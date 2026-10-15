// The home page's globe is the first picture a reader meets, and it has to read as the Earth.
//
// The user's report is why the guard exists: the canvas drew an ocean-coloured sphere, a graticule, seven pulsing
// market cities and nine travel arcs, and no land at all, so it read as a wireframe ball with no bearing on
// trading. What is asserted here is that it is still the Earth and still sharp: the coastline outlines fill
// enough of the sphere that it cannot be mistaken for a wireframe, the sphere is still the 290px box the markup
// and the stylesheet carry, and the bitmap behind it is sized for the reader's own device pixel ratio - capped at
// 2 - instead of being stretched up from a 290px bitmap on a denser screen.
//
// Measured when the coastlines were drawn, over the repository root served locally: 36.5% of the sphere's own
// pixels are land with them and 0.4% without, at device pixel ratio 1, 2 and 3, at 1440px and at 390px wide. The
// floor below sits an order of magnitude clear of both states, so it fails the old ball and passes the Earth.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const PAGE = "index.html";
const SPHERE_BOX = 290;
// The share of the sphere's own pixels that must be land: the wireframe reaches 0.004 and the drawn Earth 0.36.
const LAND_FLOOR = 0.2;
// A sanity ceiling rather than a design target: a sphere flooded with land would be a different defect in the
// same picture, and the guard should say so instead of passing.
const LAND_CEILING = 0.6;

// Serves the repository root: this is a published page that loads its own stylesheet and scripts by relative path.
function serve() {
  const types = { ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent((request.url || "/").split("?")[0]).replace(/^\/+/, "") || PAGE;
    const file = path.resolve(root, requested);
    fs.readFile(file.startsWith(root) ? file : path.join(root, PAGE), (error, content) => {
      response.writeHead(error ? 404 : 200, { "content-type": types[path.extname(file)] || "text/html; charset=utf-8" });
      response.end(error ? "Not found" : content);
    });
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// Runs inside the page, so it stands alone: nothing from this file is in scope there. It reads the canvas the
// page has actually drawn - the same sphere the reader sees - and counts land pixels against the ocean, the
// graticule, the route arcs and the city nodes. Land is filled a pale blue-grey over a dark blue ocean, so it is
// the one class inside the sphere that is light in all three channels and not markedly bluer than it is red; the
// teal routes and city nodes fail that last test, and the white graticule is far too thin to count.
function globeReadout() {
  const canvas = document.getElementById("marketGlobeCanvas");
  if (!canvas) return { present: false };
  const box = canvas.getBoundingClientRect();
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  const ratio = canvas.width / box.width;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = 118 * ratio;
  let land = 0;
  let inside = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      if (data[index + 3] === 0) continue;
      if (Math.hypot(x - cx, y - cy) > radius) continue;
      inside += 1;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (r > 60 && g > 85 && b > 110 && b - r < 90) land += 1;
    }
  }
  return {
    present: true,
    drawsLand: typeof window.initMarketGlobe === "function" && window.initMarketGlobe.toString().includes("landmasses"),
    bitmap: `${canvas.width}x${canvas.height}`,
    box: `${Math.round(box.width)}x${Math.round(box.height)}`,
    ratio: Number(ratio.toFixed(2)),
    land,
    inside,
    landShare: Number((land / inside).toFixed(4))
  };
}

async function openGlobe(browser, origin, { width, scale }) {
  const context = await browser.newContext({ deviceScaleFactor: scale, viewport: { width, height: 900 } });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", error => failures.push(String(error)));
  await page.goto(`${origin}/${PAGE}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#marketGlobeCanvas", { timeout: 30000 });
  // The globe animates: a short wait lets it paint the sphere the reader is looking at, not a blank frame.
  await page.waitForTimeout(1200);
  return { context, readout: await page.evaluate(globeReadout), failures };
}

test("the home page's globe is drawn as the Earth: coastlines over the ocean, in the box the page carries", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const width of [1440, 390]) {
      const { context, readout, failures } = await openGlobe(browser, origin, { width, scale: 1 });
      assert.equal(readout.present, true, `the home page must carry the globe canvas at ${width}px`);
      assert.equal(readout.drawsLand, true, "the globe code the page loaded must carry the coastline outlines");
      assert.equal(readout.box, `${SPHERE_BOX}x${SPHERE_BOX}`, `the sphere must stay the ${SPHERE_BOX}px box the markup and the stylesheet carry`);
      assert.ok(readout.landShare >= LAND_FLOOR, `the sphere must be drawn with land: ${(readout.landShare * 100).toFixed(1)}% of its pixels are land at ${width}px, the floor is ${LAND_FLOOR * 100}%`);
      assert.ok(readout.landShare <= LAND_CEILING, `the sphere must still read as an ocean with land on it: ${(readout.landShare * 100).toFixed(1)}% of its pixels are land at ${width}px`);
      assert.deepEqual(failures, [], `the page must load without a script error at ${width}px`);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});

test("the globe's bitmap is sized for the reader's own screen, and stops at twice the box", async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const scale of [1, 2, 3]) {
      const { context, readout, failures } = await openGlobe(browser, origin, { width: 1440, scale });
      const expected = SPHERE_BOX * Math.min(2, scale);
      assert.equal(readout.ratio, Math.min(2, scale), `the drawing ratio must be capped at 2 on a ${scale}x screen`);
      assert.equal(readout.bitmap, `${expected}x${expected}`, `on a ${scale}x screen the bitmap must be ${expected}px rather than the ${SPHERE_BOX}px one stretched up`);
      assert.equal(readout.box, `${SPHERE_BOX}x${SPHERE_BOX}`, "and the box the reader is served must not change with the screen");
      // The sharper bitmap must still carry the coastlines: the same sphere drawn finer, not a different one.
      assert.ok(readout.landShare >= LAND_FLOOR, `the sphere must still be drawn with land at ${scale}x: ${(readout.landShare * 100).toFixed(1)}% of its pixels are land`);
      assert.deepEqual(failures, [], `the page must load without a script error at ${scale}x`);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});
