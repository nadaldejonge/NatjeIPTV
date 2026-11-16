import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type { StoredSettings } from "../shared/settings.js";

export type { StoredSettings } from "../shared/settings.js";

const settingsFile = (): string => path.join(app.getPath("userData"), "settings.json");

export async function readSettings(): Promise<StoredSettings> {
  try {
    const raw = await fs.readFile(settingsFile(), "utf8");
    return JSON.parse(raw) as StoredSettings;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return {};
    }
    console.warn("Could not read settings:", error);
    return {};
  }
}

export async function writeSettings(settings: StoredSettings): Promise<StoredSettings> {
  await fs.mkdir(path.dirname(settingsFile()), { recursive: true });
  await fs.writeFile(settingsFile(), JSON.stringify(settings, null, 2), "utf8");
  return settings;
}

export async function updateSettings(patch: Partial<StoredSettings>): Promise<StoredSettings> {
  const current = await readSettings();
  return writeSettings({ ...current, ...patch });
}
