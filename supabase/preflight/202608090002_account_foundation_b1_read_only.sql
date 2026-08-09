-- READ-ONLY Production preflight for Account Foundation B1.
-- Run before applying 202608090002. This statement does not change data.
select
  (select count(*) from public.transactions) as transaction_count,
  (select count(*) from public.transactions where installer_id is null) as installer_id_null_count,
  (
    select count(*)
    from public.transactions transaction_row
    where not exists (
      select 1
      from public.installer_shops shop
      where shop.legacy_installer_user_id = transaction_row.installer_id
    )
  ) as unmapped_transaction_count,
  (
    select count(*)
    from (
      select transaction_row.installer_id
      from public.transactions transaction_row
      join public.installer_shops shop
        on shop.legacy_installer_user_id = transaction_row.installer_id
      group by transaction_row.installer_id
      having count(distinct shop.id) > 1
    ) duplicate_mapping
  ) as duplicate_installer_mapping_count,
  (
    select count(*)
    from public.transactions transaction_row
    join public.installer_shops shop
      on shop.legacy_installer_user_id = transaction_row.installer_id
  ) as mapped_transaction_count,
  (select count(*) from public.transaction_rooms) as transaction_room_count,
  (select count(*) from public.chat_messages) as chat_message_count;
