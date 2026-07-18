import { Activity, CheckCircle2, CircleAlert, CreditCard, TrendingUp } from "lucide-react";
import { pricePackages } from "../../data/pricePackages";
import type { ChatRoom, Transaction } from "../../types/transactions";
import { AdminTransactionPanel } from "./AdminTransactionPanel";

export function AdminOverview({ transactions, rooms }: { transactions: Transaction[]; rooms: ChatRoom[] }) {
  const referenceTime = Math.max(0, ...transactions.map((item) => new Date(item.status.updatedAt).getTime()));
  const stalled = transactions.filter((item) => item.status.stage !== "완료" && item.status.stage !== "취소" && referenceTime - new Date(item.status.updatedAt).getTime() > 1000 * 60 * 60 * 24 * 3).length;
  const stats = [
    { label: "전체 거래", value: transactions.length, note: "플랫폼 누적", icon: TrendingUp, tone: "blue" },
    { label: "진행 중", value: transactions.filter((item) => !["완료", "취소"].includes(item.status.stage)).length, note: "현재 운영 거래", icon: Activity, tone: "violet" },
    { label: "확인 필요", value: transactions.filter((item) => item.status.stage === "접수").length + stalled, note: "신규·장기 미응답", icon: CircleAlert, tone: "orange" },
    { label: "정산 완료", value: transactions.filter((item) => item.pricing.paymentStatus === "정산완료").length, note: "누적 정산", icon: CreditCard, tone: "green" },
  ];
  return <section className="section admin-overview">
    <header className="workspace-heading"><div><p className="eyebrow">BETA OPERATIONS</p><h1>베타 운영 현황</h1><p>사용자 거래와 응답이 필요한 상태를 한곳에서 확인합니다.</p></div><span className="admin-live-badge"><i /> 운영 모니터링 중</span></header>
    <div className="summary-grid admin-summary-grid">{stats.map((item) => <article className={`card tone-${item.tone}`} key={item.label}><i><item.icon size={20} /></i><span>{item.label}</span><b>{item.value}<small>건</small></b><em>{item.note}</em></article>)}</div>
    <div className="admin-alert-strip"><div><span>!</span><p><b>운영 확인</b> 신규 요청 {transactions.filter((item) => item.status.stage === "접수").length}건과 장기 미응답 {stalled}건을 확인해 주세요.</p></div><div><span>가격 상품</span><b>{pricePackages.length}개 운영 중</b></div></div>
    <section className="admin-insight-grid"><article className="card admin-chart-card"><header><div><p className="eyebrow">TRANSACTION VOLUME</p><h2>주간 거래량</h2></div><span><TrendingUp size={15} /> 최근 7일</span></header><div className="admin-chart" aria-label="주간 거래량 시각화">{[38, 52, 44, 68, 58, 82, 72].map((height, index) => <i key={index} style={{ height: `${height}%` }}><span>{["월", "화", "수", "목", "금", "토", "일"][index]}</span></i>)}</div></article><article className="card admin-health-card"><p className="eyebrow">SERVICE HEALTH</p><h2>운영 상태</h2><div><span><CheckCircle2 size={18} /> 서비스 운영</span><b>정상</b></div><div><span><Activity size={18} /> 활성 거래방</span><b>{rooms.length}개</b></div><div><span><CreditCard size={18} /> 가격 상품</span><b>{pricePackages.length}개</b></div></article></section>
    <AdminTransactionPanel transactions={transactions} rooms={rooms} />
  </section>;
}
