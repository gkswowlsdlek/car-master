-- Car-Master Phase 8: 전화 확인 결과 기록 — the existing "전화 확인 필요"
-- banner (TransactionChatWorkspace) is purely stage-derived (견적/시공예약)
-- with no way to record whether the Dealer actually reached the Shop. This
-- adds one nullable signal, deliberately separate from both work stage
-- (입고 전/작업 중/작업 완료/출고) and outcome (취소/시공불가) — a Dealer
-- reaching or failing to reach a Shop by phone never forces either of those
-- to change. Same shape as outcome_note (202608130004): plain nullable
-- column, no default (null = not yet checked), same 4-branch
-- admin/dealer/installer/else authorization skeleton, same
-- security-definer + revoke/grant convention, same "post a system chat
-- message so the room's timeline shows it" pattern.

begin;

-- 1. contact_status: nullable, no default. null = 확인 전 (not yet checked).
--    'contacted' = 연결됐어요. 'unreachable' = 연락이 안 돼요. Never deleted,
--    never inferred from stage — only set_transaction_contact_status writes it.
alter table public.transactions add column contact_status text;
alter table public.transactions add constraint transactions_contact_status_check
  check (contact_status is null or contact_status in ('contacted', 'unreachable'));

-- 2. set_transaction_contact_status: dealer (own transaction) or admin only —
--    this mirrors the existing phone-confirm banner's own role === "dealer"
--    gate (TransactionChatWorkspace.tsx); the Shop side isn't the one making
--    the call, so it isn't authorized to record this signal. Never touches
--    stage, never touches transaction_stage_events (this is not a work-stage
--    or outcome change) — only the contact_status column and a room-visible
--    system message.
create function public.set_transaction_contact_status(p_transaction_id text, p_status text)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.transactions;
  caller_role public.user_role;
  room_id uuid;
  status_label text;
begin
  if p_status not in ('contacted', 'unreachable') then
    raise exception 'Invalid contact status';
  end if;

  select * into target from public.transactions where id = p_transaction_id for update;
  if target.id is null then raise exception 'Transaction not found'; end if;

  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role = 'admin'::public.user_role then
    null;
  elsif caller_role = 'dealer'::public.user_role then
    if target.dealer_id <> auth.uid() then raise exception 'Transaction access denied'; end if;
  else
    raise exception 'Only the dealer or an administrator can record a contact result';
  end if;

  update public.transactions
  set contact_status = p_status, updated_at = now()
  where id = p_transaction_id
  returning * into target;

  status_label := case p_status when 'contacted' then '연결됐어요' else '연락이 안 돼요' end;
  select id into room_id from public.transaction_rooms where transaction_id = p_transaction_id;
  if room_id is not null then
    insert into public.chat_messages (room_id, sender_role, text)
    values (room_id, 'system', '전화 확인 결과: ' || status_label);
  end if;

  return target;
end;
$$;

revoke all on function public.set_transaction_contact_status(text, text) from public, anon;
grant execute on function public.set_transaction_contact_status(text, text) to authenticated;

commit;
