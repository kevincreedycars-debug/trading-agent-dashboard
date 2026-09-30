# Publish request: the work-in-progress gold factor page, live now

Prepared 2026-09-30 by worker `strategy` (`strategy-advisory-001`), at the user's own instruction: *"I want to see
this work on the dashboard so I can confirm we are going in the right direction please put it live even thjough we
are editing it."* The user asked for the link earlier the same day; that request is answered by this page rather
than by another link, because the work itself has to be visible while it is still being written.

## 1. What is asked for

1. **One file published:** this worker's `docs/strategy/WORK_IN_PROGRESS_GOLD_FACTOR_TABLES.html`, copied
   **unchanged** to the live page location. Suggested lane id `dashboard-gold-factor-wip-page-001`.
2. **One nav entry in the top bar**, labelled so the draft status is visible from the label itself (for example "Gold
   factor work in progress (draft)"). The user asked to *see* it, so it must not sit behind a deep link or extra
   clicks; if the top bar has no room, the nearest research submenu is acceptable, but the request should say so first.
3. **The draft banner and the as-of line stay as written.** They are the page's own honesty mechanism: they say it is
   a draft, how many answers are in, and that nothing on it is a result. Do not relabel or remove them.
4. **Refresh as the work moves.** Rewrite the live copy from this worker's file whenever a batch of answers lands or a
   measurement lane is accepted, updating the answered count and the as-of date in the same edit.

## 2. Why it is safe to publish while the work is unfinished

- The file is **fully self-contained**: no `<script>`, no fetch, no stylesheet link, no image, no external font, no
  network call of any kind. It renders from a static host with nothing else present, and it carries its own minimal
  CSS by design.
- It contains **no credential**, no path into a live system or broker, nothing outside the already-spent archive, and
  no value from any window.
- It **claims nothing** the deliverables do not claim: the user has ruled out a forecast, a holdout and any trading
  result (answers 37, 38 and 40), and each of those is stated as a limitation on the page itself.
- No lane is blocked by publishing it: lanes 1 and 2 (measurement, then the factor page) keep the order they already
  have, and this draft is explicitly not the finished factor table.

## 3. What the page may say, and what it may never say

May: where the question round stands; what has been decided, each with the answer number it came from; the base rates
already measured on the spent archive; what comes next; what the page is not.
May never: a prediction or forecast; a holdout, a sealed window or "when the window opens"; a trading result, spread,
slippage, a cost-adjusted figure, profit and loss, an entry, a stop or a target; a signal or a recommendation; a
ranked winner.

## 4. Single writer

The dashboard lane owns the live copy and the nav entry. This worker keeps editing only its own file inside
`docs/strategy/` and never touches the live copy, the nav or the site's shared stylesheet.

## 5. What this worker already checked, so the lane need not re-derive it

- Line endings are CRLF throughout, with no bare LF.
- No `http://`, `https://`, `<script`, `src=`, `@import`, `url(` or stylesheet `<link>` appears anywhere in the file.
- Every element tag used is balanced, and the file opens and closes as one document.
- Every figure on the page appears in `docs/strategy/INTENT_QUESTIONS_ANSWER_SHEET_20260929.md` (section "Gold L2L
  facts" and the batch sections) or in the plan. **No number was produced for the page**, so the page cannot carry a
  figure the deliverables do not.

## 6. If the coordinator prefers a smaller first step

Publish the file behind the single nav entry and change nothing else: no site CSS edits, no shared script edits, no
changes to `index.html` beyond the one link.

## 7. Hand-over now, and how later changes are reported

The user's instruction on 2026-09-30, after being told that publication is the coordinator's action rather than this
worker's: *"send updates to the orchestrator when we make further changes but for now we should have enough to send to
it to put on the live dashboard."* That is two standing rules for this lane.

**Rule 1 - hand over the copy that exists now, without waiting for the work to finish.** The copy offered is the one in
this checkout at the moment of the hand-over, identified so the lane cannot publish a different file by accident:

| Item | Value |
| --- | --- |
| File | `docs/strategy/WORK_IN_PROGRESS_GOLD_FACTOR_TABLES.html` |
| Size and shape | **24,687 bytes, 289 CRLF lines, no bare LF** |
| sha256 | `aa9e104c81b6e479ca59b05b9b31840877b4626624e54c5a0170dc202a98dd1e` |
| Readable from | `D:/trading-agent-dashboard-codex/.local/worktrees/strategy/docs/strategy/WORK_IN_PROGRESS_GOLD_FACTOR_TABLES.html` |
| Committed on | branch `workers/strategy-advisory-20260920` in this worker's worktree |

Copy that file byte for byte. If the copied file hashes differently, the copy is wrong rather than the page being out of
date, so re-copy it from the path above. Nothing else about the page is required: it is one document that renders
as it stands.

**Hand-over history.** Revision 2 is the copy in the table above; revision 1 is the copy first offered for publication.

| Revision | Answered when handed over | Size and shape | sha256 |
| --- | --- | --- | --- |
| 1 | 40 of 50 | 21,541 bytes, 261 CRLF lines, no bare LF | `675fc9da41529817c112c0f287db8daa6c29fb2269231c9bde0958dc268ecd0b` |
| 2 (this one) | **50 of 50 - the round is closed** | **24,687 bytes, 289 CRLF lines, no bare LF** | `aa9e104c81b6e479ca59b05b9b31840877b4626624e54c5a0170dc202a98dd1e` |

**What changed in revision 2.** The last ten questions came back, so the answered count moved from 40 of 50 to
**50 of 50** and the round is closed. On the page: the banner, the progress bar (now full) and the "where the questions
stand" card were rewritten from "ten still open" into what each of 41-50 settles; two decided rows were added to "what
is already settled" (the next-open count; the full page beside the accuracy panel); "what comes next" now says each
state is measured twice, once before the session and once during it, in two blocks that are never pooled; and the footer
now names questions 36-50. The checks in section 5 were re-run on the revision-2 bytes and the tag counts still balance.
**No number anywhere on the page moved**, no table was added or removed, and the page is still a draft: the one point
still open (how the during-session stream is timed) is printed on the page as open and awaiting the user, not answered
by this worker.

**Rule 2 - report every later change as it happens, not in a bundle.** Each time a batch of answers lands or a
measurement lane is accepted, this worker does three things in the same turn: rewrites its own file, updates this request
with the new answered count, as-of date and hash, and files a short note to the coordinator carrying the new hash and
what changed on the page. No change is to reach the live copy silently, and no live copy is to be refreshed by this
worker - both directions stay with one writer each.

**Cadence.** Refresh on each batch of answers rather than waiting for the whole question set to close; the user asked to
see the work while it is still being written, so a stale live copy defeats the request. The user has not contradicted
this default.

**Priority note for the lane.** The user has now asked for the page to be visible three times in two days, the last time
in the form of the instruction quoted above. If the lane can publish only one item from this worker, publish this one.
