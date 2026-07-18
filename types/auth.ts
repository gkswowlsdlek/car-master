export type UserRole = "dealer" | "installer" | "admin";
export type LegacyUserRole = "dealer" | "shop" | "admin";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  installerId?: string;
};

export function normalizeUserRole(role: LegacyUserRole): UserRole {
  return role === "shop" ? "installer" : role;
}
