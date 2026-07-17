import type { MouseEvent } from "react";
import type { PricePackage } from "../../data/pricePackages";

export function PricePackageRow({ item, selected, onDetail, onQuote, onRequest }: { item: PricePackage; selected: boolean; onDetail: () => void; onQuote: () => void; onRequest: () => void }) {
  const run = (event: MouseEvent<HTMLButtonElement>, action: () => void) => { event.preventDefault(); event.stopPropagation(); action(); };
  return <article className={`price-package-row ${selected ? "selected" : ""}`}>
    <button type="button" className="price-row-product" onClick={onDetail}><span>{item.product}</span>{item.notice !== item.description && <em>{item.notice}</em>}</button>
    <button type="button" className="price-row-price" onClick={onDetail}>{item.priceLabel}</button>
    <button type="button" className="secondary" onClick={(event) => run(event, onQuote)}>견적 문의</button>
    <button type="button" className="primary" onClick={(event) => run(event, onRequest)}>시공 요청</button>
  </article>;
}
