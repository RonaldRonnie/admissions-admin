import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSchool, deleteSchool, listDepartments, listSchools, setSchoolDean, updateSchool } from "../../api/endpoints";
import type { School } from "../../api/types";
import { FormModal, isUpperCode, STATUS_OPTIONS, str, text, type FieldSpec } from "../../components/FormModal";
import { LeaderModal } from "../../components/LeaderModal";
import { TableCard } from "../../components/TableCard";
import { Badge, Button, ConfirmDialog, PageHeader } from "../../components/ui";
import { deleteOrExplain, useAction } from "../../lib/useAction";

const FIELDS: FieldSpec[] = [
  { name: "name", label: "Name", required: true, placeholder: "School of Science and Technology" },
  { name: "code", label: "Code", required: true, validate: isUpperCode, hint: "Uppercase letters and digits." },
  { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
  { name: "description", label: "Description", type: "textarea" },
];

export function SchoolsPage() {
  const schools = useQuery({ queryKey: ["schools"], queryFn: listSchools });
  const departments = useQuery({ queryKey: ["departments"], queryFn: listDepartments });
  const [editing, setEditing] = useState<School | null | undefined>(undefined);
  const [deanFor, setDeanFor] = useState<School | null>(null);
  const [deleting, setDeleting] = useState<School | null>(null);

  const save = useAction(
    ({ school, body }: { school: School | null; body: Partial<School> }) => (school ? updateSchool(school.id, body) : createSchool(body)),
    { invalidate: [["schools"]], success: (a, r) => `${a.school ? "Saved" : "Created"} ${r.name}.`, onDone: () => setEditing(undefined) },
  );
  const dean = useAction(({ school, userId }: { school: School; userId?: string }) => setSchoolDean(school.id, userId), {
    invalidate: [["schools"]],
    success: (a) => (a.userId ? `Dean of ${a.school.name} updated.` : `Dean of ${a.school.name} cleared.`),
    onDone: () => setDeanFor(null),
  });
  const remove = useAction((school: School) => deleteOrExplain(() => deleteSchool(school.id), school.name), {
    invalidate: [["schools"]],
    success: (s) => `${s.name} deleted.`,
    onDone: () => setDeleting(null),
  });

  const deptCount = (id: string) => (departments.data ?? []).filter((d) => d.school?.id === id).length;
  const rows = [...(schools.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Schools"
        description="Faculties and schools. Each has an optional dean, which scopes the Dean module to that school's departments."
        actions={
          <Button variant="primary" onClick={() => setEditing(null)}>
            New school
          </Button>
        }
      />
      <TableCard
        rows={rows}
        rowKey={(s) => s.id}
        loading={schools.isLoading}
        error={schools.error}
        onRetry={() => schools.refetch()}
        empty="No schools yet. Departments and courses belong to a school, so start here."
        columns={[
          {
            header: "School",
            cell: (s) => (
              <>
                <div className="font-medium">{s.name}</div>
                <code className="text-xs text-slate-500">{s.code}</code>
              </>
            ),
          },
          {
            header: "Dean",
            cell: (s) =>
              s.deanName ? (
                <>
                  <div>{s.deanName}</div>
                  <div className="text-xs text-slate-500">{s.deanEmail}</div>
                </>
              ) : (
                <span className="text-slate-400">None</span>
              ),
          },
          { header: "Departments", cell: (s) => deptCount(s.id) },
          { header: "Status", cell: (s) => <Badge tone={s.status === "Inactive" ? "gray" : "green"}>{s.status || "Active"}</Badge> },
          {
            header: "Actions",
            className: "text-right",
            cell: (s) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" onClick={() => setEditing(s)}>
                  Edit
                </Button>
                <Button size="sm" onClick={() => setDeanFor(s)}>
                  Dean
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(s)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      {editing !== undefined && (
        <FormModal
          title={editing ? `Edit ${editing.name}` : "New school"}
          fields={FIELDS}
          initial={{ name: str(editing?.name), code: str(editing?.code), status: editing?.status || "Active", description: str(editing?.description) }}
          submitLabel={editing ? "Save school" : "Create school"}
          busy={save.isPending}
          onClose={() => setEditing(undefined)}
          onSubmit={(v) =>
            save.mutate({
              school: editing,
              body: { name: text(v.name), code: text(v.code), status: text(v.status), description: text(v.description) },
            })
          }
        />
      )}
      {deanFor && (
        <LeaderModal
          title={`Dean of ${deanFor.name}`}
          role="dean"
          currentUserId={deanFor.deanUserId}
          busy={dean.isPending}
          onClose={() => setDeanFor(null)}
          onSave={(userId) => dean.mutate({ school: deanFor, userId })}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete school"
        danger
        confirmLabel="Delete"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
        message={
          deleting && (
            <>
              Delete <strong>{deleting.name}</strong>? This can't be undone. The server refuses while departments or courses still belong to it; set it Inactive
              instead to keep its history.
            </>
          )
        }
      />
    </>
  );
}
