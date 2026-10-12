# USD 24-hour shadow result and the deployment diff that is *not* applied

## 1. What was run

`node backtester/scripts/run_usd_24h_shadow_comparison.js` executes the frozen candidate from
`config/usd_24h_ruleset_v2.json` over the untouched holdout window (2025-11-03 to 2026-04-30, 123 rows)
and scores it beside the deployed engine's stored calls on exactly those rows. Output:
`data/usd-24h-shadow-comparison.json`, with one record per date carrying both directions, both result
labels and the candidate's probability.

| Measure | Value |
| --- | --- |
| Candidate holdout accuracy | 46.25 [35.75, 57.10], 80 decided, 122 of 123 rows given a direction |
| Engine holdout accuracy | 52.78 |
| Days disagreeing | 84 |
| Candidate alone correct | 24 |
| Engine alone correct | 26 |
| Dispatcher enabled / status / run lock | false / paused / absent |

The candidate is therefore **worse** than the deployed engine on the shadow window, on 26 days against
24. This is the same result the selection step reported and it is the reason no deployment is proposed.

## 2. What "shadow" means here, exactly

This is an offline shadow replay. It is not a live shadow deployment:

- no n8n workflow, version, credential or activation was touched, and the candidate has never run in n8n;
- the dispatcher stays paused, as recorded in the comparison file from `controller/config.json`,
  `controller/status.json` and the absence of `controller/run.lock`;
- the comparison runs from the versioned configuration file, so a change to that file changes what the
  shadow measures — it is reproducible, not a black box.

A true live shadow needs a second, non-trading output path inside the workflow. That is a workflow
change and requires separate authorisation; it is not part of this work.

## 3. The deployment diff, prepared but unapplied

If the user authorises a candidate in shadow (or later, in production), the change to
`exports/usd_layer1_agent.json` is confined to the deterministic node `Calculate USD Conviction`
(12,276 characters today). The exact edits would be:

1. **Input pack (`Build USD Input Pack`)**: add the twelve new snapshot fields the candidate reads —
   `us_3m_yield`, `us_10y_breakeven`, `policy_rate_effr`, `sofr`, `credit_spread_hy`, `sp500_level`,
   `wti_spot`, `us_5y_real_yield`, `us_lag1_ret_1d`, `us_lag1_ret_5d`, `us_lag1_ma20_dist_pct`,
   `us_vol20_pct` — each with the declared lag, and leave `latest_us_event` and `fed_bias` null rather
   than zero-filled.
2. **Featurisation block**: add a pure function that turns those fields into the candidate's seventeen
   features, returning `null` for any feature whose inputs are absent (never `0`).
3. **Score block**: standardise with the recorded means and standard deviations, apply the recorded
   coefficients and intercept, take the direction against the recorded threshold, and write
   `candidate_direction_24h`, `candidate_p_up_24h: null`, `candidate_ruleset_version:
   "usd-24h-v2-candidate"` and `candidate_missing_features` into the existing output object.
4. **Leave every existing field alone**: `direction_24h`, the factor breakdown, the weighted score and
   the dashboard confidence keep their current meaning, so a shadow row can be compared with the live
   call on the same run, and nothing downstream changes behaviour.
5. **Do not activate**: the node change writes the candidate as an *additional* field; the call the
   dashboard and Layer 2 read stays the engine's until a separate authorisation flips it.

Verification that would accompany the change: a re-run of `node --test
backtester/tests/usd_24h_research.test.js`, a byte-level re-read of the four code nodes against the
backup, the payload-level comparison the live-deployment harness already performs, and a fresh read-back
of the executing version. The previous live apply on this workflow is the template; nothing about it is
reused blindly, because this change adds fields rather than repairing a defect.

## 4. Recommendation

Do not deploy either form yet. The candidate loses to the deployed engine on the only untouched period,
the 60% target is unmet with an adequate sample, and four release blockers stand. If the user wants the
project to continue, the productive next steps are the ones the evidence supports: repair the
economic-surprise input, replace the session-close endpoint with the declared 24-elapsed-hour window,
and re-run this pipeline against a dataset whose inputs are vintages rather than latest revisions.
