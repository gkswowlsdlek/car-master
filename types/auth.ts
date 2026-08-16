export type UserRole = "dealer" | "installer" | "admin" | "pending";
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

export type DealerSignUpInput = {
  role: "dealer";
  email: string;
  password: string;
  name: string;
  phone: string;
  companyName?: string;
  activityRegion?: string;
};
export type InstallerSignUpInput = {
  role: "installer";
  email: string;
  password: string;
  shopName: string;
  representativeName: string;
  businessName: string;
  businessRegistrationNumber: string;
  address: string;
  detailAddress?: string;
  phone: string;
  contactPhone: string;
  supportedServices: string[];
  supportedBrands: string[];
};
export type SignUpInput = DealerSignUpInput | InstallerSignUpInput;
export type SignUpResult = { userId: string; requiresEmailConfirmation: boolean; user: CurrentUser | null };

/** Legal consent captured at onboarding-submit time — see complete_dealer_onboarding/complete_installer_onboarding RPCs. */
export type LegalAgreementInput = { termsVersion: string; privacyVersion: string };

/** Minimum info collected for a Kakao-ready (or any pending-role) user completing Dealer onboarding. */
export type DealerOnboardingInput = {
  name: string;
  phone: string;
  companyName?: string;
  activityRegion?: string;
} & LegalAgreementInput;

/** Detailed info collected for a pending-role user applying as an Installer. Mirrors InstallerSignUpInput minus credentials, which OAuth doesn't have. */
export type InstallerOnboardingInput = {
  shopName: string;
  representativeName: string;
  businessName: string;
  businessRegistrationNumber: string;
  address: string;
  detailAddress?: string;
  phone: string;
  contactPhone: string;
  supportedServices: string[];
  supportedBrands: string[];
} & LegalAgreementInput;
