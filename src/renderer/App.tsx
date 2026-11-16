import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import AppLayout from "./components/AppLayout";
import ErrorPanel from "./components/ErrorPanel";
import SectionHub from "./components/SectionHub";
import StartScreen from "./components/StartScreen";
import TvLayout from "./components/TvLayout";
import type { TvModalKind } from "./components/TvLayout";
import type { NativePlaybackState } from "./components/TvMiniPlayer";
import type { Channel } from "./types/channel";
import { parseM3u } from "./lib/parseM3u";
import { getPlatform } from "../platform";
import { installTvNavigation } from "./lib/tvNavigation";
import { mapXtreamEpisodes, mapXtreamLive, mapXtreamSeries, mapXtreamMovies, seriesIdFromChannel } from "./lib/xtreamMapper";
import type { XtreamCredentials, XtreamEpgListing, XtreamPortal, XtreamSeries } from "../shared/xtream";
import { getHttpTransport, TransportError, XtreamRequestError } from "../shared/httpTransport";
import type { XtreamErrorDiagnostics } from "../shared/httpTransport";
import { useEvent } from "./lib/useEvent";
import { BoundedCache, RequestContext } from "./lib/requestContext";
import { captureTvFocus, restoreTvFocus } from "./lib/tvFocus";
import { normalizeEpg } from "../shared/epg";
import StartupScreen from "./components/StartupScreen";
import { countryCodeFromText, migrateRegionFilters } from "./lib/countryGroups";
import { processSearchChunks, searchCategories } from "./lib/progressiveSearch";
import type { StoredSettings, CategoryPreferences } from "../shared/settings";
import { type CategoryEntry, emptyCategoryPreferences, matchesSearch, orderCategories } from "./lib/categoryPreferences";

const ANDROID_TV_BUILD_ID = "Android TV · 2026-11-16.14";

type ErrorDetails = {
  title: string;
  diagnostics: XtreamErrorDiagnostics;
  retry: () => void;
};

type LoadState = "idle" | "loading" | "ready" | "error";
type Screen = "start" | "hub" | "player";
type Section = "live" | "series" | "movies";
type GroupItem = { name: string; count?: number; loading?: boolean };

export default function App(): ReactElement {
  const electronApi = getPlatform();
  const [screen, setScreen] = useState<Screen>("start");
  const [section, setSection] = useState<Section>("live");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [playlistChannels, setPlaylistChannels] = useState<Channel[]>([]);
  const [seriesChannels, setSeriesChannels] = useState<Channel[]>([]);
  const [episodeChannels, setEpisodeChannels] = useState<Channel[]>([]);
  const [loadedSeries, setLoadedSeries] = useState<XtreamSeries[]>([]);
  const [favorites, setFavorites] = useState<Channel[]>([]);
  const [recentWatched, setRecentWatched] = useState<Channel[]>([]);
  const [portal, setPortal] = useState<XtreamPortal | null>(null);
  const [xtreamCredentials, setXtreamCredentials] = useState<XtreamCredentials>({
    serverUrl: "",
    username: "",
    password: ""
  });
  const [activeSeriesName, setActiveSeriesName] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>("Alle kanalen");
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [playbackChannel, setPlaybackChannel] = useState<Channel | null>(null);
  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  queryRef.current = query;
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistLabel, setPlaylistLabel] = useState("Geen playlist geladen");
  const [status, setStatus] = useState("Klaar");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);
  const [programmeInfo, setProgrammeInfo] = useState<XtreamEpgListing[]>([]);
  const [mpvAvailable, setMpvAvailable] = useState(false);
  const [hiddenCountries, setHiddenCountries] = useState<string[]>([]);
  const [categoryPreferences, setCategoryPreferences] = useState<NonNullable<StoredSettings["categoryPreferences"]>>({});
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const errorDetailsRef = useRef<ErrorDetails | null>(null);
  errorDetailsRef.current = errorDetails;

  const isTv = electronApi.runtime === "android";
  const [startupStage, setStartupStage] = useState<string | null>(isTv ? "Opgeslagen login controleren" : null);
  const startupStageRef = useRef(startupStage);
  startupStageRef.current = startupStage;
  const restoredSettings = useRef<StoredSettings>({});
  const [rememberLogin, setRememberLogin] = useState(true);
  const autoLoginTriedRef = useRef(false);
  const [activeModal, setActiveModal] = useState<TvModalKind>(null);
  const [nativePlayback, setNativePlayback] = useState<NativePlaybackState>({ state: "idle", isLive: false });
  const [nativeError, setNativeError] = useState<string | null>(null);
  const nativeErrorDetailsRef = useRef<Record<string, unknown> | null>(null);
  const contentRequests = useRef(new RequestContext());
  const loginRequests = useRef(new RequestContext());
  const sourceRequests = useRef(new RequestContext());
  const playbackRequest = useRef(0);
  const fullscreenReturn = useRef<ReturnType<typeof captureTvFocus>>(null);
  const nativeMode = useRef("hidden");
  const session = useRef(0);
  const categoryCache = useRef(new BoundedCache<{ channels: Channel[]; series?: XtreamSeries[] }>(12, 120000));
  const catalogueCache = useRef(new BoundedCache<{ channels: Channel[]; series?: XtreamSeries[]; categoryIds?: string[] }>(3, 120000));
  const epgCache = useRef(new BoundedCache<XtreamEpgListing[]>(20, 90000));
  const activeModalRef = useRef<TvModalKind>(null);
  activeModalRef.current = activeModal;
  const screenRef = useRef<Screen>("start");
  screenRef.current = screen;
  useEffect(() => {
    if (screen !== "player") { contentRequests.current.invalidate(); setLoadingGroup(null); }
  }, [screen]);

  function showErrorDetails(error: unknown, title: string, retry: () => void): void {
    if (error instanceof XtreamRequestError) {
      setErrorDetails({ title, diagnostics: error.diagnostics, retry });
    }
  }

  useEffect(() => {
    const uninstallTvNavigation = installTvNavigation();
    let disposed = false;
    void (electronApi.supportsMpv ? electronApi.isMpvAvailable() : Promise.resolve(false)).then(setMpvAvailable);
    void electronApi.readSettings().then((settings) => {
      if (disposed) return;
      restoredSettings.current = settings;
      if (settings.xtream) {
        setXtreamCredentials(settings.xtream);
      }
      setRememberLogin(settings.rememberLogin !== false);
      // Automatische login op TV: geldige onthouden credentials → direct portal laden.
      if (
        isTv &&
        !autoLoginTriedRef.current &&
        settings.rememberLogin !== false &&
        settings.xtream?.serverUrl &&
        settings.xtream.username &&
        settings.xtream.password
      ) {
        autoLoginTriedRef.current = true;
        void performLogin(settings.xtream, { auto: true, remember: true });
      } else { setStartupStage(null); }
      setFavorites((settings.favorites ?? []) as Channel[]);
      setRecentWatched((settings.recentWatched ?? []) as Channel[]);
      setHiddenCountries(settings.hiddenCountries ?? []);
      setCategoryPreferences(settings.categoryPreferences ?? {});
      setPlaylistUrl(settings.lastPlaylistUrl ?? "");
      setActiveGroup(settings.lastGroup ?? "Alle kanalen");
      setActiveChannelId(settings.lastChannelId ?? null);
      if (settings.lastPlaylistPath) {
        setPlaylistLabel(settings.lastPlaylistPath);
      } else if (settings.lastPlaylistUrl) {
        setPlaylistLabel(settings.lastPlaylistUrl);
      }
    }).catch(() => { if (!disposed) { setStartupStage(null); setStatus("Opgeslagen instellingen konden niet worden geladen."); } });
    return () => { disposed = true; uninstallTvNavigation(); };
  }, [electronApi]);

  useEffect(() => {
    if (electronApi.runtime !== "android") {
      return;
    }
    const subscription = CapacitorApp.addListener("backButton", () => {
      if (startupStageRef.current !== null) {
        loginRequests.current.invalidate(); setStartupStage(null); setLoadState("idle"); return;
      }
      if (errorDetailsRef.current) {
        setErrorDetails(null);
        return;
      }
      if (activeModalRef.current) {
        setActiveModal(null);
        return;
      }
      if (screenRef.current === "player") {
        void stopTvPlayback();
        setScreen("hub");
        return;
      }
      if (screenRef.current === "hub") {
        setScreen("start");
        return;
      }
      void CapacitorApp.exitApp();
    });
    return () => {
      void subscription.then((handle) => handle.remove());
    };
  }, [electronApi]);

  useEffect(() => {
    if (!isTv || !electronApi.addNativePlayerListener) {
      return;
    }
    const handles: Array<Promise<{ remove: () => Promise<void> }>> = [
      electronApi.addNativePlayerListener("playerStateChanged", (data) => {
        if (data.requestId !== undefined && Number(data.requestId) !== playbackRequest.current) return;
        const state = String(data.state ?? "idle");
        const mapped: NativePlaybackState["state"] =
          state === "buffering"
            ? "buffering"
            : state === "playing"
              ? "playing"
              : state === "paused"
                ? "paused"
                : state === "ended"
                  ? "ended"
                  : state === "error"
                    ? "error"
                    : "idle";
        setNativePlayback({ state: mapped, isLive: Boolean(data.isLive) });
        if (mapped === "playing") {
          setNativeError(null);
        }
      }),
      electronApi.addNativePlayerListener("playerError", (data) => {
        if (data.requestId !== undefined && Number(data.requestId) !== playbackRequest.current) return;
        const message = String(data.message ?? "Onbekende playerfout");
        setNativeError(message);
        nativeErrorDetailsRef.current = data;
      }),
      electronApi.addNativePlayerListener("playerModeChanged", (data) => {
        const previous = nativeMode.current;
        nativeMode.current = String(data.mode);
        if (previous === "fullscreen" && data.mode === "mini") {
          requestAnimationFrame(() => restoreTvFocus(fullscreenReturn.current));
        }
      })
    ];
    return () => {
      for (const handle of handles) {
        void handle.then((item) => item.remove());
      }
    };
  }, [electronApi, isTv]);

  async function playOnTv(channel: Channel): Promise<boolean> {
    if (!electronApi.playMiniNative || !channel.url) {
      return false;
    }
    const requestId = ++playbackRequest.current;
    setPlaybackChannel(channel);
    setNativeError(null);
    nativeErrorDetailsRef.current = null;
    setNativePlayback({ state: "loading", isLive: channel.kind === "live" });
    const fallback = channel.meta?.fallbackUrl;
    const preferOriginal = channel.kind === "episode" && fallback && !/\.m3u8(?:\?|$)/i.test(fallback);
    const liveFallback = channel.kind === "live" && channel.source === "xtream" && /\.m3u8(?:\?|$)/i.test(channel.url)
      ? channel.url.replace(/\.m3u8(?=\?|$)/i, ".ts") : undefined;
    try {
      const result = await electronApi.playMiniNative({
        requestId,
        url: preferOriginal ? fallback : channel.url,
        title: channel.name,
        isLive: channel.kind === "live",
        fallbackUrls: preferOriginal ? [channel.url] : fallback ? [fallback] : liveFallback ? [liveFallback] : []
      });
      if (requestId !== playbackRequest.current) return false;
      if (!result.ok) {
        setNativeError(result.error);
        setNativePlayback({ state: "error", isLive: channel.kind === "live" });
        return false;
      }
      return true;
    } catch {
      if (requestId !== playbackRequest.current) return false;
      setNativeError("De native speler kon niet starten. Probeer opnieuw.");
      setNativePlayback({ state: "error", isLive: channel.kind === "live" });
      return false;
    }
  }

  async function stopTvPlayback(): Promise<void> {
    const request = ++playbackRequest.current;
    try { await electronApi.stopNativePlayback?.(); }
    catch { if (request === playbackRequest.current) setNativeError("Stoppen mislukt. Probeer opnieuw."); return; }
    if (request !== playbackRequest.current) return;
    setNativePlayback({ state: "idle", isLive: false });
    setNativeError(null);
    setActiveChannelId(null);
    setPlaybackChannel(null);
    requestAnimationFrame(() => restoreTvFocus());
  }

  function showNativeErrorDetails(): void {
    const data = nativeErrorDetailsRef.current ?? {};
    setErrorDetails({
      title: "Afspelen mislukt",
      diagnostics: {
        step: "native playback",
        endpoint: "stream",
        kind: "unknown",
        message: String(data.message ?? nativeError ?? "Onbekende playerfout"),
        server: "",
        sanitizedUrl: "",
        transport: "capacitor-http",
        code: data.code ? String(data.code) : undefined,
        technicalDetails: data.cause ? String(data.cause) : undefined,
        timestamp: new Date().toISOString(),
        durationMs: 0
      },
      retry: () => {
        setErrorDetails(null);
        if (activeChannel) {
          void playOnTv(activeChannel);
        }
      }
    });
  }

  function refreshCurrentGroup(): void {
    if (activeGroup.startsWith("Zoeken:")) { catalogueCache.current.clear(); categoryCache.current.clear(); void searchCurrentSection(); return; }
    if (activeGroup && !["Favorieten", "Recent bekeken"].includes(activeGroup) && portal) {
      categoryCache.current.clear();
      void selectGroup(activeGroup);
    }
  }

  function resetCountries(): void {
    setHiddenCountries([]);
    void electronApi.updateSettings({ hiddenCountries: [] });
  }

  function hideAllCountries(countries: string[]): void {
    const next = Array.from(new Set(countries)).sort();
    setHiddenCountries(next);
    const preferences = removeCountryOverrides(countries);
    setCategoryPreferences(preferences);
    void electronApi.updateSettings({ hiddenCountries: next, categoryPreferences: preferences });
  }

  const browsingChannel = useMemo(
    () => channels.find((channel) => channel.id === activeChannelId) ?? null,
    [activeChannelId, channels]
  );
  const activeChannel = isTv ? playbackChannel : browsingChannel;
  const activateMiniPlayer = useEvent(async (): Promise<void> => {
    if (!activeChannel) return;
    fullscreenReturn.current = captureTvFocus();
    if (nativeError || ["idle", "error", "ended"].includes(nativePlayback.state)) {
      if (!await playOnTv(activeChannel)) return;
    }
    try {
      if (nativePlayback.state === "paused") await electronApi.resumeNative?.();
      await electronApi.enterNativeFullscreen?.();
    } catch { setNativeError("Fullscreen openen mislukt. Probeer de zender opnieuw te starten."); }
  });
  const credentialRef = useRef(xtreamCredentials);
  credentialRef.current = xtreamCredentials;

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const channel = activeChannel;
    setProgrammeInfo([]);
    if (screen !== "player" || channel?.kind !== "live" || channel.source !== "xtream" || !channel.meta?.streamId) return;
    const cacheKey = `${session.current}:${channel.meta.streamId}`;
    const schedule = (listings: XtreamEpgListing[]): void => {
      const nextBoundary = normalizeEpg(listings).flatMap((p) => [p.start, p.end]).filter((n): n is number => n !== undefined && n * 1000 > Date.now()).sort((a, b) => a - b)[0];
      // One refresh at a programme boundary, or a slow retry for missing data. No hot polling.
      timer = window.setTimeout(() => void load(true), Math.max(15000, Math.min(300000, nextBoundary ? nextBoundary * 1000 - Date.now() + 500 : 180000)));
    };
    const load = async (refresh = false): Promise<void> => {
      try {
        const cached = refresh ? undefined : epgCache.current.get(cacheKey);
        const response = cached ?? (await electronApi.loadXtreamShortEpg(credentialRef.current, channel.meta!.streamId!)).epg_listings;
        if (cancelled) return;
        const listings = Array.isArray(response) ? response : [];
        epgCache.current.set(cacheKey, listings);
        setProgrammeInfo(listings); schedule(listings);
      } catch { if (!cancelled) { setProgrammeInfo([]); schedule([]); } }
    };
    timer = window.setTimeout(() => void load(), isTv ? 350 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activeChannel?.id, screen, electronApi, isTv, portal]);

  const favoriteKeys = useMemo(() => new Set(favorites.map((channel) => channel.favoriteKey ?? channel.id)), [favorites]);

  const sectionCategories = portal ? section === "live" ? portal.liveCategories : section === "series" ? portal.seriesCategories : portal.vodCategories : [];
  const currentCategoryPreferences = categoryPreferences[section] ?? emptyCategoryPreferences;
  const categoryKeyByName = useMemo(() => new Map(sectionCategories.map((item) => [item.category_name, `xtream:${item.category_id}`])), [sectionCategories]);
  const hiddenCategoryKeys = useMemo(() => new Set(currentCategoryPreferences.hidden), [currentCategoryPreferences.hidden]);
  const shownCategoryKeys = useMemo(() => new Set(currentCategoryPreferences.shown ?? []), [currentCategoryPreferences.shown]);
  const recentChannels = useMemo(() => recentWatched.filter((channel) => channel.section === "live" && !isHiddenCountryGroup(channel.group)), [recentWatched, hiddenCountries, shownCategoryKeys, categoryKeyByName, portal]);
  const categoryEntries = useMemo<CategoryEntry[]>(() => portal
    ? sectionCategories.map((item) => ({ key: `xtream:${item.category_id}`, name: item.category_name, countryHidden: hiddenCountries.includes(countryCodeFromText(item.category_name) ?? "") }))
    : [...new Set(playlistChannels.map((channel) => channel.group))].sort().map((name) => ({ key: `m3u:${name}`, name, countryHidden: hiddenCountries.includes(countryCodeFromText(name) ?? "") })),
  [portal, sectionCategories, playlistChannels, hiddenCountries]);
  const orderedCategoryEntries = useMemo(() => orderCategories(categoryEntries, currentCategoryPreferences.order), [categoryEntries, currentCategoryPreferences.order]);

  function isHiddenCategory(group: string, categoryId?: string): boolean {
    const key = portal ? categoryId ? `xtream:${categoryId}` : categoryKeyByName.get(group) : `m3u:${group}`;
    return Boolean(key && hiddenCategoryKeys.has(key));
  }

  const visibleChannels = useMemo(() => channels.filter((channel) => !isHiddenCategory(channel.meta?.categoryName ?? channel.group, channel.meta?.categoryId) && !isHiddenCountryGroup(channel.meta?.categoryName ?? channel.group)),
    [channels, categoryPreferences, hiddenCountries, portal, section]);

  async function saveCategoryPreferences(preferences: CategoryPreferences): Promise<void> {
    const next = { ...categoryPreferences, [section]: preferences };
    await electronApi.updateSettings({ categoryPreferences: next });
    setCategoryPreferences(next);
    // Stop older searches from publishing against filters captured before this change.
    contentRequests.current.invalidate(); setLoadingGroup(null); setLoadState("ready");
    const active = categoryEntries.find((item) => item.name === activeGroup);
    if (active && preferences.hidden.includes(active.key)) {
      setActiveGroup(portal ? "Favorieten" : "Alle kanalen"); setChannels(portal ? favorites.filter((item) => item.section === section) : playlistChannels); setQuery("");
    }
    setStatus("Categorieën en volgorde opgeslagen");
  }

  const groupsOverride = useMemo<GroupItem[] | undefined>(() => {
    if (!portal || screen !== "player" || episodeChannels.length > 0) {
      return undefined;
    }

    const sectionFavorites = favorites.filter((channel) => channel.section === section && !isHiddenCategory(channel.meta?.categoryName ?? channel.group, channel.meta?.categoryId) && !isHiddenCountryGroup(channel.meta?.categoryName ?? channel.group));
    const recentLive = visibleRecentWatched();
    const categoryItems = orderedCategoryEntries.filter((item) => !currentCategoryPreferences.hidden.includes(item.key));
    return [
      { name: "Favorieten", count: sectionFavorites.length },
      ...(section === "live" && recentLive.length > 0 ? [{ name: "Recent bekeken", count: recentLive.length }] : []),
      ...categoryItems.map((category) => ({
        name: category.name,
        loading: loadingGroup === category.name
      }))
    ];
  }, [episodeChannels.length, favorites, hiddenCountries, loadingGroup, portal, recentWatched, screen, section, orderedCategoryEntries, currentCategoryPreferences]);

  function enterSection(nextSection: Section): void {
    contentRequests.current.invalidate();
    setLoadState("ready"); setLoadingGroup(null);
    setSection(nextSection);
    setEpisodeChannels([]);
    setSeriesChannels([]);
    setLoadedSeries([]);
    setActiveSeriesName(null);
    setActiveGroup("Favorieten");
    setChannels(favorites.filter((channel) => channel.section === nextSection));
    setActiveChannelId(null);
    setQuery("");
    setScreen("player");
    setStatus(nextSection === "live" ? "Kies een live categorie" : nextSection === "movies" ? "Kies een filmcategorie" : "Kies een seriecategorie");
    void electronApi.updateSettings({ lastSection: nextSection, lastGroup: "Favorieten" });
  }

  async function loadContent(content: string, source: "m3u-file" | "m3u-url", label: string): Promise<void> {
    contentRequests.current.invalidate(); loginRequests.current.invalidate();
    ++session.current; categoryCache.current.clear(); catalogueCache.current.clear(); epgCache.current.clear();
    setLoadState("loading");
    setStatus("Playlist verwerken...");

    const parsed = parseM3u(content, source);
    if (parsed.length === 0) {
      setLoadState("error");
      setChannels([]);
      setActiveChannelId(null);
      setStatus("Geen geldige kanalen gevonden in deze playlist.");
      return;
    }

    const live = parsed.map((channel) => ({
      ...channel,
      favoriteKey: channel.url,
      section: "live" as const,
      kind: "live" as const
    }));
    if (isTv) {
      // Nieuwe playlist bevestigd: de oude bron is niet langer geldig.
      void stopTvPlayback();
    }
    setChannels(live);
    setPlaylistChannels(live);
    setPortal(null);
    setPlaylistLabel(label);
    setActiveGroup("Alle kanalen");
    setActiveChannelId(null);
    setSection("live");
    setScreen("player");
    setLoadState("ready");
    setStatus(`${live.length} kanalen geladen`);
    await electronApi.updateSettings({
      lastPlaylistType: source,
      lastPlaylistUrl: source === "m3u-url" ? label : undefined,
      lastGroup: "Alle kanalen",
      lastSection: "live"
    });
  }

  async function openFile(): Promise<void> {
    const ticket = sourceRequests.current.begin();
    loginRequests.current.invalidate();
    contentRequests.current.invalidate();
    try {
      setStatus("Bestand kiezen...");
      const result = await electronApi.openPlaylistFile();
      if (!sourceRequests.current.isCurrent(ticket)) return;
      if (!result) {
        setStatus("Bestand openen geannuleerd");
        return;
      }
      await loadContent(result.content, "m3u-file", result.filePath);
    } catch (error) {
      if (!sourceRequests.current.isCurrent(ticket)) return;
      setLoadState("error");
      setStatus(error instanceof Error ? error.message : "Playlist-bestand kon niet worden geopend.");
    }
  }

  async function loadUrl(): Promise<void> {
    const ticket = sourceRequests.current.begin();
    loginRequests.current.invalidate();
    contentRequests.current.invalidate();
    const url = playlistUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setLoadState("error");
      setStatus("Voer een geldige http(s) M3U/M3U8 URL in.");
      return;
    }

    try {
      setLoadState("loading");
      setStatus("Playlist-URL ophalen...");
      const response = await getHttpTransport().get({ url });
      if (!sourceRequests.current.isCurrent(ticket)) return;
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Playlist niet bereikbaar (${response.status})`);
      }
      await loadContent(response.bodyText, "m3u-url", url);
    } catch (error) {
      if (!sourceRequests.current.isCurrent(ticket)) return;
      setLoadState("error");
      if (error instanceof TransportError) {
        setStatus(`Playlist-URL kon niet worden geladen: ${error.message}`);
      } else {
        setStatus(error instanceof Error ? error.message : "Playlist-URL kon niet worden geladen.");
      }
    }
  }

  async function performLogin(
    rawCredentials: XtreamCredentials,
    options?: { auto?: boolean; remember?: boolean }
  ): Promise<void> {
    const ticket = loginRequests.current.begin();
    sourceRequests.current.invalidate(); contentRequests.current.invalidate();
    const credentials = {
      serverUrl: rawCredentials.serverUrl.trim(),
      username: rawCredentials.username.trim(),
      password: rawCredentials.password
    };

    if (!credentials.serverUrl || !credentials.username || !credentials.password) {
      setLoadState("error");
      setStatus("Vul server URL, username en password in.");
      return;
    }

    const remember = options?.remember ?? rememberLogin;
    const startedAt = Date.now();

    try {
      setLoadState("loading");
      if (isTv) setStartupStage("Account en categorieën ophalen");
      setStatus(options?.auto ? "Automatisch inloggen..." : "Xtream account en categorieen ophalen...");
      const loadedPortal = await electronApi.loadXtreamPortal(credentials);
      if (!loginRequests.current.isCurrent(ticket)) return;
      ++session.current; categoryCache.current.clear(); catalogueCache.current.clear(); epgCache.current.clear();

      if (isTv) {
        const saved = restoredSettings.current;
        const hidden = migrateRegionFilters(
          [...loadedPortal.liveCategories, ...loadedPortal.seriesCategories].map((item) => item.category_name),
          options?.auto ? saved.hiddenCountries ?? [] : hiddenCountries, saved.countryFilterVersion
        );
        setHiddenCountries(hidden);
        restoredSettings.current = { ...saved, hiddenCountries: hidden, countryFilterVersion: 2 };
        await electronApi.updateSettings({ hiddenCountries: hidden, countryFilterVersion: 2 });
        if (!loginRequests.current.isCurrent(ticket)) return;
        setStartupStage("Eerste categorie en zenderafbeeldingen voorbereiden");
        const savedCategories = (options?.auto ? saved.categoryPreferences : categoryPreferences)?.live ?? emptyCategoryPreferences;
        const visible = orderCategories(loadedPortal.liveCategories.map((item) => ({ ...item, key: `xtream:${item.category_id}` })), savedCategories.order)
          .filter((item) => (savedCategories.shown?.includes(item.key) || !hidden.includes(countryCodeFromText(item.category_name) ?? "")) && !savedCategories.hidden.includes(item.key));
        const first = visible.find((item) => item.category_name === saved.lastGroup) ?? visible[0];
        if (first) {
          try {
            const streams = await electronApi.loadXtreamLiveStreams(credentials, first.category_id);
            if (!loginRequests.current.isCurrent(ticket)) return;
            const prepared = mapXtreamLive(streams, loadedPortal.liveCategories, credentials);
            categoryCache.current.set(`${session.current}:live:${first.category_id}`, { channels: prepared });
            // Only the first visible category and a handful of its logos; no whole-account preload.
            await Promise.all(prepared.slice(0, 12).filter((channel) => channel.logo).map((channel) => new Promise<void>((resolve) => {
              const image = new Image();
              const finish = (): void => { window.clearTimeout(timeout); image.onload = null; image.onerror = null; resolve(); };
              const timeout = window.setTimeout(finish, 1200);
              image.onload = finish; image.onerror = finish; image.src = channel.logo!;
            })));
          } catch { /* A failed warmup must not invalidate a valid login; category retry remains available. */ }
        }
        if (!loginRequests.current.isCurrent(ticket)) return;
        setStartupStage("Interface gereedmaken");
        await new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(0, 10000 - (Date.now() - startedAt))));
        if (!loginRequests.current.isCurrent(ticket)) return;
      }

      setPortal(loadedPortal);
      setXtreamCredentials(credentials);
      setChannels([]);
      setSeriesChannels([]);
      setEpisodeChannels([]);
      setLoadedSeries([]);
      setActiveChannelId(null);
      setPlaylistLabel(isTv ? "Xtream-account verbonden" : `${credentials.serverUrl} - ${credentials.username}`);
      setLoadState("ready");
      setStatus(`${loadedPortal.liveCategories.length} live categorieen en ${loadedPortal.seriesCategories.length} serie categorieen geladen`);
      setScreen("hub");
      setStartupStage(null);
      if (isTv) {
        // Op Windows bewaart het Electron-mainproces de login al; op TV doen we het hier,
        // waarbij het wachtwoord via de platformlaag in Keystore-backed secure storage belandt.
        await electronApi.updateSettings({
          lastPlaylistType: "xtream",
          rememberLogin: remember,
          xtream: remember ? credentials : undefined
        });
      }
    } catch (error) {
      if (!loginRequests.current.isCurrent(ticket)) return;
      setStartupStage(null);
      setLoadState("error");
      setStatus(error instanceof Error ? error.message : "Xtream login mislukt.");
      showErrorDetails(error, "Login mislukt", () => {
        setErrorDetails(null);
        void performLogin(credentials, options);
      });
    }
  }

  async function loginXtream(): Promise<void> {
    await performLogin(xtreamCredentials);
  }

  const selectGroup = useEvent(async (group: string): Promise<void> => {
    const ticket = contentRequests.current.begin();
    setActiveGroup(group);
    setActiveChannelId(null);
    setQuery("");
    void electronApi.updateSettings({ lastGroup: group });
    setLoadState("ready"); setLoadingGroup(null);

    if (group === "Favorieten") {
      setChannels(favorites.filter((channel) => channel.section === section));
      setStatus("Favorieten");
      return;
    }

    if (group === "Recent bekeken") {
      const recentLive = visibleRecentWatched();
      setChannels(recentLive);
      setStatus(`${recentLive.length} recent bekeken zenders`);
      return;
    }

    if (!portal) {
      setChannels(playlistChannels);
      return;
    }

    setEpisodeChannels([]); setActiveSeriesName(null);
    const category = sectionCategories.find(
      (item) => item.category_name === group
    );
    if (!category) {
      return;
    }

    try {
      const key = `${session.current}:${section}:${category.category_id}`;
      const cached = categoryCache.current.get(key);
      if (isTv && cached) {
        setChannels(cached.channels);
        if (cached.series) { setLoadedSeries(cached.series); setSeriesChannels(cached.channels); }
        setStatus(`${cached.channels.length} geladen in ${group}`); return;
      }
      setLoadState("loading");
      setLoadingGroup(group);
      setChannels([]);
      setStatus(`${group} laden...`);

      if (section === "live") {
        const streams = await electronApi.loadXtreamLiveStreams(xtreamCredentials, category.category_id);
        if (!contentRequests.current.isCurrent(ticket)) return;
        const mapped = mapXtreamLive(streams.map((item) => ({ ...item, category_id: item.category_id ?? category.category_id })), portal.liveCategories, xtreamCredentials);
        setChannels(mapped);
        if (isTv) categoryCache.current.set(key, { channels: mapped });
        setStatus(`${mapped.length} kanalen geladen in ${group}`);
      } else if (section === "series") {
        const series = await electronApi.loadXtreamSeries(xtreamCredentials, category.category_id);
        if (!contentRequests.current.isCurrent(ticket)) return;
        const mapped = mapXtreamSeries(series.map((item) => ({ ...item, category_id: item.category_id ?? category.category_id })), portal.seriesCategories);
        setLoadedSeries(series);
        setSeriesChannels(mapped);
        setChannels(mapped);
        if (isTv) categoryCache.current.set(key, { channels: mapped, series });
        setStatus(`${mapped.length} series geladen in ${group}`);
      } else {
        const movies = await electronApi.loadXtreamVodStreams(xtreamCredentials, category.category_id);
        if (!contentRequests.current.isCurrent(ticket)) return;
        const mapped = mapXtreamMovies(movies.map((item) => ({ ...item, category_id: item.category_id ?? category.category_id })), portal.vodCategories, xtreamCredentials);
        setChannels(mapped);
        if (isTv) categoryCache.current.set(key, { channels: mapped });
        setStatus(`${mapped.length} films geladen in ${group}`);
      }

      setLoadState("ready");
    } catch (error) {
      if (!contentRequests.current.isCurrent(ticket)) return;
      setLoadState("error");
      setStatus(error instanceof Error ? error.message : "Categorie kon niet worden geladen.");
      showErrorDetails(error, "Categorie laden mislukt", () => {
        setErrorDetails(null);
        void selectGroup(group);
      });
    } finally {
      if (contentRequests.current.isCurrent(ticket)) setLoadingGroup(null);
    }
  });

  async function searchCurrentSection(submittedQuery?: string): Promise<void> {
    const searchValue = typeof submittedQuery === "string" ? submittedQuery : queryRef.current;
    queryRef.current = searchValue;
    setQuery(searchValue);
    const term = searchValue.trim();
    if (!term) {
      setStatus("Typ een titel of categorie om te zoeken.");
      return;
    }

    if (!portal) {
      setChannels(playlistChannels); setActiveGroup("Alle kanalen");
      setStatus("Zoeken doorzoekt de volledige playlist.");
      return;
    }

    const ticket = contentRequests.current.begin();

    const isCurrent = (): boolean => contentRequests.current.isCurrent(ticket);
    const results = new Map<string, Channel>();
    const allChannels = new Map<string, Channel>();
    const seriesResults = new Map<number, XtreamSeries>();
    let published = false;
    const matches = (channel: Channel): boolean => channel.section === section && (section !== "series" || channel.kind === "series") &&
      !isHiddenCountryGroup(channel.group) && !isHiddenCategory(channel.group, channel.meta?.categoryId) && matchesSearch(channel.name, channel.group, term);
    const publish = (items: Channel[]): void => {
      if (!isCurrent()) return;
      for (const item of items) if (item.section === section && (section !== "series" || item.kind === "series")) allChannels.set(item.id, item);
      let changed = !published;
      for (const channel of items) if (matches(channel) && results.get(channel.id) !== channel) { results.set(channel.id, channel); changed = true; }
      if (!changed) return;
      published = true;
      const next = [...results.values()];
      setChannels(next);
      if (section === "series") { setSeriesChannels(next); setLoadedSeries([...seriesResults.values()]); }
      setStatus(`Zoeken… ${next.length} resultaten gevonden`);
    };

    try {
      setLoadState("loading");
      setLoadingGroup("search");
      setActiveGroup(`Zoeken: ${term}`);
      setActiveChannelId(null);
      if (section === "series") { setEpisodeChannels([]); setActiveSeriesName(null); }
      setStatus(section === "live" ? "Zenders zoeken..." : section === "movies" ? "Films zoeken..." : "Series zoeken...");
      for (const series of loadedSeries) seriesResults.set(Number(series.series_id), series);
      const catalogueKey = `${session.current}:${section}`;
      const catalogue = catalogueCache.current.get(catalogueKey);
      const cached = [...categoryCache.current.values(), ...(catalogue ? [catalogue] : [])];
      for (const item of cached) for (const series of item.series ?? []) seriesResults.set(Number(series.series_id), series);
      publish([...channels, ...favorites, ...recentWatched, ...cached.flatMap((item) => item.channels)]);
      const categories = orderCategories(sectionCategories.map((item) => ({ ...item, key: `xtream:${item.category_id}` })), currentCategoryPreferences.order)
        .filter((item) => !isHiddenCountryGroup(item.category_name) && !isHiddenCategory(item.category_name, String(item.category_id)));
      const completed = new Set(catalogue?.categoryIds ?? []);
      const catalogueCoversSelection = Boolean(catalogue && (!catalogue.categoryIds || categories.every((item) => completed.has(String(item.category_id)))));
      const markComplete = (id: string): void => {
        if (!isCurrent() || !id) return;
        completed.add(String(id));
        const count = categories.filter((item) => completed.has(String(item.category_id))).length;
        setStatus(`Zoeken… ${results.size} resultaten · ${count}/${categories.length} categorieën gecontroleerd`);
      };
      let bulkComplete = false;
      const loadCategory = async (categoryId: string): Promise<void> => {
        const cacheKey = `${session.current}:${section}:${categoryId}`;
        const hit = categoryId ? categoryCache.current.get(cacheKey) : undefined;
        if (hit) { for (const item of hit.series ?? []) seriesResults.set(Number(item.series_id), item); publish(hit.channels); markComplete(categoryId); return; }
        if (!categoryId && catalogueCoversSelection && catalogue) { publish(catalogue.channels); bulkComplete = true; return; }
        if (categoryId && catalogue && completed.has(String(categoryId))) { publish(catalogue.channels); markComplete(categoryId); return; }
        if (section === "live") {
          const streams = await electronApi.loadXtreamLiveStreams(xtreamCredentials, categoryId);
          if (!isCurrent()) return;
          const mapped: Channel[] = [];
          await processSearchChunks(streams, (chunk) => { const next = mapXtreamLive(chunk.map((item) => ({ ...item, category_id: item.category_id ?? (categoryId || undefined) })), portal.liveCategories, xtreamCredentials); mapped.push(...next); publish(next); }, isCurrent);
          if (categoryId && isCurrent()) categoryCache.current.set(cacheKey, { channels: mapped });
          if (!categoryId && isCurrent()) { catalogueCache.current.set(catalogueKey, { channels: mapped }); bulkComplete = true; }
        } else if (section === "series") {
          const series = await electronApi.loadXtreamSeries(xtreamCredentials, categoryId);
          if (!isCurrent()) return;
          const mapped: Channel[] = [];
          await processSearchChunks(series, (chunk) => {
            for (const item of chunk) seriesResults.set(Number(item.series_id), item);
            const next = mapXtreamSeries(chunk.map((item) => ({ ...item, category_id: item.category_id ?? (categoryId || undefined) })), portal.seriesCategories); mapped.push(...next); publish(next);
          }, isCurrent);
          if (categoryId && isCurrent()) categoryCache.current.set(cacheKey, { channels: mapped, series });
          if (!categoryId && isCurrent()) { catalogueCache.current.set(catalogueKey, { channels: mapped, series }); bulkComplete = true; }
        } else {
          const movies = await electronApi.loadXtreamVodStreams(xtreamCredentials, categoryId);
          if (!isCurrent()) return;
          const mapped: Channel[] = [];
          await processSearchChunks(movies, (chunk) => { const next = mapXtreamMovies(chunk.map((item) => ({ ...item, category_id: item.category_id ?? (categoryId || undefined) })), portal.vodCategories, xtreamCredentials); mapped.push(...next); publish(next); }, isCurrent);
          if (categoryId && isCurrent()) categoryCache.current.set(cacheKey, { channels: mapped });
          if (!categoryId && isCurrent()) { catalogueCache.current.set(catalogueKey, { channels: mapped }); bulkComplete = true; }
        }
        markComplete(categoryId);
      };
      // Small visible selections publish each category independently. Broad searches also probe
      // at most two uncached visible categories while one account-wide request runs, so new hits
      // can appear before that large response completes without hundreds of extra API calls.
      const probes = categories.slice(0, 4).filter((item) => !categoryCache.current.get(`${session.current}:${section}:${item.category_id}`)).slice(0, 2);
      const broadSearch = categories.length > 24;
      // An account-wide request cannot exclude categories. Any visibility filter therefore
      // requires category-scoped requests, even for large selections.
      const useBulk = broadSearch && categories.length === sectionCategories.length;
      const tasks = catalogueCoversSelection ? [""] : catalogue?.categoryIds ? categories.filter((item) => !completed.has(String(item.category_id))).map((item) => item.category_id) : useBulk ? [...probes.map((item) => item.category_id), ""] : categories.map((item) => item.category_id);
      let attempted = tasks.length;
      let errors = await searchCategories(tasks, loadCategory, isCurrent);
      if (tasks.includes("") && !bulkComplete && isCurrent()) {
        setStatus("De brede aanvraag mislukte; categorieën afzonderlijk doorzoeken…");
        const remaining = categories.filter((item) => !completed.has(String(item.category_id))).map((item) => item.category_id);
        attempted = remaining.length;
        errors = await searchCategories(remaining, loadCategory, isCurrent, 2);
      }
      if (!isCurrent()) return;
      if (attempted > 0 && errors.length === attempted && results.size === 0 && completed.size === 0) throw errors[0];
      if (!bulkComplete) catalogueCache.current.set(catalogueKey, { channels: [...allChannels.values()], series: [...seriesResults.values()], categoryIds: [...completed] });
      setStatus(`${results.size} ${section === "live" ? "zenders" : section === "movies" ? "films" : "series"} gevonden voor “${term}”${errors.length ? " · Niet alle categorieën konden worden gecontroleerd. Probeer opnieuw." : ""}`);
      setLoadState("ready");
    } catch (error) {
      if (!contentRequests.current.isCurrent(ticket)) return;
      setLoadState("error");
      setStatus(error instanceof Error ? error.message : "Zoeken mislukt.");
      showErrorDetails(error, "Zoeken mislukt", () => {
        setErrorDetails(null);
        void searchCurrentSection();
      });
    } finally {
      if (contentRequests.current.isCurrent(ticket)) setLoadingGroup(null);
    }
  }

  const selectChannel = useEvent(async (channel: Channel): Promise<void> => {
    if (channel.kind === "series") {
      await openSeries(channel);
      return;
    }

    const previousChannelId = isTv ? playbackChannel?.id : activeChannelId;
    setActiveChannelId(channel.id);
    if (isTv) {
      const busy = ["playing", "paused", "buffering", "loading"].includes(nativePlayback.state);
      if (channel.id === previousChannelId && busy) {
        // Tweede OK op dezelfde zender is de TV-shortcut naar fullscreen.
        fullscreenReturn.current = captureTvFocus();
        void electronApi.enterNativeFullscreen?.().catch(() => setNativeError("Fullscreen openen mislukt."));
      } else {
        void playOnTv(channel);
      }
    }
    if (channel.kind === "live") {
      addRecentWatched(channel);
    }
    setStatus(`Geselecteerd: ${channel.name}`);
    void electronApi.updateSettings({
      lastChannelId: channel.id,
      lastGroup: channel.group
    });
  });

  const changeQuery = useEvent((value: string): void => {
    queryRef.current = value;
    if (loadingGroup === "search") { contentRequests.current.invalidate(); setLoadingGroup(null); setLoadState("ready"); }
    setQuery(value);
  });

  async function openSeries(channel: Channel): Promise<void> {
    const ticket = contentRequests.current.begin();
    setLoadingGroup(null);
    const seriesId = seriesIdFromChannel(channel);
    if (!seriesId) {
      return;
    }

    const series = loadedSeries.find((item) => Number(item.series_id) === seriesId) ?? {
      series_id: seriesId, name: channel.name, cover: channel.logo, plot: channel.meta?.plot, category_id: channel.meta?.categoryId
    };

    try {
      setLoadState("loading");
      setStatus(`Afleveringen laden: ${channel.name}`);
      const info = await electronApi.loadXtreamSeriesInfo(xtreamCredentials, seriesId);
      if (!contentRequests.current.isCurrent(ticket)) return;
      const episodes = mapXtreamEpisodes({ ...series, category_id: series.category_id ?? channel.meta?.categoryId }, info, xtreamCredentials).map((item) => ({ ...item, meta: { ...item.meta, categoryName: channel.group } }));
      setEpisodeChannels(episodes);
      setChannels(episodes);
      setActiveSeriesName(channel.name);
      setActiveGroup("Alle afleveringen");
      setActiveChannelId(null);
      setQuery("");
      setLoadState("ready");
      setStatus(episodes.length > 0 ? `${episodes.length} afleveringen geladen` : "Geen afleveringen gevonden voor deze serie.");
    } catch (error) {
      if (!contentRequests.current.isCurrent(ticket)) return;
      setLoadState("error");
      setStatus(error instanceof Error ? error.message : "Afleveringen konden niet worden geladen.");
      showErrorDetails(error, "Afleveringen laden mislukt", () => {
        setErrorDetails(null);
        void openSeries(channel);
      });
    }
  }

  const toggleFavorite = useEvent(async (channel: Channel): Promise<void> => {
    if (!channel.url || channel.kind === "series") {
      return;
    }

    const key = channel.favoriteKey ?? channel.id;
    const exists = favoriteKeys.has(key);
    const nextFavorites = exists
      ? favorites.filter((item) => (item.favoriteKey ?? item.id) !== key)
      : [...favorites, channel];

    setFavorites(nextFavorites);
    await electronApi.updateSettings({ favorites: nextFavorites });
    if (activeGroup === "Favorieten") {
      setChannels(nextFavorites.filter((item) => item.section === section));
    }
    setStatus(exists ? "Uit favorieten verwijderd" : "Aan favorieten toegevoegd");
  });

  function backToSeries(): void {
    contentRequests.current.invalidate(); setLoadState("ready"); setLoadingGroup(null);
    setEpisodeChannels([]);
    setChannels(seriesChannels);
    setActiveSeriesName(null);
    setActiveGroup(seriesChannels[0]?.group ?? activeGroup);
    setActiveChannelId(null);
    setQuery("");
    setStatus("Series overzicht");
  }

  function logout(): void {
    setStartupStage(null);
    contentRequests.current.invalidate(); loginRequests.current.invalidate(); sourceRequests.current.invalidate();
    ++session.current; categoryCache.current.clear(); catalogueCache.current.clear(); epgCache.current.clear();
    setLoadState("idle"); setLoadingGroup(null);
    if (isTv) {
      void stopTvPlayback();
      // Expliciete logout: onthouden login volledig wissen (incl. secure storage).
      void electronApi.updateSettings({ xtream: undefined, rememberLogin: undefined });
      setXtreamCredentials({ serverUrl: "", username: "", password: "" });
      autoLoginTriedRef.current = true;
    }
    setScreen("start");
    setPortal(null);
    setChannels([]);
    setSeriesChannels([]);
    setEpisodeChannels([]);
    setLoadedSeries([]);
    setActiveChannelId(null);
    setActiveGroup("Alle kanalen");
    setQuery("");
    setStatus("Klaar");
  }

  async function playWithMpv(startSeconds?: number): Promise<void> {
    if (!activeChannel) {
      return;
    }

    const result = await electronApi.playWithMpv(activeChannel.url, startSeconds);
    setStatus(result.ok ? `MPV opent: ${activeChannel.name}` : result.error);
    setMpvAvailable(await electronApi.isMpvAvailable());
  }

  function toggleCountryVisibility(country: string): void {
    const preferences = removeCountryOverrides([country]);
    setCategoryPreferences(preferences);
    setHiddenCountries((current) => {
      const next = current.includes(country) ? current.filter((item) => item !== country) : [...current, country].sort();
      void electronApi.updateSettings({ hiddenCountries: next, categoryPreferences: preferences });
      return next;
    });
  }

  function removeCountryOverrides(countries: string[]): NonNullable<StoredSettings["categoryPreferences"]> {
    const next = { ...categoryPreferences };
    for (const target of ["live", "series", "movies"] as const) {
      const preferences = next[target];
      if (!preferences?.shown?.length) continue;
      const categories = portal ? target === "live" ? portal.liveCategories : target === "series" ? portal.seriesCategories : portal.vodCategories : [];
      const names = new Map(categories.map((item) => [`xtream:${item.category_id}`, item.category_name]));
      next[target] = { ...preferences, shown: preferences.shown.filter((key) => !countries.includes(countryCodeFromText(key.startsWith("m3u:") ? key.slice(4) : names.get(key) ?? "") ?? "")) };
    }
    return next;
  }

  function addRecentWatched(channel: Channel): void {
    const key = channel.favoriteKey ?? channel.id;
    const nextRecent = [
      channel,
      ...recentWatched.filter((item) => (item.favoriteKey ?? item.id) !== key)
    ].slice(0, 10);
    setRecentWatched(nextRecent);
    void electronApi.updateSettings({ recentWatched: nextRecent });
    if (activeGroup === "Recent bekeken") {
      setChannels(nextRecent.filter((item) => item.section === "live" && !isHiddenCountryGroup(item.group)));
    }
  }

  function visibleRecentWatched(): Channel[] {
    return recentWatched.filter((channel) => channel.section === "live" && !isHiddenCountryGroup(channel.group) && !isHiddenCategory(channel.group, channel.meta?.categoryId));
  }

  function isHiddenCountryGroup(group: string): boolean {
    const key = portal ? categoryKeyByName.get(group) : `m3u:${group}`;
    if (key && shownCategoryKeys.has(key)) return false;
    const code = countryCodeFromText(group);
    return Boolean(code && hiddenCountries.includes(code));
  }

  const errorPanel = errorDetails ? (
    <ErrorPanel
      title={errorDetails.title}
      diagnostics={errorDetails.diagnostics}
      onRetry={errorDetails.retry}
      onClose={() => setErrorDetails(null)}
    />
  ) : null;

  if (isTv && startupStage !== null) return <StartupScreen stage={startupStage} />;

  if (screen === "start") {
    return (
      <>
      <StartScreen
        credentials={xtreamCredentials}
        playlistUrl={playlistUrl}
        status={status}
        buildLabel={isTv ? ANDROID_TV_BUILD_ID : undefined}
        loadState={loadState}
        tvMode={isTv}
        rememberLogin={rememberLogin}
        onRememberLoginChange={setRememberLogin}
        onCredentialsChange={setXtreamCredentials}
        onPlaylistUrlChange={setPlaylistUrl}
        onXtreamLogin={loginXtream}
        onOpenFile={openFile}
        onLoadUrl={loadUrl}
      />
      {errorPanel}
      </>
    );
  }

  if (screen === "hub") {
    return (
      <>
      <SectionHub
        tvMode={isTv}
        liveCount={portal?.liveCategories.length ?? 0}
        seriesCount={portal?.seriesCategories.length ?? 0}
        moviesCount={portal?.vodCategories.length ?? 0}
        playlistLabel={playlistLabel}
        buildLabel={isTv ? ANDROID_TV_BUILD_ID : undefined}
        loading={loadState === "loading"}
        onSelect={(nextSection) => enterSection(nextSection)}
        onLogout={logout}
      />
      {errorPanel}
      </>
    );
  }

  if (isTv) {
    return (
      <>
        <TvLayout
          api={electronApi}
          channels={visibleChannels}
          categoryEntries={categoryEntries}
          categoryPreferences={currentCategoryPreferences}
          onSaveCategories={saveCategoryPreferences}
          groupsOverride={groupsOverride}
          activeGroup={activeGroup}
          activeChannel={activeChannel}
          programmeInfo={programmeInfo}
          favoriteKeys={favoriteKeys}
          section={section}
          activeSeriesName={activeSeriesName}
          viewingEpisodes={episodeChannels.length > 0}
          query={query}
          playlistUrl={playlistUrl}
          playlistLabel={playlistLabel}
          accountLabel={portal ? "Xtream Codes" : playlistLabel}
          status={status}
          buildLabel={ANDROID_TV_BUILD_ID}
          loadState={loadState}
          searching={loadingGroup === "search" && loadState === "loading"}
          hiddenCountries={hiddenCountries}
          recentChannels={recentChannels.filter((item) => !isHiddenCategory(item.group, item.meta?.categoryId))}
          listContext={`${session.current}:${section}:${activeGroup}:${activeSeriesName ?? ""}:${query}`}
          activeModal={activeModal}
          playbackState={nativePlayback}
          playbackError={nativeError}
          miniPlayerOccluded={activeModal !== null || errorDetails !== null}
          onOpenModal={setActiveModal}
          onOpenFile={openFile}
          onLoadUrl={loadUrl}
          onPlaylistUrlChange={setPlaylistUrl}
          onQueryChange={changeQuery}
          onSearch={searchCurrentSection}
          onToggleCountry={toggleCountryVisibility}
          onResetCountries={resetCountries}
          onHideAllCountries={hideAllCountries}
          onSelectGroup={selectGroup}
          onSelectChannel={selectChannel}
          onToggleFavorite={toggleFavorite}
          onBackToHub={() => {
            void stopTvPlayback();
            setScreen("hub");
          }}
          onBackToSeries={backToSeries}
          onRefresh={refreshCurrentGroup}
          onMiniPlayerActivate={() => void activateMiniPlayer()}
          onStopPlayback={() => void stopTvPlayback()}
          onSubtitles={async () => {
            const focus = captureTvFocus();
            try { await electronApi.showNativeSubtitles?.(); }
            catch { setStatus("Ondertiteling openen mislukt. Probeer opnieuw."); }
            requestAnimationFrame(() => restoreTvFocus(focus));
          }}
          onAudioTracks={async () => {
            const focus = captureTvFocus();
            try { await electronApi.showNativeAudioTracks?.(); }
            catch { setStatus("Audiotalen openen mislukt. Probeer opnieuw."); }
            requestAnimationFrame(() => restoreTvFocus(focus));
          }}
          onRetryPlayback={() => {
            if (activeChannel) {
              void playOnTv(activeChannel);
            }
          }}
          onErrorDetails={showNativeErrorDetails}
        />
        {errorPanel}
      </>
    );
  }

  return (
    <>
    <AppLayout
      channels={visibleChannels}
      categoryEntries={categoryEntries}
      categoryPreferences={currentCategoryPreferences}
      onSaveCategories={saveCategoryPreferences}
      groupsOverride={groupsOverride}
      activeGroup={activeGroup}
      activeChannel={activeChannel}
      programmeInfo={programmeInfo}
      favoriteKeys={favoriteKeys}
      section={section}
      activeSeriesName={activeSeriesName}
      viewingEpisodes={episodeChannels.length > 0}
      query={query}
      playlistLabel={playlistLabel}
      playlistUrl={playlistUrl}
      status={status}
      loadState={loadState}
      mpvAvailable={mpvAvailable}
      hiddenCountries={hiddenCountries}
      recentChannels={recentChannels.filter((item) => !isHiddenCategory(item.group, item.meta?.categoryId))}
      onOpenFile={openFile}
      onLoadUrl={loadUrl}
      onPlaylistUrlChange={setPlaylistUrl}
      onQueryChange={changeQuery}
      onSearch={searchCurrentSection}
      onToggleCountry={toggleCountryVisibility}
      onSelectGroup={selectGroup}
      onSelectChannel={selectChannel}
      onToggleFavorite={toggleFavorite}
      onBackToHub={() => setScreen("hub")}
      onBackToSeries={backToSeries}
      onPlayWithMpv={playWithMpv}
      onStatus={setStatus}
    />
    {errorPanel}
    </>
  );
}
