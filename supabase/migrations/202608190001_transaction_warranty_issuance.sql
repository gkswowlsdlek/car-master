-- Car-Master: 보증서 발급 정보 관리 (E2E에서 발견된 필수 업무 흐름).
--
-- 문제: 딜러가 시공 요청을 만드는 시점엔 아직 고객명/연락처/정식 차량번호가
-- 없는 경우가 흔하다(ServiceRequestForm은 이미 이 정보를 요구하지 않는다 —
-- 변경 없음). 빠진 절반: 입고~출고 사이에 딜러가 이 정보를 나중에 채워 넣고,
-- 시공점이 구조화된 형태로 받아 "발급 완료" 처리할 방법이 없었다.
--
-- 설계는 기존 contact_status(202608130005_phone_contact_result.sql)를 그대로
-- 복제한다: nullable 컬럼 + SECURITY DEFINER RPC(4분기 권한 체크 + system
-- 채팅 메시지 삽입) + transactions는 UPDATE grant가 전면 회수돼 있으므로
-- (202607220001) 모든 쓰기는 RPC를 통해서만.
--
-- 핵심 결정 1: warranty_status는 컬럼으로 저장하지 않는다. 항상 파생한다 —
-- warranty_issued_at이 있으면 ISSUED, 아니면 customer_name/customer_phone/
-- vehicle_number 셋 다 있으면 READY, 아니면 NOT_READY. "필드는 바꿨는데
-- 상태 갱신을 깜빡함" 부류의 버그를 구조적으로 없앤다. TS 쪽 파생 함수는
-- services/transaction-state-service.ts의 warrantyStatus().
--
-- 핵심 결정 2: RLS는 전혀 건드리지 않는다. transactions의 기존 select
-- 정책(dealer_id = auth.uid() OR installer_id = auth.uid() OR (shop_id 있고
-- has_active_shop_membership) OR is_admin())이 "해당 거래를 만든 딜러 /
-- 담당 시공점의 허용된 멤버 / Admin만 조회 가능"과 이미 1:1로 일치한다.
-- get_transaction_contact류의 RPC 전용 컬럼 게이팅이 필요했던 이유는 그게
-- *다른 테이블*(각자 자기 RLS가 있는 dealer_profiles/installer_profiles)을
-- 조인해야 했기 때문 — 이번 컬럼은 이미 올바르게 스코프된 transactions 행
-- 자체에 얹히므로 행 단위 RLS로 충분하다.
--
-- Demo 백엔드 범위: contact_status가 세운 선례를 그대로 따른다 — Demo(로컬/
-- 공유 모두)는 이 마이그레이션의 RPC를 호출하지 않고 클라이언트 로컬 상태
-- 갱신으로 대체한다(hooks/use-transaction-actions.ts). demo_transactions
-- 테이블과 그쪽 RPC는 건드리지 않는다.

begin;

-- 1. 컬럼 8개 추가. 전부 nullable 또는 안전한 기본값 — 기존 행에 영향 없음.
alter table public.transactions
  add column dealer_name text not null default '',
  add column dealer_company_name text not null default '',
  add column customer_name text,
  add column customer_phone text,
  add column vehicle_number text,
  add column vin text,
  add column warranty_info_submitted_at timestamptz,
  add column warranty_issued_at timestamptz;

-- 기존 행 백필 — dealer_name/company만(나머지는 원래 없던 정보라 null 유지가 맞다).
update public.transactions t
set dealer_name = dp.name, dealer_company_name = coalesce(dp.company_name, '')
from public.dealer_profiles dp
where dp.user_id = t.dealer_id;

-- 2. create_transaction_with_room — 202607260001의 최종본과 동일하되,
--    auth.uid()의 dealer_profiles에서 name/company_name을 조회해 스냅샷으로
--    함께 저장하는 부분만 추가(기존 installer_name 스냅샷과 대칭되는 필드 —
--    "시공점 작업목록에서 담당 딜러를 실제 계정 관계로 표시" 요구사항).
--    나머지 로직(권한 체크, room 생성, system 메시지, stage_events insert)은
--    완전히 동일.
create or replace function public.create_transaction_with_room(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
  target_installer uuid := (payload ->> 'installerId')::uuid;
  target_name text;
  v_dealer_name text;
  v_dealer_company_name text;
  transaction_id text;
  room_id uuid;
  initial_message_id uuid;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'dealer'::public.user_role then
    raise exception 'Only dealers can create transactions';
  end if;

  select installer.shop_name into target_name
  from public.installer_profiles installer
  join public.installer_approvals approval on approval.user_id = installer.user_id
  where installer.user_id = target_installer
    and approval.status = 'approved'
    and installer.accepting_requests = true;

  if target_name is null then raise exception 'Installer is not available'; end if;

  select dp.name, coalesce(dp.company_name, '') into v_dealer_name, v_dealer_company_name
  from public.dealer_profiles dp where dp.user_id = auth.uid();

  transaction_id := 'CM-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.transaction_number_seq')::text, 4, '0');

  insert into public.transactions (
    id, dealer_id, installer_id, installer_name, dealer_name, dealer_company_name,
    vehicle, service, pricing, schedule, stage, last_message
  ) values (
    transaction_id, auth.uid(), target_installer, target_name,
    coalesce(v_dealer_name, ''), coalesce(v_dealer_company_name, ''),
    coalesce(payload -> 'vehicle', '{}'::jsonb), coalesce(payload -> 'service', '{}'::jsonb),
    coalesce(payload -> 'pricing', '{}'::jsonb), coalesce(payload -> 'schedule', '{}'::jsonb),
    '견적', '새 시공 요청이 접수되었습니다.'
  );

  insert into public.transaction_rooms (transaction_id) values (transaction_id) returning id into room_id;
  insert into public.chat_messages (room_id, sender_role, text)
    values (room_id, 'system', '거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.')
    returning id into initial_message_id;

  insert into public.transaction_stage_events (transaction_id, from_stage, to_stage, actor_role, actor_id, direction)
    values (transaction_id, null, '견적', 'dealer', auth.uid(), 'forward');

  return jsonb_build_object('transactionId', transaction_id, 'roomId', room_id, 'messageId', initial_message_id);
end;
$$;

revoke all on function public.create_transaction_with_room(jsonb) from public, anon;
grant execute on function public.create_transaction_with_room(jsonb) to authenticated;

-- 3. create_shop_transaction_with_room — 202608120002의 최종본과 동일한 방식으로 확장.
create or replace function public.create_shop_transaction_with_room(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
  target_shop_id uuid := (payload ->> 'shopId')::uuid;
  target_installer uuid;
  target_name text;
  v_dealer_name text;
  v_dealer_company_name text;
  transaction_id text;
  room_id uuid;
  initial_message_id uuid;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'dealer'::public.user_role then
    raise exception 'Only dealers can create transactions';
  end if;

  select shop.shop_name, shop.legacy_installer_user_id into target_name, target_installer
  from public.installer_shops shop
  where shop.id = target_shop_id
    and shop.approval_status = 'approved'::public.installer_approval_status
    and shop.accepting_requests = true;

  if target_name is null then raise exception 'Shop is not available'; end if;

  select dp.name, coalesce(dp.company_name, '') into v_dealer_name, v_dealer_company_name
  from public.dealer_profiles dp where dp.user_id = auth.uid();

  transaction_id := 'CM-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.transaction_number_seq')::text, 4, '0');

  insert into public.transactions (
    id, dealer_id, installer_id, shop_id, installer_name, dealer_name, dealer_company_name,
    vehicle, service, pricing, schedule, stage, last_message
  ) values (
    transaction_id, auth.uid(), target_installer, target_shop_id, target_name,
    coalesce(v_dealer_name, ''), coalesce(v_dealer_company_name, ''),
    coalesce(payload -> 'vehicle', '{}'::jsonb), coalesce(payload -> 'service', '{}'::jsonb),
    coalesce(payload -> 'pricing', '{}'::jsonb), coalesce(payload -> 'schedule', '{}'::jsonb),
    '견적', '새 시공 요청이 접수되었습니다.'
  );

  insert into public.transaction_rooms (transaction_id) values (transaction_id) returning id into room_id;
  insert into public.chat_messages (room_id, sender_role, text)
    values (room_id, 'system', '거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.')
    returning id into initial_message_id;

  insert into public.transaction_stage_events (transaction_id, from_stage, to_stage, actor_role, actor_id, direction)
    values (transaction_id, null, '견적', 'dealer', auth.uid(), 'forward');

  return jsonb_build_object('transactionId', transaction_id, 'roomId', room_id, 'messageId', initial_message_id);
end;
$$;

revoke all on function public.create_shop_transaction_with_room(jsonb) from public, anon;
grant execute on function public.create_shop_transaction_with_room(jsonb) to authenticated;

-- 4. set_transaction_warranty_info — 딜러(본인 거래) 또는 admin만. 부분 저장을
--    허용한다(3개 다 없어도 저장은 성공 — "VIN만 먼저 등록" 시나리오를 위해
--    필수). "제출 차단"은 예외를 던지는 것이 아니라 결과 상태가 READY에
--    도달하지 못하는 것으로 표현된다 — 프론트엔드가 반환된 행을 보고 안내
--    문구를 고른다. 고객명/연락처는 절대 시스템 메시지 본문에 넣지 않는다.
create or replace function public.set_transaction_warranty_info(
  p_transaction_id text,
  p_customer_name text,
  p_customer_phone text,
  p_vehicle_number text,
  p_vin text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.transactions;
  caller_role public.user_role;
  room_id uuid;
  was_ready boolean;
  now_ready boolean;
  n_customer_name text := nullif(trim(p_customer_name), '');
  n_customer_phone text := nullif(trim(p_customer_phone), '');
  n_vehicle_number text := nullif(trim(p_vehicle_number), '');
  n_vin text := nullif(trim(p_vin), '');
begin
  select * into target from public.transactions where id = p_transaction_id for update;
  if target.id is null then raise exception 'Transaction not found'; end if;

  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role = 'admin'::public.user_role then
    null;
  elsif caller_role = 'dealer'::public.user_role then
    if target.dealer_id <> auth.uid() then raise exception 'Transaction access denied'; end if;
  else
    raise exception 'Only the dealer or an administrator can set warranty info';
  end if;

  was_ready := target.customer_name is not null and target.customer_phone is not null and target.vehicle_number is not null;
  now_ready := n_customer_name is not null and n_customer_phone is not null and n_vehicle_number is not null;

  update public.transactions
  set customer_name = n_customer_name,
      customer_phone = n_customer_phone,
      vehicle_number = n_vehicle_number,
      vin = n_vin,
      warranty_info_submitted_at = case
        when now_ready and not was_ready then now()
        else warranty_info_submitted_at
      end,
      updated_at = now()
  where id = p_transaction_id
  returning * into target;

  select id into room_id from public.transaction_rooms where transaction_id = p_transaction_id;
  if room_id is not null then
    insert into public.chat_messages (room_id, sender_role, text)
    values (room_id, 'system', '딜러가 보증서 발급 정보를 등록했습니다.');
  end if;

  return target;
end;
$$;

revoke all on function public.set_transaction_warranty_info(text, text, text, text, text) from public, anon;
grant execute on function public.set_transaction_warranty_info(text, text, text, text, text) to authenticated;

-- 5. issue_transaction_warranty — 시공점(담당 installer_id 또는 shop_id의
--    active 멤버) 또는 admin만. 고객명/연락처/차량번호가 셋 다 없으면 예외 —
--    "정보 없이 작업 완료해도 잘못 ISSUED 처리되지 않는다"를 서버에서 강제.
--    이미 발급된 건 재발급 방지.
create or replace function public.issue_transaction_warranty(p_transaction_id text)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.transactions;
  caller_role public.user_role;
  room_id uuid;
begin
  select * into target from public.transactions where id = p_transaction_id for update;
  if target.id is null then raise exception 'Transaction not found'; end if;

  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role = 'admin'::public.user_role then
    null;
  elsif caller_role = 'installer'::public.user_role then
    if target.installer_id <> auth.uid()
      and not (target.shop_id is not null and public.has_active_shop_membership(target.shop_id)) then
      raise exception 'Transaction access denied';
    end if;
  else
    raise exception 'Only the assigned shop or an administrator can issue a warranty';
  end if;

  if target.warranty_issued_at is not null then
    raise exception 'Warranty already issued';
  end if;
  if target.customer_name is null or target.customer_phone is null or target.vehicle_number is null then
    raise exception 'Warranty info is not ready yet';
  end if;

  update public.transactions
  set warranty_issued_at = now(), updated_at = now()
  where id = p_transaction_id
  returning * into target;

  select id into room_id from public.transaction_rooms where transaction_id = p_transaction_id;
  if room_id is not null then
    insert into public.chat_messages (room_id, sender_role, text)
    values (room_id, 'system', '시공점이 보증서 발급을 완료했습니다.');
  end if;

  return target;
end;
$$;

revoke all on function public.issue_transaction_warranty(text) from public, anon;
grant execute on function public.issue_transaction_warranty(text) to authenticated;

commit;
