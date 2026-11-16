import type { NatjePlayerApi } from "../../shared/natjePlayerApi";

const browserFallback: NatjePlayerApi = {
  openPlaylistFile: async () => null,
  readSettings: async () => ({}),
  updateSettings: async (patch) => patch,
  loadSubtitle: async () => {
    throw new Error("Ondertitels laden werkt alleen in de desktop-app.");
  },
  loadXtreamPortal: async () => {
    throw new Error("Xtream werkt alleen in de desktop-app.");
  },
  loadXtreamSeriesInfo: async () => ({ seasons: [], episodes: {} }),
  loadXtreamLiveStreams: async () => [],
  loadXtreamSeries: async () => [],
  loadXtreamShortEpg: async () => ({ epg_listings: [] }),
  loadXtreamVodStreams: async () => [],
  buildXtreamLiveUrl: async () => "",
  buildXtreamSeriesUrl: async () => "",
  buildXtreamMovieUrl: async () => "",
  isMpvAvailable: async () => false,
  playWithMpv: async () => ({ ok: false, error: "MPV fallback niet beschikbaar" }),
  stopMpv: async () => ({ ok: true })
};

export function getElectronApi(): NatjePlayerApi {
  return window.natjePlayer ?? browserFallback;
}
