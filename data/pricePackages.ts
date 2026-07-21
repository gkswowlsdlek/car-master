import { vehicleClassOptions, type VehicleClass } from "./vehicle-class-options";

export type PriceBrand = "ENTRY" | "STANDARD" | "PREMIUM" | "SIGNATURE";
export type { VehicleClass } from "./vehicle-class-options";
export type PriceGuideFilter = "전체";

export type PricePackage = {
  id: string; brand: PriceBrand; brandGroup: "권장 패키지"; name: string; product: string;
  description: string; recommendedVehicles: string; guidePrice: number; priceLabel: string;
  prices: Record<VehicleClass, string>; includedServices: string[]; optionalServices: string[];
  recommended: boolean; available: boolean; notice: string; consultationOnly?: boolean;
};

export const vehicleClassLabels = vehicleClassOptions.map((item) => item.id);
export const priceBrands: ("전체" | PriceBrand)[] = ["전체", "ENTRY", "STANDARD", "PREMIUM", "SIGNATURE"];
export const priceGuideFilters: PriceGuideFilter[] = ["전체"];

const common = {
  brandGroup: "권장 패키지" as const,
  recommendedVehicles: "차량과 작업 범위에 따라 상담",
  includedServices: ["썬팅 시공", "기본 마감 점검"],
  optionalServices: ["선루프", "SUV", "기존 필름 제거", "PPF", "블랙박스"],
  available: true,
  notice: "예시 브랜드 또는 동급 제품 중 차량과 작업 조건에 맞는 구성을 시공점과 확인합니다.",
};

export const pricePackages: PricePackage[] = [
  { ...common, id: "package-entry", brand: "ENTRY", name: "ENTRY", product: "버텍스 900 또는 동급", description: "필수 시공을 합리적으로 구성한 입문 패키지", guidePrice: 500000, priceLabel: "40~60만원", prices: { "국산 승용": "40~60만원", "국산 대형/SUV": "추가금 발생 가능", "수입 승용": "45~65만원", "수입 대형/SUV": "상담 후 견적" }, recommended: false },
  { ...common, id: "package-standard", brand: "STANDARD", name: "STANDARD", product: "루마 IRX 또는 동급", description: "가격과 성능의 균형을 고려한 대표 패키지", guidePrice: 750000, priceLabel: "60~90만원", prices: { "국산 승용": "60~90만원", "국산 대형/SUV": "추가금 발생 가능", "수입 승용": "65~95만원", "수입 대형/SUV": "상담 후 견적" }, recommended: true },
  { ...common, id: "package-premium", brand: "PREMIUM", name: "PREMIUM", product: "솔라가드 LX 또는 동급", description: "고성능 제품과 세부 마감을 강화한 상위 패키지", guidePrice: 1100000, priceLabel: "90~130만원", prices: { "국산 승용": "90~130만원", "국산 대형/SUV": "추가금 발생 가능", "수입 승용": "95~135만원", "수입 대형/SUV": "상담 후 견적" }, recommended: false },
  { ...common, id: "package-signature", brand: "SIGNATURE", name: "SIGNATURE", product: "프리미엄 제품 맞춤 구성", description: "차량과 작업 범위에 맞춰 구성하는 맞춤 패키지", guidePrice: 1300000, priceLabel: "상담 후 견적", prices: { "국산 승용": "상담 후 견적", "국산 대형/SUV": "상담 후 견적", "수입 승용": "상담 후 견적", "수입 대형/SUV": "상담 후 견적" }, recommended: false, consultationOnly: true },
];
