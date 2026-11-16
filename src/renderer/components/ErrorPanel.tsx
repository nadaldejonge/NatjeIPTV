import type { ReactElement } from "react";
import { useEffect, useRef } from "react";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import type { XtreamErrorDiagnostics } from "../../shared/httpTransport";
import { captureTvFocus, restoreTvFocus } from "../lib/tvFocus";

type Props = {
  title: string;
  diagnostics: XtreamErrorDiagnostics;
  onRetry: () => void;
  onClose: () => void;
};

const KIND_LABELS: Record<XtreamErrorDiagnostics["kind"], string> = {
  dns: "DNS-fout",
  timeout: "Timeout",
  "connection-refused": "Verbinding geweigerd",
  "cleartext-blocked": "Cleartext http geblokkeerd",
  tls: "TLS/certificaatfout",
  http: "HTTP-fout",
  cors: "Geblokkeerd door browserlaag (CORS)",
  parse: "Ongeldige response (parse)",
  unknown: "Onbekende netwerkfout"
};

const TRANSPORT_LABELS: Record<XtreamErrorDiagnostics["transport"], string> = {
  "web-fetch": "Web fetch (WebView)",
  "capacitor-http": "Native Android HTTP (Capacitor)",
  "electron-main": "Electron mainproces"
};

export default function ErrorPanel(props: Props): ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const { diagnostics } = props;
  const closeRef = useRef(props.onClose);
  closeRef.current = props.onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const snapshot = captureTvFocus();
    retryRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key;

      if (key === "Escape" || key === "Backspace" || key === "GoBack" || key === "BrowserBack") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }

      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        return;
      }

      // Focus binnen het paneel houden; de globale tvNavigation mag hier niet bij.
      event.preventDefault();
      event.stopPropagation();

      const panel = panelRef.current;
      const scroller = scrollRef.current;
      if (!panel) {
        return;
      }

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex]:not([tabindex='-1'])")
      );
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (active === scroller && scroller && (key === "ArrowUp" || key === "ArrowDown")) {
        const atTop = scroller.scrollTop <= 0;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
        if (key === "ArrowDown" && atBottom) {
          retryRef.current?.focus();
          return;
        }
        if (key === "ArrowUp" && atTop) {
          return;
        }
        scroller.scrollBy({ top: key === "ArrowDown" ? 120 : -120, behavior: "smooth" });
        return;
      }

      const index = active ? focusables.indexOf(active) : -1;
      if (index === -1) {
        retryRef.current?.focus();
        return;
      }
      const delta = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
      const next = focusables[Math.min(focusables.length - 1, Math.max(0, index + delta))];
      next?.focus();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      requestAnimationFrame(() => { if (document.querySelector(".tv-shell")) restoreTvFocus(snapshot); else if (previous?.isConnected) previous.focus(); });
    };
  }, []);

  const localTime = new Date(diagnostics.timestamp).toLocaleString();

  return (
    <div className="error-overlay" role="dialog" aria-modal="true" aria-label={props.title}>
      <div className="error-panel" ref={panelRef}>
        <header className="error-panel-header">
          <AlertTriangle size={28} />
          <h2>{props.title}</h2>
        </header>

        <div className="error-panel-body" ref={scrollRef} tabIndex={0}>
          <dl className="error-facts">
            <dt>Stap</dt>
            <dd>{diagnostics.step}</dd>
            <dt>Fouttype</dt>
            <dd>{KIND_LABELS[diagnostics.kind]}</dd>
            <dt>Melding</dt>
            <dd>{diagnostics.message}</dd>
            <dt>Server</dt>
            <dd>{diagnostics.server}</dd>
            {typeof diagnostics.status === "number" && (
              <>
                <dt>HTTP-status</dt>
                <dd>{diagnostics.status}</dd>
              </>
            )}
            {diagnostics.responsePreview && (
              <>
                <dt>Response</dt>
                <dd className="error-preview">{diagnostics.responsePreview}</dd>
              </>
            )}
            <dt>Transport</dt>
            <dd>{TRANSPORT_LABELS[diagnostics.transport]}</dd>
            <dt>Tijdstip</dt>
            <dd>{localTime}</dd>
          </dl>

          <section className="error-technical">
            <h3>Technische details</h3>
            <dl className="error-facts">
              <dt>Endpoint</dt>
              <dd>{diagnostics.endpoint}</dd>
              <dt>URL</dt>
              <dd className="error-preview">{diagnostics.sanitizedUrl}</dd>
              <dt>Duur</dt>
              <dd>{diagnostics.durationMs} ms</dd>
              {diagnostics.code && (
                <>
                  <dt>Foutcode</dt>
                  <dd>{diagnostics.code}</dd>
                </>
              )}
              {diagnostics.technicalDetails && (
                <>
                  <dt>Oorzaak</dt>
                  <dd className="error-preview">{diagnostics.technicalDetails}</dd>
                </>
              )}
              {diagnostics.responseHeaders && (
                <>
                  <dt>Responseheaders</dt>
                  <dd className="error-preview">
                    {Object.entries(diagnostics.responseHeaders)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join("\n")}
                  </dd>
                </>
              )}
            </dl>
          </section>
        </div>

        <footer className="error-panel-actions">
          <button ref={retryRef} onClick={props.onRetry}>
            <RotateCcw size={18} />
            Opnieuw proberen
          </button>
          <button onClick={props.onClose}>
            <X size={18} />
            Sluiten
          </button>
        </footer>
      </div>
    </div>
  );
}
