import type { ReactElement } from "react";
import { HardDrive, ListVideo } from "lucide-react";

type Props = {
  status: string;
  channelCount: number;
  mpvAvailable: boolean;
  playlistLabel: string;
};

export default function StatusBar({ status, channelCount, mpvAvailable, playlistLabel }: Props): ReactElement {
  return (
    <footer className="status-bar">
      <span>{status}</span>
      <span title={playlistLabel}>
        <ListVideo size={15} />
        {channelCount} kanalen
      </span>
      <span>
        <HardDrive size={15} />
        MPV {mpvAvailable ? "beschikbaar" : "niet beschikbaar"}
      </span>
    </footer>
  );
}
