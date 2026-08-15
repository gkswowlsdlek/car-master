-- READ-ONLY preflight for 202608140001. Run in SQL Editor before apply.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('installer_shops', 'shop_memberships')
order by table_name, ordinal_position;

select tablename as table_name, rowsecurity as row_security
from pg_catalog.pg_tables
where schemaname = 'public'
  and tablename in ('installer_shops', 'shop_memberships');

select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       has_function_privilege(p.oid, 'EXECUTE') as current_user_can_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'update_shop_operating_profile';

select table_name, privilege_type, grantee
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('installer_shops', 'shop_memberships')
  and grantee in ('anon', 'authenticated', 'public')
order by table_name, grantee, privilege_type;

select p.policyname, p.tablename, p.cmd, p.roles, p.qual, p.with_check
from pg_catalog.pg_policies p
where p.schemaname = 'public'
  and p.tablename in ('installer_shops', 'shop_memberships')
order by p.tablename, p.policyname;
