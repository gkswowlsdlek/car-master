import type { ServiceRequest } from "../types/dealer";

export const defaultRequest: ServiceRequest = {
  maker: "제네시스", model: "GV80", vehicleType: "신차", deliveryArea: "경기 하남시 미사", preferredBrand: "버텍스",
  works: ["버텍스 900 썬팅"], workDescription: "버텍스 900 썬팅", extraRequest: "PPF, 블랙박스",
  inboundStart: "2026-07-24", inboundEnd: "2026-07-24", memo: "버텍스 900 시공 요청", requestType: "실제 시공 요청", extraWorkNote: "PPF, 블랙박스",
  vehicleClass: "국산 대형/SUV", selectedPackageId: "vertex-900", selectedPackageName: "900", selectedPackageBrand: "버텍스", selectedPackageProduct: "900",
  expectedPrice: "추가금 발생 가능", baseGuidePrice: 650000, surcharge: 0, priceRequiresInquiry: true,
  includedServices: ["썬팅 시공 패키지", "기본 마감 점검"], optionalServices: [],
};
