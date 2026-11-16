import { app, BrowserWindow, dialog, ipcMain, OpenDialogOptions } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isMpvAvailable, playWithMpv, stopMpv } from "./mpvController.js";
import { readPlaylistFile } from "./playlistFile.js";
import { readSettings, StoredSettings, updateSettings } from "./storage.js";
import { loadSubtitle } from "./subtitleLoader.js";
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
} from "./xtreamClient.js";
import type { XtreamCredentials } from "../shared/xtream.js";

let mainWindow: BrowserWindow | null = null;
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appIcon = app.isPackaged
  ? path.join(process.resourcesPath, "icons/natje-app.ico")
  : path.join(currentDir, "../../public/icons/natje-app.ico");

async function createWindow(): Promise<void> {
  const settings = await readSettings();

  mainWindow = new BrowserWindow({
    width: settings.windowBounds?.width ?? 1420,
    height: settings.windowBounds?.height ?? 860,
    x: settings.windowBounds?.x,
    y: settings.windowBounds?.y,
    minWidth: 1120,
    minHeight: 700,
    backgroundColor: "#050505",
    title: "Natje's IPTV-player",
    icon: appIcon,
    webPreferences: {
      preload: path.join(currentDir, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.on("close", () => {
    if (!mainWindow) {
      return;
    }
    const bounds = mainWindow.getBounds();
    void updateSettings({
      windowBounds: {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      }
    });
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(currentDir, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  ipcMain.handle("playlist:openFile", async () => {
    const dialogOptions: OpenDialogOptions = {
      title: "Open M3U playlist",
      properties: ["openFile"],
      filters: [
        { name: "M3U playlists", extensions: ["m3u", "m3u8"] },
        { name: "All files", extensions: ["*"] }
      ]
    };

    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const content = await readPlaylistFile(filePath);
    await updateSettings({
      lastPlaylistType: "m3u-file",
      lastPlaylistPath: filePath
    });
    return { filePath, content };
  });

  ipcMain.handle("settings:read", () => readSettings());
  ipcMain.handle("settings:update", (_event, patch: Partial<StoredSettings>) => updateSettings(patch));
  ipcMain.handle("subtitle:load", (_event, url: string) => loadSubtitle(url));
  ipcMain.handle("xtream:loadPortal", async (_event, credentials: XtreamCredentials) => {
    const portal = await loadXtreamPortal(credentials);
    await updateSettings({
      lastPlaylistType: "xtream",
      xtream: credentials
    });
    return portal;
  });
  ipcMain.handle("xtream:loadSeriesInfo", (_event, credentials: XtreamCredentials, seriesId: number) =>
    loadXtreamSeriesInfo(credentials, seriesId)
  );
  ipcMain.handle("xtream:loadLiveStreams", (_event, credentials: XtreamCredentials, categoryId: string) =>
    loadXtreamLiveStreams(credentials, categoryId)
  );
  ipcMain.handle("xtream:loadSeries", (_event, credentials: XtreamCredentials, categoryId: string) =>
    loadXtreamSeries(credentials, categoryId)
  );
  ipcMain.handle("xtream:loadShortEpg", (_event, credentials: XtreamCredentials, streamId: number) =>
    loadXtreamShortEpg(credentials, streamId)
  );
  ipcMain.handle("xtream:loadVodStreams", (_event, credentials: XtreamCredentials, categoryId: string) =>
    loadXtreamVodStreams(credentials, categoryId)
  );
  ipcMain.handle("xtream:liveUrl", (_event, credentials: XtreamCredentials, streamId: number, extension?: string) =>
    liveStreamUrl(credentials, streamId, extension)
  );
  ipcMain.handle("xtream:seriesUrl", (_event, credentials: XtreamCredentials, episodeId: string | number, extension?: string) =>
    seriesStreamUrl(credentials, episodeId, extension)
  );
  ipcMain.handle("xtream:movieUrl", (_event, credentials: XtreamCredentials, streamId: string | number, extension?: string) =>
    movieStreamUrl(credentials, streamId, extension)
  );
  ipcMain.handle("mpv:isAvailable", () => isMpvAvailable());
  ipcMain.handle("mpv:play", (_event, url: string, startSeconds?: number) => playWithMpv(url, startSeconds));
  ipcMain.handle("mpv:stop", () => {
    stopMpv();
    return { ok: true };
  });

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("before-quit", () => {
  stopMpv();
});

app.on("window-all-closed", () => {
  stopMpv();
  app.quit();
});
