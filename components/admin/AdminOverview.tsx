import { Activity, CheckCircle2, CircleAlert, CreditCard, TrendingUp } from "lucide-react";
import { pricePackages } from "../../data/pricePackages";
import type { ChatRoom, Transaction } from "../../types/transactions";
import { AdminTransactionPanel } from "./AdminTransactionPanel";
import { InstallerApprovalPanel } from "./InstallerApprovalPanel";
import { AdminMemberPanel } from "./AdminMemberPanel";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_MS = 1000 * 60 * 60 * 24;

/** referenceTime(최신 거래의 updatedAt)을 "오늘"로 삼아 최근 7일 생성 건수를 요일별로 집계한다.
 * 데모 시드 데이터가 실제 오늘 날짜와 멀리 떨어져 있어도(예: 2026-01-01) 항상 의미 있는 값이 나오도록,
 * 실제 시스템 시각이 아니라 데이터 안의 최신 시각을 기준으로 창을 잡는다. */
function computeWeeklyVolume(transactions: Transaction[], referenceTime: number) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const time = referenceTime - (6 - index) * DAY_MS;
    return { key: new Date(time).toISOString().slice(0, 10), label: WEEKDAY_LABELS[new Date(time).getDay()] };
  });
  const counts = new Map(days.map((day) => [day.key, 0]));
  for (const item of transactions) {
    const key = new Date(item.status.createdAt).toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const values = days.map((day) => ({ label: day.label, count: counts.get(day.key) ?? 0 }));
  const max = Math.max(1, ...values.map((item) => item.count));
  return { values, max, total: values.reduce((sum, item) => sum + item.count, 0) };
}

export function AdminOverview({ transactions, rooms, demoSession = false }: { transactions: Transaction[]; rooms: ChatRoom[]; demoSession?: boolean }) {
  const referenceTime = Math.max(0, ...transactions.map((item) => new Date(item.status.updatedAt).getTime()));
  const stalled = transactions.filter((item) => item.status.stage !== "작업완료" && item.status.stage !== "취소" && referenceTime - new Date(item.status.updatedAt).getTime() > 1000 * 60 * 60 * 24 * 3).length;
  const weeklyVolume = computeWeeklyVolume(transactions, referenceTime);
  const stats = [
    { label: "전체 거래", value: transactions.length, note: "플랫폼 누적", icon: TrendingUp, tone: "blue" },
    { label: "진행 중", value: transactions.filter((item) => !["작업완료", "취소"].includes(item.status.stage)).length, note: "현재 운영 거래", icon: Activity, tone: "violet" },
    { label: "확인 필요", value: transactions.filter((item) => item.status.stage === "견적").length + stalled, note: "신규·장기 미응답", icon: CircleAlert, tone: "orange" },
    { label: "정산 완료", value: transactions.filter((item) => item.pricing.paymentStatus === "정산완료").length, note: "누적 정산", icon: CreditCard, tone: "green" },
  ];
  return <section className="section admin-overview role-home role-home-admin">
    <header className="workspace-heading"><div><p className="eyebrow">OPERATIONS CONTROL</p><h1>카마스터 운영 현황</h1><p>승인 대기와 확인이 필요한 거래를 우선해서 보여드립니다.</p></div><div className="admin-header-badges"><span className="admin-live-badge"><i /> 실시간 운영</span><span className={`admin-live-badge admin-source-badge ${demoSession ? "demo" : "real"}`}><i /> {demoSession ? "Demo 데이터" : "실제 운영 데이터"}</span></div></header>
    <div className="summary-grid admin-summary-grid">{stats.map((item) => <article className={`card tone-${item.tone}`} key={item.label}><i><item.icon size={20} /></i><span>{item.label}</span><b>{item.value}<small>건</small></b><em>{item.note}</em></article>)}</div>
    <div className="admin-alert-strip"><div><span>!</span><p><b>운영 확인</b> 신규 요청 {transactions.filter((item) => item.status.stage === "견적").length}건과 장기 미응답 {stalled}건을 확인해 주세요.</p></div><div><span>가격 상품</span><b>{pricePackages.length}개 운영 중</b></div></div>
    <section className="admin-insight-grid"><article className="card admin-chart-card"><header><div><p className="eyebrow">TRANSACTION VOLUME</p><h2>주간 거래량</h2></div><span><TrendingUp size={15} /> 최근 7일</span></header>{weeklyVolume.total === 0 ? <div className="compact-empty admin-chart-empty"><b>표시할 거래 데이터가 아직 부족합니다.</b><span>최근 7일 내 생성된 거래가 없습니다.</span></div> : <div className="admin-chart" aria-label="주간 거래량 시각화">{weeklyVolume.values.map((item, index) => <i key={index} style={{ height: `${Math.max(6, (item.count / weeklyVolume.max) * 100)}%` }}><span>{item.label}</span></i>)}</div>}</article><article className="card admin-health-card"><p className="eyebrow">SERVICE HEALTH</p><h2>운영 상태</h2><div><span><CheckCircle2 size={18} /> 서비스 운영</span><b>정상</b></div><div><span><Activity size={18} /> 활성 거래방</span><b>{rooms.length}개</b></div><div><span><CreditCard size={18} /> 가격 상품</span><b>{pricePackages.length}개</b></div></article></section>
    <AdminTransactionPanel transactions={transactions} rooms={rooms} />
    <InstallerApprovalPanel demoSession={demoSession} />
    <AdminMemberPanel demoSession={demoSession} />
  </section>;
}
