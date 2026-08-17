"use client";

import { PasswordChangeForm } from "../auth/PasswordChangeForm";

export function AdminAccountScreen({
  demoSession = false,
  onChangePassword,
}: {
  demoSession?: boolean;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  return (
    <section className="section admin-account-screen">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>계정</h1>
          <p>관리자 계정의 비밀번호를 관리합니다.</p>
        </div>
      </header>
      {demoSession ? (
        <div className="compact-empty">
          <b>시험 관리자 화면입니다.</b>
          <span>Demo 계정에서는 비밀번호를 변경하지 않아요.</span>
        </div>
      ) : (
        <PasswordChangeForm onChangePassword={onChangePassword} />
      )}
    </section>
  );
}
