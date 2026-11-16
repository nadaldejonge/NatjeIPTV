import Hls from "hls.js";

export type PlayerTrack = {
  id: number;
  label: string;
  language?: string;
};

export type HlsAttachment = {
  destroy: () => void;
  setAudioTrack: (trackId: number) => void;
  setSubtitleTrack: (trackId: number) => void;
};

type NativeAudioTrack = {
  id?: string;
  label?: string;
  language?: string;
  enabled: boolean;
};

type NativeAudioTrackList = {
  length: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
  [index: number]: NativeAudioTrack;
};

type VideoWithNativeTracks = HTMLVideoElement & {
  audioTracks?: NativeAudioTrackList;
};

type AttachOptions = {
  onError: (message: string) => void;
  onTracks?: (tracks: { audioTracks: PlayerTrack[]; subtitleTracks: PlayerTrack[] }) => void;
};

export function attachStream(video: HTMLVideoElement, url: string, options: AttachOptions): HlsAttachment {
  const canPlayNative = video.canPlayType("application/vnd.apple.mpegurl") !== "";
  const looksLikeHls = /\.m3u8($|\?)/i.test(url) || url.includes("m3u8");

  if (looksLikeHls && Hls.isSupported()) {
    const hls = new Hls({
      lowLatencyMode: true,
      enableWorker: true
    });

    const emitTracks = (): void => {
      options.onTracks?.({
        audioTracks: hls.audioTracks.map((track, index) => ({
          id: index,
          label: track.name || track.lang || `Audio ${index + 1}`,
          language: track.lang
        })),
        subtitleTracks: hls.subtitleTracks.map((track, index) => ({
          id: index,
          label: track.name || track.lang || `Ondertiteling ${index + 1}`,
          language: track.lang
        }))
      });
    };

    hls.on(Hls.Events.MANIFEST_PARSED, emitTracks);
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, emitTracks);
    hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, emitTracks);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        options.onError(`HLS fout: ${data.details}`);
      }
    });

    hls.loadSource(url);
    hls.attachMedia(video);

    return {
      destroy: () => hls.destroy(),
      setAudioTrack: (trackId) => {
        hls.audioTrack = trackId;
      },
      setSubtitleTrack: (trackId) => {
        hls.subtitleTrack = trackId;
      }
    };
  }

  if (canPlayNative || !looksLikeHls) {
    video.src = url;
    const nativeVideo = video as VideoWithNativeTracks;
    const emitNativeTracks = (): void => {
      const nativeAudioTracks = Array.from({ length: nativeVideo.audioTracks?.length ?? 0 }, (_value, index) => {
        const track = nativeVideo.audioTracks?.[index];
        return {
          id: index,
          label: track?.label || track?.language || `Audio ${index + 1}`,
          language: track?.language
        };
      });

      options.onTracks?.({
        audioTracks: nativeAudioTracks,
        subtitleTracks: Array.from(video.textTracks).map((track, index) => ({
          id: index,
          label: track.label || track.language || `Ondertiteling ${index + 1}`,
          language: track.language
        }))
      });
    };
    video.textTracks.addEventListener?.("change", emitNativeTracks);
    nativeVideo.audioTracks?.addEventListener?.("change", emitNativeTracks);
    video.addEventListener("loadedmetadata", emitNativeTracks);
    video.addEventListener("loadeddata", emitNativeTracks);
    return {
      destroy: () => {
        video.removeEventListener("loadedmetadata", emitNativeTracks);
        video.removeEventListener("loadeddata", emitNativeTracks);
        nativeVideo.audioTracks?.removeEventListener?.("change", emitNativeTracks);
        video.removeAttribute("src");
        video.load();
      },
      setAudioTrack: (trackId) => {
        const tracks = nativeVideo.audioTracks;
        if (!tracks) {
          return;
        }
        for (let index = 0; index < tracks.length; index += 1) {
          tracks[index].enabled = index === trackId;
        }
      },
      setSubtitleTrack: (trackId) => {
        Array.from(video.textTracks).forEach((track, index) => {
          track.mode = index === trackId ? "showing" : "disabled";
        });
      }
    };
  }

  options.onError("Deze HLS-stream wordt niet ondersteund door de ingebouwde player.");
  return {
    destroy: () => undefined,
    setAudioTrack: () => undefined,
    setSubtitleTrack: () => undefined
  };
}
