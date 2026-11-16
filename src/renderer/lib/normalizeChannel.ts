import type { Channel, PlaylistSource } from "../types/channel";

export function normalizeChannel(input: Omit<Channel, "id" | "source">, source: PlaylistSource, index: number): Channel {
  const cleanName = input.name.trim() || `Kanaal ${index + 1}`;
  const cleanGroup = input.group.trim() || "Ongegroepeerd";
  const stableBase = `${cleanGroup}:${cleanName}:${input.url}`;

  return {
    id: `${index}-${hash(stableBase)}`,
    name: cleanName,
    group: cleanGroup,
    logo: input.logo?.trim() || undefined,
    tvgId: input.tvgId?.trim() || undefined,
    url: input.url.trim(),
    source
  };
}

function hash(value: string): string {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result << 5) - result + value.charCodeAt(index);
    result |= 0;
  }
  return Math.abs(result).toString(36);
}
