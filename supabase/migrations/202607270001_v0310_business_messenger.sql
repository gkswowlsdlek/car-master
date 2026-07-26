-- v0.3.10 Business Messenger
--
-- Two independent additions, both purely additive (no changes to existing
-- tables' columns/constraints, no re-grants that widen existing access):
--
-- 1. `room_reads` — a simple per-user "last read" cursor for real (Supabase
--    Auth) transaction rooms. The v0.3.5 `chat_message_reads` table (one row
--    per message per reader) was never wired into the app and stays that way
--    here; a cursor table is enough for 1:1 dealer<->installer read receipts
--    and is far cheaper to maintain than a row-per-message-per-reader model.
--
-- 2. `demo_chat_rooms` / `demo_chat_messages` / `demo_chat_reads` — a fully
--    separate table set (no FKs to `profiles`, `auth.users`, `transactions`,
--    or `transaction_rooms`) so demo-mode messaging (which never carries a
--    real Supabase Auth session — demo login is a signed cookie, not a
--    Supabase user) can share state across browsers via Realtime without
--    ever touching real participant data. Physical table separation is the
--    isolation boundary: it is structurally impossible for a demo row to
--    reference, leak into, or be mistaken for a real row.

-- ---------------------------------------------------------------------------
-- 0. Allow up to 4 attachments per message (was 1) — messenger multi-photo
--    send. `chat_attachments_match_room` (per-item path validation) already
--    handles any array length; only the column's own count CHECK needs
--    raising. Same limit applied to the new demo table below for parity.
-- ---------------------------------------------------------------------------

alter table public.chat_messages drop constraint if exists chat_messages_attachments_check;
alter table public.chat_messages add constraint chat_messages_attachments_check
  check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 4);

-- ---------------------------------------------------------------------------
-- 1. Real chat read cursor
-- ---------------------------------------------------------------------------

create table if not exists public.room_reads (
  room_id uuid not null references public.transaction_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.room_reads enable row level security;

drop policy if exists "room reads participants select" on public.room_reads;
create policy "room reads participants select" on public.room_reads
  for select to authenticated
  using (public.can_access_room(room_id, auth.uid()));

drop policy if exists "room reads self insert" on public.room_reads;
create policy "room reads self insert" on public.room_reads
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_room(room_id, auth.uid()));

drop policy if exists "room reads self update" on public.room_reads;
create policy "room reads self update" on public.room_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.room_reads from public, anon;
grant select, insert, update on public.room_reads to authenticated;

alter publication supabase_realtime add table public.room_reads;

-- ---------------------------------------------------------------------------
-- 2. Demo messenger backend (anon-only, isolated from all real tables)
-- ---------------------------------------------------------------------------

create table if not exists public.demo_chat_rooms (
  id text primary key,
  transaction_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.demo_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.demo_chat_rooms(id) on delete cascade,
  sender_id text not null,
  sender_role text not null check (sender_role in ('dealer', 'shop', 'admin', 'system')),
  text text not null default '' check (char_length(text) <= 4000),
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 4),
  client_message_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists demo_chat_messages_room_client_message_idx
  on public.demo_chat_messages (room_id, client_message_id);
create index if not exists demo_chat_messages_room_idx on public.demo_chat_messages (room_id, created_at);

create table if not exists public.demo_chat_reads (
  room_id text not null references public.demo_chat_rooms(id) on delete cascade,
  reader_id text not null,
  last_read_at timestamptz not null default now(),
  primary key (room_id, reader_id)
);

-- One fixed, pre-seeded demo room (must match repositories/transaction-repository.ts
-- DEMO_SEED_TRANSACTIONS) so both the 1/1 dealer and 2/2 installer demo
-- accounts see the same conversation in any browser without either one
-- needing to "create" it first. Client code never re-seeds this — a
-- client-side insert would fire on every visitor's page load.
insert into public.demo_chat_rooms (id, transaction_id, created_at, updated_at)
values ('CHAT-DEMO-0001', 'CM-DEMO-0001', '2026-07-27T01:00:00.000Z', '2026-07-27T01:00:00.000Z')
on conflict (id) do nothing;

insert into public.demo_chat_messages (room_id, sender_id, sender_role, text, attachments, client_message_id, created_at)
values ('CHAT-DEMO-0001', 'system', 'system', '거래방이 생성되었습니다. 자동 작업 브리핑을 확인하세요.', '[]'::jsonb, 'SEED-DEMO-0001', '2026-07-27T01:00:00.000Z')
on conflict (room_id, client_message_id) do nothing;
insert into public.demo_chat_messages (room_id, sender_id, sender_role, text, attachments, client_message_id, created_at)
values ('CHAT-DEMO-0001', 'misa-starhills-shop', 'shop', '시공예약이 확정되었습니다. 7월 29일 오전 10:00에 뵙겠습니다.', '[]'::jsonb, 'SEED-DEMO-0002', '2026-07-27T01:00:05.000Z')
on conflict (room_id, client_message_id) do nothing;

alter table public.demo_chat_rooms enable row level security;
alter table public.demo_chat_messages enable row level security;
alter table public.demo_chat_reads enable row level security;

-- Demo has no Supabase Auth session (login is a signed cookie only), so
-- every demo request reaches Postgres as `anon`. There is no real user
-- identity to scope by — the isolation guarantee comes entirely from these
-- tables being physically separate from every real table, not from RLS
-- narrowing within them. Contents are non-sensitive fixture/demo data.
drop policy if exists "demo rooms anon access" on public.demo_chat_rooms;
create policy "demo rooms anon access" on public.demo_chat_rooms for all to anon using (true) with check (true);
drop policy if exists "demo messages anon access" on public.demo_chat_messages;
create policy "demo messages anon access" on public.demo_chat_messages for all to anon using (true) with check (true);
drop policy if exists "demo reads anon access" on public.demo_chat_reads;
create policy "demo reads anon access" on public.demo_chat_reads for all to anon using (true) with check (true);

revoke all on public.demo_chat_rooms from public, authenticated;
revoke all on public.demo_chat_messages from public, authenticated;
revoke all on public.demo_chat_reads from public, authenticated;
grant select, insert, update on public.demo_chat_rooms to anon;
grant select, insert on public.demo_chat_messages to anon;
grant select, insert, update on public.demo_chat_reads to anon;

alter publication supabase_realtime add table public.demo_chat_rooms;
alter publication supabase_realtime add table public.demo_chat_messages;
alter publication supabase_realtime add table public.demo_chat_reads;

-- ---------------------------------------------------------------------------
-- 3. Counterpart contact lookup for the messenger's "전화하기" feature.
--    Deliberately narrow: returns only the OTHER participant's name/phone for
--    a transaction the caller actually belongs to (or, for an admin caller,
--    the dealer's contact) — never a general profiles lookup. This keeps
--    phone numbers out of any broad SELECT grant; the RPC is the only path.
-- ---------------------------------------------------------------------------

create or replace function public.get_transaction_contact(p_transaction_id text)
returns table(contact_name text, contact_phone text)
language plpgsql
security definer
set search_path = public
as $$
declare
  txn record;
  counterpart_id uuid;
  counterpart_role public.user_role;
begin
  select dealer_id, installer_id into txn from public.transactions where id = p_transaction_id;
  if not found then raise exception 'transaction not found'; end if;
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if auth.uid() <> txn.dealer_id and auth.uid() <> txn.installer_id and not public.is_admin() then
    raise exception 'not authorized';
  end if;

  counterpart_id := case
    when auth.uid() = txn.dealer_id then txn.installer_id
    when auth.uid() = txn.installer_id then txn.dealer_id
    else txn.dealer_id
  end;

  select role into counterpart_role from public.profiles where id = counterpart_id;
  if counterpart_role = 'dealer' then
    return query select dp.name, dp.phone from public.dealer_profiles dp where dp.user_id = counterpart_id;
  elsif counterpart_role = 'installer' then
    return query select ip.representative_name, coalesce(nullif(ip.contact_phone, ''), ip.phone) from public.installer_profiles ip where ip.user_id = counterpart_id;
  end if;
end;
$$;

revoke all on function public.get_transaction_contact(text) from public;
grant execute on function public.get_transaction_contact(text) to authenticated;
