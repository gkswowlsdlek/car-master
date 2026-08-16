import { demoAccounts } from "../data/demo-accounts";
import type { Transaction } from "../types/transactions";

export type TransactionContact = { name: string; phone: string };

/**
 * Demo-only counterpart lookup — resolved entirely client-side from the
 * fixed demo account list, never fabricated. Returns null whenever the
 * counterpart isn't one of the three fixed demo accounts (e.g. a demo
 * transaction created against an arbitrary directory listing with no phone
 * on file) rather than inventing a number.
 */
export function resolveDemoContact(transaction: Transaction, viewerRole: "dealer" | "shop"): TransactionContact | null {
  const account =
    viewerRole === "dealer"
      ? demoAccounts.find((item) => item.role === "shop" && item.shopId === transaction.installerId)
      : demoAccounts.find((item) => item.role === "dealer" && item.id === transaction.dealerId);
  return account?.phone ? { name: account.name, phone: account.phone } : null;
}
