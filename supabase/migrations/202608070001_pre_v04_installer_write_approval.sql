-- Car-Master pre-v0.4 security hardening 1-C.
-- Approved installers may mutate their assigned transactions. An installer
-- whose approval is pending, rejected, suspended, or missing is read-only.

create or replace function public.is_installer_approved(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.installer_approvals approval on approval.user_id = profile.id
    where profile.id = check_user_id
      and profile.role = 'installer'::public.user_role
      and approval.status = 'approved'::public.installer_approval_status
  );
$$;

revoke all on function public.is_installer_approved(uuid) from public, anon, authenticated;

create or replace function public.set_transaction_visibility(p_transaction_id text, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.transactions;
  caller_role public.user_role;
begin
  select * into target from public.transactions where id = p_transaction_id for update;
  if target.id is null then raise exception 'Transaction not found'; end if;
  select role into caller_role from public.profiles where id = auth.uid();

  if caller_role = 'dealer'::public.user_role and target.dealer_id = auth.uid() then
    update public.transactions set hidden_by_dealer = p_hidden, updated_at = now() where id = p_transaction_id;
  elsif caller_role = 'installer'::public.user_role
    and target.installer_id = auth.uid()
    and public.is_installer_approved(auth.uid()) then
    update public.transactions set hidden_by_installer = p_hidden, updated_at = now() where id = p_transaction_id;
  else
    raise exception 'Transaction access denied';
  end if;
end;
$$;

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
    (caller_role = 'installer'::public.user_role
      and target.installer_id = auth.uid()
      and public.is_installer_approved(auth.uid()))) then
    raise exception 'Only the assigned approved installer or an administrator can set the final price';
  end if;
  if target.stage in ('작업완료', '취소') then raise exception 'Closed transactions cannot change price'; end if;

  update public.transactions
  set pricing = jsonb_set(pricing, '{finalPrice}', to_jsonb(p_final_price), true), updated_at = now()
  where id = p_transaction_id;
end;
$$;

create or replace function public.transition_transaction_payment(p_transaction_id text, p_next_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.transactions;
  caller_role public.user_role;
  current_status text;
  allowed boolean := false;
begin
  select * into target from public.transactions where id = p_transaction_id for update;
  if target.id is null then raise exception 'Transaction not found'; end if;
  select role into caller_role from public.profiles where id = auth.uid();
  if not (target.dealer_id = auth.uid() or target.installer_id = auth.uid() or caller_role = 'admin'::public.user_role) then
    raise exception 'Transaction access denied';
  end if;
  if caller_role = 'installer'::public.user_role and not public.is_installer_approved(auth.uid()) then
    raise exception 'Installer approval required';
  end if;
  current_status := coalesce(target.pricing ->> 'paymentStatus', '미결제');
  allowed :=
    (current_status = '미결제' and p_next_status = '결제대기' and caller_role in ('dealer'::public.user_role, 'installer'::public.user_role)) or
    (current_status = '결제대기' and p_next_status = '결제완료' and caller_role in ('dealer'::public.user_role, 'admin'::public.user_role)) or
    (current_status = '결제완료' and p_next_status = '정산대기' and caller_role = 'admin'::public.user_role) or
    (current_status = '정산대기' and p_next_status = '정산완료' and caller_role = 'admin'::public.user_role);
  if not allowed then raise exception 'Invalid payment status transition'; end if;

  update public.transactions
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
  if caller_role = 'installer'::public.user_role and not public.is_installer_approved(auth.uid()) then
    raise exception 'Installer approval required';
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

revoke all on function public.set_transaction_visibility(text, boolean) from public, anon;
revoke all on function public.set_transaction_final_price(text, numeric) from public, anon;
revoke all on function public.transition_transaction_payment(text, text) from public, anon;
revoke all on function public.transition_transaction_stage(text, text) from public, anon;
grant execute on function public.set_transaction_visibility(text, boolean) to authenticated;
grant execute on function public.set_transaction_final_price(text, numeric) to authenticated;
grant execute on function public.transition_transaction_payment(text, text) to authenticated;
grant execute on function public.transition_transaction_stage(text, text) to authenticated;
