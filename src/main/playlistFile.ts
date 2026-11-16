import fs from "node:fs/promises";

export async function readPlaylistFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}
