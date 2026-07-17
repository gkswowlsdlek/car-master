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
];

export function classifyVehicleModel(model: string): VehicleClass | "" {
  return model.trim() ? "국산 승용" : "";
}
