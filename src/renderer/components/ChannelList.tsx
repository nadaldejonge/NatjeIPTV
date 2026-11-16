import type { ReactElement } from "react";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { focusTv, focusZone } from "../lib/tvFocus";
import { navigationStep } from "../lib/tvKeyRepeat";
import { Play, Star } from "lucide-react";
import type { Channel } from "../types/channel";

const INITIAL_RENDER_COUNT = 90;
const RENDER_CHUNK_SIZE = 90;

type Props = {
  channels: Channel[];
  activeChannelId: string | null;
  favoriteKeys: Set<string>;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
  tvMode?: boolean;
  listContext?: string;
  loading?: boolean;
  showPartialWhileLoading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
};

export default function ChannelList({
  channels,
  activeChannelId,
  favoriteKeys,
  onSelectChannel,
  onToggleFavorite,
  tvMode = false, listContext = "desktop", loading = false, showPartialWhileLoading = false, loadError = false, onRetry
}: Props): ReactElement {
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_RENDER_COUNT);
  const listRef = useRef<HTMLElement>(null);
  const positions = useRef(new Map<string, { limit: number; top: number }>());
  const [tvWindow, setTvWindow] = useState({ context: listContext, limit: INITIAL_RENDER_COUNT });
  const tvLimit = tvWindow.context === listContext ? tvWindow.limit : positions.current.get(listContext)?.limit ?? INITIAL_RENDER_COUNT;
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!loading) { setShowSpinner(false); return; }
    const timer = window.setTimeout(() => setShowSpinner(true), 140);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useLayoutEffect(() => {
    if (!tvMode || (loading && !showPartialWhileLoading)) return;
    const element = listRef.current;
    if (element) element.scrollTop = positions.current.get(listContext)?.top ?? 0;
    return () => { if (element) {
      const previous = positions.current.get(listContext);
      positions.current.set(listContext, { limit: previous?.limit ?? INITIAL_RENDER_COUNT, top: previous?.top ?? element.scrollTop });
      if (positions.current.size > 24) positions.current.delete(positions.current.keys().next().value!);
    } };
  }, [listContext, tvMode, loading, showPartialWhileLoading]);

  useEffect(() => {
    if (tvMode) return;
    setVisibleLimit(Math.min(channels.length, INITIAL_RENDER_COUNT));
    listRef.current?.scrollTo({ top: 0 });
  }, [channels, tvMode]);

  const limit = tvMode ? tvLimit : visibleLimit;
  const visibleChannels = useMemo(() => channels.slice(0, limit), [channels, limit]);

  function loadMore(): void {
    if (tvMode) {
      if ((loading && !showPartialWhileLoading) || channels.length <= tvLimit) return;
      const next = Math.min(channels.length, tvLimit + RENDER_CHUNK_SIZE);
      positions.current.set(listContext, { limit: next, top: listRef.current?.scrollTop ?? 0 });
      setTvWindow({ context: listContext, limit: next }); return;
    }
    setVisibleLimit((current) => Math.min(channels.length, current + RENDER_CHUNK_SIZE));
  }

  return (
    <section
      className="channel-list"
      ref={listRef}
      data-tv-zone={tvMode ? "channels" : undefined}
      data-focus-context={tvMode ? listContext : undefined}
      aria-busy={loading}
      onKeyDownCapture={tvMode ? (event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        let row = (event.target as HTMLElement).closest<HTMLElement>("button.channel-row");
        if (!row) return;
        event.preventDefault(); event.stopPropagation();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const steps = navigationStep(event.nativeEvent);
        for (let i = 0; i < steps; i++) {
          let next = focusSiblingRow(row, direction);
          if (!next && direction === 1 && tvLimit < channels.length) {
            flushSync(loadMore); next = focusSiblingRow(row, direction);
          }
          if (!next) { if (direction === -1 && i === 0) focusZone("toolbar"); break; }
          row = next;
        }
        if (document.activeElement?.closest(".channel-list")) focusTv(row);
      } : undefined}
      onScroll={(event) => {
        const element = event.currentTarget;
        if (tvMode && (!loading || showPartialWhileLoading) && channels.length > 0) positions.current.set(listContext, { limit: tvLimit, top: element.scrollTop });
        if (element.scrollTop + element.clientHeight >= element.scrollHeight - 420) {
          loadMore();
        }
      }}
    >
      {loading && tvMode && !(showPartialWhileLoading && channels.length > 0) ? (
        <div className="tv-list-state" role="status" aria-label="Zenders laden">{showSpinner && <span className="tv-spinner" />}</div>
      ) : channels.length === 0 ? (
        <div className="empty-state">{loadError ? <>Laden mislukt. <button data-focus-key="list-retry" onClick={onRetry}>Opnieuw proberen</button></> : "Geen kanalen om te tonen"}</div>
      ) : (
        <>
          {visibleChannels.map((channel, index) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              index={index}
              active={channel.id === activeChannelId}
              favorite={favoriteKeys.has(channel.favoriteKey ?? channel.id)}
              onSelectChannel={onSelectChannel}
              onToggleFavorite={onToggleFavorite}
              tvMode={tvMode}
            />
          ))}
          {!tvMode && visibleLimit < channels.length && (
            <button className="channel-row channel-load-more" onClick={loadMore}>
              <div className="channel-logo">
                <Play size={16} />
              </div>
              <div className="channel-meta">
                <strong>Meer laden</strong>
                <span>
                  {visibleLimit} van {channels.length} getoond
                </span>
              </div>
              <em>+</em>
            </button>
          )}
        </>
      )}
    </section>
  );
}

const ChannelRow = memo(function ChannelRow({
  channel,
  index,
  active,
  favorite,
  onSelectChannel,
  onToggleFavorite,
  tvMode
}: {
  channel: Channel;
  index: number;
  active: boolean;
  favorite: boolean;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
  tvMode: boolean;
}): ReactElement {
  return (
    <button
      className={active ? "channel-row active" : "channel-row"}
      data-focus-key={tvMode ? `channel:${channel.id}` : undefined}
      data-channel-id={channel.id}
      aria-current={active ? "true" : undefined}
      onClick={() => onSelectChannel(channel)}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          const next = focusSiblingRow(event.currentTarget, event.key === "ArrowDown" ? 1 : -1);
          if (next) {
            event.preventDefault();
            event.stopPropagation();
            if (tvMode) focusTv(next);
            else { next.focus(); next.scrollIntoView({ block: "nearest" }); }
          }
          return;
        }
        if (event.key === "ArrowRight") {
          const miniPlayer = document.querySelector<HTMLElement>('[data-focus-id="mini-player"]');
          if (miniPlayer) {
            event.preventDefault();
            event.stopPropagation();
            miniPlayer.focus();
          }
        }
        if (tvMode && event.key === "ArrowLeft") {
          event.preventDefault(); event.stopPropagation(); focusZone("categories");
        }
        if (tvMode && (event.key === "ContextMenu" || event.key.toLowerCase() === "f")) {
          event.preventDefault(); event.stopPropagation(); onToggleFavorite(channel);
        }
      }}
      title={`${channel.name} - ${channel.group}`}
    >
      <div className="channel-logo"><Play size={16} />{channel.logo && <img src={channel.logo} alt="" onLoad={(event) => { event.currentTarget.style.display = ""; }} onError={(event) => { event.currentTarget.style.display = "none"; }} />}</div>
      <div className="channel-meta">
        <strong>{channel.name}</strong>
        <span>{channel.group}</span>
      </div>
      {channel.kind !== "series" && (
        <span
          className={favorite ? "favorite-button active" : "favorite-button"}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(channel);
          }}
          title="Favoriet"
        >
          <Star size={16} />
        </span>
      )}
      <em>{index + 1}</em>
    </button>
  );
});

function focusSiblingRow(current: HTMLElement, direction: 1 | -1): HTMLElement | null {
  let sibling: Element | null = direction === 1 ? current.nextElementSibling : current.previousElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLElement && sibling.matches("button.channel-row:not([disabled])")) {
      return sibling;
    }
    sibling = direction === 1 ? sibling.nextElementSibling : sibling.previousElementSibling;
  }
  return null;
}
