import type { ReactNode } from "react";
import { EmptyState, ErrorBanner, Loading } from "./ui";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** A card holding a table, with the loading, error and empty states every list page shows. */
export function TableCard<T>({
  rows,
  columns,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  toolbar,
  footer,
  rowClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}) {
  return (
    <div className="card">
      {toolbar && <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">{toolbar}</div>}
      {loading ? (
        <Loading />
      ) : error ? (
        <div className="p-4">
          <ErrorBanner error={error} onRetry={onRetry} />
        </div>
      ) : rows.length === 0 ? (
        typeof empty === "string" ? <EmptyState title={empty} /> : empty
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((c) => (
                  <th key={c.header} className={`th ${c.className ?? ""}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={rowKey(row)} className={rowClassName?.(row)}>
                  {columns.map((c) => (
                    <td key={c.header} className={`td ${c.className ?? ""}`}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footer && !loading && !error && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">{footer}</div>
      )}
    </div>
  );
}

/** Previous / next controls for a 1-based page. */
export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  return (
    <>
      <span>
        {total} {total === 1 ? "record" : "records"} · page {page} of {Math.max(1, pages)}
      </span>
      <span className="flex gap-2">
        <button className="rounded border border-slate-300 px-2.5 py-1 text-xs disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button className="rounded border border-slate-300 px-2.5 py-1 text-xs disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </span>
    </>
  );
}
