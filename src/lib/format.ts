import type { AccountStatus, ApiDateTime } from "../api/types";

export function toDate(value: ApiDateTime | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    // Jackson's array form: [year, month (1-based), day, hour?, minute?, second?, nanos?]
    const [y, mo, d, h = 0, mi = 0, s = 0] = value;
    return new Date(y, mo - 1, d, h, mi, s);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTime(value: ApiDateTime | undefined): string {
  const date = toDate(value);
  return date
    ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "—";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function fullName(user: { firstName?: string; lastName?: string } | null | undefined): string {
  if (!user) return "—";
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
}

export type Tone = "gray" | "green" | "amber" | "red" | "blue";

export const STATUS_TONE: Record<AccountStatus, Tone> = {
  PENDING: "amber",
  APPROVED: "green",
  SUSPENDED: "red",
  DISABLED: "gray",
};

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Matches the backend's UpdateUserRequest password rule. */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PASSWORD_HINT = "At least 8 characters, with an uppercase letter, a lowercase letter and a digit.";

/** Matches @ValidPhoneNumber: empty, or E.164-style digits with an optional leading +. */
export const PHONE_RULE = /^$|^\+?[1-9]\d{1,14}$/;

export function generatePassword(length = 14): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%*-_"];
  const all = sets.join("");
  const random = (max: number) => crypto.getRandomValues(new Uint32Array(1))[0] % max;
  const chars = sets.map((set) => set[random(set.length)]);
  while (chars.length < length) chars.push(all[random(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
