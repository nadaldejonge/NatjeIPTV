import { app } from "electron";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let mpvProcess: ChildProcessWithoutNullStreams | null = null;

function getMpvPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "mpv", "mpv.exe");
  }

  return path.join(process.cwd(), "public", "mpv", "mpv.exe");
}

export function isMpvAvailable(): boolean {
  return fs.existsSync(getMpvPath());
}

export function stopMpv(): void {
  if (mpvProcess && !mpvProcess.killed) {
    mpvProcess.kill();
  }
  mpvProcess = null;
}

export function playWithMpv(url: string, startSeconds?: number): { ok: true } | { ok: false; error: string } {
  if (!isMpvAvailable()) {
    return { ok: false, error: "MPV fallback niet beschikbaar" };
  }

  stopMpv();

  try {
    const args = [
      "--force-window=yes",
      "--resume-playback=yes",
      "--save-position-on-quit=yes",
      "--keep-open=no",
      ...(typeof startSeconds === "number" && Number.isFinite(startSeconds) && startSeconds > 2
        ? [`--start=${Math.max(0, Math.floor(startSeconds - 1))}`]
        : []),
      url
    ];

    mpvProcess = spawn(getMpvPath(), args, {
      windowsHide: false,
      stdio: "pipe"
    });

    mpvProcess.once("exit", () => {
      mpvProcess = null;
    });

    mpvProcess.once("error", (error) => {
      console.error("MPV failed:", error);
      mpvProcess = null;
    });

    return { ok: true };
  } catch (error) {
    mpvProcess = null;
    return {
      ok: false,
      error: error instanceof Error ? error.message : "MPV kon niet worden gestart"
    };
  }
}
