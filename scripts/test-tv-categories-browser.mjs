import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installFixture } from "./fixtures/tv-platform.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/nadal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const out = path.resolve("artifacts/android-tv/verification-categories"); await fs.mkdir(out, { recursive: true });
let passed = 0; const errors = [];
const check = async (name, fn) => { await fn(); passed++; console.log("PASS " + name); };
async function create(runtime = "android", broad = false) {
  const page = await browser.newPage({ viewport: { width: runtime === "android" ? 960 : 1420, height: runtime === "android" ? 540 : 860 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*.invalid/**", (route) => route.abort());
  await page.addInitScript(installFixture, { runtime, categoryCount: 5, streamCount: 20 });
  await page.addInitScript(({ broad }) => {
    const api = window.__NATJE_TEST_PLATFORM__, fixture = window.__fixture;
    const categories = Array.from({ length: broad ? 26 : 3 }, (_, i) => ({ category_id: String(i + 10), category_name: i === 0 ? "NL | Verhalen" : i === 1 ? "أفلام عربية" : i === 2 ? "NL | Documentaires" : `NL | Catalogus ${i}` }));
    const portal = api.loadXtreamPortal;
    api.loadXtreamPortal = async () => ({ ...await portal(), seriesCategories: categories, vodCategories: categories });
    const read = api.readSettings, write = api.updateSettings;
    api.readSettings = async () => ({ ...await read(), categoryPreferences: JSON.parse(sessionStorage.getItem("test-category-preferences") || "{}") });
    api.updateSettings = async (patch) => { if (patch.categoryPreferences) { if (fixture.failSave) throw Error("fixture save failure"); sessionStorage.setItem("test-category-preferences", JSON.stringify(patch.categoryPreferences)); } return write(patch); };
    const records = (id, section) => [{ [section === "series" ? "series_id" : "stream_id"]: String(500 + Number(id)), category_id: Number(id), name: Number(id) === (broad ? 35 : 12) ? "Twin.Peaks – Café Mystère" : `Voorbeeld ${id}`, container_extension: "mp4", plot: "Volledige beschrijving" }];
    const load = async (id, section) => {
      fixture.calls.push({ action: section + "-search", id });
      await fixture.wait(fixture.delays[id] ?? 25);
      if (broad && !id) throw Error("Provider weigert grote aanvraag");
      return id ? records(id, section) : categories.flatMap((item) => records(item.category_id, section));
    };
    api.loadXtreamSeries = (_credentials, id) => load(id, "series");
    api.loadXtreamVodStreams = (_credentials, id) => load(id, "movies");
  }, { broad });
  await page.goto("http://127.0.0.1:5173");
  if (runtime === "electron") await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.locator(".hub-grid").waitFor(); return page;
}
const enter = (page, section) => page.getByRole("button", { name: new RegExp(section + ".*categorieen") }).click();
const manage = async (page) => { await page.getByRole("button", { name: /Categorieën( beheren)?$/, exact: false }).click(); await page.locator(".category-manager").waitFor(); };
const row = (page, name) => page.locator(".category-manager-row").filter({ hasText: name });
const save = async (page) => { await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await page.locator(".category-manager").waitFor({ state: "hidden" }); };
async function search(page, query) {
  await page.locator("[data-focus-key=toolbar-search]").click(); await page.locator(".tv-text-input").click();
  await page.locator(".tv-modal input").fill(query); await page.keyboard.press("Enter");
}
try {
  const page = await create(); await enter(page, "Live TV");
  await check("Live bulk hide, stable reorder and restored preferences after restart", async () => {
    await manage(page);
    await row(page, "BE | Entertainment").click(); await row(page, "DE | Nieuws").click();
    await page.getByRole("button", { name: "Verberg selectie", exact: true }).click();
    await row(page, "NL | Sport").click(); await page.getByRole("button", { name: "Helemaal bovenaan", exact: true }).click();
    await page.screenshot({ path: path.join(out, "category-manager-960.png") }); await save(page);
    assert.equal(await page.locator(".group-item").filter({ hasText: "BE | Entertainment" }).count(), 0);
    assert.deepEqual((await page.locator(".group-item").allTextContents()).slice(0, 3), ["Favorieten0", "NL | Sport", "NL | Algemeen"]);
    await page.reload(); await page.locator(".tv-hub").waitFor(); await enter(page, "Live TV");
    assert.equal(await page.locator(".group-item").filter({ hasText: "DE | Nieuws" }).count(), 0);
    assert.equal((await page.locator(".group-item").allTextContents())[1], "NL | Sport");
  });
  await check("Hidden categories can be restored; cancel and failed save retain stored preferences", async () => {
    await manage(page); await page.getByRole("button", { name: "Verborgen", exact: true }).click();
    await row(page, "BE | Entertainment").click(); await page.getByRole("button", { name: "Toon selectie", exact: true }).click();
    await page.evaluate(() => __fixture.failSave = true); await page.getByRole("button", { name: "Opslaan", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Opslaan mislukt" }).waitFor();
    await page.evaluate(() => __fixture.failSave = false); await save(page);
    await page.locator(".group-item").filter({ hasText: "BE | Entertainment" }).waitFor();
    await manage(page); await page.getByRole("button", { name: "Herstel standaard", exact: true }).click();
    await page.getByRole("button", { name: "Annuleren", exact: true }).click();
    assert.equal(await page.locator(".group-item").filter({ hasText: "DE | Nieuws" }).count(), 0);
  });
  await page.keyboard.press("Escape"); // no modal: use the test hub through existing back button in series below
  await page.reload(); await page.locator(".tv-hub").waitFor(); await enter(page, "Series");
  await check("Series title search spans unopened categories and tolerates punctuation, accents and numeric category IDs", async () => {
    await page.locator(".group-item").filter({ hasText: "NL | Verhalen" }).click(); await page.locator(".channel-row").first().waitFor();
    await page.evaluate(() => __fixture.delays["12"] = 600);
    await search(page, "twin peaks cafe"); await page.locator(".tv-search-feedback .tv-spinner").waitFor();
    await page.locator(".tv-search-result").filter({ hasText: "Twin.Peaks" }).waitFor();
    assert((await page.locator(".tv-search-result").textContent()).includes("NL | Documentaires"));
    await page.locator(".tv-search-result").click(); await page.locator(".channel-row").filter({ hasText: "Aflevering één" }).waitFor();
    await page.locator(".channel-row").filter({ hasText: "Aflevering één" }).click();
    assert.equal(await page.evaluate(() => __fixture.lastPlayback.isLive), false);
    await page.getByRole("button", { name: "Series", exact: true }).click();
  });
  await check("Series categories can be bulk hidden and reordered independently of Live TV", async () => {
    await manage(page); await row(page, "أفلام عربية").click(); await page.getByRole("button", { name: "Verberg selectie", exact: true }).click();
    await row(page, "NL | Documentaires").click(); await page.getByRole("button", { name: "Helemaal bovenaan", exact: true }).click(); await save(page);
    assert.equal(await page.locator(".group-item").filter({ hasText: "أفلام عربية" }).count(), 0);
    assert.equal((await page.locator(".group-item").allTextContents())[1], "NL | Documentaires");
    await search(page, "Voorbeeld 11");
    await page.waitForFunction(() => !document.querySelector(".tv-search-feedback .tv-spinner"));
    assert.equal(await page.locator(".tv-search-result").count(), 0, "Hidden series category must also disappear from cached search results");
    await page.keyboard.press("Escape");
  });
  await page.getByRole("button", { name: "Keuze", exact: true }).click(); await enter(page, "Films");
  await check("Movie search finds titles, selection plays VOD, management is per section", async () => {
    await search(page, "twin peaks"); await page.locator(".tv-search-result").filter({ hasText: "Twin.Peaks" }).waitFor();
    await page.locator(".tv-search-result").click();
    assert.equal(await page.evaluate(() => __fixture.lastPlayback.isLive), false);
    assert((await page.evaluate(() => __fixture.lastPlayback.url)).includes("/movie/"));
    await manage(page); assert.equal((await row(page, "أفلام عربية").textContent()).includes("Zichtbaar"), true);
    await row(page, "أفلام عربية").click(); await page.getByRole("button", { name: "Verberg selectie", exact: true }).click();
    await row(page, "NL | Documentaires").click(); await page.getByRole("button", { name: "Helemaal bovenaan", exact: true }).click(); await save(page);
    assert.equal((await page.locator(".group-item").allTextContents())[1], "NL | Documentaires");
  });
  await check("Remote navigation remains trapped, save stays reachable and manager fits 480p", async () => {
    await page.setViewportSize({ width: 854, height: 480 }); await manage(page);
    const saveButton = page.getByRole("button", { name: "Opslaan", exact: true });
    const bounds = await saveButton.boundingBox(); assert(bounds.y + bounds.height <= 480);
    await row(page, "NL | Verhalen").focus(); await page.keyboard.press("ArrowDown");
    assert(await page.locator(".category-dialog").evaluate((element) => element.contains(document.activeElement)));
    await page.screenshot({ path: path.join(out, "category-manager-854.png") }); await page.keyboard.press("Escape");
  });
  await page.close();
  const broad = await create("android", true); await enter(broad, "Series");
  await check("Provider refusing bulk search falls back to every category and caches subsequent title queries", async () => {
    await search(broad, "twin peaks"); await broad.locator(".tv-search-result").filter({ hasText: "Twin.Peaks" }).waitFor();
    await broad.waitForFunction(() => !document.querySelector(".tv-search-feedback .tv-spinner"));
    const calls = await broad.evaluate(() => __fixture.calls.filter((item) => item.action === "series-search"));
    assert.equal(new Set(calls.filter((item) => item.id).map((item) => item.id)).size, 26);
    await broad.locator(".tv-text-input").click(); await broad.locator(".tv-modal input").fill("cafe mystere"); await broad.keyboard.press("Enter");
    await broad.waitForFunction(() => !document.querySelector(".tv-search-feedback .tv-spinner"));
    assert.equal(await broad.evaluate(() => __fixture.calls.filter((item) => item.action === "series-search").length), calls.length);
    assert.equal(await broad.locator(".tv-search-result").count(), 1);
  });
  await check("Large category list uses available height at 480p, 540p and 1080p", async () => {
    await broad.keyboard.press("Escape"); await manage(broad);
    for (const [width, height, minimum] of [[854,480,6],[960,540,8],[1920,1080,16]]) {
      await broad.setViewportSize({width,height});
      await broad.locator(".category-manager-list").evaluate((element) => element.scrollTop = 0);
      const visible = await broad.locator(".category-manager-list").evaluate((element) => {
        const bounds=element.getBoundingClientRect();
        return [...element.querySelectorAll(".category-manager-row")].filter((row) => { const r=row.getBoundingClientRect(); return r.top>=bounds.top && r.bottom<=bounds.bottom; }).length;
      });
      assert(visible >= minimum, `${width}x${height}: only ${visible} complete rows`);
      await broad.screenshot({path:path.join(out,`categories-large-${width}.png`)});
      console.log(`  ${width}x${height}: ${visible} complete category rows`);
    }
    await broad.locator(".category-manager-row").first().focus(); await broad.keyboard.press("ArrowLeft");
    assert(await broad.locator(".category-tools").evaluate((element)=>element.contains(document.activeElement)));
    await broad.keyboard.press("ArrowRight");
    assert(await broad.locator(".category-browser").evaluate((element)=>element.contains(document.activeElement)));
  });
  await check("Alles uit covers unknown land codes; selectively enabled categories alone are requested", async () => {
    await broad.keyboard.press("Escape"); await broad.reload(); await broad.locator(".tv-hub").waitFor(); await enter(broad, "Series");
    await broad.locator("[data-focus-key=toolbar-countries]").click();
    await broad.locator(".tv-country").filter({hasText:"NL"}).click(); await broad.keyboard.press("Escape");
    await manage(broad); await broad.getByRole("button",{name:"Alles uit",exact:true}).click();
    assert.equal(await broad.locator(".category-manager-row").count(),26);
    await row(broad,"NL | Verhalen").click(); await row(broad,"NL | Documentaires").click();
    await broad.getByRole("button",{name:"Toon selectie",exact:true}).click(); await save(broad);
    assert.deepEqual((await broad.locator(".group-item").allTextContents()).slice(1),["NL | Verhalen","NL | Documentaires"]);
    await search(broad,"voorbeeld"); await broad.waitForFunction(()=>!document.querySelector(".tv-search-feedback .tv-spinner"));
    const calls=await broad.evaluate(()=>__fixture.calls.filter(item=>item.action==="series-search").map(item=>item.id));
    assert.deepEqual(calls.sort(),["10","12"]);
    await broad.keyboard.press("Escape"); await manage(broad); await broad.getByRole("button",{name:"Alles aan",exact:true}).click();
    await row(broad,"أفلام عربية").click(); await broad.getByRole("button",{name:"Verberg selectie",exact:true}).click(); await save(broad);
    await search(broad,"voorbeeld"); await broad.waitForFunction(()=>!document.querySelector(".tv-search-feedback .tv-spinner"));
    const after=await broad.evaluate(()=>__fixture.calls.filter(item=>item.action==="series-search").map(item=>item.id));
    assert(!after.includes(""),"Even 25 visible categories must never trigger an unfiltered provider request");
    assert(!after.includes("11"),"Hidden unknown-country category must never be requested");
    assert.equal(new Set(after).size,25);
    await broad.keyboard.press("Escape"); await broad.locator("[data-focus-key=toolbar-countries]").click();
    await broad.locator(".tv-country").filter({hasText:"NL"}).click(); // NL on
    await broad.locator(".tv-country").filter({hasText:"NL"}).click(); // NL off, clears explicit overrides
    await broad.keyboard.press("Escape");
    assert.equal(await broad.locator(".group-item").count(),1,"A later country action remains authoritative");
  }); await broad.close();
  const desktop = await create("electron"); await enter(desktop, "Films");
  await check("Windows retains player and gains the same category controls and movie search", async () => {
    await desktop.getByPlaceholder("Zoek films").fill("twin peaks cafe"); await desktop.getByPlaceholder("Zoek films").press("Enter");
    await desktop.locator(".channel-row").filter({ hasText: "Twin.Peaks" }).waitFor();
    await manage(desktop); await row(desktop, "أفلام عربية").click(); await desktop.getByRole("button", { name: "Verberg selectie", exact: true }).click(); await save(desktop);
    assert.equal(await desktop.locator(".group-item").filter({ hasText: "أفلام عربية" }).count(), 0);
  }); await desktop.close();
  assert.deepEqual(errors, []); await fs.writeFile(path.join(out, "results.json"), JSON.stringify({ passed, errors }, null, 2));
  console.log(`${passed} category/search flows geslaagd`);
} catch (error) { console.error(error); process.exitCode = 1; } finally { await browser.close(); }
