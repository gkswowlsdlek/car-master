"use client";

import { useState } from "react";
import type { DemoAccount } from "../../types/dealer";
import { LoginServiceIntro } from "../landing/LoginServiceIntro";

export function LoginScreen({ accounts, onLogin }: { accounts: DemoAccount[]; onLogin: (account: DemoAccount) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    const matched = accounts.find((account) => account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password);
    if (!matched) return setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    onLogin(matched);
  };
  const loginAsDealer = () => onLogin(accounts.find((account) => account.role === "dealer") ?? accounts[0]);

  return (
    <main className="login-ad-page">
      <div className="login-ad-layout">
        <LoginServiceIntro onExplore={loginAsDealer} onPriceGuide={loginAsDealer} />
        <section className="login-card compact-login-card">
          <p className="eyebrow">WELCOME BACK</p><h2>로그인</h2>
          <p className="login-note">발급받은 계정으로 업무를 시작하세요.</p>
          <label>아이디<input autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="아이디" /></label>
          <label>비밀번호<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder="비밀번호" /></label>
          {error && <p className="login-error">{error}</p>}
          <button className="primary full" onClick={submit}>로그인</button>
          {process.env.NODE_ENV === "development" && <small className="demo-login-hint">개발용 계정: 딜러 1/1 · 시공점 2/2 · 관리자 3/3</small>}
        </section>
      </div>
    </main>
  );
}
