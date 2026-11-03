2026-11-03 - the VIX red-team read "Stale: an input changed" although its parent had not moved.

## What the screen showed

Stage 2 of `usd-factor-live-f1-vix-level` (Red-Team), pill `Stale: an input changed`, result
`5d51a6ac-669d-4c7a-9244-8605508553e9` v1 `fa7e5f43602d`, parent input `d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc`
v1 `e4151937411e`. The stage 1 row it named was the report that had been registered all along.

## Root cause

Two separate faults stacked on each other. The store was right both times; the page's reading of it was not.

1. **The recorded parent name was a registry id, not a store row id.** The stage 2 row carries
   `parent_research_ref` = `usd-baseline-audit-01-vix-usd-report`, which is the committed register's id for
   the VIX research report, not the hosted row id `d7b8eb40-…`. The bytes are identical (84,056, sha256
   `e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d`), so the red-team judged the current
   report; only its *name* for the report was the other of the two ids the library holds for that file. The
   page filled the reference from whichever document the stage 1 card resolved to at upload time
   (`script.js`, `parents.researchRef`), and the committed register carries the same report under its own id.
2. **A missing parent version was read as version zero.** `lib/research_library.js` `chainStageState` did
   `Number.isFinite(Number(document.parent_version)) ? Number(document.parent_version) : null`. `rowsToDocuments`
   only matches a parent name against hosted rows (`parentVersion(rows, id)`), so a name the store did not carry
   returned null — and `Number(null)` is `0`, which is finite. The stage was then compared as `0 < 1` and
   flagged `stale_parent_version`. The stale flag was invented by a field that was absent, not by anything that
   had changed. The same conversion made the card print "Judged … v?" as `v0`.

Nothing was wrong with the uploaded documents, their versions or their hashes.

## Fix

`lib/research_library.js`

- `numberOrNull` keeps an absent version absent; nothing becomes version 0.
- The parent name is resolved through the whole register (`documentsById`), so a registry id and the stored row
  holding the same file are both readable.
- Freshness is decided by fingerprint when both sides record one (`parent_sha256` against the parent's current
  bytes), by recorded version when no fingerprint exists, and otherwise is unknown — never stale. A stage that
  judged identical bytes under another name, or under another version label, reads current.
- `parent_unresolved` reports a parent name the register does not carry without calling the stage stale.
- `reviewed_version` / `reviewed_sha256` now report what the stage judged, falling back to the resolved record,
  so the card shows `usd-baseline-audit-01-vix-usd-report v1 sha256 e4151937…` instead of `v0`.

`script.js`

- `researchLibraryHostedRef` translates a parent reference to the stored row holding the same bytes, so future
  uploads record a row id the store itself carries.
- A later factor stage now offers every earlier return for download (the adjudication prompt asks for the
  research report and the red-team review together); the existing `Download inputs` button and every other
  label are unchanged.
- `index.html` cache-busters for `script.js` and `lib/research_library.js` moved to `20261103-stale-parent-v1`.

## Commits and deployment

| Item | Value |
| --- | --- |
| Library fix + test | `253d4f45` |
| Page fix + cache-busters | `31ca320c` |
| Published `lib/research_library.js` | sha256 `534a11eafd8e…`, 73,902 bytes, identical to the commit |
| Published `script.js` | sha256 `7980fb2b0677…`, 1,029,670 bytes, identical to the commit |

## Live verification (published page, clean browser)

14 of 14 checks passed: published assets identical to the commit; page asks for the new cache-busters; stage 1
document `d7b8eb40-…` v1 sha256 `e4151937411e`; red-team reads `UPLOADED` with no "has to run again" note;
result `5d51a6ac-…` v1 `fa7e5f43602d`; adjudication `AWAITING UPLOAD` and offering both documents; research
report downloaded 84,056 bytes `e4151937411e`; red-team review downloaded 55,367 bytes `fa7e5f43602d`; the same
reading survived a reload. The three 404s in the console are pre-existing and unrelated
(`data/half-l2l-reach-research.json`, `/api/l2l-levels`, `data/live-trading-trader.ftmo-2.json`).

## What did not change

Both uploaded documents keep their bytes, ids, versions and hashes; no row was edited, added or removed; the
research and the red-team were not rerun; no factor status, weight, threshold, prompt, chain association or
live call moved. The register's Research/Review/Backtest columns are still the hard-coded `pending` values the
committed builder writes, so the chain card reading 2 of 3 is the store's record, not a status approval.
