// The one document a close asked for by hand from the dashboard leaves behind: `data/live-trading-close-request.json`.
//
// It is a log of asks, not an order. The Open positions table writes one row into it when a reader presses
// Close on a ticket, the five-minute loop reads it on its next tick, and the page reads it back to say
// whether an ask is still waiting. A row states the ticket, the moment it was asked, and the account it was
// asked on; nothing in it is a price or a size worked out here.
//
// Four rules keep a document in a public repository safe to leave there, and each one is written down because
// two accounts now write the same file:
//
//   the account is named      every row carries `account.lane` and the masked login the reader saw, so a row
//                             asked on account 2 is never acted on by account 1's loop. A row that names no
//                             account is not read as an ask at all.
//   the ticket is this lane's the loop only ever takes out a ticket carrying this lane's own magic, on this
//                             loop's own account, so the worst a row can do is close a trade this lane opened.
//   the id is unique          the id is the lane, the ticket, the second and a random token, so two lanes
//                             pressing on the same ticket in the same second are two rows and two closes, and
//                             the same press replayed by a retry is one row.
//   the ask expires           every row states `expires_at_utc`, at most thirty minutes after it was asked,
//                             so a request committed by mistake expires instead of firing days later.
//
// An ask that has been answered is answered once: the loop writes the `request_id` into its own state with
// the outcome, and a row whose id is already there is refused as a replay rather than acted on again.
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
  const SCHEMA_VERSION = "live-trading-close-request-v2";
  // The shape this file had before an ask named its account. It is still recognised when reading, so a page
  // can say why an old document is not acted on instead of calling it corrupt, but a row in that shape is
  // never handed to a loop: an ask that names no account cannot be told from one asked on the other account.
  const LEGACY_SCHEMA_VERSION = "live-trading-close-request-v1";
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
  // Every outcome a loop can write beside an answered ask. They are named here rather than in the loop so the
  // page and the loop describe the same five ways an ask ends without one, and an ask answered for another
  // account, a replayed ask and an expired one read the same way everywhere.
  const ANSWER_OUTCOMES = {
    closed: "closed",
    cancelled: "cancelled",
    planned: "planned",
    nothing_to_close: "nothing_to_close",
    refused: "refused",
    send_failed: "send_failed",
    foreign_account: "foreign_account",
    replay: "replay",
    expired: "expired"
  };
  // The window an ask stays live in. The loop's tick is five minutes, so half an hour is six ticks: long
  // enough that a queued ask is never missed because one tick was skipped, short enough that an ask left
  // over from an earlier session cannot fire against a position opened since. It is also the longest life a
  // row may write for itself: `expires_at_utc` is clamped to it, never past it.
  const OPEN_WINDOW_MINUTES = 30;
  // A clock a few minutes ahead of the machine's is normal between a browser and a PC, so an ask stamped
  // slightly in the future is still read as waiting; one stamped further ahead than this is not read at all
  // rather than being acted on at a moment nobody can explain.
  const CLOCK_SKEW_SECONDS = 300;
  // The log is a log: the newest asks are kept and the older ones fall off the end. Fifty is more than a
  // month of hand closes at this lane's cadence, and the file stays small enough to read in full.
  const MAX_REQUESTS = 50;
  // Four hex characters: enough that two presses on the same ticket in the same second, from the same reader,
  // are two ids while the file stays readable by eye. The token is the only part of an id that is not a fact
  // already on the page, and it is not a secret.
  const TOKEN_LENGTH = 4;
  // The file's own note travels with it, so a reader of the raw JSON knows what they are looking at without
  // opening the dashboard: what writes it, who acts on it, how long a row stays live, and that it is a
  // request rather than an order.
  const NOTE = "Close requests asked for by hand from the live dashboard's Open positions table. Each row names one ticket, the moment a reader asked for it, and the account it was asked on (`account.lane` and the masked login). A lane's five-minute loop reads this file from the published branch on its next tick and takes out only a ticket on its own account carrying its own magic, only while the row is younger than thirty minutes and before its own `expires_at_utc`; a row naming another lane or another account is never acted on, and a row whose id the loop has already answered is refused as a replay rather than acted on twice. The dashboard writes this file with the reader's own GitHub token, through the same contents API calls the marked-levels file uses. This file is a request, not an order: nothing in it places, changes or closes anything on its own.";


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

  // The id is derived from the ask itself - the lane, the ticket, the second it was asked and a random token
  // - so two lanes pressing on the same ticket in the same second are two rows and two closes, while the same
  // press replayed by a retry, a merge or a reload is one row because the row's own id travels with it.
  // It carries no account fact beyond the lane and the ticket the reader already sees on the page.
  function requestIdFor({ lane, ticket, requestedAtUtc, token }) {
    const stamp = String(requestedAtUtc || "").replace(/[^0-9A-Za-z]/g, "");
    const scope = String(lane || "unknown").replace(/[^0-9A-Za-z_-]/g, "");
    return `close-${scope}-${ticket}-${stamp}-${String(token || "").replace(/[^0-9a-f]/g, "").slice(0, TOKEN_LENGTH)}`;
  }

  // A lane id is the one the lanes file uses: short, printable, and never a path.
  function isLane(value) {
    return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(value);
  }

  // The only part of an id that is not already on the page. `crypto` is used where the page has it, so two
  // presses in the same second do not depend on `Math.random` agreeing with itself.
  function randomToken() {
    const realm = typeof globalThis !== "undefined" ? globalThis : null;
    const crypto = realm && realm.crypto;
    if (crypto && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(2);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    }
    return Math.floor(Math.random() * 0x10000).toString(16).padStart(TOKEN_LENGTH, "0");
  }

  // The account a row was asked on, as much of it as the page already shows: the lane from the lanes file, and
  // the masked login and server printed beside it. A full login is refused rather than quietly written into a
  // public repository - the page only ever has the masked one, so a full one means a hand-written row.
  function normaliseAccount(account) {
    if (!account || typeof account !== "object") return null;
    if (!isLane(account.lane)) return null;
    const masked = typeof account.login_masked === "string" ? account.login_masked.trim() : "";
    if (!masked || !masked.includes("*")) return null;
    return {
      lane: account.lane,
      login_masked: masked,
      server: typeof account.server === "string" && account.server ? account.server : null
    };
  }

  // How long a row may stay live: the ask's own stamp plus at most the window. A row that asks for longer is
  // given the window's own end, never an extension, because the window is the promise the loop acts under.
  function resolveExpiry(requestedAtUtc, expiresAtUtc) {
    const askedMs = Date.parse(requestedAtUtc);
    if (Number.isNaN(askedMs)) return null;
    const capMs = askedMs + OPEN_WINDOW_MINUTES * 60 * 1000;
    if (expiresAtUtc === undefined || expiresAtUtc === null || expiresAtUtc === "") {
      return isoStamp(new Date(capMs));
    }
    const wantedMs = Date.parse(expiresAtUtc);
    if (Number.isNaN(wantedMs)) return null;
    if (wantedMs <= askedMs) return null;
    return isoStamp(new Date(Math.min(wantedMs, capMs)));
  }

  function normaliseRequest(row) {
    if (!row || typeof row !== "object") return null;
    if (!isTicket(Number(row.ticket))) return null;
    if (!isTimestamp(row.requested_at_utc)) return null;
    const account = normaliseAccount(row.account);
    if (!account) return null;
    const side = ALLOWED_SIDES.includes(row.side) ? row.side : null;
    const volume = isFiniteNumber(Number(row.volume)) && Number(row.volume) > 0 ? Number(row.volume) : null;
    const requestedBy = Object.prototype.hasOwnProperty.call(REQUESTED_BY_LABEL, row.requested_by)
      ? row.requested_by
      : REQUESTED_BY.dashboard;
    const expires = resolveExpiry(row.requested_at_utc, row.expires_at_utc)
      || resolveExpiry(row.requested_at_utc, null);
    return {
      request_id: typeof row.request_id === "string" && row.request_id
        ? row.request_id
        : requestIdFor({ lane: account.lane, ticket: Number(row.ticket), requestedAtUtc: row.requested_at_utc, token: randomToken() }),
      ticket: Number(row.ticket),
      symbol: typeof row.symbol === "string" && row.symbol ? row.symbol : null,
      side,
      volume,
      requested_at_utc: row.requested_at_utc,
      expires_at_utc: expires,
      requested_by: requestedBy,
      account,
      note: typeof row.note === "string" ? row.note : ""
    };
  }

  // A row for one press. Everything the loop needs to look the ticket up is here - the account it was asked
  // on included - and nothing it needs to size or price anything is, because a close is not a placement and
  // the loop reads the ticket's own numbers from the terminal when it acts.
  function buildRequest({
    ticket,
    symbol,
    side,
    volume,
    requestedAtUtc,
    requestedBy,
    note,
    lane,
    accountLoginMasked,
    accountServer,
    expiresAtUtc,
    requestToken
  } = {}) {
    const numericTicket = Number(ticket);
    if (!isTicket(numericTicket)) {
      return { ok: false, error: `A close request needs a whole ticket number, got ${ticket === undefined ? "nothing" : ticket}.` };
    }
    const at = isoStamp(requestedAtUtc || new Date());
    if (!at) {
      return { ok: false, error: "A close request needs a stamp it can be aged by, and this one could not be read." };
    }
    if (!isLane(lane)) {
      return { ok: false, error: "A close request must name the lane it was asked on (for example ftmo-1), because two accounts write this file." };
    }
    const masked = typeof accountLoginMasked === "string" ? accountLoginMasked.trim() : "";
    if (!masked || !masked.includes("*")) {
      return { ok: false, error: "A close request must name the masked login it was asked on; a full login never belongs in this file." };
    }
    const expires = resolveExpiry(at, expiresAtUtc);
    if (!expires) {
      return { ok: false, error: `A close request's expiry must be readable and after the ask, and no later than ${OPEN_WINDOW_MINUTES} minutes after it.` };
    }
    const token = String(requestToken || randomToken()).replace(/[^0-9a-f]/g, "").slice(0, TOKEN_LENGTH)
      || randomToken();
    return {
      ok: true,
      request: {
        request_id: requestIdFor({ lane, ticket: numericTicket, requestedAtUtc: at, token }),
        ticket: numericTicket,
        symbol: typeof symbol === "string" && symbol ? symbol : null,
        side: ALLOWED_SIDES.includes(side) ? side : null,
        volume: isFiniteNumber(Number(volume)) && Number(volume) > 0 ? Number(volume) : null,
        requested_at_utc: at,
        expires_at_utc: expires,
        requested_by: Object.prototype.hasOwnProperty.call(REQUESTED_BY_LABEL, requestedBy)
          ? requestedBy
          : REQUESTED_BY.dashboard,
        account: {
          lane,
          login_masked: masked,
          server: typeof accountServer === "string" && accountServer ? accountServer : null
        },
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
    if (state.schema_version === LEGACY_SCHEMA_VERSION) {
      problems.push(
        `schema_version is ${LEGACY_SCHEMA_VERSION}, whose rows name no account. It must be ${SCHEMA_VERSION}: a close asked for from the page now names its lane and masked login, so a row cannot be acted on by the other account's loop.`
      );
    } else if (state.schema_version !== SCHEMA_VERSION) {
      problems.push(`schema_version must be ${SCHEMA_VERSION}, got ${JSON.stringify(state.schema_version)}`);
    }
    if (!Array.isArray(state.requests)) {
      problems.push("requests must be an array");
      return problems;
    }
    if (state.requests.length > MAX_REQUESTS) {
      problems.push(`requests holds ${state.requests.length} rows, more than the ${MAX_REQUESTS} this document keeps`);
    }
    const seen = new Map();
    state.requests.forEach((row, index) => {
      const normalised = normaliseRequest(row);
      if (!normalised) {
        const why = !row || typeof row !== "object"
          ? "it is not an object"
          : !normaliseAccount(row.account)
            ? "it names no account: account.lane and a masked account.login_masked are required"
            : "it needs a whole ticket number and a readable requested_at_utc";
        problems.push(`requests[${index}] is not a close request: ${why}`);
        return;
      }
      if (row.side !== undefined && row.side !== null && normalised.side === null) {
        problems.push(`requests[${index}].side must be buy or sell when given`);
      }
      if (row.expires_at_utc !== undefined && row.expires_at_utc !== null) {
        const askedMs = Date.parse(row.requested_at_utc);
        const wantedMs = Date.parse(row.expires_at_utc);
        if (Number.isNaN(wantedMs) || wantedMs <= askedMs) {
          problems.push(`requests[${index}].expires_at_utc must be readable and after requested_at_utc`);
        } else if (wantedMs > askedMs + OPEN_WINDOW_MINUTES * 60 * 1000) {
          problems.push(`requests[${index}].expires_at_utc is later than the ${OPEN_WINDOW_MINUTES} minutes an ask may live`);
        }
      }
      if (seen.has(normalised.request_id)) {
        problems.push(
          `requests[${index}].request_id ${JSON.stringify(normalised.request_id)} is the same as requests[${seen.get(normalised.request_id)}]'s, and an id is what makes one ask one close`
        );
        return;
      }
      seen.set(normalised.request_id, index);
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

  // Live means readable, not older than the window, not past its own stated expiry, and not so far in the
  // future that no clock involved can be believed. Everything else is left alone by whoever reads this.
  function isOpenRequest(request, nowMs) {
    const age = requestAgeSeconds(request, nowMs);
    if (age === null) return false;
    if (age > OPEN_WINDOW_MINUTES * 60) return false;
    if (age < -CLOCK_SKEW_SECONDS) return false;
    return !requestExpired(request, nowMs);
  }

  // The row's own expiry, as a fact rather than as a side effect of the window: a loop that answers an ask
  // writes down that it expired rather than passing over it in silence.
  function requestExpired(request, nowMs) {
    const expiresMs = timestampMs(request?.expires_at_utc, null);
    if (expiresMs === null) return false;
    const now = isFiniteNumber(nowMs) ? nowMs : Date.now();
    return now > expiresMs;
  }

  // Whether this ask was asked on the account a loop is running. The lane is the identity that decides it;
  // the masked login and the server are then held to what the terminal itself reports, so a renamed lane or a
  // copy of a row from the other account is refused rather than acted on. A missing identity on either side
  // is not a pass: an ask that cannot be matched is not this loop's to take out.
  function accountMatches(request, { lane, loginMasked, server } = {}) {
    const account = normaliseAccount(request?.account);
    if (!account) {
      return { ok: false, reason: "the ask names no account, so no lane can claim it" };
    }
    if (!isLane(lane)) {
      return { ok: false, reason: "this loop was not told which lane it is, so it cannot claim an ask" };
    }
    if (account.lane !== lane) {
      return { ok: false, reason: `the ask was asked on lane ${account.lane}, and this loop runs lane ${lane}` };
    }
    if (loginMasked && account.login_masked !== loginMasked) {
      return {
        ok: false,
        reason: `the ask was asked on account ${account.login_masked}, and the terminal this loop read is ${loginMasked}`
      };
    }
    if (server && account.server && account.server !== server) {
      return {
        ok: false,
        reason: `the ask was asked on server ${account.server}, and the terminal this loop read is ${server}`
      };
    }
    return { ok: true, reason: null };
  }

  // The row a loop writes into its own state when it has dealt with an ask, whatever the outcome was. It is
  // written for a close that landed, a ticket that was not there, a row for another account, a replay and an
  // expired ask alike, because it is this record - not the page's log - that makes an ask a one-shot.
  function answerFor(request, {
    answeredAtUtc,
    outcome,
    source,
    action,
    done,
    reason
  } = {}) {
    const account = normaliseAccount(request?.account);
    return {
      request_id: String(request?.request_id || ""),
      ticket: Number(request?.ticket),
      symbol: request?.symbol ?? null,
      account: account || null,
      requested_at_utc: request?.requested_at_utc ?? null,
      expires_at_utc: request?.expires_at_utc ?? null,
      requested_by: request?.requested_by ?? REQUESTED_BY.dashboard,
      answered_at_utc: isoStamp(answeredAtUtc || new Date()) || null,
      outcome: Object.values(ANSWER_OUTCOMES).includes(outcome) ? outcome : ANSWER_OUTCOMES.refused,
      source: source ?? null,
      action: action ?? null,
      done: done === true,
      reason: typeof reason === "string" ? reason : ""
    };
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
  // loop's own state, so it reports the ask, its age and the moment its own window closes, and the row
  // leaving the Open positions table on a later snapshot is what shows the trade is out.
  function describeRequest(request, nowMs) {
    const age = requestAgeSeconds(request, nowMs);
    const who = REQUESTED_BY_LABEL[request?.requested_by] || REQUESTED_BY_LABEL.dashboard;
    const asked = `asked by ${who} ${describeAge(age)}`;
    const lane = request?.account?.lane ? ` on ${request.account.lane}` : "";
    const closes = request?.expires_at_utc ? ` Its window closes at ${request.expires_at_utc}.` : "";
    if (!isOpenRequest(request, nowMs)) {
      return {
        tone: "stale",
        age_seconds: age,
        text: `${asked}${lane}, which is outside the ${OPEN_WINDOW_MINUTES} minutes the loop acts within, so it will not be taken.${closes}`
      };
    }
    return {
      tone: "waiting",
      age_seconds: age,
      text: `${asked}${lane}, still inside the ${OPEN_WINDOW_MINUTES} minutes the loop acts within: its next tick takes it.${closes}`
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
    LEGACY_SCHEMA_VERSION,
    DEFAULT_REQUEST_PATH,
    DEFAULT_REPO,
    DEFAULT_BRANCH,
    ALLOWED_SIDES,
    REQUESTED_BY,
    REQUESTED_BY_LABEL,
    ANSWER_OUTCOMES,
    MAX_REQUESTS,
    OPEN_WINDOW_MINUTES,
    CLOCK_SKEW_SECONDS,
    TOKEN_LENGTH,
    NOTE,
    isTicket,
    isLane,
    isTimestamp,
    isoStamp,
    requestIdFor,
    randomToken,
    normaliseAccount,
    resolveExpiry,
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
    requestExpired,
    accountMatches,
    answerFor,
    pendingRequests,
    latestRequest,
    describeRequest,
    normaliseTarget,
    readRemoteRequests,
    commitRequests
  };
});


