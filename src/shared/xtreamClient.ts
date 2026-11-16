import type {
  XtreamCategory,
  XtreamCredentials,
  XtreamLiveStream,
  XtreamPortal,
  XtreamSeries,
  XtreamShortEpg,
  XtreamSeriesInfo,
  XtreamVodStream
} from "./xtream.js";
import {
  getHttpTransport,
  sanitizeHeaders,
  sanitizeUrl,
  serverLabel,
  TransportError,
  XtreamRequestError
} from "./httpTransport.js";
import type { XtreamErrorDiagnostics } from "./httpTransport.js";

type PlayerApiResponse = {
  user_info?: {
    auth?: number;
    status?: string;
    exp_date?: string;
  };
  server_info?: Record<string, unknown>;
};

const USER_AGENT = "Natjes-IPTV-player/0.1";
const REQUEST_TIMEOUT_MS = 20000;

function normalizeServerUrl(serverUrl: string): string {
  const trimmed = serverUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Xtream server moet beginnen met http:// of https://");
  }
  return trimmed;
}

function apiUrl(credentials: XtreamCredentials, action?: string, extra?: Record<string, string | number>): string {
  const url = new URL(`${normalizeServerUrl(credentials.serverUrl)}/player_api.php`);
  url.searchParams.set("username", credentials.username.trim());
  url.searchParams.set("password", credentials.password);
  if (action) {
    url.searchParams.set("action", action);
  }
  for (const [key, value] of Object.entries(extra ?? {})) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function kindLabel(kind: XtreamErrorDiagnostics["kind"]): string {
  switch (kind) {
    case "dns":
      return "de hostname kon niet worden opgezocht (DNS)";
    case "timeout":
      return "de server reageerde niet op tijd (timeout)";
    case "connection-refused":
      return "de server weigerde de verbinding";
    case "cleartext-blocked":
      return "Android blokkeerde onversleuteld http-verkeer (cleartext)";
    case "tls":
      return "de beveiligde verbinding (TLS/certificaat) mislukte";
    case "http":
      return "de server gaf een HTTP-foutstatus terug";
    case "cors":
      return "de browserlaag blokkeerde de request (CORS/mixed content)";
    case "parse":
      return "de server gaf geen geldige JSON terug";
    default:
      return "er trad een onbekende netwerkfout op";
  }
}

function logDiagnostics(diag: XtreamErrorDiagnostics): void {
  // Bewust console.warn: komt op Android via Chromium in Logcat terecht. Nooit credentials.
  console.warn(
    `[XtreamDiag] step=${diag.step} kind=${diag.kind} status=${diag.status ?? "-"} transport=${diag.transport} ` +
      `duration=${diag.durationMs}ms url=${diag.sanitizedUrl} code=${diag.code ?? "-"} msg=${diag.message}`
  );
}

async function requestJson<T>(url: string, step: string, endpoint: string): Promise<T> {
  const transport = getHttpTransport();
  const startedAt = Date.now();

  const baseDiagnostics = (): Omit<XtreamErrorDiagnostics, "kind" | "message"> => ({
    step,
    endpoint,
    server: serverLabel(url),
    sanitizedUrl: sanitizeUrl(url),
    transport: transport.kind,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt
  });

  const fail = (extra: Pick<XtreamErrorDiagnostics, "kind" | "message"> & Partial<XtreamErrorDiagnostics>): never => {
    const diagnostics: XtreamErrorDiagnostics = { ...baseDiagnostics(), ...extra };
    logDiagnostics(diagnostics);
    throw new XtreamRequestError(
      `Xtream ${step} mislukt: ${kindLabel(diagnostics.kind)}.`,
      diagnostics
    );
  };

  let response;
  try {
    response = await transport.get({
      url,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      timeoutMs: REQUEST_TIMEOUT_MS
    });
  } catch (error) {
    if (error instanceof TransportError) {
      return fail({
        kind: error.kind,
        message: error.message,
        code: error.code,
        technicalDetails: error.technicalDetails
      });
    }
    return fail({
      kind: "unknown",
      message: error instanceof Error ? error.message : String(error),
      technicalDetails: error instanceof Error ? error.stack : undefined
    });
  }

  const preview = response.bodyText.slice(0, 300);
  if (response.status < 200 || response.status >= 300) {
    return fail({
      kind: "http",
      message: `HTTP ${response.status}`,
      status: response.status,
      responsePreview: preview,
      responseHeaders: sanitizeHeaders(response.headers)
    });
  }

  try {
    return JSON.parse(response.bodyText) as T;
  } catch {
    const looksLikeHtml = /^\s*</.test(response.bodyText);
    return fail({
      kind: "parse",
      message: looksLikeHtml
        ? "De server stuurde een HTML-pagina in plaats van JSON (mogelijk een blokkade- of foutpagina)."
        : "De response kon niet als JSON worden gelezen.",
      status: response.status,
      responsePreview: preview,
      responseHeaders: sanitizeHeaders(response.headers)
    });
  }
}

export async function loadXtreamPortal(credentials: XtreamCredentials): Promise<XtreamPortal> {
  const account = await requestJson<PlayerApiResponse>(apiUrl(credentials), "player_api login", "player_api.php");
  if (account.user_info?.auth === 0) {
    throw new Error("Xtream login geweigerd. Controleer server, username en password.");
  }

  const [liveCategories, seriesCategories, vodCategories] = await Promise.all([
    requestJson<XtreamCategory[]>(apiUrl(credentials, "get_live_categories"), "live categories", "get_live_categories"),
    requestJson<XtreamCategory[]>(
      apiUrl(credentials, "get_series_categories"),
      "series categories",
      "get_series_categories"
    ),
    requestJson<XtreamCategory[]>(apiUrl(credentials, "get_vod_categories"), "vod categories", "get_vod_categories")
  ]);

  return {
    userInfo: account.user_info,
    serverInfo: account.server_info,
    liveCategories: Array.isArray(liveCategories) ? liveCategories : [],
    seriesCategories: Array.isArray(seriesCategories) ? seriesCategories : [],
    vodCategories: Array.isArray(vodCategories) ? vodCategories : []
  };
}

export async function loadXtreamLiveStreams(
  credentials: XtreamCredentials,
  categoryId: string
): Promise<XtreamLiveStream[]> {
  const extra = categoryId ? { category_id: categoryId } : undefined;
  const streams = await requestJson<XtreamLiveStream[]>(
    apiUrl(credentials, "get_live_streams", extra),
    "live streams",
    "get_live_streams"
  );
  return Array.isArray(streams) ? streams : [];
}

export async function loadXtreamSeries(credentials: XtreamCredentials, categoryId: string): Promise<XtreamSeries[]> {
  const extra = categoryId ? { category_id: categoryId } : undefined;
  const series = await requestJson<XtreamSeries[]>(
    apiUrl(credentials, "get_series", extra),
    "series list",
    "get_series"
  );
  return Array.isArray(series) ? series : [];
}

export async function loadXtreamVodStreams(
  credentials: XtreamCredentials,
  categoryId: string
): Promise<XtreamVodStream[]> {
  const extra = categoryId ? { category_id: categoryId } : undefined;
  const streams = await requestJson<XtreamVodStream[]>(
    apiUrl(credentials, "get_vod_streams", extra),
    "vod streams",
    "get_vod_streams"
  );
  return Array.isArray(streams) ? streams : [];
}

export async function loadXtreamSeriesInfo(
  credentials: XtreamCredentials,
  seriesId: number
): Promise<XtreamSeriesInfo> {
  return requestJson<XtreamSeriesInfo>(
    apiUrl(credentials, "get_series_info", { series_id: seriesId }),
    "series info",
    "get_series_info"
  );
}

export async function loadXtreamShortEpg(credentials: XtreamCredentials, streamId: number): Promise<XtreamShortEpg> {
  return requestJson<XtreamShortEpg>(
    apiUrl(credentials, "get_short_epg", { stream_id: streamId, limit: 5 }),
    "short epg",
    "get_short_epg"
  );
}

export function liveStreamUrl(credentials: XtreamCredentials, streamId: number, extension = "m3u8"): string {
  return `${normalizeServerUrl(credentials.serverUrl)}/live/${encodeURIComponent(credentials.username.trim())}/${encodeURIComponent(
    credentials.password
  )}/${streamId}.${extension || "ts"}`;
}

export function seriesStreamUrl(credentials: XtreamCredentials, episodeId: string | number, extension = "mp4"): string {
  return `${normalizeServerUrl(credentials.serverUrl)}/series/${encodeURIComponent(credentials.username.trim())}/${encodeURIComponent(
    credentials.password
  )}/${episodeId}.${extension || "mp4"}`;
}

export function movieStreamUrl(credentials: XtreamCredentials, streamId: string | number, extension = "mp4"): string {
  return `${normalizeServerUrl(credentials.serverUrl)}/movie/${encodeURIComponent(credentials.username.trim())}/${encodeURIComponent(
    credentials.password
  )}/${streamId}.${extension || "mp4"}`;
}
