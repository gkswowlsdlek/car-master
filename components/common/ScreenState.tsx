import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Lock, RefreshCw } from "lucide-react";

/**
 * 빈 / 불러오는 중 / 오류 / 권한없음 — 딜러 화면 전체가 공유하는 네 가지 상태.
 *
 * 이 파일이 따로 있는 이유: 실제 서버에 새로 가입한 딜러는 대시보드·거래관리·
 * 메시지가 전부 비어 있는 상태로 시작한다. 즉 **빈 화면이 신규 사용자의 첫
 * 화면**이고, 화면마다 "아직 ~가 없습니다" 한 줄을 다르게 써 두면 제품이
 * 미완성으로 읽힌다. 네 상태를 한 곳에서 만들어 같은 위계·같은 여백·같은
 * 아이콘 크기로 그리고, 각 빈 화면이 반드시 **다음 행동 하나**로 연결되게 한다.
 *
 * 규칙:
 * - 아이콘은 lucide만 쓴다. 돋보기·화살표 이모지는 OS마다 다르게 렌더되고
 *   "만들다 만 데모" 신호로 읽힌다.
 * - 액션은 최대 두 개, 그중 primary는 하나. (design.md "한 화면에 CTA 하나")
 * - 없는 데이터를 지어내지 않는다. 빈 상태에 예시 카드/샘플 수치를 그리지 않는다.
 */

type Action = {
  label: string;
  onClick: () => void;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  /** 다음에 할 일이 여러 단계일 때만. 없으면 렌더하지 않는다. */
  steps,
  /** 카드 안에 들어가는 좁은 자리(사이드바·인박스)용 축약형. */
  compact,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: Action;
  secondaryAction?: Action;
  steps?: string[];
  compact?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`screen-state${compact ? " screen-state-compact" : ""}`}>
      <span className="screen-state-icon" aria-hidden="true">
        <Icon size={compact ? 18 : 22} strokeWidth={1.9} />
      </span>
      <b className="screen-state-title">{title}</b>
      {description && <p className="screen-state-description">{description}</p>}
      {steps && steps.length > 0 && (
        <ol className="screen-state-steps">
          {steps.map((step, index) => (
            <li key={step}>
              <i aria-hidden="true">{index + 1}</i>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
      {(action || secondaryAction) && (
        <div className="screen-state-actions">
          {action && (
            <button type="button" className="button button-primary" onClick={action.onClick}>
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button type="button" className="button button-ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function ErrorState({
  title = "정보를 불러오지 못했습니다.",
  description = "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
  onRetry,
  compact,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`screen-state screen-state-error${compact ? " screen-state-compact" : ""}`} role="alert">
      <span className="screen-state-icon" aria-hidden="true">
        <AlertTriangle size={compact ? 18 : 22} strokeWidth={1.9} />
      </span>
      <b className="screen-state-title">{title}</b>
      <p className="screen-state-description">{description}</p>
      {onRetry && (
        <div className="screen-state-actions">
          <button type="button" className="button button-primary" onClick={onRetry}>
            <RefreshCw size={15} aria-hidden="true" /> 다시 시도
          </button>
        </div>
      )}
    </div>
  );
}

/** 권한이 없어 비어 있는 화면 — "데이터가 없음"과 구분해서 보여준다.
 * 둘을 같은 문구로 처리하면 사용자가 승인 대기 중인지 정말 비어 있는지
 * 알 수 없다. */
export function PermissionState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: Action;
}) {
  return (
    <div className="screen-state screen-state-denied">
      <span className="screen-state-icon" aria-hidden="true">
        <Lock size={22} strokeWidth={1.9} />
      </span>
      <b className="screen-state-title">{title}</b>
      <p className="screen-state-description">{description}</p>
      {action && (
        <div className="screen-state-actions">
          <button type="button" className="button button-primary" onClick={action.onClick}>
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 목록이 들어올 자리를 실제 행 모양으로 미리 잡아두는 스켈레톤.
 *
 * "불러오는 중입니다…" 한 줄과 다른 점은 레이아웃이 튀지 않는다는 것이다 —
 * 텍스트 한 줄만 두면 데이터가 도착하는 순간 화면 전체가 아래로 밀린다.
 */
export function SkeletonList({
  rows = 4,
  label = "불러오는 중입니다.",
  variant = "row",
}: {
  rows?: number;
  label?: string;
  variant?: "row" | "card";
}) {
  return (
    <div className={`skeleton-list skeleton-list-${variant}`} role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton-block skeleton-avatar" />
          <span className="skeleton-lines">
            <span className="skeleton-block skeleton-line-strong" />
            <span className="skeleton-block skeleton-line" />
          </span>
          <span className="skeleton-block skeleton-pill" />
        </div>
      ))}
    </div>
  );
}
