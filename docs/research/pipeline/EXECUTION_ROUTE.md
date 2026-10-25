# Research pipeline: execution route

Written 2026-10-25 for the unattended USD Research → red-team → adjudication supervisor. It states only
what the repository can show, and marks every step that is an assumption rather than a verified fact.
Nothing in this document is a claim that a stage has run, that a model has been billed, or that a trading
edge exists.

## The route, in one line

The supervisor writes one Markdown envelope per stage, something outside this repository carries those bytes
to a model, and the returned file comes back through `submit`, which verifies it and registers it in the
Research Library registry or rejects it.

The carrier verified on 2026-10-25 is the local Codex CLI at `0.164.0` running `codex exec` against the
owner's ChatGPT/Codex plan session. It answers `gpt-6-astra`, it can search the web, and it needs this PC to be
on. Each of those three points has a recorded command below, and each one also failed on an earlier build that
this document now names, so the version is part of the route rather than a footnote.

## Interface (verified)

`lib/research_pipeline.js` is the supervisor and `scripts/research-pipeline.js` is its only front end. Both
are local files; the pipeline opens no socket and calls no API.

| Act | Command | What it writes |
| --- | --- | --- |
| see the queue | `node scripts/research-pipeline.js status` | nothing |
| see which stages may run | `plan [--runnable]` | nothing |
| read an envelope | `preview TOPIC STAGE [--chain CHAIN] [--out FILE]` | nothing (a claim and an allowance unit are not spent) |
| start a stage | `dispatch TOPIC STAGE [--chain CHAIN]` | one envelope under `.local/research-pipeline/outbox/`, a claim, one allowance unit |
| accept a return | `submit TOPIC STAGE --file F --model NAME [--chain CHAIN]` | `.local/research-library/objects/…` plus one `data/research-library/documents.json` entry |
| release a dead run | `recover` | queue only |
| stop or restart | `pause --reason TEXT`, `resume` | queue only |
| state the allowance | `allowance --limit N --reserve N --reset` | `.local/research-pipeline/usage.json` |

Verified order inside a dispatch: the stage prompt is read from the checkout and its sha256 compared with the
catalogue, the parent document is read out of the private store and re-hashed, the envelope bytes are written
and re-read from disk, and only then is the claim and the allowance unit recorded. A drift, a missing parent
or a corrupted object therefore stops the dispatch before anything is spent.

Verified order inside a submission: the bytes are checked for completeness (length, headings, truncation and
placeholder markers, unclosed code fences, invalid UTF-8, NUL), a model name is required, the parent stage must
be `delivered`, the object is stored and registered, the stored object is read back and re-hashed, and the
topic page is asked again and must show that exact version as delivered. A rejection is written to
`.local/research-pipeline/returns/rejected/` and the stage may still answer the same dispatch.

## Which stages the supervisor sees (verified 2026-10-25, integrated on main)

The committed catalogue keeps the three stages on the **factor chain** and leaves a topic as a grouping label;
the first version of this supervisor read them off the topic, so against `data/research-library/catalog.json`
every topic looked empty and nothing was runnable. The integration fixes that rather than restating it:

- a topic that carries its own stages still resolves to itself; otherwise the supervisor resolves it to the
  chains listed under that topic;
- a topic that groups more than one chain refuses an unnamed stage with `chain_required` and names the
  candidates, so the operator's choice is made explicitly by `--chain CHAIN_ID` and never guessed;
- the job key and the registered document id are derived from the chain (`usd-factor-live-f1-vix-level/research`,
  document `usd-factor-live-f1-vix-level-research`), so two chains of one topic cannot overwrite each other.

Measured against the committed catalogue on 2026-10-25 with `node scripts/research-pipeline.js status`:
`{"stages":75,"runnable":25,"claimed":0,"delivered":1,"waiting":74,"topics_ready":0}` — 75 is 25 chains times
three stages, and the one delivered stage is the VIX research report version 1 that was already registered.
`plan --runnable` lists the VIX red-team stage plus the research stage of the other twenty-four chains. Those
counts are a reading of the catalogue and the registry; they are not a claim that any new stage ran.

Not done here, and not proof of the milestones: no stage was dispatched against the committed catalogue, because
that spends allowance and writes the registry. The carrier demo below stayed in a scratch root with a
one-chain catalogue, so it verifies the carrier and the registration shape, not the real factor chain, not
automatic allowance handling and not execution with this PC off.

## What the guards show (verified)

`node --test tests/research_pipeline.test.js` — 15 of 15 pass on 2026-10-25, and the same file is discovered
by `npm test`:

- stage ordering: a stage runs only when every earlier stage of its topic is delivered, and a delivered stage
  does not run again;
- dispatch: one envelope carrying the catalogued prompt at its catalogued hash, one allowance unit spent, a
  second live dispatch refused as `already_dispatched`, an expired claim refused as `stale_claim` until
  `recover` requeues it with the attempt count intact;
- submission: verified roundtrip registered under the stage document id and read back byte-identical, a
  duplicate byte submission treated as idempotent, different bytes for a registered stage refused, a missing
  model name refused, a truncated return rejected and kept out of the registry;
- integrity: a prompt that drifted from the catalogue, and a parent object whose bytes no longer match the
  registry, both stop the dispatch before it is claimed;
- allowance: the reserve is never reached, and clearing the count is an explicit `--reset`, not a clock;
- a topic that groups two factor chains refuses an unnamed stage with `chain_required`, and the chain named with
  `--chain` dispatches, registers and reads back under that chain's own document id;
- the CLI itself: status and preview write no state, dispatch → submit → status round-trips, and
  `pause`/`resume`/`allowance`/`recover` are the only controls.

These are guards on the supervisor's own bookkeeping. They say nothing about research quality, and nothing
about the model itself — the carrier section below is where the route stops being an assumption and becomes a
command that was run.

## Billing basis (verified for this account, 2026-10-25)

The pipeline has no knowledge of money or plan limits. It keeps a counter in `usage.json`:
`limit`, `reserve`, `used`, `reset_cadence: "manual"`, `reset_at`. The operator states `limit` and `reserve`;
the supervisor refuses a dispatch at `used >= limit - reserve`.

What the carrier actually spends, verified by running it:

- it authenticates with the ChatGPT/Codex session already in `~/.codex/auth.json` (`auth_mode: chatgpt`);
  `OPENAI_API_KEY` is not set on this host and no key was passed on any command line. The carrier demo
  therefore spent the plan's allowance, not a paid API account;
- the provider reports this account as `plan_type: "plus"` with a 300-minute window, a 10,080-minute window and
  a credits balance of `144.7441982500` at the time of the run;
- one report stage consumed 269,333 input tokens (216,320 of them cached) and 1,632 output tokens in 74
  seconds, and moved the 300-minute window from 27% to 30%. So a stage is a few percent of one five-hour
  window, measured in tokens and percent, not a fixed number of "runs": the supervisor's unit is a dispatch and
  the provider's unit is tokens.

Still not verified: whether any route here could be billed to an API key (nothing in this route sets one), what
the plan's ceiling is in absolute tokens, and whether the allowance left is enough for three stages of real
research on several topics. One stage at ~270k input tokens is a floor, not a ceiling.

## The carrier that was actually run (verified 2026-10-25)

Build matters more than anything else on this route. Three Codex builds are on this host and only one of them
can answer the model:

| Build | Where it comes from | `-m gpt-6-astra` |
| --- | --- | --- |
| `codex-cli 0.147.0` | the `codex` on `PATH` | not tested to completion; predates the model |
| `codex-cli 0.163.0-alpha.11.2` | shipped inside the desktop app (`…\OpenAI\Codex\bin\37f54d68e5533a51\codex.exe`) | refused: `400 invalid_request_error`, "The 'gpt-6-astra' model requires a newer version of Codex" |
| `codex-cli 0.164.0` | `npm install @openai/codex@0.164.0` into a scratch prefix (npm `latest` on 2026-10-25) | answered |

Invocation that worked, with the envelope on stdin and the last message written to a file:

```powershell
Get-Content <envelope>.md -Raw |
  node <scratch>\node_modules\@openai\codex\bin\codex.js exec --json --skip-git-repo-check `
    -m gpt-6-astra -c web_search=live -s read-only -C <root> -o <root>\return.md -
```

What each part of that line establishes:

- `--json` prints one event per line on stdout, so the carrier can be driven without a terminal: `thread.started`
  gives `thread_id`, `item.completed` types are `agent_message`, `web_search`, `command_execution`, and
  `turn.completed` gives `usage` (`input_tokens`, `cached_input_tokens`, `output_tokens`).
- `-c web_search=live` is the only way search is on. `codex exec --help` lists no `--search` flag, and without
  the override the run has no web tool at all. With it, each search is a `web_search` item carrying `action`
  (`search`, `open_page`, `find_in_page`), `url`, `title` and `snippet`, which is exactly the source-retrieval
  evidence a stage report is meant to rest on.
- no `resume` and no `--ephemeral`: every `exec` call is a fresh thread with its own `thread_id`, so a stage
  cannot inherit an earlier stage's context, and dropping `--ephemeral` keeps the rollout file that carries the
  provider's limit numbers.
- `-s read-only` and `-C <root>` keep the agent from writing anything itself; the only bytes that travel back are
  the answer, which `submit` then verifies.

The demonstration run, in a scratch root outside the repository (`%TEMP%\astra-carrier-demo`) with a one-topic
catalogue so the repository registry was never touched:

1. `dispatch astra-carrier-demo research` wrote a 1,572-byte envelope, sha256 `b931dec3…`, prompt
   `151bb39a…` verified against the catalogue, one allowance unit spent.
2. Astra answered in 74 seconds with a 6,179-byte document, five headings, search evidence from
   `developers.openai.com`, thread `01a174a1-8838-76a2-9b2c-474d19bbb4f0`.
3. `submit … --model gpt-6-astra` verified the return (6,179 bytes, 5 headings, no truncation or placeholder
   markers) and registered version 1, sha256 `0621219e…`, `storage: library_object`,
   `public_download: false`; the stored object was read back and matched, and `status` then showed
   `delivered: 1`.

Not demonstrated, and deliberately so: a real factor chain. The VIX report object does exist, though not in this
worktree: it was retrieved from the canonical checkout's private store and re-hashed to the registered value (see
"Before the pilot" below), so the red-team stage has the bytes it must judge. What is still missing is the
coordinator's confirmation of which catalogue and prompt version the pilot reads. The carrier is proven; the chain
over a real topic is the next act, not a claimed result.

## Allowance access and the provider's own limit signal (read path verified, not yet wired)

Reading our allowance is `node scripts/research-pipeline.js allowance`; changing it is
`allowance --limit N --reserve N --reset`. There is no importer, and `usage.json` stays a self-imposed budget:
the supervisor knows nothing about the plan.

The provider's numbers do reach the host, though. `codex exec` without `--ephemeral` writes a rollout to
`~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<thread_id>.jsonl`, and the `thread_id` printed by
`exec --json` is the join key into that filename. Inside it, `token_count` events carry:

```
"rate_limits":{"limit_id":"codex","primary":{"used_percent":30.0,"window_minutes":300,"resets_at":1792973506},
"secondary":{"used_percent":7.0,"window_minutes":10080,"resets_at":1793531220},
"credits":{"has_credits":true,"unlimited":false,"balance":"144.7441982500"},
"plan_type":"plus","rate_limit_reached_type":null}
```

So a machine-readable reset signal exists: `primary.resets_at` is the five-hour window reset and
`secondary.resets_at` the weekly one, both epoch seconds. It is the provider's window, not our counter.
A refused turn surfaces in the same JSONL as `{"type":"error"}` followed by `{"type":"turn.failed"}` (shape
observed on the version-mismatch 400 above); `rate_limit_reached_type` is the field that is non-null on a quota
refusal, taken from the schema. No run has been pushed to the limit to see one, and none should be.

## Allowance control: the provider's numbers, wired in

The supervisor no longer depends on a human reading `usage.json` before a shift. `lib/codex_usage.js` reads a
rollout and turns it into a gate; `lib/research_pipeline.js` enforces that gate on every dispatch. Both halves of
the allowance are enforced together, and neither can be switched off by a run:

- **the operator count** — `limit`, with `reserve` dispatches held back for the owner's own use;
- **the provider windows** — a fresh reading of the plan's own percentages, with a capacity ceiling
  (`capacity_percent`, default 85) that leaves the rest of the five-hour and weekly windows for the owner.

Commands:

```
node scripts/research-pipeline.js allowance                     # both halves, with the windows and reset times
node scripts/research-pipeline.js allowance --provider on|off   # the owner's switch for the provider half
node scripts/research-pipeline.js allowance --capacity-percent 80 --max-age-minutes 60
node scripts/research-pipeline.js allowance --from-rollout FILE # import one rollout (also the resume path)
node scripts/research-pipeline.js allowance --latest-rollout    # import the newest rollout under ~/.codex/sessions
node scripts/research-pipeline.js allowance --refusal "MESSAGE" [--refusal-type T] [--resets-at ISO]
```

What the gate does, in the order it decides:

1. `provider_allowance_unknown` — no reading has been imported, or the reading carries no window. Paused.
2. `provider_refused` — the provider refused a run and no later reading has cleared it. Paused, and `resume`
   refuses too: the reset time in the refusal is the only thing that ends it.
3. `provider_allowance_stale` — the reading is older than `max_age_minutes`, or a window it describes has already
   reset. Paused, because percentages from an ended window say nothing about the current one.
4. `provider_allowance_exhausted` — either window is at or above `capacity_percent`, or the operator count has
   reached `limit - reserve`. Paused, and the reason names the window and its `resets_at`.

The order matters for an unattended loop: unknown is never permission, and nothing expires into permission.

Pausing and resuming without losing work:

- a failing gate pauses the queue itself (`paused_by: "allowance"`) and refuses the dispatch. An owner pause
  (`paused_by: "operator"`) is never lifted by this code;
- `allowance --from-rollout` (or `--latest-rollout`) is the resume path. A reading that clears the gate lifts an
  allowance pause and leaves the queue untouched; a reading that does not clear it keeps the pause and records why;
- the queue keeps every claim, attempt count and registered version across a pause, and `recover` still releases
  an expired lease. A stage that was already registered is not re-dispatched, and re-submitting identical bytes
  returns `duplicate: true` instead of writing a second version.

Recording a refusal also switches the provider half on: a refusal is proof that the plan's limit applies, so the
supervisor must not keep dispatching because nobody had enabled the check.

One deliberate limit: `rate_limits` is only present in a rollout written by a run that reached the provider. A run
started with `--ephemeral` writes no rollout, and a run that never got that far writes no limit numbers, so
`allowance --from-rollout` on such a file fails with `provider_reading_incomplete` instead of importing zeros.

## Per-stage execution receipts

A model name inside a document proves nothing. `submit --rollout` reads what the runtime recorded and compares it
with what is being registered:

- `model` in the rollout's `turn_context` must equal `--model`, or the submission fails `model_mismatch`;
- the registered bytes must appear among the run's assistant messages, or the submission fails
  `return_not_in_rollout` — a document assembled by hand is not this run's answer;
- `--envelope SHA256` must equal the hash of the dispatched envelope, or `envelope_mismatch`; the envelope
  itself carries the catalogue prompt hash and the exact parent version the stage judges, so this is what
  "the stage received its exact inputs" means in practice;
- `--exec-log FILE` reads the captured `codex exec --json` stream (UTF-8 or UTF-16LE): its `thread_id` must match
  the rollout's, and `--require-search` refuses a stage with no completed `web_search` item
  (`search_not_observed`). The receipt records the query, the actions (`search`, `open_page`, `find_in_page`) and
  the source URLs the run actually saw.

Each receipt is written to `.local/research-pipeline/receipts/` and attached to the job record, with the rollout's
own sha256, thread id, CLI version, plan type, token usage and windows.

Verified on 2026-10-25 against the carrier demonstration: parsing the captured `astra_exec.jsonl` (UTF-16LE)
yields thread `01a174a1-8838-76a2-9b2c-474d19bbb4f0`, five completed `web_search` items with actions
`search`, `open_page` and `find_in_page`, and source URLs on `developers.openai.com`; parsing the matching
rollout yields the same thread, `model: "gpt-6-astra"`, `cli_version: "0.164.0"`, `plan_type: "plus"`, and the
two windows. The rollout alone does **not** carry the search results, which is why the exec stream is part of the
receipt.


## Running with the local PC off (not implemented, and excluded by choice)

The supervisor is a one-shot CLI on this host and so is the carrier: `codex exec` runs as a local process, reads
`~/.codex/auth.json`, and writes its rollout under `~/.codex/sessions`. Nothing runs when the machine is off, and
no scheduler, service, hosted runner or remote worker has been added. `recover` exists precisely because a run
can be cut off by a shutdown, and it requeues an expired claim without losing the attempt count.

Three ways to move a stage off this PC, and why none of them is in place:

- a provider-side cloud or scheduled task: it runs in a remote sandbox, not in this checkout, so it cannot write
  `.local/research-pipeline/outbox/`, cannot read the private objects, and cannot run `submit`. Provider
  documentation for those surfaces could not be retrieved during this session (every fetch of
  `developers.openai.com` and `learn.chatgpt.com` returned an empty body), so their exact terms are unverified
  here rather than contradicted;
- a self-hosted runner: it needs a machine left on, which is the same requirement as leaving this PC on, plus a
  second host to keep patched;
- a hosted runner with this session's credentials: that exports the owner's plan session to a third-party host,
  and hosted minutes are paid hosting. Both are out of scope by instruction.

So the honest statement is: with the PC off, the chain does not run, and no unpaid supported route found here
changes that. The carrier demo adds one measured fact — the answer arrives in about a minute and a quarter of
wall-clock time, so an on-PC run of a full topic is a matter of minutes, not an overnight job.

## Store access (verified boundary)

The supervisor runs as the same account as the library. Objects go to `.local/research-library/objects/`,
which is ignored by Git; the only repository-visible file it writes is the registry entry in
`data/research-library/documents.json`. A published page can show that metadata row; the bytes stay behind the
local service, as `docs/research-library/README.md` describes.

Observed on 2026-10-25: in a fresh worktree, `.local/research-library/` held only the service token and no
objects, so dispatching the red-team stage of the VIX topic failed with
`usd-baseline-audit-01-vix-usd-report version 1 is registered but its object is absent`. That is the honest
answer, not a defect: the stored bytes are intentionally outside Git, so a checkout that has not received them
cannot run a stage that judges them. A worktree is for code and guards; the pipeline runs where the objects are.

The demonstration run confirmed the registration shape end to end: the row it wrote reads `storage:
"library_object"`, `public_download: false`, `origin: "external_upload"`, `model: "gpt-6-astra"`, one version
with the returned sha256, and `status` listed the stage as `delivered`.

Where a finished report is visible, stated plainly:

- hosted dashboard (`https://kevincreedycars-debug.github.io/trading-agent-dashboard/`, GitHub Pages from a
  commit): the published registry row — id, title, type, model, date, version, hash, "not published" note. Not
  the bytes;
- local service: the topic page renders the stored document and offers View/Download, and the download is hashed
  against the registry before it is served;
- so "verified dashboard download" today means the local service. Publishing report bytes would mean committing
  them under `docs/` and deploying, which is a change of the storage decision, not a step in this route.

## Verified on 2026-10-25, reported separately

- **Carrier verified.** `codex exec` from `@openai/codex@0.164.0`, `-m gpt-6-astra -c web_search=live -s read-only`,
  answered a dispatched envelope; the return was verified and registered as version 1 with
  `storage: library_object`, `public_download: false`, `status: delivered`.
- **Live web search verified.** The captured `astra_exec.jsonl` of that run holds five completed `web_search`
  items (`search`, `open_page`, `find_in_page`) with source URLs on `developers.openai.com`; the rollout of the
  same thread records `model: "gpt-6-astra"` and `cli_version: "0.164.0"`. That is retrieval, not a claim inside
  an answer. The 6,179-byte answer also cites the pages it opened.
- **Automatic allowance handling verified.** `lib/codex_usage.js` parses a real rollout into the two windows,
  their reset times, the plan, the credits and any refusal; `lib/research_pipeline.js` pauses and refuses on
  unknown, stale, refused or exhausted, lifts an allowance pause only on a fresh reading, and leaves the queue,
  the attempt counts and the registered versions intact across the pause. Guarded by tests that write rollout
  fixtures and never call a model.
- **Real research chain not verified.** No stage over a real topic has been executed through the carrier yet.
  The VIX research report exists, but the red-team stage needs the report bytes, the revised prompts and an
  execution directory the coordinator agrees to.
- **Hosted unattended execution not verified.** With this PC off nothing runs: the carrier is a local process
  reading `~/.codex/auth.json`, and no unpaid supported remote route was found.

## Before the pilot: what is already known, and what is not

Established from the shared repository on 2026-10-25, without changing the canonical checkout or its registry:

- the VIX research report is registered as `usd-baseline-audit-01-vix-usd-report` version 1, 84,056 bytes,
  sha256 `e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d`, `storage: library_object`,
  `public_download: false`. Its object was retrieved through the authorised private store at
  `.local/research-library/objects/e4/e41519…` in the canonical checkout and its bytes re-hash to that value,
  so it does not need regenerating;
- no red-team and no adjudication document exists for that topic in the canonical registry or in the registry on
  `origin/main`. The two roles that remain are red-team and adjudication; the research role is done;
- the prompt question is real and unresolved: `origin/main` (65444c58) carries a six-topic catalogue whose briefs
  are embedded as `dispatched_brief_text` plus `packs` and `probes` — VIX topic block sha256
  `9ac5677f64a052ce8790bc400f693f750f5033273b85073f47fd8110454d6606` — with the stage-1/stage-2 duplication fixed at
  `fe56e520`, while this branch carries a catalogue with a `stages[]` array and separate prompt files under
  `docs/research/topics/usd/vix-level-and-risk-regime/` (`69daff3c…`, `f391fce4…`, `4587ebca…`), published by
  `c89a5faa`, which is not on `origin/main`. The supervisor verifies prompts against whatever catalogue it is
  given, so the coordinator has to say which catalogue the pilot reads, and the pilot then records those hashes;
- the canonical checkout was clean when inspected, on `research/usd-session-20261013` at `1e6ab197`, and the shared
  object database already contains this branch, so its commits are visible to the coordinator without a push. It
  was being edited by another process later in the same session (26 modified paths), which is why this lane reads
  it and never writes to it.


1. Whether the pinned carrier (`@openai/codex@0.164.0`, `exec -m gpt-6-astra -c web_search=live`) is the
   supported route, and where that binary is allowed to come from — npm at a pinned version, or a future app
   build that ships a CLI which knows the model.
2. ~~Whether the provider's `rate_limits` block should be read by the pipeline or stay a human check before each
   shift.~~ Decided by the owner on 2026-10-25: it is wired in as code, with a configurable capacity ceiling and a
   reserve, because unattended operation cannot depend on a human check each shift.
3. Whether an unattended carrier is wanted at all, given that with this PC off there is no unpaid route, and
   that a hosted runner means exporting the plan session and paying for minutes.
4. Whether report bytes should ever be public on Pages. Today they are deliberately not.
