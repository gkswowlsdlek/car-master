"use client";

import { useRef, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import type { DemoAccount } from "../../types/dealer";
import { LoginServiceIntro } from "../landing/LoginServiceIntro";

export function LoginScreen({ accounts, onLogin, onExplore }: { accounts: DemoAccount[]; onLogin: (account: DemoAccount) => void; onExplore: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const loginCardRef = useRef<HTMLElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const submit = () => {
    const matched = accounts.find((account) => account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password);
    if (!matched) return setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    onLogin(matched);
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
          <div className="login-card-icon"><LockKeyhole size={21} /></div><p className="eyebrow">WELCOME BACK</p><h2>로그인</h2>
          <p className="login-note">카마스터 베타 초대 계정으로 업무를 시작하세요.</p>
          <label>아이디<span className="login-input-wrap"><UserRound size={17} /><input ref={emailInputRef} id="login-email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="아이디" /></span></label>
          <label>비밀번호<span className="login-input-wrap"><LockKeyhole size={17} /><input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder="비밀번호" /></span></label>
          {error && <p className="login-error">{error}</p>}
          <button className="primary full" onClick={submit}>워크스페이스 로그인 <ArrowRight size={17} /></button>
          <div className="login-security-note"><ShieldCheck size={19} /><span><b>안전한 워크스페이스</b><small>초대받은 딜러 및 시공점만 접근할 수 있습니다.</small></span></div>
          <p className="login-support-note">계정 발급이나 로그인에 문제가 있나요? <button onClick={() => alert("베타 운영 문의: help@car-master.kr")}>운영팀 문의</button></p>
          {process.env.NODE_ENV === "development" && <small className="demo-login-hint">개발용 계정: 딜러 1/1 · 시공점 2/2 · 관리자 3/3</small>}
        </section>
      </div>
    </main>
  );
}
