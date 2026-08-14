-- Phase D-1: Shop operating profile write boundary.
-- installer_profiles remains the legacy account profile. This RPC is the
-- only new browser write path for installer_shops operating fields.

create or replace function public.update_shop_operating_profile(
  p_shop_id uuid,
  p_payload jsonb
)
returns table (
  id uuid,
  shop_name text,
  address text,
  detail_address text,
  phone text,
  contact_phone text,
  business_hours text,
  closed_days text,
  supported_brands text[],
  supported_services text[],
  introduction text,
  accepting_requests boolean,
  approval_status public.installer_approval_status,
  ownership_status public.shop_ownership_status,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_shop public.installer_shops%rowtype;
  next_shop_name text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Shop operating profile payload must be an object';
  end if;

  select shop.* into current_shop
  from public.installer_shops shop
  where shop.id = p_shop_id;

  if not found then
    raise exception 'Shop not found';
  end if;

  if current_shop.approval_status <> 'approved'::public.installer_approval_status then
    raise exception 'Only approved Shops can update operating information';
  end if;

  if not exists (
    select 1
    from public.shop_memberships membership
    where membership.shop_id = p_shop_id
      and membership.user_id = caller_id
      and membership.status = 'active'::public.shop_membership_status
      and membership.membership_role in ('owner'::public.shop_membership_role, 'manager'::public.shop_membership_role)
  ) then
    raise exception 'Active Shop owner or manager membership required';
  end if;

  next_shop_name := case when p_payload ? 'shop_name'
    then nullif(btrim(p_payload ->> 'shop_name'), '')
    else current_shop.shop_name end;
  if next_shop_name is null then
    raise exception 'shop_name is required';
  end if;

  return query
  update public.installer_shops shop
  set
    shop_name = next_shop_name,
    address = case when p_payload ? 'address' then nullif(btrim(p_payload ->> 'address'), '') else shop.address end,
    detail_address = case when p_payload ? 'detail_address' then nullif(btrim(p_payload ->> 'detail_address'), '') else shop.detail_address end,
    phone = case when p_payload ? 'phone' then nullif(btrim(p_payload ->> 'phone'), '') else shop.phone end,
    contact_phone = case when p_payload ? 'contact_phone' then nullif(btrim(p_payload ->> 'contact_phone'), '') else shop.contact_phone end,
    business_hours = case when p_payload ? 'business_hours' then nullif(btrim(p_payload ->> 'business_hours'), '') else shop.business_hours end,
    closed_days = case when p_payload ? 'closed_days' then nullif(btrim(p_payload ->> 'closed_days'), '') else shop.closed_days end,
    supported_brands = case when p_payload ? 'supported_brands' then coalesce((select array_agg(btrim(value)) from jsonb_array_elements_text(p_payload -> 'supported_brands') value where btrim(value) <> ''), '{}') else shop.supported_brands end,
    supported_services = case when p_payload ? 'supported_services' then coalesce((select array_agg(btrim(value)) from jsonb_array_elements_text(p_payload -> 'supported_services') value where btrim(value) <> ''), '{}') else shop.supported_services end,
    introduction = case when p_payload ? 'introduction' then nullif(btrim(p_payload ->> 'introduction'), '') else shop.introduction end,
    accepting_requests = case when p_payload ? 'accepting_requests' then (p_payload ->> 'accepting_requests')::boolean else shop.accepting_requests end,
    updated_at = now()
  where shop.id = p_shop_id
  returning shop.id, shop.shop_name, shop.address, shop.detail_address, shop.phone,
    shop.contact_phone, shop.business_hours, shop.closed_days, shop.supported_brands,
    shop.supported_services, shop.introduction, shop.accepting_requests,
    shop.approval_status, shop.ownership_status, shop.updated_at;
end;
$$;

revoke all on function public.update_shop_operating_profile(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_shop_operating_profile(uuid, jsonb) to authenticated;

comment on function public.update_shop_operating_profile(uuid, jsonb) is
  'Updates only approved Shop operating fields for an active owner or manager membership.';
