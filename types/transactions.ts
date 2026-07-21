import type { VehicleClass } from "../data/vehicle-class-options";

export type TransactionStage = "접수" | "입고예정" | "입고" | "시공중" | "완료" | "취소";
export type PaymentStatus = "미결제" | "결제대기" | "결제완료" | "정산대기" | "정산완료";

export type Transaction = {
  id: string;
  dealerId: string;
  installerId: string;
  installerName: string;
  vehicle: { maker: string; model: string; class: VehicleClass | "" };
  service: { brand?: string; product?: string; workDescription: string; extraRequest?: string };
  pricing: { baseGuidePrice?: number; surcharge?: number; finalPrice?: number; paymentStatus: PaymentStatus; paymentAt?: string; settlementDueAt?: string };
  schedule: { requestedInboundAt?: string; confirmedInboundAt?: string; completedAt?: string };
  status: { stage: TransactionStage; createdAt: string; updatedAt: string };
  visibility: { hiddenByDealer: boolean; hiddenByInstaller: boolean };
  chatRoomId: string;
  lastMessage: string;
};

export type TransactionChatMessage = {
  id: string; roomId: string; senderId: string; senderRole: "dealer" | "shop" | "admin" | "system";
  text: string; createdAt: string; readBy: string[]; attachments?: ChatAttachment[];
};

export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  kind: "image" | "file";
  persistence: "session" | "remote";
  storagePath?: string;
  createdAt: string;
};

export type ChatRoom = { id: string; transactionId: string; messages: TransactionChatMessage[]; createdAt: string; updatedAt: string };

export type UserProfile = {
  id: string; role: "dealer" | "shop"; name: string; companyName?: string; representativeName?: string;
  phone: string; email: string; activityArea?: string; address?: string; brands?: string[]; works?: string[]; hours?: string; introduction?: string;
  closedDays?: string; emergencyAvailable?: boolean;
  notifications: { request: boolean; chat: boolean; schedule: boolean; marketing: boolean };
};
