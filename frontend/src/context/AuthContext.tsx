import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "../api/authApi";
import { ApiError, getToken, onUnauthorized, setToken } from "../api/client";
import type { User } from "../types/auth";

type AuthState = {
  /** The signed-in user, or null when anonymous. */
  user: User | null;
  /** True only during initial or retried session-restoration check. */
  isRestoring: boolean;
  /** True while a login request is in flight. */
  isLoggingIn: boolean;
  /** Set when session restoration encounters a recoverable network or server failure. */
  restorationError: string | null;
  /** Sign in with email and password. Returns the user on success or throws. */
  login: (email: string, password: string) => Promise<User>;
  /** Clear the session locally without making any backend call. */
  logout: () => void;
  /** Retry restoring session after a recoverable failure. */
  retryRestoration: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(() => getToken() !== null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [restorationError, setRestorationError] = useState<string | null>(null);

  // Monotonic counter: incremented on login, logout, and token changes so stale async responses are discarded.
  const epoch = useRef(0);

  const restoreSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsRestoring(false);
      setRestorationError(null);
      return;
    }

    setIsRestoring(true);
    setRestorationError(null);
    const myEpoch = epoch.current;

    try {
      const { user: restoredUser } = await authApi.me();
      if (epoch.current === myEpoch) {
        setUser(restoredUser);
        setRestorationError(null);
      }
    } catch (err) {
      if (epoch.current === myEpoch) {
        if (err instanceof ApiError && err.status === 401) {
          // Confirmed invalid or expired session: clear stored token and user.
          setToken(null);
          setUser(null);
          setRestorationError(null);
        } else {
          // Network errors (status 0) and server errors (5xx) are recoverable:
          // keep the token so the user can retry without losing their session.
          setRestorationError(
            err instanceof Error ? err.message : "Failed to restore session",
          );
        }
      }
    } finally {
      if (epoch.current === myEpoch) {
        setIsRestoring(false);
      }
    }
  }, []);

  // Run session restoration on mount.
  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) {
      return;
    }

    const myEpoch = epoch.current;
    authApi
      .me()
      .then(({ user: restoredUser }) => {
        if (!cancelled && epoch.current === myEpoch) {
          setUser(restoredUser);
          setRestorationError(null);
        }
      })
      .catch((err) => {
        if (!cancelled && epoch.current === myEpoch) {
          if (err instanceof ApiError && err.status === 401) {
            setToken(null);
            setUser(null);
            setRestorationError(null);
          } else {
            setRestorationError(
              err instanceof Error ? err.message : "Failed to restore session",
            );
          }
        }
      })
      .finally(() => {
        if (!cancelled && epoch.current === myEpoch) {
          setIsRestoring(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Invalidate session immediately when any protected API request returns 401 for the current token.
  useEffect(() => {
    return onUnauthorized((failedToken) => {
      if (failedToken && failedToken === getToken()) {
        epoch.current += 1;
        setToken(null);
        setUser(null);
        setRestorationError(null);
        setIsRestoring(false);
      }
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoggingIn(true);
    try {
      const { token, user: loggedInUser } = await authApi.login({
        email,
        password,
      });
      epoch.current += 1;
      setToken(token);
      setUser(loggedInUser);
      setIsRestoring(false);
      setRestorationError(null);
      return loggedInUser;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    epoch.current += 1;
    setToken(null);
    setUser(null);
    setIsRestoring(false);
    setRestorationError(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isRestoring,
      isLoggingIn,
      restorationError,
      login,
      logout,
      retryRestoration: restoreSession,
    }),
    [
      user,
      isRestoring,
      isLoggingIn,
      restorationError,
      login,
      logout,
      restoreSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
