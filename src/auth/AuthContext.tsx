import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { adminHealth, login } from "../api/endpoints";
import { getSession, setSession, subscribe, type Session } from "../api/session";

interface AuthValue {
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setLocal] = useState<Session | null>(getSession);
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribe((next) => {
        setLocal(next);
        // Never show one admin's cached data to the next person who signs in on this tab.
        if (!next) queryClient.clear();
      }),
    [queryClient],
  );

  async function signIn(email: string, password: string) {
    const auth = await login(email.trim(), password);
    setSession({
      token: auth.token,
      refreshToken: auth.refreshToken,
      user: {
        id: auth.userId,
        email: auth.email,
        firstName: auth.firstName,
        lastName: auth.lastName,
        role: auth.role,
      },
    });
    // Ask the server rather than trusting auth.role: /admin/health answers 200 only to whoever
    // the backend's own rules (role plus derived authorities) treat as an admin right now.
    try {
      await adminHealth();
    } catch (error) {
      setSession(null);
      if (error instanceof ApiError && error.status === 403) {
        throw new ApiError(403, "This account does not have administrator access.");
      }
      throw error;
    }
  }

  function signOut() {
    setSession(null);
  }

  return <AuthContext.Provider value={{ session, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
