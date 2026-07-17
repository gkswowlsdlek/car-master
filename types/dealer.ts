import type { Brand } from "../lib/dealer-flow-data";
import type { VehicleClass } from "../data/vehicle-class-options";

export type Role = "dealer" | "shop" | "admin";
export type Screen = "landing" | "login" | "dealerDashboard" | "priceGuide" | "dealerMap" | "request" | "requestSummary" | "deals" | "dealerProfile" | "shopRequests" | "ops";
export type RequestType = "견적 문의" | "실제 시공 요청";
export type DemoAccount = { id: string; email: string; password: string; name: string; role: Role; entryScreen: Screen; shopId?: string };

export type ServiceRequest = {
  maker: string; model: string; vehicleType: "신차" | "재시공"; deliveryArea: string; preferredBrand: Brand;
  works: string[]; workDescription: string; extraRequest: string;
  inboundStart: string; inboundEnd: string; memo: string; requestType: RequestType; extraWorkNote: string;
  vehicleClass: VehicleClass | ""; selectedPackageId?: string; selectedPackageName?: string;
  selectedPackageBrand?: string; selectedPackageProduct?: string; expectedPrice?: string;
  baseGuidePrice?: number; surcharge?: number; finalGuidePrice?: number; priceRequiresInquiry?: boolean;
  includedServices?: string[]; optionalServices?: string[];
};
