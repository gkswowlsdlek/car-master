"use client";

import { useState } from "react";

/** Shared by TransactionChatWorkspace and TransactionManagementScreen —
 * 취소/시공불가 never deletes the Transaction/Room/Messages/Shop, it just
 * ends the work lifecycle (Phase 5). An optional short reason note only. */
export function EndTransactionOutcomeModal({
  outcome,
  onClose,
  onConfirm,
}: {
  outcome: "취소" | "시공불가";
  onClose: () => void;
  onConfirm: (note?: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await onConfirm(note.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="stage-confirm-overlay" role="dialog" aria-modal="true">
      <div className="stage-confirm-backdrop" onClick={onClose} />
      <div className="stage-confirm-card">
        <h3>{outcome === "취소" ? "거래를 취소할까요?" : "시공 불가로 종료할까요?"}</h3>
        <p>
          {outcome === "취소"
            ? "거래 기록은 그대로 보관되고, 이후 작업 단계는 변경할 수 없어요."
            : "시공점에서 작업이 어렵다고 확인된 경우 사용하세요. 거래 기록은 그대로 보관됩니다."}
        </p>
        {error && <p className="login-error">{error}</p>}
        <label className="outcome-note-field">
          <span>사유 (선택)</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="예: 일정이 맞지 않아요" />
        </label>
        <div className="stage-confirm-buttons">
          <button type="button" className="button button-secondary" onClick={onClose}>
            취소
          </button>
          <button type="button" className="button button-primary" onClick={() => void submit()} disabled={pending}>
            {pending ? "처리 중…" : outcome === "취소" ? "거래 취소" : "시공 불가 처리"}
          </button>
        </div>
      </div>
    </div>
  );
}
