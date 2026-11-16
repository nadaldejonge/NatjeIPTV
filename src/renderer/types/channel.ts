export type PlaylistSource = "m3u-file" | "m3u-url" | "xtream";
export type MediaSection = "live" | "series" | "movies";
export type MediaKind = "live" | "series" | "episode" | "movie";

export type Channel = {
  id: string;
  name: string;
  group: string;
  logo?: string;
  tvgId?: string;
  url: string;
  source: PlaylistSource;
  section?: MediaSection;
  kind?: MediaKind;
  favoriteKey?: string;
  parentId?: string;
  meta?: {
    categoryId?: string;
    categoryName?: string;
    plot?: string;
    season?: number;
    episode?: number;
    streamId?: number;
    fallbackUrl?: string;
    subtitles?: Array<{
      url: string;
      label?: string;
      language?: string;
    }>;
  };
};
