import type { Channel } from "../types/channel";
import type {
  XtreamCategory,
  XtreamCredentials,
  XtreamEpisode,
  XtreamLiveStream,
  XtreamSeries,
  XtreamSeriesInfo,
  XtreamVodStream
} from "../../shared/xtream";

export function mapXtreamLive(
  streams: XtreamLiveStream[],
  categories: XtreamCategory[],
  credentials: XtreamCredentials
): Channel[] {
  const categoryNames = new Map(categories.map((category) => [String(category.category_id), category.category_name]));
  const base = credentials.serverUrl.replace(/\/+$/, "");

  return streams.map((stream, index) => {
    const extension = stream.container_extension === "ts" || !stream.container_extension ? "m3u8" : stream.container_extension;
    return {
      id: `xtream-live-${stream.stream_id}`,
      favoriteKey: `xtream-live-${stream.stream_id}`,
      name: stream.name || `Live kanaal ${index + 1}`,
      group: categoryNames.get(String(stream.category_id ?? "")) ?? "Ongegroepeerd",
      logo: stream.stream_icon || undefined,
      url: `${base}/live/${encodeURIComponent(credentials.username.trim())}/${encodeURIComponent(credentials.password)}/${stream.stream_id}.${extension}`,
      source: "xtream",
      section: "live",
      kind: "live",
      meta: {
        categoryId: stream.category_id == null ? undefined : String(stream.category_id),
        streamId: stream.stream_id
      }
    };
  });
}

export function mapXtreamSeries(seriesList: XtreamSeries[], categories: XtreamCategory[]): Channel[] {
  const categoryNames = new Map(categories.map((category) => [String(category.category_id), category.category_name]));

  return seriesList.map((series, index) => ({
    id: `xtream-series-${series.series_id}`,
    name: series.name || `Serie ${index + 1}`,
    group: categoryNames.get(String(series.category_id ?? "")) ?? "Ongegroepeerd",
    logo: series.cover || undefined,
    url: "",
    source: "xtream",
    section: "series",
    kind: "series",
    meta: {
      categoryId: series.category_id == null ? undefined : String(series.category_id),
      plot: series.plot
    }
  }));
}

export function mapXtreamMovies(
  movies: XtreamVodStream[],
  categories: XtreamCategory[],
  credentials: XtreamCredentials
): Channel[] {
  const categoryNames = new Map(categories.map((category) => [String(category.category_id), category.category_name]));
  const base = credentials.serverUrl.replace(/\/+$/, "");

  return movies.map((movie, index) => {
    const extension = movie.container_extension || "mp4";
    return {
      id: `xtream-movie-${movie.stream_id}`,
      favoriteKey: `xtream-movie-${movie.stream_id}`,
      name: movie.name || `Film ${index + 1}`,
      group: categoryNames.get(String(movie.category_id ?? "")) ?? "Ongegroepeerd",
      logo: movie.stream_icon || undefined,
      url: `${base}/movie/${encodeURIComponent(credentials.username.trim())}/${encodeURIComponent(credentials.password)}/${movie.stream_id}.${extension}`,
      source: "xtream",
      section: "movies",
      kind: "movie",
      meta: {
        categoryId: movie.category_id == null ? undefined : String(movie.category_id),
        plot: movie.plot
      }
    };
  });
}

export function seriesIdFromChannel(channel: Channel): number | null {
  const match = channel.id.match(/^xtream-series-(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function mapXtreamEpisodes(series: XtreamSeries, info: XtreamSeriesInfo, credentials: XtreamCredentials): Channel[] {
  const episodes = Object.entries(info.episodes ?? {}).flatMap(([season, items]) =>
    items.map((episode) => mapEpisode(series, Number(season), episode, credentials))
  );

  return episodes.sort((a, b) => {
    const seasonDelta = (a.meta?.season ?? 0) - (b.meta?.season ?? 0);
    if (seasonDelta !== 0) {
      return seasonDelta;
    }
    return (a.meta?.episode ?? 0) - (b.meta?.episode ?? 0);
  });
}

function mapEpisode(series: XtreamSeries, season: number, episode: XtreamEpisode, credentials: XtreamCredentials): Channel {
  const extension = episode.container_extension || "mp4";
  const base = credentials.serverUrl.replace(/\/+$/, "");
  const episodeId = String(episode.id);
  const episodeNumber = episode.episode_num ?? 0;
  const originalUrl = `${base}/series/${encodeURIComponent(credentials.username.trim())}/${encodeURIComponent(credentials.password)}/${episodeId}.${extension}`;
  const hlsUrl = `${base}/series/${encodeURIComponent(credentials.username.trim())}/${encodeURIComponent(credentials.password)}/${episodeId}.m3u8`;
  const shouldTryHlsFirst = extension !== "m3u8";

  return {
    id: `xtream-episode-${episodeId}`,
    favoriteKey: `xtream-episode-${episodeId}`,
    name: episode.title || `${series.name} S${season}E${episodeNumber}`,
    group: `${series.name} - Seizoen ${season}`,
    logo: episode.info?.movie_image || series.cover || undefined,
    url: shouldTryHlsFirst ? hlsUrl : originalUrl,
    source: "xtream",
    section: "series",
    kind: "episode",
    parentId: `xtream-series-${series.series_id}`,
    meta: {
      categoryId: series.category_id == null ? undefined : String(series.category_id),
      plot: episode.info?.plot || series.plot,
      season,
      episode: episodeNumber,
      fallbackUrl: shouldTryHlsFirst ? originalUrl : undefined,
      subtitles: extractSubtitleLinks(episode.info?.subtitles ?? episode.info?.subtitle)
    }
  };
}

function extractSubtitleLinks(value: unknown): Array<{ url: string; label?: string; language?: string }> {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return isSubtitleUrl(value) ? [{ url: value, label: labelFromSubtitleUrl(value) }] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractSubtitleLinks(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const rawUrl = record.url ?? record.file ?? record.src ?? record.link;
    if (typeof rawUrl !== "string" || !isSubtitleUrl(rawUrl)) {
      return [];
    }
    return [
      {
        url: rawUrl,
        label: typeof record.label === "string" ? record.label : typeof record.name === "string" ? record.name : labelFromSubtitleUrl(rawUrl),
        language: typeof record.lang === "string" ? record.lang : typeof record.language === "string" ? record.language : undefined
      }
    ];
  }

  return [];
}

function isSubtitleUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) && /\.(vtt|webvtt|srt)(?:$|\?)/i.test(value);
}

function labelFromSubtitleUrl(value: string): string {
  try {
    const file = new URL(value).pathname.split("/").pop() || "Ondertiteling";
    return decodeURIComponent(file.replace(/\.(vtt|webvtt|srt)$/i, ""));
  } catch {
    return "Ondertiteling";
  }
}
