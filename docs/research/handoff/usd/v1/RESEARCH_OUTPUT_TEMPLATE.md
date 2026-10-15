# How to return a research card

Forecast the direction of the US dollar over one session: the sign of the change in the label instrument from 05:00 Europe/London to 05:00 Europe/London on the next local date.

Return one JSON document per card and nothing else in that file, plus a short note listing the sources you fetched and the questions you could not resolve.

## Rules

Do not invent a backtest, a performance figure, an accuracy rate or a sample size. If you have not
measured it, say it is unmeasured. Numbers you remember are not evidence.
Do not use hindsight: never state what a past period would have predicted using information that was not
available at that time, and do not present a later revision as a first print.
Cite only sources you actually fetched in this session, with the link and the passage you relied on.
Where you are uncertain, say so and give the reason; an unresolved question is a valid return.
State effects that are already in the price at the cutoff rather than counting them again as predictive.
Treat the deployed weights, thresholds and signs as a baseline to audit, never as evidence for your claim.
Name the instrument a claim is really about. Never present another instrument as DXY.
No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by
this pack, and none may be proposed as part of the deliverable.

Return one JSON document for this factor, and nothing else in the JSON file.
Use the field list in section 7 of this pack exactly; a required field left empty is not an accepted card.
At most two programmable hypotheses. If you cannot state a hypothesis a program could evaluate session by
session without judgement, return one, or return none and say why.
Every parameter must carry the values you allow, a default and the rule for choosing it on training rows
only, declared before validation.
Every claim in the verdict must be traceable to an entry in evidence, or be labelled as a judgement.
Return the file plus a short note listing the sources you fetched and the questions you could not resolve.

Validate against `docs/research/handoff/usd/v1/research_card.schema.json` (usd-session-research-card-v3), which extends `docs/research/usd-session/v1/research-card.schema.json` and keeps that schema's session_horizon, calendar_and_quote_handling and evidence blocks unchanged.

## The fields, in the order the schema requires them

- `card_id`
- `schema_version`
- `created_at`
- `author`
- `status`
- `title`
- `asset`
- `factor_id`
- `task_id`
- `card_version`
- `model`
- `family`
- `assignment_id`
- `session_horizon`
- `calendar_and_quote_handling`
- `verdict`
- `mechanism`
- `direction_claim`
- `session_role`
- `observable_by_cutoff`
- `reaction_vs_predictive`
- `historical_data_requirements`
- `live_data_requirements`
- `missing_or_stale_handling`
- `dependencies_and_overlap`
- `hypotheses`
- `rejection_test`
- `falsification_tests`
- `evidence`
- `limitations`
- `open_questions`

## A skeleton to copy

Every angle bracket is a placeholder and an empty required string is not an accepted card. The session_horizon constants and the asset are already correct and must not be changed.

```json
{
  "card_id": "fx.usd-baseline-factor-24h",
  "schema_version": "usd-session-research-card-v3",
  "created_at": "<YYYY-MM-DD>",
  "author": {
    "kind": "<field-model|frontier-reviewer|coordinator>",
    "name": "<who wrote it>"
  },
  "status": "research-drafted",
  "title": "<one line naming the claim>",
  "asset": "USD",
  "factor_id": "<the factor_id printed at the top of your pack>",
  "task_id": "<the task_id printed at the top of your pack>",
  "card_version": 1,
  "model": "<the model that wrote this card>",
  "family": "<the card family printed at the top of your pack>",
  "assignment_id": "<the same task_id>",
  "session_horizon": {
    "horizon_id": "london-0500-to-london-0500-next-day",
    "start_local": "05:00",
    "start_zone": "Europe/London",
    "end_local": "05:00",
    "end_zone": "Europe/London",
    "end_day_offset": 1,
    "nominal_hours": 24,
    "rule": "<your own statement of the window: Monday-to-Friday starts, the Friday session that contains the US close, the excluded London transitions, and the label as the change in the label instrument between the two London instants>"
  },
  "calendar_and_quote_handling": {
    "dst_rule": "<what your series does on the London changeover dates>",
    "weekend_rule": "<which sessions are eligible and what happens to the Friday session that ends on Saturday>",
    "missing_quote_rule": "<what happens when either London print is missing, stale or revised>"
  },
  "verdict": "<supported|rejected|inconclusive|not_testable>",
  "mechanism": {
    "summary": "<the mechanism in plain words>",
    "session_relevance": "<why it should appear inside 24 hours>",
    "economic_channel": "<the channel>"
  },
  "direction_claim": {
    "sign_expected": "<BULLISH|BEARISH|REGIME_ONLY|AMBIGUOUS>",
    "magnitude_expected": "<what size, and how measured>",
    "sign_change_conditions": [
      "<condition under which the sign flips>"
    ],
    "weakening_conditions": [
      "<condition under which the effect weakens>"
    ],
    "already_priced_in_conditions": [
      "<what is already in the price at 05:00 London>"
    ]
  },
  "session_role": "<direction|regime_context|quality_gate|abstention_gate|diagnostic_only>",
  "observable_by_cutoff": {
    "available": false,
    "as_of_rule": "<the rule that decides what is observable>",
    "notes": "<what the collector actually has>"
  },
  "reaction_vs_predictive": {
    "classified": "<predictive|reaction_only|mixed>",
    "explanation": "<why>"
  },
  "historical_data_requirements": [
    {
      "series": "<series>",
      "source": "<source>",
      "frequency": "<intraday_hourly|intraday_minute|daily|weekly|monthly|event_driven>",
      "units": "<units>",
      "history_start": "<YYYY-MM-DD>",
      "session_timing_rule": "<how a value is assigned to a session and to the cutoff, with missing bars named>",
      "vintage_available": "<yes|no|unknown>"
    }
  ],
  "live_data_requirements": [
    {
      "series": "<series>",
      "collector_path": "<where the live value comes from today>",
      "exists_today": "<yes|no|partial>",
      "latency_note": "<age at 05:00 London>"
    }
  ],
  "missing_or_stale_handling": {
    "missing_rule": "<what happens when the input is absent>",
    "stale_rule": "<the age test, or none>",
    "effect_on_score": "<what it does to the published number>"
  },
  "dependencies_and_overlap": {
    "depends_on": [
      "<other factor or source>"
    ],
    "overlaps_with": [
      "<factor id>"
    ],
    "double_count_risk": "<how the same news could be counted twice>"
  },
  "hypotheses": [
    {
      "programmable_statement": "<a statement a program could evaluate session by session>",
      "null_hypothesis": "<the null>",
      "expected_effect_size": "<what size, and why>",
      "eligible_rows_note": "<which sessions are eligible>",
      "parameters": [
        {
          "name": "<parameter>",
          "values": [
            "<allowed value>"
          ],
          "default": "<default>",
          "selection_rule": "<chosen on training rows only, declared before validation>"
        }
      ]
    }
  ],
  "rejection_test": {
    "design": "<the design>",
    "metric": "<the metric>",
    "reject_if": "<the rejection rule>",
    "cannot_conclude_if": "<when the test proves nothing>",
    "sample_and_period": "<sample and period>",
    "multiple_comparisons_note": "<how many comparisons, and the correction>"
  },
  "falsification_tests": [
    {
      "name": "<test name>",
      "design": "<the design>",
      "metric": "<the metric>",
      "reject_if": "<what abandons the claim>",
      "cannot_conclude_if": "<when it proves nothing>"
    }
  ],
  "evidence": [
    {
      "fetched": false,
      "url": "<the link you actually opened>",
      "supports": "<the passage relied on>",
      "source_type": "not_yet_fetched"
    }
  ],
  "limitations": [
    "<what this card could not establish>"
  ],
  "open_questions": [
    "<what remains unresolved>"
  ]
}
```

## What happens after you return it

- The card is research evidence. It is not an approval and it changes nothing in the live engine.
- A reviewer attacks the card against the same pack, and only a recorded review can accept a hypothesis.
- Only a backtest run under the frozen evaluation design can test it, and the label instrument decision comes before any of that.
