export type InstallationPriceItem = {
  name: string;
  guidePrice: number;
  note?: string;
};

export type InstallationPriceBrand = {
  id: string;
  name: string;
  category?: string;
  products: InstallationPriceItem[];
};

export const installationPriceGuide: InstallationPriceBrand[] = [
  {
    id: "vertex",
    name: "버텍스",
    products: [
      { name: "300", guidePrice: 300000 },
      { name: "500", guidePrice: 400000 },
      { name: "700", guidePrice: 500000 },
      { name: "650", guidePrice: 600000 },
      { name: "MK", guidePrice: 650000 },
      { name: "900/700", guidePrice: 600000 },
      { name: "900", guidePrice: 650000 },
      { name: "1100/900", guidePrice: 850000 },
      { name: "1100", guidePrice: 1100000 },
    ],
  },
  {
    id: "vkool",
    name: "브이쿨",
    products: [
      { name: "Q", guidePrice: 350000 },
      { name: "M/MR", guidePrice: 400000 },
      { name: "KEV", guidePrice: 650000 },
      { name: "K", guidePrice: 650000 },
      { name: "VK + K", guidePrice: 1300000 },
    ],
  },
  {
    id: "solargard-premium",
    name: "솔라가드 프리미엄",
    products: [
      { name: "S-LINE", guidePrice: 330000 },
      { name: "G-LINE", guidePrice: 450000 },
      { name: "차콜", guidePrice: 500000 },
      { name: "퀀텀", guidePrice: 650000 },
      { name: "티타늄 IR", guidePrice: 850000 },
      { name: "보그", guidePrice: 1000000 },
      { name: "LX", guidePrice: 1450000 },
    ],
  },
  {
    id: "solargard-noblesse",
    name: "솔라가드 노블레스",
    products: [
      { name: "팬텀", guidePrice: 600000 },
      { name: "볼텍스 IR", guidePrice: 1000000 },
    ],
  },
  {
    id: "huper-optik",
    name: "후퍼옵틱",
    products: [
      { name: "GK", guidePrice: 300000 },
      { name: "KBR", guidePrice: 400000 },
      { name: "클래식", guidePrice: 600000 },
      { name: "RE", guidePrice: 700000 },
      { name: "프나세 + 클래식", guidePrice: 800000, note: "측후면·전면 클래식 구성" },
      { name: "프나세 + 클래식", guidePrice: 1000000, note: "전면 클래식 구성" },
    ],
  },
  {
    id: "rainbow",
    name: "레인보우",
    products: [
      { name: "I55", guidePrice: 250000 },
      { name: "IS100S", guidePrice: 450000 },
      { name: "IS200", guidePrice: 500000 },
      { name: "VS100", guidePrice: 500000 },
      { name: "VS200", guidePrice: 600000 },
      { name: "V90", guidePrice: 450000 },
      { name: "I90", guidePrice: 450000 },
    ],
  },
  {
    id: "rayno",
    name: "레이노",
    products: [
      { name: "F5", guidePrice: 300000 },
      { name: "F85", guidePrice: 400000 },
      { name: "F95", guidePrice: 500000 },
      { name: "파노라마 7", guidePrice: 500000 },
      { name: "파노라마 9", guidePrice: 600000 },
      { name: "S9", guidePrice: 350000, note: "측후면 필름" },
      { name: "파노라마 R", guidePrice: 400000 },
    ],
  },
  {
    id: "glasstint",
    name: "글라스틴트",
    products: [
      { name: "로더", guidePrice: 250000 },
      { name: "선셋", guidePrice: 400000 },
      { name: "레이븐블루", guidePrice: 600000 },
      { name: "로데", guidePrice: 350000 },
      { name: "슈어", guidePrice: 550000 },
    ],
  },
  {
    id: "the-smith",
    name: "더스미스",
    products: [
      { name: "벨라", guidePrice: 200000 },
      { name: "베가", guidePrice: 400000 },
      { name: "크로마 그린반사", guidePrice: 300000 },
      { name: "크로마 블루반사", guidePrice: 300000 },
    ],
  },
  {
    id: "madico",
    name: "마디코",
    products: [
      { name: "ART 비반사", guidePrice: 350000 },
      { name: "CCIRO 반사", guidePrice: 600000 },
    ],
  },
  {
    id: "tincube",
    name: "틴큐브",
    products: [
      { name: "T PLUS", guidePrice: 250000 },
      { name: "Q PLUS", guidePrice: 250000 },
      { name: "M LINE", guidePrice: 450000 },
    ],
  },
  {
    id: "t-nine",
    name: "티나인",
    products: [
      { name: "R 100", guidePrice: 550000 },
      { name: "V 100", guidePrice: 550000 },
    ],
  },
];

export function formatGuidePrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`;
}
