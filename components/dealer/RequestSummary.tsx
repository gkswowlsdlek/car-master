import type { InstallerShop } from "../../lib/dealer-flow-data";
import type { ServiceRequest } from "../../types/dealer";
export function RequestSummary({ request, shop, onBack, onSubmit }: { request: ServiceRequest; shop: InstallerShop; onBack: () => void; onSubmit: () => void }) {
  const rows = [["차량", `${request.maker} ${request.model}`], ["차량 등급", request.vehicleClass], ["작업내용", request.workDescription], ["추가 요청", request.extraRequest || "없음"], ["입고예정일", request.inboundStart], ["시공점", shop.name], ["가이드 가격", request.expectedPrice ?? "시공점 확인"]];
  return <section className="section summary-page"><header className="page-title"><div><p className="eyebrow">FINAL REVIEW</p><h1>요청 내용을 확인해주세요</h1><p className="page-subtitle">전송하면 이 요청만을 위한 독립 거래방이 생성됩니다.</p></div></header><div className="card summary-card"><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="summary-actions"><button className="button button-secondary" onClick={onBack}>수정하기</button><button className="button button-primary" onClick={onSubmit}>{request.requestType} 보내기</button></div></div></section>;
}
