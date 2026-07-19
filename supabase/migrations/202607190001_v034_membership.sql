-- Car-Master v0.3.4 membership foundation
create type public.user_role as enum ('dealer', 'installer', 'admin');
create type public.installer_approval_status as enum ('pending', 'approved', 'rejected', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dealer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  name text not null,
  phone text not null,
  company_name text,
  activity_region text,
  updated_at timestamptz not null default now()
);

create table public.installer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  shop_name text not null,
  representative_name text not null,
  business_name text not null,
  business_registration_number text not null,
  address text not null,
  detail_address text,
  phone text not null,
  contact_phone text not null,
  supported_services text[] not null default '{}',
  supported_brands text[] not null default '{}',
  business_hours text,
  closed_days text,
  introduction text,
  emergency_available boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.installer_approvals (
  user_id uuid primary key references public.installer_profiles(user_id) on delete cascade,
  status public.installer_approval_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  updated_at timestamptz not null default now()
);

create unique index installer_business_registration_number_idx on public.installer_profiles (business_registration_number);
create index profiles_role_idx on public.profiles (role);
create index installer_approvals_status_idx on public.installer_approvals (status);

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user_id and role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role;
begin
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

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.dealer_profiles enable row level security;
alter table public.installer_profiles enable row level security;
alter table public.installer_approvals enable row level security;

create policy "profiles select own or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "dealer profiles select own or admin" on public.dealer_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "dealer profiles update own" on public.dealer_profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "installer profiles select own or admin" on public.installer_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "installer profiles update own" on public.installer_profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "installer approvals select own or admin" on public.installer_approvals
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "installer approvals admin update" on public.installer_approvals
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, delete on public.dealer_profiles from anon, authenticated;
revoke insert, delete on public.installer_profiles from anon, authenticated;
revoke insert, delete on public.installer_approvals from anon, authenticated;
grant select on public.profiles, public.dealer_profiles, public.installer_profiles, public.installer_approvals to authenticated;
grant update (name, phone, company_name, activity_region, updated_at) on public.dealer_profiles to authenticated;
grant update (shop_name, representative_name, business_name, business_registration_number, address, detail_address, phone, contact_phone, supported_services, supported_brands, business_hours, closed_days, introduction, emergency_available, updated_at) on public.installer_profiles to authenticated;
grant update (status, reviewed_by, reviewed_at, review_note, updated_at) on public.installer_approvals to authenticated;
