-- Car-Master v0.3.13: Demo installer-membership backend, so Demo Admin 3/3
-- can actually exercise the 시공점 가입 승인 workflow instead of seeing a
-- static "실제 가입 심사는 회원 관리자 계정으로 로그인하면 표시됩니다"
-- placeholder — the only piece of the Admin Workspace that had zero Demo
-- parity. Same physical-isolation philosophy as demo_transactions /
-- demo_chat_messages: no FK to installer_profiles, installer_approvals,
-- profiles or auth.users anywhere in this file. Demo login is a signed
-- cookie only, never a real Supabase Auth session, so there is no
-- auth.uid()/is_admin() for RLS to key off — mutations go through a
-- SECURITY DEFINER RPC with an explicit, client-declared p_actor_role
-- instead, same accepted trust boundary as demo_transactions' p_actor_role
-- (no real identity to cryptographically verify it against; the value this
-- adds is refusing invalid status transitions server-side, not defending
-- against a hostile client).

create table if not exists public.demo_installer_applications (
  id text primary key,
  shop_name text not null,
  representative_name text not null,
  business_name text not null,
  business_registration_number text not null,
  address text not null,
  detail_address text not null default '',
  phone text not null,
  contact_phone text not null default '',
  supported_services text[] not null default '{}',
  supported_brands text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_installer_applications_status_idx on public.demo_installer_applications (status, created_at);

alter table public.demo_installer_applications enable row level security;

drop policy if exists "demo installer applications anon read" on public.demo_installer_applications;
create policy "demo installer applications anon read" on public.demo_installer_applications for select to anon using (true);

-- No insert/update/delete grant to anon — every mutation goes through the
-- SECURITY DEFINER RPC below, matching the real installer_approvals table's
-- RLS-gated-update invariant (there, gated by is_admin(); here, by the RPC
-- being the only path at all).
revoke all on public.demo_installer_applications from public, authenticated;
grant select on public.demo_installer_applications to anon;

create or replace function public.demo_review_installer_application(p_application_id text, p_status text, p_review_note text default '', p_actor_role text default 'admin')
returns public.demo_installer_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_application public.demo_installer_applications;
begin
  if p_actor_role <> 'admin' then
    raise exception 'Only an administrator can review installer applications';
  end if;
  if p_status not in ('pending', 'approved', 'rejected', 'suspended') then
    raise exception 'Invalid application status';
  end if;

  update public.demo_installer_applications
  set status = p_status, review_note = coalesce(p_review_note, ''), updated_at = now()
  where id = p_application_id
  returning * into current_application;

  if current_application.id is null then
    raise exception 'Application not found';
  end if;

  return current_application;
end;
$$;

revoke all on function public.demo_review_installer_application(text, text, text, text) from public, authenticated;
grant execute on function public.demo_review_installer_application(text, text, text, text) to anon;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime' and c.relname = 'demo_installer_applications' and c.relnamespace = 'public'::regnamespace
  ) then
    execute format('alter publication supabase_realtime add table public.demo_installer_applications');
  end if;
end $$;

-- A small, clearly-fictional seed: one pending, one already-approved (so
-- the panel isn't always empty on a fresh demo session), one rejected —
-- enough to exercise every status the UI renders, not a flood of fake data.
insert into public.demo_installer_applications (id, shop_name, representative_name, business_name, business_registration_number, address, detail_address, phone, contact_phone, supported_services, supported_brands, status, review_note, created_at, updated_at)
values
  ('DEMO-APP-0001', '한강 오토랩', '김도윤', '한강오토랩', '123-45-67890', '서울 강동구 천호대로 1000', '2층', '02-000-1111', '010-2222-3333', array['썬팅', '블랙박스'], array['버텍스', '솔라가드'], 'pending', '', '2026-01-01T05:00:00.000Z', '2026-01-01T05:00:00.000Z'),
  ('DEMO-APP-0002', '분당 오토스타일', '박지훈', '분당오토스타일', '111-22-33333', '경기 성남시 분당구 판교로 200', '1층', '031-000-0000', '031-000-0001', array['썬팅', '신차검수', 'PPF', '블랙박스'], array['버텍스', '솔라가드', '후퍼옵틱', '브이쿨'], 'approved', '서류 확인 완료', '2026-01-01T05:01:00.000Z', '2026-01-01T05:01:05.000Z'),
  ('DEMO-APP-0003', '강남 프리미엄 시공', '이서준', '강남프리미엄', '222-33-44444', '서울 강남구 테헤란로 500', '3층', '02-000-2222', '010-4444-5555', array['PPF', '유리막코팅'], array['3M', '엑스팰'], 'rejected', '사업자등록증 확인 불가', '2026-01-01T05:02:00.000Z', '2026-01-01T05:02:10.000Z')
on conflict (id) do nothing;
