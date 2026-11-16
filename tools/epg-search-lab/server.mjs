import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent } from "undici";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDir, "../..");
const cacheDir = path.join(projectRoot, ".cache");
const cachePath = path.join(cacheDir, "epg-search-cache.json");
const xmltvPath = path.join(cacheDir, "xmltv.xml");
const port = Number(process.env.EPG_SEARCH_PORT || 8787);

const STREAM_TTL_MS = 24 * 60 * 60 * 1000;
const PORTAL_TTL_MS = 12 * 60 * 60 * 1000;
const EPG_TTL_MS = 2 * 60 * 1000;
const XMLTV_TTL_MS = 30 * 60 * 1000;
const SEARCH_CONCURRENCY = 24;
const EPG_WINDOW_RADIUS = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_REQUEST_ATTEMPTS = 2;
const EPG_TABLE_TIMEOUT_MS = 1100;
const EPG_SHORT_TIMEOUT_MS = 800;
const xtreamDispatcher = new Agent({
  connect: { timeout: 1200 },
  headersTimeout: 3000,
  bodyTimeout: 3000
});

const runtimeCache = {
  portal: null,
  streamsByCategory: {},
  epgByStream: {}
};

let saveTimer = null;

await loadCache();

const server = createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

    if (requestUrl.pathname === "/") {
      await serveFile(res, path.join(toolDir, "index.html"), "text/html; charset=utf-8");
      return;
    }

    if (requestUrl.pathname === "/app.js") {
      await serveFile(res, path.join(toolDir, "app.js"), "text/javascript; charset=utf-8");
      return;
    }

    if (requestUrl.pathname === "/styles.css") {
      await serveFile(res, path.join(toolDir, "styles.css"), "text/css; charset=utf-8");
      return;
    }

    if (requestUrl.pathname === "/api/bootstrap") {
      const credentials = loadCredentials();
      const portal = await getPortal(credentials);
      sendJson(res, {
        ok: true,
        account: credentials.username,
        liveCategoryCount: portal.liveCategories.length,
        countries: countryOptionsFromCategories(portal.liveCategories),
        cache: cacheStats()
      });
      return;
    }

    if (requestUrl.pathname === "/api/cache/clear" && req.method === "POST") {
      runtimeCache.epgByStream = {};
      scheduleSave();
      sendJson(res, { ok: true, cache: cacheStats() });
      return;
    }

    if (requestUrl.pathname === "/api/search-stream") {
      await streamSearch(req, res, requestUrl).catch((error) => {
        if (!res.headersSent) {
          sendJson(res, { ok: false, error: error instanceof Error ? error.message : "Scanfout" }, 500);
          return;
        }

        res.write("event: scanError\n");
        res.write(`data: ${JSON.stringify({ message: error instanceof Error ? error.message : "Scanfout" })}\n\n`);
        res.end();
      });
      return;
    }

    sendJson(res, { ok: false, error: "Niet gevonden" }, 404);
  } catch (error) {
    sendJson(res, { ok: false, error: error instanceof Error ? error.message : "Onbekende fout" }, 500);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`EPG Search Lab draait op http://127.0.0.1:${port}`);
});

async function streamSearch(req, res, requestUrl) {
  const credentials = loadCredentials();
  const query = (requestUrl.searchParams.get("q") ?? "").trim();
  const hiddenCountries = new Set(
    (requestUrl.searchParams.get("hidden") ?? "")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
  );

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const send = (event, data) => {
    if (!closed) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  if (query.length < 2) {
    send("scanError", { message: "Typ minimaal 2 tekens." });
    res.end();
    return;
  }

  const heartbeat = setInterval(() => {
    send("heartbeat", { ts: Date.now() });
  }, 5000);

  const queryTerms = normalizeText(query).split(/\s+/).filter(Boolean);
  send("status", { message: "Zoekverbinding gestart..." });

  try {
    const portal = await getPortal(credentials);
    const visibleCategories = portal.liveCategories.filter((category) => {
      const country = countryCodeFromText(category.category_name);
      return !country || !hiddenCountries.has(country);
    });

    send("scope", {
      categoryCount: visibleCategories.length,
      hiddenCountries: Array.from(hiddenCountries),
      totalCategoryCount: portal.liveCategories.length
    });

  let loadedCategories = 0;
  let loadedChannels = 0;
  let categoryErrors = 0;
  const categoryChannelLists = await mapConcurrent(visibleCategories, 8, async (category) => {
    try {
      const streams = await getStreamsForCategory(credentials, category);
      const mapped = streams
        .filter((stream) => stream?.stream_id)
        .map((stream) => ({
          id: String(stream.stream_id),
          name: stream.name ?? "Naamloos kanaal",
          logo: stream.stream_icon ?? "",
          group: category.category_name,
          country: countryCodeFromText(category.category_name),
          epgChannelId: stream.epg_channel_id ?? "",
          streamId: Number(stream.stream_id)
        }));

      loadedChannels += mapped.length;
      return mapped;
    } catch {
      categoryErrors += 1;
      return [];
    } finally {
      loadedCategories += 1;
      if (loadedCategories % 8 === 0 || loadedCategories === visibleCategories.length) {
        send("categoryProgress", {
          loaded: loadedCategories,
          total: visibleCategories.length,
          channels: loadedChannels,
          errors: categoryErrors
        });
      }
    }
  });

  if (closed) {
    return;
  }

  const channels = categoryChannelLists.flat();
  const uniqueChannels = uniqueBy(channels, (channel) => channel.streamId);
  send("status", { message: `${uniqueChannels.length} zenders scannen op actuele info...` });

  let cursor = 0;
  let processed = 0;
  let errors = 0;
  let matches = 0;
  const matchedStreamIds = new Set();

  for (const channel of uniqueChannels) {
    if (matchesTerms(`${channel.name} ${channel.group}`, queryTerms)) {
      matchedStreamIds.add(channel.streamId);
      matches += 1;
      send("match", {
        channel,
        programme: null,
        matchedOn: "kanaal/groep"
      });
    }
  }

  send("status", { message: "XMLTV gids doorzoeken..." });
  const xmltvMatches = await searchXmltvMatches(credentials, uniqueChannels, queryTerms);
  for (const match of xmltvMatches) {
    if (matchedStreamIds.has(match.channel.streamId)) {
      continue;
    }

    matchedStreamIds.add(match.channel.streamId);
    matches += 1;
    send("match", {
      channel: match.channel,
      programme: match.programme,
      matchedOn: "XMLTV programma-info"
    });
  }

  processed = uniqueChannels.length;
  send("progress", {
    processed,
    total: uniqueChannels.length,
    matches,
    errors,
    cachedEpgItems: Object.keys(runtimeCache.epgByStream).length
  });

  if (!closed) {
    send("done", {
      processed,
      total: uniqueChannels.length,
      matches,
      errors,
      categoryErrors,
      cache: cacheStats(),
      xmltv: true
    });
    res.end();
  }
  return;

  async function worker() {
    while (!closed && cursor < uniqueChannels.length) {
      const channel = uniqueChannels[cursor++];
      try {
        const listings = await getProgrammeWindow(credentials, channel.streamId);
        const listingMatch = listings.find((listing) =>
          normalizeText(`${listing.title} ${listing.description}`).includes(normalizedQuery)
        );

        if (listingMatch && !matchedStreamIds.has(channel.streamId)) {
          matchedStreamIds.add(channel.streamId);
          matches += 1;
          send("match", {
            channel,
            programme: listingMatch,
            matchedOn: "programma-info"
          });
        }
      } catch {
        errors += 1;
      } finally {
        processed += 1;
        if (processed % 12 === 0 || processed === uniqueChannels.length) {
          send("progress", {
            processed,
            total: uniqueChannels.length,
            matches,
            errors,
            cachedEpgItems: Object.keys(runtimeCache.epgByStream).length
          });
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(SEARCH_CONCURRENCY, uniqueChannels.length) }, () => worker()));

    if (!closed) {
      send("done", {
        processed,
        total: uniqueChannels.length,
        matches,
        errors,
        categoryErrors,
        cache: cacheStats()
      });
      res.end();
    }
  } finally {
    clearInterval(heartbeat);
  }
}

async function getPortal(credentials) {
  if (runtimeCache.portal && Date.now() - runtimeCache.portal.fetchedAt < PORTAL_TTL_MS) {
    return runtimeCache.portal.data;
  }

  const [userInfo, liveCategories] = await Promise.all([
    requestJson(credentials, {}, { timeoutMs: 20000, attempts: 2 }),
    requestJson(credentials, { action: "get_live_categories" }, { timeoutMs: 20000, attempts: 2 })
  ]);

  if (userInfo?.user_info?.auth === 0) {
    throw new Error("Xtream login geweigerd. Check je .env.");
  }

  const portal = { liveCategories: Array.isArray(liveCategories) ? liveCategories : [] };
  runtimeCache.portal = { fetchedAt: Date.now(), data: portal };
  scheduleSave();
  return portal;
}

async function getStreamsForCategory(credentials, category) {
  const cacheKey = String(category.category_id);
  const cached = runtimeCache.streamsByCategory[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < STREAM_TTL_MS) {
    return cached.data;
  }

  const streams = await requestJson(
    credentials,
    {
      action: "get_live_streams",
      category_id: category.category_id
    },
    { timeoutMs: 10000, attempts: 1 }
  );
  const data = Array.isArray(streams) ? streams : [];
  runtimeCache.streamsByCategory[cacheKey] = { fetchedAt: Date.now(), data };
  scheduleSave();
  return data;
}

async function getShortEpg(credentials, streamId) {
  const cacheKey = `short:${streamId}`;
  const cached = runtimeCache.epgByStream[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < EPG_TTL_MS) {
    return cached.data;
  }

  const data = await requestJson(
    credentials,
    {
      action: "get_short_epg",
      stream_id: streamId,
      limit: 7
    },
    { timeoutMs: EPG_SHORT_TIMEOUT_MS, attempts: 1 }
  );
  runtimeCache.epgByStream[cacheKey] = { fetchedAt: Date.now(), data: data ?? { epg_listings: [] } };
  scheduleSave();
  return runtimeCache.epgByStream[cacheKey].data;
}

async function getProgrammeWindow(credentials, streamId) {
  const cacheKey = `window:${streamId}`;
  const cached = runtimeCache.epgByStream[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < EPG_TTL_MS) {
    return cached.data;
  }

  let listings = [];
  try {
    const table = await requestJson(
      credentials,
      {
        action: "get_simple_data_table",
        stream_id: streamId
      },
      { timeoutMs: EPG_TABLE_TIMEOUT_MS, attempts: 1 }
    );
    listings = decodeListings(table?.epg_listings ?? table?.data ?? []);
  } catch {
    const shortEpg = await getShortEpg(credentials, streamId);
    listings = decodeListings(shortEpg?.epg_listings ?? []);
  }

  const windowed = selectProgrammeWindow(listings);
  runtimeCache.epgByStream[cacheKey] = { fetchedAt: Date.now(), data: windowed };
  scheduleSave();
  return windowed;
}

async function searchXmltvMatches(credentials, channels, queryTerms) {
  const channelsByEpgId = new Map();
  for (const channel of channels) {
    if (!channel.epgChannelId) {
      continue;
    }
    const key = String(channel.epgChannelId);
    if (!channelsByEpgId.has(key)) {
      channelsByEpgId.set(key, []);
    }
    channelsByEpgId.get(key).push(channel);
  }

  if (channelsByEpgId.size === 0) {
    return [];
  }

  const xml = await getXmltv(credentials);
  const programmesByChannel = new Map();
  const programmeRegex = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/gi;
  let match;

  while ((match = programmeRegex.exec(xml))) {
    const attrs = match[1];
    const channelId = attrs.match(/channel="([^"]+)"/)?.[1];
    if (!channelId || !channelsByEpgId.has(channelId)) {
      continue;
    }

    const startRaw = attrs.match(/start="([^"]+)"/)?.[1] ?? "";
    const stopRaw = attrs.match(/stop="([^"]+)"/)?.[1] ?? "";
    const programme = {
      title: xmlEntityDecode(xmlTag(match[2], "title")),
      description: xmlEntityDecode(xmlTag(match[2], "desc")),
      start: startRaw,
      end: stopRaw,
      startTimestamp: parseXmltvTimestamp(startRaw),
      stopTimestamp: parseXmltvTimestamp(stopRaw)
    };

    if (!programme.title && !programme.description) {
      continue;
    }

    if (!programmesByChannel.has(channelId)) {
      programmesByChannel.set(channelId, []);
    }
    programmesByChannel.get(channelId).push(programme);
  }

  const results = [];
  for (const [channelId, programmes] of programmesByChannel.entries()) {
    const windowed = selectProgrammeWindow(programmes);
    const hit = windowed.find((programme) => matchesTerms(`${programme.title} ${programme.description}`, queryTerms));
    if (!hit) {
      continue;
    }

    for (const channel of channelsByEpgId.get(channelId) ?? []) {
      results.push({ channel, programme: hit });
    }
  }

  return results;
}

async function getXmltv(credentials) {
  try {
    const stat = await import("node:fs/promises").then((fs) => fs.stat(xmltvPath));
    if (Date.now() - stat.mtimeMs < XMLTV_TTL_MS) {
      return readFile(xmltvPath, "utf8");
    }
  } catch {
    // Missing/stale XMLTV cache is fetched below.
  }

  const url = new URL(`${normalizeServerUrl(credentials.serverUrl)}/xmltv.php`);
  url.searchParams.set("username", credentials.username);
  url.searchParams.set("password", credentials.password);
  const xml = await requestText(url, { timeoutMs: 45000, attempts: 1 });
  await mkdir(cacheDir, { recursive: true });
  await writeFile(xmltvPath, xml, "utf8");
  return xml;
}

function selectProgrammeWindow(listings) {
  const clean = listings
    .filter((listing) => listing.title || listing.description)
    .sort((a, b) => (a.startTimestamp || 0) - (b.startTimestamp || 0));

  if (clean.length <= EPG_WINDOW_RADIUS * 2 + 1) {
    return clean;
  }

  const now = Math.floor(Date.now() / 1000);
  let currentIndex = clean.findIndex(
    (listing) => listing.startTimestamp && listing.stopTimestamp && listing.startTimestamp <= now && listing.stopTimestamp >= now
  );

  if (currentIndex === -1) {
    currentIndex = clean.findIndex((listing) => listing.startTimestamp && listing.startTimestamp >= now);
  }

  if (currentIndex === -1) {
    currentIndex = 0;
  }

  const start = Math.max(0, currentIndex - EPG_WINDOW_RADIUS);
  return clean.slice(start, Math.min(clean.length, currentIndex + EPG_WINDOW_RADIUS + 1));
}

function matchesTerms(value, queryTerms) {
  const text = normalizeText(value);
  return queryTerms.every((term) => text.includes(term));
}

function xmlTag(body, tagName) {
  const match = body.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? match[1] : "";
}

function xmlEntityDecode(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .trim();
}

function parseXmltvTimestamp(value) {
  const match = String(value ?? "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}))?/);
  if (!match) {
    return 0;
  }

  const utcMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  if (!match[7]) {
    return Math.floor(utcMs / 1000);
  }

  const sign = match[7][0] === "+" ? 1 : -1;
  const hours = Number(match[7].slice(1, 3));
  const minutes = Number(match[7].slice(3, 5));
  return Math.floor((utcMs - sign * (hours * 60 + minutes) * 60 * 1000) / 1000);
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function requestJson(credentials, params, options = {}) {
  const url = new URL(`${normalizeServerUrl(credentials.serverUrl)}/player_api.php`);
  url.searchParams.set("username", credentials.username);
  url.searchParams.set("password", credentials.password);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let lastError = null;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const attempts = options.attempts ?? DEFAULT_REQUEST_ATTEMPTS;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        dispatcher: xtreamDispatcher,
        headers: {
          "User-Agent": "Natjes-EPG-Search-Lab/0.1"
        }
      });
      if (!response.ok) {
        throw new Error(`Xtream request mislukt (${response.status})`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(300 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Xtream request mislukt");
}

async function requestText(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const attempts = options.attempts ?? DEFAULT_REQUEST_ATTEMPTS;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        dispatcher: xtreamDispatcher,
        headers: {
          "User-Agent": "Natjes-EPG-Search-Lab/0.1"
        }
      });
      if (!response.ok) {
        throw new Error(`Xtream request mislukt (${response.status})`);
      }
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(300 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Xtream text request mislukt");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCredentials() {
  const env = parseEnvFile();
  const credentials = {
    serverUrl: process.env.XTREAM_SERVER_URL || env.XTREAM_SERVER_URL,
    username: process.env.XTREAM_USERNAME || env.XTREAM_USERNAME,
    password: process.env.XTREAM_PASSWORD || env.XTREAM_PASSWORD
  };

  if (!credentials.serverUrl || !credentials.username || !credentials.password) {
    throw new Error("Zet XTREAM_SERVER_URL, XTREAM_USERNAME en XTREAM_PASSWORD in .env.");
  }

  return credentials;
}

function parseEnvFile() {
  try {
    const raw = syncReadText(path.join(projectRoot, ".env"));
    const result = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        continue;
      }
      result[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    }
    return result;
  } catch {
    return {};
  }
}

function syncReadText(filePath) {
  return Buffer.from(readFileSync(filePath)).toString("utf8");
}

function normalizeServerUrl(serverUrl) {
  const trimmed = serverUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("XTREAM_SERVER_URL moet met http:// of https:// beginnen.");
  }
  return trimmed;
}

function decodeListings(listings) {
  return listings.map((listing) => ({
    title: decodeXtreamText(listing.title),
    description: decodeXtreamText(listing.description),
    start: listing.start ?? "",
    end: listing.end ?? "",
    startTimestamp: Number(listing.start_timestamp || 0),
    stopTimestamp: Number(listing.stop_timestamp || 0)
  }));
}

function decodeXtreamText(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length % 4 === 0) {
      return Buffer.from(trimmed, "base64").toString("utf8").replace(/\0/g, "").trim() || value;
    }
  } catch {
    return value;
  }

  return value;
}

function countryOptionsFromCategories(categories) {
  const counts = new Map();
  for (const category of categories) {
    const code = countryCodeFromText(category.category_name);
    if (code) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, count]) => ({ code, count }));
}

function countryCodeFromText(value) {
  const match = String(value ?? "").trim().match(/^([A-Z]{2,3})\s*(?:\||-|:)/);
  return match ? match[1] : null;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = getKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

async function serveFile(res, filePath, contentType) {
  const content = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(content);
}

function sendJson(res, body, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function cacheStats() {
  return {
    streamCategories: Object.keys(runtimeCache.streamsByCategory).length,
    epgItems: Object.keys(runtimeCache.epgByStream).length
  };
}

async function loadCache() {
  try {
    const raw = await readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw);
    runtimeCache.portal = parsed.portal ?? null;
    runtimeCache.streamsByCategory = parsed.streamsByCategory ?? {};
    runtimeCache.epgByStream = parsed.epgByStream ?? {};
  } catch {
    // Cache is optional.
  }
}

function scheduleSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(async () => {
    try {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(cachePath, JSON.stringify(runtimeCache), "utf8");
    } catch {
      // Search still works without disk cache.
    }
  }, 400);
}
