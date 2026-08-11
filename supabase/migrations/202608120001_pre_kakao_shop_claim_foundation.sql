begin;

create type public.shop_claim_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table public.shop_claim_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.installer_shops(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status public.shop_claim_request_status not null default 'pending',
  note text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index shop_claim_one_pending_per_user_idx
  on public.shop_claim_requests (shop_id, requester_id)
  where status = 'pending';
create index shop_claim_requests_shop_status_idx
  on public.shop_claim_requests (shop_id, status, created_at desc);

alter table public.shop_claim_requests enable row level security;
revoke all on table public.shop_claim_requests from public, anon, authenticated;
grant select on table public.shop_claim_requests to authenticated;

create policy "claim requests select own or admin"
  on public.shop_claim_requests for select to authenticated
  using (requester_id = auth.uid() or public.is_admin());

create or replace function public.request_shop_claim(p_shop_id uuid, p_note text default '')
returns public.shop_claim_requests
language plpgsql security definer set search_path = ''
as $$
declare result public.shop_claim_requests;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'installer'::public.user_role) then
    raise exception 'Only Installer accounts can request a Shop claim';
  end if;
  if not exists (
    select 1 from public.installer_shops
    where id = p_shop_id and approval_status = 'approved'::public.installer_approval_status
      and ownership_status = 'unclaimed'::public.shop_ownership_status
  ) then raise exception 'Shop is not available for claim'; end if;
  insert into public.shop_claim_requests (shop_id, requester_id, note)
  values (p_shop_id, auth.uid(), coalesce(p_note, '')) returning * into result;
  return result;
end;
$$;

create or replace function public.review_shop_claim(p_request_id uuid, p_approve boolean, p_note text default '')
returns public.shop_claim_requests
language plpgsql security definer set search_path = ''
as $$
declare request_row public.shop_claim_requests; result public.shop_claim_requests;
begin
  if not public.is_admin() then raise exception 'Only administrators can review Shop claims'; end if;
  select * into request_row from public.shop_claim_requests where id = p_request_id for update;
  if request_row.id is null or request_row.status <> 'pending'::public.shop_claim_request_status then
    raise exception 'Claim request is not pending';
  end if;
  if p_approve then
    if not exists (select 1 from public.installer_shops where id = request_row.shop_id and ownership_status = 'unclaimed'::public.shop_ownership_status) then
      raise exception 'Shop has already been claimed';
    end if;
    insert into public.shop_memberships (shop_id, user_id, membership_role, status)
      values (request_row.shop_id, request_row.requester_id, 'owner'::public.shop_membership_role, 'active'::public.shop_membership_status);
    update public.installer_shops set ownership_status = 'claimed'::public.shop_ownership_status, updated_at = now() where id = request_row.shop_id;
  end if;
  update public.shop_claim_requests
    set status = case when p_approve then 'approved'::public.shop_claim_request_status else 'rejected'::public.shop_claim_request_status end,
        reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now()
    where id = p_request_id returning * into result;
  return result;
end;
$$;

revoke all on function public.request_shop_claim(uuid, text) from public, anon;
grant execute on function public.request_shop_claim(uuid, text) to authenticated;
revoke all on function public.review_shop_claim(uuid, boolean, text) from public, anon;
grant execute on function public.review_shop_claim(uuid, boolean, text) to authenticated;

commit;
