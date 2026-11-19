import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bulkSetGrants, getCatalog, listRoleTemplates } from "../../api/endpoints";
import type { GrantSet, User } from "../../api/types";
import { EMPTY_GRANTS, GrantsEditor } from "../../components/GrantsEditor";
import { Button, ErrorBanner, Loading, Modal } from "../../components/ui";
import { useToast } from "../../components/Toast";

export function BulkGrantModal({
  users,
  open,
  onClose,
  onApplied,
}: {
  users: User[];
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [grants, setGrants] = useState<GrantSet>(EMPTY_GRANTS);
  const [mode, setMode] = useState<"ADD" | "REPLACE">("ADD");
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => getCatalog(), enabled: open });
  const templates = useQuery({ queryKey: ["role-templates"], queryFn: listRoleTemplates, enabled: open });

  // The API rejects the whole batch if any target isn't an ADMIN-role account and admin scope is requested.
  const allAdmins = users.every((u) => u.role === "ADMIN");

  const mutation = useMutation({
    mutationFn: () => bulkSetGrants({ userIds: users.map((u) => u.id), grants, mode }),
    onSuccess: () => {
      toast.success(`Access updated for ${users.length} user${users.length === 1 ? "" : "s"}.`);
      queryClient.invalidateQueries({ queryKey: ["grants"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      onApplied();
    },
    onError: (error) => toast.error(error),
  });

  const empty = Object.values(grants).every((list) => list.length === 0);

  return (
    <Modal
      wide
      title={`Grant access to ${users.length} selected user${users.length === 1 ? "" : "s"}`}
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={mode === "REPLACE" ? "danger" : "primary"}
            busy={mutation.isPending}
            disabled={empty && mode === "ADD"}
            onClick={() => mutation.mutate()}
          >
            {mode === "ADD" ? "Add to their access" : "Replace their access"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-semibold text-slate-800">How to apply</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="mode" className="mt-1 accent-brand-700" checked={mode === "ADD"} onChange={() => setMode("ADD")} />
            <span>
              <strong>Add</strong>: keep what each user already has and add the selection below.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="mode" className="mt-1 accent-brand-700" checked={mode === "REPLACE"} onChange={() => setMode("REPLACE")} />
            <span>
              <strong>Replace</strong>: throw away each user's current grants and give them exactly the selection below.
            </span>
          </label>
        </fieldset>
        {catalog.isLoading || templates.isLoading ? (
          <Loading />
        ) : catalog.error || templates.error ? (
          <ErrorBanner error={catalog.error ?? templates.error} />
        ) : (
          <GrantsEditor
            catalog={catalog.data ?? []}
            templates={templates.data ?? []}
            value={grants}
            onChange={setGrants}
            allowAdminScope={allAdmins}
          />
        )}
      </div>
    </Modal>
  );
}
