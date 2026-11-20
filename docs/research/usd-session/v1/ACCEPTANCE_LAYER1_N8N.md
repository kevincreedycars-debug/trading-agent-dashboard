# Layer 1 n8n backtester — acceptance package (2026-11-20)

Research only. This package records what the USD Layer 1 n8n backtester has actually proved, what it has
not, and the exact artefact behind every statement. No workflow is scheduled, no webhook is left
authenticated for unattended use, and no order, stop, size, feed or runtime table was read or written.
Every number below is read from a committed artefact; none is typed in by hand.

The acceptance classes are kept apart on purpose. A passing local test is not a reproduction, a
reproduction is not a validated historical run, and a validated run is not an edge.

## 1. Verdict

| Class | Question | Evidence | Verdict |
| --- | --- | --- | --- |
| Identity and determinism | Is the checked-in workflow the build of the pinned sources? | manifest `usd-l1-cloud-workflows-v1`; `npm run build:usd-l1-n8n` rewrites the same bytes; `npm run test:usd-l1-n8n` 15/15 | **accepted** |
| Swap behaviour | Can the model change without the morning, dataset, gate or scoring changing? | four recorded mornings, twelve executions 5471-5482, all `success` | **accepted** |
| Reproduction | Does the Cloud bundle reproduce the Node controller, and the controller the stored panel? | 1,450/1,450 Cloud decisions; 2,175/2,175 decisions and 8,700/8,700 results locally, 0 mismatches | **accepted** |
| Strict historical validity | Is every consumed input present, fresh, clocked and identified before 05:00? | clock rung passes on 0 mornings; identity rung passes on 0 mornings; `receipted_complete: 0` of 725 | **not accepted** |
| Performance | Is there an edge, an accuracy or a tradable result? | `performance.status: "not established as an edge"`; structural replay only, no costs, slippage, holdout or multiplicity control | **not accepted** |
| H1 readiness | Does `USD-L1-25F-H1-v0.1.0` have any eligible morning? | 0 of 725 eligible; `earliest_eligible: null`; nine input blockers | **not accepted** |
| Live trading | Was any live path touched? | no n8n schedule, no trade node, no runtime write; the live-copier file appears only as a path in a read-only scan | **out of scope, unchanged** |

## 2. Links

Instance: `https://silver17.app.n8n.cloud`; project `ISQG9XU7TGTT6Fcu`.

| Object | Identifier | Direct URL |
| --- | --- | --- |
| Parent — `USD Layer 1 - paired controller (Cloud)` | `89uk5JnPbWPL5lGD` | https://silver17.app.n8n.cloud/workflow/89uk5JnPbWPL5lGD |
| Child v0 — `USD Layer 1 - challenger v0 (Cloud adapter)` | `giGJKNQw5WLh1xbX` | https://silver17.app.n8n.cloud/workflow/giGJKNQw5WLh1xbX |
| Child v1 — `USD Layer 1 - challenger v1 (Cloud adapter)` | `42sxXHScRvE3qSTX` | https://silver17.app.n8n.cloud/workflow/42sxXHScRvE3qSTX |
| Project workflows | `ISQG9XU7TGTT6Fcu` | https://silver17.app.n8n.cloud/projects/ISQG9XU7TGTT6Fcu/workflows |
| Recorded runs | 5471-5482 | `https://silver17.app.n8n.cloud/execution/<id>` |

The parent is manual plus header-authenticated webhook, no schedule, `active: false`; its webhook was
deactivated after the evidence was captured. Both children are `active: true` but can only be started by
`executeWorkflow`, so neither can self-start or repeat unattended.

| Artefact | Path |
| --- | --- |
| Manifest (source pins, bundle hash, child ids) | `automation/n8n/usd-l1-cloud-workflows.manifest.json` |
| Runtime bundle | `automation/n8n/usd-l1-cloud-runtime.js` — `usd-l1-cloud-runtime-v1`, sha256 `e1e7ecb0…`, 90,011 bytes, 7 sources, 1 stub |
| Evidence summary (sha256 `17dd410c…`, 62,511 bytes) | `data/usd-layer1-backtester/n8n-execution-evidence-v1.json` |
| Execution index (12 ids) | `data/usd-layer1-backtester/n8n/executions-index-20261119.json` |
| Raw transcripts | `data/usd-layer1-backtester/n8n/execution-5471-structural.json`, `-5474-receipted.json`, `-5477-missing-date.json`, `-5480-missing-inputs.json` |
| Map view model | `lib/backtesting_n8n_map.js` (pure functions over the evidence; no second score, no live control) |
| Dashboard map, live | https://kevincreedycars-debug.github.io/trading-agent-dashboard/backtesting.html#n8nmap |
| Dashboard map, local preview | `npm run preview:backtesting` → `http://localhost:4173/backtesting.html#n8nmap` |
| Screen payload behind the Backtesting page | `data/usd-layer1-backtester/backtesting-screen-v1.json` |

Publication evidence, measured 2026-11-19: the live page answered 200 at 75,024 bytes with four `n8nmap`
references, and the live evidence file matched this checkout byte for byte. The evidence file still hashes
to `17dd410c…` here. The screen payload changed locally in this acceptance pass (§10), so republishing is a
separate operation.

## 3. Model identities

Two identities were invoked in n8n Cloud; two were deliberately not.

| Key | Identity | Source | n8n workflow |
| --- | --- | --- | --- |
| `challenger` | `usd-layer1-challenger-v0` | `backtester/lib/usd_layer1_backtester/challenger.js` | `giGJKNQw5WLh1xbX` |
| `challenger_v1` | `usd-layer1-challenger-v1` | `backtester/lib/usd_layer1_backtester/challenger_v1.js` | `42sxXHScRvE3qSTX` |

| Key | Identity | Version / source | Why not invoked |
| --- | --- | --- | --- |
| `current` | current USD model | `agent_usd_direction.md` (production baseline, replayed by `backtester/replay/usd/usd_replay_core.js`) | its replay core reads local files and Supabase helpers, so it is not bundled; the local controller still runs it |
| `h1` | `usd_l1_25f_h1` | `USD-L1-25F-H1-v0.1.0`, unpacked at `backtester/packages/USD-L1-25F-H1-v0.1.0/` | separate, unscored identity; its nine-input evidence contract is unmet; never substituted for a challenger |

The Backtesting screen carries the longer identities:

| Role | Id | Version | Status |
| --- | --- | --- | --- |
| Control | `usd_control_v1` | `agent_usd_direction.md` (production baseline, replayed) | `PROVISIONAL_BASELINE` — presence and freshness only, no verified 05:00 receipt |
| Legacy candidate | `usd_candidate_25f_v1` | `usd-l1-factor-rulebook-v1.0.0` / `usd-l1-decision-rules-v1.0.0` | `CONFIG_BLOCKED` — the intended 25-factor agent has no adjudicated sign, weight or threshold, so its rule is undefined |
| H1 | `usd_l1_25f_h1` | `USD-L1-25F-H1-v0.1.0` | `FROZEN_H1_HYPOTHESIS`, `scored: false` |

`CONFIG_BLOCKED` applies to `usd_candidate_25f_v1` only. It is not a statement about H1, and H1 is not a
replacement for the legacy book.

## 4. The swap, as recorded

Every parent execution returned `success`. Every child answer carries its own workflow id, execution id,
identity, `model_version`, direction and conviction.

| Morning | Validation | Parent | v0 child | v1 child | Outcome |
| --- | --- | --- | --- | --- | --- |
| `2024-01-10` | structural | 5471 `success` | 5472 `allowed`, BULLISH, conviction 2 | 5473 `allowed`, BULLISH, conviction 2 | both call |
| `2024-01-10` | receipted | 5474 `success` | 5475 `blocked`, `receipted_incomplete` | 5476 `blocked`, `receipted_incomplete` | receipted gate refuses date-only prints |
| `2024-01-06` | structural | 5477 `success` | 5478 `blocked`, `not_in_dataset`, NO_CALL | 5479 `blocked`, `not_in_dataset`, NO_CALL | date absent from the panel |
| `2024-01-02` | structural | 5480 `success` | 5481 `abstained`, NO_CALL | 5482 `abstained`, NO_CALL | all nine declared inputs missing |

What each case proves about the gate:

- **5471 structural.** 9 of 9 declared inputs present, only 2 carry a full pre-cutoff timestamp;
  `receipted_complete: false`. The structural gate accepts because the morning is internally consistent,
  and both children call. This is the clearest demonstration that structural acceptance is not evidence.
- **5474 receipted.** Same morning and values, stricter mode: both children are `blocked` with
  `receipted_incomplete`; the gate, not the model, changed the outcome.
- **5477 missing date.** `not_in_dataset` before any model work; no direction is invented.
- **5480 missing inputs.** The morning is structurally valid but 0 of 9 inputs are present, so both
  children abstain with all nine keys named. Absence produces an abstention, never a filled value.

Two honesty notes:

1. A blocked child run can still carry the raw direction the model computed (5475/5476 show BULLISH), but
   `results` is `null` and the case outcome is `blocked`; it is never scored. The gated records the screen
   counts separately carry `NO_CALL` and no trade.
2. The same-direction result on 5471 is not a performance claim. Version 0 and version 1 share the scoring
   code but not the frozen weighting, and one morning is one morning.

Reproduction behind the swap:

| Check | Result |
| --- | --- |
| Cloud bundle vs Node controller, both challengers, 725 mornings | 1,450 decisions checked, 0 mismatches |
| Local controller vs `run-v1.json` | 2,175/2,175 decisions, 8,700/8,700 results, 0 mismatches |
| Execution index | 12 of 12 executions `success`, captured `2026-11-19T19:57:36.695Z` |
| Evidence generated at repository head | `fdfc2c1d5e9b46174c50568212033af0f24cbc79`, `2026-11-19T21:33:04.680Z` |

Reproduction is not accuracy: it says the same stored call and the same stored outcome came back, not that
the call was right.

## 5. The dated morning, 2024-03-26

This is a replay of a stored morning, not a validated historical run and not a trade. Session contract:
05:00 Europe/London to 05:00 the next local day, so cutoff `2024-03-26T05:00:00.000Z` and endpoint
`2024-03-27T05:00:00.000Z`.

| Model | Outcome | Direction | Gate | Detail |
| --- | --- | --- | --- | --- |
| `usd_control_v1` (current, replayed) | `allowed` | BEARISH, conviction 3 | `data_present_and_fresh` — declared narrow gate | 12 declared inputs, 4 unclocked (`vix_level`, `vix_d5_chg`, `us_2y_d5_bps`, `us_10y_real_d5_bps`), 4 from a different instrument (gold, Nasdaq-100, EURUSD, USDJPY returns); production band 3 reached, so `trade_eligible: true` under a production rule, not a validated edge |
| `usd_candidate_25f_v1` (legacy book) | `allowed` | BEARISH, conviction 3 | `book_checks`, `data_gate: insufficient_data`, `intended: undefined_rule` | same 4 unclocked and 4 identity failures; `clocked: not_recorded`, `identified: false`; the rule set is `CONFIG_BLOCKED`, so this is not a call for the intended 25-factor model |
| `usd_l1_25f_h1` | blocked | NO_CALL | `h1_historical_evidence_blocked` | 8 of 9 inputs present, 0 original observations, 1 lookback, 0 fresh, 0 clocked, 0 receipted, 0 identified, 8 schedule-complete, **0 eligible** |

Strict evidence for the morning: `ready: false`; `clocks_verified: false`; `h1_ready: false`; the
current model's evidence grade is `narrow_presence_and_freshness_only`; the criterion is "present + fresh +
verified 05:00 observation/publication/receipt + named instrument, for every required input"; and the
reason is that no morning in the archive carries a verified receipt for every required input.

H1's nine blockers on this morning, by issue:

| Input | Issue |
| --- | --- |
| `vix` | `unclocked` |
| `front` | `derived_only` |
| `spread` | `derived_only` |
| `real` | `derived_only` |
| `broad` | `derived_only` |
| `ice` | `missing_value` |
| `gold` | `identity_mismatch` |
| `qqq` | `identity_mismatch` |
| `calendar` | `incomplete_calendar` |

The two instrument failures are identity, not absence: the legacy gold return is an OANDA XAU/USD quote, not
the LBMA Gold Price PM auction, and the legacy tech return is the Nasdaq-100 index, not the QQQ official
close. The four `derived_only` inputs store only the five-interval change, so the five observations, their
vintages and their clocks cannot be reconciled to the declared transform. The calendar blocker is the
absence of CPI, Employment Situation, advance GDP and Personal Income and Outlays schedules.

Artifact: `data/usd-layer1-backtester/morning-run-v1.json`, `provenance.artifact_sha256`
`c376affc95b9c38672229df7e07c3bf6d282e7c07602b232922e71a01f4d6110`, rendered to
`docs/research/usd-session/v1/layer1_morning_run_2024-03-26.md`. The digest covers the body before the
provenance block, and the builder reruns the committed artefacts to reproduce it.

## 6. Blocking evidence

The package has to show that the refusal is real, not a missing field. Three audits and two gate counts do
that.

| Audit | Date | What was caught | Where |
| --- | --- | --- | --- |
| Missing input | `2024-03-25` | 3 required inputs absent under their declared names (`fx_eurusd_momentum_1s_pct`, `fx_eurusd_momentum_5s_pct`, `usdjpy`) **and** a trade flag left on a blocked morning | decision `usd_candidate_25f_v1@2024-03-25` |
| Wrong version | `2024-02-06` | rules `usd-l1-decision-rules-v1.0.0-tampered` against the registered `…-v1.0.0`; the ledger rejects the record | decision `usd_candidate_25f_v1@2024-02-06`, from `data/usd-layer1-backtester/engine-v1.json` |
| Clean control | `2024-01-02` | no findings — the audit is capable of passing | decision `usd_candidate_25f_v1@2024-01-02` |

Counts from the immutable decision records:

| Measure | Gated records | Legacy morning states |
| --- | --- | --- |
| Blocked | 541 of 725 | 541 of 725 |
| Blocked with a direction | **0** | 75 (preserved, labelled, never counted) |
| Blocked with a trade flag | **0** | 21 (preserved, labelled, never counted) |
| Blocked and scored | **0** | not counted |

The 75/21 legacy contradictions exist in `engine-v1.json` and are kept byte for byte as audit evidence;
they are not gated decisions and never enter a direction count, a trade count or an accuracy denominator.
The gated records carry `NO_CALL`, `band: null`, `trade_eligible: false` and no outcome.

Input availability, from the coverage table:

- The largest single gap is `us_2y_d5_bps` at 64 of 725 mornings (8.83 per cent), first
  `2024-01-02`, last `2026-09-15`; the action is "no call", never a filled value.
- `us_de_2y_spread_d5_bps`, `latest_us_event` and `fed_bias` each have a value on only 11 of 725
  mornings, so those production rules cannot vote on 714 mornings.
- `dxy_d1` is present on 707 of 725 mornings but is FRED `DTWEXBGS`, a broad trade-weighted stand-in, not
  the ICE cash DXY; the coded 24h weight (14) and the rulebook weight (6) also disagree.
- The screen's production-parity verdict is `NOT_ESTABLISHED`, with the claim that three of the four
  checked mappings are absent on most mornings and the fourth uses a broad-index stand-in.

Strict validity, in one line: on the run's own ladder, `clocked` passes on **0** of 725 sessions and
`identified` on **0**, so no morning is valid for either model under the strict headline. The receipted gate
refuses all 725 committed mornings (`receipted_complete: 0`, `receipted_incomplete: 725`) because most macro
prints carry a date only; late-print rejection is therefore **untested on history**.

H1 packaging is a separate matter from H1 evidence. The package is present, its archive checksum and
`SHA256SUMS` verify, and its fixtures all match — but the fixtures are synthetic, the package is a
hypothesis, and presence is not identity: **0 of 725** mornings are eligible and
`earliest_eligible` is `null`.

## 7. Per-test readiness

| Test | Status | Usable sessions | Candidate (gated) | Control | H1 |
| --- | --- | --- | --- | --- | --- |
| 1. `dxy_direction_broker_cfd` — broker DXY.cash proxy | `scored_proxy` | 360 | 541 blocked, 143 abstained, 40 scored in legacy aggregate, 1 not in legacy sample | 108 blocked, 609 scored in legacy aggregate, 8 no call | 0 of 725 eligible |
| 2. `four_markets` — one call against EUR/USD, gold, bitcoin, NAS100 | `scored` | 685 | 189 blocked, 47 abstained, 488 scored, 1 allowed | 13 blocked, 675 scored, 29 allowed, 8 no call | 0 of 725 eligible |
| 3. `l2l_full_5r` — original Layer 2 levels, frozen 5R | `blocked` | 0 | 725 blocked | 725 blocked | 0 of 725 eligible |
| 4. `l2l_half_3r` — separately frozen half geometry, 3R | `blocked` | 0 | 725 blocked | 725 blocked | 0 of 725 eligible |
| Supplementary: official ICE DXY direction | `blocked` | 0 | — | — | 0 of 725 eligible |

Test 1 is a proxy and is labelled as one everywhere. Test 2's counts are per role, not one shared
denominator, and no cross-market aggregate is reported. Tests 3 and 4 are blocked on history — no
contemporaneous level grid, no actionable bid/ask M5 tape, and for test 4 the midpoint geometry — not
scored at zero. The official ICE DXY test stays empty because the series is not in the checkout; the
broker proxy is never substituted into it.

Readiness headline:

| Measure | Value |
| --- | --- |
| Strict evidence ready — control | 0 of 725 |
| Strict evidence ready — legacy candidate | 0 of 725 |
| Narrow presence/freshness ready — control (labelled comparison, not readiness) | 617 of 725 |
| Narrow blocked — control | 108 |
| Book allowed — candidate | 41 |
| Book abstained — candidate | 143 |
| Book blocked — candidate | 541 |
| H1 eligible | 0 of 725 at every test, blocked by the same nine inputs |

None of these is performance. The performance verdict is `not established as an edge`.

## 8. Performance, for completeness

The only pool with outcomes is the gross directional replay over `2024-01-02` to `2026-10-12`,
structural validation, no costs, no slippage, no live execution, no holdout and no multiple-testing
control. It is reported here so the swap is not mistaken for an improvement.

| Model | Scored | Hit | Miss | Flat | No outcome | No call | Accuracy | Wilson lower 95% | Pooled delta vs control |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `current` (control) | 1,887 | 980 | 907 | 504 | 465 | 44 | 51.93% | 49.68% | — |
| `challenger` (v0) | 1,367 | 680 | 687 | 355 | 310 | 868 | 49.74% | 47.10% | −2.19 pp |
| `challenger_v1` (v1) | 1,382 | 690 | 692 | 368 | 310 | 840 | 49.93% | 47.30% | −2.00 pp |

Every challenger market delta against the control is negative (EURUSD −1.98 pp, XAUUSD −4.80 pp,
BTCUSD −0.78 pp, NAS100 −1.48 pp for v0; −1.29, −4.52, −1.43, −0.90 pp for v1). All three Wilson intervals
include 50 per cent — the stored lower bounds are 49.68, 47.10 and 47.30, and recomputing the interval from
each stored hit/miss count puts the upper bound at 54.18, 52.39 and 52.56. The correct reading is that the
swap is mechanically verified and produces no demonstrated improvement — not that v0 or v1 is worse in a
statistically meaningful way.

## 9. Reproduction checks, run 2026-11-20

Environment: Windows, PowerShell, Node `v22.19.0`, `core.autocrlf=true`.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run screen:backtesting:check` | 0 | `screen reproduces: 951788c52574bb889e9f158561926e854c850de01c2a1a97e062c17a7ae0d149` |
| `npm run report:layer1:check` | 0 | `report reproduces: a458d02a409ed53480de7eb2921bf4bebcddadd1235e5bbe353af0023f157024`; markdown reproduces |
| `npm run report:morning:check` | 0 | `morning report reproduces: c376affc95b9c38672229df7e07c3bf6d282e7c07602b232922e71a01f4d6110` |
| `npm run h1:evidence:check` | 0 | `ice: valid · 455 record(s)`; the other eight inputs report `no evidence file` |
| `npm run test:usd-l1-n8n` | 0 | `# tests 15`, `# pass 15`, `# fail 0` |
| `npm run test:usd-session` | 0 | `# tests 90`, `# pass 90`, `# fail 0` |

The `h1:evidence:check` result is the reason H1 cannot be scored: one of nine inputs has an evidence file,
and that file is an ICE series, not a full H1 input set.

Two test files changed in this pass, and only these two:

- `tests/layer1_backtest_report.test.js` and `tests/layer1_morning_run.test.js` now compare the committed
  JSON and markdown with a fresh build on canonical text (`\r\n` → `\n`), the same rule each builder's
  `--check` already applies. The content was already identical; the raw-byte comparison failed on a
  Windows checkout because `core.autocrlf=true` rewrites the working copy to CRLF while the builder emits
  LF. Before the change the same two tests were the only failures in `test:usd-session` (88/90); after it,
  90/90. No assertion was removed.

## 10. Change record for this pass

`data/usd-layer1-backtester/backtesting-screen-v1.json` was regenerated, and nothing else in it was
altered by hand. `git diff --numstat` against `HEAD` is **7 insertions, 1 deletion**:

| Change | Lines |
| --- | --- |
| `data\live-ctrader-copier.json` added to both copies of the search list | 2 |
| `docs\research\usd-session\v1\ACCEPTANCE_LAYER1_N8N.md` (this document) added to both copies of the search list and to both hit lists | 4 |
| `provenance.screen_sha256`: `2d8ec033…` → `951788c5…` | 1 replaced |

A deep comparison of the previous payload (`aa64897e…`) with the new one (`951788c5…`) reports 143 changed
positional leaves, and every one is inside `package_identity.searched[]`, `package_identity.hits[]` or the
digest: one insertion shifts the index of every later array entry, so these are position markers, not
semantic changes. `tests`, `models`, `h1`, `morning_run`, `integrity`, `audit` and `decisions` are
byte-identical. No model identity, morning, count, readiness or test field changed.

Outside the payload, this pass edited four tracked files and added this document, none of them generated:
`tests/layer1_backtest_report.test.js` and `tests/layer1_morning_run.test.js` (§9), a row for this
document in `docs/research/usd-session/v1/README.md`, and the 2026-11-20 entry in `docs/CHANGELOG.md`. The
README row changes file content but not the search list — `README.md` was already searched and already a hit
— so the digest is unaffected; `npm run screen:backtesting:check` was re-run after these edits and still
reports `951788c5…`.

The reason the payload moves at all is the design of the identity search: it lists every file it looked at
in `config`, `docs/research/usd-session/v1`, `exports`, top-level `data` and `lib/layer1_backtesting`, and
its hits are a text search across those files. Any new file in one of those directories — a research doc,
or a live-copier data file written by the running system — changes the list and therefore the digest, and
the `--check` then reports a stale payload even though no figure changed. That is exactly the failure this
pass started from. It is recorded as an open item rather than papered over; the immediate mitigation is to
regenerate the payload in the same change as any file added to those directories.

## 11. Repository state

The package was prepared on `backtesting/usd-l1-n8n-guard-notes`, which is level with `origin/main` at
`d73e5efd`, and delivered on the scoped branch `backtesting/usd-l1-n8n-acceptance-20261120` with a pull
request against `origin/main`. Nothing is merged or force-pushed, and the package does not depend on the
stale branch below.

The local `main` is stale and must not be reset. It carries 8 commits dated 2026-09-07 that are not on the
remote branch this work descends from. Recommended sequence, not yet performed:

1. `git branch backup/main-20261120 main` — keep the 8 commits reachable.
2. `git fetch origin` and compare `main` with `origin/main` before any merge or rebase.
3. Decide per commit: keep, reapply or drop. Do not `git reset --hard` and do not force-push.

The acceptance artefacts above do not depend on those 8 commits.

## 12. Open items

| # | Item | Why it blocks | Earliest unblock |
| --- | --- | --- | --- |
| 1 | H1 evidence contract, nine blockers | 0 of 725 mornings eligible; `earliest_eligible: null` | a full 05:00-receipted input set for the nine H1 inputs |
| 2 | 05:00 receipts | clock rung passes on 0 mornings; receipted gate refuses 725/725 | a receipt archive proving each reading was in hand by 05:00 London |
| 3 | Instrument identity | identity rung passes on 0 mornings; gold and QQQ are the wrong instruments in the legacy panel | LBMA Gold Price PM and QQQ official closes, with labels |
| 4 | Late-print rejection | never exercised on history | a synthetic late-print fixture, then a real late print |
| 5 | Tests 3 and 4 | 0 usable sessions; no contemporaneous level grid or actionable M5 tape | staged level and bid/ask M5 history |
| 6 | Official ICE DXY | series absent from the checkout; the broker series is a labelled proxy | ICE sample and licence |
| 7 | Screen identity scan | the payload embeds the files it searched, so unrelated files change the digest | scope the scan to research paths or drop the raw list from the digest |
| 8 | Performance | pooled accuracy 51.93 / 49.74 / 49.93, all intervals spanning 50, every market delta negative | a pre-registered sample, holdout and multiplicity plan |
| 9 | Publication | the regenerated payload is on the pull-request branch; the live page still serves the 2026-11-19 build | merge the pull request, then republish |

## 13. Acceptance statement

**Accepted, within the scope documented here:** the n8n Cloud integration — workflow identity and
deterministic build, the model swap on four recorded mornings, the reproduction of the stored panel by both
the Cloud bundle and the Node controller — plus the audit and integrity counts and the honest reporting of
per-test readiness. Each accepted class names its artefact and its digest in sections 2 to 8.

**Not accepted:** historical H1 validity (0 of 725 eligible, `earliest_eligible: null`, clock and identity
rungs passing on no morning) and predictive performance (pooled accuracy 51.93 / 49.74 / 49.93 per cent, every
interval spanning 50, every market delta negative, no holdout or multiplicity control). Also not accepted: any
claim that late-print rejection has been exercised, and any use of these workflows for unattended or live
trading.

## 14. Digests are per-commit

Every digest above is the one this package was signed against. A later commit that regenerates a generated
artefact changes that artefact's digest without changing any accepted claim: the screen payload and the
morning run are functions of the committed inputs, so importing new H1 evidence moves both. The next
acquisition (2026-11-20, six of the nine H1 inputs imported) records its own digests —
`b801822d…` for the screen and `2f584719…` for the morning run — and leaves the acceptance classes in
§1 exactly as they are stated here: the n8n integration, the swap and the reproduction remain accepted;
H1 validity and performance remain unaccepted.
