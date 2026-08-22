import type { VehicleClass } from "../data/vehicle-class-options";
import type { LegacyUserRole } from "./auth";

/** @deprecated UI compatibility alias. New service boundaries use UserRole (`installer`). */
export type Role = LegacyUserRole;
export type Screen =
  | "landing"
  | "login"
  | "signup"
  | "forgotPassword"
  | "updatePassword"
  | "terms"
  | "privacy"
  | "onboarding"
  | "accountStatus"
  | "dealerDashboard"
  | "shopDashboard"
  | "dealerMap"
  | "request"
  | "requestSummary"
  | "deals"
  | "dealerProfile"
  | "shopRequests"
  | "shopSearchRequests"
  | "ops"
  | "adminShops"
  | "adminAccount"
  | "messages"
  | "dealerHelp"
  | "shopHelp";
export type RequestType = "견적 문의" | "실제 시공 요청";
export type DemoAccount = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  entryScreen: Screen;
  shopId?: string;
  phone?: string;
};

export type ServiceRequest = {
  maker: string;
  model: string;
  vehicleType: "신차" | "재시공";
  deliveryArea: string;
  works: string[];
  workDescription: string;
  extraRequest: string;
  inboundStart: string;
  inboundEnd: string;
  releaseDate: string;
  memo: string;
  requestType: RequestType;
  extraWorkNote: string;
  vehicleClass: VehicleClass | "";
  /** All optional — filled in only when the dealer already knows them at
   * request time. Flows into the same Transaction's warranty info via
   * set_transaction_warranty_info right after creation (see DealerWorkspace's
   * createTransaction) rather than a separate input later. */
  vehicleNumber?: string;
  vin?: string;
  customerName?: string;
  customerPhone?: string;
};
