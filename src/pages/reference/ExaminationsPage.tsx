import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createExamination, deleteExamination, listAcademicYears, listCourses, listExaminations, updateExamination } from "../../api/endpoints";
import { EXAMINATION_TYPES, type Examination } from "../../api/types";
import { FormModal, isPositiveNumber, isWholeNumber, num, str, text, type FieldSpec, type FormValues } from "../../components/FormModal";
import { Pager, TableCard } from "../../components/TableCard";
import { Badge, Button, ConfirmDialog, PageHeader } from "../../components/ui";
import { formatDateTime, toDate } from "../../lib/format";
import { deleteOrExplain, useAction } from "../../lib/useAction";

const LIMIT = 25;
const STATUSES = ["Draft", "Scheduled", "Completed", "Cancelled"].map((s) => ({ value: s, label: s }));

/** "YYYY-MM-DDTHH:mm" for a datetime-local input, from the API's LocalDateTime. */
function toLocalInput(value: Examination["dueDate"]): string {
  const d = toDate(value);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExaminationsPage() {
  const [page, setPage] = useState(1);
  const exams = useQuery({ queryKey: ["examinations", page], queryFn: () => listExaminations(page, LIMIT), placeholderData: keepPreviousData });
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const years = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });
  const [editing, setEditing] = useState<Examination | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Examination | null>(null);

  const save = useAction(
    ({ exam, v }: { exam: Examination | null; v: FormValues }) => {
      const body: Partial<Examination> = {
        title: text(v.title),
        type: text(v.type),
        maxMarks: num(v.maxMarks),
        weight: num(v.weight),
        passingMarks: num(v.passingMarks),
        dueDate: `${String(v.dueDate)}:00`,
        durationMinutes: num(v.durationMinutes),
        academicYear: text(v.academicYear),
        semester: text(v.semester),
        status: text(v.status),
        instructions: text(v.instructions),
      };
      // AssessmentService#update overwrites these two lists with whatever is sent; keep them.
      return exam
        ? updateExamination(exam.id, { ...body, learningOutcomes: exam.learningOutcomes ?? [], skillsAssessed: exam.skillsAssessed ?? [] })
        : createExamination(String(v.courseId), body);
    },
    { invalidate: [["examinations"]], success: (a, r) => `${a.exam ? "Saved" : "Scheduled"} ${r.title}.`, onDone: () => setEditing(undefined) },
  );
  const remove = useAction((exam: Examination) => deleteOrExplain(() => deleteExamination(exam.id), exam.title), {
    invalidate: [["examinations"]],
    success: (e) => `${e.title} deleted.`,
    onDone: () => setDeleting(null),
  });

  const creating = editing === null;
  const courseOptions = [...(courses.data ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: `${c.courseCode} · ${c.name}` }));
  const yearOptions = (years.data ?? []).map((y) => ({ value: y.name, label: y.current ? `${y.name} (current)` : y.name }));
  const fields: FieldSpec[] = [
    { name: "courseId", label: "Course", type: "select", options: courseOptions, required: creating, disabled: !creating, wide: true },
    { name: "title", label: "Title", required: true, wide: true, placeholder: "End of Semester 1 Examinations" },
    { name: "type", label: "Type", type: "select", required: true, options: EXAMINATION_TYPES.map((t) => ({ value: t, label: t })) },
    { name: "status", label: "Status", type: "select", options: STATUSES },
    { name: "academicYear", label: "Academic year", type: "select", required: true, options: yearOptions, disabled: !creating },
    { name: "semester", label: "Semester", required: true, placeholder: "Semester 1", disabled: !creating, hint: creating ? "The term name, as in the calendar." : "Fixed after creation." },
    { name: "dueDate", label: "Date and time", type: "datetime-local", required: true },
    { name: "durationMinutes", label: "Duration (minutes)", type: "number", validate: isWholeNumber(1, 600) },
    { name: "maxMarks", label: "Maximum marks", type: "number", required: true, validate: isPositiveNumber },
    {
      name: "weight",
      label: "Weight (%)",
      type: "number",
      required: true,
      validate: (v) => (Number(v) > 0 && Number(v) <= 100 ? undefined : "Between 0 and 100."),
    },
    {
      name: "passingMarks",
      label: "Pass mark",
      type: "number",
      validate: (v, all) => (Number(v) >= 0 && (!all.maxMarks || Number(v) <= Number(all.maxMarks)) ? undefined : "From 0 up to the maximum marks."),
    },
    { name: "instructions", label: "Instructions", type: "textarea" },
  ];

  const pagination = exams.data?.meta?.pagination;

  return (
    <>
      <PageHeader
        title="Examinations"
        description="Scheduled CATs, midterms, finals and practicals, per course and term. Earliest first."
        actions={
          <Button variant="primary" onClick={() => setEditing(null)} disabled={!courses.data?.length}>
            Schedule examination
          </Button>
        }
      />
      <TableCard
        rows={exams.data?.data ?? []}
        rowKey={(e) => e.id}
        loading={exams.isLoading}
        error={exams.error}
        onRetry={() => exams.refetch()}
        empty="No examinations scheduled."
        footer={pagination && <Pager page={pagination.page} pages={pagination.totalPages} total={pagination.total} onPage={setPage} />}
        columns={[
          {
            header: "Examination",
            cell: (e) => (
              <>
                <div className="font-medium">{e.title}</div>
                <div className="text-xs text-slate-500">{e.course?.courseCode ?? e.course?.name}</div>
              </>
            ),
          },
          { header: "Type", cell: (e) => <Badge tone="blue">{e.type}</Badge> },
          { header: "Term", cell: (e) => `${e.academicYear} · ${e.semester}` },
          {
            header: "When",
            cell: (e) => (
              <>
                <div>{formatDateTime(e.dueDate)}</div>
                {e.durationMinutes && <div className="text-xs text-slate-500">{e.durationMinutes} min</div>}
              </>
            ),
          },
          { header: "Marks", cell: (e) => `${e.maxMarks} · ${e.weight}%` },
          { header: "Status", cell: (e) => <Badge>{e.status || "Draft"}</Badge> },
          {
            header: "Actions",
            className: "text-right",
            cell: (e) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" onClick={() => setEditing(e)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(e)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />

      {editing !== undefined && (
        <FormModal
          title={editing ? `Edit ${editing.title}` : "Schedule examination"}
          fields={fields}
          initial={{
            courseId: str(editing?.course?.id),
            title: str(editing?.title),
            type: editing?.type ?? "Final Exam",
            status: editing?.status || "Draft",
            academicYear: editing?.academicYear ?? years.data?.find((y) => y.current)?.name ?? "",
            semester: str(editing?.semester),
            dueDate: toLocalInput(editing?.dueDate ?? null),
            durationMinutes: str(editing?.durationMinutes),
            maxMarks: str(editing?.maxMarks ?? 100),
            weight: str(editing?.weight ?? 60),
            passingMarks: str(editing?.passingMarks),
            instructions: str(editing?.instructions),
          }}
          submitLabel={editing ? "Save examination" : "Schedule"}
          busy={save.isPending}
          onClose={() => setEditing(undefined)}
          onSubmit={(v) => save.mutate({ exam: editing, v })}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete examination"
        danger
        confirmLabel="Delete"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
        message={deleting && <>Delete <strong>{deleting.title}</strong>? This can't be undone.</>}
      />
    </>
  );
}
