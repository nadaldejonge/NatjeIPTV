import { CapacitorHttp } from "@capacitor/core";
import type { HttpGetRequest, HttpTextResponse, HttpTransport } from "../shared/httpTransport";
import { TransportError } from "../shared/httpTransport";

const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Native Android transport via CapacitorHttp. Requests lopen buiten de WebView om
 * (HttpURLConnection in de native laag), dus CORS en mixed-content-regels van
 * Chromium gelden hier niet. Dit spiegelt de Windows-versie, waar Xtream-requests
 * in het Electron-mainproces draaien en dezelfde browserregels ook niet gelden.
 */
export function createCapacitorHttpTransport(): HttpTransport {
  return {
    kind: "capacitor-http",
    async get(request: HttpGetRequest): Promise<HttpTextResponse> {
      const timeout = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      let response;
      try {
        response = await CapacitorHttp.get({
          url: request.url,
          headers: request.headers,
          connectTimeout: timeout,
          readTimeout: timeout,
          responseType: "text"
        });
      } catch (error) {
        throw classifyNativeError(error);
      }

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers ?? {})) {
        headers[key.toLowerCase()] = String(value);
      }

      return {
        status: response.status,
        headers,
        // Bij content-type application/json parset de native laag alvast naar een object.
        bodyText: typeof response.data === "string" ? response.data : JSON.stringify(response.data ?? null),
        finalUrl: response.url || undefined
      };
    }
  };
}

/** Vertaalt Java/Kotlin exceptionteksten van de native laag naar een NetworkFailure-classificatie. */
function classifyNativeError(error: unknown): TransportError {
  const err = error as { message?: string; code?: string };
  const message = err?.message ?? String(error);
  const code = err?.code;
  const details = code ? `${message} (code: ${code})` : message;

  if (/unable to resolve host|unknownhostexception|no address associated/i.test(message)) {
    return new TransportError("dns", "De hostname van de server kon niet worden gevonden (DNS).", {
      code,
      technicalDetails: details
    });
  }
  if (/sockettimeout|timed? ?out|timeout/i.test(message)) {
    return new TransportError("timeout", "De server reageerde niet binnen de tijdslimiet.", {
      code,
      technicalDetails: details
    });
  }
  if (/connection refused|econnrefused|failed to connect to/i.test(message)) {
    return new TransportError("connection-refused", "De server weigerde de verbinding (poort dicht of server offline).", {
      code,
      technicalDetails: details
    });
  }
  if (/cleartext/i.test(message)) {
    return new TransportError(
      "cleartext-blocked",
      "Android blokkeerde onversleuteld http-verkeer naar deze server (cleartext policy).",
      { code, technicalDetails: details }
    );
  }
  if (/ssl|tls|certificate|handshake|trust anchor|cert/i.test(message)) {
    return new TransportError("tls", "De beveiligde verbinding (TLS/certificaat) kon niet worden opgezet.", {
      code,
      technicalDetails: details
    });
  }
  if (/enetunreach|network is unreachable|econnreset|connection reset|broken pipe/i.test(message)) {
    return new TransportError("connection-refused", "De netwerkverbinding werd verbroken of is onbereikbaar.", {
      code,
      technicalDetails: details
    });
  }
  return new TransportError("unknown", message || "Onbekende netwerkfout in de native Android-laag.", {
    code,
    technicalDetails: details
  });
}
