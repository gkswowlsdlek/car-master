"use client";
import { useMemo, useState } from "react";
import type { ChatRoom, Transaction, TransactionStage } from "../../types/transactions";

export function AdminTransactionPanel({ transactions, rooms }: { transactions: Transaction[]; rooms: ChatRoom[] }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<TransactionStage | "전체">("전체");
  const [selectedId, setSelectedId] = useState("");
  const visible = useMemo(() => transactions.filter((item) => stage === "전체" || item.status.stage === stage).filter((item) => `${item.id} ${item.vehicle.model} ${item.dealerId} ${item.installerName} ${item.status.stage}`.toLowerCase().includes(query.toLowerCase())), [transactions, query, stage]);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const room = rooms.find((item) => item.transactionId === selected?.id);
  return <section className="admin-transaction-panel">
    <div className="section-head"><div><p className="eyebrow">TRANSACTION CONTROL</p><h2>전체 거래 모니터링</h2><p>사용자 숨김 여부와 관계없이 모든 거래 기록을 확인합니다.</p></div><div className="admin-search-tools"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="거래번호, 차량, 사용자 검색" /><select value={stage} onChange={(event) => setStage(event.target.value as TransactionStage | "전체")}><option value="전체">전체 상태</option>{["접수", "입고예정", "입고", "시공중", "완료", "취소"].map((item) => <option key={item}>{item}</option>)}</select></div></div>
    {visible.length === 0 ? <div className="compact-empty"><b>조건에 맞는 거래가 없습니다.</b><span>검색어 또는 상태 필터를 변경해 주세요.</span></div> : <div className="admin-transaction-layout"><div className="admin-transaction-list">{visible.map((item) => <button className={item.id === selected?.id ? "selected" : ""} key={item.id} onClick={() => setSelectedId(item.id)}><span><b>{item.vehicle.maker} {item.vehicle.model}</b><small>{item.id}</small></span><span>{item.dealerId}<small>{item.installerName}</small></span><em className={`status-chip status-${item.status.stage}`}>{item.status.stage}</em></button>)}</div>{selected && <aside className="admin-transaction-detail"><div><span>{selected.id}</span><em className={`status-chip status-${selected.status.stage}`}>{selected.status.stage}</em></div><h3>{selected.vehicle.maker} {selected.vehicle.model}</h3><dl><div><dt>작업</dt><dd>{selected.service.workDescription}</dd></div><div><dt>결제</dt><dd>{selected.pricing.paymentStatus}</dd></div><div><dt>최근 업데이트</dt><dd>{new Date(selected.status.updatedAt).toLocaleString("ko-KR")}</dd></div><div><dt>사용자 숨김</dt><dd>딜러 {selected.visibility.hiddenByDealer ? "예" : "아니오"} · 시공점 {selected.visibility.hiddenByInstaller ? "예" : "아니오"}</dd></div></dl><h4>최근 채팅</h4><div className="admin-chat-preview">{room?.messages.slice(-4).map((message) => <p key={message.id}><b>{message.senderRole}</b><span>{message.text}</span></p>) ?? <small>채팅 기록이 없습니다.</small>}</div></aside>}</div>}
  </section>;
}
