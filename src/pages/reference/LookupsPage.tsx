import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { createLookup, deleteLookup, listLookupCategories, listLookups, updateLookup } from "../../api/endpoints";
import type { LookupValue } from "../../api/types";
import { FormModal, isWholeNumber, str, text, type FieldSpec } from "../../components/FormModal";
import { Pager, TableCard } from "../../components/TableCard";
import { Badge, Button, ConfirmDialog, ErrorBanner, Loading, PageHeader } from "../../components/ui";
import { useAction } from "../../lib/useAction";

const LIMIT = 25;

const FIELDS: FieldSpec[] = [
  { name: "name", label: "Name", required: true, validate: (v) => (v.length > 200 ? "At most 200 characters." : undefined) },
  { name: "code", label: "Code", validate: (v) => (v.length > 50 ? "At most 50 characters." : undefined) },
  { name: "sortOrder", label: "Sort order", type: "number", validate: isWholeNumber(0), hint: "Lower numbers are listed first." },
  { name: "description", label: "Description", type: "textarea" },
  { name: "active", label: "Active", type: "checkbox", description: "Inactive values stay on old records but can't be picked for new ones." },
];

/**
 * The Setup module's reference lists (religions, sponsors, grading scales, ...): one table per
 * LookupCategory, all served by LookupValueController.
 */
export function LookupsPage() {
  const [params, setParams] = useSearchParams();
  const category = params.get("list") ?? "";
  const categories = useQuery({ queryKey: ["lookup-categories"], queryFn: listLookupCategories });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<LookupValue | null | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<LookupValue | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => setPage(1), [category, query]);

  const sorted = [...(categories.data ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const current = sorted.find((c) => c.key === category);

  const values = useQuery({
    queryKey: ["lookups", category, page, query],
    queryFn: () => listLookups(category, page, LIMIT, query || undefined),
    enabled: Boolean(category),
    placeholderData: keepPreviousData,
  });

  const save = useAction(
    ({ value, body }: { value: LookupValue | null; body: Partial<LookupValue> }) =>
      value ? updateLookup(category, value.id, body) : createLookup(category, body),
    { invalidate: [["lookups", category]], success: (a, r) => `${a.value ? "Saved" : "Added"} ${r.name}.`, onDone: () => setEditing(undefined) },
  );
  const deactivate = useAction((value: LookupValue) => deleteLookup(category, value.id), {
    invalidate: [["lookups", category]],
    success: (v) => `${v.name} deactivated.`,
    onDone: () => setDeactivating(null),
  });

  const pagination = values.data?.meta?.pagination;

  return (
    <>
      <PageHeader
        title="Reference lists"
        description="The pick-lists used across admissions, the registrar and the student record. Removing a value only deactivates it."
        actions={
          current && (
            <Button variant="primary" onClick={() => setEditing(null)}>
              New value
            </Button>
          )
        }
      />
      {categories.isLoading ? (
        <Loading />
      ) : categories.error ? (
        <ErrorBanner error={categories.error} onRetry={() => categories.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <nav className="card h-fit max-h-[70vh] overflow-y-auto p-2" aria-label="Lists">
            {sorted.map((c) => (
              <button
                key={c.key}
                onClick={() => setParams({ list: c.key })}
                className={`block w-full rounded-md px-3 py-1.5 text-left text-sm ${c.key === category ? "bg-brand-50 font-medium text-brand-700" : "hover:bg-slate-50"}`}
              >
                {c.displayName}
              </button>
            ))}
          </nav>
          {!current ? (
            <div className="card p-8 text-center text-sm text-slate-600">Choose a list on the left. There are {sorted.length} of them.</div>
          ) : (
            <div>
              <p className="mb-3 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{current.displayName}</span> · staff edit it with <code className="text-xs">{current.permissionKey}</code>
              </p>
              <TableCard
                rows={values.data?.data ?? []}
                rowKey={(v) => v.id}
                loading={values.isLoading}
                error={values.error}
                onRetry={() => values.refetch()}
                empty={query ? "No values match." : "This list is empty."}
                rowClassName={(v) => (v.active ? undefined : "text-slate-500")}
                toolbar={<input className="input max-w-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />}
                footer={pagination && <Pager page={pagination.page} pages={pagination.totalPages} total={pagination.total} onPage={setPage} />}
                columns={[
                  { header: "Name", cell: (v) => <span className="font-medium">{v.name}</span> },
                  { header: "Code", cell: (v) => (v.code ? <code className="text-xs">{v.code}</code> : "—") },
                  { header: "Order", cell: (v) => v.sortOrder },
                  { header: "Status", cell: (v) => (v.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>) },
                  {
                    header: "Actions",
                    className: "text-right",
                    cell: (v) => (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => setEditing(v)}>
                          Edit
                        </Button>
                        {v.active && (
                          <Button size="sm" variant="ghost" onClick={() => setDeactivating(v)}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </div>
      )}

      {editing !== undefined && current && (
        <FormModal
          title={editing ? `Edit ${editing.name}` : `New value in ${current.displayName}`}
          fields={FIELDS}
          initial={{
            name: str(editing?.name),
            code: str(editing?.code),
            sortOrder: str(editing?.sortOrder ?? 0),
            description: str(editing?.description),
            active: editing?.active ?? true,
          }}
          submitLabel={editing ? "Save value" : "Add value"}
          busy={save.isPending}
          onClose={() => setEditing(undefined)}
          onSubmit={(v) =>
            save.mutate({
              value: editing,
              body: { name: text(v.name), code: text(v.code), sortOrder: Number(v.sortOrder || 0), description: text(v.description), active: Boolean(v.active) },
            })
          }
        />
      )}
      <ConfirmDialog
        open={deactivating !== null}
        title="Deactivate value"
        danger
        confirmLabel="Deactivate"
        busy={deactivate.isPending}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && deactivate.mutate(deactivating)}
        message={deactivating && <>Deactivate <strong>{deactivating.name}</strong>? Existing records keep it; it just can't be picked any more.</>}
      />
    </>
  );
}
