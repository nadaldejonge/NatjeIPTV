// Testmatrix voor de gedeelde Xtream-client en transportlaag.
// Draait tegen de gecompileerde output: eerst `npm run build`, dan `node scripts/test-xtream.mjs`.
import {
  setHttpTransport,
  sanitizeUrl,
  serverLabel,
  TransportError,
  XtreamRequestError
} from "../dist/shared/httpTransport.js";
import {
  liveStreamUrl,
  loadXtreamPortal,
  loadXtreamLiveStreams
} from "../dist/shared/xtreamClient.js";

let passed = 0;
let failed = 0;

function check(name, condition, extra = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

function fakeTransport(handler) {
  const requests = [];
  setHttpTransport({
    kind: "capacitor-http",
    async get(request) {
      requests.push(request);
      return handler(request);
    }
  });
  return requests;
}

const creds = (serverUrl) => ({ serverUrl, username: "user name", password: "p@ss&wo=rd" });

console.log("\n== URL-opbouw ==");
{
  const requests = fakeTransport(async () => ({ status: 200, headers: {}, bodyText: "[]" }));
  await loadXtreamLiveStreams(creds("http://example.com:8080/"), "12");
  const url = new URL(requests[0].url);
  check("trailing slash verwijderd", requests[0].url.startsWith("http://example.com:8080/player_api.php?"), requests[0].url);
  check("geen dubbele slashes in pad", !url.pathname.includes("//"), url.pathname);
  check("username met spatie encoded", url.searchParams.get("username") === "user name" && requests[0].url.includes("username=user+name") || requests[0].url.includes("username=user%20name"));
  check("password speciale tekens intact", url.searchParams.get("password") === "p@ss&wo=rd");
  check("category_id meegegeven", url.searchParams.get("category_id") === "12");
  check("action correct", url.searchParams.get("action") === "get_live_streams");
}
{
  fakeTransport(async () => ({ status: 200, headers: {}, bodyText: "[]" }));
  let error = null;
  try {
    await loadXtreamLiveStreams(creds("example.com"), "");
  } catch (e) {
    error = e;
  }
  check("host zonder protocol geeft duidelijke fout", error?.message?.includes("http://"));
}
{
  const httpsUrl = liveStreamUrl(creds("https://example.com"), 42, "m3u8");
  check("https host + stream URL", httpsUrl === "https://example.com/live/user%20name/p%40ss%26wo%3Drd/42.m3u8", httpsUrl);
}

console.log("\n== HTTP-statusfouten ==");
for (const status of [401, 403, 404, 500]) {
  fakeTransport(async () => ({ status, headers: { "content-type": "text/html" }, bodyText: "<html>err</html>" }));
  let error = null;
  try {
    await loadXtreamPortal(creds("http://example.com:8080"));
  } catch (e) {
    error = e;
  }
  check(
    `HTTP ${status} → kind=http met status`,
    error instanceof XtreamRequestError && error.diagnostics.kind === "http" && error.diagnostics.status === status
  );
}

console.log("\n== Parse-fouten ==");
{
  fakeTransport(async () => ({ status: 200, headers: {}, bodyText: "<html><body>Blocked</body></html>" }));
  let error = null;
  try {
    await loadXtreamPortal(creds("http://example.com:8080"));
  } catch (e) {
    error = e;
  }
  check(
    "HTML-errorpagina → kind=parse met preview",
    error instanceof XtreamRequestError &&
      error.diagnostics.kind === "parse" &&
      error.diagnostics.responsePreview.includes("Blocked")
  );
}
{
  fakeTransport(async () => ({ status: 200, headers: {}, bodyText: "" }));
  let error = null;
  try {
    await loadXtreamPortal(creds("http://example.com:8080"));
  } catch (e) {
    error = e;
  }
  check("lege response → kind=parse", error instanceof XtreamRequestError && error.diagnostics.kind === "parse");
}

console.log("\n== Netwerkfouten (gesimuleerd via transport) ==");
const networkCases = [
  ["dns", "Unable to resolve host"],
  ["timeout", "De server reageerde niet"],
  ["connection-refused", "Connection refused"],
  ["cleartext-blocked", "CLEARTEXT communication not permitted"],
  ["tls", "TLS handshake failed"]
];
for (const [kind, message] of networkCases) {
  fakeTransport(async () => {
    throw new TransportError(kind, message);
  });
  let error = null;
  try {
    await loadXtreamPortal(creds("http://example.com:8080"));
  } catch (e) {
    error = e;
  }
  check(
    `${kind} → doorgegeven met step`,
    error instanceof XtreamRequestError &&
      error.diagnostics.kind === kind &&
      error.diagnostics.step === "player_api login"
  );
}

console.log("\n== Step-onderscheid login vs vervolgcalls ==");
{
  fakeTransport(async (request) => {
    if (request.url.includes("get_series_categories")) {
      throw new TransportError("timeout", "timeout");
    }
    if (request.url.includes("action=")) {
      return { status: 200, headers: {}, bodyText: "[]" };
    }
    return { status: 200, headers: {}, bodyText: JSON.stringify({ user_info: { auth: 1 } }) };
  });
  let error = null;
  try {
    await loadXtreamPortal(creds("http://example.com:8080"));
  } catch (e) {
    error = e;
  }
  check(
    "login slaagt maar series categories faalt → step=series categories",
    error instanceof XtreamRequestError && error.diagnostics.step === "series categories"
  );
}

console.log("\n== Redirect (transport volgt, finalUrl zichtbaar) ==");
{
  fakeTransport(async () => ({
    status: 200,
    headers: {},
    bodyText: JSON.stringify({ user_info: { auth: 1 } }),
    finalUrl: "https://example.com/player_api.php"
  }));
  const requests = [];
  // Alleen controleren dat een 30x-status als http-fout zichtbaar wordt wanneer redirects niet gevolgd worden.
  fakeTransport(async () => ({ status: 302, headers: { location: "https://example.com" }, bodyText: "" }));
  let error = null;
  try {
    await loadXtreamPortal(creds("http://example.com:8080"));
  } catch (e) {
    error = e;
  }
  check(
    "onafgehandelde 302 → kind=http status=302",
    error instanceof XtreamRequestError && error.diagnostics.kind === "http" && error.diagnostics.status === 302
  );
}

console.log("\n== Sanitisatie ==");
{
  const dirty = "http://h.example:8080/player_api.php?username=jan&password=geheim&action=get_series";
  const clean = sanitizeUrl(dirty);
  check("query credentials gemaskeerd", clean.includes("username=***") && clean.includes("password=***") && !clean.includes("geheim"));
  const streamClean = sanitizeUrl("http://h.example:8080/live/jan/geheim/42.m3u8");
  check("pad credentials gemaskeerd", streamClean.includes("/live/***/***/42.m3u8") && !streamClean.includes("geheim"));
  check("serverLabel zonder credentials", serverLabel(dirty) === "http://h.example:8080");
  check("serverLabel default poort", serverLabel("https://h.example/x") === "https://h.example:443");
}
{
  fakeTransport(async () => {
    throw new TransportError("dns", "Unable to resolve host");
  });
  let error = null;
  try {
    await loadXtreamPortal(creds("http://example.com:8080"));
  } catch (e) {
    error = e;
  }
  const diagText = JSON.stringify(error?.diagnostics ?? {});
  check("diagnostics bevatten geen wachtwoord", !diagText.includes("p@ss&wo=rd") && !diagText.includes("user name"));
}

console.log(`\nResultaat: ${passed} geslaagd, ${failed} gefaald`);
process.exit(failed === 0 ? 0 : 1);
