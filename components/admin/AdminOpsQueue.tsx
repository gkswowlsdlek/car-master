"use client";

import { useEffect, useState } from "react";
import { AlertOctagon, Building2, PhoneOff, PlayCircle, Search, Send, UserCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { shopSearchRequestRepository } from "../../repositories/shop-search-request-repository";
import type { Transaction } from "../../types/transactions";

type QueueCounts = {
  requested: number;
  inProgress: number;
  shopProposed: number;
  installerPending: number;
  shopClaimPending: number;
};

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/**
 * Admin 홈의 "지금 무엇을 먼저 처리해야 하는지" 큐. 새 집계 시스템이 아니라
 * 이미 존재하는 상태(shop_search_requests.status, installer_approvals.status,
 * shop_claim_requests.status, transactions.stage)를 그대로 세는 것뿐이며,
 * count가 0인 항목은 렌더링하지 않는다 (§3). 매출/가입자수 같은 vanity
 * metric은 절대 넣지 않는다 (§16).
 */
export function AdminOpsQueue({
  transactions,
  demoSession,
  onOpenShopManagement,
  onOpenTerminatedTransactions,
  onOpenUnreachableTransactions,
}: {
  transactions: Transaction[];
  demoSession: boolean;
  onOpenShopManagement: () => void;
  onOpenTerminatedTransactions: () => void;
  onOpenUnreachableTransactions: () => void;
}) {
  const [counts, setCounts] = useState<QueueCounts | null>(null);

  useEffect(() => {
    if (demoSession) return;
    let active = true;
    (async () => {
      const client = createSupabaseBrowserClient();
      const [requests, installerPending, shopClaimPending] = await Promise.all([
        shopSearchRequestRepository.getAllForAdmin().catch(() => []),
        client.from("installer_approvals").select("*", { count: "exact", head: true }).eq("status", "pending"),
        client.from("shop_claim_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      if (!active) return;
      setCounts({
        requested: requests.filter((item) => item.status === "requested").length,
        inProgress: requests.filter((item) => item.status === "in_progress").length,
        shopProposed: requests.filter((item) => item.status === "shop_proposed").length,
        installerPending: installerPending.count ?? 0,
        shopClaimPending: shopClaimPending.count ?? 0,
      });
    })();
    return () => {
      active = false;
    };
  }, [demoSession]);

  const terminatedCount = transactions.filter(
    (item) => item.status.stage === "취소" || item.status.stage === "시공불가",
  ).length;
  // Phone-contact result (Phase 8) — an independent signal from stage/outcome, already loaded on the transactions prop, no new query.
  const unreachableCount = transactions.filter((item) => item.contactStatus === "unreachable").length;

  const cards = [
    {
      key: "requested",
      count: counts?.requested ?? 0,
      icon: Search,
      label: "시공점 찾기 요청",
      onClick: () => scrollTo("admin-shop-search-request-panel"),
    },
    {
      key: "inProgress",
      count: counts?.inProgress ?? 0,
      icon: PlayCircle,
      label: "카마스터 확인 중인 요청",
      onClick: () => scrollTo("admin-shop-search-request-panel"),
    },
    {
      key: "shopProposed",
      count: counts?.shopProposed ?? 0,
      icon: Send,
      label: "Dealer 응답 대기",
      onClick: () => scrollTo("admin-shop-search-request-panel"),
    },
    {
      key: "unreachable",
      count: unreachableCount,
      icon: PhoneOff,
      label: "연락 실패 거래",
      onClick: onOpenUnreachableTransactions,
    },
    {
      key: "terminated",
      count: terminatedCount,
      icon: AlertOctagon,
      label: "취소·시공불가 거래",
      onClick: onOpenTerminatedTransactions,
    },
    {
      key: "installerPending",
      count: counts?.installerPending ?? 0,
      icon: UserCheck,
      label: "Installer 승인 대기",
      onClick: () => scrollTo("installer-approval-panel"),
    },
    {
      key: "shopClaimPending",
      count: counts?.shopClaimPending ?? 0,
      icon: Building2,
      label: "업체 연결 승인 대기",
      onClick: onOpenShopManagement,
    },
  ].filter((card) => card.count > 0);

  return (
    <section className="admin-ops-queue" aria-label="운영 큐">
      {demoSession ? (
        <div className="compact-empty">
          <b>Demo 세션에서는 실제 운영 큐가 표시되지 않습니다.</b>
          <span>실제 관리자 계정으로 로그인하면 처리 대기 항목이 표시됩니다.</span>
        </div>
      ) : counts === null ? (
        <div className="compact-empty">
          <b>운영 큐를 불러오는 중입니다.</b>
        </div>
      ) : cards.length === 0 ? (
        <div className="compact-empty">
          <b>지금 처리할 항목이 없습니다.</b>
          <span>모든 요청과 승인이 처리 완료 상태입니다.</span>
        </div>
      ) : (
        <div className="transaction-summary-strip admin-ops-queue-strip">
          {cards.map((card) => (
            <button type="button" key={card.key} onClick={card.onClick}>
              <span>
                <card.icon size={14} aria-hidden="true" /> {card.label}
              </span>
              <b>{card.count}</b>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
