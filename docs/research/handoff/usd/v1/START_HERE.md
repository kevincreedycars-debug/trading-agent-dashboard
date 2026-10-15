# USD research handoff - start here

Generated 2026-10-15 on branch `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`. Context version usd-session-context-20261014.1, pack version 2.0.0.

This bundle is the standardised handoff for the USD research programme: 25 self-contained briefs, one per USD factor in the committed Research Library catalogue, each carrying its own context, its research prompt and its output instructions. Hand one brief to one model and a card comes back. Nothing here is a forecast, a performance number or an approval.

Every brief uses one session: 05:00 Europe/London to 05:00 Europe/London on the next local date. The flat band, the tie policy and the missing-quote policy are still undecided and are not assumed by any brief.

## Download

- The whole bundle as one archive: [`usd-research-handoff-v1.zip`](usd-research-handoff-v1.zip) - every file below, 25 briefs included, stored uncompressed so the archive is reproducible.
- The same list as data: [`BRIEF_INDEX.json`](BRIEF_INDEX.json) - factor id, label, half, covering task, status and pack path for all 25 briefs.

## The twenty-five briefs

| # | Factor id | Label | Half | Covered by | Research | Brief |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `live.f1-vix-level` | F1 VIX level and risk regime | deployed baseline audit | `USD-BASELINE-AUDIT-01` | ready | [`packs/f1-vix-level.md`](packs/f1-vix-level.md) |
| 2 | `live.f2-us-2y-delta` | F2 US 2Y yield delta | deployed baseline audit | `USD-BASELINE-AUDIT-02` | ready | [`packs/f2-us-2y-delta.md`](packs/f2-us-2y-delta.md) |
| 3 | `live.f3-us-de-2y-spread-delta` | F3 US-DE 2Y spread delta | deployed baseline audit | `USD-BASELINE-AUDIT-03` | ready | [`packs/f3-us-de-2y-spread-delta.md`](packs/f3-us-de-2y-spread-delta.md) |
| 4 | `live.f4-real-yield-delta` | F4 US 10Y real yield delta | deployed baseline audit | `USD-BASELINE-AUDIT-04` | ready | [`packs/f4-real-yield-delta.md`](packs/f4-real-yield-delta.md) |
| 5 | `live.f5-dxy-delta` | F5 DXY delta | deployed baseline audit | `USD-BASELINE-AUDIT-05` | ready | [`packs/f5-dxy-delta.md`](packs/f5-dxy-delta.md) |
| 6 | `live.f6-gold-delta` | F6 Gold delta | deployed baseline audit | `USD-BASELINE-AUDIT-06` | ready | [`packs/f6-gold-delta.md`](packs/f6-gold-delta.md) |
| 7 | `live.f7-economic-surprise` | F7 US economic surprise | deployed baseline audit | `USD-BASELINE-AUDIT-07` | blocked | [`packs/f7-economic-surprise.md`](packs/f7-economic-surprise.md) |
| 8 | `live.f8-fed-bias` | F8 Fed bias | deployed baseline audit | `USD-BASELINE-AUDIT-08` | blocked | [`packs/f8-fed-bias.md`](packs/f8-fed-bias.md) |
| 9 | `live.f9-dollar-smile` | F9 Dollar Smile regime | deployed baseline audit | `USD-BASELINE-AUDIT-09` | ready | [`packs/f9-dollar-smile.md`](packs/f9-dollar-smile.md) |
| 10 | `live.f10-equity-versus-usd` | F10 Equity versus USD | deployed baseline audit | `USD-BASELINE-AUDIT-10` | ready | [`packs/f10-equity-versus-usd.md`](packs/f10-equity-versus-usd.md) |
| 11 | `fx.usd-session-momentum` | USD session momentum | session research | `USD-SESSION-A1` | ready | [`packs/fx-usd-session-momentum.md`](packs/fx-usd-session-momentum.md) |
| 12 | `fx.usd-overnight-range-position` | USD overnight range position | session research | `USD-SESSION-A1` | ready | [`packs/fx-usd-overnight-range-position.md`](packs/fx-usd-overnight-range-position.md) |
| 13 | `fx.usd-session-volatility-regime` | USD session volatility regime | session research | `USD-SESSION-A1` | ready | [`packs/fx-usd-session-volatility-regime.md`](packs/fx-usd-session-volatility-regime.md) |
| 14 | `risk.vix-level-and-change-at-cutoff` | VIX level and change at the cutoff | session research | `USD-SESSION-A1` | ready | [`packs/risk-vix-level-and-change-at-cutoff.md`](packs/risk-vix-level-and-change-at-cutoff.md) |
| 15 | `risk.risk-on-off-cross-asset-state` | Risk-on and risk-off cross-asset state | session research | `USD-SESSION-A1` | ready | [`packs/risk-risk-on-off-cross-asset-state.md`](packs/risk-risk-on-off-cross-asset-state.md) |
| 16 | `risk.usd-safe-haven-demand` | USD safe-haven demand | session research | `USD-SESSION-A1` | ready | [`packs/risk-usd-safe-haven-demand.md`](packs/risk-usd-safe-haven-demand.md) |
| 17 | `data.quality-gate-for-abstention` | Data quality gate for abstention | session research | `USD-SESSION-A1` | ready | [`packs/data-quality-gate-for-abstention.md`](packs/data-quality-gate-for-abstention.md) |
| 18 | `rates.us-front-end-delta` | US front-end delta | session research | `USD-SESSION-A2` | ready | [`packs/rates-us-front-end-delta.md`](packs/rates-us-front-end-delta.md) |
| 19 | `rates.relative-front-end-delta` | Relative front-end delta | session research | `USD-SESSION-A2` | ready | [`packs/rates-relative-front-end-delta.md`](packs/rates-relative-front-end-delta.md) |
| 20 | `rates.real-yield-delta` | Real yield delta | session research | `USD-SESSION-A2` | ready | [`packs/rates-real-yield-delta.md`](packs/rates-real-yield-delta.md) |
| 21 | `rates.term-premium-and-curve` | Term premium and curve | session research | `USD-SESSION-A2` | ready | [`packs/rates-term-premium-and-curve.md`](packs/rates-term-premium-and-curve.md) |
| 22 | `rates.credit-spread-delta` | Credit spread delta | session research | `USD-SESSION-A2` | ready | [`packs/rates-credit-spread-delta.md`](packs/rates-credit-spread-delta.md) |
| 23 | `calendar.known-releases-between-cutoff-and-endpoint` | Known releases inside the window | session research | `USD-SESSION-A2` | ready | [`packs/calendar-known-releases-between-cutoff-and-endpoint.md`](packs/calendar-known-releases-between-cutoff-and-endpoint.md) |
| 24 | `calendar.days-since-and-until-high-impact-events` | Distance from high-impact events | session research | `USD-SESSION-A2` | ready | [`packs/calendar-days-since-and-until-high-impact-events.md`](packs/calendar-days-since-and-until-high-impact-events.md) |
| 25 | `macro.release-surprise-at-first-print` | Release surprise at first print | session research | `USD-SESSION-A2` | blocked | [`packs/macro-release-surprise-at-first-print.md`](packs/macro-release-surprise-at-first-print.md) |

All 25 USD factors in the committed catalogue (`data/research-library/catalog.json`) have exactly one brief here: 10 deployed factors, whose packs audit code that runs, and 15 session-research factors (15 in `research_session_v1`), which have no rule in force. A brief is an assignment, so a returned card is evidence; it becomes a rule only after a review accepts it and a backtest supports it.

## How to run one brief

1. Open the brief you want from the table above, or take the same brief from the Research Library tab of the dashboard, where each of the 25 factors carries its own Copy prompt and Download actions.
2. Paste it into your own ChatGPT session. Nothing in this repository calls a model API, and no brief authorises a workflow, feed, dashboard or configuration change.
3. Return one JSON card per brief, following [`research_card.schema.json`](research_card.schema.json) (usd-session-research-card-v3) and the template `RESEARCH_OUTPUT_TEMPLATE.md`, then upload it against the covering task id. An upload records evidence; it is not an approval.
4. Send the returned cards to reviewer A and reviewer B, who now cover all twenty-five entries and their overlaps, then to the synthesis.

## Read in this order

1. `USD_SYSTEM_CONTEXT.md` - the system as it is: objective, the path from inputs to the published call, the rules and weights that execute, the code, the defects and the source table.
2. `USD_FACTOR_REGISTER.md` and `USD_FACTOR_REGISTER.json` - the 10 deployed factors with their rules, inputs, weights, availability and open questions.
3. `packs/` - the 25 briefs, one per factor. Hand one brief to one frontier model.
4. `RESEARCH_OUTPUT_TEMPLATE.md` and `research_card.schema.json` - what comes back and how it is validated.
5. `tracker_tasks.json` - all 25 briefs as tracker rows, with statuses copied from the committed catalogue.
6. `HANDOFF_MANIFEST.json` - what was generated, with a hash for every other file in the bundle.

## What is not claimed

- No live deployment, workflow, dashboard, feed or database change was made or is authorised by this bundle.
- No backtest was run for any factor here and no performance figure is asserted anywhere in it.
- A pack is an assignment, a passing schema check is not a review, and a reviewed hypothesis is not a tested one.
- A brief states a question, not a finding. Coverage of 25 of 25 factors says every factor has an assignment; it says nothing about any factor's behaviour.

## Regenerating it

`node scripts/build_research_handoff.js write` rebuilds every file here, including the archive, and `check` fails if any of them is stale, if the register contradicts `data/research-library/catalog.json`, or if the catalogue's session factors and the authored briefs disagree.
