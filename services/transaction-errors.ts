/**
 * Same idea as translateAuthError (services/auth/supabase-auth-provider.ts)
 * — transaction/shop-search RPCs raise plain-English `raise exception`
 * text (e.g. "Transaction access denied", "Invalid final price"), which
 * was previously shown to end users verbatim via `alert(error.message)`.
 * This maps every known exception string to a Korean, user-facing message,
 * and separately recognizes an expired/invalid session so the user gets a
 * re-login prompt instead of a raw permission error.
 */
export function isSessionExpiredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();
  return lower.includes("jwt") || lower.includes("not authenticated") || lower.includes("session") && lower.includes("expired");
}

export function translateTransactionError(error: unknown, fallback: string): string {
  if (isSessionExpiredError(error)) return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  const message = error instanceof Error ? error.message : "";
  if (message.includes("access denied") || message.includes("not authorized") || message.includes("Only the dealer") || message.includes("Only administrators") || message.includes("Only an administrator")) {
    return "이 작업을 처리할 권한이 없습니다.";
  }
  if (message.includes("already ended")) return "이미 종료된 거래입니다.";
  if (message.includes("Invalid final price")) return "최종 시공금액을 확인해 주세요. (0보다 크고, 소수점 없는 정수여야 해요)";
  if (message.includes("Invalid transaction outcome") || message.includes("Invalid contact status")) return "처리할 수 없는 값입니다. 새로고침 후 다시 시도해 주세요.";
  if (message.includes("not found")) return "거래 정보를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.";
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  return fallback;
}
