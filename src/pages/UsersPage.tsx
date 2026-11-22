import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listUsers } from "../api/endpoints";
import { ACCOUNT_STATUSES, ROLE_LABELS, USER_ROLES, type AccountStatus, type User, type UserRole } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Badge, Button, EmptyState, ErrorBanner, Loading, PageHeader } from "../components/ui";
import { formatDateTime, fullName, humanize, STATUS_TONE, toDate } from "../lib/format";
import { ACTION_LABELS, actionsFor, useAccountActions } from "./users/accountActions";
import { BulkGrantModal } from "./users/BulkGrantModal";
import { ResetPasswordModal } from "./users/ResetPasswordModal";
import { UserFormModal } from "./users/UserFormModal";
import { downloadText, stamp, toCsv } from "../lib/csv";

const PAGE_SIZE = 25;

export function UsersPage() {
  const { session } = useAuth();
  const selfId = session?.user.id;
  const users = useQuery({ queryKey: ["users", "all"], queryFn: listUsers });
  const actions = useAccountActions();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [status, setStatus] = useState<AccountStatus | "">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<User | null | undefined>(undefined); // undefined = closed, null = new
  const [bulkOpen, setBulkOpen] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (users.data ?? [])
      .filter((u) => !role || u.role === role)
      .filter((u) => !status || u.accountStatus === status)
      .filter(
        (u) =>
          !needle ||
          fullName(u).toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle) ||
          (u.phone ?? "").includes(needle),
      )
      .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
  }, [users.data, search, role, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const selectedUsers = (users.data ?? []).filter((u) => selected.has(u.id));
  const allOnPageSelected = rows.length > 0 && rows.every((u) => selected.has(u.id));

  function toggle(id: string, on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Every account in the system: staff, students and applicants. Applicants register themselves; staff accounts are created here."
        actions={
          <>
            {selected.size > 0 && <Button onClick={() => setBulkOpen(true)}>Grant access to {selected.size} selected</Button>}
            <Button
              disabled={filtered.length === 0}
              onClick={() =>
                downloadText(
                  `users-${stamp()}.csv`,
                  toCsv(filtered, [
                    { header: "First name", value: (u) => u.firstName },
                    { header: "Last name", value: (u) => u.lastName },
                    { header: "Email", value: (u) => u.email },
                    { header: "Phone", value: (u) => u.phone },
                    { header: "Role", value: (u) => ROLE_LABELS[u.role] ?? u.role },
                    { header: "Status", value: (u) => humanize(u.accountStatus) },
                    { header: "Enabled", value: (u) => (u.enabled ? "Yes" : "No") },
                    { header: "Created", value: (u) => toDate(u.createdAt)?.toISOString() },
                    { header: "Last sign-in", value: (u) => toDate(u.lastLogin)?.toISOString() },
                  ]),
                )
              }
            >
              Export CSV ({filtered.length})
            </Button>
            <Button variant="primary" onClick={() => setEditing(null)}>
              New staff account
            </Button>
          </>
        }
      />

      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
          <input
            className="input max-w-xs"
            placeholder="Search name, email or phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select className="input w-auto" value={role} onChange={(e) => (setRole(e.target.value as UserRole | ""), setPage(1))} aria-label="Role">
            <option value="">All roles</option>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <select className="input w-auto" value={status} onChange={(e) => (setStatus(e.target.value as AccountStatus | ""), setPage(1))} aria-label="Status">
            <option value="">All statuses</option>
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
          <span className="ml-auto self-center text-sm text-slate-500">
            {filtered.length} of {users.data?.length ?? 0}
          </span>
        </div>

        {users.isLoading ? (
          <Loading />
        ) : users.error ? (
          <div className="p-4">
            <ErrorBanner error={users.error} onRetry={() => users.refetch()} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No users match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      className="accent-brand-700"
                      checked={allOnPageSelected}
                      onChange={(e) => rows.forEach((u) => toggle(u.id, e.target.checked))}
                    />
                  </th>
                  <th className="th">Name</th>
                  <th className="th">Role</th>
                  <th className="th">Status</th>
                  <th className="th">Created</th>
                  <th className="th">Last sign-in</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="td">
                      <input
                        type="checkbox"
                        aria-label={`Select ${fullName(u)}`}
                        className="accent-brand-700"
                        checked={selected.has(u.id)}
                        onChange={(e) => toggle(u.id, e.target.checked)}
                      />
                    </td>
                    <td className="td">
                      <div className="font-medium text-slate-900">
                        {fullName(u)} {u.id === selfId && <Badge tone="blue">you</Badge>}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="td whitespace-nowrap">{ROLE_LABELS[u.role] ?? u.role}</td>
                    <td className="td">
                      <Badge tone={STATUS_TONE[u.accountStatus]}>{humanize(u.accountStatus)}</Badge>
                    </td>
                    <td className="td whitespace-nowrap text-slate-600">{formatDateTime(u.createdAt)}</td>
                    <td className="td whitespace-nowrap text-slate-600">{formatDateTime(u.lastLogin)}</td>
                    <td className="td">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" onClick={() => setEditing(u)}>
                          Edit
                        </Button>
                        {u.role !== "APPLICANT" && u.accountStatus !== "PENDING" && (
                          <Button size="sm" onClick={() => setResetting(u)}>
                            Reset password
                          </Button>
                        )}
                        <Link to={`/users/${u.id}/access`} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          Access
                        </Link>
                        {actionsFor(u, selfId).map((action) => (
                          <Button
                            key={action}
                            size="sm"
                            variant={action === "approve" || action === "reactivate" ? "primary" : "ghost"}
                            onClick={() => actions.start(action, u)}
                          >
                            {ACTION_LABELS[action]}
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-500">
              Page {current} of {pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                Previous
              </Button>
              <Button size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {actions.dialog}
      {editing !== undefined && (
        <UserFormModal key={editing?.id ?? "new"} user={editing} open selfId={selfId} onClose={() => setEditing(undefined)} />
      )}
      {resetting && <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />}
      {bulkOpen && (
        <BulkGrantModal
          users={selectedUsers}
          open
          onClose={() => setBulkOpen(false)}
          onApplied={() => {
            setBulkOpen(false);
            setSelected(new Set());
          }}
        />
      )}
    </>
  );
}
