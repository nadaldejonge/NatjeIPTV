import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installFixture } from "./fixtures/tv-platform.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "C:/Users/nadal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const out = path.resolve("artifacts/android-tv/verification");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
let passed = 0;
const errors = [];
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/*.invalid/**", (route) => route.abort());
await page.addInitScript(installFixture, {});
const test = async (name, fn) => { await fn(); passed++; console.log("PASS " + name); };
const focus = async (key) => page.locator(`[data-focus-key="${key}"]`).focus();
const active = () => page.evaluate(() => document.activeElement?.getAttribute("data-focus-key"));
const choose = async (name) => { await page.getByRole("button", { name, exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll(".channel-row").length > 0); };
const inside = async (selector) => {
  const boxes = await page.locator(selector).evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; }));
  const size = page.viewportSize();
  for (const r of boxes) { assert(r.x >= 0 && r.y >= 0 && r.right <= size.width + 1 && r.bottom <= size.height + 1 && r.w > 0 && r.h > 0, JSON.stringify(r)); }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
};
try {
  await page.goto("http://127.0.0.1:5173");
  await page.locator(".tv-hub").waitFor();
  for (const [width, height] of [[854,480],[960,540],[1280,720],[1920,1080]]) {
    await page.setViewportSize({width,height});
    await test(`Hub past ${width}x${height}`, async () => { await inside(".hub-header,.hub-card"); await page.screenshot({path:path.join(out,`hub-${width}.png`)}); });
  }
  await page.setViewportSize({width:960,height:540});
  await page.getByRole("button", {name:/Live TV.*categorieen/}).click();
  await choose("NL | Algemeen");
  await test("Zender 7 OK → omlaag zender 8, ook na EPG", async () => {
    await focus("channel:xtream-live-1007"); await page.keyboard.press("Enter");
    await page.waitForTimeout(500); assert.equal(await active(),"channel:xtream-live-1007");
    await page.keyboard.press("ArrowDown"); assert.equal(await active(),"channel:xtream-live-1008");
    await page.locator(".tv-programme-summary h3").filter({hasText:"café"}).waitFor();
    assert.equal(await active(),"channel:xtream-live-1008");
  });
  await test("Automatisch voorbij 90; index 125 blijft staan", async () => {
    await focus("channel:xtream-live-1089");
    for (let i=0;i<36;i++) await page.keyboard.press("ArrowDown");
    assert.equal(await active(),"channel:xtream-live-1125");
    const top = await page.locator(".channel-list").evaluate((el)=>el.scrollTop);
    await page.keyboard.press("Enter"); await page.waitForTimeout(500);
    assert.equal(await active(),"channel:xtream-live-1125");
    assert.equal(await page.locator(".channel-list").evaluate((el)=>el.scrollTop),top);
  });
  await test("Expliciete focusgraaf en fullscreen zonder nieuwe play", async () => {
    await page.keyboard.press("ArrowRight"); assert.equal(await active(),"mini-player");
    await page.keyboard.press("ArrowDown"); assert.equal(await active(),"action-fullscreen");
    const plays = await page.evaluate(()=>__fixture.calls.filter((x)=>x.action==="play").length);
    await page.keyboard.press("Enter"); await page.evaluate(()=>__NATJE_TEST_PLATFORM__.exitNativeFullscreen()); await page.waitForTimeout(60);
    assert.equal(await active(),"action-fullscreen");
    assert.equal(await page.evaluate(()=>__fixture.calls.filter((x)=>x.action==="play").length),plays);
    await page.keyboard.press("ArrowRight"); assert.equal(await active(),"action-stop");
    await page.keyboard.press("ArrowUp"); assert.equal(await active(),"mini-player");
    await page.keyboard.press("ArrowLeft"); assert.equal(await active(),"channel:xtream-live-1125");
  });
  await test("Beschrijving, modal, focus en favorieten", async () => {
    await focus("action-programme"); await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    assert((await page.locator(".tv-programme-detail").textContent()).includes("België"));
    await page.keyboard.press("ArrowDown");
    for(let i=0;i<20;i++) await page.keyboard.press("ArrowDown");
    assert((await page.locator(".tv-programme-detail").evaluate(el=>el.scrollTop))>0);
    await page.screenshot({path:path.join(out,"programme-details-960.png")});
    await page.keyboard.press("Escape"); await page.waitForTimeout(60); assert.equal(await active(),"action-programme");
    await focus("action-favorite"); await page.keyboard.press("Enter");
    assert.equal(await page.locator("[data-focus-key=action-favorite]").getAttribute("aria-pressed"),"true");
  });
  for (const [width,height] of [[854,480],[960,540],[1280,720],[1920,1080]]) {
    await page.setViewportSize({width,height});
    await test(`Live-panelen en acties passen ${width}x${height}`, async () => { await inside(".tv-toolbar,.tv-list-panel,.tv-mini-player,.tv-mini-actions button,.tv-status-bar"); await page.screenshot({path:path.join(out,`live-${width}.png`)}); });
  }
  await page.setViewportSize({width:960,height:540});
  await test("Native bounds volgen resizing", async () => { await page.waitForTimeout(80); const data = await page.evaluate(()=>{const r=document.querySelector(".tv-mini-video").getBoundingClientRect();return {r:{x:r.x,y:r.y,width:r.width,height:r.height},b:__fixture.bounds.at(-1)}}); for(const k of ["x","y","width","height"]) assert(Math.abs(data.r[k]-data.b[k])<1); });
  await test("Zenderlogo's volledig passend; previewrand neutraal en dun",async()=>{
    const logo=page.locator('.channel-logo img').nth(1);assert.equal(await logo.evaluate(el=>getComputedStyle(el).objectFit),"contain");
    await focus("mini-player");await page.keyboard.press("ArrowRight");
    const style=await page.locator(".tv-mini-player").evaluate(el=>({color:getComputedStyle(el).outlineColor,width:getComputedStyle(el).outlineWidth}));
    assert.equal(style.width,"1px");assert.equal(style.color,"rgb(199, 204, 211)");
    await page.screenshot({path:path.join(out,"preview-focus-960.png")});
  });
  await test("Categorie wisselen behoudt playback en knoppen", async () => { await choose("NL | Sport"); assert((await page.locator(".tv-playing-name").textContent()).includes("125")); assert.equal(await page.locator("[data-focus-key=action-stop]").count(),1); });
  await test("Terug naar categorie herstelt zenderfocus boven 90",async()=>{
    await choose("NL | Algemeen");await page.keyboard.press("ArrowRight");assert.equal(await active(),"channel:xtream-live-1125");
    await choose("NL | Sport");
  });
  await test("Oude category-success en finally genegeerd", async () => {
    await page.evaluate(()=>{__fixture.delays["3"]=350;__fixture.delays["4"]=20;});
    await page.getByRole("button",{name:"BE | Entertainment",exact:true}).click(); await page.getByRole("button",{name:"DE | Nieuws",exact:true}).click();
    await page.waitForTimeout(420); assert.equal(await page.locator(".channel-row").first().getAttribute("data-channel-id"),"xtream-live-4001");
  });
  await test("Oude category-error genegeerd", async () => {
    await page.evaluate(()=>{__fixture.failures["3"]=true;});
    await page.getByRole("button",{name:"BE | Entertainment",exact:true}).click(); await page.getByRole("button",{name:"NL | Sport",exact:true}).click();
    await page.waitForTimeout(420); assert.equal(await page.locator(".channel-row").first().getAttribute("data-channel-id"),"xtream-live-2001"); assert.equal(await page.locator(".error-overlay").count(),0);
  });
  await test("Lege categorie en rustige loading", async () => { await page.evaluate(()=>__fixture.delays["5"]=1200); await page.getByRole("button",{name:"FR | Leeg",exact:true}).click(); await page.locator(".tv-spinner").waitFor(); await page.locator(".empty-state").waitFor(); assert.equal(await page.getByText(/0 van|Meer laden/).count(),0); });
  await choose("NL | Algemeen");
  await test("Oude EPG-success en error veranderen nieuwe informatie niet", async () => {
    for (const fail of [false,true]) {
      await page.evaluate((fail)=>{__fixture.epgDelays[1002]=900;__fixture.epgFailures[1002]=fail;},fail);
      await focus("channel:xtream-live-1002"); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
      await focus("channel:xtream-live-1003"); await page.keyboard.press("Enter"); await page.waitForTimeout(1000);
      assert((await page.locator(".tv-programme-summary h3").textContent()).includes("1003"));
    }
  });
  await test("Stop met focus houdt geldige bestemming", async () => { await focus("action-stop"); await page.keyboard.press("Enter"); await page.waitForTimeout(60); assert.notEqual(await active(),null); assert.equal(await page.locator("[data-focus-key=action-stop]").count(),0); });
  await test("Afgewezen native Promise wordt afgehandeld", async () => { await page.evaluate(()=>__fixture.nativeFailure=true); await focus("channel:xtream-live-1001"); await page.keyboard.press("Enter"); await page.getByText("De native speler kon niet starten. Probeer opnieuw.").waitFor(); await page.setViewportSize({width:854,height:480});await inside(".tv-mini-actions button");await page.setViewportSize({width:960,height:540});await page.evaluate(()=>__fixture.nativeFailure=false); });
  await test("Playlist- en landenacties blijven beschikbaar", async () => { for(const key of ["toolbar-playlist","toolbar-countries","toolbar-search"]){await focus(key);await page.keyboard.press("Enter");await page.getByRole("dialog").waitFor();await page.keyboard.press("Escape");await page.waitForTimeout(40);assert.equal(await active(),key);} });
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,"browser-results.json"),JSON.stringify({passed,errors,environment:"Chromium desktop, synthetic Android bridge; no physical device"},null,2));
  console.log(`${passed} browsercontroles geslaagd`);
} catch (error) {
  await page.screenshot({path:path.join(out,"failure.png")});
  console.log(await page.evaluate(()=>({status:document.querySelector(".tv-status-bar")?.textContent,calls:__fixture.calls.filter((x)=>x.action!=="settings").slice(-10),errors:document.querySelector(".error-panel")?.textContent,rows:document.querySelectorAll(".channel-row").length})));
  console.log(errors);
  throw error;
} finally { await browser.close(); }
