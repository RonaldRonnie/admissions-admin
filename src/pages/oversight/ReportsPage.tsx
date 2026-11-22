import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getReportCsv, getReportDefinition, getReportRows } from "../../api/endpoints";
import { SETUP_REPORTS } from "../../api/types";
import { Pager, TableCard } from "../../components/TableCard";
import { useToast } from "../../components/Toast";
import { Button, ErrorBanner, Loading, PageHeader } from "../../components/ui";
import { downloadText, stamp } from "../../lib/csv";

const LIMIT = 25;

/** The Setup module's nine reports (SetupReportsController): filterable, paginated, exportable. */
export function ReportsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const report = params.get("report") ?? SETUP_REPORTS[0].key;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    setFilters({});
    setSearch("");
    setQuery("");
  }, [report]);
  useEffect(() => setPage(1), [report, query, filters]);

  const definition = useQuery({ queryKey: ["report-definition", report], queryFn: () => getReportDefinition(report) });
  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const rows = useQuery({
    queryKey: ["report-rows", report, page, query, activeFilters],
    queryFn: () => getReportRows(report, page, LIMIT, query, activeFilters),
    placeholderData: keepPreviousData,
  });

  async function exportCsv() {
    setExporting(true);
    try {
      downloadText(`${report}-${stamp()}.csv`, await getReportCsv(report, query, activeFilters));
    } catch (error) {
      toast.error(error);
    } finally {
      setExporting(false);
    }
  }

  const def = definition.data;
  const pagination = rows.data?.meta?.pagination;
  const filterColumns = (def?.columns ?? []).filter((c) => c.filter);

  return (
    <>
      <PageHeader
        title="Setup reports"
        description="Read-only views over the institution's setup data. Filters and search also apply to the CSV export."
        actions={
          <Button onClick={exportCsv} busy={exporting} disabled={!def}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Report">
        {SETUP_REPORTS.map((r) => (
          <button
            key={r.key}
            role="tab"
            aria-selected={r.key === report}
            onClick={() => setParams({ report: r.key })}
            className={`rounded-full px-3 py-1 text-sm ${r.key === report ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {r.title}
          </button>
        ))}
      </div>
      {definition.isLoading ? (
        <Loading />
      ) : definition.error ? (
        <ErrorBanner error={definition.error} onRetry={() => definition.refetch()} />
      ) : (
        def && (
          <>
            <p className="mb-3 text-sm text-slate-600">{def.description}</p>
            <TableCard
              rows={rows.data?.data ?? []}
              rowKey={(row) => JSON.stringify(row)}
              loading={rows.isLoading}
              error={rows.error}
              onRetry={() => rows.refetch()}
              empty="No rows match."
              toolbar={
                <>
                  <input className="input max-w-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  {filterColumns.map((c) => (
                    <select
                      key={c.key}
                      className="input w-auto"
                      aria-label={c.header}
                      value={filters[c.key] ?? ""}
                      onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))}
                    >
                      <option value="">{c.header}: all</option>
                      {(def.filterOptions[c.key] ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ))}
                </>
              }
              footer={pagination && <Pager page={pagination.page} pages={pagination.totalPages} total={pagination.total} onPage={setPage} />}
              columns={def.columns.map((c) => ({ header: c.header, cell: (row: Record<string, string>) => row[c.key] || "—" }))}
            />
          </>
        )
      )}
    </>
  );
}
