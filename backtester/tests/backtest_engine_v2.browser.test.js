// The approved presentation groups technical evidence into a simple three-band flow.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"../..");
function serve() {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json"
  };
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent((request.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(root, requested);
    fs.readFile(file.startsWith(root) ? file : path.join(root, "index.html"), (error, content) => {
      response.writeHead(error ? 404 : 200, {
        "content-type": types[path.extname(file)] || "application/octet-stream"
      });
      response.end(error ? "Not found" : content);
    });
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}


for (const width of [1440,1180,860,768,390]) {
 test(`approved flow and inspector at ${width}px`,async()=>{
  const server=await serve(); const browser=await chromium.launch({headless:true});
  try {
   const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.address().port}/backtest-engine-v2.html`);
   await page.waitForFunction(()=>document.querySelector('#crHint').textContent.includes('evidence sources read'));
   assert.equal(await page.locator('.cr-band').count(),3);
   assert.equal(await page.locator('.cr-node').count(),10);
   assert.equal(await page.locator('.cr-node .cr-pip').count(),0);
   assert.equal(await page.locator('.cr-wire').count(),9);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.locator('[data-node="call"]').click();
   assert.equal(await page.locator('#crInspectorTitle').innerText(),'Generate call');
   assert.ok(await page.locator('#crInspectorBody a[href*="/workflow/89uk5JnPbWPL5lGD"]').count());
   await page.locator('#crInspectorBody summary').filter({hasText:'Fresh-call proof'}).click();
   assert.equal(await page.locator('#crInspectorBody [data-dimension="deployed"]').count()>0,true);
   await page.keyboard.press('Escape');
   if(width<=1000) assert.equal(await page.locator('#crInspector').evaluate(n=>n.classList.contains('is-open')),false);
   else assert.equal(await page.locator('.cr-node.is-selected').count(),0);
   await page.locator('#crZoomIn').click();await page.locator('#crZoomFit').click();
   assert.equal(await page.locator('#crZoomValue').innerText(),'100%');
   await page.locator('#crMotion').click();assert.equal(await page.locator('#crMotion').getAttribute('aria-pressed'),'false');
   assert.deepEqual(errors,[]);
  } finally {await browser.close();server.close();}
 });
}

// The bar and the rail are the dashboard's, not this page's. This page may draw a control room beside them,
// but it may not rename the brand, hide the rail's head, foot or clocks, or rebuild the rail into a shorter
// list of its own: the entries, their order and their visibility are measured against a second served page
// that carries the same shared block, so a page-level override or a script that rewrites the rail fails here.
test("the page keeps the dashboard's own bar and rail", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const url = file => `http://127.0.0.1:${server.address().port}/${file}`;
  const read = view => view.evaluate(() => {
    const shown = node => Boolean(node) && getComputedStyle(node).display !== "none";
    const rail = document.querySelector(".side-rail");
    return {
      brand: document.querySelector(".topbar-brand")?.textContent.trim(),
      meta: shown(document.querySelector(".topbar-meta")),
      date: document.querySelector("#currentDate")?.textContent.trim(),
      clock: document.querySelector("#topbarClock")?.textContent.trim(),
      head: shown(document.querySelector(".side-rail-head")),
      foot: shown(document.querySelector(".side-rail-foot")),
      railWidth: Math.round(rail.getBoundingClientRect().width),
      entries: Array.from(document.querySelectorAll(".side-rail-tabs > *")).map(node => {
        const [kind] = node.className.split(" ");
        return `${kind}: ${(node.textContent || "").trim().replace(/\s+/g, " ")}`;
      })
    };
  });
  try {
    for (const width of [1440, 390]) {
      const shared = await browser.newPage({ viewport: { width, height: 1000 } });
      await shared.goto(url("standing-dashboard.html"));
      const expected = await read(shared);
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.goto(url("backtest-engine-v2.html"));
      await page.waitForFunction(() => document.querySelector("#crHint").textContent.includes("evidence sources read"));
      const seen = await read(page);
      assert.equal(seen.brand, "Asset Directional Movement Dashboard", `the ${width}px bar must keep the dashboard's brand`);
      assert.deepEqual(seen.entries, expected.entries, `the ${width}px rail must offer the dashboard's entries in its order`);
      assert.deepEqual(
        { meta: seen.meta, head: seen.head, foot: seen.foot, railWidth: seen.railWidth },
        { meta: expected.meta, head: expected.head, foot: expected.foot, railWidth: expected.railWidth },
        `the ${width}px bar and rail must be shown exactly as the dashboard shows them`
      );
      const evidence = seen.entries.findIndex(entry => entry.startsWith("side-rail-group: Evidence"));
      assert.ok(evidence >= 0, `the ${width}px rail must keep its Evidence group`);
      assert.match(seen.entries[evidence + 1], /^side-rail-link: Backtest Engine v2$/, `the ${width}px rail must keep Backtest Engine v2 directly below Evidence`);
      assert.doesNotMatch(seen.date, /Loading/, `the ${width}px bar must fill in the date`);
      assert.match(seen.clock, /UK \d{2}:\d{2} \| ET \d{2}:\d{2}/, `the ${width}px bar must run both clocks`);
      await page.close();
      await shared.close();
    }
  } finally { await browser.close(); server.close(); }
});
