import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { apiBaseUrl } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, ErrorBanner, Field } from "../components/ui";

export function LoginPage() {
  const { session, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const from = (location.state as { from?: string } | null)?.from ?? "/";
  if (session) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <p className="text-xs font-medium tracking-wider text-slate-300 uppercase">Bugema University</p>
          <h1 className="text-2xl font-semibold">Admissions Admin</h1>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          {!apiBaseUrl() && (
            <ErrorBanner error="This build has no API address. Set VITE_API_BASE_URL (or the API_BASE_URL repository variable) and rebuild." />
          )}
          {error !== null && <ErrorBanner error={error} />}
          <Field label="Email">
            {(id) => (
              <input id={id} type="email" autoComplete="username" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          <Field label="Password">
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="current-password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" variant="primary" busy={busy} className="w-full">
            Sign in
          </Button>
          <p className="text-center text-xs text-slate-500">For system administrators only. Every action is recorded in the audit log.</p>
        </form>
      </div>
    </div>
  );
}
