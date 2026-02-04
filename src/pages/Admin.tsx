import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { LogOut, Building2, MessageSquare, UserCheck, ExternalLink, Shield, Trash2, Plus, Loader2, Users, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  auth,
  buildAuthPath,
  getUserRoles,
  getUserSites,
  hasAdminRole,
  hasSuperAdminRole,
  isUnauthorizedError,
} from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Client {
  id: string;
  name: string;
  slug: string;
  site_id?: string;
  is_active: boolean;
  created_at: string;
}

interface Stats {
  totalClients: number;
  totalChats: number;
  totalLeads: number;
}

interface UserWithRole {
  user_id: string;
  email: string;
  role: "superadmin" | "admin" | "user";
  sites: string[];
  created_at: string;
}

const normalizeSiteId = (value: unknown) => String(value ?? "").trim().toLowerCase();

const toUniqueSiteIds = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  values.forEach((raw) => {
    const siteId = String(raw ?? "").trim();
    if (!siteId) return;

    const key = normalizeSiteId(siteId);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(siteId);
  });

  return unique;
};

const normalizeRoleName = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[_\-\s]+/g, "");

const resolveUserRole = (payload: any): UserWithRole["role"] => {
  if (hasSuperAdminRole(payload)) return "superadmin";

  const roles = [
    ...getUserRoles(payload),
    payload?.role,
    payload?.app_role,
  ].map((role) => normalizeRoleName(role));

  if (roles.includes("superadmin")) return "superadmin";
  if (roles.includes("admin")) return "admin";
  return "user";
};

const isEndpointMismatchError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return /status 400|status 404|status 405|not found|method not allowed/i.test(error.message);
};

const isRoleAlreadyAssignedError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return /already.*(role|admin)|role.*already|duplicate/i.test(error.message);
};

const parseUsersPayload = (payload: any): UserWithRole[] => {
  const candidates = [
    payload?.users,
    payload?.items,
    payload?.data?.users,
    payload?.data?.items,
    payload?.data,
    payload,
  ];

  const source = candidates.find((item) => Array.isArray(item));
  if (!Array.isArray(source)) return [];

  return source
    .map((item) => ({
      user_id: String(item?.user_id || item?.userId || item?._id || item?.id || ""),
      email: String(item?.email || ""),
      role: resolveUserRole(item),
      sites: toUniqueSiteIds([
        ...getUserSites(item),
        item?.siteId,
        item?.site_id,
      ]),
      created_at: item?.created_at || item?.createdAt || new Date().toISOString(),
    }))
    .filter((item) => item.user_id && item.email);
};

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalChats: 0,
    totalLeads: 0,
  });
  
  // User management state
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "user">("user");
  const [addingUser, setAddingUser] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [siteSelectionByUserId, setSiteSelectionByUserId] = useState<Record<string, string>>({});
  const [siteUpdateByUserId, setSiteUpdateByUserId] = useState<Record<string, boolean>>({});

  const siteOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();

    clients.forEach((client) => {
      const rawSiteId = String(client.site_id || "").trim();
      if (!rawSiteId) return;

      const normalized = normalizeSiteId(rawSiteId);
      if (map.has(normalized)) return;
      map.set(normalized, {
        value: rawSiteId,
        label: `${client.name} (${rawSiteId})`,
      });
    });

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [clients]);

  const siteLabelById = useMemo(() => {
    const map = new Map<string, string>();
    siteOptions.forEach((site) => {
      map.set(normalizeSiteId(site.value), site.label);
    });
    return map;
  }, [siteOptions]);

  const siteMetaById = useMemo(() => {
    const map = new Map<string, { siteId: string; clientId: string; label: string }>();
    clients.forEach((client) => {
      const siteId = String(client.site_id || "").trim();
      if (!siteId) return;
      const key = normalizeSiteId(siteId);
      if (map.has(key)) return;
      map.set(key, {
        siteId,
        clientId: client.id,
        label: `${client.name} (${siteId})`,
      });
    });
    return map;
  }, [clients]);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    try {
      const me = await auth.getMe();
      if (!me) {
        navigate(buildAuthPath({ returnTo, reason: "session_expired" }), { replace: true });
        return;
      }

      const isAdminRole = hasAdminRole(me);
      if (!isAdminRole) {
        toast({
          title: "Access denied",
          description: "You don't have admin privileges",
          variant: "destructive",
        });
        navigate("/", { replace: true });
        return;
      }

      const superAdmin = hasSuperAdminRole(me);
      const scopedSiteIds = getUserSites(me);
      if (!superAdmin && scopedSiteIds.length === 0) {
        toast({
          title: "Access denied",
          description: "Your admin account has no assigned sites.",
          variant: "destructive",
        });
        navigate("/", { replace: true });
        return;
      }

      setIsAdmin(true);
      setIsSuperAdmin(superAdmin);
      setCurrentUserEmail(me.email || "");

      const scope = { superAdmin, scopedSiteIds };
      const visibleClients = await loadClients(scope);
      const visibleClientSiteIds = visibleClients
        .map((client) => String(client.site_id || "").trim())
        .filter(Boolean);
      await loadStats(scope, visibleClients.length, visibleClientSiteIds);

      if (superAdmin) {
        await loadUsers();
      }
    } catch (error: any) {
      if (isUnauthorizedError(error)) {
        navigate(buildAuthPath({ returnTo, reason: "session_expired" }), { replace: true });
        return;
      }

      console.error("Error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async (scope: { superAdmin: boolean; scopedSiteIds: string[] }): Promise<Client[]> => {
    try {
      const data = await apiFetch<{ clients?: any[]; total?: number }>(
        "/api/clients?page=1&limit=200"
      );

      const mapped = (data?.clients || []).map((client) => ({
        id: String(client._id || client.id),
        name: client.name,
        slug: client.slug,
        site_id: client.siteId || client.site_id,
        is_active: client.isActive ?? client.is_active ?? true,
        created_at: client.createdAt || client.created_at,
      }));

      const allowedSites = new Set(scope.scopedSiteIds.map(normalizeSiteId));
      const scopedClients = scope.superAdmin
        ? mapped
        : mapped.filter((client) => {
            const siteId = normalizeSiteId(client.site_id);
            return siteId.length > 0 && allowedSites.has(siteId);
          });

      // Sort to put 'widget' first
      const sortedClients = scopedClients.sort((a, b) => {
        if (a.slug === 'widget') return -1;
        if (b.slug === 'widget') return 1;
        return 0;
      });

      setClients(sortedClients);
      return sortedClients;
    } catch (error) {
      console.error("Error loading clients:", error);
      return [];
    }
  };

  const loadStats = async (
    scope: { superAdmin: boolean; scopedSiteIds: string[] },
    visibleClientsCount = clients.length,
    visibleClientSiteIds: string[] = []
  ) => {
    try {
      const days = 3650;
      if (!scope.superAdmin) {
        const siteIdsForStats = visibleClientSiteIds.length > 0
          ? visibleClientSiteIds
          : scope.scopedSiteIds;
        const uniqueSiteIdsForStats = [...new Set(siteIdsForStats.map((id) => id.trim()).filter(Boolean))];

        const perSiteStats = await Promise.all(
          uniqueSiteIdsForStats.map(async (siteId) => {
            try {
              const [sessionsRes, messagesRes] = await Promise.all([
                apiFetch<{ total?: number }>(
                  `/api/statistic/sessions/list?days=${days}&page=1&limit=1&siteId=${encodeURIComponent(siteId)}`
                ),
                apiFetch<{ totals?: { totalMessages?: number } }>(
                  `/api/statistic/messages/summary?days=${days}&siteId=${encodeURIComponent(siteId)}`
                ),
              ]);

              return {
                sessions: sessionsRes?.total ?? 0,
                messages: messagesRes?.totals?.totalMessages ?? 0,
              };
            } catch (error) {
              console.error(`Error loading stats for site ${siteId}:`, error);
              return { sessions: 0, messages: 0 };
            }
          })
        );

        const chatsCount = perSiteStats.reduce((sum, item) => sum + item.sessions, 0);
        const messagesCount = perSiteStats.reduce((sum, item) => sum + item.messages, 0);

        setStats({
          totalClients: visibleClientsCount,
          totalChats: chatsCount,
          totalLeads: messagesCount,
        });
        return;
      }

      const [sessionsRes, messagesRes] = await Promise.allSettled([
        apiFetch<{ total?: number }>(`/api/statistic/sessions/list?days=${days}&page=1&limit=1`),
        apiFetch<{ totals?: { totalMessages?: number } }>(`/api/statistic/messages/summary?days=${days}`),
      ]);

      if (sessionsRes.status === "rejected") {
        console.error("Error loading total sessions stats:", sessionsRes.reason);
      }
      if (messagesRes.status === "rejected") {
        console.error("Error loading total messages stats:", messagesRes.reason);
      }

      const chatsCount = sessionsRes.status === "fulfilled" ? sessionsRes.value?.total ?? 0 : 0;
      const messagesCount =
        messagesRes.status === "fulfilled" ? messagesRes.value?.totals?.totalMessages ?? 0 : 0;

      setStats({
        totalClients: visibleClientsCount,
        totalChats: chatsCount || 0,
        totalLeads: messagesCount || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const endpoints = ["/api/users", "/api/users/admin", "/api/users/roles"];
      let resolvedUsers: UserWithRole[] = [];
      let lastError: unknown = null;

      for (const endpoint of endpoints) {
        try {
          const payload = await apiFetch<any>(endpoint);
          const parsed = parseUsersPayload(payload);
          if (parsed.length > 0 || endpoint === endpoints[endpoints.length - 1]) {
            resolvedUsers = parsed;
            break;
          }
        } catch (error) {
          if (isEndpointMismatchError(error)) {
            lastError = error;
            continue;
          }
          throw error;
        }
      }

      if (resolvedUsers.length === 0 && lastError) {
        throw lastError;
      }

      setUsers(resolvedUsers);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast({
        title: "Error loading users",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setAddingUser(true);
    try {
      const payload = {
        email: newUserEmail.trim(),
        role: newUserRole,
      };

      const endpoints = ["/api/users/roles", "/api/users/role", "/api/users"];
      let succeeded = false;
      let lastError: unknown = null;

      for (const endpoint of endpoints) {
        try {
          await apiFetch(endpoint, {
            method: "POST",
            body: payload,
          });
          succeeded = true;
          break;
        } catch (error) {
          if (isEndpointMismatchError(error)) {
            lastError = error;
            continue;
          }
          throw error;
        }
      }

      if (!succeeded) {
        throw lastError || new Error("Could not add user role with available API endpoints.");
      }

      toast({
        title: "Success",
        description: `User ${newUserEmail} has been added with ${newUserRole} role`,
      });

      setNewUserEmail("");
      setNewUserRole("user");
      await loadUsers();
      await loadStats({ superAdmin: true, scopedSiteIds: [] });
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast({
        title: "Error adding user",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    setDeletingUser(true);
    try {
      const payload = { userId: deleteUserId };
      const attempts: Array<{ path: string; method: "POST" | "DELETE"; body: any }> = [
        { path: "/api/users/roles", method: "DELETE", body: payload },
        { path: "/api/users/roles", method: "POST", body: { ...payload, action: "remove" } },
        { path: "/api/users/role", method: "DELETE", body: payload },
        { path: "/api/users/role", method: "POST", body: { ...payload, action: "remove" } },
        { path: "/api/users", method: "DELETE", body: payload },
      ];

      let succeeded = false;
      let lastError: unknown = null;

      for (const attempt of attempts) {
        try {
          await apiFetch(attempt.path, {
            method: attempt.method,
            body: attempt.body,
          });
          succeeded = true;
          break;
        } catch (error) {
          if (isEndpointMismatchError(error)) {
            lastError = error;
            continue;
          }
          throw error;
        }
      }

      if (!succeeded) {
        throw lastError || new Error("Could not remove user role with available API endpoints.");
      }

      toast({
        title: "Success",
        description: "User role has been removed",
      });

      setDeleteUserId(null);
      await loadUsers();
      await loadStats({ superAdmin: true, scopedSiteIds: [] });
    } catch (error: any) {
      console.error("Error removing user:", error);
      toast({
        title: "Error removing user",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingUser(false);
    }
  };

  const getSiteLabel = (siteId: string) =>
    siteLabelById.get(normalizeSiteId(siteId)) || siteId;

  const promoteUserToAdmin = async (user: UserWithRole) => {
    if (user.role === "admin" || user.role === "superadmin") return;
    const userId = String(user.user_id || "").trim();
    if (!userId) {
      throw new Error("Cannot promote user to admin: missing user id.");
    }

    try {
      await apiFetch(`/api/users/${encodeURIComponent(userId)}/roles`, {
        method: "PATCH",
        body: {
          roles: ["admin"],
        },
      });
    } catch (error) {
      if (isRoleAlreadyAssignedError(error)) {
        return;
      }
      throw error;
    }
  };

  const executeUserSiteUpdate = async (params: {
    userId: string;
    nextSiteIds: string[];
  }) => {
    const userId = String(params.userId || "").trim();
    if (!userId) {
      throw new Error("Cannot update sites: missing user id.");
    }

    const sitesPayload = toUniqueSiteIds(params.nextSiteIds).map((siteId) => {
      const siteMeta = siteMetaById.get(normalizeSiteId(siteId));
      return {
        siteId,
        ...(siteMeta?.clientId ? { clientId: siteMeta.clientId } : {}),
        role: "editor",
        isActive: true,
      };
    });

    await apiFetch(`/api/users/${encodeURIComponent(userId)}/sites`, {
      method: "PATCH",
      body: {
        sites: sitesPayload,
      },
    });
  };

  const handleAddSiteToUser = async (user: UserWithRole) => {
    if (user.role === "superadmin") return;

    const selectedSite = String(siteSelectionByUserId[user.user_id] || "").trim();
    if (!selectedSite) {
      toast({
        title: "Select a site",
        description: "Please choose a site before adding.",
        variant: "destructive",
      });
      return;
    }

    const alreadyAssigned = new Set(user.sites.map(normalizeSiteId));
    if (alreadyAssigned.has(normalizeSiteId(selectedSite))) {
      toast({
        title: "Site already assigned",
        description: "This site is already assigned to the user.",
        variant: "destructive",
      });
      return;
    }

    const selectedSiteMeta = siteMetaById.get(normalizeSiteId(selectedSite));
    if (!selectedSiteMeta?.clientId) {
      toast({
        title: "Cannot add site",
        description: "Client ID for this site was not found.",
        variant: "destructive",
      });
      return;
    }

    const nextSiteIds = toUniqueSiteIds([...user.sites, selectedSite]);
    const shouldPromoteToAdmin = user.role === "user";
    setSiteUpdateByUserId((prev) => ({ ...prev, [user.user_id]: true }));

    try {
      await executeUserSiteUpdate({
        userId: user.user_id,
        nextSiteIds,
      });

      let roleUpdateError: Error | null = null;
      if (shouldPromoteToAdmin) {
        try {
          await promoteUserToAdmin(user);
        } catch (error) {
          roleUpdateError = error instanceof Error
            ? error
            : new Error("Site was assigned, but role update failed.");
        }
      }

      toast({
        title: roleUpdateError ? "Site assigned, role update failed" : "Success",
        description: roleUpdateError
          ? roleUpdateError.message
          : shouldPromoteToAdmin
            ? `Site ${selectedSite} assigned to ${user.email}. Role updated to admin.`
            : `Site ${selectedSite} assigned to ${user.email}`,
        variant: roleUpdateError ? "destructive" : "default",
      });

      setSiteSelectionByUserId((prev) => ({ ...prev, [user.user_id]: "" }));
      await loadUsers();
    } catch (error: any) {
      console.error("Error assigning site:", error);
      toast({
        title: "Error assigning site",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSiteUpdateByUserId((prev) => ({ ...prev, [user.user_id]: false }));
    }
  };

  const handleRemoveSiteFromUser = async (user: UserWithRole, siteId: string) => {
    if (user.role === "superadmin") return;

    const nextSiteIds = toUniqueSiteIds(user.sites.filter((currentSite) => normalizeSiteId(currentSite) !== normalizeSiteId(siteId)));
    setSiteUpdateByUserId((prev) => ({ ...prev, [user.user_id]: true }));

    try {
      await executeUserSiteUpdate({
        userId: user.user_id,
        nextSiteIds,
      });

      toast({
        title: "Success",
        description: `Site ${siteId} removed from ${user.email}`,
      });

      await loadUsers();
    } catch (error: any) {
      console.error("Error removing site:", error);
      toast({
        title: "Error removing site",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSiteUpdateByUserId((prev) => ({ ...prev, [user.user_id]: false }));
    }
  };

  const handleLogout = async () => {
    await auth.logout();
    navigate("/");
  };

  const handleManageClient = (clientId: string) => {
    navigate(`/admin/client/${clientId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 sm:px-6">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="grid gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Manage clients, users, and system settings</p>
          </div>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            {currentUserEmail && (
              <span className="max-w-[180px] truncate text-sm text-muted-foreground sm:max-w-[260px]" title={currentUserEmail}>
                {currentUserEmail}
              </span>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className={`grid w-full ${isSuperAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="users">Users & Roles</TabsTrigger>}
          </TabsList>

          {/* Overview Tab - Combined with Clients */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Clients</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalClients}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Chats</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalChats}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Messages</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalLeads}</div>
                </CardContent>
              </Card>
            </div>

            {/* Clients List */}
            <Card>
              <CardHeader>
                <CardTitle>Clients</CardTitle>
                <CardDescription>
                  Manage client accounts and their configurations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {clients.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No clients found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clients.map((client) => (
                      <div
                        key={client.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{client.name}</h3>
                            {client.slug === 'widget' && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                Primary
                              </span>
                            )}
                            {!client.is_active && (
                              <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span>Slug: {client.slug}</span>
                            <span>•</span>
                            <span>Created: {new Date(client.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => window.open(`/demo/${client.slug}`, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Demo
                          </Button>
                          <Button
                            className="w-full sm:w-auto"
                            onClick={() => handleManageClient(client.id)}
                          >
                            Manage
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users & Roles Tab */}
          {isSuperAdmin && (
          <TabsContent value="users" className="space-y-6">
            {/* Add User Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add New User
                </CardTitle>
                <CardDescription>
                  Add a user and assign them a role in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                    />
                  </div>
                  <div className="w-full space-y-2 sm:w-48">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as "admin" | "user")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full sm:w-auto" onClick={handleAddUser} disabled={addingUser}>
                      {addingUser ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Add User
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Users List Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  All Users
                </CardTitle>
                <CardDescription>
                  Manage user roles and permissions across the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="min-w-[360px]">Sites</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => {
                        const isSuperAdminUser = user.role === "superadmin";
                        const isUpdatingSites = !!siteUpdateByUserId[user.user_id];
                        const assignedSites = toUniqueSiteIds(user.sites);
                        const assignedSiteKeys = new Set(assignedSites.map(normalizeSiteId));
                        const addableSiteOptions = siteOptions.filter(
                          (site) => !assignedSiteKeys.has(normalizeSiteId(site.value))
                        );

                        return (
                          <TableRow key={user.user_id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-wrap items-center gap-2">
                                <span>{user.email}</span>
                                {isSuperAdminUser && (
                                  <Badge className="uppercase tracking-wide">
                                    Superadmin
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.role === "user" ? "secondary" : "default"}>
                                {user.role === "user" ? (
                                  <Users className="w-3 h-3 mr-1" />
                                ) : (
                                  <Shield className="w-3 h-3 mr-1" />
                                )}
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top">
                              {isSuperAdminUser ? (
                                <Badge variant="secondary" className="rounded-md px-2.5 py-1">
                                  Full access to all sites
                                </Badge>
                              ) : (
                                <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Assigned sites
                                    </p>
                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                      {assignedSites.length}
                                    </Badge>
                                  </div>
                                  {assignedSites.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No sites assigned</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {assignedSites.map((siteId) => (
                                        <div
                                          key={`${user.user_id}-${siteId}`}
                                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background/70 px-2 py-1 text-xs"
                                        >
                                          <span className="max-w-[220px] truncate" title={getSiteLabel(siteId)}>
                                            {getSiteLabel(siteId)}
                                          </span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive hover:bg-transparent"
                                            disabled={isUpdatingSites}
                                            onClick={() => handleRemoveSiteFromUser(user, siteId)}
                                          >
                                            {isUpdatingSites ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <X className="h-3 w-3" />
                                            )}
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex flex-col gap-2 border-t border-border/70 pt-2 sm:flex-row sm:items-center">
                                    <Select
                                      value={siteSelectionByUserId[user.user_id] || ""}
                                      onValueChange={(value) =>
                                        setSiteSelectionByUserId((prev) => ({ ...prev, [user.user_id]: value }))
                                      }
                                      disabled={isUpdatingSites || addableSiteOptions.length === 0}
                                    >
                                      <SelectTrigger className="h-9 w-full sm:w-[260px]">
                                        <SelectValue placeholder={addableSiteOptions.length > 0 ? "Select site" : "All sites assigned"} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {addableSiteOptions.map((site) => (
                                          <SelectItem key={site.value} value={site.value}>
                                            {site.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-9"
                                      disabled={
                                        isUpdatingSites ||
                                        !siteSelectionByUserId[user.user_id] ||
                                        addableSiteOptions.length === 0
                                      }
                                      onClick={() => handleAddSiteToUser(user)}
                                    >
                                      {isUpdatingSites ? (
                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      ) : (
                                        <Plus className="w-3 h-3 mr-1" />
                                      )}
                                      Add site
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={deletingUser || isUpdatingSites}
                                onClick={() => setDeleteUserId(user.user_id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this user's role? They will lose access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deletingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingUser ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
