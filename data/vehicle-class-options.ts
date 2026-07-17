export type VehicleClass = "국산 승용" | "국산 대형/SUV" | "수입 승용" | "수입 대형/SUV";

export type VehicleClassOption = {
  id: VehicleClass;
  label: string;
  adjustmentType: "fixed" | "inquiry";
  surcharge: number;
  description: string;
};

export const vehicleClassOptions: VehicleClassOption[] = [
  { id: "국산 승용", label: "국산 승용", adjustmentType: "fixed", surcharge: 0, description: "기본 가이드 가격" },
  { id: "국산 대형/SUV", label: "국산 대형/SUV", adjustmentType: "inquiry", surcharge: 0, description: "차량 및 유리 면적에 따라 추가금 발생 가능" },
  // PATCH 1 prototype rule: imported sedans add a fixed 50,000 won to the base guide price.
  { id: "수입 승용", label: "수입 승용", adjustmentType: "fixed", surcharge: 50000, description: "기본 가이드 가격에서 5만원 추가 (프로토타입)" },
  { id: "수입 대형/SUV", label: "수입 대형/SUV", adjustmentType: "inquiry", surcharge: 0, description: "차량별 별도 견적" },
];

export function calculateVehicleClassPrice(basePrice: number, vehicleClass: VehicleClass) {
  const option = vehicleClassOptions.find((item) => item.id === vehicleClass) ?? vehicleClassOptions[0];
  return {
    surcharge: option.surcharge,
    finalGuidePrice: option.adjustmentType === "fixed" ? basePrice + option.surcharge : undefined,
    priceRequiresInquiry: option.adjustmentType === "inquiry",
  };
}
