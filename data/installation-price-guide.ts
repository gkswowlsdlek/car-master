export type InstallationPriceItem = {
  id: string;
  name: string;
  guidePrice: number;
  note?: string;
};

export type PriceBrandGroup = "주요 브랜드" | "기타";

export type InstallationPriceBrand = {
  id: string;
  name: string;
  group: PriceBrandGroup;
  category?: string;
  products: InstallationPriceItem[];
};

export const installationPriceGuide: InstallationPriceBrand[] = [
  {
    id: "vertex",
    name: "버텍스",
    group: "주요 브랜드",
    products: [
      { id: "vertex-300", name: "300", guidePrice: 300000 },
      { id: "vertex-500", name: "500", guidePrice: 400000 },
      { id: "vertex-700", name: "700", guidePrice: 500000 },
      { id: "vertex-650", name: "650", guidePrice: 600000 },
      { id: "vertex-mk", name: "MK", guidePrice: 650000 },
      { id: "vertex-900-700", name: "900/700", guidePrice: 600000 },
      { id: "vertex-900", name: "900", guidePrice: 650000 },
      { id: "vertex-1100-900", name: "1100/900", guidePrice: 850000 },
      { id: "vertex-1100", name: "1100", guidePrice: 1100000 },
    ],
  },
  {
    id: "vkool",
    name: "브이쿨",
    group: "주요 브랜드",
    products: [
      { id: "vkool-q", name: "Q", guidePrice: 350000 },
      { id: "vkool-m-mr", name: "M/MR", guidePrice: 400000 },
      { id: "vkool-kev", name: "KEV", guidePrice: 650000 },
      { id: "vkool-k", name: "K", guidePrice: 650000 },
      { id: "vkool-vk-k", name: "VK + K", guidePrice: 1300000 },
    ],
  },
  {
    id: "solargard-premium",
    name: "솔라가드 프리미엄",
    group: "주요 브랜드",
    products: [
      { id: "solargard-premium-s-line", name: "S-LINE", guidePrice: 330000 },
      { id: "solargard-premium-g-line", name: "G-LINE", guidePrice: 450000 },
      { id: "solargard-premium-charcoal", name: "차콜", guidePrice: 500000 },
      { id: "solargard-premium-quantum", name: "퀀텀", guidePrice: 650000 },
      { id: "solargard-premium-titanium-ir", name: "티타늄 IR", guidePrice: 850000 },
      { id: "solargard-premium-vogue", name: "보그", guidePrice: 1000000 },
      { id: "solargard-premium-lx", name: "LX", guidePrice: 1450000 },
    ],
  },
  {
    id: "solargard-noblesse",
    name: "솔라가드 노블레스",
    group: "주요 브랜드",
    products: [
      { id: "solargard-noblesse-phantom", name: "팬텀", guidePrice: 600000 },
      { id: "solargard-noblesse-vortex-ir", name: "볼텍스 IR", guidePrice: 1000000 },
    ],
  },
  {
    id: "huper-optik",
    name: "후퍼옵틱",
    group: "주요 브랜드",
    products: [
      { id: "huper-optik-gk", name: "GK", guidePrice: 300000 },
      { id: "huper-optik-kbr", name: "KBR", guidePrice: 400000 },
      { id: "huper-optik-classic", name: "클래식", guidePrice: 600000 },
      { id: "huper-optik-re", name: "RE", guidePrice: 700000 },
      { id: "huper-optik-prenace-classic-a", name: "프나세 + 클래식 A", guidePrice: 800000, note: "세부 구성 확인 필요" },
      { id: "huper-optik-prenace-classic-b", name: "프나세 + 클래식 B", guidePrice: 1000000, note: "세부 구성 확인 필요" },
    ],
  },
  {
    id: "rainbow",
    name: "레인보우",
    group: "주요 브랜드",
    products: [
      { id: "rainbow-i55", name: "I55", guidePrice: 250000 },
      { id: "rainbow-is100s", name: "IS100S", guidePrice: 450000 },
      { id: "rainbow-is200", name: "IS200", guidePrice: 500000 },
      { id: "rainbow-vs100", name: "VS100", guidePrice: 500000 },
      { id: "rainbow-vs200", name: "VS200", guidePrice: 600000 },
      { id: "rainbow-v90", name: "V90", guidePrice: 450000 },
      { id: "rainbow-i90", name: "I90", guidePrice: 450000 },
    ],
  },
  {
    id: "rayno",
    name: "레이노",
    group: "주요 브랜드",
    products: [
      { id: "rayno-f5", name: "F5", guidePrice: 300000 },
      { id: "rayno-f85", name: "F85", guidePrice: 400000 },
      { id: "rayno-f95", name: "F95", guidePrice: 500000 },
      { id: "rayno-panorama-7", name: "파노라마 7", guidePrice: 500000 },
      { id: "rayno-panorama-9", name: "파노라마 9", guidePrice: 600000 },
      { id: "rayno-s9", name: "S9", guidePrice: 350000, note: "측후면 필름" },
      { id: "rayno-panorama-r", name: "파노라마 R", guidePrice: 400000 },
    ],
  },
  {
    id: "glasstint",
    name: "글라스틴트",
    group: "주요 브랜드",
    products: [
      { id: "glasstint-rother", name: "로더", guidePrice: 250000 },
      { id: "glasstint-sunset", name: "선셋", guidePrice: 400000 },
      { id: "glasstint-raven-blue", name: "레이븐블루", guidePrice: 600000 },
      { id: "glasstint-rode", name: "로데", guidePrice: 350000 },
      { id: "glasstint-sure", name: "슈어", guidePrice: 550000 },
    ],
  },
  {
    id: "the-smith",
    name: "더스미스",
    group: "기타",
    products: [
      { id: "the-smith-bella", name: "벨라", guidePrice: 200000 },
      { id: "the-smith-vega", name: "베가", guidePrice: 400000 },
      { id: "the-smith-chroma-green", name: "크로마 그린반사", guidePrice: 300000 },
      { id: "the-smith-chroma-blue", name: "크로마 블루반사", guidePrice: 300000 },
    ],
  },
  {
    id: "madico",
    name: "마디코",
    group: "기타",
    products: [
      { id: "madico-art", name: "ART 비반사", guidePrice: 350000 },
      { id: "madico-cciro", name: "CCIRO 반사", guidePrice: 600000 },
    ],
  },
  {
    id: "tincube",
    name: "틴큐브",
    group: "기타",
    products: [
      { id: "tincube-t-plus", name: "T PLUS", guidePrice: 250000 },
      { id: "tincube-q-plus", name: "Q PLUS", guidePrice: 250000 },
      { id: "tincube-m-line", name: "M LINE", guidePrice: 450000 },
    ],
  },
  {
    id: "t-nine",
    name: "티나인",
    group: "기타",
    products: [
      { id: "t-nine-r-100", name: "R 100", guidePrice: 550000 },
      { id: "t-nine-v-100", name: "V 100", guidePrice: 550000 },
    ],
  },
];

export function formatGuidePrice(price: number) {
  return `${price.toLocaleString("ko-KR")}원`;
}
