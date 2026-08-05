-- Car-Master v0.3.14 Phase 2A — legal consent history + Kakao-ready pending
-- onboarding foundation. No Kakao/OAuth wiring happens in this migration —
-- it only prepares the DB so that a future OAuth-created auth.users row
-- (which arrives with no signup_role metadata) lands safely as a minimal
-- 'pending' profile instead of a guessed dealer/installer, and can then
-- complete onboarding exactly once through the two new RPCs below.
--
-- Fully additive:
--   - No existing table is dropped/altered destructively.
--   - handle_new_user() keeps the exact existing dealer/installer insert
--     logic, byte-for-byte, for every signup_role value the app has ever
--     sent ('dealer' | 'installer'); only a new branch is added for
--     anything else.
--   - No existing RLS policy is modified; only new policies on the new
--     legal_agreements table are added.
--   - Requires 202608050001_v0314_user_role_pending.sql (adds the
--     'pending' enum label) to already be applied and committed.

-- ---------------------------------------------------------------------
-- Legal consent history
-- ---------------------------------------------------------------------
-- One row per agreement event (not per user) so a future re-consent flow
-- (terms/privacy version bump) has a full, append-only audit trail instead
-- of overwriting the only record of what a user agreed to and when. Only
-- the onboarding RPCs below ever insert into this table — no direct client
-- write path, same "no client insert, RPC-only" invariant already used for
-- profiles/dealer_profiles/installer_profiles/installer_approvals.
create table public.legal_agreements (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  agreed_at timestamptz not null default now()
);

create index legal_agreements_user_id_idx on public.legal_agreements (user_id);

alter table public.legal_agreements enable row level security;

create policy "legal agreements select own or admin" on public.legal_agreements
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.legal_agreements from anon, authenticated;
grant select on public.legal_agreements to authenticated;

-- ---------------------------------------------------------------------
-- handle_new_user(): preserve existing email/password signup, add a
-- minimal pending branch for anything without a recognized signup_role
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role;
begin
  -- coalesce(..., '') is required here, not cosmetic: in SQL three-valued
  -- logic, `NULL NOT IN (...)` evaluates to NULL (not TRUE), and PL/pgSQL's
  -- IF treats a NULL condition as false — so a bare `signup_role NOT IN
  -- (...)` guard would silently SKIP this branch for a NULL signup_role
  -- (no metadata at all, e.g. an OAuth-created row) and fall through to
  -- the CASE below, which defaults to 'dealer'. Coalescing to '' first
  -- makes the comparison a real, non-null value ('' NOT IN (...) = true),
  -- so NULL / '' / any unrecognized string all correctly enter the
  -- pending branch, while exactly 'dealer'/'installer' correctly do not.
  if coalesce(new.raw_user_meta_data ->> 'signup_role', '') not in ('dealer', 'installer') then
    -- No recognized signup_role metadata (OAuth/social sign-in, or any
    -- future path that doesn't collect role/business info before the
    -- auth.users row exists). Create only the identity anchor row and
    -- defer role selection + profile completion to the onboarding RPCs.
    -- Never default to dealer/installer and never fabricate placeholder
    -- business data here.
    insert into public.profiles (id, email, role)
    values (new.id, coalesce(new.email, ''), 'pending'::public.user_role);
    return new;
  end if;

  requested_role := case
    when new.raw_user_meta_data ->> 'signup_role' = 'installer' then 'installer'::public.user_role
    else 'dealer'::public.user_role
  end;

  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), requested_role);

  if requested_role = 'dealer' then
    insert into public.dealer_profiles (user_id, name, phone, company_name, activity_region)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', ''),
      coalesce(new.raw_user_meta_data ->> 'phone', ''),
      nullif(new.raw_user_meta_data ->> 'company_name', ''),
      nullif(new.raw_user_meta_data ->> 'activity_region', '')
    );
  else
    insert into public.installer_profiles (
      user_id, shop_name, representative_name, business_name,
      business_registration_number, address, detail_address, phone,
      contact_phone, supported_services, supported_brands
    ) values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'shop_name', ''),
      coalesce(new.raw_user_meta_data ->> 'representative_name', ''),
      coalesce(new.raw_user_meta_data ->> 'business_name', ''),
      coalesce(new.raw_user_meta_data ->> 'business_registration_number', ''),
      coalesce(new.raw_user_meta_data ->> 'address', ''),
      nullif(new.raw_user_meta_data ->> 'detail_address', ''),
      coalesce(new.raw_user_meta_data ->> 'phone', ''),
      coalesce(new.raw_user_meta_data ->> 'contact_phone', ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'supported_services', '[]'::jsonb))), '{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'supported_brands', '[]'::jsonb))), '{}')
    );
    insert into public.installer_approvals (user_id) values (new.id);
  end if;
  return new;
end;
$$;

-- Grants unchanged from 202607190001 (already supabase_auth_admin-only);
-- re-stating is harmless and keeps this migration self-describing.
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- ---------------------------------------------------------------------
-- Dealer onboarding RPC — completes a pending profile into a dealer
-- ---------------------------------------------------------------------
-- auth.uid()-scoped only: there is no user-id parameter, so a caller can
-- never onboard anyone but themselves. Row is locked `for update` so two
-- concurrent calls can't both observe role = 'pending' and double-insert;
-- the second call blocks, then sees the already-updated role and fails
-- with "Onboarding already completed" instead of creating a duplicate
-- dealer_profiles row (which the primary key would reject anyway, but the
-- explicit role check gives a clean error instead of a raw PK violation).
create or replace function public.complete_dealer_onboarding(payload jsonb)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role public.user_role;
  input_name text := trim(coalesce(payload ->> 'name', ''));
  input_phone text := trim(coalesce(payload ->> 'phone', ''));
  input_company_name text := nullif(trim(coalesce(payload ->> 'companyName', '')), '');
  input_activity_region text := nullif(trim(coalesce(payload ->> 'activityRegion', '')), '');
  input_terms_version text := trim(coalesce(payload ->> 'termsVersion', ''));
  input_privacy_version text := trim(coalesce(payload ->> 'privacyVersion', ''));
  result public.profiles;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select role into caller_role from public.profiles where id = caller_id for update;
  if caller_role is null then
    raise exception 'Profile not found';
  end if;
  if caller_role is distinct from 'pending'::public.user_role then
    raise exception 'Onboarding already completed';
  end if;

  if input_name = '' or input_phone = '' then
    raise exception 'Name and phone are required';
  end if;
  if input_terms_version = '' or input_privacy_version = '' then
    raise exception 'Terms and privacy agreement is required';
  end if;

  update public.profiles set role = 'dealer'::public.user_role, updated_at = now() where id = caller_id;

  insert into public.dealer_profiles (user_id, name, phone, company_name, activity_region)
  values (caller_id, input_name, input_phone, input_company_name, input_activity_region);

  insert into public.legal_agreements (user_id, terms_version, privacy_version)
  values (caller_id, input_terms_version, input_privacy_version);

  select * into result from public.profiles where id = caller_id;
  return result;
end;
$$;

revoke all on function public.complete_dealer_onboarding(jsonb) from public, anon;
grant execute on function public.complete_dealer_onboarding(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Installer onboarding RPC — completes a pending profile into a
-- pending-approval installer application
-- ---------------------------------------------------------------------
create or replace function public.complete_installer_onboarding(payload jsonb)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role public.user_role;
  input_shop_name text := trim(coalesce(payload ->> 'shopName', ''));
  input_representative_name text := trim(coalesce(payload ->> 'representativeName', ''));
  input_business_name text := trim(coalesce(payload ->> 'businessName', ''));
  input_business_registration_number text := trim(coalesce(payload ->> 'businessRegistrationNumber', ''));
  input_address text := trim(coalesce(payload ->> 'address', ''));
  input_detail_address text := nullif(trim(coalesce(payload ->> 'detailAddress', '')), '');
  input_phone text := trim(coalesce(payload ->> 'phone', ''));
  input_contact_phone text := trim(coalesce(payload ->> 'contactPhone', ''));
  input_supported_services text[] := coalesce(array(select jsonb_array_elements_text(coalesce(payload -> 'supportedServices', '[]'::jsonb))), '{}');
  input_supported_brands text[] := coalesce(array(select jsonb_array_elements_text(coalesce(payload -> 'supportedBrands', '[]'::jsonb))), '{}');
  input_terms_version text := trim(coalesce(payload ->> 'termsVersion', ''));
  input_privacy_version text := trim(coalesce(payload ->> 'privacyVersion', ''));
  result public.profiles;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  select role into caller_role from public.profiles where id = caller_id for update;
  if caller_role is null then
    raise exception 'Profile not found';
  end if;
  if caller_role is distinct from 'pending'::public.user_role then
    raise exception 'Onboarding already completed';
  end if;

  if input_shop_name = '' or input_representative_name = '' or input_business_name = ''
     or input_business_registration_number = '' or input_address = ''
     or input_phone = '' or input_contact_phone = '' then
    raise exception 'Required installer fields are missing';
  end if;
  if input_terms_version = '' or input_privacy_version = '' then
    raise exception 'Terms and privacy agreement is required';
  end if;

  update public.profiles set role = 'installer'::public.user_role, updated_at = now() where id = caller_id;

  insert into public.installer_profiles (
    user_id, shop_name, representative_name, business_name,
    business_registration_number, address, detail_address, phone,
    contact_phone, supported_services, supported_brands
  ) values (
    caller_id, input_shop_name, input_representative_name, input_business_name,
    input_business_registration_number, input_address, input_detail_address, input_phone,
    input_contact_phone, input_supported_services, input_supported_brands
  );

  insert into public.installer_approvals (user_id) values (caller_id);

  insert into public.legal_agreements (user_id, terms_version, privacy_version)
  values (caller_id, input_terms_version, input_privacy_version);

  select * into result from public.profiles where id = caller_id;
  return result;
end;
$$;

revoke all on function public.complete_installer_onboarding(jsonb) from public, anon;
grant execute on function public.complete_installer_onboarding(jsonb) to authenticated;
