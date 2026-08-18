"use client";

import { PasswordChangeForm } from "../auth/PasswordChangeForm";
import type { DemoAccount } from "../../types/dealer";

/** 지금 실제로 있는 데이터(account prop)만으로 구성한다 — 딜러 마이페이지의 거래
 * 통계 카드는 넣지 않는다. "총 거래 3건" 같은 지표는 관리자 자기 계정에는
 * 의미가 없고(관리자는 거래 당사자가 아니다), 최근 로그인·권한 범위 같은 항목은
 * 지금 데이터로 채울 수 없어 만들지 않는다(redesign/shop-admin-shell 4번). */
export function AdminAccountScreen({
  account,
  demoSession = false,
  onChangePassword,
}: {
  account: DemoAccount;
  demoSession?: boolean;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  return (
    <section className="section admin-account-screen">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>계정</h1>
          <p>관리자 계정 정보와 비밀번호를 관리합니다.</p>
        </div>
      </header>
      <div className="card admin-account-info">
        <dl>
          <div>
            <dt>담당자명</dt>
            <dd>{account.name}</dd>
          </div>
          <div>
            <dt>이메일</dt>
            {/* 데모 관리자 계정(hanjaejin-admin)은 email이 빈 문자열이다 — 실제
                Supabase 관리자 계정은 채워져 있으니, 빈 칸 대신 미등록 표기로
                깨져 보이지 않게 한다. */}
            <dd>{account.email || "미등록"}</dd>
          </div>
          <div>
            <dt>역할</dt>
            <dd>
              <span className="badge">관리자</span>
            </dd>
          </div>
        </dl>
      </div>
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
