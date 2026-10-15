# Pilot 1 return - recorded as preliminary, unreviewed and not backtested

Hand-written on 2026-10-15 on branch `research/usd-session-20261013`, beside `PILOT_DISPATCH_RECORD.md`. It is not generated, not a member of any archive and not registered in the Research Library, so nothing here moves a dispatched byte: the pilot package `1.0.0` and its four members still hash to the values the dispatch record pins.

## What came back

Pilot 1 was the VIX package `1.0.0` of 2026-10-15 (factor `live.f1-vix-level`, task `USD-BASELINE-AUDIT-01`, pack version `2.0.0`, context version `usd-session-context-20261014.1`, card schema `usd-session-research-card-v3`). Its return is two artefacts as they exist today:

- a JSON research card for `live.f1-vix-level`, on `usd-session-research-card-v3`; and
- a source note listing what was fetched, the passages relied on and the questions left unresolved.

The bytes of both are **not** committed to this repository, so this record pins their identity (factor, task, package version, schema version) and not their hashes. When the bytes are added, this file gains a row with each file's path, byte count and sha256; until then no hash is claimed for them.

## Status of both artefacts

| Field | Value |
| --- | --- |
| Status | **preliminary** |
| Review | **unreviewed** - no independent review has run on it |
| Backtest | **not backtested** - no run has measured it |
| Task `USD-BASELINE-AUDIT-01` | **open** - this return does not complete it |
| Factor status | research `ready`, review `pending`, backtest `not_tested`, unchanged |
| Implementation | **not advanced** - nothing was proposed for implementation and nothing was moved |

A card is evidence. It becomes a rule only after a review accepts it and a backtest under the frozen design supports it, and neither has happened.

## Why it is not the deep-research deliverable

The package asked for a per-factor assignment: audit the deployed sign, weight, threshold and lookback of F1 and return one card. The return answers that question. It is a preliminary baseline audit, not the comprehensive research the programme now asks for, and the brief it came from is not the deep-research brief.

What fell short, without judging the card's contents:

- it was not a comprehensive, source-backed report on how VIX and its interactions with other factors relate to the subsequent direction of the dollar over the 05:00 Europe/London to 05:00 next-local-date session;
- no independent red-team review has attacked it, so nothing in it has been tested claim by claim;
- the run that produced it is not a verified Astra deep-research run under the corrected programme;
- it was never asked to weigh the literature beyond this repository, on mechanisms, evidence and interactions.

The corrected programme is `../deep-research/START_HERE.md`: the report is the primary deliverable (step 1), an independent red-team review follows (step 2), the revised synthesis and structured research cards come next (step 3, where the per-card limit of at most two hypotheses applies), and backtesting under a frozen session and data contract is last (step 4).

## What this return may and may not be used for

May be used for: as one input to step 3, quoted and attributed as preliminary; as a worked example of a return's shape; and as evidence in the methodology review of what the package actually asked for.

May not be used for: as a finding about VIX or the dollar; as the completion of `USD-BASELINE-AUDIT-01`; as a reviewed or tested artefact; as evidence in the step 1 report; as a reason to change a weight, sign, threshold, lookback or rule; as a reason to advance the factor to candidate status; or as a substitute for the deep-research report.

## What would change its status

1. An independent review that attacks the card against its own brief and records a verdict claim by claim.
2. A backtest run under the frozen session and data contract, with the label instrument and quote source decided first, reporting coverage, sample size and uncertainty on decided calls.
3. A recorded decision by the owner on what, if anything, the reviewed card changes.

None of those has happened, none is authorised by this note, and no factor's status moves until they do.

## Not claimed

Nothing was deployed. No workflow, feed, dashboard, dispatcher or database was touched and no interface was changed. No factor's status moved: the catalogue still reads 22 ready and 3 blocked, and each of the ten deployed factors still reads research `ready`, review `pending`, backtest `not_tested`. No backtest was run and no performance figure, accuracy rate or sample size exists for this factor anywhere in this repository.
