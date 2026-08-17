"use client";

import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { PasswordField } from "./PasswordField";

type Status = "checking" | "ready" | "invalid" | "success";

// Reads `code` directly from window.location instead of next/navigation's
// useSearchParams() — this whole app is one client-rendered root screen
// (see app/page.tsx), and useSearchParams() would force a Suspense boundary
// this tree doesn't otherwise need. Client-only read, matches the existing
// window.history.pushState() convention already used throughout app/page.tsx.
function readRecoveryCode() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("code");
}

export function UpdatePasswordScreen({
  onExchangeCode,
  onUpdatePassword,
  onGoToLogin,
  onGoToForgotPassword,
}: {
  onExchangeCode: (code: string) => Promise<boolean>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
  onGoToLogin: () => void;
  onGoToForgotPassword: () => void;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const code = readRecoveryCode();
    const check = code ? onExchangeCode(code) : Promise.resolve(false);
    void check.then((ok) => {
      if (active) setStatus(ok ? "ready" : "invalid");
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (submitting) return;
    setError("");
    if (password.length < 8) return setError("비밀번호는 8자 이상이어야 해요.");
    if (password !== confirmPassword) return setError("두 비밀번호가 일치하지 않아요.");
    setSubmitting(true);
    try {
      await onUpdatePassword(password);
      setStatus("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "비밀번호를 변경하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-ad-page">
      <div className="auth-standalone-layout">
        <section className="login-card compact-login-card">
          <div className="login-card-icon">
            <LockKeyhole size={21} />
          </div>
          <h2>새 비밀번호 설정</h2>
          {status === "checking" && <p className="login-note">링크를 확인하고 있어요...</p>}
          {status === "invalid" && (
            <>
              <p className="login-note">링크가 만료되었거나 이미 사용된 링크예요.</p>
              <button type="button" className="primary full" onClick={onGoToForgotPassword}>
                비밀번호 재설정 다시 요청하기
              </button>
            </>
          )}
          {status === "ready" && (
            <>
              <p className="login-note">새 비밀번호를 설정해주세요.</p>
              <PasswordField
                label="새 비밀번호"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                placeholder="8자 이상"
              />
              <PasswordField
                label="새 비밀번호 확인"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                onKeyDown={(event) => event.key === "Enter" && void submit()}
              />
              {error && <p className="login-error">{error}</p>}
              <button
                type="button"
                className="primary full"
                onClick={() => void submit()}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? "변경 중..." : "비밀번호 변경"} {!submitting && <ArrowRight size={17} />}
              </button>
            </>
          )}
          {status === "success" && (
            <>
              <p className="login-note">비밀번호가 변경됐어요.</p>
              <button type="button" className="primary full" onClick={onGoToLogin}>
                로그인하기
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
