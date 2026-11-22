export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// The sign-in token. Whoever builds the login screen stores it with setToken after POST /api/auth/login.
const TOKEN_KEY = "gate-parking-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be blocked (private mode); the user then has to sign in again.
  }
}

// The backend answers errors as { error: "..." }.
function errorText(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const text = "error" in data ? data.error : undefined;
  return typeof text === "string" && text ? text : undefined;
}

// Listeners notified when an authenticated request returns 401.
// Receives the token sent with the failing request so stale responses can be ignored.
type UnauthorizedListener = (token: string) => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized(token: string | null): void {
  if (!token) return;
  for (const listener of unauthorizedListeners) {
    try {
      listener(token);
    } catch {
      // Listeners must not break API error propagation.
    }
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  const token = getToken();
  try {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the server. Please try again.", 0);
  }

  const data: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);

  if (!response.ok) {
    // Only authenticated protected requests (not public auth endpoints) trigger session invalidation.
    if (
      response.status === 401 &&
      path !== "/auth/login" &&
      path !== "/auth/activate"
    ) {
      notifyUnauthorized(token);
    }
    const message =
      errorText(data) ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};
