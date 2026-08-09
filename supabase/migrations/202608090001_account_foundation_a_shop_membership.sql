-- Car-Master Account Foundation A: add an account-independent Shop model.
--
-- This migration is intentionally additive. The application continues to use
-- installer_profiles, installer_approvals and transactions.installer_id until
-- a later, separately-reviewed migration switches those runtime paths.

do $$
begin
  create type public.shop_ownership_status as enum ('unclaimed', 'claimed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.shop_membership_role as enum ('owner', 'manager', 'staff');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.shop_membership_status as enum ('active', 'suspended', 'revoked');
exception when duplicate_object then null;
end $$;

create table if not exists public.installer_shops (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null,
  business_name text not null,
  business_registration_number text not null,
  representative_name text not null,
  address text not null,
  detail_address text,
  phone text not null,
  contact_phone text not null,
  supported_services text[] not null default '{}',
  supported_brands text[] not null default '{}',
  business_hours text,
  closed_days text,
  introduction text,
  latitude double precision,
  longitude double precision,
  accepting_requests boolean not null default true,
  approval_status public.installer_approval_status not null default 'pending',
  ownership_status public.shop_ownership_status not null default 'unclaimed',
  created_by uuid references public.profiles(id) on delete set null,
  -- Temporary compatibility key for the later transaction migration. New
  -- admin-pre-registered Shops leave it NULL and therefore need no auth user.
  legacy_installer_user_id uuid unique references public.installer_profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint installer_shops_business_registration_number_key unique (business_registration_number)
);

create table if not exists public.shop_memberships (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.installer_shops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_role public.shop_membership_role not null default 'owner',
  status public.shop_membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_memberships_shop_user_key unique (shop_id, user_id)
);

create index if not exists installer_shops_approval_directory_idx
  on public.installer_shops (approval_status, accepting_requests, updated_at desc);
create index if not exists installer_shops_ownership_idx
  on public.installer_shops (ownership_status);
create index if not exists shop_memberships_user_status_idx
  on public.shop_memberships (user_id, status);
create index if not exists shop_memberships_shop_status_idx
  on public.shop_memberships (shop_id, status);

alter table public.installer_shops enable row level security;
alter table public.shop_memberships enable row level security;

drop policy if exists "installer shops select member or admin" on public.installer_shops;
create policy "installer shops select member or admin"
  on public.installer_shops for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.shop_memberships membership
      where membership.shop_id = installer_shops.id
        and membership.user_id = auth.uid()
        and membership.status = 'active'::public.shop_membership_status
    )
  );

drop policy if exists "shop memberships select own or admin" on public.shop_memberships;
create policy "shop memberships select own or admin"
  on public.shop_memberships for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- No client mutation grants are introduced. A later batch can add narrowly
-- scoped Admin-create and Shop-claim RPCs after their security review.
revoke all on table public.installer_shops from anon, authenticated;
revoke all on table public.shop_memberships from anon, authenticated;
grant select on table public.installer_shops, public.shop_memberships to authenticated;

-- Backfill one Shop for every legacy installer profile. The compatibility
-- user id is unique, making this safe to re-run without creating extra Shops.
-- A missing approval row is treated as pending rather than over-granting.
insert into public.installer_shops (
  shop_name, business_name, business_registration_number,
  representative_name, address, detail_address, phone, contact_phone,
  supported_services, supported_brands, business_hours, closed_days,
  introduction, latitude, longitude, accepting_requests, approval_status,
  ownership_status, created_by, legacy_installer_user_id, updated_at
)
select
  installer.shop_name, installer.business_name,
  installer.business_registration_number, installer.representative_name,
  installer.address, installer.detail_address, installer.phone,
  installer.contact_phone, installer.supported_services,
  installer.supported_brands, installer.business_hours,
  installer.closed_days, installer.introduction, installer.latitude,
  installer.longitude, installer.accepting_requests,
  coalesce(approval.status, 'pending'::public.installer_approval_status),
  'claimed'::public.shop_ownership_status, installer.user_id,
  installer.user_id, installer.updated_at
from public.installer_profiles installer
left join public.installer_approvals approval on approval.user_id = installer.user_id
on conflict (legacy_installer_user_id) do update set
  shop_name = excluded.shop_name,
  business_name = excluded.business_name,
  business_registration_number = excluded.business_registration_number,
  representative_name = excluded.representative_name,
  address = excluded.address,
  detail_address = excluded.detail_address,
  phone = excluded.phone,
  contact_phone = excluded.contact_phone,
  supported_services = excluded.supported_services,
  supported_brands = excluded.supported_brands,
  business_hours = excluded.business_hours,
  closed_days = excluded.closed_days,
  introduction = excluded.introduction,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  accepting_requests = excluded.accepting_requests,
  approval_status = excluded.approval_status,
  ownership_status = 'claimed'::public.shop_ownership_status,
  updated_at = excluded.updated_at;

-- Connect each legacy Installer user to the Shop created above. The pair is
-- unique, so a re-run updates the compatibility membership instead of adding
-- a duplicate.
insert into public.shop_memberships (
  shop_id, user_id, membership_role, status
)
select
  shop.id, shop.legacy_installer_user_id,
  'owner'::public.shop_membership_role,
  'active'::public.shop_membership_status
from public.installer_shops shop
where shop.legacy_installer_user_id is not null
on conflict (shop_id, user_id) do update set
  membership_role = 'owner'::public.shop_membership_role,
  status = 'active'::public.shop_membership_status,
  updated_at = now();
