export type PriceBrand = "버텍스" | "솔라가드" | "브이쿨" | "후퍼옵틱" | "레이노";

export type VehicleClass = "중형" | "대형" | "특대형";

export type PricePackage = {
  id: string;
  brand: PriceBrand;
  name: string;
  description: string;
  recommendedVehicles: string;
  prices: Record<VehicleClass, string>;
  includedServices: string[];
  optionalServices: string[];
  recommended: boolean;
  available: boolean;
  notice: string;
};

export const vehicleClassLabels: VehicleClass[] = ["중형", "대형", "특대형"];

export const priceBrands: ("전체" | PriceBrand)[] = ["전체", "버텍스", "솔라가드", "브이쿨", "후퍼옵틱", "레이노"];

export const pricePackages: PricePackage[] = [
  {
    id: "vertex-900",
    brand: "버텍스",
    name: "버텍스 900",
    description: "프리미엄 열차단 신차패키지",
    recommendedVehicles: "GV80, 카니발, 대형 SUV",
    prices: {
      중형: "가격 입력 예정",
      대형: "가격 입력 예정",
      특대형: "가격 입력 예정",
    },
    includedServices: ["신차검수", "생활보호 PPF 4종", "기본 코팅"],
    optionalServices: ["전면 30%", "측후면 15%", "유리막코팅", "블랙박스", "추가 PPF"],
    recommended: true,
    available: true,
    notice: "표기 금액은 기본 패키지 기준 샘플이며 차량 옵션과 추가 작업에 따라 달라질 수 있습니다.",
  },
  {
    id: "solargard-premium",
    brand: "솔라가드",
    name: "솔라가드 프리미엄",
    description: "고급 반사 필름 중심의 신차패키지",
    recommendedVehicles: "그랜저, K8, G80",
    prices: {
      중형: "가격 입력 예정",
      대형: "가격 입력 예정",
      특대형: "가격 입력 예정",
    },
    includedServices: ["신차검수", "생활보호 PPF 2종", "기본 코팅"],
    optionalServices: ["전면 35%", "측후면 15%", "하이패스", "블랙박스"],
    recommended: true,
    available: true,
    notice: "추후 실제 가격표 전달 시 이 데이터 파일의 값만 교체하면 됩니다.",
  },
  {
    id: "vkool-k",
    brand: "브이쿨",
    name: "브이쿨 K",
    description: "열차단 성능 중심의 수입차 선호 패키지",
    recommendedVehicles: "BMW X5, E-Class, 수입 SUV",
    prices: {
      중형: "가격 입력 예정",
      대형: "가격 입력 예정",
      특대형: "가격 입력 예정",
    },
    includedServices: ["신차검수", "기본 코팅", "시공 전 상담"],
    optionalServices: ["전면 30%", "측후면 5%", "PPF 4종", "유리막코팅"],
    recommended: false,
    available: true,
    notice: "시공점별 취급 가능 여부는 요청 후 확인합니다.",
  },
  {
    id: "huper-optik-prime",
    brand: "후퍼옵틱",
    name: "후퍼옵틱 프라임",
    description: "비반사 필름 선호 고객을 위한 패키지",
    recommendedVehicles: "아이오닉5, EV9, 전기차",
    prices: {
      중형: "가격 입력 예정",
      대형: "가격 입력 예정",
      특대형: "가격 입력 예정",
    },
    includedServices: ["신차검수", "생활보호 PPF 2종", "기본 코팅"],
    optionalServices: ["전면 35%", "측후면 15%", "블랙박스", "하이패스"],
    recommended: false,
    available: true,
    notice: "샘플 가격표이므로 실제 견적 확정 기능은 포함하지 않습니다.",
  },
  {
    id: "rayno-f95",
    brand: "레이노",
    name: "레이노 F95",
    description: "합리적인 가격대의 기본 신차패키지",
    recommendedVehicles: "아반떼, K3, 소형 및 준중형 세단",
    prices: {
      중형: "가격 입력 예정",
      대형: "가격 입력 예정",
      특대형: "가격 입력 예정",
    },
    includedServices: ["신차검수", "기본 썬팅", "기본 코팅"],
    optionalServices: ["측후면 15%", "PPF 2종", "블랙박스"],
    recommended: false,
    available: true,
    notice: "금액표는 딜러 참고용이며 최종 금액은 시공점 확인 후 조율합니다.",
  },
];
