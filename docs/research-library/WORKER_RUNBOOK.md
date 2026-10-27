# Research worker runbook

`scripts/research-worker.js` is the unattended half of the research library. It runs **one pass** and stops:
recover what died, read the provider rollout, read the allowance, take the next runnable stage, dispatch it,
refuse the answer unless the run's own record proves it, deliver through the hosted store, write a receipt.

## One pass, in the order the gates apply

1. `recover()` clears claims left behind by a pass that died mid-stage.
2. The provider reading. With `--provider-reading FILE` the pass imports that rollout; by default it imports the
   newest rollout under `--codex-home` (the Codex home the carrier writes to). A pass **never** switches the
   provider half of the allowance on itself: with the provider switch off it reports `provider_disabled` and
   leaves the allowance as it found it. A dry run imports nothing at all.
3. `budget()` must be readable and not exhausted; `dispatch` is called with `require_provider`, so a missing,
   stale, refused or over-capacity reading pauses the queue instead of spending it.
4. The carrier is a local `codex exec` process using its own `~/.codex/auth.json`. No key, token or hosted runner
   is involved.
5. The answer is checked against the run before it is stored: same thread in the event stream and the rollout,
   the model the runtime recorded, a completed `web_search` where the stage needs a source, and the exact bytes
   in the rollout's assistant messages.
6. The hosted store is written and read back **before** the local registry records the same document. A pass that
   reports `hosted_not_configured` has delivered nothing and adopted nothing.

## Commands

```text
node scripts/research-worker.js --help
node scripts/research-worker.js --dry-run --max-stages 1 --asset USD
node scripts/research-worker.js --max-stages 1 --stage research --asset USD
node scripts/research-worker.js --max-stages 3 --asset USD
node scripts/research-worker.js --provider-reading <rollout.jsonl> --max-stages 1
node scripts/research-worker.js --no-provider-reading --max-stages 1
```

`--dry-run` plans the next stage and writes no allowance state, no receipt and no document. `--max-stages N`
bounds one pass; a refusal stops the pass at once, whatever remains of the bound.

## What a pass reports

The pass prints one JSON summary: `provider_reading` (`path`, `observed_at`, `windows`, or the refusal code),
`allowance`, one `stages` entry per attempted stage with `status`, `thread_id`, `model`, `hosted` and
`receipt`, and `stopped` (`reason`, `code`, `message`). `ok` is `false` whenever the pass stopped on something the
owner has to clear — a spent budget, a refused provider reading, an exhausted or disabled provider half, a failed
or timed-out carrier, an answer the run never produced, or a hosted store that was not configured. A scheduler
must read the exit code, not the stage count.

The same record is appended to `.local/research-pipeline/worker/runs.jsonl`, and each attempted stage keeps its
own receipt under `.local/research-pipeline/receipts/`.

## Scheduling on the host

One task, one pass, no overlap:

```powershell
schtasks /Create /TN "Astra research pass" /SC MINUTE /MO 30 /TR "node D:\astra\scripts\research-worker.js --max-stages 1 --asset USD" /RU <account> /RP *
```

Set the task to *do not start a new instance* while one is running, and run under the account that owns the
Codex sign-in so the carrier finds its own auth. A pass that finds another pass's live claim skips that stage
rather than fighting over it.

## Tests

`node --test tests/research_worker.test.js` runs the pass against a stub carrier: it covers a delivered stage,
`search_not_observed`, `provider_disabled`, `provider_allowance_unknown`, `provider_allowance_exhausted`,
`return_not_in_rollout`, `carrier_failed`, `carrier_timeout`, `hosted_not_configured`, `dry_run`, a research then
red-team pair, and the provider rollout read from the worker's own Codex home.
