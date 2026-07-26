import type { DemoAccount } from "../types/dealer";

// Demo-only placeholder numbers — never a real subscriber. Fixed and stable
// so both demo browsers (dealer + shop) resolve the same counterpart contact
// without any network call. Real accounts use their own profile.phone via
// the get_transaction_contact RPC instead of anything in this file.
export const demoAccounts: DemoAccount[] = [
  { id: "hanjaejin-dealer", email: "", password: "", name: "한재진", role: "dealer", entryScreen: "dealerDashboard", phone: "010-1111-2222" },
  { id: "misa-starhills-shop", email: "", password: "", name: "미사 스타힐스 시공점", role: "shop", entryScreen: "shopDashboard", shopId: "SHOP-MISA-001", phone: "010-1234-5678" },
  { id: "hanjaejin-admin", email: "", password: "", name: "관리자 한재진", role: "admin", entryScreen: "ops" },
];

export function isDemoAccountId(value?: string) {
  return Boolean(value && demoAccounts.some((account) => account.id === value));
}
