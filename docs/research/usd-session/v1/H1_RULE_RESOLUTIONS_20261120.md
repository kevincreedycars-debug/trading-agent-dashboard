# H1 rule resolutions and the owner decision packet — 2026-11-20

Research only. This note answers the six proposals the strategy agent filed on 2026-11-18, states what is
still an owner decision, records the exact contract version the published coverage is evaluated under, and
names the first morning that would become eligible once the two missing inputs exist. Nothing here applies a
candidate rule to a scored result: the coverage gate keeps the supplied rules, and every count below is
measured, not projected.

## 1. Where the lane stands

| Input | eligible mornings | state |
| --- | --- | --- |
| `vix` | 725 of 725 | verified original, Cboe close |
| `front` | 725 of 725 | verified original, H.15 DGS2 — present and never read by a family (see P-02) |
| `spread` | 697 of 725 | verified original, H.15 DGS2 minus Bundesbank Svensson 2.0-year on the strict T+1 bound |
| `real` | 725 of 725 | amended source, Treasury real yield curve under H1-A02 (pending) |
| `broad` | 564 of 725 | verified original, H.10 DTWEXBGS on the supplied 192-hour observation-age window |
| `ice` | 455 of 725 | amended source, DXY.cash broker CFD under H1-A01 (accepted) |
| `gold` | 0 of 725 | identity mismatch: the legacy field is a broker XAU/USD quote, the contract asks for LBMA Gold Price PM |
| `qqq` | 725 of 725 | verified original, Nasdaq official close |
| `calendar` | 0 of 725 | incomplete: no release schedule archived with the instant it became public (D6) |

**Ready mornings: 0 of 725. `earliest_eligible`: `null`. Sealed replay: 0 of 725** (no receipts exist, as
expected for historical reconstruction).

336 of the 725 mornings are blocked by `gold` and `calendar` and by nothing else. The first of them is
**2024-12-12**, which is also the first morning on which the H1-A01 tape has a completed 05:00 bar. If both
missing inputs arrive with evidence that satisfies the gate as written, 2024-12-12 is the first valid H1
decision morning available to this project, and the last of the 336 is 2026-10-09.

## 2. The six proposals

Each proposal is answered on its evidence, not on convenience. "Accept" means the wording becomes the
project's stated position in this note and, where it is a code or data change, in the files named; it does
**not** mean a threshold moved, because none of these changes a scored count.

| Proposal | Answer | Why | Effect on counts |
| --- | --- | --- | --- |
| **P-01** ICE 05:00 timing: receive by the cutoff, not at it | **Superseded for the model input; accepted as the sealed-lane rule** | H1-A01 replaced the ICE fixing with the DXY.cash tape for the historical lane, and that bar completes at the cutoff, so the `observed <= published <= received <= cutoff` collapse no longer describes the input being used. The principle P-01 defends — a fixing received at or before the cutoff, no older than 96 hours, two distinct fixings — is exactly what the live DXY.cash collector must prove, and it is recorded as the `acquisition` step on the amended `ice` contract. | 0: `ice` stays at 455, set by the tape start, not by the reception rule |
| **P-02** The front-end change is a spread operand, not a ninth gate | **Finding accepted, count change deferred** | `front` is imported, verified and eligible on all 725 mornings, and no family reads it; the spread row is the only consumer of a 2-year yield. The count stays at nine rows because the published payload, the fixtures and the rulebook all say nine, and a silent 9-to-8 change would break the comparison with v0.1.0. The payload now says it out loud instead: `coverage.contract_check.not_read_by_any_family = ["front"]`. | 0 now; a v0.2 change would report eight inputs plus one named operand |
| **P-03** The VIX row measured the level only | **Accepted as wording** | The executable reads the VIX level and nothing else; the row text implied a change feature that has no executable representation. The retitle belongs to the package text, which is preserved by digest (`USD-L1-25F-H1-v0.1.0`, archive sha256 `1c82e904…72e0`), so the retitle is scheduled with the v0.1.1 package patch rather than patched in place. | 0: fixtures and counts unchanged |
| **P-04** F23 calendar distance is declared but not implemented | **Accepted: recorded as declared-only** | There is no executable distance feature, and with `calendar` at 0 of 725 the F23 row cannot contribute to any morning in this window. Implementing it before the calendar evidence exists would create an untestable code path. | 0 |
| **P-05** The trace's front vote is reported-only | **Accepted in principle, deferred to the package patch** | `frontCounted:false` beside `votes.front` is a double-count trap for a reader, and `lib/layer1_backtesting/h1_review.js` already files it as H1R-06. The trace is produced inside the preserved package (`backtester/packages/USD-L1-25F-H1-v0.1.0/models.js`), so renaming the field is a package revision, not a coverage change. | 0 |
| **P-06** A zero event count from an incomplete calendar is not evidence | **Accepted** | This is already the gate's behaviour: `calendar` reports `incomplete_calendar` and blocks the morning instead of reporting "no release", so no morning can be scored with a fabricated zero. The sentence is now part of the stated position and the calendar row keeps blocking every morning until a schedule is imported. | 0: 725 blocked before and after |

Three of the six are therefore live: P-01's principle in the sealed lane, P-02's finding in the published
payload, and P-06's behaviour. P-03, P-04 and P-05 are accepted as positions but land with the package
revision, because the v0.1.0 package is preserved byte for byte and cannot be edited in place.

## 3. The contract the coverage is evaluated under

| Layer | Version | Status | Where it is published |
| --- | --- | --- | --- |
| Supplied rules | `USD-L1-25F-H1-v0.1.0` | preserved, archive sha256 `1c82e9048a3cf2237ffea6873b8099389d09fccefa083cd38ccb87517e3672e0` | `h1.package`, `coverage.binding.package_archive_sha256` |
| H1-A01 ICE identity | `v0.1.1` | **accepted by owner 2026-11-18** | `contract_check.amended_versions`, `source_amendments` |
| H1-A02 real-yield publisher | `v0.1.2` | **proposed, pending owner** | `contract_check.pending_amendments = ["H1-A02"]` |

`coverage.binding.model_version` stays `USD-L1-25F-H1-v0.1.0` because the supplied model did not change.
The evaluated contract is stated separately and exactly:

```
USD-L1-25F-H1-v0.1.0 supplied rules
+ H1-A01 v0.1.1 (accepted by owner 2026-11-18)
+ H1-A02 v0.1.2 (proposed, pending owner)
```

The honest consequence of applying a pending amendment: `real` is eligible on 725 mornings only because
H1-A02 records the Treasury as the publisher of record. The supplied text names "Federal Reserve H.15",
which has never carried a real-yield column; without the amendment the imported records fail the identity
rung and `real` drops to 0 of 725, which would remove the last non-gold blocking reason. The amendment is
disclosed as pending on every input row (`amended.status`) rather than being presented as settled.

## 4. The owner decision packet

Six decisions. Each one names the recommendation, the measurement behind it, and what refusal costs.

| # | Decision | Recommendation | Measured basis | Cost of refusal / delay |
| --- | --- | --- | --- | --- |
| **D1** | `broad` freshness: measure the H.10 release clock instead of the observation date (H1-C01) | **Adopt as a measured variant** | 564 → 725 fresh, 161 gained (145 Mondays, 16 post-holiday Tuesdays), 0 lost; the release is the newest available on all 725 mornings; publication age max 175.75 h against a 192 h window | 161 mornings stay blocked although the newest release is in hand |
| **D2** | `calendar` freshness: applicability instead of a 24-hour decay (H1-C02) | **Adopt the wording; import evidence next** | Unmeasurable today: no release schedule has been archived with its publication stamp, so the candidate ships `measurable: false` and no gain is claimed | Adopting it alone unblocks nothing; the missing input is the schedule, not the rule |
| **D3** | Bundesbank publication clock: strict T+1 23:59 Europe/Berlin, or same-day on a captured stamp (H1-C03) | **Keep the strict bound** | Two observed BBSIS stamps are same-day (2026-11-19 12:22:17 and 2026-11-20 12:29:01), but neither is a 2024 stamp; the bound costs 28 mornings (worst age 151 h) and is later than every refresh it was checked against | Same-day relaxation could return at most 28 mornings and would rest on an unproven 2024 pattern |
| **D4** | H1-A02: Treasury as publisher of record for the real yield | **Accept** | 540 of 541 clean-week mornings identical within 0.005 bp; 12 of 120 windows spanning a Treasury non-publication day identical, max 13 bp, mean 3.67 bp; the difference is the legacy holiday fill, not the instrument | `real` reverts to 0 of 725 and the amendment stays pending in the payload |
| **D5** | `gold` access | **Decide between buying an IBA licence and accepting `gold` stays absent** | The LBMA prices page read on 2026-11-20 states that historical benchmark data moved to MyLBMA and that "A licence from IBA is required in order to obtain, use or redistribute real-time or historical benchmark data"; the price host answered 403 on every attempt from this environment | `gold` blocks all 725 mornings; no substitute passes the identity rung, and OANDA XAU/USD is not the contract's instrument |
| **D6** | `calendar` evidence | **Import the five release schedules as they stood before each cutoff — a calendar capture, not a value vintage** | Required types: CPI, Employment Situation, advance GDP, Personal Income and Outlays, FOMC policy decision. The schedules are readable; none has been archived with the instant it became public, which is the one property the gate reads besides the date and time themselves | `calendar` blocks all 725 mornings; a zero event count is not evidence (P-06) |

D5 and D6 are the only decisions that can move ready mornings off zero. D1, D3 and D4 set how many mornings
survive once the two inputs exist; D2 is the rule the calendar evidence has to be imported under.

**Wording correction, 2026-11-24.** D6 and the `calendar` row in section 1 used to say "vintage-stamped
schedules". A *vintage*, in this repository, is a property of a released value: the same statistic as it was
first published and as it was revised (`docs/research/usd-session/h1/v0.1.1/GAP_REGISTER.md` uses it that
way, and so does every FRED/ALFRED extract behind `broad`, `front`, `spread` and `real`). A release
*schedule* has no such thing. What the event gate reads is the scheduled date and time of a release and the
instant that schedule became public, so a morning can be judged on the calendar knowable at its 05:00
cutoff rather than on a page read today. The object D6 asks for is therefore a capture of a dated page, not
a vintage of a released number; the recommendation, the five required release types, the missing evidence
and the 0 of 725 are otherwise unchanged.

## 5. What this does not do

- **No threshold moves.** The 96-hour spread window, the 192-hour broad window, the 24-hour calendar window
  and the identity rung are unchanged. The candidates are published beside the gate with `applied: false`.
- **No rule candidate is applied.** `coverage.rule_candidates.status = "proposed"`, and the gate keeps
  reading the supplied contract, so the published `ready` count cannot move by reading a proposal.
- **No substitute instrument.** `gold` stays at 0 rather than accepting the legacy XAU/USD field, and the
  DXY.cash tape stays labelled a broker CFD under H1-A01 rather than being described as ICE data.
- **No sealed-lane claim.** Historical reconstruction and sealed live replay stay separate; receipts are
  0 of 725 and the DXY.cash export cannot supply one retrospectively.

## 6. Reproduction

```
npm run screen:backtesting
npm run screen:backtesting:check
npm run h1:evidence:check
npm run check:h1-a02
npm run test:usd-session
```

`tests/h1_resolutions.test.js` holds this note to the payload: P-02's `not_read_by_any_family`, the pending
H1-A02 status and the exact evaluated-contract string, the three candidate effects, the DXY.cash labelling,
the IBA licence wording on `gold`, the 0 of 725 ready count, and the fact that 2024-12-12 is blocked by
`gold` and `calendar` alone.
