-- Car-Master Phase 2: Dealer "시공점 찾기 요청" + Admin intake.
--
-- Beta doesn't assume every region has enough Shops yet. When a Dealer can't
-- find a suitable Shop in the Directory, they can ask Car-Master to find one
-- by hand — this is a real, additive Core Flow table, not a customer-support
-- ticket system. Exactly 4 statuses this phase: requested, in_progress
-- ("카마스터 확인 중"), cancelled, unable_to_connect ("연결 어려움"). Shop
-- suggestion / dealer selection / room creation are explicitly out of scope
-- and land in a later, separately-reviewed migration.
--
-- The admin_note column must never be readable by a dealer, even their own
-- row's — Postgres RLS is row-level only, so this table gets NO direct
-- table-level grant to `authenticated` at all (same "RPC only" shape as
-- `transactions` mutations); every read and write goes through a
-- SECURITY DEFINER function that explicitly controls its own column list.

begin;

do $$
begin
  create type public.shop_search_request_status as enum ('requested', 'in_progress', 'cancelled', 'unable_to_connect');
exception when duplicate_object then null;
end $$;

create table public.shop_search_requests (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.dealer_profiles(user_id) on delete cascade,
  dealer_name text not null,
  dealer_phone text not null,
  region text not null,
  work_type text not null,
  vehicle_maker text not null,
  vehicle_model text not null,
  desired_inbound_date text not null,
  date_flexible boolean not null default false,
  dealer_note text,
  status public.shop_search_request_status not null default 'requested',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shop_search_requests_dealer_idx on public.shop_search_requests (dealer_id, created_at desc);
-- "오래된 미처리 요청 우선" — Admin's default sort is open requests (requested/
-- in_progress) ordered oldest-first; this index serves that query directly.
create index shop_search_requests_open_oldest_idx on public.shop_search_requests (created_at)
  where status in ('requested', 'in_progress');

alter table public.shop_search_requests enable row level security;

-- No policy grants broad SELECT/INSERT/UPDATE — every access path is a
-- SECURITY DEFINER RPC below. RLS stays enabled (defense in depth: even a
-- future accidental GRANT could not expose rows without an explicit policy),
-- but no policy is defined because none is needed while there is no grant.
revoke all on public.shop_search_requests from public, anon, authenticated;

-- 1. create_shop_search_request: dealer only. Dealer contact is snapshotted
--    from dealer_profiles at creation time (reused, never re-typed) rather
--    than joined live, matching how create_shop_transaction_with_room
--    snapshots installer_name at creation time.
create or replace function public.create_shop_search_request(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
  dealer_name text;
  dealer_phone text;
  new_id uuid;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'dealer'::public.user_role then
    raise exception 'Only dealers can create a shop search request';
  end if;

  select name, phone into dealer_name, dealer_phone
  from public.dealer_profiles where user_id = auth.uid();
  if dealer_name is null then raise exception 'Dealer profile not found'; end if;

  if coalesce(payload ->> 'region', '') = '' then raise exception 'region is required'; end if;
  if coalesce(payload ->> 'workType', '') = '' then raise exception 'workType is required'; end if;
  if coalesce(payload ->> 'vehicleMaker', '') = '' then raise exception 'vehicleMaker is required'; end if;
  if coalesce(payload ->> 'vehicleModel', '') = '' then raise exception 'vehicleModel is required'; end if;
  if coalesce(payload ->> 'desiredInboundDate', '') = '' then raise exception 'desiredInboundDate is required'; end if;

  insert into public.shop_search_requests (
    dealer_id, dealer_name, dealer_phone, region, work_type, vehicle_maker, vehicle_model,
    desired_inbound_date, date_flexible, dealer_note
  ) values (
    auth.uid(), dealer_name, dealer_phone, payload ->> 'region', payload ->> 'workType',
    payload ->> 'vehicleMaker', payload ->> 'vehicleModel', payload ->> 'desiredInboundDate',
    coalesce((payload ->> 'dateFlexible')::boolean, false), nullif(payload ->> 'dealerNote', '')
  ) returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.create_shop_search_request(jsonb) from public, anon;
grant execute on function public.create_shop_search_request(jsonb) to authenticated;

-- 2. get_my_shop_search_requests: dealer only, own rows, no admin_note column.
create or replace function public.get_my_shop_search_requests()
returns table (
  id uuid, region text, work_type text, vehicle_maker text, vehicle_model text,
  desired_inbound_date text, date_flexible boolean, dealer_note text,
  status public.shop_search_request_status, created_at timestamptz, updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.region, r.work_type, r.vehicle_maker, r.vehicle_model,
    r.desired_inbound_date, r.date_flexible, r.dealer_note, r.status, r.created_at, r.updated_at
  from public.shop_search_requests r
  where r.dealer_id = auth.uid()
  order by r.created_at desc;
$$;

revoke all on function public.get_my_shop_search_requests() from public, anon;
grant execute on function public.get_my_shop_search_requests() to authenticated;

-- 3. cancel_shop_search_request: dealer only, own row, one-way into
--    'cancelled' from an open state — never a hard delete, the record stays
--    for Admin's history.
create or replace function public.cancel_shop_search_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.shop_search_requests;
begin
  select * into target from public.shop_search_requests where id = p_request_id for update;
  if target.id is null then raise exception 'Request not found'; end if;
  if target.dealer_id <> auth.uid() then raise exception 'Request access denied'; end if;
  if target.status not in ('requested', 'in_progress') then
    raise exception 'Only an open request can be cancelled';
  end if;

  update public.shop_search_requests
  set status = 'cancelled', updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.cancel_shop_search_request(uuid) from public, anon;
grant execute on function public.cancel_shop_search_request(uuid) to authenticated;

-- 4. get_admin_shop_search_requests: admin only, every column including
--    admin_note. Default sort is oldest-open-first per the product spec.
create or replace function public.get_admin_shop_search_requests()
returns table (
  id uuid, dealer_id uuid, dealer_name text, dealer_phone text, region text, work_type text,
  vehicle_maker text, vehicle_model text, desired_inbound_date text, date_flexible boolean,
  dealer_note text, status public.shop_search_request_status, admin_note text,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can list shop search requests'; end if;
  return query
  select r.id, r.dealer_id, r.dealer_name, r.dealer_phone, r.region, r.work_type,
    r.vehicle_maker, r.vehicle_model, r.desired_inbound_date, r.date_flexible,
    r.dealer_note, r.status, r.admin_note, r.created_at, r.updated_at
  from public.shop_search_requests r
  order by
    (r.status in ('requested', 'in_progress')) desc,
    r.created_at asc;
end;
$$;

revoke all on function public.get_admin_shop_search_requests() from public, anon;
grant execute on function public.get_admin_shop_search_requests() to authenticated;

-- 5. admin_start_shop_search_request: requested -> in_progress ("카마스터
--    확인 중"). The dealer's own read (get_my_shop_search_requests) reflects
--    this the moment it's set — no separate notification plumbing needed.
create or replace function public.admin_start_shop_search_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.shop_search_requests;
begin
  if not public.is_admin() then raise exception 'Only an administrator can update a shop search request'; end if;
  select * into target from public.shop_search_requests where id = p_request_id for update;
  if target.id is null then raise exception 'Request not found'; end if;
  if target.status <> 'requested' then raise exception 'Only a newly requested item can be started'; end if;

  update public.shop_search_requests
  set status = 'in_progress', updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.admin_start_shop_search_request(uuid) from public, anon;
grant execute on function public.admin_start_shop_search_request(uuid) to authenticated;

-- 6. admin_mark_shop_search_request_unable: any open state -> unable_to_connect.
create or replace function public.admin_mark_shop_search_request_unable(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.shop_search_requests;
begin
  if not public.is_admin() then raise exception 'Only an administrator can update a shop search request'; end if;
  select * into target from public.shop_search_requests where id = p_request_id for update;
  if target.id is null then raise exception 'Request not found'; end if;
  if target.status not in ('requested', 'in_progress') then
    raise exception 'Only an open request can be marked unable to connect';
  end if;

  update public.shop_search_requests
  set status = 'unable_to_connect', updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.admin_mark_shop_search_request_unable(uuid) from public, anon;
grant execute on function public.admin_mark_shop_search_request_unable(uuid) to authenticated;

-- 7. admin_set_shop_search_request_note: free-text operational memo, admin
--    only, never surfaced to the dealer (get_my_shop_search_requests never
--    selects this column).
create or replace function public.admin_set_shop_search_request_note(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.shop_search_requests;
begin
  if not public.is_admin() then raise exception 'Only an administrator can set the operational note'; end if;
  select * into target from public.shop_search_requests where id = p_request_id for update;
  if target.id is null then raise exception 'Request not found'; end if;

  update public.shop_search_requests
  set admin_note = nullif(p_note, ''), updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.admin_set_shop_search_request_note(uuid, text) from public, anon;
grant execute on function public.admin_set_shop_search_request_note(uuid, text) to authenticated;

commit;
