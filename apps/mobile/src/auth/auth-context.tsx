import { apiClient } from "@/api/client";
import {
  clearStoredSession,
  getStoredSession,
  setStoredSession,
} from "@/auth/session-storage";
import type { LoginRequest, LoginResponse } from "@rsjt/shared";
import {
  type PropsWithChildren,
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthContextValue = {
  session: LoginResponse | null;
  isLoading: boolean;
  signIn: (input: LoginRequest) => Promise<LoginResponse>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const storedSession = await getStoredSession();

      if (!storedSession) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const currentSession = await apiClient.getSession(storedSession.token);
        const nextSession = {
          token: storedSession.token,
          user: currentSession.user,
        };

        await setStoredSession(nextSession);
        if (active) {
          setSession(nextSession);
        }
      } catch {
        await clearStoredSession();
        if (active) {
          setSession(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (input: LoginRequest) => {
    const nextSession = await apiClient.login(input);
    await setStoredSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }, []);

  const signOut = useCallback(async () => {
    const token = session?.token;
    setSession(null);
    await clearStoredSession();

    if (token) {
      await apiClient.logout(token).catch(() => undefined);
    }
  }, [session?.token]);

  const value = useMemo(
    () => ({
      session,
      isLoading,
      signIn,
      signOut,
    }),
    [isLoading, session, signIn, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
