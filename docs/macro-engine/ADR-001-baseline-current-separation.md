# ADR-001: Baseline and Current Call Separation

## Status

Accepted for staged Phase 1 and Phase 2 only.

## Decision

The session-open Layer 1 call is a sealed `BASELINE` version. A material event or confirmed price shock may create an `EVENT_OVERLAY` version, but it must retain the baseline's `baselineCallId` and identify the call it supersedes.

No workflow, dashboard file, or table may overwrite the baseline record. The current call is derived by selecting the latest compatible non-terminal version, never by mutating the baseline.

## Consequences

- Replay can compare baseline value with revised-call value at the correct timestamp.
- Layer 2 can reject a stale, weakening, expired, invalidated, or incompatible source leg.
- Alerts can explain the prior call, new call, trigger events, and exact change time.
- A revision that changes duration or hard expiry needs an explicit new call version; timestamps cannot be silently extended.

## Guardrails

- `BASELINE` requires `baselineCallId === callId`.
- `EVENT_OVERLAY` requires `baselineCallId` and `supersedesCallId` lineage.
- `INVALIDATED` and `EXPIRED` calls cannot be resurrected.
- Missing or stale required data fails closed.
- Production Layer 1 and Layer 2 tables remain out of scope through shadow operation.
