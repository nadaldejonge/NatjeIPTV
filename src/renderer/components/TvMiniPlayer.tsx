import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Captions, Info, Maximize2, Square, Star, Volume2 } from "lucide-react";
import type { Channel } from "../types/channel";
import type { XtreamEpgListing } from "../../shared/xtream";
import type { PlatformApi } from "../../platform";
import { normalizeEpg, programmeWindow } from "../../shared/epg";
import { focusZone } from "../lib/tvFocus";

export type NativePlaybackState = {
  state: "idle" | "loading" | "buffering" | "ready" | "playing" | "paused" | "ended" | "error";
  isLive: boolean;
};

type Props = {
  api: PlatformApi;
  channel: Channel | null;
  playbackState: NativePlaybackState;
  errorMessage: string | null;
  programmeInfo: XtreamEpgListing[];
  occluded: boolean;
  onActivate: () => void;
  onStop: () => void;
  onRetry: () => void;
  onErrorDetails: () => void;
  onProgrammeDetails: () => void;
  onFavorite: () => void;
  onSubtitles: () => void;
  onAudioTracks: () => void;
  favorite: boolean;
};

/**
 * Mini-player: React tekent de placeholder en is het DPAD-focusdoel; de native
 * Media3 PlayerView rendert de echte video exact over dit vlak heen (bounds
 * worden hier gemeten en naar Kotlin/Java gestuurd).
 */
export default function TvMiniPlayer(props: Props): ReactElement {
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const lastBoundsRef = useRef<string>("");

  useEffect(() => {
    const element = videoBoxRef.current;
    const setBounds = props.api.setMiniPlayerBounds;
    if (!element || !setBounds) {
      return;
    }

    if (props.occluded) {
      lastBoundsRef.current = "occluded";
      void setBounds({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        devicePixelRatio: window.devicePixelRatio || 1
      }).catch(() => undefined);
      return;
    }

    let frame = 0;
    const report = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const ratio = (window.devicePixelRatio || 1) * (window.visualViewport?.scale ?? 1);
        const key = `${Math.round(rect.left * ratio)}:${Math.round(rect.top * ratio)}:${Math.round(rect.width * ratio)}:${Math.round(rect.height * ratio)}:${ratio}`;
        if (key === lastBoundsRef.current) {
          return;
        }
        lastBoundsRef.current = key;
        void setBounds({
          x: rect.left - (window.visualViewport?.offsetLeft ?? 0),
          y: rect.top - (window.visualViewport?.offsetTop ?? 0),
          width: rect.width,
          height: rect.height,
          devicePixelRatio: ratio
        }).catch(() => undefined);
      });
    };

    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener("resize", report);
    window.addEventListener("scroll", report, true);
    window.visualViewport?.addEventListener("resize", report);
    window.visualViewport?.addEventListener("scroll", report);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", report);
      window.removeEventListener("scroll", report, true);
      window.visualViewport?.removeEventListener("resize", report);
      window.visualViewport?.removeEventListener("scroll", report);
      cancelAnimationFrame(frame);
    };
  }, [props.api, props.occluded]);

  const { channel, playbackState, errorMessage } = props;
  const isActive = Boolean(channel) && playbackState.state !== "idle";
  const isLoading = playbackState.state === "loading" || playbackState.state === "buffering";
  const hasError = playbackState.state === "error" || Boolean(errorMessage);

  const programmes = useMemo(() => normalizeEpg(props.programmeInfo), [props.programmeInfo]);
  const [clock, setClock] = useState(Date.now() / 1000);
  useEffect(() => {
    const next = programmes.flatMap((p) => [p.start, p.end]).filter((n): n is number => n !== undefined && n > Date.now() / 1000).sort((a, b) => a - b)[0];
    if (!next) return;
    const timer = window.setTimeout(() => setClock(Date.now() / 1000), Math.min(2147483647, Math.max(100, next * 1000 - Date.now() + 50)));
    return () => window.clearTimeout(timer);
  }, [programmes, clock]);
  const { current: nowPlaying, next, fallback } = programmeWindow(programmes, Math.max(clock, Date.now() / 1000));
  const displayed = nowPlaying ?? fallback;
  useEffect(() => {
    const active = document.activeElement;
    if ((!active || active === document.body) && document.querySelector(".tv-shell") && !document.querySelector('[role="dialog"]')) focusZone("preview");
  }, [hasError, isActive]);

  return (
    <section className="tv-mini-player-zone">
      <div data-tv-zone="preview">
      <div
        className="tv-mini-player"
        tabIndex={0}
        data-focus-id="mini-player"
        data-focus-key="mini-player"
        role="button"
        aria-label={channel ? `${channel.name} fullscreen openen` : "Mini-player"}
        onClick={props.onActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            props.onActivate();
          }
        }}
      >
        <div className="tv-mini-video" ref={videoBoxRef}>
          {!isActive && <span className="tv-mini-hint">Kies een zender om te starten</span>}
          {isActive && isLoading && <span className="tv-mini-hint">Laden…</span>}
          {isActive && hasError && (
            <span className="tv-mini-hint error">
              <AlertTriangle size={18} /> Afspelen mislukt
            </span>
          )}
        </div>
      </div>
      </div>

      <div className="tv-mini-meta">
        <span className="tv-eyebrow">{isActive ? "Je kijkt naar" : "Mini-player"}</span>
        <strong className="tv-playing-name">{channel?.name ?? "Kies je zender"}</strong>
        <div className="tv-programme-summary">
          <span className="tv-eyebrow">{nowPlaying ? "Nu" : next ? "Straks" : "Programma-informatie"}{displayed?.timeLabel ? ` · ${displayed.timeLabel}` : ""}</span>
          <h3>{displayed?.title || (channel?.kind === "episode" ? "Aflevering" : "Geen programmatitel beschikbaar")}</h3>
          <p className="tv-epg-description">{displayed?.description || channel?.meta?.plot || (channel ? "De aanbieder heeft geen beschrijving beschikbaar gesteld." : "Start een zender om hier programma-informatie te bekijken.")}</p>
          {nowPlaying && next && <span className="tv-next-programme">Hierna: {next.title}</span>}
        </div>
        {isActive && !hasError && (
          <span className="tv-mini-state">
            {playbackState.state === "playing" ? (playbackState.isLive ? "Live" : "Speelt af") : playbackState.state === "paused" ? "Gepauzeerd" : isLoading ? "Buffering…" : ""}
          </span>
        )}
        {hasError && errorMessage && <span className="tv-mini-error">{errorMessage}</span>}
      </div>

      <div className="tv-mini-actions" data-tv-zone="actions">
        {isActive && !hasError && (
          <button className="tv-favorite-action" data-focus-key="action-fullscreen" onClick={props.onActivate} aria-label="Fullscreen" title="Fullscreen">
            <Maximize2 size={16} />
          </button>
        )}
        {hasError && (
          <>
            <button data-focus-key="action-retry" onClick={props.onRetry}>Opnieuw</button>
            <button data-focus-key="action-error" onClick={props.onErrorDetails}>
              <Info size={16} /> Foutdetails
            </button>
          </>
        )}
        {isActive && (
          <button data-focus-key="action-stop" onClick={props.onStop}>
            <Square size={16} /> Stop
          </button>
        )}
        <button data-focus-key="action-programme" onClick={props.onProgrammeDetails}><Info size={16} /> Details</button>
        {channel && channel.kind !== "series" && <button className="tv-favorite-action" data-focus-key="action-favorite" aria-label={props.favorite ? "Uit favorieten verwijderen" : "Aan favorieten toevoegen"} aria-pressed={props.favorite} onClick={props.onFavorite}><Star size={16} /></button>}
        {isActive && !hasError && (channel?.kind === "episode" || channel?.kind === "movie") && (
          <>
            <button disabled={isLoading} data-focus-key="action-subtitles" onClick={props.onSubtitles} aria-label="Ondertiteling kiezen" title="Ondertiteling kiezen"><Captions size={18} /></button>
            <button disabled={isLoading} data-focus-key="action-audio" onClick={props.onAudioTracks} aria-label="Audiotaal kiezen" title="Audiotaal kiezen"><Volume2 size={18} /></button>
          </>
        )}
      </div>
    </section>
  );
}

