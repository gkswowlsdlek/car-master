import type { VehicleClass } from "../data/vehicle-class-options";

export type TransactionStage = "견적" | "시공예약" | "입고" | "작업완료" | "취소";
export type PaymentStatus = "미결제" | "결제대기" | "결제완료" | "정산대기" | "정산완료";

/** One row of the 거래 로그: every forward advance and every one-step revert. */
export type TransactionStageEvent = {
  id: string;
  fromStage: TransactionStage | null;
  toStage: TransactionStage;
  actorRole: "dealer" | "shop" | "admin";
  direction: "forward" | "backward";
  createdAt: string;
};

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
  stageLog: TransactionStageEvent[];
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

export type ChatRoom = { id: string; transactionId: string; messages: TransactionChatMessage[]; createdAt: string; updatedAt: string; unreadCount: number };

export type UserProfile = {
  id: string; role: "dealer" | "shop"; name: string; companyName?: string; representativeName?: string;
  phone: string; email: string; activityArea?: string; address?: string; detailAddress?: string; brands?: string[]; works?: string[]; hours?: string; introduction?: string;
  closedDays?: string; emergencyAvailable?: boolean;
  notifications: { request: boolean; chat: boolean; schedule: boolean; marketing: boolean };
};
