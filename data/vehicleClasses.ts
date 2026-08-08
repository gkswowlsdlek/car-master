import type { VehicleClass } from "./pricePackages";

export function classifyVehicleModel(model: string): VehicleClass | "" {
  const normalized = model.toLowerCase();
  if (!normalized.trim()) return "";
  if (/x5|x7|gle|gls|model x|모델x|카이엔|q7|q8/.test(normalized)) return "수입 대형/SUV";
  if (/bmw|benz|벤츠|아우디|테슬라|model 3|모델3|e-class|5 series/.test(normalized)) return "수입 승용";
  if (/gv80|gv70|카니발|팰리세이드|싼타페|쏘렌토|ev9|아이오닉 9/.test(normalized)) return "국산 대형/SUV";
  return "국산 승용";
}
