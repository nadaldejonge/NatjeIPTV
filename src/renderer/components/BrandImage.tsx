import type { ReactElement } from "react";

const base = "branding/natje-2026/";

/** App branding only. Channel images continue to use their provider/playlist URL. */
export default function BrandImage({ variant = "icon" }: { variant?: "icon" | "wordmark" }): ReactElement {
  return variant === "wordmark" ? (
    <img className="natje-brand-image" src={`${base}natje-iptv-logo-800w.png`}
      srcSet={`${base}natje-iptv-logo-400w.png 400w, ${base}natje-iptv-logo-800w.png 800w, ${base}natje-iptv-logo-1200w.png 1200w`}
      sizes="(min-width: 1500px) 460px, 32vw" alt="Natje IPTV" draggable={false} />
  ) : (
    <img className="natje-brand-image" src={`${base}natje-joint-icon-192.png`}
      srcSet={`${base}natje-joint-icon-96.png 1x, ${base}natje-joint-icon-192.png 2x, ${base}natje-joint-icon-384.png 3x`}
      alt="" draggable={false} />
  );
}
