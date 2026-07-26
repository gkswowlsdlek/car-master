-- v0.3.10 Business Messenger — READ-ONLY 통합 검증 SQL
-- DB를 전혀 수정하지 않습니다 (전부 SELECT / 시스템 카탈로그 조회 / 순수 함수 호출).
-- 마이그레이션(202607270001_v0310_business_messenger.sql) 적용 후에만 의미가 있습니다
-- (room_reads / demo_chat_* / get_transaction_contact를 참조하므로 적용 전에는 에러가 납니다).
-- Supabase SQL Editor에 이 파일 전체를 그대로 붙여넣고 한 번에 실행하세요.
-- 복사/반복 없이 이 실행 하나의 결과에 18개 항목 + 마지막 OVERALL 요약 행이 함께 나옵니다.

with checks as (

  select 1 as n, 'Demo/Real 분리' as category, 'demo_chat_* 테이블에 real 테이블로의 FK가 없다' as description,
    not exists (
      select 1 from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
        and tc.table_name in ('demo_chat_rooms','demo_chat_messages','demo_chat_reads')
        and ccu.table_name not in ('demo_chat_rooms','demo_chat_messages','demo_chat_reads')
    ) as passed

  union all
  select 2, 'Demo/Real 분리', 'demo_chat_messages.sender_id, demo_chat_reads.reader_id가 text 타입(profiles 참조 아님)',
    (select data_type from information_schema.columns where table_schema='public' and table_name='demo_chat_messages' and column_name='sender_id') = 'text'
    and (select data_type from information_schema.columns where table_schema='public' and table_name='demo_chat_reads' and column_name='reader_id') = 'text'

  union all
  select 3, 'RLS', '신규 테이블 4개(room_reads/demo_chat_rooms/demo_chat_messages/demo_chat_reads) 모두 RLS enabled',
    (select bool_and(relrowsecurity) from pg_class
     where relname in ('room_reads','demo_chat_rooms','demo_chat_messages','demo_chat_reads')
       and relnamespace = 'public'::regnamespace)

  union all
  select 4, 'grants', 'room_reads에 anon/public 권한이 전혀 없다',
    not exists (
      select 1 from information_schema.role_table_grants
      where table_schema='public' and table_name='room_reads' and grantee in ('anon','public')
    )

  union all
  select 5, 'grants', 'room_reads: authenticated는 select/insert/update만 보유(delete 없음)',
    (select array_agg(distinct privilege_type::text order by privilege_type::text) from information_schema.role_table_grants
     where table_schema='public' and table_name='room_reads' and grantee='authenticated')
      = array['INSERT','SELECT','UPDATE']::text[]

  union all
  select 6, 'grants', 'demo_chat_* 테이블에 authenticated/public 권한이 없다',
    not exists (
      select 1 from information_schema.role_table_grants
      where table_schema='public' and table_name in ('demo_chat_rooms','demo_chat_messages','demo_chat_reads')
        and grantee in ('authenticated','public')
    )

  union all
  select 7, 'Demo 데이터 구조', 'demo_chat_messages 제약이 정상이고 고정 시드 메시지 2건이 존재한다',
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.demo_chat_messages'::regclass
        and pg_get_constraintdef(oid) ilike '%sender_role%'
    )
    and (
      select count(*) from public.demo_chat_messages
      where room_id = 'CHAT-DEMO-0001' and client_message_id in ('SEED-DEMO-0001','SEED-DEMO-0002')
    ) = 2

  union all
  select 8, 'RPC 권한', 'get_transaction_contact가 SECURITY DEFINER로 존재한다',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public' and p.proname='get_transaction_contact' and p.prosecdef)

  union all
  select 9, 'get_transaction_contact', 'authenticated만 EXECUTE 가능, anon/public 불가',
    exists (select 1 from information_schema.role_routine_grants
            where routine_schema='public' and routine_name='get_transaction_contact' and grantee='authenticated')
    and not exists (select 1 from information_schema.role_routine_grants
            where routine_schema='public' and routine_name='get_transaction_contact' and grantee in ('anon','public'))

  union all
  -- Postgres can serialize an empty search_path in proconfig as either
  -- "search_path=" or "search_path=\"\"" depending on version/formatting; the
  -- original check only matched the first exact literal and false-negatived
  -- on a genuinely-correct function. Parse key/value instead of string-matching whole.
  select 10, 'get_transaction_contact', 'search_path가 빈 문자열로 설정되어 있다(기존 컨벤션과 일치)',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public' and p.proname='get_transaction_contact'
              and exists (
                select 1 from unnest(coalesce(p.proconfig,'{}')) cfg
                where split_part(cfg, '=', 1) = 'search_path'
                  and trim(both '"' from split_part(cfg, '=', 2)) = ''
              ))

  union all
  select 11, '기존 불변식', 'transactions 테이블에 authenticated UPDATE grant가 없다',
    not exists (select 1 from information_schema.role_table_grants
                where table_schema='public' and table_name='transactions'
                  and grantee='authenticated' and privilege_type='UPDATE')

  union all
  select 12, '기존 불변식', 'transactions에 update 정책이 존재하지 않는다(RPC-only)',
    not exists (select 1 from pg_policies where schemaname='public' and tablename='transactions' and cmd='UPDATE')

  union all
  select 13, 'Realtime publication', 'room_reads/demo_chat_rooms/demo_chat_messages/demo_chat_reads가 모두 publication에 포함',
    (select count(*) from pg_publication_rel pr join pg_publication p on p.oid=pr.prpubid join pg_class c on c.oid=pr.prrelid
     where p.pubname='supabase_realtime' and c.relname in ('room_reads','demo_chat_rooms','demo_chat_messages','demo_chat_reads')) = 4

  union all
  select 14, 'Realtime publication', 'chat_messages/transactions가 여전히 publication에 포함(회귀 없음)',
    (select count(*) from pg_publication_rel pr join pg_publication p on p.oid=pr.prpubid join pg_class c on c.oid=pr.prrelid
     where p.pubname='supabase_realtime' and c.relname in ('chat_messages','transactions')) = 2

  union all
  select 15, 'attachment 제약', 'chat_messages 첨부파일 CHECK 제약이 최대 4장을 허용한다',
    (select pg_get_constraintdef(oid) from pg_constraint
     where conrelid='public.chat_messages'::regclass and conname='chat_messages_attachments_check') ilike '%<= 4%'

  union all
  select 16, 'attachment 제약', 'chat_attachments_match_room()가 같은 room의 2장은 허용하고 다른 room으로 첨부되면 차단한다',
    public.chat_attachments_match_room(
      '00000000-0000-0000-0000-000000000000'::uuid,
      '[{"storagePath":"00000000-0000-0000-0000-000000000000/11111111-1111-4111-8111-111111111111/a.jpg"},
        {"storagePath":"00000000-0000-0000-0000-000000000000/11111111-1111-4111-8111-111111111111/b.jpg"}]'::jsonb
    )
    and not public.chat_attachments_match_room(
      '00000000-0000-0000-0000-000000000000'::uuid,
      '[{"storagePath":"00000000-0000-0000-0000-000000000000/11111111-1111-4111-8111-111111111111/a.jpg"},
        {"storagePath":"99999999-9999-9999-9999-999999999999/11111111-1111-4111-8111-111111111111/b.jpg"}]'::jsonb
    )

  union all
  select 17, 'attachment 제약', 'demo_chat_messages CHECK 제약도 최대 4장을 허용한다',
    (select pg_get_constraintdef(oid) from pg_constraint
     where conrelid='public.demo_chat_messages'::regclass and conname like '%attachments%') ilike '%<= 4%'

  union all
  select 18, '기존 불변식', 'chat_messages(room_id, client_message_id) 유니크 인덱스가 여전히 존재한다',
    exists (select 1 from pg_indexes where schemaname='public' and tablename='chat_messages'
            and indexname='chat_messages_room_client_message_idx')

)
select "#", "분류", "검증 항목", "결과" from (
  select n as sort_key, n::text as "#", category as "분류", description as "검증 항목",
    case when passed then 'PASS' else 'FAIL' end as "결과"
  from checks
  union all
  select
    999,
    'TOTAL',
    'OVERALL',
    case when count(*) filter (where not passed) = 0 then 'OVERALL PASS' else 'OVERALL FAIL' end,
    count(*) filter (where passed) || '/' || count(*) || ' checks passed'
  from checks
) combined
order by sort_key;
