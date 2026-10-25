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

Not demonstrated, and deliberately so: a real factor chain. In this worktree `.local/research-library/objects/`
is empty, so the red-team stage of the VIX topic cannot re-hash the report it is meant to judge (see below), and
the revised stage prompts are still with the research coordinator. The carrier is proven; the chain over real
topics is the next act, not a claimed result.

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
`secondary.resets_at` the weekly one, both epoch seconds. It is the provider's window, not our counter, and
nothing in `lib/` reads it yet — `reset_cadence` is still `manual`. A refused turn surfaces in the same JSONL as
`{"type":"error"}` followed by `{"type":"turn.failed"}` (shape observed on the version-mismatch 400 above);
`rate_limit_reached_type` is the field that should be non-null on a quota refusal, which is inferred from the
schema and not tested, because no run has been pushed to the limit and none should be.

The first act of an unattended shift therefore remains: read our allowance, read the last rollout's
`rate_limits`, and only then dispatch.

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

## Still the owner's decision

1. Whether the pinned carrier (`@openai/codex@0.164.0`, `exec -m gpt-6-astra -c web_search=live`) is the
   supported route, and where that binary is allowed to come from — npm at a pinned version, or a future app
   build that ships a CLI which knows the model.
2. Whether the provider's `rate_limits` block should be read by the pipeline (an `allowance --from-rollout`
   style import) or stay a human check before each shift.
3. Whether an unattended carrier is wanted at all, given that with this PC off there is no unpaid route, and
   that a hosted runner means exporting the plan session and paying for minutes.
4. Whether report bytes should ever be public on Pages. Today they are deliberately not.
