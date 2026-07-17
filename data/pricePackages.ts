import { formatGuidePrice, installationPriceGuide } from "./installation-price-guide";

export type PriceBrand = (typeof installationPriceGuide)[number]["name"];

export type VehicleClass = "국산 승용";

export type PricePackage = {
  id: string;
  brand: PriceBrand;
  name: string;
  product: string;
  description: string;
  recommendedVehicles: string;
  guidePrice: number;
  priceLabel: string;
  prices: Record<VehicleClass, string>;
  includedServices: string[];
  optionalServices: string[];
  recommended: boolean;
  available: boolean;
  notice: string;
};

export const vehicleClassLabels: VehicleClass[] = ["국산 승용"];

export const priceBrands: ("전체" | PriceBrand)[] = ["전체", ...installationPriceGuide.map((brand) => brand.name)];

export const pricePackages: PricePackage[] = installationPriceGuide.flatMap((brand) =>
  brand.products.map((product, productIndex) => {
    const priceLabel = formatGuidePrice(product.guidePrice);

    return {
      id: `${brand.id}-${productIndex}-${product.name.toLowerCase().replace(/[^a-z0-9가-힣]+/gi, "-")}`,
      brand: brand.name,
      name: `${brand.name} ${product.name}`,
      product: product.name,
      description: product.note ?? "국산 승용차의 썬팅 시공 패키지를 기준으로 한 카마스터 시공 가격 가이드입니다.",
      recommendedVehicles: "국산 승용",
      guidePrice: product.guidePrice,
      priceLabel,
      prices: {
        "국산 승용": priceLabel,
      },
      includedServices: ["썬팅 시공 패키지", "기본 마감 점검"],
      optionalServices: ["선루프", "SUV", "기존 필름 제거", "PPF", "블랙박스"],
      recommended: productIndex === 0,
      available: true,
      notice: product.note ?? "시공점별 최종 견적은 차량 크기, 필름 농도, 작업 조건에 따라 달라질 수 있습니다.",
    };
  }),
);
