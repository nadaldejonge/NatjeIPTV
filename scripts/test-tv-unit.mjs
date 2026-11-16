import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
const load = async (file) => {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(output).toString("base64"));
};
const { decodeEpgText, epgTimestamp, normalizeEpg, programmeWindow } = await load("src/shared/epg.ts");
const { RequestContext, BoundedCache } = await load("src/renderer/lib/requestContext.ts");
const { navigationStep, resetNavigationRepeat } = await load("src/renderer/lib/tvKeyRepeat.ts");
const { countryCodeFromText, migrateRegionFilters } = await load("src/renderer/lib/countryGroups.ts");
const { processSearchChunks, searchCategories } = await load("src/renderer/lib/progressiveSearch.ts");
const { orderCategories, moveCategories, matchesSearch } = await load("src/renderer/lib/categoryPreferences.ts");
const { mapXtreamSeries, mapXtreamMovies, mapXtreamEpisodes } = await load("src/renderer/lib/xtreamMapper.ts");
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("PASS " + name); };

test("Opgeslagen categorievolgorde behoudt onbekende en nieuwe categorieën", () => {
  assert.deepEqual(orderCategories([{key:"a"},{key:"b"},{key:"new"}], ["gone","b"]).map(x=>x.key), ["b","a","new"]);
});
test("Bulk verplaatsen behoudt volgorde binnen selectie en overige categorieën", () => {
  const list=["a","b","c","d","e"],selected=new Set(["b","d"]);
  assert.deepEqual(moveCategories(list,selected,"top"),["b","d","a","c","e"]);
  assert.deepEqual(moveCategories(list,selected,"bottom"),["a","c","e","b","d"]);
  assert.deepEqual(moveCategories(list,selected,"up"),["b","a","d","c","e"]);
  assert.deepEqual(moveCategories(list,selected,"down"),["a","c","b","e","d"]);
  assert.deepEqual(list,["a","b","c","d","e"]);
});
test("Titelzoeken accepteert accenten, leestekens, losse woorden en Arabisch", () => {
  assert(matchesSearch("Twin.Peaks – Café Mystère","NL | Series","twin peaks cafe"));
  assert(matchesSearch("مسلسل جديد","عربي","مسلسل"));
  assert(matchesSearch("Andere titel","NL | Documentaires","documentaires"));
  assert(!matchesSearch("Twin Peaks","NL | Series","twin lost"));
});
test("Gemengde provider-ID-types behouden film- en seriecategorieën en episodekoppeling", () => {
  const categories=[{category_id:"12",category_name:"NL | Documentaires"}];
  const series={series_id:"12",category_id:12,name:"Serie"};
  const creds={serverUrl:"https://provider.invalid",username:"fixture",password:"fixture"};
  assert.equal(mapXtreamSeries([series],categories)[0].group,"NL | Documentaires");
  assert.equal(mapXtreamMovies([{stream_id:1,category_id:12,name:"Film"}],categories,creds)[0].meta.categoryId,"12");
  assert.equal(mapXtreamEpisodes(series,{episodes:{1:[{id:22}]}},creds)[0].meta.categoryId,"12");
});
test("UTF-8 base64", () => assert.equal(decodeEpgText(Buffer.from("België en café – één").toString("base64")), "België en café – één"));
for (const text of ["Nieuws", "RTL4", "test", "Geen beschrijving.", "%%%", "", "AB=="]) test("Platte/ongeldige tekst behouden: " + text, () => assert.equal(decodeEpgText(text), text));
test("Ontbrekende velden", () => assert.equal(decodeEpgText(null), ""));
test("Seconden", () => assert.equal(epgTimestamp("1793700000"), 1793700000));
test("Milliseconden", () => assert.equal(epgTimestamp("1793700000000"), 1793700000));
test("Expliciete tijdzone", () => assert.equal(epgTimestamp(undefined, "2026-11-03 12:00:00+01:00"), Date.parse("2026-11-03T11:00:00Z") / 1000));
test("Geen tijdzone verzinnen", () => assert.equal(epgTimestamp(undefined, "2026-11-03 12:00:00"), undefined));
test("Ongeldige response", () => assert.deepEqual(normalizeEpg({ epg_listings: "invalid" }), []));
test("Onvolledige listings veilig", () => assert.deepEqual(normalizeEpg([null, 7, {}, { title: "Nieuws" }]).map((p) => p.title), ["Nieuws"]));
test("Huidig, volgend en exclusieve eindgrens", () => {
  const items = normalizeEpg([{ title: "Nu", start_timestamp: "1793700000", stop_timestamp: "1793701000" }, { title: "Straks", start_timestamp: "1793701000", stop_timestamp: "1793702000" }]);
  assert.equal(programmeWindow(items, 1793700500).current.title, "Nu");
  assert.equal(programmeWindow(items, 1793700500).next.title, "Straks");
  assert.equal(programmeWindow(items, 1793701000).current.title, "Straks");
});
test("Onbekende tijd is nooit Nu", () => { const items = normalizeEpg([{ title: "Onbekend", description: "Tekst" }]); assert.equal(programmeWindow(items).current, undefined); assert.equal(programmeWindow(items).fallback.title, "Onbekend"); });
test("Oud succes/error/finally verliezen dezelfde context", () => { const scope = new RequestContext(); const a = scope.begin(); const b = scope.begin(); assert.equal(scope.isCurrent(a), false); assert.equal(scope.isCurrent(b), true); scope.invalidate(); assert.equal(scope.isCurrent(b), false); });
test("Cache bounded en sessies gescheiden", () => { const cache = new BoundedCache(2, 1000); cache.set("session1:a", 1); cache.set("session2:a", 2); cache.get("session1:a"); cache.set("session2:b", 3); assert.equal(cache.get("session2:a"), undefined); assert.equal(cache.get("session1:a"), 1); cache.clear(); assert.equal(cache.get("session1:a"), undefined); });
test("Cache verloopt", () => { const cache = new BoundedCache(2, -1); cache.set("a", 1); assert.equal(cache.get("a"), undefined); });
test("Hold versnelt geleidelijk; maximum, loslaten en richting resetten", () => {
  resetNavigationRepeat();
  assert.equal(navigationStep({key:"ArrowDown",repeat:false},0),1);
  const speeds = [500,1000,2000,3000,4000,6000].map((now)=>navigationStep({key:"ArrowDown",repeat:true},now));
  assert(speeds[0] < speeds[2]); assert(speeds[2] < speeds[4]); assert.equal(speeds[5],12);
  for(let i=0;i<100;i++)assert(navigationStep({key:"ArrowDown",repeat:true},10000+i)<=12);
  resetNavigationRepeat();
  assert.equal(navigationStep({key:"ArrowDown",repeat:false},4200),1);
  assert.equal(navigationStep({key:"ArrowUp",repeat:true},6500),1);
});
test("ASIA en EX-YU varianten zijn filterbaar", () => {
  for (const value of ["ASIA | Sport", "Asia: Nieuws", "Azië - TV"]) assert.equal(countryCodeFromText(value), "ASIA");
  for (const value of ["EX-YU | Sport", "EXYU | TV", "EXXIU - TV", "EX-U: TV"]) assert.equal(countryCodeFromText(value), "EX-YU");
  assert.equal(countryCodeFromText("NL | Algemeen"),"NL");
  assert.equal(countryCodeFromText("Favorieten"),null);
});
test("Legacy strenge landenfilter breidt regio's uit zonder expliciete keuze te verliezen", () => {
  const names=["NL | TV","BE | TV","US | TV","DE | TV","FR | TV","GB | TV","ASIA | TV","EX-YU | TV"];
  const hidden=["BE","US","DE","FR","GB"];
  assert(migrateRegionFilters(names,hidden).includes("ASIA"));
  assert(migrateRegionFilters(names,hidden).includes("EX-YU"));
  assert.deepEqual(migrateRegionFilters(names,hidden,2),hidden);
  assert.deepEqual(migrateRegionFilters(names,["US"]),["US"]);
});
{
  let callbacks=0; let valid=true;
  await processSearchChunks(Array.from({length:1000},(_,i)=>i),()=>{callbacks++; if(callbacks===2)valid=false;},()=>valid,100);
  assert.equal(callbacks,2); passed++; console.log("PASS chunkverwerking stopt onmiddellijk bij verouderde context");
}
{
  let running=0,max=0;const completed=[];
  const errors=await searchCategories([1,2,3,4],async(id)=>{running++;max=Math.max(max,running);await new Promise(r=>setTimeout(r,id===1?30:1));running--;completed.push(id);if(id===4)throw Error("fixture");},()=>true,2);
  assert(max<=2);assert.equal(completed[0],2);assert.equal(errors.length,1);passed++;console.log("PASS bounded parallel zoeken publiceert snelle categorie vóór trage");
}
console.log(`${passed} tests geslaagd`);
