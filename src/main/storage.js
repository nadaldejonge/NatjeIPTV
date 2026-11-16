import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
export async function readSettings() {
    try {
        const raw = await fs.readFile(settingsFile(), "utf8");
        return JSON.parse(raw);
    }
    catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
            return {};
        }
        console.warn("Could not read settings:", error);
        return {};
    }
}
export async function writeSettings(settings) {
    await fs.mkdir(path.dirname(settingsFile()), { recursive: true });
    await fs.writeFile(settingsFile(), JSON.stringify(settings, null, 2), "utf8");
    return settings;
}
export async function updateSettings(patch) {
    const current = await readSettings();
    return writeSettings({ ...current, ...patch });
}
