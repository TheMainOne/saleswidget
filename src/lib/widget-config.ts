import { apiFetch } from "@/lib/api";

export interface WidgetClientSettings {
  widget_title: string;
  welcome_message: string;
  primary_color: string;
  background_color: string;
  text_color: string;
  border_color: string;
  logo_url?: string;
}

export interface PublicWidgetConfigResult {
  siteId: string;
  clientId: string | null;
  settings: WidgetClientSettings;
}

export function mapWidgetSettings(config: any): WidgetClientSettings {
  const primary = config?.primaryColor || config?.primary_color || "#6D28D9";
  return {
    widget_title: config?.widgetTitle || config?.widget_title || "AI Assistant",
    welcome_message:
      config?.welcomeMessage || config?.welcome_message || "Hi! How can I help you today?",
    primary_color: primary,
    background_color: config?.backgroundColor || config?.background_color || "#0f0f0f",
    text_color: config?.textColor || config?.text_color || "#ffffff",
    border_color: config?.borderColor || config?.border_color || primary,
    logo_url: config?.logo?.url || config?.logoUrl || config?.logo_url || undefined,
  };
}

export async function fetchPublicWidgetConfig(
  siteId: string,
): Promise<PublicWidgetConfigResult> {
  const payload = await apiFetch<{ config?: any; ok?: boolean }>(
    `/api/clients/widget-config?siteId=${encodeURIComponent(siteId)}`,
    { skipAuth: true },
  );

  const config = payload?.config || {};
  const resolvedSiteId = String(config?.siteId || siteId || "").trim() || siteId;
  const resolvedClientId =
    config?.clientId !== undefined && config?.clientId !== null
      ? String(config.clientId)
      : null;

  return {
    siteId: resolvedSiteId,
    clientId: resolvedClientId,
    settings: mapWidgetSettings(config),
  };
}
