"use client";

import { useEffect, useState } from "react";
import { membershipRepository, type InstallerApplication } from "../../repositories/membership-repository";

export function InstallerRegistrationEditor() {
  const [value, setValue] = useState<InstallerApplication | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(true);
  useEffect(() => { const frame = requestAnimationFrame(() => { void membershipRepository.getCurrentInstallerApplication().then(setValue).catch(() => setMessage("등록 정보를 불러오지 못했습니다.")).finally(() => setBusy(false)); }); return () => cancelAnimationFrame(frame); }, []);
  if (busy) return <div className="compact-empty"><b>등록 정보를 불러오는 중입니다.</b></div>;
  if (!value) return <div className="compact-empty"><b>등록 정보를 찾지 못했습니다.</b></div>;
  const field = (key: keyof InstallerApplication, label: string) => <label>{label}<input value={String(value[key] ?? "")} onChange={(event) => setValue({ ...value, [key]: event.target.value })} /></label>;
  const listField = (key: "supportedServices" | "supportedBrands", label: string) => <label>{label}<input value={value[key].join(", ")} onChange={(event) => setValue({ ...value, [key]: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>;
  const save = async () => { setMessage(""); try { await membershipRepository.updateInstallerApplication(value); setMessage("등록 정보를 수정했습니다. 변경된 정보로 심사가 진행됩니다."); } catch { setMessage("등록 정보를 저장하지 못했습니다."); } };
  return <section className="installer-registration-editor card"><h2>제출한 시공점 정보</h2><p>심사 중에도 사업자와 시공점 정보를 수정할 수 있습니다.</p><div>{field("shopName", "시공점명")}{field("representativeName", "대표자명")}{field("businessName", "사업자명")}{field("businessRegistrationNumber", "사업자등록번호")}{field("address", "주소")}{field("detailAddress", "상세주소")}{field("phone", "전화번호")}{field("contactPhone", "담당자 연락처")}{listField("supportedServices", "취급 가능 작업")}{listField("supportedBrands", "취급 브랜드")}</div>{message && <p className="registration-message">{message}</p>}<button className="primary" onClick={() => void save()}>등록 정보 저장</button></section>;
}
