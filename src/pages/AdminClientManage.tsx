import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Upload, Copy, ExternalLink, ArrowLeft, Trash2, X, Image as ImageIcon, Eye, Download, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import ClientAnalytics from "./ClientAnalytics";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { auth, buildAuthPath, getUserSites, hasAdminRole, hasSuperAdminRole, isUnauthorizedError } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.

CONTENT RULES:
1. ALWAYS answer ONLY based on the knowledge base provided
2. For general questions - give a BRIEF overview (2-3 sentences) using ONLY information from the knowledge base
3. If specific information exists in the knowledge base - use it with exact details
4. If information is not in the knowledge base - honestly say so and suggest contacting support
5. DO NOT use general knowledge - ONLY the knowledge base provided`;
const UNSAVED_SETTINGS_MESSAGE = "You have unsaved changes. Leave this page without saving?";

interface Client {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  site_id?: string;
}

interface WidgetConfigForm {
  widgetTitle: string;
  welcomeMessage: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  logoUrl: string | null;
  customSystemPrompt: string;
  lang: string;
  position: string;
  inputPlaceholder: string;
  headerBackgroundColor: string;
  headerTextColor: string;
  assistantBubbleColor: string;
  assistantBubbleTextColor: string;
  userBubbleColor: string;
  userBubbleTextColor: string;
  bubbleBorderColor: string;
  inputBackgroundColor: string;
  inputTextColor: string;
  inputBorderColor: string;
  sendButtonBackgroundColor: string;
  sendButtonIconColor: string;
  showAvatars: boolean;
  showTimestamps: boolean;
  fontFamily: string;
  fontCssUrl: string;
  fontFileUrl: string;
  baseFontSize: number;
  autostart: boolean;
  autostartDelay: number;
  autostartMode: string;
  autostartMessage: string;
  autostartPrompt: string;
  autostartCooldownHours: number;
  preserveHistory: boolean;
  resetHistoryOnOpen: boolean;
  inlineAutostart: string;
  stream: boolean;
  leadCapture: string;
  isActive: boolean;
  widgetVersionOverride: string;
}

type ColorConfigField =
  | "primaryColor"
  | "backgroundColor"
  | "textColor"
  | "borderColor"
  | "headerBackgroundColor"
  | "headerTextColor"
  | "assistantBubbleColor"
  | "assistantBubbleTextColor"
  | "userBubbleColor"
  | "userBubbleTextColor"
  | "bubbleBorderColor"
  | "inputBackgroundColor"
  | "inputTextColor"
  | "inputBorderColor"
  | "sendButtonBackgroundColor"
  | "sendButtonIconColor";

interface Document {
  id: string;
  title: string;
  file_name: string;
  is_active: boolean;
  created_at: string;
  file_size: number;
  content?: string;
  original_file_url?: string;
  mime_type?: string;
}

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const normalizePickerColor = (value: string, fallback = "#000000") => {
  const trimmed = (value || "").trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) return fallback;
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return trimmed.toLowerCase();
};

interface ColorFieldProps {
  label: string;
  value: string;
  fallback?: string;
  onChange: (value: string) => void;
}

const ColorField = ({ label, value, fallback = "#000000", onChange }: ColorFieldProps) => {
  const normalized = (value || "").trim();
  const isConfigured = normalized.length > 0;

  return (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="flex items-center gap-2">
      <Input
        type="color"
        value={normalizePickerColor(value, fallback)}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-14 cursor-pointer p-1 ${isConfigured ? "" : "opacity-60"}`}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Not set (default ${fallback})`}
      />
      {isConfigured && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 px-3"
          onClick={() => onChange("")}
        >
          Clear
        </Button>
      )}
    </div>
    <p className={`text-xs ${isConfigured ? "text-muted-foreground" : "text-amber-500/80"}`}>
      {isConfigured ? "Configured" : "Not set in DB (widget default will be used)"}
    </p>
  </div>
  );
};

interface InlineLoaderWidgetPreviewProps {
  siteId: string;
  host: string;
}

const toSafeHtmlId = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const InlineLoaderWidgetPreview = ({ siteId, host }: InlineLoaderWidgetPreviewProps) => {
  const [loadError, setLoadError] = useState<string | null>(null);
  const slotId = useMemo(() => {
    const safe = toSafeHtmlId(siteId) || "site";
    return `aiw-inline-slot-${safe}`;
  }, [siteId]);

  useEffect(() => {
    setLoadError(null);
    const target = document.getElementById(slotId);
    if (target) target.innerHTML = "";

    const script = document.createElement("script");
    script.src = `${host}/aiw/widget-loader.js`;
    script.defer = true;
    script.setAttribute("data-host", host);
    script.setAttribute("data-site-id", siteId);
    script.setAttribute("data-mode", "inline");
    script.setAttribute("data-target", `#${slotId}`);
    script.setAttribute("data-fit", "container");
    script.setAttribute("data-aiw-inline", "1");
    script.setAttribute("data-aiw-slot", slotId);
    script.onerror = () => {
      setLoadError(`Failed to load widget loader from ${host}`);
    };
    document.body.appendChild(script);

    const verifyTimer = window.setTimeout(() => {
      const mountedTarget = document.getElementById(slotId);
      if (!mountedTarget) return;

      const hasContent =
        mountedTarget.childElementCount > 0 ||
        (mountedTarget.shadowRoot?.childElementCount || 0) > 0;

      if (!hasContent) {
        setLoadError("Widget did not initialize. Check siteId and widget host.");
      }
    }, 4500);

    return () => {
      window.clearTimeout(verifyTimer);
      script.remove();
      const mountedTarget = document.getElementById(slotId);
      if (mountedTarget) mountedTarget.innerHTML = "";
    };
  }, [host, siteId, slotId]);

  return (
    <div className="space-y-2">
      <div
        id={slotId}
        className="h-[70vh] min-h-[460px] max-h-[680px] w-full sm:h-[72vh] sm:min-h-[520px] sm:max-h-[760px] lg:h-[74vh] lg:max-h-[820px]"
      />
      {loadError ? (
        <p className="text-xs text-amber-500">{loadError}</p>
      ) : null}
    </div>
  );
};

const AdminClientManage = () => {
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfigForm>({
    widgetTitle: "AI Assistant",
    welcomeMessage: "Hi! How can I help you today?",
    primaryColor: "#2927ea",
    backgroundColor: "#0f0f0f",
    textColor: "#ffffff",
    borderColor: "#2927ea",
    logoUrl: null,
    customSystemPrompt: DEFAULT_SYSTEM_PROMPT,
    lang: "en",
    position: "br",
    inputPlaceholder: "",
    headerBackgroundColor: "",
    headerTextColor: "",
    assistantBubbleColor: "",
    assistantBubbleTextColor: "",
    userBubbleColor: "",
    userBubbleTextColor: "",
    bubbleBorderColor: "",
    inputBackgroundColor: "",
    inputTextColor: "",
    inputBorderColor: "",
    sendButtonBackgroundColor: "",
    sendButtonIconColor: "",
    showAvatars: true,
    showTimestamps: true,
    fontFamily: "",
    fontCssUrl: "",
    fontFileUrl: "",
    baseFontSize: 14,
    autostart: false,
    autostartDelay: 5000,
    autostartMode: "local",
    autostartMessage: "",
    autostartPrompt: "",
    autostartCooldownHours: 12,
    preserveHistory: true,
    resetHistoryOnOpen: false,
    inlineAutostart: "",
    stream: false,
    leadCapture: "",
    isActive: true,
    widgetVersionOverride: "",
  });
  const [persistedWidgetConfig, setPersistedWidgetConfig] = useState<WidgetConfigForm | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [togglingDocuments, setTogglingDocuments] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  
  // Logo upload states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  // Document viewing states
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  
  // Users state
  const [clientUsers, setClientUsers] = useState<Array<{ id: string; user_id: string; email: string; created_at: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  const normalizeSiteId = (value: unknown) => String(value ?? "").trim().toLowerCase();
  const toSnakeCaseKey = (value: string) => value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  const readConfigField = (config: any | undefined, field: string): unknown => {
    if (!config || typeof config !== "object") return undefined;
    const record = config as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, field)) return record[field];
    return record[toSnakeCaseKey(field)];
  };
  const readRawColorValue = (config: any | undefined, field: ColorConfigField): string => {
    const rawValue = readConfigField(config, field);
    if (typeof rawValue !== "string") return "";
    return rawValue.trim();
  };

  useEffect(() => {
    checkAdminAndLoadData();
  }, [clientId]);

  useEffect(() => {
    if (client) {
      loadClientUsers();
    }
  }, [client]);

  const mapWidgetConfig = (
    config: any | undefined,
    rawColorSource: any | undefined = config,
  ): WidgetConfigForm => {
    return {
      widgetTitle: config?.widgetTitle || "AI Assistant",
      welcomeMessage: config?.welcomeMessage || "Hi! How can I help you today?",
      primaryColor: readRawColorValue(rawColorSource, "primaryColor"),
      backgroundColor: readRawColorValue(rawColorSource, "backgroundColor"),
      textColor: readRawColorValue(rawColorSource, "textColor"),
      borderColor: readRawColorValue(rawColorSource, "borderColor"),
      logoUrl: config?.logo?.url || config?.logoUrl || null,
      customSystemPrompt: config?.customSystemPrompt || DEFAULT_SYSTEM_PROMPT,
      lang: config?.lang || "en",
      position: config?.position || "br",
      inputPlaceholder: config?.inputPlaceholder || "",
      headerBackgroundColor: readRawColorValue(rawColorSource, "headerBackgroundColor"),
      headerTextColor: readRawColorValue(rawColorSource, "headerTextColor"),
      assistantBubbleColor: readRawColorValue(rawColorSource, "assistantBubbleColor"),
      assistantBubbleTextColor: readRawColorValue(rawColorSource, "assistantBubbleTextColor"),
      userBubbleColor: readRawColorValue(rawColorSource, "userBubbleColor"),
      userBubbleTextColor: readRawColorValue(rawColorSource, "userBubbleTextColor"),
      bubbleBorderColor: readRawColorValue(rawColorSource, "bubbleBorderColor"),
      inputBackgroundColor: readRawColorValue(rawColorSource, "inputBackgroundColor"),
      inputTextColor: readRawColorValue(rawColorSource, "inputTextColor"),
      inputBorderColor: readRawColorValue(rawColorSource, "inputBorderColor"),
      sendButtonBackgroundColor: readRawColorValue(rawColorSource, "sendButtonBackgroundColor"),
      sendButtonIconColor: readRawColorValue(rawColorSource, "sendButtonIconColor"),
      showAvatars: config?.showAvatars !== false,
      showTimestamps: config?.showTimestamps !== false,
      fontFamily: config?.fontFamily || "",
      fontCssUrl: config?.fontCssUrl || "",
      fontFileUrl: config?.fontFileUrl || "",
      baseFontSize: typeof config?.baseFontSize === "number" ? config.baseFontSize : 14,
      autostart: !!config?.autostart,
      autostartDelay: Number(config?.autostartDelay ?? 5000),
      autostartMode: config?.autostartMode || "local",
      autostartMessage: config?.autostartMessage || "",
      autostartPrompt: config?.autostartPrompt || "",
      autostartCooldownHours: Number(config?.autostartCooldownHours ?? 12),
      preserveHistory: config?.preserveHistory !== false,
      resetHistoryOnOpen: !!config?.resetHistoryOnOpen,
      inlineAutostart: config?.inlineAutostart ? JSON.stringify(config.inlineAutostart, null, 2) : "",
      stream: !!config?.stream,
      leadCapture: config?.leadCapture ? JSON.stringify(config.leadCapture, null, 2) : "",
      isActive: config?.isActive !== false,
      widgetVersionOverride: config?.widgetVersionOverride || "",
    };
  };

  const hasUnsavedChanges = useMemo(() => {
    if (!persistedWidgetConfig) return false;
    const configChanged = JSON.stringify(widgetConfig) !== JSON.stringify(persistedWidgetConfig);
    return configChanged || !!logoFile;
  }, [widgetConfig, persistedWidgetConfig, logoFile]);

  const confirmDiscardUnsavedChanges = () =>
    !hasUnsavedChanges || window.confirm(UNSAVED_SETTINGS_MESSAGE);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const extractDocumentContent = (doc: any): string | undefined => {
    const raw =
      doc?.content ??
      doc?.textContent ??
      doc?.text_content ??
      doc?.textPreview ??
      doc?.text_preview ??
      doc?.extractedText ??
      doc?.extracted_text;

    return typeof raw === "string" && raw.length > 0 ? raw : undefined;
  };

  const extractDocumentUrl = (doc: any): string | undefined => {
    const raw =
      doc?.originalFileUrl ??
      doc?.original_file_url ??
      doc?.fileUrl ??
      doc?.file_url ??
      doc?.s3Url ??
      doc?.s3_url ??
      doc?.url;

    if (typeof raw !== "string") return undefined;
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : undefined;
  };

  const mapDocument = (doc: any): Document => ({
    id: String(doc?._id || doc?.id),
    title: doc?.title || "Untitled",
    file_name: doc?.fileName || doc?.file_name || "document.txt",
    file_size: Number(doc?.fileSize ?? doc?.file_size ?? 0),
    is_active: doc?.isActive ?? doc?.is_active ?? true,
    created_at: doc?.createdAt || doc?.created_at || new Date().toISOString(),
    content: extractDocumentContent(doc),
    original_file_url: extractDocumentUrl(doc),
    mime_type: doc?.mimeType || doc?.mime_type || doc?.contentType || doc?.content_type,
  });

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

      const isSuperAdmin = hasSuperAdminRole(me);
      const allowedSiteIds = getUserSites(me);
      const allowedSiteIdSet = new Set(allowedSiteIds.map(normalizeSiteId));
      if (!isSuperAdmin && allowedSiteIds.length === 0) {
        toast({
          title: "Access denied",
          description: "Your admin account has no assigned sites.",
          variant: "destructive",
        });
        navigate("/", { replace: true });
        return;
      }

      setIsAdmin(true);

      if (!clientId) {
        toast({
          title: "Error",
          description: "Client ID is required",
          variant: "destructive",
        });
        navigate("/admin");
        return;
      }

      // Load client data
      const clientData = await apiFetch<any>(`/api/clients/${clientId}`);

      if (!clientData) {
        toast({
          title: "Error",
          description: "Failed to load client data",
          variant: "destructive",
        });
        navigate("/admin");
        return;
      }

      const currentClientSiteId = normalizeSiteId(clientData.siteId || clientData.site_id);
      if (!isSuperAdmin) {
        const hasAccess = currentClientSiteId.length > 0 && allowedSiteIdSet.has(currentClientSiteId);
        if (!hasAccess) {
          toast({
            title: "Access denied",
            description: "You can only view clients assigned to your account.",
            variant: "destructive",
          });
          navigate("/admin", { replace: true });
          return;
        }
      }

      setClient({
        id: String(clientData._id || clientData.id),
        name: clientData.name,
        slug: clientData.slug,
        api_key: clientData.apiKey || clientData.api_key,
        site_id: clientData.siteId || clientData.site_id,
      });

      const rawClientConfig = clientData?.config;

      try {
        const cfgResponse = await apiFetch<{ ok: boolean; config: any }>(
          `/api/clients/${clientId}/widget-config`
        );
        const mappedConfig = mapWidgetConfig(
          cfgResponse?.config || rawClientConfig,
          rawClientConfig || cfgResponse?.config,
        );
        setWidgetConfig(mappedConfig);
        setPersistedWidgetConfig(mappedConfig);
      } catch (error) {
        const mappedConfig = mapWidgetConfig(rawClientConfig, rawClientConfig);
        setWidgetConfig(mappedConfig);
        setPersistedWidgetConfig(mappedConfig);
      }

      // Load documents
      await loadDocuments(String(clientData._id || clientData.id));
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

  const loadDocuments = async (clientId: string) => {
    try {
      const data = await apiFetch<any[]>(`/api/clients/${clientId}/documents`);
      const mapped = (data || []).map((doc) => mapDocument(doc));
      setDocuments(mapped);
    } catch (error) {
      console.error("Error loading documents:", error);
    }
  };

  const normalizeFileName = (rawName: string) => {
    const normalized = rawName.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim();
    return normalized || "document";
  };

  const getFileExtension = (fileName: string) => {
    const parts = fileName.toLowerCase().split(".");
    return parts.length > 1 ? parts[parts.length - 1] : "";
  };

  const isPdfDocument = (doc: Document) => {
    const mime = (doc.mime_type || "").toLowerCase();
    return mime.includes("pdf") || getFileExtension(doc.file_name) === "pdf";
  };

  const isWordDocument = (doc: Document) => {
    const mime = (doc.mime_type || "").toLowerCase();
    const ext = getFileExtension(doc.file_name);
    return (
      mime.includes("wordprocessingml") ||
      mime.includes("msword") ||
      ext === "docx" ||
      ext === "doc"
    );
  };

  const buildWordPreviewUrl = (sourceUrl: string) =>
    `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(sourceUrl)}`;

  const triggerBrowserDownload = (href: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const loadClientUsers = async () => {
    if (!client) return;
    
    setLoadingUsers(true);
    try {
      const data = await apiFetch<any[]>(`/api/clients/${client.id}/users`);
      const mapped = (data || []).map((u) => ({
        id: String(u._id || u.id),
        user_id: String(u.userId || u.user_id || u.id),
        email: u.email || "Unknown",
        created_at: u.createdAt || u.created_at || new Date().toISOString(),
      }));
      setClientUsers(mapped);
    } catch (error) {
      console.error('Error loading client users:', error);
      toast({
        title: "Error",
        description: "Failed to load client users",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddUser = async () => {
    toast({
      title: "Not supported yet",
      description: "User management endpoint is not wired in this UI yet.",
      variant: "destructive",
    });
  };

  const handleRemoveUser = async (userId: string) => {
    toast({
      title: "Not supported yet",
      description: "User management endpoint is not wired in this UI yet.",
      variant: "destructive",
    });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/png')) {
      toast({
        title: "Error",
        description: "Only PNG files are allowed",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Logo must be less than 2MB",
        variant: "destructive",
      });
      return;
    }

    setLogoFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (!client) return;

    try {
      setWidgetConfig({ ...widgetConfig, logoUrl: null });
      setLogoFile(null);
      setLogoPreview(null);

      toast({
        title: "Logo cleared locally",
        description: "Server-side logo removal is not supported by this endpoint yet.",
        variant: "destructive",
      });
    } catch (error: any) {
      console.error("Error removing logo:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveSettings = async () => {
    if (!client) return;

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("widgetTitle", widgetConfig.widgetTitle);
      formData.append("welcomeMessage", widgetConfig.welcomeMessage);
      formData.append("primaryColor", widgetConfig.primaryColor);
      formData.append("backgroundColor", widgetConfig.backgroundColor);
      formData.append("textColor", widgetConfig.textColor);
      formData.append("borderColor", widgetConfig.borderColor);
      formData.append("lang", widgetConfig.lang);
      formData.append("position", widgetConfig.position);
      formData.append("inputPlaceholder", widgetConfig.inputPlaceholder);
      formData.append("headerBackgroundColor", widgetConfig.headerBackgroundColor);
      formData.append("headerTextColor", widgetConfig.headerTextColor);
      formData.append("assistantBubbleColor", widgetConfig.assistantBubbleColor);
      formData.append("assistantBubbleTextColor", widgetConfig.assistantBubbleTextColor);
      formData.append("userBubbleColor", widgetConfig.userBubbleColor);
      formData.append("userBubbleTextColor", widgetConfig.userBubbleTextColor);
      formData.append("bubbleBorderColor", widgetConfig.bubbleBorderColor);
      formData.append("inputBackgroundColor", widgetConfig.inputBackgroundColor);
      formData.append("inputTextColor", widgetConfig.inputTextColor);
      formData.append("inputBorderColor", widgetConfig.inputBorderColor);
      formData.append("sendButtonBackgroundColor", widgetConfig.sendButtonBackgroundColor);
      formData.append("sendButtonIconColor", widgetConfig.sendButtonIconColor);
      formData.append("showAvatars", String(widgetConfig.showAvatars));
      formData.append("showTimestamps", String(widgetConfig.showTimestamps));
      formData.append("fontFamily", widgetConfig.fontFamily);
      formData.append("fontCssUrl", widgetConfig.fontCssUrl);
      formData.append("fontFileUrl", widgetConfig.fontFileUrl);
      formData.append("baseFontSize", String(widgetConfig.baseFontSize));
      formData.append("customSystemPrompt", widgetConfig.customSystemPrompt);
      formData.append("autostart", String(widgetConfig.autostart));
      formData.append("autostartDelay", String(widgetConfig.autostartDelay));
      formData.append("autostartMode", widgetConfig.autostartMode);
      formData.append("autostartMessage", widgetConfig.autostartMessage);
      formData.append("autostartPrompt", widgetConfig.autostartPrompt);
      formData.append("autostartCooldownHours", String(widgetConfig.autostartCooldownHours));
      formData.append("preserveHistory", String(widgetConfig.preserveHistory));
      formData.append("resetHistoryOnOpen", String(widgetConfig.resetHistoryOnOpen));
      formData.append("stream", String(widgetConfig.stream));
      formData.append("isActive", String(widgetConfig.isActive));
      formData.append("widgetVersionOverride", widgetConfig.widgetVersionOverride);

      if (widgetConfig.inlineAutostart.trim()) {
        formData.append("inlineAutostart", widgetConfig.inlineAutostart.trim());
      }
      if (widgetConfig.leadCapture.trim()) {
        formData.append("leadCapture", widgetConfig.leadCapture.trim());
      }
      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const response = await apiFetch<{ ok: boolean; config: any }>(
        `/api/clients/${client.id}/widget-config`,
        {
          method: "PUT",
          body: formData,
        }
      );

      const updatedConfig = response?.config || {};
      const savedConfig = mapWidgetConfig(updatedConfig, widgetConfig);
      setWidgetConfig(savedConfig);
      setPersistedWidgetConfig(savedConfig);
      setLogoFile(null);
      setLogoPreview(null);

      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!client) return;
    
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
      formData.append("fileName", file.name);

      await apiFetch(`/api/clients/${client.id}/documents`, {
        method: "POST",
        body: formData,
      });

      toast({
        title: "Success",
        description: "Document uploaded",
      });

      await loadDocuments(client.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleToggleDocument = async (docId: string, currentState: boolean) => {
    if (!client) return;

    const nextState = !currentState;
    setTogglingDocuments((prev) => ({ ...prev, [docId]: true }));

    try {
      await apiFetch(`/api/clients/${client.id}/documents/${docId}`, {
        method: "PATCH",
        body: { isActive: nextState },
      });

      setDocuments((docs) =>
        docs.map((doc) =>
          doc.id === docId ? { ...doc, is_active: nextState } : doc
        )
      );

      toast({
        title: "Success",
        description: `Document ${nextState ? "activated" : "deactivated"}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTogglingDocuments((prev) => {
        const next = { ...prev };
        delete next[docId];
        return next;
      });
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await apiFetch(`/api/clients/${client?.id}/documents/${docId}`, {
        method: "DELETE",
      });

      setDocuments(docs => docs.filter(d => d.id !== docId));

      toast({
        title: "Success",
        description: "Document deleted",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewDocument = (doc: Document) => {
    if (!doc.original_file_url && !doc.content) {
      toast({
        title: "Error",
        description: "Document URL is missing in API response",
        variant: "destructive",
      });
      return;
    }

    setViewingDocument(doc);
    setIsViewDialogOpen(true);
  };

  const handleDownloadDocument = (doc: Document) => {
    try {
      const defaultName = doc.file_name || `${doc.title}.txt`;
      const fileName = normalizeFileName(defaultName);

      if (doc.original_file_url) {
        // Avoid CORS issues: delegate file transfer directly to the browser.
        triggerBrowserDownload(doc.original_file_url, fileName);

        toast({
          title: "Download started",
          description: fileName,
        });
        return;
      }

      if (!doc.content) {
        throw new Error("Document content is not available");
      }

      const blob = new Blob([doc.content], { type: doc.mime_type || "text/plain;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      triggerBrowserDownload(url, fileName.endsWith(".txt") ? fileName : `${fileName}.txt`);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Downloaded",
        description: fileName,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Copied to clipboard",
    });
  };

  const generateEmbedCode = (siteId: string) => {
    const host = "https://cloudcompliance.duckdns.org";
    const safeSiteId = String(siteId).replace(/"/g, "&quot;");

    return `<script
  defer
  src="${host}/aiw/widget-loader.js"
  data-host="${host}"
  data-site-id="${safeSiteId}"
  data-mode="floating"
  data-position="right"
></script>`;
  };

  const getWidgetHost = () => {
    const candidate =
      (import.meta.env.VITE_WIDGET_HOST as string | undefined) ||
      "https://cloudcompliance.duckdns.org";

    try {
      return new URL(candidate).origin;
    } catch {
      return "https://cloudcompliance.duckdns.org";
    }
  };

  const renderDocumentPreview = () => {
    if (!viewingDocument) {
      return (
        <div className="h-[60vh] w-full rounded-md border p-4 text-sm text-muted-foreground">
          No document selected
        </div>
      );
    }

    if (viewingDocument.original_file_url && isPdfDocument(viewingDocument)) {
      return (
        <iframe
          src={viewingDocument.original_file_url}
          title={viewingDocument.file_name}
          className="h-[50vh] w-full rounded-md border sm:h-[60vh]"
        />
      );
    }

    if (viewingDocument.original_file_url && isWordDocument(viewingDocument)) {
      return (
        <iframe
          src={buildWordPreviewUrl(viewingDocument.original_file_url)}
          title={viewingDocument.file_name}
          className="h-[50vh] w-full rounded-md border sm:h-[60vh]"
        />
      );
    }

    if (viewingDocument.content) {
      return (
        <ScrollArea className="h-[50vh] w-full rounded-md border p-4 sm:h-[60vh]">
          <pre className="whitespace-pre-wrap font-mono text-sm">
            {viewingDocument.content}
          </pre>
        </ScrollArea>
      );
    }

    return (
      <div className="h-[50vh] w-full rounded-md border p-4 text-sm text-muted-foreground sm:h-[60vh]">
        Preview is unavailable for this file type.
      </div>
    );
  };

  const handleBackToAdminClick = () => {
    if (!confirmDiscardUnsavedChanges()) return;
    navigate("/admin");
  };

  const handleAdminBreadcrumbClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (confirmDiscardUnsavedChanges()) return;
    event.preventDefault();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Client not found</p>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 sm:px-6">
          <div className="mb-3 flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToAdminClick}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
          </div>
          
          <Breadcrumb>
            <BreadcrumbList className="flex-wrap">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/admin" onClick={handleAdminBreadcrumbClick}>Admin</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/admin" onClick={handleAdminBreadcrumbClick}>Clients</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{client.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="mt-3 flex items-center gap-3">
            {widgetConfig.logoUrl && (
              <img 
                src={widgetConfig.logoUrl} 
                alt={client.name}
                className="h-10 w-10 rounded object-contain"
              />
            )}
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">{client.name}</h1>
              <p className="text-sm text-muted-foreground">Manage client configuration and content</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <Tabs defaultValue="setup" className="space-y-6">
          <TabsList className="flex w-full flex-nowrap gap-1 overflow-x-auto md:overflow-visible">
            <TabsTrigger value="analytics" className="shrink-0 whitespace-nowrap md:flex-1">Analytics</TabsTrigger>
            <TabsTrigger value="setup" className="shrink-0 whitespace-nowrap md:flex-1">Widget Setup</TabsTrigger>
            <TabsTrigger value="knowledge" className="shrink-0 whitespace-nowrap md:flex-1">Knowledge Base</TabsTrigger>
            <TabsTrigger value="users" className="shrink-0 whitespace-nowrap md:flex-1">Users</TabsTrigger>
            <TabsTrigger value="code" className="shrink-0 whitespace-nowrap md:flex-1">Widget Code</TabsTrigger>
            <TabsTrigger value="demo" className="shrink-0 whitespace-nowrap md:flex-1">Demo</TabsTrigger>
          </TabsList>

          {/* Widget Setup */}
          <TabsContent value="setup" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Widget Configuration</CardTitle>
                <CardDescription>Customize your AI widget appearance and behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Widget Logo</Label>
                  <div className="space-y-3">
                    {(logoPreview || widgetConfig.logoUrl) && (
                      <div className="relative inline-block">
                        <img
                          src={logoPreview || widgetConfig.logoUrl || ''}
                          alt="Logo preview"
                          className="h-20 w-20 rounded object-contain border border-border bg-muted"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                          onClick={handleRemoveLogo}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                      <Input
                        type="file"
                        accept=".png"
                        onChange={handleLogoChange}
                        className="max-w-xs"
                      />
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PNG format only, max 2MB. Recommended size: 200x200px
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="widget_title">Widget Title</Label>
                  <Input
                    id="widget_title"
                    value={widgetConfig.widgetTitle}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, widgetTitle: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="welcome_message">Welcome Message</Label>
                  <Input
                    id="welcome_message"
                    value={widgetConfig.welcomeMessage}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, welcomeMessage: e.target.value })}
                  />
                </div>
                {/* Appearance */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold">Appearance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColorField
                      label="Primary Color"
                      value={widgetConfig.primaryColor}
                      fallback="#2927ea"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, primaryColor: value })}
                    />
                    <ColorField
                      label="Border Color"
                      value={widgetConfig.borderColor}
                      fallback="#2927ea"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, borderColor: value })}
                    />
                    <ColorField
                      label="Background Color"
                      value={widgetConfig.backgroundColor}
                      fallback="#0f0f0f"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, backgroundColor: value })}
                    />
                    <ColorField
                      label="Text Color"
                      value={widgetConfig.textColor}
                      fallback="#ffffff"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, textColor: value })}
                    />
                    <ColorField
                      label="Header Background"
                      value={widgetConfig.headerBackgroundColor}
                      fallback="#0f0f0f"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, headerBackgroundColor: value })}
                    />
                    <ColorField
                      label="Header Text"
                      value={widgetConfig.headerTextColor}
                      fallback="#ffffff"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, headerTextColor: value })}
                    />
                  </div>
                </div>

                {/* Bubbles & Input */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold">Bubbles & Input</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColorField
                      label="Assistant Bubble Color"
                      value={widgetConfig.assistantBubbleColor}
                      fallback="#1f2937"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, assistantBubbleColor: value })}
                    />
                    <ColorField
                      label="Assistant Bubble Text"
                      value={widgetConfig.assistantBubbleTextColor}
                      fallback="#ffffff"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, assistantBubbleTextColor: value })}
                    />
                    <ColorField
                      label="User Bubble Color"
                      value={widgetConfig.userBubbleColor}
                      fallback="#2927ea"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, userBubbleColor: value })}
                    />
                    <ColorField
                      label="User Bubble Text"
                      value={widgetConfig.userBubbleTextColor}
                      fallback="#ffffff"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, userBubbleTextColor: value })}
                    />
                    <ColorField
                      label="Bubble Border Color"
                      value={widgetConfig.bubbleBorderColor}
                      fallback="#2927ea"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, bubbleBorderColor: value })}
                    />
                    <div className="space-y-2">
                      <Label>Input Placeholder</Label>
                      <Input
                        value={widgetConfig.inputPlaceholder}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, inputPlaceholder: e.target.value })}
                      />
                    </div>
                    <ColorField
                      label="Input Background"
                      value={widgetConfig.inputBackgroundColor}
                      fallback="#0f0f0f"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, inputBackgroundColor: value })}
                    />
                    <ColorField
                      label="Input Text"
                      value={widgetConfig.inputTextColor}
                      fallback="#ffffff"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, inputTextColor: value })}
                    />
                    <ColorField
                      label="Input Border"
                      value={widgetConfig.inputBorderColor}
                      fallback="#2927ea"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, inputBorderColor: value })}
                    />
                    <ColorField
                      label="Send Button Background"
                      value={widgetConfig.sendButtonBackgroundColor}
                      fallback="#2927ea"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, sendButtonBackgroundColor: value })}
                    />
                    <ColorField
                      label="Send Button Icon"
                      value={widgetConfig.sendButtonIconColor}
                      fallback="#ffffff"
                      onChange={(value) => setWidgetConfig({ ...widgetConfig, sendButtonIconColor: value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-6 pt-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={widgetConfig.showAvatars}
                        onCheckedChange={(checked) => setWidgetConfig({ ...widgetConfig, showAvatars: checked })}
                      />
                      <Label>Show Avatars</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={widgetConfig.showTimestamps}
                        onCheckedChange={(checked) => setWidgetConfig({ ...widgetConfig, showTimestamps: checked })}
                      />
                      <Label>Show Timestamps</Label>
                    </div>
                  </div>
                </div>

                {/* Typography */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold">Typography</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Font Family</Label>
                      <Input
                        value={widgetConfig.fontFamily}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, fontFamily: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Font CSS URL</Label>
                      <Input
                        value={widgetConfig.fontCssUrl}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, fontCssUrl: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Font File URL</Label>
                      <Input
                        value={widgetConfig.fontFileUrl}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, fontFileUrl: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Base Font Size</Label>
                      <Input
                        type="number"
                        value={widgetConfig.baseFontSize}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, baseFontSize: Number(e.target.value) })}
                        min={10}
                        max={24}
                      />
                    </div>
                  </div>
                </div>

                {/* Behavior */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold">Behavior</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Input
                        value={widgetConfig.lang}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, lang: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Input
                        value={widgetConfig.position}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, position: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Autostart Mode</Label>
                      <Input
                        value={widgetConfig.autostartMode}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, autostartMode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Autostart Delay (ms)</Label>
                      <Input
                        type="number"
                        value={widgetConfig.autostartDelay}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, autostartDelay: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Autostart Cooldown (hours)</Label>
                      <Input
                        type="number"
                        value={widgetConfig.autostartCooldownHours}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, autostartCooldownHours: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Autostart Message</Label>
                      <Input
                        value={widgetConfig.autostartMessage}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, autostartMessage: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Autostart Prompt</Label>
                      <Input
                        value={widgetConfig.autostartPrompt}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, autostartPrompt: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-6 pt-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={widgetConfig.autostart}
                        onCheckedChange={(checked) => setWidgetConfig({ ...widgetConfig, autostart: checked })}
                      />
                      <Label>Autostart</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={widgetConfig.preserveHistory}
                        onCheckedChange={(checked) => setWidgetConfig({ ...widgetConfig, preserveHistory: checked })}
                      />
                      <Label>Preserve History</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={widgetConfig.resetHistoryOnOpen}
                        onCheckedChange={(checked) => setWidgetConfig({ ...widgetConfig, resetHistoryOnOpen: checked })}
                      />
                      <Label>Reset History On Open</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={widgetConfig.stream}
                        onCheckedChange={(checked) => setWidgetConfig({ ...widgetConfig, stream: checked })}
                      />
                      <Label>Stream</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={widgetConfig.isActive}
                        onCheckedChange={(checked) => setWidgetConfig({ ...widgetConfig, isActive: checked })}
                      />
                      <Label>Active</Label>
                    </div>
                  </div>
                </div>

                {/* Advanced JSON */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold">Advanced</h3>
                  <div className="space-y-2">
                    <Label>Inline Autostart (JSON)</Label>
                    <Textarea
                      value={widgetConfig.inlineAutostart}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, inlineAutostart: e.target.value })}
                      placeholder='{"enabled":true,"mode":"session","script":[{"text":"Hello","delayMs":1000}]}'
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Capture (JSON)</Label>
                    <Textarea
                      value={widgetConfig.leadCapture}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, leadCapture: e.target.value })}
                      placeholder='{"enabled":true,"steps":[...],"triggers":{...}}'
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Widget Version Override</Label>
                    <Input
                      value={widgetConfig.widgetVersionOverride}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, widgetVersionOverride: e.target.value })}
                    />
                  </div>
                </div>

                {/* System Prompt Configuration */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="system_prompt">Custom System Prompt (Optional)</Label>
                  <Textarea
                    id="system_prompt"
                    value={widgetConfig.customSystemPrompt}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, customSystemPrompt: e.target.value })}
                    placeholder="Leave empty to use default prompt. Custom prompt will be used as the system message for ChatGPT API."
                    rows={40}
                    className="min-h-[320px] font-mono text-sm sm:min-h-[600px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    This prompt defines how the AI assistant behaves. If your knowledge base has context, it will be automatically appended to this prompt.
                    Leave empty to use the default sales assistant prompt.
                  </p>
                  {widgetConfig.customSystemPrompt && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-800">
                        <strong>Note:</strong> Your custom prompt is active. Knowledge base context will be automatically appended when available.
                      </p>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  Changes are local and will be saved to DB only after clicking "Save Settings".
                  {hasUnsavedChanges && <span className="ml-1 text-amber-500">Unsaved changes</span>}
                </div>

                <Button onClick={handleSaveSettings} disabled={saving || !hasUnsavedChanges}>
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Base */}
          <TabsContent value="knowledge" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Documents</CardTitle>
                <CardDescription>
                  Upload documents to train your AI assistant. Supported formats: TXT, PDF, DOCX (up to 10MB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg border-2 border-dashed p-4 text-center sm:p-8">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload TXT, PDF, or DOCX files
                    </p>
                    <Input
                      type="file"
                      accept=".txt,.pdf,.docx"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="mx-auto w-full max-w-xs"
                    />
                    {uploading && (
                      <div className="flex items-center justify-center gap-2 mt-3">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        <p className="text-sm text-muted-foreground">Processing document...</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">
                      Upload documents containing information about your products, services, or FAQs.
                    </p>
                  </div>

                  {documents.length === 0 ? (
                    <div className="text-center py-6 border rounded-lg bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-1">
                        No documents uploaded yet.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Upload your first document to train your AI assistant with your business knowledge.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Your Documents</h3>
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium break-words">{doc.title}</p>
                            <p className="text-xs text-muted-foreground break-all sm:break-words">
                              {doc.file_name} | {(doc.file_size / 1024).toFixed(1)} KB |{" "}
                              {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:flex-nowrap sm:justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDocument(doc)}
                              title="View document content"
                              className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadDocument(doc)}
                              title="Download document"
                              className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant={doc.is_active ? "default" : "outline"}
                              size="sm"
                              disabled={!!togglingDocuments[doc.id]}
                              onClick={() => handleToggleDocument(doc.id, doc.is_active)}
                              className="h-8 rounded-full px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                            >
                              {togglingDocuments[doc.id]
                                ? "Updating..."
                                : doc.is_active
                                  ? "Active"
                                  : "Inactive"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Users</CardTitle>
                <CardDescription>
                  Manage users who have access to this client's dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add User Form */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="userEmail">Add User by Email</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="userEmail"
                        type="email"
                        placeholder="user@example.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddUser();
                          }
                        }}
                      />
                      <Button 
                        onClick={handleAddUser} 
                        disabled={addingUser || !emailInput.trim()}
                      >
                        {addingUser ? "Adding..." : "Add User"}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      The user must already have an account to be added.
                    </p>
                  </div>
                </div>

                {/* Users List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Current Users</h3>
                  
                  {loadingUsers ? (
                    <p className="text-muted-foreground">Loading users...</p>
                  ) : clientUsers.length === 0 ? (
                    <p className="text-muted-foreground">No users assigned to this client yet.</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-medium">Email</th>
                            <th className="text-left p-3 font-medium">Added</th>
                            <th className="text-right p-3 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientUsers.map((user) => (
                            <tr key={user.id} className="border-t">
                              <td className="p-3">{user.email}</td>
                              <td className="p-3 text-muted-foreground">
                                {new Date(user.created_at).toLocaleDateString()}
                              </td>
                              <td className="p-3 text-right">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleRemoveUser(user.user_id)}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Widget Code */}
          <TabsContent value="code" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Installation Instructions</CardTitle>
                <CardDescription>
                  Use the widget loader script and client siteId to embed the widget
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Step 1: Your siteId</h3>
                  <div className="flex gap-2">
                    <Input value={client.site_id || "Not configured"} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      disabled={!client.site_id}
                      onClick={() => client.site_id && copyToClipboard(client.site_id)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    data-site-id must contain this exact value from the client's siteId field.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Step 2: Add Embed Code</h3>
                  <p className="text-sm text-muted-foreground">
                    Copy this code and paste it before the closing &lt;/body&gt; tag on your website:
                  </p>
                  {client.site_id ? (
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                        {generateEmbedCode(client.site_id)}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          if (!client.site_id) return;
                          copyToClipboard(generateEmbedCode(client.site_id));
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border p-4 bg-muted/20 text-sm text-muted-foreground">
                      This client has no siteId yet. Add siteId in the clients collection first.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Step 3: Test Your Widget</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    After adding the code, the chat widget will appear on your website. You can test it using the Demo tab!
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/demo/${client.slug}`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Demo Page
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Demo */}
          <TabsContent value="demo">
            <Card>
              <CardHeader>
                <CardTitle>Widget Demo</CardTitle>
                <CardDescription>
                  Live inline widget loaded from production by this client's siteId
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {client.site_id ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      This is the real production loader. It fetches the current widget config for this exact client from DB.
                    </p>
                    <div className="rounded-lg border overflow-hidden bg-muted/20 p-2 sm:p-3">
                      <InlineLoaderWidgetPreview siteId={client.site_id} host={getWidgetHost()} />
                    </div>
                    {client.slug ? (
                      <Button
                        variant="outline"
                        onClick={() => window.open(`/demo/${client.slug}`, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Full Demo Page
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-lg border p-4 bg-muted/20">
                    <p className="text-sm text-muted-foreground">
                      This client has no siteId yet. Add siteId to enable loader-based demo preview.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics">
            <ClientAnalytics clientId={client.id} siteId={client.site_id} />
          </TabsContent>
        </Tabs>

        {/* View Document Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-[95vw] sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{viewingDocument?.title}</DialogTitle>
              <DialogDescription>
                {viewingDocument?.file_name} | {viewingDocument?.file_size ? (viewingDocument.file_size / 1024).toFixed(1) : 0} KB
              </DialogDescription>
            </DialogHeader>
            {renderDocumentPreview()}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => viewingDocument && handleDownloadDocument(viewingDocument)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button onClick={() => setIsViewDialogOpen(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminClientManage;



