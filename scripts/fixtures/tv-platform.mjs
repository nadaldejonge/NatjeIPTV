/** Synthetic provider and native bridge: never reads .env, storage, or real account data. */
export function installFixture({ runtime = "android", categoryCount = 478, streamCount = 240, rememberLogin = true, settingsDelay = 0, categoryNames = null, initialHiddenCountries = [], countryFilterVersion = 0 } = {}) {
  const listeners = {};
  const fixture = window.__fixture = {
    calls: [], bounds: [], epgDelay: 20, epgFailure: false, nativeFailure: false,
    delays: {}, failures: {}, epgDelays: {}, epgFailures: {}, settings: { xtream: { serverUrl: "https://provider.invalid", username: "fixture", password: "fixture" }, rememberLogin, hiddenCountries: initialHiddenCountries, countryFilterVersion, favorites: [], recentWatched: [], windowBounds: { width: 1420, height: 860 } },
    emit(name, data) { for (const cb of listeners[name] ?? []) cb(data); },
    async wait(ms) { await new Promise((resolve) => setTimeout(resolve, ms)); }
  };
  const categories = Array.from({ length: categoryCount }, (_, i) => ({ category_id: String(i + 1), category_name: i === 0 ? "NL | Algemeen" : i === 1 ? "NL | Sport" : i === 2 ? "BE | Entertainment" : i === 3 ? "DE | Nieuws" : i === 4 ? "FR | Leeg" : `NL | Categorie ${i + 1}` }));
  if (categoryNames) categories.splice(0, categories.length, ...categoryNames.map((category_name, i) => ({ category_id: String(i + 1), category_name })));
  const names = ["NPO 1 HD", "RTL 4 HD", "RTL 7 HD", "NL | Ziggo Sport Voetbal 4K Ultra HD", "NL | ESPN Eredivisie Premium"];
  const logo = (i) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60"><rect width="80" height="60" rx="7" fill="${["#c32e45","#1679b8","#b34b21","#7c4193","#424b64"][i%5]}"/><text x="40" y="35" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="white">${["NPO 1","RTL 4","RTL 7","SPORT","ESPN"][i%5]}</text></svg>`);
  const streams = (category) => Array.from({ length: category === "5" ? 0 : streamCount }, (_, i) => ({ stream_id: Number(category || 1) * 1000 + i + 1, name: names[i % names.length] + ` · ${i + 1}`, stream_icon: i % 11 === 0 ? "https://logo.invalid/missing.png" : logo(i), category_id: category || "1", container_extension: "m3u8" }));
  const api = {
    runtime, supportsNativePlayer: runtime === "android", supportsMpv: runtime === "electron",
    readSettings: async () => { await fixture.wait(settingsDelay); return fixture.settings; },
    updateSettings: async (patch) => { fixture.calls.push({ action: "settings", keys: Object.keys(patch) }); return fixture.settings = { ...fixture.settings, ...patch }; },
    loadXtreamPortal: async () => ({ liveCategories: categories, seriesCategories: [{ category_id: "10", category_name: "NL | Series" }], vodCategories: [], userInfo: { auth: 1 } }),
    loadXtreamLiveStreams: async (_credentials, id) => {
      fixture.calls.push({ action: "category", id }); await fixture.wait(fixture.delays[id] ?? 15);
      if (fixture.failures[id]) throw new Error("Gesimuleerde providerfout");
      return id ? streams(id) : categories.flatMap((item) => streams(item.category_id));
    },
    loadXtreamSeries: async () => [{ series_id: 1, name: "Voorbeeldserie", category_id: "10", cover: "icons/app.ico", plot: "Bestaande serie-informatie." }],
    loadXtreamSeriesInfo: async () => ({ episodes: { "1": [{ id: 11, title: "Aflevering één", episode_num: 1, container_extension: "mp4", info: { plot: "Afleveringbeschrijving" } }] } }),
    loadXtreamShortEpg: async (_credentials, id) => {
      const fail = fixture.epgFailure || fixture.epgFailures[id];
      fixture.calls.push({ action: "epg", id }); await fixture.wait(fixture.epgDelays[id] ?? fixture.epgDelay);
      if (fail) throw new Error("Gesimuleerde EPG-fout");
      const now = Math.floor(Date.now() / 1000);
      const encode = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
      return { epg_listings: [{ id: `${id}-now`, title: encode(`Nieuws & café ${id}`), description: encode("Een uitgebreide programmabeschrijving met Nederlandse tekens: België, één en café. ".repeat(12)), start_timestamp: String(now - 600), stop_timestamp: String(now + 1800) }, { id: `${id}-next`, title: "Volgende uitzending", description: "Beschrijving van het volgende programma.", start_timestamp: String(now + 1800), stop_timestamp: String(now + 3600) }] };
    },
    playMiniNative: async (request) => {
      fixture.calls.push({ action: "play", id: request.requestId });
      if (fixture.nativeFailure) throw new Error("Gesimuleerde bridgeafwijzing");
      fixture.lastPlayback = request;
      fixture.emit("playerStateChanged", { state: "buffering", isLive: request.isLive, requestId: request.requestId });
      setTimeout(() => fixture.emit("playerStateChanged", { state: "playing", isLive: request.isLive, requestId: request.requestId }), 30);
      return { ok: true };
    },
    setMiniPlayerBounds: async (bounds) => { fixture.bounds.push(bounds); return { ok: true }; },
    enterNativeFullscreen: async () => { fixture.calls.push({ action: "fullscreen" }); fixture.emit("playerModeChanged", { mode: "fullscreen" }); return { ok: true }; },
    exitNativeFullscreen: async () => { fixture.emit("playerModeChanged", { mode: "mini" }); return { ok: true }; },
    stopNativePlayback: async () => { fixture.calls.push({ action: "stop" }); return { ok: true }; },
    showNativeSubtitles: async () => { fixture.calls.push({ action: "subtitles-menu" }); await fixture.wait(30); return { ok: true }; },
    showNativeAudioTracks: async () => { fixture.calls.push({ action: "audio-menu" }); await fixture.wait(30); return { ok: true }; },
    addNativePlayerListener: async (event, cb) => { (listeners[event] ??= []).push(cb); return { remove: async () => { listeners[event] = listeners[event].filter((x) => x !== cb); } }; },
    isMpvAvailable: async () => true, playWithMpv: async () => ({ ok: true }), stopMpv: async () => ({ ok: true }),
    loadSubtitle: async () => ({ content: "WEBVTT\n", format: "vtt" }),
    openPlaylistFile: async () => ({ filePath: "fixture.m3u", content: '#EXTM3U\n#EXTINF:-1 tvg-id="npo1" tvg-logo="icons/app.ico" group-title="NL | M3U",NPO 1\nhttps://media.invalid/demo.m3u8' }),
    loadXtreamVodStreams: async () => [], buildXtreamLiveUrl: async () => "", buildXtreamSeriesUrl: async () => "", buildXtreamMovieUrl: async () => ""
  };
  window.__NATJE_TEST_PLATFORM__ = api;
}
