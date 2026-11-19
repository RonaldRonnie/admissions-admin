import type { UserRole } from "./types";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface Session {
  token: string;
  refreshToken?: string;
  user: SessionUser;
}

// sessionStorage, not localStorage: an admin session ends when the tab closes, and a token left
// on a shared office machine doesn't outlive the browser window that created it.
const STORAGE_KEY = "admissions-admin.session";

type Listener = (session: Session | null) => void;
const listeners = new Set<Listener>();

let current: Session | null = read();

function read(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return current;
}

export function setSession(session: Session | null): void {
  current = session;
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, policy): the session still lives in memory for this tab.
  }
  listeners.forEach((listener) => listener(session));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
