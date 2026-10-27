'use strict';

// Reads the provider's own limit numbers out of a Codex rollout file, and decides whether the supervisor
// may spend another dispatch.
//
// A rollout is the JSONL file `codex exec` writes to `~/.codex/sessions/YYYY/MM/DD/` when the run is not
// started with `--ephemeral`. Two kinds of line matter here:
//
//   - `token_count` events carry `rate_limits`: the primary window (the five-hour Codex window), the
//     secondary window (the weekly one), each with `used_percent`, `window_minutes` and an epoch
//     `resets_at`, plus the plan, the credit balance and `rate_limit_reached_type`;
//   - `turn_context` events carry the model the runtime actually used. That field, not the answer text,
//     is what proves which model answered a stage.
//
// Nothing here infers a number the file does not contain: a rollout without a rate-limit event is an
// unknown allowance, and unknown means paused.
//
// docs/research/pipeline/EXECUTION_ROUTE.md records what is verified about this signal and what is not.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_POLICY = Object.freeze({
  enabled: false,
  capacity_percent: 85,
  max_age_minutes: 90
});

const WINDOW_NAMES = Object.freeze(['primary', 'secondary']);

const REFUSAL_PATTERN = /rate limit|usage limit|limit reached|quota|too many requests|try again (later|in)/i;

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// The purchased-credit balance, as the provider reported it. It is a decimal string in the rollout, and it is
// read as a number only for the one comparison that matters: did it fall since the reading that was taken as
// the baseline. A balance that cannot be read is not treated as a spend and not treated as proof of no spend.
function creditBalance(credits) {
  if (!credits || typeof credits !== 'object') return null;
  const text = asText(credits.balance).trim();
  if (!text) return null;
  return finite(text);
}

function isoFrom(value) {
  const number = finite(value);
  if (number === null) return null;
  const millis = number > 1e12 ? number : number * 1000;
  const date = new Date(millis);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeWindow(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const used = finite(raw.used_percent);
  const minutes = finite(raw.window_minutes);
  const resetsAt = isoFrom(raw.resets_at);
  if (used === null && minutes === null && !resetsAt) return null;
  return {
    used_percent: used,
    window_minutes: minutes,
    resets_at: resetsAt,
    resets_at_epoch: finite(raw.resets_at)
  };
}

// Tolerant by design: one unreadable line in a rollout must not hide the limit numbers that follow it, and
// the count of skipped lines is reported so a half-written file is visible rather than silently trusted.
function parseRolloutBytes(buffer, options = {}) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer);
  const result = {
    path: options.path ? path.resolve(options.path) : null,
    bytes: Buffer.byteLength(text, 'utf8'),
    sha256: sha256(Buffer.from(text, 'utf8')),
    thread_id: null,
    model: null,
    model_provider: null,
    cli_version: null,
    plan_type: null,
    windows: {},
    credits: null,
    rate_limit_reached_type: null,
    refusal: null,
    observed_at: null,
    first_event_at: null,
    last_event_at: null,
    usage: { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 },
    assistant_text: '',
    assistant_messages: [],
    turns: 0,
    events: 0,
    unreadable_lines: 0,
    rate_limit_events: 0
  };

  let lastRefusal = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event = null;
    try {
      event = JSON.parse(line);
    } catch (error) {
      result.unreadable_lines += 1;
      continue;
    }
    if (!event || typeof event !== 'object') {
      result.unreadable_lines += 1;
      continue;
    }
    result.events += 1;
    const at = asText(event.timestamp) || null;
    if (at) {
      if (!result.first_event_at) result.first_event_at = at;
      result.last_event_at = at;
    }
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};

    if (event.type === 'session_meta') {
      result.thread_id = asText(payload.id || payload.session_id) || result.thread_id;
      result.model_provider = asText(payload.model_provider) || result.model_provider;
      result.cli_version = asText(payload.cli_version) || result.cli_version;
    }
    if (event.type === 'turn_context') {
      result.turns += 1;
      if (asText(payload.model)) result.model = asText(payload.model);
    }
    if (event.type === 'token_usage_record' && payload.usage && typeof payload.usage === 'object') {
      result.usage.input_tokens += finite(payload.usage.input_tokens) || 0;
      result.usage.output_tokens += finite(payload.usage.output_tokens) || 0;
      result.usage.cached_input_tokens += finite(payload.usage.cached_input_tokens) || 0;
    }
    // The answer itself, as the runtime recorded it. A submitted return that does not appear here did not
    // come out of this run, whatever a model name in the document claims.
    if (event.type === 'response_item' && payload.type === 'message' && payload.role === 'assistant' && Array.isArray(payload.content)) {
      payload.content.forEach(part => {
        if (!part || typeof part !== 'object') return;
        if ((part.type === 'output_text' || part.type === 'text') && typeof part.text === 'string') {
          result.assistant_messages.push(part.text);
          result.assistant_text += `${result.assistant_text ? '\n' : ''}${part.text}`;
        }
      });
    }



    const limits = payload.rate_limits && typeof payload.rate_limits === 'object' ? payload.rate_limits : null;
    if (limits) {
      result.rate_limit_events += 1;
      result.observed_at = at || result.observed_at;
      result.plan_type = asText(limits.plan_type) || result.plan_type;
      if (limits.credits && typeof limits.credits === 'object') {
        result.credits = {
          has_credits: limits.credits.has_credits === true,
          unlimited: limits.credits.unlimited === true,
          balance: asText(limits.credits.balance) || null
        };
      }
      if (asText(limits.rate_limit_reached_type)) {
        result.rate_limit_reached_type = asText(limits.rate_limit_reached_type);
      }
      WINDOW_NAMES.forEach(name => {
        const window = normalizeWindow(limits[name]);
        if (window) result.windows[name] = window;
      });
    }

    // A refusal can surface as a non-null `rate_limit_reached_type` or as a failed turn whose only
    // explanation is a limit message. Both are recorded; neither is guessed from an ordinary error.
    const reached = asText(payload.rate_limit_reached_type);
    const message = asText(payload.message || (payload.error && payload.error.message) || '');
    const failed = event.type === 'turn.failed' || Boolean(payload.error);
    if (reached || (failed && REFUSAL_PATTERN.test(message))) {
      lastRefusal = {
        type: reached || 'rate_limit',
        message: message || `the provider reported ${reached || 'a limit'}`,
        at: at || null
      };
    }
  }

  if (lastRefusal) {
    const resets = result.windows.primary && result.windows.primary.resets_at
      ? result.windows.primary.resets_at
      : result.windows.secondary && result.windows.secondary.resets_at
        ? result.windows.secondary.resets_at
        : null;
    result.refusal = { ...lastRefusal, resets_at: resets };
  }
  return result;
}

function parseRolloutFile(filePath) {
  const resolved = path.resolve(filePath);
  return parseRolloutBytes(fs.readFileSync(resolved), { path: resolved });
}

// `codex exec --json` writes its event stream to stdout, and on Windows a captured stream is often UTF-16,
// which is why the decoder is explicit rather than a plain toString.
function decodeCapturedLog(buffer) {
  if (Buffer.isBuffer(buffer) && buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.slice(2).toString('utf16le');
  }
  if (Buffer.isBuffer(buffer) && buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.slice(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  return (Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer)).replace(/^\uFEFF/, '');
}

// The carrier's own event stream is the only place a search is visible: the rollout keeps the tool calls but
// not the search results. One completed `web_search` item is one retrieval; its results are the sources the
// stage could actually have read.
function parseExecLogBytes(buffer, options = {}) {
  const text = decodeCapturedLog(Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer), 'utf8'));
  const result = {
    path: options.path ? path.resolve(options.path) : null,
    bytes: Buffer.byteLength(text, 'utf8'),
    sha256: sha256(Buffer.from(text, 'utf8')),
    thread_id: null,
    events: 0,
    unreadable_lines: 0,
    searches: [],
    sources: []
  };
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event = null;
    try {
      event = JSON.parse(line);
    } catch (error) {
      result.unreadable_lines += 1;
      continue;
    }
    result.events += 1;
    if (event.type === 'thread.started' && asText(event.thread_id)) result.thread_id = asText(event.thread_id);
    const item = event.item && typeof event.item === 'object' ? event.item : null;
    if (event.type !== 'item.completed' || !item || item.type !== 'web_search') continue;
    const action = item.action && typeof item.action === 'object' ? item.action : {};
    const entry = {
      action: asText(action.type) || 'search',
      query: asText(action.query || item.query) || null,
      url: asText(action.url) || null,
      title: asText(item.title) || null
    };
    result.searches.push(entry);
    const found = [];
    if (entry.url) found.push(entry.url);
    (Array.isArray(item.results) ? item.results : []).forEach(hit => {
      if (!hit || typeof hit !== 'object') return;
      const url = asText(hit.url);
      if (url) found.push(url);
      else if (asText(hit.domain)) found.push(asText(hit.domain));
    });
    found.forEach(url => {
      if (!result.sources.includes(url)) result.sources.push(url);
    });
  }
  return result;
}

function parseExecLogFile(filePath) {
  const resolved = path.resolve(filePath);
  return parseExecLogBytes(fs.readFileSync(resolved), { path: resolved });
}

// The newest rollout under a Codex home. `codex exec` names the file `rollout-<timestamp>-<thread_id>.jsonl`,
// so newest-by-mtime is a usable answer when the caller has the thread id but not the path.
function latestRolloutFile(options = {}) {
  const home = path.resolve(options.codexHome || process.env.CODEX_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '.', '.codex'));
  const sessions = path.join(home, 'sessions');
  if (!fs.existsSync(sessions)) return null;
  let newest = null;
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      const stat = fs.statSync(full);
      if (!newest || stat.mtimeMs > newest.mtimeMs) newest = { path: full, mtimeMs: stat.mtimeMs };
    }
  };
  walk(sessions);
  return newest ? newest.path : null;
}


function normalizePolicy(provider) {
  const source = provider && typeof provider === 'object' ? provider : {};
  const capacity = finite(source.capacity_percent);
  const maxAge = finite(source.max_age_minutes);
  const baseline = source.credits_baseline && typeof source.credits_baseline === 'object' ? source.credits_baseline : null;
  const baselineBalance = baseline ? finite(baseline.balance) : null;
  return {
    enabled: source.enabled === true,
    capacity_percent: capacity === null ? DEFAULT_POLICY.capacity_percent : Math.min(100, Math.max(1, capacity)),
    max_age_minutes: maxAge === null ? DEFAULT_POLICY.max_age_minutes : Math.max(1, maxAge),
    credits_baseline: baseline && baselineBalance !== null
      ? { ...baseline, balance: baselineBalance }
      : null,
    snapshot: source.snapshot && typeof source.snapshot === 'object' ? source.snapshot : null
  };
}

function describeWindow(name, window, policy) {
  const used = finite(window.used_percent);
  return {
    name,
    used_percent: used,
    capacity_percent: policy.capacity_percent,
    remaining_percent: used === null ? null : Math.max(0, Number((policy.capacity_percent - used).toFixed(1))),
    window_minutes: finite(window.window_minutes),
    resets_at: window.resets_at || null,
    resets_in_minutes: window.resets_at ? Math.max(0, Math.round((Date.parse(window.resets_at) - policy.now) / 60000)) : null
  };
}

// The decision, in one place so the queue, the CLI and the tests cannot disagree about it. An unreadable
// or missing signal is never treated as permission.
function evaluateGate({ provider, now } = {}) {
  const current = finite(now);
  const at = current === null ? Date.now() : current;
  const policy = { ...normalizePolicy(provider), now: at };
  const snapshot = policy.snapshot;
  const gate = {
    enforced: policy.enabled,
    ok: true,
    code: 'provider_disabled',
    reason: 'the provider limit signal is not wired into this allowance; the budget is the operator count only',
    capacity_percent: policy.capacity_percent,
    owner_reserve_percent: Math.max(0, 100 - policy.capacity_percent),
    max_age_minutes: policy.max_age_minutes,
    observed_at: snapshot ? snapshot.observed_at || null : null,
    age_minutes: null,
    plan_type: snapshot ? snapshot.plan_type || null : null,
    credits: snapshot ? snapshot.credits || null : null,
    credits_baseline: policy.credits_baseline,
    refusal: snapshot ? snapshot.refusal || null : null,
    windows: []
  };
  if (!policy.enabled) return gate;

  if (!snapshot) {
    return {
      ...gate,
      ok: false,
      code: 'provider_allowance_unknown',
      reason: 'no provider reading has been imported, so the remaining allowance cannot be established; run allowance --from-rollout FILE (or --latest-rollout) before dispatching'
    };
  }

  const observed = snapshot.observed_at ? Date.parse(snapshot.observed_at) : NaN;
  if (Number.isFinite(observed)) gate.age_minutes = Math.round(((at - observed) / 60000) * 10) / 10;
  gate.windows = WINDOW_NAMES
    .filter(name => snapshot.windows && snapshot.windows[name])
    .map(name => describeWindow(name, snapshot.windows[name], policy));

  const refusal = snapshot.refusal && typeof snapshot.refusal === 'object' ? snapshot.refusal : null;
  if (refusal) {
    const refusedAt = refusal.at ? Date.parse(refusal.at) : NaN;
    const cleared = Number.isFinite(observed) && Number.isFinite(refusedAt) && observed > refusedAt;
    if (!cleared) {
      const reset = refusal.resets_at || (gate.windows[0] && gate.windows[0].resets_at) || null;
      return {
        ...gate,
        ok: false,
        code: 'provider_refused',
        reason: `the provider refused a run (${refusal.type || 'rate_limit'}: ${refusal.message}${reset ? `; the window resets at ${reset}` : ''}); wait for the reset and import a fresh reading before resuming`,
        refusal: { ...refusal, resets_at: reset }
      };
    }
  }


  if (!Number.isFinite(observed)) {
    return { ...gate, ok: false, code: 'provider_allowance_unknown', reason: 'the imported provider reading carries no observation time, so its age cannot be established' };
  }
  if (!gate.windows.length) {
    return { ...gate, ok: false, code: 'provider_allowance_unknown', reason: 'the imported rollout carries no usage window, so the remaining allowance cannot be established' };
  }
  if (gate.age_minutes > policy.max_age_minutes) {
    return {
      ...gate,
      ok: false,
      code: 'provider_allowance_stale',
      reason: `the provider reading is ${gate.age_minutes} minutes old and the limit is ${policy.max_age_minutes}; import a fresh reading before dispatching`
    };
  }
  const rolled = gate.windows.find(window => window.resets_at && Date.parse(window.resets_at) <= at);
  if (rolled) {
    return {
      ...gate,
      ok: false,
      code: 'provider_allowance_stale',
      reason: `the ${rolled.name} window reset at ${rolled.resets_at}, so the imported percentages describe a window that has ended; import a fresh reading`
    };
  }
  // The ChatGPT-authenticated route carries a credit balance of its own, and a balance that falls between two
  // readings is the only machine-readable evidence that the plan's included allowance ran out and the carrier
  // moved onto purchased credits. Once it falls, every later reading carries the lower number, so the baseline
  // is what makes the drop visible at all - and only the owner puts it back.
  const baselineCredit = creditBalance(gate.credits_baseline);
  const currentCredit = creditBalance(gate.credits);
  if (baselineCredit !== null && currentCredit !== null && currentCredit < baselineCredit) {
    const spent = Number((baselineCredit - currentCredit).toFixed(4));
    return {
      ...gate,
      ok: false,
      code: 'provider_credits_spent',
      reason: `the credit balance fell from ${baselineCredit} to ${currentCredit} (${spent} spent) since the baseline taken at ${gate.credits_baseline.at || 'an unrecorded time'}, so the plan's included allowance was exhausted and the carrier drew on purchased credits; the pass stops until the owner re-baselines with allowance --rebaseline-credits`
    };
  }

  const over = gate.windows.find(window => window.used_percent !== null && window.used_percent >= policy.capacity_percent);
  if (over) {
    return {
      ...gate,
      ok: false,
      code: 'provider_allowance_exhausted',
      reason: `the ${over.name} window is at ${over.used_percent}% and this budget stops at ${policy.capacity_percent}%, keeping ${gate.owner_reserve_percent}% for the owner; it resets at ${over.resets_at || 'an unpublished time'}`
    };
  }

  const busiest = gate.windows.reduce((worst, window) => {
    if (window.used_percent === null) return worst;
    return !worst || window.used_percent > worst.used_percent ? window : worst;
  }, null);
  return {
    ...gate,
    code: 'provider_ok',
    reason: busiest
      ? `the ${busiest.name} window is at ${busiest.used_percent}% of ${policy.capacity_percent}% usable, resets at ${busiest.resets_at || 'an unpublished time'}`
      : 'the provider reading carries no percentage, but no window is over budget'
  };
}

module.exports = {
  DEFAULT_POLICY,
  WINDOW_NAMES,
  parseRolloutBytes,
  parseRolloutFile,
  parseExecLogBytes,
  parseExecLogFile,
  latestRolloutFile,
  evaluateGate,
  creditBalance
};
