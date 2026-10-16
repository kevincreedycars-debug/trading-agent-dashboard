// The one document a close asked for by hand from the dashboard leaves behind: `data/live-trading-close-request.json`.
//
// It is a log of asks, not an order. The Open positions table writes one row into it when a reader presses
// Close on a ticket, the five-minute loop reads it on its next tick, and the page reads it back to say
// whether an ask is still waiting. A row states the ticket and the moment it was asked; nothing in it is a
// price, a size worked out here, or an account fact.
//
// Two rules keep a document in a public repository safe to leave there. The loop only ever takes out a
// ticket carrying this lane's own magic - the same check `--close-ticket` already makes, so the worst a row
// in this file can do is close a trade this lane opened itself - and an ask older than its own window is not
// acted on at all, so a request committed by mistake expires instead of firing days later.
//
// Nothing here holds a credential. A commit is made with the reader's own GitHub token through the same
// contents API calls `lib/l2l_levels_store.js` already makes, and the token is never written into this
// document, into the page, or into any artifact.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.LiveTradingCloseRequest = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createLiveTradingCloseRequest() {
  const SCHEMA_VERSION = "live-trading-close-request-v1";
  const DEFAULT_REQUEST_PATH = "data/live-trading-close-request.json";
  const DEFAULT_REPO = "kevincreedycars-debug/trading-agent-dashboard";
  const DEFAULT_BRANCH = "main";
  const ALLOWED_SIDES = ["buy", "sell"];
  // Who asked. `dashboard` is the Open positions table's own button; `loop` is left for an ask the trading
  // path itself records, so a reader can always tell a hand press from something the loop wrote.
  const REQUESTED_BY = {
    dashboard: "dashboard",
    loop: "loop"
  };
  const REQUESTED_BY_LABEL = {
    dashboard: "the dashboard's Open positions table",
    loop: "the trading loop"
  };
  // The window an ask stays live in. The loop's tick is five minutes, so half an hour is six ticks: long
  // enough that a queued ask is never missed because one tick was skipped, short enough that an ask left
  // over from an earlier session cannot fire against a position opened since.
  const OPEN_WINDOW_MINUTES = 30;
  // A clock a few minutes ahead of the machine's is normal between a browser and a PC, so an ask stamped
  // slightly in the future is still read as waiting; one stamped further ahead than this is not read at all
  // rather than being acted on at a moment nobody can explain.
  const CLOCK_SKEW_SECONDS = 300;
  // The log is a log: the newest asks are kept and the older ones fall off the end. Fifty is more than a
  // month of hand closes at this lane's cadence, and the file stays small enough to read in full.
  const MAX_REQUESTS = 50;
  // The file's own note travels with it, so a reader of the raw JSON knows what they are looking at without
  // opening the dashboard: what writes it, who acts on it, how long a row stays live, and that it is a
  // request rather than an order.
  const NOTE = "Close requests asked for by hand from the live dashboard's Open positions table. Each row is one ticket and the moment a reader asked for it. The five-minute loop reads this file from the published branch on its next tick and takes out only a ticket carrying its own magic, and only while the row is younger than thirty minutes; an older row is left alone, because a position opened since must not be closed by an ask nobody meant for it. The dashboard writes this file with the reader's own GitHub token, through the same contents API calls the marked-levels file uses. This file is a request, not an order: nothing in it places, changes or closes anything on its own.";


  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function isTimestamp(value) {
    return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
  }

  function isTicket(value) {
    return isFiniteNumber(value) && Number.isInteger(value) && value > 0;
  }

  // Every stamp this document holds is written in the shape the rest of the repository's artifacts use:
  // UTC, seconds resolution, a trailing Z. A stamp that cannot be read is dropped with its row rather than
  // guessed at, because the age of an ask is the one thing that decides whether it still counts.
  function isoStamp(value) {
    const when = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(when.getTime())) return null;
    return when.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  function timestampMs(value, fallback) {
    const when = Date.parse(value);
    if (!Number.isNaN(when)) return when;
    return isFiniteNumber(fallback) ? fallback : null;
  }

  // The id is derived from the ask itself - the ticket and the second it was asked - so the same press
  // replayed by a retry, a merge or a reload is one row rather than two closes. It carries no account fact
  // beyond the ticket the reader already sees on the page.
  function requestIdFor({ ticket, requestedAtUtc }) {
    const stamp = String(requestedAtUtc || "").replace(/[^0-9A-Za-z]/g, "");
    return `close-${ticket}-${stamp}`;
  }

  function normaliseRequest(row) {
    if (!row || typeof row !== "object") return null;
    if (!isTicket(Number(row.ticket))) return null;
    if (!isTimestamp(row.requested_at_utc)) return null;
    const side = ALLOWED_SIDES.includes(row.side) ? row.side : null;
    const volume = isFiniteNumber(Number(row.volume)) && Number(row.volume) > 0 ? Number(row.volume) : null;
    const requestedBy = Object.prototype.hasOwnProperty.call(REQUESTED_BY_LABEL, row.requested_by)
      ? row.requested_by
      : REQUESTED_BY.dashboard;
    return {
      request_id: typeof row.request_id === "string" && row.request_id
        ? row.request_id
        : requestIdFor({ ticket: Number(row.ticket), requestedAtUtc: row.requested_at_utc }),
      ticket: Number(row.ticket),
      symbol: typeof row.symbol === "string" && row.symbol ? row.symbol : null,
      side,
      volume,
      requested_at_utc: row.requested_at_utc,
      requested_by: requestedBy,
      note: typeof row.note === "string" ? row.note : ""
    };
  }

  // A row for one press. Everything the loop needs to look the ticket up is here; nothing it needs to size
  // or price anything is, because a close is not a placement and the loop reads the ticket's own numbers
  // from the terminal when it acts.
  function buildRequest({ ticket, symbol, side, volume, requestedAtUtc, requestedBy, note } = {}) {
    const numericTicket = Number(ticket);
    if (!isTicket(numericTicket)) {
      return { ok: false, error: `A close request needs a whole ticket number, got ${ticket === undefined ? "nothing" : ticket}.` };
    }
    const at = isoStamp(requestedAtUtc || new Date());
    if (!at) {
      return { ok: false, error: "A close request needs a stamp it can be aged by, and this one could not be read." };
    }
    return {
      ok: true,
      request: {
        request_id: requestIdFor({ ticket: numericTicket, requestedAtUtc: at }),
        ticket: numericTicket,
        symbol: typeof symbol === "string" && symbol ? symbol : null,
        side: ALLOWED_SIDES.includes(side) ? side : null,
        volume: isFiniteNumber(Number(volume)) && Number(volume) > 0 ? Number(volume) : null,
        requested_at_utc: at,
        requested_by: Object.prototype.hasOwnProperty.call(REQUESTED_BY_LABEL, requestedBy)
          ? requestedBy
          : REQUESTED_BY.dashboard,
        note: typeof note === "string" ? note : ""
      }
    };
  }

  function createEmptyState(nowIso) {
    return {
      schema_version: SCHEMA_VERSION,
      updated_at_utc: isoStamp(nowIso || new Date()),
      note: NOTE,
      request_count: 0,
      requests: []
    };
  }

  function normaliseState(raw) {
    const requests = (Array.isArray(raw?.requests) ? raw.requests : [])
      .map(normaliseRequest)
      .filter(Boolean)
      .sort((left, right) => timestampMs(left.requested_at_utc, 0) - timestampMs(right.requested_at_utc, 0));
    return {
      schema_version: SCHEMA_VERSION,
      updated_at_utc: isTimestamp(raw?.updated_at_utc) ? raw.updated_at_utc : null,
      note: typeof raw?.note === "string" && raw.note ? raw.note : NOTE,
      request_count: requests.length,
      requests
    };
  }

  // The append is a union by request id rather than a push, so the same ask merged twice - a conflict
  // retry, a page reload, a second press inside the same second - stays one row and stays one close.
  function appendRequests(state, rows, { nowIso } = {}) {
    const base = normaliseState(state);
    const incoming = (Array.isArray(rows) ? rows : [rows]).map(normaliseRequest).filter(Boolean);
    const byId = new Map(base.requests.map(row => [row.request_id, row]));
    incoming.forEach(row => {
      if (!byId.has(row.request_id)) byId.set(row.request_id, row);
    });
    const merged = Array.from(byId.values())
      .sort((left, right) => timestampMs(left.requested_at_utc, 0) - timestampMs(right.requested_at_utc, 0))
      .slice(-MAX_REQUESTS);
    return {
      schema_version: SCHEMA_VERSION,
      updated_at_utc: isoStamp(nowIso || new Date()) || base.updated_at_utc,
      note: base.note,
      request_count: merged.length,
      requests: merged
    };
  }

  // What this browser holds merged with what the published file holds. A conflict retry uses this: the asks
  // in the browser are the ones this reader made, the asks in the file are the ones everyone else made, and
  // neither side may drop the other's.
  function mergeStates(mine, published, { nowIso } = {}) {
    return appendRequests(mine, normaliseState(published).requests, { nowIso });
  }

  function serialiseState(state) {
    return `${JSON.stringify(normaliseState(state), null, 2)}\n`;
  }

  // The checker, in the shape the levels file's own is: a list of problems, empty when the document is one
  // the loop and the page can both read. A malformed row is a problem rather than something to repair,
  // because the loop decides what to act on from this file.
  function validateRequestsState(state) {
    const problems = [];
    if (!state || typeof state !== "object") return ["The document must be a JSON object."];
    if (state.schema_version !== SCHEMA_VERSION) {
      problems.push(`schema_version must be ${SCHEMA_VERSION}, got ${JSON.stringify(state.schema_version)}`);
    }
    if (!Array.isArray(state.requests)) {
      problems.push("requests must be an array");
      return problems;
    }
    if (state.requests.length > MAX_REQUESTS) {
      problems.push(`requests holds ${state.requests.length} rows, more than the ${MAX_REQUESTS} this document keeps`);
    }
    state.requests.forEach((row, index) => {
      const normalised = normaliseRequest(row);
      if (!normalised) {
        problems.push(`requests[${index}] is not a close request: it needs a whole ticket number and a readable requested_at_utc`);
        return;
      }
      if (row.side !== undefined && row.side !== null && normalised.side === null) {
        problems.push(`requests[${index}].side must be buy or sell when given`);
      }
    });
    return problems;
  }

  // How old an ask is, in seconds, as the machine reading it sees it. A stamp in the future reads as a
  // negative age, which is what the window below treats as clock skew rather than as a very young ask.
  function requestAgeSeconds(request, nowMs) {
    const asked = timestampMs(request?.requested_at_utc, null);
    const now = isFiniteNumber(nowMs) ? nowMs : Date.now();
    if (asked === null) return null;
    return Math.round((now - asked) / 1000);
  }

  // Live means readable, not older than the window, and not so far in the future that no clock involved can
  // be believed. Everything else is left alone by whoever reads this.
  function isOpenRequest(request, nowMs) {
    const age = requestAgeSeconds(request, nowMs);
    if (age === null) return false;
    if (age > OPEN_WINDOW_MINUTES * 60) return false;
    return age >= -CLOCK_SKEW_SECONDS;
  }

  // The rows the loop may act on, oldest ask first: a reader who pressed Close twice has the first ask taken
  // first, and an ask made after it is not overtaken.
  function pendingRequests(state, nowMs) {
    return normaliseState(state).requests.filter(request => isOpenRequest(request, nowMs));
  }

  function latestRequest(state) {
    const rows = normaliseState(state).requests;
    return rows.length ? rows[rows.length - 1] : null;
  }

  function describeAge(seconds) {
    if (seconds === null) return "at a moment this page cannot read";
    if (seconds < -CLOCK_SKEW_SECONDS) return "at a stamp further ahead than any clock here can explain";
    if (seconds < 0) return "just now";
    if (seconds < 90) return `${seconds} seconds ago`;
    if (seconds < 5400) return `${Math.round(seconds / 60)} minutes ago`;
    if (seconds < 172800) return `${Math.round(seconds / 3600)} hours ago`;
    return `${Math.round(seconds / 86400)} days ago`;
  }

  // What the page says about one ask. It states the window rather than a promise: the page cannot see the
  // loop's own state, so it reports the ask and its age, and the row leaving the Open positions table on a
  // later snapshot is what shows the trade is out.
  function describeRequest(request, nowMs) {
    const age = requestAgeSeconds(request, nowMs);
    const who = REQUESTED_BY_LABEL[request?.requested_by] || REQUESTED_BY_LABEL.dashboard;
    const asked = `asked by ${who} ${describeAge(age)}`;
    if (!isOpenRequest(request, nowMs)) {
      return {
        tone: "stale",
        age_seconds: age,
        text: `${asked}, which is outside the ${OPEN_WINDOW_MINUTES} minutes the loop acts within, so it will not be taken.`
      };
    }
    return {
      tone: "waiting",
      age_seconds: age,
      text: `${asked}, still inside the ${OPEN_WINDOW_MINUTES} minutes the loop acts within: its next tick takes it.`
    };
  }

  // ---- Reading and writing it in the reader's own repository -------------------------------------------
  // The GitHub calls are the marked-levels module's own, injected rather than copied, so there is one
  // implementation of the contents API, one set of plain-word refusals and one place a token is used.
  function githubLayer(github) {
    const layer = github || (typeof globalThis !== "undefined" ? globalThis.L2LLevelsStore : null);
    if (!layer || typeof layer.buildCommitRequest !== "function" || typeof layer.buildReadRequest !== "function") {
      return null;
    }
    return layer;
  }

  // What the page fills in and what the calls need, in one place: a repository the reader typed, the branch
  // it is published from, and the one path this capability may touch. The layer is passed in by the page so
  // the same function can be exercised without one.
  function normaliseTarget({ repo, branch, path, github } = {}) {
    const layer = githubLayer(github);
    const parsed = layer ? layer.parseRepo(repo) : null;
    if (!parsed) {
      return { ok: false, error: "The repository must be written as owner/repo, for example kevincreedycars-debug/trading-agent-dashboard." };
    }
    return {
      ok: true,
      owner: parsed.owner,
      repo: parsed.repo,
      branch: String(branch || DEFAULT_BRANCH),
      path: String(path || DEFAULT_REQUEST_PATH)
    };
  }

  // A read needs no token: the repository is public and this log is nobody's secret. A token is used when
  // the page has one, because a reader who is signed in should not be rate-limited as a stranger.
  async function readRemoteRequests({ fetchImpl, github, owner, repo, branch, token, path }) {
    const layer = githubLayer(github);
    if (!layer) return { ok: false, status: 0, error: "The GitHub calls this page needs did not load, so the close-request log could not be read." };
    const send = fetchImpl || (typeof fetch === "function" ? fetch : null);
    if (!send) return { ok: false, status: 0, error: "This browser cannot reach GitHub to read the close-request log." };
    const target = path || DEFAULT_REQUEST_PATH;
    let response;
    try {
      const request = layer.buildReadRequest({ owner, repo, branch, token, path: target });
      response = await send(request.url, request.init);
    } catch (error) {
      return { ok: false, status: 0, error: `Could not reach GitHub: ${error.message}` };
    }
    if (response.status === 404) {
      return { ok: true, status: 404, sha: null, state: createEmptyState(new Date().toISOString()), missing: true };
    }
    if (!response.ok) {
      return { ok: false, status: response.status, error: layer.describeStatus(response.status) };
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      return { ok: false, status: response.status, error: "GitHub's answer could not be read as JSON." };
    }
    let raw = null;
    try {
      raw = JSON.parse(layer.fromBase64(String(payload?.content || "")));
    } catch (error) {
      raw = null;
    }
    if (!raw || validateRequestsState(raw).length) {
      return { ok: false, status: response.status, error: `The published ${target} is not a close-request document this page can read, so nothing was replaced.` };
    }
    return {
      ok: true,
      status: response.status,
      sha: typeof payload?.sha === "string" ? payload.sha : null,
      state: normaliseState(raw),
      missing: false
    };
  }

  // The commit refuses to write a document the checker would reject, and refuses to replace a published file
  // that moved under it unless the caller says to. The caller's answer to a conflict is to merge and try
  // again, which is why a refusal carries the sha it saw.
  async function commitRequests({ fetchImpl, github, owner, repo, branch, token, path, state, message, expectedSha, force }) {
    const layer = githubLayer(github);
    if (!layer) return { ok: false, status: 0, error: "The GitHub calls this page needs did not load, so nothing could be asked." };
    const problems = validateRequestsState(state);
    if (problems.length) {
      return { ok: false, status: 0, error: `Refusing to publish a close-request file that would not validate: ${problems.join("; ")}` };
    }
    if (!token) {
      return { ok: false, status: 0, error: "A GitHub token with Contents: read and write on this repository is needed to ask the loop. Paste one in the marked-levels box on this tab." };
    }
    const target = path || DEFAULT_REQUEST_PATH;
    const remote = await readRemoteRequests({ fetchImpl, github: layer, owner, repo, branch, token, path: target });
    if (!remote.ok) return remote;
    if (expectedSha && remote.sha && remote.sha !== expectedSha && force !== true) {
      return {
        ok: false,
        status: 409,
        conflict: true,
        sha: remote.sha,
        remote,
        error: "The published close-request file changed on GitHub since this page read it. Press again and this ask is merged into the newest version rather than replacing it."
      };
    }
    const send = fetchImpl || (typeof fetch === "function" ? fetch : null);
    let response;
    try {
      const request = layer.buildCommitRequest({
        owner,
        repo,
        branch,
        token,
        path: target,
        content: serialiseState(state),
        sha: remote.sha,
        message
      });
      response = await send(request.url, request.init);
    } catch (error) {
      return { ok: false, status: 0, error: `Could not reach GitHub: ${error.message}` };
    }
    if (!response.ok) {
      return { ok: false, status: response.status, error: layer.describeStatus(response.status) };
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    return {
      ok: true,
      status: response.status,
      sha: typeof payload?.content?.sha === "string" ? payload.content.sha : null,
      commit_sha: typeof payload?.commit?.sha === "string" ? payload.commit.sha : null,
      commit_url: typeof payload?.commit?.html_url === "string" ? payload.commit.html_url : ""
    };
  }

  return {
    SCHEMA_VERSION,
    DEFAULT_REQUEST_PATH,
    DEFAULT_REPO,
    DEFAULT_BRANCH,
    ALLOWED_SIDES,
    REQUESTED_BY,
    REQUESTED_BY_LABEL,
    MAX_REQUESTS,
    OPEN_WINDOW_MINUTES,
    CLOCK_SKEW_SECONDS,
    NOTE,
    isTicket,
    isTimestamp,
    isoStamp,
    requestIdFor,
    normaliseRequest,
    buildRequest,
    createEmptyState,
    normaliseState,
    appendRequests,
    mergeStates,
    serialiseState,
    validateRequestsState,
    requestAgeSeconds,
    isOpenRequest,
    pendingRequests,
    latestRequest,
    describeRequest,
    normaliseTarget,
    readRemoteRequests,
    commitRequests
  };
});


