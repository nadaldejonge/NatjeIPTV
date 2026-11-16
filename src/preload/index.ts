import { contextBridge, ipcRenderer } from "electron";
import type { NatjePlayerApi } from "../shared/natjePlayerApi.js";
import type { StoredSettings } from "../shared/settings.js";
import type {
  XtreamCredentials,
  XtreamLiveStream,
  XtreamPortal,
  XtreamSeries,
  XtreamSeriesInfo,
  XtreamShortEpg,
  XtreamVodStream
} from "../shared/xtream.js";

const api: NatjePlayerApi = {
  openPlaylistFile: (): Promise<{ filePath: string; content: string } | null> => ipcRenderer.invoke("playlist:openFile"),
  readSettings: (): Promise<StoredSettings> => ipcRenderer.invoke("settings:read"),
  updateSettings: (patch: Partial<StoredSettings>): Promise<StoredSettings> => ipcRenderer.invoke("settings:update", patch),
  loadSubtitle: (url: string): Promise<{ content: string; format: "vtt" }> => ipcRenderer.invoke("subtitle:load", url),
  loadXtreamPortal: (credentials: XtreamCredentials): Promise<XtreamPortal> => ipcRenderer.invoke("xtream:loadPortal", credentials),
  loadXtreamSeriesInfo: (credentials: XtreamCredentials, seriesId: number): Promise<XtreamSeriesInfo> =>
    ipcRenderer.invoke("xtream:loadSeriesInfo", credentials, seriesId),
  loadXtreamLiveStreams: (credentials: XtreamCredentials, categoryId: string): Promise<XtreamLiveStream[]> =>
    ipcRenderer.invoke("xtream:loadLiveStreams", credentials, categoryId),
  loadXtreamSeries: (credentials: XtreamCredentials, categoryId: string): Promise<XtreamSeries[]> =>
    ipcRenderer.invoke("xtream:loadSeries", credentials, categoryId),
  loadXtreamShortEpg: (credentials: XtreamCredentials, streamId: number): Promise<XtreamShortEpg> =>
    ipcRenderer.invoke("xtream:loadShortEpg", credentials, streamId),
  loadXtreamVodStreams: (credentials: XtreamCredentials, categoryId: string): Promise<XtreamVodStream[]> =>
    ipcRenderer.invoke("xtream:loadVodStreams", credentials, categoryId),
  buildXtreamLiveUrl: (credentials: XtreamCredentials, streamId: number, extension?: string): Promise<string> =>
    ipcRenderer.invoke("xtream:liveUrl", credentials, streamId, extension),
  buildXtreamSeriesUrl: (
    credentials: XtreamCredentials,
    episodeId: string | number,
    extension?: string
  ): Promise<string> => ipcRenderer.invoke("xtream:seriesUrl", credentials, episodeId, extension),
  buildXtreamMovieUrl: (credentials: XtreamCredentials, streamId: string | number, extension?: string): Promise<string> =>
    ipcRenderer.invoke("xtream:movieUrl", credentials, streamId, extension),
  isMpvAvailable: (): Promise<boolean> => ipcRenderer.invoke("mpv:isAvailable"),
  playWithMpv: (url: string, startSeconds?: number): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke("mpv:play", url, startSeconds),
  stopMpv: (): Promise<{ ok: true }> => ipcRenderer.invoke("mpv:stop")
};

contextBridge.exposeInMainWorld("natjePlayer", api);

export type { NatjePlayerApi };
