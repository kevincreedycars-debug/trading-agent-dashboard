# Central decisions

## 2026-09-25: 019 re-notified by assignment revision; the unattended reviewer was restarted

The Gold window reconnected on bridge 0.2.1 at `2026-09-25T11:26:26Z` and the queued
`gold-coverage-completion-019` wake was delivered then (dispatch record `a3761088`,
`sent_unconfirmed`). No worker activity followed, and the bridge never retries an ambiguous send, so
the coordinator applied the assignment-version rule it recorded during 018: revision 2 of
`docs/orchestration/assignments/gold-research.md` adds a section 7 continuation notice, which changes
the event key and produced a fresh immediate delivery (dispatch record `1d8e899e`, event
`7f4eed0d...`). The revision states the same assignment, fixes the work order (section 8 hardening
before anchor 2's entry lane at `2026-09-25T14:00:00Z`) and forbids line-ending renormalisation or a
repository-level `.gitattributes` entry, because a hash-bound materialisation defect already sits with
the `backtester-spike` change request and Gold must stop and report rather than publish a changed
block. Independently corroborated, read-only: the capture task `GoldQualificationWindowTick018` is
`Ready` with result `0`, last run `12:26:01` local, next `12:36`, zero missed runs and a `tick.log`
written `12:26:02`, and the three sealed anchor-2 captures are unchanged. A real operational defect was
found and corrected: the unattended reviewer was not running - `status.json` still carried pid 41964
from `2026-09-24T21:20:41Z` with no such process - so automatic review would not have run; the daemon
now runs again with a live pid. Publication is still not pickup: `019` stays awaiting worker activity
and no outcome, holdout, production, warehouse, Layer 1, live workflow, credential or deployment action
occurred.

## 2026-09-24: the mailbox wake cap is removed at the user's direction

The user rejected the bridge's fixed twelve-wake-per-worker-per-day limit: while they are at
the machine, work should simply continue. Bridge 0.2.1 therefore removes the daily cap from
`tools/agent-mailbox-bridge/core.js`. The remaining guards are structural rather than
budgetary: an event is delivered at most once ever (the immutable per-event record file is
the dedupe key), an ambiguous or failed send is never retried automatically, only one
Strategy window connects to a worker, and a worker whose reported activity is `working` is
still never interrupted. The bridge unit test was rewritten to prove that forty distinct
wakes all deliver while a duplicate never resends, and the bridge README plus
`docs/orchestration/README.md` were updated. The background reviewer keeps its separate
six-reviews-per-UTC-day ceiling in `scripts/coordinator-dispatch.js`, which bounds model
spend rather than worker progress; that one is a cost guard the user can lift separately.
A window running the old 0.2.0 extension keeps the old cap until it reloads.


## 2026-09-24: user authorises hardening the Gold capture task

The user authorised hardening the installed capture task `GoldQualificationWindowTick018` so
that a missed trigger or a logon gap cannot quietly drop a prospective lane:
`StartWhenAvailable` becomes true and the battery-related start restrictions are cleared,
with the task otherwise unchanged (same name, action, `PT10M` repetition, single task, no
change to any accepted or frozen file). The change is queued inside
`gold-coverage-completion-019` section 8, must be verified by a real tick after the change,
and must be reverted with a reported blocker if it cannot be verified. The three sealed
anchor-2 captures must stay byte-identical.


## 2026-09-24: the four free keyless Gold sources become standing parts of the source contract

The user confirmed that the four free, keyless, read-only sources authorised for
`gold-coverage-completion-019` are permanent parts of the Gold source contract, not a
one-off exception: keyless FRED CSV (`SP500`, with `DTWEXBGS` already archived), the San
Francisco Fed Daily News Sentiment Index, and the Philadelphia Fed ADS all-vintages file.
Future Gold assignments keep them, no purchase, subscription, licence or credential is
required for them, and the Yahoo chart endpoint remains refused. Every adapter for them
stays read-only, keyless and hash-verified, and their availability and vintage semantics
must be declared before any measurement. This does not widen the prospective 014 window's
frozen source set: the window keeps its accepted sources and evidence.


## 2026-09-24: user authorises four free keyless sources and the dxy_* retirement; 019 published

Strategy advisory 002 proposed measuring the seven remaining Gold drivers from free
sources. The coordinator established from
`backtester/registries/gold_live_input_inventory.v1.json` and
`backtester/registries/gold_variable_horizon_context.v1.json` that the live F2 dollar
input is FRED `DTWEXBGS` and must not be reported as the declared `dxy_*` variables, so
the drivers can be closed by honest declaration rather than any purchase. The user then
authorised the four additional free, keyless, read-only sources (keyless FRED CSV for
`SP500`, the San Francisco Fed Daily News Sentiment Index, and the Philadelphia Fed ADS
all-vintages file, with `DTWEXBGS` already archived), the retirement of the legacy `dxy_*`
ids without backfill or relabelling, and publishing `gold-coverage-completion-019`.

019 declares and measures seven new ids on the accepted historical path without changing a
research rule and regenerates the findings digest at 28 of 28 variables with the 21
existing blocks byte-identical. It must not disturb the live 014 window: the installed
capture task keeps running, the accepted 014/015/016/017 files and the sealed window-018
evidence stay byte-identical, and no prospective observation or outcome may be read before
`2027-03-25T15:00:00Z`. The Yahoo chart endpoint is refused as undocumented and
licence-ambiguous.


## 2026-09-24: user authorizes real Gold qualification window activation

After the coordinator disclosed that the accepted 014 window opened at
`2026-09-24T14:00:00Z`, that anchor 1 is permanently missed
(`interval_closed_no_backfill`, no catch-up) and that anchor 2's pre-anchor feature
interval closes at `2026-09-25T14:00:00Z`, the user explicitly authorized activating the
real window. Published `gold-qualification-window-activation-018` to the registered Gold
worktree: a lock-guarded tick driver that captures only identities whose declared
interval currently contains the operating-system clock, exactly one installed local
Windows scheduled task running the accepted 017 runner through the encrypted credential
runner with only `FRED_API_KEY` and `OANDA_API_TOKEN`, missed lanes sealed as reason-coded
blocked attempts, and anchors 2-130 captured as their declared lanes open.

Boundaries that remain closed: no outcome, direction, aggregate, qualification, accuracy
or edge read before `2027-03-25T15:00:00Z`; no backfill or rescheduling; no change to any
accepted 014/015/016/017 artifact; no warehouse, Layer 1, live workflow, dashboard,
integration, deployment or production action; no credential beyond the two named; no
second writer in the worktree. Publication is not pickup: the bridge wake stays
`sent_unconfirmed` until the worker reports activity.


## 2026-09-24: Gold 017 overlap reconciled; multi-asset readiness spike is next

Two Gold sessions ran assignment 017 in the same worktree. The pre-existing window
detected the unfamiliar provider-client file, recorded `blocked` and stopped; the
surviving session then halted, preserved the superseded revision with per-file
hashes under `backtester/tmp/superseded-017-other-session-20260924/`, reconciled one
coherent implementation and committed it at `6cbbd01` in the registered Gold
worktree. Submission `20260924-gold-qualification-activation-package-017-r1`
(mailbox SHA-256 `f3ac41d9...`) is awaiting review; the review must be performed by
a session other than the author. The stale `gold-source-007` agent message, which
pointed at the wrong HEAD, was replaced. Real anchor capture and scheduler
installation remain unauthorized. See
`docs/orchestration/reviews/20260924-gold-017-overlap-reconciliation.md`.

Under the user's direction recorded in `docs/DEEPSEEK_PROJECT_HANDOVER_20260924.md`,
the next milestone is a bounded **multi-asset one-day readiness spike** in an
isolated worktree and branch: a readiness matrix for Gold, USD, EUR, NQ, BTC, GBP,
Silver and WTI, a generic asset/job manifest schema, a shared immutable cache
contract with hash validator, a deterministic concurrency-capped orchestrator with
resumable shards and stage metrics, a single-worker versus parallel equivalence
proof and a measured one-day capacity estimate. It is a rehearsal and measurement
milestone: no research-rule change, no reacquisition of paid or live sources, no
Layer 1, warehouse, scheduler, evaluation or production action.


## 2026-09-24: user authorizes bounded provider activation preparation

After being told that advancing Gold requires read-only provider/network access and
scoped credentials, the user directed the coordinator to push forward. Published
`gold-qualification-activation-package-017` from accepted clean `4eea9a8`. It may
load only `FRED_API_KEY` and `OANDA_API_TOKEN`, implement clock-bound capture
controls and run small pre-window provider smokes. It cannot capture a real anchor,
install/start a scheduler, evaluate outcomes or change production. Those actions
remain subject to review of 017.

## 2026-09-24: collectors 016 accepted; real collection awaits the user

Interactive coordinator review accepted Gold `gold-qualification-collector-016` at
clean worker `4eea9a8` (base `b5f2e27`, one commit, exactly the four disclosed added
files, +408/-0), submission SHA-256 `efe76d7c...`. Coordinator verification
reproduced the mailbox hash, both accepted bindings, an independent fixture dry run
whose capture plan equals the submitted `807dc73e...` byte-for-byte, the 130-anchor /
780-item blocked-no-reschedule reconciliation, the metadata-only envelope and index,
the CLI refusals of network, evaluation, real-window retrieval, existing output and
path escapes, and both tamper probes (a rewritten envelope hash, and a
self-consistent rewritten envelope/index pair, are rejected). Coordinator focused
file 10/10; the full local suite reports 490 tests with 486 pass and four failures,
all pre-existing console-width-dependent `secret_scanner.test.js` cases already
recorded as a separate backlog item. No real acquisition, prospective read, window
activation, integration, deployment or production action occurred, and acceptance is
not qualification, accuracy or edge.

No successor assignment was published. Real prospective collection and window
activation need network/provider access, scoped credentials and an explicit user
decision, and the 014 manifest's first anchor `2026-09-24T14:00:00Z` is imminent, so
the window stays closed and Gold remains stopped at `4eea9a8`. **Open decision
(needs the user):** authorize real prospective collection and window activation under
a new bounded assignment, or keep the window closed. Until that decision no Gold
work of any kind is authorized.


## 2026-09-24: scaffold 015 accepted; offline collectors are next

Accepted Gold 015 at clean `b5f2e27`: the exact manifest/contract gate, recursive
outcome-field rejection, 130-anchor metadata reconciliation and final evaluation
boundary pass review. Published `gold-qualification-collector-016` to implement the
four declared source parsers and sealed capture envelopes with synthetic/pre-window
fixtures only. Real prospective acquisition and window activation remain separate.

## 2026-09-24: Gold execution scaffold is next; the window remains closed

After accepting manifest 014 at clean `715c982`, the user directed Gold to its next
instruction. Published `gold-qualification-execution-scaffold-015` to freeze the
outcome-blind source/evidence contract, sealed bundle schema and readiness gate
before any real window execution. It is bound to the exact manifest, four ids and
130-anchor schedule and must refuse evaluation before `2027-03-25T15:00:00Z`.
Only synthetic fixtures are authorized. No real acquisition, prospective value or
outcome read, qualification execution, integration or production action.

## 2026-09-23: shortlist 013 accepted; future-only manifest is next

Accepted Gold shortlist 013 at clean `0d82157`. Independent execution reproduced
the exact four ids, 255-candidate audit and submitted hashes; focused tests passed
79/79 and the full local suite 463/463. The smaller four-id result follows the
frozen one-use-per-variable rule over nine eligible variables and is accepted as a
selection checkpoint, not an edge or qualification result.

Published `gold-qualification-window-freeze-014`. The 012 first-anchor date predates
the shortlist freeze and will not be backfilled. The new manifest must begin at
`2026-09-24T14:00:00Z`, bind the four accepted ids and their consumed reference signs
without changing membership/order, and remain outcome-free until separately
reviewed. No qualification execution, integration or production action is yet
authorized.

## 2026-09-23: narrow Gold before opening the prospective window

The user accepted the coordinator recommendation to narrow the pool first.
Published `gold-qualification-shortlist-013` from accepted worker HEAD `67fcc09`.
The assignment authorizes exactly one execution of the selector frozen in protocol
012 over the accepted 255-candidate eligible set and consumed run-011 ledger. It
must use only the five declared selection fields, preserve the exact deterministic
order and one-per-pair/one-per-variable diversity rules, freeze at most 20 candidate
ids, and emit a complete 255-candidate audit with immutable provenance and tests.

This resolves only the pool-narrowing decision. It does not authorize opening or
backfilling the prospective window, reading or acquiring outcomes after the
consumed boundary, reserving or consuming a holdout, fitting a formula, or changing
live Gold, Layer 1, integration, deployment or production. The shortlist requires
separate coordinator review before any prospective action.

## 2026-09-23: Gold qualification-protocol-012 revision 3 accepted; prospective window awaits the user

Background coordinator review of submission `20260923-gold-qualification-protocol-012-r3`
at clean worker `67fcc09` (base `7792477`, one commit, two disclosed files),
submission SHA-256 `868c0611f489ea8d994f2d4c86ecc60d07cd13b83aece603d83ac2352a508448`.
Independently verified: the hash reproduces; `git diff --name-only 7792477 67fcc09`
returns only the two requested documents (+6/-4); zero literal backslash-n sequences
remain in tracked Markdown; the Assignment 012 table and `docs/SESSION_NOTES.md`
record 8 tests / 72-72 / 456-452; changed-document hashes match; all fourteen
protected artifacts re-hash byte-identical to their accepted values. Coordinator
re-runs: focused file 8/8, eight focused Gold files 72/72, full local suite `npm
test` 456 tests / 456 pass / 0 fail - the documented four console-width-dependent
secret-scanner failures pass in this environment and that is an environment note,
not a defect. Decision: **accepted**, documentation-only. Assignment 012 is complete
as a bounded predeclaration deliverable; acceptance is not integration, merge,
deployment, qualification or edge. Reply SHA-256
`7dcc46fe3b12d51126dbc148880662d0524cf164412152081e3a3d159a1d189c`; durable review
`reviews/20260923-gold-qualification-protocol-012-r3.md`. No next worker assignment
is published in this cycle.

**Open decision (needs the user).** The declaration space is 255 eligible candidates
against a declared selection cap of 20. Whether a prospective qualification window
opens over that pool under the frozen protocol with the declared 20-hypothesis cap,
or the pool is narrowed before any window opens, is not decided. Until the user
decides, no selector execution or adaptation, pool narrowing, outcome acquisition or
read after the consumed boundary (`2026-09-14T15:00Z`), holdout reservation or use,
candidate ranking, formula fitting, integration or production change is authorized.

## 2026-09-23: Run-011 closes; prospective Gold protocol is next

Revision 3 at clean worker `cccbf47` makes only the requested results-document
wording/EOF changes and adds a narrow regression. Coordinator focused suites pass
26/26. Run-011 is accepted as consumed exploratory evidence, not predictive or
production qualification. `gold-qualification-protocol-012` now maps the 37 atoms
and 15 variables to live availability and freezes the prospective qualification
and later-selection rules before any new outcome is read. It does not rank the
consumed ledger, name a winner, acquire data, or change live Gold.

## 2026-09-23: Unattended coordinator inference moves to DeepSeek

The OpenAI-backed dispatcher stays disabled. The same event, lock, deduplication,
daily cap, timeout, sandbox and no-approval boundaries are retained, but Codex CLI
is now only the sandboxed agent host and inference is pinned to DeepSeek
`deepseek-flash` over its Responses-compatible API. Authentication uses only the
encrypted local `DEEPSEEK_API_KEY`; there is no OpenAI model/auth fallback. Missing
credentials or provider incompatibility fail closed and pause automation.

The existing Cline DeepSeek credential was subsequently migrated into the encrypted
project store without printing it, and the live read-only smoke returned
`COORDINATOR_READY`. Persistent unattended start remains disabled until the user
explicitly approves sending repository review evidence to DeepSeek as a third-party
data destination.

## 2026-09-23: Gold run-011 revision 2 passes substantively; wording correction remains

At clean worker 1526d34, independent checks verify the corrected immutable ledger:
2,548 ordered records, all 81 reconstruction checks, all aggregates and zero
availability-baseline denominator or median mismatches; focused 61/61 passes. The
implementation and evidence pass. Acceptance awaits only a documentation revision
that removes unexecuted 1h/4h/five-session descriptions and accurately states that
pooled all_computed is the explicit sum of separately visible endpoint groups.
No rerun or new research is authorized.

## 2026-09-23: Gold run-011 revision 1 needs availability-matched baselines

Independent review at clean worker 27fa8e9 verified the frozen registry, execution
manifest and sources, all 2,548 ledger records in registry order, all 81 row checks
and the submitted status/direction/endpoint/exclusion totals. Focused 57/57 and
current full local 441/441 pass. The batch is not accepted because every candidate
uses the same n=964 cohort baseline rather than matching feature/context
availability as assignment 011 requires. Independent reconstruction changes the
baseline denominator and median for 2,481 candidates and changes 19 comparison
signs. Published a narrow revision-2 request for per-candidate baseline derivation
and validation, a new immutable full run and corrected reporting. Preserve the
registry and all existing run evidence. No alternative search, holdout, ranking,
integration or production action.

2026-09-22 evening: all six inboxes checked; Gold 010 r3 was the only pending item. Accepted a185086 after independent 50/50 focused checks and synthetic rejection probes; unchanged frozen registry verified. Published gold-combination-run-011 for the first bounded 2,548-candidate exploratory run with pre-execution manifest/code, strict reconstruction reconciliation and exhaustive ledger. Await actual pickup. Other workers have no new submissions. Automatic reviews remain capped at six per UTC day; this review was user-requested. No real combinations have run at this checkpoint and no production change occurred.

2026-09-22 combination-registry-010 r2 manually reviewed at e8b9a89 on user request. Focused 22/22 pass and frozen registry unchanged. Requested corrections are present, but synthetic probes reproduce min_n override (1 accepted against frozen 20), duplicate-anchor inflation (one anchor counted 20 times), and writer provenance bypass (missing inputs and mismatched registry object/file accepted). Published narrow revision-3 request. No real outcomes or production changes. Automatic six-review daily cap remains unchanged; manual review was explicitly requested.

## 2026-09-22: Gold combination registry is frozen; execution machinery needs correction

Revision 1 at clean `50d3276` supports the pre-outcome registry: independent
hashing reproduces registry `7e2bcff6...`, 2,548 candidates and candidate-list
`23d83641...`, with focused synthetic tests passing 9/9. Execution is not
authorized. The evaluator presently reconciles endpoint denominators to attempted
rows rather than computed candidate observations, applies `min_n` to matched
anchors rather than computed `n`, and makes no-context candidates depend on context
availability. The ledger also omits the accepted run and artifact/code hashes and
does not carry the mutually exclusive outcome/exclusion partition needed to
reconcile attempts. A narrow hash-bound correction is requested; no real outcomes,
holdout, ranking, formula, integration or production action.

## 2026-09-22: Gold reporting-009 accepted; freeze the first batch before execution

Revision 5 at clean `7cb773a` narrows the remaining forward matcher to the exact
standardized negative statement. Independent checks reject the four revision-4
probes and two additional intervening-text variants; focused suites pass 12/12 and
26/26; the revision-5 evidence exists; accepted hashes remain unchanged; and the
declaration-only universe reproduces 2,548 daily and 29,740 event candidates.
Reporting-009 is accepted for exploratory reporting only.

The accepted protocol requires a concrete candidate registry and coordinator
review before outcome aggregation. Under the user's standing direction,
`gold-combination-registry-010` authorizes only the 2,548-candidate daily
`h24_post_event` / `all_computed` / `and` registry freeze, evaluator/ledger
scaffolding and synthetic verification. A separate later assignment is required
to execute it on consumed data. No holdout exists or is consumed, and no accuracy,
causation, profitability, timing or trading-edge claim is established.

## 2026-09-22: Gold reporting-009 revision 4 retains a forward-form provenance bypass

Revision 4 at clean `5d3f890` produces the previously absent `run.json`; focused
checks pass 12/12 and 26/26, and accepted hashes, path safety, candidate counts and
endpoint wording remain unchanged. It is not accepted because the forward-form
allowlist can span arbitrary text from a freshness word to an unrelated later
prohibition. Four independent probes reproduce the bypass. A narrow hash-bound
correction is requested; no outcome inspection, combination execution, holdout use
or next research assignment.

## 2026-09-22: Gold reporting-009 revision 3 still has a structural provenance bypass

Revision 3 at clean `a4676ab` corrects the candidate grammar and endpoint wording.
Independent counts reproduce 2,548 daily candidates per operator and 29,740 event
candidates with deterministic balanced selection of 5,000; focused checks pass
12/12 and 26/26, and accepted hashes remain unchanged. It is not accepted because
the provenance guard still accepts any negation left elsewhere in its regex-defined
clause: `not reserved therefore remains fresh` and `remains fresh despite not being
reserved` both return zero violations. A narrow fail-closed relationship correction
is requested. The cited ignored `run.json` is absent and must be reconciled. No
outcome inspection, combination execution, holdout use or next assignment.

## 2026-09-22: Gold reporting-009 revision 2 still needs claim and grammar corrections

Revision 2 at clean `abcc83e` resolves overwrite and all tested path-alias cases;
focused coordinator checks pass and the exhaustive companion remains byte-identical.
It is not accepted because an unrelated negation earlier in the same regex clause
still masks a fresh/untouched/unread claim about manifested consumed dates. The
proposed universe counter also counts each atom pair once while the protocol allows
both conjunction and disjunction, and includes same-variable state pairs without
declaring whether they are candidates. Corrected daily counts can exceed the 5,000
cap, so the grammar, counter and selection decision are not yet aligned. One report
limit still incorrectly says endpoint kinds are never pooled. A hash-bound narrow
revision is requested; no outcome inspection or next research execution assignment.

## 2026-09-22: Gold reporting-009 revision 1 requires safety corrections

The clean `360f48d` implementation reproduces the accepted numerical digest and
byte-identical exhaustive companion, and coordinator focused tests pass. It is not
accepted because sentence-wide negation can mask a forbidden fresh-data claim,
digest and companion paths can alias and silently replace the digest, and overwrite
is exposed despite the new-output-only assignment. The combination protocol must
also specify, before outcomes, how a candidate universe larger than 5,000 is fully
bounded or selected without sort-order-prefix bias and must distinguish the pooled
summary from separate endpoint strata. A hash-bound narrow revision is requested;
no next research execution assignment is published yet.

2026-09-22 RESUMED: user authorized building and communication. Coverage-008 revision 2 at de775b5 accepted after independent byte-identical digest/companion reproduction and unchanged report hash. Published gold-reporting-009 for a durable findings renderer, regression checks and next-stage combination protocol proposal; no search or new measurements yet. Restore background coordinator after interactive edits; worker pickup must be confirmed from actual activity. Existing source/calendar/timing limitations and all consumed-period exclusions remain. No integration or production change.

## 2026-09-21: Gold coverage-008 revision 1 requires one provenance correction

The two-variable implementation at clean worker `35e8384` is technically
supportable: declaration preceded outcomes, source artifacts and hashes reconcile,
fresh report generation reproduces the declared content hash, the 19 accepted
variable blocks and existing conditioning cells are invariant, and focused 70/70
plus full local 410/410 tests pass. Acceptance is withheld because the regenerated
findings digest says no final-test split has been consumed, contradicting the
accepted manifest and canonical record that the 2025-10-01 through 2026-04-30 L2L
final-test period is consumed and cannot be reused. Revision scope is only that
digest wording and its rendering source. No next research assignment is published
until the corrected revision is accepted.

## 2026-09-21: Gold source-007 accepted; two-variable coverage proceeds

Revision 2 at clean worker `3b10d73` corrects final-test consumption wording,
records coverage-006 as the accepted baseline and commits the reproducible
generator plus real archive-hash checks. Independent regeneration and tests pass.
The supported next bounded batch is `gold-coverage-008`: DFEDTARU-derived
`fed_bias` and T5YIE market-implied `inflation_signal`, with source-semantic rules
committed before outcomes and invariance for all 19 existing measured variables.
The conservative 36-hour FRED proxy remains an explicitly exploratory convention.
DXY licensing, OANDA calendar continuity, NASDAQCOM redistribution, growth identity
and headline corpus remain unresolved and out of scope. No final holdout exists;
all manifested periods are consumed and ineligible as a fresh final test.

## 2026-09-21: Gold source-007 revision 1 requires provenance correction

The DXY/source audit conclusions at faaf9ee are supported by official ICE/FRED
documentation and independent file-hash/test reproduction, but the batch is not
accepted yet. Its manifest simultaneously says no final-test split was consumed
and lists the prior L2L final-test period as consumed; it also misstates accepted
coverage-006 as merely submitted and relies on an ignored generator for its
reproducibility claim. A hash-bound revision request limits work to correcting
those records and making generation/archive-hash verification durable. No new
measurement batch is assigned until the corrected provenance is accepted.

## 2026-09-20: coordinator and workers

- This canonical project owns overall architecture, priorities, integration,
  cross-project decisions and durable memory. Workers use separate worktrees.
- Shared immutable submission/reply files replace copying chat history. The
  coordinator reviews on request; no background runner has been configured.
- All five registered workers have bounded assignments. Existing asset workers
  must reconcile current state before more implementation is assigned. Their
  worktree HEADs are observed facts, not proof of current deployment or completion.
- Central review can accept, request changes, acknowledge or mark blocked. Accepted,
  integrated and deployed are distinct states. Production actions require the
  applicable user authorization; a worker submission does not supply it.

## Gold research facts and dependencies

Coverage milestone b8193ba is accepted in 0b0e92d. Twenty-eight variables are
declared, sixteen have a local source; availability is not measured association.
The accepted audit reports zero contiguous 24-hour windows in either cohort.
Immediate/event windows need appropriate resolution; five-trading-day horizons
need declared session rules. Hourly source duplicates were losslessly deduplicated.
See the complete evidence in `docs/DEEPSEEK_GOLD_RESEARCH_PROGRESS.md`.

Next proposal must address XAU/USD session/calendar and DST/holiday provenance,
hourly gap classification, anchor alignment, trailing five-session return and
volatility estimators, missing-context handling and a bounded first report.
The coordinator reviews the proposal before measurement implementation proceeds.
Source coverage, endpoint availability and contiguous tradable paths must remain
distinct. No gap filling or timestamp-policy change may silently manufacture evidence.

Order remains individual direction AND return magnitude -> prior-context
conditioning -> systematic combinations with all attempts and year stability ->
frozen formula and untouched qualification. Descriptive reaction is not causation
or reliable predictive influence. Programs perform bulk processing; AI writes,
debugs and interprets compact reports. Layer 1 agents remain independent and
backtesting downstream-only.

Consistency rule (2026-09-21 review of 20260920-gold-findings-summary-005-r2): a
consistency claim requires at least two supported years. States with zero or one
supported year are not assessable for between-year agreement, and pooled-sign
agreement is reported separately from between-year agreement. Under that rule the
between-year same/differ/not-assessable totals are pooled 43/27/320, exact
41/21/305 and delayed 6/50/231 (unavailable states included). Pooled-sign totals
47/29/314, 48/21/298 and 6/50/231 are unchanged. This applies to later
documentation, companion tables, conditioning cells and any variable added by the
coverage plan.

Known separate defect: accepted coverage checkpoint reports 356/360 full tests;
failures are confined to pre-existing secret-scanner console-width truncation.
This historical result is not a test result for new changes.

## Gold transition review: changes requested

Submission 20260920-gold-policy-transition-001 was independently reproduced but not accepted. Verified two blocking bugs: close values used before candle completion and missing declared closes silently replaced. The archive-derived exception register does not independently validate source completeness. gold-policy-002 authorizes preserving the five files in the worker branch, corrective implementation/tests and a provider-evidenced proposal; canonical originals remain untouched. Earlier user research authorization remains valid; implementation preservation is not integration or permission to proceed to reaction reports. See the durable review for evidence and reported user horizon constraints.

## Project aim

Project aim (user relayed and confirmed 2026-09-20): every tracked asset provides a 24-hour directional call. Layer 2 is intended to issue a higher-conviction cross-pair call when two independent Layer 1 calls move in opposing directions. The dashboard is the decision aid for acting on those calls. This records intended product behaviour; higher conviction is not established predictive accuracy or profitability. Research/backtesting stays downstream-only.

## 2026-09-21: continue Gold research under orchestrator

2026-09-21 user authorized orchestrator to advance Gold research toward better validated Layer 1 calls. Published gold-coverage-006 from accepted ffa380c: prior 1/5/20-session Gold returns, expanded individual-variable/context report, regression tests and concrete remaining-coverage/qualification plan. Earlier Phase 1 approval hold superseded. Awaiting worker pickup; publication does not prove activity. Further bounded research assignments follow coordinator review under standing user direction; no production or accuracy claim.

Sequence remains coverage and individual relationships -> prior-context analysis -> systematic combinations with all attempts and chronological stability -> frozen candidate and genuinely untouched qualification. Reused exploratory/validation dates cannot become a fresh final test. Higher Layer 1 accuracy is an objective to test, not a promised outcome.

## 2026-09-21: bounded local worker-wake automation

The user built, installed and committed a local VS Code extension (`tools/agent-mailbox-bridge/`, `trading-local.trading-agent-mailbox` 0.1.0) that wakes a bound Cline worker window when that worker's own mailbox changes. It is a worker-side wake bridge, not a coordinator: it does not review submissions and does not wake this Codex coordinator, so the coordinator cycle stays manual ("check submissions").

Limits recorded with the adoption: explicit one-time binding per window that expires on reload; delivery recorded as `sent_unconfirmed` because Cline exposes no receipt, with worker activity as the only pickup evidence; concurrent or repeated events collapse to one attempt; a bounded daily wake budget; fail-closed on any mailbox validation error or assignment path escape; and the bridge never creates or replaces a Cline task, never clicks approvals and never interpolates report text into commands. Live end-to-end delivery is not verified, and installation alone does not establish it. Delivery records live outside the inbox and replies directories, so the bridge cannot alter a submitted report or a reply.

Any future coordinator-side automation still needs explicit budgets, exclusive coordinator locking and deduplication and remains a separate implementation. The open question of running the coordinator in the background versus in the current chat is unanswered.
## 2026-09-23: gold-qualification-protocol-012 revision 2 reviewed, changes requested

Background coordinator review of submission `20260923-gold-qualification-protocol-012-r2`
at clean worker `7792477`, submission SHA-256 `413b6b173cc46bde9b2c968b058a63564addee52507137dcf104e478a0a89beb`.
Independently verified: every artifact hash, the deterministic gate result (255
eligible of 2,548, identical per-check counts), the reproducing fail-closed probes,
the 37-atom/15-variable coverage, the fixed-offset consumed boundary and the
byte-identity of all nine run-011 artifacts; focused protocol file re-ran 8/8.
Revision 2 is not accepted. Revision 3 is limited to durable-note documentation
defects: a literal backslash escape and stale 7-test/71-71/455-451 counts in
`docs/GOLD_INDIVIDUAL_VARIABLE_REPORT_PROGRESS.md` and `docs/SESSION_NOTES.md`, to be
corrected to the delivered 8-test/72-72/456-452 state. See
`reviews/20260923-gold-qualification-protocol-012-r2.md`.

**Open decision (needs the user).** The gate's declaration space is 255 eligible
candidates against a declared selection cap of 20. Whether a prospective
qualification window opens over that pool, and whether the pool should be narrowed
before it opens, is not decided. No selector execution, prospective anchor or
outcome acquisition, holdout reservation/use, integration or production change is
authorized pending that decision. Revision 3 was subsequently reviewed and accepted; see the entry at the top of this file and `reviews/20260923-gold-qualification-protocol-012-r3.md`.
## 2026-09-24: strategy 003-asap acknowledged; the second adviser's provider line is explicit

The strategy worker recorded a user priority signal asking for the second Strategy adviser to be built
immediately and pointed at DeepSeek again, with no new key, credential scope or provider configuration,
and asked for two confirmations. The coordinator reviewed it as evidence, not instructions: submission
`20260924-strategy-second-adviser-003-asap` (mailbox SHA-256 `6a08b366...`, `status_report`, no commits
and no changed files) was acknowledged, and the build it asks for was already complete in canonical
`c4948df` - worktree, branch, register entry with the exact `instructions_published_awaiting_worker`
spelling, assignment, copper workspace and wake prompt. That publication did not depend on
`gold-coverage-completion-019`, on the live capture lane or on a later checkpoint. One real gap was
closed by this review: the provider is now named explicitly in revision 2 of
`docs/orchestration/assignments/strategy-2.md`, in the `strategy-2` wake prompt and in
`tools/strategy-node/README.md`; no second README file was created, because a duplicate beside the second
workspace would drift from the first. `projects.json` still carries no provider field, because the
provider is the user's selection in the Cline task in that window. No new worker assignment was
published: `gold-coverage-completion-019`, `strategy-advisory-2-001` and the `backtester-spike` revision
are already published and awaiting pickup, so a fourth would break the single-active-milestone rule, and
publication is not pickup. Boundaries unchanged: no deployment, production, warehouse, Layer 1, live
workflow, credential, qualification or holdout action, and the live capture lane stays untouched.
