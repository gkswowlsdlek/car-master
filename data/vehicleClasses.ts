import type { VehicleClass } from "./pricePackages";

export type VehicleClassGuide = {
  className: VehicleClass;
  description: string;
  examples: string[];
};

export const vehicleClassGuides: VehicleClassGuide[] = [
  {
    className: "중형",
    description: "일반 세단과 소형 및 준중형 차량",
    examples: ["아반떼", "K3", "쏘나타", "K5", "소형 밴"],
  },
  {
    className: "대형",
    description: "중대형 세단과 일반 SUV",
    examples: ["그랜저", "K8", "제네시스 G80", "싼타페", "쏘렌토"],
  },
  {
    className: "특대형",
    description: "대형 SUV와 승합 차량",
    examples: ["GV80", "카니발", "EV9", "팰리세이드", "스타리아", "테슬라 모델Y"],
  },
];

const vehicleClassSamples: Record<VehicleClass, string[]> = {
  중형: ["아반떼", "K3", "쏘나타", "K5", "모델3"],
  대형: ["그랜저", "K8", "G80", "싼타페", "쏘렌토", "E-Class"],
  특대형: ["GV80", "카니발", "EV9", "X5", "아이오닉 9", "팰리세이드", "스타리아", "모델Y"],
};

export function classifyVehicleModel(model: string): VehicleClass | "" {
  const normalized = model.replace(/\s+/g, "").toLowerCase();
  if (!normalized) return "";

  for (const [className, samples] of Object.entries(vehicleClassSamples) as [VehicleClass, string[]][]) {
    if (samples.some((sample) => normalized.includes(sample.replace(/\s+/g, "").toLowerCase()))) {
      return className;
    }
  }

  return "";
}
