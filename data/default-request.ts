import type { ServiceRequest } from "../types/dealer";

export const defaultRequest: ServiceRequest = {
  maker: "제네시스",
  model: "GV80",
  vehicleType: "신차",
  deliveryArea: "경기 하남시 미사",
  works: ["버텍스 900 썬팅"],
  workDescription: "버텍스 900 썬팅",
  extraRequest: "PPF, 블랙박스",
  inboundStart: "2026-07-24",
  inboundEnd: "2026-07-24",
  releaseDate: "2026-07-26",
  memo: "버텍스 900 시공 요청",
  requestType: "실제 시공 요청",
  extraWorkNote: "PPF, 블랙박스",
  vehicleClass: "국산 대형/SUV",
};
