/*
  Backtest Engine v2 - the control room's reader.

  Nothing on this page is a typed-in figure. The page loads one hand-written view manifest
  (backtester/assets/backtest-engine-v2.manifest.json), which names the published artefacts and says how
  each step is judged, then loads those artefacts and renders what they say. A step the artefacts do not
  describe is drawn as unknown, never as complete, and an artefact that will not load leaves its step
  unknown rather than blank.

  Rules are read in the order the manifest writes them and the first one that matches wins, so the
  precedence between "blocked", "complete" and the fallback is the manifest's, not this file's.
*/
(() => {
  "use strict";

  const MANIFEST_URL = "backtester/assets/backtest-engine-v2.manifest.json";
  const STATE_RANK = ["blocked", "stale", "pending", "unknown", "complete"];
  // The manifest declares the readiness dimensions and may give a step a default for one it does not write.
  // The fallback keeps a manifest written before that block readable rather than blank.
  const FALLBACK_DIMENSIONS = [
    ["software", "Software", "Sof"],
    ["data", "Data", "Dat"],
    ["research", "Research", "Res"]
  ];
  const FLOW = { zoom: 1, selection: null, manifest: null, sources: {}, loaded: 0, failed: [] };

  function dimensions() {
    const declared = (FLOW.manifest && FLOW.manifest.dimensions) || [];
    if (!declared.length) return FALLBACK_DIMENSIONS;
    return declared.map(entry => [entry.key, entry.label, entry.short || entry.label.slice(0, 3)]);
  }

  function dimensionOf(node, key) {
    const own = node.readiness && node.readiness[key];
    if (own) return own;
    const defaults = (FLOW.manifest && FLOW.manifest.defaults && FLOW.manifest.defaults.readiness) || {};
    return defaults[key] || null;
  }

  // --- Fetching ---------------------------------------------------------
  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
  }

  // --- Reading a path ---------------------------------------------------
  // "evidence.claims.consistency.status", "retrieval.capture_corpus.entries",
  // "evidence.workflows.children[0].url", "freshcall.live_call.child_executions[model=challenger].id"
  // and "evidence.workflows.children.length" all read the same way: a bracketed number indexes an array,
  // and a bracketed "field=value" picks the first record whose field carries that value.
  function segments(path) {
    return String(path)
      .replace(/\[(\d+)\]/g, ".$1.")
      .replace(/\[([^\[\]]+)\]/g, ".$1.")
      .split(".")
      .filter(Boolean);
  }

  function walk(value, path) {
    if (!path) return undefined;
    let cursor = value;
    for (const part of segments(path)) {
      if (cursor === null || cursor === undefined) return undefined;
      if (Array.isArray(cursor) && /^\d+$/.test(part)) {
        cursor = cursor[Number(part)];
        continue;
      }
      if (Array.isArray(cursor) && part.includes("=")) {
        const [field, ...rest] = part.split("=");
        const wanted = rest.join("=");
        cursor = cursor.find(item => item && String(item[field]) === wanted);
        continue;
      }
      cursor = cursor[part];
    }
    return cursor;
  }

  function readPath(path, sources) {
    const parts = segments(path);
    const root = parts.shift();
    if (!(root in sources)) return undefined;
    return walk(sources[root], parts.join("."));
  }

  // A source's own verification stamp is read inside that artefact, not through the source map, so a
  // missing field is simply a missing timestamp rather than a failed lookup.
  function readWithin(value, path) {
    return walk(value, path);
  }

  // --- Formatting -------------------------------------------------------
  const COUNT = new Intl.NumberFormat("en-GB");
  const STAMP = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  });

  function formatValue(value, format) {
    if (value === undefined || value === null || value === "") return null;
    if (format === "count") {
      const number = Number(value);
      return Number.isFinite(number) ? COUNT.format(number) : String(value);
    }
    if (format === "datetime") {
      const at = new Date(value);
      return Number.isNaN(at.getTime()) ? String(value) : STAMP.format(at);
    }
    if (format === "boolean") return value ? "Yes" : "No";
    if (format === "bytes") {
      const bytes = Number(value);
      if (!Number.isFinite(bytes)) return String(value);
      if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      if (bytes >= 1024) return `${Math.round(bytes / 1024)} kB`;
      return `${COUNT.format(bytes)} B`;
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.map(item => String(item)).join(", ");
    if (typeof value === "number") return COUNT.format(value);
    if (typeof value === "object") return null;
    return String(value);
  }

  const TEMPLATE = /\{\{\s*([^}|]+?)\s*(?:\|([a-z]+))?\s*\}\}/g;

  // A note is only printed when every value it quotes exists: a sentence with a hole in it would read as
  // a claim nobody made.
  function interpolate(text, sources) {
    if (typeof text !== "string") return null;
    let complete = true;
    const out = text.replace(TEMPLATE, (_, path, format) => {
      const rendered = formatValue(readPath(path.trim(), sources), format);
      if (rendered === null) complete = false;
      return rendered === null ? "" : rendered;
    });
    return complete ? out : null;
  }

  function metricValue(metric, sources) {
    if (typeof metric.value === "string" && metric.value.includes("{{")) {
      return interpolate(metric.value, sources);
    }
    if (metric.path) return formatValue(readPath(metric.path, sources), metric.format);
    return interpolationOfLiteral(metric.value, sources);
  }

  function interpolationOfLiteral(value, sources) {
    return typeof value === "string" ? interpolate(value, sources) : null;
  }

  // --- Rule precedence --------------------------------------------------
  function test(rule, sources) {
    const { path, op, value } = rule.if || {};
    const actual = readPath(path, sources);
    if (op === "exists") return actual !== undefined && actual !== null;
    if (op === "eq") {
      if (typeof value === "boolean") return actual === value;
      if (typeof value === "number") return Number(actual) === value;
      return actual === value;
    }
    if (op === "gt") {
      const number = Number(actual);
      return Number.isFinite(number) && number > Number(value);
    }
    if (op === "eqPath") {
      const other = readPath(value, sources);
      if (actual === undefined || other === undefined) return false;
      return String(actual) === String(other);
    }
    if (op === "olderThanPath") {
      const at = Date.parse(actual);
      const other = Date.parse(readPath(value, sources));
      return Number.isFinite(at) && Number.isFinite(other) && at < other;
    }
    return false;
  }

  function readiness(dimension, sources) {
    const rules = (dimension && dimension.rules) || [];
    // An artefact that would not load cannot be judged: the step reads unknown rather than falling through
    // to whatever the last rule happens to say.
    const unreadable = rules.some(rule => {
      if (!rule.if) return false;
      if (FLOW.failed.includes(String(rule.if.path || "").split(/[.[]/)[0])) return true;
      return rule.if.op === "eqPath" && FLOW.failed.includes(String(rule.if.value || "").split(/[.[]/)[0]);
    });
    if (unreadable) return "unknown";
    for (const rule of rules) {
      if (!rule.if) return rule.state;
      if (test(rule, sources)) return rule.state;
    }
    return "unknown";
  }

  // One step's state is the first state it can claim, worst first: blocked, stale, pending, unknown,
  // complete. A step whose dimensions are all deliberately not counted reads inactive. The dimensions
  // themselves are always shown unsummarised in the panel, so the badge never hides a stronger
  // statement than the one it makes.
  function stepState(node) {
    const states = dimensions().map(([key]) => readiness(dimensionOf(node, key), FLOW.sources));
    if (states.every(state => state === "inactive")) return { state: "inactive", dimensions: states };
    return { state: STATE_RANK.find(candidate => states.includes(candidate)) || "unknown", dimensions: states };
  }

  // --- Small DOM helpers ------------------------------------------------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function legendLabel(state) {
    const entry = (FLOW.manifest.legend || []).find(item => item.state === state);
    return entry ? entry.label : state;
  }

  function chip(state, extraClass) {
    const node = el("span", extraClass ? `cr-chip ${extraClass}` : "cr-chip", legendLabel(state));
    node.dataset.state = state;
    return node;
  }

  function resolution(path) {
    if (!path) return [];
    if (typeof path !== "string") return Array.isArray(path) ? path : [];
    const value = readPath(path, FLOW.sources);
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return [value];
    return [];
  }

  // A list item may be a plain sentence or a small record; both are printed as the sentence they carry.
  function sentence(item) {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      return item.text || item.statement || item.label || item.action || item.note || null;
    }
    return null;
  }

  function nodeOrder(node) {
    return FLOW.manifest.nodes.findIndex(candidate => candidate.id === node.id) + 1;
  }

  function bandOf(node) {
    return (FLOW.manifest.bands || []).find(band => band.id === node.band) || { label: node.band };
  }

  // Presentation groups are deliberately separate from the evidence manifest.
  // No workflow, readiness rule or research result is changed by this view.
  const VIEW = [
    {id:"strategy", title:"Layer 1 strategy", band:"inputs", icon:"layers", plug:true, members:["registry","rulebook","challenger-v0","challenger-v1","fixture"], summary:"Choose the versioned strategy to test. Its rules and required inputs travel with it."},
    {id:"required", title:"Required inputs", band:"inputs", icon:"database", plug:true, members:["sources","rulebook"], summary:"The selected strategy declares the factors it needs. Input preparation must check each required factor for every morning in the selected period."},
    {id:"history", title:"Historical data", band:"inputs", icon:"database", members:["panel","sources"], summary:"Prepare the historical inputs for each morning, keeping source availability and missing data visible."},
    {id:"validate", title:"Validate inputs", band:"core", icon:"shield", members:["sources"], summary:"Check completeness, source identity and availability at the decision cutoff. An incomplete morning must be blocked rather than filled with guessed values."},
    {id:"blocked", title:"Blocked", band:"core", icon:"blocked", members:["sources"], summary:"Inspect what prevents a morning from passing. This branch shows validation refusals, not a running workflow."},
    {id:"call", title:"Generate call", band:"core", icon:"code", members:["controller","freshcall","challenger-v0","challenger-v1"], summary:"Run the selected Layer 1 logic to produce a directional call. Inspect the recorded executions and the fresh-call proof below."},
    {id:"matrix", title:"Market × test matrix", band:"compare", icon:"grid", members:["outcomes"], summary:"Apply all three tests to each selected market: directional accuracy, original L2L 5R and 0.5 L2L 3R. Missing history remains a blocker, never a zero result."},
    {id:"prices", title:"Outcomes data", band:"compare", icon:"chart", members:["outcomes"], summary:"Prices, historical levels and execution tape feed outcome evaluation. These future outcomes must not feed the earlier directional decision."},
    {id:"baseline", title:"Compare with baseline", band:"compare", icon:"scale", members:["reproduction","evidence"], summary:"Compare the candidate and baseline on comparable dates and tests. Replay agreement alone does not demonstrate improved predictive accuracy."},
    {id:"results", title:"Results dashboard", band:"compare", icon:"screen", members:["evidence","outcomes"], summary:"Review results, coverage and limitations together. Software verification does not mean the historical data is complete or that a predictive edge exists."}
  ];
  const CONNECTIONS = [
    ["strategy","history"],["required","history"],["history","validate"],
    ["validate","blocked","side"],["validate","call"],["call","matrix"],
    ["prices","matrix","left"],["matrix","baseline"],["baseline","results"]
  ];
  const ICONS = {
    layers:'<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5"/>',
    database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    shield:'<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
    blocked:'<circle cx="12" cy="12" r="9"/><path d="m6 18 12-12"/>',
    code:'<path d="m7 5-6 7 6 7m10-14 6 7-6 7M14 3l-4 18"/>',
    grid:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>',
    chart:'<path d="M4 20V12m6 8V4m6 16V9m6 11V1"/>',
    scale:'<path d="M12 2v19M6 22h12M3 6h18M5 6l-4 9h8L5 6Zm14 0-4 9h8l-4-9Z"/>',
    screen:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v5m-6 0h12"/>'
  };
  function icon(name) {
    const wrap=el("span","cr-icon");
    wrap.innerHTML=`<svg viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.grid}</svg>`;
    return wrap;
  }
  function members(view) { return view.members.map(id => FLOW.manifest.nodes.find(n=>n.id===id)).filter(Boolean); }
  function viewState(view) {
    const states=members(view).map(n=>stepState(n).state);
    return STATE_RANK.find(s=>states.includes(s)) || "unknown";
  }
  function renderNodes() {
    const host=document.getElementById("crBands"); host.textContent="";
    [["inputs","Configurable inputs"],["core","Fixed core"],["compare","Test & compare"]].forEach(([id,label])=>{
      const section=el("section","cr-band"); section.dataset.band=id;
      section.append(el("h2","cr-band-label",label));
      const grid=el("div","cr-grid");
      VIEW.filter(v=>v.band===id).forEach(v=>{
        const button=el("button","cr-node"); button.type="button";
        button.dataset.node=v.id; button.dataset.state=viewState(v);
        button.dataset.kind=v.plug?"replaceable":"core";
        button.setAttribute("aria-pressed","false");
        button.append(icon(v.icon));
        const text=el("span","cr-node-copy"); text.append(el("span","cr-node-title",v.title));
        if(v.id==="matrix") text.append(el("span","cr-node-subtitle","Each selected market · 3 tests"));
        text.append(chip(viewState(v))); button.append(text);
        if(v.plug) button.append(el("span","cr-badge","Plug-in"));
        if(v.id==="matrix") {
          const tests=el("span","cr-test-chips");
          ["Direction","L2L 5R","0.5 L2L 3R"].forEach(t=>tests.append(el("span",null,t)));
          button.append(tests);
        }
        button.addEventListener("click",()=>select(v.id)); grid.append(button);
      });
      section.append(grid); host.append(section);
    });
  }
  function markSelection() {
    document.querySelectorAll(".cr-node").forEach(n=>{
      const selected=n.dataset.node===FLOW.selection;
      n.classList.toggle("is-selected",selected); n.setAttribute("aria-pressed",String(selected));
    });
  }
  // --- The inspector ----------------------------------------------------
  function block(title) {
    const box = el("section", "cr-block");
    box.append(el("h3", "cr-block-title", title));
    return box;
  }

  function readability(node) {
    const box = block("Readiness");
    const list = el("div", "cr-readiness");
    dimensions().forEach(([key, name]) => {
      const dimension = dimensionOf(node, key);
      if (!dimension) return;
      const row = el("div", "cr-readiness-row");
      row.dataset.dimension = key;
      const head = el("div", "cr-readiness-head");
      head.append(el("span", "cr-readiness-name", name), chip(readiness(dimension, FLOW.sources)));
      row.append(head);
      const note = interpolate(dimension.note, FLOW.sources);
      if (note) row.append(el("p", "cr-readiness-note", note));
      const quote = dimension.quote && interpolate(dimension.quote.path.includes("{{")
        ? dimension.quote.path
        : `{{${dimension.quote.path}}}`, FLOW.sources);
      if (quote) {
        const cited = el("blockquote", "cr-quote", `\u201c${quote}\u201d`);
        const source = (FLOW.manifest.sources || {})[dimension.quote.from];
        cited.append(el("cite", null, source ? source.label : dimension.quote.from));
        row.append(cited);
      }
      list.append(row);
    });
    box.append(list);
    return box;
  }

  function readableMetrics(node) {
    const rows = (node.metrics || [])
      .map(metric => ({ label: metric.label, value: metricValue(metric, FLOW.sources) }))
      .filter(metric => metric.value !== null && metric.value !== undefined);
    if (!rows.length) return null;
    const box = block("Figures the artefact states");
    const list = el("dl", "cr-metrics");
    rows.forEach(metric => {
      const line = el("div", "cr-metric");
      line.append(el("dt", null, metric.label), el("dd", null, metric.value));
      list.append(line);
    });
    box.append(list);
    return box;
  }

  function readableIo(node) {
    const io = node.io || {};
    if (!io.in && !io.out) return null;
    const box = block("Takes in, hands on");
    const wrap = el("div", "cr-io");
    [["in", "Reads"], ["out", "Leaves"]].forEach(([key, name]) => {
      if (!io[key] || !io[key].length) return;
      const group = el("div", "cr-io-group");
      group.append(el("span", "cr-io-name", name));
      const list = el("ul");
      io[key].forEach(item => list.append(el("li", null, interpolate(item, FLOW.sources) || item)));
      group.append(list);
      wrap.append(group);
    });
    box.append(wrap);
    return box;
  }

  function readableTests(node) {
    if (!node.tests || !node.tests.length) return null;
    const box = block("The tests behind the numbers");
    const list = el("div", "cr-tests");
    node.tests.forEach(entry => {
      const status = String(interpolate(entry.status, FLOW.sources) || "").trim();
      const row = el("div", "cr-test");
      if (status) row.dataset.status = status.toLowerCase().replace(/\s+/g, "_");
      row.append(el("span", "cr-test-dot"));
      const text = el("div", "cr-test-text");
      text.append(el("p", "cr-test-title", interpolate(entry.title, FLOW.sources) || entry.title));
      const note = interpolate(entry.note, FLOW.sources);
      if (note) text.append(el("p", "cr-test-note", note));
      row.append(text);
      list.append(row);
    });
    box.append(list);
    return box;
  }

  function readableClaims(node) {
    if (!node.claims || !node.claims.length) return null;
    const box = block(node.claims_title || "What the evidence claims, and does not");
    const list = el("div", "cr-claims");
    node.claims.forEach(entry => {
      const status = String(interpolate(entry.status, FLOW.sources) || "").trim();
      const row = el("div", "cr-claim");
      const head = el("div", "cr-claim-head");
      head.append(el("span", "cr-claim-name", interpolate(entry.label, FLOW.sources) || entry.label));
      const badge = el("span", "cr-claim-status", status.replace(/_/g, " "));
      if (status) badge.dataset.state = status.toLowerCase().replace(/\s+/g, "_");
      head.append(badge);
      row.append(head);
      const note = interpolate(entry.note, FLOW.sources);
      if (note) row.append(el("p", "cr-claim-note", note));
      list.append(row);
    });
    box.append(list);
    return box;
  }

  function readableList(node, path, title, extraClass) {
    const items = resolution(path).map(sentence).filter(Boolean);
    if (!items.length) return null;
    const box = block(title);
    const list = el("ul", extraClass ? `cr-list ${extraClass}` : "cr-list");
    items.forEach(item => list.append(el("li", null, interpolate(item, FLOW.sources) || item)));
    box.append(list);
    return box;
  }

  // A link may name a source instead of spelling a path, so the artefact's address is declared once in
  // `sources` and every link that cites it follows the same declaration.
  function linkTarget(link) {
    if (link.source) {
      const source = (FLOW.manifest.sources || {})[link.source];
      if (!source) return null;
      return {
        label: link.label || source.label,
        href: interpolate(source.url, FLOW.sources),
        kind: link.kind || "artefact"
      };
    }
    return { label: link.label, href: interpolate(link.href, FLOW.sources), kind: link.kind || "page" };
  }

  function readableLinks(node) {
    const links = (node.links || [])
      .map(linkTarget)
      .filter(link => link && link.href);
    if (!links.length) return null;
    const box = block("Where it is written down");
    const list = el("div", "cr-links");
    links.forEach(link => {
      const anchor = el("a", "cr-link", link.label);
      anchor.href = link.href;
      anchor.dataset.kind = link.kind;
      if (link.kind !== "page") {
        anchor.target = "_blank";
        anchor.rel = "noreferrer noopener";
      }
      list.append(anchor);
    });
    box.append(list);
    return box;
  }

  function renderInspector(node) {
    const kicker = document.getElementById("crInspectorKicker");
    const title = document.getElementById("crInspectorTitle");
    const role = document.getElementById("crInspectorRole");
    const body = document.getElementById("crInspectorBody");
    if (!kicker || !title || !role || !body) return;
    body.textContent = "";
    if (!node) {
      kicker.textContent = "Step detail";
      title.textContent = "Choose a step";
      role.textContent = "Every state on this page is read from a published artefact when the page opens.";
      body.append(el("p", "cr-empty", "Select a step in the flow to see what it reads, how it is judged, and what the artefacts state about it."));
      return;
    }
    const state = stepState(node);
    kicker.textContent = `Step ${String(nodeOrder(node)).padStart(2, "0")} \u00b7 ${bandOf(node).label} \u00b7 ${legendLabel(state.state)}`;
    title.textContent = node.title;
    role.textContent = node.role || "";
    const summary = interpolate(node.summary, FLOW.sources);
    if (summary) body.append(el("p", "cr-insp-summary", summary));
    [
      readability(node),
      readableMetrics(node),
      readableIo(node),
      readableTests(node),
      readableClaims(node),
      readableList(node, node.limitations, "What this does not establish", "is-limit"),
      readableList(node, node.open, "What would change it", "is-open"),
      readableLinks(node)
    ].forEach(section => { if (section) body.append(section); });
  }

  function openSheet() {
    const inspector = document.getElementById("crInspector");
    const backdrop = document.getElementById("crBackdrop");
    if (inspector) inspector.classList.add("is-open");
    if (backdrop) backdrop.classList.add("is-open");
  }

  function closeSheet(returnFocus) {
    const inspector = document.getElementById("crInspector");
    const backdrop = document.getElementById("crBackdrop");
    if (inspector) inspector.classList.remove("is-open");
    if (backdrop) backdrop.classList.remove("is-open");
    if (returnFocus && FLOW.selection) {
      const node = document.querySelector(`.cr-node[data-node="${FLOW.selection}"]`);
      if (node) node.focus();
    }
  }

  function select(id) {
    const view=VIEW.find(v=>v.id===id);
    FLOW.selection=view?view.id:null; markSelection();
    if(!view) { renderInspector(null); return; }
    const title=document.getElementById("crInspectorTitle");
    const role=document.getElementById("crInspectorRole");
    const body=document.getElementById("crInspectorBody");
    document.getElementById("crInspectorKicker").textContent=view.plug?"Replaceable module":"Engine step";
    title.textContent=view.title; role.textContent=view.summary; body.textContent="";
    const summary=block("Current status"); summary.append(chip(viewState(view)));
    summary.append(el("p", "cr-readiness-note", "Combined evidence status. Software, deployment, data and research are assessed separately below."));
    body.append(summary);
    const links=block("Connected workflows"); const seen=new Set();
    members(view).forEach(n=>(n.links||[]).map(linkTarget).filter(Boolean).forEach(l=>{
      if(!l.href || !l.href.includes("app.n8n.cloud/workflow/") || seen.has(l.href)) return;
      seen.add(l.href); const a=el("a","cr-link",n.title + " in n8n"); a.href=l.href; a.target="_blank"; a.rel="noopener noreferrer"; links.append(a);
    }));
    if(seen.size) body.append(links);
    else { links.append(el("p","cr-readiness-note","This stage has no separate n8n workflow linked in the current evidence.")); body.append(links); }
    const progress=block("Build progress & next actions");
    members(view).forEach(n=>{
      const detail=el("details","cr-component"); detail.append(el("summary",null,n.title));
      const summary=interpolate(n.summary,FLOW.sources); if(summary) detail.append(el("p","cr-insp-summary",summary));
      [readability(n),readableList(n,n.open,"Needed next","is-open"),readableList(n,n.limitations,"Limitations","is-limit"),readableMetrics(n),readableIo(n),readableTests(n),readableClaims(n),readableLinks(n)].forEach(part=>{if(part) detail.append(part);});
      progress.append(detail);
    }); body.append(progress);
    const sources=el("details","cr-component"); sources.append(el("summary",null,"Evidence sources and timestamps"));
    const sourceHost=document.getElementById("crSources"); if(sourceHost) { const copy=sourceHost.cloneNode(true); copy.removeAttribute("id"); copy.hidden=false; sources.append(copy); } body.append(sources);
    document.getElementById("crAnnounce").textContent=view.title+", "+legendLabel(viewState(view));
    openSheet(); drawWires();
  }
  function drawWires() {
    const svg=document.getElementById("crWires"), scaler=document.getElementById("crScaler");
    if(!svg || !scaler || !FLOW.manifest) return;
    const box=scaler.getBoundingClientRect(), z=FLOW.zoom||1;
    const w=scaler.offsetWidth,h=scaler.offsetHeight;
    svg.setAttribute("viewBox",`0 0 ${w} ${h}`); svg.setAttribute("width",w); svg.setAttribute("height",h);
    svg.innerHTML='<defs><marker id="crArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#50eff4" stroke-width="1.5"/></marker></defs>';
    function point(id,side) {
      const r=scaler.querySelector(`[data-node="${id}"]`).getBoundingClientRect();
      return {x:((side==="left"?r.left:side==="right"?r.right:r.left+r.width/2)-box.left)/z,y:((side==="top"?r.top:side==="bottom"?r.bottom:r.top+r.height/2)-box.top)/z};
    }
    CONNECTIONS.forEach(([from,to,type])=>{
      const a=point(from,type==="side"?"right":type==="left"?"left":"bottom");
      const b=point(to,type==="side"?"left":type==="left"?"right":"top");
      const middle=(a.y+b.y)/2;
      const d=type?`M${a.x},${a.y} L${b.x},${b.y}`:`M${a.x},${a.y} C${a.x},${middle} ${b.x},${middle} ${b.x},${b.y}`;
      ["cr-wire","cr-wire-flow"].forEach(cls=>{const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d",d);path.setAttribute("class",cls);if(cls==="cr-wire")path.setAttribute("marker-end","url(#crArrow)");svg.append(path);});
    });
  }

  // --- Zoom -------------------------------------------------------------
  function applyZoom() {
    const stage = document.getElementById("crStage");
    const fit = document.getElementById("crFit");
    const scaler = document.getElementById("crScaler");
    if (!stage || !fit || !scaler) return;
    const base = Math.max(240, stage.clientWidth - 8);
    scaler.style.width = `${base}px`;
    const height = scaler.offsetHeight;
    fit.style.width = `${Math.round(base * FLOW.zoom)}px`;
    fit.style.height = `${Math.round(height * FLOW.zoom)}px`;
    scaler.style.transform = `scale(${FLOW.zoom})`;
    const readout = document.getElementById("crZoomValue");
    if (readout) readout.textContent = `${Math.round(FLOW.zoom * 100)}%`;
    drawWires();
  }

  function setZoom(value) {
    FLOW.zoom = Math.min(1.4, Math.max(0.6, Math.round(value * 100) / 100));
    applyZoom();
  }

  // --- Legend and status ------------------------------------------------
  function renderLegend() {
    const host = document.getElementById("crLegend");
    if (!host) return;
    host.textContent = "";
    host.append(el("h2", "cr-legend-title", "Six states, each read from the artefacts"));
    (FLOW.manifest.legend || []).forEach(entry => {
      const item = el("div", "cr-legend-item");
      item.append(chip(entry.state), el("span", "cr-legend-meaning", entry.meaning));
      host.append(item);
    });
  }

  // The dimension key names each axis a badge is read on, so a pip's three letters are never the only word
  // for one. The manifest owns the names; this only lays them out.
  function renderDimensionKey() {
    const host = document.getElementById("crDimensions");
    if (!host) return;
    host.textContent = "";
    host.append(el("h2", "cr-dimensions-title", "Readiness dimensions, each read separately"));
    const list = el("div", "cr-dimensions-list");
    dimensions().forEach(([key, name, short]) => {
      const declared = (FLOW.manifest.dimensions || []).find(item => item.key === key);
      const item = el("div", "cr-dimension");
      item.dataset.dimension = key;
      item.append(el("span", "cr-dimension-short", short), el("span", "cr-dimension-name", name));
      if (declared && declared.summary) item.append(el("span", "cr-dimension-summary", declared.summary));
      list.append(item);
    });
    host.append(list);
  }

  function updateStatus() {
    const hint = document.getElementById("crHint");
    const total = Object.keys((FLOW.manifest && FLOW.manifest.sources) || {}).length;
    if (hint) {
      hint.textContent = `${FLOW.loaded} of ${total} evidence sources read` +
        (FLOW.failed.length ? ` \u00b7 ${FLOW.failed.length} unavailable` : "");
    }
    const foot = document.getElementById("crInspectorFoot");
    if (foot) {
      const built = formatValue(readPath("evidence.generated_at", FLOW.sources), "datetime");
      foot.textContent = built
        ? `Evidence built ${built} \u00b7 ${FLOW.loaded} of ${total} artefacts read`
        : `${FLOW.loaded} of ${total} artefacts read`;
    }
  }

  // --- Sources and their own stamps -------------------------------------
  // The page never types a verification date: each source declares which field of its own artefact
  // carries the time it was built, and this panel prints that field or says there is none. A source
  // that failed to load is named as unavailable rather than quietly left off the page.
  function renderSources() {
    const host = document.getElementById("crSources");
    if (!host) return;
    host.textContent = "";
    host.append(el("h2", "cr-sources-title", "Sources, each stamped by its own artefact"));
    const list = el("ul", "cr-sources-list");
    for (const [key, source] of Object.entries(FLOW.manifest.sources || {})) {
      const item = el("li", "cr-source");
      item.dataset.source = key;
      const anchor = el("a", "cr-source-link", source.label);
      anchor.href = source.url;
      anchor.dataset.kind = "artefact";
      anchor.target = "_blank";
      anchor.rel = "noreferrer noopener";
      item.append(anchor);
      if (FLOW.failed.includes(key)) {
        item.dataset.state = "unavailable";
        item.append(el("span", "cr-source-stamp", "unavailable - the page could not read it"));
      } else {
        const stamp = source.verified_at
          ? formatValue(readWithin(FLOW.sources[key], source.verified_at), "datetime")
          : null;
        item.dataset.state = stamp ? "read" : "unstamped";
        item.append(el("span", "cr-source-stamp", stamp ? `Source timestamp: ${stamp}` : "read - no timestamp published"));
      }
      list.append(item);
    }
    host.append(list);
  }

  // --- Wiring the controls ----------------------------------------------
  function wireControls() {
    const zoomIn = document.getElementById("crZoomIn");
    const zoomOut = document.getElementById("crZoomOut");
    const zoomFit = document.getElementById("crZoomFit");
    const motion = document.getElementById("crMotion");
    const close = document.getElementById("crInspectorClose");
    const backdrop = document.getElementById("crBackdrop");
    const stage = document.getElementById("crStage");

    if (zoomIn) zoomIn.addEventListener("click", () => setZoom(FLOW.zoom + 0.1));
    if (zoomOut) zoomOut.addEventListener("click", () => setZoom(FLOW.zoom - 0.1));
    if (zoomFit) {
      zoomFit.addEventListener("click", () => {
        setZoom(1);
        if (stage) stage.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    }
    if (motion) {
      const page = document.querySelector(".cr-page");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      const sync = () => motion.setAttribute("aria-pressed", page && page.classList.contains("cr-motion-off") ? "false" : "true");
      if (reduce.matches && page) page.classList.add("cr-motion-off");
      sync();
      motion.addEventListener("click", () => {
        if (!page) return;
        page.classList.toggle("cr-motion-off");
        sync();
      });
    }
    if (close) close.addEventListener("click", () => closeSheet(true));
    if (backdrop) backdrop.addEventListener("click", () => closeSheet(true));

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      const inspector = document.getElementById("crInspector");
      // Whether the panel is a sheet over the flow is the stylesheet's decision, not a second breakpoint here:
      // the sheet is the fixed one, and Escape puts it away first, leaving the step chosen behind it.
      const isSheet = inspector && getComputedStyle(inspector).position === "fixed";
      if (isSheet && inspector.classList.contains("is-open")) {
        closeSheet(true);
        event.preventDefault();
        return;
      }
      // At the wider layout the panel stands in the page rather than over it, so Escape is the reader's way
      // back to the empty panel: the step goes unchosen and the lines it dimmed come back.
      if (!FLOW.selection) return;
      const chosen = document.querySelector(`.cr-node[data-node="${FLOW.selection}"]`);
      select(null);
      if (chosen) chosen.focus();
      event.preventDefault();
    });

    const bands = document.getElementById("crBands");
    if (bands) {
      bands.addEventListener("keydown", event => {
        if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        const nodes = Array.from(bands.querySelectorAll(".cr-node"));
        if (!nodes.length) return;
        const current = nodes.indexOf(document.activeElement);
        let next = current;
        if (event.key === "Home") next = 0;
        else if (event.key === "End") next = nodes.length - 1;
        else if (event.key === "ArrowDown" || event.key === "ArrowRight") next = Math.min(nodes.length - 1, current + 1);
        else next = Math.max(0, current - 1);
        if (next !== current) {
          nodes[next].focus();
          event.preventDefault();
        }
      });
    }

    if (stage && "ResizeObserver" in window) {
      let frame = 0;
      new ResizeObserver(() => {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => { frame = 0; applyZoom(); });
      }).observe(stage);
    } else {
      window.addEventListener("resize", () => applyZoom());
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => applyZoom());
  }

  function showFailure(message) {
    const bands = document.getElementById("crBands");
    const body = document.getElementById("crInspectorBody");
    const hint = document.getElementById("crHint");
    if (bands) {
      bands.textContent = "";
      const band = el("section", "cr-band");
      band.append(el("p", "cr-empty", message));
      bands.append(band);
    }
    if (body) {
      body.textContent = "";
      body.append(el("p", "cr-empty", message));
    }
    if (hint) hint.textContent = "No state is shown";
  }

  function renderHead() {
    const page = FLOW.manifest.page || {};
    const set = (selector, text) => {
      const node = document.querySelector(selector);
      if (node && text) node.textContent = text;
    };
    set(".cr-eyebrow", page.eyebrow);
    set(".cr-title", page.title);
    set(".cr-intro", page.intro);
    set(".cr-note-text", page.note);
    if (page.title) document.title = `${page.title} \u2014 Backtest Engine v2`;
  }

  // --- Boot -------------------------------------------------------------
  async function boot() {
    try {
      FLOW.manifest = await fetchJson(MANIFEST_URL);
    } catch (error) {
      showFailure(
        "This page could not read its own view manifest, so it shows no state rather than a guessed one. " +
        "Reload once the file backtester/assets/backtest-engine-v2.manifest.json is served."
      );
      return;
    }
    // Page heading follows the approved visual reference, not the technical manifest intro.

    const entries = Object.entries(FLOW.manifest.sources || {});
    await Promise.all(entries.map(async ([key, source]) => {
      try {
        FLOW.sources[key] = await fetchJson(source.url);
        FLOW.loaded += 1;
      } catch (error) {
        FLOW.sources[key] = null;
        FLOW.failed.push(key);
      }
    }));
    renderNodes();
    renderSources();
    renderInspector(null);
    wireControls();
    applyZoom();
    drawWires();
    updateStatus();
    if (window.innerWidth > 1000) select("history");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
