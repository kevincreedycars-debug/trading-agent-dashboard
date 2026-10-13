# Second checkpoint — USD session research programme (2026-10-13)

Branch `research/usd-session-20261013`, continuing from checkpoint 1 (`312c016`). Every claim is labelled
**extracted**, **researched**, **reviewed**, **implemented** or **tested**, and no performance figure in this
package came from a forecasting harness, because none exists and none was run. The frontier research, the two
reviews and the synthesis are still external work: none of it was produced here and none was simulated.

## 1. Target-independent macro work — **researched**, **implemented**, **tested**

`macro_data_inventory.md`, `backtester/lib/usdsession/macro_series.js`,
`backtester/scripts/build_macro_asof_inventory.js`, `data/research/usd-session/macro-data-inventory.json` and
`macro-asof-frame-summary.json`. Twenty-two series, each with its provider, id, units, publication schedule and
the page it was verified on, its revision note, its missingness and its as-of rule; a 725-row by 22-column frame
aligned to the 05:00 London cutoff (local evidence, hashed, not committed).

The finding that matters, measured rather than assumed: the Federal Reserve publishes **H.10** exchange rates
and the dollar indexes **on Mondays at 16:15 ET for the previous business week**, so at a 05:00 London cutoff the
H.10 family, including `DTWEXBGS` (the series the live collector stores as `dxy_level`), is **2 to 6 business
days old**, median 4. The first checkpoint and the closed study's manifest described that input as having a 1-2
business-day lag, which is the FRED refresh lag rather than the availability lag at the cutoff. No rule, sign,
threshold or candidate was defined and no forecast was scored.

## 2. The target — **researched**, decision still open

`target_source_assessment.md`. Verified from the sources themselves: the ICE U.S. Dollar Index is the exclusive
property of ICE Data Indices, LLC and any use "whether directly or indirectly" is prohibited without written
consent, while the DX futures contract's official daily settlement is a volume-weighted average of 14:59-15:00
Eastern, two hours before the 17:00 New York endpoint; the Fed's H.10 family is public domain but weekly; and the
free mirrors could not be verified at all (Stooq refused the fetch, the Nasdaq Data Link page returned 404).

Recommendation: **do not purchase yet, and do not relabel anything as DXY.** The only route that keeps the DXY
name is a licence from ICE Data Indices, with two questions answered in writing first: an exact print at both
ends, and rights to store the values and derive a label. The named fallbacks are `alt.eurusd-session-h1` (EUR/USD
from the existing hourly OANDA cache: the euro leg, not the basket, and never called DXY) and
`alt.usd6-venue-basket` (not constructible today: no EUR, CHF or SEK source). A five-question acceptance
checklist must be answered before any dataset is built, and nothing was bought.

## 3. The weight discrepancy — **extracted**, decision still open

`weight_vector_discrepancy.md`. Both vectors, their exact contents and where they live; which calculation uses
which; what the dashboard consumes; and what "both are live" means. The code's `WEIGHTS` literal in
`Calculate USD Conviction` produces the published number; the rulebook's table in `logic/agent_usd_direction.md`
v2.1 is fetched live and read by the model that writes the verdict strings the arithmetic consumes. Neither is a
shadow, and nothing reconciles them: no node, no test, no checker. Both are preserved as named baselines
(`weights.coded.24h.v154`, `weights.rulebook.v2.1`) and shown side by side per factor in the new panel. No
production weight was touched.

## 4-5. The Research Library panel and durable storage — **implemented**, **tested**

`docs/research-library/README.md` carries the full design. In short: a new Research Library entry in the
dashboard's Evidence group; eight assets with USD first; asset and factor filters; progress counts; a factor
table with separate research, review and backtest statuses plus blockers, dependencies, document version and
last-updated date; a factor detail page with brief, current rules, reports, reviews, sources and history; Copy
prompt and Download context package; Upload, View and Download actions; and a separate whole-engine section for
reviews, synthesis and experiment results.

Storage: a committed metadata registry (`data/research-library/documents.json`, immutable versions, SHA-256 per
version) plus uploaded bytes in the ignored `.local/research-library/objects/<sha256>`, readable only through a
loopback service that requires a token held outside Git. Downloads are re-hashed and compared. There is no
public upload and no public download. The smallest backend addition is stated plainly rather than simulated,
with Supabase named as the next step if uploads must work from the published page without a local process.

## 6-7. Reuse and honest progress — **implemented**

The five packages were adapted rather than rebuilt: each card group is now a task in the catalogue with its
covers, gaps, dependencies, status, context version, prompt fingerprint and required output schema, and the
context package carried to the model contains all of them. Statuses are three separate vocabularies, and the
validator refuses the dishonest combinations (accepted without uploaded, tested without accepted, blocked
without a blocker line). A changed factor report flags the dependent reviews and synthesis documents for
reassessment.

## 8. Verification — **tested**

`tests/research_library.test.js` and `tests/research_library.browser.test.js`, the catalogue validator, the
registry hash check, and `npm test` for the whole local suite. The panel was opened in a served copy of this
checkout at desktop and narrow width. **No live artefact changed**: no workflow, no dispatcher, no database, no
credential, no production scoring path; the live trading feed was read only.

## Open, in the order it bites

1. The label instrument and quote source (the user's decision; section 2).
2. Reviewer B's approval of the frozen evaluation design before any candidate is scored.
3. The frontier runs themselves: A1 and A2 are ready to paste, and both reviews and the synthesis wait on them.
4. The weight question: which vector is the project's own.
5. Consensus and first-print vintages for the highest-weight live family, or an explicit decision to drop it.
