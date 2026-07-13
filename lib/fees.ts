export function calculateSettlement(gross: number, platformRate: number, pgRate: number) {
  const platformFee = Math.round((gross * platformRate) / 100);
  const pgFee = Math.round((gross * pgRate) / 100);
  return { gross, platformFee, pgFee, net: Math.max(0, gross - platformFee - pgFee) };
}

export function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}
