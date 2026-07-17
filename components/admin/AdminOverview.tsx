import { pricePackages } from "../../data/pricePackages";
import type { ChatRoom, Transaction } from "../../types/transactions";
import { AdminTransactionPanel } from "./AdminTransactionPanel";
export function AdminOverview({ transactions, rooms }: { transactions: Transaction[]; rooms: ChatRoom[] }) {
  const stats = [{ label: "전체 거래", value: transactions.length }, { label: "진행 중", value: transactions.filter((item) => !["완료", "취소"].includes(item.status.stage)).length }, { label: "완료", value: transactions.filter((item) => item.status.stage === "완료").length }, { label: "정산 완료", value: transactions.filter((item) => item.pricing.paymentStatus === "정산완료").length }];
  return <section className="section admin-overview"><header className="page-title"><div><p className="eyebrow">OPERATIONS OVERVIEW</p><h1>관리자 전체 현황</h1><p className="page-subtitle">거래와 결제 상태를 한곳에서 확인합니다.</p></div></header><div className="summary-grid">{stats.map((item) => <article className="card" key={item.label}><span>{item.label}</span><b>{item.value}건</b></article>)}</div><AdminTransactionPanel transactions={transactions} rooms={rooms} /><section className="card admin-price-summary"><div className="section-heading"><div><span>PRICE GUIDE</span><h2>가격 가이드 현황</h2></div><b>{pricePackages.length}개 상품</b></div></section></section>;
}
