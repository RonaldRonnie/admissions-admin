import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button, Checkbox, Field, Modal } from "./ui";

export type FormValues = Record<string, string | boolean>;

export type FieldSpec = {
  name: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  /** Full row on wide screens. */
  wide?: boolean;
  disabled?: boolean;
  /** Returns an error message, or nothing when the value is fine. */
  validate?: (value: string, values: FormValues) => string | undefined;
} & (
  | { type?: "text" | "email" | "number" | "date" | "datetime-local"; placeholder?: string }
  | { type: "textarea" }
  | { type: "select"; options: { value: string; label: string }[]; placeholder?: string }
  | { type: "checkbox"; description?: ReactNode }
);

export function errorsFor(fields: FieldSpec[], values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "checkbox" || f.disabled) continue;
    const value = String(values[f.name] ?? "").trim();
    if (f.required && !value) errors[f.name] = "Required.";
    else if (value && f.validate) {
      const message = f.validate(value, values);
      if (message) errors[f.name] = message;
    }
  }
  return errors;
}

/**
 * A modal form built from field specs. Values stay strings (and booleans for checkboxes); the
 * caller turns them into the request body in onSubmit.
 */
export function FormModal({
  title,
  fields,
  initial,
  submitLabel,
  busy,
  onSubmit,
  onClose,
  intro,
  onChange,
}: {
  title: string;
  fields: FieldSpec[];
  initial: FormValues;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (values: FormValues) => void;
  onClose: () => void;
  intro?: ReactNode;
  /** Lets a field react to another (a department list that follows the chosen school). */
  onChange?: (name: string, values: FormValues) => FormValues;
}) {
  const formId = useId();
  const [values, setValues] = useState<FormValues>(initial);
  const [touched, setTouched] = useState(false);
  const errors = errorsFor(fields, values);

  function set(name: string, value: string | boolean) {
    const next = { ...values, [name]: value };
    setValues(onChange ? onChange(name, next) : next);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length === 0) onSubmit(values);
  }

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" busy={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      {intro && <div className="mb-4 text-sm text-slate-600">{intro}</div>}
      <form id={formId} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.wide || f.type === "textarea" || f.type === "checkbox" ? "sm:col-span-2" : undefined}>
            {f.type === "checkbox" ? (
              <Checkbox label={f.label} description={f.description} checked={Boolean(values[f.name])} disabled={f.disabled} onChange={(on) => set(f.name, on)} />
            ) : (
              <Field label={f.required ? `${f.label} *` : f.label} hint={f.hint} error={touched ? errors[f.name] : undefined}>
                {(id) => {
                  const value = String(values[f.name] ?? "");
                  if (f.type === "textarea")
                    return <textarea id={id} rows={3} className="input" value={value} disabled={f.disabled} onChange={(e) => set(f.name, e.target.value)} />;
                  if (f.type === "select")
                    return (
                      <select id={id} className="input" value={value} disabled={f.disabled} onChange={(e) => set(f.name, e.target.value)}>
                        <option value="">{f.placeholder ?? "Choose…"}</option>
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    );
                  return (
                    <input
                      id={id}
                      type={f.type ?? "text"}
                      className="input"
                      value={value}
                      placeholder={f.placeholder}
                      disabled={f.disabled}
                      onChange={(e) => set(f.name, e.target.value)}
                    />
                  );
                }}
              </Field>
            )}
          </div>
        ))}
      </form>
    </Modal>
  );
}

/** Trimmed text, or undefined so the API keeps its default. */
export const text = (v: string | boolean | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
/** A number, or undefined when blank. */
export const num = (v: string | boolean | undefined) => (typeof v === "string" && v.trim() !== "" ? Number(v) : undefined);
export const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export const isWholeNumber = (min: number, max?: number) => (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || (max !== undefined && n > max))
    return max === undefined ? `A whole number of at least ${min}.` : `A whole number from ${min} to ${max}.`;
  return undefined;
};

export const isPositiveNumber = (v: string) => (Number.isFinite(Number(v)) && Number(v) > 0 ? undefined : "A number above 0.");

/** School, department and lookup codes: uppercase letters and digits (the backend's @Pattern). */
export const isUpperCode = (v: string) => (/^[A-Z0-9]+$/.test(v) ? undefined : "Uppercase letters and digits only, e.g. SOS.");

export const STATUS_OPTIONS = ["Active", "Inactive"].map((s) => ({ value: s, label: s }));
