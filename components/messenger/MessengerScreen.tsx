"use client";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Search, X } from "lucide-react";
import type { ChatRoom, PaymentStatus, Transaction, TransactionChatMessage, TransactionStage } from "../../types/transactions";
import type { InstallerListing } from "../../types/installer";
import { TransactionChatWorkspace } from "../transactions/TransactionChatWorkspace";
import type { AttachmentProvider } from "../../services/attachments";

const INBOX_OPEN_STORAGE_KEY = "car-master-messenger-inbox-open";

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

export function MessengerScreen({ role, userId, transactions, rooms, installers, selectedId, useRemoteAttachments, demoAttachmentProvider, isLoading, loadError, onSelect, onSend, onHide, onFinalPriceChange, onStageChange, onPaymentChange, onMarkRead, onLoadContact, onMobileChatOpenChange }: {
  role: "dealer" | "shop"; userId: string; transactions: Transaction[]; rooms: ChatRoom[]; installers?: InstallerListing[]; selectedId: string;
  useRemoteAttachments: boolean; demoAttachmentProvider?: AttachmentProvider; isLoading: boolean; loadError: string;
  onSelect: (id: string) => void; onSend: (transaction: Transaction, message: TransactionChatMessage) => Promise<void>;
  onHide: (id: string, role: "dealer" | "shop") => void; onFinalPriceChange: (transaction: Transaction, finalPrice: number) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => Promise<void>; onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
  onMarkRead: (roomId: string) => void; onLoadContact?: (transaction: Transaction) => Promise<{ name: string; phone: string } | null>;
  onMobileChatOpenChange?: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  // Desktop-only: conversation list starts collapsed behind a slim icon rail
  // so a first-time dealer with one active deal sees a clean, chat-first
  // screen. Remembered per browser so a dealer juggling several deals only
  // has to open it once, not every visit.
  const [listOpen, setListOpen] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(INBOX_OPEN_STORAGE_KEY) === "1");
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem(INBOX_OPEN_STORAGE_KEY, listOpen ? "1" : "0"); }, [listOpen]);
  // Mobile-only drill-down: Inbox and chat never share the screen on a phone
  // width — entering a room switches to a dedicated full-height chat view
  // (nav/topbar hidden by the parent via onMobileChatOpenChange) with its own
  // back action, instead of trying to fit both panes in a shrunk viewport.
  // Irrelevant on desktop, where CSS shows both panes regardless of this.
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  useEffect(() => () => onMobileChatOpenChange?.(false), [onMobileChatOpenChange]);

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
  const totalUnread = useMemo(() => rows.reduce((sum, { room }) => sum + (room?.unreadCount ?? 0), 0), [rows]);
  const selected = filtered.find((item) => item.transaction.id === selectedId) ?? filtered[0];
  const selectedRoom = rooms.find((item) => item.transactionId === selected?.transaction.id);
  // installers[].id is installer_shops.id (Shop-model identity) — matched
  // against transaction.shopId, not the legacy installerId, so this keeps
  // resolving correctly for Shops with no linked Installer Account too.
  // Account Foundation B1 already backfilled shopId onto every legacy
  // transaction, so this also still matches old transactions unchanged.
  const selectedInstaller = installers?.find((item) => item.id === selected?.transaction.shopId);

  const openRoom = (id: string) => {
    onSelect(id);
    setMobileView("chat");
    onMobileChatOpenChange?.(true);
  };
  const backToList = () => {
    setMobileView("list");
    onMobileChatOpenChange?.(false);
  };

  return <section className="messenger-screen">
    <div className={`messenger-layout${listOpen ? " list-open" : ""}`}>
      <aside className="messenger-rail">
        <button type="button" className="messenger-rail-toggle" aria-label={listOpen ? "대화 목록 접기" : "대화 목록 펼치기"} aria-expanded={listOpen} onClick={() => setListOpen((value) => !value)}>
          <MessageCircle size={20} aria-hidden="true" />
          {totalUnread > 0 && <span className="nav-unread-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>}
        </button>
      </aside>
      <aside className={`inbox-pane${mobileView === "chat" ? " mobile-hidden" : ""}${listOpen ? "" : " desktop-collapsed"}`}>
        <div className="inbox-pane-head">
          <label className="search-field inbox-search"><Search size={17} aria-hidden="true" /><input aria-label="메시지 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업체, 차량, 대화 내용 검색" /></label>
          <button type="button" className="inbox-collapse-button" aria-label="대화 목록 접기" onClick={() => setListOpen(false)}><X size={16} aria-hidden="true" /></button>
        </div>
        {isLoading ? <div className="inbox-state" role="status">대화 목록을 불러오는 중입니다…</div>
          : loadError ? <div className="inbox-state inbox-state-error" role="alert">{loadError}</div>
          : filtered.length === 0 ? <div className="inbox-state inbox-empty">{query ? <><b>검색 결과가 없습니다.</b><span>다른 검색어로 다시 시도해 보세요.</span></> : <><b>아직 대화가 없습니다.</b><span>거래가 시작되면 여기에서 대화를 확인할 수 있어요.</span></>}</div>
          : <ul className="inbox-list">
            {filtered.map(({ transaction, room }) => {
              const counterpart = role === "dealer" ? transaction.installerName : "담당 딜러";
              const unread = room?.unreadCount ?? 0;
              return <li key={transaction.id}>
                <button className={transaction.id === selected?.transaction.id ? "selected" : ""} onClick={() => openRoom(transaction.id)} data-testid={`inbox-row-${transaction.id}`}>
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
      <div className={`messenger-chat-pane${mobileView === "list" ? " mobile-hidden" : ""}`}>
        {selected ? <TransactionChatWorkspace role={role} userId={userId} transaction={selected.transaction} room={selectedRoom} installer={selectedInstaller} useRemoteAttachments={useRemoteAttachments} demoAttachmentProvider={demoAttachmentProvider} onSend={onSend} onHide={onHide} onFinalPriceChange={onFinalPriceChange} onStageChange={onStageChange} onPaymentChange={onPaymentChange} onMarkRead={onMarkRead} onLoadContact={onLoadContact} onBack={backToList} />
          : <div className="messenger-no-selection"><b>대화를 선택하세요.</b><span>왼쪽 목록에서 거래방을 선택하면 대화가 여기에 표시됩니다.</span></div>}
      </div>
    </div>
  </section>;
}
