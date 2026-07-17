import { pricePackages } from "../../data/pricePackages";
import { calculateVehicleClassPrice, vehicleClassOptions, type VehicleClass } from "../../data/vehicle-class-options";
import { formatGuidePrice } from "../../data/installation-price-guide";
import { classifyVehicleModel } from "../../data/vehicleClasses";
import type { ServiceRequest } from "../../types/dealer";

export function ServiceRequestForm({ request, setRequest, onFindShops, onSummary, hasSelectedShop }: { request: ServiceRequest; setRequest: (request: ServiceRequest) => void; onFindShops: () => void; onSummary: () => void; hasSelectedShop: boolean }) {
  const updateModel = (model: string) => setRequest({ ...request, model, vehicleClass: classifyVehicleModel(model) || request.vehicleClass });
  const updateVehicleClass = (vehicleClass: VehicleClass) => {
    const pkg = pricePackages.find((item) => item.id === request.selectedPackageId);
    if (!pkg) return setRequest({ ...request, vehicleClass });
    const price = calculateVehicleClassPrice(pkg.guidePrice, vehicleClass);
    setRequest({ ...request, vehicleClass, baseGuidePrice: pkg.guidePrice, ...price, expectedPrice: price.priceRequiresInquiry ? (vehicleClass === "국산 대형/SUV" ? "추가금 발생 가능" : "별도 견적") : formatGuidePrice(price.finalGuidePrice ?? pkg.guidePrice) });
  };
  const ready = Boolean(request.model.trim() && request.deliveryArea.trim() && request.workDescription.trim() && request.inboundStart.trim() && hasSelectedShop);
  return <form className="simple-request-card practical-request-card service-request-form">
    <div className="form-section-title wide-field"><span>01</span><div><b>차량 정보</b><small>시공할 차량과 등급을 확인해 주세요.</small></div></div>
    <label className="wide-field required-field"><span>차량모델 <em>필수</em></span><input required value={request.model} onChange={(event) => updateModel(event.target.value)} placeholder="예: 제네시스 GV80" /></label>
    <div className="vehicle-class-picker wide-field"><span>차량 등급</span>{vehicleClassOptions.map((option) => <button type="button" key={option.id} className={request.vehicleClass === option.id ? "active" : ""} onClick={() => updateVehicleClass(option.id)}><b>{option.label}</b><small>{option.description}</small></button>)}<p>※ 같은 차량 등급이라도 창문 크기, 필름 사용량 및 작업 조건에 따라 추가 비용이 발생할 수 있습니다.</p></div>
    <div className="form-section-title wide-field"><span>02</span><div><b>일정 및 작업</b><small>시공점이 바로 확인할 수 있도록 핵심 내용을 입력해 주세요.</small></div></div>
    <label className="required-field"><span>시공지역 <em>필수</em></span><input required value={request.deliveryArea} onChange={(event) => setRequest({ ...request, deliveryArea: event.target.value })} onBlur={onFindShops} placeholder="예: 경기 하남시 미사" /></label>
    <label className="required-field"><span>입고예정일 <em>필수</em></span><input required value={request.inboundStart} onChange={(event) => setRequest({ ...request, inboundStart: event.target.value, inboundEnd: event.target.value })} placeholder="예: 2026-07-24 또는 일정 미정" /></label>
    <label className="wide-field required-field"><span>작업내용 <em>필수</em></span><textarea required value={request.workDescription} onChange={(event) => setRequest({ ...request, workDescription: event.target.value, works: event.target.value.trim() ? [event.target.value.trim()] : [], memo: event.target.value })} placeholder="예: 버텍스 900 썬팅, 신차검수, 생활보호 PPF, 블랙박스 장착" /></label>
    <label className="wide-field"><span>추가 요청사항</span><textarea value={request.extraRequest} onChange={(event) => setRequest({ ...request, extraRequest: event.target.value, extraWorkNote: event.target.value })} placeholder="예: 전면 30%, 측후면 15% 희망 / 출고 전 사진 요청" /></label>
    <div className="request-submit-area wide-field"><p>{ready ? "필수 정보와 시공점 선택이 완료되었습니다." : "필수 정보를 입력하고 시공점을 선택해 주세요."}</p><button type="button" className="primary request-submit-button" onClick={onSummary} disabled={!ready}>{request.requestType} 보내기</button></div>
  </form>;
}
