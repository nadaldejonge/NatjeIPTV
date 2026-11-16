export type NetworkFailureKind =
  | "dns"
  | "timeout"
  | "connection-refused"
  | "cleartext-blocked"
  | "tls"
  | "http"
  | "cors"
  | "parse"
  | "unknown";

export type HttpGetRequest = {
  url: string;
  headers?: Record<string, string>;
  /** Totale timeout in ms voor connect + lezen. */
  timeoutMs?: number;
};

export type HttpTextResponse = {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  /** Uiteindelijke URL na eventuele redirects, indien bekend. */
  finalUrl?: string;
};

export type TransportKind = "web-fetch" | "capacitor-http" | "electron-main";

export interface HttpTransport {
  readonly kind: TransportKind;
  get(request: HttpGetRequest): Promise<HttpTextResponse>;
}

/**
 * Fout die een transport gooit wanneer er geen HTTP-response is
 * (DNS, timeout, TLS, cleartext, CORS, ...). HTTP-statusfouten worden
 * als normale response teruggegeven en door de aanroeper beoordeeld.
 */
export class TransportError extends Error {
  readonly kind: NetworkFailureKind;
  readonly code?: string;
  readonly technicalDetails?: string;

  constructor(kind: NetworkFailureKind, message: string, options?: { code?: string; technicalDetails?: string }) {
    super(message);
    this.name = "TransportError";
    this.kind = kind;
    this.code = options?.code;
    this.technicalDetails = options?.technicalDetails;
  }
}

/** Diagnostische informatie over een mislukte Xtream-request, zonder credentials. */
export type XtreamErrorDiagnostics = {
  step: string;
  endpoint: string;
  kind: NetworkFailureKind;
  message: string;
  /** Alleen protocol + hostname + poort, nooit credentials. */
  server: string;
  sanitizedUrl: string;
  transport: TransportKind;
  status?: number;
  code?: string;
  responsePreview?: string;
  responseHeaders?: Record<string, string>;
  technicalDetails?: string;
  timestamp: string;
  durationMs: number;
};

export class XtreamRequestError extends Error {
  readonly diagnostics: XtreamErrorDiagnostics;

  constructor(message: string, diagnostics: XtreamErrorDiagnostics) {
    super(message);
    this.name = "XtreamRequestError";
    this.diagnostics = diagnostics;
  }
}

/** Maskeert username/password in querystring en in /live|series|movie/{user}/{pass}/ paden. */
export function sanitizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const key of ["username", "password", "token", "auth"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, "***");
      }
    }
    url.pathname = url.pathname.replace(
      /\/(live|series|movie)\/[^/]+\/[^/]+\//i,
      "/$1/***/***/"
    );
    if (url.username || url.password) {
      url.username = "***";
      url.password = "";
    }
    return url.toString();
  } catch {
    return rawUrl.replace(/([?&](?:username|password|token|auth)=)[^&]*/gi, "$1***");
  }
}

/** Protocol + host + poort zonder pad of credentials, voor weergave in de UI. */
export function serverLabel(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    return `${url.protocol}//${url.hostname}:${port}`;
  } catch {
    return "(ongeldige URL)";
  }
}

/** Verwijdert bekende secret-headers voordat headers gelogd of getoond worden. */
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = /authorization|cookie|token/i.test(key) ? "***" : value;
  }
  return result;
}

const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Standaard transport op basis van fetch. Wordt gebruikt in het Electron-mainproces
 * (Node fetch, geen CORS) en als fallback in een gewone browser tijdens ontwikkeling.
 */
const runsInElectronMain =
  typeof window === "undefined" &&
  typeof (globalThis as { process?: { versions?: { electron?: string } } }).process?.versions?.electron === "string";

export const fetchTransport: HttpTransport = {
  kind: runsInElectronMain ? "electron-main" : "web-fetch",
  async get(request: HttpGetRequest): Promise<HttpTextResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(request.url, {
        headers: request.headers,
        signal: controller.signal
      });
      const bodyText = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return { status: response.status, headers, bodyText, finalUrl: response.url || undefined };
    } catch (error) {
      throw classifyFetchError(error, request.url);
    } finally {
      clearTimeout(timer);
    }
  }
};

function classifyFetchError(error: unknown, url: string): TransportError {
  if (error instanceof TransportError) {
    return error;
  }
  const err = error as Error & { cause?: { code?: string; message?: string } };
  const causeCode = err?.cause?.code;
  const causeMessage = err?.cause?.message ?? "";
  const message = err?.message ?? String(error);
  const details = [message, causeCode, causeMessage].filter(Boolean).join(" | ");

  if (err?.name === "AbortError" || /aborted|timeout/i.test(message)) {
    return new TransportError("timeout", "De server reageerde niet binnen de tijdslimiet.", {
      code: causeCode,
      technicalDetails: details
    });
  }
  if (causeCode === "ENOTFOUND" || causeCode === "EAI_AGAIN" || /getaddrinfo/i.test(causeMessage)) {
    return new TransportError("dns", "De hostname van de server kon niet worden gevonden (DNS).", {
      code: causeCode,
      technicalDetails: details
    });
  }
  if (causeCode === "ECONNREFUSED") {
    return new TransportError("connection-refused", "De server weigerde de verbinding (poort dicht of server offline).", {
      code: causeCode,
      technicalDetails: details
    });
  }
  if (causeCode === "ETIMEDOUT" || causeCode === "UND_ERR_CONNECT_TIMEOUT") {
    return new TransportError("timeout", "De verbinding met de server verliep (timeout).", {
      code: causeCode,
      technicalDetails: details
    });
  }
  if (/certificate|ssl|tls|handshake/i.test(details)) {
    return new TransportError("tls", "De beveiligde verbinding (TLS/certificaat) kon niet worden opgezet.", {
      code: causeCode,
      technicalDetails: details
    });
  }
  if (err instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(message)) {
    // Browser fetch geeft geen onderscheid tussen CORS, mixed content, DNS of offline.
    const isHttpTarget = /^http:\/\//i.test(url);
    return new TransportError(
      "cors",
      isHttpTarget
        ? "De browserlaag blokkeerde de request (waarschijnlijk CORS of geblokkeerd http-verkeer vanuit een https-context)."
        : "De browserlaag blokkeerde de request (waarschijnlijk CORS) of de server is onbereikbaar.",
      { technicalDetails: details }
    );
  }
  return new TransportError("unknown", message || "Onbekende netwerkfout.", {
    code: causeCode,
    technicalDetails: details
  });
}

let activeTransport: HttpTransport = fetchTransport;

export function setHttpTransport(transport: HttpTransport): void {
  activeTransport = transport;
}

export function getHttpTransport(): HttpTransport {
  return activeTransport;
}
