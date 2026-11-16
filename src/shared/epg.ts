import type { XtreamEpgListing } from "./xtream.js";

export type Programme = {
  id: string; title: string; description: string;
  start?: number; end?: number; timeLabel: string;
};

/** Conservative base64 detection, canonical roundtrip, strict UTF-8, printable text only. */
export function decodeEpgText(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return text;
  try {
    const binary = atob(text);
    if (btoa(binary) !== text) return text;
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))).trim();
    if (!decoded || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(decoded)) return text;
    // Short unpadded plain words are ambiguous; prefer preserving the provider text.
    if (!text.includes("=") && text.length < 12) return text;
    return decoded;
  } catch { return text; }
}

export function epgTimestamp(value: unknown, raw?: unknown): number | undefined {
  const numeric = typeof value === "number" || (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value)) ? Number(value) : NaN;
  if (Number.isFinite(numeric) && numeric > 0) {
    const seconds = numeric > 100000000000 ? numeric / 1000 : numeric;
    if (seconds >= 946684800 && seconds < 7258118400) return seconds;
  }
  // Do not invent a timezone for provider-local date strings without an explicit offset.
  if (typeof raw === "string" && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    const parsed = Date.parse(raw.replace(" ", "T"));
    if (Number.isFinite(parsed)) return parsed / 1000;
  }
  return undefined;
}

export function programmeTime(start?: number, end?: number): string {
  const clock = (n: number) => new Date(n * 1000).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  return [start ? clock(start) : "", end ? clock(end) : ""].filter(Boolean).join(" – ");
}

export function normalizeEpg(listings: unknown): Programme[] {
  if (!Array.isArray(listings)) return [];
  return listings.filter((x): x is XtreamEpgListing => Boolean(x && typeof x === "object")).map((item, index) => {
    const start = epgTimestamp(item.start_timestamp, item.start);
    const parsedEnd = epgTimestamp(item.stop_timestamp, item.end);
    const end = parsedEnd && (!start || parsedEnd > start) ? parsedEnd : undefined;
    return { id: String(item.id ?? index), title: decodeEpgText(item.title), description: decodeEpgText(item.description), start, end, timeLabel: programmeTime(start, end) };
  }).filter((item) => item.title || item.description);
}

export function programmeWindow(items: Programme[], now = Date.now() / 1000): { current?: Programme; next?: Programme; fallback?: Programme } {
  const current = items.find((p) => p.start !== undefined && p.end !== undefined && p.start <= now && now < p.end);
  const next = items.filter((p) => p.start !== undefined && p.start > now).sort((a, b) => a.start! - b.start!)[0];
  return { current, next, fallback: current ? undefined : next ?? items.find((p) => p.start === undefined) };
}
