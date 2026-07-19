"use client";

import { useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, UserRound } from "lucide-react";
import type { SignUpInput, SignUpResult } from "../../types/auth";

const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function SignUpScreen({ onBack, onSignUp }: { onBack: () => void; onSignUp: (input: SignUpInput) => Promise<SignUpResult> }) {
  const [role, setRole] = useState<"dealer" | "installer">("dealer");
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [complete, setComplete] = useState(false);
  const field = (key: string, label: string, required = true, type = "text", placeholder = "") => <label>{label}{required && <b>*</b>}<input type={type} required={required} value={form[key] ?? ""} placeholder={placeholder} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>;
  const submit = async () => {
    setError("");
    if (!form.email || !form.password || form.password.length < 8) return setError("이메일과 8자 이상의 비밀번호를 확인해 주세요.");
    const input: SignUpInput = role === "dealer" ? { role, email: form.email, password: form.password, name: form.name ?? "", phone: form.phone ?? "", companyName: form.companyName, activityRegion: form.activityRegion } : { role, email: form.email, password: form.password, shopName: form.shopName ?? "", representativeName: form.representativeName ?? "", businessName: form.businessName ?? "", businessRegistrationNumber: form.businessRegistrationNumber ?? "", address: form.address ?? "", detailAddress: form.detailAddress, phone: form.phone ?? "", contactPhone: form.contactPhone ?? "", supportedServices: splitList(form.supportedServices ?? ""), supportedBrands: splitList(form.supportedBrands ?? "") };
    const required = input.role === "dealer" ? [input.name, input.phone] : [input.shopName, input.representativeName, input.businessName, input.businessRegistrationNumber, input.address, input.phone, input.contactPhone];
    if (required.some((value) => !value.trim())) return setError("필수 입력 항목을 모두 작성해 주세요.");
    setBusy(true);
    try { const result = await onSignUp(input); if (result.requiresEmailConfirmation) setComplete(true); } catch (cause) { setError(cause instanceof Error ? cause.message : "회원가입 중 오류가 발생했습니다."); } finally { setBusy(false); }
  };
  if (complete) return <main className="signup-page"><section className="signup-complete card"><CheckCircle2 size={38} /><p className="eyebrow">EMAIL CONFIRMATION</p><h1>가입 확인 메일을 보내드렸습니다.</h1><p>이메일의 인증 링크를 누른 뒤 로그인해 주세요. 시공점 회원은 이메일 확인 후 관리자 심사가 진행됩니다.</p><button className="primary" onClick={onBack}>로그인으로 이동</button></section></main>;
  return <main className="signup-page"><section className="signup-shell"><header><button onClick={onBack}><ArrowLeft size={18} /> 로그인으로</button><p className="eyebrow">CREATE WORKSPACE ACCOUNT</p><h1>카마스터 회원가입</h1><p>업무 유형을 선택하고 실제 워크스페이스 계정을 만드세요.</p></header><div className="signup-role-picker"><button className={role === "dealer" ? "active" : ""} onClick={() => setRole("dealer")}><UserRound /><span><b>딜러로 가입</b><small>가입 후 바로 딜러 워크스페이스를 이용합니다.</small></span></button><button className={role === "installer" ? "active" : ""} onClick={() => setRole("installer")}><Building2 /><span><b>시공점으로 가입</b><small>정보 제출 후 관리자 승인을 기다립니다.</small></span></button></div><section className="signup-form card"><h2>{role === "dealer" ? "딜러 기본 정보" : "시공점 등록 신청"}</h2><div className="signup-grid">{field("email", "이메일", true, "email", "name@company.com")}{field("password", "비밀번호", true, "password", "8자 이상")}{role === "dealer" ? <>{field("name", "이름")}{field("phone", "휴대전화")}{field("companyName", "회사명", false)}{field("activityRegion", "기본 활동지역", false)}</> : <>{field("shopName", "시공점명")}{field("representativeName", "대표자명")}{field("businessName", "사업자명")}{field("businessRegistrationNumber", "사업자등록번호")}{field("address", "주소")}{field("detailAddress", "상세주소", false)}{field("phone", "시공점 전화번호")}{field("contactPhone", "담당자 연락처")}{field("supportedServices", "취급 가능 작업", true, "text", "썬팅, PPF, 블랙박스")}{field("supportedBrands", "취급 브랜드", true, "text", "버텍스, 솔라가드")}</>}</div>{error && <p className="signup-error">{error}</p>}<button className="primary signup-submit" disabled={busy} onClick={() => void submit()}>{busy ? "가입 처리 중..." : role === "dealer" ? "딜러 계정 만들기" : "시공점 가입 신청하기"}</button><p className="signup-policy">관리자 계정은 회원가입으로 생성할 수 없습니다.</p></section></section></main>;
}
