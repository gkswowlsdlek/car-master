"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ChatRoom, PaymentStatus, Transaction, TransactionChatMessage, TransactionStage } from "../../types/transactions";
import { TransactionChatWorkspace } from "../transactions/TransactionChatWorkspace";

function messagePreview(room?: ChatRoom) {
  const last = room?.messages[room.messages.length - 1];
  if (!last) return "아직 대화가 없습니다.";
  if (last.text.trim()) return last.text;
  const attachment = last.attachments?.[0];
  return attachment?.kind === "image" ? "사진을 보냈습니다" : attachment ? "파일을 보냈습니다" : "아직 대화가 없습니다.";
}

function relativeRoomTime(room?: ChatRoom) {
  const last = room?.messages[room.messages.length - 1];
  const at = last?.createdAt ?? room?.updatedAt;
  if (!at) return "";
  const diffMs = Date.now() - new Date(at).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function MessengerScreen({ role, userId, transactions, rooms, selectedId, useRemoteAttachments, isLoading, loadError, onSelect, onSend, onHide, onFinalPriceChange, onStageChange, onPaymentChange, onMarkRead, onLoadContact }: {
  role: "dealer" | "shop"; userId: string; transactions: Transaction[]; rooms: ChatRoom[]; selectedId: string;
  useRemoteAttachments: boolean; isLoading: boolean; loadError: string;
  onSelect: (id: string) => void; onSend: (transaction: Transaction, message: TransactionChatMessage) => Promise<void>;
  onHide: (id: string, role: "dealer" | "shop") => void; onFinalPriceChange: (transaction: Transaction, finalPrice: number) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => Promise<void>; onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
  onMarkRead: (roomId: string) => void; onLoadContact?: (transaction: Transaction) => Promise<{ name: string; phone: string } | null>;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => transactions.filter((item) => !(role === "dealer" ? item.visibility.hiddenByDealer : item.visibility.hiddenByInstaller)), [transactions, role]);
  const rows = useMemo(() => visible
    .map((transaction) => ({ transaction, room: rooms.find((item) => item.transactionId === transaction.id) }))
    .sort((a, b) => {
      const aAt = a.room?.messages[a.room.messages.length - 1]?.createdAt ?? a.transaction.status.updatedAt;
      const bAt = b.room?.messages[b.room.messages.length - 1]?.createdAt ?? b.transaction.status.updatedAt;
      return bAt.localeCompare(aAt);
    }), [visible, rooms]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter(({ transaction, room }) => {
      const haystack = `${transaction.id} ${transaction.vehicle.maker} ${transaction.vehicle.model} ${transaction.installerName} ${transaction.service.workDescription} ${room?.messages.map((message) => message.text).join(" ") ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [rows, query]);
  const selected = filtered.find((item) => item.transaction.id === selectedId) ?? filtered[0];
  const selectedRoom = rooms.find((item) => item.transactionId === selected?.transaction.id);

  return <section className="messenger-screen">
    <div className="page-title"><div><p className="eyebrow">MESSENGER</p><h1>메시지</h1><p className="page-subtitle">모든 거래방의 대화를 한곳에서 확인하세요.</p></div></div>
    <div className="messenger-layout">
      <aside className="inbox-pane">
        <label className="search-field inbox-search"><Search size={17} aria-hidden="true" /><input aria-label="메시지 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업체, 차량, 대화 내용 검색" /></label>
        {isLoading ? <div className="inbox-state" role="status">대화 목록을 불러오는 중입니다…</div>
          : loadError ? <div className="inbox-state inbox-state-error" role="alert">{loadError}</div>
          : filtered.length === 0 ? <div className="inbox-state inbox-empty">{query ? <><b>검색 결과가 없습니다.</b><span>다른 검색어로 다시 시도해 보세요.</span></> : <><b>아직 대화가 없습니다.</b><span>거래가 시작되면 여기에서 대화를 확인할 수 있어요.</span></>}</div>
          : <ul className="inbox-list">
            {filtered.map(({ transaction, room }) => {
              const counterpart = role === "dealer" ? transaction.installerName : `딜러 ${transaction.dealerId}`;
              const unread = room?.unreadCount ?? 0;
              return <li key={transaction.id}>
                <button className={transaction.id === selected?.transaction.id ? "selected" : ""} onClick={() => onSelect(transaction.id)} data-testid={`inbox-row-${transaction.id}`}>
                  <span className="inbox-row-avatar">{transaction.vehicle.maker.slice(0, 1)}</span>
                  <span className="inbox-row-body">
                    <span className="inbox-row-top"><b>{counterpart}</b><time>{relativeRoomTime(room)}</time></span>
                    <span className="inbox-row-meta">{transaction.vehicle.maker} {transaction.vehicle.model} · {transaction.service.workDescription}</span>
                    <span className="inbox-row-bottom"><em className="inbox-row-preview">{messagePreview(room)}</em>{unread > 0 && <span className="inbox-unread-badge">{unread > 99 ? "99+" : unread}</span>}</span>
                  </span>
                </button>
              </li>;
            })}
          </ul>}
      </aside>
      {selected ? <TransactionChatWorkspace role={role} userId={userId} transaction={selected.transaction} room={selectedRoom} useRemoteAttachments={useRemoteAttachments} onSend={onSend} onHide={onHide} onFinalPriceChange={onFinalPriceChange} onStageChange={onStageChange} onPaymentChange={onPaymentChange} onMarkRead={onMarkRead} onLoadContact={onLoadContact} />
        : <div className="messenger-no-selection"><b>대화를 선택하세요.</b><span>왼쪽 목록에서 거래방을 선택하면 대화가 여기에 표시됩니다.</span></div>}
    </div>
  </section>;
}
