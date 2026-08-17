export type Brand =
  "버텍스" | "솔라가드" | "후퍼옵틱" | "브이쿨" | "글라스틴트" | "레이노" | "레인보우" | "기타 브랜드";

export type WorkType = "신차패키지" | "신차검수" | "생활보호 PPF" | "유리막코팅" | "블랙박스" | "하이패스";

export type RegionKey = "seoul" | "metro" | "busan" | "daegu" | "chungcheong" | "jeolla" | "gangwon" | "jeju";

export type InstallerShop = {
  id: string;
  name: string;
  address: string;
  district: string;
  region: RegionKey;
  lat?: number;
  lng?: number;
  brands: Brand[];
  works: WorkType[];
  hours: string;
  available: boolean;
  approved: boolean;
  rating: number;
  responseTime: string;
  recentTransactionCount: number;
};

export const brands: Brand[] = [
  "버텍스",
  "솔라가드",
  "후퍼옵틱",
  "브이쿨",
  "글라스틴트",
  "레이노",
  "레인보우",
  "기타 브랜드",
];

export const workTypes: WorkType[] = ["신차패키지", "신차검수", "생활보호 PPF", "유리막코팅", "블랙박스", "하이패스"];
