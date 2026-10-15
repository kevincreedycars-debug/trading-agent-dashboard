# Research-card schema (reusable)

File: `research-card.schema.json` (JSON Schema draft 2020-12, id `usd-session-research-card-v2`, fixed to the
London 05:00→05:00 session horizon declared in `session_contract_v1.json`).
Validator: `backtester/lib/usd_session_research_card.js` (`checkResearchCard`, `assertResearchCard`).
Template: `research-cards/_template.usd-session-card.json`.
Guard test: `backtester/tests/usd_session_research_card.test.js`.

## Why a schema instead of prose assignments

The user's brief requires every factor to carry the same evidence, the same data-availability statement and
a test that could reject it. A schema makes those fields non-optional: a card that omits its rejection test,
its as-of rule, its double-counting risk or its fetched sources does not validate, so it cannot be handed to
a reviewer or cited by the engine specification. The schema carries no `asset` field — `family` is its only
asset-specific vocabulary — so the same shape
will carry EUR, GBP, GOLD, SILVER, NQ, BTC and WTI cards later, changing only `family` values if those assets
need more families. What each card must now also state for itself is the session horizon it was written for and
how its own series behaves on a changeover day, at a weekend and when a quote is missing.

## Field-by-field correspondence with the brief

| Brief requirement | Schema field |
| --- | --- |
| Proposed mechanism and evidence for our session horizon | `mechanism.summary`, `mechanism.session_relevance`, `evidence[]` |
| The session horizon the card is written for, stated on the card itself | `session_horizon.horizon_id`, `.start_local`, `.start_zone`, `.end_local`, `.end_zone`, `.end_day_offset`, `.nominal_hours`, `.rule` |
| How the card's own series behaves on a changeover day, at a weekend or with a missing quote | `calendar_and_quote_handling.dst_rule`, `.weekend_rule`, `.missing_quote_rule` |
| Conditions where the relation changes sign, weakens or is priced in | `direction_claim.sign_change_conditions`, `.weakening_conditions`, `.already_priced_in_conditions` |
| Whether it gives direction, regime, quality gate or abstention gate | `session_role` (one card per role) |
| Dependencies and overlap with other factors | `dependencies_and_overlap.depends_on`, `.overlaps_with`, `.double_count_risk` |
| Exact historical and live data requirements | `historical_data_requirements[]`, `live_data_requirements[]` |
| What was actually observable by 05:00 London | `observable_by_cutoff.available`, `.as_of_rule`, `.notes` |
| Programmable hypothesis, bounded parameters, a test that could reject it | `hypothesis.*`, `parameters[]`, `rejection_test.*` |
| Sources actually fetched, with links and the passage relied on | `evidence[]`, with `fetched` and `supports` |
| Separate reaction from predictive information | `reaction_vs_predictive.classified`, `.explanation` |

## Conventions that keep cards comparable

- `card_id` is a dotted lowercase id used verbatim in the engine specification and in experiment registry
  rows. Renaming a card means renaming the rule that cites it.
- `status` moves only forward: `stub` → `research-drafted` → `reviewed-a` / `reviewed-b` → `synthesised` →
  `implemented` → `tested`, or to `rejected` at any point. Reviewer comments are not stored in the card;
  they are separate artefacts, so the researcher's original text survives review.
- `session_horizon` and `calendar_and_quote_handling` are required from version 2 of the schema, and the horizon
  identifier inside `session_horizon` is a fixed constant (`london-0500-to-london-0500-next-day`). A card written
  against the superseded 05:00 London → 17:00 New York window therefore cannot validate: both ends are now
  05:00 `Europe/London` one local day apart, 24 nominal hours, and the eligible starts are Monday to Friday only.
  The horizon is fixed by `session_contract_v1.json` and by
  `backtester/lib/usd_session_engine_interface.js` (engine version `usd-session-engine-interface-v2`).
- `evidence[].fetched` must be `true` before a source may be cited anywhere else. Model memory of a paper is
  not evidence; an un-fetched intended source stays `fetched: false` with `source_type: not_yet_fetched`.
- `parameters[].selection_rule` must name the training period the choice is made on. A parameter with no
  declared selection rule fails validation.
- `session_role: diagnostic_only` exists so a factor that is only ever a removal test cannot accidentally
  carry weight.
- `open_questions` is mandatory-by-array (may be empty) so an unresolved disagreement has a place to live
  instead of being smoothed away in synthesis.
