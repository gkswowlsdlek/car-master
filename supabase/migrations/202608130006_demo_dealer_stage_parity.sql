-- Car-Master: Phase 1 finish patch — Shared Demo backend stage-machine parity.
--
-- The real (Supabase-authenticated) transaction stage machine already lets a
-- dealer drive every forward/backward work-stage transition on their own
-- transaction (see 202608120002_dealer_immediate_transaction_flow.sql's
-- transition_transaction_stage), and already has a terminal 출고 stage after
-- 작업완료. The Shared Demo backend's mirror function
-- (demo_transition_transaction_stage, added in
-- 202608010001_v0312_installer_workspace.sql) never received either change:
-- it still restricts non-cancel stage advances to shop/admin only, and its
-- stage machine stops at 작업완료. This is purely additive — no destructive
-- change, no data migration — and shop/admin keep driving the demo stage
-- machine exactly as before (this RPC has never done per-user ownership
-- checks, only role-string checks, so widening the allowed role set is the
-- same trust model already in place).

begin;

alter table public.demo_transactions drop constraint if exists demo_transactions_stage_check;
alter table public.demo_transactions add constraint demo_transactions_stage_check
  check (stage in ('견적', '시공예약', '입고', '작업완료', '출고', '취소'));

create or replace function public.demo_transition_transaction_stage(p_transaction_id text, p_next_stage text, p_actor_role text)
returns public.demo_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_transaction public.demo_transactions;
  stage_order text[] := array['견적', '시공예약', '입고', '작업완료', '출고'];
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
        when event_direction = 'backward' and old_stage = '작업완료' then schedule - 'completedAt'
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

commit;
