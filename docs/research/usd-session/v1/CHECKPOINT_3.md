# Third checkpoint — the session-horizon correction (2026-10-14)

Branch `research/usd-session-20261013`, continuing from checkpoint 2. This checkpoint records one correction and
everything it touched. Nothing was deployed, published, activated, merged or sent, and no forecast was scored.

## 1. What changed — **corrected**

The session target is now **05:00 `Europe/London` → 05:00 `Europe/London` on the next local date**: one 24-hour
session. The earlier statement — 05:00 London → 17:00 `America/New_York` on the same local date, "17 nominal
hours, 16 in the mismatch weeks" — is **withdrawn**. `America/New_York` is no longer part of the session
definition; it is kept only where the timing of the Federal Reserve's H.10 release is described.

Everything below was re-derived from the corrected definition rather than assumed:

- Both ends are wall-clock times in **one** zone, so no US or EU changeover date can move the window. A fixed
  hour count is never used to build it.
- A session starts at 05:00 London on a **Monday-to-Friday local date only**. The London spring transition (01:00Z
  on the last Sunday of March) and the autumn transition (01:00Z on the last Sunday of October) both fall inside
  the session that starts on the preceding **Saturday**, so that start measures 23 hours in spring and 25 in
  autumn and is not a session. Every eligible session is therefore exactly 24 hours; held by test over every
  Monday-to-Friday start from 2023 to 2027.
- The Friday session contains Friday's US close and ends on Saturday morning. That is the intended behaviour,
  not a defect.

## 2. Where the correction lives — **implemented**

- `backtester/lib/usd_session_engine_interface.js`: `SESSION_CONTRACT` at 05:00/05:00 London,
  `endpoint_day_offset: 1`, `nominal_hours: 24`, `session_start_weekdays: [1, 2, 3, 4, 5]`, a new
  `isSessionStart`, engine version `usd-session-engine-interface-v2`. `resolveSession` resolves both ends from
  the declared London transitions and is the resolver every measurement below uses.
- `docs/research/usd-session/v1/session_contract_v1.json`: the endpoint block, the endpoint UTC rule, the
  eligible-start rule, the flat-band note, the deployed-engine comparison and a `horizon_correction_note`. It
  also gains `horizon_id: london-0500-to-london-0500-next-day`, the same identifier the card schema fixes.
- `docs/research/usd-session/v1/research-card.schema.json` at **v2**: `session_horizon` and
  `calendar_and_quote_handling` are now required, so a card written against the superseded window cannot
  validate. `research-cards/_template.usd-session-card.json` follows the v2 shape.
- `research_card_schema.md`, `README.md`, `CHECKPOINT_1.md` (§2, §6, §8), `CHECKPOINT_2.md` (§2),
  `implementation_plan.md` (§4), `exposed_periods.md` (§4, §5), `inventory.md` (§7),
  `target_source_assessment.md` (the target statement, the ICE row, the `alt.eurusd-session-h1` fallback and the
  acceptance checklist) and the five assignment packages A1–A5.

## 3. What the correction does to the closed 24-hour study — **extracted**, then **measured**

The study's own manifest (`data/usd-24h-dataset-manifest.json`) declares `call_time_et` 09:30, an outcome entry
of "09:30 ET on the snapshot date" and an endpoint of "16:00 ET close of the next valid trading session" with a
declared delayed-endpoint fallback of up to 3 calendar days. That question did not change, and the study's
numbers stand as the answer to that question alone. Measured with `resolveSession` on the study's own 583
evaluable rows:

| Quantity | Result on the 583 rows |
| --- | --- |
| Session length on each row's start date | exactly 24 hours on all 583 rows (every start date is a weekday) |
| Overlap of the study's interval with the session | 14.5 hours on 528 rows; 15.5 hours on 55 rows |
| Which 55 rows | the weeks when New York changes before London (New York already on EDT while London is still on GMT) |
| Part of the session the study never covers | the first 9.5 hours (8.5 on those 55 rows): New York time 00:00 to 09:30 |
| Study interval beyond the session's endpoint | median 16 hours, minimum 15, maximum 88 on the 24 rows whose endpoint was delayed |
| The "about 7 nominal hours" overlap in checkpoint 1 | **withdrawn**: it was 17 hours minus the 9.5-hour gap from 05:00 London to the 09:30 ET snapshot, and the endpoint is no longer 17:00 New York |

Consequence for every future table: the deployed engine's stored calls may be scored on the new label only as a
diagnostic arm, with this mismatch stated in the table. It was asked 09:30 ET → the next 16:00 ET close, about
30.5 hours at the median, and was never asked to forecast from 05:00 London.

## 4. Verification — **tested**

- `npm run test:usd-session`: 33 assertions, 0 failures — 18 for the engine interface (both London instants, the
  excluded Saturday starts, the 24-hour sweep over every eligible start, the look-ahead refusal), 8 for the card
  schema, 7 for the write-path guard.
- Full `npm test`: 560 tests, 558 pass. The only two failures are the known terminal-width
  `backtester/tests/secret_scanner.test.js` cases, which a clean commit reproduces; nothing new fails.
- Two existing checks had to follow the correction rather than be excused from it. The registry now holds 16
  repo-backed documents, so `tests/research_library.test.js` counts 16 instead of 15, and
  `tests/research_library.browser.test.js` compares the downloaded bytes with the **latest** registered version
  instead of version 1, which is what the registry means by "latest" once a file has been corrected in place.
  Both pass: 17 of 17 and 1 of 1.
- `node scripts/build_research_library.js catalog --write`, then `registry --write`, then `verify`: catalog ok,
  registry ok, repo hashes ok. The correction changed the bytes of registered documents, so their new SHA-256
  values are registered as new versions beside the immutable first ones.
- No production, workflow, dashboard, dispatcher, database or configuration file was touched, and the untracked
  Gold session-horizon-policy work in the working tree was left alone.

## 5. What this checkpoint does not do

- The frontier research, the two reviews and the synthesis have still not been run: none of A1–A5 has been sent
  to a model. If they are run now they carry the corrected horizon and the v2 card schema, which is the point of
  raising the schema version.
- Still open, unchanged in substance: the label instrument and quote source (whether a licensed DXY can print at
  both 05:00 London instants), Reviewer B's approval of the frozen evaluation design, and consensus and
  first-print vintages.
- No dataset for the new label exists, so its overlap rate, flat share, autocorrelation or factor relations have
  not been read. The label stays untouched until the first exploratory table is printed, and that look must then
  be recorded in `exposed_periods.md` as a cost.
- Nothing here is a performance claim. A corrected horizon is not evidence of an edge, and no replay, export or
  passing test in this repository is proof of live deployment.

- `scripts/build_research_library.js`: the session objective, the task headers, the card field lists, the schema
  identifier and the registered note for the contract file now say 24 hours and `usd-session-research-card-v2`.
