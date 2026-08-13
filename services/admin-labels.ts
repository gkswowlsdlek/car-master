/** Shared Admin-facing label maps — DB enum values never render raw in the
 * UI. Keeping these in one place avoids the drift that happened before
 * Phase 7 (AdminMemberPanel had its own approvalLabel map; InstallerApprovalPanel
 * rendered the same enum unlabeled). */

/** "회원 이용 승인" — installer_approval_status, reused for both an
 * Installer's own membership approval and a Shop's exposure approval
 * (installer_shops.approval_status shares the same enum). */
export const INSTALLER_APPROVAL_STATUS_LABEL: Record<"pending" | "approved" | "rejected" | "suspended", string> = {
  pending: "승인 대기", approved: "승인", rejected: "거절", suspended: "정지",
};

/** "업체 노출 상태" — same enum as above, applied to a Shop row specifically
 * (installer_shops.approval_status): whether the Shop can actually be found/
 * used in search and transactions. Deliberately never called "가입 승인" here —
 * that phrase is reserved for the Installer-account membership flow. */
export const SHOP_EXPOSURE_STATUS_LABEL = INSTALLER_APPROVAL_STATUS_LABEL;

/** "업체 연결 상태" — shop_ownership_status. Never conflated with approval:
 * a Shop can be approved (exposed) and still unclaimed (no owner account). */
export const SHOP_OWNERSHIP_STATUS_LABEL: Record<"unclaimed" | "claimed", string> = {
  unclaimed: "미가입 업체", claimed: "운영자 연결됨",
};

/** "업체 연결 요청" — shop_claim_request_status. */
export const SHOP_CLAIM_STATUS_LABEL: Record<"pending" | "approved" | "rejected" | "cancelled", string> = {
  pending: "승인 대기", approved: "승인됨", rejected: "거절됨", cancelled: "취소됨",
};
