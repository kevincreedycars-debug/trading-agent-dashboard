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
