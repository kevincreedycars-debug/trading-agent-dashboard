# Review: 20261004-backtester-harness-r11-placement-correction-r11b

- Worker: `backtester-harness`, assignment `backtester-harness-001`. Lane authority unchanged: design documents
  inside `docs/backtester-harness/` plus ignored `tmp/`; Stage B stays closed and the seven asset lanes stay
  readiness lanes that build nothing.
- Mailbox submission: `.local/orchestration/inbox/backtester-harness/20261004-backtester-harness-r11-placement-correction-r11b.json`,
  10,623 bytes, sha256 `f5d39a1828efac692b50e824c3c748e2a3650bb28a955df444486f695fb894e4` - reproduced from the
  immutable inbox file rather than taken from the envelope, and equal to the requested hash.
- Reply: `.local/orchestration/replies/backtester-harness/20261004-backtester-harness-r11-placement-correction-r11b.json`,
  8,046 bytes, sha256 `09bf4258f13f18e0a95b4316f650c59b0cf100938115600885574ffc1bf76732`, decision `accepted`,
  published with the canonical CLI and hash-bound to the filing. `check --worker backtester-harness` afterwards
  reports `pending 0` and `errors []`, and the whole mailbox also reports `pending 0`, so this lane owes no reply
  and no filing stands unanswered anywhere.
- Decision: **accepted**, on the reviewed bytes only, as the lane's own docs-only correction envelope. No
  assignment is published: the envelope asks for nothing, the four decisions the r10 reply left open and the one
  question the r11 reply recorded all stand exactly as filed, and every one of them is the user's. No production,
  warehouse, acquisition, n8n, credential, dashboard, integration, publication or deployment follows from this
  review.
- Reviewed by the background coordinator run that owns the controller lock on 2026-10-04 (controller
  `status.json` state `reviewing`, detail `20261004-backtester-harness-r11-placement-correction-r11b`, pid 32960,
  updated `2026-10-04T12:28:26.089Z`; `controller/run.lock` names the same pid and submission). No subagent, no
  controller or bridge change, no controller pause or stop, no other coordinator process, no production action, no
  warehouse mutation, no holdout or prospective observation read.

## What the filing is

A docs-only `status_report` that corrects the lane's own r11 filing rather than making a new request. It states
that the r11 narrative put the fourteen-line production paragraph of the session 10 note in the wrong place, that
the paragraph had in fact been inserted before the session 8 closing paragraph, and that the lane moved the block
to the end of the session 10 note and amended its single commit before filing the correction. It declares one
commit, one changed document, four document digests, one placement re-check, four test commands, five restated
blockers, no question and a full production-change disclosure.

It is the second half of a deliberate pair and is the reason it exists: the r11 reply deferred it in writing
("the still-pending correction is a separate submission and is not reviewed by this cycle"), so this cycle closes
that deferral rather than re-opening the r11 review.

## Independent checks that reproduce

- Identity and scope: the commit `8b88821a33129083a07e770677c1e4728e8d9619` has sole parent
  `81bbfffce362a9afabde8227b160ff4abe871654`, is exactly one file, `docs/backtester-harness/CONVERSATION_NOTES.md`,
  72 insertions and 0 deletions, and touches no path outside `docs/backtester-harness/`. The worktree
  `.local/worktrees/backtester-harness` on `workers/backtester-harness-20260930` prints nothing under
  `git status --porcelain --untracked-files=all` and has no upstream configured, so nothing was pushed.
- Document bytes reproduced from the checkout, not from the envelope: notes 40,020 bytes, 516 CRLF, 0 bare LF,
  sha256 `43579b870efc0409db7a67546429ea0eb103f16f8860d1aa9fbad4a9b8e87f00` from the LF blob
  `ff836c91aee32085f51de3803f974e189cb96817` at 39,504 LF bytes; `ASSET_DATA_AND_TABS_PLAN.md` 38,402 / 491 /
  `0aa54d3e...`; `FOUNDATION_BUILD_WORK_ORDER_20261003.md` 67,367 / 776 / `5966544d...`;
  `RAIL_ACCORDION_SPEC_20261003.md` 48,642 / 707 / `f14d53cd...`. The last three are identical to the figures the
  r11 reply verified, and the notes' byte count and CRLF count are also unchanged from it, so only the digest
  moved. The envelope's "517 lines" is the same byte stream counted with its trailing empty line; the file holds
  516 line terminators, 445 of which were the pre-pass figure plus the 72 added lines.
- The correction is a pure move: `git diff 4dff3c92b4db2e836be7ecf97eeadea0a97b06f0 8b88821a...` is fourteen
  insertions and fourteen deletions in that single file and nothing else.
- The defect is real, not asserted. At the superseded head `4dff3c9` the fourteen-line production paragraph
  occupies lines 407-420 inside the session 8 span, immediately before session 8's own closing paragraph at 421,
  with the session 9 heading at 426. At `8b88821` the identical block occupies 495-508 inside session 10, whose
  heading is 446, immediately before session 10's own closing paragraph at 509, which is the last paragraph in the
  file. Every placement figure the envelope prints reproduces line by line, including session 8 heading 388 /
  closing paragraph 407 and session 9 heading 412 / closing paragraph 440.
- The amend lineage is visible rather than trusted: the branch reflog reads `81bbfff`, `5f72e56`, `4dff3c9`,
  `8b88821`, the last two steps both recorded as `commit (amend)`, which matches the envelope's account of one
  amended commit and one superseded head.
- The two declared replay artifacts exist in the lane's ignored `tmp/`: `tmp/move-session10b.js` (2,217 bytes,
  which the lane says refuses to run unless the block is exactly fourteen lines and the target is the final
  paragraph) and `tmp/probe-r11.js` (3,251 bytes, which prints the placement check), together with
  `tmp/build-submission-r11b.js` and `tmp/submission-r11b.json`.
- Production re-measured: `origin/main` is `8a976e3ef407f4da7dae101743afa6438bf11ec0` ("docs: mark the site-nav
  note's rail and page-count paragraphs superseded", `2026-10-04T12:51:41+01:00`), four commits past `4a99258`
  (`a492c51`, `ae9a1f0`, `0f222d1`, `8a976e3`), and `git diff --shortstat 4a99258 origin/main` is twenty files
  changed, 635 insertions and 31 deletions, with `backtester/partials/shared_nav.html`,
  `backtester/scripts/build_shared_nav.js`, `backtester/tests/site_nav_consistency.browser.test.js` and every
  published page in the path list.
- The focused suite was re-run here rather than read from the lane's scratch: `node --test
  tests/monitor_state.test.js tests/coordination.test.js tests/token_usage.test.js`, 15 tests, 15 pass, 0 fail,
  0 skipped. `npm test` was not run, and the lane is right not to run it, because the commit changes one markdown
  document and no source, test, data, workflow or pipeline file. The same re-run used by the r11 cycle also
  passed 15 of 15, so the figure is consistent across both cycles.

## The defect, and why the disclosure is the right shape

The r11 filing's item (2) described the session 10 note as carrying the fourteen-line production paragraph. At the
head that filing named, the paragraph sat inside the session 8 span instead - after session 8's own text and
before session 8's closing paragraph - so a reader checking the note against the filing would have found a note
that did not say what the filing said it said. Nothing load-bearing changed: the byte count, the CRLF count and
the other three documents' digests were identical before and after, and the sentence "the production paragraph now
sits in session 10 rather than session 8" is the only substance that moved.

The lane's handling is the behaviour this protocol asks for and is what is accepted here: it corrected the bytes
and disclosed the correction in its own envelope, with the superseded head named, the amended-away object
reported as never pushed, filed or named in any envelope, the replayed move left guarded in `tmp/`, and the
placement printed by a probe so a later window can re-check it without trusting the prose. The alternative -
amending quietly and leaving the r11 envelope describing a note that never existed - is the failure mode this
disclosure avoids.

## What was accepted

- **The correction itself**, reproduced from the checkout as a pure fourteen-line move with an unchanged byte
  count and unchanged figures for every other document, and with the placement at both heads verified line by
  line rather than read from the envelope.
- **The disclosure discipline**, including the statement of what the correction cost (one amended commit, one
  digest change, one envelope) and the naming of the superseded head.
- **The carried record.** The envelope re-states rather than re-derives the r11 outcome, its four decisions, its
  three questions, the register state of the seven lanes, the fifth production move to `8a976e3` and the paused
  lane. Each of those reproduces from the mailbox, the register and `origin/main` as stated, and the envelope
  does not re-file the refused seven-lane request.
- **The correctness of the pause.** The lane adds no line to any assignment, plan, spec or work order and starts
  no work, which is the right behaviour for a lane whose reply authorises nothing and whose next steps are the
  user's.

## The precise unresolved decisions

No assignment is published, because nothing here is a bounded research task the coordinator may open. The one
concrete item on the table is the offered re-base of `RAIL_ACCORDION_SPEC_20261003.md` against `origin/main` at
`8a976e3` as one docs-only commit in this lane, which the r11 reply recorded as the user's to answer; it stands as
filed, is not answered or re-asked here, and the coordinator declines to pre-empt it - it is a currency update to
a spec whose purpose is the accordion publication decision, that decision is user-only, and production has moved
five times in one day, so a re-base taken now is stale on arrival. The four decisions the r10 reply left open are
unchanged:

- (a) Who publishes the left-rail accordion from `RAIL_ACCORDION_SPEC_20261003.md`: production, cut from the
  current production rail partial or its generator and never from `index.html`, or a direct edit reverts the
  published Silver, WTI and GBP tabs.
- (b) Whether the 2026-10-04 seven-lane foundation-build authorisation is confirmed, and if so whether one shared
  assignment or seven per-lane revisions, staged or all at once. This remains blocked on a central authorisation
  record that no lane can write and no background cycle may invent; the seven paste-ready revisions stay where
  they were written, inside `FOUNDATION_BUILD_WORK_ORDER_20261003.md` sections 5.2 and 5.3.
- (c) The DeepSeek/n8n scope - new backtester-side flows only, or also the production Layer 1 model-node swap,
  which needs a credential action and a strict-JSON validation pass.
- (d) The seven lanes' still-unfiled stage-A `READINESS.md`, with the price-series gaps beside it (GBP, Silver and
  WTI none; Gold roughly three months of front backfill; USD, EUR, NQ and BTC about 2.75 years each).

## Register and carried work

The `backtester-harness` register row keeps status exactly `instructions_published_awaiting_worker`, and no other
row is altered; all seven `backtester-<asset>` rows already read the same status and are untouched. No assignment
is published, edited or re-published, so no new assignment content hash exists and no lane is woken by this cycle:
the reply is the only new event this filing produces, and it ends the lane's queue.

`docs/orchestration/projects.json` carries only the harness row's `next` update from this cycle. The canonical
checkout still carries one modified unrelated file (`tools/strategy-node/Strategy.code-workspace`) and five
untracked `backtester/` Gold session-policy files that belong to no lane of this cycle; they were inspected only
and left exactly as found, unstaged and uncommitted.

## Integration and deployment status

Nothing is integrated, merged, published or deployed by this review. The lane keeps design-only authority inside
`docs/backtester-harness/` plus ignored `tmp/`, Stage B stays closed, and the seven asset lanes stay readiness
lanes that build nothing. Layer 1 stays independent and backtesting stays downstream only; a corrected note, a
clean tree, a pure-move diff or a passing focused suite is not edge, accuracy, causal feature-timing or
live-deployment evidence, no outcome, holdout or prospective observation was read, and the sealed qualification
window stays sealed.