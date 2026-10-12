# Evening digest, 2026-10-12

**What this is.** The full answer to the user's question, "give me an update on everything that was
developed this evening", written out here because the chat reply is capped at three short bullets. The
window is roughly 18:00 to 22:05 on 12 October 2026 (Europe/London). It is a read-only summary of work
other workers committed; this lane built and measured nothing this turn.

**Where it was read from.** The canonical checkout `D:/trading-agent-dashboard-codex` on
`orchestration/control-plane-20260920`, production `main`, and the sibling lane branches
(`workers/live-trading-20260929`, `workers/backtester-harness-20260930`), via `git log`, the committed
`docs/CHANGELOG.md` and `docs/SESSION_NOTES.md`, and the lanes' own session notes. `coordination.js
check` returned `errors: []`; `monitor-state.js snapshot` at 21:03Z reported the controller offline and
two submissions pending project-wide.

**Headline in five lines.**

1. The live trading page now dates each closed trade (the day it opened and the day it closed), and the
   change is live on the dashboard.
2. The live dollar engine's missing-value fix is applied and confirmed executing - USD only.
3. The dollar 24-hour forecasting study finished, and its honest answer is that improvement is not
   demonstrated; the candidate is shadow-only and nothing was switched on.
4. A separate review of that study's written plan says the research half fits and the build half is
   already done.
5. Routine: the live feed published a snapshot every fifteen minutes to production `main` all evening.

## 1. Live trading page: the closed trades now carry their dates, and the quiet spell is explained

Landed 19:39-19:41 and released to production `main`.

- **The change.** The *Closed trades* panel used to show one time column, a bare `HH:MMZ` clock. A
  position can open before midnight and close after it, so a reader could not say which day either end
  belonged to. Both timestamps (`opened.time_utc`, `closed.time_utc`) were already in the feed, so this
  was a dashboard-only change: the feed schema, the feed validator and the producer were not touched.
  Work: `script.js` gained `liveTradingDateTimeLabel()` (the UTC date in front of the existing clock,
  reusing the one UTC formatting path), the two cells became `Opened (UTC)` / `Closed (UTC)`, and a
  caption sentence was added. Commits `d3662e5` (page) and `3b585bd` (feature, with the tests).
- **Tests and evidence.** `node --check script.js` clean; the focused set green 56/56; the whole local
  suite 685 tests, 682 pass, 3 fail - the three being the `secret_scanner` width-truncation family this
  machine has failed since the fourth entry and which this change does not touch. A throwaway Playwright
  script drove the real page at three widths and read the two columns back with their dates.
- **Release.** A release tree was cut from `origin/main` at `e9fc964` and pushed as `d3662e5`, with the
  `script.js` cache-buster moved to `?v=20261012-closed-trade-dates` and `styles.css` left alone. The
  release tree's own evidence is recorded, including the seven reds that are `main`'s before and after
  so the change added none, and the live-page check against the published blob.
- **Why no recent trades (asked in the same turn).** The loop is armed and running: 1,264 logged runs
  from `2026-10-05T05:41:30Z` to `2026-10-12T17:26:30Z` on its five-minute schedule, `armed: true` on the
  last, reading a snapshot 69 seconds old against its 900-second limit. The last ticket a terminal
  accepted is `2026-10-08T14:26:32Z` (`US100.cash` limit `#298948282`). Since then, 604 runs: 598
  `nothing_to_place` and 6 `refused`, every refusal environmental or the rule's own guard (weekend reads,
  or a limit the market had already retraced past). The marked ladder's age gates nothing - no code tests
  it - the caps are unfilled (`taken_today: 0`, `open_tickets: 0`), and passing a marked line is not
  enough on its own. The loop's silence is the rule waiting, not the rule broken; no rule, cap or level
  was changed to hurry it.

## 2. The live dollar engine: the first supervised apply of the null-conversion guard (USD only)

Landed 18:51-20:56 on `orchestration/control-plane-20260920`.

- **The hardening, then the apply.** The layer 1 live-repair runner was first hardened and committed for
  review with no instance touched (`2d35b08`, `78288dc`, `fbbc0ac`): whole-workflow payload coverage,
  executing-version verification, exact recorded node sets, and a committed GET-only publishing probe.
  Two further defects were then closed: a failed write is decided by a fresh read (`a204c10`) and a
  rollback is verified on the version the instance executes, not the draft alone; and a run that cannot
  take a read now stops with an unknown state rather than trusting anything (`a6706b8`), with the
  deployment-check fix recorded (`cd32b01`).
- **The apply (`fe1f1c2`, 20:56).** The USD Layer 1 null-conversion guard is applied **and executing** in
  the live USD workflow `OCt1tB9yVMUgFTha`, verified by a fresh read rather than the write's own
  response. Draft and executing version id `aa275379...` to `0fb553c2...`, `versionCounter` 154 to 155,
  `published_copy_verified true`, connections and settings unchanged. A whole-workflow backup was taken
  before the update (`tmp/n8n-backups/usd-layer1-null-conversion-2026-10-12T19-52-13-306Z.json`).
- **Boundaries.** One workflow touched, USD only; GOLD `wwBVT0EQcKu5517I` and NQ `FOpFp3AzTJVYdLXe`
  were neither read nor written; the dispatcher stays paused (`enabled: false`, state `paused`). The
  correction is verified runner behaviour on one engine, not live-deployment evidence of timing or edge.
  Still carried: the credential remediation (literal API keys in running collector URLs) and the
  confidence-label correction.

## 3. The dollar 24-hour forecasting study (interactive coordinator, fifth action): improvement is not demonstrated

Committed `c1ea8ab` at 22:04:23, 40 files, ~91,700 insertions. USD only, offline replay, dispatcher
paused, no live artefact touched.

- **Baseline measured first.** Outcome instrument is FRED `DTWEXBGS`, the same series the live collector
  stores as `dxy_level`; the archive and the new dataset agree byte for byte on all 584 shared dates. The
  cutoff is the 09:30 ET snapshot; the endpoint is the repository's own "following 24hrs" window, which is
  the 16:00 ET close of the next valid session, not 24 elapsed hours (30.5 hours at the median, 102.5 at
  the maximum). Flat band 0.1pp. On 584 rows (583 evaluable) the deployed engine's stored calls score
  55.00 / 44.21 / 52.78 per cent ex-flat over development / validation / holdout, against 54.84 / 48.08 /
  50.00 for always-bullish; the replayed engine reads 52.22 / 50.55 / 48.57.
- **93 experiments, no model call, no download.** `data/usd-24h-experiment-registry.json` keeps every
  attempt including the losers. The fitted challenger is the only full-coverage arm that beats the engine
  before the holdout (61.75 / 55.77), then loses on it (46.25 against 52.78).
- **Selection declared before the holdout was read.** No configuration passed the full filter tier, two
  passed the reduced tier; the winner is recorded as `tier_2_reduced_filters` so the weaker evidence stays
  visible. Evidence classification `not_supported`; Platt scaling did not beat the constant base rate, so
  no probability is published. The candidate is published as `CANDIDATE_SHADOW_ONLY` with
  `production_enabled` false and `trade_eligible` false.
- **Two structural facts matter more than any number.** The endpoint the engine calls "24 hours" is the
  next session close; and the economic-surprise family carrying 24 of the live 100 points cannot be
  evaluated at all, because neither consensus nor vintage data is available to this repository.
- **Repair status on this archive.** All 604 rows carry zero differing factor entries (6,040 compared), so
  the unavailable-versus-zero conversion cannot move an archived call; and the archive's stored close
  prices differ from the dataset's on 25 of 584 rows while all 584 opening prices are exact.
- **Next actions named, not taken.** Decide whether to fund or drop the economic-surprise and Fed-repricing
  families; decide whether to replace the session-close endpoint with a declared 24-elapsed-hour window;
  if work continues, re-run against a vintage or publication-timestamped dataset.
- **Tests.** `backtester/tests/usd_24h_research.test.js` is 15 tests, all green; `npm test` reads 461 of
  466 passing, the five being pre-existing environmental failures (`secret_scanner` output-format asserts
  and two Playwright `refresh_progress` timeouts).

## 4. A review of that study's written plan (backtester-harness, 21:00)

Committed `eb08df0`: `docs/backtester-harness/USD_RESEARCH_HANDOFF_FIT_20261012.md` (251 lines) plus a
session note. The user pasted a USD 24-hour research and experiment handoff; this lane read it against the
repository. Docs-only; no code, workflow, warehouse, credential or dashboard change.

- **Verdict.** The handoff's research and evaluation half is additive and already aligned with the
  repository's stated discipline (registry before outcomes, family de-duplication, frozen manifests,
  chronological evaluation, parity does not establish edge). Its engineering half is *behind* the
  repository rather than ahead of it, since WP0/WP1 discovery, the authorised read-only n8n export, the
  twelve CONFIRMED claims and the live repair runner are all further along than the document assumes.
- **Six corrections filed.** Demote the model recommendation to a named gate; treat "local Parquet cache"
  as an open user decision, not a tooling choice; rebuild the data packet from the sanitised review copies
  because two named inputs do not exist here; write the sealed-window and consumed-block exclusions into
  the experiment sequence; align the clock language with the existing New York ruling; and name an owner,
  because no lane is free to absorb it as written.
- **Facts checked, not assumed.** The ten USD factor weights in `logic/agent_usd_direction.md` read
  10/14/16/14/6/5/3/18/12/2 (total 100) while the live export's `TIMEFRAME_WEIGHTS` `24h` vector reads
  10/14/10/10/14/4/24/12/1/1 - so "the ten factors" is really four weighting schemes over the same ten
  inputs. Zero occurrences of `21:00` or `16:30` appear in the export or the logic docs. Still open and
  outside that lane: how a day is measured and on which instrument, warehouse versus local cache, whether
  and when the USD live repair and the credential remediation run, and who owns the researched half.

## 5. Routine traffic

- The live trading feed published an M5/H1/H4 snapshot to production `main` every fifteen minutes all
  evening (roughly 19 snapshot commits between 18:00 and 21:55), data file only.
- Several `cline checkpoint` housekeeping commits on the control-plane branch.
- No coordinator wake, no assignment published, and no lane woken this evening as far as the register
  shows; the automatic coordinator is offline and this lane's two filings (`-065`, `-066`) still sit in
  the coordinator's review queue.

## 6. What was not touched (boundaries held across all of the above)

No credential value was read, printed or committed; no other engine, no warehouse write, no dashboard
publish outside the named live-trading page; the dispatcher stayed paused; the sealed qualification
window (`2027-03-25T15:00:00Z`) and the consumed `2025-10-01..2026-04-30` block were not read. No edge,
accuracy, causal feature timing or live-deployment claim is made by any item above.

## 7. Where every fact came from

- Live trading page: `d3662e5`, `3b585bd`, session note commit `c18e63a`
  (`docs/live-trading/STRATEGY_LIVE.md` section 53 and `docs/live-trading/CONVERSATION_NOTES.md`); release
  branch `release/live-trading-closed-dates-20261012`; production `main` top at `dea6d7a`.
- Dollar engine apply: `2d35b08`, `78288dc`, `fbbc0ac`, `a204c10`, `a6706b8`, `cd32b01`, `fe1f1c2` on
  `orchestration/control-plane-20260920`; `docs/CHANGELOG.md` and `docs/SESSION_NOTES.md` on that branch.
- Dollar 24-hour study: `c1ea8ab`; the fifth-action entry in `docs/CHANGELOG.md`; `docs/SESSION_NOTES.md`;
  `docs/review/usd-24h-ruleset-v1/USD_24H_IMPROVEMENT_RESULTS.md`; data files under `data/usd-24h-*` and
  `config/usd_24h_ruleset_v2.json`.
- Plan review: `eb08df0` on `workers/backtester-harness-20260930`
  (`docs/backtester-harness/USD_RESEARCH_HANDOFF_FIT_20261012.md`, `.../CONVERSATION_NOTES.md` session 19).
- Routine: `git log origin/main` and `git log --all` for 2026-10-12.



