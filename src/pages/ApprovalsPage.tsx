import { useQuery } from "@tanstack/react-query";
import { listPendingUsers } from "../api/endpoints";
import { ROLE_LABELS } from "../api/types";
import { Button, EmptyState, ErrorBanner, Loading, PageHeader } from "../components/ui";
import { formatDateTime, fullName } from "../lib/format";
import { useAccountActions } from "./users/accountActions";

export function ApprovalsPage() {
  const pending = useQuery({ queryKey: ["users", "pending"], queryFn: listPendingUsers });
  const actions = useAccountActions();

  return (
    <>
      <PageHeader
        title="Pending approvals"
        description="Staff who registered themselves and are waiting for an administrator. Approving lets them sign in; you can change their role as you approve."
      />
      <div className="card">
        {pending.isLoading ? (
          <Loading />
        ) : pending.error ? (
          <div className="p-4">
            <ErrorBanner error={pending.error} onRetry={() => pending.refetch()} />
          </div>
        ) : (pending.data ?? []).length === 0 ? (
          <EmptyState title="Nothing waiting.">New staff registrations will appear here.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.data!.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{fullName(u)}</p>
                  <p className="text-sm text-slate-500">
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ""}
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  <p>Requested: {ROLE_LABELS[u.role] ?? u.role}</p>
                  <p className="text-xs text-slate-500">Registered {formatDateTime(u.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" onClick={() => actions.start("approve", u)}>
                    Approve…
                  </Button>
                  <Button variant="danger" onClick={() => actions.start("reject", u)}>
                    Reject…
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {actions.dialog}
    </>
  );
}
