-- Car-Master v0.3.12: Demo transaction backend, physically isolated from the
-- real `transactions` table exactly like demo_chat_* is isolated from
-- `chat_messages` (see 202607270001_v0310_business_messenger.sql's own
-- comment on that philosophy) — no FKs to transactions, transaction_rooms,
-- profiles or auth.users anywhere in this file. Demo login is a signed
-- cookie only (lib/demo-session.ts), never a real Supabase Auth session, so
-- every request here reaches Postgres as `anon` with no auth.uid() to trust.
-- Unlike demo_chat_messages (anon has direct insert), every mutation here
-- goes through a SECURITY DEFINER RPC that validates an explicit p_role
-- parameter against the same forward/backward-one-step state machine as
-- services/transaction-state-service.ts and the real transition_transaction_*
-- RPCs — anon has select only on the tables themselves. The client-declared
-- role is not cryptographically verified (there is no real identity to
-- verify it against, same accepted tradeoff as demo_chat_messages.sender_role),
-- but the RPC still refuses to skip stages or let a dealer progress work,
-- which is the actual UI-breaking bug this migration exists to fix — not a
-- defense against a hostile client, exactly like demo_chat_messages' own
-- documented trust boundary.

create table if not exists public.demo_transactions (
  id text primary key,
  dealer_id text not null,
  installer_id text not null,
  installer_name text not null,
  vehicle jsonb not null default '{}'::jsonb,
  service jsonb not null default '{}'::jsonb,
  pricing jsonb not null default '{"paymentStatus":"미결제"}'::jsonb,
  schedule jsonb not null default '{}'::jsonb,
  stage text not null default '견적' check (stage in ('견적','시공예약','입고','작업완료','취소')),
  hidden_by_dealer boolean not null default false,
  hidden_by_installer boolean not null default false,
  last_message text not null default '',
  chat_room_id text not null references public.demo_chat_rooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_transactions_updated_at_idx on public.demo_transactions (updated_at desc);

create table if not exists public.demo_transaction_stage_events (
  id bigint generated always as identity primary key,
  transaction_id text not null references public.demo_transactions(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  actor_role text not null check (actor_role in ('dealer','shop','admin')),
  direction text not null check (direction in ('forward','backward')),
  created_at timestamptz not null default now()
);

create index if not exists demo_transaction_stage_events_transaction_id_idx
  on public.demo_transaction_stage_events (transaction_id, created_at);

alter table public.demo_transactions enable row level security;
alter table public.demo_transaction_stage_events enable row level security;

drop policy if exists "demo transactions anon read" on public.demo_transactions;
create policy "demo transactions anon read" on public.demo_transactions for select to anon using (true);
drop policy if exists "demo transaction stage events anon read" on public.demo_transaction_stage_events;
create policy "demo transaction stage events anon read" on public.demo_transaction_stage_events for select to anon using (true);

-- No insert/update/delete grant to anon on either table — every mutation
-- goes through the SECURITY DEFINER RPCs below, matching the real
-- `transactions` table's own "no direct writes" invariant.
revoke all on public.demo_transactions from public, authenticated;
revoke all on public.demo_transaction_stage_events from public, authenticated;
grant select on public.demo_transactions to anon;
grant select on public.demo_transaction_stage_events to anon;

-- ---------------------------------------------------------------------------
-- RPCs — mirror the shape and stage-machine rules of create_transaction_with_room
-- / transition_transaction_stage / set_transaction_final_price /
-- transition_transaction_payment / set_transaction_visibility
-- (202607260001_v039_transaction_workflow.sql, 202607220001_v036_production_connection.sql)
-- exactly, with auth.uid()-based role lookups replaced by an explicit
-- p_role/p_actor_id parameter.
-- ---------------------------------------------------------------------------

-- Demo ids are generated server-side (not client-supplied) so two browsers
-- creating a demo transaction at the same moment can never collide, and so
-- the id is unmistakably demo-namespaced (CM-DEMO-NNNN), never overlapping
-- the real id format (CM-YYYYMMDD-NNNN from create_transaction_with_room).
create sequence if not exists public.demo_transaction_number_seq start 6;

create or replace function public.demo_create_transaction_with_room(
  p_dealer_id text, p_installer_id text, p_installer_name text,
  p_vehicle jsonb, p_service jsonb, p_pricing jsonb, p_schedule jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  transaction_id text;
  room_id text;
  initial_message_id uuid;
begin
  if p_dealer_id is null or p_installer_id is null or p_installer_name is null then
    raise exception 'Missing required transaction fields';
  end if;

  transaction_id := 'CM-DEMO-' || lpad(nextval('public.demo_transaction_number_seq')::text, 4, '0');
  room_id := 'CHAT-' || transaction_id;
  insert into public.demo_chat_rooms (id, transaction_id) values (room_id, transaction_id);

  insert into public.demo_transactions (
    id, dealer_id, installer_id, installer_name, vehicle, service, pricing, schedule,
    stage, last_message, chat_room_id
  ) values (
    transaction_id, p_dealer_id, p_installer_id, p_installer_name,
    coalesce(p_vehicle, '{}'::jsonb), coalesce(p_service, '{}'::jsonb),
    coalesce(p_pricing, '{}'::jsonb) || jsonb_build_object('paymentStatus', '미결제'),
    coalesce(p_schedule, '{}'::jsonb),
    '견적', '새 시공 요청이 접수되었습니다.', room_id
  );

  insert into public.demo_chat_messages (room_id, sender_id, sender_role, text)
    values (room_id, 'system', 'system', '거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.')
    returning id into initial_message_id;

  insert into public.demo_transaction_stage_events (transaction_id, from_stage, to_stage, actor_role, direction)
    values (transaction_id, null, '견적', 'dealer', 'forward');

  return jsonb_build_object('transactionId', transaction_id, 'roomId', room_id, 'messageId', initial_message_id);
end;
$$;

revoke all on function public.demo_create_transaction_with_room(text, text, text, jsonb, jsonb, jsonb, jsonb) from public, authenticated;
grant execute on function public.demo_create_transaction_with_room(text, text, text, jsonb, jsonb, jsonb, jsonb) to anon;

create or replace function public.demo_transition_transaction_stage(p_transaction_id text, p_next_stage text, p_actor_role text)
returns public.demo_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_transaction public.demo_transactions;
  stage_order text[] := array['견적', '시공예약', '입고', '작업완료'];
  current_idx int;
  next_idx int;
  old_stage text;
  event_direction text;
begin
  select * into current_transaction from public.demo_transactions where id = p_transaction_id for update;
  if current_transaction.id is null then raise exception 'Transaction not found'; end if;
  if p_actor_role not in ('dealer', 'shop', 'admin') then raise exception 'Invalid actor role'; end if;

  if p_next_stage = '취소' then
    if p_actor_role not in ('dealer', 'admin') then raise exception 'Only the dealer or an administrator can cancel a transaction'; end if;
    old_stage := current_transaction.stage;
    update public.demo_transactions set stage = '취소', updated_at = now() where id = p_transaction_id
      returning * into current_transaction;
    insert into public.demo_transaction_stage_events (transaction_id, from_stage, to_stage, actor_role, direction)
      values (p_transaction_id, old_stage, '취소', p_actor_role, 'forward');
    return current_transaction;
  end if;

  if p_actor_role not in ('shop', 'admin') then
    raise exception 'Only the assigned installer or an administrator can change the work stage';
  end if;

  current_idx := array_position(stage_order, current_transaction.stage);
  next_idx := array_position(stage_order, p_next_stage);
  if current_idx is null or next_idx is null or abs(next_idx - current_idx) <> 1 then
    raise exception 'Invalid transaction stage transition';
  end if;
  event_direction := case when next_idx > current_idx then 'forward' else 'backward' end;
  old_stage := current_transaction.stage;

  update public.demo_transactions
  set stage = p_next_stage,
      schedule = case
        when p_next_stage = '작업완료' then jsonb_set(schedule, '{completedAt}', to_jsonb(now()::text), true)
        when old_stage = '작업완료' then schedule - 'completedAt'
        else schedule
      end,
      updated_at = now()
  where id = p_transaction_id
  returning * into current_transaction;

  insert into public.demo_transaction_stage_events (transaction_id, from_stage, to_stage, actor_role, direction)
    values (p_transaction_id, old_stage, p_next_stage, p_actor_role, event_direction);

  return current_transaction;
end;
$$;

revoke all on function public.demo_transition_transaction_stage(text, text, text) from public, authenticated;
grant execute on function public.demo_transition_transaction_stage(text, text, text) to anon;

create or replace function public.demo_set_transaction_final_price(p_transaction_id text, p_final_price numeric, p_actor_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.demo_transactions;
begin
  if p_final_price is null or p_final_price <= 0 or p_final_price > 100000000 then
    raise exception 'Invalid final price';
  end if;
  select * into target from public.demo_transactions where id = p_transaction_id for update;
  if target.id is null then raise exception 'Transaction not found'; end if;
  if p_actor_role not in ('shop', 'admin') then
    raise exception 'Only the assigned installer or an administrator can set the final price';
  end if;
  if target.stage in ('작업완료', '취소') then raise exception 'Closed transactions cannot change price'; end if;

  update public.demo_transactions
  set pricing = jsonb_set(pricing, '{finalPrice}', to_jsonb(p_final_price), true), updated_at = now()
  where id = p_transaction_id;
end;
$$;

revoke all on function public.demo_set_transaction_final_price(text, numeric, text) from public, authenticated;
grant execute on function public.demo_set_transaction_final_price(text, numeric, text) to anon;

create or replace function public.demo_transition_transaction_payment(p_transaction_id text, p_next_status text, p_actor_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.demo_transactions;
  current_status text;
  allowed boolean := false;
begin
  select * into target from public.demo_transactions where id = p_transaction_id for update;
  if target.id is null then raise exception 'Transaction not found'; end if;
  if p_actor_role not in ('dealer', 'shop', 'admin') then raise exception 'Invalid actor role'; end if;
  current_status := coalesce(target.pricing ->> 'paymentStatus', '미결제');
  allowed :=
    (current_status = '미결제' and p_next_status = '결제대기' and p_actor_role in ('dealer', 'shop')) or
    (current_status = '결제대기' and p_next_status = '결제완료' and p_actor_role in ('dealer', 'admin')) or
    (current_status = '결제완료' and p_next_status = '정산대기' and p_actor_role = 'admin') or
    (current_status = '정산대기' and p_next_status = '정산완료' and p_actor_role = 'admin');
  if not allowed then raise exception 'Invalid payment status transition'; end if;

  update public.demo_transactions
  set pricing = jsonb_set(
        case when p_next_status = '결제완료'
          then jsonb_set(pricing, '{paymentAt}', to_jsonb(now()::text), true)
          else pricing end,
        '{paymentStatus}', to_jsonb(p_next_status), true
      ),
      updated_at = now()
  where id = p_transaction_id;
end;
$$;

revoke all on function public.demo_transition_transaction_payment(text, text, text) from public, authenticated;
grant execute on function public.demo_transition_transaction_payment(text, text, text) to anon;

create or replace function public.demo_set_transaction_visibility(p_transaction_id text, p_hidden boolean, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_role not in ('dealer', 'shop') then raise exception 'Invalid role'; end if;
  if not exists (select 1 from public.demo_transactions where id = p_transaction_id) then
    raise exception 'Transaction not found';
  end if;
  if p_role = 'dealer' then
    update public.demo_transactions set hidden_by_dealer = p_hidden, updated_at = now() where id = p_transaction_id;
  else
    update public.demo_transactions set hidden_by_installer = p_hidden, updated_at = now() where id = p_transaction_id;
  end if;
end;
$$;

revoke all on function public.demo_set_transaction_visibility(text, boolean, text) from public, authenticated;
grant execute on function public.demo_set_transaction_visibility(text, boolean, text) to anon;

-- A shared demo_transactions row can no longer be "touched" (last_message /
-- updated_at) by a client-side localStorage update the way the old
-- single-browser model did — the client has no UPDATE grant on
-- demo_transactions at all (RPC-only, see above). This trigger does it
-- server-side instead, so repositories/demo-chat-repository.ts's existing
-- addMessage() (unchanged) keeps working without app/page.tsx needing any
-- extra write call.
create or replace function public.demo_touch_transaction_from_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_transaction_id text;
begin
  select transaction_id into target_transaction_id from public.demo_chat_rooms where id = new.room_id;
  if target_transaction_id is not null then
    update public.demo_transactions
    set last_message = case when new.text <> '' then new.text when jsonb_array_length(new.attachments) > 0 then '사진을 보냈습니다' else last_message end,
        updated_at = new.created_at
    where id = target_transaction_id;
  end if;
  return new;
end;
$$;

drop trigger if exists demo_chat_messages_touch_transaction on public.demo_chat_messages;
create trigger demo_chat_messages_touch_transaction
  after insert on public.demo_chat_messages
  for each row execute function public.demo_touch_transaction_from_message();

-- ---------------------------------------------------------------------------
-- Realtime + seed data
-- ---------------------------------------------------------------------------

do $$
declare
  target text;
begin
  foreach target in array array['demo_transactions', 'demo_transaction_stage_events']
  loop
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      where p.pubname = 'supabase_realtime' and c.relname = target and c.relnamespace = 'public'::regnamespace
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end $$;

-- Bring the existing fixed seed transaction (CM-DEMO-0001 / CHAT-DEMO-0001,
-- previously only computed client-side in
-- repositories/transaction-repository.ts's DEMO_SEED_TRANSACTIONS) into the
-- shared backend so it behaves identically to every other demo transaction
-- going forward, plus a small, clearly-fictional set of additional fixtures
-- per the "few natural transactions, not a flood of fake data" guidance —
-- one new request, one today-inbound, one in-progress, one completed.
insert into public.demo_transactions (id, dealer_id, installer_id, installer_name, vehicle, service, pricing, schedule, stage, hidden_by_dealer, hidden_by_installer, last_message, chat_room_id, created_at, updated_at)
values
  ('CM-DEMO-0001', 'hanjaejin-dealer', 'SHOP-MISA-001', '미사 스타힐스 시공점',
   '{"maker":"BMW","model":"X5","class":"수입 대형/SUV"}'::jsonb,
   '{"brand":"버텍스","product":"카본 스텔스","workDescription":"전면 유리 & 사이드 썬팅","extraRequest":""}'::jsonb,
   '{"baseGuidePrice":450000,"surcharge":0,"paymentStatus":"미결제"}'::jsonb,
   '{"requestedInboundAt":"2026-07-29","confirmedInboundAt":"2026-07-29T10:00:00.000Z"}'::jsonb,
   '시공예약', false, false, '시공예약이 확정되었습니다. 7월 29일 오전 10:00', 'CHAT-DEMO-0001',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:05.000Z'),
  ('CM-DEMO-0002', 'hanjaejin-dealer', 'SHOP-MISA-001', '미사 스타힐스 시공점',
   '{"maker":"제네시스","model":"GV80","class":"수입 대형/SUV"}'::jsonb,
   '{"brand":"","product":"","workDescription":"전면 PPF","extraRequest":"출고 직후 차량, 신차 상태 유지 요청"}'::jsonb,
   '{"paymentStatus":"미결제"}'::jsonb,
   '{"requestedInboundAt":"2026-08-02"}'::jsonb,
   '견적', false, false, '새 시공 요청이 접수되었습니다.', 'CHAT-DEMO-0002',
   '2026-01-01T01:00:00.000Z', '2026-01-01T01:00:00.000Z'),
  ('CM-DEMO-0003', 'hanjaejin-dealer', 'SHOP-MISA-001', '미사 스타힐스 시공점',
   '{"maker":"현대","model":"팰리세이드","class":"국산 대형/SUV"}'::jsonb,
   '{"brand":"","product":"","workDescription":"루프랩 시공","extraRequest":""}'::jsonb,
   '{"baseGuidePrice":320000,"surcharge":0,"paymentStatus":"미결제"}'::jsonb,
   '{"requestedInboundAt":"2026-08-01","confirmedInboundAt":"2026-08-01T13:30:00.000Z"}'::jsonb,
   '시공예약', false, false, '시공예약이 확정되었습니다. 8월 1일 오후 1:30', 'CHAT-DEMO-0003',
   '2026-01-01T02:00:00.000Z', '2026-01-01T02:00:05.000Z'),
  ('CM-DEMO-0004', 'hanjaejin-dealer', 'SHOP-MISA-001', '미사 스타힐스 시공점',
   '{"maker":"BMW","model":"520i","class":"수입 중형"}'::jsonb,
   '{"brand":"","product":"","workDescription":"블랙박스 설치","extraRequest":""}'::jsonb,
   '{"baseGuidePrice":250000,"surcharge":0,"paymentStatus":"미결제"}'::jsonb,
   '{"requestedInboundAt":"2026-07-31","confirmedInboundAt":"2026-07-31T11:20:00.000Z"}'::jsonb,
   '입고', false, false, '차량이 입고되었습니다.', 'CHAT-DEMO-0004',
   '2026-01-01T03:00:00.000Z', '2026-01-01T03:00:05.000Z'),
  ('CM-DEMO-0005', 'hanjaejin-dealer', 'SHOP-MISA-001', '미사 스타힐스 시공점',
   '{"maker":"기아","model":"쏘렌토","class":"국산 중형/SUV"}'::jsonb,
   '{"brand":"","product":"","workDescription":"윈도우 썬팅","extraRequest":""}'::jsonb,
   '{"baseGuidePrice":280000,"surcharge":0,"finalPrice":280000,"paymentStatus":"정산완료","paymentAt":"2026-01-01T04:30:00.000Z"}'::jsonb,
   '{"requestedInboundAt":"2026-07-28","confirmedInboundAt":"2026-07-28T09:00:00.000Z","completedAt":"2026-07-28T15:00:00.000Z"}'::jsonb,
   '작업완료', false, false, '작업이 완료되었습니다.', 'CHAT-DEMO-0005',
   '2026-01-01T04:00:00.000Z', '2026-01-01T04:30:00.000Z')
on conflict (id) do nothing;

insert into public.demo_chat_rooms (id, transaction_id, created_at, updated_at)
values
  ('CHAT-DEMO-0002', 'CM-DEMO-0002', '2026-01-01T01:00:00.000Z', '2026-01-01T01:00:00.000Z'),
  ('CHAT-DEMO-0003', 'CM-DEMO-0003', '2026-01-01T02:00:00.000Z', '2026-01-01T02:00:05.000Z'),
  ('CHAT-DEMO-0004', 'CM-DEMO-0004', '2026-01-01T03:00:00.000Z', '2026-01-01T03:00:05.000Z'),
  ('CHAT-DEMO-0005', 'CM-DEMO-0005', '2026-01-01T04:00:00.000Z', '2026-01-01T04:30:00.000Z')
on conflict (id) do nothing;

insert into public.demo_chat_messages (room_id, sender_id, sender_role, text, client_message_id, created_at)
values
  ('CHAT-DEMO-0002', 'system', 'system', '거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.', 'SEED-DEMO-0201', '2026-01-01T01:00:00.000Z'),
  ('CHAT-DEMO-0003', 'system', 'system', '거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.', 'SEED-DEMO-0301', '2026-01-01T02:00:00.000Z'),
  ('CHAT-DEMO-0003', 'SHOP-MISA-001', 'shop', '시공예약이 확정되었습니다. 8월 1일 오후 1:30에 뵙겠습니다.', 'SEED-DEMO-0302', '2026-01-01T02:00:05.000Z'),
  ('CHAT-DEMO-0004', 'system', 'system', '거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.', 'SEED-DEMO-0401', '2026-01-01T03:00:00.000Z'),
  ('CHAT-DEMO-0004', 'SHOP-MISA-001', 'shop', '차량이 입고되었습니다. 작업 시작하겠습니다.', 'SEED-DEMO-0402', '2026-01-01T03:00:05.000Z'),
  ('CHAT-DEMO-0005', 'system', 'system', '거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.', 'SEED-DEMO-0501', '2026-01-01T04:00:00.000Z'),
  ('CHAT-DEMO-0005', 'SHOP-MISA-001', 'shop', '작업이 완료되었습니다. 확인 부탁드립니다.', 'SEED-DEMO-0502', '2026-01-01T04:30:00.000Z')
on conflict (room_id, client_message_id) do nothing;

-- demo_transaction_stage_events has no natural unique key to key an ON
-- CONFLICT off of, so idempotency is guarded explicitly here instead —
-- CM-DEMO-0002 only ever comes from this migration, so its absence means
-- this whole seed batch (including CM-DEMO-0001's two events) hasn't run yet.
do $$
begin
  if not exists (select 1 from public.demo_transaction_stage_events where transaction_id = 'CM-DEMO-0002') then
    insert into public.demo_transaction_stage_events (transaction_id, from_stage, to_stage, actor_role, direction, created_at)
    values
      ('CM-DEMO-0001', null, '견적', 'dealer', 'forward', '2026-01-01T00:00:00.000Z'),
      ('CM-DEMO-0001', '견적', '시공예약', 'shop', 'forward', '2026-01-01T00:00:05.000Z'),
      ('CM-DEMO-0002', null, '견적', 'dealer', 'forward', '2026-01-01T01:00:00.000Z'),
      ('CM-DEMO-0003', null, '견적', 'dealer', 'forward', '2026-01-01T02:00:00.000Z'),
      ('CM-DEMO-0003', '견적', '시공예약', 'shop', 'forward', '2026-01-01T02:00:05.000Z'),
      ('CM-DEMO-0004', null, '견적', 'dealer', 'forward', '2026-01-01T03:00:00.000Z'),
      ('CM-DEMO-0004', '견적', '시공예약', 'shop', 'forward', '2026-01-01T03:00:03.000Z'),
      ('CM-DEMO-0004', '시공예약', '입고', 'shop', 'forward', '2026-01-01T03:00:05.000Z'),
      ('CM-DEMO-0005', null, '견적', 'dealer', 'forward', '2026-01-01T04:00:00.000Z'),
      ('CM-DEMO-0005', '견적', '시공예약', 'shop', 'forward', '2026-01-01T04:00:03.000Z'),
      ('CM-DEMO-0005', '시공예약', '입고', 'shop', 'forward', '2026-01-01T04:15:00.000Z'),
      ('CM-DEMO-0005', '입고', '작업완료', 'shop', 'forward', '2026-01-01T04:30:00.000Z');
  end if;
end $$;
