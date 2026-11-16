import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type {
  MiniPlayerBounds,
  NativePlayerEvent,
  NatjePlayerApi,
  PlatformPlayerState,
  PlatformTracks,
  PlayerPlayRequest,
  PlaylistFileResult
} from "../shared/natjePlayerApi";
import type { StoredSettings } from "../shared/settings";
import type { XtreamCredentials } from "../shared/xtream";
import {
  liveStreamUrl,
  loadXtreamLiveStreams,
  loadXtreamPortal,
  loadXtreamShortEpg,
  loadXtreamSeries,
  loadXtreamSeriesInfo,
  loadXtreamVodStreams,
  movieStreamUrl,
  seriesStreamUrl
} from "../shared/xtreamClient";
import { loadSubtitleText } from "../shared/subtitleText";
import { setHttpTransport } from "../shared/httpTransport";
import { createCapacitorHttpTransport } from "./androidHttp";
import type { PlatformApi } from "./types";

type AndroidTvBridgePlugin = {
  openPlaylistFile: () => Promise<PlaylistFileResult | null>;
  play: (request: PlayerPlayRequest) => Promise<{ ok: true } | { ok: false; error: string }>;
  pause: () => Promise<{ ok: true }>;
  resume: () => Promise<{ ok: true }>;
  stop: () => Promise<{ ok: true }>;
  seekTo: (request: { positionMs: number }) => Promise<{ ok: true }>;
  getState: () => Promise<PlatformPlayerState>;
  getTracks: () => Promise<PlatformTracks>;
  selectAudioTrack: (request: { id: string }) => Promise<{ ok: true }>;
  selectSubtitleTrack: (request: { id: string }) => Promise<{ ok: true }>;
  disableSubtitles: () => Promise<{ ok: true }>;
  showSubtitles: () => Promise<{ ok: true }>;
  showAudioTracks: () => Promise<{ ok: true }>;
  playMini: (request: PlayerPlayRequest) => Promise<{ ok: true } | { ok: false; error: string }>;
  setMiniPlayerBounds: (bounds: MiniPlayerBounds) => Promise<{ ok: true }>;
  enterFullscreen: () => Promise<{ ok: true }>;
  exitFullscreen: () => Promise<{ ok: true }>;
  stopPlayback: () => Promise<{ ok: true }>;
  addListener: (
    event: string,
    callback: (data: Record<string, unknown>) => void
  ) => Promise<{ remove: () => Promise<void> }>;
  secureSetCredentials: (credentials: { username: string; password: string }) => Promise<{ ok: true }>;
  secureGetCredentials: () => Promise<{ username: string; password: string }>;
  secureClearCredentials: () => Promise<{ ok: true }>;
};

const AndroidTvBridge = registerPlugin<AndroidTvBridgePlugin>("AndroidTvBridge");
const settingsKey = "natje-player-settings";

async function readSettings(): Promise<StoredSettings> {
  const stored = await Preferences.get({ key: settingsKey });
  let settings: StoredSettings = {};
  if (stored.value) {
    try {
      settings = JSON.parse(stored.value) as StoredSettings;
    } catch {
      settings = {};
    }
  }
  // Username/password staan in Keystore-backed secure storage, niet in Preferences.
  if (settings.xtream?.serverUrl) {
    try {
      const credentials = await AndroidTvBridge.secureGetCredentials();
      settings = {
        ...settings,
        xtream: {
          serverUrl: settings.xtream.serverUrl,
          username: credentials.username ?? "",
          password: credentials.password ?? ""
        }
      };
    } catch {
      // Secure storage niet beschikbaar; alleen serverUrl teruggeven.
    }
  }
  return settings;
}

let settingsQueue: Promise<unknown> = Promise.resolve();
function updateSettings(patch: Partial<StoredSettings>): Promise<StoredSettings> {
  const operation = settingsQueue.then(() => persistSettings(patch));
  settingsQueue = operation.catch(() => undefined);
  return operation;
}

async function persistSettings(patch: Partial<StoredSettings>): Promise<StoredSettings> {
  const current = await readSettings();
  const next = { ...current, ...patch };

  if ("xtream" in patch) {
    if (patch.xtream?.serverUrl) {
      try {
        await AndroidTvBridge.secureSetCredentials({
          username: patch.xtream.username,
          password: patch.xtream.password
        });
      } catch {
        // Keystore niet beschikbaar: dan bewust niets gevoeligs opslaan.
      }
    } else {
      try {
        await AndroidTvBridge.secureClearCredentials();
      } catch {
        // Niets te wissen.
      }
    }
  }

  // Wachtwoord en username nooit als platte tekst in Preferences bewaren.
  const persisted: StoredSettings = {
    ...next,
    xtream: next.xtream?.serverUrl ? { serverUrl: next.xtream.serverUrl, username: "", password: "" } : undefined
  };
  await Preferences.set({ key: settingsKey, value: JSON.stringify(persisted) });
  return next;
}

const androidApi: NatjePlayerApi = {
  openPlaylistFile: () => AndroidTvBridge.openPlaylistFile(),
  readSettings,
  updateSettings,
  loadSubtitle: loadSubtitleText,
  loadXtreamPortal: (credentials: XtreamCredentials) => loadXtreamPortal(credentials),
  loadXtreamSeriesInfo,
  loadXtreamLiveStreams,
  loadXtreamSeries,
  loadXtreamShortEpg,
  loadXtreamVodStreams,
  buildXtreamLiveUrl: async (credentials, streamId, extension) => liveStreamUrl(credentials, streamId, extension),
  buildXtreamSeriesUrl: async (credentials, episodeId, extension) => seriesStreamUrl(credentials, episodeId, extension),
  buildXtreamMovieUrl: async (credentials, streamId, extension) => movieStreamUrl(credentials, streamId, extension),
  isMpvAvailable: async () => false,
  playWithMpv: async () => ({ ok: false, error: "MPV is alleen beschikbaar in de Windows-versie." }),
  stopMpv: async () => ({ ok: true }),
  playNative: (request) => AndroidTvBridge.play(request),
  pauseNative: () => AndroidTvBridge.pause(),
  resumeNative: () => AndroidTvBridge.resume(),
  stopNative: () => AndroidTvBridge.stop(),
  seekNative: (positionMs) => AndroidTvBridge.seekTo({ positionMs }),
  getNativeState: () => AndroidTvBridge.getState(),
  getNativeTracks: () => AndroidTvBridge.getTracks(),
  selectNativeAudioTrack: (id) => AndroidTvBridge.selectAudioTrack({ id }),
  selectNativeSubtitleTrack: (id) => AndroidTvBridge.selectSubtitleTrack({ id }),
  disableNativeSubtitles: () => AndroidTvBridge.disableSubtitles(),
  showNativeSubtitles: () => AndroidTvBridge.showSubtitles(),
  showNativeAudioTracks: () => AndroidTvBridge.showAudioTracks(),
  playMiniNative: (request) => AndroidTvBridge.playMini(request),
  setMiniPlayerBounds: (bounds) => AndroidTvBridge.setMiniPlayerBounds(bounds),
  enterNativeFullscreen: () => AndroidTvBridge.enterFullscreen(),
  exitNativeFullscreen: () => AndroidTvBridge.exitFullscreen(),
  stopNativePlayback: () => AndroidTvBridge.stopPlayback(),
  addNativePlayerListener: (event: NativePlayerEvent, callback) => AndroidTvBridge.addListener(event, callback)
};

export function createAndroidPlatform(): PlatformApi {
  if (Capacitor.getPlatform() === "android") {
    // Xtream/API-verkeer via de native laag laten lopen in plaats van WebView fetch.
    // WebView fetch faalt op Xtream-servers zonder CORS-headers met "Failed to fetch".
    setHttpTransport(createCapacitorHttpTransport());
  }
  return {
    ...androidApi,
    runtime: Capacitor.getPlatform() === "android" ? "android" : "web",
    supportsNativePlayer: Capacitor.getPlatform() === "android",
    supportsMpv: false
  };
}
