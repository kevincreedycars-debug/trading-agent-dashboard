// One browser test for the Live Trade Logic tab, run against the real page and the real scripts.
//
// The tab is copy rather than computation, so what is asserted here is that the copy is where the rail says it
// is, that it renders when the tab is opened and not before, and that it still states the numbers the system
// actually holds: the five-to-one geometry is read out of `lib/l2l_strategy.js` (`REWARD_R_MULTIPLE`) and, on a
// tree that carries the live loop, the daily count and the hold are read out of the loop's own defaults
// (`DEFAULT_MAX_PER_DAY`, `DEFAULT_MAX_OPEN`, `DEFAULT_EXPIRE_MINUTES`) plus the registration script's parameter
// defaults, so a rule that changes without the page following it fails here. The tab is page work and can be
// released ahead of the loop, so on a tree that carries no loop yet the page is held to the rule's own published
// numbers instead; the lane, which carries the loop, always takes the strict branch. The two honesty cards are
// asserted by name: the walkthrough has to keep
// saying that a filled ticket is not evidence the rule makes money, and it has to keep naming the one machine
// fact that does not match the rule - the task registered before the per-pair hold, which still passes the older
// `--max-open 1`. The last case holds the tab to being read-only: nothing inside the view is a control, and
// opening it asks the network for nothing.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const strategy = require("../lib/l2l_strategy.js");

const repoRoot = path.resolve(__dirname, "..");
const loopPath = path.join(repoRoot, "scripts", "run-live-trading-trader.js");
const registerPath = path.join(repoRoot, "scripts", "register-live-trading-trader-task.ps1");

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

// The committed page and artifacts as they are, with no fixture: this tab reads nothing from a feed, so the
// page's own defaults are what is under test.
async function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.resolve(repoRoot, pathname.replace(/^\/+/, ""));
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    res.end(fs.readFileSync(filePath));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
  };
}

const WORDS = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight" };


// Where the tab sits in the rail, read from the rail itself rather than from a selector: the group label is the
// last one above the button, which is what "in the System section" means to a reader.
function railReadout() {
  const button = document.querySelector('.tab-button[data-tab="live-trade-logic"]');
  if (!button) return null;
  const rail = button.parentElement;
  const children = Array.from(rail.children);
  const tabs = children.filter(node => node.classList.contains("tab-button"));
  const group = children
    .slice(0, children.indexOf(button))
    .filter(node => node.classList.contains("side-rail-group"))
    .pop();
  return {
    label: (button.textContent || "").trim(),
    tabs: tabs.map(node => node.dataset.tab),
    index: tabs.indexOf(button),
    architectureIndex: tabs.findIndex(node => node.dataset.tab === "architecture"),
    group: group ? (group.textContent || "").trim() : null
  };
}

function logicReadout() {
  const view = document.getElementById("liveTradeLogicView");
  const panel = document.getElementById("liveTradeLogicPanel");
  const text = value => (value?.textContent || "").replace(/\s+/g, " ").trim();
  const cards = Array.from(panel.querySelectorAll(".live-trade-logic-card"));
  const card = name => cards.find(node => text(node.querySelector(".live-trade-logic-head h3")) === name);
  const rows = name => {
    const found = card(name);
    return found ? Array.from(found.querySelectorAll("li")).map(node => text(node.querySelector("b"))) : [];
  };
  const summary = card("The rule in one sentence");
  return {
    active: view.classList.contains("active-view"),
    display: window.getComputedStyle(view).display,
    cards: cards.map(node => text(node.querySelector(".live-trade-logic-head h3"))),
    tags: cards.map(node => text(node.querySelector(".live-trade-logic-tag"))),
    summary: summary ? text(summary.querySelector(".live-trade-logic-lead")) : "",
    steps: Array.from(panel.querySelectorAll(".live-trade-logic-steps li b")).map(text),
    stepsText: text(panel.querySelector(".live-trade-logic-steps")),
    endings: rows("How a trade ends"),
    endingsText: text(card("How a trade ends")),
    gates: rows("What has to be true before anything is sent"),
    gatesText: text(card("What has to be true before anything is sent")),
    limits: Array.from(panel.querySelectorAll(".live-trade-logic-limits li")).map(node => ({
      value: text(node.querySelector("b")),
      label: text(node.querySelector(".live-trade-logic-limit-label"))
    })),
    files: rows("Where this lives"),
    note: text(card("One thing is out of step on this machine")),
    caution: text(card("What this page does not claim")),
    controls: view.querySelectorAll("button, input, select, textarea, a, [contenteditable]").length
  };
}


test("the System section carries the live rule, and the tab renders the walkthrough only when it is opened", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });

    const rail = await page.evaluate(railReadout);
    assert.ok(rail, "the rail carries a Live Trade Logic tab");
    assert.equal(rail.label, "Live Trade Logic");
    assert.equal(rail.group, "System", "the tab sits in the rail's System section");
    assert.ok(rail.architectureIndex >= 0, "the Architecture tab is in the same rail");
    assert.ok(rail.index > rail.architectureIndex, "the rule tab follows Architecture");
    assert.equal(rail.index, rail.tabs.length - 1, "and it is the last entry of the System group");

    // A tab nobody has opened carries no copy and is not drawn: the walkthrough is built on the click.
    const closed = await page.evaluate(() => {
      const view = document.getElementById("liveTradeLogicView");
      return {
        active: view.classList.contains("active-view"),
        display: window.getComputedStyle(view).display,
        cards: document.querySelectorAll("#liveTradeLogicPanel .live-trade-logic-card").length
      };
    });
    assert.equal(closed.active, false);
    assert.equal(closed.display, "none", "an unopened view is not drawn");
    assert.equal(closed.cards, 0, "and its copy is not built before it is asked for");

    await page.click('.tab-button[data-tab="live-trade-logic"]');
    await page.waitForSelector("#liveTradeLogicPanel .live-trade-logic-steps li", { timeout: 20000 });
    const logic = await page.evaluate(logicReadout);

    assert.equal(logic.active, true);
    assert.notEqual(logic.display, "none", "the opened view is drawn");
    assert.deepEqual(logic.cards, [
      "The rule in one sentence",
      "Step by step",
      "How a trade ends",
      "What has to be true before anything is sent",
      "The account's own limits",
      "Where this lives",
      "One thing is out of step on this machine",
      "What this page does not claim"
    ]);
    // The steps are the rule's own order, so the walkthrough is asserted as a sequence rather than as a bag of
    // sentences: scope, direction, the hand-marked lines, the trigger, the three prices, then the ticket.
    assert.equal(logic.steps.length, 11);
    assert.equal(logic.steps[0], "Four markets, and no others");
    assert.equal(logic.steps[3], "A five-minute candle has to close through a line");
    assert.equal(logic.steps[4], "Three prices come out of that crossing");
    assert.equal(logic.steps[6], "One trade per market, and the other three stay free");
    assert.equal(logic.steps[10], "Nothing on this page can trade");
    // The tags are the short answers a reader scans for, and each card opens on the fact it carries.
    assert.ok(logic.tags.includes("One trade per market"));
    assert.ok(logic.tags.includes("Not a signal"));

    // The view travels with the rail the way the other views do: opening another tab closes it, and coming back
    // renders the same walkthrough rather than an empty panel.
    await page.click('.tab-button[data-tab="architecture"]');
    const moved = await page.evaluate(() => document.getElementById("liveTradeLogicView").classList.contains("active-view"));
    assert.equal(moved, false, "opening Architecture closes the rule view");
    await page.click('.tab-button[data-tab="live-trade-logic"]');
    const again = await page.evaluate(() => document.querySelectorAll("#liveTradeLogicPanel .live-trade-logic-card").length);
    assert.equal(again, 8, "and coming back renders the same walkthrough");
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the walkthrough states the rule's own numbers, and the module, the loop and the script still hold them", async () => {
  // The rule's geometry, from the module that computes it.
  assert.equal(strategy.REWARD_R_MULTIPLE, 5, "the target is five times the risk, which is what 'one fifth of the distance' means");
  // The loop's own defaults and the registration script's, read from those two files whenever the tree this runs
  // on carries them, which the lane does. The tab is page work and can be released on a tree that has no live loop
  // yet, so there the page is held to the rule's published numbers - four new trades a day, one per market - and to
  // the module's geometry above; a tree that carries the loop must match it exactly.
  const hasLoop = fs.existsSync(loopPath) && fs.existsSync(registerPath);
  let perDay = 4;
  if (hasLoop) {
    const loop = fs.readFileSync(loopPath, "utf8");
    perDay = Number((loop.match(/const DEFAULT_MAX_PER_DAY = (\d+);/) || [])[1]);
    const maxOpen = (loop.match(/const DEFAULT_MAX_OPEN = (null|\d+);/) || [])[1];
    const expiry = (loop.match(/const DEFAULT_EXPIRE_MINUTES = (null|\d+);/) || [])[1];
    assert.ok(Number.isInteger(perDay) && perDay > 0, "the loop states a daily count of new trades");
    assert.equal(maxOpen, "null", "and passes no cap of its own across markets: the one-trade-per-market hold is the cap");
    assert.equal(expiry, "null", "and no expiry, because the marked levels are permanent");
    // And the registration script's own defaults, which are what the rule asks a fresh task to be armed with.
    const register = fs.readFileSync(registerPath, "utf8");
    assert.match(register, /\[int\] \$MaxOpen = 0,/, "a freshly registered task passes no cap across markets");
    assert.match(register, new RegExp(`\\[int\\] \\$MaxPerDay = ${perDay},`), "and the same daily count the loop defaults to");
  } else {
    assert.equal(perDay, 4, "with no loop in this tree to read it from, the count is the rule's own: four, one per market");
  }

  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trade-logic"]');
    await page.waitForSelector("#liveTradeLogicPanel .live-trade-logic-steps li", { timeout: 20000 });
    const logic = await page.evaluate(logicReadout);

    // The four markets, named, and nothing else traded.
    assert.match(logic.stepsText, /EUR\/USD, gold \(XAUUSD\), the Nasdaq 100 \(US100\.cash\) and bitcoin \(BTCUSD\)/);
    // The geometry, stated in the two directions the module states it in.
    assert.match(logic.summary, /One resting order per market/);
    assert.match(logic.stepsText, /a fifth of the distance away/);
    assert.match(logic.stepsText, /five of reward/);
    // The hold, the lifetime and the size: the three facts a reader is most likely to have wrong.
    assert.match(logic.stepsText, /One trade per market, and the other three stay free/);
    assert.match(logic.stepsText, /The entry carries no time limit/);
    assert.match(logic.stepsText, /0\.01 lot/);
    // The day's count, in the words the page uses, held to the loop's own number rather than to a remembered one.
    assert.match(logic.gatesText, new RegExp(`${WORDS[perDay]} a day by default`, "i"));
    assert.match(logic.gatesText, /one per market/);
    // The endings are the loop's endings: the stop leaving the level active, the target spending it, the call
    // taking the ticket out, and a put-back being the same trade.
    assert.equal(logic.endings.length, 5);
    assert.match(logic.endingsText, /The stop is hit/);
    assert.match(logic.endingsText, /The level stays marked and active/);
    assert.match(logic.endingsText, /only has to be touched/);
    assert.match(logic.endingsText, /The day's call turns against the trade/);
    assert.match(logic.endingsText, /same trade offered again rather than a second one/);
    // The account's limits, and the note that they are FTMO's.
    assert.deepEqual(logic.limits.map(row => row.value), ["5%", "10%", "10%", "4", "1"]);
    assert.deepEqual(logic.limits.map(row => row.label), [
      "Daily loss cap",
      "Total loss cap",
      "Profit target",
      "Minimum trading days",
      "Automated systems"
    ]);
    // And the paths, so a reader can go from the page to the file that does the thing.
    assert.ok(logic.files.includes("scripts/run-live-trading-trader.js"));
    assert.ok(logic.files.includes("scripts/register-live-trading-trader-task.ps1"));
  } finally {
    await browser.close();
    await server.close();
  }
});


test("the walkthrough keeps both honesty cards: no edge claimed, and the machine fact that is out of step", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trade-logic"]');
    await page.waitForSelector("#liveTradeLogicPanel .live-trade-logic-card.caution", { timeout: 20000 });
    const logic = await page.evaluate(logicReadout);

    // The rule is not presented as an edge, and a traded ticket is not presented as a result.
    assert.match(logic.caution, /not a validated profit rule/);
    assert.match(logic.caution, /not evidence that the rule makes money/);
    assert.match(logic.caution, /arithmetic about the three prices rather than a win rate/);
    assert.match(logic.caution, /mechanical consequence of the rule/);
    assert.ok(logic.tags.includes("Not a signal"), "and the card is tagged as such");
    // The geometry is stated as one fifth of the distance and as five of reward, which is the same number twice:
    // neither is presented as a probability.
    assert.equal(strategy.REWARD_R_MULTIPLE, 5);

    // The hand cap is named as a hand cap rather than as the rule.
    assert.match(logic.gatesText, /A cap across all markets exists only for a run that passes one/);
    // And the one place this machine's task and the rule disagree is on the page, with the command that fixes
    // it: the task registered before the per-pair hold still carries the older cap.
    assert.match(logic.note, /2026-10-05/);
    assert.match(logic.note, /--max-open 1/);
    assert.match(logic.note, /scripts\/register-live-trading-trader-task\.ps1 -Arm/);
    assert.match(logic.note, /one working ticket across all four markets/);
    assert.ok(logic.tags.includes("Machine state, not the rule"), "and it is tagged as machine state");
    // The claim is not the page's word alone where the tree carries the script it names: that script defaults to no
    // cap and to the daily count the rule states, so re-running it is what moves the task onto the per-pair hold. A
    // tree released without the live loop keeps the page's own words as the record instead.
    if (fs.existsSync(registerPath)) {
      const register = fs.readFileSync(registerPath, "utf8");
      assert.match(register, /\[int\] \$MaxOpen = 0,/);
      assert.match(register, /one ticket per pair, no cap across pairs/);
    } else {
      assert.match(logic.note, /takes the current rule/);
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the tab is read-only: nothing inside the view is a control, and opening it sends nothing", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });

    // Everything the page asks for after the tab is clicked. The dashboard refetches its own snapshots on a
    // cadence, so what is asserted is not "no requests at all" but "nothing on the order path": no bridge, no
    // order tool, no terminal, and no write of any kind.
    const requested = [];
    page.on("request", request => requested.push({ url: request.url(), method: request.method() }));
    await page.click('.tab-button[data-tab="live-trade-logic"]');
    await page.waitForSelector("#liveTradeLogicPanel .live-trade-logic-steps li", { timeout: 20000 });
    const logic = await page.evaluate(logicReadout);

    assert.equal(logic.controls, 0, "the walkthrough carries no button, field, link or editable region");
    assert.deepEqual(
      requested.filter(entry => entry.method !== "GET"),
      [],
      "opening the tab writes nothing"
    );
    assert.deepEqual(
      requested.filter(entry => /\/order|mt5|bridge|cancel|place/i.test(entry.url)),
      [],
      "and reaches no order path"
    );
    // The page says so itself, in the step a reader is most likely to wonder about.
    assert.match(logic.stepsText, /No control on the dashboard can place, change or close a trade/);
  } finally {
    await browser.close();
    await server.close();
  }
});


// The widths the page's own layout guards use, plus the two sides of this tab's own breakpoint: the labelled row
// layout only has room for its label column from 900px up, so 900 and 899 are both checked.
const WIDTHS = [1440, 1180, 900, 899, 768, 390];

test("the walkthrough holds its shape from a wide window down to a phone", async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-trade-logic"]');
    await page.waitForSelector("#liveTradeLogicPanel .live-trade-logic-steps li", { timeout: 20000 });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const measured = await page.evaluate(() => {
        const panel = document.getElementById("liveTradeLogicPanel");
        const row = panel.querySelector(".live-trade-logic-rows li");
        const overflowing = [];
        for (const node of panel.querySelectorAll("*")) {
          if (node.scrollWidth > node.clientWidth + 1) {
            overflowing.push(`${node.className || node.tagName}: ${node.scrollWidth} in ${node.clientWidth}`);
          }
        }
        const style = window.getComputedStyle(row);
        return {
          sideways: document.documentElement.scrollWidth > window.innerWidth,
          overflowing,
          columns: style.gridTemplateColumns.trim().split(/\s+/).length,
          cards: panel.querySelectorAll(".live-trade-logic-card").length,
          steps: panel.querySelectorAll(".live-trade-logic-steps li").length,
          limits: panel.querySelectorAll(".live-trade-logic-limits li").length,
          endings: panel.querySelectorAll(".live-trade-logic-card")[2].querySelectorAll("li").length,
          gates: panel.querySelectorAll(".live-trade-logic-card")[3].querySelectorAll("li").length,
          files: panel.querySelectorAll(".live-trade-logic-card")[5].querySelectorAll("li").length,
          widest: Math.max(...Array.from(panel.querySelectorAll("*")).map(node => node.getBoundingClientRect().width))
        };
      });

      assert.equal(measured.sideways, false, `at ${width}px the page must not scroll sideways`);
      assert.deepEqual(measured.overflowing, [], `at ${width}px no line of the walkthrough may outgrow its card`);
      assert.equal(measured.cards, 8, `at ${width}px all eight cards stand`);
      assert.equal(measured.steps, 11, `at ${width}px the eleven steps stand`);
      assert.equal(measured.limits, 5, `at ${width}px the five account limits stand`);
      assert.equal(measured.endings, 5, `at ${width}px the five endings stand`);
      assert.equal(measured.gates, 7, `at ${width}px the seven gates stand`);
      assert.equal(measured.files, 6, `at ${width}px the six paths stand`);
      // The labelled rows are one column on a narrow window and two from 900px up, which is the one thing the
      // tab's own stylesheet decides about the layout.
      assert.equal(measured.columns, width >= 900 ? 2 : 1, `at ${width}px the row label sits ${width >= 900 ? "beside" : "above"} its line`);
      assert.ok(measured.widest <= width, `at ${width}px nothing in the walkthrough is wider than the window`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

