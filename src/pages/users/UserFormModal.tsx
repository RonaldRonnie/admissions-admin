import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUser, updateUser } from "../../api/endpoints";
import { ROLE_LABELS, STAFF_ROLES, USER_ROLES, type User, type UserRole } from "../../api/types";
import { Button, Checkbox, Field, Modal } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { fullName, generatePassword, PASSWORD_HINT, PASSWORD_RULE, PHONE_RULE } from "../../lib/format";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  enabled: boolean;
  password: string;
}

const NAME_RULE = /^[\p{L}][\p{L}\s'.-]*$/u;

function validate(form: FormState, creating: boolean): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  for (const key of ["firstName", "lastName"] as const) {
    const value = form[key].trim();
    if (value.length < 2 || value.length > 50) errors[key] = "Between 2 and 50 characters.";
    else if (!NAME_RULE.test(value)) errors[key] = "Letters, spaces, hyphens, apostrophes and periods only.";
  }
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (!PHONE_RULE.test(form.phone.trim())) errors.phone = "Digits only, optionally starting with +, e.g. +256701234567.";
  if (creating || form.password) {
    if (!PASSWORD_RULE.test(form.password)) errors.password = PASSWORD_HINT;
  }
  return errors;
}

export function UserFormModal({ user, open, onClose, selfId }: { user: User | null; open: boolean; onClose: () => void; selfId?: string }) {
  const creating = user === null;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => ({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user?.role ?? "ADMISSIONS_OFFICER",
    enabled: user?.enabled ?? true,
    password: "",
  }));
  const [touched, setTouched] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const errors = validate(form, creating);
  const isSelf = user?.id === selfId;

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        enabled: form.enabled,
      };
      return creating
        ? createUser({ ...body, password: form.password })
        : updateUser(user.id, { ...body, password: form.password || undefined });
    },
    onSuccess: (saved) => {
      toast.success(creating ? `Created ${fullName(saved)}.` : `Saved ${fullName(saved)}.`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
      onClose();
    },
    onError: (error) => toast.error(error),
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length === 0) mutation.mutate();
  }

  const show = (key: keyof FormState) => (touched ? errors[key] : undefined);
  // Applicants self-register; the API refuses to create one here, but an existing applicant can be edited.
  const roles = creating ? STAFF_ROLES : USER_ROLES;

  return (
    <Modal
      title={creating ? "New staff account" : `Edit ${fullName(user)}`}
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-form" variant="primary" busy={mutation.isPending}>
            {creating ? "Create account" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={show("firstName")}>
          {(id) => <input id={id} className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />}
        </Field>
        <Field label="Last name" error={show("lastName")}>
          {(id) => <input id={id} className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Email" error={show("email")}>
            {(id) => <input id={id} type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />}
          </Field>
        </div>
        <Field label="Phone (optional)" error={show("phone")}>
          {(id) => <input id={id} type="tel" className="input" placeholder="+256701234567" value={form.phone} onChange={(e) => set("phone", e.target.value)} />}
        </Field>
        <Field label="Role" hint={isSelf ? "You cannot change your own role." : undefined}>
          {(id) => (
            <select id={id} className="input" value={form.role} disabled={isSelf} onChange={(e) => set("role", e.target.value as UserRole)}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field
            label={creating ? "Password" : "New password (leave blank to keep the current one)"}
            error={show("password")}
            hint={PASSWORD_HINT}
          >
            {(id) => (
              <div className="flex gap-2">
                <input
                  id={id}
                  type={revealed ? "text" : "password"}
                  autoComplete="new-password"
                  className="input font-mono"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                />
                <Button onClick={() => setRevealed((r) => !r)}>{revealed ? "Hide" : "Show"}</Button>
                <Button
                  onClick={() => {
                    set("password", generatePassword());
                    setRevealed(true);
                  }}
                >
                  Generate
                </Button>
              </div>
            )}
          </Field>
          {revealed && form.password && (
            <p className="mt-2 text-xs text-amber-700">Copy this password now and hand it over securely; it is not shown again after you save.</p>
          )}
        </div>
        {!creating && (
          <div className="sm:col-span-2">
            <Checkbox
              label="Account enabled"
              description={isSelf ? "You cannot disable your own account." : "Unticking this disables the account (status becomes Disabled)."}
              checked={form.enabled}
              disabled={isSelf}
              onChange={(on) => set("enabled", on)}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
