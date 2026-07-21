import { Search } from "lucide-react";
import type { InstallerShop } from "../../lib/dealer-flow-data";
import type { InstallerSearchResult, SearchLocation } from "../../types/location";
import { InstallerShopCard } from "./InstallerShopCard";

export function DealerMapScreen({ query, setQuery, searchArea, location, searchError, results, selectedShop, selectedShopId, setSelectedShopId, favoriteShopIds, toggleFavoriteShop, selectedBrand, isOtherBrand, onRequest }: {
  query: string; setQuery: (value: string) => void; searchArea: (query?: string) => Promise<void>; location: SearchLocation | null; searchError: string;
  results: InstallerSearchResult[]; selectedShop: InstallerShop; selectedShopId: string; setSelectedShopId: (id: string) => void;
  favoriteShopIds: string[]; toggleFavoriteShop: (id: string) => void; selectedBrand?: string; isOtherBrand: boolean; onRequest: () => void;
}) {
  const selectedResult = results.find((item) => item.shop.id === selectedShop.id);
  return <section className="dealer-screen district-search-screen">
    <div className="page-title"><div><p className="eyebrow">INSTALLER NETWORK</p><h1>{location ? `${location.district}청 기준 가까운 시공점` : "행정구역으로 가까운 시공점을 찾으세요"}</h1>{location && <><p className="page-subtitle">검색 기준: {location.label}</p><small>행정구역 대표 위치를 기준으로 거리를 계산합니다.</small></>}</div></div>
    <div className="map-search"><label className="search-field"><Search size={18} aria-hidden="true" /><input aria-label="지역 검색" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void searchArea()} placeholder="예: 강동구, 서울 강동구, 강동구청" /></label><button className="primary" onClick={() => void searchArea()}>검색</button></div>
    {searchError && <div className="location-search-error"><b>{searchError}</b><p>검색 예시: 강동구, 서울 강동구, 송파구, 강남구, 하남시</p></div>}
    {!searchError && location && <div className="shop-finder-layout"><aside className="results-panel finder-results"><div className="results-head"><b>{location.district}청 기준 검색 결과</b><span>{results.length}곳 · 거리순</span></div>
      {results.map(({ shop, distanceLabel }) => <button key={shop.id} className={`shop-row enhanced-shop-row ${shop.id === selectedShopId ? "selected" : ""}`} onClick={() => setSelectedShopId(shop.id)}>
        <span className="shop-logo">{shop.name.slice(0, 2)}</span><span><small>{distanceLabel} · ★ {shop.rating.toFixed(1)} · 최근 거래 {shop.recentTransactionCount}건</small><b>{shop.name}</b><em>{shop.address}</em><i>{shop.responseTime} · 가능 작업: {shop.works.slice(0, 3).join(", ")}</i>{isOtherBrand && <strong className="brand-check-badge inquiry">해당 브랜드 취급 여부 확인 필요</strong>}</span>
        <span role="button" tabIndex={0} className={`favorite-star ${favoriteShopIds.includes(shop.id) ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); toggleFavoriteShop(shop.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); toggleFavoriteShop(shop.id); } }} aria-label={`${shop.name} 즐겨찾기`}>★</span>
      </button>)}
    </aside><div className="selected-shop-panel"><InstallerShopCard shop={selectedShop} distanceLabel={selectedResult?.distanceLabel ?? "-"} selectedBrand={selectedBrand} isOtherBrand={isOtherBrand} onRequest={onRequest} /></div></div>}
  </section>;
}
