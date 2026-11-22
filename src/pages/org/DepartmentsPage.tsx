import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createDepartment, deleteDepartment, listDepartments, listSchools, setDepartmentHead, updateDepartment } from "../../api/endpoints";
import type { Department } from "../../api/types";
import { FormModal, isUpperCode, STATUS_OPTIONS, str, text, type FieldSpec } from "../../components/FormModal";
import { LeaderModal } from "../../components/LeaderModal";
import { TableCard } from "../../components/TableCard";
import { Badge, Button, ConfirmDialog, PageHeader } from "../../components/ui";
import { deleteOrExplain, useAction } from "../../lib/useAction";

export function DepartmentsPage() {
  const departments = useQuery({ queryKey: ["departments"], queryFn: listDepartments });
  const schools = useQuery({ queryKey: ["schools"], queryFn: listSchools });
  const [schoolFilter, setSchoolFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Department | null | undefined>(undefined);
  const [headFor, setHeadFor] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  const save = useAction(
    ({ dept, schoolId, body }: { dept: Department | null; schoolId: string; body: Partial<Department> }) =>
      dept ? updateDepartment(dept.id, schoolId, body) : createDepartment(schoolId, body),
    { invalidate: [["departments"]], success: (a, r) => `${a.dept ? "Saved" : "Created"} ${r.name}.`, onDone: () => setEditing(undefined) },
  );
  const head = useAction(({ dept, userId }: { dept: Department; userId?: string }) => setDepartmentHead(dept.id, userId), {
    invalidate: [["departments"]],
    success: (a) => (a.userId ? `Head of ${a.dept.name} updated.` : `Head of ${a.dept.name} cleared.`),
    onDone: () => setHeadFor(null),
  });
  const remove = useAction((dept: Department) => deleteOrExplain(() => deleteDepartment(dept.id), dept.name), {
    invalidate: [["departments"]],
    success: (d) => `${d.name} deleted.`,
    onDone: () => setDeleting(null),
  });

  const schoolOptions = (schools.data ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));
  const fields: FieldSpec[] = [
    { name: "schoolId", label: "School", type: "select", required: true, options: schoolOptions },
    { name: "name", label: "Name", required: true, placeholder: "Computing and Informatics" },
    { name: "code", label: "Code", required: true, validate: isUpperCode },
    { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    { name: "description", label: "Description", type: "textarea" },
  ];

  const needle = search.trim().toLowerCase();
  const rows = (departments.data ?? [])
    .filter((d) => !schoolFilter || d.school?.id === schoolFilter)
    .filter((d) => !needle || d.name.toLowerCase().includes(needle) || d.code.toLowerCase().includes(needle))
    .sort((a, b) => (a.school?.name ?? "").localeCompare(b.school?.name ?? "") || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Departments"
        description="Departments within each school. The head of department is the Department module's scope: marks, units and clearances."
        actions={
          <Button variant="primary" onClick={() => setEditing(null)} disabled={!schools.data?.length}>
            New department
          </Button>
        }
      />
      <TableCard
        rows={rows}
        rowKey={(d) => d.id}
        loading={departments.isLoading}
        error={departments.error}
        onRetry={() => departments.refetch()}
        empty={schools.data?.length === 0 ? "Create a school first; every department belongs to one." : "No departments match."}
        toolbar={
          <>
            <input className="input max-w-xs" placeholder="Search name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="input w-auto" aria-label="School" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
              <option value="">All schools</option>
              {schoolOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </>
        }
        columns={[
          {
            header: "Department",
            cell: (d) => (
              <>
                <div className="font-medium">{d.name}</div>
                <code className="text-xs text-slate-500">{d.code}</code>
              </>
            ),
          },
          { header: "School", cell: (d) => d.school?.name ?? "—" },
          {
            header: "Head",
            cell: (d) =>
              d.hodName ? (
                <>
                  <div>{d.hodName}</div>
                  <div className="text-xs text-slate-500">{d.hodEmail}</div>
                </>
              ) : (
                <span className="text-slate-400">None</span>
              ),
          },
          { header: "Status", cell: (d) => <Badge tone={d.status === "Inactive" ? "gray" : "green"}>{d.status || "Active"}</Badge> },
          {
            header: "Actions",
            className: "text-right",
            cell: (d) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" onClick={() => setEditing(d)}>
                  Edit
                </Button>
                <Button size="sm" onClick={() => setHeadFor(d)}>
                  Head
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(d)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      {editing !== undefined && (
        <FormModal
          title={editing ? `Edit ${editing.name}` : "New department"}
          fields={fields}
          initial={{
            schoolId: editing?.school?.id ?? schoolFilter,
            name: str(editing?.name),
            code: str(editing?.code),
            status: editing?.status || "Active",
            description: str(editing?.description),
          }}
          submitLabel={editing ? "Save department" : "Create department"}
          busy={save.isPending}
          onClose={() => setEditing(undefined)}
          onSubmit={(v) =>
            save.mutate({
              dept: editing,
              schoolId: String(v.schoolId),
              body: { name: text(v.name), code: text(v.code), status: text(v.status), description: text(v.description) },
            })
          }
        />
      )}
      {headFor && (
        <LeaderModal
          title={`Head of ${headFor.name}`}
          role="head"
          currentUserId={headFor.headUserId}
          busy={head.isPending}
          onClose={() => setHeadFor(null)}
          onSave={(userId) => head.mutate({ dept: headFor, userId })}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete department"
        danger
        confirmLabel="Delete"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
        message={
          deleting && (
            <>
              Delete <strong>{deleting.name}</strong>? This can't be undone. The server refuses while courses or course units still belong to it; set it Inactive instead
              to keep its history.
            </>
          )
        }
      />
    </>
  );
}
