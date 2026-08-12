"use client";

import { useCallback, useEffect, useState } from "react";
import { PlayCircle, RefreshCw, Search, XCircle } from "lucide-react";
import { shopSearchRequestRepository } from "../../repositories/shop-search-request-repository";
import type { AdminShopSearchRequest } from "../../types/shop-search-request";
import { SHOP_SEARCH_REQUEST_STATUS_LABEL } from "../dealer/ShopSearchRequestScreen";

const dateLabel = (value: string) => new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });

/** Admin-only — "카마스터가 사람이 직접 메우는" 초기 공급 부족 대응 Core Flow.
 * Not a general customer-support ticket panel; scope stays to intake +
 * status + an operational memo (no CRM, no call log). */
export function AdminShopSearchRequestPanel({ demoSession = false }: { demoSession?: boolean }) {
  const [items, setItems] = useState<AdminShopSearchRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [loading, setLoading] = useState(!demoSession);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    if (demoSession) return;
    setLoading(true);
    try {
      const requests = await shopSearchRequestRepository.getAllForAdmin();
      setItems(requests);
      setSelectedId((current) => (current && requests.some((item) => item.id === current) ? current : requests[0]?.id ?? null));
      setError("");
    } catch {
      setError("시공점 찾기 요청을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [demoSession]);
  useEffect(() => { const frame = requestAnimationFrame(() => { void load(); }); return () => cancelAnimationFrame(frame); }, [load]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  // Reset the note draft synchronously during render when the selected
  // request changes, instead of in an effect (React's documented pattern
  // for "reset state when a prop changes").
  const [lastNoteRequestId, setLastNoteRequestId] = useState<string | null>(null);
  if ((selected?.id ?? null) !== lastNoteRequestId) {
    setLastNoteRequestId(selected?.id ?? null);
    setNoteDraft(selected?.adminNote ?? "");
  }

  const startProcessing = async (id: string) => {
    setActionError("");
    try { await shopSearchRequestRepository.startProcessing(id); await load(); }
    catch { setActionError("확인 시작 처리를 하지 못했습니다."); }
  };
  const markUnable = async (id: string) => {
    if (!confirm("이 요청을 연결 어려움으로 처리할까요?")) return;
    setActionError("");
    try { await shopSearchRequestRepository.markUnableToConnect(id); await load(); }
    catch { setActionError("상태를 변경하지 못했습니다."); }
  };
  const saveNote = async () => {
    if (!selected) return;
    setActionError("");
    try { await shopSearchRequestRepository.setAdminNote(selected.id, noteDraft); await load(); }
    catch { setActionError("운영 메모를 저장하지 못했습니다."); }
  };

  return <section id="admin-shop-search-request-panel" className="card admin-shop-search-request-panel">
    <header><div><p className="eyebrow">SHOP SEARCH REQUESTS</p><h2>시공점 찾기 요청</h2></div><button onClick={() => void load()}><RefreshCw size={16} /> 새로고침</button></header>
    {error && <p className="admin-membership-error">{error}</p>}
    {actionError && <p className="admin-membership-error">{actionError}</p>}
    {loading ? <div className="compact-empty"><b>요청을 불러오는 중입니다.</b></div>
      : items.length === 0 ? <div className="compact-empty"><b>접수된 시공점 찾기 요청이 없습니다.</b></div>
      : <div className="installer-approval-layout">
        <div className="installer-application-list">{items.map((item) => <button key={item.id} className={selectedId === item.id ? "selected" : ""} onClick={() => setSelectedId(item.id)}>
          <Search size={18} />
          <span><b>{item.vehicleMaker} {item.vehicleModel} · {item.workType}</b><small>{item.dealerName} · {item.region}</small></span>
          <em className={`shop-search-request-status-${item.status}`}>{SHOP_SEARCH_REQUEST_STATUS_LABEL[item.status]}</em>
        </button>)}</div>
        {selected && <aside>
          <header><div><h3>{selected.dealerName}</h3><p>{selected.dealerPhone}</p></div><em className={`shop-search-request-status-${selected.status}`}>{SHOP_SEARCH_REQUEST_STATUS_LABEL[selected.status]}</em></header>
          <dl>
            <div><dt>지역</dt><dd>{selected.region}</dd></div>
            <div><dt>작업 종류</dt><dd>{selected.workType}</dd></div>
            <div><dt>차종</dt><dd>{selected.vehicleMaker} {selected.vehicleModel}</dd></div>
            <div><dt>희망 입고일</dt><dd>{dateLabel(selected.desiredInboundDate)}</dd></div>
            <div><dt>날짜 조정 가능 여부</dt><dd>{selected.dateFlexible ? "가능" : "불가"}</dd></div>
            <div><dt>딜러 메모</dt><dd>{selected.dealerNote || "작성된 메모가 없습니다."}</dd></div>
            <div><dt>요청 일시</dt><dd>{dateLabel(selected.createdAt)}</dd></div>
          </dl>
          <div className="approval-actions">
            {selected.status === "requested" && <button className="approve" onClick={() => void startProcessing(selected.id)}><PlayCircle size={16} /> 확인 시작</button>}
            {(selected.status === "requested" || selected.status === "in_progress") && <button className="reject" onClick={() => void markUnable(selected.id)}><XCircle size={16} /> 연결 어려움</button>}
          </div>
          <div className="admin-note-field">
            <label htmlFor="shop-search-request-admin-note">운영 메모 (Dealer에게 노출되지 않음)</label>
            <textarea id="shop-search-request-admin-note" rows={3} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="예: 미사 A업체 전화 안 받음" />
            <button className="button button-secondary" onClick={() => void saveNote()}>메모 저장</button>
          </div>
        </aside>}
      </div>}
    {demoSession && <p className="compact-empty-note">Demo 세션에서는 실제 Supabase 계정으로 로그인해야 이 패널이 실제 데이터를 표시합니다.</p>}
  </section>;
}
