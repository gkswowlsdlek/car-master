"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  Ban,
  Check,
  Copy,
  FileText,
  ImagePlus,
  MoreHorizontal,
  Paperclip,
  Phone,
  PhoneOff,
  Search,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { attachmentProvider, supabaseAttachmentProvider, type AttachmentProvider } from "../../services/attachments";
import { generateShopMessage } from "../../services/shop-message";
import { translateTransactionError } from "../../services/transaction-errors";
import {
  canTransitionStage,
  dealerStageIndex,
  dealerStageLabel,
  DEALER_STAGE_LABELS,
  isTerminalOutcome,
  nextForwardStage,
  revertStage,
  stageLogLabel,
  stageOrder,
  STAGE_ACTION_LABEL,
  STAGE_REVERT_LABEL,
  warrantyStatus,
  WARRANTY_STATUS_LABEL,
} from "../../services/transaction-state-service";
import type {
  ChatAttachment,
  ChatRoom,
  ContactStatus,
  PaymentStatus,
  Transaction,
  TransactionChatMessage,
  TransactionStage,
  WarrantyInfo,
} from "../../types/transactions";
import type { InstallerListing } from "../../types/installer";
import { EndTransactionOutcomeModal } from "./EndTransactionOutcomeModal";

const won = (value?: number) => (value == null ? "미확정" : `${value.toLocaleString("ko-KR")}원`);
const fileSize = (value: number) =>
  value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))}KB` : `${(value / 1024 / 1024).toFixed(1)}MB`;
// 시공예약 확정 → accept, 입고 처리 → start-work(작업의 시작), 작업완료 → complete-work.
// start-work-button / complete-work-button 문자열은 tests/v036-production-connection.test.mjs가 그대로 검증한다.
const stageActionTestId = (stage?: TransactionStage) =>
  stage === "시공예약"
    ? "accept-transaction-button"
    : stage === "입고"
      ? "start-work-button"
      : stage === "작업완료"
        ? "complete-work-button"
        : stage === "출고"
          ? "dispatch-transaction-button"
          : undefined;
const MAX_ATTACHMENTS = 4;
// Dealer-facing advance button text — grammatically correct particle per label
// (완료/출고 end in a vowel so take 로, 중 ends in a consonant so takes 으로).
const DEALER_ADVANCE_BUTTON_TEXT: Record<string, string> = {
  "작업 중": "작업 중으로 변경",
  "작업 완료": "작업 완료로 변경",
  출고: "출고로 변경",
};

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "오늘";
  if (date.toDateString() === yesterday.toDateString()) return "어제";
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function draftKey(roomId?: string) {
  return roomId ? `car-master-chat-draft:${roomId}` : "";
}

// Schedule fields can be a plain date ("2026-07-29") or a full ISO timestamp
// depending on how they were set — never show either raw to the user.
function scheduleLabel(value?: string) {
  if (!value) return "미정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

export function TransactionChatWorkspace({
  role,
  userId,
  transaction,
  room,
  installer,
  useRemoteAttachments,
  demoAttachmentProvider,
  onSend,
  onHide,
  onFinalPriceChange,
  onStageChange,
  onEndOutcome,
  onSetContactStatus,
  onSetWarrantyInfo,
  onIssueWarranty,
  onFindAnotherShop,
  onMarkRead,
  onLoadContact,
  onLoadOlder,
  onBack,
}: {
  role: "dealer" | "shop";
  userId: string;
  transaction: Transaction;
  room?: ChatRoom;
  /** Only meaningful for role === "dealer" — the installer's own directory listing, used by "시공점 정보 보기". */
  installer?: InstallerListing;
  useRemoteAttachments: boolean;
  /** Set only when the Demo attachment backend (SUPABASE_SERVICE_ROLE_KEY + demo-transaction-attachments bucket) is confirmed ready; otherwise falls back to attachmentProvider (session-only), unchanged from before this existed. */
  demoAttachmentProvider?: AttachmentProvider;
  onSend: (transaction: Transaction, message: TransactionChatMessage) => Promise<void>;
  onHide: (id: string, role: "dealer" | "shop") => void;
  onFinalPriceChange: (transaction: Transaction, finalPrice: number) => void;
  onStageChange: (transaction: Transaction, stage: TransactionStage) => Promise<void>;
  onPaymentChange: (transaction: Transaction, status: PaymentStatus) => void;
  /** 취소/시공불가 — never deletes the Transaction/Room/Messages/Shop, just ends the work lifecycle (Phase 5). */
  onEndOutcome: (transaction: Transaction, outcome: "취소" | "시공불가", note?: string) => Promise<void>;
  /** Phone-contact result (Phase 8) — independent signal, never forces a stage/outcome change. */
  onSetContactStatus?: (transaction: Transaction, status: ContactStatus) => Promise<void>;
  /** Dealer-only — saves whatever warranty-issuance fields are filled in (partial saves allowed). */
  onSetWarrantyInfo?: (
    transaction: Transaction,
    info: { customerName?: string; customerPhone?: string; vehicleNumber?: string; vin?: string },
  ) => Promise<void>;
  /** Shop-only — marks the warranty as issued; the caller enforces READY-only server-side. */
  onIssueWarranty?: (transaction: Transaction) => Promise<void>;
  /** Meaningful for role === "dealer" on a terminated transaction, or after an "연락이 안 돼요" contact result — sends the dealer back to Shop Search. */
  onFindAnotherShop?: () => void;
  onMarkRead?: (roomId: string) => void;
  onLoadContact?: (transaction: Transaction) => Promise<{ name: string; phone: string } | null>;
  /** Prepends the previous page of history. Resolves false when nothing more remains. */
  onLoadOlder?: (roomId: string) => Promise<boolean>;
  /** Only passed by MessengerScreen — renders a mobile-only back-to-Inbox button. TransactionManagementScreen never passes this, so its header is unchanged. */
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [preview, setPreview] = useState<ChatAttachment | null>(null);
  const [detailPanel, setDetailPanel] = useState<"none" | "transaction" | "installer">("none");
  const [finalPrice, setFinalPrice] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [stagePending, setStagePending] = useState(false);
  const [stageError, setStageError] = useState("");
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [confirmDispatchOpen, setConfirmDispatchOpen] = useState(false);
  const [endOutcomeModal, setEndOutcomeModal] = useState<"취소" | "시공불가" | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [showStageLog, setShowStageLog] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactState, setContactState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [contact, setContact] = useState<{ name: string; phone: string } | null>(null);
  const [contactCopied, setContactCopied] = useState(false);
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [contactStatusPending, setContactStatusPending] = useState(false);
  const [warrantyFormOpen, setWarrantyFormOpen] = useState(false);
  const [warrantyDraft, setWarrantyDraft] = useState({ customerName: "", customerPhone: "", vehicleNumber: "", vin: "" });
  const [warrantyPending, setWarrantyPending] = useState(false);
  const [warrantyResultMessage, setWarrantyResultMessage] = useState("");
  const [issueWarrantyPending, setIssueWarrantyPending] = useState(false);
  const [shopMessageCopied, setShopMessageCopied] = useState(false);
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
  // Dealer product spec is exactly 4 stages (입고 전/작업 중/작업 완료/출고, see
  // dealerStageLabel). 견적→시공예약 both collapse into "입고 전", so a dealer's
  // first advance click needs to chain two raw-stage hops to reach a visibly
  // different dealer-facing state in one click — see advanceFromQuoteToInbound.
  const dealerCurrentIndex = dealerStageIndex(transaction.status.stage);
  const dealerNextLabel = dealerCurrentIndex < 3 ? DEALER_STAGE_LABELS[dealerCurrentIndex + 1] : undefined;

  // Stage changes are projected into the timeline from transaction.stageLog
  // (the existing source of truth) instead of also writing a chat_messages
  // row per transition — one write path, no duplicated history. The very
  // first stageLog entry (room creation) is skipped since the room's own
  // initial system chat message already covers it.
  const timeline: (
    | { key: string; createdAt: string; kind: "stage"; label: string }
    | { key: string; createdAt: string; kind: "message"; message: TransactionChatMessage }
    | { key: string; createdAt: string; kind: "contact" }
  )[] = room
    ? [
        ...room.messages.map((message) => ({
          key: message.id,
          createdAt: message.createdAt,
          kind: "message" as const,
          message,
        })),
        ...transaction.stageLog.slice(1).map((event) => ({
          key: event.id,
          createdAt: event.createdAt,
          kind: "stage" as const,
          label: stageLogLabel(event),
        })),
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];
  // 전화 확인 안내를 별도의 큰 배너 대신, 거래방 생성 시스템 메시지(항상
  // timeline의 첫 항목) 바로 아래에 붙는 작은 블록으로 표시한다 — 같은
  // contact_status 흐름/데이터, 위치만 다르다.
  const showInlineContactBlock =
    role === "dealer" && (transaction.status.stage === "견적" || transaction.status.stage === "시공예약");
  if (showInlineContactBlock && timeline.length > 0) {
    timeline.splice(1, 0, { key: "inline-contact-block", createdAt: timeline[0].createdAt, kind: "contact" });
  }

  const runStageChange = async (next: TransactionStage) => {
    if (stagePending) return;
    setStagePending(true);
    setStageError("");
    try {
      await onStageChange(transaction, next);
    } catch (error) {
      setStageError(translateTransactionError(error, "상태를 변경하지 못했습니다. 다시 시도해 주세요."));
    } finally {
      setStagePending(false);
    }
  };
  const handleAdvanceClick = () => {
    if (!forwardStage || stagePending) return;
    if (forwardStage === "작업완료") {
      setConfirmCompleteOpen(true);
      return;
    }
    if (forwardStage === "출고" && !transaction.pricing.finalPrice) {
      setConfirmDispatchOpen(true);
      return;
    }
    void runStageChange(forwardStage);
  };
  const confirmComplete = () => {
    setConfirmCompleteOpen(false);
    void runStageChange("작업완료");
  };
  const confirmDispatch = () => {
    setConfirmDispatchOpen(false);
    void runStageChange("출고");
  };
  const advanceFromQuoteToInbound = async () => {
    if (stagePending) return;
    setStagePending(true);
    setStageError("");
    try {
      await onStageChange(transaction, "시공예약");
      await onStageChange({ ...transaction, status: { ...transaction.status, stage: "시공예약" } }, "입고");
    } catch (error) {
      setStageError(translateTransactionError(error, "상태를 변경하지 못했습니다. 다시 시도해 주세요."));
    } finally {
      setStagePending(false);
    }
  };
  const handleDealerAdvanceClick = () => {
    if (!dealerNextLabel || stagePending) return;
    if (transaction.status.stage === "견적") {
      void advanceFromQuoteToInbound();
      return;
    }
    handleAdvanceClick();
  };

  const terminalOutcome = isTerminalOutcome(transaction.status.stage);

  // Load any draft left behind the last time this room was open, and swap it
  // out (not append) whenever the user switches rooms. Adjusted synchronously
  // during render (React's documented pattern for "reset state when a prop
  // changes") rather than in an effect, since setState-in-effect triggers an
  // avoidable extra render pass.
  const [lastDraftRoomId, setLastDraftRoomId] = useState(room?.id);
  if (room?.id !== lastDraftRoomId) {
    setLastDraftRoomId(room?.id);
    const key = draftKey(room?.id);
    setDraft(key ? (sessionStorage.getItem(key) ?? "") : "");
  }
  useEffect(() => {
    const key = draftKey(room?.id);
    if (!key) return;
    if (draft) sessionStorage.setItem(key, draft);
    else sessionStorage.removeItem(key);
  }, [draft, room?.id]);

  // Keyed on the NEWEST entry, never on timeline.length: prepending a page of
  // history also grows the length, and reacting to that would fire the
  // "새 메시지" affordance for messages the reader deliberately went back for.
  const latestKey = timeline.length > 0 ? timeline[timeline.length - 1].key : "";

  // Auto-scroll only follows new messages while the reader is already near
  // the bottom — someone scrolled up to reread history shouldn't get yanked
  // back down. Otherwise a small "새 메시지" affordance appears instead.
  const wasNearBottom = useRef(true);
  useEffect(() => {
    if (wasNearBottom.current) {
      messageEnd.current?.scrollIntoView({ block: "end" });
      setShowJumpToLatest(false);
    } else setShowJumpToLatest(true);
  }, [latestKey]);
  const handleScroll = () => {
    const element = messagesContainer.current;
    if (!element) return;
    wasNearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    if (wasNearBottom.current) setShowJumpToLatest(false);
  };
  const jumpToLatest = () => {
    messageEnd.current?.scrollIntoView({ block: "end" });
    setShowJumpToLatest(false);
    wasNearBottom.current = true;
  };

  // Prepending history shifts everything down by exactly the height that was
  // inserted, which would throw the reader to a different part of the
  // conversation. Capturing scrollHeight before the load and re-adding the
  // difference afterwards keeps the message they were looking at still under
  // the cursor.
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadOlder = async () => {
    const element = messagesContainer.current;
    if (!room || !onLoadOlder || loadingOlder) return;
    const previousHeight = element?.scrollHeight ?? 0;
    const previousTop = element?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      await onLoadOlder(room.id);
    } finally {
      setLoadingOlder(false);
    }
    requestAnimationFrame(() => {
      const node = messagesContainer.current;
      if (!node) return;
      node.scrollTop = previousTop + (node.scrollHeight - previousHeight);
    });
  };

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
    // array .find() result each time) — depending on room?.id/latestKey
    // instead avoids re-arming this timer on unrelated re-renders.
    //
    // latestKey, NOT timeline.length: markRead moves the cursor to now(), so
    // firing it when a page of HISTORY is prepended would mark genuinely
    // unseen new messages as read. Only a new newest message may re-arm it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, latestKey, onMarkRead]);
  useEffect(() => {
    if (!onMarkRead) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && room) onMarkRead(room.id);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, onMarkRead]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(
    () => () => {
      const provider = useRemoteAttachments
        ? supabaseAttachmentProvider
        : (demoAttachmentProvider ?? attachmentProvider);
      pendingRef.current.forEach((item) => {
        if (provider.discard) void provider.discard(item);
        else provider.release(item);
      });
    },
    [useRemoteAttachments, demoAttachmentProvider],
  );

  const selectFiles = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setAttachmentError("");
    const room_ = pendingRef.current.length;
    const capped = list.slice(0, Math.max(0, MAX_ATTACHMENTS - room_));
    if (list.length > capped.length) setAttachmentError(`한 번에 최대 ${MAX_ATTACHMENTS}장까지 첨부할 수 있어요.`);
    const provider = useRemoteAttachments ? supabaseAttachmentProvider : (demoAttachmentProvider ?? attachmentProvider);
    for (const file of capped) {
      try {
        const prepared = await provider.prepare(file, room?.id);
        pendingRef.current = [...pendingRef.current, prepared];
        setPending([...pendingRef.current]);
      } catch (error) {
        setAttachmentError(translateTransactionError(error, "파일을 업로드하지 못했습니다."));
      }
    }
  };
  const removePending = (id: string) =>
    setPending((current) => {
      const next = current.filter((item) => {
        if (item.id === id) {
          const provider = useRemoteAttachments
            ? supabaseAttachmentProvider
            : (demoAttachmentProvider ?? attachmentProvider);
          if (provider.discard) void provider.discard(item);
          else provider.release(item);
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
      await onSend(transaction, {
        id: `${room.id}-M-${now}`,
        roomId: room.id,
        senderId: userId,
        senderRole: role,
        text,
        attachments: pending,
        createdAt: now,
        readBy: [userId],
      });
      pendingRef.current = [];
      setDraft("");
      setPending([]);
      const key = draftKey(room.id);
      if (key) sessionStorage.removeItem(key);
    } catch (error) {
      const provider = useRemoteAttachments
        ? supabaseAttachmentProvider
        : (demoAttachmentProvider ?? attachmentProvider);
      await Promise.allSettled(pending.map((item) => provider.discard?.(item)));
      pendingRef.current = [];
      setPending([]);
      setAttachmentError(translateTransactionError(error, "메시지를 보내지 못했습니다. 잠시 후 다시 시도해 주세요."));
    } finally {
      setIsSending(false);
    }
  };
  const hide = () => {
    const warning =
      !["작업완료", "출고", "취소", "시공불가"].includes(transaction.status.stage) && role === "shop"
        ? "진행 중인 거래입니다. 그래도 숨기시겠습니까?\n"
        : "";
    if (confirm(`${warning}이 거래방은 목록에서 숨겨집니다. 거래 기록은 카마스터에 보관됩니다.`))
      onHide(transaction.id, role);
  };
  const openContact = async () => {
    setContactOpen(true);
    setContactCopied(false);
    if (!onLoadContact) {
      setContactState("error");
      return;
    }
    setContactState("loading");
    try {
      const result = await onLoadContact(transaction);
      setContact(result);
      setContactState("loaded");
    } catch {
      setContactState("error");
    }
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
  const recordContactResult = async (status: ContactStatus) => {
    if (!onSetContactStatus || contactStatusPending) return;
    setContactStatusPending(true);
    try {
      await onSetContactStatus(transaction, status);
    } finally {
      setContactStatusPending(false);
    }
  };
  const openWarrantyForm = () => {
    setWarrantyDraft({
      customerName: transaction.warranty.customerName ?? "",
      customerPhone: transaction.warranty.customerPhone ?? "",
      vehicleNumber: transaction.warranty.vehicleNumber ?? "",
      vin: transaction.warranty.vin ?? "",
    });
    setWarrantyResultMessage("");
    setWarrantyFormOpen(true);
  };
  // "보증서 정보 전달"은 3개 필수 필드가 전부 있을 때만 활성화된다 — 완료
  // 처리는 이 버튼에서만 일어난다. VIN 등 일부만 먼저 저장하고 싶을 때는
  // 아래 "임시 저장"(항상 클릭 가능, 같은 RPC를 그대로 호출 — 백엔드는
  // 원래도 부분 저장을 허용한다)을 쓴다. 어느 버튼을 눌러도 warrantyStatus는
  // 여전히 3개 필드 존재 여부로만 파생되므로, VIN만 저장하면 항상 NOT_READY.
  const canSubmitWarranty = Boolean(
    warrantyDraft.customerName.trim() && warrantyDraft.customerPhone.trim() && warrantyDraft.vehicleNumber.trim(),
  );
  // 임시 저장 후 안내 문구 — 어떤 필드가 비어 있는지에 따라 갈린다. VIN만
  // 있고 나머지가 전부 비어 있으면(시나리오 B) "차량 확인 가능" 문구, 이름/
  // 연락처는 있는데 차량번호만 없으면(시나리오 D) 차량번호 안내 문구를
  // 우선한다 — 둘 다 vehicleNumber가 없다는 점은 같지만 상황이 다르다.
  const warrantyDraftGuidance = () => {
    const hasName = Boolean(warrantyDraft.customerName.trim());
    const hasPhone = Boolean(warrantyDraft.customerPhone.trim());
    const hasPlate = Boolean(warrantyDraft.vehicleNumber.trim());
    const hasVin = Boolean(warrantyDraft.vin.trim());
    if (hasName && hasPhone && hasPlate) return "정보가 저장되었습니다.";
    if (!hasPlate && hasVin && !hasName && !hasPhone)
      return "차량 확인은 가능하지만 보증서 발급 정보는 아직 완료되지 않았습니다.";
    if (!hasPlate) return "보증서 발급에는 차량번호가 필요합니다.";
    if (!hasName) return "고객명을 입력해 주세요.";
    if (!hasPhone) return "연락처를 입력해 주세요.";
    return "정보가 저장되었습니다.";
  };
  // 시공점 뷰의 NOT_READY 안내 — 정보가 아예 없는지, 차량번호만 없는지,
  // 차량번호는 있는데 이름/연락처가 없는지를 구분해서 문구를 고른다.
  const shopWarrantyNotReadyMessage = (warranty: WarrantyInfo) => {
    const hasAny = Boolean(warranty.customerName || warranty.customerPhone || warranty.vehicleNumber || warranty.vin);
    if (!hasAny) return "딜러가 아직 보증서 발급 정보를 등록하지 않았습니다.";
    if (!warranty.vehicleNumber) return "차량번호 등록 대기 중입니다.";
    return "보증서 발급 정보가 아직 완료되지 않았습니다.";
  };
  const saveWarrantyDraft = async () => {
    if (!onSetWarrantyInfo || warrantyPending) return;
    setWarrantyPending(true);
    try {
      await onSetWarrantyInfo(transaction, warrantyDraft);
      setWarrantyResultMessage(warrantyDraftGuidance());
    } finally {
      setWarrantyPending(false);
    }
  };
  const submitWarrantyInfo = async () => {
    if (!onSetWarrantyInfo || warrantyPending || !canSubmitWarranty) return;
    setWarrantyPending(true);
    try {
      await onSetWarrantyInfo(transaction, warrantyDraft);
      setWarrantyResultMessage("보증서 발급 준비가 완료됐습니다. 시공점에 전달됩니다.");
    } finally {
      setWarrantyPending(false);
    }
  };
  const submitIssueWarranty = async () => {
    if (!onIssueWarranty || issueWarrantyPending) return;
    setIssueWarrantyPending(true);
    try {
      await onIssueWarranty(transaction);
    } finally {
      setIssueWarrantyPending(false);
    }
  };
  const copyShopMessage = () => {
    void navigator.clipboard?.writeText(generateShopMessage(transaction)).then(() => {
      setShopMessageCopied(true);
      setTimeout(() => setShopMessageCopied(false), 2000);
    });
  };

  return (
    <article className="messenger-workspace" data-testid={`transaction-detail-${transaction.id}`}>
      <section className="messenger-center">
        <header className="messenger-header">
          {onBack && (
            <button className="chat-back-button" onClick={onBack} aria-label="목록으로 돌아가기">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <span className="messenger-avatar">{transaction.vehicle.maker.slice(0, 1)}</span>
            <div>
              <h2>
                {transaction.vehicle.maker} {transaction.vehicle.model} ·{" "}
                {transaction.service.product ?? transaction.service.workDescription}
                {transaction.warranty.vehicleNumber ? ` · ${transaction.warranty.vehicleNumber}` : ""}
              </h2>
              <p>
                {role === "dealer" ? transaction.installerName : transaction.dealerName || "담당 딜러"} <i />{" "}
                <b>{role === "dealer" ? dealerStageLabel(transaction.status.stage) : transaction.status.stage}</b>
              </p>
            </div>
          </div>
          <nav>
            <button
              aria-label="전화하기"
              title={contactState === "loaded" && !contact ? "등록된 연락처가 없습니다." : "연락처 확인"}
              className="messenger-call-button"
              disabled={contactState === "loaded" && !contact}
              onClick={() => void openContact()}
            >
              <Phone size={18} />
            </button>
            <span className="messenger-more-wrap">
              <button
                aria-label="더보기"
                aria-expanded={moreMenuOpen}
                onClick={() => setMoreMenuOpen((value) => !value)}
              >
                <MoreHorizontal size={19} />
              </button>
              {moreMenuOpen && (
                <div className="messenger-more-menu">
                  <button
                    onClick={() => {
                      setNotificationsMuted((value) => !value);
                      setMoreMenuOpen(false);
                    }}
                  >
                    {notificationsMuted ? "알림 켜기" : "알림 끄기"}
                  </button>
                  <button
                    onClick={() => {
                      setDetailPanel("transaction");
                      setMoreMenuOpen(false);
                    }}
                  >
                    거래 상세 보기
                  </button>
                  {role === "dealer" && (
                    <button
                      onClick={() => {
                        setDetailPanel("installer");
                        setMoreMenuOpen(false);
                      }}
                    >
                      시공점 정보 보기
                    </button>
                  )}
                  {role === "dealer" && !terminalOutcome && (
                    <button
                      onClick={() => {
                        setEndOutcomeModal("취소");
                        setMoreMenuOpen(false);
                      }}
                    >
                      거래 취소
                    </button>
                  )}
                  {role === "dealer" && !terminalOutcome && (
                    <button
                      onClick={() => {
                        setEndOutcomeModal("시공불가");
                        setMoreMenuOpen(false);
                      }}
                    >
                      시공 불가 처리
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMoreMenuOpen(false);
                      hide();
                    }}
                  >
                    이 거래방 숨기기
                  </button>
                </div>
              )}
            </span>
          </nav>
        </header>
        {confirmCompleteOpen && (
            <div className="stage-confirm-overlay" role="dialog" aria-modal="true">
              <div className="stage-confirm-backdrop" onClick={() => setConfirmCompleteOpen(false)} />
              <div className="stage-confirm-card">
                <h3>작업완료 처리할까요?</h3>
                <p>
                  작업완료로 표시하면 이 거래는 완료 상태가 됩니다. 실수였다면 이후에도 입고 상태로 되돌릴 수 있어요.
                </p>
                <div className="stage-confirm-buttons">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setConfirmCompleteOpen(false)}
                  >
                    취소
                  </button>
                  <button type="button" className="button button-primary" onClick={confirmComplete}>
                    작업완료 처리
                  </button>
                </div>
              </div>
            </div>
          )}
          {confirmDispatchOpen && (
            <div className="stage-confirm-overlay" role="dialog" aria-modal="true">
              <div className="stage-confirm-backdrop" onClick={() => setConfirmDispatchOpen(false)} />
              <div className="stage-confirm-card">
                <h3>최종 시공금액을 먼저 입력할까요?</h3>
                <p>아직 최종 시공금액이 기록되지 않았어요. 나중에 입력해도 출고 처리에는 영향이 없어요.</p>
                <div className="stage-confirm-buttons">
                  <button type="button" className="button button-secondary" onClick={confirmDispatch}>
                    나중에 입력
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      setConfirmDispatchOpen(false);
                      setDetailPanel("transaction");
                    }}
                  >
                    지금 입력
                  </button>
                </div>
              </div>
            </div>
          )}
        {endOutcomeModal && (
          <EndTransactionOutcomeModal
            outcome={endOutcomeModal}
            onClose={() => setEndOutcomeModal(null)}
            onConfirm={async (note) => {
              await onEndOutcome(transaction, endOutcomeModal, note);
              setEndOutcomeModal(null);
            }}
          />
        )}
        <div className="messenger-messages" ref={messagesContainer} onScroll={handleScroll}>
          {room?.hasMoreMessages && onLoadOlder && (
            <div className="messenger-load-older">
              <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder}>
                {loadingOlder ? "불러오는 중…" : "이전 메시지 보기"}
              </button>
            </div>
          )}
          <div className="message-date-divider">
            <span>거래방 생성 · {dayLabel(transaction.status.createdAt)}</span>
          </div>
          {timeline.map((entry, index) => {
            const previousDate = index > 0 ? new Date(timeline[index - 1].createdAt).toDateString() : "";
            const currentDate = new Date(entry.createdAt).toDateString();
            const showDivider = index === 0 ? false : previousDate !== currentDate;
            if (entry.kind === "stage")
              return (
                <div key={entry.key}>
                  {showDivider && (
                    <div className="message-date-divider">
                      <span>{dayLabel(entry.createdAt)}</span>
                    </div>
                  )}
                  <div className="message-system message-stage-event">
                    <span>{entry.label}</span>
                  </div>
                </div>
              );
            if (entry.kind === "contact")
              return (
                <div
                  key={entry.key}
                  className={`chat-contact-inline ${
                    transaction.contactStatus === "contacted"
                      ? "chat-contact-inline-done-card"
                      : transaction.contactStatus === "unreachable"
                        ? "chat-contact-inline-alert"
                        : "chat-contact-inline-pending"
                  }`}
                >
                  {transaction.contactStatus === "contacted" ? (
                    <p className="chat-contact-inline-done">
                      <Check size={14} /> 전화 확인 완료
                    </p>
                  ) : transaction.contactStatus === "unreachable" ? (
                    <>
                      <p>
                        <PhoneOff size={14} /> 연락이 되지 않았어요
                      </p>
                      <div className="chat-contact-inline-actions">
                        {installer?.contactPhone ? (
                          <a
                            className="button button-secondary"
                            href={`tel:${installer.contactPhone.replace(/[^0-9+]/g, "")}`}
                          >
                            <Phone size={14} /> 다시 전화하기
                          </a>
                        ) : (
                          <span className="chat-contact-inline-empty">등록된 연락처가 없습니다.</span>
                        )}
                        {onFindAnotherShop && (
                          <button type="button" className="button button-secondary" onClick={onFindAnotherShop}>
                            다른 시공점 찾기
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="chat-contact-inline-title">전화 확인이 필요합니다</p>
                      <p className="chat-contact-inline-shop">{transaction.installerName}</p>
                      <p className="chat-contact-inline-phone">
                        {installer?.contactPhone || "등록된 연락처가 없습니다."}
                      </p>
                      <div className="chat-contact-inline-actions">
                        {installer?.contactPhone && (
                          <a
                            className="button button-primary"
                            href={`tel:${installer.contactPhone.replace(/[^0-9+]/g, "")}`}
                          >
                            <Phone size={14} /> 전화하기
                          </a>
                        )}
                        {onSetContactStatus && (
                          <>
                            <button
                              type="button"
                              className="button button-secondary"
                              disabled={contactStatusPending}
                              onClick={() => void recordContactResult("contacted")}
                            >
                              연결됐어요
                            </button>
                            <button
                              type="button"
                              className="button button-secondary"
                              disabled={contactStatusPending}
                              onClick={() => void recordContactResult("unreachable")}
                            >
                              연락이 안 돼요
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            const message = entry.message;
            const mine = message.senderId === userId;
            const read = mine && message.readBy.length > 1;
            if (message.senderRole === "system")
              return (
                <div key={entry.key}>
                  {showDivider && (
                    <div className="message-date-divider">
                      <span>{dayLabel(message.createdAt)}</span>
                    </div>
                  )}
                  <div className="message-system">
                    <span>{message.text}</span>
                  </div>
                </div>
              );
            return (
              <div key={entry.key}>
                {showDivider && (
                  <div className="message-date-divider">
                    <span>{dayLabel(message.createdAt)}</span>
                  </div>
                )}
                <div className={`message-row ${mine ? "mine" : "theirs"}`}>
                  {!mine && <span className="message-avatar">{message.senderRole === "shop" ? "시" : "딜"}</span>}
                  <div className="message-content">
                    <small>{mine ? "나" : message.senderRole === "shop" ? "시공점" : "딜러"}</small>
                    {message.text && <p>{message.text}</p>}
                    {message.attachments?.map((attachment) =>
                      attachment.kind === "image" ? (
                        <button className="image-message" key={attachment.id} onClick={() => setPreview(attachment)}>
                          <img src={attachment.url} alt={attachment.name} />
                          <span>{attachment.name}</span>
                        </button>
                      ) : (
                        <a
                          className="file-message"
                          key={attachment.id}
                          href={attachment.url}
                          download={attachment.name}
                        >
                          <FileText size={22} />
                          <span>
                            <b>{attachment.name}</b>
                            <small>{fileSize(attachment.size)}</small>
                          </span>
                        </a>
                      ),
                    )}
                    <span>
                      <time>
                        {new Date(message.createdAt).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      {read && <em className="message-status read">읽음</em>}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {!room && (
            <div className="messenger-empty" role="status">
              <b>거래방을 연결하고 있어요.</b>
              <span>잠시만 기다려 주세요.</span>
            </div>
          )}
          {room && timeline.length === 0 && (
            <div className="messenger-empty">
              <b>아직 나눈 대화가 없어요.</b>
              <span>시공 일정이나 차량 정보를 먼저 전달해 보세요.</span>
            </div>
          )}
          <div ref={messageEnd} />
        </div>
        {showJumpToLatest && (
          <button className="jump-to-latest" onClick={jumpToLatest}>
            <ArrowDown size={15} /> 새 메시지
          </button>
        )}
        <footer className="messenger-composer">
          {attachmentError && <p className="login-error">{attachmentError}</p>}
          {pending.length > 0 && (
            <div className="attachment-preview-strip">
              {pending.map((item) => (
                <div key={item.id}>
                  {item.kind === "image" ? <img src={item.url} alt="" /> : <FileText size={22} />}
                  <span>
                    <b>{item.name}</b>
                    <small>
                      {fileSize(item.size)} ·{" "}
                      {item.persistence === "remote" ? "거래방에 안전하게 저장" : "이번 세션에서만 표시"}
                    </small>
                  </span>
                  <button onClick={() => removePending(item.id)} aria-label="첨부 삭제">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="composer-row">
            <div className="composer-tools">
              <button onClick={() => imageInput.current?.click()} aria-label="사진 첨부" disabled={isSending}>
                <ImagePlus size={19} />
              </button>
              <button onClick={() => fileInput.current?.click()} aria-label="파일 첨부" disabled={isSending}>
                <Paperclip size={19} />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              data-testid="chat-input"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="메시지를 입력하세요."
            />
            <button
              data-testid="chat-send-button"
              className="composer-send"
              onClick={() => void send()}
              disabled={isSending || !room || (!draft.trim() && pending.length === 0)}
              aria-busy={isSending}
            >
              <Send size={18} />
              <span>{isSending ? "전송 중" : "보내기"}</span>
            </button>
          </div>
          <input
            data-testid="file-upload-input"
            ref={imageInput}
            hidden
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              void selectFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={fileInput}
            hidden
            type="file"
            multiple
            accept=".pdf,.txt,.doc,.docx,.xls,.xlsx"
            onChange={(event) => {
              void selectFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </footer>
      </section>
      <aside className={`messenger-sidebar ${detailPanel !== "none" ? "mobile-open" : ""}`}>
        <button className="sidebar-close" onClick={() => setDetailPanel("none")}>
          <X size={18} />
        </button>
        {detailPanel === "installer" ? (
          <>
            <div className="briefing-title">
              <span>연락처 정보</span>
              <h3>시공점 정보</h3>
              <p>연락 전에 위치와 영업 정보를 먼저 확인하세요.</p>
            </div>
            <dl className="briefing-data">
              <div>
                <dt>시공점</dt>
                <dd>{transaction.installerName}</dd>
              </div>
              <div>
                <dt>위치</dt>
                <dd>{installer?.address ?? "등록된 주소가 없습니다."}</dd>
              </div>
              <div>
                <dt>영업시간</dt>
                <dd>{installer?.hours ?? "등록된 영업시간이 없습니다."}</dd>
              </div>
              <div>
                <dt>시공 가능 필름</dt>
                <dd>{installer?.brands.length ? installer.brands.join(", ") : "등록된 정보가 없습니다."}</dd>
              </div>
            </dl>
            <div className="sidebar-settlement">
              <h4>연락처</h4>
              <button className="button button-secondary" onClick={() => void openContact()}>
                연락처 확인
              </button>
            </div>
            {role === "dealer" && (
              <div className="sidebar-settlement">
                <h4>시공점에 보낼 내용</h4>
                <button type="button" className="button button-secondary" onClick={copyShopMessage}>
                  <Copy size={16} /> {shopMessageCopied ? "복사됨" : "시공점에 보낼 내용 복사"}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 한 패널에 eyebrow + 제목 + 설명 3단을 쌓지 않는다 — 매번 보는
             * 상시 사이드바라 제목 한 줄이면 충분하고, 걷어낸 높이는 실제
             * 거래 정보가 가져간다. */}
            <div className="briefing-title">
              <h3>거래 정보</h3>
            </div>
            <div className="sidebar-stage">
              <span>현재 상태</span>
              <b>{role === "dealer" ? dealerStageLabel(transaction.status.stage) : transaction.status.stage}</b>
              <div className="stage-progress-rail sidebar-stage-rail">
                {role === "dealer"
                  ? DEALER_STAGE_LABELS.map((label, index) => {
                      const dealerIndex = dealerStageIndex(transaction.status.stage);
                      return (
                        <span
                          className={index < dealerIndex ? "complete" : index === dealerIndex ? "active" : ""}
                          key={label}
                        >
                          <i>{index < dealerIndex ? "✓" : index + 1}</i>
                          <small>{label}</small>
                        </span>
                      );
                    })
                  : stageOrder.map((stage, index) => (
                      <span
                        className={index < stageIndex ? "complete" : index === stageIndex ? "active" : ""}
                        key={stage}
                      >
                        <i>{index < stageIndex ? "✓" : index + 1}</i>
                        <small>{stage}</small>
                      </span>
                    ))}
              </div>
              {stageError && (
                <p className="stage-error" role="alert">
                  {stageError}
                </p>
              )}
              {terminalOutcome ? (
                <div className={`transaction-outcome-banner outcome-${transaction.status.stage}`}>
                  <b>
                    {transaction.status.stage === "취소" ? (
                      <>
                        <XCircle size={16} /> 이 거래는 취소되었습니다.
                      </>
                    ) : (
                      <>
                        <Ban size={16} /> 이 거래는 시공 불가로 종료되었습니다.
                      </>
                    )}
                  </b>
                  {transaction.outcomeNote && <p>{transaction.outcomeNote}</p>}
                  {role === "dealer" && onFindAnotherShop && (
                    <button type="button" className="button button-secondary" onClick={onFindAnotherShop}>
                      <Search size={16} /> 다른 시공점 찾기
                    </button>
                  )}
                </div>
              ) : (
                <div className="sidebar-next-step">
                  <span>지금 할 일</span>
                  {role === "dealer" ? (
                    dealerNextLabel ? (
                      <button
                        type="button"
                        data-testid="dealer-stage-advance-button"
                        className="primary stage-cta"
                        onClick={handleDealerAdvanceClick}
                        disabled={stagePending}
                        aria-busy={stagePending}
                      >
                        {stagePending ? "처리 중…" : DEALER_ADVANCE_BUTTON_TEXT[dealerNextLabel]}
                      </button>
                    ) : (
                      <p className="sidebar-next-step-done">추가로 진행할 단계가 없습니다.</p>
                    )
                  ) : (
                    <>
                      {canAdvance && (
                        <button
                          data-testid={stageActionTestId(forwardStage)}
                          className="primary stage-cta"
                          onClick={handleAdvanceClick}
                          disabled={stagePending}
                          aria-busy={stagePending}
                        >
                          {stagePending ? "처리 중…" : STAGE_ACTION_LABEL[forwardStage!]}
                        </button>
                      )}
                      {canRevert && (
                        <button
                          type="button"
                          className="stage-revert-link"
                          onClick={() => void runStageChange(backStage!)}
                          disabled={stagePending}
                        >
                          ↩ {STAGE_REVERT_LABEL[backStage!]}
                        </button>
                      )}
                      {!canAdvance && !canRevert && <p className="sidebar-next-step-done">추가로 진행할 단계가 없습니다.</p>}
                    </>
                  )}
                </div>
              )}
            </div>
            <dl className="briefing-data">
              <div>
                <dt>다음 일정</dt>
                <dd>
                  {scheduleLabel(transaction.schedule.confirmedInboundAt ?? transaction.schedule.requestedInboundAt)}
                </dd>
              </div>
              <div>
                <dt>출고 희망일</dt>
                <dd>{scheduleLabel(transaction.schedule.desiredReleaseAt)}</dd>
              </div>
              <div>
                <dt>차량</dt>
                <dd>
                  {transaction.vehicle.maker} {transaction.vehicle.model} ({transaction.vehicle.class || "미분류"})
                </dd>
              </div>
              <div>
                <dt>시공 품목</dt>
                <dd>{transaction.service.workDescription}</dd>
              </div>
              <div>
                <dt>상대 업체</dt>
                <dd>{role === "dealer" ? transaction.installerName : "담당 딜러"}</dd>
              </div>
            </dl>
            <div className="sidebar-settlement">
              <h4>최종 시공금액</h4>
              <p className="final-amount-value">
                <b>{won(transaction.pricing.finalPrice)}</b>
              </p>
              {(role === "shop" || role === "dealer") && (
                <div>
                  <input
                    value={finalPrice}
                    onChange={(event) => setFinalPrice(event.target.value)}
                    placeholder="최종 시공금액"
                    inputMode="numeric"
                  />
                  <button onClick={savePrice}>저장</button>
                </div>
              )}
            </div>
            {/* Free Beta에서는 payment/settlement UI 비활성. 향후 결제 모델
                확정 후 재검토 — pricing.paymentStatus/onPaymentChange/
                transitionPayment RPC는 그대로 두고 이 화면에서만 숨긴다. */}
            <div className="sidebar-settlement">
              <h4>보증서 발급 정보</h4>
              {role === "dealer" ? (
                warrantyFormOpen ? (
                  <div className="warranty-form">
                    <p className="warranty-form-group-label">고객 정보</p>
                    <label>
                      고객명 *
                      <input
                        value={warrantyDraft.customerName}
                        onChange={(event) =>
                          setWarrantyDraft((current) => ({ ...current, customerName: event.target.value }))
                        }
                        placeholder="고객명"
                      />
                    </label>
                    <label>
                      연락처 *
                      <input
                        value={warrantyDraft.customerPhone}
                        onChange={(event) =>
                          setWarrantyDraft((current) => ({ ...current, customerPhone: event.target.value }))
                        }
                        placeholder="연락처"
                        inputMode="tel"
                      />
                    </label>
                    <p className="warranty-form-group-label">차량 정보</p>
                    <label>
                      차량번호 *
                      <input
                        value={warrantyDraft.vehicleNumber}
                        onChange={(event) =>
                          setWarrantyDraft((current) => ({ ...current, vehicleNumber: event.target.value }))
                        }
                        placeholder="예: 123가4567"
                      />
                      <small>보증서 발급에는 차량번호가 필요합니다.</small>
                    </label>
                    <label>
                      차대번호(VIN)
                      <input
                        value={warrantyDraft.vin}
                        onChange={(event) => setWarrantyDraft((current) => ({ ...current, vin: event.target.value }))}
                        placeholder="선택 입력"
                      />
                      <small>차대번호는 차량 확인용 선택 정보입니다.</small>
                    </label>
                    {warrantyResultMessage && <p className="warranty-result-message">{warrantyResultMessage}</p>}
                    <div className="warranty-form-actions">
                      <button type="button" className="button button-secondary" onClick={() => setWarrantyFormOpen(false)}>
                        닫기
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={warrantyPending || canSubmitWarranty}
                        aria-busy={warrantyPending}
                        onClick={() => void saveWarrantyDraft()}
                        title={
                          canSubmitWarranty
                            ? "고객명, 연락처, 차량번호가 모두 있어요 — 보증서 정보 전달을 눌러주세요."
                            : "차량번호가 아직 없을 때 VIN 등 일부 정보만 먼저 저장합니다."
                        }
                      >
                        {warrantyPending ? "저장 중…" : "임시 저장"}
                      </button>
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={warrantyPending || !canSubmitWarranty}
                        aria-busy={warrantyPending}
                        title={canSubmitWarranty ? undefined : "고객명, 연락처, 차량번호가 모두 있어야 전달할 수 있습니다."}
                        onClick={() => void submitWarrantyInfo()}
                      >
                        {warrantyPending ? "전달 중…" : "보증서 정보 전달"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {warrantyStatus(transaction.warranty) === "ISSUED" ? (
                      <p>보증서 발급 완료</p>
                    ) : warrantyStatus(transaction.warranty) === "READY" ? (
                      <p>발급 대기 — 시공점에서 확인 중입니다.</p>
                    ) : (
                      <>
                        <p className="warranty-not-ready-title">출고 전 입력 필요</p>
                        <p className="warranty-not-ready-detail">고객명, 연락처, 차량번호가 필요합니다.</p>
                      </>
                    )}
                    {warrantyStatus(transaction.warranty) !== "ISSUED" && (
                      <button type="button" className="button button-secondary" onClick={openWarrantyForm}>
                        보증서 정보 입력
                      </button>
                    )}
                  </>
                )
              ) : (
                <>
                  <dl className="briefing-data warranty-info-dl">
                    <div>
                      <dt>담당 딜러</dt>
                      <dd>{transaction.dealerName || "확인 중"}</dd>
                    </div>
                    <div>
                      <dt>딜러 소속</dt>
                      <dd>{transaction.dealerCompanyName || "확인 중"}</dd>
                    </div>
                    <div>
                      <dt>차종</dt>
                      <dd>
                        {transaction.vehicle.maker} {transaction.vehicle.model}
                      </dd>
                    </div>
                    <div>
                      <dt>차량번호</dt>
                      <dd>{transaction.warranty.vehicleNumber || "미등록"}</dd>
                    </div>
                    <div>
                      <dt>VIN</dt>
                      <dd>{transaction.warranty.vin || "미등록"}</dd>
                    </div>
                    <div>
                      <dt>고객명</dt>
                      <dd>{transaction.warranty.customerName || "미등록"}</dd>
                    </div>
                    <div>
                      <dt>고객 연락처</dt>
                      <dd>{transaction.warranty.customerPhone || "미등록"}</dd>
                    </div>
                    <div>
                      <dt>정보 등록일</dt>
                      <dd>
                        {transaction.warranty.infoSubmittedAt
                          ? new Date(transaction.warranty.infoSubmittedAt).toLocaleString("ko-KR", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "미등록"}
                      </dd>
                    </div>
                    <div>
                      <dt>보증서 상태</dt>
                      <dd>{WARRANTY_STATUS_LABEL[warrantyStatus(transaction.warranty)]}</dd>
                    </div>
                  </dl>
                  {warrantyStatus(transaction.warranty) === "NOT_READY" && (
                    <p className="warranty-result-message">{shopWarrantyNotReadyMessage(transaction.warranty)}</p>
                  )}
                  {warrantyStatus(transaction.warranty) === "READY" && onIssueWarranty && (
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={issueWarrantyPending}
                      aria-busy={issueWarrantyPending}
                      onClick={() => void submitIssueWarranty()}
                    >
                      {issueWarrantyPending ? "처리 중…" : "보증서 발급 완료"}
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="sidebar-stage-log">
              <button
                type="button"
                className="sidebar-stage-log-toggle"
                onClick={() => setShowStageLog((value) => !value)}
                aria-expanded={showStageLog}
              >
                <span>전체 기록 보기</span>
                {showStageLog ? "▲" : "▼"}
              </button>
              {showStageLog &&
                (transaction.stageLog.length === 0 ? (
                  <p className="stage-log-empty">아직 기록이 없습니다.</p>
                ) : (
                  <ul>
                    {[...transaction.stageLog].reverse().map((event) => (
                      <li key={event.id}>
                        <time>
                          {new Date(event.createdAt).toLocaleString("ko-KR", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                        <span>{stageLogLabel(event)}</span>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
            <button className="transaction-hide-button" onClick={hide}>
              이 거래방 숨기기
            </button>
          </>
        )}
      </aside>
      {preview && (
        <div className="attachment-lightbox" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <button aria-label="닫기" onClick={() => setPreview(null)}>
            <X size={22} />
          </button>
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={preview.url} alt={preview.name} />
            <figcaption>{preview.name}</figcaption>
          </figure>
        </div>
      )}
      {contactOpen && (
        <div className="contact-sheet-overlay" role="dialog" aria-modal="true" aria-label="연락처 확인">
          <div className="contact-sheet-backdrop" onClick={() => setContactOpen(false)} />
          <div className="contact-sheet-card">
            {contactState === "loading" && <p className="contact-sheet-status">연락처를 확인하는 중입니다…</p>}
            {contactState === "error" && (
              <p className="contact-sheet-status" role="alert">
                연락처를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
              </p>
            )}
            {contactState === "loaded" && !contact && (
              <p className="contact-sheet-status">연락처가 등록되지 않았습니다.</p>
            )}
            {contactState === "loaded" && contact && (
              <>
                <b className="contact-sheet-name">{contact.name}</b>
                <p className="contact-sheet-phone">{contact.phone}</p>
                <div className="contact-sheet-actions">
                  <button type="button" className="button button-secondary" onClick={copyContactPhone}>
                    <Copy size={16} /> {contactCopied ? "복사됨" : "번호 복사"}
                  </button>
                  <a className="button button-primary" href={`tel:${contact.phone.replace(/[^0-9+]/g, "")}`}>
                    <Phone size={16} /> 통화하기
                  </a>
                </div>
              </>
            )}
            <button type="button" className="contact-sheet-close" onClick={() => setContactOpen(false)}>
              취소
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
