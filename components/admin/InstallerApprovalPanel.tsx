"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, PauseCircle, RefreshCw, XCircle } from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { membershipRepository, type InstallerApplication } from "../../repositories/membership-repository";
import { demoMembershipRepository } from "../../repositories/demo-membership-repository";
import type { InstallerApprovalStatus } from "../../types/auth";

export function InstallerApprovalPanel({ demoSession = false }: { demoSession?: boolean }) {
  // Demo Admin 3/3 gets its own isolated approval workflow (see
  // 202608030001 migration) instead of the old static placeholder — but
  // only once that migration is confirmed applied; until then this
  // degrades to the same placeholder as before, exactly like the Demo
  // transaction backend's rollout in v0.3.12.
  const [demoSchemaReady, setDemoSchemaReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (!demoSession) return;
    let active = true;
    void demoMembershipRepository.isSchemaReady().then((ready) => { if (active) setDemoSchemaReady(ready); });
    return () => { active = false; };
  }, [demoSession]);
  const useDemoBackend = demoSession && demoSchemaReady === true;
  const membershipEnabled = (isSupabaseConfigured && !demoSession) || useDemoBackend;

  const [items, setItems] = useState<InstallerApplication[]>([]); const [selected, setSelected] = useState<InstallerApplication | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(membershipEnabled);
  const load = useCallback(async () => {
    if (!membershipEnabled) return;
    setLoading(true);
    try {
      const applications = useDemoBackend ? await demoMembershipRepository.getInstallerApplications() : await membershipRepository.getInstallerApplications();
      setItems(applications);
      setSelected((current) => applications.find((item) => item.userId === current?.userId) ?? applications[0] ?? null);
      setError("");
    } catch {
      setError("시공점 가입 신청을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [membershipEnabled, useDemoBackend]);
  useEffect(() => { const frame = requestAnimationFrame(() => { void load(); }); return () => cancelAnimationFrame(frame); }, [load]);
  const review = async (status: InstallerApprovalStatus) => {
    if (!selected) return;
    const note = status === "rejected" || status === "suspended" ? prompt("처리 사유를 입력해 주세요.") ?? "" : "";
    try {
      if (useDemoBackend) await demoMembershipRepository.reviewInstaller(selected.userId, status, note);
      else await membershipRepository.reviewInstaller(selected.userId, status, note);
      await load();
    } catch {
      setError("승인 상태를 변경하지 못했습니다. 관리자 권한을 확인해 주세요.");
    }
  };
  if (!membershipEnabled) return <section className="card installer-approval-panel"><header><div><p className="eyebrow">INSTALLER MEMBERSHIP</p><h2>시공점 가입 승인</h2></div></header><div className="compact-empty"><b>{demoSession ? (demoSchemaReady === null ? "시험 관리자 화면을 확인하는 중입니다." : "시험 관리자 화면입니다.") : "DB 연결 후 사용할 수 있습니다."}</b><span>{demoSession ? (demoSchemaReady === null ? "잠시만 기다려 주세요." : "실제 서비스에서는 회원 관리자 계정으로 로그인하면 가입 심사 화면이 표시됩니다.") : "Supabase 환경변수와 마이그레이션을 적용하면 가입 신청이 표시됩니다."}</span></div></section>;
  return <section className="card installer-approval-panel"><header><div><p className="eyebrow">INSTALLER MEMBERSHIP</p><h2>시공점 가입 승인</h2></div><button onClick={() => void load()}><RefreshCw size={16} /> 새로고침</button></header>{error && <p className="admin-membership-error">{error}</p>}{loading ? <div className="compact-empty"><b>가입 신청을 불러오는 중입니다.</b></div> : items.length === 0 ? <div className="compact-empty"><b>접수된 시공점 가입 신청이 없습니다.</b></div> : <div className="installer-approval-layout"><div className="installer-application-list">{items.map((item) => <button key={item.userId} className={selected?.userId === item.userId ? "selected" : ""} onClick={() => setSelected(item)}><Building2 size={18} /><span><b>{item.shopName}</b><small>{item.businessRegistrationNumber} · {item.representativeName}</small></span><em className={`approval-${item.status}`}>{item.status}</em></button>)}</div>{selected && <aside><header><div><h3>{selected.shopName}</h3><p>{selected.email}</p></div><em className={`approval-${selected.status}`}>{selected.status}</em></header><dl><div><dt>사업자명</dt><dd>{selected.businessName}</dd></div><div><dt>사업자등록번호</dt><dd>{selected.businessRegistrationNumber}</dd></div><div><dt>대표자</dt><dd>{selected.representativeName}</dd></div><div><dt>주소</dt><dd>{selected.address} {selected.detailAddress}</dd></div><div><dt>연락처</dt><dd>{selected.phone} · {selected.contactPhone}</dd></div><div><dt>가능 작업</dt><dd>{selected.supportedServices.join(", ")}</dd></div><div><dt>취급 브랜드</dt><dd>{selected.supportedBrands.join(", ")}</dd></div></dl><div className="approval-actions"><button className="approve" onClick={() => void review("approved")}><CheckCircle2 size={16} /> 승인</button><button className="reject" onClick={() => void review("rejected")}><XCircle size={16} /> 반려</button><button className="suspend" onClick={() => void review("suspended")}><PauseCircle size={16} /> 활동 정지</button>{selected.status !== "pending" && <button onClick={() => void review("pending")}>심사 대기로 전환</button>}</div></aside>}</div>}</section>;
}
