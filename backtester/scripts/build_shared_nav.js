'use strict';

// Renders the shared navigation block from backtester/partials/shared_nav.html into the published pages,
// so the twelve copies cannot drift apart again.
//
//   node backtester/scripts/build_shared_nav.js --check            verify every page carries the render
//   node backtester/scripts/build_shared_nav.js --write            place or refresh the block
//   node backtester/scripts/build_shared_nav.js --print dashboard  print one variant
//   node backtester/scripts/build_shared_nav.js --print standalone
//
// --check is the mode the guard suite and any release check should use: it compares bytes, not shape, so a
// hand-edited copy, a stale copy or a copy with one extra link all fail. --write is idempotent.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PARTIAL = path.join(ROOT, 'backtester', 'partials', 'shared_nav.html');
const START = '<!-- SHARED-NAV:START -->';
const END = '<!-- SHARED-NAV:END -->';
const PART = /^<!-- SHARED-NAV:PART ([a-z-]+) -->$/;

// The order the parts are written into a page. The CSS comes last inside the block: it is parsed before the
// page's own content is, and putting it last keeps the block from becoming a page's first child.
const ORDER = {
  dashboard: ['bar-dashboard', 'frame-open', 'rail-dashboard', 'css'],
  standalone: ['bar-standalone', 'rail-standalone', 'css'],
};

// The twelve published pages. "place" says what a first placement does: index.html already carries a bar and a
// rail, so its anchor is the whole span they occupy, from the line break before the bar to the line break
// after the rail, and the block replaces it rather than joining it. The other ten carry neither, so the
// block goes in under the body tag and nothing already on the page moves. Once a page carries the markers
// the anchor is never consulted again.
const PAGES = [
  { file: 'index.html', variant: 'dashboard', place: { mode: 'replace', pattern: /\r?\n {2}<header class="topbar">[\s\S]*?<\/aside>\r?\n/ } },
  { file: 'gold.html', variant: 'standalone', place: { mode: 'after', pattern: /<body\b[^>]*>/ } },
  { file: 'dashboard-northstar.html', variant: 'standalone', place: { mode: 'after', pattern: /<body\b[^>]*>/ } },
  { file: 'standing-dashboard.html', variant: 'standalone', place: { mode: 'after', pattern: /<body\b[^>]*>/ } },
  { file: 'backtest-flow.html', variant: 'standalone', place: { mode: 'after', pattern: /<body\b[^>]*>/ } },
  { file: 'gold-direction-scorecard.html', variant: 'standalone', place: { mode: 'after', pattern: /<body\b[^>]*>/ } },
  { file: 'gold-backtest-outcomes.html', variant: 'standalone', place: { mode: 'after', pattern: /<body\b[^>]*>/ } },
  { file: 'gold-backtesting.html', variant: 'standalone', place: { mode: 'after', pattern: /<body\b[^>]*>/ } },
  { file: 'gold-factor-wip.html', variant: 'standalone', place: { mode: 'after', pattern: /<body\b[^>]*>/ } },
  { file: 'what-moves-gold.html', variant: 'standalone', place: { mode: 'after', pattern: /<body\b[^>]*>/ } },
  // Added 2026-10-04, the eleventh page: the printable call map was written as a sheet with no navigation of
  // its own, and the bar and the rail reached it from the other pages. It is a page a reader navigates from
  // now, so it carries the block like every other standalone page, and its own print block takes the bar and
  // the rail off the printed sheet, so what a reader prints is still the map alone on one page.
  { file: 'layer1-call-flow.html', variant: 'standalone', place: { mode: 'after', pattern: /<body\b[^>]*>/ } },
  // Added 2026-10-08, the twelfth page: the USD one-pager is the printable sheet for the USD Layer 1 call, the
  // USD-only twin of the call map, so it carries the block like the map and its own print block takes the bar and
  // the rail back off the sheet.
  { file: 'usd-layer1-call-flow.html', variant: 'standalone', place: { mode: 'after', pattern: /<body\b[^>]*>/ } },
];

function readParts() {
  const parts = {};
  let current = null;
  fs.readFileSync(PARTIAL, 'utf8').split('\n').forEach(line => {
    const match = PART.exec(line.trim());
    if (match) {
      current = match[1];
      parts[current] = [];
      return;
    }
    if (current) parts[current].push(line.replace(/\r$/, ''));
  });
  Object.keys(parts).forEach(name => {
    const lines = parts[name];
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    parts[name] = lines.join('\n');
  });
  return parts;
}

function renderBlock(variant, eol = '\n') {
  const names = ORDER[variant];
  if (!names) throw new Error(`unknown variant: ${variant}`);
  const parts = readParts();
  const missing = names.filter(name => !parts[name]);
  if (missing.length) throw new Error(`backtester/partials/shared_nav.html is missing: ${missing.join(', ')}`);
  // The leading and trailing newlines belong to the block, so a page's own line breaks stay outside it.
  // The ending follows the page the block goes into, so a CRLF page stays all CRLF.
  const block = `\n${START}\n${names.map(name => parts[name]).join('\n')}\n${END}\n`;
  return eol === '\n' ? block : block.split('\n').join(eol);
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

function findRegion(source) {
  if (source.split(START).length - 1 !== 1 || source.split(END).length - 1 !== 1) return null;
  const start = source.indexOf(START);
  const end = source.indexOf(END) + END.length;
  const from = source.slice(0, start).replace(/\r?\n$/, '').length;
  const to = source.startsWith('\r\n', end) ? end + 2 : source[end] === '\n' ? end + 1 : end;
  // A block that owns neither of its surrounding line breaks is half a block: refuse rather than guess.
  if (from === start || to === end) return null;
  return { text: source.slice(from, to), start: from, end: to };
}

function applyPage(source, page) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const block = renderBlock(page.variant, eol);
  const region = findRegion(source);
  if (region) {
    return normalize(region.text) === normalize(block)
      ? { next: source, action: 'current' }
      : { next: source.slice(0, region.start) + block + source.slice(region.end), action: 'refreshed' };
  }
  const found = source.match(page.place.pattern);
  const hits = source.match(new RegExp(page.place.pattern.source, 'g'));
  if (!found || !hits || hits.length !== 1) {
    throw new Error(`${page.file}: no SHARED-NAV markers and the placement anchor matched ${hits ? hits.length : 0} times, expected 1`);
  }
  if (page.place.mode === 'replace') {
    const at = source.indexOf(found[0]);
    return { next: source.slice(0, at) + block + source.slice(at + found[0].length), action: 'placed' };
  }
  // The block starts on the line after the body tag and ends before whatever the page opens with, whether
  // that tag is alone on its line or shares it with the page's first block.
  const at = source.indexOf(found[0]) + found[0].length;
  return { next: source.slice(0, at) + block + source.slice(at), action: 'placed' };
}

// The two variants must stay one navigation, not two: same bar but for the live spans, same rail but for
// the way an entry is driven. These checks fail loudly here rather than quietly in eleven pages.
function selfChecks() {
  const parts = readParts();
  const liveSpans = /\n? {0,6}<span id="currentDate">[\s\S]*?UK --:-- \| ET --:--<\/span>/;
  if (!liveSpans.test(parts['bar-dashboard'])) {
    throw new Error('bar-dashboard must carry the two live spans (currentDate and topbarClock)');
  }
  const dashboardBar = parts['bar-dashboard'].replace(liveSpans, '');
  if (dashboardBar !== parts['bar-standalone']) {
    throw new Error('bar-dashboard must differ from bar-standalone only by the two live spans');
  }
  // The outbound entries are not tabs: they leave the dashboard set for a page of their own, so both variants
  // write them as links and they are held out of the entry comparison below.
  const dashboardTabs = withoutOutbound(parts['rail-dashboard']);
  const standaloneLinks = withoutOutbound(parts['rail-standalone']);
  const dashboardEntries = entriesOf(dashboardTabs, 'data-tab="([^"]+)"');
  const standaloneEntries = entriesOf(standaloneLinks, 'href="([^"]+)"');
  const expected = dashboardEntries.map(({ label, target }) => ({
    label,
    target: target === 'GOLD' ? 'gold.html#direction' : `index.html#${target}`,
  }));
  if (JSON.stringify(standaloneEntries) !== JSON.stringify(expected)) {
    throw new Error('the two rail variants must offer the same entries in the same order');
  }
  if (dashboardEntries.length !== 17) {
    throw new Error(`the rail must offer the 17 dashboard tabs, found ${dashboardEntries.length}`);
  }
  const dashboardOutbound = outboundOf(parts['rail-dashboard']);
  const standaloneOutbound = outboundOf(parts['rail-standalone']);
  if (JSON.stringify(dashboardOutbound) !== JSON.stringify(standaloneOutbound)) {
    throw new Error('the two rail variants must offer the same outbound entries in the same order');
  }
  if (!dashboardOutbound.length) {
    throw new Error('the rail must keep its outbound entries to the printable call maps');
  }
  if (/data-tab=/.test(standaloneLinks) || /\bhref=/.test(dashboardTabs)) {
    throw new Error('the standalone rail must be plain links and the dashboard rail must be data-tab buttons');
  }
  ['dashboard', 'standalone'].forEach(variant => {
    const block = renderBlock(variant);
    if (/<(link|script|img|iframe|source|object|embed)\b/i.test(block) || /@import|\burl\(/i.test(block)) {
      throw new Error(`${variant}: the block must not pull in anything from outside the page`);
    }
  });
  if (/id="agentTabs"/.test(parts['rail-standalone'])) {
    throw new Error('only the dashboard rail may own the agentTabs id');
  }
  return { entries: dashboardEntries, outbound: dashboardOutbound };
}

function entriesOf(rail, targetPattern) {
  const pattern = new RegExp(`<(?:button|a)\\b[^>]*${targetPattern}[^>]*>([^<]+)</(?:button|a)>`, 'g');
  return Array.from(rail.matchAll(pattern), match => ({ label: match[2].trim(), target: match[1] }));
}

// The rail's outbound entries: the one kind of rail entry that leaves the dashboard set for a page of its own.
// Both variants must write them the same way, in one line, or this file cannot read them back and the guard
// cannot pin them. They are links in both variants, so they never carry a data-tab.
const OUTBOUND = /^ *<a class="side-rail-link" href="([^"]+)" target="_top">([^<]+)<\/a>$/gm;

function outboundOf(rail) {
  return Array.from(rail.matchAll(OUTBOUND), match => ({ label: match[2].trim(), target: match[1] }));
}

function withoutOutbound(rail) {
  return rail.replace(OUTBOUND, '');
}

function main(argv) {
  const mode = argv[0] || '--check';
  if (mode === '--print') {
    process.stdout.write(renderBlock(argv[1] || 'dashboard'));
    return;
  }
  if (mode !== '--check' && mode !== '--write') {
    throw new Error('usage: build_shared_nav.js [--check|--write|--print <dashboard|standalone>]');
  }
  const { entries, outbound } = selfChecks();
  let changes = 0;
  PAGES.forEach(page => {
    const file = path.join(ROOT, page.file);
    const result = applyPage(fs.readFileSync(file, 'utf8'), page);
    if (result.action !== 'current') {
      changes += 1;
      if (mode === '--write') fs.writeFileSync(file, result.next);
    }
    console.log(`${page.file} [${page.variant}]: ${result.action}`);
  });
  console.log(`${mode}: ${PAGES.length} pages, ${entries.length} rail entries, ${outbound.length} outbound, ${changes} change(s)`);
  if (mode === '--check' && changes) process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2).filter(argument => argument !== '--'));

module.exports = { ROOT, PARTIAL, START, END, PAGES, ORDER, readParts, renderBlock, findRegion, applyPage };
