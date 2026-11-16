import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { installFixture } from "./fixtures/tv-platform.mjs";
const require=createRequire(import.meta.url);
const {chromium}=require("C:/Users/nadal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
const out=path.resolve("artifacts/android-tv/verification-subtitles");await fs.mkdir(out,{recursive:true});
const errors=[];let passed=0;
const check=async(name,run)=>{await run();passed++;console.log("PASS "+name);};
try{
  const page=await browser.newPage({viewport:{width:960,height:540}});page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/*.invalid/**",route=>route.abort());
  await page.addInitScript(installFixture,{categoryCount:3,streamCount:20});
  await page.addInitScript(()=>{
    const api=window.__NATJE_TEST_PLATFORM__,portal=api.loadXtreamPortal;
    api.loadXtreamPortal=async()=>({...await portal(),vodCategories:[{category_id:"20",category_name:"NL | Films"}]});
    api.loadXtreamVodStreams=async()=>[{stream_id:22,name:"Testfilm",category_id:"20",container_extension:"mkv"}];
  });
  await page.goto("http://127.0.0.1:5173");await page.locator(".tv-hub").waitFor();
  await page.getByRole("button",{name:/Series.*categorieen/}).click();await page.getByRole("button",{name:"NL | Series",exact:true}).click();
  await page.getByRole("button",{name:/Voorbeeldserie/}).click();await page.getByRole("button",{name:/Aflevering één/}).click();
  await page.locator('[data-focus-key="action-subtitles"]:not([disabled])').waitFor();
  await check("Series prefer original video, preserve HLS fallback, and expose CC/audio after existing controls",async()=>{
    const playback=await page.evaluate(()=>__fixture.lastPlayback);assert(playback.url.endsWith(".mp4"));assert(playback.fallbackUrls[0].endsWith(".m3u8"));
    const keys=await page.locator(".tv-mini-actions button").evaluateAll(buttons=>buttons.map(button=>button.dataset.focusKey));
    assert.deepEqual(keys,["action-fullscreen","action-stop","action-programme","action-favorite","action-subtitles","action-audio"]);
    await page.getByRole("button",{name:"Ondertiteling kiezen",exact:true}).click();
    await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>document.activeElement.dataset.focusKey),"action-subtitles");
    await page.keyboard.press("ArrowRight");assert.equal(await page.evaluate(()=>document.activeElement.dataset.focusKey),"action-audio");await page.keyboard.press("Enter");
    await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>__fixture.calls.filter(call=>call.action==="audio-menu").length),1);
    assert.equal(await page.evaluate(()=>__fixture.calls.filter(call=>call.action==="subtitles-menu").length),1);
  });
  await check("Six mini-player controls remain visible and focusable at 480p/540p/1080p",async()=>{
    for(const [width,height] of [[854,480],[960,540],[1920,1080]]){
      await page.setViewportSize({width,height});
      const bounds=await page.locator(".tv-mini-actions button").evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
      for(const r of bounds)assert(r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height,JSON.stringify(r));
      await page.screenshot({path:path.join(out,`controls-${width}.png`)});
    }
  });
  await page.getByRole("button",{name:"Series",exact:true}).click();await page.getByRole("button",{name:"Keuze",exact:true}).click();
  await page.getByRole("button",{name:/Films.*categorieen/}).click();await page.getByRole("button",{name:"NL | Films",exact:true}).click();
  await page.getByRole("button",{name:/Testfilm/}).click();await page.locator('[data-focus-key="action-subtitles"]:not([disabled])').waitFor();
  await check("Movie CC/audio controls and Stop retain existing playback behaviour",async()=>{
    assert((await page.evaluate(()=>__fixture.lastPlayback.url)).endsWith(".mkv"));
    await page.getByRole("button",{name:"Audiotaal kiezen",exact:true}).click();await page.waitForTimeout(80);
    assert.equal(await page.evaluate(()=>__fixture.calls.filter(call=>call.action==="audio-menu").length),2);
    await page.locator('[data-focus-key="action-stop"]').click();await page.locator('[data-focus-key="action-subtitles"]').waitFor({state:"hidden"});
  });
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,"browser-results.json"),JSON.stringify({passed,errors},null,2));console.log(`${passed} subtitle/audio browser flows passed`);
}catch(error){console.error(error);process.exitCode=1;}finally{await browser.close();}
