"use client";
import { useEffect, useMemo, useState } from "react";
import { shopSearchRequestRepository } from "../repositories/shop-search-request-repository";
import { dealerStageLabel } from "../services/transaction-state-service";
import type { ChatRoom, Transaction } from "../types/transactions";

/**
 * All three notification types are derived from data the app already loads
 * for other reasons (rooms/unreadCount, transaction.stageLog, shop search
 * request status) — no notifications table, no new inserts anywhere. See
 * feat/notifications 1단계 investigation: a stored-events table would need a
 * migration and a write at three call sites, and could silently drift from
 * the data it's supposed to summarize. If the source data has nothing, a
 * notification cannot exist — that's the "no fake notifications" guarantee,
 * structurally, not by convention.
 */
export type NotificationType = "message" | "stage_change" | "shop_proposed" | "new_request";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  transactionId?: string;
  /** Only meaningful for type "shop_proposed" — routes to 시공점 찾기 요청 instead of a room. */
  requestId?: string;
};

function relativeTime(iso: string) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

/**
 * @param role "dealer" watches messages + stage changes + Admin shop
 *   proposals. "shop" watches messages + new requests only — Admin gets no
 *   notification layer at all (AdminOverview's ops queue already is one).
 * @param useSupabaseData Shop 제안(shop_search_proposals)은 Real 전용 기능이라
 *   Demo에서는 이 조회 자체를 건너뛴다 — 건너뛰는 것이 맞다, 즉 0건이 정답이다.
 */
export function useNotifications({
  role,
  transactions,
  rooms,
  useSupabaseData = false,
}: {
  role: "dealer" | "shop";
  transactions: Transaction[];
  rooms: ChatRoom[];
  /** Shop 제안 조회 여부를 결정 — dealer가 아니면 애초에 안 쓰이므로 shop 쪽
   * 호출부는 생략해도 된다. */
  useSupabaseData?: boolean;
}) {
  const [proposals, setProposals] = useState<{ id: string; shopName: string; updatedAt: string }[]>([]);

  useEffect(() => {
    // role/useSupabaseData는 이 훅을 부르는 워크스페이스가 마운트된 동안
    // 사실상 고정값이라(DealerWorkspace는 항상 role:"dealer", InstallerWorkspace는
    // 항상 role:"shop") 가드에 걸릴 때 상태를 되돌릴 필요가 없다 — 초기값이
    // 이미 []다.
    if (role !== "dealer" || !useSupabaseData) return;
    let cancelled = false;
    void shopSearchRequestRepository
      .getMine()
      .then((items) => {
        if (cancelled) return;
        setProposals(
          items
            .filter((item) => item.status === "shop_proposed" && item.proposedShop)
            .map((item) => ({ id: item.id, shopName: item.proposedShop!.shopName, updatedAt: item.updatedAt })),
        );
      })
      .catch(() => {
        if (!cancelled) setProposals([]);
      });
    return () => {
      cancelled = true;
    };
    // transactions.length: 요청→거래 전환(수락) 시 늘어나므로, 그 타이밍에
    // 다시 읽어 수락된 제안을 목록에서 걷어낸다.
  }, [role, useSupabaseData, transactions.length]);

  const visibleTransactions = useMemo(
    () =>
      transactions.filter((item) =>
        role === "dealer" ? !item.visibility.hiddenByDealer : !item.visibility.hiddenByInstaller,
      ),
    [transactions, role],
  );

  const messageNotifications = useMemo<AppNotification[]>(() => {
    // Shop의 "새 요청"은 아직 이 시공점이 한 번도 응답하지 않은 견적 상태
    // 거래를 가리킨다(ShopDashboard와 동일 판정) — 그 방의 첫 메시지가 곧
    // "새 요청" 알림이 되므로, message 알림에서는 제외해 같은 사건이 두 번
    // 뜨지 않게 한다.
    const newRequestRoomIds =
      role === "shop"
        ? new Set(
            visibleTransactions
              .filter((item) => item.status.stage === "견적")
              .filter(
                (item) =>
                  !rooms
                    .find((room) => room.id === item.chatRoomId)
                    ?.messages.some((message) => message.senderRole === "shop"),
              )
              .map((item) => item.chatRoomId),
          )
        : new Set<string>();
    return rooms
      .filter((room) => room.unreadCount > 0 && !newRequestRoomIds.has(room.id))
      .map((room) => {
        const transaction = visibleTransactions.find((item) => item.chatRoomId === room.id);
        const last = room.messages[room.messages.length - 1];
        const counterpart = transaction
          ? role === "dealer"
            ? transaction.installerName
            : "담당 딜러"
          : "새 메시지";
        return {
          id: `message-${room.id}`,
          type: "message" as const,
          title: counterpart,
          body: last?.text?.trim() || (last?.attachments?.length ? "파일을 보냈습니다" : "새 메시지가 도착했습니다."),
          createdAt: last?.createdAt ?? room.updatedAt,
          transactionId: transaction?.id,
        };
      });
  }, [rooms, visibleTransactions, role]);

  const stageChangeNotifications = useMemo<AppNotification[]>(() => {
    if (role !== "dealer") return [];
    const list: AppNotification[] = [];
    for (const transaction of visibleTransactions) {
      const room = rooms.find((item) => item.id === transaction.chatRoomId);
      const lastReadAt = room?.lastReadAt ?? "";
      const latest = [...transaction.stageLog].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!latest) continue;
      if (latest.actorRole === "dealer") continue; // 딜러 자신의 조작은 알릴 필요 없음
      if (latest.createdAt <= lastReadAt) continue; // 그 방을 이미 열어본 뒤 일어난 변경이 아님
      list.push({
        id: `stage-${transaction.id}-${latest.id}`,
        type: "stage_change",
        title: transaction.installerName,
        body: `현재 단계: ${dealerStageLabel(transaction.status.stage)}`,
        createdAt: latest.createdAt,
        transactionId: transaction.id,
      });
    }
    return list;
  }, [visibleTransactions, rooms, role]);

  const proposalNotifications = useMemo<AppNotification[]>(
    () =>
      proposals.map((item) => ({
        id: `proposal-${item.id}`,
        type: "shop_proposed" as const,
        title: item.shopName,
        body: "시공점을 제안드렸습니다. 확인해 주세요.",
        createdAt: item.updatedAt,
        requestId: item.id,
      })),
    [proposals],
  );

  const newRequestNotifications = useMemo<AppNotification[]>(() => {
    if (role !== "shop") return [];
    return visibleTransactions
      .filter((item) => item.status.stage === "견적")
      .filter(
        (item) =>
          !rooms.find((room) => room.id === item.chatRoomId)?.messages.some((message) => message.senderRole === "shop"),
      )
      .map((item) => ({
        id: `new-request-${item.id}`,
        type: "new_request" as const,
        title: `${item.vehicle.maker} ${item.vehicle.model}`,
        body: item.service.workDescription || item.service.product || "새 시공 요청이 도착했습니다.",
        createdAt: item.status.createdAt,
        transactionId: item.id,
      }));
  }, [visibleTransactions, rooms, role]);

  const items = useMemo(
    () =>
      [...messageNotifications, ...stageChangeNotifications, ...proposalNotifications, ...newRequestNotifications].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt),
      ),
    [messageNotifications, stageChangeNotifications, proposalNotifications, newRequestNotifications],
  );

  return { items, unreadCount: items.length, relativeTime };
}
