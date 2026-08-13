"use client";

import { demoAccounts } from "../../data/demo-accounts";
import type { DemoAccount, Screen } from "../../types/dealer";
import type { ChatRoom, Transaction } from "../../types/transactions";
import { AdminAccountScreen } from "../admin/AdminAccountScreen";
import { AdminOverview } from "../admin/AdminOverview";
import { AdminShopManagementScreen } from "../admin/AdminShopManagementScreen";

type AdminWorkspaceProps = {
  account: DemoAccount;
  screen: Screen;
  transactions: Transaction[];
  rooms: ChatRoom[];
  onNavigate: (screen: Screen) => void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

export function AdminWorkspace({ account, screen, transactions, rooms, onNavigate, onChangePassword }: AdminWorkspaceProps) {
  const demoSession = demoAccounts.some((item) => item.id === account.id);

  return <>
    {screen === "ops" && <AdminOverview transactions={transactions} rooms={rooms} demoSession={demoSession} onOpenShopManagement={() => onNavigate("adminShops")} />}
    {screen === "adminShops" && <AdminShopManagementScreen />}
    {screen === "adminAccount" && <AdminAccountScreen demoSession={demoSession} onChangePassword={onChangePassword} />}
  </>;
}
