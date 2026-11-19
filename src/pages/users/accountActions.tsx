import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { approveUser, deleteUser, reactivateUser, rejectUser, suspendUser } from "../../api/endpoints";
import { ROLE_LABELS, STAFF_ROLES, type User, type UserRole } from "../../api/types";
import { ConfirmDialog, Field } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { fullName } from "../../lib/format";

export type AccountAction = "approve" | "reject" | "suspend" | "reactivate" | "delete";

/** The transitions UserService allows from each status. */
export function actionsFor(user: User, selfId: string | undefined): AccountAction[] {
  const self = user.id === selfId;
  switch (user.accountStatus) {
    case "PENDING":
      return ["approve", "reject"];
    case "APPROVED":
      return self ? [] : ["suspend", "delete"];
    case "SUSPENDED":
      return self ? ["reactivate"] : ["reactivate", "delete"];
    case "DISABLED":
      return ["reactivate"];
    default:
      return [];
  }
}

export const ACTION_LABELS: Record<AccountAction, string> = {
  approve: "Approve",
  reject: "Reject",
  suspend: "Suspend",
  reactivate: "Reactivate",
  delete: "Disable",
};

const COPY: Record<AccountAction, { title: string; body: string; danger: boolean; reason: boolean; done: string }> = {
  approve: { title: "Approve account", body: "They will be able to sign in straight away.", danger: false, reason: false, done: "approved" },
  reject: { title: "Reject account", body: "The registration is refused and the account disabled.", danger: true, reason: true, done: "rejected" },
  // JwtAuthenticationFilter re-checks the account on every request, so this cuts off sessions
  // that are already open, not just future sign-ins.
  suspend: {
    title: "Suspend account",
    body: "They are signed out everywhere immediately and cannot sign in again until reactivated.",
    danger: true,
    reason: true,
    done: "suspended",
  },
  reactivate: { title: "Reactivate account", body: "The account returns to Approved and can sign in again.", danger: false, reason: false, done: "reactivated" },
  delete: {
    title: "Disable account",
    body: "This is the API's delete: the account is disabled (signed out immediately), not erased, and can be reactivated later.",
    danger: true,
    reason: false,
    done: "disabled",
  },
};

/** One confirm dialog for every account-lifecycle action. Render `dialog` once; call `start`. */
export function useAccountActions() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<{ action: AccountAction; user: User } | null>(null);
  const [reason, setReason] = useState("");
  const [role, setRole] = useState<UserRole | "">("");

  const mutation = useMutation({
    mutationFn: async ({ action, user }: { action: AccountAction; user: User }) => {
      switch (action) {
        case "approve":
          return approveUser(user.id, role || undefined);
        case "reject":
          return rejectUser(user.id, reason || undefined);
        case "suspend":
          return suspendUser(user.id, reason || undefined);
        case "reactivate":
          return reactivateUser(user.id);
        case "delete":
          return deleteUser(user.id);
      }
    },
    onSuccess: (_data, { action, user }) => {
      toast.success(`${fullName(user)} ${COPY[action].done}.`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      setPending(null);
    },
    onError: (error) => toast.error(error),
  });

  function start(action: AccountAction, user: User) {
    setReason("");
    setRole(action === "approve" && user.role !== "APPLICANT" ? user.role : "");
    setPending({ action, user });
  }

  const copy = pending ? COPY[pending.action] : null;
  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={copy?.title ?? ""}
      danger={copy?.danger}
      confirmLabel={pending ? ACTION_LABELS[pending.action] : ""}
      busy={mutation.isPending}
      reason={reason}
      onReasonChange={copy?.reason ? setReason : undefined}
      onClose={() => setPending(null)}
      onConfirm={() => pending && mutation.mutate(pending)}
      message={
        pending && (
          <div className="space-y-4">
            <p>
              <strong>{fullName(pending.user)}</strong> ({pending.user.email}). {copy?.body}
            </p>
            {pending.action === "approve" && (
              <Field label="Approve as" hint="Leave as-is to keep the role they registered with.">
                {(id) => (
                  <select id={id} className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole | "")}>
                    <option value="">Keep current role ({ROLE_LABELS[pending.user.role]})</option>
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
          </div>
        )
      }
    />
  );

  return { start, dialog };
}
