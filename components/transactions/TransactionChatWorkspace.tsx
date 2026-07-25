"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { CheckCheck, FileText, ImagePlus, Info, Paperclip, Send, X } from "lucide-react";
import { attachmentProvider, supabaseAttachmentProvider } from "../../services/attachments";
import { canTransitionStage } from "../../services/transaction-state-service";
import type { ChatAttachment, ChatRoom, PaymentStatus, Transaction, TransactionChatMessage, TransactionStage } from "../../types/transactions";

const stages: TransactionStage[] = ["접수", "입고예정", "입고", "시공중", "완료"];
const stageLabel: Record<TransactionStage | "취소", string> = { 접수: "접수", 입고예정: "예약", 입고: "입고", 시공중: "시공", 완료: "완료", 취소: "취소" };
const won = (value?: number) => value == null ? "미확정" : `${value.toLocaleString("ko-KR")}원`;
const fileSize = (value: number) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))}KB` : `${(value / 1024 / 1024).toFixed(1)}MB`;
const stageActionTestId = (stage?: TransactionStage) => stage === "입고예정" ? "accept-transaction-button" : stage === "시공중" ? "start-work-button" : stage === "완료" ? "complete-work-button" : undefined;
const stageActionLabel = (stage?: TransactionStage) => stage === "입고예정" ? "예약 확정" : stage === "입고" ? "입고 확인" : stage === "시공중" ? "작업 시작" : stage === "완료" ? "완료 처리" : `${stage} 확인`;

export function TransactionChatWorkspace({ role, userId, transaction, room, useRemoteAttachments, onSend, onHide, onFinalPriceChange, onStageChange, onPaymentChange }: {
  role: "dealer" | "shop";
  userId: string;
  transaction: Transaction;
  room?: ChatRoom;
  useRemoteAttachments: boolean;
  onSend: (transaction: Transaction, message: TransactionChatMessage) => Promise<void>;
  onHide: (id: string, role: "dealer" | "shop") => void;
  onFinalPriceChange: (transaction: Transaction, finalPrice: number) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => void;
  onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [preview, setPreview] = useState<ChatAttachment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [finalPrice, setFinalPrice] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<ChatAttachment[]>([]);
  const stageIndex = stages.indexOf(transaction.status.stage);
  const nextStage = stageIndex >= 0 ? stages[stageIndex + 1] : undefined;

  useEffect(() => { messageEnd.current?.scrollIntoView({ block: "end" }); }, [room?.messages.length]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => () => {
    const provider = useRemoteAttachments ? supabaseAttachmentProvider : attachmentProvider;
    pendingRef.current.forEach((item) => { if (provider.discard) void provider.discard(item); else provider.release(item); });
  }, [useRemoteAttachments]);

  const selectFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setAttachmentError("");
    try {
      const provider = useRemoteAttachments ? supabaseAttachmentProvider : attachmentProvider;
      const prepared = await provider.prepare(file, room?.id);
      const previous = pendingRef.current;
      await Promise.allSettled(previous.map((item) => provider.discard ? provider.discard(item) : Promise.resolve(provider.release(item))));
      pendingRef.current = [prepared];
      setPending([prepared]);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "파일을 업로드하지 못했습니다.");
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
  const hide = () => {
    const warning = transaction.status.stage !== "완료" && role === "shop" ? "진행 중인 거래입니다. 그래도 숨기시겠습니까?\n" : "";
    if (confirm(`${warning}이 거래방은 목록에서 숨겨집니다. 거래 기록은 카마스터에 보관됩니다.`)) onHide(transaction.id, role);
  };
  const savePrice = () => {
    const value = Number(finalPrice.replace(/\D/g, ""));
    if (value <= 0) return;
    onFinalPriceChange(transaction, value);
    setFinalPrice("");
  };

  return <article className="thread" data-testid={`transaction-detail-${transaction.id}`}>
    <section className="thread-main">
      <header className="thread-head">
        <div className="thread-head-id"><span>{transaction.vehicle.maker} {transaction.vehicle.model}</span><em>{transaction.service.product ?? transaction.service.workDescription}</em></div>
        <p>{role === "dealer" ? transaction.installerName : `딜러 ${transaction.dealerId}`}</p>
        <button className="thread-info-toggle" aria-label="거래 정보" onClick={() => setShowDetails((value) => !value)}><Info size={17} /></button>
      </header>

      <ol className="thread-stage-rail">
        {stages.map((stage, index) => <li key={stage} className={index < stageIndex ? "done" : index === stageIndex ? "now" : ""}>
          <i>{index < stageIndex ? "✓" : index + 1}</i><span>{stageLabel[stage]}</span>
        </li>)}
      </ol>
      {role === "shop" && nextStage && canTransitionStage(transaction.status.stage, nextStage, role) && <div className="thread-stage-action">
        <button data-testid={stageActionTestId(nextStage)} className="primary" onClick={() => onStageChange(transaction, nextStage)}>{stageActionLabel(nextStage)}</button>
      </div>}

      <div className="thread-messages">
        <div className="thread-date-divider"><span>거래방 생성 · {new Date(transaction.status.createdAt).toLocaleDateString("ko-KR")}</span></div>
        {room?.messages.map((message, index) => {
          const mine = message.senderId === userId;
          const previousDate = index > 0 ? new Date(room.messages[index - 1].createdAt).toDateString() : "";
          const currentDate = new Date(message.createdAt).toDateString();
          const read = mine && message.readBy.length > 1;
          return <div key={message.id}>
            {index > 0 && previousDate !== currentDate && <div className="thread-date-divider"><span>{new Date(message.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span></div>}
            <div className={`thread-row ${mine ? "mine" : "theirs"}`}>
              {!mine && <span className="thread-avatar">{message.senderRole === "system" ? "CM" : message.senderRole === "shop" ? "시" : "딜"}</span>}
              <div className="thread-bubble-col">
                {!mine && <small className="thread-sender">{message.senderRole === "system" ? "Car-Master" : message.senderRole === "shop" ? "시공점" : "딜러"}</small>}
                {message.text && <p className="thread-bubble">{message.text}</p>}
                {message.attachments?.map((attachment) => attachment.kind === "image" ? <button className="thread-image" key={attachment.id} onClick={() => setPreview(attachment)}><img src={attachment.url} alt={attachment.name} /></button> : <a className="thread-file" key={attachment.id} href={attachment.url} download={attachment.name}><FileText size={20} /><span><b>{attachment.name}</b><small>{fileSize(attachment.size)}</small></span></a>)}
                <div className="thread-meta"><time>{new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</time>{read && <span className="thread-read"><CheckCheck size={12} /> 읽음</span>}</div>
              </div>
            </div>
          </div>;
        })}
        {!room && <div className="thread-empty"><b>거래방을 준비하고 있어요.</b><span>거래방 생성 후 메시지를 보낼 수 있습니다.</span></div>}
        <div ref={messageEnd} />
      </div>

      <footer className="thread-composer">
        {attachmentError && <p className="field-error">{attachmentError}</p>}
        {pending.length > 0 && <div className="attachment-preview-strip">{pending.map((item) => <div key={item.id}>{item.kind === "image" ? <img src={item.url} alt="" /> : <FileText size={20} />}<span><b>{item.name}</b><small>{fileSize(item.size)} · {item.persistence === "remote" ? "거래방에 안전하게 저장" : "이번 세션에서만 표시"}</small></span><button onClick={() => removePending(item.id)} aria-label="첨부 삭제"><X size={14} /></button></div>)}</div>}
        <div className="thread-input-row">
          <div className="thread-tools"><button onClick={() => imageInput.current?.click()} aria-label="사진 첨부" disabled={isSending}><ImagePlus size={18} /></button><button onClick={() => fileInput.current?.click()} aria-label="파일 첨부" disabled={isSending}><Paperclip size={18} /></button></div>
          <textarea data-testid="chat-input" rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="메시지를 입력하세요" disabled={isSending} />
          <button data-testid="chat-send-button" className="thread-send" onClick={() => void send()} disabled={isSending || !room || (!draft.trim() && pending.length === 0)} aria-busy={isSending}><Send size={17} /></button>
        </div>
        <input data-testid="file-upload-input" ref={imageInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void selectFiles(event.target.files); event.target.value = ""; }} />
        <input ref={fileInput} hidden type="file" accept=".pdf,.txt,.doc,.docx,.xls,.xlsx" onChange={(event) => { void selectFiles(event.target.files); event.target.value = ""; }} />
      </footer>
    </section>

    <aside className={`thread-side ${showDetails ? "open" : ""}`}>
      <button className="thread-side-close" onClick={() => setShowDetails(false)} aria-label="닫기"><X size={16} /></button>
      <p className="eyebrow">거래 정보</p>
      <dl className="thread-facts">
        <div><dt>차량</dt><dd>{transaction.vehicle.maker} {transaction.vehicle.model}{transaction.vehicle.class && ` · ${transaction.vehicle.class}`}</dd></div>
        <div><dt>작업</dt><dd>{transaction.service.workDescription}{transaction.service.extraRequest && <small> · {transaction.service.extraRequest}</small>}</dd></div>
        <div><dt>시공점</dt><dd>{transaction.installerName}</dd></div>
        <div><dt>일정</dt><dd>{transaction.schedule.confirmedInboundAt ?? transaction.schedule.requestedInboundAt ?? "미정"}</dd></div>
        <div><dt>가격</dt><dd>{won(transaction.pricing.baseGuidePrice)} <small>(가이드)</small></dd></div>
      </dl>
      <div className="thread-side-payment">
        <p className="eyebrow">결제 · 정산</p>
        <div className="thread-side-payment-row"><span>확정 금액</span><b>{won(transaction.pricing.finalPrice)}</b></div>
        <div className="thread-side-payment-row"><span>결제 상태</span><b>{transaction.pricing.paymentStatus}</b></div>
        {role === "shop" && <div className="thread-side-payment-form"><input value={finalPrice} onChange={(event) => setFinalPrice(event.target.value)} placeholder="최종 시공금액" /><button className="secondary" onClick={savePrice}>저장</button></div>}
        {role === "dealer" && transaction.pricing.finalPrice && transaction.pricing.paymentStatus === "미결제" && <button className="secondary" onClick={() => onPaymentChange(transaction, "결제대기")}>금액 확인</button>}
      </div>
      <button className="thread-hide-button" onClick={hide}>이 거래방 숨기기</button>
    </aside>

    {preview && <div className="attachment-lightbox" role="dialog" aria-modal="true" onClick={() => setPreview(null)}><button aria-label="닫기"><X size={22} /></button><figure onClick={(event) => event.stopPropagation()}><img src={preview.url} alt={preview.name} /><figcaption>{preview.name}</figcaption></figure></div>}
  </article>;
}
