import { useState } from "react";
import { classifyVehicleModel } from "../../data/vehicleClasses";
import {
  administrativeRegionNames,
  administrativeRegions,
  type AdministrativeRegion,
} from "../../data/administrative-regions";
import type { ServiceRequest } from "../../types/dealer";

export function ServiceRequestForm({
  request,
  setRequest,
  onFindShops,
  onSummary,
  hasSelectedShop,
}: {
  request: ServiceRequest;
  setRequest: (request: ServiceRequest) => void;
  onFindShops: (area?: string) => void;
  onSummary: () => void;
  hasSelectedShop: boolean;
}) {
  const [showOptionalInfo, setShowOptionalInfo] = useState(false);
  const updateModel = (model: string) =>
    setRequest({ ...request, model, vehicleClass: classifyVehicleModel(model) || request.vehicleClass });
  const selectedRegion = administrativeRegionNames.find((region) => request.deliveryArea.includes(region)) ?? "경기";
  const districts = administrativeRegions[selectedRegion];
  const selectedDistrict = districts.find((district) => request.deliveryArea.includes(district)) ?? districts[0];
  const setArea = (region: string, district: string) => {
    const area = `${region} ${district}`;
    setRequest({ ...request, deliveryArea: area });
    onFindShops(area);
  };
  const today = new Date().toISOString().slice(0, 10);
  const ready = Boolean(
    request.model.trim() &&
    request.deliveryArea.trim() &&
    request.workDescription.trim() &&
    request.inboundStart.trim() &&
    request.releaseDate.trim() &&
    hasSelectedShop,
  );
  return (
    <form className="simple-request-card practical-request-card service-request-form">
      <div className="form-section-title wide-field">
        <span>01</span>
        <div>
          <b>차량 정보</b>
          <small>시공할 차량 모델을 입력해 주세요.</small>
        </div>
      </div>
      <label className="wide-field required-field">
        <span>
          차량모델 <em>필수</em>
        </span>
        <input
          required
          value={request.model}
          onChange={(event) => updateModel(event.target.value)}
          placeholder="예: 제네시스 GV80"
        />
      </label>
      <div className="form-section-title wide-field">
        <span>02</span>
        <div>
          <b>일정 및 작업</b>
          <small>시공점이 바로 확인할 수 있도록 핵심 내용을 입력해 주세요.</small>
        </div>
      </div>
      <fieldset className="request-region-field required-field">
        <legend>
          시공지역 <em>필수</em>
        </legend>
        <div>
          <select
            aria-label="시도 선택"
            value={selectedRegion}
            onChange={(event) => {
              const region = event.target.value as AdministrativeRegion;
              setArea(region, administrativeRegions[region][0]);
            }}
          >
            {administrativeRegionNames.map((region) => (
              <option key={region}>{region}</option>
            ))}
          </select>
          <select
            aria-label="시군구 선택"
            value={selectedDistrict}
            onChange={(event) => setArea(selectedRegion, event.target.value)}
          >
            {districts.map((district) => (
              <option key={district}>{district}</option>
            ))}
          </select>
        </div>
        <small>지역을 선택하면 가까운 시공점 목록과 연결됩니다.</small>
      </fieldset>
      <label className="required-field">
        <span>
          입고예정일 <em>필수</em>
        </span>
        <input
          required
          type="date"
          min={today}
          value={request.inboundStart}
          onChange={(event) =>
            setRequest({ ...request, inboundStart: event.target.value, inboundEnd: event.target.value })
          }
        />
      </label>
      <label className="required-field">
        <span>
          출고 희망일 <em>필수</em>
        </span>
        <input
          required
          type="date"
          min={request.inboundStart || today}
          value={request.releaseDate}
          onChange={(event) => setRequest({ ...request, releaseDate: event.target.value })}
        />
      </label>
      <label className="wide-field required-field">
        <span>
          작업내용 <em>필수</em>
        </span>
        <textarea
          required
          value={request.workDescription}
          onChange={(event) =>
            setRequest({
              ...request,
              workDescription: event.target.value,
              works: event.target.value.trim() ? [event.target.value.trim()] : [],
              memo: event.target.value,
            })
          }
          placeholder="예: 버텍스 900 썬팅, 신차검수, 생활보호 PPF, 블랙박스 장착"
        />
      </label>
      <label className="wide-field">
        <span>추가 요청사항</span>
        <textarea
          value={request.extraRequest}
          onChange={(event) =>
            setRequest({ ...request, extraRequest: event.target.value, extraWorkNote: event.target.value })
          }
          placeholder="예: 전면 30%, 측후면 15% 희망 / 출고 전 사진 요청"
        />
      </label>
      <div className="form-section-title wide-field">
        <span>03</span>
        <div>
          <b>차량·고객 정보 (선택)</b>
          <small>알고 있는 정보가 있다면 미리 입력해 두세요. 몰라도 요청은 그대로 보낼 수 있고, 나중에 거래관리에서 입력해도 됩니다.</small>
        </div>
      </div>
      {!showOptionalInfo ? (
        <div className="wide-field">
          <button type="button" className="secondary" onClick={() => setShowOptionalInfo(true)}>
            차량·고객 정보 입력 (선택)
          </button>
        </div>
      ) : (
        <>
          <label>
            <span>차량번호</span>
            <input
              value={request.vehicleNumber ?? ""}
              onChange={(event) => setRequest({ ...request, vehicleNumber: event.target.value })}
              placeholder="예: 123가4567"
            />
          </label>
          <label>
            <span>차대번호</span>
            <input
              value={request.vin ?? ""}
              onChange={(event) => setRequest({ ...request, vin: event.target.value })}
              placeholder="차량번호를 모를 때 확인용"
            />
          </label>
          <label>
            <span>고객명</span>
            <input
              value={request.customerName ?? ""}
              onChange={(event) => setRequest({ ...request, customerName: event.target.value })}
              placeholder="보증서 발급 대상 고객"
            />
          </label>
          <label>
            <span>고객 연락처</span>
            <input
              value={request.customerPhone ?? ""}
              onChange={(event) => setRequest({ ...request, customerPhone: event.target.value })}
              placeholder="예: 010-1234-5678"
            />
          </label>
        </>
      )}
      <div className="request-submit-area wide-field">
        <p>{ready ? "필수 정보와 시공점 선택이 완료되었습니다." : "필수 정보를 입력하고 시공점을 선택해 주세요."}</p>
        <button type="button" className="primary request-submit-button" onClick={onSummary} disabled={!ready}>
          {request.requestType} 보내기
        </button>
      </div>
    </form>
  );
}
