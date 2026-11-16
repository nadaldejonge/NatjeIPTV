import type { ReactElement } from "react";
import { FolderOpen, Link, Loader2 } from "lucide-react";

type Props = {
  playlistUrl: string;
  playlistLabel: string;
  loadState: "idle" | "loading" | "ready" | "error";
  onOpenFile: () => void;
  onLoadUrl: () => void;
  onPlaylistUrlChange: (value: string) => void;
};

export default function PlaylistImport(props: Props): ReactElement {
  const isLoading = props.loadState === "loading";

  return (
    <div className={isLoading ? "import-panel loading" : "import-panel"}>
      <div className="playlist-name" title={props.playlistLabel}>
        {isLoading ? <Loader2 className="spin" size={16} /> : <Link size={16} />}
        <span>{props.playlistLabel}</span>
      </div>
      <div className="import-actions">
        <button onClick={props.onOpenFile} disabled={isLoading} title="Open M3U/M3U8 bestand">
          <FolderOpen size={18} />
          Bestand
        </button>
        <input
          value={props.playlistUrl}
          onChange={(event) => props.onPlaylistUrlChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              props.onLoadUrl();
            }
          }}
          disabled={isLoading}
          placeholder="https://voorbeeld.nl/playlist.m3u8"
        />
        <button onClick={props.onLoadUrl} disabled={isLoading} title="Laad URL">
          {isLoading ? <Loader2 className="spin" size={18} /> : <Link size={18} />}
          {isLoading ? "Laden" : "URL"}
        </button>
      </div>
    </div>
  );
}
