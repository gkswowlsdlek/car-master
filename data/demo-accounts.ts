import type { DemoAccount } from "../types/dealer";

export const demoAccounts: DemoAccount[] = [
  { id: "hanjaejin-dealer", email: "1", password: "1", name: "한재진", role: "dealer", entryScreen: "dealerDashboard" },
  { id: "misa-starhills-shop", email: "2", password: "2", name: "미사 스타힐스 시공점", role: "shop", entryScreen: "shopDashboard", shopId: "SHOP-MISA-001" },
  { id: "hanjaejin-admin", email: "3", password: "3", name: "관리자 한재진", role: "admin", entryScreen: "ops" },
];
