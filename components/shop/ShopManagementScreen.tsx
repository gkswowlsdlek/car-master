"use client";

import { useEffect, useState } from "react";
import { Building2, Clock3, Tags, Wrench } from "lucide-react";
import { isDemoAccountId } from "../../data/demo-accounts";
import { profileRepository } from "../../repositories/profile-repository";
import { shopManagementRepository, type ShopManagementRecord } from "../../repositories/shop-management-repository";
import { PasswordChangeForm } from "../auth/PasswordChangeForm";

type Props = { userId: string; onChangePassword: (currentPassword: string, newPassword: string) => Promise<void> };
type Editable = Pick<ShopManagementRecord, "shopName" | "address" | "detailAddress" | "phone" | "contactPhone" | "businessHours" | "closedDays" | "supportedBrands" | "supportedServices" | "introduction" | "acceptingRequests">;

const toEditable = (value: ShopManagementRecord): Editable => ({ shopName: value.shopName, address: value.address, detailAddress: value.detailAddress, phone: value.phone, contactPhone: value.contactPhone, businessHours: value.businessHours, closedDays: value.closedDays, supportedBrands: value.supportedBrands, supportedServices: value.supportedServices, introduction: value.introduction, acceptingRequests: value.acceptingRequests });

function demoRecord(userId: string): ShopManagementRecord | null {
  const profile = profileRepository.getById(userId);
  const fallback = { name: "미사 스타힐스 시공점", address: "경기 하남시 미사강변중앙로 180", phone: "031-000-0000", brands: ["버텍스", "솔라가드", "후퍼옵틱", "브이쿨"], works: ["썬팅", "신차검수", "PPF", "블랙박스"], hours: "평일 09:00-19:00", closedDays: "매주 일요일", introduction: "신차 패키지 전문 시공점" };
  const value = profile ?? { ...fallback, id: userId, role: "shop" as const, email: "", notifications: { request: true, chat: true, schedule: true, marketing: false } };
  return { id: userId, shopName: value.name, address: value.address ?? fallback.address, detailAddress: value.detailAddress ?? null, phone: value.phone || fallback.phone, contactPhone: value.phone || fallback.phone, businessHours: value.hours ?? fallback.hours, closedDays: value.closedDays ?? fallback.closedDays, supportedBrands: value.brands ?? fallback.brands, supportedServices: value.works ?? fallback.works, introduction: value.introduction ?? fallback.introduction, acceptingRequests: value.emergencyAvailable !== false, approvalStatus: "approved", ownershipStatus: "claimed", membershipRole: "owner", membershipStatus: "active" };
}

export function ShopManagementScreen({ userId, onChangePassword }: Props) {
  const [record, setRecord] = useState<ShopManagementRecord | null>(() => isDemoAccountId(userId) ? demoRecord(userId) : null);
  const [draft, setDraft] = useState<Editable | null>(() => record ? toEditable(record) : null);
  const [loading, setLoading] = useState(!isDemoAccountId(userId));
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const canEdit = record?.membershipStatus === "active" && (record.membershipRole === "owner" || record.membershipRole === "manager");

  useEffect(() => { if (isDemoAccountId(userId)) return; void shopManagementRepository.getForUser(userId).then((value) => { setRecord(value); setDraft(value ? toEditable(value) : null); }).catch(() => setError("시공점 운영정보를 불러오지 못했습니다.")).finally(() => setLoading(false)); }, [userId]);
  const set = <K extends keyof Editable>(key: K, value: Editable[K]) => { setMessage(""); setDraft((current) => current ? { ...current, [key]: value } : current); };
  const text = (key: Exclude<keyof Editable, "supportedBrands" | "supportedServices" | "acceptingRequests">, label: string, multiline = false) => <label className={multiline ? "wide-field" : ""}><span>{label}</span>{multiline ? <textarea value={String(draft?.[key] ?? "")} disabled={!canEdit} onChange={(event) => set(key, event.target.value as Editable[typeof key])} /> : <input value={String(draft?.[key] ?? "")} disabled={!canEdit} onChange={(event) => set(key, event.target.value as Editable[typeof key])} />}</label>;
  const list = (key: "supportedBrands" | "supportedServices", label: string) => <label><span>{label}</span><input value={(draft?.[key] ?? []).join(", ")} disabled={!canEdit} onChange={(event) => set(key, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder="쉼표로 구분" /></label>;
  const save = async () => { if (!draft || !record || !canEdit) return; setSaving(true); setError(""); setMessage(""); try { if (isDemoAccountId(userId)) { const current = profileRepository.getById(userId); if (current) profileRepository.save({ ...current, name: draft.shopName, address: draft.address, detailAddress: draft.detailAddress ?? undefined, phone: draft.phone, hours: draft.businessHours ?? undefined, closedDays: draft.closedDays ?? undefined, brands: draft.supportedBrands, works: draft.supportedServices, introduction: draft.introduction ?? undefined, emergencyAvailable: draft.acceptingRequests }); setRecord({ ...record, ...draft }); setMessage("Demo 운영정보를 저장했습니다."); } else { const updated = await shopManagementRepository.updateOperatingProfile(record.id, draft); setRecord({ ...record, ...updated, membershipRole: record.membershipRole, membershipStatus: record.membershipStatus }); setDraft(toEditable({ ...record, ...updated })); setMessage("운영정보를 저장했습니다."); } } catch { setError("운영정보 저장 기능을 사용할 수 없습니다. 관리자에게 문의해 주세요."); } finally { setSaving(false); } };
  if (loading) return <section className="shop-management-screen"><div className="empty-state"><h2>운영정보를 불러오는 중입니다.</h2></div></section>;
  if (!record || !draft) return <section className="shop-management-screen"><div className="empty-state"><h2>연결된 시공점 정보를 찾을 수 없습니다.</h2><p>활성 시공점 소속이 확인된 뒤 운영정보를 관리할 수 있습니다.</p></div></section>;
  return <section className="shop-management-screen"><header className="page-title"><div><p className="eyebrow">시공점 운영</p><h1>시공점 관리</h1><p className="page-subtitle">고객에게 노출되는 시공점 운영정보를 관리하세요.</p></div><div className={`shop-operation-status ${draft.acceptingRequests ? "open" : "paused"}`}><span>{draft.acceptingRequests ? "요청 받는 중" : "요청 일시 중지"}</span><button className="secondary" disabled={!canEdit} onClick={() => set("acceptingRequests", !draft.acceptingRequests)}>{draft.acceptingRequests ? "요청 잠시 중지" : "요청 다시 받기"}</button></div></header>
    <div className="shop-management-status-strip"><span>운영 상태</span><b>{record.approvalStatus === "approved" ? "승인된 시공점" : "승인 상태 확인 필요"}</b><span>소속 권한</span><b>{record.membershipRole === "owner" ? "Owner" : record.membershipRole === "manager" ? "Manager" : record.membershipRole === "staff" ? "Staff" : "확인 필요"}</b>{!canEdit && <em>현재 계정은 읽기 전용입니다.</em>}</div>
    {message && <p className="profile-saved">{message}</p>}{error && <p className="login-error">{error}</p>}
    <div className="shop-management-sections"><section className="shop-management-card"><header><Building2 size={19} /><div><h2>기본 정보</h2><small>시공점명과 고객 연락처</small></div></header><div className="shop-management-fields">{text("shopName", "시공점명")}{text("address", "주소")}{text("detailAddress", "상세주소")}{text("phone", "대표 전화번호")}{text("contactPhone", "업무 연락처")}{text("introduction", "소개", true)}</div></section><section className="shop-management-card"><header><Clock3 size={19} /><div><h2>운영 정보</h2><small>영업시간과 휴무일</small></div></header><div className="shop-management-fields">{text("businessHours", "영업시간")}{text("closedDays", "휴무일")}</div></section><section className="shop-management-card"><header><Tags size={19} /><div><h2>취급 브랜드</h2><small>고객에게 안내되는 브랜드</small></div></header><div className="shop-management-fields">{list("supportedBrands", "취급 브랜드")}</div></section><section className="shop-management-card"><header><Wrench size={19} /><div><h2>가능 작업</h2><small>실제 요청 가능한 작업</small></div></header><div className="shop-management-fields">{list("supportedServices", "가능 작업")}</div></section></div>
    <div className="shop-management-actions">{!canEdit && <p>owner 또는 manager 권한이 있는 활성 소속만 운영정보를 수정할 수 있습니다.</p>}<button className="primary" disabled={!canEdit || saving} onClick={() => void save()}>{saving ? "저장 중..." : "변경사항 저장"}</button></div>
    <PasswordChangeForm onChangePassword={onChangePassword} />
  </section>;
}
