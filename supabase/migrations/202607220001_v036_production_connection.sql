-- Car-Master v0.3.6 production connection hardening.
-- Safe, additive migration. Apply after 202607210001_v035_foundation.sql.

alter table public.chat_messages
  add column if not exists client_message_id text;

create unique index if not exists chat_messages_room_client_message_idx
  on public.chat_messages (room_id, client_message_id);

create or replace function public.chat_attachments_match_room(check_room_id uuid, items jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(items) <> 'array' then false
    when jsonb_array_length(items) > 1 then false
    else not exists (
      select 1
      from jsonb_array_elements(items) attachment
      where jsonb_typeof(attachment) <> 'object'
         or coalesce(attachment ->> 'storagePath', '') = ''
         or split_part(attachment ->> 'storagePath', '/', 1) <> check_room_id::text
         or array_length(string_to_array(attachment ->> 'storagePath', '/'), 1) <> 3
         or split_part(attachment ->> 'storagePath', '/', 2) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         or split_part(attachment ->> 'storagePath', '/', 3) = ''
    )
  end;
$$;

revoke all on function public.chat_attachments_match_room(uuid, jsonb) from public;
grant execute on function public.chat_attachments_match_room(uuid, jsonb) to authenticated;

-- The v035 creation RPC intentionally accepts the request payload, but clients
-- must never be able to choose server-owned state such as payment progress.
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

  new.stage := '접수';
  new.hidden_by_dealer := false;
  new.hidden_by_installer := false;
  new.pricing := (coalesce(new.pricing, '{}'::jsonb) - 'paymentAt' - 'settlementDueAt')
    || jsonb_build_object('paymentStatus', '미결제');
  return new;
end;
$$;

revoke all on function public.guard_transaction_insert() from public, anon, authenticated;
drop trigger if exists guard_transaction_insert on public.transactions;
create trigger guard_transaction_insert
  before insert on public.transactions
  for each row execute procedure public.guard_transaction_insert();

drop policy if exists "chat participants insert" on public.chat_messages;
create policy "chat participants insert" on public.chat_messages
  for insert to authenticated with check (
    public.can_access_room(room_id)
    and sender_id = auth.uid()
    and sender_role = (
      select case profile.role
        when 'installer'::public.user_role then 'shop'
        when 'dealer'::public.user_role then 'dealer'
        when 'admin'::public.user_role then 'admin'
      end
      from public.profiles profile
      where profile.id = auth.uid()
    )
    and (char_length(trim(text)) > 0 or jsonb_array_length(attachments) > 0)
    and coalesce(client_message_id, '') <> ''
    and public.chat_attachments_match_room(room_id, attachments)
  );

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
  elsif caller_role = 'installer'::public.user_role and target.installer_id = auth.uid() then
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
    (caller_role = 'installer'::public.user_role and target.installer_id = auth.uid())) then
    raise exception 'Only the assigned installer or an administrator can set the final price';
  end if;
  if target.stage in ('완료', '취소') then raise exception 'Closed transactions cannot change price'; end if;

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

revoke all on function public.set_transaction_visibility(text, boolean) from public, anon;
revoke all on function public.set_transaction_final_price(text, numeric) from public, anon;
revoke all on function public.transition_transaction_payment(text, text) from public, anon;
grant execute on function public.set_transaction_visibility(text, boolean) to authenticated;
grant execute on function public.set_transaction_final_price(text, numeric) to authenticated;
grant execute on function public.transition_transaction_payment(text, text) to authenticated;

create or replace function public.transition_transaction_stage(p_transaction_id text, p_next_stage text)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_transaction public.transactions;
  caller_role public.user_role;
  allowed_next text;
begin
  select * into current_transaction
  from public.transactions
  where id = p_transaction_id
  for update;

  if current_transaction.id is null then
    raise exception 'Transaction not found';
  end if;

  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role not in ('installer'::public.user_role, 'admin'::public.user_role) then
    raise exception 'Only the assigned installer or an administrator can change the work stage';
  end if;
  if caller_role = 'installer'::public.user_role and current_transaction.installer_id <> auth.uid() then
    raise exception 'Transaction access denied';
  end if;

  allowed_next := case current_transaction.stage
    when '접수' then '입고예정'
    when '입고예정' then '입고'
    when '입고' then '시공중'
    when '시공중' then '완료'
    else null
  end;
  if p_next_stage is distinct from allowed_next then
    raise exception 'Invalid transaction stage transition';
  end if;

  update public.transactions
  set stage = p_next_stage,
      schedule = case when p_next_stage = '완료'
        then jsonb_set(schedule, '{completedAt}', to_jsonb(now()::text), true)
        else schedule end,
      updated_at = now()
  where id = p_transaction_id
  returning * into current_transaction;
  return current_transaction;
end;
$$;

revoke all on function public.transition_transaction_stage(text, text) from public, anon;
grant execute on function public.transition_transaction_stage(text, text) to authenticated;

-- v035 granted column-level UPDATE privileges. Revoke those exact grants as
-- well as any table-level grant so every member mutation must use an RPC.
revoke update on public.transactions from authenticated;
revoke update (vehicle, service, pricing, schedule, stage, hidden_by_dealer, hidden_by_installer, last_message, updated_at)
  on public.transactions from authenticated;
drop policy if exists "transaction participants update" on public.transactions;

create or replace function public.attachment_room_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[] := string_to_array(object_name, '/');
begin
  if array_length(parts, 1) <> 3 or coalesce(parts[2], '') = '' or coalesce(parts[3], '') = '' then
    return null;
  end if;
  if parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return parts[1]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke all on function public.attachment_room_id(text) from public;
grant execute on function public.attachment_room_id(text) to authenticated;

drop policy if exists "transaction attachments participants read" on storage.objects;
create policy "transaction attachments participants read" on storage.objects
  for select to authenticated using (
    bucket_id = 'transaction-attachments'
    and public.can_access_room(public.attachment_room_id(name))
  );

drop policy if exists "transaction attachments participants upload" on storage.objects;
create policy "transaction attachments participants upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'transaction-attachments'
    and owner_id = auth.uid()::text
    and public.can_access_room(public.attachment_room_id(name))
  );

drop policy if exists "transaction attachments uploader cleanup" on storage.objects;
create policy "transaction attachments uploader cleanup" on storage.objects
  for delete to authenticated using (
    bucket_id = 'transaction-attachments'
    and owner_id = auth.uid()::text
    and public.can_access_room(public.attachment_room_id(name))
  );

create or replace function public.set_transaction_room_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.transaction_rooms set updated_at = new.created_at where id = new.room_id;
  update public.transactions
    set last_message = case when trim(new.text) <> '' then new.text else '첨부파일' end,
        updated_at = new.created_at
    where id = (select transaction_id from public.transaction_rooms where id = new.room_id);
  return new;
end;
$$;

drop trigger if exists chat_message_updates_room on public.chat_messages;
create trigger chat_message_updates_room
  after insert on public.chat_messages
  for each row execute procedure public.set_transaction_room_updated_at();
