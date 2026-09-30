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

### backtester-<asset>, the seven asset windows
None of the seven has confirmed pickup: `.local/orchestration/connections/backtester-<asset>.json` still reads
`sent_unconfirmed` from 2026-09-29T20:47Z, no worktree shows a `READINESS.md` commit and no submission exists.
Open `tools/backtester-<asset>-node/Backtester<Asset>.code-workspace`, paste that window's own block below, then
run `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-<asset>` and report
activity with `monitor-state.js`. Readiness and standby only: build nothing, and leave the deferred build decision
to the user. Report a `blocked` envelope if the window cannot read or write the canonical mailbox.



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
