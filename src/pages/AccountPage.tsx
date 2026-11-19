import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { changePassword } from "../api/endpoints";
import { Button, Field, PageHeader } from "../components/ui";
import { useToast } from "../components/Toast";
import { PASSWORD_HINT, PASSWORD_RULE } from "../lib/format";

export function AccountPage() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);

  const errors = {
    current: current ? undefined : "Required.",
    next: PASSWORD_RULE.test(next) ? (next === current ? "Choose a different password." : undefined) : PASSWORD_HINT,
    confirm: confirm === next ? undefined : "Does not match.",
  };

  const mutation = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
      setTouched(false);
    },
    onError: (error) => toast.error(error),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!errors.current && !errors.next && !errors.confirm) mutation.mutate();
  }

  return (
    <>
      <PageHeader title="My password" />
      <form onSubmit={submit} noValidate className="card max-w-md space-y-4 p-5">
        <Field label="Current password" error={touched ? errors.current : undefined}>
          {(id) => <input id={id} type="password" autoComplete="current-password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} />}
        </Field>
        <Field label="New password" error={touched ? errors.next : undefined} hint={PASSWORD_HINT}>
          {(id) => <input id={id} type="password" autoComplete="new-password" className="input" value={next} onChange={(e) => setNext(e.target.value)} />}
        </Field>
        <Field label="Repeat new password" error={touched ? errors.confirm : undefined}>
          {(id) => <input id={id} type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" busy={mutation.isPending}>
          Change password
        </Button>
      </form>
    </>
  );
}
