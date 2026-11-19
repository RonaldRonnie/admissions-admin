import { getSession, setSession } from "./session";
import type { ApiResponse, AuthenticationResponse, ErrorResponse } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: { field: string; message: string }[];

  constructor(status: number, message: string, fieldErrors: { field: string; message: string }[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (configured ?? "").replace(/\/+$/, "");
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  /** Send the bearer token and retry once through /auth/refresh on a 401. Default true. */
  auth?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `${apiBaseUrl()}${path}${qs ? `?${qs}` : ""}`;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorFrom(status: number, body: unknown): ApiError {
  const err = (body && typeof body === "object" ? body : {}) as Partial<ErrorResponse> & { error?: string };
  const fieldErrors = (err.errors ?? []).map((e) => ({ field: e.field, message: e.message }));
  let message = err.message || err.error || (typeof body === "string" && body.length < 300 ? body : "");
  if (!message) {
    message =
      status === 401
        ? "You are not signed in, or your session has expired."
        : status === 403
          ? "Your account is not allowed to do that."
          : status === 404
            ? "Not found."
            : `The server returned an error (HTTP ${status}).`;
  }
  // The backend's field messages read on their own ("Please provide a valid email address"), and
  // some "fields" aren't form fields at all (login failures come back under "credentials").
  const details = fieldErrors.map((f) => f.message).filter((m) => m && !message.includes(m));
  if (details.length) message = `${message.replace(/[.:]\s*$/, "")}: ${details.join("; ")}`;
  return new ApiError(status, message, fieldErrors);
}

async function send(url: string, options: RequestOptions, token?: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // fetch only rejects when no HTTP response arrived: server down, wrong URL, or a CORS
    // rejection (which the browser deliberately reports the same way).
    throw new ApiError(
      0,
      `Cannot reach the API at ${apiBaseUrl() || "(VITE_API_BASE_URL is not set)"}. ` +
        "Check that the server is running and that this site's address is in its ALLOWED_ORIGINS.",
    );
  }
}

// One refresh at a time: several queries failing together share the same /auth/refresh call
// instead of racing each other with the same refresh token.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const session = getSession();
  if (!session?.refreshToken) return false;
  const response = await send(buildUrl("/auth/refresh"), {
    method: "POST",
    body: { refreshToken: session.refreshToken },
  }).catch(() => null);
  if (!response?.ok) return false;
  const body = (await parseBody(response)) as ApiResponse<AuthenticationResponse> | null;
  const fresh = body?.data;
  if (!fresh?.token) return false;
  // The session may have been cleared (signed out) while the refresh was in flight.
  if (getSession() === null) return false;
  setSession({ ...session, token: fresh.token, refreshToken: fresh.refreshToken ?? session.refreshToken });
  return true;
}

function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= refreshSession().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth ?? true;
  const url = buildUrl(path, options.query);

  let response = await send(url, options, useAuth ? getSession()?.token : undefined);

  if (response.status === 401 && useAuth && getSession()) {
    if (await refreshOnce()) {
      response = await send(url, options, getSession()?.token);
    }
    if (response.status === 401) {
      setSession(null);
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
  }

  const body = await parseBody(response);
  if (!response.ok) throw errorFrom(response.status, body);
  return body as T;
}

/** For the many endpoints that wrap their payload in ApiResponse<T>. */
export async function requestData<T>(path: string, options?: RequestOptions): Promise<T> {
  const body = await request<ApiResponse<T>>(path, options);
  return body.data;
}
