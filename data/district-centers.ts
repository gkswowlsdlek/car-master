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
];
