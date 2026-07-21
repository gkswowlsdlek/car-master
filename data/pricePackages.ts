import { formatGuidePrice, installationPriceGuide } from "./installation-price-guide";
import { vehicleClassOptions, type VehicleClass } from "./vehicle-class-options";

export type PriceBrand = (typeof installationPriceGuide)[number]["name"];
export type { VehicleClass } from "./vehicle-class-options";
export type PriceGuideFilter = "전체" | "버텍스" | "브이쿨" | "솔라가드" | "후퍼옵틱" | "레인보우" | "레이노" | "글라스틴트" | "기타";

export type PricePackage = {
  id: string; brand: PriceBrand; brandGroup: "주요 브랜드" | "기타"; name: string; product: string;
  description: string; recommendedVehicles: string; guidePrice: number; priceLabel: string;
  prices: Record<VehicleClass, string>; includedServices: string[]; optionalServices: string[];
  recommended: boolean; available: boolean; notice: string;
};

export const vehicleClassLabels = vehicleClassOptions.map((item) => item.id);
export const priceBrands: ("전체" | PriceBrand)[] = ["전체", ...installationPriceGuide.map((brand) => brand.name)];
export const priceGuideFilters: PriceGuideFilter[] = ["전체", "버텍스", "브이쿨", "솔라가드", "후퍼옵틱", "레인보우", "레이노", "글라스틴트", "기타"];

export const pricePackages: PricePackage[] = installationPriceGuide.flatMap((brand) =>
  brand.products.map((product, productIndex) => {
    const priceLabel = formatGuidePrice(product.guidePrice);
    return {
      id: product.id, brand: brand.name, brandGroup: brand.group, name: `${brand.name} ${product.name}`, product: product.name,
      description: product.note ?? "국산 승용차의 썬팅 시공 패키지를 기준으로 한 카마스터 권장 시공 패키지 가이드입니다.",
      recommendedVehicles: "국산 승용", guidePrice: product.guidePrice, priceLabel,
      prices: { "국산 승용": priceLabel, "국산 대형/SUV": "추가금 발생 가능", "수입 승용": formatGuidePrice(product.guidePrice + 50000), "수입 대형/SUV": "별도 견적" },
      includedServices: ["썬팅 시공 패키지", "기본 마감 점검"], optionalServices: ["선루프", "SUV", "기존 필름 제거", "PPF", "블랙박스"],
      recommended: productIndex === 0, available: true,
      notice: product.note ?? "시공점별 최종 견적은 차량 크기, 필름 농도, 작업 조건에 따라 달라질 수 있습니다.",
    };
  }),
);
