"use client";

import { demoAccounts } from "../../data/demo-accounts";
import type { DemoAccount, Screen } from "../../types/dealer";
import type { ChatRoom, Transaction } from "../../types/transactions";
import { AdminAccountScreen } from "../admin/AdminAccountScreen";
import { AdminOverview } from "../admin/AdminOverview";

type AdminWorkspaceProps = {
  account: DemoAccount;
  screen: Screen;
  transactions: Transaction[];
  rooms: ChatRoom[];
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

export function AdminWorkspace({ account, screen, transactions, rooms, onChangePassword }: AdminWorkspaceProps) {
  const demoSession = demoAccounts.some((item) => item.id === account.id);

  return <>
    {screen === "ops" && <AdminOverview transactions={transactions} rooms={rooms} demoSession={demoSession} />}
    {screen === "adminAccount" && <AdminAccountScreen demoSession={demoSession} onChangePassword={onChangePassword} />}
  </>;
}
