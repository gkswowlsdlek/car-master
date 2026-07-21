-- Car-Master v0.3.5 foundation stabilization
-- Apply after 202607190001_v034_membership.sql.

alter table public.installer_profiles
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists accepting_requests boolean not null default true;

create sequence if not exists public.transaction_number_seq;

create table public.transactions (
  id text primary key,
  dealer_id uuid not null references public.dealer_profiles(user_id),
  installer_id uuid not null references public.installer_profiles(user_id),
  installer_name text not null,
  vehicle jsonb not null,
  service jsonb not null,
  pricing jsonb not null,
  schedule jsonb not null,
  stage text not null default '접수',
  hidden_by_dealer boolean not null default false,
  hidden_by_installer boolean not null default false,
  last_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transaction_rooms (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique references public.transactions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.transaction_rooms(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  sender_role text not null check (sender_role in ('dealer', 'shop', 'admin', 'system')),
  text text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.chat_message_reads (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index transactions_dealer_idx on public.transactions (dealer_id, updated_at desc);
create index transactions_installer_idx on public.transactions (installer_id, updated_at desc);
create index chat_messages_room_idx on public.chat_messages (room_id, created_at);

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
      and (transaction.dealer_id = check_user_id or transaction.installer_id = check_user_id or public.is_admin(check_user_id))
  );
$$;

create or replace function public.can_access_room(check_room_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.transaction_rooms room
    where room.id = check_room_id and public.can_access_transaction(room.transaction_id, check_user_id)
  );
$$;

revoke all on function public.can_access_transaction(text, uuid) from public;
revoke all on function public.can_access_room(uuid, uuid) from public;
grant execute on function public.can_access_transaction(text, uuid), public.can_access_room(uuid, uuid) to authenticated;

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
    '접수', '새 시공 요청이 접수되었습니다.'
  );

  insert into public.transaction_rooms (transaction_id) values (transaction_id) returning id into room_id;
  insert into public.chat_messages (room_id, sender_role, text)
    values (room_id, 'system', '거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.')
    returning id into initial_message_id;

  return jsonb_build_object('transactionId', transaction_id, 'roomId', room_id, 'messageId', initial_message_id);
end;
$$;

revoke all on function public.create_transaction_with_room(jsonb) from public, anon;
grant execute on function public.create_transaction_with_room(jsonb) to authenticated;

create or replace function public.get_approved_installer_directory()
returns table (
  id uuid, name text, address text, brands text[], works text[], hours text,
  available boolean, latitude double precision, longitude double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select installer.user_id, installer.shop_name,
    trim(concat(installer.address, ' ', coalesce(installer.detail_address, ''))),
    installer.supported_brands, installer.supported_services, installer.business_hours,
    installer.accepting_requests, installer.latitude, installer.longitude
  from public.installer_profiles installer
  join public.installer_approvals approval on approval.user_id = installer.user_id
  where exists (select 1 from public.profiles caller where caller.id = auth.uid() and caller.role in ('dealer', 'admin'))
    and approval.status = 'approved' and installer.accepting_requests = true
  order by installer.updated_at desc;
$$;

revoke all on function public.get_approved_installer_directory() from public, anon;
grant execute on function public.get_approved_installer_directory() to authenticated;

alter table public.transactions enable row level security;
alter table public.transaction_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_reads enable row level security;

create policy "transaction participants select" on public.transactions
  for select to authenticated using (dealer_id = auth.uid() or installer_id = auth.uid() or public.is_admin());
create policy "transaction participants update" on public.transactions
  for update to authenticated using (dealer_id = auth.uid() or installer_id = auth.uid() or public.is_admin())
  with check (dealer_id = auth.uid() or installer_id = auth.uid() or public.is_admin());

create policy "transaction room participants select" on public.transaction_rooms
  for select to authenticated using (public.can_access_transaction(transaction_id));

create policy "chat participants select" on public.chat_messages
  for select to authenticated using (public.can_access_room(room_id));
create policy "chat participants insert" on public.chat_messages
  for insert to authenticated with check (
    public.can_access_room(room_id) and sender_id = auth.uid() and sender_role <> 'system'
  );

create policy "message reads participants select" on public.chat_message_reads
  for select to authenticated using (
    exists (select 1 from public.chat_messages message where message.id = message_id and public.can_access_room(message.room_id))
  );
create policy "message reads own insert" on public.chat_message_reads
  for insert to authenticated with check (
    user_id = auth.uid() and exists (select 1 from public.chat_messages message where message.id = message_id and public.can_access_room(message.room_id))
  );

grant select on public.transactions to authenticated;
grant update (vehicle, service, pricing, schedule, stage, hidden_by_dealer, hidden_by_installer, last_message, updated_at) on public.transactions to authenticated;
grant select on public.transaction_rooms to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert on public.chat_message_reads to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transaction-attachments', 'transaction-attachments', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "transaction attachments participants read" on storage.objects
  for select to authenticated using (
    bucket_id = 'transaction-attachments'
    and public.can_access_room(((storage.foldername(name))[1])::uuid)
  );
create policy "transaction attachments participants upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'transaction-attachments'
    and public.can_access_room(((storage.foldername(name))[1])::uuid)
  );

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.transactions;
