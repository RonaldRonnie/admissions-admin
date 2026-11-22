import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listLeaderCandidates } from "../api/endpoints";
import { ROLE_LABELS } from "../api/types";
import { Button, ErrorBanner, Field, Loading, Modal } from "./ui";

/**
 * Picks the dean of a school or head of a department from the active staff accounts. The choice is
 * the Department/Dean modules' scope, so it decides whose marks and clearances that person sees.
 */
export function LeaderModal({
  title,
  role,
  currentUserId,
  busy,
  onSave,
  onClose,
}: {
  title: string;
  role: "dean" | "head";
  currentUserId?: string | null;
  busy?: boolean;
  onSave: (userId: string | undefined) => void;
  onClose: () => void;
}) {
  const candidates = useQuery({ queryKey: ["leader-candidates"], queryFn: listLeaderCandidates });
  const [userId, setUserId] = useState(currentUserId ?? "");

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} disabled={userId === (currentUserId ?? "")} onClick={() => onSave(userId || undefined)}>
            {userId ? "Save" : `Clear ${role}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          {role === "dean"
            ? "The dean sees every department in this school in the Dean module, and signs dean clearance stages."
            : "The head sees this department's marks, course units and clearances in the Department module."}{" "}
          They also need that module granted under Users → Access.
        </p>
        {candidates.isLoading ? (
          <Loading label="Loading staff…" />
        ) : candidates.error ? (
          <ErrorBanner error={candidates.error} onRetry={() => candidates.refetch()} />
        ) : (
          <Field label="Staff account" hint="Only enabled staff accounts can lead a school or department.">
            {(id) => (
              <select id={id} className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">(none)</option>
                {(candidates.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.email} · {ROLE_LABELS[c.role] ?? c.role}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
      </div>
    </Modal>
  );
}
