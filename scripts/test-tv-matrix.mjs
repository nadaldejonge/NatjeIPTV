import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installFixture } from "./fixtures/tv-platform.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "C:/Users/nadal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe"});
const output=path.resolve("artifacts/android-tv/verification"); await fs.mkdir(output,{recursive:true});
let passed=0; const performanceResults=[]; const errors=[]; let lastPage;
const check=async(name,fn)=>{await fn();passed++;console.log("PASS "+name);};
async function create(options={}) {
  const p=await browser.newPage({viewport:options.runtime==="electron"?{width:1420,height:860}:{width:960,height:540}});
  lastPage=p;
  p.on("pageerror",e=>errors.push(e.message));
  await p.route("**/*.invalid/**",r=>r.abort());
  if(options.runtime==="electron") await p.route("https://provider.invalid/live/**",async(route)=>{
    const name=new URL(route.request().url()).pathname.split("/").pop();
    const file=name.endsWith(".m3u8")?"fixture.m3u8":name;
    try {await route.fulfill({body:await fs.readFile(path.join(output,"media",file)),contentType:file.endsWith(".m3u8")?"application/vnd.apple.mpegurl":"video/mp2t",headers:{"access-control-allow-origin":"*"}});}catch{await route.abort();}
  });
  await p.addInitScript(installFixture,options);await p.goto("http://127.0.0.1:5173");
  if(options.runtime==="electron")await p.getByRole("button",{name:"Login",exact:true}).click();
  await p.locator(".hub-grid").waitFor();return p;
}
async function live(p){await p.getByRole("button",{name:/Live TV.*categorieen/}).click();await p.locator('[data-focus-key="category:NL | Algemeen"]').click();await p.locator(".channel-row").first().waitFor();}
try {
  for(const categoryCount of [50,478,600]) {
    const p=await create({categoryCount});await live(p);
    await check(`${categoryCount} categorieën: pijlen zonder requests`,async()=>{
      const before=await p.evaluate(()=>__fixture.calls.filter(c=>c.action==="category").length);
      const measurement=await p.evaluate(async()=>{
        document.querySelector(".group-item").focus(); const durations=[];
        for(let i=0;i<40;i++) {await new Promise(requestAnimationFrame);const start=performance.now();document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}));durations.push(performance.now()-start);}
        durations.sort((a,b)=>a-b);return {p50:durations[20],p95:durations[38],max:durations.at(-1),samples:durations.length};
      });
      assert.equal(await p.evaluate(()=>__fixture.calls.filter(c=>c.action==="category").length),before);
      performanceResults.push({categoryCount,...measurement,metric:"synthetic keydown-to-DOM-focus handler ms; desktop Chrome; excludes paint/native playback"});
    });
    await p.close();
  }
  for(const streamCount of [40,90,120,240]) {
    const p=await create({streamCount});await live(p);
    await check(`${streamCount} zenders volledig bereikbaar zonder laadknop`,async()=>{
      await p.locator(".channel-row").first().focus();
      await p.evaluate((count)=>{for(let i=1;i<count;i++)document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}));},streamCount);
      assert.equal(await p.evaluate(()=>document.activeElement?.dataset.channelId),`xtream-live-${1000+streamCount}`);
      assert.equal(await p.getByText(/Meer laden|0 van/).count(),0);
    });
    await p.close();
  }
  const p=await create();await live(p);
  await check("Vasthouden 2s versnelt en loslaten stopt/reset",async()=>{
    await p.locator('[data-focus-key="channel:xtream-live-1001"]').focus();
    await p.keyboard.down("ArrowDown");await p.waitForTimeout(2050);await p.keyboard.down("ArrowDown");
    assert.equal(await p.evaluate(()=>document.activeElement?.dataset.channelId),"xtream-live-1006");
    await p.keyboard.up("ArrowDown");await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>document.activeElement?.dataset.channelId),"xtream-live-1006");
    await p.keyboard.press("ArrowDown");assert.equal(await p.evaluate(()=>document.activeElement?.dataset.channelId),"xtream-live-1007");
  });
  await check("Stale playbackevent kan nieuwere stream niet overschrijven",async()=>{
    await p.keyboard.press("Enter");await p.waitForTimeout(60);
    await p.evaluate(()=>__fixture.emit("playerError",{requestId:-1,message:"OUDE FOUT"}));
    assert.equal(await p.getByText("OUDE FOUT").count(),0);
  });
  await check("Landenfilter behoudt reset/alles uit en playback",async()=>{
    await p.locator("[data-focus-key=toolbar-countries]").click();
    await p.getByRole("button",{name:"Alles uit",exact:true}).click();
    await p.getByRole("button",{name:"Reset",exact:true}).click();
    await p.getByRole("button",{name:"Toepassen",exact:true}).click(); // apply does not close in baseline
    if(await p.getByRole("dialog").count())await p.keyboard.press("Escape");
    assert.equal(await p.locator("[data-focus-key=action-stop]").count(),1);
  });
  await check("M3U-bestand en zenderlogo blijven functioneel",async()=>{
    await p.locator("[data-focus-key=toolbar-playlist]").click();await p.getByRole("button",{name:"Bestand",exact:true}).click();
    await p.locator(".channel-row").first().waitFor();assert((await p.locator(".channel-meta strong").first().textContent()).includes("NPO 1"));
    assert((await p.locator(".channel-logo img").first().getAttribute("src")).includes("icons/app.ico"));
  });await p.close();
  const series=await create();
  await check("Series, afleveringen, fallback en terug behouden",async()=>{
    await series.getByRole("button",{name:/Series.*categorieen/}).click();await series.getByRole("button",{name:"NL | Series",exact:true}).click();
    await series.getByRole("button",{name:/Voorbeeldserie/}).click();await series.getByRole("button",{name:/Aflevering één/}).click();
    await series.waitForTimeout(50);assert.equal(await series.evaluate(()=>__fixture.lastPlayback.fallbackUrls.length),1);
    await series.getByRole("button",{name:"Series",exact:true}).click();await series.getByRole("button",{name:/Voorbeeldserie/}).waitFor();
  });await series.close();
  const win=await create({runtime:"electron"});
  await check("Windows-login, Xtream, HLS-UI, EPG en alle bestaande controls",async()=>{
    await win.getByRole("button",{name:/Live TV.*categorieen/}).click();await win.getByRole("button",{name:"NL | Algemeen",exact:true}).click();
    await win.locator(".channel-row[data-channel-id]").first().click();await win.locator(".programme-card p").first().waitFor();
    assert((await win.locator(".programme-card p").first().textContent()).includes("België"));assert.equal(await win.locator("video").count(),1);
    await win.waitForFunction(()=>document.querySelector("video")?.currentTime>0.1);
    for(const label of ["Play","Pauze","Stop","Herlaad stream","Open met MPV vanaf huidige positie","Picture-in-picture","Fullscreen"])assert((await win.getByRole("button",{name:label,exact:true}).count())>=1,label);
    assert.equal(await win.locator('input[aria-label="Helderheid"]').count(),1);
    await win.screenshot({path:path.join(output,"windows-regression.png")});
  });
  await check("Windows HLS speelt, Pauze/Play/Stop en fullscreen werken",async()=>{
    await win.getByRole("button",{name:"Pauze",exact:true}).click();assert.equal(await win.locator("video").evaluate(v=>v.paused),true);
    await win.getByRole("button",{name:"Play",exact:true}).click();await win.waitForFunction(()=>!document.querySelector("video").paused);
    await win.locator(".player-controls").getByRole("button",{name:"Fullscreen",exact:true}).click();await win.waitForFunction(()=>Boolean(document.fullscreenElement));
    await win.evaluate(()=>document.exitFullscreen());
    await win.getByRole("button",{name:"Stop",exact:true}).click();assert.equal(await win.locator("video").evaluate(v=>v.paused),true);
  });await win.close();
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,"matrix-results.json"),JSON.stringify({passed,errors,performanceResults},null,2));
  console.log(`${passed} matrix/regressiecontroles geslaagd`);console.log(JSON.stringify(performanceResults));
}catch(error){
  if(lastPage&&!lastPage.isClosed()) {
    await lastPage.screenshot({path:path.join(output,"matrix-failure.png")});
    console.log(await lastPage.evaluate(()=>({status:document.querySelector(".status-bar")?.textContent,cards:document.querySelectorAll(".programme-card").length,calls:__fixture.calls.filter(c=>c.action!=="settings").slice(-10)})));
  }
  console.log(errors);throw error;
}finally{await browser.close();}
