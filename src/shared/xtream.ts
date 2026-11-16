export type XtreamCredentials = {
  serverUrl: string;
  username: string;
  password: string;
};

export type XtreamCategory = {
  category_id: string;
  category_name: string;
};

export type XtreamLiveStream = {
  stream_id: number;
  name: string;
  stream_icon?: string;
  category_id?: string;
  container_extension?: string;
};

export type XtreamSeries = {
  series_id: number;
  name: string;
  cover?: string;
  category_id?: string;
  plot?: string;
};

export type XtreamVodStream = {
  stream_id: number;
  name: string;
  stream_icon?: string;
  category_id?: string;
  container_extension?: string;
  plot?: string;
};

export type XtreamEpisode = {
  id: string | number;
  title?: string;
  episode_num?: number;
  container_extension?: string;
  info?: {
    movie_image?: string;
    plot?: string;
    subtitles?: unknown;
    subtitle?: unknown;
  };
};

export type XtreamSeason = {
  season_number?: number;
  episode_count?: number;
};

export type XtreamSeriesInfo = {
  seasons?: XtreamSeason[];
  episodes?: Record<string, XtreamEpisode[]>;
};

export type XtreamEpgListing = {
  id?: string;
  title?: string;
  description?: string;
  start?: string;
  end?: string;
  start_timestamp?: string;
  stop_timestamp?: string;
};

export type XtreamShortEpg = {
  epg_listings?: XtreamEpgListing[];
};

export type XtreamPortal = {
  userInfo?: {
    auth?: number;
    status?: string;
    exp_date?: string;
  };
  serverInfo?: Record<string, unknown>;
  liveCategories: XtreamCategory[];
  seriesCategories: XtreamCategory[];
  vodCategories: XtreamCategory[];
};
