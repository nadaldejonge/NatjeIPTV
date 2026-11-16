import type { LoadedSubtitle } from "./natjePlayerApi.js";
import { getHttpTransport } from "./httpTransport.js";

export async function loadSubtitleText(url: string): Promise<LoadedSubtitle> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Ongeldige ondertitel URL.");
  }

  const response = await getHttpTransport().get({ url });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Ondertiteling niet bereikbaar (${response.status})`);
  }

  const text = response.bodyText;
  return {
    content: url.toLowerCase().split("?")[0].endsWith(".srt") ? srtToVtt(text) : normalizeVtt(text),
    format: "vtt"
  };
}

function normalizeVtt(value: string): string {
  const trimmed = value.replace(/^\uFEFF/, "").trimStart();
  return trimmed.startsWith("WEBVTT") ? trimmed : `WEBVTT\n\n${trimmed}`;
}

function srtToVtt(value: string): string {
  const normalized = value
    .replace(/^\uFEFF/, "")
    .replace(/\r+/g, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
    .trim();
  return `WEBVTT\n\n${normalized}`;
}
