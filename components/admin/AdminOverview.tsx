import { useState } from "react";
import type { ChatRoom, Transaction } from "../../types/transactions";
import { AdminOpsQueue } from "./AdminOpsQueue";
import { AdminShopSearchRequestPanel } from "./AdminShopSearchRequestPanel";
import { AdminTransactionPanel, type TransactionGroup } from "./AdminTransactionPanel";
import { InstallerApprovalPanel } from "./InstallerApprovalPanel";
import { AdminMemberPanel } from "./AdminMemberPanel";

/**
 * Admin 홈 — "지금 무엇을 먼저 처리해야 하는지"가 최우선이다 (Phase 7 §1).
 * 매출/가입자수/주간 거래량 Chart 같은 vanity metric은 의도적으로 없다 (§16).
 * 운영 큐 → 처리 대기 요청(Shop Search Request) → 전체 거래 → 승인 관리 순으로
 * 배치해 실제 운영 우선순위를 화면 순서에 그대로 반영한다.
 */
export function AdminOverview({ transactions, rooms, demoSession = false, onOpenShopManagement }: { transactions: Transaction[]; rooms: ChatRoom[]; demoSession?: boolean; onOpenShopManagement: () => void }) {
  const [transactionGroup, setTransactionGroup] = useState<TransactionGroup>("전체");
  const [contactFilter, setContactFilter] = useState<"전체" | "연락실패">("전체");

  const scrollToTransactionPanel = () => document.getElementById("admin-transaction-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return <section className="section admin-overview role-home role-home-admin">
    <header className="workspace-heading"><div><p className="eyebrow">OPERATIONS QUEUE</p><h1>카마스터 운영 현황</h1><p>지금 처리가 필요한 항목을 오래된 순으로 보여드립니다.</p></div><div className="admin-header-badges"><span className="admin-live-badge"><i /> 실시간 운영</span><span className={`admin-live-badge admin-source-badge ${demoSession ? "demo" : "real"}`}><i /> {demoSession ? "Demo 데이터" : "실제 운영 데이터"}</span></div></header>
    <AdminOpsQueue transactions={transactions} demoSession={demoSession} onOpenShopManagement={onOpenShopManagement}
      onOpenTerminatedTransactions={() => { setTransactionGroup("종료"); setContactFilter("전체"); scrollToTransactionPanel(); }}
      onOpenUnreachableTransactions={() => { setTransactionGroup("전체"); setContactFilter("연락실패"); scrollToTransactionPanel(); }} />
    <AdminShopSearchRequestPanel demoSession={demoSession} />
    <AdminTransactionPanel transactions={transactions} rooms={rooms} group={transactionGroup} onGroupChange={setTransactionGroup} contactFilter={contactFilter} onContactFilterChange={setContactFilter} />
    <InstallerApprovalPanel demoSession={demoSession} />
    <AdminMemberPanel demoSession={demoSession} />
  </section>;
}
