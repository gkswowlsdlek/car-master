-- Car-Master v0.3.9: simplify the transaction stage workflow to a single
-- forward/back-one-step ladder (견적 -> 시공예약 -> 입고 -> 작업완료), and add
-- an append-only stage-change log. Safe, additive migration. Apply after
-- 202607220001_v036_production_connection.sql.
--
-- No column/type changes: `transactions.stage` was already a plain `text`
-- column with no CHECK constraint (validated only inside the RPCs below), so
-- renaming the allowed values is purely an RPC-level change plus a one-time
-- data backfill for any existing rows.

-- 1. Backfill legacy stage values on existing rows to their new-model
--    equivalent. 시공중 (in-progress) folds into 입고, since the new model
--    has no separate "work in progress" stage — 작업완료 is reached directly
--    from 입고. 입고 and 취소 are unchanged.
update public.transactions
set stage = case stage
  when '접수' then '견적'
  when '입고예정' then '시공예약'
  when '시공중' then '입고'
  when '완료' then '작업완료'
  else stage
end
where stage in ('접수', '입고예정', '시공중', '완료');

alter table public.transactions alter column stage set default '견적';

-- 2. Append-only 거래 로그: one row per stage change (forward or backward).
--    No table/column-level UPDATE or DELETE grants for anyone — every insert
--    happens exclusively inside transition_transaction_stage below, matching
--    the existing "no direct writes, RPC only" invariant for `transactions`.
create table if not exists public.transaction_stage_events (
  id bigint generated always as identity primary key,
  transaction_id text not null references public.transactions(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  actor_role public.user_role not null,
  actor_id uuid not null,
  direction text not null check (direction in ('forward', 'backward')),
  created_at timestamptz not null default now()
);

create index if not exists transaction_stage_events_transaction_id_idx
  on public.transaction_stage_events (transaction_id, created_at);

alter table public.transaction_stage_events enable row level security;

drop policy if exists "transaction stage events participants select" on public.transaction_stage_events;
create policy "transaction stage events participants select"
  on public.transaction_stage_events for select to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_stage_events.transaction_id
        and (t.dealer_id = auth.uid() or t.installer_id = auth.uid() or public.is_admin())
    )
  );

revoke all on public.transaction_stage_events from public, anon, authenticated;
grant select on public.transaction_stage_events to authenticated;

-- 3. New transactions start at 견적, not 접수.
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

  new.stage := '견적';
  new.hidden_by_dealer := false;
  new.hidden_by_installer := false;
  new.pricing := (coalesce(new.pricing, '{}'::jsonb) - 'paymentAt' - 'settlementDueAt')
    || jsonb_build_object('paymentStatus', '미결제');
  return new;
end;
$$;

revoke all on function public.guard_transaction_insert() from public, anon, authenticated;
-- trigger definition (name, timing, table) is unchanged from v036, only the
-- function body above changes what CREATE OR REPLACE points it at.

-- 4. create_transaction_with_room: insert literal updated for consistency
--    with the trigger above (the trigger overrides `stage` regardless, but
--    both should agree on the starting stage for anyone reading this file).
-- Identical to the v035 original except: the stage literal ('접수' -> '견적')
-- and one added insert into transaction_stage_events at the end, so the
-- 거래 로그 has a first entry from the moment a transaction is created.
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

  transaction_id := 'CM-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.transaction_number_seq')::text, 4, '0');

  insert into public.transactions (
    id, dealer_id, installer_id, installer_name, vehicle, service, pricing, schedule,
    stage, last_message
  ) values (
    transaction_id, auth.uid(), target_installer, target_name,
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

-- 5. set_transaction_final_price: terminal-stage literal updated (완료/취소 -> 작업완료/취소).
create or replace function public.set_transaction_final_price(p_transaction_id text, p_final_price numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.transactions;
  caller_role public.user_role;
begin
  if p_final_price is null or p_final_price <= 0 or p_final_price > 100000000 then
    raise exception 'Invalid final price';
  end if;
  select * into target from public.transactions where id = p_transaction_id for update;
  if target.id is null then raise exception 'Transaction not found'; end if;
  select role into caller_role from public.profiles where id = auth.uid();
  if not (caller_role = 'admin'::public.user_role or
    (caller_role = 'installer'::public.user_role and target.installer_id = auth.uid())) then
    raise exception 'Only the assigned installer or an administrator can set the final price';
  end if;
  if target.stage in ('작업완료', '취소') then raise exception 'Closed transactions cannot change price'; end if;

  update public.transactions
  set pricing = jsonb_set(pricing, '{finalPrice}', to_jsonb(p_final_price), true), updated_at = now()
  where id = p_transaction_id;
end;
$$;

revoke all on function public.set_transaction_final_price(text, numeric) from public, anon;
grant execute on function public.set_transaction_final_price(text, numeric) to authenticated;

-- 6. transition_transaction_stage: 4-stage ladder, one step forward OR one
--    step back (no skipping, no jumping to an arbitrary past stage), logged
--    to transaction_stage_events. 취소 is kept reachable by dealer/admin from
--    any stage for backward compatibility with already-cancelled rows, but
--    the app UI no longer exposes a way to trigger it.
create or replace function public.transition_transaction_stage(p_transaction_id text, p_next_stage text)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_transaction public.transactions;
  caller_role public.user_role;
  stage_order text[] := array['견적', '시공예약', '입고', '작업완료'];
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

  if caller_role not in ('installer'::public.user_role, 'admin'::public.user_role) then
    raise exception 'Only the assigned installer or an administrator can change the work stage';
  end if;
  if caller_role = 'installer'::public.user_role and current_transaction.installer_id <> auth.uid() then
    raise exception 'Transaction access denied';
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
        when old_stage = '작업완료' then schedule - 'completedAt'
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
