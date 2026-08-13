-- Car-Master Phase 5: complete the Transaction lifecycle — normal work
-- progress (입고 전/작업 중/작업 완료/출고, already built) plus an
-- exception-termination path (취소/시공불가) and a real "최종 시공금액"
-- record. Neither concept is a parallel state system: both reuse the
-- existing transactions.stage text column (which already carries '취소' as
-- a legacy, DB-supported-but-UI-unexposed value — see
-- transition_transaction_stage in 202607260001) and the existing
-- pricing.finalPrice jsonb field + set_transaction_final_price RPC (already
-- built for the pre-Beta recommended-pricing model, never removed).
--
-- transition_transaction_stage itself is left completely untouched — its
-- existing '취소' branch keeps working exactly as before. The new
-- end_transaction_outcome function below is the one path the new UI
-- actually calls; it additionally supports '시공불가' and an optional short
-- reason note, and shares the exact same dealer/installer/admin
-- authorization shape as the rest of this schema.

begin;

-- 1. outcome_note: nullable, additive. Holds the short reason for the
--    CURRENT terminal outcome only (not a history log — the existing
--    transaction_stage_events table already keeps the from/to/actor/time
--    trail; this is just what the room displays right now).
alter table public.transactions add column outcome_note text;

-- 2. end_transaction_outcome: dealer (own), the Shop's connected approved
--    operator (legacy installer_id or active shop_memberships row), or
--    admin. Never deletes the Transaction, Room, Messages, or Shop — only
--    changes stage and records why.
create or replace function public.end_transaction_outcome(p_transaction_id text, p_outcome text, p_note text default null)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_transaction public.transactions;
  caller_role public.user_role;
  old_stage text;
  room_id uuid;
  clean_note text;
begin
  if p_outcome not in ('취소', '시공불가') then
    raise exception 'Invalid transaction outcome';
  end if;

  select * into current_transaction from public.transactions where id = p_transaction_id for update;
  if current_transaction.id is null then raise exception 'Transaction not found'; end if;

  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role = 'admin'::public.user_role then
    null;
  elsif caller_role = 'dealer'::public.user_role then
    if current_transaction.dealer_id <> auth.uid() then raise exception 'Transaction access denied'; end if;
  elsif caller_role = 'installer'::public.user_role then
    if not (
      (current_transaction.installer_id is not null and current_transaction.installer_id = auth.uid())
      or (current_transaction.shop_id is not null and public.has_active_shop_membership(current_transaction.shop_id))
    ) then
      raise exception 'Transaction access denied';
    end if;
  else
    raise exception 'Only the dealer, the assigned shop or an administrator can end a transaction';
  end if;

  if current_transaction.stage in ('취소', '시공불가') then
    raise exception 'Transaction has already ended';
  end if;

  old_stage := current_transaction.stage;
  clean_note := nullif(trim(coalesce(p_note, '')), '');

  update public.transactions
  set stage = p_outcome, outcome_note = clean_note, updated_at = now()
  where id = p_transaction_id
  returning * into current_transaction;

  insert into public.transaction_stage_events (transaction_id, from_stage, to_stage, actor_role, actor_id, direction)
    values (p_transaction_id, old_stage, p_outcome, caller_role, auth.uid(), 'forward');

  select id into room_id from public.transaction_rooms where transaction_id = p_transaction_id;
  if room_id is not null then
    insert into public.chat_messages (room_id, sender_role, text)
    values (
      room_id, 'system',
      '거래가 "' || p_outcome || '"로 종료되었습니다.' || case when clean_note is not null then ' (' || clean_note || ')' else '' end
    );
  end if;

  return current_transaction;
end;
$$;

revoke all on function public.end_transaction_outcome(text, text, text) from public, anon;
grant execute on function public.end_transaction_outcome(text, text, text) to authenticated;

-- 3. set_transaction_final_price: same signature (CREATE OR REPLACE is safe
--    — no return-type/OUT-shape change). Extends authorization to the
--    dealer (own transaction) and to a shop-membership-connected operator,
--    not just the legacy installer_id match (matches
--    transition_transaction_stage's own authorization shape). Drops the
--    stage-based block entirely — Product decision: never force-block
--    entering the amount, observe real-world omission rate first. Adds an
--    integer-won check and a system message, matching the room's existing
--    audit-trail convention.
create or replace function public.set_transaction_final_price(p_transaction_id text, p_final_price numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.transactions;
  caller_role public.user_role;
  room_id uuid;
begin
  if p_final_price is null or p_final_price <= 0 or p_final_price > 100000000 or p_final_price <> trunc(p_final_price) then
    raise exception 'Invalid final price';
  end if;

  select * into target from public.transactions where id = p_transaction_id for update;
  if target.id is null then raise exception 'Transaction not found'; end if;

  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role = 'admin'::public.user_role then
    null;
  elsif caller_role = 'dealer'::public.user_role then
    if target.dealer_id <> auth.uid() then raise exception 'Transaction access denied'; end if;
  elsif caller_role = 'installer'::public.user_role then
    if not (
      (target.installer_id is not null and target.installer_id = auth.uid())
      or (target.shop_id is not null and public.has_active_shop_membership(target.shop_id))
    ) then
      raise exception 'Transaction access denied';
    end if;
  else
    raise exception 'Only the dealer, the assigned shop or an administrator can set the final price';
  end if;

  update public.transactions
  set pricing = jsonb_set(pricing, '{finalPrice}', to_jsonb(p_final_price), true), updated_at = now()
  where id = p_transaction_id;

  select id into room_id from public.transaction_rooms where transaction_id = p_transaction_id;
  if room_id is not null then
    insert into public.chat_messages (room_id, sender_role, text)
    values (room_id, 'system', '최종 시공금액이 ' || to_char(p_final_price, 'FM999,999,999') || '원으로 기록되었습니다.');
  end if;
end;
$$;

revoke all on function public.set_transaction_final_price(text, numeric) from public, anon;
grant execute on function public.set_transaction_final_price(text, numeric) to authenticated;

commit;
