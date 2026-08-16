"use client";

import { useEffect, useState } from "react";
import { Bell, Building2, CalendarOff, Clock3, Image as ImageIcon, Tags, WalletCards, Wrench } from "lucide-react";
import { profileRepository } from "../../repositories/profile-repository";
import { supabaseProfileRepository } from "../../repositories/supabase-profile-repository";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { isDemoAccountId } from "../../data/demo-accounts";
import type { UserProfile } from "../../types/transactions";
import { PasswordChangeForm } from "../auth/PasswordChangeForm";

export const defaultDealerCompanyName = "카마스터";

const defaults: Record<"dealer" | "shop", UserProfile> = {
  dealer: {
    id: "hanjaejin-dealer",
    role: "dealer",
    name: "한재진",
    companyName: defaultDealerCompanyName,
    phone: "010-1234-5678",
    email: "dealer@car-master.kr",
    activityArea: "서울·경기",
    notifications: { request: true, chat: true, schedule: true, marketing: false },
  },
  shop: {
    id: "misa-starhills-shop",
    role: "shop",
    name: "미사 스타힐스 시공점",
    representativeName: "홍길동",
    phone: "031-000-0000",
    email: "shop@car-master.kr",
    address: "경기 하남시 미사강변중앙로 180",
    brands: ["버텍스", "솔라가드", "후퍼옵틱", "브이쿨"],
    works: ["썬팅", "신차검수", "PPF", "블랙박스"],
    hours: "평일 09:00-19:00",
    closedDays: "매주 일요일",
    emergencyAvailable: true,
    introduction: "신차 패키지 전문 시공점",
    notifications: { request: true, chat: true, schedule: true, marketing: false },
  },
};

const regions = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
];
const notificationCopy = {
  request: ["시공 요청 응답", "새 견적과 시공 요청의 응답을 알려드려요."],
  chat: ["거래 채팅", "거래방에 새 메시지가 오면 알려드려요."],
  schedule: ["일정 및 상태", "입고 일정과 거래 단계 변경을 알려드려요."],
  marketing: ["서비스 소식", "카마스터 운영 소식을 받아봅니다."],
} as const;

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length === 10 ? 6 : 7)}-${digits.slice(digits.length === 10 ? 6 : 7)}`;
}

export function ProfileEditor({
  role,
  userId,
  activity,
  onChangePassword,
}: {
  role: "dealer" | "shop";
  userId?: string;
  activity: { total: number; monthly: number; completed: number; favorites: number };
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const profileId = userId ?? defaults[role].id;
  const useMemberDatabase = isSupabaseConfigured && !isDemoAccountId(profileId);
  const [profile, setProfile] = useState(
    () => profileRepository.getById(profileId) ?? { ...defaults[role], id: profileId },
  );
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(useMemberDatabase);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!useMemberDatabase) return;
    void supabaseProfileRepository
      .getById(profileId, role)
      .then((value) => {
        const local = profileRepository.getById(profileId);
        if (value) setProfile({ ...value, notifications: local?.notifications ?? value.notifications });
      })
      .catch(() => setError("회원 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [profileId, role, useMemberDatabase]);
  const field = (key: keyof UserProfile, label: string, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        value={Array.isArray(profile[key]) ? profile[key].join(", ") : String(profile[key] ?? "")}
        onChange={(event) => {
          setSaved(false);
          const value = key === "phone" ? formatPhone(event.target.value) : event.target.value;
          setProfile({
            ...profile,
            [key]:
              key === "brands" || key === "works"
                ? value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : value,
          });
        }}
      />
    </label>
  );
  const save = async () => {
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return setError("올바른 이메일 주소를 입력해 주세요.");
    setSaving(true);
    try {
      if (useMemberDatabase) await supabaseProfileRepository.save(profile);
      profileRepository.save(profile);
      setSaved(true);
    } catch {
      setError("회원 정보를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };
  if (loading)
    return (
      <section className="profile-editor">
        <div className="empty-state">
          <h2>회원 정보를 불러오고 있습니다.</h2>
        </div>
      </section>
    );
  const notifications = (
    <section className="profile-notification-settings shop-management-card">
      <header>
        <Bell size={19} />
        <div>
          <h2>알림 설정</h2>
          <small>업무 알림 수신 범위</small>
        </div>
      </header>
      <div className="notification-toggle-list">
        {(["request", "chat", "schedule", "marketing"] as const).map((key) => (
          <label key={key}>
            <span>
              <b>{notificationCopy[key][0]}</b>
              <small>{notificationCopy[key][1]}</small>
            </span>
            <input
              className="toggle-input"
              type="checkbox"
              checked={profile.notifications[key]}
              onChange={() => {
                setSaved(false);
                setProfile({
                  ...profile,
                  notifications: { ...profile.notifications, [key]: !profile.notifications[key] },
                });
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );

  return (
    <section className={`profile-editor ${role === "shop" ? "shop-management-page" : ""}`}>
      <div className="page-title">
        <div>
          <p className="eyebrow">운영 정보 관리</p>
          <h1>{role === "dealer" ? "딜러 마이페이지" : "시공점 관리"}</h1>
          <p className="page-subtitle">
            {role === "shop"
              ? "고객에게 노출되는 정보와 요청 수신 설정을 섹션별로 관리합니다."
              : "내 정보와 알림 설정, 최근 활동을 관리합니다."}
          </p>
        </div>
        {role === "shop" && (
          <div className="shop-operation-status">
            <span className={profile.emergencyAvailable ? "open" : "paused"}>
              {profile.emergencyAvailable ? "요청 수신 중" : "요청 일시 중지"}
            </span>
            <button
              className="secondary"
              onClick={() => {
                setSaved(false);
                setProfile({ ...profile, emergencyAvailable: !profile.emergencyAvailable });
              }}
            >
              {profile.emergencyAvailable ? "요청 잠시 중지" : "요청 다시 받기"}
            </button>
          </div>
        )}
      </div>
      <section className="profile-activity-summary">
        <article>
          <span>총 거래</span>
          <b>{activity.total}건</b>
        </article>
        <article>
          <span>이번 달 거래</span>
          <b>{activity.monthly}건</b>
        </article>
        <article>
          <span>완료 거래</span>
          <b>{activity.completed}건</b>
        </article>
        <article>
          <span>{role === "shop" ? "요청 수신" : "즐겨찾는 시공점"}</span>
          <b>{role === "shop" ? (profile.emergencyAvailable ? "운영 중" : "중지") : `${activity.favorites}곳`}</b>
        </article>
      </section>
      {saved && <p className="profile-saved">변경사항을 저장했습니다.</p>}
      {error && <p className="login-error">{error}</p>}
      {role === "dealer" ? (
        <div className="profile-editor-grid">
          {field("name", "담당자명")}
          {field("companyName", "회사명 / 소속")}
          {field("phone", "휴대전화", "tel")}
          {field("email", "이메일", "email")}
          <label>
            기본 활동지역
            <select
              value={profile.activityArea ?? ""}
              onChange={(event) => {
                setSaved(false);
                setProfile({ ...profile, activityArea: event.target.value });
              }}
            >
              <option value="">지역 선택</option>
              {regions.map((region) => (
                <option key={region}>{region}</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="shop-management-grid">
          <section className="shop-management-card">
            <header>
              <Building2 size={19} />
              <div>
                <h2>기본 정보</h2>
                <small>시공점 소개와 연락처</small>
              </div>
            </header>
            <div>
              {field("name", "시공점명")}
              {field("representativeName", "대표자명")}
              {field("address", "주소")}
              {field("detailAddress", "상세주소")}
              {field("phone", "전화번호")}
              {field("introduction", "소개글")}
            </div>
          </section>
          <section className="shop-management-card">
            <header>
              <Clock3 size={19} />
              <div>
                <h2>영업시간</h2>
                <small>고객에게 안내할 운영시간</small>
              </div>
            </header>
            <div>{field("hours", "영업시간")}</div>
            <header className="subsection-head">
              <CalendarOff size={18} />
              <div>
                <h3>휴무일</h3>
              </div>
            </header>
            <div>{field("closedDays", "정기 휴무")}</div>
          </section>
          <section className="shop-management-card">
            <header>
              <Tags size={19} />
              <div>
                <h2>작업 가능 브랜드</h2>
                <small>쉼표로 구분해 입력하세요</small>
              </div>
            </header>
            <div>{field("brands", "취급 브랜드")}</div>
          </section>
          <section className="shop-management-card">
            <header>
              <Wrench size={19} />
              <div>
                <h2>작업 가능 항목</h2>
                <small>실제 접수 가능한 작업</small>
              </div>
            </header>
            <div>{field("works", "가능 작업")}</div>
            <label className="profile-checkbox-field">
              <input
                type="checkbox"
                checked={Boolean(profile.emergencyAvailable)}
                onChange={(event) => {
                  setSaved(false);
                  setProfile({ ...profile, emergencyAvailable: event.target.checked });
                }}
              />{" "}
              긴급 시공 요청을 받을 수 있습니다.
            </label>
          </section>
          <section className="shop-management-card management-placeholder">
            <header>
              <WalletCards size={19} />
              <div>
                <h2>정산 정보</h2>
                <small>계좌 및 사업자 확인</small>
              </div>
            </header>
            <p>정산 기능 연결 후 이 영역에서 관리할 수 있습니다.</p>
          </section>
          <section className="shop-management-card management-placeholder">
            <header>
              <ImageIcon size={19} />
              <div>
                <h2>포트폴리오</h2>
                <small>시공 사례 관리</small>
              </div>
            </header>
            <p>거래방에 등록한 작업 사진을 기반으로 제공할 예정입니다.</p>
          </section>
        </div>
      )}
      {notifications}
      <div className="profile-editor-actions">
        <button className="primary" onClick={() => void save()} disabled={saving}>
          {saving ? "저장 중…" : "변경사항 저장"}
        </button>
      </div>
      <p>
        {useMemberDatabase
          ? "회원 정보는 안전한 회원 DB에 저장됩니다. 이메일 변경 시 새 주소로 전송된 인증이 필요할 수 있습니다."
          : "시험 계정의 설정은 현재 브라우저에 저장됩니다."}
      </p>
      {useMemberDatabase ? (
        <PasswordChangeForm onChangePassword={onChangePassword} />
      ) : (
        <section className="profile-password-card shop-management-card">
          <header>
            <div>
              <h2>비밀번호 변경</h2>
            </div>
          </header>
          <p className="profile-demo-password-note">Demo 계정에서는 비밀번호를 변경하지 않아요.</p>
        </section>
      )}
    </section>
  );
}
