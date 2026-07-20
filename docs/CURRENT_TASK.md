# Current Task

Last updated: 2026-07-20

## Task

Layer 1 Overview expiry UK tooltip.

## Objective

Add UK-time hover/focus tooltips to the existing Layer 1 `24H` expiry sections on the Overview cards while preserving the visible ET expiry display that is already deployed and validated.

This task must:

- continue using `forecast_window_end` as the primary expiry source, with `expires_at` as fallback only
- convert the same expiry timestamp into UK time using `Europe/London`
- use browser-native `Intl.DateTimeFormat`
- preserve the visible ET expiry value
- keep the tooltip compact, accessible, and free of overflow
- avoid changing Layer 2 logic or presentation unless a shared Layer 1 component naturally inherits the same behavior without a logic change

## Current Status

The current production baseline is already deployed and validated at commit `a15100d62f9a8a4c6ad6d8390f97f7de25ca1cdd` with:

- explicit Layer 1 `24H` expiry visible on Overview cards
- UK/ET live header clock
- Layer 1 Directional Viability spacing fix
- redundant Overview weighted-verdict prose removed

## Completed

- The visible ET expiry block on each Layer 1 Overview card is already deployed.
- The UK/ET live header clock is already deployed and validated.
- The Layer 1 Directional Viability spacing fix is already deployed and validated.
- The redundant Overview weighted-verdict summary prose has already been removed.

## Next Immediate Steps

1. Add a compact UK-time hover/focus tooltip to each available Layer 1 Overview expiry section.
2. Extend smoke coverage to verify the tooltip contract, focus behavior, ET display preservation, and no-overflow behavior.
3. After the tooltip work, plan the architecture-mirror implementation without building it yet.

## Current Blocker

No repository-side blocker.

## Target Outcome

The near-term outcome is:

> preserve the deployed ET expiry display while exposing the exact same `24H` expiry in UK time on hover and keyboard focus

The next planned phase is:

> architecture mirror of the dashboard and research platform
