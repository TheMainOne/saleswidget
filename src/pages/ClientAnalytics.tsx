import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Users, TrendingUp, AlertTriangle, CheckCircle, CalendarIcon, X, UserCheck, Mail, Building2, Phone, AtSign, Globe, Monitor, Smartphone, Tablet, RefreshCw, Search, Share2, Link2, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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

interface AnalyticsStats {
  totalSessions: number;
  totalMessages: number;
  averageMessagesPerSession: number;
  pendingKnowledgeGaps?: number;
  resolvedKnowledgeGaps?: number;
}

interface ChatSession {
  id: string;
  created_at: string;
  last_message_at?: string;
  message_count: number;
  ip_address?: string;
  country?: string | null;
  first_message: string;
  had_knowledge_gaps?: boolean;
}

interface KnowledgeGap {
  id: string;
  created_at: string;
  user_question: string;
  status: string;
  session_id: string;
  resolved_at?: string;
  notes?: string;
  phase?: string;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  handle: string | null;
  company: string | null;
  message: string;
  request_type: string;
  created_at: string;
  session_id: string | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface TelemetrySummary {
  total: number;
  byDevice: Array<{ deviceType: string; count: number }>;
  topCountries: Array<{ countryCode: string; country: string; count: number }>;
  topRegions: Array<{ countryCode: string; regionCode: string; region: string; count: number }>;
  topViewports: Array<{ viewportW: number; viewportH: number; count: number }>;
}

interface TelemetryCountryStat {
  countryCode: string;
  country: string;
  count: number;
}

interface TelemetryEvent {
  pagePath: string;
  referrerDomain: string;
  deviceType: string;
  viewportW: number | null;
  viewportH: number | null;
  countryCode?: string | null;
  country: string | null;
  region: string | null;
  createdAt: string;
}

interface ClientAnalyticsProps {
  clientId: string;
  siteId?: string;
}

interface WorldCountryFeature {
  type: string;
  properties?: {
    ISO_A2?: string;
    ISO_A2_EH?: string;
    ADMIN?: string;
    NAME?: string;
  };
  geometry?: {
    type?: string;
    coordinates?: any;
  };
}

const WORLD_MAP_WIDTH = 1200;
const WORLD_MAP_HEIGHT = 620;
const WORLD_MAP_LON_MIN = -180;
const WORLD_MAP_LON_MAX = 180;
const WORLD_MAP_LAT_MIN = -60;
const WORLD_MAP_LAT_MAX = 85;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const projectLonLatToMap = (lon: number, lat: number) => {
  const xRatio = (lon - WORLD_MAP_LON_MIN) / (WORLD_MAP_LON_MAX - WORLD_MAP_LON_MIN);
  const yRatio = (WORLD_MAP_LAT_MAX - lat) / (WORLD_MAP_LAT_MAX - WORLD_MAP_LAT_MIN);
  return [
    clamp(xRatio, 0, 1) * WORLD_MAP_WIDTH,
    clamp(yRatio, 0, 1) * WORLD_MAP_HEIGHT,
  ] as const;
};

const ringToSvgPath = (ring: any) => {
  if (!Array.isArray(ring) || ring.length === 0) return "";
  const commands: string[] = [];

  for (let i = 0; i < ring.length; i += 1) {
    const point = ring[i];
    if (!Array.isArray(point) || point.length < 2) continue;
    const [x, y] = projectLonLatToMap(Number(point[0]), Number(point[1]));
    commands.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  return commands.length ? `${commands.join(" ")} Z` : "";
};

const polygonToSvgPath = (rings: any) => {
  if (!Array.isArray(rings)) return "";
  return rings.map((ring: any) => ringToSvgPath(ring)).filter(Boolean).join(" ");
};

const geometryToSvgPath = (geometry: WorldCountryFeature["geometry"]) => {
  if (!geometry || !geometry.type || !geometry.coordinates) return "";
  if (geometry.type === "Polygon") return polygonToSvgPath(geometry.coordinates);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((polygon: any) => polygonToSvgPath(polygon)).filter(Boolean).join(" ");
  }
  return "";
};

const getFeatureCountryCode = (feature: WorldCountryFeature) => {
  const isoA2 = String(feature?.properties?.ISO_A2 || "").trim().toUpperCase();
  if (isoA2 && isoA2 !== "-99") return isoA2;

  const isoA2Eh = String(feature?.properties?.ISO_A2_EH || "").trim().toUpperCase();
  if (isoA2Eh && isoA2Eh !== "-99") return isoA2Eh;

  return null;
};

export default function ClientAnalytics({ clientId, siteId }: ClientAnalyticsProps) {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedGapId, setSelectedGapId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>("sessions");
  const [telemetrySummary, setTelemetrySummary] = useState<TelemetrySummary | null>(null);
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([]);
  const [telemetryCountries, setTelemetryCountries] = useState<TelemetryCountryStat[]>([]);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [worldMapFeatures, setWorldMapFeatures] = useState<WorldCountryFeature[]>([]);
  const [loadingWorldMap, setLoadingWorldMap] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [leadPendingDelete, setLeadPendingDelete] = useState<Lead | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [sessionPendingDelete, setSessionPendingDelete] = useState<ChatSession | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        loadAnalytics(),
        loadKnowledgeGaps(),
        loadLeads(),
        loadTelemetry(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [clientId, siteId, dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;

    const loadWorldMap = async () => {
      try {
        setLoadingWorldMap(true);
        const baseUrl = import.meta.env.BASE_URL || "/";
        const worldMapPath = `${baseUrl.replace(/\/?$/, "/")}world-countries-110m.geojson`;

        let response = await fetch(worldMapPath, { cache: "force-cache" });
        // Fallback for environments where assets are served from domain root.
        if (!response.ok && worldMapPath !== "/world-countries-110m.geojson") {
          response = await fetch("/world-countries-110m.geojson", { cache: "force-cache" });
        }

        if (!response.ok) {
          throw new Error(`World map request failed with status ${response.status}`);
        }
        const data = await response.json();
        if (cancelled) return;
        setWorldMapFeatures(Array.isArray(data?.features) ? data.features : []);
      } catch (error) {
        console.error("Error loading world map:", error);
        if (!cancelled) {
          setWorldMapFeatures([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingWorldMap(false);
        }
      }
    };

    loadWorldMap();
    return () => {
      cancelled = true;
    };
  }, []);

  const computeDays = () => {
    if (!dateFrom) return 30;
    const diffMs = Date.now() - dateFrom.getTime();
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return Math.max(1, days);
  };

  const loadAnalytics = async () => {
    try {
      const days = computeDays();
      const siteParam = siteId ? `&siteId=${encodeURIComponent(siteId)}` : "";

      const [sessionsRes, messagesRes, gapsRes] = await Promise.all([
        apiFetch<{ total: number; items: any[] }>(
          `/api/statistic/sessions/list?days=${days}&page=1&limit=200${siteParam}`
        ),
        apiFetch<{ totals: { totalMessages: number; avgMsgsPerSession: number } }>(
          `/api/statistic/messages/summary?days=${days}${siteParam}`
        ),
        apiFetch<{ totals?: { total?: number; unresolved?: number; resolved?: number } }>(
          `/api/statistic/gaps/summary?days=${days}${siteParam}`
        )
      ]);

      const mappedSessions = (sessionsRes?.items || []).map((s) => ({
        id: s.sessionId,
        created_at: s.startedAt,
        last_message_at: s.endedAt,
        message_count: s.messagesCount || 0,
        country: typeof s.country === "string" ? s.country : null,
        first_message: s.lastUserQuestion || "Empty conversation",
        had_knowledge_gaps: false,
      }));

      setStats({
        totalSessions: sessionsRes?.total || 0,
        totalMessages: messagesRes?.totals?.totalMessages || 0,
        averageMessagesPerSession: messagesRes?.totals?.avgMsgsPerSession || 0,
        pendingKnowledgeGaps: gapsRes?.totals?.unresolved || 0,
        resolvedKnowledgeGaps: gapsRes?.totals?.resolved || 0,
      });
      setSessions(mappedSessions);
      
      // Auto-select first session if available
      if (mappedSessions.length > 0 && !selectedSession) {
        viewSessionHistory(mappedSessions[0].id);
      }
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast.error("Failed to load analytics");
    }
  };

  const loadKnowledgeGaps = async () => {
    try {
      const days = computeDays();
      const siteParam = siteId ? `&siteId=${encodeURIComponent(siteId)}` : "";
      const data = await apiFetch<{ items: any[] }>(
        `/api/statistic/gaps/list?days=${days}&page=1&limit=200${siteParam}`
      );

      const mapped = (data?.items || []).map((g, index) => ({
        id: `${g.sessionId || "gap"}-${g.createdAt || index}`,
        created_at: g.createdAt,
        user_question: g.question,
        status: g.resolvedAt ? "resolved" : "pending",
        session_id: g.sessionId,
        resolved_at: g.resolvedAt,
        phase: g.phase,
      }));

      setKnowledgeGaps(mapped);

      const pending = mapped.filter((g) => g.status === "pending").length;
      const resolved = mapped.filter((g) => g.status === "resolved").length;

      setStats((prev) => ({
        ...(prev || { totalSessions: 0, totalMessages: 0, averageMessagesPerSession: 0, pendingKnowledgeGaps: 0, resolvedKnowledgeGaps: 0 }),
        pendingKnowledgeGaps: pending,
        resolvedKnowledgeGaps: resolved
      }));
    } catch (error) {
      console.error("Error loading knowledge gaps:", error);
    }
  };

  const loadLeads = async () => {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "200",
        clientId,
      });

      if (siteId) {
        params.set("siteId", siteId);
      }

      if (dateFrom) {
        params.set("from", dateFrom.toISOString());
      }

      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        params.set("to", endOfDay.toISOString());
      }

      const data = await apiFetch<{ items: any[] }>(`/api/leads?${params.toString()}`);

      const mapped = (data?.items || []).map((lead) => {
        const contact = lead?.answers?.contact || {};
        const metaLead = lead?.meta?.lead || {};

        return {
          id: String(lead?._id || lead?.id),
          name: contact?.name || metaLead?.name || "New lead",
          email: contact?.email || metaLead?.email || null,
          phone: contact?.phone || metaLead?.phone || null,
          handle: contact?.handle || metaLead?.handle || null,
          company: lead?.answers?.company || null,
          message: lead?.answers?.message || lead?.message || "",
          request_type: lead?.request_type || lead?.requestType || "lead",
          created_at: lead?.createdAt || lead?.created_at || new Date().toISOString(),
          session_id: lead?.sessionId || lead?.session_id || null,
        } as Lead;
      });

      setLeads(mapped);
    } catch (error) {
      console.error("Error loading leads:", error);
      toast.error("Failed to load leads");
    }
  };

  const loadTelemetry = async () => {
    try {
      setLoadingTelemetry(true);
      if (!siteId) {
        setTelemetrySummary(null);
        setTelemetryEvents([]);
        setTelemetryCountries([]);
        return;
      }

      const params = new URLSearchParams();

      if (dateFrom) {
        params.set("from", dateFrom.toISOString());
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        params.set("to", endOfDay.toISOString());
      }

      const summaryPath = `/api/telemetry/summary?siteId=${encodeURIComponent(siteId)}${params.toString() ? `&${params.toString()}` : ""}`;

      const buildEventsPath = (page: number, limit: number) =>
        `/api/telemetry/events?siteId=${encodeURIComponent(siteId)}&page=${page}&limit=${limit}${params.toString() ? `&${params.toString()}` : ""}`;

      const pageLimit = 100;
      const [summaryData, firstPageData] = await Promise.all([
        apiFetch<any>(summaryPath),
        apiFetch<any>(buildEventsPath(1, pageLimit)),
      ]);

      setTelemetrySummary({
        total: Number(summaryData?.total || 0),
        byDevice: Array.isArray(summaryData?.byDevice) ? summaryData.byDevice : [],
        topCountries: Array.isArray(summaryData?.topCountries) ? summaryData.topCountries : [],
        topRegions: Array.isArray(summaryData?.topRegions) ? summaryData.topRegions : [],
        topViewports: Array.isArray(summaryData?.topViewports) ? summaryData.topViewports : [],
      });

      const firstPageItems = Array.isArray(firstPageData?.items) ? firstPageData.items : [];
      setTelemetryEvents(firstPageItems.slice(0, 50));

      // Build full country distribution for the selected period (not just top-10).
      const countryMap = new Map<string, TelemetryCountryStat>();
      const total = Number(firstPageData?.total || firstPageItems.length || 0);
      const totalPages = Math.max(1, Math.ceil(total / pageLimit));

      const addCountriesFromItems = (items: any[]) => {
        for (const ev of items) {
          const code = String(ev?.countryCode || "").trim().toUpperCase();
          if (!code) continue;
          const countryName = String(ev?.country || code).trim() || code;
          const existing = countryMap.get(code);
          if (existing) {
            existing.count += 1;
          } else {
            countryMap.set(code, { countryCode: code, country: countryName, count: 1 });
          }
        }
      };

      addCountriesFromItems(firstPageItems);

      for (let page = 2; page <= totalPages; page += 1) {
        const pageData = await apiFetch<any>(buildEventsPath(page, pageLimit));
        const items = Array.isArray(pageData?.items) ? pageData.items : [];
        addCountriesFromItems(items);
      }

      setTelemetryCountries(
        Array.from(countryMap.values()).sort((a, b) => b.count - a.count)
      );
    } catch (error) {
      console.error("Error loading telemetry:", error);
      setTelemetrySummary(null);
      setTelemetryEvents([]);
      setTelemetryCountries([]);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const updateGapStatus = async (gapId: string, status: string) => {
    try {
      toast.error("Updating gaps is not supported yet.");
    } catch (error: any) {
      console.error('Error updating gap:', error);
      toast.error(error?.message || 'Failed to update status');
    }
  };

  const viewSessionHistory = async (sessionId: string) => {
    try {
      setLoadingMessages(true);
      setSelectedSession(sessionId);

      const days = computeDays();
      const siteParam = siteId ? `&siteId=${encodeURIComponent(siteId)}` : "";
      const data = await apiFetch<{ items: any[] }>(
        `/api/statistic/messages/list?days=${days}&sessionId=${encodeURIComponent(sessionId)}&page=1&limit=200${siteParam}`
      );

      const mapped = (data?.items || [])
        .map((m) => ({
          role: m.role,
          content: m.content,
          created_at: m.createdAt,
        }))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setSessionMessages(mapped);
    } catch (error) {
      console.error("Error loading session history:", error);
      toast.error("Failed to load chat history");
    } finally {
      setLoadingMessages(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "dd.MM HH:mm");
  };

  const formatSessionCountry = (value: string | null | undefined) => {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return "";

    // Backend currently sends timezone-like strings (e.g. America/Vancouver).
    // Show them as a readable location label in the chat list.
    if (!raw.includes("/")) return raw;

    const parts = raw
      .split("/")
      .filter(Boolean)
      .map((part) => part.replace(/_/g, " "));

    if (parts.length <= 1) return parts[0] || raw;

    const city = parts[parts.length - 1];
    const region = parts.slice(0, -1).join(" / ");
    return `${city} (${region})`;
  };

  const formatVisitLocation = (event: TelemetryEvent) => {
    const countryName = typeof event.country === "string" ? event.country.trim() : "";
    const countryCode = typeof event.countryCode === "string" ? event.countryCode.trim().toUpperCase() : "";
    const region = typeof event.region === "string" ? event.region.trim() : "";

    const country = countryName || countryCode || "Unknown country";
    return region ? `${country}, ${region}` : country;
  };

  const getReferrerMeta = (value: string | null | undefined) => {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!raw) return null;

    let hostname = raw;
    try {
      const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
      hostname = (url.hostname || raw).toLowerCase();
    } catch {
      hostname = raw.split("/")[0].toLowerCase();
    }

    hostname = hostname.replace(/^www\./, "");
    if (!hostname) return null;

    const searchMatchers = ["google.", "bing.", "duckduckgo.", "yahoo.", "yandex.", "baidu.", "ecosia."];
    const socialMatchers = [
      "facebook.",
      "instagram.",
      "linkedin.",
      "twitter.",
      "x.com",
      "t.co",
      "reddit.",
      "pinterest.",
      "tiktok.",
      "youtube.",
      "youtu.be",
    ];

    const type = searchMatchers.some((m) => hostname.includes(m))
      ? "Search"
      : socialMatchers.some((m) => hostname.includes(m))
        ? "Social"
        : "Referral";

    return {
      domain: hostname,
      type,
      href: `https://${hostname}`,
    } as const;
  };

  const getReferrerBadgeClass = (type: "Search" | "Social" | "Referral") => {
    if (type === "Search") {
      return "border-blue-400/30 bg-blue-500/15 text-blue-200";
    }
    if (type === "Social") {
      return "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200";
    }
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  };

  const hasText = (value: string | null | undefined) => typeof value === "string" && value.trim().length > 0;

  const getLeadContacts = (lead: Lead) => {
    const contacts: Array<{ type: "email" | "phone" | "handle"; value: string }> = [];
    if (hasText(lead.email)) contacts.push({ type: "email", value: lead.email!.trim() });
    if (hasText(lead.phone)) contacts.push({ type: "phone", value: lead.phone!.trim() });
    if (hasText(lead.handle)) contacts.push({ type: "handle", value: lead.handle!.trim() });
    return contacts;
  };

  const getPrimaryContactLabel = (lead: Lead) => {
    const contacts = getLeadContacts(lead);
    if (contacts.length === 0) return "No contact provided";
    if (contacts[0].type === "handle") {
      return contacts[0].value.startsWith("@") ? contacts[0].value : `@${contacts[0].value}`;
    }
    return contacts[0].value;
  };

  const getDeviceCount = (device: "mobile" | "tablet" | "desktop") => {
    return (
      telemetrySummary?.byDevice?.find(
        (d) => String(d.deviceType || "").trim().toLowerCase() === device
      )?.count || 0
    );
  };

  const telemetryCountryStatsByCode = useMemo(() => {
    const map = new Map<string, TelemetryCountryStat>();

    for (const item of telemetryCountries) {
      const code = String(item.countryCode || "").trim().toUpperCase();
      if (!code) continue;
      map.set(code, {
        countryCode: code,
        country: item.country || code,
        count: Number(item.count || 0),
      });
    }

    return map;
  }, [telemetryCountries]);

  const telemetryCountryShapes = useMemo(() => {
    if (!worldMapFeatures.length) return [];

    const maxCount = Math.max(
      ...Array.from(telemetryCountryStatsByCode.values()).map((item) => Number(item.count || 0)),
      1
    );

    return worldMapFeatures
      .map((feature, idx) => {
        const code = getFeatureCountryCode(feature);
        if (!code || code === "AQ") return null;

        const path = geometryToSvgPath(feature.geometry);
        if (!path) return null;

        const stat = telemetryCountryStatsByCode.get(code);
        const count = Number(stat?.count || 0);
        const intensity = count > 0 ? Math.pow(count / maxCount, 0.55) : 0;
        const fillOpacity = count > 0 ? 0.22 + intensity * 0.68 : 0.22;

        return {
          key: `${code}-${idx}`,
          path,
          country: stat?.country || feature?.properties?.ADMIN || feature?.properties?.NAME || code,
          count,
          fill: count > 0 ? `rgba(236,72,153,${fillOpacity.toFixed(3)})` : "rgba(15,23,42,0.52)",
          stroke: count > 0 ? "rgba(249,168,212,0.95)" : "rgba(71,85,105,0.45)",
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [worldMapFeatures, telemetryCountryStatsByCode]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        loadAnalytics(),
        loadKnowledgeGaps(),
        loadLeads(),
        loadTelemetry(),
      ]);
      toast.success("Analytics updated");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteLead = async () => {
    const targetLead = leadPendingDelete;
    if (!targetLead) return;

    const leadId = String(targetLead.id || "").trim();
    if (!leadId) {
      toast.error("This lead cannot be deleted because ID is missing.");
      return;
    }

    try {
      setDeletingLeadId(leadId);
      await apiFetch(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: "DELETE",
      });

      setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
      if (selectedLead?.id === leadId) {
        setSelectedLead(null);
        setSelectedSession(null);
        setSessionMessages([]);
      }

      setLeadPendingDelete(null);
      toast.success("Lead deleted");
    } catch (error: any) {
      console.error("Error deleting lead:", error);
      toast.error(error?.message || "Failed to delete lead");
    } finally {
      setDeletingLeadId(null);
    }
  };

  const handleDeleteSession = async () => {
    const targetSession = sessionPendingDelete;
    if (!targetSession) return;

    const sessionId = String(targetSession.id || "").trim();
    if (!sessionId) {
      toast.error("This chat cannot be deleted because sessionId is missing.");
      return;
    }

    try {
      setDeletingSessionId(sessionId);
      const response = await apiFetch<any>(`/api/statistic/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });

      const deletedMessagesRaw = Number(
        response?.deletedMessages ??
          response?.messagesDeleted ??
          response?.deleted_messages ??
          response?.messages
      );
      const deletedSessionsRaw = Number(
        response?.deletedSessions ??
          response?.sessionsDeleted ??
          response?.deleted_sessions ??
          response?.sessions
      );

      const removedMessages = Number.isFinite(deletedMessagesRaw)
        ? Math.max(0, deletedMessagesRaw)
        : Math.max(0, Number(targetSession.message_count || 0));
      const removedSessions = Number.isFinite(deletedSessionsRaw)
        ? Math.max(1, deletedSessionsRaw)
        : 1;

      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
      setKnowledgeGaps((prev) => prev.filter((gap) => gap.session_id !== sessionId));

      if (selectedSession === sessionId) {
        setSelectedSession(null);
        setSessionMessages([]);
      }

      if (selectedLead?.session_id === sessionId) {
        setSessionMessages([]);
      }

      setStats((prev) => {
        if (!prev) return prev;

        const nextTotalSessions = Math.max(0, prev.totalSessions - removedSessions);
        const nextTotalMessages = Math.max(0, prev.totalMessages - removedMessages);

        return {
          ...prev,
          totalSessions: nextTotalSessions,
          totalMessages: nextTotalMessages,
          averageMessagesPerSession:
            nextTotalSessions > 0 ? Number((nextTotalMessages / nextTotalSessions).toFixed(1)) : 0,
        };
      });

      setSessionPendingDelete(null);
      toast.success(
        removedMessages > 0
          ? `Chat deleted (${removedMessages} messages removed)`
          : "Chat deleted"
      );
    } catch (error: any) {
      console.error("Error deleting chat session:", error);
      toast.error(error?.message || "Failed to delete chat");
    } finally {
      setDeletingSessionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center p-8 lg:h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentList = activeTab === "sessions" ? sessions : knowledgeGaps;

  return (
    <div className="space-y-4 h-full">
      {/* Stats Header with integrated date filter */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        {/* Stats - improved visual design */}
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:flex-1">
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl">
            <div className="p-1.5 bg-primary/20 rounded-lg">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="text-lg font-semibold">{stats?.totalSessions || 0}</span>
              <span className="text-xs text-muted-foreground ml-1.5">chats</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl">
            <div className="p-1.5 bg-blue-500/20 rounded-lg">
              <MessageSquare className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <span className="text-lg font-semibold">{stats?.totalMessages || 0}</span>
              <span className="text-xs text-muted-foreground ml-1.5">messages</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <span className="text-lg font-semibold">{stats?.averageMessagesPerSession || 0}</span>
              <span className="text-xs text-muted-foreground ml-1.5">avg msgs/chat</span>
            </div>
          </div>
        </div>

        {/* Date Filter - matching stats height */}
        <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/40 p-2 sm:w-auto sm:flex-nowrap sm:border-0 sm:bg-transparent sm:p-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-[48px] w-full min-w-[120px] flex-1 justify-start text-left font-normal text-xs sm:w-[120px] sm:flex-none",
                  !dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, "dd.MM.yy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <span className="hidden text-muted-foreground text-xs sm:inline">-</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-[48px] w-full min-w-[120px] flex-1 justify-start text-left font-normal text-xs sm:w-[120px] sm:flex-none",
                  !dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateTo ? format(dateTo, "dd.MM.yy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-[48px] w-[48px] shrink-0"
              onClick={() => {
                setDateFrom(undefined);
                setDateTo(undefined);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="outline"
            className="h-[48px] w-[48px] shrink-0 px-0"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Split View: List + Chat */}
      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:h-[calc(100vh-280px)] lg:min-h-[600px]"
      >
        {/* Left Panel: Chat List */}
        <Card className="lg:col-span-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-3">
            <Tabs value={activeTab} onValueChange={(v) => {
              setActiveTab(v);
              if (v === "leads" || v === "telemetry") {
                setSelectedSession(null);
              }
              if (v !== "leads") {
                setSelectedLead(null);
              }
            }}>
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="sessions">
                  Chats
                </TabsTrigger>
                <TabsTrigger value="gaps" className="relative">
                  Issues
                  {(stats?.pendingKnowledgeGaps || 0) > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                      {stats?.pendingKnowledgeGaps}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="leads" className="relative">
                  Leads
                  {leads.length > 0 && (
                    <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                      {leads.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="telemetry" className="relative">
                  Traffic
                  {(telemetrySummary?.total || 0) > 0 && (
                    <Badge className="ml-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]">
                      {telemetrySummary?.total}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {activeTab === "sessions" ? (
                sessions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 px-4">No chat sessions yet</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {sessions.map((session) => {
                      const sessionCountry = formatSessionCountry(session.country);

                      return (
                        <div
                          key={session.id}
                          onClick={() => {
                            setSelectedLead(null);
                            viewSessionHistory(session.id);
                          }}
                          className={cn(
                            "group p-4 cursor-pointer transition-all",
                            selectedSession === session.id && !selectedLead
                              ? "bg-gradient-to-r from-primary/20 to-primary/10 border-l-2 border-l-primary"
                              : "hover:bg-accent/50",
                            deletingSessionId === session.id && "pointer-events-none opacity-70"
                          )}
                        >
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatShortDate(session.created_at)}</span>
                              <span className="text-muted-foreground/50">•</span>
                              <span>{session.message_count} msgs</span>
                              {session.had_knowledge_gaps && (
                                <Badge variant="destructive" className="text-xs h-4 px-1">
                                  ⚠️
                                </Badge>
                              )}
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSessionPendingDelete(session);
                                }}
                                disabled={!!deletingSessionId || !!deletingLeadId}
                                title="Delete chat"
                              >
                                {deletingSessionId === session.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <p className="line-clamp-2 text-sm">
                            {session.first_message || "Empty conversation"}
                          </p>
                          {sessionCountry && (
                            <div className="mt-2 inline-flex max-w-full items-start gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                              <Globe className="mt-0.5 h-3 w-3 shrink-0" />
                              <span className="break-words leading-relaxed">{sessionCountry}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : activeTab === "gaps" ? (
                knowledgeGaps.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 px-4">
                    No knowledge gaps detected
                  </p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {knowledgeGaps.map((gap) => (
                      <div
                        key={gap.id}
                        onClick={() => {
                          setSelectedGapId(gap.id);
                          setSelectedLead(null);
                          viewSessionHistory(gap.session_id);
                        }}
                        className={cn(
                          "p-4 cursor-pointer transition-all",
                          selectedGapId === gap.id && !selectedLead
                            ? "bg-gradient-to-r from-primary/20 to-primary/10 border-l-2 border-l-primary" 
                            : "hover:bg-accent/50"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant={
                              gap.status === 'resolved' ? 'default' : 
                              gap.status === 'in_progress' ? 'secondary' : 
                              gap.status === 'ignored' ? 'outline' :
                              'destructive'
                            }
                            className="text-xs"
                          >
                            {gap.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatShortDate(gap.created_at)}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2">{gap.user_question}</p>
                        {gap.status === 'pending' && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateGapStatus(gap.id, 'resolved');
                              }}
                            >
                              Resolve
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateGapStatus(gap.id, 'ignored');
                              }}
                            >
                              Ignore
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : activeTab === "leads" ? (
                leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 px-4">
                    No leads yet
                  </p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {leads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => {
                          setSelectedLead(lead);
                          if (lead.session_id) {
                            viewSessionHistory(lead.session_id);
                          } else {
                            setSelectedSession(null);
                            setSessionMessages([]);
                          }
                        }}
                        className={cn(
                          "group p-4 cursor-pointer transition-all",
                          selectedLead?.id === lead.id
                            ? "bg-gradient-to-r from-primary/20 to-primary/10 border-l-2 border-l-primary"
                            : "hover:bg-accent/50",
                          deletingLeadId === lead.id && "pointer-events-none opacity-70"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {lead.request_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatShortDate(lead.created_at)}
                              </span>
                              {lead.session_id && (
                                <Badge variant="outline" className="text-xs">
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  Chat
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-sm font-medium">{lead.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{getPrimaryContactLabel(lead)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              setLeadPendingDelete(lead);
                            }}
                            disabled={!!deletingLeadId}
                            title="Delete lead"
                          >
                            {deletingLeadId === lead.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : loadingTelemetry ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Widget loads</p>
                    <p className="text-xl font-semibold mt-1">{telemetrySummary?.total || 0}</p>
                  </div>

                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">By device</p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Mobile</span>
                      </div>
                      <span className="font-medium">{getDeviceCount("mobile")}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Tablet className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Tablet</span>
                      </div>
                      <span className="font-medium">{getDeviceCount("tablet")}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Desktop</span>
                      </div>
                      <span className="font-medium">{getDeviceCount("desktop")}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-2">Top viewports</p>
                    {telemetrySummary?.topViewports?.length ? (
                      <div className="space-y-1.5">
                        {telemetrySummary.topViewports.slice(0, 5).map((vp, idx) => (
                          <div key={`${vp.viewportW}-${vp.viewportH}-${idx}`} className="flex items-center justify-between text-xs">
                            <span>{vp.viewportW}x{vp.viewportH}</span>
                            <span className="text-muted-foreground">{vp.count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No viewport data yet</p>
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Panel: Chat Messages or Lead Details */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {!selectedSession && !selectedLead && (
            <CardHeader className="pb-3 border-b flex-shrink-0">
              <CardTitle className="text-base font-medium">
                {activeTab === "leads" ? "Select a lead" : activeTab === "telemetry" ? "Telemetry details" : "Select a chat"}
              </CardTitle>
            </CardHeader>
          )}
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {activeTab === "telemetry" ? (
                loadingTelemetry ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Total widget loads</p>
                        <p className="text-2xl font-semibold mt-1">{telemetrySummary?.total || 0}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Mobile loads</p>
                        <p className="text-2xl font-semibold mt-1">{getDeviceCount("mobile")}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Tablet loads</p>
                        <p className="text-2xl font-semibold mt-1">{getDeviceCount("tablet")}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Desktop loads</p>
                        <p className="text-2xl font-semibold mt-1">{getDeviceCount("desktop")}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-2">Visits by country</p>
                      <div className="relative w-full aspect-[1200/620] rounded-md overflow-hidden border bg-slate-950/40">
                        <svg
                          viewBox={`0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`}
                          className="absolute inset-0 h-full w-full"
                          aria-label="World map with highlighted countries"
                          preserveAspectRatio="xMidYMid meet"
                        >
                          <rect width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} fill="rgba(2, 6, 23, 0.5)" />
                          {telemetryCountryShapes.map((shape) => (
                            <path
                              key={shape.key}
                              d={shape.path}
                              fill={shape.fill}
                              stroke={shape.stroke}
                              strokeWidth={0.9}
                              vectorEffect="non-scaling-stroke"
                            >
                              <title>{shape.count > 0 ? `${shape.country}: ${shape.count}` : shape.country}</title>
                            </path>
                          ))}
                        </svg>
                      </div>
                      {loadingWorldMap && (
                        <p className="text-xs text-muted-foreground mt-2">Loading map...</p>
                      )}
                      {!loadingWorldMap && telemetryCountryShapes.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          No country map data available.
                        </p>
                      )}
                      {!loadingWorldMap && telemetryCountryShapes.length > 0 && telemetryCountries.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          No visits in selected period yet.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground mb-2">Top countries</p>
                        {telemetryCountries.length ? (
                          <div className="space-y-1.5">
                            {telemetryCountries.slice(0, 8).map((item, idx) => (
                              <div key={`${item.countryCode}-${idx}`} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{item.country || item.countryCode}</span>
                                </div>
                                <span className="text-muted-foreground">{item.count}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No country data yet</p>
                        )}
                      </div>

                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground mb-2">Top viewports</p>
                        {telemetrySummary?.topViewports?.length ? (
                          <div className="space-y-1.5">
                            {telemetrySummary.topViewports.slice(0, 8).map((vp, idx) => (
                              <div key={`${vp.viewportW}-${vp.viewportH}-${idx}`} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{vp.viewportW}x{vp.viewportH}</span>
                                </div>
                                <span className="text-muted-foreground">{vp.count}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No viewport data yet</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground mb-2">Recent visits</p>
                      {telemetryEvents.length ? (
                        <div className="space-y-2">
                          {telemetryEvents.slice(0, 12).map((ev, idx) => {
                            const referrer = getReferrerMeta(ev.referrerDomain);

                            return (
                              <div key={`${ev.createdAt}-${ev.pagePath}-${idx}`} className="flex items-start justify-between text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{ev.pagePath || "/"}</p>
                                  <p className="text-muted-foreground truncate">
                                    {ev.deviceType || "unknown"} | {ev.viewportW || "?"}x{ev.viewportH || "?"} | {formatVisitLocation(ev)}
                                  </p>
                                  {referrer && (
                                    <div className="mt-1 flex items-center gap-2 min-w-0">
                                      <Badge variant="secondary" className={cn("h-5 px-2 rounded-full text-[10px] font-medium gap-1", getReferrerBadgeClass(referrer.type))}>
                                        {referrer.type === "Search" ? <Search className="h-3 w-3" /> : referrer.type === "Social" ? <Share2 className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                                        <span>{referrer.type}</span>
                                      </Badge>
                                      <a
                                        href={referrer.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="min-w-0 max-w-[260px] inline-flex items-center gap-1 overflow-hidden text-[11px] text-primary/90 hover:text-primary transition-colors"
                                        title={`Referrer: ${referrer.domain}`}
                                      >
                                        <span className="truncate">{referrer.domain}</span>
                                        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                                <span className="text-muted-foreground ml-3 shrink-0">{formatShortDate(ev.createdAt)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No visits in selected period</p>
                      )}
                    </div>
                  </div>
                )
              ) : selectedLead ? (
                // Lead Details View with Chat
                <div className="flex flex-col h-full">
                  {/* Lead Contact Card - Always visible */}
                  <div className="p-4 border-b bg-muted/30 flex-shrink-0">
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 bg-primary/10 rounded-full flex-shrink-0">
                        <UserCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="truncate text-lg font-semibold">{selectedLead.name}</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setLeadPendingDelete(selectedLead)}
                            disabled={!!deletingLeadId}
                          >
                            {deletingLeadId === selectedLead.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Delete
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {getLeadContacts(selectedLead).map((contact, index) => (
                            <div key={`${contact.type}-${contact.value}-${index}`} className="flex items-center gap-1.5 text-sm">
                              {contact.type === "email" && <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                              {contact.type === "phone" && <Phone className="h-3.5 w-3.5 text-muted-foreground" />}
                              {contact.type === "handle" && <AtSign className="h-3.5 w-3.5 text-muted-foreground" />}
                              {contact.type === "email" ? (
                                <a href={`mailto:${contact.value}`} className="text-primary hover:underline">
                                  {contact.value}
                                </a>
                              ) : contact.type === "phone" ? (
                                <a href={`tel:${contact.value.replace(/\s+/g, "")}`} className="text-primary hover:underline">
                                  {contact.value}
                                </a>
                              ) : (
                                <span>{contact.value.startsWith("@") ? contact.value : `@${contact.value}`}</span>
                              )}
                            </div>
                          ))}
                          {getLeadContacts(selectedLead).length === 0 && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>No contact provided</span>
                            </div>
                          )}
                          {selectedLead.company && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{selectedLead.company}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">{selectedLead.request_type}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(selectedLead.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Lead message if no chat */}
                    {!selectedLead.session_id && selectedLead.message && (
                      <div className="mt-4 p-3 bg-background rounded-lg border">
                        <p className="text-xs text-muted-foreground mb-1">Message</p>
                        <p className="text-sm whitespace-pre-wrap">{selectedLead.message}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-auto">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : sessionMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p className="text-center py-20">
                          {selectedLead.session_id ? "No messages in this conversation" : "No chat associated with this lead"}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 space-y-4">
                        {sessionMessages.map((message, index) => (
                          <div
                            key={index}
                            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={cn(
                                "max-w-[80%] rounded-lg p-3",
                                message.role === "user"
                                  ? "bg-primary/20 border border-primary/30 text-foreground"
                                  : "bg-secondary text-secondary-foreground border"
                              )}
                            >
                              <div className="text-xs opacity-70 mb-1">
                                {message.role === "user" ? "User" : "Assistant"}
                              </div>
                              <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                              <div className="text-xs opacity-50 mt-1">
                                {formatDate(message.created_at)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : !selectedSession ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p className="text-center py-20">
                    {activeTab === "leads" ? "Select a lead to view details" : "Select a chat from the list to view the conversation"}
                  </p>
                </div>
              ) : loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : sessionMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p className="text-center py-20">No messages in this conversation</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {sessionMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg p-3",
                          message.role === "user"
                            ? "bg-primary/20 border border-primary/30 text-foreground"
                            : "bg-secondary text-secondary-foreground border"
                        )}
                      >
                        <div className="text-xs opacity-70 mb-1">
                          {message.role === "user" ? "User" : "Assistant"}
                        </div>
                        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                        <div className="text-xs opacity-50 mt-1">
                          {formatDate(message.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={!!leadPendingDelete}
        onOpenChange={(open) => {
          if (!open && !deletingLeadId) {
            setLeadPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The lead and linked contact snapshot will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {leadPendingDelete && (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <p className="text-sm font-medium">{leadPendingDelete.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{getPrimaryContactLabel(leadPendingDelete)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(leadPendingDelete.created_at)}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingLeadId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!leadPendingDelete || !!deletingLeadId}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteLead();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingLeadId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!sessionPendingDelete}
        onOpenChange={(open) => {
          if (!open && !deletingSessionId) {
            setSessionPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the full chat and all messages in this session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {sessionPendingDelete && (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <p className="text-sm font-medium">Session: {sessionPendingDelete.id}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Started: {formatDate(sessionPendingDelete.created_at)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Messages: {sessionPendingDelete.message_count}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingSessionId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!sessionPendingDelete || !!deletingSessionId}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteSession();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSessionId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
