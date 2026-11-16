import type { ReactElement } from "react";
import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, FolderOpen, Globe, Heart, Link as LinkIcon, RefreshCw, Search, ListFilter } from "lucide-react";
import type { Channel } from "../types/channel";
import type { XtreamEpgListing } from "../../shared/xtream";
import type { PlatformApi } from "../../platform";
import GroupSidebar from "./GroupSidebar";
import ChannelList from "./ChannelList";
import TvModal from "./TvModal";
import TvMiniPlayer from "./TvMiniPlayer";
import TvTextInput from "./TvTextInput";
import type { NativePlaybackState } from "./TvMiniPlayer";
import { focusZone } from "../lib/tvFocus";
import { normalizeEpg, programmeWindow } from "../../shared/epg";
import BrandImage from "./BrandImage";
import { countryCodeFromText } from "../lib/countryGroups";
import { matchesSearch, orderCategories, type CategoryEntry } from "../lib/categoryPreferences";
import type { CategoryPreferences } from "../../shared/settings";
import CategoryManager from "./CategoryManager";

export type TvModalKind = "search" | "playlist" | "countries" | "programme" | "categories" | null;

type Props = {
  api: PlatformApi;
  listContext: string;
  channels: Channel[];
  groupsOverride?: Array<{ name: string; count?: number; loading?: boolean }>;
  activeGroup: string;
  activeChannel: Channel | null;
  programmeInfo: XtreamEpgListing[];
  favoriteKeys: Set<string>;
  section: "live" | "series" | "movies";
  categoryEntries: CategoryEntry[];
  categoryPreferences: CategoryPreferences;
  onSaveCategories: (preferences: CategoryPreferences) => Promise<void>;
  activeSeriesName: string | null;
  viewingEpisodes: boolean;
  query: string;
  playlistUrl: string;
  playlistLabel: string;
  accountLabel: string;
  status: string;
  buildLabel: string;
  loadState: "idle" | "loading" | "ready" | "error";
  searching: boolean;
  hiddenCountries: string[];
  recentChannels: Channel[];
  activeModal: TvModalKind;
  playbackState: NativePlaybackState;
  playbackError: string | null;
  miniPlayerOccluded: boolean;
  onOpenModal: (modal: TvModalKind) => void;
  onOpenFile: () => void;
  onLoadUrl: () => void;
  onPlaylistUrlChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onSearch: (value?: string) => void;
  onToggleCountry: (country: string) => void;
  onResetCountries: () => void;
  onHideAllCountries: (countries: string[]) => void;
  onSelectGroup: (group: string) => void;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
  onBackToHub: () => void;
  onBackToSeries: () => void;
  onRefresh: () => void;
  onMiniPlayerActivate: () => void;
  onStopPlayback: () => void;
  onSubtitles: () => void;
  onAudioTracks: () => void;
  onRetryPlayback: () => void;
  onErrorDetails: () => void;
};

export default function TvLayout(props: Props): ReactElement {
  const searchForm = useRef<HTMLFormElement>(null);
  const submitSearch = () => props.onSearch(searchForm.current?.querySelector<HTMLInputElement>("input")?.value ?? props.query);
  useEffect(() => { focusZone("categories"); }, []);
  const programmes = useMemo(() => normalizeEpg(props.programmeInfo), [props.programmeInfo]);
  const currentProgramme = programmeWindow(programmes).current;
  const hiddenCountrySet = useMemo(() => new Set(props.hiddenCountries), [props.hiddenCountries]);
  const countryHiddenGroups = useMemo(() => new Set(props.categoryEntries.filter((item) => item.countryHidden && !props.categoryPreferences.shown?.includes(item.key)).map((item) => item.name)), [props.categoryEntries, props.categoryPreferences.shown]);

  const countryOptions = useMemo(() => {
    const codes = new Set<string>();
    const sourceGroups = props.categoryEntries.map((group) => group.name);
    for (const group of sourceGroups) {
      const code = countryCodeFromText(group);
      if (code && group !== "Favorieten") {
        codes.add(code);
      }
    }
    for (const code of props.hiddenCountries) {
      codes.add(code);
    }
    return Array.from(codes).sort((a, b) => a.localeCompare(b));
  }, [props.categoryEntries, props.hiddenCountries]);

  const groups = useMemo(() => {
    if (props.groupsOverride) {
      return props.groupsOverride.filter((group) => {
        return !countryHiddenGroups.has(group.name);
      });
    }
    const counts = new Map<string, number>();
    for (const channel of props.channels) {
      counts.set(channel.group, (counts.get(channel.group) ?? 0) + 1);
    }
    const allLabel = props.viewingEpisodes ? "Alle afleveringen" : props.section === "series" ? "Alle series" : props.section === "movies" ? "Alle films" : "Alle kanalen";
    return [
      { name: allLabel, count: props.channels.length },
      ...(props.section === "live" && props.recentChannels.length > 0
        ? [{ name: "Recent bekeken", count: props.recentChannels.length }]
        : []),
      ...orderCategories(Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .filter(([name]) => {
          return !countryHiddenGroups.has(name);
        })
        .map(([name, count]) => ({ name, count, key: `m3u:${name}` })).filter((item) => !props.categoryPreferences.hidden.includes(item.key)), props.categoryPreferences.order)
    ];
  }, [props.channels, props.groupsOverride, countryHiddenGroups, props.recentChannels, props.section, props.viewingEpisodes, props.categoryPreferences]);

  const filteredChannels = useMemo(() => {
    const normalizedQuery = props.query.trim().toLowerCase();
    const allLabel = props.viewingEpisodes ? "Alle afleveringen" : props.section === "series" ? "Alle series" : props.section === "movies" ? "Alle films" : "Alle kanalen";
    const sourceChannels = props.activeGroup === "Recent bekeken" ? props.recentChannels : props.channels;
    return sourceChannels.filter((channel) => {
      const matchesGroup =
        props.activeGroup === "Recent bekeken" || props.groupsOverride
          ? true
          : props.activeGroup === allLabel || channel.group === props.activeGroup;
      const matchesQuery = matchesSearch(channel.name, channel.group, normalizedQuery);
      return matchesGroup && matchesQuery;
    });
  }, [props.channels, props.activeGroup, props.groupsOverride, props.query, props.recentChannels, props.section, props.viewingEpisodes, hiddenCountrySet]);

  return (
    <div className="app-shell tv-shell">
      <main className="tv-workspace">
        <header className="tv-toolbar" data-tv-zone="toolbar">
          <div className="tv-toolbar-brand">
            <BrandImage />
            <span>
              {props.viewingEpisodes ? props.activeSeriesName : props.section === "series" ? "Series" : props.section === "movies" ? "Films" : "Live TV"}
              <em className="tv-build-badge">{props.buildLabel}</em>
              {props.accountLabel && <em className="tv-account-label"> · {props.accountLabel}</em>}
            </span>
          </div>
          {(props.section !== "live" || props.viewingEpisodes) && (
            <button data-focus-key="toolbar-back" onClick={props.viewingEpisodes ? props.onBackToSeries : props.onBackToHub}>
              <ArrowLeft size={16} />
              {props.viewingEpisodes ? "Series" : "Keuze"}
            </button>
          )}
          <button data-focus-key="toolbar-search" onClick={() => props.onOpenModal("search")}>
            <Search size={16} />
            Zoeken
          </button>
          <button data-focus-key="toolbar-playlist" onClick={() => props.onOpenModal("playlist")}>
            <FolderOpen size={16} />
            Playlist
          </button>
          <button data-focus-key="toolbar-countries" onClick={() => props.onOpenModal("countries")}>
            <Globe size={16} />
            Landen
          </button>
          <button data-focus-key="toolbar-categories" onClick={() => props.onOpenModal("categories")}>
            <ListFilter size={16} /> Categorieën
          </button>
          <button data-focus-key="toolbar-favorites" onClick={() => props.onSelectGroup("Favorieten")}>
            <Heart size={16} />
            Favorieten
          </button>
          <button data-focus-key="toolbar-refresh" onClick={props.onRefresh} aria-disabled={props.loadState === "loading"}>
            <RefreshCw size={16} className={props.loadState === "loading" ? "spin" : undefined} />
            Verversen
          </button>
        </header>

        <section className="tv-content-grid">
          <div className="tv-list-panel"><h2>Categorieën <span>{groups.length}</span></h2>
          <GroupSidebar tvMode groups={groups} activeGroup={props.activeGroup} onSelectGroup={props.onSelectGroup} />
          </div>
          <div className="tv-list-panel"><h2>{props.viewingEpisodes ? "Afleveringen" : props.section === "series" ? "Series" : props.section === "movies" ? "Films" : "Zenders"} <span>{filteredChannels.length}</span></h2>
          <ChannelList
            tvMode listContext={props.listContext} loading={props.loadState === "loading"} showPartialWhileLoading={props.searching} loadError={props.loadState === "error"} onRetry={props.onRefresh}
            channels={filteredChannels}
            activeChannelId={props.activeChannel?.id ?? null}
            favoriteKeys={props.favoriteKeys}
            onSelectChannel={props.onSelectChannel}
            onToggleFavorite={props.onToggleFavorite}
          />
          </div>
          <TvMiniPlayer
            api={props.api}
            channel={props.activeChannel}
            playbackState={props.playbackState}
            errorMessage={props.playbackError}
            programmeInfo={props.programmeInfo}
            occluded={props.miniPlayerOccluded}
            onActivate={props.onMiniPlayerActivate}
            onStop={props.onStopPlayback}
            onSubtitles={props.onSubtitles}
            onAudioTracks={props.onAudioTracks}
            onRetry={props.onRetryPlayback}
            onErrorDetails={props.onErrorDetails}
            onProgrammeDetails={() => props.onOpenModal("programme")}
            onFavorite={() => { if (props.activeChannel) props.onToggleFavorite(props.activeChannel); }}
            favorite={Boolean(props.activeChannel && props.favoriteKeys.has(props.activeChannel.favoriteKey ?? props.activeChannel.id))}
          />
        </section>

        <footer className="tv-status-bar"><span>{props.status}</span><span>{props.channels.length} items</span></footer>
      </main>

      {props.activeModal === "search" && (
        <TvModal title="Zoeken" onClose={() => props.onOpenModal(null)}>
          <p className="tv-modal-hint">Zoekt op titel én categorie in alle zichtbare categorieën van dit onderdeel. OK op het veld opent het toetsenbord.</p>
          <form className="tv-search-form" ref={searchForm} onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
          <TvTextInput
            value={props.query}
            onChange={props.onQueryChange}
            name="query"
            enterKeyHint="search"
            placeholder={props.section === "series" ? "Series zoeken…" : props.section === "movies" ? "Films zoeken…" : "Zenders zoeken…"}
            onSubmit={props.onSearch}
          />
          <div className="tv-modal-actions">
            <button type="submit">
              <Search size={16} /> Zoeken
            </button>
            <button type="button" onClick={() => props.onQueryChange("")}>Wissen</button>
            <button type="button" onClick={() => props.onOpenModal(null)}>Sluiten</button>
          </div>
          </form>
          <div className="tv-search-feedback" role="status" aria-live="polite">
            {props.searching && <span className="tv-spinner" aria-hidden="true" />}
            <span>{props.searching ? props.status : props.loadState === "error" ? props.status : props.activeGroup.startsWith("Zoeken:") ? props.status : "Typ een zoekterm en druk op Zoeken."}</span>
          </div>
          <div className="tv-search-results">
            {filteredChannels.slice(0, 50).map((channel) => (
              <button
                key={channel.id}
                className="tv-search-result"
                onClick={() => {
                  props.onOpenModal(null);
                  void props.onSelectChannel(channel);
                }}
              >
                <span>{channel.name}</span>
                <em>{channel.group}</em>
              </button>
            ))}
            {filteredChannels.length > 50 && (
              <span className="tv-modal-label">{filteredChannels.length - 50} extra resultaten — verfijn de zoekterm of sluit om de volledige lijst te zien.</span>
            )}
          </div>
        </TvModal>
      )}

      {props.activeModal === "categories" && <CategoryManager tvMode categories={props.categoryEntries} preferences={props.categoryPreferences}
        sectionLabel={props.section === "live" ? "Live TV" : props.section === "movies" ? "Films" : "Series"}
        onSave={props.onSaveCategories} onClose={() => props.onOpenModal(null)} />}

      {props.activeModal === "programme" && (
        <TvModal title={props.activeChannel?.name ?? "Programma-informatie"} onClose={() => props.onOpenModal(null)}>
          <div className="tv-programme-detail" tabIndex={0} data-focus-key="programme-scroll" aria-label="Programma-informatie scrollen">
            {programmes.map((item) => (
              <article className="tv-programme-card" key={`${item.id}:${item.start ?? item.title}`}>
                <span>{currentProgramme === item ? "Nu · " : ""}{item.timeLabel || "Tijd niet beschikbaar"}</span>
                <h3>{item.title || "Programma"}</h3><p>{item.description || "Geen beschrijving beschikbaar."}</p>
              </article>
            ))}
            {props.programmeInfo.length === 0 && <p>{props.activeChannel?.meta?.plot || "Geen programma-informatie beschikbaar voor deze zender."}</p>}
          </div>
        </TvModal>
      )}

      {props.activeModal === "playlist" && (
        <TvModal title="Playlist openen" onClose={() => props.onOpenModal(null)}>
          <p className="tv-modal-hint">De huidige stream blijft spelen totdat een nieuwe playlist is geladen.</p>
          <span className="tv-modal-label">Huidige bron: {props.playlistLabel}</span>
          <TvTextInput
            value={props.playlistUrl}
            onChange={props.onPlaylistUrlChange}
            placeholder="https://voorbeeld.nl/playlist.m3u8"
            onSubmit={() => {
              props.onLoadUrl();
              props.onOpenModal(null);
            }}
          />
          <div className="tv-modal-actions">
            <button
              onClick={() => {
                props.onLoadUrl();
                props.onOpenModal(null);
              }}
            >
              <LinkIcon size={16} /> URL laden
            </button>
            <button
              onClick={() => {
                props.onOpenModal(null);
                props.onOpenFile();
              }}
            >
              <FolderOpen size={16} /> Bestand
            </button>
            <button onClick={() => props.onOpenModal(null)}>Sluiten</button>
          </div>
        </TvModal>
      )}

      {props.activeModal === "countries" && (
        <TvModal title="Landenfilter" onClose={() => props.onOpenModal(null)}>
          <p className="tv-modal-hint">Zet landen uit om ze te verbergen. Wijzigingen gelden direct; de video speelt door.</p>
          <div className="tv-country-list">
            {countryOptions.length === 0 && <span className="tv-modal-label">Geen landcodes gevonden in de groepen.</span>}
            {countryOptions.map((country) => {
              const hidden = hiddenCountrySet.has(country);
              return (
                <button
                  key={country}
                  className={hidden ? "tv-country hidden" : "tv-country"}
                  onClick={() => props.onToggleCountry(country)}
                >
                  <span>{country}</span>
                  <em>{hidden ? "Uit" : "Aan"}</em>
                </button>
              );
            })}
          </div>
          <div className="tv-modal-actions">
            <button onClick={() => props.onOpenModal(null)}>Toepassen</button>
            <button onClick={() => props.onHideAllCountries(countryOptions)}>Alles uit</button>
            <button onClick={props.onResetCountries}>Reset</button>
            <button onClick={() => props.onOpenModal(null)}>Sluiten</button>
          </div>
        </TvModal>
      )}
    </div>
  );
}

