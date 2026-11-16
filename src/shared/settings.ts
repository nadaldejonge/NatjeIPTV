export type PlaylistSource = "m3u-file" | "m3u-url" | "xtream";

export type XtreamCredentials = {
  serverUrl: string;
  username: string;
  password: string;
};

export type StoredFavorite = {
  id: string;
  name: string;
  group: string;
  logo?: string;
  tvgId?: string;
  url: string;
  source: PlaylistSource;
  section?: "live" | "series" | "movies";
  kind?: "live" | "series" | "episode" | "movie";
  favoriteKey?: string;
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

export type StoredSettings = {
  lastPlaylistType?: PlaylistSource;
  lastPlaylistPath?: string;
  lastPlaylistUrl?: string;
  xtream?: XtreamCredentials;
  rememberLogin?: boolean;
  favorites?: StoredFavorite[];
  recentWatched?: StoredFavorite[];
  hiddenCountries?: string[];
  countryFilterVersion?: number;
  categoryPreferences?: Partial<Record<"live" | "series" | "movies", CategoryPreferences>>;
  lastGroup?: string;
  lastChannelId?: string;
  lastSection?: "live" | "series" | "movies";
  windowBounds?: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
};

export type CategoryPreferences = { hidden: string[]; order: string[]; shown?: string[] };
