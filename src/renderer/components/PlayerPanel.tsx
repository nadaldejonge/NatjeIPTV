import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  Captions,
  ExternalLink,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Square,
  SunMedium,
  Volume2
} from "lucide-react";
import type { Channel } from "../types/channel";
import { attachStream, HlsAttachment, PlayerTrack } from "../lib/hlsPlayer";
import { getPlatform } from "../../platform";
import type { XtreamEpgListing } from "../../shared/xtream";
import { decodeEpgText } from "../../shared/epg";

const loadingMessages = ["Laden...", "Heb je al gedraaid?", "Je moet OF draaien OF dagga bro..."];

type Props = {
  channel: Channel | null;
  programmeInfo: XtreamEpgListing[];
  mpvAvailable: boolean;
  onPlayWithMpv: (startSeconds?: number) => void;
  onStatus: (value: string) => void;
};

export default function PlayerPanel({ channel, programmeInfo, mpvAvailable, onPlayWithMpv, onStatus }: Props): ReactElement {
  const electronApi = getPlatform();
  const panelRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachmentRef = useRef<HlsAttachment | null>(null);
  const [playerState, setPlayerState] = useState("Geen kanaal geselecteerd");
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [audioTracks, setAudioTracks] = useState<PlayerTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<PlayerTrack[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<number>(-1);
  const [selectedSubtitle, setSelectedSubtitle] = useState<number>(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenControlsVisible, setFullscreenControlsVisible] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [urlIndex, setUrlIndex] = useState(0);
  const [resolvedSubtitles, setResolvedSubtitles] = useState<Array<{ url: string; label: string; language: string }>>([]);
  const resumeTimeRef = useRef(0);
  const retryCountRef = useRef(0);
  const controlsTimerRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const canPlay = Boolean(channel?.url);
  const playbackUrls = channel?.url ? [channel.url, channel.meta?.fallbackUrl].filter((url): url is string => Boolean(url)) : [];
  const currentPlaybackUrl = playbackUrls[Math.min(urlIndex, Math.max(0, playbackUrls.length - 1))] ?? "";
  const isLoadingVideo = Boolean(channel) && (playerState.includes("Laden") || playerState.includes("Buffering"));
  const showAudioControls = canPlay && (channel?.kind === "episode" || channel?.kind === "series" || channel?.kind === "movie");
  const showSubtitleControls = canPlay;
  const useNativePlayer = electronApi.supportsNativePlayer;

  useEffect(() => {
    const onFullscreenChange = (): void => {
      const active = document.fullscreenElement === panelRef.current || document.fullscreenElement === videoRef.current;
      setIsFullscreen(active);
      setFullscreenControlsVisible(true);
      if (active) {
        scheduleControlsHide();
      } else if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
      if (clickTimerRef.current) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoadingVideo) {
      setLoadingTextIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingTextIndex((value) => (value + 1) % loadingMessages.length);
    }, 1550);
    return () => window.clearInterval(timer);
  }, [isLoadingVideo]);

  useEffect(() => {
    setUrlIndex(0);
  }, [channel?.id]);

  useEffect(() => {
    const sourceTracks = channel?.meta?.subtitles ?? [];
    const objectUrls: string[] = [];
    let cancelled = false;

    setResolvedSubtitles([]);
    if (sourceTracks.length === 0) {
      return () => undefined;
    }

    void Promise.all(
      sourceTracks.map(async (track, index) => {
        const loaded = await electronApi.loadSubtitle(track.url);
        const blobUrl = URL.createObjectURL(new Blob([loaded.content], { type: "text/vtt" }));
        objectUrls.push(blobUrl);
        return {
          url: blobUrl,
          label: track.label ?? `Ondertiteling ${index + 1}`,
          language: track.language ?? "und"
        };
      })
    )
      .then((tracks) => {
        if (!cancelled) {
          setResolvedSubtitles(tracks);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedSubtitles([]);
        }
      });

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [channel?.id, electronApi]);

  useEffect(() => {
    if (resolvedSubtitles.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      const tracks = Array.from(video.textTracks).map((track, index) => ({
        id: index,
        label: track.label || track.language || `Ondertiteling ${index + 1}`,
        language: track.language
      }));
      if (tracks.length > 0) {
        setSubtitleTracks(tracks);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [resolvedSubtitles]);

  useEffect(() => {
    const video = videoRef.current;
    if (!channel || !currentPlaybackUrl) {
      setPlayerState(channel?.kind === "series" ? "Open een serie om afleveringen te laden." : "Geen kanaal geselecteerd");
      return;
    }

    setHasError(false);
    retryCountRef.current = 0;
    setAudioTracks([]);
    setSubtitleTracks([]);
    setSelectedAudio(-1);
    setSelectedSubtitle(-1);
    setCurrentTime(0);
    setDuration(0);
    setIsPaused(true);
    setPlayerState("Laden...");
    if (useNativePlayer) {
      void electronApi
        .playNative?.({
          url: currentPlaybackUrl,
          title: channel.name,
          subtitle: channel.group,
          logo: channel.logo,
          isLive: channel.kind === "live",
          startPositionMs: resumeTimeRef.current > 2 ? Math.floor(resumeTimeRef.current * 1000) : undefined,
          fallbackUrls: channel.meta?.fallbackUrl ? [channel.meta.fallbackUrl] : undefined
        })
        .then((result) => {
          if (!result || result.ok) {
            setIsPaused(false);
            setPlayerState(`Speelt native: ${channel.name}`);
            return;
          }
          setHasError(true);
          setPlayerState(result.error);
          onStatus(result.error);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Native Android-player kon niet starten.";
          setHasError(true);
          setPlayerState(message);
          onStatus(message);
        });
      return;
    }

    if (!video) {
      return;
    }

    attachmentRef.current?.destroy();
    attachmentRef.current = attachStream(video, currentPlaybackUrl, {
      onError: (message) => {
        if (urlIndex < playbackUrls.length - 1) {
          setPlayerState("HLS variant niet beschikbaar, originele stream proberen...");
          setUrlIndex((value) => value + 1);
          return;
        }
        setHasError(true);
        setPlayerState(message);
        onStatus(message);
      },
      onTracks: (tracks) => {
        setAudioTracks(tracks.audioTracks);
        setSubtitleTracks(tracks.subtitleTracks);
        setSelectedAudio((current) => (current === -1 && tracks.audioTracks.length > 0 ? 0 : current));
      }
    });

    const onWaiting = (): void => setPlayerState("Buffering...");
    const onPlaying = (): void => {
      setIsPaused(false);
      setPlayerState(`Speelt: ${channel.name}`);
    };
    const onPause = (): void => setIsPaused(true);
    const onLoadedMetadata = (): void => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };
    const onTimeUpdate = (): void => {
      if (Number.isFinite(video.currentTime)) {
        resumeTimeRef.current = video.currentTime;
        setCurrentTime(video.currentTime);
      }
      if (Number.isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };
    const onStalled = (): void => retryPlayback("Stream hapert, opnieuw verbinden...");
    const onError = (): void => {
      setHasError(true);
      const message = video.currentSrc.includes(".ts")
        ? "Deze TS-stream heeft MPV nodig of een HLS (.m3u8) variant."
        : "Stream niet bereikbaar of niet ondersteund.";
      setPlayerState(message);
      onStatus(message);
      retryPlayback(message);
    };

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("error", onError);
    void video.play().catch(() => {
      setPlayerState("Klik op play om te starten.");
    });

    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("error", onError);
      attachmentRef.current?.destroy();
      attachmentRef.current = null;
    };
  }, [channel, currentPlaybackUrl, electronApi, onStatus, playbackUrls.length, reloadKey, urlIndex, useNativePlayer]);

  function play(): void {
    if (useNativePlayer) {
      void electronApi.resumeNative?.();
      setIsPaused(false);
      return;
    }
    void videoRef.current?.play();
  }

  function pause(): void {
    if (useNativePlayer) {
      void electronApi.pauseNative?.();
      setIsPaused(true);
      setPlayerState("Gepauzeerd");
      return;
    }
    videoRef.current?.pause();
    setPlayerState("Gepauzeerd");
  }

  function togglePlayPause(): void {
    const video = videoRef.current;
    if (!video || !canPlay) {
      return;
    }

    if (video.paused) {
      void video.play();
      return;
    }

    pause();
  }

  function stop(): void {
    if (useNativePlayer) {
      void electronApi.stopNative?.();
      setIsPaused(true);
      setPlayerState("Gestopt");
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.pause();
    video.currentTime = 0;
    setPlayerState("Gestopt");
  }

  function selectAudio(trackId: number): void {
    setSelectedAudio(trackId);
    attachmentRef.current?.setAudioTrack(trackId);
  }

  function selectSubtitle(trackId: number): void {
    setSelectedSubtitle(trackId);
    if (trackId === -1) {
      const video = videoRef.current;
      if (video) {
        Array.from(video.textTracks).forEach((track) => {
          track.mode = "disabled";
        });
      }
      attachmentRef.current?.setSubtitleTrack(-1);
      return;
    }
    attachmentRef.current?.setSubtitleTrack(trackId);
  }

  return (
    <section
      ref={panelRef}
      className={isFullscreen ? `player-panel fullscreen ${fullscreenControlsVisible ? "controls-visible" : "controls-hidden"}` : "player-panel"}
      onMouseMove={showFullscreenControls}
      onMouseDown={showFullscreenControls}
      onKeyDown={showFullscreenControls}
    >
      <div className="video-frame" onClick={handleVideoClick} onDoubleClick={handleVideoDoubleClick}>
        {canPlay && useNativePlayer ? (
          <div className="video-placeholder native-player-placeholder">
            Native Android TV-player actief
          </div>
        ) : canPlay ? (
          <video ref={videoRef} playsInline style={{ filter: `brightness(${brightness}%)` }}>
            {resolvedSubtitles.map((track, index) => (
              <track
                key={`${track.url}-${index}`}
                src={track.url}
                kind="subtitles"
                srcLang={track.language ?? "und"}
                label={track.label ?? `Ondertiteling ${index + 1}`}
              />
            ))}
          </video>
        ) : (
          <div className="video-placeholder">
            {channel?.kind === "series" ? "Selecteer een serie om afleveringen te openen" : "Laad een playlist en kies een kanaal"}
          </div>
        )}
        {isLoadingVideo && (
          <div className="video-loading">
            <div className="loading-spinner" />
            <strong>{loadingMessages[loadingTextIndex]}</strong>
          </div>
        )}
        {canPlay && (
          <div className="video-overlay-actions">
            <button onClick={handlePictureInPictureClick} title="Picture-in-picture" aria-label="Picture-in-picture">
              <PictureInPicture2 size={18} />
            </button>
            <button onClick={handleFullscreenClick} title="Fullscreen" aria-label="Fullscreen">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        )}
        {canPlay && (
          <div className="video-progress-overlay">
            <button className="video-click-hint" aria-label={isPaused ? "Afspelen" : "Pauzeren"}>
              {isPaused ? <Play size={20} /> : <Pause size={20} />}
            </button>
            <div className={duration > 0 ? "video-progress-track" : "video-progress-track live"}>
              <span style={{ width: duration > 0 ? `${Math.min(100, (currentTime / duration) * 100)}%` : "100%" }} />
            </div>
            <div className="video-progress-time">
              <span>{formatClock(currentTime)}</span>
              <span>{duration > 0 ? formatClock(duration) : "Live"}</span>
            </div>
          </div>
        )}
      </div>
      <div className="player-details">
        <div className="now-playing">
          <div>
            <span>Nu geselecteerd</span>
            <h2>{channel?.name ?? "Geen kanaal"}</h2>
            <p>{channel?.group ?? "Open een M3U of M3U8 playlist om te starten."}</p>
          </div>
          <div className={hasError ? "player-state error" : "player-state"}>{playerState}</div>
        </div>
        <div className="player-controls">
          <button className="icon-control" onClick={play} disabled={!canPlay} title="Play" aria-label="Play">
            <Play size={18} />
          </button>
          <button className="icon-control" onClick={pause} disabled={!canPlay} title="Pauze" aria-label="Pauze">
            <Pause size={18} />
          </button>
          <button className="icon-control" onClick={stop} disabled={!canPlay} title="Stop" aria-label="Stop">
            <Square size={18} />
          </button>
          <button
            className="icon-control"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={!canPlay}
            title="Herlaad stream"
            aria-label="Herlaad stream"
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="icon-control"
            onClick={() => onPlayWithMpv(resumeTimeRef.current)}
            disabled={!canPlay || !mpvAvailable || useNativePlayer}
            title="Open met MPV vanaf huidige positie"
            aria-label="Open met MPV vanaf huidige positie"
          >
            <ExternalLink size={18} />
          </button>
          <button className="icon-control" onClick={togglePictureInPicture} disabled={!canPlay} title="Picture-in-picture" aria-label="Picture-in-picture">
            <PictureInPicture2 size={18} />
          </button>
          <button className="icon-control" onClick={toggleFullscreen} disabled={!channel} title="Fullscreen" aria-label="Fullscreen">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        {(showAudioControls || showSubtitleControls) && (
          <div className="track-controls">
            <label className="brightness-control">
              <SunMedium size={16} />
              <input
                type="range"
                min="35"
                max="125"
                step="5"
                value={brightness}
                onChange={(event) => setBrightness(Number(event.target.value))}
                aria-label="Helderheid"
              />
              <span>{brightness}%</span>
            </label>
            {showAudioControls && (
              <label>
                <Volume2 size={16} />
                <select value={selectedAudio} disabled={audioTracks.length === 0} onChange={(event) => selectAudio(Number(event.target.value))}>
                  {audioTracks.length === 0 ? (
                    <option value={-1}>Standaard audio</option>
                  ) : (
                    audioTracks.map((track) => (
                      <option key={track.id} value={track.id}>
                        {track.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}
            {showSubtitleControls && (
              <label>
                <Captions size={16} />
                <select value={selectedSubtitle} disabled={subtitleTracks.length === 0} onChange={(event) => selectSubtitle(Number(event.target.value))}>
                  <option value={-1}>Ondertiteling uit</option>
                  {subtitleTracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        {programmeInfo.length > 0 && (
          <div className="programme-info">
            {programmeInfo.map((item, index) => (
              <div className={index === 0 ? "programme-card active" : "programme-card"} key={`${item.id ?? index}-${item.start ?? ""}`}>
                <strong>{decodeText(item.title ?? "Programma")}</strong>
                <span>{formatProgrammeTime(item)}</span>
                {item.description && <p>{decodeText(item.description)}</p>}
              </div>
            ))}
          </div>
        )}
        {channel?.meta?.plot && (
          <div className="media-info-card">
            <strong>{channel.kind === "episode" ? "Aflevering info" : "Info"}</strong>
            {(channel.meta.season || channel.meta.episode) && (
              <span>
                {channel.meta.season ? `Seizoen ${channel.meta.season}` : ""}
                {channel.meta.season && channel.meta.episode ? " · " : ""}
                {channel.meta.episode ? `Aflevering ${channel.meta.episode}` : ""}
              </span>
            )}
            <p>{channel.meta.plot}</p>
          </div>
        )}
        {!useNativePlayer && !mpvAvailable && <div className="mpv-note">MPV fallback niet beschikbaar</div>}
      </div>
    </section>
  );

  async function toggleFullscreen(): Promise<void> {
    const panel = panelRef.current;
    const video = videoRef.current;
    if (!panel) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    try {
      setFullscreenControlsVisible(true);
      await panel.requestFullscreen();
    } catch {
      setFullscreenControlsVisible(true);
      await requestVideoFullscreen(video);
    }
  }

  function handleVideoClick(event: MouseEvent<HTMLDivElement>): void {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
    }
    clickTimerRef.current = window.setTimeout(() => {
      togglePlayPause();
      clickTimerRef.current = null;
    }, 190);
  }

  function handleVideoDoubleClick(event: MouseEvent<HTMLDivElement>): void {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    void toggleFullscreen();
  }

  function handleFullscreenClick(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    void toggleFullscreen();
  }

  function handlePictureInPictureClick(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    void togglePictureInPicture();
  }

  async function togglePictureInPicture(): Promise<void> {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) {
      onStatus("Picture-in-picture niet beschikbaar voor deze stream.");
      return;
    }

    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
        return;
      }
      await video.requestPictureInPicture();
      onStatus("Picture-in-picture geopend");
    } catch {
      onStatus("Picture-in-picture kon niet worden geopend.");
    }
  }

  function showFullscreenControls(): void {
    if (!isFullscreen) {
      return;
    }
    setFullscreenControlsVisible(true);
    scheduleControlsHide();
  }

  function scheduleControlsHide(): void {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = window.setTimeout(() => {
      setFullscreenControlsVisible(false);
      controlsTimerRef.current = null;
    }, 2600);
  }

  function retryPlayback(message: string): void {
    const video = videoRef.current;
    if (!video || retryCountRef.current >= 2 || channel?.kind === "live") {
      return;
    }

    const resumeAt = resumeTimeRef.current;
    retryCountRef.current += 1;
    setPlayerState(message);
    window.setTimeout(() => {
      setReloadKey((value) => value + 1);
      window.setTimeout(() => {
        const nextVideo = videoRef.current;
        if (nextVideo && resumeAt > 2) {
          try {
            nextVideo.currentTime = Math.max(0, resumeAt - 1);
          } catch {
            // Some HLS/VOD manifests do not allow immediate seeking until metadata is ready.
          }
        }
      }, 900);
    }, 700);
  }
}

function decodeText(value: string): string {
  return decodeEpgText(value);
}

function formatProgrammeTime(item: XtreamEpgListing): string {
  const start = formatTimestamp(item.start_timestamp) || item.start || "";
  const end = formatTimestamp(item.stop_timestamp) || item.end || "";
  return [start, end].filter(Boolean).join(" - ");
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return "";
  }
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  return new Date(timestamp * 1000).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function formatClock(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function requestVideoFullscreen(video: HTMLVideoElement | null): Promise<void> {
  if (!video) {
    return;
  }

  const fullscreenVideo = video as HTMLVideoElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };

  if (fullscreenVideo.requestFullscreen) {
    await fullscreenVideo.requestFullscreen();
    return;
  }

  if (fullscreenVideo.webkitRequestFullscreen) {
    await fullscreenVideo.webkitRequestFullscreen();
    return;
  }

  if (fullscreenVideo.msRequestFullscreen) {
    await fullscreenVideo.msRequestFullscreen();
  }
}
