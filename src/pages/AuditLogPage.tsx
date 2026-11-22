import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listAuditLogs } from "../api/endpoints";
import { AUDIT_ACTIONS, type AuditLog } from "../api/types";
import { Badge, Button, EmptyState, ErrorBanner, Loading, Modal, PageHeader } from "../components/ui";
import { useToast } from "../components/Toast";
import { downloadText, stamp, toCsv } from "../lib/csv";
import { formatDateTime, fullName, humanize, toDate, type Tone } from "../lib/format";

const LIMIT = 50;
/** Rows per request (AuditLogController caps a page at 200) and a ceiling on pages per export. */
const EXPORT_PAGE = 100;
const EXPORT_MAX_PAGES = 100;

async function fetchAll(action: string): Promise<AuditLog[]> {
  const rows: AuditLog[] = [];
  for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
    const body = await listAuditLogs(page, EXPORT_PAGE, action || undefined);
    rows.push(...(body.data ?? []));
    if (page >= (body.meta?.pagination?.totalPages ?? 1)) break;
  }
  return rows;
}

const who = (u: AuditLog["performedBy"]) => (u ? `${fullName(u)} <${u.email}>` : "");

function actionTone(action: string): Tone {
  if (/REJECTED|SUSPENDED|DEACTIVATED/.test(action)) return "red";
  if (/APPROVED|REACTIVATED|CREATED/.test(action)) return "green";
  if (/ACCESS|PASSWORD/.test(action)) return "amber";
  return "gray";
}

function Person({ user }: { user: AuditLog["performedBy"] }) {
  if (!user) return <span className="text-slate-400">—</span>;
  return (
    <span>
      {fullName(user)}
      <span className="block text-xs text-slate-500">{user.email}</span>
    </span>
  );
}

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [open, setOpen] = useState<AuditLog | null>(null);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  async function exportCsv() {
    setExporting(true);
    try {
      const all = await fetchAll(action);
      downloadText(
        `audit-log-${action ? `${action.toLowerCase()}-` : ""}${stamp()}.csv`,
        toCsv(all, [
          { header: "When", value: (l) => toDate(l.timestamp)?.toISOString() },
          { header: "Action", value: (l) => l.action },
          { header: "By", value: (l) => who(l.performedBy) },
          { header: "Account", value: (l) => who(l.targetUser) },
          { header: "Entity", value: (l) => [l.entityType, l.entityId].filter(Boolean).join(" ") },
          { header: "Details", value: (l) => (l.details && Object.keys(l.details).length ? JSON.stringify(l.details) : "") },
          { header: "IP address", value: (l) => l.ipAddress },
        ]),
      );
      toast.success(`Exported ${all.length} entries.`);
    } catch (error) {
      toast.error(error);
    } finally {
      setExporting(false);
    }
  }

  const logs = useQuery({
    queryKey: ["audit", page, action],
    queryFn: () => listAuditLogs(page, LIMIT, action || undefined),
    placeholderData: keepPreviousData,
  });
  const pagination = logs.data?.meta?.pagination;
  const rows = logs.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who changed which account or access, and when. Newest first. Entries cannot be edited or removed."
        actions={
          <Button onClick={exportCsv} busy={exporting} disabled={!pagination?.total}>
            Export CSV{action ? ` (${humanize(action)})` : ""}
          </Button>
        }
      />
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <select
            className="input w-auto"
            aria-label="Action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {humanize(a)}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => logs.refetch()} busy={logs.isFetching && !logs.isLoading}>
            Refresh
          </Button>
          {pagination && <span className="ml-auto text-sm text-slate-500">{pagination.total} entries</span>}
        </div>

        {logs.isLoading ? (
          <Loading />
        ) : logs.error ? (
          <div className="p-4">
            <ErrorBanner error={logs.error} onRetry={() => logs.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No entries." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">When</th>
                  <th className="th">Action</th>
                  <th className="th">By</th>
                  <th className="th">Affected</th>
                  <th className="th">From</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="td whitespace-nowrap text-slate-600">{formatDateTime(log.timestamp)}</td>
                    <td className="td">
                      <Badge tone={actionTone(log.action)}>{humanize(log.action)}</Badge>
                    </td>
                    <td className="td">
                      <Person user={log.performedBy} />
                    </td>
                    <td className="td">
                      {log.targetUser ? (
                        <Person user={log.targetUser} />
                      ) : log.entityType ? (
                        <span className="text-xs">
                          {log.entityType} <code>{log.entityId}</code>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="td text-xs text-slate-500">{log.ipAddress || "—"}</td>
                    <td className="td text-right">
                      <Button size="sm" variant="ghost" onClick={() => setOpen(log)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Newer
              </Button>
              <Button size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
                Older
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal open={open !== null} title={open ? humanize(open.action) : ""} onClose={() => setOpen(null)} wide>
        {open && (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="font-medium text-slate-500">When</dt>
            <dd>{formatDateTime(open.timestamp)}</dd>
            <dt className="font-medium text-slate-500">By</dt>
            <dd>
              <Person user={open.performedBy} />
            </dd>
            <dt className="font-medium text-slate-500">Affected user</dt>
            <dd>
              <Person user={open.targetUser} />
            </dd>
            {open.entityType && (
              <>
                <dt className="font-medium text-slate-500">Entity</dt>
                <dd>
                  {open.entityType} <code>{open.entityId}</code>
                </dd>
              </>
            )}
            <dt className="font-medium text-slate-500">IP address</dt>
            <dd>{open.ipAddress || "—"}</dd>
            <dt className="font-medium text-slate-500">Browser</dt>
            <dd className="text-xs break-all">{open.userAgent || "—"}</dd>
            <dt className="font-medium text-slate-500">Details</dt>
            <dd>
              {open.details && Object.keys(open.details).length > 0 ? (
                <pre className="overflow-x-auto rounded-md bg-slate-50 p-3 text-xs">{JSON.stringify(open.details, null, 2)}</pre>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        )}
      </Modal>
    </>
  );
}
