# Backtester Master Logic

## Purpose

The backtester is a reusable research engine for evaluating Layer 1 trading agents.

`docs/CORE_RESEARCH_PHILOSOPHY.md` is the authoritative repository statement for the research platform's guiding principles.

It must test what each agent would have said at a given point in time, based only on the inputs available at that time, and compare that verdict against realised market movement.

The backtester must be reusable across assets and agents.

Initial assets:

* USD
* EUR
* Gold
* NQ
* BTC

## Core Principle

Production Layer 1 agents must remain sealed and deterministic.

The backtester must never influence live signals directly.

It is a downstream research and evaluation layer.

The first job is measurement of the current production system, not optimization of a future one.

## Timeframes To Evaluate

Every call should be evaluated across:

* 12hr
* current day
* following 24hrs
* 3d from call
* current week
* following week
* current month
* following month

Current week means from the call timestamp to the end of that same market week.

Example:

* Monday call = Monday to Saturday
* Thursday call = Thursday to Saturday

## Part 1 — Agent Verdict Backtester

This evaluates the current agent engine.

For each historical row, the system should determine:

* asset
* agent
* timestamp
* available market inputs
* agent verdict
* direction
* confidence
* bull case
* bear case
* participation
* net edge
* strength
* factor breakdown
* missing inputs
* warnings
* logic version
* collector version

Then it compares the verdict against realised market outcome for each timeframe.

This gives accuracy by:

* asset
* agent
* timeframe
* confidence bucket
* participation bucket
* strength
* market regime
* logic version

## Part 2 — Factor Reliability Backtester

This should be mostly mathematical and token-conservative.

It should not require AI for every row.

The system should extract historical market data, run each row against the factor logic, and store every factor observation.

Example:

F2
US 2Y 5d bps = +7
Verdict = bullish USD
Reason = US front-end yields support USD

The backtester should then measure:

* how often this factor appeared
* how often it was bullish
* how often it was bearish
* how often it agreed with the final agent call
* how often the market outcome confirmed it
* whether it worked better on 12hr, current day, 24hr, 3d, week, or month
* whether it worked better in specific regimes
* whether it became unreliable in certain conditions

This creates a permanent factor reliability database.

## Part 3 — Event-Aware Backtester

This comes later.

Economic events are harder because they can change the day’s verdict after release.

The event-aware engine should eventually separate:

* pre-event call
* post-event call
* event actual
* event consensus
* event surprise
* market reaction window
* agent adjustment after event
* realised outcome

Do not build this first.

## Token-Conservative Strategy

Do not blindly rerun AI agents over one year of data if avoidable.

Preferred approach:

1. Store all live Layer 1 calls from now onward.
2. Store all factor breakdowns in flattened form.
3. Store realised outcomes after each timeframe expires.
4. Use mathematical factor evaluation wherever possible.
5. Only use AI historical replay for targeted tests, selected dates, or regime samples.

## Required Database Concept

The backtester needs three core storage layers:

1. Predictions
   One row per agent, asset, timestamp, and timeframe.

2. Outcomes
   One row per prediction and realised timeframe result.

3. Factor Observations
   One row per factor inside each prediction.

## Success Criteria

The backtester should eventually answer:

* How accurate is each agent?
* Which timeframe works best?
* Which asset is easiest to forecast?
* Which confidence levels are genuinely predictive?
* Which factors improve accuracy?
* Which factors damage accuracy?
* Which factors only work in certain regimes?
* Which agent logic version performed best?
* Which changes improved or reduced performance?

## Non-Negotiables

* No live signal contamination.
* No cross-agent contamination.
* Store everything needed for future analysis.
* Make schema generic enough for every asset.
* Make the engine reusable and rerunnable.
* Separate agent accuracy from factor reliability.
* Keep event-aware testing as a later module.
