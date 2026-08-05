"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { PasswordField } from "./PasswordField";

/**
 * Shared authenticated password-change form — mounted in ProfileEditor
 * (Dealer/Installer) and AdminAccountScreen (Admin). One implementation so
 * there is exactly one password-change code path for every Real role.
 */
export function PasswordChangeForm({ onChangePassword }: { onChangePassword: (currentPassword: string, newPassword: string) => Promise<void> }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setError(""); setSuccess(false);
    if (!currentPassword) return setError("현재 비밀번호를 입력해 주세요.");
    if (newPassword.length < 8) return setError("새 비밀번호는 8자 이상이어야 해요.");
    if (newPassword !== confirmPassword) return setError("새 비밀번호가 일치하지 않아요.");
    setSubmitting(true);
    try {
      await onChangePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "비밀번호를 변경하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="profile-password-card shop-management-card">
      <header><LockKeyhole size={19} /><div><h2>비밀번호 변경</h2><small>주기적으로 변경하면 계정을 더 안전하게 지킬 수 있어요.</small></div></header>
      <div className="profile-password-grid">
        <PasswordField label="현재 비밀번호" autoComplete="current-password" value={currentPassword} onChange={(value) => { setCurrentPassword(value); setSuccess(false); }} />
        <PasswordField label="새 비밀번호" autoComplete="new-password" value={newPassword} onChange={(value) => { setNewPassword(value); setSuccess(false); }} placeholder="8자 이상" />
        <PasswordField label="새 비밀번호 확인" autoComplete="new-password" value={confirmPassword} onChange={(value) => { setConfirmPassword(value); setSuccess(false); }} onKeyDown={(event) => event.key === "Enter" && void submit()} />
      </div>
      {success && <p className="profile-saved">비밀번호가 변경됐어요.</p>}
      {error && <p className="login-error">{error}</p>}
      <button type="button" className="secondary" onClick={() => void submit()} disabled={submitting}>{submitting ? "변경 중..." : "비밀번호 변경"}</button>
    </section>
  );
}
