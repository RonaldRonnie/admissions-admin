import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiBaseUrl } from "../api/client";
import { adminHealth, listAuditLogs, listCampuses, listIntakes, listUsers } from "../api/endpoints";
import { ROLE_LABELS, USER_ROLES } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Badge, ErrorBanner, PageHeader, Spinner } from "../components/ui";
import { formatDateTime, fullName, humanize } from "../lib/format";

function Stat({ label, value, to, tone }: { label: string; value: ReactNode; to?: string; tone?: "warn" }) {
  const body = (
    <div className={`card h-full p-4 ${to ? "transition-shadow hover:shadow-md" : ""}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export function DashboardPage() {
  const { session } = useAuth();
  const health = useQuery({ queryKey: ["health"], queryFn: adminHealth, refetchInterval: 60_000 });
  const users = useQuery({ queryKey: ["users", "all"], queryFn: listUsers });
  const campuses = useQuery({ queryKey: ["campuses"], queryFn: listCampuses });
  const intakes = useQuery({ queryKey: ["intakes"], queryFn: listIntakes });
  const recent = useQuery({ queryKey: ["audit", 1, "", "recent"], queryFn: () => listAuditLogs(1, 8) });

  const all = users.data ?? [];
  const count = (pred: (u: (typeof all)[number]) => boolean) => (users.data ? all.filter(pred).length : "…");
  const pending = count((u) => u.accountStatus === "PENDING");

  return (
    <>
      <PageHeader title={`Welcome, ${session?.user.firstName ?? "admin"}`} description="An overview of accounts and setup across the admissions system." />

      <div className="card mb-6 flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="font-medium">API</span>
        <code className="text-xs text-slate-600">{apiBaseUrl()}</code>
        <span className="ml-auto">
          {health.isLoading ? (
            <Spinner className="h-4 w-4" />
          ) : health.error ? (
            <Badge tone="red">Unreachable</Badge>
          ) : (
            <Badge tone="green">{health.data?.status === "healthy" ? "Healthy" : health.data?.status}</Badge>
          )}
        </span>
      </div>
      {health.error && (
        <div className="mb-6">
          <ErrorBanner error={health.error} onRetry={() => health.refetch()} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Accounts" value={count(() => true)} to="/users" />
        <Stat label="Waiting for approval" value={pending} to="/approvals" tone={typeof pending === "number" && pending > 0 ? "warn" : undefined} />
        <Stat label="Suspended or disabled" value={count((u) => u.accountStatus === "SUSPENDED" || u.accountStatus === "DISABLED")} to="/users" />
        <Stat
          label="Active campuses · intakes"
          value={
            <>
              {campuses.data ? campuses.data.filter((c) => c.active).length : "…"}
              <span className="text-slate-400"> · </span>
              {intakes.data ? intakes.data.filter((i) => i.active).length : "…"}
            </>
          }
          to="/intakes"
        />
      </div>
      {users.error && (
        <div className="mt-4">
          <ErrorBanner error={users.error} onRetry={() => users.refetch()} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Accounts by role</h2>
          <ul className="space-y-1.5 text-sm">
            {USER_ROLES.map((role) => (
              <li key={role} className="flex justify-between">
                <span className="text-slate-600">{ROLE_LABELS[role]}</span>
                <span className="font-medium">{count((u) => u.role === role)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Recent activity</h2>
            <Link to="/audit" className="text-sm text-brand-700 hover:underline">
              Full audit log →
            </Link>
          </div>
          {recent.error ? (
            <div className="p-4">
              <ErrorBanner error={recent.error} />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {(recent.data?.data ?? []).map((log) => (
                <li key={log.id} className="flex flex-wrap items-baseline gap-x-2 px-4 py-2.5">
                  <span className="font-medium">{humanize(log.action)}</span>
                  {log.targetUser && <span className="text-slate-600">· {fullName(log.targetUser)}</span>}
                  <span className="text-slate-500">by {fullName(log.performedBy)}</span>
                  <span className="ml-auto text-xs text-slate-500">{formatDateTime(log.timestamp)}</span>
                </li>
              ))}
              {recent.data && recent.data.data.length === 0 && <li className="px-4 py-6 text-center text-slate-500">No activity recorded yet.</li>}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
