-- Car-Master Phase 3: Admin quick Shop registration.
--
-- When an Admin finds a real Shop by phone (e.g. while working a Phase 2
-- "시공점 찾기 요청") and confirms it's willing to take work, the Admin can
-- register it directly — no Installer Account, no Shop owner, no Shop
-- Membership, no Shop Claim. installer_shops.legacy_installer_user_id was
-- already designed to stay NULL for exactly this case (see its comment in
-- Account Foundation A) — this migration just adds the missing INSERT path
-- and relaxes three NOT NULL columns that a phone-verified-only Shop
-- genuinely doesn't have yet (business registration paperwork, not
-- something an Admin learns on a phone call).

begin;

-- business_name/business_registration_number/representative_name are business
-- paperwork Car-Master doesn't collect at quick-registration time. Relaxing
-- NOT NULL (not dropping the columns) — every existing row already has real
-- values, so this changes nothing for any existing Shop. NULL, not '', for
-- business_registration_number specifically: its UNIQUE constraint treats
-- NULL as "no value" (not a normal comparable value), so any number of
-- quick-registered Shops can coexist without violating uniqueness — an
-- empty-string placeholder would collide on the second insert.
alter table public.installer_shops alter column business_name drop not null;
alter table public.installer_shops alter column business_registration_number drop not null;
alter table public.installer_shops alter column representative_name drop not null;

-- Phase 2 -> Phase 3 traceability: which request (if any) an Admin was
-- working when they registered this Shop. Nullable, one-way (a request
-- never has more than one resulting Shop this phase — no shop-suggestion /
-- dealer-selection flow exists yet), never touches shop_search_requests'
-- own status enum.
alter table public.shop_search_requests add column registered_shop_id uuid references public.installer_shops(id) on delete set null;

-- 1. find_duplicate_shop_candidates: admin-only lookup Car-Master's Admin UI
--    calls before/at submit time so the same real Shop doesn't get
--    registered twice. Exact match only (same phone, or same name+address) —
--    no fuzzy matching per the product spec.
create or replace function public.find_duplicate_shop_candidates(p_phone text, p_shop_name text, p_address text)
returns table (
  id uuid, shop_name text, address text, phone text,
  approval_status public.installer_approval_status, ownership_status public.shop_ownership_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only an administrator can search for duplicate shops'; end if;
  return query
  select s.id, s.shop_name, s.address, s.phone, s.approval_status, s.ownership_status
  from public.installer_shops s
  where (nullif(trim(p_phone), '') is not null and s.phone = trim(p_phone))
     or (nullif(trim(p_shop_name), '') is not null and nullif(trim(p_address), '') is not null
         and s.shop_name = trim(p_shop_name) and s.address = trim(p_address));
end;
$$;

revoke all on function public.find_duplicate_shop_candidates(text, text, text) from public, anon;
grant execute on function public.find_duplicate_shop_candidates(text, text, text) to authenticated;

-- 2. admin_register_shop: admin-only. Creates an approved, unclaimed Shop
--    with no linked Installer Account — immediately searchable by Dealers
--    (same approval_status the Directory RPC already filters on) and
--    immediately claimable later through the existing Shop Claim Foundation
--    (request_shop_claim already requires approval_status = 'approved' and
--    ownership_status = 'unclaimed', both set here). Re-runs the same
--    duplicate check as #1 server-side — pConfirmDuplicate lets the Admin
--    knowingly proceed anyway (e.g. a legitimate shared franchise phone
--    line) instead of a hard, unrecoverable block.
create or replace function public.admin_register_shop(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  request_id uuid := nullif(payload ->> 'requestId', '')::uuid;
  duplicate_count int;
begin
  if not public.is_admin() then raise exception 'Only an administrator can register a shop'; end if;
  if coalesce(payload ->> 'shopName', '') = '' then raise exception 'shopName is required'; end if;
  if coalesce(payload ->> 'address', '') = '' then raise exception 'address is required'; end if;
  if coalesce(payload ->> 'phone', '') = '' then raise exception 'phone is required'; end if;

  if coalesce((payload ->> 'confirmDuplicate')::boolean, false) is distinct from true then
    select count(*) into duplicate_count
    from public.installer_shops s
    where s.phone = trim(payload ->> 'phone')
       or (s.shop_name = trim(payload ->> 'shopName') and s.address = trim(payload ->> 'address'));
    if duplicate_count > 0 then
      raise exception 'DUPLICATE_CANDIDATE_EXISTS';
    end if;
  end if;

  insert into public.installer_shops (
    shop_name, address, phone, contact_phone, supported_services, supported_brands,
    accepting_requests, approval_status, ownership_status, created_by
  ) values (
    trim(payload ->> 'shopName'), trim(payload ->> 'address'), trim(payload ->> 'phone'), trim(payload ->> 'phone'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(payload -> 'supportedServices', '[]'::jsonb)) x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(payload -> 'supportedBrands', '[]'::jsonb)) x), '{}'),
    true, 'approved'::public.installer_approval_status, 'unclaimed'::public.shop_ownership_status, auth.uid()
  ) returning id into new_id;

  if request_id is not null then
    update public.shop_search_requests set registered_shop_id = new_id, updated_at = now() where id = request_id;
  end if;

  return new_id;
end;
$$;

revoke all on function public.admin_register_shop(jsonb) from public, anon;
grant execute on function public.admin_register_shop(jsonb) to authenticated;

-- get_admin_shop_search_requests (Phase 2) needs to surface registered_shop_id
-- too, so Admin sees "이미 등록됨" and the resulting Shop when reopening a
-- request they already worked. Same authorization/shape otherwise.
create or replace function public.get_admin_shop_search_requests()
returns table (
  id uuid, dealer_id uuid, dealer_name text, dealer_phone text, region text, work_type text,
  vehicle_maker text, vehicle_model text, desired_inbound_date text, date_flexible boolean,
  dealer_note text, status public.shop_search_request_status, admin_note text,
  registered_shop_id uuid, created_at timestamptz, updated_at timestamptz
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
    r.dealer_note, r.status, r.admin_note, r.registered_shop_id, r.created_at, r.updated_at
  from public.shop_search_requests r
  order by
    (r.status in ('requested', 'in_progress')) desc,
    r.created_at asc;
end;
$$;

revoke all on function public.get_admin_shop_search_requests() from public, anon;
grant execute on function public.get_admin_shop_search_requests() to authenticated;

commit;
