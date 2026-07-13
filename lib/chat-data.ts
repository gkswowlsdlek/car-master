export type ChatMessage = {
  id: string;
  sender: "dealer" | "shop" | "system";
  text: string;
  time: string;
};

export type ScheduleProposal = {
  inboundAt: string;
  outboundAt: string;
  memo: string;
};

export const initialChatMessages: ChatMessage[] = [
  {
    id: "m1",
    sender: "system",
    text: "시공점이 요청을 수락하면 거래 전용 채팅방이 열립니다.",
    time: "09:02",
  },
  {
    id: "m2",
    sender: "dealer",
    text: "고객 차량은 부산 해운대구 인도 예정입니다. 신차패키지와 신차검수를 함께 요청드립니다.",
    time: "09:04",
  },
  {
    id: "m3",
    sender: "shop",
    text: "요청 확인했습니다. 입고 가능 시간과 출고 예상 시간을 제안드리겠습니다.",
    time: "09:18",
  },
];

export const sampleScheduleProposal: ScheduleProposal = {
  inboundAt: "2026년 7월 22일 오전 10:00",
  outboundAt: "2026년 7월 22일 오후 18:00",
  memo: "신차검수 후 이상 없으면 즉시 썬팅과 생활보호 PPF 작업을 진행합니다.",
};
