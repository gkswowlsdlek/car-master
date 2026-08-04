-- Car-Master v0.3.13: private Storage bucket for Demo Messenger image/file
-- attachments, so a photo sent in the Demo Dealer 1/1 <-> Demo Installer 2/2
-- shared chat survives a refresh and shows up for the other browser/session
-- instead of the current LocalAttachmentProvider blob: URL (tab-only, gone
-- on refresh).
--
-- Demo accounts are never a real Supabase Auth session (see
-- lib/demo-session.ts — a signed cookie only), so the existing
-- "authenticated ... using (can_access_room(...))" pattern that protects
-- transaction-attachments (202607210001/202607220001) cannot apply here —
-- there is no auth.uid() for it to key off. Rather than weaken that pattern
-- or make this bucket anon-writable (both explicitly forbidden for this
-- change), this bucket grants NOTHING to anon or authenticated at all.
-- Every read/write goes through app/api/demo-attachments/* server routes,
-- which verify the signed Demo session cookie + room membership themselves
-- before using a server-only SUPABASE_SERVICE_ROLE_KEY client that bypasses
-- storage RLS by design. That key is never sent to the browser and this
-- migration does not (and cannot) create it — see docs/admin-bootstrap.md's
-- sibling doc, docs/demo-attachment-storage-setup.md, for the exact manual
-- setup step.
--
-- Fully additive: no existing bucket, policy or table is touched.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'demo-transaction-attachments', 'demo-transaction-attachments', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

-- No storage.objects policy is created for this bucket on purpose: anon and
-- authenticated get zero grants (no select/insert/update/delete), so the
-- bucket is reachable only through the service-role server routes.
