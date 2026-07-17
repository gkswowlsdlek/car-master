import type { ChatMessage } from "../lib/chat-data";
import type { Brand } from "../lib/dealer-flow-data";
import type { VehicleClass } from "../data/vehicle-class-options";

export type Role = "dealer" | "shop" | "admin";
export type Screen = "landing" | "login" | "dealerDashboard" | "priceGuide" | "dealerMap" | "request" | "requestSummary" | "deals" | "dealerSettlement" | "dealerProfile" | "shopRequests" | "chat" | "ops";
export type RequestStatus = "draft" | "sent" | "accepted" | "scheduleAgreed";
export type DealStatus = "시공점 확인중" | "진행중" | "작업완료" | "취소";
export type RequestType = "견적 문의" | "실제 시공 요청";
export type DealStage = "접수" | "입고" | "시공중" | "완료";

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

export type DealerDeal = {
  id: string; maker: string; model: string; shopName: string; shopAddress: string; region: string; works: string[];
  packageName: string; packageBrand?: string; packageProduct?: string; requestType?: RequestType; extraWorkNote?: string;
  vehicleClass?: VehicleClass | ""; expectedPrice?: string; status: DealStatus; stage?: DealStage; inboundAt?: string;
  outboundAt?: string; completedAt?: string; lastMessage: string; updatedAt: string; unread: number; messages: ChatMessage[];
};
