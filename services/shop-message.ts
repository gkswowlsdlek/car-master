import type { Transaction } from "../types/transactions";

function scheduleDateLabel(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

/**
 * Builds the "시공점에 보낼 내용 복사" message from real Transaction data only
 * — every line is conditional on the underlying field actually existing, so
 * a Dealer never copies a line reading "undefined"/"null" or an empty field.
 * Deliberately excludes: customer personal data (none exists on Transaction
 * anyway), the Shop's own phone number (Dealer already has it via the
 * contact sheet), the Dealer's personal contact (never auto-included), and
 * price (Product Rule default is exclude — no confirmed case yet where a
 * Shop needs the price disclosed via this message).
 */
export function generateShopMessage(transaction: Transaction): string {
  const lines: string[] = ["안녕하세요.", "차량 용품 작업 문의드립니다.", ""];

  const vehicle = [transaction.vehicle.maker, transaction.vehicle.model].filter(Boolean).join(" ");
  if (vehicle) lines.push(`차종: ${vehicle}`);

  const work = transaction.service.workDescription || transaction.service.product;
  if (work) lines.push(`작업: ${work}`);

  if (transaction.service.brand) lines.push(`필름: ${transaction.service.brand}`);

  const inbound = scheduleDateLabel(transaction.schedule.confirmedInboundAt ?? transaction.schedule.requestedInboundAt);
  if (inbound) lines.push(`입고 예정: ${inbound}`);

  if (transaction.service.extraRequest) lines.push(`추가 요청: ${transaction.service.extraRequest}`);

  lines.push("", "카마스터를 통해 확인한 작업 건입니다.");
  return lines.join("\n");
}
