export type UserRole = "dealer" | "installer" | "admin";
export type LegacyUserRole = "dealer" | "shop" | "admin";
export type InstallerApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  installerId?: string;
  approvalStatus?: InstallerApprovalStatus;
};

export type DealerSignUpInput = { role: "dealer"; email: string; password: string; name: string; phone: string; companyName?: string; activityRegion?: string };
export type InstallerSignUpInput = {
  role: "installer"; email: string; password: string; shopName: string; representativeName: string; businessName: string;
  businessRegistrationNumber: string; address: string; detailAddress?: string; phone: string; contactPhone: string;
  supportedServices: string[]; supportedBrands: string[];
};
export type SignUpInput = DealerSignUpInput | InstallerSignUpInput;
export type SignUpResult = { userId: string; requiresEmailConfirmation: boolean; user: CurrentUser | null };

export function normalizeUserRole(role: LegacyUserRole): UserRole {
  return role === "shop" ? "installer" : role;
}
