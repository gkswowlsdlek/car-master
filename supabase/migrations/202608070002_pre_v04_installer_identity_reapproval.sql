-- Car-Master pre-v0.4 security hardening 1-D.
-- An approved installer must be reviewed again after changing identity or
-- registered-business fields that the administrator used for approval.

create or replace function public.reset_installer_approval_on_identity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.shop_name is distinct from new.shop_name
     or old.representative_name is distinct from new.representative_name
     or old.business_name is distinct from new.business_name
     or old.business_registration_number is distinct from new.business_registration_number
     or old.address is distinct from new.address
     or old.detail_address is distinct from new.detail_address then
    update public.installer_approvals
    set status = 'pending'::public.installer_approval_status,
        reviewed_by = null,
        reviewed_at = null,
        review_note = null,
        updated_at = now()
    where user_id = new.user_id
      and status = 'approved'::public.installer_approval_status;
  end if;

  return new;
end;
$$;

revoke all on function public.reset_installer_approval_on_identity_change() from public, anon, authenticated;

drop trigger if exists installer_identity_change_requires_reapproval on public.installer_profiles;
create trigger installer_identity_change_requires_reapproval
  after update of shop_name, representative_name, business_name,
    business_registration_number, address, detail_address
  on public.installer_profiles
  for each row execute procedure public.reset_installer_approval_on_identity_change();
