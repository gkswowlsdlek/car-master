-- Car-Master Account Foundation B1: connect legacy transactions to Shops.
--
-- This migration is intentionally schema-compatible. Runtime code continues
-- to use transactions.installer_id until a later, separately-reviewed batch.

begin;

alter table public.transactions
  add column shop_id uuid;

alter table public.transactions
  add constraint transactions_shop_id_fkey
  foreign key (shop_id)
  references public.installer_shops(id)
  on delete restrict;

create index transactions_shop_updated_idx
  on public.transactions (shop_id, updated_at desc);

-- Every legacy Installer referenced by a transaction must map to exactly one
-- Shop. Abort the whole transaction before writing if the mapping is missing
-- or ambiguous; never guess a Shop and never copy a user id into shop_id.
do $$
declare
  unmapped_transaction_count bigint;
  duplicate_installer_count bigint;
begin
  select count(*)
  into unmapped_transaction_count
  from public.transactions transaction_row
  where not exists (
    select 1
    from public.installer_shops shop
    where shop.legacy_installer_user_id = transaction_row.installer_id
  );

  if unmapped_transaction_count > 0 then
    raise exception 'Account Foundation B1 aborted: % transaction(s) have no legacy Installer-to-Shop mapping',
      unmapped_transaction_count;
  end if;

  select count(*)
  into duplicate_installer_count
  from (
    select transaction_row.installer_id
    from public.transactions transaction_row
    join public.installer_shops shop
      on shop.legacy_installer_user_id = transaction_row.installer_id
    group by transaction_row.installer_id
    having count(distinct shop.id) > 1
  ) duplicate_mapping;

  if duplicate_installer_count > 0 then
    raise exception 'Account Foundation B1 aborted: % Installer id(s) map to multiple Shops',
      duplicate_installer_count;
  end if;
end
$$;

update public.transactions transaction_row
set shop_id = shop.id
from public.installer_shops shop
where shop.legacy_installer_user_id = transaction_row.installer_id;

do $$
declare
  null_shop_transaction_count bigint;
begin
  select count(*)
  into null_shop_transaction_count
  from public.transactions
  where shop_id is null;

  if null_shop_transaction_count > 0 then
    raise exception 'Account Foundation B1 aborted: % transaction(s) remain without shop_id after backfill',
      null_shop_transaction_count;
  end if;
end
$$;

commit;
