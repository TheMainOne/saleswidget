const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const ACCESS_TOKEN_KEY = "auth_access_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";

type TokenPair = {
  accessToken?: string;
  refreshToken?: string;
};

export const tokenStore = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(tokens: TokenPair) {
    if (tokens.accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    }
    if (tokens.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
  },
  clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?:
    | BodyInit
    | Record<string, unknown>
    | Array<unknown>
    | null;
  skipAuth?: boolean;
};

export class UnauthorizedError extends Error {
  status: number;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
    this.status = 401;
  }
}

function buildUrl(path: string): string {
  if (!API_BASE_URL) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(buildUrl("/api/auth/refresh"), {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!res.ok) {
        tokenStore.clearTokens();
        return null;
      }

      const data = await safeJson<{ accessToken?: string }>(res);
      if (data?.accessToken) {
        tokenStore.setTokens({ accessToken: data.accessToken });
        return data.accessToken;
      }

      tokenStore.clearTokens();
      return null;
    } catch {
      tokenStore.clearTokens();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { skipAuth, headers, body, ...rest } = options;
  const requestHeaders = new Headers(headers || {});
  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  let requestBody: BodyInit | undefined = body as BodyInit | undefined;
  const isBodyObject =
    body &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer);

  if (isBodyObject) {
    requestBody = JSON.stringify(body);
    if (!requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json");
    }
  }

  if (!skipAuth) {
    const token = tokenStore.getAccessToken();
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const requestInit: RequestInit = {
    ...rest,
    headers: requestHeaders,
    body: requestBody
  };

  const doFetch = () => fetch(buildUrl(path), requestInit);
  let res = await doFetch();

  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders.set("Authorization", `Bearer ${newToken}`);
      res = await doFetch();
    }
  }

  if (!res.ok) {
    const err = await safeJson<ApiErrorPayload>(res);
    const message = err?.error || err?.message || `Request failed with status ${res.status}`;
    if (res.status === 401 && !skipAuth) {
      tokenStore.clearTokens();
      throw new UnauthorizedError(message);
    }
    throw new Error(message);
  }

  return safeJson<T>(res);
}
