import { normalizeChannel } from "./normalizeChannel";
import type { Channel, PlaylistSource } from "../types/channel";

type ExtInf = {
  name: string;
  group: string;
  logo?: string;
  tvgId?: string;
};

export function parseM3u(content: string, source: PlaylistSource): Channel[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const channels: Channel[] = [];
  let pending: ExtInf | null = null;

  for (const line of lines) {
    if (line.startsWith("#EXTINF")) {
      pending = parseExtInf(line);
      continue;
    }

    if (line.startsWith("#")) {
      continue;
    }

    if (!pending || !isProbablyUrl(line)) {
      pending = null;
      continue;
    }

    channels.push(
      normalizeChannel(
        {
          name: pending.name,
          group: pending.group,
          logo: pending.logo,
          tvgId: pending.tvgId,
          url: line
        },
        source,
        channels.length
      )
    );
    pending = null;
  }

  return channels;
}

function parseExtInf(line: string): ExtInf {
  const name = line.includes(",") ? line.slice(line.lastIndexOf(",") + 1).trim() : "Onbekend kanaal";
  return {
    name,
    group: readAttribute(line, "group-title") ?? "Ongegroepeerd",
    logo: readAttribute(line, "tvg-logo"),
    tvgId: readAttribute(line, "tvg-id")
  };
}

function readAttribute(line: string, attribute: string): string | undefined {
  const pattern = new RegExp(`${attribute}=(?:"([^"]*)"|'([^']*)'|([^\\s,]+))`, "i");
  const match = line.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? undefined;
}

function isProbablyUrl(value: string): boolean {
  return /^(https?|rtmp|rtsp):\/\//i.test(value);
}
