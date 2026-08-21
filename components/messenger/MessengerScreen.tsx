"use client";
import { useEffect, useMemo, useState } from "react";
import { MapPin, MessageCircle, MessagesSquare, Search, SearchX, X } from "lucide-react";
import { EmptyState, ErrorState, SkeletonList } from "../common/ScreenState";
import type {
  ChatRoom,
  ContactStatus,
  PaymentStatus,
  Transaction,
  TransactionChatMessage,
  TransactionStage,
} from "../../types/transactions";
import type { InstallerListing } from "../../types/installer";
import { TransactionChatWorkspace } from "../transactions/TransactionChatWorkspace";
import type { AttachmentProvider } from "../../services/attachments";

const INBOX_OPEN_STORAGE_KEY = "car-master-messenger-inbox-open";

function messagePreview(room?: ChatRoom) {
  const last = room?.messages[room.messages.length - 1];
  if (!last) return "아직 대화가 없습니다.";
  if (last.text.trim()) return last.text;
  const attachment = last.attachments?.[0];
  return attachment?.kind === "image"
    ? "사진을 보냈습니다"
    : attachment
      ? "파일을 보냈습니다"
      : "아직 대화가 없습니다.";
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

export function MessengerScreen({
  role,
  userId,
  transactions,
  rooms,
  installers,
  selectedId,
  useRemoteAttachments,
  demoAttachmentProvider,
  isLoading,
  loadError,
  onSelect,
  onSend,
  onHide,
  onFinalPriceChange,
  onStageChange,
  onPaymentChange,
  onEndOutcome,
  onSetContactStatus,
  onSetWarrantyInfo,
  onIssueWarranty,
  onFindAnotherShop,
  onMarkRead,
  onLoadOlder,
  onLoadContact,
  onMobileChatOpenChange,
  onRetry,
  onFindShop,
}: {
  role: "dealer" | "shop";
  userId: string;
  transactions: Transaction[];
  rooms: ChatRoom[];
  installers?: InstallerListing[];
  selectedId: string;
  useRemoteAttachments: boolean;
  demoAttachmentProvider?: AttachmentProvider;
  isLoading: boolean;
  loadError: string;
  onSelect: (id: string) => void;
  onSend: (transaction: Transaction, message: TransactionChatMessage) => Promise<void>;
  onHide: (id: string, role: "dealer" | "shop") => void;
  onFinalPriceChange: (transaction: Transaction, finalPrice: number) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => Promise<void>;
  onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
  onEndOutcome: (transaction: Transaction, outcome: "취소" | "시공불가", note?: string) => Promise<void>;
  onSetContactStatus?: (transaction: Transaction, status: ContactStatus) => Promise<void>;
  /** Dealer-only — saves whatever warranty-issuance fields are filled in. */
  onSetWarrantyInfo?: (
    transaction: Transaction,
    info: { customerName?: string; customerPhone?: string; vehicleNumber?: string; vin?: string },
  ) => Promise<void>;
  /** Shop-only — marks the warranty as issued once info is READY. */
  onIssueWarranty?: (transaction: Transaction) => Promise<void>;
  /** Only meaningful for role === "dealer" on a terminated transaction. */
  onFindAnotherShop?: () => void;
  onMarkRead: (roomId: string) => void;
  /** Prepends the previous page of chat history for one room. */
  onLoadOlder?: (roomId: string) => Promise<boolean>;
  onLoadContact?: (transaction: Transaction) => Promise<{ name: string; phone: string } | null>;
  onMobileChatOpenChange?: (open: boolean) => void;
  /** 불러오기 실패 시 다시 시도. 없으면 오류 상태에 재시도 버튼을 그리지 않는다. */
  onRetry?: () => void;
  /** Dealer 전용 — 거래가 한 건도 없을 때 빈 화면에서 곧장 시공점 찾기로 보낸다. */
  onFindShop?: () => void;
}) {
  const [query, setQuery] = useState("");
  // Desktop-only: conversation list starts collapsed behind a slim icon rail
  // so a first-time dealer with one active deal sees a clean, chat-first
  // screen. Remembered per browser so a dealer juggling several deals only
  // has to open it once, not every visit.
  const [listOpen, setListOpen] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(INBOX_OPEN_STORAGE_KEY) === "1",
  );
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(INBOX_OPEN_STORAGE_KEY, listOpen ? "1" : "0");
  }, [listOpen]);
  // Mobile-only drill-down: Inbox and chat never share the screen on a phone
  // width — entering a room switches to a dedicated full-height chat view
  // (nav/topbar hidden by the parent via onMobileChatOpenChange) with its own
  // back action, instead of trying to fit both panes in a shrunk viewport.
  // Irrelevant on desktop, where CSS shows both panes regardless of this.
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  useEffect(() => () => onMobileChatOpenChange?.(false), [onMobileChatOpenChange]);

  const visible = useMemo(
    () =>
      transactions.filter(
        (item) => !(role === "dealer" ? item.visibility.hiddenByDealer : item.visibility.hiddenByInstaller),
      ),
    [transactions, role],
  );
  const rows = useMemo(
    () =>
      visible
        .map((transaction) => ({ transaction, room: rooms.find((item) => item.transactionId === transaction.id) }))
        .sort((a, b) => {
          const aAt = a.room?.messages[a.room.messages.length - 1]?.createdAt ?? a.transaction.status.updatedAt;
          const bAt = b.room?.messages[b.room.messages.length - 1]?.createdAt ?? b.transaction.status.updatedAt;
          return bAt.localeCompare(aAt);
        }),
    [visible, rooms],
  );
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter(({ transaction, room }) => {
      const haystack =
        `${transaction.id} ${transaction.vehicle.maker} ${transaction.vehicle.model} ${transaction.installerName} ${transaction.service.workDescription} ${room?.messages.map((message) => message.text).join(" ") ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [rows, query]);
  // Search runs over what is loaded. Five of its six fields (거래번호, 차량,
  // 시공점, 작업내용) come from the transaction and are always complete; only
  // message bodies are windowed. Rather than let older conversations quietly
  // fall out of results, say so — but only while searching, and only when some
  // room genuinely has unloaded history.
  const searchScopeLimited = useMemo(
    () => query.trim().length > 0 && rows.some(({ room }) => room?.hasMoreMessages),
    [query, rows],
  );
  const totalUnread = useMemo(() => rows.reduce((sum, { room }) => sum + (room?.unreadCount ?? 0), 0), [rows]);
  const selected = filtered.find((item) => item.transaction.id === selectedId) ?? filtered[0];
  const selectedRoom = rooms.find((item) => item.transactionId === selected?.transaction.id);
  // installers[].id is installer_shops.id (Shop-model identity) — matched
  // against transaction.shopId, not the legacy installerId, so this keeps
  // resolving correctly for Shops with no linked Installer Account too.
  // Account Foundation B1 already backfilled shopId onto every legacy
  // transaction, so this also still matches old transactions unchanged.
  const selectedInstaller = installers?.find((item) => item.id === selected?.transaction.shopId);

  /* 인박스도 비고 채팅도 비었을 때 두 칸에 같은 문구와 같은 버튼을 나란히
     그리면, 화면이 두 번 사과하는 것처럼 읽힌다. 목록 자체가 없으면 레이아웃을
     펼치지 않고 한 장으로 답한다. */
  const nothingToShow = !isLoading && !loadError && rows.length === 0;
  const allHidden = nothingToShow && transactions.length > 0;

  const openRoom = (id: string) => {
    onSelect(id);
    setMobileView("chat");
    onMobileChatOpenChange?.(true);
  };
  const backToList = () => {
    setMobileView("list");
    onMobileChatOpenChange?.(false);
  };

  if (nothingToShow)
    return (
      <section className="messenger-screen messenger-screen-blank">
        {allHidden ? (
          <EmptyState
            icon={MessagesSquare}
            title="표시할 거래방이 없습니다."
            description="숨긴 거래방만 남아 있습니다. 거래 관리 화면에서 다시 보이게 할 수 있어요."
          />
        ) : (
          <EmptyState
            icon={role === "dealer" ? MapPin : MessagesSquare}
            title={role === "dealer" ? "첫 거래방을 열어보세요." : "아직 들어온 요청이 없습니다."}
            description={
              role === "dealer"
                ? "고객 차량이 있는 지역의 시공점에 시공 요청을 보내면 거래방이 즉시 만들어지고, 이후 모든 연락과 진행 상황이 이 화면에 모입니다."
                : "딜러가 시공 요청을 보내면 이 화면에 거래방이 나타납니다. 요청이 오면 알림으로 알려드립니다."
            }
            action={role === "dealer" && onFindShop ? { label: "시공점 찾기", onClick: onFindShop } : undefined}
          />
        )}
      </section>
    );

  return (
    <section className="messenger-screen">
      <div className={`messenger-layout${listOpen ? " list-open" : ""}`}>
        <aside className="messenger-rail">
          <button
            type="button"
            className="messenger-rail-toggle"
            aria-label={listOpen ? "대화 목록 접기" : "대화 목록 펼치기"}
            aria-expanded={listOpen}
            onClick={() => setListOpen((value) => !value)}
          >
            <MessageCircle size={20} aria-hidden="true" />
            {totalUnread > 0 && <span className="nav-unread-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>}
          </button>
        </aside>
        <aside
          className={`inbox-pane${mobileView === "chat" ? " mobile-hidden" : ""}${listOpen ? "" : " desktop-collapsed"}`}
        >
          <div className="inbox-pane-head">
            <label className="search-field inbox-search">
              <Search size={17} aria-hidden="true" />
              <input
                aria-label="메시지 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="업체, 차량, 대화 내용 검색"
              />
            </label>
            <button
              type="button"
              className="inbox-collapse-button"
              aria-label="대화 목록 접기"
              onClick={() => setListOpen(false)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {searchScopeLimited && (
            <p className="inbox-search-scope" role="status">
              거래 정보는 전체에서, 대화 내용은 최근 메시지에서 찾습니다. 예전 대화까지 찾으려면 거래방에서 “이전 메시지
              보기”로 불러온 뒤 검색해 주세요.
            </p>
          )}
          {isLoading ? (
            <SkeletonList rows={5} label="대화 목록을 불러오는 중입니다." />
          ) : loadError ? (
            <ErrorState compact title="대화 목록을 불러오지 못했습니다." description={loadError} onRetry={onRetry} />
          ) : filtered.length === 0 ? (
            query ? (
              <EmptyState
                compact
                icon={SearchX}
                title="검색 결과가 없습니다."
                description="업체명, 차량, 대화 내용 중 하나로 다시 찾아보세요."
                action={{ label: "검색어 지우기", onClick: () => setQuery("") }}
              />
            ) : (
              <EmptyState
                compact
                icon={MessagesSquare}
                title="표시할 거래방이 없습니다."
                description="숨긴 거래방은 거래 관리 화면에서 다시 보이게 할 수 있어요."
              />
            )
          ) : (
            <ul className="inbox-list">
              {filtered.map(({ transaction, room }) => {
                const counterpart = role === "dealer" ? transaction.installerName : "담당 딜러";
                const unread = room?.unreadCount ?? 0;
                return (
                  <li key={transaction.id}>
                    <button
                      className={transaction.id === selected?.transaction.id ? "selected" : ""}
                      onClick={() => openRoom(transaction.id)}
                      data-testid={`inbox-row-${transaction.id}`}
                    >
                      <span className="inbox-row-avatar">{transaction.vehicle.maker.slice(0, 1)}</span>
                      <span className="inbox-row-body">
                        <span className="inbox-row-top">
                          <b>{counterpart}</b>
                          <time>{relativeRoomTime(room)}</time>
                        </span>
                        <span className="inbox-row-meta">
                          {transaction.vehicle.maker} {transaction.vehicle.model} ·{" "}
                          {transaction.service.workDescription}
                        </span>
                        <span className="inbox-row-bottom">
                          <em className="inbox-row-preview">{messagePreview(room)}</em>
                          {unread > 0 && <span className="inbox-unread-badge">{unread > 99 ? "99+" : unread}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
        <div className={`messenger-chat-pane${mobileView === "list" ? " mobile-hidden" : ""}`}>
          {selected ? (
            <TransactionChatWorkspace
              role={role}
              userId={userId}
              transaction={selected.transaction}
              room={selectedRoom}
              installer={selectedInstaller}
              useRemoteAttachments={useRemoteAttachments}
              demoAttachmentProvider={demoAttachmentProvider}
              onSend={onSend}
              onHide={onHide}
              onFinalPriceChange={onFinalPriceChange}
              onStageChange={onStageChange}
              onPaymentChange={onPaymentChange}
              onEndOutcome={onEndOutcome}
              onSetContactStatus={onSetContactStatus}
              onSetWarrantyInfo={onSetWarrantyInfo}
              onIssueWarranty={onIssueWarranty}
              onFindAnotherShop={onFindAnotherShop}
              onMarkRead={onMarkRead}
              onLoadOlder={onLoadOlder}
              onLoadContact={onLoadContact}
              onBack={backToList}
              roomLoading={isLoading}
              onRetry={onRetry}
            />
          ) : isLoading ? (
            <div className="messenger-no-selection">
              <SkeletonList rows={3} variant="card" label="거래방을 불러오는 중입니다." />
            </div>
          ) : (
            <div className="messenger-no-selection">
              {/* 이미 테두리가 있는 패널 안이라 compact — 카드 속 카드를 만들지 않는다. */}
              <EmptyState
                compact
                icon={MessageCircle}
                title="대화를 선택하세요."
                description="왼쪽 목록에서 거래방을 고르면 대화와 거래 정보가 여기에 표시됩니다."
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
