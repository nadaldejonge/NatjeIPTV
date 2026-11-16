import type { ReactElement } from "react";
import { useEffect, useRef } from "react";
import { Clapperboard, Film, Tv } from "lucide-react";
import BrandImage from "./BrandImage";

type Props = {
  liveCount: number;
  seriesCount: number;
  moviesCount: number;
  playlistLabel: string;
  buildLabel?: string;
  loading: boolean;
  onSelect: (section: "live" | "series" | "movies") => void;
  onLogout: () => void;
  tvMode?: boolean;
};

export default function SectionHub({ liveCount, seriesCount, moviesCount, playlistLabel, buildLabel, loading, onSelect, onLogout, tvMode }: Props): ReactElement {
  const root = useRef<HTMLElement>(null);
  useEffect(() => { if (tvMode) root.current?.querySelector<HTMLButtonElement>(".hub-card:not([disabled])")?.focus(); }, [tvMode]);
  return (
    <main ref={root} className={tvMode ? "hub-screen tv-hub" : "hub-screen"}>
      <section className="hub-header">
        <div className="login-brand">
          <div className={tvMode ? "brand-wordmark" : "brand-mark"}>
            <BrandImage variant={tvMode ? "wordmark" : "icon"} />
          </div>
          <div className="hub-brand-copy">
            <h1>Natje&apos;s IPTV-player</h1>
            <span title={playlistLabel}>{playlistLabel}</span>
            {buildLabel && <em className="tv-build-badge">{buildLabel}</em>}
          </div>
        </div>
        <button className="ghost-button" onClick={onLogout}>
          Andere login
        </button>
      </section>

      <section className="hub-grid">
        <button className="hub-card" onClick={() => onSelect("live")} disabled={loading}>
          <Tv size={54} />
          <strong>Live TV</strong>
          <span>{liveCount} categorieen</span>
        </button>
        <button className="hub-card" onClick={() => onSelect("series")} disabled={loading || seriesCount === 0}>
          <Clapperboard size={54} />
          <strong>Series</strong>
          <span>{seriesCount} categorieen</span>
        </button>
        <button className="hub-card" onClick={() => onSelect("movies")} disabled={loading || moviesCount === 0}>
          <Film size={54} />
          <strong>Films</strong>
          <span>{moviesCount} categorieen</span>
        </button>
      </section>
    </main>
  );
}
