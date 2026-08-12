"use client";

import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { shopSearchRequestRepository } from "../../repositories/shop-search-request-repository";
import type { ShopSearchRequest } from "../../types/shop-search-request";

export const SHOP_SEARCH_REQUEST_STATUS_LABEL: Record<ShopSearchRequest["status"], string> = {
  requested: "요청 접수", in_progress: "카마스터 확인 중", cancelled: "취소됨", unable_to_connect: "연결 어려움",
};

const dateLabel = (value: string) => new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

/** Only shown in Real (Supabase) mode — this is real, stored data, not a demo/local placeholder. */
export function ShopSearchRequestScreen({ initialFormOpen = false }: { initialFormOpen?: boolean }) {
  const [requests, setRequests] = useState<ShopSearchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(initialFormOpen);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [region, setRegion] = useState("");
  const [workType, setWorkType] = useState("썬팅");
  const [vehicleMaker, setVehicleMaker] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [desiredInboundDate, setDesiredInboundDate] = useState("");
  const [dateFlexible, setDateFlexible] = useState(false);
  const [dealerNote, setDealerNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRequests(await shopSearchRequestRepository.getMine());
      setLoadError("");
    } catch {
      setLoadError("요청 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { const frame = requestAnimationFrame(() => { void load(); }); return () => cancelAnimationFrame(frame); }, []);

  const resetForm = () => {
    setRegion(""); setWorkType("썬팅"); setVehicleMaker(""); setVehicleModel("");
    setDesiredInboundDate(""); setDateFlexible(false); setDealerNote(""); setSubmitError("");
  };

  const submit = async () => {
    if (!region.trim() || !vehicleMaker.trim() || !vehicleModel.trim() || !desiredInboundDate || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await shopSearchRequestRepository.create({
        region: region.trim(), workType, vehicleMaker: vehicleMaker.trim(), vehicleModel: vehicleModel.trim(),
        desiredInboundDate, dateFlexible, dealerNote: dealerNote.trim() || undefined,
      });
      resetForm();
      setFormOpen(false);
      await load();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm("이 시공점 찾기 요청을 취소할까요?")) return;
    try {
      await shopSearchRequestRepository.cancel(id);
      await load();
    } catch {
      setLoadError("요청을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  return <section className="shop-search-request-screen">
    <div className="page-title"><div><p className="eyebrow">SHOP SEARCH REQUEST</p><h1>시공점 찾기 요청</h1><p className="page-subtitle">원하는 시공점을 찾지 못하셨나요? 카마스터가 직접 확인해드릴게요.</p></div>
      {!formOpen && <button className="primary" onClick={() => setFormOpen(true)}><Plus size={16} /> 시공점 찾기 요청</button>}</div>

    {formOpen && <div className="card shop-search-request-form">
      <h2>새 요청 작성</h2>
      {submitError && <p className="login-error">{submitError}</p>}
      <label><span>지역</span><input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="예: 서울 강남구" /></label>
      <label><span>작업 종류</span><select value={workType} onChange={(event) => setWorkType(event.target.value)}><option>썬팅</option><option>PPF</option><option>블랙박스</option><option>유리막</option><option>기타</option></select></label>
      <div className="shop-search-request-form-row">
        <label><span>제조사</span><input value={vehicleMaker} onChange={(event) => setVehicleMaker(event.target.value)} placeholder="예: 현대" /></label>
        <label><span>모델</span><input value={vehicleModel} onChange={(event) => setVehicleModel(event.target.value)} placeholder="예: 그랜저" /></label>
      </div>
      <label><span>희망 입고일</span><input type="date" value={desiredInboundDate} onChange={(event) => setDesiredInboundDate(event.target.value)} /></label>
      <label className="compact-control"><input type="checkbox" checked={dateFlexible} onChange={(event) => setDateFlexible(event.target.checked)} /><span>날짜 조정 가능해요</span></label>
      <label><span>추가 메모 (선택)</span><textarea value={dealerNote} onChange={(event) => setDealerNote(event.target.value)} placeholder="시공점에 전달하고 싶은 내용이 있다면 남겨 주세요." rows={3} /></label>
      <div className="shop-search-request-form-actions">
        <button className="button button-secondary" onClick={() => { setFormOpen(false); resetForm(); }}>취소</button>
        <button className="button button-primary" onClick={() => void submit()} disabled={submitting || !region.trim() || !vehicleMaker.trim() || !vehicleModel.trim() || !desiredInboundDate}>{submitting ? "요청 중…" : "요청 보내기"}</button>
      </div>
    </div>}

    {loadError && <p className="login-error">{loadError}</p>}
    {loading ? <div className="compact-empty"><b>요청 목록을 불러오는 중입니다.</b></div>
      : requests.length === 0 ? <section className="empty-state"><span><Search size={22} /></span><h2>아직 시공점 찾기 요청이 없습니다.</h2><p>원하는 시공점을 찾지 못했을 때 카마스터에게 직접 요청해 보세요.</p></section>
      : <ul className="shop-search-request-list">{requests.map((item) => <li key={item.id} className={`status-${item.status}`}>
          <div><b>{item.vehicleMaker} {item.vehicleModel} · {item.workType}</b><span>{item.region} · 희망 입고일 {dateLabel(item.desiredInboundDate)}{item.dateFlexible && " (날짜 조정 가능)"}</span>{item.dealerNote && <em>{item.dealerNote}</em>}</div>
          <div className="shop-search-request-list-meta"><em className={`status-chip status-${item.status}`}>{SHOP_SEARCH_REQUEST_STATUS_LABEL[item.status]}</em><small>{dateLabel(item.createdAt)} 요청</small>{(item.status === "requested" || item.status === "in_progress") && <button className="button button-secondary" onClick={() => void cancel(item.id)}>요청 취소</button>}</div>
        </li>)}</ul>}
  </section>;
}
