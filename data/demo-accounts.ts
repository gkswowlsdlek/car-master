import type { DemoAccount } from "../types/dealer";

export const demoAccounts: DemoAccount[] = [
  { id: "hanjaejin-dealer", email: "", password: "", name: "한재진", role: "dealer", entryScreen: "dealerDashboard" },
  { id: "misa-starhills-shop", email: "", password: "", name: "미사 스타힐스 시공점", role: "shop", entryScreen: "shopDashboard", shopId: "SHOP-MISA-001" },
  { id: "hanjaejin-admin", email: "", password: "", name: "관리자 한재진", role: "admin", entryScreen: "ops" },
];

export function isDemoAccountId(value?: string) {
  return Boolean(value && demoAccounts.some((account) => account.id === value));
}
