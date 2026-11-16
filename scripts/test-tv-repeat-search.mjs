import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {installFixture} from './fixtures/tv-platform.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/nadal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const errors=[];let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)};
const out=path.resolve('artifacts/android-tv/verification-repeat-search');await fs.mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:960,height:540}});page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*.invalid/**',route=>route.abort());await page.addInitScript(installFixture,{categoryCount:3,streamCount:20});
 await page.addInitScript(()=>{
  const api=__NATJE_TEST_PLATFORM__,portal=api.loadXtreamPortal;
  api.loadXtreamPortal=async()=>({...await portal(),seriesCategories:[{category_id:'10',category_name:'NL | Series'}],vodCategories:[{category_id:'20',category_name:'NL | Films'}]});
  api.loadXtreamSeries=async()=>{await __fixture.wait(__fixture.seriesDelay??20);return[{series_id:11,name:'Sherlock',category_id:'10'},{series_id:12,name:'Mocro Maffia',category_id:'10'}]};
  api.loadXtreamVodStreams=async()=>{await __fixture.wait(__fixture.movieDelay??20);if(__fixture.movieFailure)throw Error('Gesimuleerde fout');return[{stream_id:21,name:'Paddington',category_id:'20',container_extension:'mkv'},{stream_id:22,name:'Bridget Jones',category_id:'20',container_extension:'mkv'}]};
 });
 await page.goto('http://127.0.0.1:5173');await page.locator('.tv-hub').waitFor();await page.getByRole('button',{name:/Live TV.*categorieen/}).click();
 const open=()=>page.locator('[data-focus-key=toolbar-search]').click();
 const input=page.locator('.tv-modal input');
 const button=()=>page.locator('.tv-modal-actions').getByRole('button',{name:'Zoeken',exact:true});
 const edit=async(term)=>{await page.locator('.tv-text-input').click();await input.fill(term)};
 const done=()=>page.waitForFunction(()=>!document.querySelector('.tv-search-feedback .tv-spinner'));
 const results=()=>page.locator('.tv-search-result').allTextContents();
 await open();await edit('RTL');await button().click();await done();assert((await results()).every(name=>name.includes('RTL')));
 await check('A second button search uses the final visible IME text, not the previous query',async()=>{
  await edit('RTL');
  await input.evaluate(element=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(element,'NPO');element.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'NPO'}));});
  await button().click();await done();const found=await results();assert(found.length>0);assert(found.every(name=>name.includes('NPO')),JSON.stringify(found));
 });
 await check('Changing text and pressing Enter in the same task submits the latest value',async()=>{
  await page.locator('.tv-text-input').click();
  await input.evaluate(element=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(element,'ESPN');element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));});
  await done();assert((await results()).every(name=>name.includes('ESPN')));assert((await results()).length>0);
 });
 await check('A new request replaces an in-progress search and old completion cannot restore old results',async()=>{
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{__fixture.delays['1']=700;__fixture.delays['2']=700;__fixture.delays['3']=700});
  await page.locator('[data-focus-key=toolbar-refresh]').click();
  await open();await edit('RTL');await button().click();await page.locator('.tv-search-feedback .tv-spinner').waitFor();
  await edit('NPO');await button().click();await done();await page.waitForTimeout(800);
  assert((await results()).length>0);assert((await results()).every(name=>name.includes('NPO')));
  await page.keyboard.press('Escape');
 });
 await page.reload();await page.locator('.tv-hub').waitFor();
 for(const [section,first,second] of [['Series','Sherlock','Mocro'],['Films','Paddington','Bridget']]){
  await page.getByRole('button',{name:new RegExp(section+'.*categorieen')}).click();await open();
  await edit(first);await button().click();await done();assert((await results()).some(name=>name.includes(first)));
  await check(section+': repeated searches work via button, Enter and after reopening',async()=>{
   await edit(second);await button().click();await done();assert((await results()).every(name=>name.includes(second)));assert((await results()).length>0);
   await page.keyboard.press('Escape');await open();await edit(first);await input.press('Enter');await done();assert((await results()).some(name=>name.includes(first)));
   await page.locator('.tv-modal-actions').getByRole('button',{name:'Wissen',exact:true}).click();await edit(second);await button().click();await done();assert((await results()).some(name=>name.includes(second)));
   await page.keyboard.press('Escape');
  });
  await page.getByRole('button',{name:'Keuze',exact:true}).click();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'results.json'),JSON.stringify({passed,errors},null,2));console.log(`${passed} repeated-search flows passed`);
}catch(error){console.error(error);process.exitCode=1}finally{await browser.close()}
