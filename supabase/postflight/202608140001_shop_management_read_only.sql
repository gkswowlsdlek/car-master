-- READ-ONLY postflight for 202608140001. Run after manual apply.
select p.oid::regprocedure as function_signature,
       p.prosecdef as security_definer,
       p.proowner::regrole as owner_role,
       p.proconfig as function_config
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'update_shop_operating_profile';

select routine_schema, routine_name, routine_type,
       security_type, data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'update_shop_operating_profile';

select routine_schema, routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'update_shop_operating_profile'
order by grantee, privilege_type;

select table_name, table_type
from information_schema.tables
where table_schema = 'public'
  and table_name in ('installer_shops', 'shop_memberships');

select tablename as table_name, rowsecurity as row_security
from pg_catalog.pg_tables
where schemaname = 'public'
  and tablename in ('installer_shops', 'shop_memberships');

select count(*) as installer_shops_count from public.installer_shops;
select count(*) as shop_memberships_count from public.shop_memberships;
