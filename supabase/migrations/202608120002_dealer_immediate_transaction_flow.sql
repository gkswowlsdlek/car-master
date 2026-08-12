-- Car-Master: Dealer immediate-transaction Phase 1.
--
-- Product direction: in free Beta, a Dealer selecting a Shop creates the
-- transaction (and its room) immediately — there is no Installer
-- accept/reject gate, and a Shop with no linked Installer Account must be a
-- fully valid transaction counterpart. This migration is additive: existing
-- installer_id-keyed transactions, RPCs and RLS keep working unchanged; a
-- parallel shop_id-keyed path is added alongside them.

begin;

-- 1. transactions.installer_id can no longer be NOT NULL — an admin
--    pre-registered Shop with no linked auth account must be a valid
--    transaction counterpart. shop_id (added in Account Foundation B1) is
--    now the field every transaction is guaranteed to carry.
alter table public.transactions
  alter column installer_id drop not null;

alter table public.transactions
  add constraint transactions_installer_or_shop_check
  check (installer_id is not null or shop_id is not null);

-- 2. Membership-based access helper — lets a Shop's connected, approved
--    operator (shop_memberships, Account Foundation A) reach a transaction
--    even when the legacy installer_id column is null. Every existing
--    legacy Shop already has an 'owner' membership row for its own
--    installer_id, so this is additive and changes no existing behavior.
create or replace function public.has_active_shop_membership(p_shop_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shop_memberships membership
    where membership.shop_id = p_shop_id
      and membership.user_id = p_user_id
      and membership.status = 'active'::public.shop_membership_status
  );
$$;

revoke all on function public.has_active_shop_membership(uuid, uuid) from public, anon;
grant execute on function public.has_active_shop_membership(uuid, uuid) to authenticated;

-- 3. can_access_transaction (gates transaction_rooms/chat_messages RLS) and
--    the transactions table's own select policy both learn the shop_id path.
create or replace function public.can_access_transaction(check_transaction_id text, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.transactions transaction
    where transaction.id = check_transaction_id
      and (
        transaction.dealer_id = check_user_id
        or transaction.installer_id = check_user_id
        or (transaction.shop_id is not null and public.has_active_shop_membership(transaction.shop_id, check_user_id))
        or public.is_admin(check_user_id)
      )
  );
$$;

drop policy if exists "transaction participants select" on public.transactions;
create policy "transaction participants select" on public.transactions
  for select to authenticated using (
    dealer_id = auth.uid()
    or installer_id = auth.uid()
    or (shop_id is not null and public.has_active_shop_membership(shop_id))
    or public.is_admin()
  );

-- 4. guard_transaction_insert: the same pre-insert validation, extended so a
--    shop_id-only insert (no installer_id) is validated against
--    installer_shops instead of installer_profiles/installer_approvals.
create or replace function public.guard_transaction_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'dealer'::public.user_role or new.dealer_id is distinct from auth.uid() then
    raise exception 'Only the authenticated dealer can create a transaction';
  end if;

  if new.installer_id is not null then
    if not exists (
      select 1
      from public.installer_profiles installer
      join public.installer_approvals approval on approval.user_id = installer.user_id
      where installer.user_id = new.installer_id
        and installer.accepting_requests = true
        and approval.status = 'approved'
    ) then
      raise exception 'Installer is not available';
    end if;
  elsif new.shop_id is not null then
    if not exists (
      select 1 from public.installer_shops shop
      where shop.id = new.shop_id
        and shop.approval_status = 'approved'::public.installer_approval_status
        and shop.accepting_requests = true
    ) then
      raise exception 'Shop is not available';
    end if;
  else
    raise exception 'Transaction must reference an installer or a shop';
  end if;

  new.stage := '견적';
  new.hidden_by_dealer := false;
  new.hidden_by_installer := false;
  new.pricing := (coalesce(new.pricing, '{}'::jsonb) - 'paymentAt' - 'settlementDueAt')
    || jsonb_build_object('paymentStatus', '미결제');
  return new;
end;
$$;

revoke all on function public.guard_transaction_insert() from public, anon, authenticated;

-- 5. create_shop_transaction_with_room: the Shop-centric counterpart to
--    create_transaction_with_room. No acceptance gate — the room is created
--    in the same statement as the transaction, exactly like the legacy RPC.
--    installer_id is populated from the Shop's legacy_installer_user_id when
--    one exists (keeping the existing Installer dashboard/notification path
--    working unchanged) and left null otherwise.
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

  transaction_id := 'CM-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.transaction_number_seq')::text, 4, '0');

  insert into public.transactions (
    id, dealer_id, installer_id, shop_id, installer_name, vehicle, service, pricing, schedule,
    stage, last_message
  ) values (
    transaction_id, auth.uid(), target_installer, target_shop_id, target_name,
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

-- 6. get_approved_shop_directory: the Dealer-facing directory, sourced from
--    installer_shops (every existing approved Installer already has a
--    mirrored row there, backfilled by Account Foundation A) instead of
--    installer_profiles, so admin pre-registered / no-account Shops can
--    appear too. Also returns phone, needed for the "전화 확인 필요" CTA —
--    get_approved_installer_directory is left in place, unused, rather than
--    dropped.
create or replace function public.get_approved_shop_directory()
returns table (
  id uuid, name text, address text, brands text[], works text[], hours text,
  available boolean, latitude double precision, longitude double precision, phone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select shop.id, shop.shop_name,
    trim(concat(shop.address, ' ', coalesce(shop.detail_address, ''))),
    shop.supported_brands, shop.supported_services, shop.business_hours,
    shop.accepting_requests, shop.latitude, shop.longitude,
    nullif(coalesce(nullif(shop.contact_phone, ''), shop.phone), '')
  from public.installer_shops shop
  where exists (select 1 from public.profiles caller where caller.id = auth.uid() and caller.role in ('dealer', 'admin'))
    and shop.approval_status = 'approved'::public.installer_approval_status
    and shop.accepting_requests = true
  order by shop.updated_at desc;
$$;

revoke all on function public.get_approved_shop_directory() from public, anon;
grant execute on function public.get_approved_shop_directory() to authenticated;

-- 7. get_transaction_contact: when the caller is the dealer and the
--    transaction has no installer_id (no linked Installer Account), fall
--    back to the Shop's own phone/name instead of returning nothing. The
--    shop-membership caller path mirrors #3 above. Never fabricates a
--    number — a Shop with no phone on file still returns no rows, same as
--    before.
create or replace function public.get_transaction_contact(p_transaction_id text)
returns table(contact_name text, contact_phone text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  txn record;
  is_dealer_caller boolean;
  is_shop_caller boolean;
begin
  select dealer_id, installer_id, shop_id into txn from public.transactions where id = p_transaction_id;
  if not found then raise exception 'transaction not found'; end if;
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  is_dealer_caller := auth.uid() = txn.dealer_id;
  is_shop_caller := auth.uid() = txn.installer_id
    or (txn.shop_id is not null and public.has_active_shop_membership(txn.shop_id));

  if not (is_dealer_caller or is_shop_caller or public.is_admin()) then
    raise exception 'not authorized';
  end if;

  if is_dealer_caller then
    if txn.installer_id is not null then
      return query select ip.representative_name, coalesce(nullif(ip.contact_phone, ''), ip.phone)
        from public.installer_profiles ip where ip.user_id = txn.installer_id;
    elsif txn.shop_id is not null then
      return query select shop.shop_name, coalesce(nullif(shop.contact_phone, ''), shop.phone)
        from public.installer_shops shop where shop.id = txn.shop_id;
    end if;
  else
    return query select dp.name, dp.phone from public.dealer_profiles dp where dp.user_id = txn.dealer_id;
  end if;
end;
$$;

revoke all on function public.get_transaction_contact(text) from public, anon;
grant execute on function public.get_transaction_contact(text) to authenticated;

-- 8. transition_transaction_stage: adds a terminal 출고 stage after
--    작업완료, lets the dealer drive forward/backward transitions on their
--    own transaction (previously installer/admin only — the Beta core
--    requirement is that the flow never stalls waiting on an Installer who
--    may never open Car-Master), and extends installer-side authorization to
--    a shop-membership-connected operator, not just the legacy installer_id
--    match. The completedAt schedule write is made direction-aware (it
--    previously fired on old_stage = '작업완료' regardless of direction,
--    which was harmless with 작업완료 as the last stage but would have
--    incorrectly cleared completedAt when reversing 출고 -> 작업완료).
create or replace function public.transition_transaction_stage(p_transaction_id text, p_next_stage text)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_transaction public.transactions;
  caller_role public.user_role;
  stage_order text[] := array['견적', '시공예약', '입고', '작업완료', '출고'];
  current_idx int;
  next_idx int;
  old_stage text;
  event_direction text;
begin
  select * into current_transaction
  from public.transactions
  where id = p_transaction_id
  for update;

  if current_transaction.id is null then
    raise exception 'Transaction not found';
  end if;

  select role into caller_role from public.profiles where id = auth.uid();

  if p_next_stage = '취소' then
    if caller_role not in ('dealer'::public.user_role, 'admin'::public.user_role) then
      raise exception 'Only the dealer or an administrator can cancel a transaction';
    end if;
    if caller_role = 'dealer'::public.user_role and current_transaction.dealer_id <> auth.uid() then
      raise exception 'Transaction access denied';
    end if;
    old_stage := current_transaction.stage;
    update public.transactions set stage = '취소', updated_at = now() where id = p_transaction_id
      returning * into current_transaction;
    insert into public.transaction_stage_events (transaction_id, from_stage, to_stage, actor_role, actor_id, direction)
      values (p_transaction_id, old_stage, '취소', caller_role, auth.uid(), 'forward');
    return current_transaction;
  end if;

  if caller_role = 'admin'::public.user_role then
    null;
  elsif caller_role = 'dealer'::public.user_role then
    if current_transaction.dealer_id <> auth.uid() then
      raise exception 'Transaction access denied';
    end if;
  elsif caller_role = 'installer'::public.user_role then
    if current_transaction.installer_id <> auth.uid()
      and not (current_transaction.shop_id is not null and public.has_active_shop_membership(current_transaction.shop_id)) then
      raise exception 'Transaction access denied';
    end if;
  else
    raise exception 'Only the dealer, the assigned shop or an administrator can change the work stage';
  end if;

  current_idx := array_position(stage_order, current_transaction.stage);
  next_idx := array_position(stage_order, p_next_stage);
  if current_idx is null or next_idx is null or abs(next_idx - current_idx) <> 1 then
    raise exception 'Invalid transaction stage transition';
  end if;
  event_direction := case when next_idx > current_idx then 'forward' else 'backward' end;
  old_stage := current_transaction.stage;

  update public.transactions
  set stage = p_next_stage,
      schedule = case
        when p_next_stage = '작업완료' then jsonb_set(schedule, '{completedAt}', to_jsonb(now()::text), true)
        when event_direction = 'backward' and old_stage = '작업완료' then schedule - 'completedAt'
        else schedule
      end,
      updated_at = now()
  where id = p_transaction_id
  returning * into current_transaction;

  insert into public.transaction_stage_events (transaction_id, from_stage, to_stage, actor_role, actor_id, direction)
    values (p_transaction_id, old_stage, p_next_stage, caller_role, auth.uid(), event_direction);

  return current_transaction;
end;
$$;

revoke all on function public.transition_transaction_stage(text, text) from public, anon;
grant execute on function public.transition_transaction_stage(text, text) to authenticated;

commit;
