import type { Brand, RegionKey, WorkType } from "../lib/dealer-flow-data";
import type { InstallerListing } from "../types/installer";

type RawPoint = { id: string; name: string; province: string; city: string; address: string; lat: number; lng: number; region: RegionKey };

// Representative 시/도·시/군/구 office coordinates. One entry per Seoul 구 (25),
// ten major Gyeonggi cities, and every other 시/도, so the demo directory reads
// as a nationwide network rather than a Seoul-only sample.
const RAW_POINTS: RawPoint[] = [
  // 서울특별시 - 25개 구
  { id: "INS-SEOUL-001", name: "카마스터 종로점", province: "서울특별시", city: "종로구", address: "서울 종로구 종로 1", lat: 37.5735, lng: 126.9788, region: "seoul" },
  { id: "INS-SEOUL-002", name: "카마스터 중구점", province: "서울특별시", city: "중구", address: "서울 중구 세종대로 110", lat: 37.5636, lng: 126.9976, region: "seoul" },
  { id: "INS-SEOUL-003", name: "카마스터 용산점", province: "서울특별시", city: "용산구", address: "서울 용산구 이태원로 245", lat: 37.5326, lng: 126.9906, region: "seoul" },
  { id: "INS-SEOUL-004", name: "카마스터 성동점", province: "서울특별시", city: "성동구", address: "서울 성동구 왕십리로 410", lat: 37.5634, lng: 127.0369, region: "seoul" },
  { id: "INS-SEOUL-005", name: "카마스터 광진점", province: "서울특별시", city: "광진구", address: "서울 광진구 자양로 117", lat: 37.5385, lng: 127.0824, region: "seoul" },
  { id: "INS-SEOUL-006", name: "카마스터 동대문점", province: "서울특별시", city: "동대문구", address: "서울 동대문구 왕산로 205", lat: 37.5744, lng: 127.0396, region: "seoul" },
  { id: "INS-SEOUL-007", name: "카마스터 중랑점", province: "서울특별시", city: "중랑구", address: "서울 중랑구 봉화산로 179", lat: 37.6063, lng: 127.0925, region: "seoul" },
  { id: "INS-SEOUL-008", name: "카마스터 성북점", province: "서울특별시", city: "성북구", address: "서울 성북구 보문로 168", lat: 37.5894, lng: 127.0167, region: "seoul" },
  { id: "INS-SEOUL-009", name: "카마스터 강북점", province: "서울특별시", city: "강북구", address: "서울 강북구 도봉로 89", lat: 37.6396, lng: 127.0257, region: "seoul" },
  { id: "INS-SEOUL-010", name: "카마스터 도봉점", province: "서울특별시", city: "도봉구", address: "서울 도봉구 마들로 656", lat: 37.6688, lng: 127.0471, region: "seoul" },
  { id: "INS-SEOUL-011", name: "카마스터 노원점", province: "서울특별시", city: "노원구", address: "서울 노원구 노해로 437", lat: 37.6542, lng: 127.0568, region: "seoul" },
  { id: "INS-SEOUL-012", name: "카마스터 은평점", province: "서울특별시", city: "은평구", address: "서울 은평구 은평로 195", lat: 37.6027, lng: 126.9291, region: "seoul" },
  { id: "INS-SEOUL-013", name: "카마스터 서대문점", province: "서울특별시", city: "서대문구", address: "서울 서대문구 연희로 214", lat: 37.5791, lng: 126.9368, region: "seoul" },
  { id: "INS-SEOUL-014", name: "카마스터 마포점", province: "서울특별시", city: "마포구", address: "서울 마포구 월드컵로 212", lat: 37.5663, lng: 126.9019, region: "seoul" },
  { id: "INS-SEOUL-015", name: "카마스터 양천점", province: "서울특별시", city: "양천구", address: "서울 양천구 목동동로 105", lat: 37.5170, lng: 126.8664, region: "seoul" },
  { id: "INS-SEOUL-016", name: "카마스터 강서점", province: "서울특별시", city: "강서구", address: "서울 강서구 화곡로 302", lat: 37.5509, lng: 126.8495, region: "seoul" },
  { id: "INS-SEOUL-017", name: "카마스터 구로점", province: "서울특별시", city: "구로구", address: "서울 구로구 구로중앙로 24", lat: 37.4954, lng: 126.8874, region: "seoul" },
  { id: "INS-SEOUL-018", name: "카마스터 금천점", province: "서울특별시", city: "금천구", address: "서울 금천구 시흥대로 73", lat: 37.4569, lng: 126.8956, region: "seoul" },
  { id: "INS-SEOUL-019", name: "카마스터 영등포점", province: "서울특별시", city: "영등포구", address: "서울 영등포구 의사당대로 43", lat: 37.5264, lng: 126.8963, region: "seoul" },
  { id: "INS-SEOUL-020", name: "카마스터 동작점", province: "서울특별시", city: "동작구", address: "서울 동작구 장승배기로 161", lat: 37.5124, lng: 126.9393, region: "seoul" },
  { id: "INS-SEOUL-021", name: "카마스터 관악점", province: "서울특별시", city: "관악구", address: "서울 관악구 관악로 145", lat: 37.4784, lng: 126.9516, region: "seoul" },
  { id: "SHOP-SEOUL-REAL-001", name: "후퍼옵틱 강남점", province: "서울특별시", city: "강남구", address: "서울 강남구 논현로 640", lat: 37.5088, lng: 127.0375, region: "seoul" },
  { id: "SHOP-SEOUL-REAL-002", name: "브이쿨 서초점", province: "서울특별시", city: "서초구", address: "서울 서초구 반포대로 58", lat: 37.4865, lng: 127.0104, region: "seoul" },
  { id: "INS-SEOUL-024", name: "카마스터 송파점", province: "서울특별시", city: "송파구", address: "서울 송파구 올림픽로 326", lat: 37.5145, lng: 127.1059, region: "seoul" },
  { id: "INS-SEOUL-025", name: "카마스터 강동점", province: "서울특별시", city: "강동구", address: "서울 강동구 성내로 25", lat: 37.5301, lng: 127.1238, region: "seoul" },

  // 경기도 - 주요 10개 도시
  { id: "INS-GG-001", name: "카마스터 수원점", province: "경기도", city: "수원시", address: "경기 수원시 영통구 광교로 145", lat: 37.2636, lng: 127.0286, region: "metro" },
  { id: "INS-GG-002", name: "카마스터 성남점", province: "경기도", city: "성남시", address: "경기 성남시 분당구 판교역로 235", lat: 37.3826, lng: 127.1189, region: "metro" },
  { id: "INS-GG-003", name: "카마스터 고양점", province: "경기도", city: "고양시", address: "경기 고양시 일산동구 중앙로 1275", lat: 37.6584, lng: 126.7717, region: "metro" },
  { id: "INS-GG-004", name: "카마스터 용인점", province: "경기도", city: "용인시", address: "경기 용인시 수지구 포은대로 435", lat: 37.3222, lng: 127.0980, region: "metro" },
  { id: "INS-GG-005", name: "카마스터 부천점", province: "경기도", city: "부천시", address: "경기 부천시 원미구 길주로 210", lat: 37.5035, lng: 126.7660, region: "metro" },
  { id: "INS-GG-006", name: "카마스터 안산점", province: "경기도", city: "안산시", address: "경기 안산시 단원구 광덕대로 지선 152", lat: 37.3218, lng: 126.8309, region: "metro" },
  { id: "INS-GG-007", name: "카마스터 안양점", province: "경기도", city: "안양시", address: "경기 안양시 동안구 시민대로 235", lat: 37.3897, lng: 126.9280, region: "metro" },
  { id: "SHOP-MISA-001", name: "미사 스타힐스 시공점", province: "경기도", city: "하남시", address: "경기 하남시 미사강변중앙로 180", lat: 37.5602, lng: 127.1927, region: "metro" },
  { id: "INS-GG-009", name: "카마스터 남양주점", province: "경기도", city: "남양주시", address: "경기 남양주시 다산순환로 20", lat: 37.6360, lng: 127.2165, region: "metro" },
  { id: "INS-GG-010", name: "카마스터 화성점", province: "경기도", city: "화성시", address: "경기 화성시 동탄대로 537", lat: 37.2003, lng: 127.0736, region: "metro" },

  // 부산광역시
  { id: "SHOP-BS-001", name: "루마버텍스 해운대점", province: "부산광역시", city: "해운대구", address: "부산 해운대구 센텀중앙로 97", lat: 35.1711, lng: 129.1307, region: "busan" },
  { id: "INS-BS-002", name: "카마스터 부산진점", province: "부산광역시", city: "부산진구", address: "부산 부산진구 중앙대로 680", lat: 35.1626, lng: 129.0530, region: "busan" },

  // 대구광역시
  { id: "INS-DG-001", name: "카마스터 수성점", province: "대구광역시", city: "수성구", address: "대구 수성구 달구벌대로 2451", lat: 35.8584, lng: 128.6306, region: "daegu" },
  { id: "INS-DG-002", name: "카마스터 달서점", province: "대구광역시", city: "달서구", address: "대구 달서구 달구벌대로 1690", lat: 35.8299, lng: 128.5326, region: "daegu" },

  // 인천광역시
  { id: "INS-IC-001", name: "카마스터 연수점", province: "인천광역시", city: "연수구", address: "인천 연수구 송도과학로 32", lat: 37.3897, lng: 126.6459, region: "metro" },
  { id: "INS-IC-002", name: "카마스터 남동점", province: "인천광역시", city: "남동구", address: "인천 남동구 남동대로 765", lat: 37.4477, lng: 126.7314, region: "metro" },

  // 제주특별자치도
  { id: "INS-JJ-001", name: "카마스터 제주시점", province: "제주특별자치도", city: "제주시", address: "제주 제주시 노형로 89", lat: 33.4996, lng: 126.5312, region: "jeju" },
  { id: "INS-JJ-002", name: "카마스터 서귀포점", province: "제주특별자치도", city: "서귀포시", address: "제주 서귀포시 중앙로 76", lat: 33.2541, lng: 126.5601, region: "jeju" },

  // 광주광역시
  { id: "INS-GJ-001", name: "카마스터 광주서구점", province: "광주광역시", city: "서구", address: "광주 서구 상무중앙로 61", lat: 35.1522, lng: 126.8902, region: "jeolla" },

  // 대전광역시
  { id: "INS-DJ-001", name: "카마스터 유성점", province: "대전광역시", city: "유성구", address: "대전 유성구 대학로 291", lat: 36.3622, lng: 127.3561, region: "chungcheong" },

  // 울산광역시
  { id: "INS-US-001", name: "카마스터 울산남구점", province: "울산광역시", city: "남구", address: "울산 남구 삼산로 282", lat: 35.5384, lng: 129.3114, region: "busan" },

  // 세종특별자치시
  { id: "INS-SJ-001", name: "카마스터 세종점", province: "세종특별자치시", city: "나성동", address: "세종 나성로 121", lat: 36.4801, lng: 127.2891, region: "chungcheong" },

  // 강원특별자치도
  { id: "INS-GW-001", name: "카마스터 춘천점", province: "강원특별자치도", city: "춘천시", address: "강원 춘천시 중앙로 47", lat: 37.8813, lng: 127.7298, region: "gangwon" },
  { id: "INS-GW-002", name: "카마스터 강릉점", province: "강원특별자치도", city: "강릉시", address: "강원 강릉시 경강로 2100", lat: 37.7519, lng: 128.8761, region: "gangwon" },

  // 충청북도
  { id: "INS-CB-001", name: "카마스터 청주점", province: "충청북도", city: "청주시", address: "충북 청주시 흥덕구 오송생명로 178", lat: 36.6424, lng: 127.4348, region: "chungcheong" },
  { id: "INS-CB-002", name: "카마스터 충주점", province: "충청북도", city: "충주시", address: "충북 충주시 계명대로 43", lat: 36.9910, lng: 127.9259, region: "chungcheong" },

  // 충청남도
  { id: "INS-CN-001", name: "카마스터 천안점", province: "충청남도", city: "천안시", address: "충남 천안시 서북구 불당대로 234", lat: 36.8151, lng: 127.1139, region: "chungcheong" },
  { id: "INS-CN-002", name: "카마스터 아산점", province: "충청남도", city: "아산시", address: "충남 아산시 배방읍 희망로 100", lat: 36.7898, lng: 127.0018, region: "chungcheong" },

  // 전북특별자치도
  { id: "INS-JB-001", name: "카마스터 전주점", province: "전북특별자치도", city: "전주시", address: "전북 전주시 덕진구 백제대로 567", lat: 35.8380, lng: 127.1465, region: "jeolla" },
  { id: "INS-JB-002", name: "카마스터 익산점", province: "전북특별자치도", city: "익산시", address: "전북 익산시 함라로 25", lat: 35.9483, lng: 126.9576, region: "jeolla" },

  // 전라남도
  { id: "INS-JN-001", name: "카마스터 순천점", province: "전라남도", city: "순천시", address: "전남 순천시 훈련로 66", lat: 34.9506, lng: 127.4874, region: "jeolla" },
  { id: "INS-JN-002", name: "카마스터 목포점", province: "전라남도", city: "목포시", address: "전남 목포시 영산로 111", lat: 34.8118, lng: 126.3922, region: "jeolla" },

  // 경상북도
  { id: "INS-GB-001", name: "카마스터 포항점", province: "경상북도", city: "포항시", address: "경북 포항시 남구 중앙로 90", lat: 36.0322, lng: 129.3650, region: "daegu" },
  { id: "INS-GB-002", name: "카마스터 구미점", province: "경상북도", city: "구미시", address: "경북 구미시 인동가야로 3", lat: 36.1195, lng: 128.3444, region: "daegu" },

  // 경상남도
  { id: "INS-GN-001", name: "카마스터 창원점", province: "경상남도", city: "창원시", address: "경남 창원시 성산구 창이대로 689", lat: 35.2278, lng: 128.6812, region: "busan" },
  { id: "INS-GN-002", name: "카마스터 김해점", province: "경상남도", city: "김해시", address: "경남 김해시 김해대로 2401", lat: 35.2285, lng: 128.8894, region: "busan" },
  { id: "INS-GN-003", name: "카마스터 진주점", province: "경상남도", city: "진주시", address: "경남 진주시 진주대로 1027", lat: 35.1799, lng: 128.1076, region: "busan" },
];

const BRAND_SETS: Brand[][] = [
  ["버텍스", "솔라가드", "브이쿨"],
  ["솔라가드", "후퍼옵틱", "레이노"],
  ["버텍스", "솔라가드"],
  ["후퍼옵틱", "브이쿨", "글라스틴트"],
  ["버텍스", "후퍼옵틱", "브이쿨"],
  ["솔라가드", "브이쿨", "레인보우"],
  ["버텍스", "솔라가드", "후퍼옵틱", "기타 브랜드"],
  ["후퍼옵틱", "레이노", "레인보우"],
];

const WORK_SETS: WorkType[][] = [
  ["신차패키지", "신차검수", "생활보호 PPF"],
  ["신차패키지", "신차검수", "생활보호 PPF", "블랙박스"],
  ["신차패키지", "유리막코팅"],
  ["신차패키지", "생활보호 PPF", "유리막코팅", "하이패스"],
  ["신차검수", "블랙박스", "하이패스"],
  ["신차패키지", "생활보호 PPF", "유리막코팅", "블랙박스"],
];

const HOURS_SET = ["평일 09:00-19:00, 토요일 09:00-17:00", "평일 09:30-19:30, 토요일 예약제", "평일 10:00-20:00, 토요일 예약제", "평일 09:00-18:30, 일요일 휴무"];
const NEXT_AVAILABLE_SET = ["오늘 가능", "내일 가능", "7/27(월) 가능", "7/28(화) 가능", "7/29(수) 가능", "7/30(목) 가능", "이번 주 마감, 다음주 가능"];

export const demoInstallerListings: InstallerListing[] = RAW_POINTS.map((point, index) => {
  // RAW_POINTS는 지역 기준점일 뿐 실제 사업장 좌표가 아닙니다. 지도에서는
  // 행정청 표식과 겹치지 않도록 같은 생활권 안에서 결정론적으로 분산합니다.
  const angle = (index * 137.508 * Math.PI) / 180;
  const radius = 0.006 + (index % 5) * 0.0024;
  const demoLat = point.lat + Math.sin(angle) * radius;
  const demoLng = point.lng + Math.cos(angle) * radius / Math.max(0.7, Math.cos(point.lat * Math.PI / 180));
  return {
    id: point.id,
    name: point.name,
    address: point.address,
    district: `${point.province.slice(0, 2)} ${point.city}`,
    province: point.province,
    city: point.city,
    region: point.region,
    lat: Number(demoLat.toFixed(5)),
    lng: Number(demoLng.toFixed(5)),
    brands: BRAND_SETS[index % BRAND_SETS.length],
    works: WORK_SETS[index % WORK_SETS.length],
    hours: HOURS_SET[index % HOURS_SET.length],
    available: index % 11 !== 0,
    approved: true,
    rating: Number((4.4 + (index % 6) * 0.1).toFixed(1)),
    reviewCount: 18 + (index % 13) * 11,
    responseTime: `평균 ${15 + (index % 9) * 6}분`,
    recentTransactionCount: 24 + (index % 17) * 5,
    nextAvailableDate: NEXT_AVAILABLE_SET[index % NEXT_AVAILABLE_SET.length],
    isDemo: true,
  };
});
