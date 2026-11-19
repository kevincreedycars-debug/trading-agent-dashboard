# USD-L1-25F-H1 v0.1.1 · proposed corrections for review

18 November 2026 · pre-evaluation research hypothesis · research only · **not applied**

This proposal preserves `USD-L1-25F-H1-v0.1.0` byte for byte. It does not edit the committed
package, its `SHA256SUMS`, `expected.json`, `models.js`, `inputs.json` or `RULEBOOK.md`. v0.1.0
remains the frozen candidate and its fixtures still define acceptance. v0.1.1 is a separate package
for the owner to accept or reject.

## 1. What is being reconciled

The earlier handover named four candidate v0.1.1 edits:

1. ICE age (`H1R-03`)
2. VIX level-and-change (`H1R-02`)
3. F23 event distance (`H1R-04`)
4. the front-trace rename (`H1R-06`)

The independent review now reports **three behaviour-changing findings** — `H1R-02`, `H1R-03` and
`H1R-04` — and treats `H1R-06` as presentation only. It also raises `H1R-01` (the DGS2 input is a
required gate but cannot vote). `H1R-01` is a fifth, coverage-scope finding raised by the review; it
was not one of the earlier four.

This proposal therefore does not silently drop the fourth item. It classifies it correctly:
`H1R-06` is a presentation cleanup, not a behaviour change. It also does not silently apply
`H1R-01`: moving DGS2 out of the gate changes which mornings are admitted and needs its own decision.

| Finding | Review severity | v0.1.1 proposal | Behaviour change? |
|---|---|---|---|
| `H1R-03` ICE zero age | defect | latest eligible fixing with a 24 h or 96 h cap (default 96 h), receipt still by cutoff | yes, timing |
| `H1R-02` VIX level and change | gap | retitle the row as level-only; adding a VIX change is a separate option | no under the recommended option |
| `H1R-04` F23 distance | gap | record F23 as unimplemented in the rulebook table; distance stays out of the executable rule | no under the recommended option |
| `H1R-06` front trace | presentation | rename `votes.front` to `frontReportedOnly`; publish the counted vote set | no |
| `H1R-01` DGS2 cannot vote | assumption | owner decision: make DGS2 an operand of the spread rather than a ninth standalone gate | yes, coverage |
| `H1R-10` incomplete calendar | gap | rulebook sentence: a zero count from an incomplete calendar blocks, it does not mean no release | no, it makes the existing block explicit |

The `H1R-01` entry is **not applied** in this dashboard change. It is listed because the strategy
handoff proposes it and because it changes the admission set; it needs its own coverage rerun. The
`H1R-10` entry is already the executable behaviour (`schedule_complete` blocks the morning); the
proposal only makes the rulebook say so.

`H1R-02` and `H1R-04` each have a behaviour-changing option (add a tenth VIX-change input; implement
a distance field). Those options are recorded below, but neither is recommended until a registered
sign, threshold and data requirement exist. Retitling and recording an unimplemented row are
documentation corrections; they do not make a blocked morning pass.

## 2. The zero-age timing rule (`H1R-03`)

### Before (v0.1.0, unchanged)

`inputs.json` declares `ice: ["ICE", "US Dollar index spot", "previous eligible London 05:00 fixing
to current 05:00, simple return in percent", 0]`. The package engine applies the fourth field as an
inclusive maximum age in hours and requires `observed <= published <= received <= cutoff`. With a
maximum age of zero, the only passing record is one whose observation, publication and receipt are
all stamped at the cutoff instant. A live morning would need a zero-latency receipt at
`05:00:00.000`; a historical morning would need the same impossible coincidence. The supplied
fixture passes because it stamps all three clocks at the cutoff. That is why v0.1.0 cannot produce
a sealed live proof and why every historical morning is blocked even if licensed ICE fixings are
acquired.

### After (proposed v0.1.1)

- `inputs.json` ice maximum age becomes **Option A: 24 hours**, or **Option B: 96 hours** (the
  strategy handoff's default). The owner must choose; the dashboard does not apply either.
- The operand definition is made explicit: **current eligible fixing** means the latest London
  05:00 fixing that was published at or before the cutoff; **previous eligible fixing** means the
  one before it. The feature is the simple return from the previous eligible fixing to the current
  eligible fixing.
- `observed_at_utc` is the latest fixing used; `published_at_utc` is its official publication time;
  `received_at_utc` is the genuine collector receipt. Historical reconstruction requires
  `observed <= published <= cutoff` and a nullable receipt. Sealed live replay additionally
  requires `published <= received <= cutoff`.
- If the current eligible fixing was published after the cutoff, the record is blocked. If no
  eligible fixing exists within 24 hours, the record is blocked. Nothing is forward-filled,
  interpolated or moved back in time.

The receipt requirement is **not** relaxed for sealed replay. Only the age of the eligible fixing
changes. A receipt after the cutoff still fails; a publication after the cutoff still fails.

**Why 96 hours is the default, and why that is not a pass-rate relaxation.** The strategy handoff
counted the session structure: 145 complete Monday-to-Friday weeks, 579 one-day gaps and 145
three-day weekend gaps, with 145 Mondays (20% of the 725 sessions). A 24-hour cap excludes every
Monday and every post-holiday morning by construction, because the previous fixing is then more
than 24 hours old. A 96-hour cap keeps those sessions admissible while still requiring the fixing to
be published and received by the cutoff. The choice is justified by the calendar, not by a target
pass rate; the coverage count stays 0 either way until licensed fixings exist.

### Research basis

The ICE US Dollar Index is a daily London 05:00 fixing. At the 05:00 decision instant the current
fixing is normally not yet published, so a zero-age rule makes the feature unavailable by
construction. The supplied rulebook's own transform already describes a previous-to-current fixing
return, and rule 1 separates historical publication evidence from the live receipt gate. A
24-hour maximum age is the smallest window that admits the previous eligible fixing without
accepting a stale print. This is a proposed timing correction, not a measured edge.

### Verification for v0.1.1

| Case | Expected |
|---|---|
| previous fixing T-24 h, current T-1 h, published T-45 min, received T-15 min | sealed eligible under both Option A and Option B |
| previous fixing T-72 h (a Monday), current T-1 h, received T-15 min | blocked under Option A (24 h), eligible under Option B (96 h) |
| same, receipt T+1 min | sealed blocked: `unverified_receipt` |
| current fixing published T+1 h | blocked: `unclocked`; no future print is accepted |
| no fixing within the chosen cap | blocked: `stale_or_unproven` |
| historical record with no receipt, observed and published before cutoff | historical eligible; sealed blocked |

The v0.1.0 runner must still exit 0 (`node verify.js` from the v0.1.0 package) and its 16 hashes must
remain unchanged. v0.1.1 gets its own fixtures and its own archive hash; it must not overwrite the
v0.1.0 fixtures.

## 3. VIX level and change (`H1R-02`)

**Before.** Two rows name the VIX level and its change at the cutoff, but the executable gate reads
the level only. No VIX change is among the nine declared inputs.

**Recommended after.** Retitle the row as `VIX level and risk regime (level-only)` in the v0.1.1
rulebook table. The executable rule does not change. The missing change is recorded as an
unimplemented hypothesis, not silently treated as zero.

**Alternative (not recommended yet).** Add a tenth input, `vix_change_1d`, with a declared source,
one-day transform, maximum age and registered threshold, and include it in the gate. This is a
behaviour change and would increase the evidence requirement; it must not be introduced merely to
make a morning pass.

**Research basis.** The registered adjudications provide no measured sign for a VIX change. Adding
an unregistered gate would create a new hypothesis inside a correction release. Retitling keeps the
frozen arithmetic and removes a false claim.

**Verification.** A rulebook/input consistency test must fail if a row names an operand that is not
in `inputs.json`. The factor trace and all v0.1.0 fixture outputs must remain unchanged.

## 4. F23 event distance (`H1R-04`)

**Before.** Two calendar rows share one input. Only the release count in `[cutoff, endpoint)` is
executable; distance since or until an event has no field.

**Recommended after.** Record F23 as `declared, not implemented` in the v0.1.1 rulebook table. The
event gate still uses the count only. No distance value is inferred.

**Alternative (not recommended yet).** Implement a separate `days_since` / `days_until` context
field with its own source, clock and sign. That is a new feature and needs a registered hypothesis.

**Research basis.** The review found no executable representation and no measured sign for
distance. A documentation correction is honest; inventing a distance rule inside v0.1.1 is not.

**Verification.** The mapping review must report F23 as declared-not-implemented, and the calendar
count must remain the only calendar input in the trace.

## 5. Front trace (`H1R-06`)

**Before.** `votes.front` is published even though `frontCounted` is false. A reader adding the
trace's votes double counts the US leg.

**After.** Rename the field to `frontReportedOnly` and publish the counted vote set beside it. This
is presentation only; no decision, gate or threshold changes.

**Verification.** The fixture trace must contain the same arithmetic under the new names, and a test
must assert that the sum of counted votes excludes `frontReportedOnly`.

## 6. DGS2 as a standalone gate (`H1R-01`, owner decision)

**Before.** DGS2 is a required input that cannot vote. A morning can be blocked by an input that
cannot change the call.

**Proposed.** Make DGS2 an operand of the spread rather than a ninth standalone gate. This changes
which mornings are admitted.

**Status.** The strategy handoff records this as `P-02`; this dashboard does not apply it. It is a
coverage decision, not a timing correction, and it needs its own coverage run. Until the owner
decides, the H1 audit keeps nine inputs and DGS2 keeps its standalone rung.

## 7. Incomplete calendar (`H1R-10`, rulebook wording)

**Before.** The event gate counts releases in `[cutoff, endpoint)`. Four of the five required release
families are absent from the staged calendar, so a zero count cannot mean "no release".

**Proposed.** Add one sentence to the rulebook: a zero count computed from an incomplete calendar is
not evidence that no release occurred; it blocks the morning.

**Status.** This is already the executable behaviour (`calendar.schedule_complete` is false on all
725 mornings and the calendar is a blocker). The proposal makes the block explicit in the rulebook
instead of leaving it as an accident of a missing file.

## 8. What v0.1.1 does not do

- It does not change any threshold, sign, family weight, conviction band or trade rule.
- It does not add a fallback for a missing, stale, unclocked or substituted input.
- It does not accept a publication or receipt after the cutoff.
- It does not make a blocked morning count as a direction, trade or scored outcome.
- It does not overwrite v0.1.0, its fixtures, its hashes or its review record.
- It does not claim that any historical morning is eligible until original operands and clocks are
  imported.

## 9. Verification commands for the review

```text
cd backtester/packages/USD-L1-25F-H1-v0.1.0
node verify.js                                  # v0.1.0 unchanged: exit 0

node --test tests/h1_evidence.test.js           # historical vs sealed gate
node scripts/import_h1_evidence.js --check      # imported evidence, if any
node scripts/build_backtesting_screen.js        # rebuild the published payload
node scripts/build_backtesting_screen.js --check
node --test tests/backtesting_screen.test.js tests/layer1_morning_run.test.js
```

## 10. Provenance

The strategy handoff is preserved in this repository:

- `docs/strategy/V0_1_1_PROPOSALS_20261118.md` — the six-entry proposal set (`P-01`…`P-06`).
- `docs/strategy/proposals/H1_V0_1_1_PROPOSALS_20261118.json` — machine-readable mirror.
- `docs/strategy/proposals/H1_ICE_TIMING_20261118.js` and `.test.js` — executable timing spec and
  13 tests; run `node --test docs/strategy/proposals/H1_ICE_TIMING_20261118.test.js`.
- `docs/strategy/BACKTEST_AUDIT.md` and `docs/strategy/BACKTEST_HANDOFF_FOR_COORDINATOR.md` — the
  legacy audit and its handoff, brought in as labelled evidence.
- `docs/strategy/STATUS_H1_20261118.md` — the strategy lane's status snapshot. It is advisory and
  records the state at `64a96163`; this proposal supersedes its v0.1.1 section where the two differ.

The six-entry set adds `P-02` (DGS2 as a spread operand) and `P-06` (incomplete-calendar wording) to
the earlier four. Neither is applied to the frozen package. `P-02` is listed as an owner decision;
`P-06` is already the executable behaviour and remains a rulebook wording correction.


## 11. Addendum · `H1-A01`, the `ice` **source** amendment (applied 2026-11-18)

This proposal set is unchanged. A separate, owner-accepted amendment is now applied beside it, and the
two must not be confused:

| | `H1-A01` (applied) | `H1R-03` (still proposed) |
|---|---|---|
| What changes | the **source** of `ice`: licensed ICE fixing → archived `DXY.cash` hourly tape | the **age** rule: zero-age → latest eligible fixing within 24 h or 96 h |
| Why | the owner decided no ICE licence is required, and the tape is already held and verified | a zero-age window is unreachable for an official fixing print |
| Effect on this amendment | none: the amended observation is stamped at the cutoff by construction, so age stays exactly zero | still open; it would only matter if a future source prints after the cutoff |

Applied by `lib/layer1_backtesting/h1_source_amendments.js`; documented in `AMENDMENT_ICE_SOURCE.md`;
imported as `data/usd-layer1-backtester/h1-v1/ice.json` (455 records, 455 of 725 mornings, historical
reconstruction lane only). `USD-L1-25F-H1-v0.1.0` is untouched and `node verify.js` still exits 0.

Nothing else in this proposal is applied. `H1R-01`, `H1R-02`, `H1R-04` and `H1R-06` keep the status
recorded above.

