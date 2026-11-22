import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClassroom, deleteClassroom, listCampuses, listClassrooms, updateClassroom } from "../../api/endpoints";
import type { Classroom } from "../../api/types";
import { FormModal, isWholeNumber, num, str, text, type FieldSpec } from "../../components/FormModal";
import { TableCard } from "../../components/TableCard";
import { Badge, Button, ConfirmDialog, PageHeader } from "../../components/ui";
import { useAction } from "../../lib/useAction";

export function ClassroomsPage() {
  const rooms = useQuery({ queryKey: ["classrooms"], queryFn: listClassrooms });
  const campuses = useQuery({ queryKey: ["campuses"], queryFn: listCampuses });
  const [campusFilter, setCampusFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Classroom | null | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<Classroom | null>(null);

  const save = useAction(
    ({ room, campusId, body }: { room: Classroom | null; campusId?: string; body: Partial<Classroom> }) =>
      room ? updateClassroom(room.id, campusId, body) : createClassroom(campusId, body),
    { invalidate: [["classrooms"]], success: (a, r) => `${a.room ? "Saved" : "Created"} room ${r.roomNumber}.`, onDone: () => setEditing(undefined) },
  );
  const deactivate = useAction((room: Classroom) => deleteClassroom(room.id), {
    invalidate: [["classrooms"]],
    success: (r) => `Room ${r.roomNumber} deactivated.`,
    onDone: () => setDeactivating(null),
  });

  const campusOptions = (campuses.data ?? []).map((c) => ({ value: c.id, label: c.name }));
  const fields: FieldSpec[] = [
    { name: "roomNumber", label: "Room", required: true, placeholder: "LT 3", validate: (v) => (v.length > 50 ? "At most 50 characters." : undefined) },
    { name: "building", label: "Building", placeholder: "Science Block" },
    { name: "campusId", label: "Campus", type: "select", options: campusOptions },
    { name: "capacity", label: "Capacity", type: "number", validate: isWholeNumber(1, 5000) },
    { name: "description", label: "Description", type: "textarea" },
    { name: "active", label: "Active", type: "checkbox", description: "Only active rooms can be timetabled." },
  ];

  const rows = (rooms.data ?? [])
    .filter((r) => showInactive || r.active)
    .filter((r) => !campusFilter || r.campus?.id === campusFilter)
    .sort((a, b) => (a.building ?? "").localeCompare(b.building ?? "") || a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

  return (
    <>
      <PageHeader
        title="Buildings & classrooms"
        description="Rooms available for the timetable, by campus and building. Removing a room only deactivates it."
        actions={
          <Button variant="primary" onClick={() => setEditing(null)}>
            New room
          </Button>
        }
      />
      <TableCard
        rows={rows}
        rowKey={(r) => r.id}
        loading={rooms.isLoading}
        error={rooms.error}
        onRetry={() => rooms.refetch()}
        empty="No rooms match."
        rowClassName={(r) => (r.active ? undefined : "text-slate-500")}
        toolbar={
          <>
            <select className="input w-auto" aria-label="Campus" value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)}>
              <option value="">All campuses</option>
              {campusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="accent-brand-700" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
          </>
        }
        columns={[
          { header: "Room", cell: (r) => <span className="font-medium">{r.roomNumber}</span> },
          { header: "Building", cell: (r) => r.building || "—" },
          { header: "Campus", cell: (r) => r.campus?.name ?? "—" },
          { header: "Capacity", cell: (r) => r.capacity ?? "—" },
          { header: "Status", cell: (r) => (r.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>) },
          {
            header: "Actions",
            className: "text-right",
            cell: (r) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" onClick={() => setEditing(r)}>
                  Edit
                </Button>
                {r.active && (
                  <Button size="sm" variant="ghost" onClick={() => setDeactivating(r)}>
                    Deactivate
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      {editing !== undefined && (
        <FormModal
          title={editing ? `Edit room ${editing.roomNumber}` : "New room"}
          fields={fields}
          initial={{
            roomNumber: str(editing?.roomNumber),
            building: str(editing?.building),
            campusId: editing?.campus?.id ?? campusFilter,
            capacity: str(editing?.capacity),
            description: str(editing?.description),
            active: editing?.active ?? true,
          }}
          submitLabel={editing ? "Save room" : "Create room"}
          busy={save.isPending}
          onClose={() => setEditing(undefined)}
          onSubmit={(v) =>
            save.mutate({
              room: editing,
              campusId: text(v.campusId),
              body: { roomNumber: text(v.roomNumber), building: text(v.building), capacity: num(v.capacity), description: text(v.description), active: Boolean(v.active) },
            })
          }
        />
      )}
      <ConfirmDialog
        open={deactivating !== null}
        title="Deactivate room"
        danger
        confirmLabel="Deactivate"
        busy={deactivate.isPending}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && deactivate.mutate(deactivating)}
        message={deactivating && <>Deactivate room <strong>{deactivating.roomNumber}</strong>? It stops being offered for the timetable; edit it to reactivate.</>}
      />
    </>
  );
}
