import { Clock3, LogOut, ShieldAlert, Store } from "lucide-react";
import type { CurrentUser } from "../../types/auth";
import { InstallerRegistrationEditor } from "./InstallerRegistrationEditor";

export function AccountStatusScreen({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const status = user.approvalStatus ?? "pending";
  const content = status === "rejected" ? { icon: ShieldAlert, eyebrow: "APPLICATION REJECTED", title: "시공점 등록이 반려되었습니다.", description: "등록 정보를 확인한 뒤 운영팀에 재심사를 요청해 주세요." } : status === "suspended" ? { icon: ShieldAlert, eyebrow: "ACCOUNT SUSPENDED", title: "시공점 활동이 정지되었습니다.", description: "현재 시공 요청을 받을 수 없습니다. 자세한 사유는 운영팀에 문의해 주세요." } : { icon: Clock3, eyebrow: "UNDER REVIEW", title: "시공점 등록 심사 중입니다.", description: "제출하신 사업자와 시공점 정보를 확인하고 있습니다. 승인이 완료되면 시공 요청을 받을 수 있습니다." };
  return <main className="account-status-page"><div className="account-status-shell"><section className="account-status-card card"><span><content.icon size={30} /></span><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.description}</p><div className="account-status-profile"><Store size={20} /><div><b>{user.name}</b><small>{user.email}</small></div><em>{status}</em></div><p className="status-help">승인 관련 문의: help@car-master.kr</p><button className="secondary" onClick={onLogout}><LogOut size={17} /> 로그아웃</button></section><InstallerRegistrationEditor /></div></main>;
}
