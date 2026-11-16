import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const directory = path.resolve("artifacts/android-tv/verification/media");
createServer(async (req, res) => {
  const name = new URL(req.url, "http://localhost").pathname.slice(1);
  if (!/^(fixture\.m3u8|segment\d+\.ts|subtitles\.mkv|english-only\.mkv)$/.test(name)) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(path.join(directory, name));
    const headers = { "content-type": name.endsWith("m3u8") ? "application/vnd.apple.mpegurl" : name.endsWith("mkv") ? "video/x-matroska" : "video/mp2t", "access-control-allow-origin": "*", "accept-ranges": "bytes" };
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
      if (start >= body.length || start > end) { res.writeHead(416, { "content-range": `bytes */${body.length}` }).end(); return; }
      res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${body.length}`, "content-length": end - start + 1 });
      res.end(body.subarray(start, end + 1));
    } else { res.writeHead(200, { ...headers, "content-length": body.length }); res.end(body); }
  } catch { res.writeHead(404).end(); }
}).listen(8788, "127.0.0.1", () => console.log("Synthetic native-media fixture on 127.0.0.1:8788"));
