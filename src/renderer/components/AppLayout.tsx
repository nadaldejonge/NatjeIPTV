import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { ArrowLeft, ListFilter } from "lucide-react";
import type { Channel } from "../types/channel";
import type { XtreamEpgListing } from "../../shared/xtream";
import PlaylistImport from "./PlaylistImport";
import SearchBar from "./SearchBar";
import GroupSidebar from "./GroupSidebar";
import ChannelList from "./ChannelList";
import PlayerPanel from "./PlayerPanel";
import StatusBar from "./StatusBar";
import BrandImage from "./BrandImage";
import { countryCodeFromText } from "../lib/countryGroups";
import { matchesSearch, orderCategories, type CategoryEntry } from "../lib/categoryPreferences";
import type { CategoryPreferences } from "../../shared/settings";
import CategoryManager from "./CategoryManager";

type Props = {
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
  playlistLabel: string;
  playlistUrl: string;
  status: string;
  loadState: "idle" | "loading" | "ready" | "error";
  mpvAvailable: boolean;
  hiddenCountries: string[];
  recentChannels: Channel[];
  onOpenFile: () => void;
  onLoadUrl: () => void;
  onPlaylistUrlChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onToggleCountry: (country: string) => void;
  onSelectGroup: (group: string) => void;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
  onBackToHub: () => void;
  onBackToSeries: () => void;
  onPlayWithMpv: (startSeconds?: number) => void;
  onStatus: (value: string) => void;
};

export default function AppLayout(props: Props): ReactElement {
  const [managingCategories, setManagingCategories] = useState(false);
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
    for (const code of props.hiddenCountries) codes.add(code);
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
      ...(props.section === "live" && props.recentChannels.length > 0 ? [{ name: "Recent bekeken", count: props.recentChannels.length }] : []),
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
        props.activeGroup === "Recent bekeken" || props.groupsOverride ? true : props.activeGroup === allLabel || channel.group === props.activeGroup;
      const matchesQuery = matchesSearch(channel.name, channel.group, normalizedQuery);
      return matchesGroup && matchesQuery;
    });
  }, [props.channels, props.activeGroup, props.groupsOverride, props.query, props.recentChannels, props.section, props.viewingEpisodes]);

  return (
    <div className="app-shell">
      <main className={props.section !== "live" || props.viewingEpisodes ? "workspace has-breadcrumb" : "workspace"}>
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <BrandImage />
            </div>
            <div>
              <h1>Natje&apos;s IPTV-player</h1>
              <span>{props.viewingEpisodes ? props.activeSeriesName : props.section === "series" ? "Series" : props.section === "movies" ? "Films" : "Live TV"}</span>
            </div>
          </div>
          <PlaylistImport
            playlistUrl={props.playlistUrl}
            playlistLabel={props.playlistLabel}
            loadState={props.loadState}
            onOpenFile={props.onOpenFile}
            onLoadUrl={props.onLoadUrl}
            onPlaylistUrlChange={props.onPlaylistUrlChange}
          />
        </header>

        <SearchBar
          value={props.query}
          onChange={props.onQueryChange}
          onSearch={props.onSearch}
          total={filteredChannels.length}
          isLoading={props.loadState === "loading"}
          scopeLabel={props.section === "series" ? "series" : props.section === "movies" ? "films" : "zenders"}
          countries={countryOptions}
          hiddenCountries={props.hiddenCountries}
          onToggleCountry={props.onToggleCountry}
        />

        {props.section !== "live" && (
          <div className="breadcrumb-bar">
            <button onClick={props.viewingEpisodes ? props.onBackToSeries : props.onBackToHub}>
              <ArrowLeft size={17} />
              {props.viewingEpisodes ? "Terug naar series" : "Terug naar keuze"}
            </button>
            <span>{props.viewingEpisodes ? props.activeSeriesName : props.section === "movies" ? "Films overzicht" : "Series overzicht"}</span>
          </div>
        )}

        <section className="content-grid">
          {props.loadState === "loading" && (
            <div className="content-loading">
              <span />
              <span />
              <span />
            </div>
          )}
          <div className="desktop-categories">
            <button className="category-manage-button" onClick={() => setManagingCategories(true)}><ListFilter size={16} /> Categorieën beheren</button>
            <GroupSidebar groups={groups} activeGroup={props.activeGroup} onSelectGroup={props.onSelectGroup} />
          </div>
          <ChannelList
            channels={filteredChannels}
            activeChannelId={props.activeChannel?.id ?? null}
            favoriteKeys={props.favoriteKeys}
            onSelectChannel={props.onSelectChannel}
            onToggleFavorite={props.onToggleFavorite}
          />
          <PlayerPanel
            channel={props.activeChannel}
            programmeInfo={props.programmeInfo}
            mpvAvailable={props.mpvAvailable}
            onPlayWithMpv={props.onPlayWithMpv}
            onStatus={props.onStatus}
          />
        </section>

        <StatusBar
          status={props.status}
          channelCount={props.channels.length}
          mpvAvailable={props.mpvAvailable}
          playlistLabel={props.playlistLabel}
        />
      </main>
      {managingCategories && <CategoryManager categories={props.categoryEntries} preferences={props.categoryPreferences}
        sectionLabel={props.section === "live" ? "Live TV" : props.section === "movies" ? "Films" : "Series"}
        onSave={props.onSaveCategories} onClose={() => setManagingCategories(false)} />}
    </div>
  );
}

