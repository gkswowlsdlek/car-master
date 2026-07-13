export type Brand =
  | "버텍스"
  | "솔라가드"
  | "후퍼옵틱"
  | "브이쿨"
  | "글라스틴트"
  | "레이노"
  | "레인보우"
  | "기타 브랜드";

export type WorkType =
  | "신차패키지"
  | "신차검수"
  | "생활보호 PPF"
  | "유리막코팅"
  | "블랙박스"
  | "하이패스";

export type RegionKey =
  | "seoul"
  | "metro"
  | "busan"
  | "daegu"
  | "chungcheong"
  | "jeolla"
  | "gangwon"
  | "jeju";

export type InstallerShop = {
  id: string;
  name: string;
  address: string;
  district: string;
  region: RegionKey;
  lat: number;
  lng: number;
  brands: Brand[];
  works: WorkType[];
  hours: string;
  available: boolean;
  approved: boolean;
  rating: number;
  responseTime: string;
};

export type SearchLocation = {
  id: string;
  label: string;
  aliases: string[];
  lat: number;
  lng: number;
  region: RegionKey;
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

export const workTypes: WorkType[] = [
  "신차패키지",
  "신차검수",
  "생활보호 PPF",
  "유리막코팅",
  "블랙박스",
  "하이패스",
];

export const searchLocations: SearchLocation[] = [
  { id: "gangnam", label: "서울 강남구", aliases: ["강남", "서울 강남", "gangnam"], lat: 37.5172, lng: 127.0473, region: "seoul" },
  { id: "haeundae", label: "부산 해운대구", aliases: ["해운대", "부산 해운대", "haeundae"], lat: 35.1631, lng: 129.1636, region: "busan" },
  { id: "suseong", label: "대구 수성구", aliases: ["수성구", "대구 수성", "suseong"], lat: 35.8584, lng: 128.6306, region: "daegu" },
  { id: "misa", label: "경기 하남시 미사", aliases: ["하남 미사", "미사", "미사강변", "hanam misa"], lat: 37.5602, lng: 127.1927, region: "metro" },
  { id: "bundang", label: "경기 성남시 분당구", aliases: ["분당", "성남 분당"], lat: 37.3826, lng: 127.1189, region: "metro" },
  { id: "songdo", label: "인천 연수구 송도", aliases: ["송도", "인천 송도"], lat: 37.3897, lng: 126.6459, region: "metro" },
  { id: "daejeon", label: "대전 유성구", aliases: ["유성", "대전 유성"], lat: 36.3622, lng: 127.3561, region: "chungcheong" },
  { id: "gwangju", label: "광주 서구", aliases: ["광주", "광주 서구"], lat: 35.1522, lng: 126.8902, region: "jeolla" },
  { id: "jeju", label: "제주 제주시", aliases: ["제주", "제주시"], lat: 33.4996, lng: 126.5312, region: "jeju" },
];

const highBrandSets: Brand[][] = [
  ["버텍스", "솔라가드", "브이쿨"],
  ["솔라가드", "후퍼옵틱", "레이노"],
  ["버텍스", "솔라가드"],
  ["후퍼옵틱", "브이쿨", "글라스틴트"],
  ["버텍스", "후퍼옵틱", "브이쿨"],
  ["솔라가드", "브이쿨", "레인보우"],
  ["버텍스", "솔라가드", "후퍼옵틱", "기타 브랜드"],
  ["후퍼옵틱", "레이노", "레인보우"],
  ["버텍스", "브이쿨", "글라스틴트"],
  ["솔라가드", "후퍼옵틱", "브이쿨", "레이노"],
];

const workSets: WorkType[][] = [
  ["신차패키지", "신차검수", "생활보호 PPF"],
  ["신차패키지", "신차검수", "생활보호 PPF", "블랙박스"],
  ["신차패키지", "유리막코팅"],
  ["신차패키지", "생활보호 PPF", "유리막코팅", "하이패스"],
  ["신차검수", "블랙박스", "하이패스"],
  ["신차패키지", "생활보호 PPF", "유리막코팅", "블랙박스"],
];

const shopBrandPrefixes = [
  "루마버텍스",
  "솔라가드 프리미엄",
  "후퍼옵틱",
  "브이쿨",
  "레이노",
  "글라스틴트",
  "레인보우",
];

const regionMeta: Record<RegionKey, { label: string; center: [number, number]; districts: string[]; suffixes: string[] }> = {
  seoul: {
    label: "서울",
    center: [37.545, 126.99],
    districts: ["강남구", "서초구", "송파구", "마포구", "성동구", "영등포구", "강서구", "노원구", "용산구", "광진구"],
    suffixes: ["프리미엄 틴팅", "오토케어", "카랩", "모터스튜디오", "썬팅팩토리"],
  },
  metro: {
    label: "경기·인천",
    center: [37.42, 126.92],
    districts: ["성남 분당구", "수원 영통구", "고양 일산동구", "인천 연수구", "부천 상동", "하남 미사", "안양 동안구"],
    suffixes: ["카케어", "틴팅하우스", "오토필름", "디테일링", "모터랩"],
  },
  busan: {
    label: "부산·울산·경남",
    center: [35.17, 129.08],
    districts: ["부산 해운대구", "부산 수영구", "부산 동래구", "부산 남구", "울산 남구", "창원 성산구"],
    suffixes: ["오토랩", "틴팅 스튜디오", "카케어", "모터스", "필름센터"],
  },
  daegu: {
    label: "대구·경북",
    center: [35.86, 128.6],
    districts: ["대구 수성구", "대구 달서구", "대구 북구", "포항 남구", "구미 인동"],
    suffixes: ["카프로", "오토필름", "틴팅랩", "디테일샵"],
  },
  chungcheong: {
    label: "대전·세종·충청",
    center: [36.36, 127.38],
    districts: ["대전 유성구", "대전 서구", "세종 나성동", "청주 흥덕구", "천안 불당동"],
    suffixes: ["오토스퀘어", "틴팅존", "카케어", "필름웍스"],
  },
  jeolla: {
    label: "광주·전라",
    center: [35.16, 126.9],
    districts: ["광주 서구", "광주 광산구", "전주 덕진구", "순천 조례동"],
    suffixes: ["카랩", "오토케어", "틴팅팩토리", "모터스"],
  },
  gangwon: {
    label: "강원",
    center: [37.75, 128.88],
    districts: ["원주 무실동", "춘천 퇴계동", "강릉 교동", "속초 조양동"],
    suffixes: ["오토케어", "틴팅랩", "카프로"],
  },
  jeju: {
    label: "제주",
    center: [33.49, 126.53],
    districts: ["제주 연동", "제주 노형동", "서귀포 혁신도시"],
    suffixes: ["오토랩", "카케어", "틴팅스튜디오"],
  },
};

const explicitBusan: InstallerShop[] = [
  {
    id: "SHOP-BS-001",
    name: "루마버텍스 해운대점",
    address: "부산 해운대구 센텀중앙로 97",
    district: "부산 해운대구",
    region: "busan",
    lat: 35.1711,
    lng: 129.1307,
    brands: ["버텍스", "솔라가드", "브이쿨"],
    works: ["신차패키지", "신차검수", "생활보호 PPF"],
    hours: "평일 09:00-19:00, 토요일 09:00-17:00",
    available: true,
    approved: true,
    rating: 4.9,
    responseTime: "평균 18분",
  },
  {
    id: "SHOP-BS-002",
    name: "솔라가드 프리미엄 센텀점",
    address: "부산 해운대구 해운대로 620",
    district: "부산 해운대구",
    region: "busan",
    lat: 35.1636,
    lng: 129.158,
    brands: ["솔라가드", "후퍼옵틱", "레이노"],
    works: ["신차패키지", "신차검수", "생활보호 PPF"],
    hours: "평일 09:30-19:30, 토요일 예약제",
    available: true,
    approved: true,
    rating: 4.8,
    responseTime: "평균 24분",
  },
  {
    id: "SHOP-BS-003",
    name: "브이쿨 부산수영점",
    address: "부산 수영구 광안해변로 215",
    district: "부산 수영구",
    region: "busan",
    lat: 35.1532,
    lng: 129.1188,
    brands: ["버텍스", "솔라가드"],
    works: ["신차패키지", "유리막코팅"],
    hours: "평일 09:00-18:30, 일요일 휴무",
    available: true,
    approved: true,
    rating: 4.7,
    responseTime: "평균 31분",
  },
];

const explicitMetro: InstallerShop[] = [
  {
    id: "SHOP-MISA-001",
    name: "미사 스타힐스 시공점",
    address: "경기 하남시 미사강변중앙로 180",
    district: "하남 미사",
    region: "metro",
    lat: 37.5602,
    lng: 127.1927,
    brands: ["버텍스", "솔라가드", "후퍼옵틱", "브이쿨"],
    works: ["신차패키지", "신차검수", "생활보호 PPF", "유리막코팅", "블랙박스"],
    hours: "평일 09:00-19:00, 토요일 09:00-16:00",
    available: true,
    approved: true,
    rating: 4.9,
    responseTime: "평균 16분",
  },
];

function buildRegionShops(region: RegionKey, count: number, start: number): InstallerShop[] {
  const meta = regionMeta[region];
  const [baseLat, baseLng] = meta.center;

  return Array.from({ length: count }, (_, index) => {
    const n = start + index;
    const district = meta.districts[index % meta.districts.length];
    const districtName = district.replace(/^(서울|부산|대구|대전|광주|제주)\s/, "").replace(/\s/g, "");
    const name = `${shopBrandPrefixes[(index + start) % shopBrandPrefixes.length]} ${districtName}${meta.suffixes[index % meta.suffixes.length]}`;
    const latOffset = (((index % 7) - 3) * 0.012) + (Math.floor(index / 7) * 0.006);
    const lngOffset = (((index % 5) - 2) * 0.016) - (Math.floor(index / 9) * 0.005);
    const brandsForShop = highBrandSets[(index + start) % highBrandSets.length];
    const worksForShop = workSets[(index + start) % workSets.length];
    const approved = index % 17 !== 0;

    return {
      id: `SHOP-${String(n).padStart(3, "0")}`,
      name,
      address: `${district} ${["중앙로", "테헤란로", "해변로", "산업로", "대로", "신도시로"][index % 6]} ${80 + index * 7}`,
      district,
      region,
      lat: Number((baseLat + latOffset).toFixed(5)),
      lng: Number((baseLng + lngOffset).toFixed(5)),
      brands: brandsForShop,
      works: worksForShop,
      hours: index % 6 === 0 ? "평일 10:00-20:00, 토요일 예약제" : "평일 09:00-19:00, 토요일 09:00-17:00",
      available: index % 9 !== 0,
      approved,
      rating: Number((4.5 + ((index + start) % 5) * 0.1).toFixed(1)),
      responseTime: `평균 ${18 + ((index + start) % 8) * 7}분`,
    };
  });
}

export const installerShops: InstallerShop[] = [
  ...buildRegionShops("seoul", 50, 1),
  {
    id: "SHOP-SEOUL-REAL-001",
    name: "후퍼옵틱 강남점",
    address: "서울 강남구 논현로 640",
    district: "서울 강남구",
    region: "seoul",
    lat: 37.5088,
    lng: 127.0375,
    brands: ["후퍼옵틱", "브이쿨", "솔라가드"],
    works: ["신차패키지", "신차검수", "생활보호 PPF", "블랙박스"],
    hours: "평일 09:00-19:00, 토요일 예약제",
    available: true,
    approved: true,
    rating: 4.8,
    responseTime: "평균 22분",
  },
  {
    id: "SHOP-SEOUL-REAL-002",
    name: "브이쿨 서초점",
    address: "서울 서초구 반포대로 58",
    district: "서울 서초구",
    region: "seoul",
    lat: 37.4865,
    lng: 127.0104,
    brands: ["브이쿨", "버텍스", "솔라가드"],
    works: ["신차패키지", "생활보호 PPF", "유리막코팅"],
    hours: "평일 09:30-19:30, 토요일 09:30-16:00",
    available: true,
    approved: true,
    rating: 4.7,
    responseTime: "평균 28분",
  },
  ...explicitMetro,
  ...buildRegionShops("metro", 14, 51),
  ...explicitBusan,
  ...buildRegionShops("busan", 7, 66),
  ...buildRegionShops("daegu", 7, 73),
  ...buildRegionShops("chungcheong", 6, 80),
  ...buildRegionShops("jeolla", 5, 86),
  ...buildRegionShops("gangwon", 4, 91),
  ...buildRegionShops("jeju", 3, 95),
].map((shop, index) => ({
  ...shop,
  id: shop.id.startsWith("SHOP-BS") || shop.id.startsWith("SHOP-MISA") || shop.id.startsWith("SHOP-SEOUL-REAL") ? shop.id : `SHOP-${String(index + 1).padStart(3, "0")}`,
}));

export const regionLabels: Record<RegionKey, string> = Object.fromEntries(
  Object.entries(regionMeta).map(([key, meta]) => [key, meta.label]),
) as Record<RegionKey, string>;

export function findSearchLocation(query: string): SearchLocation {
  const normalized = query.trim().toLowerCase();
  return (
    searchLocations.find((location) =>
      [location.label, ...location.aliases].some((item) => item.toLowerCase().includes(normalized) || normalized.includes(item.toLowerCase())),
    ) ?? searchLocations[1]
  );
}

export function distanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const earthRadius = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(value: number) {
  return `${value.toFixed(value < 10 ? 1 : 0)}km`;
}
