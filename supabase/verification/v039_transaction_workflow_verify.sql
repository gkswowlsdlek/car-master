-- v0.3.9 Transaction Workflow — post-migration verification
--
-- Run this in the Supabase SQL Editor (or `psql`) AFTER applying
-- 202607260001_v039_transaction_workflow.sql against Production, BEFORE
-- promoting the app code to Production. This file only reads data — it
-- makes no writes and is safe to run multiple times.
--
-- Read each result set top to bottom. Expected results are noted above
-- each query. Stop and report back if any block doesn't match.

-- 1) No rows should still carry a legacy stage value. Expect: 0 rows.
select stage, count(*) as legacy_row_count
from public.transactions
where stage in ('접수', '입고예정', '시공중', '완료')
group by stage;

-- 2) Current stage distribution — sanity check the backfill landed on the
--    new 4-stage set (plus 취소 if any transactions were ever cancelled).
--    Expect: only 견적 / 시공예약 / 입고 / 작업완료 / 취소.
select stage, count(*) as row_count
from public.transactions
group by stage
order by row_count desc;

-- 3) New default value on the stage column. Expect: '견적'::text (or
--    equivalent — Postgres may print it as "'견적'::text").
select column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'transactions' and column_name = 'stage';

-- 4) transaction_stage_events table exists with the expected shape.
--    Expect: 8 rows — id, transaction_id, from_stage, to_stage, actor_role,
--    actor_id, direction, created_at.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'transaction_stage_events'
order by ordinal_position;

-- 5) RLS is enabled on the new table. Expect: relrowsecurity = true.
select relname, relrowsecurity
from pg_class
where relname = 'transaction_stage_events';

-- 6) Exactly one SELECT policy on the new table, no others. Expect: 1 row,
--    cmd = 'SELECT'.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'transaction_stage_events';

-- 7) Grants on the new table must be SELECT-only for `authenticated` — no
--    INSERT/UPDATE/DELETE should ever be grantable to it directly (writes
--    only happen inside the SECURITY DEFINER RPC). Expect: exactly one row,
--    privilege_type = 'SELECT', grantee = 'authenticated'.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'transaction_stage_events'
  and grantee in ('authenticated', 'anon', 'public');

-- 8) The v036 "no direct UPDATE on transactions" invariant must still hold
--    (this migration doesn't touch it, but re-confirm before going live).
--    Expect: 0 rows (no UPDATE grant, no lingering "participants update"
--    policy).
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'transactions'
  and privilege_type = 'UPDATE';

select policyname
from pg_policies
where schemaname = 'public' and tablename = 'transactions' and policyname ilike '%update%';

-- 9) All four RPCs used by the app exist and are owned/executable as
--    expected. Expect: 4 rows.
select p.proname, r.rolname as owner, p.prosecdef as is_security_definer
from pg_proc p
join pg_roles r on r.oid = p.proowner
where p.proname in ('create_transaction_with_room', 'set_transaction_final_price', 'transition_transaction_payment', 'transition_transaction_stage')
  and p.pronamespace = 'public'::regnamespace;

-- 10) EXECUTE grants on the stage-transition RPC: authenticated only, never
--     anon/public. Expect: 1 row.
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public' and routine_name = 'transition_transaction_stage';

-- 11) Foreign key from transaction_stage_events to transactions is in
--     place with ON DELETE CASCADE. Expect: 1 row, confdeltype = 'c'.
select conname, confdeltype
from pg_constraint
where conrelid = 'public.transaction_stage_events'::regclass and contype = 'f';
