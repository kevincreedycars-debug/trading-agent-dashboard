# Research pipeline: execution route

Written 2026-10-25 for the unattended USD Research → red-team → adjudication supervisor. It states only
what the repository can show, and marks every step that is an assumption rather than a verified fact.
Nothing in this document is a claim that a stage has run, that a model has been billed, or that a trading
edge exists.

## The route, in one line

The supervisor writes one Markdown envelope per stage, something outside this repository carries those bytes
to a model, and the returned file comes back through `submit`, which verifies it and registers it in the
Research Library registry or rejects it.

## Interface (verified)

`lib/research_pipeline.js` is the supervisor and `scripts/research-pipeline.js` is its only front end. Both
are local files; the pipeline opens no socket and calls no API.

| Act | Command | What it writes |
| --- | --- | --- |
| see the queue | `node scripts/research-pipeline.js status` | nothing |
| see which stages may run | `plan [--runnable]` | nothing |
| read an envelope | `preview TOPIC STAGE [--out FILE]` | nothing (a claim and an allowance unit are not spent) |
| start a stage | `dispatch TOPIC STAGE` | one envelope under `.local/research-pipeline/outbox/`, a claim, one allowance unit |
| accept a return | `submit TOPIC STAGE --file F --model NAME` | `.local/research-library/objects/…` plus one `data/research-library/documents.json` entry |
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

## What the guards show (verified)

`node --test tests/research_pipeline.test.js` — 14 of 14 pass on 2026-10-25, and the same file is discovered
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
- the CLI itself: status and preview write no state, dispatch → submit → status round-trips, and
  `pause`/`resume`/`allowance`/`recover` are the only controls.

These are guards on the supervisor's own bookkeeping. They say nothing about whether any model can run a
stage unattended, and nothing about research quality.

## Billing basis (assumed, not verified)

The pipeline has no knowledge of money or plan limits. It keeps a counter in `usage.json`:
`limit`, `reserve`, `used`, `reset_cadence: "manual"`, `reset_at`. The operator states `limit` and `reserve`;
the supervisor refuses a dispatch at `used >= limit - reserve`.

Not verified, and therefore not asserted anywhere in code:

- whether an execution route is billed per token through an API key or against a ChatGPT/Codex plan quota;
- how many dispatches such a plan allows in a window, and whether a deep-research run costs one unit or more;
- whether any machine-readable reset signal exists. The code assumes none, which is why `reset_cadence` is
  `manual` and `--reset` is required.

Until the owner states those facts, treat `limit`/`reserve` as a self-imposed budget, not a measurement of
what the plan allows.

## Allowance access (verified interface, unverified source)

Reading the allowance is `node scripts/research-pipeline.js allowance`; changing it is
`allowance --limit N --reserve N --reset`. There is no importer, because the repository holds no credential
and no plan endpoint. A run started with the wrong `limit` stops at the wrong place, so the first act of an
unattended shift is to read the allowance, not to dispatch.

## Running with the local PC off (not implemented)

The supervisor is a one-shot CLI on this host. It does not run when the machine is off, and no scheduler,
service, hosted runner or remote worker has been added. `recover` exists precisely because a run can be cut
off by a shutdown, and it requeues an expired claim without losing the attempt count.

To make a stage happen with the PC off, something outside this checkout must (a) start the dispatch, (b) carry
the envelope to a model, and (c) bring the return back to `submit`. None of those three legs is implemented
here, and none is verified. `dispatch`/`submit` are written so that any such carrier stays replaceable: a
carrier moves bytes and nothing else.

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

## Still the owner's decision

1. The execution route and its billing basis, so the allowance numbers mean something.
2. Whether an unattended carrier is wanted at all, and where it would run when this PC is off.
