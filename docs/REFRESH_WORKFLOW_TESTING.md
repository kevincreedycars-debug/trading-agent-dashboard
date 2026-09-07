# Refresh Workflow Testing

## Purpose

The dashboard refresh surface is not just a button and a badge. It is a browser-side state machine that tries to answer a harder question:

- did this exact browser click lead to a completed published refresh?

Because the public dashboard can run in browser-only mode, it cannot always prove that exact linkage. The tests in `tests/refresh_progress.browser.test.js` exist to keep that boundary honest.

## Core Files

- `script.js`
  Contains the refresh-state reconciliation logic, operator-facing workflow copy, and rendering for the Master Orchestrator panel.
- `tests/refresh_progress.browser.test.js`
  End-to-end browser suite for refresh request lifecycle behavior.
- `data/workflow-status.json`
  Default published workflow status contract consumed by the dashboard.
- `data/refresh-runtime-profile.json`
  Runtime percentile profile used for countdown, delay, and expiry thresholds.

## Local Setup

Install dependencies and the Chromium browser binary:

```powershell
npm install
npm run playwright:install
```

Run the suite:

```powershell
npm test
```

Useful alternatives:

```powershell
npm run test:refresh-harness
npm run test:refresh-browser
npm run test:refresh-browser:watch
```

## What The Browser Suite Verifies

The suite covers these workflow behaviors:

- acceptance is not completion
- stale previous success does not satisfy a new request
- browser-local lock coordination across reloads and tabs
- delayed publication and status polling gaps
- exact-associated completion
- exact-associated vs unverified failure handling
- hard-expiry behavior after the verification window closes
- stale terminal states when newer unrelated public runs appear
- operator-facing failure wording for collectors and publication steps

## Workflow State Meanings

These are the states currently modeled by the dashboard refresh presentation:

- `sending`
  The browser has created a local refresh request and is sending the webhook.
- `accepted`
  The webhook dispatch completed from the browser point of view, but execution is not yet proven.
- `publishing`
  Fresh post-request artifacts are appearing, but the full required publication set is not complete yet.
- `delayed`
  The request has exceeded the normal runtime threshold without enough public confirmation.
- `status_unavailable`
  Public workflow status polling failed while the request is still active.
- `failed`
  A fresh failed workflow run was observed and the request can be closed.
- `incomplete`
  The verification window expired after only partial publication evidence appeared.
- `verification_expired`
  The verification window expired with no qualifying fresh publication.
- `association_unverified`
  A newer full publication appeared, but exact request linkage is still unavailable in browser-only mode.
- `complete`
  Exact associated fresh publication was confirmed.
- `failed_dispatch`
  The browser could not send the webhook request at all.

## Important Invariants

- `Accepted` must never imply completion.
- A new public run without exact linkage must not be labeled `Completed`.
- Terminal states must release the local lock so `Run Refresh` becomes available again.
- Delay notes should only appear while a request is still operationally active.
- Passive published failure rendering and active request failure rendering should use consistent operator language.

## Test Harness Notes

The browser suite uses a local HTTP harness that serves:

- `index.html`
- `script.js`
- `styles.css`
- mock `workflow-control.json`
- mock `workflow-status.json`
- mock `refresh-runtime-profile.json`
- mutable Layer 1 and Layer 2 JSON fixtures

That harness lets the tests move workflow state forward without touching live infrastructure.

There is also a fast helper-level suite in `tests/refresh_workflow_harness.test.js` that verifies the reusable fixture builders and timestamp helpers without launching a browser.

Two fixture helper families matter:

- `buildLayer1` / `buildLayer2`
  Good for basic mutable artifact payloads.
- `buildPublishedLayer1` / `buildPublishedLayer2`
  Use these when the test needs published freshness markers such as `dashboard_meta.last_updated_et`.

If a test is supposed to simulate a newer public run, prefer the `buildPublished*` helpers so freshness detection works the same way it does in the dashboard.

## When To Add Or Update Tests

Add or update this suite when changing:

- refresh request reconciliation rules
- localStorage lock lifecycle behavior
- workflow delay / expiry thresholds
- publication freshness detection
- error or failure wording in the orchestrator panel
- any logic that changes what the operator sees in the Master Orchestrator card

## Current Baseline

As of Tuesday, August 18, 2026, the refresh browser suite passes locally with:

```powershell
node --test tests/refresh_progress.browser.test.js
```
