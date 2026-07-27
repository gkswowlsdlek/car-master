export type DistrictCenter = {
  id: string;
  city: string;
  district: string;
  label: string;
  latitude: number;
  longitude: number;
  aliases: string[];
};

// Representative coordinates correspond to the municipal office addresses.
// Existing project coordinates are reused for Gangnam; the other entries use
// the published city/district office locations, not estimated district centers.
export const districtCenters: DistrictCenter[] = [
  { id: "seoul-gangdong", city: "서울특별시", district: "강동구", label: "서울특별시 강동구청", latitude: 37.5301, longitude: 127.1238, aliases: ["강동구", "서울 강동구", "서울특별시 강동구", "강동", "강동구청"] },
  { id: "seoul-songpa", city: "서울특별시", district: "송파구", label: "서울특별시 송파구청", latitude: 37.5145, longitude: 127.1059, aliases: ["송파구", "서울 송파구", "서울특별시 송파구", "송파", "송파구청"] },
  { id: "seoul-gangnam", city: "서울특별시", district: "강남구", label: "서울특별시 강남구청", latitude: 37.5172, longitude: 127.0473, aliases: ["강남구", "서울 강남구", "서울특별시 강남구", "강남", "강남구청"] },
  { id: "seoul-seocho", city: "서울특별시", district: "서초구", label: "서울특별시 서초구청", latitude: 37.4837, longitude: 127.0324, aliases: ["서초구", "서울 서초구", "서울특별시 서초구", "서초", "서초구청"] },
  { id: "gyeonggi-hanam", city: "경기도", district: "하남시", label: "경기도 하남시청", latitude: 37.5393, longitude: 127.2148, aliases: ["하남시", "경기 하남시", "경기도 하남시", "하남", "하남시청", "미사", "하남 미사", "경기 하남시 미사"] },
  { id: "gyeonggi-seongnam", city: "경기도", district: "성남시", label: "경기도 성남시청", latitude: 37.42, longitude: 127.1266, aliases: ["성남시", "경기 성남시", "경기도 성남시", "성남", "성남시청"] },
  { id: "gyeonggi-guri", city: "경기도", district: "구리시", label: "경기도 구리시청", latitude: 37.5943, longitude: 127.1296, aliases: ["구리시", "경기 구리시", "경기도 구리시", "구리", "구리시청"] },
  { id: "gyeonggi-namyangju", city: "경기도", district: "남양주시", label: "경기도 남양주시청", latitude: 37.636, longitude: 127.2165, aliases: ["남양주시", "경기 남양주시", "경기도 남양주시", "남양주", "남양주시청"] },
  { id: "busan-haeundae", city: "부산광역시", district: "해운대구", label: "부산 해운대구", latitude: 35.1632, longitude: 129.1636, aliases: ["부산", "부산 해운대구", "해운대구", "해운대"] },
  { id: "daegu-suseong", city: "대구광역시", district: "수성구", label: "대구 수성구", latitude: 35.8582, longitude: 128.6306, aliases: ["대구", "대구 수성구", "수성구"] },
  { id: "incheon-namdong", city: "인천광역시", district: "남동구", label: "인천 남동구", latitude: 37.4473, longitude: 126.7315, aliases: ["인천", "인천 남동구", "남동구"] },
  { id: "gwangju-seo", city: "광주광역시", district: "서구", label: "광주 서구", latitude: 35.152, longitude: 126.8895, aliases: ["광주", "광주 서구"] },
  { id: "daejeon-seo", city: "대전광역시", district: "서구", label: "대전 서구", latitude: 36.3551, longitude: 127.3838, aliases: ["대전", "대전 서구"] },
  { id: "ulsan-nam", city: "울산광역시", district: "남구", label: "울산 남구", latitude: 35.5438, longitude: 129.3301, aliases: ["울산", "울산 남구"] },
  { id: "sejong", city: "세종특별자치시", district: "세종시", label: "세종시", latitude: 36.48, longitude: 127.289, aliases: ["세종", "세종시"] },
  { id: "gangwon-chuncheon", city: "강원특별자치도", district: "춘천시", label: "강원 춘천시", latitude: 37.8813, longitude: 127.7298, aliases: ["강원", "강원 춘천시", "춘천시", "춘천"] },
  { id: "chungbuk-cheongju", city: "충청북도", district: "청주시", label: "충북 청주시", latitude: 36.6424, longitude: 127.489, aliases: ["충북", "충북 청주시", "청주시", "청주"] },
  { id: "chungnam-cheonan", city: "충청남도", district: "천안시", label: "충남 천안시", latitude: 36.8151, longitude: 127.1139, aliases: ["충남", "충남 천안시", "천안시", "천안"] },
  { id: "jeonbuk-jeonju", city: "전북특별자치도", district: "전주시", label: "전북 전주시", latitude: 35.8242, longitude: 127.148, aliases: ["전북", "전북 전주시", "전주시", "전주"] },
  { id: "jeonnam-suncheon", city: "전라남도", district: "순천시", label: "전남 순천시", latitude: 34.9506, longitude: 127.4872, aliases: ["전남", "전남 순천시", "순천시", "순천"] },
  { id: "gyeongbuk-pohang", city: "경상북도", district: "포항시", label: "경북 포항시", latitude: 36.019, longitude: 129.3435, aliases: ["경북", "경북 포항시", "포항시", "포항"] },
  { id: "gyeongnam-changwon", city: "경상남도", district: "창원시", label: "경남 창원시", latitude: 35.2279, longitude: 128.6811, aliases: ["경남", "경남 창원시", "창원시", "창원"] },
  { id: "jeju", city: "제주특별자치도", district: "제주시", label: "제주시", latitude: 33.4996, longitude: 126.5312, aliases: ["제주", "제주시"] },
];
