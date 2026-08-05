"use client";

import { useState } from "react";
import { Building2, LogOut, UserRound } from "lucide-react";
import type { CurrentUser, DealerOnboardingInput, InstallerOnboardingInput } from "../../types/auth";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "../../data/legal-versions";

const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function OnboardingScreen({ user, onCompleteDealer, onCompleteInstaller, onLogout }: {
  user: CurrentUser;
  onCompleteDealer: (input: DealerOnboardingInput) => Promise<void>;
  onCompleteInstaller: (input: InstallerOnboardingInput) => Promise<void>;
  onLogout: () => void;
}) {
  const [role, setRole] = useState<"dealer" | "installer">("dealer");
  const [form, setForm] = useState<Record<string, string>>({});
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const field = (key: string, label: string, required = true, placeholder = "") => (
    <label>{label}{required && <b>*</b>}<input value={form[key] ?? ""} placeholder={placeholder} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>
  );

  const submit = async () => {
    setError("");
    if (!agreedTerms || !agreedPrivacy) return setError("이용약관과 개인정보처리방침에 모두 동의해 주세요.");
    setBusy(true);
    try {
      if (role === "dealer") {
        if (!form.name?.trim() || !form.phone?.trim()) throw new Error("이름과 연락처를 입력해 주세요.");
        await onCompleteDealer({
          name: form.name.trim(), phone: form.phone.trim(), companyName: form.companyName?.trim(), activityRegion: form.activityRegion?.trim(),
          termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION,
        });
      } else {
        const required = [form.shopName, form.representativeName, form.businessName, form.businessRegistrationNumber, form.address, form.phone, form.contactPhone];
        if (required.some((value) => !value?.trim())) throw new Error("필수 입력 항목을 모두 작성해 주세요.");
        await onCompleteInstaller({
          shopName: form.shopName.trim(), representativeName: form.representativeName.trim(), businessName: form.businessName.trim(),
          businessRegistrationNumber: form.businessRegistrationNumber.trim(), address: form.address.trim(), detailAddress: form.detailAddress?.trim(),
          phone: form.phone.trim(), contactPhone: form.contactPhone.trim(),
          supportedServices: splitList(form.supportedServices ?? ""), supportedBrands: splitList(form.supportedBrands ?? ""),
          termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION,
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "온보딩 중 오류가 발생했습니다.");
      setBusy(false);
    }
  };

  return (
    <main className="signup-page">
      <section className="signup-shell">
        <header>
          <p className="eyebrow">WELCOME TO CAR-MASTER</p>
          <h1>{user.email}님, 환영해요.</h1>
          <p>이용 유형을 선택하고 기본 정보를 입력하면 바로 시작할 수 있어요.</p>
        </header>
        <div className="signup-role-picker">
          <button className={role === "dealer" ? "active" : ""} onClick={() => setRole("dealer")}><UserRound /><span><b>딜러로 시작하기</b><small>최소 정보 입력 후 바로 딜러 워크스페이스를 이용합니다.</small></span></button>
          <button className={role === "installer" ? "active" : ""} onClick={() => setRole("installer")}><Building2 /><span><b>시공점 입점 신청</b><small>상세 정보 제출 후 관리자 승인을 기다립니다.</small></span></button>
        </div>
        <section className="signup-form card">
          <h2>{role === "dealer" ? "딜러 기본 정보" : "시공점 입점 신청 정보"}</h2>
          <div className="signup-grid">
            {role === "dealer" ? <>
              {field("name", "이름")}
              {field("phone", "휴대전화")}
              {field("companyName", "회사명", false)}
              {field("activityRegion", "기본 활동지역", false)}
            </> : <>
              {field("shopName", "시공점명")}
              {field("representativeName", "대표자명")}
              {field("businessName", "사업자명")}
              {field("businessRegistrationNumber", "사업자등록번호")}
              {field("address", "주소")}
              {field("detailAddress", "상세주소", false)}
              {field("phone", "시공점 전화번호")}
              {field("contactPhone", "담당자 연락처")}
              {field("supportedServices", "취급 가능 작업", true, "썬팅, PPF, 블랙박스")}
              {field("supportedBrands", "취급 브랜드", true, "버텍스, 솔라가드")}
            </>}
          </div>
          <div className="onboarding-consent">
            <label><input type="checkbox" checked={agreedTerms} onChange={(event) => setAgreedTerms(event.target.checked)} /><span>[필수] <a href="/terms" target="_blank" rel="noopener noreferrer">이용약관</a> 동의</span></label>
            <label><input type="checkbox" checked={agreedPrivacy} onChange={(event) => setAgreedPrivacy(event.target.checked)} /><span>[필수] <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침</a> 확인 및 개인정보 수집·이용 동의</span></label>
          </div>
          {error && <p className="signup-error">{error}</p>}
          <button className="primary signup-submit" disabled={busy} onClick={() => void submit()}>{busy ? "처리 중..." : role === "dealer" ? "딜러로 시작하기" : "입점 신청하기"}</button>
          <button type="button" className="onboarding-logout" onClick={onLogout}><LogOut size={14} /> 다른 계정으로 로그인</button>
        </section>
      </section>
    </main>
  );
}
