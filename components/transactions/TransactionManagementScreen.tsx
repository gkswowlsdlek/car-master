"use client";
import { useMemo, useState } from "react";
import type { ChatRoom, PaymentStatus, Transaction, TransactionChatMessage, TransactionStage } from "../../types/transactions";

const stages: TransactionStage[] = ["접수", "입고예정", "입고", "시공중", "완료"];
const won = (value?: number) => value == null ? "미확정" : `${value.toLocaleString("ko-KR")}원`;

export function TransactionManagementScreen({ role, userId, transactions, rooms, selectedId, onSelect, onSend, onHide, onUpdate }: {
  role: "dealer" | "shop"; userId: string; transactions: Transaction[]; rooms: ChatRoom[]; selectedId: string;
  onSelect: (id: string) => void; onSend: (transaction: Transaction, message: TransactionChatMessage) => void;
  onHide: (id: string, role: "dealer" | "shop") => void; onUpdate: (transaction: Transaction) => void;
}) {
  const [tab, setTab] = useState<"거래내역" | "결제 및 정산">("거래내역");
  const [query, setQuery] = useState(""); const [showHidden, setShowHidden] = useState(false); const [draft, setDraft] = useState(""); const [finalPrice, setFinalPrice] = useState("");
  const visible = useMemo(() => transactions.filter((item) => showHidden || !(role === "dealer" ? item.visibility.hiddenByDealer : item.visibility.hiddenByInstaller)).filter((item) => `${item.id} ${item.vehicle.maker} ${item.vehicle.model} ${item.installerName} ${item.status.stage}`.toLowerCase().includes(query.toLowerCase())), [transactions, showHidden, role, query]);
  const selected = transactions.find((item) => item.id === selectedId) ?? visible[0]; const room = rooms.find((item) => item.transactionId === selected?.id);
  const send = () => { const text = draft.trim(); if (!text || !selected || !room) return; const now = new Date().toISOString(); onSend(selected, { id: `${room.id}-M-${now}`, roomId: room.id, senderId: userId, senderRole: role, text, createdAt: now, readBy: [userId] }); setDraft(""); };
  const hide = () => { if (!selected) return; const warning = selected.status.stage !== "완료" && role === "shop" ? "진행 중인 거래입니다. 그래도 숨기시겠습니까?\n" : ""; if (confirm(`${warning}이 거래방은 목록에서 숨겨집니다. 거래 기록은 카마스터에 보관됩니다.`)) onHide(selected.id, role); };
  const savePrice = () => { if (!selected) return; const value = Number(finalPrice.replace(/\D/g, "")); if (value <= 0) return; onUpdate({ ...selected, pricing: { ...selected.pricing, finalPrice: value, paymentStatus: "결제대기" }, status: { ...selected.status, updatedAt: new Date().toISOString() } }); };
  const setPayment = (paymentStatus: PaymentStatus) => selected && onUpdate({ ...selected, pricing: { ...selected.pricing, paymentStatus }, status: { ...selected.status, updatedAt: new Date().toISOString() } });
  return <section className="transaction-management-screen"><div className="page-title"><div><p className="eyebrow">TRANSACTION ROOM ARCHITECTURE</p><h1>거래관리</h1><p>거래 1건마다 독립된 작업 정보, 채팅방, 결제 기록을 관리합니다.</p></div></div>
    <div className="transaction-tabs"><button className={tab === "거래내역" ? "active" : ""} onClick={() => setTab("거래내역")}>거래내역</button><button className={tab === "결제 및 정산" ? "active" : ""} onClick={() => setTab("결제 및 정산")}>결제 및 정산</button></div>
    <div className="transaction-filters"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="거래번호, 차량, 시공점, 상태 검색" /><label><input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} /> 숨긴 거래 보기</label></div>
    {tab === "결제 및 정산" ? <div className="transaction-payment-table">{visible.map((item) => <button key={item.id} onClick={() => onSelect(item.id)}><b>{item.id}</b><span>{won(item.pricing.finalPrice)}</span><span>{item.pricing.paymentStatus}</span><span>{item.schedule.completedAt ?? "시공일 미정"}</span></button>)}</div> : <div className="transaction-room-layout"><aside className="transaction-list">{visible.map((item) => <button className={item.id === selected?.id ? "selected" : ""} key={item.id} onClick={() => onSelect(item.id)}><b>{item.id}</b><span>{item.vehicle.maker} {item.vehicle.model}</span><small>{item.installerName} · {item.status.stage}</small><em>{item.lastMessage}</em></button>)}</aside>
      {selected && <article className="transaction-detail"><div className="transaction-detail-head"><div><span>{selected.id}</span><h2>{selected.vehicle.maker} {selected.vehicle.model}</h2><p>딜러 {selected.dealerId} · {selected.installerName}</p></div><b>{selected.status.stage}</b></div>
        <section className="transaction-briefing"><h3>자동 작업 브리핑</h3><dl><div><dt>차량 등급</dt><dd>{selected.vehicle.class}</dd></div><div><dt>작업내용</dt><dd>{selected.service.workDescription}</dd></div><div><dt>추가 요청</dt><dd>{selected.service.extraRequest || "없음"}</dd></div><div><dt>입고예정일</dt><dd>{selected.schedule.requestedInboundAt || "미정"}</dd></div><div><dt>가이드 가격</dt><dd>{won(selected.pricing.baseGuidePrice)}</dd></div><div><dt>확정 시공가격</dt><dd>{won(selected.pricing.finalPrice)}</dd></div></dl></section>
        <div className="transaction-stage-flow">{stages.map((stage) => <button className={stage === selected.status.stage ? "active" : ""} onClick={() => onUpdate({ ...selected, status: { stage, createdAt: selected.status.createdAt, updatedAt: new Date().toISOString() }, schedule: { ...selected.schedule, completedAt: stage === "완료" ? new Date().toISOString() : selected.schedule.completedAt } })} key={stage}>{stage}</button>)}</div>
        <section className="transaction-chat"><h3>거래 채팅</h3><div>{room?.messages.map((message) => <p className={message.senderId === userId ? "mine" : ""} key={message.id}><small>{message.senderRole} · {new Date(message.createdAt).toLocaleString("ko-KR")}</small>{message.text}</p>)}</div><div><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && send()} placeholder="메시지 입력" /><button onClick={send}>전송</button></div></section>
        <section className="transaction-settlement-summary"><h3>결제 및 정산</h3>{role === "shop" && <div><input value={finalPrice} onChange={(event) => setFinalPrice(event.target.value)} placeholder="최종 시공금액" /><button onClick={savePrice}>금액 저장</button></div>}<p>확정 금액 {won(selected.pricing.finalPrice)} · {selected.pricing.paymentStatus}</p>{role === "dealer" && selected.pricing.finalPrice && <button onClick={() => setPayment("결제대기")}>금액 확인</button>}</section>
        <button className="transaction-hide-button" onClick={hide}>이 거래방 숨기기</button>
      </article>}
    </div>}</section>;
}
