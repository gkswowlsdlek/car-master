-- Car-Master Phase 4a: add the 2 new shop_search_requests statuses this
-- phase needs (제안됨/거래 연결 완료). Split into its own migration on
-- purpose — PostgreSQL forbids referencing a newly added enum value inside
-- the same transaction that added it, so the RPCs that use these values
-- must live in a later migration (202608130003), applied as its own
-- separate transaction.

alter type public.shop_search_request_status add value if not exists 'shop_proposed';
alter type public.shop_search_request_status add value if not exists 'transaction_linked';
