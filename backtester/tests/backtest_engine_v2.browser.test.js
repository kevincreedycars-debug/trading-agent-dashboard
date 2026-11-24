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
