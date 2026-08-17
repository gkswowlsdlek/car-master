"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { brands, workTypes, type Brand, type WorkType } from "../../lib/dealer-flow-data";
import { adminShopRepository, DUPLICATE_CANDIDATE_ERROR } from "../../repositories/admin-shop-repository";
import type { DuplicateShopCandidate, RegisteredShopResult } from "../../types/admin-shop";

/** Admin-only "phone-call speed" registration — no Installer Account, no
 * Shop owner, no Shop Membership, no Shop Claim. Never fabricates a
 * business registration number or representative name; those columns are
 * simply left blank until the real operator claims the Shop later. */
export function AdminQuickShopRegistrationModal({
  requestId,
  onClose,
  onRegistered,
}: {
  requestId?: string;
  onClose: () => void;
  onRegistered: (shopId: string) => void;
}) {
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedServices, setSelectedServices] = useState<WorkType[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateShopCandidate[] | null>(null);
  const [result, setResult] = useState<RegisteredShopResult | null>(null);

  const toggleService = (item: WorkType) =>
    setSelectedServices((current) => (current.includes(item) ? current.filter((v) => v !== item) : [...current, item]));
  const toggleBrand = (item: Brand) =>
    setSelectedBrands((current) => (current.includes(item) ? current.filter((v) => v !== item) : [...current, item]));

  const canSubmit = shopName.trim() && address.trim() && phone.trim();

  const submit = async (confirmDuplicate: boolean) => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const shopId = await adminShopRepository.quickRegister({
        shopName: shopName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        supportedServices: selectedServices,
        supportedBrands: selectedBrands,
        requestId,
        confirmDuplicate,
      });
      setDuplicates(null);
      setResult({
        id: shopId,
        shopName: shopName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        supportedServices: selectedServices,
        supportedBrands: selectedBrands,
      });
      onRegistered(shopId);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "";
      if (message.includes(DUPLICATE_CANDIDATE_ERROR)) {
        try {
          setDuplicates(
            await adminShopRepository.findDuplicateCandidates(phone.trim(), shopName.trim(), address.trim()),
          );
        } catch {
          setError("중복 확인에 실패했습니다.");
        }
      } else {
        setError(message || "시공점을 등록하지 못했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="stage-confirm-overlay" role="dialog" aria-modal="true" aria-label="시공점 빠른 등록">
      <div className="stage-confirm-backdrop" onClick={onClose} />
      <div className="stage-confirm-card admin-quick-shop-card">
        <button type="button" className="admin-quick-shop-close" aria-label="닫기" onClick={onClose}>
          <X size={18} />
        </button>
        {result ? (
          <>
            <h3>시공점이 등록되었습니다</h3>
            <dl className="admin-quick-shop-result">
              <div>
                <dt>업체명</dt>
                <dd>{result.shopName}</dd>
              </div>
              <div>
                <dt>주소</dt>
                <dd>{result.address}</dd>
              </div>
              <div>
                <dt>전화번호</dt>
                <dd>{result.phone}</dd>
              </div>
              <div>
                <dt>가능 작업</dt>
                <dd>
                  {result.supportedServices.length ? result.supportedServices.join(", ") : "등록된 정보가 없습니다."}
                </dd>
              </div>
              <div>
                <dt>취급 브랜드</dt>
                <dd>{result.supportedBrands.length ? result.supportedBrands.join(", ") : "등록된 정보가 없습니다."}</dd>
              </div>
              <div>
                <dt>회원 연결 여부</dt>
                <dd>미가입 시공점 · 운영자 미연결</dd>
              </div>
            </dl>
            <div className="stage-confirm-buttons">
              <button type="button" className="button button-primary" onClick={onClose}>
                {requestId ? "요청으로 돌아가기" : "닫기"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>시공점 빠른 등록</h3>
            <p>전화로 확인한 실제 업체 정보를 입력하세요. 회원 가입 없이 시공점으로 등록됩니다.</p>
            {error && <p className="login-error">{error}</p>}
            <label>
              <span>상호명</span>
              <input
                value={shopName}
                onChange={(event) => setShopName(event.target.value)}
                placeholder="예: 미사 스타힐스 시공점"
              />
            </label>
            <label>
              <span>주소</span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="예: 경기 하남시 미사대로 000"
              />
            </label>
            <label>
              <span>전화번호</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="예: 031-000-0000" />
            </label>
            <div className="admin-quick-shop-checkbox-group">
              <span>가능 작업</span>
              <div>
                {workTypes.map((item) => (
                  <label key={item} className="compact-control">
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(item)}
                      onChange={() => toggleService(item)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="admin-quick-shop-checkbox-group">
              <span>취급 브랜드</span>
              <div>
                {brands.map((item) => (
                  <label key={item} className="compact-control">
                    <input type="checkbox" checked={selectedBrands.includes(item)} onChange={() => toggleBrand(item)} />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            {duplicates && duplicates.length > 0 && (
              <div className="admin-quick-shop-duplicate-warning">
                <p>
                  <AlertTriangle size={16} /> 같은 정보의 시공점이 이미 등록되어 있습니다.
                </p>
                <ul>
                  {duplicates.map((item) => (
                    <li key={item.id}>
                      <b>{item.shopName}</b>
                      <span>
                        {item.address} · {item.phone}
                      </span>
                      <em>{item.ownershipStatus === "claimed" ? "운영자 연결됨" : "미가입 시공점"}</em>
                    </li>
                  ))}
                </ul>
                <div className="stage-confirm-buttons">
                  <button type="button" className="button button-secondary" onClick={() => setDuplicates(null)}>
                    다시 입력
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => void submit(true)}
                    disabled={submitting}
                  >
                    {submitting ? "등록 중…" : "그래도 새로 등록"}
                  </button>
                </div>
              </div>
            )}

            {!duplicates && (
              <div className="stage-confirm-buttons">
                <button type="button" className="button button-secondary" onClick={onClose}>
                  취소
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void submit(false)}
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? "등록 중…" : "등록"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
