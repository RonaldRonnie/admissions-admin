import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, request, requestData } from "./client";
import { getSession, setSession } from "./session";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const user = { id: "u1", email: "a@b.c", firstName: "A", lastName: "B", role: "ADMIN" as const };

describe("api client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.org/api/");
    vi.stubGlobal("fetch", fetchMock);
    setSession({ token: "old", refreshToken: "refresh-1", user });
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("sends the bearer token to the configured base URL, without a doubled slash", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: [1, 2] }));

    await expect(requestData("/admin/users", { query: { page: 2, q: "", skip: undefined } })).resolves.toEqual([1, 2]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.org/api/admin/users?page=2");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer old");
  });

  it("refreshes once on a 401 and retries with the new token", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, { success: true, data: { token: "new" } }))
      .mockResolvedValueOnce(json(200, { success: true, data: "ok" }));

    await expect(requestData("/admin/users")).resolves.toBe("ok");

    expect(fetchMock.mock.calls[1][0]).toBe("https://api.example.org/api/auth/refresh");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ refreshToken: "refresh-1" });
    expect((fetchMock.mock.calls[2][1]?.headers as Record<string, string>).Authorization).toBe("Bearer new");
    // A refresh that returns no new refresh token keeps the old one.
    expect(getSession()).toMatchObject({ token: "new", refreshToken: "refresh-1" });
  });

  it("shares one refresh between requests that fail together", async () => {
    let releaseRefresh!: () => void;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        await new Promise<void>((resolve) => (releaseRefresh = resolve));
        return json(200, { success: true, data: { token: "new", refreshToken: "refresh-2" } });
      }
      return getSession()?.token === "new" ? json(200, { success: true, data: url }) : json(401, {});
    });

    const both = Promise.all([requestData("/a"), requestData("/b")]);
    await vi.waitFor(() => expect(releaseRefresh).toBeTypeOf("function"));
    releaseRefresh();
    await both;

    const refreshCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
    expect(getSession()?.refreshToken).toBe("refresh-2");
  });

  it("signs out when the refresh is refused", async () => {
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, { success: false, message: "expired" }));

    await expect(request("/admin/users")).rejects.toMatchObject({ status: 401 });
    expect(getSession()).toBeNull();
  });

  it("turns the backend's ErrorResponse into a readable ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, {
        success: false,
        message: "Validation failed",
        errors: [{ field: "email", code: "Email", message: "Please provide a valid email address" }],
      }),
    );

    const error = (await request("/admin/users", { method: "POST", body: {} }).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe("Validation failed: Please provide a valid email address");
    expect(error.fieldErrors).toEqual([{ field: "email", message: "Please provide a valid email address" }]);
  });

  it("reads a failed sign-in as one sentence (the backend reports it under a 'credentials' pseudo-field)", async () => {
    fetchMock.mockResolvedValueOnce(
      json(401, {
        success: false,
        message: "Authentication failed",
        errors: [{ field: "credentials", code: "BadCredentials", message: "Invalid email or password" }],
      }),
    );

    const error = (await request("/auth/login", { method: "POST", body: {}, auth: false }).catch((e) => e)) as ApiError;
    expect(error.message).toBe("Authentication failed: Invalid email or password");
  });

  it("explains an unreachable server or CORS refusal instead of 'Failed to fetch'", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const error = (await request("/admin/health").catch((e) => e)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.message).toContain("ALLOWED_ORIGINS");
  });

  it("does not send a token or try to refresh for unauthenticated calls", async () => {
    fetchMock.mockResolvedValueOnce(json(401, { success: false, message: "Bad credentials" }));

    await expect(request("/auth/login", { method: "POST", body: {}, auth: false })).rejects.toMatchObject({
      status: 401,
      message: "Bad credentials",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(getSession()).not.toBeNull();
  });
});
