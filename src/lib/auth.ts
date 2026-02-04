import { apiFetch, tokenStore, UnauthorizedError } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  roles?: unknown;
  sites?: unknown;
  role?: unknown;
  siteIds?: unknown;
  site_ids?: unknown;
  user_roles?: unknown;
  isActive?: boolean;
  timezone?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

function normalizeAuthResponse(data: any): AuthResponse {
  return {
    ...data,
    user: normalizeAuthUser(data?.user ?? data),
    tokens: data?.tokens,
  } as AuthResponse;
}

function pickUserPayload(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  if (payload.user && typeof payload.user === "object") return payload.user;
  if (payload.data?.user && typeof payload.data.user === "object") return payload.data.user;
  return payload;
}

function normalizeAuthUser(payload: any): AuthUser {
  const source = pickUserPayload(payload) || {};
  return {
    ...source,
    id: String(source.id ?? source._id ?? ""),
    email: source.email ?? "",
    isActive: source.isActive ?? source.is_active,
    roles: source.roles ?? source.role ?? source.user_roles,
    role: source.role,
    sites: source.sites ?? source.siteIds ?? source.site_ids,
    siteIds: source.siteIds,
    site_ids: source.site_ids,
    user_roles: source.user_roles,
  };
}

export async function register(payload: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResponse> {
  const data = await apiFetch<any>("/api/auth/register", {
    method: "POST",
    body: payload,
    skipAuth: true
  });

  if (data?.tokens) {
    tokenStore.setTokens(data.tokens);
  }

  return normalizeAuthResponse(data);
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const data = await apiFetch<any>("/api/auth/login", {
    method: "POST",
    body: payload,
    skipAuth: true
  });

  if (data?.tokens) {
    tokenStore.setTokens(data.tokens);
  }

  return normalizeAuthResponse(data);
}

export async function loginWithGoogle(payload: {
  idToken: string;
}): Promise<AuthResponse> {
  const data = await apiFetch<any>("/api/auth/google", {
    method: "POST",
    body: payload,
    skipAuth: true
  });

  if (data?.tokens) {
    tokenStore.setTokens(data.tokens);
  }

  return normalizeAuthResponse(data);
}

export async function logout(): Promise<void> {
  const refreshToken = tokenStore.getRefreshToken();
  tokenStore.clearTokens();

  if (!refreshToken) return;

  try {
    await apiFetch<{ ok?: boolean }>("/api/auth/logout", {
      method: "POST",
      body: { refreshToken },
      skipAuth: true
    });
  } catch {
    // Ignore logout errors; tokens are already cleared locally.
  }
}

export async function getMe(): Promise<AuthUser> {
  const data = await apiFetch<any>("/api/auth/me");
  return normalizeAuthUser(data);
}

export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof UnauthorizedError) return true;
  if (!(error instanceof Error)) return false;
  return /401|unauthorized|unauthenticated|not authenticated/i.test(error.message);
}

function collectStringValues(value: unknown, target: string[]): void {
  if (!value) return;

  if (typeof value === "string") {
    value
      .split(/[,|]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => target.push(part));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, target));
    return;
  }

  if (typeof value !== "object") return;

  const obj = value as Record<string, unknown>;
  const preferredKeys = [
    "role",
    "name",
    "slug",
    "value",
    "id",
    "key",
    "app_role",
    "siteId",
    "site_id",
    "client_id",
  ];
  preferredKeys.forEach((key) => {
    if (obj[key] !== undefined) {
      collectStringValues(obj[key], target);
    }
  });

  Object.entries(obj).forEach(([key, flag]) => {
    if (typeof flag !== "boolean" || !flag) return;
    const normalizedKey = key.trim().toLowerCase();
    if (normalizedKey === "admin" || normalizedKey === "superadmin" || normalizedKey === "user") {
      target.push(normalizedKey);
    }
    if (normalizedKey === "isadmin") {
      target.push("admin");
    }
    if (normalizedKey === "issuperadmin") {
      target.push("superadmin");
    }
  });
}

function toUniqueNormalized(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function toUniqueTrimmed(values: string[]): string[] {
  const result = new Map<string, string>();
  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      const key = value.toLowerCase();
      if (!result.has(key)) {
        result.set(key, value);
      }
    });
  return [...result.values()];
}

export function getUserRoles(user: Partial<AuthUser> | null | undefined): string[] {
  if (!user) return [];

  const roles: string[] = [];
  collectStringValues(user.roles, roles);
  collectStringValues(user.role, roles);
  collectStringValues(user.user_roles, roles);

  return toUniqueNormalized(roles);
}

export function hasAdminRole(user: Partial<AuthUser> | null | undefined): boolean {
  if (!user) return false;
  if ((user as any).isAdmin === true || (user as any).is_admin === true) return true;
  if (hasSuperAdminRole(user)) return true;
  const roles = getUserRoles(user);
  return roles.includes("admin");
}

export function hasSuperAdminRole(user: Partial<AuthUser> | null | undefined): boolean {
  if (!user) return false;
  if ((user as any).isSuperAdmin === true || (user as any).is_superadmin === true) return true;
  const roles = getUserRoles(user);
  return roles.includes("superadmin");
}

export function getUserSites(user: Partial<AuthUser> | null | undefined): string[] {
  if (!user) return [];

  const sites: string[] = [];
  collectStringValues(user.sites, sites);
  collectStringValues(user.siteIds, sites);
  collectStringValues(user.site_ids, sites);

  return toUniqueTrimmed(sites);
}

export function hasUserSites(user: Partial<AuthUser> | null | undefined): boolean {
  return getUserSites(user).length > 0;
}

export function sanitizeReturnToPath(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.startsWith("/auth")) return null;
  return path;
}

export function buildAuthPath(options?: {
  returnTo?: string | null;
  reason?: string;
}): string {
  const params = new URLSearchParams();
  const safeReturnTo = sanitizeReturnToPath(options?.returnTo);
  if (safeReturnTo) {
    params.set("returnTo", safeReturnTo);
  }
  if (options?.reason) {
    params.set("reason", options.reason);
  }

  const query = params.toString();
  return query ? `/auth?${query}` : "/auth";
}

export const auth = {
  register,
  login,
  loginWithGoogle,
  logout,
  getMe,
  getAccessToken: tokenStore.getAccessToken,
  getRefreshToken: tokenStore.getRefreshToken,
  clearTokens: tokenStore.clearTokens
};
