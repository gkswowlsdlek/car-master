"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { Bell, FileText, ImagePlus, Info, MoreHorizontal, Paperclip, Send, X } from "lucide-react";
import { attachmentProvider } from "../../services/attachments";
import { canTransitionStage } from "../../services/transaction-state-service";
import type { ChatAttachment, ChatRoom, PaymentStatus, Transaction, TransactionChatMessage, TransactionStage } from "../../types/transactions";

const stages: TransactionStage[] = ["접수", "입고예정", "입고", "시공중", "완료"];
const won = (value?: number) => value == null ? "미확정" : `${value.toLocaleString("ko-KR")}원`;
const fileSize = (value: number) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))}KB` : `${(value / 1024 / 1024).toFixed(1)}MB`;

export function TransactionChatWorkspace({ role, userId, transaction, room, onSend, onHide, onUpdate, onStageChange, onPaymentChange }: {
  role: "dealer" | "shop";
  userId: string;
  transaction: Transaction;
  room?: ChatRoom;
  onSend: (transaction: Transaction, message: TransactionChatMessage) => void;
  onHide: (id: string, role: "dealer" | "shop") => void;
  onUpdate: (transaction: Transaction) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => void;
  onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [preview, setPreview] = useState<ChatAttachment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [finalPrice, setFinalPrice] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<ChatAttachment[]>([]);
  const stageIndex = stages.indexOf(transaction.status.stage);
  const nextStage = stageIndex >= 0 ? stages[stageIndex + 1] : undefined;

  useEffect(() => { messageEnd.current?.scrollIntoView({ block: "end" }); }, [room?.messages.length]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => () => pendingRef.current.forEach((item) => attachmentProvider.release(item)), []);

  const selectFiles = async (files: FileList | null) => {
    if (!files) return;
    const valid = [...files].filter((file) => file.size <= 10 * 1024 * 1024);
    const prepared = await Promise.all(valid.map((file) => attachmentProvider.prepare(file)));
    setPending((current) => [...current, ...prepared]);
  };
  const removePending = (id: string) => setPending((current) => current.filter((item) => { if (item.id === id) attachmentProvider.release(item); return item.id !== id; }));
  const send = () => {
    const text = draft.trim();
    if ((!text && pending.length === 0) || !room) return;
    const now = new Date().toISOString();
    onSend(transaction, { id: `${room.id}-M-${now}`, roomId: room.id, senderId: userId, senderRole: role, text, attachments: pending, createdAt: now, readBy: [userId] });
    setDraft(""); setPending([]);
  };
  const hide = () => {
    const warning = transaction.status.stage !== "완료" && role === "shop" ? "진행 중인 거래입니다. 그래도 숨기시겠습니까?\n" : "";
    if (confirm(`${warning}이 거래방은 목록에서 숨겨집니다. 거래 기록은 카마스터에 보관됩니다.`)) onHide(transaction.id, role);
  };
  const savePrice = () => {
    const value = Number(finalPrice.replace(/\D/g, ""));
    if (value <= 0) return;
    onUpdate({ ...transaction, pricing: { ...transaction.pricing, finalPrice: value }, status: { ...transaction.status, updatedAt: new Date().toISOString() } });
    setFinalPrice("");
  };

  return <article className="messenger-workspace">
    <section className="messenger-center">
      <header className="messenger-header"><div><span className="messenger-avatar">{transaction.vehicle.maker.slice(0, 1)}</span><div><h2>{transaction.vehicle.maker} {transaction.vehicle.model} · {transaction.service.product ?? transaction.service.workDescription}</h2><p>{role === "dealer" ? transaction.installerName : `딜러 ${transaction.dealerId}`} <i /> <b>{transaction.status.stage}</b></p></div></div><nav><button aria-label="알림 설정"><Bell size={18} /></button><button aria-label="거래 정보" onClick={() => setShowDetails((value) => !value)}><Info size={18} /></button><button aria-label="더보기"><MoreHorizontal size={19} /></button></nav></header>
      <div className="messenger-messages">
        <div className="message-date-divider"><span>거래방 생성 · {new Date(transaction.status.createdAt).toLocaleDateString("ko-KR")}</span></div>
        {room?.messages.map((message, index) => {
          const mine = message.senderId === userId;
          const previousDate = index > 0 ? new Date(room.messages[index - 1].createdAt).toDateString() : "";
          const currentDate = new Date(message.createdAt).toDateString();
          return <div key={message.id}>{index > 0 && previousDate !== currentDate && <div className="message-date-divider"><span>{new Date(message.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span></div>}<div className={`message-row ${mine ? "mine" : "theirs"}`}>
            {!mine && <span className="message-avatar">{message.senderRole === "system" ? "CM" : message.senderRole === "shop" ? "시" : "딜"}</span>}
            <div className="message-content"><small>{message.senderRole === "system" ? "Car-Master" : mine ? "나" : message.senderRole === "shop" ? "시공점" : "딜러"}</small>{message.text && <p>{message.text}</p>}{message.attachments?.map((attachment) => attachment.kind === "image" ? <button className="image-message" key={attachment.id} onClick={() => setPreview(attachment)}><img src={attachment.url} alt={attachment.name} /><span>{attachment.name}</span></button> : <a className="file-message" key={attachment.id} href={attachment.url} download={attachment.name}><FileText size={22} /><span><b>{attachment.name}</b><small>{fileSize(attachment.size)}</small></span></a>)}<time>{new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</time></div>
          </div></div>;
        })}
        {!room && <div className="messenger-empty"><b>거래방을 준비하고 있습니다.</b><span>거래방 생성 후 메시지를 보낼 수 있습니다.</span></div>}
        <div ref={messageEnd} />
      </div>
      <footer className="messenger-composer">
        {pending.length > 0 && <div className="attachment-preview-strip">{pending.map((item) => <div key={item.id}>{item.kind === "image" ? <img src={item.url} alt="" /> : <FileText size={22} />}<span><b>{item.name}</b><small>{fileSize(item.size)} · 이번 세션에서만 표시</small></span><button onClick={() => removePending(item.id)} aria-label="첨부 삭제"><X size={15} /></button></div>)}</div>}
        <div className="composer-row"><div className="composer-tools"><button onClick={() => imageInput.current?.click()} aria-label="사진 첨부"><ImagePlus size={19} /></button><button onClick={() => fileInput.current?.click()} aria-label="파일 첨부"><Paperclip size={19} /></button></div><textarea rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="메시지를 입력하세요. Shift + Enter로 줄바꿈" /><button className="composer-send" onClick={send} disabled={!room || (!draft.trim() && pending.length === 0)}><Send size={18} /><span>보내기</span></button></div>
        <input ref={imageInput} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void selectFiles(event.target.files); event.target.value = ""; }} /><input ref={fileInput} hidden type="file" multiple onChange={(event) => { void selectFiles(event.target.files); event.target.value = ""; }} />
      </footer>
    </section>
    <aside className={`messenger-sidebar ${showDetails ? "mobile-open" : ""}`}><button className="sidebar-close" onClick={() => setShowDetails(false)}><X size={18} /></button><div className="briefing-title"><span>AI WORK BRIEFING</span><h3>자동 작업 브리핑</h3><p>대화 중에도 핵심 작업 정보를 바로 확인하세요.</p></div><dl className="briefing-data"><div><dt>차량</dt><dd>{transaction.vehicle.maker} {transaction.vehicle.model}</dd></div><div><dt>차량 등급</dt><dd>{transaction.vehicle.class || "미분류"}</dd></div><div><dt>시공 품목</dt><dd>{transaction.service.workDescription}</dd></div><div><dt>추가 요청</dt><dd>{transaction.service.extraRequest || "없음"}</dd></div><div><dt>입고 예정</dt><dd>{transaction.schedule.confirmedInboundAt ?? transaction.schedule.requestedInboundAt ?? "미정"}</dd></div><div><dt>시공점</dt><dd>{transaction.installerName}</dd></div><div><dt>가이드 가격</dt><dd>{won(transaction.pricing.baseGuidePrice)}</dd></div></dl>
      <div className="sidebar-stage"><span>현재 상태</span><b>{transaction.status.stage}</b><div>{stages.map((stage, index) => <i key={stage} className={index <= stageIndex ? "done" : ""} title={stage} />)}</div>{role === "shop" && nextStage && canTransitionStage(transaction.status.stage, nextStage, role) && <button className="primary" onClick={() => onStageChange(transaction, nextStage)}>{nextStage} 단계로 진행</button>}</div>
      <div className="sidebar-settlement"><h4>결제 및 정산</h4><p>확정 금액 <b>{won(transaction.pricing.finalPrice)}</b></p><p>결제 상태 <b>{transaction.pricing.paymentStatus}</b></p>{role === "shop" && <div><input value={finalPrice} onChange={(event) => setFinalPrice(event.target.value)} placeholder="최종 시공금액" /><button onClick={savePrice}>저장</button></div>}{role === "dealer" && transaction.pricing.finalPrice && transaction.pricing.paymentStatus === "미결제" && <button onClick={() => onPaymentChange(transaction, "결제대기")}>금액 확인</button>}</div><button className="transaction-hide-button" onClick={hide}>이 거래방 숨기기</button>
    </aside>
    {preview && <div className="attachment-lightbox" role="dialog" aria-modal="true" onClick={() => setPreview(null)}><button aria-label="닫기"><X size={22} /></button><figure onClick={(event) => event.stopPropagation()}><img src={preview.url} alt={preview.name} /><figcaption>{preview.name}</figcaption></figure></div>}
  </article>;
}
