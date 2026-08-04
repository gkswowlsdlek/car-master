"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Users } from "lucide-react";
import { membershipRepository, type AdminMember } from "../../repositories/membership-repository";
import { demoMembershipRepository } from "../../repositories/demo-membership-repository";

type RoleFilter = "전체" | "dealer" | "installer";
type ApprovalFilter = "전체" | InstallerApprovalStatusValue;
type InstallerApprovalStatusValue = "pending" | "approved" | "rejected" | "suspended";

const roleLabel: Record<AdminMember["role"], string> = { dealer: "Dealer", installer: "Installer" };
const approvalLabel: Record<InstallerApprovalStatusValue, string> = { pending: "승인 대기", approved: "승인", rejected: "거절", suspended: "정지" };

export function AdminMemberPanel({ demoSession = false }: { demoSession?: boolean }) {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("전체");
  const [approval, setApproval] = useState<ApprovalFilter>("전체");
  const [selectedId, setSelectedId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = demoSession ? await demoMembershipRepository.getAllMembers() : await membershipRepository.getAllMembers();
      setMembers(rows);
      setError("");
    } catch {
      setError("회원 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [demoSession]);

  useEffect(() => { const frame = requestAnimationFrame(() => { void load(); }); return () => cancelAnimationFrame(frame); }, [load]);

  const visible = useMemo(() => members
    .filter((item) => role === "전체" || item.role === role)
    .filter((item) => approval === "전체" || item.approvalStatus === approval)
    .filter((item) => `${item.name} ${item.companyName} ${item.email}`.toLowerCase().includes(query.trim().toLowerCase())),
    [members, query, role, approval]);
  const selected = visible.find((item) => item.userId === selectedId);

  const dealerCount = members.filter((item) => item.role === "dealer").length;
  const installerCount = members.filter((item) => item.role === "installer").length;
  const pendingCount = members.filter((item) => item.approvalStatus === "pending").length;

  return <section className="card admin-member-panel">
    <header><div><p className="eyebrow">MEMBER DIRECTORY</p><h2>회원 관리</h2><p>가입한 Dealer와 Installer를 한눈에 확인합니다.</p></div></header>
    <div className="transaction-summary-strip admin-member-summary">
      <button type="button" className={role === "전체" ? "active" : ""} onClick={() => setRole("전체")}><span>전체 회원</span><b>{members.length}</b></button>
      <button type="button" className={role === "dealer" ? "active" : ""} onClick={() => setRole("dealer")}><span>Dealer</span><b>{dealerCount}</b></button>
      <button type="button" className={role === "installer" ? "active" : ""} onClick={() => setRole("installer")}><span>Installer</span><b>{installerCount}</b></button>
      <button type="button" className={approval === "pending" ? "active" : ""} onClick={() => { setRole("installer"); setApproval("pending"); }}><span>승인 대기</span><b>{pendingCount}</b></button>
    </div>
    <div className="admin-member-tools">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 업체명, 이메일 검색" />
      <select value={role} onChange={(event) => setRole(event.target.value as RoleFilter)}>
        <option value="전체">전체 역할</option><option value="dealer">Dealer</option><option value="installer">Installer</option>
      </select>
      <select value={approval} onChange={(event) => setApproval(event.target.value as ApprovalFilter)}>
        <option value="전체">전체 승인상태</option><option value="pending">승인 대기</option><option value="approved">승인</option><option value="rejected">거절</option><option value="suspended">정지</option>
      </select>
    </div>
    {error && <p className="admin-membership-error">{error}</p>}
    {loading ? <div className="compact-empty"><b>회원 목록을 불러오는 중입니다.</b></div>
      : visible.length === 0 ? <div className="compact-empty"><b>조건에 맞는 회원이 없습니다.</b><span>검색어 또는 필터를 변경해 주세요.</span></div>
      : <div className="admin-member-layout">
          <div className="admin-member-list">
            {visible.map((item) => <button key={item.userId} className={selected?.userId === item.userId ? "selected" : ""} onClick={() => setSelectedId((current) => current === item.userId ? "" : item.userId)}>
              {item.role === "dealer" ? <Users size={18} /> : <Building2 size={18} />}
              <span><b>{item.companyName}</b><small>{item.name} · {item.email || "이메일 없음"}</small></span>
              <span className="admin-member-badges"><em className={`member-role-badge role-${item.role}`}>{roleLabel[item.role]}</em>{item.approvalStatus && <em className={`approval-${item.approvalStatus}`}>{approvalLabel[item.approvalStatus]}</em>}</span>
            </button>)}
          </div>
          {selected && <aside>
            <header><div><h3>{selected.companyName}</h3><p>{selected.name}</p></div><em className={`member-role-badge role-${selected.role}`}>{roleLabel[selected.role]}</em></header>
            <dl>
              <div><dt>이메일</dt><dd>{selected.email || "-"}</dd></div>
              <div><dt>전화번호</dt><dd>{selected.phone || "-"}</dd></div>
              <div><dt>가입일</dt><dd>{selected.createdAt ? new Date(selected.createdAt).toLocaleDateString("ko-KR") : "-"}</dd></div>
              {selected.approvalStatus && <div><dt>승인 상태</dt><dd><em className={`approval-${selected.approvalStatus}`}>{approvalLabel[selected.approvalStatus]}</em></dd></div>}
            </dl>
            {selected.role === "installer" && selected.approvalStatus !== "approved" && <p className="admin-member-hint">승인/거절 처리는 아래 <a href="#installer-approval-panel">시공점 가입 승인</a> 패널에서 진행할 수 있습니다.</p>}
          </aside>}
        </div>}
  </section>;
}
