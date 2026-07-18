import { demoAccounts } from "../../data/demo-accounts";
import { DemoAuthProvider } from "./demo-auth-provider";

export const authProvider = new DemoAuthProvider(demoAccounts);
export type { AuthCredentials, AuthProvider } from "./auth-provider";
