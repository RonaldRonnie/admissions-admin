import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUser } from "../../api/endpoints";
import type { User } from "../../api/types";
import { useToast } from "../../components/Toast";
import { Button, Field, Modal } from "../../components/ui";
import { fullName, generatePassword, PASSWORD_HINT, PASSWORD_RULE } from "../../lib/format";

/**
 * Sets a new password for someone who has lost theirs. The API has no admin-only reset call, so
 * this is the user update with every other field sent back unchanged.
 */
export function ResetPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [password, setPassword] = useState(() => generatePassword());
  const [done, setDone] = useState(false);
  const valid = PASSWORD_RULE.test(password);

  const mutation = useMutation({
    mutationFn: () =>
      updateUser(user.id, {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone ?? undefined,
        role: user.role,
        enabled: user.enabled,
        password,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      toast.success(`New password set for ${fullName(user)}.`);
      setDone(true);
    },
    onError: (error) => toast.error(error),
  });

  return (
    <Modal
      open
      title={`Reset password: ${fullName(user)}`}
      onClose={onClose}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!valid} busy={mutation.isPending} onClick={() => mutation.mutate()}>
              Set password
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4 text-sm text-slate-700">
        <p>
          {user.email}. The old password stops working at once. Ask them to change this one under My password after signing in.
        </p>
        <Field label="New password" hint={PASSWORD_HINT} error={password && !valid ? PASSWORD_HINT : undefined}>
          {(id) => (
            <div className="flex gap-2">
              <input id={id} className="input font-mono" value={password} readOnly={done} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
              {!done && <Button onClick={() => setPassword(generatePassword())}>Generate</Button>}
              <Button
                onClick={() =>
                  navigator.clipboard?.writeText(password).then(
                    () => toast.success("Copied."),
                    () => toast.error("Copy failed; select the text instead."),
                  )
                }
              >
                Copy
              </Button>
            </div>
          )}
        </Field>
        {done && <p className="text-amber-700">Hand this password over securely now. It isn't shown again after you close this.</p>}
      </div>
    </Modal>
  );
}
