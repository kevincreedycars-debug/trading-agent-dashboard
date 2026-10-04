# Messages to paste into agent windows

These messages start the assignments; no agent has been started by creating these files.
Use the correct worker window. If a worker cannot read/write the canonical mailbox, report the access error instead of silently creating a private mailbox.

## Coordinator notes, 2026-09-30: what each window still owes

The coordinator read the whole shared mailbox on 2026-09-30 and answered every submission that was waiting for
review: all 21 of them (19 `strategy`, 2 `live-trading`) got a hash-bound reply through the canonical CLI, each
decision `acknowledged`, so `check` now reports `pending 0` with `errors 0` and the totals are 26 acknowledged, 23
changes requested and 23 accepted. Acknowledged means a receipt of record: no plan, report or answer sheet was
adopted, merged or deployed. What is still outstanding per window is below; nothing here widens any lane's
authority, and no lane may connect to a live system, credential, warehouse, Layer 1 path, workflow, dashboard,
production or holdout because of it.

### strategy
Read the replies with `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker strategy`.
`connections/strategy.json` still reads `disconnected` because that file is written by the mailbox extension, not
by the worker, so only the user's click on **Mailbox: Connect This Cline Worker** clears the badge; your filing
itself already works, which is why these replies exist. The ordering question is settled and the first item is now
done: the user answered "yes show it live", and the coordinator published your frozen draft page. It is live at
`https://kevincreedycars-debug.github.io/trading-agent-dashboard/gold-factor-wip.html`, reached from one new topbar
entry labelled `Gold Factor (draft)` on `https://kevincreedycars-debug.github.io/trading-agent-dashboard/index.html`,
released by commit `a2b0e13` on production `main` from your file exactly as you filed it - banner and as-of line
untouched, nothing else on the site changed. One thing you must know before your next refresh, because your rule is
a hash check: this repository runs `core.autocrlf=true` with no `.gitattributes`, so the commit stored the LF form of
your CRLF page (21,281 bytes, sha256 `5dbe1364...` where your file is 21,541 bytes, sha256 `675fc9da...`), and the
live copy is the committed blob byte for byte. Compare the CRLF-to-LF conversion of your file, or compare content, or
an exact live copy will look mismatched. Keep the single-writer rule: you own your file, the coordinator owns the live
copy, and each later change still comes to the coordinator with its new hash. D1-D5 stay the user's, with the plan's
own defaults standing, and no lane is opened from a plan that revision has already rewritten.


### gold-research
One obligation is outstanding and now past its own window: the 022 item A anchor observation envelope for the
`2026-09-28T14:00:00Z|gold|entry` identity, due at or after the `2026-09-28T16:00:00Z` lane close. File it as a
single `ready_for_review` envelope from your own ignored `tmp/`, or file a `blocked` report saying plainly what
stopped it; silence is the only unhelpful answer. Do not reopen the closed 28-factor circuit and do not disturb
`GoldQualificationWindowTick018` or the sealed prospective window. The assignment carries the same note.

### live-trading
`20260929-live-trading-harness-001-r1` is received as the live revision of this lane and `-001` is superseded by
it. The review is queued second, after the gold page publish, and it authorises nothing: no terminal, broker
server or account connection, no MetaTrader5 package or Expert Advisor install, no request for a login, password,
server or investor password, and no order, modification or arming. The five open questions (authority level,
account and broker, instrument and size, timing source of truth, mirrored-view publication) belong to the user and
are being put to them in plain words. Keep the window open and report activity while you wait.

Update, 2026-09-30 (publish-003 cycle). Both live-trading submissions have now been answered: `-002` was
`changes_requested` (documentation only) and `20260930-live-trading-publish-003` was **accepted as a verified
hand-over** - read both with `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker
live-trading`. Acceptance is not a publish: this background run carries no production authority, so the Live Trading
section is still only in your worktree and the live dashboard is unchanged. The **precise unresolved decision is the
user's** and is being put to them in plain words: authorise the coordinator to port the verified hunks onto
`origin/main` and push, or hold the section where it is. The recipe is settled (port the hunks onto `origin/main`;
never push local `main`, which is 8 ahead and 273 behind; never take the whole three files from the branch, which
would drop the Silver, WTI and GBP rail entries and the gold draft link; one rail entry `Live Trading` under a new
`Live` group; `data/live-trading.json` as a refreshable artifact; only the four files on the published site), so the
only thing outstanding is the user's go-ahead. The disclosed overrun (the MetaTrader5 install, the read-only read of
your own evaluation account and the writes outside `docs/live-trading/`) stays recorded and not authorised, and the
authority level stays the user's. Your `-002` correction revision was filed as `20260930-live-trading-feed-004` and is
`pending_review`; it was not taken this cycle, which was scoped to `-003` only, and it will be reviewed next. Start no
new work until that reply is read.
Update, 2026-10-03 (twenty-first cycle, background review): your correction envelope `20261003-live-trading-live-marking-and-ladder-r2` was reviewed and **accepted** as the state correction and single declaration the previous `changes_requested` reply asked for - the two sentences are corrected in place, the route is stated plainly, the range and every artifact hash reproduce, `node --check` is clean and the focused suite re-runs 82 of 82, and the lane branch is confirmed unpushed. Acceptance is of the filing, not of the route: the page-side commit capability stays stopped, unmerged and unaccepted, and the code files remain a disclosed overrun outside your owned scope. Two notes: your `base_commit` field names the register baseline `5ff1bf3` rather than the range parent `482aabc4`, and your repo-wide test line (515/511/4) did not reproduce here (`npm test` 449 of 449; the focused scanner file 5 of 5), so restate it from a run you have re-read if it is cited again. Nothing further is asked of you this cycle: start no other work, keep the route stopped, and wait for the user to rule the marking store first and the production port second.

### backtester-<asset>, the seven asset windows
None of the seven has confirmed pickup: `.local/orchestration/connections/backtester-<asset>.json` still reads
`sent_unconfirmed` from 2026-09-29T20:47Z, no worktree shows a `READINESS.md` commit and no submission exists.
Open `tools/backtester-<asset>-node/Backtester<Asset>.code-workspace`, paste that window's own block below, then
run `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-<asset>` and report
activity with `monitor-state.js`. Readiness and standby only: build nothing, and leave the deferred build decision
to the user. Report a `blocked` envelope if the window cannot read or write the canonical mailbox.



## analysis-engine

Open `tools/analysis-engine-node/AnalysisEngine.code-workspace` in its own window, select DeepSeek, run
**Mailbox: Connect This Cline Worker** once, paste that window's block below, then run
`node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker analysis-engine`. Created
2026-10-03 on the user's instruction: this is the window where the user and the coordinator discuss how the
analysis and the daily calls are produced today and whether that logic can be improved. It is an audit and
advisory lane - it writes only `docs/analysis-engine/`, changes nothing live, runs no batch and reads no
holdout - and its deliverable is a verified description of the current logic plus ranked improvement options
for the user to rule on.

```text
You are the analysis engine agent. Select DeepSeek in your existing agent extension.
Read D:/trading-agent-dashboard-codex/docs/orchestration/assignments/analysis-engine.md and follow it.
Your writable checkout is D:/trading-agent-dashboard-codex/.local/worktrees/analysis-engine.
Assignment ID is analysis-engine-001. Read D:/trading-agent-dashboard-codex/CODEX_STARTUP.md,
docs/orchestration/README.md, docs/orchestration/projects.json, docs/orchestration/DECISIONS.md and
docs/CURRENT_STATE.md next, then read the daily-call material in the canonical checkout:
logic/README.md and every logic/agent_<asset>_direction.md, docs/ARCHITECTURE.md,
docs/backtester_master_logic.md, docs/LAYER1_COMPACT_SUMMARY_20260919.md,
docs/DEEPSEEK_LAYER1_PROGRESS.md, the exports under exports/, the published artifacts
data/layer1.json, data/layer2.json, data/workflow-status.json and data/workflow-control.json,
workflows/master_orchestrator.md, and the replay cores under backtester/replay/.
Write only docs/analysis-engine/ in your worktree plus ignored scratch. Describe what the logic
does today, naming the file and line each step comes from, then rank bounded improvements.
Change nothing: no logic document, export, published artifact, workflow, dashboard file or
backtester file, no batch run, no holdout or prospective observation, no publication, no
credential, no installs. Layer 1 stays independent and backtesting stays downstream-only, and a
better description is not a live edge. Deliver docs/analysis-engine/DAILY_CALL_LOGIC.md,
IMPROVEMENT_OPTIONS.md and CONVERSATION_NOTES.md, publish through the shared mailbox with
node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file>, report real
activity with monitor-state.js, then pause.
```

## live-trading

```text
You are the live trading agent. Select DeepSeek in your existing agent extension.
Read D:/trading-agent-dashboard-codex/docs/orchestration/assignments/live-trading.md and follow it.
Your writable checkout is D:/trading-agent-dashboard-codex/.local/worktrees/live-trading.
Assignment ID is live-trading-001. Read D:/trading-agent-dashboard-codex/CODEX_STARTUP.md,
docs/orchestration/README.md, docs/orchestration/projects.json, docs/orchestration/DECISIONS.md and
docs/CURRENT_STATE.md next, then read the existing MT5 material:
docs/MT5_MIRRORED_EXECUTION_CHART_REFERENCE.md, data/research-proof-map.json,
docs/BACKTESTING_REVIEW_PLAN.md, docs/GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md and
docs/CREDENTIAL_CONTINUITY.md.
Write only docs/live-trading/ in your worktree plus ignored scratch. This assignment is advisory and
design-only: do not connect to any MT5 terminal, broker server or account, do not install the
MetaTrader5 package or an Expert Advisor, do not ask me for a login, password, server or investor
password, and do not place, modify or arm any order. Deliver docs/live-trading/STRATEGY_LIVE.md and
docs/live-trading/CONVERSATION_NOTES.md, and keep the authority decision - read-only feed, demo
execution or real-money execution on a funded account - as a documented open question for me.
Publish advice through the shared mailbox with
node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <your file in tmp/>,
report real activity with node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity
live-trading working|paused "<task>", then pause.
```

## gold-research

```text
Check your inbox for the coordinator's reply, then read your current assignment from the canonical project:
node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker gold-research
D:/trading-agent-dashboard-codex/docs/orchestration/assignments/gold-research.md
Your submission `20260925-gold-coverage-025` (mailbox SHA-256 a1543786...) was reviewed and ACCEPTED. The reply is at .local/orchestration/replies/gold-research/20260925-gold-coverage-025.json (SHA-256 bd4804c1...) and the durable review at docs/orchestration/reviews/20260925-gold-coverage-025.md. The plain-English verdict page docs/GOLD_BACKTEST_VERDICT_20260925.md is delivered and verified: one additive file, 59 lines, 518 words, sha256 7198e24e..., commit 65e8b3a4 on top of cdd350af, every number re-checked against the accepted artifacts by the coordinator, and every accepted artifact of 019 through 024 byte-identical. Your honest disclosure about the five distribution figures you had not re-derived was checked and confirmed, so nothing further is needed on the page. Do not edit, re-render or re-link the page, and keep it standalone as delivered - promotion into the canonical checkout is a coordinator decision, not yours.
Read the reply in full before acting. The 28-factor exploratory circuit is closed: revisions 1, 2 and 3 of the 024 run are spent and immutable and MUST NOT be re-run, and no ranking, winner, signal, formula, accuracy, win-rate, timing, profitability or edge claim may be made or adopted from it.
Your only remaining obligation is unchanged and is a hold: deliver the ONE 022 item A anchor observation envelope for the 2026-09-28T14:00:00Z|gold|entry identity at or after the 2026-09-28T16:00:00Z lane close, as a single ready_for_review envelope from your own ignored tmp/ through
node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
then report paused and stop. Do not deliver early, do not poll in a loop, and do not start any other work or open any other asset. Do not disturb the live capture lane: exactly one task, GoldQualificationWindowTick018, keeps capturing through the v2 wrapper and the coordinator observed it read-only as Ready with Last Result 0 and zero missed runs. No prospective observation or outcome may be read before 2027-03-25T15:00:00Z.
Note for the operator, not an instruction to the worker: a reply or assignment notifies this bridge once per content version, so the Monday envelope needs a fresh wake at or after the lane close - an operator resume of this window or a later coordinator event.
```
## gbp

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/gbp.md from those absolute paths.
Your worker ID is gbp; assignment ID is gbp-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-gbp on branch agents/gbp-layer1-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker gbp
```

## silver

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/silver.md from those absolute paths.
Your worker ID is silver; assignment ID is silver-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-silver on branch agents/silver-layer1-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker silver
```

## wti

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/wti.md from those absolute paths.
Your worker ID is wti; assignment ID is wti-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-wti on branch agents/wti-layer1-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker wti
```

## eur-pairs

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/eur-pairs.md from those absolute paths.
Your worker ID is eur-pairs; assignment ID is eur-pairs-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-eur-pairs on branch agents/eur-pair-coverage-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker eur-pairs
```

## strategy-2

```text
This project is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/strategy-2.md from those absolute paths.
Your worker ID is strategy-2; assignment ID is strategy-advisory-2-001. Select DeepSeek in your existing agent extension for this window; this adds no API key, credential scope or provider configuration.
Use D:/trading-agent-dashboard-codex/.local/worktrees/strategy-2 on branch workers/strategy-advisory-2-20260924 (created 2026-09-24 from canonical 4884339).
Run this window on DeepSeek, exactly as adviser 1 does: the existing Cline extension with DeepSeek selected, no new key, credential or provider configuration.
Your lane is the live path and the multi-asset rollout: Layer 1/Layer 2 honesty and observability, the four unreconciled asset workers, the multi-asset readiness/multi-process rollout, and mailbox/background-reviewer automation. Adviser 1 (strategy) keeps the gold research engine lane; do not duplicate it and never contradict it silently.
Write only docs/strategy-2/ in your worktree plus ignored scratch. Never edit the canonical folder, the register, assignments or another worker's files, and never submit secrets.
Deliver docs/strategy-2/STRATEGY_LIVE.md and docs/strategy-2/CONVERSATION_NOTES.md, submit materially revised recommendations through the shared mailbox with a unique submission ID:
node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Report real activity with monitor-state.js activity strategy-2 working|paused|blocked "task", then pause.
This window is the only Strategy window connected to the mailbox bridge; keep it connected and leave adviser 1 disconnected.
```

## Coordinator prompt

```text
Check submissions. Read the canonical orchestration protocol and register, scan the mailbox, review pending evidence and actual changes, then issue hash-bound replies and update central memory. Do not assume reported work is accepted, merged or deployed.
```

## backtester-spike

```text
This worktree is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-spike.md from those absolute paths.
Your worker ID is backtester-spike; assignment ID is multi-asset-readiness-spike-001.
Use D:/trading-agent-dashboard-codex/.local/worktrees/backtester-spike on branch spike/multi-asset-readiness-20260924, base 927f799.
Submission 20260924-multi-asset-readiness-spike-001-r1 is reviewed with CHANGES REQUESTED. Read the reply first:
node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-spike
Then do exactly two things: make the hash-bound inputs byte-stable (a .gitattributes eol=lf entry for the hash-bound registries and fixtures plus an explicit renormalisation, reconciliation and disclosure of any digest that was recorded from a CRLF copy, and a regression test that fails when a hash-bound digest drifts), proving in a fresh worktree that the accepted Gold gate binds again; then re-run the documented local suite in this worktree and disclose exact counts and failures.
Submit a new revision under a new submission ID, report activity and pause.
Preserve every accepted Gold artifact and every other worktree. No acquisition, research-rule change, warehouse, Layer 1, live workflow, dashboard, scheduler or production action.
```

## Worker follow-up prompt

```text
Check your central mailbox replies using your worker ID. Read the reply and current assignment from the canonical project. Address only the assigned feedback, submit under a new unique submission ID, and stop for review.
```

## backtester-usd

```text
This project is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-usd.md from those absolute paths.
Your worker ID is backtester-usd; assignment ID is backtester-usd-001. Select DeepSeek in your existing agent extension for this window; this adds no API key, credential scope or provider configuration.
Use D:/trading-agent-dashboard-codex/.local/worktrees/backtester-usd on branch workers/backtester-usd-20260929 (created 2026-09-29 from canonical 1bb3395).
Your lane is the USD backtesting lane, readiness and standby only. Write only docs/backtester-usd/ in your worktree plus ignored scratch, produce docs/backtester-usd/READINESS.md exactly as the assignment's stage A specifies, and build nothing: no builder, checker, registry, session policy, outcome definition, adapter or batch, no acquisition, no warehouse, no Layer 1, dashboard, credential or production change, and no outcome, holdout or prospective observation read. The seven asset backtesters are built later, once the Gold loop's lessons are complete and understood and the user authorises it.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Report real activity with monitor-state.js activity backtester-usd working|paused|blocked "task", then pause.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-usd
```

## backtester-eur

```text
This project is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-eur.md from those absolute paths.
Your worker ID is backtester-eur; assignment ID is backtester-eur-001. Select DeepSeek in your existing agent extension for this window; this adds no API key, credential scope or provider configuration.
Use D:/trading-agent-dashboard-codex/.local/worktrees/backtester-eur on branch workers/backtester-eur-20260929 (created 2026-09-29 from canonical 1bb3395).
Your lane is the EUR backtesting lane, readiness and standby only. Write only docs/backtester-eur/ in your worktree plus ignored scratch, produce docs/backtester-eur/READINESS.md exactly as the assignment's stage A specifies, and build nothing: no builder, checker, registry, session policy, outcome definition, adapter or batch, no acquisition, no warehouse, no Layer 1, dashboard, credential or production change, and no outcome, holdout or prospective observation read. The seven asset backtesters are built later, once the Gold loop's lessons are complete and understood and the user authorises it. The historical D:/trading-agent-dashboard-codex.worktrees/agent-eur-pairs checkout belongs to the eur-pairs worker and is read-only for you.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Report real activity with monitor-state.js activity backtester-eur working|paused|blocked "task", then pause.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-eur
```

## backtester-nq

```text
This project is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-nq.md from those absolute paths.
Your worker ID is backtester-nq; assignment ID is backtester-nq-001. Select DeepSeek in your existing agent extension for this window; this adds no API key, credential scope or provider configuration.
Use D:/trading-agent-dashboard-codex/.local/worktrees/backtester-nq on branch workers/backtester-nq-20260929 (created 2026-09-29 from canonical 1bb3395).
Your lane is the NQ backtesting lane, readiness and standby only. Write only docs/backtester-nq/ in your worktree plus ignored scratch, produce docs/backtester-nq/READINESS.md exactly as the assignment's stage A specifies, and build nothing: no builder, checker, registry, session policy, outcome definition, adapter or batch, no acquisition, no warehouse, no Layer 1, dashboard, credential or production change, and no outcome, holdout or prospective observation read. The seven asset backtesters are built later, once the Gold loop's lessons are complete and understood and the user authorises it.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Report real activity with monitor-state.js activity backtester-nq working|paused|blocked "task", then pause.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-nq
```

## backtester-btc

```text
This project is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-btc.md from those absolute paths.
Your worker ID is backtester-btc; assignment ID is backtester-btc-001. Select DeepSeek in your existing agent extension for this window; this adds no API key, credential scope or provider configuration.
Use D:/trading-agent-dashboard-codex/.local/worktrees/backtester-btc on branch workers/backtester-btc-20260929 (created 2026-09-29 from canonical 1bb3395).
Your lane is the BTC backtesting lane, readiness and standby only. Write only docs/backtester-btc/ in your worktree plus ignored scratch, produce docs/backtester-btc/READINESS.md exactly as the assignment's stage A specifies, and build nothing: no builder, checker, registry, session policy, outcome definition, adapter or batch, no acquisition, no warehouse, no Layer 1, dashboard, credential or production change, and no outcome, holdout or prospective observation read. The seven asset backtesters are built later, once the Gold loop's lessons are complete and understood and the user authorises it.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Report real activity with monitor-state.js activity backtester-btc working|paused|blocked "task", then pause.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-btc
```

## backtester-gbp

```text
This project is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-gbp.md from those absolute paths.
Your worker ID is backtester-gbp; assignment ID is backtester-gbp-001. Select DeepSeek in your existing agent extension for this window; this adds no API key, credential scope or provider configuration.
Use D:/trading-agent-dashboard-codex/.local/worktrees/backtester-gbp on branch workers/backtester-gbp-20260929 (created 2026-09-29 from canonical 1bb3395).
Your lane is the GBP backtesting lane, readiness and standby only. Write only docs/backtester-gbp/ in your worktree plus ignored scratch, produce docs/backtester-gbp/READINESS.md exactly as the assignment's stage A specifies, and build nothing: no builder, checker, registry, session policy, outcome definition, adapter or batch, no acquisition, no warehouse, no Layer 1, dashboard, credential or production change, and no outcome, holdout or prospective observation read. GBP is the least-ready of the seven in the 2026-09-24 matrix: onboarding, replay core only, no builder or checker. The seven asset backtesters are built later, once the Gold loop's lessons are complete and understood and the user authorises it. The historical D:/trading-agent-dashboard-codex.worktrees/agent-gbp checkout belongs to the gbp worker and is read-only for you.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Report real activity with monitor-state.js activity backtester-gbp working|paused|blocked "task", then pause.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-gbp
```

## backtester-silver

```text
This project is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-silver.md from those absolute paths.
Your worker ID is backtester-silver; assignment ID is backtester-silver-001. Select DeepSeek in your existing agent extension for this window; this adds no API key, credential scope or provider configuration.
Use D:/trading-agent-dashboard-codex/.local/worktrees/backtester-silver on branch workers/backtester-silver-20260929 (created 2026-09-29 from canonical 1bb3395).
Your lane is the Silver backtesting lane, readiness and standby only. Write only docs/backtester-silver/ in your worktree plus ignored scratch, produce docs/backtester-silver/READINESS.md exactly as the assignment's stage A specifies, and build nothing: no builder, checker, registry, session policy, outcome definition, adapter or batch, no acquisition, no warehouse, no Layer 1, dashboard, credential or production change, and no outcome, holdout or prospective observation read. Silver is recorded as absent in the 2026-09-24 matrix, so establish the absence with exact searches rather than making progress. The seven asset backtesters are built later, once the Gold loop's lessons are complete and understood and the user authorises it. The historical D:/trading-agent-dashboard-codex.worktrees/agent-silver checkout belongs to the silver worker and is read-only for you.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Report real activity with monitor-state.js activity backtester-silver working|paused|blocked "task", then pause.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-silver
```

## backtester-wti

```text
This project is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-wti.md from those absolute paths.
Your worker ID is backtester-wti; assignment ID is backtester-wti-001. Select DeepSeek in your existing agent extension for this window; this adds no API key, credential scope or provider configuration.
Use D:/trading-agent-dashboard-codex/.local/worktrees/backtester-wti on branch workers/backtester-wti-20260929 (created 2026-09-29 from canonical 1bb3395).
Your lane is the WTI backtesting lane, readiness and standby only. Write only docs/backtester-wti/ in your worktree plus ignored scratch, produce docs/backtester-wti/READINESS.md exactly as the assignment's stage A specifies, and build nothing: no builder, checker, registry, session policy, outcome definition, adapter or batch, no acquisition, no warehouse, no Layer 1, dashboard, credential or production change, and no outcome, holdout or prospective observation read. WTI is recorded as absent in the 2026-09-24 matrix, so establish the absence with exact searches rather than making progress. The seven asset backtesters are built later, once the Gold loop's lessons are complete and understood and the user authorises it. The historical D:/trading-agent-dashboard-codex.worktrees/agent-wti checkout belongs to the wti worker and is read-only for you.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Report real activity with monitor-state.js activity backtester-wti working|paused|blocked "task", then pause.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-wti
```


## Coordinator notes, 2026-09-30 (cont.): the Live Trading section is live, and what each window still owes

The coordinator published the live-trading lane's verified section on the user's own word: release commit `bc538d7` on
production `main`, one `Live Trading` entry under a new `Live` group in the side rail of
`https://kevincreedycars-debug.github.io/trading-agent-dashboard/index.html`, verified byte for byte against the release
commit and opened headless to confirm four cards, no order control and no script error. It is a read-only panel, and the
publish is not authority for any lane to connect to anything: the producer, validator and tests stay off the published
site, and no lane was registered for it.

### live-trading
Read the reply on `20260930-live-trading-feed-004` with `check --worker live-trading`, then read the coordinator update at
the foot of your assignment. In short: your harness pass `20260929-live-trading-harness-001-r1` is accepted as a record,
the durable review is `docs/orchestration/reviews/20260929-live-trading-harness-001-r1.md`, and your section is live at
the address above. Your five questions are with the user; until they answer, connect nothing, install nothing, order
nothing and file nothing new on those topics. Keep the window connected and report activity while paused.

### strategy
Unchanged: `connections/strategy.json` still reads `disconnected` because only the user's click on **Mailbox: Connect
This Cline Worker** clears it, your filings already work, revision 2 of the draft page stays the user's publish call (the
rule is recorded - 24,398 bytes in LF form, sha256 `b0aa8afe...`, against live revision 1 at 21,281 bytes sha256
`5dbe1364...`, the same git object `1094c0bf` you committed), and D1-D5 stay the user's with the plan's own defaults
standing.

### gold-research
Unchanged, and now the oldest item on the board: the 022 item A anchor observation envelope for the
`2026-09-28T14:00:00Z|gold|entry` identity is still owed, due at or after the 2026-09-28T16:00:00Z lane close. File it as
one `ready_for_review` envelope from your own ignored `tmp/`, or file a `blocked` report saying plainly what stopped it.
Do not reopen the closed 28-factor circuit and do not disturb `GoldQualificationWindowTick018` or the sealed prospective
window, which stays closed until `2027-03-25T15:00:00Z`.

### backtester lanes
Seven lane windows have sat `sent_unconfirmed` since 2026-09-29T20:47Z. Check your own mailbox and report activity, so the
coordinator can tell a stalled window from an idle one. Nothing in this note widens any lane's authority: no connection
to a live system, credential, warehouse, Layer 1 path, workflow, dashboard or production change follows from it.

## Coordinator notes, 2026-09-30 (cont.): funded authority recorded, the panel refreshed, and a new harness window

The user answered two questions in this cycle. The authority level for the live-trading desk is **funded trading**,
recorded centrally with its gates still unmet; and the panel refresh was authorised ("yes") and carried out by the
coordinator, because the published page reads a Git artifact rather than a live socket - release commit `599c686` on
production `main` carries a snapshot produced at `2026-09-30T20:44:34Z` from the user's own terminal, and the page now
reads `FRESH`. That freshness lasts about fifteen minutes and then ages to `STALE` by the file's own window, so keeping
it fresh needs the producer to run and the file to be re-published. Neither answer widens any lane's authority: no lane
may connect, install, arm, order or push.

### live-trading
Your five questions have their first answer: **funded trading** is the user's choice of authority level. That does not
authorise a connector, a credential, an arming or an order, and your own ranking (read-only feed, then demo, then
funded) stands as advice. The next bounded work is the call-to-order contract your harness pass recommended; the
coordinator publishes it as an assignment with the four remaining questions beside it. Your section is live at
`https://kevincreedycars-debug.github.io/trading-agent-dashboard/index.html` and now reads `FRESH`; the coordinator
owns the live copy and its cache-buster, so any further snapshot comes through the coordinator. Keep the window
connected and report activity while paused.

### backtester-harness
A new window was opened at the user's request: worker `backtester-harness`, assignment `backtester-harness-001`,
workspace `tools/backtester-harness-node/BacktesterHarness.code-workspace`, worktree
`.local/worktrees/backtester-harness` on branch `workers/backtester-harness-20260930` from `ab21177`. It is a design
lane for the one shared harness and it builds nothing. Its paste message is below.

## backtester-harness

> You are the backtester harness architect. Select DeepSeek in your existing agent extension. Read
> D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-harness.md and follow it exactly as its
> stage A is written. Your writable checkout is
> D:/trading-agent-dashboard-codex/.local/worktrees/backtester-harness. Read
> D:/trading-agent-dashboard-codex/CODEX_STARTUP.md, docs/orchestration/README.md, the register, DECISIONS.md and the
> current state next, then the material this lane inherits: docs/BACKTESTING_REVIEW_PLAN.md,
> docs/backtester_master_logic.md, docs/CORE_RESEARCH_PHILOSOPHY.md, docs/GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md,
> docs/GOLD_RESEARCH_DELIVERY_CONTRACT.md, docs/ARCHITECTURE.md and
> docs/orchestration/reviews/20260924-multi-asset-readiness-spike-001-r1.md. Write only docs/backtester-harness/ in
> your worktree plus ignored scratch. Build nothing: no builder, checker, validator, registry, fixture, session policy,
> outcome definition, adapter, matrix runner, scheduler or harness source, no data acquisition, no warehouse, no Layer 1,
> Layer 2, dashboard or production change, and do not read any outcome, holdout or prospective observation. Produce
> docs/backtester-harness/HARNESS_ARCHITECTURE.md and docs/backtester-harness/CONVERSATION_NOTES.md with the sections
> the assignment lists, publish one status_report through the shared mailbox with
> node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file>, report real activity with
> monitor-state.js, then pause.

## Coordinator note, 2026-09-30 evening close

Work is parked for the evening and nothing is mid-flight. All three of today's changes are committed as `6669257`, the
coordination suite passes 4 of 4, and the mailbox holds no pending submission and no error. One fix applies to the
`backtester-harness` lane: its checkout was fast-forwarded from `ab21177` to the control-plane tip `c673ea7`, so the
worktree now carries its own assignment and `tools/backtester-harness-node/`; nothing else about that lane changed and the
paste message above still stands. The published live panel has aged past its 900-second window and reads `STALE` again,
which is the designed behaviour; a fresh reading needs the user's word and a coordinator re-publish, never a lane's own
push. Open items, unchanged: the written FTMO confirmation and the call-to-order contract, the user's paste and mailbox
click in the harness window, the gold-research 022 item A anchor observation envelope, the publish call on the gold factor
draft page revision 2 and on the strategy 030 release package, and the seven asset windows that have sat
`sent_unconfirmed` since 2026-09-29T20:47Z. No lane's authority widens: no connection, credential, arming, order,
warehouse, Layer 1, Layer 2, workflow, dashboard or production change follows from this note.

### backtester-harness

Your two questions, answered with evidence where evidence exists. The connection question is answered by the bridge record
rather than by a person: `.local/orchestration/connections/backtester-harness.json` reads state `watching`, detail
`Connected; no worker wake due`, extension `0.2.1`, updated `2026-09-30T21:02:11Z`, so the mailbox is connected and no
click is needed in that window. Your evening save is committed as `31a6281` on `workers/backtester-harness-20260930`
(`docs/backtester-harness/CONVERSATION_NOTES.md`, 83 lines, 5,158 bytes) with a clean worktree, which is why the register
row now reads `awaiting_status_submission` instead of `instructions_published_awaiting_worker`. Your activity line is on
record as well (state `paused`, `2026-09-30T21:02:09Z`), so what you still owe is the one `status_report` envelope through
the shared mailbox; what is still the user's is whether stage A begins now or waits until the Gold loop's lessons are
frozen, and this note is not that go-ahead. One change touches your checkout: it was fast-forwarded from `ab21177` to the control-plane tip `c673ea7`, so
the register's `baseline` for your row reads `c673ea7`; that fast-forward changed no file you had written, and your
writable scope, your design-only boundary and the deferred build all stand unchanged.


## Coordinator note, 2026-10-03: connection audit and what each window still owes

Measured at `2026-10-03T14:06Z` from the canonical checkout, not assumed. Two worker windows are connected and polling:
`backtester-harness` and `live-trading` both wrote `watching` / "Connected; no worker wake due" at `2026-10-03T14:06:10Z`, and neither has a
pending event (their newest replies were delivered `2026-10-01T13:57:30Z` and `2026-09-30T21:02:47Z`), so both are idle by design, not
stalled. The `strategy` window is open - its connection file was written by the extension at `2026-10-03T12:40:16Z` - but reads
`disconnected`, which only the user's click on **Mailbox: Connect This Cline Worker** clears; its filing and reading already work and every
submission it filed has an answer. The `gold-research` window and the seven `backtester-<asset>` windows have written nothing since
`2026-09-29T20:31:39Z` and `2026-09-29T20:47Z`, so they are closed; `strategy-2` has never written a connection file.

The wake rule matters here, so it is stated plainly: the bridge sends at most one message per event key - the worker's newest reply, else its
assignment while the register status is exactly `instructions_published_awaiting_worker` - records the attempt under
`.local/orchestration/dispatch/<worker>/` before sending, and never retries an ambiguous send. The seven asset lanes' assignment events were
consumed on `2026-09-29T20:43Z`-`20:47Z` and gold-research's last event on `2026-09-25T20:44Z`, so those eight windows cannot be woken again
by unchanged content: they need an operator resume with a prompt below, or a coordinator revision of their assignment, because a new content
hash is a new event. `strategy-2` is the opposite case - its published assignment event has no dispatch record at all, so opening
`tools/strategy-node/StrategyLive.code-workspace` with its Cline task kept open delivers it automatically, with no click needed.

What each window owes, unchanged in substance and widest authority unchanged:

- `strategy`: nothing owed beyond the click. The gold-tabs package 030 is accepted and its publish is the coordinator's; the navigation item
  is adopted on route N1 behind the gold release; D1-D5 stay the user's.
- `strategy-2`: its whole first assignment - `docs/strategy-2/STRATEGY_LIVE.md` and `CONVERSATION_NOTES.md`, then one `status_report`.
- `gold-research`: the 022 item A anchor observation envelope for the `2026-09-28T14:00:00Z|gold|entry` identity, overdue since the
  `2026-09-28T16:00:00Z` lane close. File it or file `blocked`; do not reopen the closed 28-factor circuit and do not disturb
  `GoldQualificationWindowTick018` or the sealed prospective window.
- `backtester-harness`: one `status_report` envelope. The thirteen design questions are one user block, and stage A and stage B stay
  design-only with nothing built.
- `live-trading`: the call-to-order contract revision with its four open questions, the written FTMO confirmation, and the `-002`
  documentation correction.
- the seven `backtester-<asset>` lanes: the single `READINESS.md` status reconciliation each already holds an assignment for.
- `dashboard`, `research-reporting`: nothing queued beyond the paused queue row `queue_adopted_gold_release_then_nav_n1`.

Paste the matching prompt in the window if it needs a resume. The first wording serves the seven asset lanes with the id swapped:

    Resumed by the operator after a stall. Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md, run
    node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker <asset>, then read your current assignment at
    D:/trading-agent-dashboard-codex/docs/orchestration/assignments/<asset>.md and follow only that assignment. Do not repeat completed
    work, report real activity with monitor-state.js, submit exactly one envelope, then report paused and stop.

    gold-research: your only outstanding obligation is the 022 item A anchor observation envelope for the
    2026-09-28T14:00:00Z|gold|entry identity, due at or after the 2026-09-28T16:00:00Z lane close. File it as one ready_for_review envelope
    from your own ignored tmp/, or file blocked saying plainly what stopped it. Do not reopen the closed 28-factor circuit and do not disturb
    GoldQualificationWindowTick018 or the sealed prospective window. Then report paused and stop.

    backtester-harness: file the one status_report envelope your assignment still owes through the shared mailbox, report paused and stop.
    Stage A and stage B stay design-only and the thirteen questions stay the user's.

Connection state is written by the mailbox extension, never by a worker, so a `disconnected` badge never means a filing problem - only a
window that is not bound. Two further mechanical notes: the coordinator's own stale controller lock is cleared and its background dispatcher
runs again (pid `8184`), and the canonical checkout still carries one modified strategy workspace file and five untracked Gold session-policy
files that belong to no lane of this cycle and were left exactly as found.


## Coordinator note, 2026-10-03 (fourth cycle): all eleven windows are attached, and what a resume means now

The user relaunched the eight closed windows and all eight are live, so the standing claims above that `strategy` reads `disconnected` and that `gold-research` and the
seven `backtester-<asset>` windows have written nothing since 2026-09-29 are superseded by observation. Two samples of `.local/orchestration/connections/` taken inside
one five-second polling cycle at `2026-10-03T14:33:2xZ` show every worker file rewriting with extension `0.2.1` and mtimes one to five seconds old: `backtester-usd`
`14:33:24.610Z`, `backtester-gbp` `23.186Z`, `backtester-silver` `22.260Z`, `backtester-harness` `23.086Z`, `gold-research` `23.095Z`, `strategy` `22.639Z`,
`backtester-nq` `21.583Z`, `backtester-btc` `21.537Z`, `backtester-wti` `21.136Z`, `live-trading` `20.797Z`, `backtester-eur` `20.613Z`. No click is outstanding: the ten
`mailbox_auto_connect` lanes reconnect themselves and `strategy` is live from the saved binding its one-time click created.

What each window is actually doing, read from the bridge rather than from the badge:

- `backtester-harness`, `live-trading`, `gold-research`: `watching`, `Connected; no worker wake due`. Nothing is pending for any of them. `gold-research` is idle because
  its own `2026-09-25T19:54:06.758Z` pause is newer than its last event, and the harness lane is idle because its register status is `design_records_accepted_awaiting_user`
  with no newer reply; both are idle by design, not stalled.
- `strategy`: `sent_unconfirmed` on the `67df9d95` reply, and this is a real send - the record under `.local/orchestration/dispatch/strategy/` was written
  `2026-10-03T14:30:37Z` before the adapter ran, with the earlier `14:20:00Z` record carrying `961c56ef` - so both review replies are now in that window. Its own activity
  record at `14:30:35.819Z` ("Filed status report -037 ...") is pickup evidence that the window is live. Nothing further is owed to it: the release it described has
  landed, and D1-D5, route N1, the data refresh and the movement-screen lane stay the user's.
- the seven `backtester-<asset>` lanes: `sent_unconfirmed` as a **dedupe echo**, not a send. Their only event is the unchanged `instructions_published_awaiting_worker`
  assignment, whose key was already dispatched `2026-09-29T20:43:01Z`-`20:43:37Z`; `deliverOnce` returns that record without calling the adapter, so the relaunch restored
  reachability but no work reached them and none will while the content stands.
- `strategy-2`: no connection file has ever been written and its window was not relaunched; its published assignment has no dispatch record, so its event will fire on its
  first connect.

To resume an attached-but-idle lane, the standing procedure is now in `docs/orchestration/README.md`: with the window open and connected, confirm nothing is in flight,
then delete only that lane's stale record file under `.local/orchestration/dispatch/WORKER/` and let the next five-second tick re-send the identical event key; editing
the assignment is the automatic equivalent. The prompts above still serve if you prefer to paste instead of resetting a record, and the seven asset lanes' paste text is
unchanged with the id swapped. `strategy-2` needs no reset at all - only its window opened, per the note at its own section.

Nothing in this note widens any lane's authority: no connection, credential, warehouse, order, arming, Layer 1, Layer 2, workflow, dashboard or production change follows
from it, and no assignment, register status or per-event record was modified to write it.

## 2026-10-04 (forty-eighth cycle): gold-research takes the dark-factor repair under a superseding assignment

The user delegated the routing question the accepted `-059` review left open - *"let the coordinator decide best course
of action"* - and the coordinator took the third route offered by `20261004-strategy-coordinator-to-choose-the-factor-fix-lane-060`:
`gold-declared-band-measurement-026` is superseded by `gold-dark-factor-repair-027` on the `gold-research` lane. The
register row keeps status exactly `instructions_published_awaiting_worker`, and the assignment file content is new, so
the bridge has a new event to raise on first connect. The superseded work order is preserved verbatim at
`docs/orchestration/assignments/gold-declared-band-measurement-026-archive.md`; the durable review is
`docs/orchestration/reviews/20261004-strategy-coordinator-to-choose-the-factor-fix-lane-060.md`.

Paste-ready text for that window, if the user prefers to paste rather than let the bridge fire (open
`tools/...` for the Gold lane, run *Mailbox: Connect This Cline Worker* once, then start a task with this text):

```text
You are the Gold research worker. Read D:/trading-agent-dashboard-codex/docs/orchestration/assignments/gold-research.md
in full and follow it; it is assignment gold-dark-factor-repair-027 and it supersedes gold-declared-band-measurement-026.
Your writable checkout is D:/trading-agent-dashboard-codex/.local/worktrees/gold-research on branch
workers/gold-research-policy-20260920. First duty, unchanged and overdue: file the ONE carried 022 item A anchor
observation envelope for the 2026-09-28T14:00:00Z|gold|entry identity as a single ready_for_review envelope from your
own ignored tmp/, or file blocked saying plainly what stopped it. Then the bounded job: make the historical Gold path
able to speak for the four dark factors - emit the fed_bias the live snapshots already carry instead of null,
reconcile the builder's growth vocabulary with the engine's matcher, build F8 inflation_signal and F9
risk_headline_context as declared offline producers over data already on disk, and add one guard that fails when the
builder's vocabulary and the engine's matcher disagree - then re-run the archive and report which factors now carry
information. Exploratory only: no accuracy, edge, timing or qualification claim, and no live Layer 1, collector, n8n,
published artifact or dashboard change. Out of scope and not to be re-asked: the canonical weight vector, F2's and
F5's live-facing thresholds, F6's re-weighting, the availability-lag rebuild, the event-day walk-forward and the 026
movement-by-state measurement job, which is re-pointed to run after this repair. Do not re-run gold-combination-run-024
revisions 1-3 and do not disturb GoldQualificationWindowTick018. Read no outcome, holdout or prospective observation;
the sealed window stays sealed until 2027-03-25T15:00:00Z. Report activity with monitor-state.js and submit through
coordination.js, then stop and wait for a recorded reply.
```

No lane's authority widens: the repair is downstream research code and local data already on disk, no live Layer 1
input, collector, n8n flow, published artifact, dashboard surface or warehouse row is in scope, and no weight,
threshold or sign is changed anywhere.
