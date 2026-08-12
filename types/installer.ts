import type { InstallerShop } from "../lib/dealer-flow-data";

/**
 * Unified Installer View Model.
 * Superset of `InstallerShop` so every existing consumer (InstallerShopCard,
 * ServiceRequestForm, RequestSummary, ...) keeps working unchanged when given
 * an `InstallerListing`. Demo fixtures and the Supabase-backed directory both
 * map into this single shape.
 */
export type InstallerListing = InstallerShop & {
  /** 시/도 */
  province: string;
  /** 시/군/구 */
  city: string;
  /** 리뷰 수 */
  reviewCount: number;
  /** 다음 작업 가능 일정 (표시용 라벨) */
  nextAvailableDate: string;
  /** true = 데모 시공점, false = 카마스터 등록(실) 시공점 */
  isDemo: boolean;
  /** 시공점 전화번호. 등록되지 않은 경우 undefined — 절대 임의로 채우지 않는다. */
  contactPhone?: string;
};
