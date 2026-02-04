import { apiFetch } from "@/lib/api";

export type AiwRole = "system" | "user" | "assistant";

export interface AiwMessage {
  role: AiwRole;
  content: string;
}

interface SendAiwChatParams {
  messages: AiwMessage[];
  siteId?: string | null;
  clientId?: string | null;
  sessionId?: string | null;
  stream?: boolean;
  meta?: Record<string, unknown>;
}

interface SendAiwChatResult {
  reply: string;
  sessionId: string;
  sessionToken: string | null;
  raw: any;
}

const VISITOR_KEY = "aiw_visitor_id";

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const getVisitorId = () => {
  try {
    const fromStorage = localStorage.getItem(VISITOR_KEY);
    if (fromStorage) return fromStorage;
    const next = createId();
    localStorage.setItem(VISITOR_KEY, next);
    return next;
  } catch {
    return createId();
  }
};

export async function sendAiwChat(params: SendAiwChatParams): Promise<SendAiwChatResult> {
  const siteId = (params.siteId || "widget").trim() || "widget";
  const sessionId = (params.sessionId || "").trim() || createId();
  const visitorId = getVisitorId();

  const payloadMessages = (params.messages || [])
    .map((message) => ({
      role: message.role,
      content: String(message.content || ""),
    }))
    .filter((message) => message.content.trim().length > 0);

  const data = await apiFetch<any>("/api/aiw/chat", {
    method: "POST",
    skipAuth: true,
    headers: {
      "x-aiw-site": siteId,
      "x-aiw-visitor": visitorId,
      "x-aiw-session": sessionId,
    },
    body: {
      messages: payloadMessages,
      stream: !!params.stream,
      clientId: params.clientId || null,
      meta: {
        ...(params.meta || {}),
        siteId,
        sessionId,
        visitorId,
      },
    },
  });

  const reply =
    typeof data?.reply === "string"
      ? data.reply
      : typeof data?.message === "string"
        ? data.message
        : "";

  return {
    reply,
    sessionId: typeof data?.sessionId === "string" && data.sessionId.trim() ? data.sessionId : sessionId,
    sessionToken:
      typeof data?.sessionToken === "string" && data.sessionToken.trim() ? data.sessionToken : null,
    raw: data,
  };
}
