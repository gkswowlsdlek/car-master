"use client";

import { useState } from "react";
import { Search, Store, X } from "lucide-react";
import { adminShopRepository } from "../../repositories/admin-shop-repository";
import { shopSearchRequestRepository } from "../../repositories/shop-search-request-repository";
import type { SearchableShop } from "../../types/admin-shop";

/** Admin proposes exactly one Shop for a Dealer's Phase 2 request — no
 * multi-shop comparison UI this phase. registeredShopId (if the Admin just
 * quick-registered one for this same request) gets a one-click shortcut;
 * the search box covers proposing any other existing approved Shop. */
export function AdminProposeShopModal({ requestId, registeredShopId, onClose, onProposed }: {
  requestId: string;
  registeredShopId?: string;
  onClose: () => void;
  onProposed: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchableShop[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const search = async () => {
    setSearching(true);
    setError("");
    try {
      setResults(await adminShopRepository.searchShops(query.trim()));
    } catch {
      setError("시공점을 검색하지 못했습니다.");
    } finally {
      setSearching(false);
    }
  };

  const propose = async (shopId: string) => {
    if (submittingId) return;
    setSubmittingId(shopId);
    setError("");
    try {
      await shopSearchRequestRepository.proposeShop(requestId, shopId);
      onProposed();
      onClose();
    } catch (proposeError) {
      setError(proposeError instanceof Error ? proposeError.message : "시공점을 제안하지 못했습니다.");
      setSubmittingId(null);
    }
  };

  return <div className="stage-confirm-overlay" role="dialog" aria-modal="true" aria-label="Dealer에게 시공점 제안">
    <div className="stage-confirm-backdrop" onClick={onClose} />
    <div className="stage-confirm-card admin-quick-shop-card">
      <button type="button" className="admin-quick-shop-close" aria-label="닫기" onClick={onClose}><X size={18} /></button>
      <h3>Dealer에게 시공점 제안</h3>
      <p>이 요청의 Dealer에게 제안할 시공점 1곳을 선택하세요.</p>
      {error && <p className="login-error">{error}</p>}

      {registeredShopId && <button type="button" className="button button-primary admin-propose-quick-pick" onClick={() => void propose(registeredShopId)} disabled={submittingId === registeredShopId}>
        <Store size={16} /> {submittingId === registeredShopId ? "제안 중…" : "방금 등록한 시공점 제안"}
      </button>}

      <div className="shop-search-request-form-row admin-propose-search-row">
        <label><span>시공점 검색 (상호명 / 주소 / 전화번호)</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="예: 미사 스타힐스" /></label>
        <button type="button" className="button button-secondary" onClick={() => void search()} disabled={searching}><Search size={16} /> 검색</button>
      </div>

      {results && (results.length === 0 ? <p className="compact-empty-note">검색 결과가 없습니다.</p> : <ul className="admin-propose-results">
        {results.map((shop) => <li key={shop.id}>
          <div><b>{shop.shopName}</b><span>{shop.address} · {shop.phone}</span>{shop.supportedServices.length > 0 && <em>{shop.supportedServices.join(", ")}</em>}</div>
          <button type="button" className="button button-secondary" onClick={() => void propose(shop.id)} disabled={submittingId === shop.id}>{submittingId === shop.id ? "제안 중…" : "이 시공점 제안"}</button>
        </li>)}
      </ul>)}
    </div>
  </div>;
}
