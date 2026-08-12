-- Car-Master Phase 4b: Admin proposes a Shop for a Phase 2 request, Dealer
-- accepts or declines. Accepting reuses Phase 1's
-- create_shop_transaction_with_room verbatim (called from inside
-- accept_shop_search_proposal) — no parallel transaction-creation path.
--
-- Requires 202608130002 (the new shop_search_request_status enum values) to
-- already be committed, which it is by the time this migration's own
-- transaction starts.

begin;

create type public.shop_search_proposal_status as enum ('proposed', 'accepted', 'declined');

create table public.shop_search_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.shop_search_requests(id) on delete cascade,
  shop_id uuid not null references public.installer_shops(id) on delete restrict,
  status public.shop_search_proposal_status not null default 'proposed',
  proposed_by uuid not null references public.profiles(id) on delete set null,
  dealer_note text,
  transaction_id text references public.transactions(id) on delete set null,
  room_id uuid references public.transaction_rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index shop_search_proposals_request_idx on public.shop_search_proposals (request_id, created_at desc);
-- At most one live (undecided) proposal per request at a time — Admin must
-- wait for the Dealer's decision (or the Dealer must decline) before a new
-- one can be proposed. Enforced here, not just in application logic.
create unique index shop_search_proposals_one_open_per_request_idx
  on public.shop_search_proposals (request_id)
  where status = 'proposed';

alter table public.shop_search_proposals enable row level security;
-- Same shape as shop_search_requests: zero direct grants, every access is a
-- SECURITY DEFINER RPC below — the dealer's own accept/decline path never
-- needs to see who else this Shop was proposed to, and Admin's operational
-- context stays server-controlled.
revoke all on public.shop_search_proposals from public, anon, authenticated;

-- 1. admin_propose_shop_for_request: admin-only. Requires the request to
--    still be open (requested/in_progress) and the Shop to be approved.
create or replace function public.admin_propose_shop_for_request(p_request_id uuid, p_shop_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.shop_search_requests;
  new_id uuid;
begin
  if not public.is_admin() then raise exception 'Only an administrator can propose a shop'; end if;
  select * into target from public.shop_search_requests where id = p_request_id for update;
  if target.id is null then raise exception 'Request not found'; end if;
  if target.status not in ('requested', 'in_progress') then
    raise exception 'Request is not open for a proposal';
  end if;
  if not exists (
    select 1 from public.installer_shops
    where id = p_shop_id and approval_status = 'approved'::public.installer_approval_status
  ) then raise exception 'Shop is not available to propose'; end if;

  insert into public.shop_search_proposals (request_id, shop_id, proposed_by)
  values (p_request_id, p_shop_id, auth.uid())
  returning id into new_id;

  update public.shop_search_requests set status = 'shop_proposed'::public.shop_search_request_status, updated_at = now()
  where id = p_request_id;

  return new_id;
end;
$$;

revoke all on function public.admin_propose_shop_for_request(uuid, uuid) from public, anon;
grant execute on function public.admin_propose_shop_for_request(uuid, uuid) to authenticated;

-- 2. admin_search_shops: admin-only, exact/substring lookup over approved
--    Shops so an Admin can propose an existing Shop, not only one they just
--    quick-registered. Real DB data only — no rating/review/volume fields
--    exist to fabricate.
create or replace function public.admin_search_shops(p_query text)
returns table (id uuid, shop_name text, address text, phone text, supported_services text[], supported_brands text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can search shops'; end if;
  return query
  select s.id, s.shop_name, s.address, s.phone, s.supported_services, s.supported_brands
  from public.installer_shops s
  where s.approval_status = 'approved'::public.installer_approval_status
    and (
      coalesce(trim(p_query), '') = ''
      or s.shop_name ilike '%' || trim(p_query) || '%'
      or s.address ilike '%' || trim(p_query) || '%'
      or s.phone ilike '%' || trim(p_query) || '%'
    )
  order by s.updated_at desc
  limit 20;
end;
$$;

revoke all on function public.admin_search_shops(text) from public, anon;
grant execute on function public.admin_search_shops(text) to authenticated;

-- 3. accept_shop_search_proposal: dealer only, own request. Reuses
--    create_shop_transaction_with_room verbatim — this is the ONLY place a
--    Transaction/Room gets created from a proposal, same code Phase 1's
--    direct-search Dealer flow already uses. Row-locks the proposal first,
--    so a double-click/retry sees status <> 'proposed' on the second call
--    and returns the SAME stored result instead of creating a second
--    Transaction — idempotent without a generic idempotency framework.
create or replace function public.accept_shop_search_proposal(p_proposal_id uuid, p_vehicle_class text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.shop_search_proposals;
  request public.shop_search_requests;
  result jsonb;
begin
  select * into proposal from public.shop_search_proposals where id = p_proposal_id for update;
  if proposal.id is null then raise exception 'Proposal not found'; end if;

  select * into request from public.shop_search_requests where id = proposal.request_id for update;
  if request.dealer_id <> auth.uid() then raise exception 'Proposal access denied'; end if;

  if proposal.status = 'accepted'::public.shop_search_proposal_status then
    return jsonb_build_object('transactionId', proposal.transaction_id, 'roomId', proposal.room_id);
  end if;
  if proposal.status <> 'proposed'::public.shop_search_proposal_status then
    raise exception 'Proposal is not in a decidable state';
  end if;
  if coalesce(p_vehicle_class, '') = '' then raise exception 'vehicleClass is required'; end if;

  result := public.create_shop_transaction_with_room(jsonb_build_object(
    'shopId', proposal.shop_id,
    'vehicle', jsonb_build_object('maker', request.vehicle_maker, 'model', request.vehicle_model, 'class', p_vehicle_class),
    'service', jsonb_build_object('workDescription', request.work_type, 'extraRequest', request.dealer_note),
    'pricing', '{}'::jsonb,
    'schedule', jsonb_build_object('requestedInboundAt', request.desired_inbound_date)
  ));

  update public.shop_search_proposals
  set status = 'accepted'::public.shop_search_proposal_status,
      transaction_id = result ->> 'transactionId',
      room_id = (result ->> 'roomId')::uuid,
      decided_at = now()
  where id = p_proposal_id;

  update public.shop_search_requests
  set status = 'transaction_linked'::public.shop_search_request_status, updated_at = now()
  where id = request.id;

  return result;
end;
$$;

revoke all on function public.accept_shop_search_proposal(uuid, text) from public, anon;
grant execute on function public.accept_shop_search_proposal(uuid, text) to authenticated;

-- 4. decline_shop_search_proposal: dealer only, own request. No Transaction,
--    no Room, no Shop deleted. Sends the request back to 'in_progress' so
--    Admin's queue picks it up again; the declined proposal row itself is
--    never deleted (kept for traceability, even with no dedicated UI yet).
create or replace function public.decline_shop_search_proposal(p_proposal_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.shop_search_proposals;
  request public.shop_search_requests;
begin
  select * into proposal from public.shop_search_proposals where id = p_proposal_id for update;
  if proposal.id is null then raise exception 'Proposal not found'; end if;

  select * into request from public.shop_search_requests where id = proposal.request_id for update;
  if request.dealer_id <> auth.uid() then raise exception 'Proposal access denied'; end if;
  if proposal.status <> 'proposed'::public.shop_search_proposal_status then
    raise exception 'Proposal is not in a decidable state';
  end if;

  update public.shop_search_proposals
  set status = 'declined'::public.shop_search_proposal_status, dealer_note = nullif(trim(coalesce(p_note, '')), ''), decided_at = now()
  where id = p_proposal_id;

  update public.shop_search_requests
  set status = 'in_progress'::public.shop_search_request_status, updated_at = now()
  where id = request.id;
end;
$$;

revoke all on function public.decline_shop_search_proposal(uuid, text) from public, anon;
grant execute on function public.decline_shop_search_proposal(uuid, text) to authenticated;

-- 5. admin_mark_shop_search_request_unable: extend the allowed source
--    states to include shop_proposed (Admin may still give up on a request
--    that has an outstanding, undecided proposal), matching the same
--    guard style as the rest of this function.
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
  if target.status not in ('requested', 'in_progress', 'shop_proposed') then
    raise exception 'Only an open request can be marked unable to connect';
  end if;

  update public.shop_search_requests
  set status = 'unable_to_connect', updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.admin_mark_shop_search_request_unable(uuid) from public, anon;
grant execute on function public.admin_mark_shop_search_request_unable(uuid) to authenticated;

-- 6. get_my_shop_search_requests: return shape changed (adds the current
--    live proposal's Shop details, when one exists) — drop then recreate,
--    Postgres won't let CREATE OR REPLACE change a RETURNS TABLE shape.
drop function if exists public.get_my_shop_search_requests();

create function public.get_my_shop_search_requests()
returns table (
  id uuid, region text, work_type text, vehicle_maker text, vehicle_model text,
  desired_inbound_date text, date_flexible boolean, dealer_note text,
  status public.shop_search_request_status, created_at timestamptz, updated_at timestamptz,
  proposal_id uuid, proposed_shop_id uuid, proposed_shop_name text, proposed_shop_address text,
  proposed_shop_phone text, proposed_shop_services text[], proposed_shop_brands text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.region, r.work_type, r.vehicle_maker, r.vehicle_model,
    r.desired_inbound_date, r.date_flexible, r.dealer_note, r.status, r.created_at, r.updated_at,
    p.id, s.id, s.shop_name, s.address, coalesce(nullif(s.contact_phone, ''), s.phone), s.supported_services, s.supported_brands
  from public.shop_search_requests r
  left join public.shop_search_proposals p on p.request_id = r.id and p.status = 'proposed'::public.shop_search_proposal_status
  left join public.installer_shops s on s.id = p.shop_id
  where r.dealer_id = auth.uid()
  order by r.created_at desc;
$$;

revoke all on function public.get_my_shop_search_requests() from public, anon;
grant execute on function public.get_my_shop_search_requests() to authenticated;

-- 7. get_admin_shop_search_requests: same shape-change situation.
drop function if exists public.get_admin_shop_search_requests();

create function public.get_admin_shop_search_requests()
returns table (
  id uuid, dealer_id uuid, dealer_name text, dealer_phone text, region text, work_type text,
  vehicle_maker text, vehicle_model text, desired_inbound_date text, date_flexible boolean,
  dealer_note text, status public.shop_search_request_status, admin_note text,
  registered_shop_id uuid, created_at timestamptz, updated_at timestamptz,
  proposal_id uuid, proposed_shop_id uuid, proposed_shop_name text
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
    r.dealer_note, r.status, r.admin_note, r.registered_shop_id, r.created_at, r.updated_at,
    p.id, s.id, s.shop_name
  from public.shop_search_requests r
  left join public.shop_search_proposals p on p.request_id = r.id and p.status = 'proposed'::public.shop_search_proposal_status
  left join public.installer_shops s on s.id = p.shop_id
  order by
    (r.status in ('requested', 'in_progress', 'shop_proposed')) desc,
    r.created_at asc;
end;
$$;

revoke all on function public.get_admin_shop_search_requests() from public, anon;
grant execute on function public.get_admin_shop_search_requests() to authenticated;

commit;
