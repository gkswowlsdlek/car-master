"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Store, XCircle } from "lucide-react";
import { adminShopRepository } from "../../repositories/admin-shop-repository";
import { shopClaimRepository } from "../../repositories/shop-claim-repository";
import type { AdminShopListItem } from "../../types/admin-shop";
import type { AdminShopClaimRequest } from "../../types/shop-claim";
import {
  SHOP_CLAIM_STATUS_LABEL,
  SHOP_EXPOSURE_STATUS_LABEL,
  SHOP_OWNERSHIP_STATUS_LABEL,
} from "../../services/admin-labels";

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });

/**
 * "시공점 관리" — Shop 검색/상태 확인 + Shop Claim(업체 연결 요청) 승인/거절.
 * Both reuse existing RLS (installer_shops/shop_claim_requests already grant
 * admin full SELECT) and the existing review_shop_claim RPC — this screen
 * only wires up client access that the backend already supports; no new
 * business rule, no migration.
 */
export function AdminShopManagementScreen() {
  const [shops, setShops] = useState<AdminShopListItem[]>([]);
  const [shopQuery, setShopQuery] = useState("");
  const [shopsLoading, setShopsLoading] = useState(true);
  const [shopsError, setShopsError] = useState("");
  const [selectedShopId, setSelectedShopId] = useState("");

  const loadShops = useCallback(async (query: string) => {
    setShopsLoading(true);
    try {
      const results = await adminShopRepository.listAll(query);
      setShops(results);
      setShopsError("");
    } catch {
      setShopsError("시공점 목록을 불러오지 못했습니다.");
    } finally {
      setShopsLoading(false);
    }
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadShops("");
    });
    return () => cancelAnimationFrame(frame);
  }, [loadShops]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadShops(shopQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [shopQuery, loadShops]);
  const selectedShop = shops.find((item) => item.id === selectedShopId) ?? shops[0];

  const [claims, setClaims] = useState<AdminShopClaimRequest[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claimsError, setClaimsError] = useState("");
  const [claimActionError, setClaimActionError] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState("");

  const loadClaims = useCallback(async () => {
    setClaimsLoading(true);
    try {
      const results = await shopClaimRepository.getAllForAdmin();
      setClaims(results);
      setSelectedClaimId((current) =>
        current && results.some((item) => item.id === current) ? current : (results[0]?.id ?? ""),
      );
      setClaimsError("");
    } catch {
      setClaimsError("업체 연결 요청을 불러오지 못했습니다.");
    } finally {
      setClaimsLoading(false);
    }
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadClaims();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadClaims]);
  const selectedClaim = claims.find((item) => item.id === selectedClaimId) ?? claims[0];

  const reviewClaim = async (approve: boolean) => {
    if (!selectedClaim) return;
    if (!approve && !confirm("이 업체 연결 요청을 거절할까요?")) return;
    setClaimActionError("");
    try {
      await shopClaimRepository.review(selectedClaim.id, approve);
      await loadClaims();
      await loadShops(shopQuery);
    } catch {
      setClaimActionError("요청을 처리하지 못했습니다.");
    }
  };

  return (
    <section className="section admin-shop-management">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">SHOP MANAGEMENT</p>
          <h1>시공점 관리</h1>
          <p>등록된 시공점 상태를 확인하고, 업체 연결(Claim) 요청을 처리합니다.</p>
        </div>
      </header>

      <section id="admin-shop-list-panel" className="card admin-shop-search-request-panel">
        <header>
          <div>
            <p className="eyebrow">SHOPS</p>
            <h2>시공점 검색</h2>
          </div>
          <button onClick={() => void loadShops(shopQuery)}>
            <RefreshCw size={16} /> 새로고침
          </button>
        </header>
        <div className="admin-member-tools">
          <input
            value={shopQuery}
            onChange={(event) => setShopQuery(event.target.value)}
            placeholder="업체명, 주소, 전화번호 검색"
          />
        </div>
        {shopsError && <p className="admin-membership-error">{shopsError}</p>}
        {shopsLoading ? (
          <div className="compact-empty">
            <b>시공점 목록을 불러오는 중입니다.</b>
          </div>
        ) : shops.length === 0 ? (
          <div className="compact-empty">
            <b>조건에 맞는 시공점이 없습니다.</b>
          </div>
        ) : (
          <div className="installer-approval-layout">
            <div className="installer-application-list">
              {shops.map((item) => (
                <button
                  key={item.id}
                  className={
                    selectedShopId === item.id || (!selectedShopId && item.id === shops[0].id) ? "selected" : ""
                  }
                  onClick={() => setSelectedShopId(item.id)}
                >
                  <Store size={18} />
                  <span>
                    <b>{item.shopName}</b>
                    <small>{item.address}</small>
                  </span>
                  <em className={`approval-${item.approvalStatus}`}>
                    {SHOP_EXPOSURE_STATUS_LABEL[item.approvalStatus]}
                  </em>
                </button>
              ))}
            </div>
            {selectedShop && (
              <aside>
                <header>
                  <div>
                    <h3>{selectedShop.shopName}</h3>
                    <p>{selectedShop.phone}</p>
                  </div>
                  <em className={`approval-${selectedShop.approvalStatus}`}>
                    {SHOP_EXPOSURE_STATUS_LABEL[selectedShop.approvalStatus]}
                  </em>
                </header>
                <dl>
                  <div>
                    <dt>주소</dt>
                    <dd>{selectedShop.address}</dd>
                  </div>
                  <div>
                    <dt>전화번호</dt>
                    <dd>{selectedShop.phone}</dd>
                  </div>
                  <div>
                    <dt>가능 작업</dt>
                    <dd>{selectedShop.supportedServices.join(", ") || "-"}</dd>
                  </div>
                  <div>
                    <dt>취급 브랜드</dt>
                    <dd>{selectedShop.supportedBrands.join(", ") || "-"}</dd>
                  </div>
                  <div>
                    <dt>업체 노출 상태</dt>
                    <dd>{SHOP_EXPOSURE_STATUS_LABEL[selectedShop.approvalStatus]}</dd>
                  </div>
                  <div>
                    <dt>업체 연결 상태</dt>
                    <dd>{SHOP_OWNERSHIP_STATUS_LABEL[selectedShop.ownershipStatus]}</dd>
                  </div>
                  <div>
                    <dt>등록일</dt>
                    <dd>{dateLabel(selectedShop.createdAt)}</dd>
                  </div>
                </dl>
              </aside>
            )}
          </div>
        )}
      </section>

      <section id="admin-shop-claim-panel" className="card admin-shop-search-request-panel">
        <header>
          <div>
            <p className="eyebrow">SHOP CLAIMS</p>
            <h2>업체 연결 요청</h2>
          </div>
          <button onClick={() => void loadClaims()}>
            <RefreshCw size={16} /> 새로고침
          </button>
        </header>
        {claimsError && <p className="admin-membership-error">{claimsError}</p>}
        {claimActionError && <p className="admin-membership-error">{claimActionError}</p>}
        {claimsLoading ? (
          <div className="compact-empty">
            <b>업체 연결 요청을 불러오는 중입니다.</b>
          </div>
        ) : claims.length === 0 ? (
          <div className="compact-empty">
            <b>접수된 업체 연결 요청이 없습니다.</b>
          </div>
        ) : (
          <div className="installer-approval-layout">
            <div className="installer-application-list">
              {claims.map((item) => (
                <button
                  key={item.id}
                  className={selectedClaimId === item.id ? "selected" : ""}
                  onClick={() => setSelectedClaimId(item.id)}
                >
                  <Store size={18} />
                  <span>
                    <b>{item.shopName}</b>
                    <small>{item.requesterEmail}</small>
                  </span>
                  <em className={`approval-${item.status === "cancelled" ? "rejected" : item.status}`}>
                    {SHOP_CLAIM_STATUS_LABEL[item.status]}
                  </em>
                </button>
              ))}
            </div>
            {selectedClaim && (
              <aside>
                <header>
                  <div>
                    <h3>{selectedClaim.shopName}</h3>
                    <p>{selectedClaim.requesterEmail}</p>
                  </div>
                  <em
                    className={`approval-${selectedClaim.status === "cancelled" ? "rejected" : selectedClaim.status}`}
                  >
                    {SHOP_CLAIM_STATUS_LABEL[selectedClaim.status]}
                  </em>
                </header>
                <dl>
                  <div>
                    <dt>업체 주소</dt>
                    <dd>{selectedClaim.shopAddress || "-"}</dd>
                  </div>
                  <div>
                    <dt>업체 전화번호</dt>
                    <dd>{selectedClaim.shopPhone || "-"}</dd>
                  </div>
                  <div>
                    <dt>요청 메모</dt>
                    <dd>{selectedClaim.note || "작성된 메모가 없습니다."}</dd>
                  </div>
                  <div>
                    <dt>요청 일시</dt>
                    <dd>{dateLabel(selectedClaim.createdAt)}</dd>
                  </div>
                  {selectedClaim.reviewNote && (
                    <div>
                      <dt>처리 메모</dt>
                      <dd>{selectedClaim.reviewNote}</dd>
                    </div>
                  )}
                </dl>
                {selectedClaim.status === "pending" && (
                  <div className="approval-actions">
                    <button className="approve" onClick={() => void reviewClaim(true)}>
                      <CheckCircle2 size={16} /> 승인
                    </button>
                    <button className="reject" onClick={() => void reviewClaim(false)}>
                      <XCircle size={16} /> 거절
                    </button>
                  </div>
                )}
              </aside>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
