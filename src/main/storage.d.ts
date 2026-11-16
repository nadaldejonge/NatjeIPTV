export type PlaylistSource = "m3u-file" | "m3u-url";
export type StoredSettings = {
    lastPlaylistType?: PlaylistSource;
    lastPlaylistPath?: string;
    lastPlaylistUrl?: string;
    lastGroup?: string;
    lastChannelId?: string;
    windowBounds?: {
        width: number;
        height: number;
        x?: number;
        y?: number;
    };
};
export declare function readSettings(): Promise<StoredSettings>;
export declare function writeSettings(settings: StoredSettings): Promise<StoredSettings>;
export declare function updateSettings(patch: Partial<StoredSettings>): Promise<StoredSettings>;
