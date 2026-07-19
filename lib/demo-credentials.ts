import type { Role } from "../types/dealer";

type DemoCredential = {
  role: Role;
  username: string;
  password: string;
};

// Public QA defaults for the prototype deployment. Production-like environments
// can override every value with server-only environment variables.
export const defaultDemoCredentials: DemoCredential[] = [
  { role: "dealer", username: "1", password: "1" },
  { role: "shop", username: "2", password: "2" },
  { role: "admin", username: "3", password: "3" },
];

export function getDemoCredentials(): DemoCredential[] {
  return [
    {
      role: "dealer",
      username: process.env.CARMASTER_DEMO_DEALER_ID?.trim() || defaultDemoCredentials[0].username,
      password: process.env.CARMASTER_DEMO_DEALER_PASSWORD || defaultDemoCredentials[0].password,
    },
    {
      role: "shop",
      username: process.env.CARMASTER_DEMO_SHOP_ID?.trim() || defaultDemoCredentials[1].username,
      password: process.env.CARMASTER_DEMO_SHOP_PASSWORD || defaultDemoCredentials[1].password,
    },
    {
      role: "admin",
      username: process.env.CARMASTER_DEMO_ADMIN_ID?.trim() || defaultDemoCredentials[2].username,
      password: process.env.CARMASTER_DEMO_ADMIN_PASSWORD || defaultDemoCredentials[2].password,
    },
  ];
}
