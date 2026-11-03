2026-11-03 - the VIX chain reverted to the registry's status about a minute after it was opened.

## What the screen showed

Opening `usd-factor-live-f1-vix-level` read all three stages from the private store, pill `UPLOADED`, with
results `d7b8eb40-ce08-48c3-9d2c-5bf94b7618bc`, `5d51a6ac-669d-4c7a-9244-8605508553e9` and
`60494b47-b2e7-448c-86f4-7aeaae625d04`. Within a minute, without a reload and without any action by the
reader, the same three cards read:

- stage 1 Research: document `usd-baseline-audit-01-vix-usd-report` - the committed register's id for the
  same file, whose record carries no uploaded status;
- stage 2 Red-Team: `awaiting_upload`;
- stage 3 Adjudication: `not_started`.

The store never changed. Nothing was uploaded, deleted or edited while this happened.

## Root cause

`loadDashboard()` assigned the page's registry copy wholesale:

```js
researchLibraryDocuments = researchLibraryDocumentsResult.value;
```

`loadDashboard` runs at page load and again every 60 seconds, and the value it assigns is
`data/research-library/documents.json` - the committed register, which by design never carries a row from
the private store. Every stage state on the page is derived from the documents list, so replacing the list
with the register's copy removed the store's rows from view and each stage fell back to the register's
record or to `awaiting_upload` / `not_started`.

The store's rows were also being written *into* that same object (upload registration, remember-on-read),
so the reload did not merely hide them for a moment: it discarded them, and the panel only recovered when
a later store read happened to land. That is why the reversion looked intermittent - it depended on where
the 60-second tick fell relative to the reader's last action.

A second, smaller fault sat under it: nothing ordered the page's reads. A slow registry read, an upload's
follow-up read and a background load could settle in any order, and the last one to settle wrote its
answer regardless of which read had been taken last.

## Fix

`lib/research_library.js`

- `mergeDocumentRecords` folds the records naming one document into one: the record naming the newer
  version wins, a field the winner leaves blank is filled from the older record rather than blanked, and
  every version either side names is kept, so a legacy registry record stays as history and nothing is
  dropped.
- `mergeDocumentLayers(...layers)` folds layers of records, the rightmost layer having the last word on a
  document it names.

`script.js`

- The store's rows live in `hostedDocuments`, apart from the registry copy, so no registry read can remove
  them; `hostedDocumentReads` / `hostedReads` keep each row with the read that returned it.
- `researchLibraryApplyDocuments` is the single writer of the registry copy. Each read takes the next
  number from `documentsReadSeq` and only a read at least as new as `documentsAppliedSeq` may write, so a
  read that settles late cannot replace a newer answer.
- `researchLibraryLayerHostedDocuments` layers the store's rows back over the registry copy on every write,
  including the one `loadDashboard` performs, which is the specific line that used to revert a chain.
- `index.html` cache-busters for `script.js` and `lib/research_library.js` moved to
  `20261103-stored-chain-v1`.

## Guards

| Suite | Result |
| --- | --- |
| `tests/research_library.test.js` (3 new tests) | 39/39 pass |
| `tests/research_library.browser.test.js` (new reversion scenario) | pass |
| `npm run test:research-library` (library, browser, export) | 46/46 pass |
| the same, plus the live-trading lamp test, after the rebase | 51/51 pass |

The browser scenario asserts the stored ids survive `loadDashboard()`, a second background load, navigation
to another asset and back, and a page reload, and that stage 3 still offers both parent downloads. Run
against the previous `script.js` it fails at "a background load must not revert any of the three stages";
run against this one it passes.

## Commits and deployment

| Item | Value |
| --- | --- |
| Fix, tests, cache-busters | `f2951330` |
| Published `script.js` | sha256 `0a483e16a636…`, 1,040,428 bytes |
| Published `lib/research_library.js` | sha256 `627c903bebdb…`, 77,062 bytes |
| Published `index.html` | sha256 `56d87bba201e…`, 29,856 bytes |

All three published assets were re-downloaded byte for byte and match the commit's blobs.

## Live verification (published page, read-only)

The same scripted check was run on the published page before and after the deploy, opening the chain and
then calling the function the 60-second timer calls. Before: 3 of 4 checks failed - stage 1 had fallen back
to `usd-baseline-audit-01-vix-usd-report`, stage 2 read `awaiting_upload`, stage 3 `not_started`. After:
4 of 4 passed - all three stages read `delivered` with the same stored ids across the background load, and
stage 3 still offers both parent documents plus its own return. Sitting on the page for 80 seconds with the
dashboard's own timer running - a real tick, not a hand-run call - still read `delivered` with the same
three ids.

The pre-deploy run is the reproduction: it is the reported symptom, caught with the same three ids the
reader saw before the panel changed under them.

## What did not change

Both uploaded documents and the adjudication keep their bytes, ids, versions and hashes; no row was edited,
added or removed; nothing was re-run. No factor status, weight, threshold, prompt, chain association or live
call moved, and the register is still the committed file - the store's rows are layered over it in the page
only, never written back into it.
