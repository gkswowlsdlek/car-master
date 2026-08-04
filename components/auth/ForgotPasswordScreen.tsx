"use client";

import { useState } from "react";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react";

export function ForgotPasswordScreen({ onRequestReset, onBack }: { onRequestReset: (email: string) => Promise<void>; onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("올바른 이메일 주소를 입력해 주세요.");
    setSubmitting(true);
    try {
      await onRequestReset(email);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "재설정 이메일을 보내지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-ad-page">
      <div className="auth-standalone-layout">
        <section className="login-card compact-login-card">
          <button type="button" className="auth-back-link" onClick={onBack}><ArrowLeft size={16} /> 로그인으로</button>
          <div className="login-card-icon"><LockKeyhole size={21} /></div>
          <h2>비밀번호 재설정</h2>
          {sent ? <>
            <p className="login-note">입력하신 이메일이 가입된 계정이라면 비밀번호 재설정 안내를 보내드렸어요.</p>
            <p className="login-note">이메일의 안내에 따라 새 비밀번호를 설정해 주세요.</p>
            <button type="button" className="primary full" onClick={onBack}>로그인으로 돌아가기</button>
          </> : <>
            <p className="login-note">가입한 이메일을 입력해주세요.</p>
            <label>이메일<span className="login-input-wrap"><Mail size={17} /><input type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void submit()} placeholder="name@company.com" /></span></label>
            {error && <p className="login-error">{error}</p>}
            <button type="button" className="primary full" onClick={() => void submit()} disabled={submitting} aria-busy={submitting}>{submitting ? "전송 중..." : "재설정 이메일 보내기"}</button>
          </>}
        </section>
      </div>
    </main>
  );
}
