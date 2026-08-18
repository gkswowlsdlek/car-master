"use client";

import { useRef, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { LoginServiceIntro, LoginWorkspaceBenefits } from "../landing/LoginServiceIntro";

export function LoginScreen({
  onLogin,
  onExplore,
  onSignUp,
  onForgotPassword,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onExplore: () => void;
  onSignUp: () => void;
  onForgotPassword: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginCardRef = useRef<HTMLElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const submit = async () => {
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      await onLogin(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "로그인 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const focusLogin = () => {
    loginCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    emailInputRef.current?.focus({ preventScroll: true });
  };

  return (
    <main className="login-ad-page">
      <div className="login-ad-layout">
        <LoginServiceIntro onExplore={onExplore} onPriceGuide={focusLogin} />
        <section className="login-card compact-login-card" ref={loginCardRef}>
          <div className="login-card-icon">
            <LockKeyhole size={21} />
          </div>
          <h2>로그인</h2>
          <label>
            이메일 또는 아이디
            <span className="login-input-wrap">
              <UserRound size={17} />
              <input
                ref={emailInputRef}
                id="login-email"
                type="text"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="이메일 또는 아이디"
              />
            </span>
          </label>
          <label>
            비밀번호
            <span className="login-input-wrap">
              <LockKeyhole size={17} />
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void submit()}
                placeholder="비밀번호"
              />
            </span>
          </label>
          <button type="button" className="login-forgot-password-link" onClick={onForgotPassword}>
            비밀번호를 잊으셨나요?
          </button>
          {error && <p className="login-error">{error}</p>}
          {/* 로그인 수단은 이 스택 안에서만 늘어난다. 추후 카카오톡 로그인 버튼이
              들어갈 자리로, 여기에 형제 버튼을 추가하면 아래 구분선·회원가입 링크는
              그대로 두고 스택만 아래로 밀린다 — 카드 구조를 다시 짤 필요가 없다. */}
          <div className="login-submit-stack">
            <button
              className="primary full"
              onClick={() => void submit()}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "로그인 중..." : "로그인"} {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </div>
          <div className="login-card-divider" role="presentation" />
          <button className="login-signup-link" onClick={onSignUp}>
            처음이신가요? <b>회원가입</b>
          </button>
          <div className="login-security-note">
            <ShieldCheck size={19} strokeWidth={1.75} />
            <span>
              <b>안전한 회원 워크스페이스</b>
              <small>회원 역할과 용품점 승인 상태에 따라 접근 권한을 확인합니다.</small>
            </span>
          </div>
          <p className="login-support-note">
            로그인에 문제가 있나요?{" "}
            <button
              onClick={() => {
                window.location.href = "/help";
              }}
            >
              도움말 보기
            </button>
          </p>
        </section>
        <LoginWorkspaceBenefits className="login-benefits-mobile" />
      </div>
    </main>
  );
}
