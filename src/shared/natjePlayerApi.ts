import type { StoredSettings } from "./settings.js";
import type {
  XtreamCredentials,
  XtreamLiveStream,
  XtreamPortal,
  XtreamSeries,
  XtreamSeriesInfo,
  XtreamShortEpg,
  XtreamVodStream
} from "./xtream.js";

export type PlaylistFileResult = {
  filePath: string;
  content: string;
};

export type LoadedSubtitle = {
  content: string;
  format: "vtt";
};

export type PlatformPlayerState = {
  state: string;
  positionMs: number;
  durationMs: number;
  bufferedPositionMs: number;
  isLive: boolean;
};

export type PlatformTrack = {
  id: string;
  label: string;
  language?: string;
  mimeType?: string;
  selected?: boolean;
  supported?: boolean;
};

export type PlatformTracks = {
  audioTracks: PlatformTrack[];
  subtitleTracks: PlatformTrack[];
};

export type PlayerPlayRequest = {
  requestId?: number;
  url: string;
  title?: string;
  subtitle?: string;
  logo?: string;
  isLive?: boolean;
  startPositionMs?: number;
  headers?: Record<string, string>;
  userAgent?: string;
  referer?: string;
  cookies?: string;
  mimeType?: string;
  fallbackUrls?: string[];
};

export type MiniPlayerBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio: number;
};

export type NativePlayerEvent =
  | "playerStateChanged"
  | "playerError"
  | "playerModeChanged"
  | "tracksChanged"
  | "videoSizeChanged";

export type NativePlayerListenerHandle = {
  remove: () => Promise<void>;
};

export type NatjePlayerApi = {
  openPlaylistFile: () => Promise<PlaylistFileResult | null>;
  readSettings: () => Promise<StoredSettings>;
  updateSettings: (patch: Partial<StoredSettings>) => Promise<StoredSettings>;
  loadSubtitle: (url: string) => Promise<LoadedSubtitle>;
  loadXtreamPortal: (credentials: XtreamCredentials) => Promise<XtreamPortal>;
  loadXtreamSeriesInfo: (credentials: XtreamCredentials, seriesId: number) => Promise<XtreamSeriesInfo>;
  loadXtreamLiveStreams: (credentials: XtreamCredentials, categoryId: string) => Promise<XtreamLiveStream[]>;
  loadXtreamSeries: (credentials: XtreamCredentials, categoryId: string) => Promise<XtreamSeries[]>;
  loadXtreamShortEpg: (credentials: XtreamCredentials, streamId: number) => Promise<XtreamShortEpg>;
  loadXtreamVodStreams: (credentials: XtreamCredentials, categoryId: string) => Promise<XtreamVodStream[]>;
  buildXtreamLiveUrl: (credentials: XtreamCredentials, streamId: number, extension?: string) => Promise<string>;
  buildXtreamSeriesUrl: (
    credentials: XtreamCredentials,
    episodeId: string | number,
    extension?: string
  ) => Promise<string>;
  buildXtreamMovieUrl: (credentials: XtreamCredentials, streamId: string | number, extension?: string) => Promise<string>;
  isMpvAvailable: () => Promise<boolean>;
  playWithMpv: (url: string, startSeconds?: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  stopMpv: () => Promise<{ ok: true }>;
  playNative?: (request: PlayerPlayRequest) => Promise<{ ok: true } | { ok: false; error: string }>;
  pauseNative?: () => Promise<{ ok: true }>;
  resumeNative?: () => Promise<{ ok: true }>;
  stopNative?: () => Promise<{ ok: true }>;
  seekNative?: (positionMs: number) => Promise<{ ok: true }>;
  getNativeState?: () => Promise<PlatformPlayerState>;
  getNativeTracks?: () => Promise<PlatformTracks>;
  selectNativeAudioTrack?: (id: string) => Promise<{ ok: true }>;
  selectNativeSubtitleTrack?: (id: string) => Promise<{ ok: true }>;
  disableNativeSubtitles?: () => Promise<{ ok: true }>;
  showNativeSubtitles?: () => Promise<{ ok: true }>;
  showNativeAudioTracks?: () => Promise<{ ok: true }>;
  playMiniNative?: (request: PlayerPlayRequest) => Promise<{ ok: true } | { ok: false; error: string }>;
  setMiniPlayerBounds?: (bounds: MiniPlayerBounds) => Promise<{ ok: true }>;
  enterNativeFullscreen?: () => Promise<{ ok: true }>;
  exitNativeFullscreen?: () => Promise<{ ok: true }>;
  stopNativePlayback?: () => Promise<{ ok: true }>;
  addNativePlayerListener?: (
    event: NativePlayerEvent,
    callback: (data: Record<string, unknown>) => void
  ) => Promise<NativePlayerListenerHandle>;
};
