import type { VehicleClass } from "./pricePackages";

export type VehicleClassGuide = {
  className: VehicleClass;
  description: string;
  examples: string[];
};

export const vehicleClassGuides: VehicleClassGuide[] = [
  {
    className: "국산 승용",
    description: "국산 승용차의 썬팅 시공 패키지를 기준으로 한 카마스터 시공 가격 가이드",
    examples: ["G80", "그랜저", "K8", "쏘나타", "아반떼"],
  },
  { className: "국산 대형/SUV", description: "차량 및 유리 면적에 따라 추가금 발생 가능", examples: ["GV80", "카니발", "팰리세이드", "EV9"] },
  { className: "수입 승용", description: "기본 가이드 가격에서 5만원 추가하는 프로토타입 기준", examples: ["E-Class", "5 Series", "Model 3"] },
  { className: "수입 대형/SUV", description: "차량별 별도 견적", examples: ["X5", "GLE", "Model X"] },
];

export function classifyVehicleModel(model: string): VehicleClass | "" {
  const normalized = model.toLowerCase();
  if (!normalized.trim()) return "";
  if (/x5|x7|gle|gls|model x|모델x|카이엔|q7|q8/.test(normalized)) return "수입 대형/SUV";
  if (/bmw|benz|벤츠|아우디|테슬라|model 3|모델3|e-class|5 series/.test(normalized)) return "수입 승용";
  if (/gv80|gv70|카니발|팰리세이드|싼타페|쏘렌토|ev9|아이오닉 9/.test(normalized)) return "국산 대형/SUV";
  return "국산 승용";
}
