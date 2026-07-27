"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, Bell, BellOff, Copy, FileText, ImagePlus, Info, MoreHorizontal, Paperclip, Phone, Send, X } from "lucide-react";
import { attachmentProvider, supabaseAttachmentProvider } from "../../services/attachments";
import { canTransitionStage, nextForwardStage, revertStage, stageLogLabel, stageOrder, STAGE_ACTION_LABEL, STAGE_REVERT_LABEL } from "../../services/transaction-state-service";
import type { ChatAttachment, ChatRoom, PaymentStatus, Transaction, TransactionChatMessage, TransactionStage } from "../../types/transactions";

const won = (value?: number) => value == null ? "미확정" : `${value.toLocaleString("ko-KR")}원`;
const fileSize = (value: number) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))}KB` : `${(value / 1024 / 1024).toFixed(1)}MB`;
// 시공예약 확정 → accept, 입고 처리 → start-work(작업의 시작), 작업완료 → complete-work.
// start-work-button / complete-work-button 문자열은 tests/v036-production-connection.test.mjs가 그대로 검증한다.
const stageActionTestId = (stage?: TransactionStage) => stage === "시공예약" ? "accept-transaction-button" : stage === "입고" ? "start-work-button" : stage === "작업완료" ? "complete-work-button" : undefined;
const MAX_ATTACHMENTS = 4;
const QUICK_REPLIES = ["확인했습니다.", "가능합니다.", "일정 확인 후 답변드릴게요.", "입고 가능합니다."];

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "오늘";
  if (date.toDateString() === yesterday.toDateString()) return "어제";
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function draftKey(roomId?: string) { return roomId ? `car-master-chat-draft:${roomId}` : ""; }

// Schedule fields can be a plain date ("2026-07-29") or a full ISO timestamp
// depending on how they were set — never show either raw to the user.
function scheduleLabel(value?: string) {
  if (!value) return "미정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

export function TransactionChatWorkspace({ role, userId, transaction, room, useRemoteAttachments, onSend, onHide, onFinalPriceChange, onStageChange, onPaymentChange, onMarkRead, onLoadContact, onBack }: {
  role: "dealer" | "shop";
  userId: string;
  transaction: Transaction;
  room?: ChatRoom;
  useRemoteAttachments: boolean;
  onSend: (transaction: Transaction, message: TransactionChatMessage) => Promise<void>;
  onHide: (id: string, role: "dealer" | "shop") => void;
  onFinalPriceChange: (transaction: Transaction, finalPrice: number) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => Promise<void>;
  onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
  onMarkRead?: (roomId: string) => void;
  onLoadContact?: (transaction: Transaction) => Promise<{ name: string; phone: string } | null>;
  /** Only passed by MessengerScreen — renders a mobile-only back-to-Inbox button. TransactionManagementScreen never passes this, so its header is unchanged. */
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [preview, setPreview] = useState<ChatAttachment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [finalPrice, setFinalPrice] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [stagePending, setStagePending] = useState(false);
  const [stageError, setStageError] = useState("");
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [showStageLog, setShowStageLog] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactState, setContactState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [contact, setContact] = useState<{ name: string; phone: string } | null>(null);
  const [contactCopied, setContactCopied] = useState(false);
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const messagesContainer = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef<ChatAttachment[]>([]);
  const stageIndex = stageOrder.indexOf(transaction.status.stage);
  const forwardStage = nextForwardStage(transaction.status.stage);
  const backStage = revertStage(transaction.status.stage);
  const canAdvance = Boolean(forwardStage) && canTransitionStage(transaction.status.stage, forwardStage!, role);
  const canRevert = Boolean(backStage) && canTransitionStage(transaction.status.stage, backStage!, role);

  // Stage changes are projected into the timeline from transaction.stageLog
  // (the existing source of truth) instead of also writing a chat_messages
  // row per transition — one write path, no duplicated history. The very
  // first stageLog entry (room creation) is skipped since the room's own
  // initial system chat message already covers it.
  const timeline: ({ key: string; createdAt: string; kind: "stage"; label: string } | { key: string; createdAt: string; kind: "message"; message: TransactionChatMessage })[] = room ? [
    ...room.messages.map((message) => ({ key: message.id, createdAt: message.createdAt, kind: "message" as const, message })),
    ...transaction.stageLog.slice(1).map((event) => ({ key: event.id, createdAt: event.createdAt, kind: "stage" as const, label: stageLogLabel(event) })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];

  const runStageChange = async (next: TransactionStage) => {
    if (stagePending) return;
    setStagePending(true);
    setStageError("");
    try {
      await onStageChange(transaction, next);
    } catch (error) {
      setStageError(error instanceof Error ? error.message : "상태를 변경하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setStagePending(false);
    }
  };
  const handleAdvanceClick = () => {
    if (!forwardStage || stagePending) return;
    if (forwardStage === "작업완료") { setConfirmCompleteOpen(true); return; }
    void runStageChange(forwardStage);
  };
  const confirmComplete = () => { setConfirmCompleteOpen(false); void runStageChange("작업완료"); };

  // Load any draft left behind the last time this room was open, and swap it
  // out (not append) whenever the user switches rooms. Adjusted synchronously
  // during render (React's documented pattern for "reset state when a prop
  // changes") rather than in an effect, since setState-in-effect triggers an
  // avoidable extra render pass.
  const [lastDraftRoomId, setLastDraftRoomId] = useState(room?.id);
  if (room?.id !== lastDraftRoomId) {
    setLastDraftRoomId(room?.id);
    const key = draftKey(room?.id);
    setDraft(key ? sessionStorage.getItem(key) ?? "" : "");
  }
  useEffect(() => {
    const key = draftKey(room?.id);
    if (!key) return;
    if (draft) sessionStorage.setItem(key, draft); else sessionStorage.removeItem(key);
  }, [draft, room?.id]);

  // Auto-scroll only follows new messages while the reader is already near
  // the bottom — someone scrolled up to reread history shouldn't get yanked
  // back down. Otherwise a small "새 메시지" affordance appears instead.
  const wasNearBottom = useRef(true);
  useEffect(() => {
    if (wasNearBottom.current) { messageEnd.current?.scrollIntoView({ block: "end" }); setShowJumpToLatest(false); }
    else setShowJumpToLatest(true);
  }, [timeline.length]);
  const handleScroll = () => {
    const element = messagesContainer.current;
    if (!element) return;
    wasNearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    if (wasNearBottom.current) setShowJumpToLatest(false);
  };
  const jumpToLatest = () => { messageEnd.current?.scrollIntoView({ block: "end" }); setShowJumpToLatest(false); wasNearBottom.current = true; };

  // Textarea grows with content up to a cap, then scrolls internally.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
  }, [draft]);

  // Mark-as-read only fires while this exact room is open, the tab is
  // actually visible, and messages exist to read — never from a background
  // Inbox fetch. Re-fires on new messages arriving and on tab refocus.
  useEffect(() => {
    if (!room || !onMarkRead || document.visibilityState !== "visible") return;
    const timer = setTimeout(() => onMarkRead(room.id), 400);
    return () => clearTimeout(timer);
    // `room` itself changes identity on every parent re-render (it's a fresh
    // array .find() result each time) — depending on room?.id/timeline.length
    // instead avoids re-arming this timer on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, timeline.length, onMarkRead]);
  useEffect(() => {
    if (!onMarkRead) return;
    const handleVisibility = () => { if (document.visibilityState === "visible" && room) onMarkRead(room.id); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, onMarkRead]);

  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => () => {
    const provider = useRemoteAttachments ? supabaseAttachmentProvider : attachmentProvider;
    pendingRef.current.forEach((item) => { if (provider.discard) void provider.discard(item); else provider.release(item); });
  }, [useRemoteAttachments]);

  const selectFiles = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setAttachmentError("");
    const room_ = pendingRef.current.length;
    const capped = list.slice(0, Math.max(0, MAX_ATTACHMENTS - room_));
    if (list.length > capped.length) setAttachmentError(`한 번에 최대 ${MAX_ATTACHMENTS}장까지 첨부할 수 있어요.`);
    const provider = useRemoteAttachments ? supabaseAttachmentProvider : attachmentProvider;
    for (const file of capped) {
      try {
        const prepared = await provider.prepare(file, room?.id);
        pendingRef.current = [...pendingRef.current, prepared];
        setPending([...pendingRef.current]);
      } catch (error) {
        setAttachmentError(error instanceof Error ? error.message : "파일을 업로드하지 못했습니다.");
      }
    }
  };
  const removePending = (id: string) => setPending((current) => {
    const next = current.filter((item) => {
    if (item.id === id) {
      const provider = useRemoteAttachments ? supabaseAttachmentProvider : attachmentProvider;
      if (provider.discard) void provider.discard(item); else provider.release(item);
    }
      return item.id !== id;
    });
    pendingRef.current = next;
    return next;
  });
  const send = async () => {
    const text = draft.trim();
    if ((!text && pending.length === 0) || !room || isSending) return;
    const now = new Date().toISOString();
    setIsSending(true);
    setAttachmentError("");
    try {
      await onSend(transaction, { id: `${room.id}-M-${now}`, roomId: room.id, senderId: userId, senderRole: role, text, attachments: pending, createdAt: now, readBy: [userId] });
      pendingRef.current = [];
      setDraft(""); setPending([]);
      const key = draftKey(room.id);
      if (key) sessionStorage.removeItem(key);
    } catch (error) {
      const provider = useRemoteAttachments ? supabaseAttachmentProvider : attachmentProvider;
      await Promise.allSettled(pending.map((item) => provider.discard?.(item)));
      pendingRef.current = [];
      setPending([]);
      setAttachmentError(error instanceof Error ? error.message : "메시지를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSending(false);
    }
  };
  const insertQuickReply = (text: string) => {
    setDraft((current) => current.trim() ? `${current.trim()} ${text}` : text);
    textareaRef.current?.focus();
  };
  const hide = () => {
    const warning = transaction.status.stage !== "작업완료" && role === "shop" ? "진행 중인 거래입니다. 그래도 숨기시겠습니까?\n" : "";
    if (confirm(`${warning}이 거래방은 목록에서 숨겨집니다. 거래 기록은 카마스터에 보관됩니다.`)) onHide(transaction.id, role);
  };
  const openContact = async () => {
    setContactOpen(true);
    setContactCopied(false);
    if (!onLoadContact) { setContactState("error"); return; }
    setContactState("loading");
    try {
      const result = await onLoadContact(transaction);
      setContact(result);
      setContactState("loaded");
    } catch { setContactState("error"); }
  };
  const copyContactPhone = () => {
    if (!contact) return;
    void navigator.clipboard?.writeText(contact.phone).then(() => setContactCopied(true));
  };
  const savePrice = () => {
    const value = Number(finalPrice.replace(/\D/g, ""));
    if (value <= 0) return;
    onFinalPriceChange(transaction, value);
    setFinalPrice("");
  };

  return <article className="messenger-workspace" data-testid={`transaction-detail-${transaction.id}`}>
    <section className="messenger-center">
      <header className="messenger-header">{onBack && <button className="chat-back-button" onClick={onBack} aria-label="목록으로 돌아가기"><ArrowLeft size={20} /></button>}<div><span className="messenger-avatar">{transaction.vehicle.maker.slice(0, 1)}</span><div><h2>{transaction.vehicle.maker} {transaction.vehicle.model} · {transaction.service.product ?? transaction.service.workDescription}</h2><p>{role === "dealer" ? transaction.installerName : "담당 딜러"} <i /> <b>{transaction.status.stage}</b></p></div></div><nav><button aria-label={notificationsMuted ? "대화 알림 켜기" : "대화 알림 끄기"} title={notificationsMuted ? "알림 켜기" : "알림 끄기"} className={notificationsMuted ? "active" : ""} onClick={() => setNotificationsMuted((value) => !value)}>{notificationsMuted ? <BellOff size={18} /> : <Bell size={18} />}</button><button aria-label="전화하기" title={contactState === "loaded" && !contact ? "등록된 연락처가 없습니다." : "연락처 확인"} className="messenger-call-button" disabled={contactState === "loaded" && !contact} onClick={() => void openContact()}><Phone size={18} /></button><button aria-label="거래 정보" className={showDetails ? "active" : ""} onClick={() => setShowDetails((value) => !value)}><Info size={18} /></button><span className="messenger-more-wrap"><button aria-label="더보기" aria-expanded={moreMenuOpen} onClick={() => setMoreMenuOpen((value) => !value)}><MoreHorizontal size={19} /></button>{moreMenuOpen && <div className="messenger-more-menu"><button onClick={() => { setNotificationsMuted((value) => !value); setMoreMenuOpen(false); }}>{notificationsMuted ? "알림 켜기" : "알림 끄기"}</button><button onClick={() => { setShowDetails(true); setMoreMenuOpen(false); }}>거래 상세 보기</button>{role === "dealer" && <button onClick={() => { setShowDetails(true); setMoreMenuOpen(false); }}>시공점 정보 보기</button>}<button onClick={() => { setMoreMenuOpen(false); hide(); }}>이 거래방 숨기기</button></div>}</span></nav></header>
      <section className="shop-stage-overview">
        {stageError && <p className="stage-error" role="alert">{stageError}</p>}
        <div className="stage-actions">
          {canAdvance && <button data-testid={stageActionTestId(forwardStage)} className="primary stage-cta" onClick={handleAdvanceClick} disabled={stagePending} aria-busy={stagePending}>{stagePending ? "처리 중…" : STAGE_ACTION_LABEL[forwardStage!]}</button>}
          {canRevert && <button type="button" className="stage-revert-link" onClick={() => void runStageChange(backStage!)} disabled={stagePending}>↩ {STAGE_REVERT_LABEL[backStage!]}</button>}
        </div>
        {confirmCompleteOpen && <div className="stage-confirm-overlay" role="dialog" aria-modal="true">
          <div className="stage-confirm-backdrop" onClick={() => setConfirmCompleteOpen(false)} />
          <div className="stage-confirm-card">
            <h3>작업완료 처리할까요?</h3>
            <p>작업완료로 표시하면 이 거래는 완료 상태가 됩니다. 실수였다면 이후에도 입고 상태로 되돌릴 수 있어요.</p>
            <div className="stage-confirm-buttons"><button type="button" className="button button-secondary" onClick={() => setConfirmCompleteOpen(false)}>취소</button><button type="button" className="button button-primary" onClick={confirmComplete}>작업완료 처리</button></div>
          </div>
        </div>}
      </section>
      <div className="messenger-messages" ref={messagesContainer} onScroll={handleScroll}>
        <div className="message-date-divider"><span>거래방 생성 · {dayLabel(transaction.status.createdAt)}</span></div>
        {timeline.map((entry, index) => {
          const previousDate = index > 0 ? new Date(timeline[index - 1].createdAt).toDateString() : "";
          const currentDate = new Date(entry.createdAt).toDateString();
          const showDivider = index === 0 ? false : previousDate !== currentDate;
          if (entry.kind === "stage") return <div key={entry.key}>
            {showDivider && <div className="message-date-divider"><span>{dayLabel(entry.createdAt)}</span></div>}
            <div className="message-system message-stage-event"><span>{entry.label}</span></div>
          </div>;
          const message = entry.message;
          const mine = message.senderId === userId;
          const read = mine && message.readBy.length > 1;
          if (message.senderRole === "system") return <div key={entry.key}>
            {showDivider && <div className="message-date-divider"><span>{dayLabel(message.createdAt)}</span></div>}
            <div className="message-system"><span>{message.text}</span></div>
          </div>;
          return <div key={entry.key}>{showDivider && <div className="message-date-divider"><span>{dayLabel(message.createdAt)}</span></div>}<div className={`message-row ${mine ? "mine" : "theirs"}`}>
            {!mine && <span className="message-avatar">{message.senderRole === "shop" ? "시" : "딜"}</span>}
            <div className="message-content"><small>{mine ? "나" : message.senderRole === "shop" ? "시공점" : "딜러"}</small>{message.text && <p>{message.text}</p>}{message.attachments?.map((attachment) => attachment.kind === "image" ? <button className="image-message" key={attachment.id} onClick={() => setPreview(attachment)}><img src={attachment.url} alt={attachment.name} /><span>{attachment.name}</span></button> : <a className="file-message" key={attachment.id} href={attachment.url} download={attachment.name}><FileText size={22} /><span><b>{attachment.name}</b><small>{fileSize(attachment.size)}</small></span></a>)}<span><time>{new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</time>{read && <em className="message-status read">읽음</em>}</span></div>
          </div></div>;
        })}
        {!room && <div className="messenger-empty"><b>거래방을 준비하고 있습니다.</b><span>거래방 생성 후 메시지를 보낼 수 있습니다.</span></div>}
        {room && timeline.length === 0 && <div className="messenger-empty"><b>아직 대화가 없습니다.</b><span>거래에 필요한 내용을 여기서 이야기해보세요.</span></div>}
        <div ref={messageEnd} />
      </div>
      {showJumpToLatest && <button className="jump-to-latest" onClick={jumpToLatest}><ArrowDown size={15} /> 새 메시지</button>}
      <footer className="messenger-composer">
        {attachmentError && <p className="login-error">{attachmentError}</p>}
        <div className="quick-reply-row">{QUICK_REPLIES.map((reply) => <button type="button" key={reply} className="quick-reply-chip" onClick={() => insertQuickReply(reply)} disabled={isSending}>{reply}</button>)}</div>
        {pending.length > 0 && <div className="attachment-preview-strip">{pending.map((item) => <div key={item.id}>{item.kind === "image" ? <img src={item.url} alt="" /> : <FileText size={22} />}<span><b>{item.name}</b><small>{fileSize(item.size)} · {item.persistence === "remote" ? "거래방에 안전하게 저장" : "이번 세션에서만 표시"}</small></span><button onClick={() => removePending(item.id)} aria-label="첨부 삭제"><X size={15} /></button></div>)}</div>}
        <div className="composer-row"><div className="composer-tools"><button onClick={() => imageInput.current?.click()} aria-label="사진 첨부" disabled={isSending}><ImagePlus size={19} /></button><button onClick={() => fileInput.current?.click()} aria-label="파일 첨부" disabled={isSending}><Paperclip size={19} /></button></div><textarea ref={textareaRef} data-testid="chat-input" rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="메시지를 입력하세요." /><button data-testid="chat-send-button" className="composer-send" onClick={() => void send()} disabled={isSending || !room || (!draft.trim() && pending.length === 0)} aria-busy={isSending}><Send size={18} /><span>{isSending ? "전송 중" : "보내기"}</span></button></div>
        <input data-testid="file-upload-input" ref={imageInput} hidden type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { void selectFiles(event.target.files); event.target.value = ""; }} /><input ref={fileInput} hidden type="file" multiple accept=".pdf,.txt,.doc,.docx,.xls,.xlsx" onChange={(event) => { void selectFiles(event.target.files); event.target.value = ""; }} />
      </footer>
    </section>
    <aside className={`messenger-sidebar ${showDetails ? "mobile-open" : ""}`}><button className="sidebar-close" onClick={() => setShowDetails(false)}><X size={18} /></button><div className="briefing-title"><span>TRANSACTION INFO</span><h3>거래 정보</h3><p>대화 중에도 핵심 작업 정보를 바로 확인하세요.</p></div>
      <div className="sidebar-stage"><span>현재 상태</span><b>{transaction.status.stage}</b><div className="stage-progress-rail sidebar-stage-rail">{stageOrder.map((stage, index) => <span className={index < stageIndex ? "complete" : index === stageIndex ? "active" : ""} key={stage}><i>{index < stageIndex ? "✓" : index + 1}</i><small>{stage}</small></span>)}</div></div>
      <dl className="briefing-data"><div><dt>다음 일정</dt><dd>{scheduleLabel(transaction.schedule.confirmedInboundAt ?? transaction.schedule.requestedInboundAt)}</dd></div><div><dt>차량</dt><dd>{transaction.vehicle.maker} {transaction.vehicle.model} ({transaction.vehicle.class || "미분류"})</dd></div><div><dt>시공 품목</dt><dd>{transaction.service.workDescription}</dd></div><div><dt>상대 업체</dt><dd>{role === "dealer" ? transaction.installerName : "담당 딜러"}</dd></div></dl>
      <div className="sidebar-settlement"><h4>결제 및 정산</h4><p>확정 금액 <b>{won(transaction.pricing.finalPrice)}</b></p><p>결제 상태 <b>{transaction.pricing.paymentStatus}</b></p>{role === "shop" && <div><input value={finalPrice} onChange={(event) => setFinalPrice(event.target.value)} placeholder="최종 시공금액" /><button onClick={savePrice}>저장</button></div>}{role === "dealer" && transaction.pricing.finalPrice && transaction.pricing.paymentStatus === "미결제" && <button onClick={() => onPaymentChange(transaction, "결제대기")}>금액 확인</button>}</div>
      <div className="sidebar-stage-log">
        <button type="button" className="sidebar-stage-log-toggle" onClick={() => setShowStageLog((value) => !value)} aria-expanded={showStageLog}><span>전체 기록 보기</span>{showStageLog ? "▲" : "▼"}</button>
        {showStageLog && (transaction.stageLog.length === 0 ? <p className="stage-log-empty">아직 기록이 없습니다.</p> : <ul>{[...transaction.stageLog].reverse().map((event) => <li key={event.id}><time>{new Date(event.createdAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time><span>{stageLogLabel(event)}</span></li>)}</ul>)}
      </div>
      <button className="transaction-hide-button" onClick={hide}>이 거래방 숨기기</button>
    </aside>
    {preview && <div className="attachment-lightbox" role="dialog" aria-modal="true" onClick={() => setPreview(null)}><button aria-label="닫기" onClick={() => setPreview(null)}><X size={22} /></button><figure onClick={(event) => event.stopPropagation()}><img src={preview.url} alt={preview.name} /><figcaption>{preview.name}</figcaption></figure></div>}
    {contactOpen && <div className="contact-sheet-overlay" role="dialog" aria-modal="true" aria-label="연락처 확인">
      <div className="contact-sheet-backdrop" onClick={() => setContactOpen(false)} />
      <div className="contact-sheet-card">
        {contactState === "loading" && <p className="contact-sheet-status">연락처를 확인하는 중입니다…</p>}
        {contactState === "error" && <p className="contact-sheet-status" role="alert">연락처를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
        {contactState === "loaded" && !contact && <p className="contact-sheet-status">연락처가 등록되지 않았습니다.</p>}
        {contactState === "loaded" && contact && <>
          <b className="contact-sheet-name">{contact.name}</b>
          <p className="contact-sheet-phone">{contact.phone}</p>
          <div className="contact-sheet-actions">
            <button type="button" className="button button-secondary" onClick={copyContactPhone}><Copy size={16} /> {contactCopied ? "복사됨" : "번호 복사"}</button>
            <a className="button button-primary" href={`tel:${contact.phone.replace(/[^0-9+]/g, "")}`}><Phone size={16} /> 통화하기</a>
          </div>
        </>}
        <button type="button" className="contact-sheet-close" onClick={() => setContactOpen(false)}>취소</button>
      </div>
    </div>}
  </article>;
}
