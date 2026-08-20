-- Car-Master Geocoding — optional real coordinates on admin shop registration.
--
-- installer_shops.latitude/longitude have existed since Account Foundation A
-- (202608090001) and get_approved_shop_directory already returns them
-- (202608120002) — the Dealer-side distance calculation was never missing a
-- column. What was actually missing: admin_register_shop (202608130001),
-- the write path every real (non-Demo, non-legacy-installer-profile) Shop
-- goes through today, never accepted latitude/longitude in its payload at
-- all, so every Admin-registered Shop's coordinates stay NULL forever —
-- silently falling back to "거리 정보 없음" in the Dealer's Shop Search list.
--
-- This migration only widens admin_register_shop to accept optional
-- latitude/longitude in its payload and store them if present. It does NOT
-- geocode anything itself (Postgres has no built-in HTTP client here without
-- adding an extension like pg_net, which is out of scope for this pass) —
-- the intended caller is the Admin-facing registration UI, which would
-- geocode the address client-side via the existing /api/geocode route
-- (services/geocoding-service.ts) and pass the result through. That UI
-- wiring is NOT part of this migration — see the completion report for why.
--
-- Existing callers that omit latitude/longitude are unaffected: both remain
-- NULL exactly as before, identical to today's behavior.
--
-- NOT applied to any database by this commit — write-only, for review.

begin;

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
  p_latitude double precision := nullif(payload ->> 'latitude', '')::double precision;
  p_longitude double precision := nullif(payload ->> 'longitude', '')::double precision;
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
    accepting_requests, approval_status, ownership_status, created_by, latitude, longitude
  ) values (
    trim(payload ->> 'shopName'), trim(payload ->> 'address'), trim(payload ->> 'phone'), trim(payload ->> 'phone'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(payload -> 'supportedServices', '[]'::jsonb)) x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(payload -> 'supportedBrands', '[]'::jsonb)) x), '{}'),
    true, 'approved'::public.installer_approval_status, 'unclaimed'::public.shop_ownership_status, auth.uid(),
    p_latitude, p_longitude
  ) returning id into new_id;

  if request_id is not null then
    update public.shop_search_requests set registered_shop_id = new_id, updated_at = now() where id = request_id;
  end if;

  return new_id;
end;
$$;

revoke all on function public.admin_register_shop(jsonb) from public, anon;
grant execute on function public.admin_register_shop(jsonb) to authenticated;

commit;
