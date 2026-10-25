'use strict';

// Authors the Research Library catalog and the document registry, and verifies both.
//
//   node scripts/build_research_library.js catalog --write    # rebuild data/research-library/catalog.json
//   node scripts/build_research_library.js catalog --check    # fail if the committed file differs
//   node scripts/build_research_library.js registry --write   # register repo-backed documents (hash + version)
//   node scripts/build_research_library.js registry --check   # fail if a registered hash no longer matches
//   node scripts/build_research_library.js verify             # validate catalog, registry and file hashes
//
// The catalog is research management metadata only. It holds no credential, no model endpoint and
// no live trading input, and it changes nothing that n8n, the dispatcher or the dashboard reads.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ResearchLibrary = require('../lib/research_library.js');
const Prompts = require('../lib/research_prompt_templates.js');

const root = path.resolve(__dirname, '..');
const catalogPath = path.join(root, 'data', 'research-library', 'catalog.json');
const registryPath = path.join(root, 'data', 'research-library', 'documents.json');
// The same briefs the handoff bundle publishes are the briefs the factor pages offer, so the pack path, its
// hash and its coverage come from one generator instead of two lists that can drift apart.
const Handoff = require('./build_research_handoff.js');

// The twenty-five factor ids the briefs cover, in catalogue order, read from the handoff builder rather than
// listed twice. The two review tasks and the synthesis cover this whole set, so a factor added to either
// half cannot quietly fall outside the reviews.
const ALL_BRIEF_FACTOR_IDS = Handoff.factorBriefRows().map(row => row.factor_id);
const TODAY = '2026-10-13';

const SESSION_OBJECTIVE =
  'One directional USD call per day over the 05:00 Europe/London to 05:00 Europe/London 24-hour session '
  + '(the endpoint is the next local date), from factors whose value is observable at the cutoff, '
  + 'with the label instrument and quote source declared.';

const STORAGE = {
  registry_path: 'data/research-library/documents.json',
  library_root: '.local/research-library',
  library_root_note: 'Ignored by Git. Uploaded bytes are research evidence and are not published.',
  catalog_path: 'data/research-library/catalog.json',
  service: {
    name: 'research-library-service',
    version: '1.0.0',
    bind: '127.0.0.1',
    default_endpoint: 'http://127.0.0.1:8791',
    start_command: 'node scripts/research-library-server.js --serve-repo',
    token_file: '.local/research-library/service-token',
    token_rule: 'The service creates the token file on first run and compares it in constant time. The token lives outside Git and is never rendered into the page.',
    public_upload: false,
    public_download: false,
    coordinator_export: 'GET /manifest and GET /export, token required',
    integrity_rule: 'Every object is stored once, under its own SHA-256, and is never rewritten. A download is re-hashed and refused if the bytes no longer match the registered hash.'
  },
  output_schema: {
    schema_path: 'docs/research/usd-session/v1/research-card.schema.json',
    schema_version: 'usd-session-research-card-v2',
    format: 'one JSON document per card, collected into a single file per task on return',
    verdict: 'A card may conclude that the factor should not be used. A returned card is research evidence, not an approved rule.',
    required_fields: [
      'card_id',
      'schema_version',
      'created_at',
      'author',
      'status',
      'title',
      'family',
      'assignment_id',
      'session_horizon',
      'calendar_and_quote_handling',
      'mechanism',
      'direction_claim',
      'session_role',
      'observable_by_cutoff',
      'reaction_vs_predictive',
      'historical_data_requirements',
      'live_data_requirements',
      'dependencies_and_overlap',
      'hypothesis',
      'parameters',
      'rejection_test',
      'evidence',
      'open_questions'
    ]
  },
  policy: {
    manual_task_only: true,
    frontier_api_calls: false,
    upload_is_approval: false,
    review_is_separate_from_authorship: true,
    note: 'Preparing a task writes nothing to a model. Uploading a report records evidence. Only a recorded review can accept a hypothesis, and only a backtest can test it.'
  },
  coordinator_sources: [
    'docs/research/usd-session/v1/inventory.md (extracted engine inventory, WP1)',
    'docs/research/usd-session/v1/session_contract_v1.json (target contract, label decision open)',
    'docs/research/usd-session/v1/exposed_periods.md (what has already been read)',
    'docs/research/usd-session/v1/implementation_plan.md (build plan and frozen evaluation design)',
    'data/usd-24h-dataset-manifest.json (what data the closed study reached, with declared lags)'
  ]
};

// The ten factors the deployed USD node computes today, extracted on 2026-10-13 from
// exports/usd_layer1_agent.json (workflow OCt1tB9yVMUgFTha; that export is the audited baseline, measured
// against v154 on 2026-10-11, and the executing version is v155 since 2026-10-12) and logic/agent_usd_direction.md v2.1.
// The two weight columns are both live and disagree; see docs/research/usd-session/v1/weight_vector_discrepancy.md.
const L = (factor) => ({
  review_status: 'pending',
  backtest_status: 'not_tested',
  dependencies: [],
  blockers: [],
  current_rules: [],
  sources: [],
  history: [],
  research_status: 'ready',
  doc_version: 'onboarding inventory v1 (2026-10-13)',
  updated_at: TODAY,
  ...factor
});

const LIVE_FACTORS = [
  L({
    factor_id: 'live.f1-vix-level',
    label: 'F1 VIX level and risk regime',
    group: 'live_engine',
    role: 'regime context',
    brief: 'VIX level is read as the risk regime the dollar is trading in. The rulebook also describes 1d and 5d modifiers; the deployed code does not implement them.',
    current_rules: ['VIX above 25 reads BULLISH, 16 to 25 NEUTRAL, below 16 BEARISH', 'level only; the documented 1d/5d modifier is not implemented'],
    lookback: 'level',
    threshold: '25 / 16',
    live_weight_coded: 10,
    live_weight_rulebook: 10,
    sources: ['FRED VIXCLS, read by the collector and stored as vix_level']
  }),
  L({
    factor_id: 'live.f2-us-2y-delta',
    label: 'F2 US 2Y yield delta',
    group: 'live_engine',
    role: 'direction',
    brief: 'Change in the US 2Y yield as a policy-expectation proxy.',
    current_rules: ['5-day change at or above +5 bps reads BULLISH, at or below -5 bps BEARISH'],
    lookback: '5 days on the 24h timeframe',
    threshold: '+/- 5 bps',
    live_weight_coded: 14,
    live_weight_rulebook: 14,
    sources: ['FRED DGS2']
  }),
  L({
    factor_id: 'live.f3-us-de-2y-spread-delta',
    label: 'F3 US-DE 2Y spread delta',
    group: 'live_engine',
    role: 'direction',
    brief: 'Change in the US minus German 2Y spread, derived in the collector from two series.',
    current_rules: ['5-day change at or above +5 bps reads BULLISH, at or below -5 bps BEARISH'],
    lookback: '5 days on the 24h timeframe',
    threshold: '+/- 5 bps',
    live_weight_coded: 10,
    live_weight_rulebook: 16,
    sources: ['FRED DGS2', 'Bundesbank BBSSY 2Y CSV']
  }),
  L({
    factor_id: 'live.f4-real-yield-delta',
    label: 'F4 US 10Y real yield delta',
    group: 'live_engine',
    role: 'direction',
    brief: 'Change in the 10Y TIPS real yield.',
    current_rules: ['5-day change at or above +5 bps reads BULLISH, at or below -5 bps BEARISH'],
    lookback: '5 days on the 24h timeframe',
    threshold: '+/- 5 bps',
    live_weight_coded: 10,
    live_weight_rulebook: 14,
    sources: ['FRED DFII10']
  }),
  L({
    factor_id: 'live.f5-dxy-delta',
    label: 'F5 DXY delta',
    group: 'live_engine',
    role: 'direction',
    brief: 'Trailing change in the dollar index the collector stores as dxy_level (FRED DTWEXBGS), with a d1 to d5 to d20 substitution ladder.',
    current_rules: ['1-day change at or above +0.15% reads BULLISH, at or below -0.15% BEARISH', 'falls back d1 then d5 then d20 and records only a warning string'],
    lookback: '1 day on the 24h timeframe',
    threshold: '+/- 0.15%',
    live_weight_coded: 14,
    live_weight_rulebook: 6,
    sources: ['FRED DTWEXBGS'],
    history: [{ date: '2026-10-12', version: 'recorded', note: 'The closed 24h study measured the deployed endpoint as the next session close, 30.5 hours at the median, not 24 elapsed hours.' }]
  }),
  L({
    factor_id: 'live.f6-gold-delta',
    label: 'F6 Gold delta',
    group: 'live_engine',
    role: 'direction',
    brief: 'Gold move as an inverse dollar-risk read.',
    current_rules: ['at or below -0.1% reads BULLISH, above +0.1% BEARISH', 'falls back from 5-day to 1-day and records only a warning string'],
    lookback: '5 days, 1-day fallback',
    threshold: '+/- 0.1%',
    live_weight_coded: 4,
    live_weight_rulebook: 5,
    sources: ['Coinbase XAU-USD spot']
  }),
  L({
    factor_id: 'live.f7-economic-surprise',
    label: 'F7 US economic surprise',
    group: 'live_engine',
    role: 'direction',
    brief: 'The highest-weight live family. The stored usd_signal per event is copied straight through, with no consensus and no first-print vintage reachable from this repository.',
    current_rules: ['the collector pre-computes a usd_signal per event and the node copies it', 'no threshold, no as-of check, no vintage'],
    lookback: 'whatever the collector stored',
    threshold: 'none',
    live_weight_coded: 24,
    live_weight_rulebook: 3,
    sources: ['Finnhub economic calendar (paid key), no consensus archive kept'],
    blockers: ['No consensus or first-print vintage source is reachable from this repository.'],
    research_status: 'blocked'
  }),
  L({
    factor_id: 'live.f8-fed-bias',
    label: 'F8 Fed bias',
    group: 'live_engine',
    role: 'direction',
    brief: 'Directional read of the Fed bias string, tested for the words hawkish or dovish. The rulebook describes a delta; the code measures no change.',
    current_rules: ['string contains hawkish or dovish', 'unknown is treated as a missing input and scores NEUTRAL'],
    lookback: 'current string only',
    threshold: 'none',
    live_weight_coded: 12,
    live_weight_rulebook: 18,
    sources: ['Collector-derived from the paid calendar feed'],
    blockers: ['No vintage of the bias string is retained, so no change can be measured.'],
    research_status: 'blocked'
  }),
  L({
    factor_id: 'live.f9-dollar-smile',
    label: 'F9 Dollar Smile regime',
    group: 'live_engine',
    role: 'regime context',
    brief: 'The smile regime read from the VIX level and the bias string.',
    current_rules: ['VIX above 25 reads BULLISH; VIX below 16 and not hawkish reads BEARISH'],
    lookback: 'level',
    threshold: '25 / 16',
    live_weight_coded: 1,
    live_weight_rulebook: 12,
    sources: ['FRED VIXCLS', 'the collector bias string']
  }),
  L({
    factor_id: 'live.f10-equity-versus-usd',
    label: 'F10 Equity versus USD',
    group: 'live_engine',
    role: 'regime context',
    brief: 'Cross-asset read of equities against the dollar, gated by the VIX regime.',
    current_rules: ['VIX below 16 with NQ up reads BEARISH; VIX below 16 with NQ down BULLISH; VIX above 25 with NQ down BULLISH'],
    lookback: 'NQ 1 day',
    threshold: '16 / 25',
    live_weight_coded: 1,
    live_weight_rulebook: 2,
    sources: ['Alpha Vantage GLOBAL_QUOTE on QQQ']
  })
  // APPEND_ANCHOR
];

// The fifteen candidate cards the two field packages ask for. None of them is a rule in force.
const R = (factor) => ({
  group: 'research_session_v1',
  research_status: 'ready',
  review_status: 'pending',
  backtest_status: 'not_tested',
  blockers: [],
  dependencies: [],
  doc_version: 'research package v1 (2026-10-13)',
  updated_at: TODAY,
  current_rules: ['No rule is in force. This is a hypothesis to be researched, not a deployed rule.'],
  sources: [],
  history: [{ date: TODAY, version: 'v1', note: 'Package prepared. No frontier model has run it yet.' }],
  ...factor
});

const A1_FACTORS = [
  R({
    factor_id: 'fx.usd-session-momentum',
    label: 'USD session momentum',
    asset: 'USD',
    role: 'direction',
    brief: 'Trailing 1-day and 5-day move in the label instrument, read at the cutoff: continuation or fade inside the 24-hour London-to-London session.',
    dependencies: ['The label instrument and quote source decision.'],
    sources: ['Price and risk package USD-SESSION-A1']
  }),
  R({
    factor_id: 'fx.usd-overnight-range-position',
    label: 'USD overnight range position',
    asset: 'USD',
    role: 'direction',
    brief: 'Where the dollar sits in its own recent range at the cutoff, as a bound on the session move rather than a directional call.',
    dependencies: ['The label instrument and quote source decision.'],
    sources: ['Price and risk package USD-SESSION-A1']
  }),
  R({
    factor_id: 'fx.usd-session-volatility-regime',
    label: 'USD session volatility regime',
    asset: 'USD',
    role: 'abstention gate',
    brief: 'Realised volatility of the label instrument and the effect of that regime on the expected move and on whether a call should be withheld.',
    dependencies: ['The label instrument and quote source decision.'],
    sources: ['Price and risk package USD-SESSION-A1']
  }),
  R({
    factor_id: 'risk.vix-level-and-change-at-cutoff',
    label: 'VIX level and change at the cutoff',
    asset: 'USD',
    role: 'regime',
    brief: 'VIX level and its change, read as risk regime rather than as a standalone direction, with the documented-but-unimplemented 1d and 5d modifiers examined.',
    sources: ['FRED VIXCLS', 'Price and risk package USD-SESSION-A1']
  }),
  R({
    factor_id: 'risk.risk-on-off-cross-asset-state',
    label: 'Risk-on and risk-off cross-asset state',
    asset: 'USD',
    role: 'regime',
    brief: 'Equities, credit, gold and crypto at the cutoff as one risk state, with the double-counting risk against the VIX card named explicitly.',
    sources: ['FRED credit and equity series in the closed study dataset', 'Coinbase spot quotes', 'Price and risk package USD-SESSION-A1']
  }),
  R({
    factor_id: 'risk.usd-safe-haven-demand',
    label: 'USD safe-haven demand',
    asset: 'USD',
    role: 'direction',
    brief: 'Whether the dollar is being bought as insurance rather than for carry, which changes the sign of the same risk move.',
    sources: ['Price and risk package USD-SESSION-A1']
  }),
  R({
    factor_id: 'data.quality-gate-for-abstention',
    label: 'Data quality gate for abstention',
    asset: 'USD',
    role: 'quality gate',
    brief: 'Which data states should force abstention instead of a weak call, given that the live collector has no as-of check and no staleness test.',
    dependencies: ['The label instrument and quote source decision.', 'Reviewer B approval of the frozen evaluation design.'],
    sources: ['docs/research/usd-session/v1/inventory.md section 4 and 7']
  })
];

const A2_FACTORS = [
  R({
    factor_id: 'rates.us-front-end-delta',
    label: 'US front-end delta',
    role: 'direction',
    brief: '2Y and 3M yield changes as policy-expectation proxies, with the publication lag of each series stated.',
    sources: ['FRED DGS2 and DTB3 via the closed study dataset', 'Rates package USD-SESSION-A2']
  }),
  R({
    factor_id: 'rates.relative-front-end-delta',
    label: 'Relative front-end delta',
    role: 'direction',
    brief: 'US against German and other G10 front ends, with each euro-area and UK leg named rather than implied.',
    dependencies: ['Access to a foreign front-end series that is genuinely observable at the cutoff.'],
    sources: ['Bundesbank 2Y series', 'Rates package USD-SESSION-A2']
  }),
  R({
    factor_id: 'rates.real-yield-delta',
    label: 'Real yield delta',
    role: 'direction',
    brief: '10Y and 5Y real yields and the breakeven split, separating the nominal and inflation parts of the move.',
    sources: ['FRED DFII10 and T10YIE', 'Rates package USD-SESSION-A2']
  }),
  R({
    factor_id: 'rates.term-premium-and-curve',
    label: 'Term premium and curve',
    role: 'regime',
    brief: '10Y minus 2Y slope, and whether the level or the change carries information across the session.',
    sources: ['FRED DGS10 and DGS2', 'Rates package USD-SESSION-A2']
  }),
  R({
    factor_id: 'rates.credit-spread-delta',
    label: 'Credit spread delta',
    role: 'regime',
    brief: 'High-yield spread change as a growth and risk proxy, with its overlap against the cross-asset risk card bounded.',
    sources: ['FRED high-yield spread series', 'Rates package USD-SESSION-A2']
  }),
  R({
    factor_id: 'calendar.known-releases-between-cutoff-and-endpoint',
    label: 'Known releases inside the window',
    role: 'quality gate',
    brief: 'Which releases are scheduled between the cutoff and the endpoint, and how a known-but-unreleased event may be used without using its outcome.',
    sources: ['Collector calendar feed (paid)', 'Rates package USD-SESSION-A2']
  }),
  R({
    factor_id: 'calendar.days-since-and-until-high-impact-events',
    label: 'Distance from high-impact events',
    role: 'regime',
    brief: 'Positioning measured as distance from known high-impact dates, using only the release calendar and never the surprise.',
    sources: ['Collector calendar feed (paid)', 'Rates package USD-SESSION-A2']
  }),
  R({
    factor_id: 'macro.release-surprise-at-first-print',
    label: 'Release surprise at first print',
    role: 'direction',
    brief: 'The honest test of the highest-weight live family. Asking for a first-print surprise with the consensus that was published before the release, and stating plainly if no such source is reachable.',
    blockers: ['No consensus or first-print vintage source is reachable from this repository: the ALFRED vintage CSV needs a key, and the live calendar feed stores no consensus snapshot.'],
    research_status: 'blocked',
    sources: ['Rates package USD-SESSION-A2', 'docs/research/usd-session/v1/inventory.md section 7'],
    history: [{ date: TODAY, version: 'v1', note: 'Package prepared and marked blocked on data access, not on effort. The card is still expected to report the honest answer.' }]
  })
];

const TASK_RULES = [
  'No production, workflow, dashboard, dispatcher, database or configuration change is authorised by this task.',
  'State an unavailable input plainly rather than substituting a proxy silently.',
  'Do not propose a threshold that cannot be computed from the data named in this package.',
  'Do not state a performance figure you have not measured, and do not quote one from memory.',
  'A card may conclude that the factor should not be used. That is a valid return.'
];

const CARD_SCHEMA_PATH = 'docs/research/usd-session/v1/research-card.schema.json';
const CARD_SCHEMA_FIELDS = [
  'card_id', 'schema_version', 'created_at', 'author', 'status', 'title', 'family', 'assignment_id',
  'session_horizon', 'calendar_and_quote_handling', 'mechanism', 'direction_claim', 'session_role',
  'observable_by_cutoff', 'reaction_vs_predictive', 'historical_data_requirements', 'live_data_requirements',
  'dependencies_and_overlap', 'hypothesis', 'parameters', 'rejection_test', 'evidence', 'open_questions'
];
const ISSUE_SCHEMA_PATH = 'docs/research/usd-session/v1/review-issue-register.schema.json';


const DATA_INFORMATION = [
  'No intraday dollar index print exists in this repository or in the live collector, so the cutoff and endpoint prices are unverified at both ends.',
  'The live collector takes one snapshot per day at the 09:30 ET pipeline time and prices the dollar with FRED DTWEXBGS, a daily index the Federal Reserve publishes in H.10 on Mondays at 16:15 ET for the previous business week, which leaves it two to six business days old at the 05:00 London cutoff (median four); the shorter one to two business-day figure is the FRED refresh lag, not the availability lag.',
  'Hourly OANDA caches exist for EUR/USD, XAU/USD and NAS100 only, and only to 2026-04-30.',
  'Daily macro series (FRED and Bundesbank) are the previous close at 05:00 London, correctly lagged, never the same morning.',
  'The paid calendar feed stores no consensus snapshot and no release-instant vintage.',
  'Full inventory: docs/research/usd-session/v1/inventory.md sections 2 and 7; cached-input manifest: data/usd-24h-dataset-manifest.json.'
];

function header(taskId, title, kindLine) {
  return [
    `TASK ${taskId} - ${title}`,
    kindLine,
    '',
    'You are writing for one reader who trades the US dollar and needs to know what is actually true, not what sounds plausible.',
    '',
    `Objective. ${SESSION_OBJECTIVE}`,
    'Cutoff: 05:00 Europe/London. Endpoint: 05:00 Europe/London on the next local date: one 24-hour session whose two ends are wall-clock times in the same zone. New York is not part of the session definition and is kept only for the timing of the Federal Reserve H.10 release. A session starts on a Monday-to-Friday local date only; the London spring and autumn transitions fall inside the preceding Saturday start, which is not a session, so every eligible session is exactly 24 hours.',
    'Intended label instrument: DXY. Its quote source is NOT yet verified. If a claim is really about EUR/USD, a basket, or any other instrument, name that instrument and say so. Never present a different instrument as if it were DXY.',
    'Everything must be observable at 05:00 London: a value published after the cutoff may not be used, and a later revision may not be used as if it were the first print.'
  ].join('\n');
}

function fieldPrompt({ taskId, title, packets, cards, familyLine, closing }) {
  return [
    header(taskId, title, `Field research package. Return one research card per card id listed below.`),
    '',
    `Families in scope: ${familyLine}.`,
    '',
    'Card ids to return:',
    ...cards.map(card => `- ${card}`),
    '',
    `Output schema: ${CARD_SCHEMA_PATH} (usd-session-research-card-v2), one JSON document per card, carrying every one of: ${CARD_SCHEMA_FIELDS.join(', ')}. A card that leaves a required field empty is not accepted.`,
    '',
    'Every card must answer, in its own words: the session horizon it is written for, stated once in the card\'s own session_horizon block, and the DST, weekend and missing-quote handling in calendar_and_quote_handling; the mechanism that would operate inside this specific 24-hour London-to-London window; when the relation changes sign, weakens, or stops being informative because it is already priced; whether the factor is direction, regime context, a quality gate or an abstention gate; what exactly was observable at the cutoff and how stale each input is; the programmable hypothesis with its bounded parameter values; the result that would falsify it; and which other cards share the same information and what would be double-counted.',
    '',
    packets,
    '',
    'Rules.',
    ...TASK_RULES.map(rule => `- ${rule}`),
    '',
    closing
  ].join('\n');
}

function reviewPrompt({ taskId, title, lens, subject, extra, closing }) {
  return [
    header(taskId, title, `Independent review package. ${lens}`),
    '',
    subject,
    '',
    extra,
    '',
    `Output schema: ${ISSUE_SCHEMA_PATH}, one entry per objection, with severity, the evidence or missing evidence it rests on, the remedy and the test that would falsify it.`,
    `The cards under review follow ${CARD_SCHEMA_PATH} (usd-session-research-card-v2): use it to check that each card answers every required field, including its own session_horizon and calendar_and_quote_handling blocks, and say so when one does not.`,
    '',
    'Return a review with, for every objection: its severity, the exact evidence or missing evidence it rests on, the remedy, and the test that would falsify the objection. Do not soften an objection because the coordinator may dislike it, and do not manufacture one to look thorough.',
    '',
    'Rules.',
    ...TASK_RULES.map(rule => `- ${rule}`),
    '- You are one of two independent reviewers. Do not assume what the other reviewer will say, and do not write as if your acceptance were the last step.',
    '',
    closing
  ].join('\n');
}

function synthesisPrompt({ taskId, title, subject, closing }) {
  return [
    header(taskId, title, 'Synthesis package. Combine the field cards and both reviews into one engine specification and one open-issue register.'),
    '',
    subject,
    '',
    'Return: the engine specification (which cards survive, in what role and with what bounded parameters); the open-issue register using docs/research/usd-session/v1/review-issue-register.schema.json; the conflicts between the two reviewers that you could NOT resolve and why; an explicit list of what remains unverifiable from repository-reachable data; and the smallest set of decisions only the user can take.',
    `The cards and reviews you combine follow ${CARD_SCHEMA_PATH} (usd-session-research-card-v2) and ${ISSUE_SCHEMA_PATH}; keep both shapes so the synthesis can be checked mechanically.`,
    '',
    'Rules.',
    ...TASK_RULES.map(rule => `- ${rule}`),
    '- Where the reviewers disagree and the evidence does not settle it, say so. Do not average two positions into a third that neither reviewer supports.',
    '- Nothing you write becomes a live rule. This synthesis is a research artefact.',
    '',
    closing
  ].join('\n');
}

const IMPLEMENTATION_EXCERPT = [
  'Deployed 24h weights as coded in Calculate USD Conviction, workflow OCt1tB9yVMUgFTha (the executing version is v155 since 2026-10-12, the audited export was measured at v154 on 2026-10-11): F1 10, F2 14, F3 10,',
  'F4 10, F5 14, F6 4, F7 24, F8 12, F9 1, F10 1, sum 100.',
  'Aggregation: the weights of BULLISH and BEARISH factors become bullish and bearish; active = bullish + bearish;',
  'bullishArgument = round(bullish / active * 100); netEdge = bullishArgument - bearishArgument; direction is the larger',
  'side, suffixed _LEAN when the absolute net edge is below 20, NO_CLEAR_BIAS on an exact tie; conviction is the winning',
  'argument percentage, so conviction is a share of ACTIVE evidence and can read 100 per cent while half the weight is missing.',
  'Missing factor input: that factor scores NEUTRAL and its weight moves to the neutral pile. The node strips raw inputs before the write.'
].join('\n');

const RULEBOOK_EXCERPT = [
  'logic/agent_usd_direction.md, version 2.1, fetched live from GitHub on every run and read by the model.',
  'Its own weight table reads 10, 14, 16, 14, 6, 5, 3, 18, 12, 2 - a different allocation of the same total from the code above.',
  'Documented in the rulebook but NOT implemented in the code: the VIX 1d and 5d modifiers, the stronger-message-wins conflict',
  'rule, F8 as a delta, and the participation cap, missing-input penalty, conflict penalty and agreement boost, which the code',
  'hard-codes to zero or to active.',
  'The rulebook cites no book, edition or external source, so the factor set has no provenance in this repository.'
].join('\n');

const DEFAULT_DELIVERABLE = {
  format: 'one JSON document per card following docs/research/usd-session/v1/research-card.schema.json, collected into a single file per task',
  location: 'returned to the user, then uploaded against this task id in the Research Library',
  must_also_return: 'a short note listing every source fetched with its link, and any question the task could not resolve'
};

const packetBlock = () => [
  'Data that is reachable today, stated once so no card has to guess:',
  ...DATA_INFORMATION.map(line => `- ${line}`)
].join('\n');

const A1_CARD_IDS = A1_FACTORS.map(factor => factor.factor_id);
const A2_CARD_IDS = A2_FACTORS.map(factor => factor.factor_id);
const ALL_RESEARCH_CARD_IDS = [...A1_CARD_IDS, ...A2_CARD_IDS];

const TASKS = [
  {
    task_id: 'USD-SESSION-A1',
    title: 'USD price behaviour and risk conditions at the 05:00 London cutoff',
    kind: 'field_research',
    asset: 'USD',
    slot: 'field-model-1',
    status: 'ready',
    context_version: 'usd-session-context-20261013.1',
    covers: A1_CARD_IDS,
    gaps: [
      'No rates, release or calendar card is in this package; those belong to the rates package.',
      'The label instrument and quote source is unverified, so every claim must name the instrument it is actually about.'
    ],
    depends_on: [],
    session_objective: SESSION_OBJECTIVE,
    implementation_excerpt: IMPLEMENTATION_EXCERPT,
    rulebook_excerpt: RULEBOOK_EXCERPT,
    data_information: DATA_INFORMATION,
    deliverable: DEFAULT_DELIVERABLE,
    rules: TASK_RULES,
    prompt: fieldPrompt({
      taskId: 'USD-SESSION-A1',
      title: 'USD price behaviour and risk conditions at the 05:00 London cutoff',
      familyLine: 'USD price behaviour, risk conditions',
      cards: A1_CARD_IDS,
      packets: packetBlock(),
      closing: 'Return the cards only. Do not propose a trading rule, a position size, a probability, or a performance figure. The reader decides what, if anything, becomes a rule.'
    })
  },
  {
    task_id: 'USD-SESSION-A2',
    title: 'Rates, policy expectations, releases and calendar context',
    kind: 'field_research',
    asset: 'USD',
    slot: 'field-model-2',
    status: 'ready',
    context_version: 'usd-session-context-20261013.1',
    covers: A2_CARD_IDS,
    gaps: [
      'No price-behaviour or risk-regime card is in this package.',
      'Consensus and first-print vintages may be unreachable; the surprise card must report that plainly rather than substitute a proxy.'
    ],
    depends_on: [],
    session_objective: SESSION_OBJECTIVE,
    implementation_excerpt: IMPLEMENTATION_EXCERPT,
    rulebook_excerpt: RULEBOOK_EXCERPT,
    data_information: DATA_INFORMATION,
    deliverable: DEFAULT_DELIVERABLE,
    rules: TASK_RULES,
    prompt: fieldPrompt({
      taskId: 'USD-SESSION-A2',
      title: 'Rates, policy expectations, releases and calendar context',
      familyLine: 'foreign rates and policy expectations, macroeconomic releases, calendar context',
      cards: A2_CARD_IDS,
      packets: packetBlock(),
      closing: 'If the consensus that was published before a release cannot be reached, say so and say what that costs the family. Do not reconstruct a consensus from memory and do not present a later revision as a first print.'
    })
  },
  {
    task_id: 'USD-SESSION-A3',
    title: 'Reviewer A: mechanisms, signs, timing, interactions and double counting',
    kind: 'review',
    asset: 'USD',
    slot: 'reviewer-a',
    status: 'not_started',
    context_version: 'usd-session-context-20261013.1',
    covers: ALL_BRIEF_FACTOR_IDS,
    gaps: [
      'This review cannot start until all twenty-five briefs have returned their cards: the fifteen session cards from the two field packages, and the ten baseline-audit cards from the handoff bundle tasks USD-BASELINE-AUDIT-01 to USD-BASELINE-AUDIT-10.',
      'Reviewer A is kept blind to Reviewer B, and neither sees the coordinator expectations.'
    ],
    depends_on: ['USD-SESSION-A1', 'USD-SESSION-A2'],
    session_objective: SESSION_OBJECTIVE,
    implementation_excerpt: IMPLEMENTATION_EXCERPT,
    rulebook_excerpt: RULEBOOK_EXCERPT,
    data_information: DATA_INFORMATION,
    deliverable: {
      format: 'a review using docs/research/usd-session/v1/review-issue-register.schema.json, one entry per objection',
      location: 'returned to the user, then uploaded against this task id in the Research Library',
      must_also_return: 'a one-paragraph verdict per card: keep, keep with conditions, or drop, with the reason'
    },
    rules: TASK_RULES,
    prompt: reviewPrompt({
      taskId: 'USD-SESSION-A3',
      title: 'Reviewer A: mechanisms, signs, timing, interactions and double counting',
      lens: 'Lens: economic and market mechanism. Judge whether each proposed card would actually operate inside this 24-hour London-to-London session.',
      subject: 'Subject: all twenty-five briefs taken as written, in two halves. The fifteen session-research cards returned by the two field packages, and the ten baseline-audit cards returned against the deployed factors (F1 VIX level, F2 US 2Y delta, F3 US-DE 2Y spread delta, F4 real yield delta, F5 DXY delta, F6 gold delta, F7 economic surprise, F8 Fed bias, F9 dollar smile, F10 equity versus USD) from the handoff bundle packs under docs/research/handoff/usd/v1/packs/. Read them as claims to be attacked rather than as findings to be summarised.',
      extra: [
        'For every card ask: is the stated mechanism true, and is it true on this horizon rather than on a daily or monthly one; is the sign right and does it flip in any plausible regime; is the timing right, that is when inside the window does it act; is the information already in the price by 05:00 London; and which other card carries the same information, so that weighting both would double-count one idea.',
        'Then work the overlaps across the whole set of twenty-five, not card by card: the deployed baseline audits already overlap each other (F2 with F3, F3 with F4, F4 with F6, F1 with F9 and F10, and the F7 and F8 pair), and the session cards overlap the deployed ones wherever they read the same quantity (session rates against F2 to F4, the session VIX and cross-asset cards against F1, F9 and F10, the session calendar cards against F7, and the session momentum and range cards against F5). Name every pair or group you judge to be one idea, say which member should carry it, and say what the discarded members would still add.',
        'Name any card whose mechanism you believe is simply wrong, and say what evidence would settle it.',
        'If the card set misses a mechanism that matters on this window, say which and why, but do not write the missing card yourself.'
      ].join('\n\n'),
      closing: 'Return the issue register and the per-card verdicts. Do not rewrite the cards and do not propose weights.'
    })
  },
  {
    task_id: 'USD-SESSION-A4',
    title: 'Reviewer B: data availability, leakage, statistical design, fidelity and overfitting',
    kind: 'review',
    asset: 'USD',
    slot: 'reviewer-b',
    status: 'not_started',
    context_version: 'usd-session-context-20261013.1',
    covers: ALL_BRIEF_FACTOR_IDS,
    gaps: [
      'This review cannot start until all twenty-five briefs have returned their cards: the fifteen session cards from the two field packages, and the ten baseline-audit cards from the handoff bundle tasks USD-BASELINE-AUDIT-01 to USD-BASELINE-AUDIT-10.',
      'The evaluation design it must approve is a proposal in docs/research/usd-session/v1/implementation_plan.md; no candidate may be scored before this approval is recorded.'
    ],
    depends_on: ['USD-SESSION-A1', 'USD-SESSION-A2'],
    session_objective: SESSION_OBJECTIVE,
    implementation_excerpt: IMPLEMENTATION_EXCERPT,
    rulebook_excerpt: RULEBOOK_EXCERPT,
    data_information: DATA_INFORMATION,
    deliverable: {
      format: 'a review using docs/research/usd-session/v1/review-issue-register.schema.json, plus a separate decision on the frozen evaluation design',
      location: 'returned to the user, then uploaded against this task id in the Research Library',
      must_also_return: 'for the evaluation design: approved, approved with conditions, or refused, with the exact clause you would change and why'
    },
    rules: TASK_RULES,
    prompt: reviewPrompt({
      taskId: 'USD-SESSION-A4',
      title: 'Reviewer B: data availability, leakage, statistical design, fidelity and overfitting',
      lens: 'Lens: data and method. Judge whether each card could be tested honestly with the data that actually exists.',
      subject: 'Subject: all twenty-five briefs, plus the proposed frozen evaluation design. The fifteen session-research cards from the two field packages, and the ten baseline-audit cards returned against the deployed factors F1 to F10 from the handoff bundle packs under docs/research/handoff/usd/v1/packs/.',
      extra: [
        'For every card ask: is the input genuinely available at 05:00 London, and at what publication lag; is any value used that could only be known later; is the parameter bounded tightly enough to avoid a fitted curve; is the stated falsifying test real; and does the card quietly depend on a proxy that changes what is being measured.',
        'Then judge the set as a whole rather than twenty-five times over: the twenty-five briefs read the same handful of series, so say which cards would be tested against the same series, which of them cannot be separated by any test the design allows, and how many independent comparisons the design actually buys once the overlaps are counted. Where two cards share a series, name the one you would keep and why.',
        'Then judge the evaluation design: the development, validation and holdout split, the flat band, the abstention rule, the scoring metric, the uncertainty reporting and the sealed set. Say approved, approved with conditions or refused, and name the clause you would change.',
        'Call out any card that cannot be tested at all with the data named in this package, and any card whose overlap with another makes it untestable in isolation.'
      ].join('\n\n'),
      closing: 'Return the issue register, the per-card verdicts and the decision on the evaluation design. No candidate may be scored until this decision is recorded.'
    })
  },
  {
    task_id: 'USD-SESSION-A5',
    title: 'Synthesis into one engine specification and one open-issue register',
    kind: 'synthesis',
    asset: 'USD',
    slot: 'synthesis',
    status: 'not_started',
    context_version: 'usd-session-context-20261013.1',
    covers: ALL_BRIEF_FACTOR_IDS,
    gaps: [
      'This task cannot start until both reviews are recorded.',
      'It produces a research artefact only: no weight, threshold or probability becomes live without the user.'
    ],
    depends_on: ['USD-SESSION-A3', 'USD-SESSION-A4'],
    session_objective: SESSION_OBJECTIVE,
    implementation_excerpt: IMPLEMENTATION_EXCERPT,
    rulebook_excerpt: RULEBOOK_EXCERPT,
    data_information: DATA_INFORMATION,
    deliverable: {
      format: 'one engine specification and one issue register (docs/research/usd-session/v1/review-issue-register.schema.json)',
      location: 'returned to the user, then uploaded against this task id in the Research Library',
      must_also_return: 'the unresolved conflicts between the two reviewers and the smallest set of decisions only the user can take'
    },
    rules: TASK_RULES,
    prompt: synthesisPrompt({
      taskId: 'USD-SESSION-A5',
      title: 'Synthesis into one engine specification and one open-issue register',
      subject: 'Subject: all twenty-five field cards, Reviewer A, Reviewer B and the frozen evaluation design. The ten baseline-audit cards sit alongside the fifteen session cards here: the deployed set is in the specification because its sign, weight, threshold and lookback have to be either justified or replaced by the same evidence standard, and because it is where the overlaps with the session cards actually bite. Produce the specification the briefs and the reviews jointly support, which is likely to be smaller than the twenty-five cards.',
      closing: 'Return the specification, the issue register, the conflicts you could not resolve, what remains unverifiable, and the decisions only the user can take.'
    })
  }
];

const USD_ASSET = {
  asset: 'USD',
  label: 'US Dollar',
  standfirst: 'The first asset in the library and the only one with factors under research today.',
  status: 'active',
  next_step: "Work one factor chain at a time through its three stages. Stage 1: open the factor's chain row, copy the research prompt and run it in your own session, then upload the one Markdown report against that chain. Stage 2: download the exact research version the card names, run the red-team prompt, upload the review. Stage 3: download both documents, run the adjudication prompt, upload the conclusion. The final asset-level chain stays locked until every one of the twenty-five factor chains is complete; the topic labels group chains and own no stage. The legacy task list (USD-SESSION-A1 to A5) is kept as history and is not the workflow.",
  factors: [...LIVE_FACTORS, ...A1_FACTORS, ...A2_FACTORS],
  blockers: [
    'Label instrument and quote source unresolved: no free intraday DXY print exists in this checkout or in the collector, so the cutoff and endpoint prices are unverified at both ends.',
    'Reviewer B has not approved the frozen evaluation design, so no candidate may be scored.',
    'The rulebook cites no book or edition, so the factor set has no provenance in this repository.',
    'Consensus and first-print vintages sit behind paid feeds, which is why two live factors and one research card are blocked.',
    'The five task prompts are external work: this repository prepares them, it does not run them.'
  ],
  note: 'This library changes nothing about the live engine. The deployed USD node still computes its ten factors with the coded weight vector while the rulebook it reads declares a different one.'
};

const OTHER_ASSETS = [
  {
    asset: 'EUR',
    label: 'Euro',
    standfirst: 'No EUR session research has started. Nothing from the USD programme transfers by default.',
    status: 'not_started',
    next_step: 'Wait for the USD final chain to complete, then decide per asset whether the same question is asked.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'No USD sign, weight, threshold or factor transfers to another asset without its own research.'
  },
  {
    asset: 'GBP',
    label: 'British Pound',
    standfirst: 'No GBP session research has started.',
    status: 'not_started',
    next_step: 'Wait for the USD final chain.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'No USD result transfers here.'
  },
  {
    asset: 'GOLD',
    label: 'Gold',
    standfirst: 'No gold session research has started in this programme; the gold backtesting lane keeps its own scope.',
    status: 'not_started',
    next_step: 'Keep the existing gold lane scope until the USD final chain says what is worth repeating.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'Gold keeps its own horizon policy and backtesting loop.'
  },
  {
    asset: 'SILVER',
    label: 'Silver',
    standfirst: 'No silver session research has started.',
    status: 'not_started',
    next_step: 'Wait for the USD final chain.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'No USD result transfers here.'
  },
  {
    asset: 'NQ',
    label: 'Nasdaq 100',
    standfirst: 'No NQ session research has started.',
    status: 'not_started',
    next_step: 'Wait for the USD final chain.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'The only NQ input in the live USD collector is a QQQ quote, which is an ETF, not the index.'
  },
  {
    asset: 'BTC',
    label: 'Bitcoin',
    standfirst: 'No BTC session research has started.',
    status: 'not_started',
    next_step: 'Wait for the USD final chain.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'No USD result transfers here.'
  },
  {
    asset: 'WTI',
    label: 'Crude Oil (WTI)',
    standfirst: 'No WTI session research has started.',
    status: 'not_started',
    next_step: 'Wait for the USD final chain.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'No USD result transfers here.'
  }
];

// Whole-engine reviews, synthesis documents and experiment results live here rather than under a
// single factor, because they judge the engine as a whole.
const ENGINE_DOCUMENTS = [
  {
    document_id: 'usd-session-label-instrument-decision',
    title: 'Label instrument and quote source decision',
    document_type: 'brief',
    status: 'blocked',
    updated_at: TODAY,
    asset: 'USD',
    note: 'The decision is the user\u2019s. The source assessment in docs/research/usd-session/v1/target_source_assessment.md returns a recommendation and purchases nothing.',
    repo_path: 'docs/research/usd-session/v1/target_source_assessment.md'
  },
  {
    document_id: 'usd-session-evaluation-design-approval',
    title: 'Reviewer B decision on the frozen evaluation design',
    document_type: 'review',
    status: 'pending',
    updated_at: TODAY,
    asset: 'USD',
    task_id: 'USD-SESSION-A4',
    note: 'No candidate may be scored before this decision is recorded. The design proposed for approval is docs/research/usd-session/v1/implementation_plan.md sections 4 and 5.'
  },
  {
    document_id: 'usd-session-reviewer-a-report',
    title: 'Reviewer A: mechanisms, signs, timing, interactions, double counting',
    document_type: 'review',
    status: 'not_started',
    updated_at: TODAY,
    asset: 'USD',
    task_id: 'USD-SESSION-A3',
    note: 'Starts only after both field packages return.'
  },
  {
    document_id: 'usd-session-reviewer-b-report',
    title: 'Reviewer B: data availability, leakage, statistical design, fidelity, overfitting',
    document_type: 'review',
    status: 'not_started',
    updated_at: TODAY,
    asset: 'USD',
    task_id: 'USD-SESSION-A4',
    note: 'Starts only after both field packages return.'
  },
  {
    document_id: 'usd-session-synthesis-v1',
    title: 'Synthesis: one engine specification and one open-issue register',
    document_type: 'synthesis',
    status: 'not_started',
    updated_at: TODAY,
    asset: 'USD',
    task_id: 'USD-SESSION-A5',
    note: 'Registered separately from the two reviews, as the brief asks.'
  },
  {
    document_id: 'usd-24h-study-results',
    title: 'Closed 24-hour improvement study: results',
    document_type: 'experiment',
    status: 'closed',
    updated_at: '2026-10-12',
    asset: 'USD',
    note: 'The measured answer to a different question: its endpoint was the next session close, 30.5 hours at the median, not a 24-elapsed-hour window.',
    repo_path: 'docs/review/usd-24h-ruleset-v1/USD_24H_IMPROVEMENT_RESULTS.md',
    hash_note: 'Not hashed here: this file carries unrelated uncommitted edits from another workstream, and this programme deliberately leaves it alone.'
  },
  {
    document_id: 'usd-24h-study-experiment-registry',
    title: 'Closed 24-hour study: 93 configuration registry',
    document_type: 'experiment',
    status: 'closed',
    updated_at: '2026-10-12',
    asset: 'USD',
    registered_document_id: 'usd-24h-experiment-registry'
  },
  {
    document_id: 'usd-24h-study-selection',
    title: 'Closed 24-hour study: predeclared selection result',
    document_type: 'experiment',
    status: 'closed',
    updated_at: '2026-10-12',
    asset: 'USD',
    registered_document_id: 'usd-24h-selection'
  }
];
// REPO_DOC_ANCHOR
const REPO_DOCUMENTS = [
  { document_id: 'usd-session-inventory', title: 'USD input and decision inventory (WP1)', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/inventory.md', note: 'Every input, rule, threshold and fallback extracted from the deployed node.' },
  { document_id: 'usd-session-contract', title: 'Session target contract v1', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/session_contract_v1.json', note: 'The 05:00 London to 05:00 London on the next local date target (24 hours, corrected 2026-10-14), with the label decision left open.' },
  { document_id: 'usd-session-exposed-periods', title: 'Exposed periods record', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/exposed_periods.md', note: 'What has already been read, so nothing is later called unseen.' },
  { document_id: 'usd-session-implementation-plan', title: 'Implementation and experiment plan', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/implementation_plan.md', note: 'Includes the evaluation design Reviewer B must approve.' },
  { document_id: 'usd-session-isolation', title: 'Isolation note', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/isolation.md', note: 'What actually stops a research run writing into production.' },
  { document_id: 'usd-session-checkpoint-1', title: 'Checkpoint 1', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/CHECKPOINT_1.md', note: 'The first checkpoint return.' },
  { document_id: 'usd-session-checkpoint-2', title: 'Checkpoint 2', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/CHECKPOINT_2.md', note: 'This cycle: macro inventory, source assessment, weight vectors and the research library.' },
  { document_id: 'usd-session-checkpoint-3', title: 'Checkpoint 3: the session-horizon correction', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/CHECKPOINT_3.md', note: 'The 2026-10-14 correction to 05:00 London to 05:00 London on the next local date, the engine and card-schema version bumps, and the re-measured overlap with the closed 24-hour study.' },
  { document_id: 'usd-session-card-schema', title: 'Research card schema', document_type: 'context_package', repo_path: 'docs/research/usd-session/v1/research-card.schema.json', note: 'The schema every returned card must follow.' },
  { document_id: 'usd-session-issue-schema', title: 'Review issue register schema', document_type: 'context_package', repo_path: 'docs/research/usd-session/v1/review-issue-register.schema.json', note: 'The schema every reviewer return must follow.' },
  { document_id: 'usd-session-target-source-assessment', title: 'DXY and intraday source assessment', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/target_source_assessment.md', note: 'Coverage, cutoff and endpoint quotes, access, licensing and cost, with a recommendation.' },
  { document_id: 'usd-session-weight-discrepancy', title: 'Weight vector discrepancy', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/weight_vector_discrepancy.md', note: 'Where each weight vector is stored, which calculation uses it, and what both-are-live means.' },
  { document_id: 'usd-session-macro-data-inventory', title: 'Macro data inventory and as-of feature preparation', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/macro_data_inventory.md', note: 'Publication timing, revisions, missingness and live versus historical availability for the target-independent macro series.' },
  { document_id: 'research-library-readme', title: 'Research Library design and operations', document_type: 'brief', repo_path: 'docs/research-library/README.md', note: 'Storage, retrieval, manifest, authentication and the preview instructions.' },
  { document_id: 'usd-24h-experiment-registry', title: 'Closed 24-hour study: 93 configuration registry', document_type: 'experiment', repo_path: 'data/usd-24h-experiment-registry.json', note: 'Every configuration tested by the closed study, including the deployed baseline.' },
  { document_id: 'usd-24h-selection', title: 'Closed 24-hour study: predeclared selection result', document_type: 'experiment', repo_path: 'data/usd-24h-selection.json', note: 'The selected candidate under the predeclared filters, and the evidence classification.' }
].map(entry => ({
  asset: 'USD',
  factor_id: null,
  task_id: null,
  model: null,
  updated_at: TODAY,
  ...entry
}));

// The twenty-five self-contained research briefs, one per USD factor, generated and hashed by
// scripts/build_research_handoff.js and published here as repo-backed documents. The library is the second
// place the same briefs appear: the handoff bundle is the artefact a reader downloads, and these rows are
// what the factor page offers as Copy prompt and Download. The bytes are the same file, so the registry
// hash and the bundle's own manifest hash cover one set of bytes rather than two copies of the text.
const BRIEF_DOCUMENTS = Handoff.factorBriefRows().map(row => ({
  document_id: `usd-brief-${row.factor_id.replace(/^live\./, '').replace(/\./g, '-')}`,
  title: `${row.label} - research brief`,
  document_type: 'brief',
  asset: 'USD',
  factor_id: row.factor_id,
  task_id: row.live ? null : row.task_id,
  model: null,
  updated_at: TODAY,
  repo_path: row.pack_path,
  brief_kind: row.live ? 'baseline_audit' : 'research_assignment',
  brief_position: row.position,
  note: row.live
    ? 'Baseline audit brief: what the deployed node computes for this factor, and what would have to be shown before its sign, weight, threshold and lookback are treated as justified.'
    : 'Research brief: the factor, the session context, the research prompt and the output instructions. No rule is in force for it, and a returned card is evidence rather than an approval.'
}));

// Every document the registry seeds: the repository artefacts plus the per-factor briefs. Both lists are
// hashed from the file on disk when the registry is written, so a corrected brief becomes a new version.
const REGISTRY_DOCUMENTS = [...REPO_DOCUMENTS, ...BRIEF_DOCUMENTS];

// ---------------------------------------------------------------------------------------------
// Factor chains: one factor, three numbered stages
//
// A factor chain is the unit a reader works on. It names its factor and its topic label, the three
// prompts in order, and the document type each stage returns. The prompts are generated from this file,
// so a prompt cannot drift from the catalogue, and each prompt's hash goes into the catalogue so the
// page can say which prompt was copied. Nothing here authorises a model call: a prompt is copied by
// hand into the reader's own session, and the returned document is uploaded by hand as evidence.
// ---------------------------------------------------------------------------------------------

// Research is factor-scoped: prompts live under one folder per factor chain, and the gated asset-level
// chain has its own folder so the final analysis is never mistaken for a factor review.
const FACTOR_DIR = 'docs/research/factors/usd';
const FINAL_DIR = 'docs/research/final/usd';
const DEEP_RESEARCH_DIR = 'docs/research/handoff/usd/v1/deep-research';
const VIX_DISPATCHED_BRIEF = `${DEEP_RESEARCH_DIR}/VIX_COMPREHENSIVE_REPORT_BRIEF.md`;
const CONTEXT_PACK_NEUTRAL = `${DEEP_RESEARCH_DIR}/CONTEXT_PACK_NEUTRAL.md`;
const FACTOR_STAGE_ORDER = { research: 1, red_team: 2, adjudication: 3 };
const FINAL_STAGE_ORDER = { final_analysis: 1, final_red_team: 2, final_adjudication: 3 };
const FINAL_STAGE_META = {
  final_analysis: {
    label: 'Final analysis',
    document_type: 'synthesis',
    deliverable: 'One Markdown asset-level synthesis over every factor-chain adjudication: what survives, what conflicts, the candidate specification and its validation plan, and what cannot be tested here.',
    returns: 'The adjudications reconciled; where the factor chains agree and conflict; the entries that survive, merge or drop; the candidate specification; the unvalidated parameters named as parameters; the validation plan; what would falsify it; the data gaps; sources.'
  },
  final_red_team: {
    label: 'Final red-team',
    document_type: 'review',
    deliverable: 'One Markdown independent challenge to the final analysis: every load-bearing claim quoted, given a verdict, a severity and the evidence that would settle it.',
    returns: 'The issue register; specification and validation-plan defects; what the proposal gets right; what is unvalidated but presented as settled; what a corrected version would change and what it should not; sources.'
  },
  final_adjudication: {
    label: 'Final adjudication',
    document_type: 'synthesis',
    deliverable: 'One Markdown adjudication of the final analysis and the red-team findings, ending with the complete candidate Layer 1 logic for an isolated backtest.',
    returns: 'The decision register; the accepted specification and validation plan; the complete candidate Layer 1 logic with every parameter marked measured or unvalidated; the acceptance criterion and the condition that would abandon the model; unresolved items; decisions reserved to the user; what the handoff does not claim; sources.'
  }
};
function stageMeta(stageId) {
  return FINAL_STAGE_META[stageId] || FACTOR_STAGE_META[stageId];
}
function stageOrder(stageId) {
  return FINAL_STAGE_ORDER[stageId] || FACTOR_STAGE_ORDER[stageId];
}
// Factor chains run the three research stages; the gated asset-level chain runs analysis, red-team, adjudication.
const FACTOR_STAGE_IDS = Object.keys(FACTOR_STAGE_ORDER);
const FINAL_STAGE_IDS = Object.keys(FINAL_STAGE_ORDER);

const FACTOR_STAGE_META = {
  research: {
    label: 'Research',
    document_type: 'report',
    deliverable: 'One Markdown report: the assignment answered in full, with the sources as the closing section inside the same document.',
    returns: 'The sections the prompt fixes, in order, each answered or named unanswerable, with the sample behind every claim, an explicit what-could-not-be-established section and a closing sources section.'
  },
  red_team: {
    label: 'Red-team',
    document_type: 'review',
    deliverable: 'One Markdown issue register: every load-bearing claim quoted, given a verdict, a severity and the evidence that would settle it.',
    returns: 'The issue register; what the report gets right; what it cannot support and what you could not check; window, instrument, timing and inference defects; the double counting it leaves unaddressed; the corrected version of the strongest surviving claim; sources.'
  },
  adjudication: {
    label: 'Adjudication',
    document_type: 'synthesis',
    deliverable: 'One Markdown adjudication: corrected conclusions, a decision on every material objection, the required tests and a handoff to the asset synthesis.',
    returns: 'The decision register; the corrected conclusion for the chain; what the chain rules out; unresolved items; the proposed treatment with every unvalidated parameter named; required tests and blockers; input ownership across chains; the handoff to the asset synthesis; sources.'
  }
};

// The session every stage is written for. It is repeated in every prompt because a prompt has to stand alone.
// The topic labels. Every USD factor sits in exactly one label, and a label may name the other labels it
// interacts with. The label carries shared context and probes only; the chain under each factor owns the
// stages and the evidence. The VIX label carries the one dispatched brief, which is attached to the F1 chain's
// stage 1 prompt.
const TOPIC_MAP = [
  {
    topic_id: 'usd-topic-vix-level-and-risk-regime',

    slug: 'vix-level-and-risk-regime',
    title: 'VIX, its change and the USD risk regime at the 05:00 London cutoff',
    summary: 'Whether the VIX level, its one-day change or a longer change says anything about the direction of the dollar over the next 24-hour London-to-London session, and what those quantities interact with.',
    factor_ids: ['live.f1-vix-level', 'risk.vix-level-and-change-at-cutoff'],
    overlaps: ['usd-topic-fx-session-structure'],
    dispatch: {
      state: 'dispatched',
      task_id: 'USD-BASELINE-AUDIT-01',
      pack_version: '2.0.0',
      context_version: 'usd-session-context-20261014.1',
      dispatched_at: '2026-10-15'
    },
    dispatched_brief_path: VIX_DISPATCHED_BRIEF,
    programme_red_team_path: `${DEEP_RESEARCH_DIR}/RED_TEAM_REVIEW_BRIEF.md`,
    companion_paths: [
      { repo_path: CONTEXT_PACK_NEUTRAL, role: 'the neutral context pack the brief asks the reader to work from' }
    ],
    pack_factor_ids: ['live.f1-vix-level', 'risk.vix-level-and-change-at-cutoff'],
    probes: [
      'Is the informative quantity the level, the one-day change or a five-day change, and does the answer differ between calm and stressed regimes?',
      'Does the volatility-of-volatility or term-structure information add anything the level does not already carry?',
      'Is the mechanism safe-haven demand, risk appetite, carry or policy expectations, and what observable at the cutoff distinguishes them?',
      'How much of the VIX move is already in the dollar at 05:00 Europe/London, and what is left for the following 24 hours?'
    ],
    next_step: 'The research report is registered on the usd-factor-live-f1-vix-level chain. Run that chain\'s stage 2 (red-team) against research version 1, then its stage 3 (adjudication). The sibling usd-factor-risk-vix-level-and-change-at-cutoff chain is still not started and is not advanced by that report.'
  },
  {
    topic_id: 'usd-topic-front-end-rates',
    slug: 'front-end-rates',
    title: 'US front-end rates, real yields and curve position',
    summary: 'Whether front-end rate changes, real yields, the US-DE spread and curve or credit measures carry information about the next 24-hour dollar move, at the level or in a delta.',
    factor_ids: ['live.f2-us-2y-delta', 'live.f3-us-de-2y-spread-delta', 'live.f4-real-yield-delta', 'rates.us-front-end-delta', 'rates.relative-front-end-delta', 'rates.real-yield-delta', 'rates.term-premium-and-curve', 'rates.credit-spread-delta'],
    overlaps: ['usd-topic-economic-surprise-and-fed-bias'],
    dispatch: { state: 'queued' },
    companion_paths: [
      { repo_path: 'docs/research/usd-session/v1/weight_vector_discrepancy.md', role: 'the two live weight vectors and where each is used' }
    ],
    pack_factor_ids: ['live.f2-us-2y-delta', 'live.f3-us-de-2y-spread-delta', 'live.f4-real-yield-delta', 'rates.us-front-end-delta', 'rates.relative-front-end-delta', 'rates.real-yield-delta', 'rates.term-premium-and-curve', 'rates.credit-spread-delta'],
    probes: [
      'Which of the eight entries is measuring something the others do not, and which pairs are the same information counted twice?',
      'Is the informative quantity the level, a five-day change or a same-session change, and does the answer depend on the policy cycle?',
      'Does a real-yield change add information beyond the nominal front end, and does that survive the inflation-expectation measurement problem?',
      'Are these relations already in the dollar by 05:00 Europe/London, given that the US cash market is closed at the cutoff?'
    ],
    next_step: 'Not dispatched. Each factor under this label has its own written and checked research prompt; open a chain and take its stage 1 prompt when the batch opens.'
  },
  {
    topic_id: 'usd-topic-dollar-index-gold-and-equities',
    slug: 'dollar-index-gold-and-equities',
    title: 'Dollar index, gold and equity-against-USD relations',
    summary: 'Whether the dollar index delta, gold and equity moves carry independent information about the next 24-hour dollar move, or restate the risk appetite the other topics already measure.',
    factor_ids: ['live.f5-dxy-delta', 'live.f6-gold-delta', 'live.f9-dollar-smile', 'live.f10-equity-versus-usd'],
    overlaps: ['usd-topic-vix-level-and-risk-regime', 'usd-topic-fx-session-structure'],
    dispatch: { state: 'queued' },
    companion_paths: [
      { repo_path: 'docs/research/usd-session/v1/target_source_assessment.md', role: 'DXY and intraday source coverage, access and cost' }
    ],
    pack_factor_ids: ['live.f5-dxy-delta', 'live.f6-gold-delta', 'live.f9-dollar-smile', 'live.f10-equity-versus-usd'],
    probes: [
      'Is the dollar smile a measured relation for this window, or a descriptive convenience: what would falsify it?',
      'Which dollar index is a claim actually about, and does the answer change with the index construction?',
      'Does a same-day dollar move followed by a session direction suggest mean reversion or continuation, and on what evidence?',
      'Are gold and equities independent evidence for the dollar, or the same risk factor counted twice?'
    ],
    next_step: 'Not dispatched. Each factor under this label has its own written and checked research prompt; open a chain and take its stage 1 prompt when the batch opens.'
  },
  {
    topic_id: 'usd-topic-economic-surprise-and-fed-bias',
    slug: 'economic-surprise-and-fed-bias',
    title: 'Economic surprises, first prints and Fed bias',
    summary: 'Whether release surprises, their first-print vintages and the realised-versus-signalled policy path explain the next 24-hour dollar move, and what part of that is already priced.',
    factor_ids: ['live.f7-economic-surprise', 'live.f8-fed-bias', 'macro.release-surprise-at-first-print'],
    overlaps: ['usd-topic-front-end-rates', 'usd-topic-calendar-and-data-quality'],
    dispatch: { state: 'queued' },
    companion_paths: [
      { repo_path: 'docs/research/usd-session/v1/macro_data_inventory.md', role: 'publication timing, revisions, missingness and live versus historical availability' }
    ],
    pack_factor_ids: ['live.f7-economic-surprise', 'live.f8-fed-bias', 'macro.release-surprise-at-first-print'],
    probes: [
      'Which surprise measure is defensible: survey consensus, model nowcast, or the market-implied move, and what does each one cost?',
      'Is the first print the only honest vintage, and what does the revision history of the tested series look like?',
      'Is Fed bias an observable at 05:00 Europe/London or a narrative, and what would an observable version look like?',
      'How much of a surprise is already in the dollar in the minutes after the print, and how do you separate that from the session that follows?'
    ],
    next_step: 'Not dispatched. Each factor under this label has its own written and checked research prompt; open a chain and take its stage 1 prompt when the batch opens.'
  },
  {
    topic_id: 'usd-topic-fx-session-structure',
    slug: 'fx-session-structure',
    title: 'Session structure, overnight range and safe-haven demand',
    summary: 'Whether the placement of the dollar inside its own range, session momentum and safe-haven or risk-on state carry information forward into the next 24-hour session.',
    factor_ids: ['fx.usd-session-momentum', 'fx.usd-overnight-range-position', 'fx.usd-session-volatility-regime', 'risk.usd-safe-haven-demand', 'risk.risk-on-off-cross-asset-state'],
    overlaps: ['usd-topic-vix-level-and-risk-regime', 'usd-topic-dollar-index-gold-and-equities'],
    dispatch: { state: 'queued' },
    companion_paths: [
      { repo_path: 'docs/research/usd-session/v1/session_contract_v1.json', role: 'the session contract the cutoff and endpoint come from' }
    ],
    pack_factor_ids: ['fx.usd-session-momentum', 'fx.usd-overnight-range-position', 'fx.usd-session-volatility-regime', 'risk.usd-safe-haven-demand', 'risk.risk-on-off-cross-asset-state'],
    probes: [
      'Is the range position a state variable or an artefact of when the session starts, and what does the start time do to it?',
      'Does session momentum survive the bid-ask bounce of a 24-hour window, and what measurement would separate them?',
      'Is safe-haven demand observable at the cutoff separately from risk-on/off, or is it the same input twice?',
      'Which instrument labels these factors, given that DXY has no verified intraday source?'
    ],
    next_step: 'Not dispatched. Each factor under this label has its own written and checked research prompt; open a chain and take its stage 1 prompt when the batch opens.'
  },
  {
    topic_id: 'usd-topic-calendar-and-data-quality',
    slug: 'calendar-and-data-quality',
    title: 'Calendar state and the data-quality gate',
    summary: 'Whether the release calendar and the collector data-quality state should inform the call, gate it, or abstain, and what that means for the 25 factor entries.',
    factor_ids: ['calendar.known-releases-between-cutoff-and-endpoint', 'calendar.days-since-and-until-high-impact-events', 'data.quality-gate-for-abstention'],
    overlaps: ['usd-topic-economic-surprise-and-fed-bias'],
    dispatch: { state: 'queued' },
    companion_paths: [
      { repo_path: 'docs/research/usd-session/v1/inventory.md', role: 'the input and decision inventory this topic closes out' }
    ],
    pack_factor_ids: ['calendar.known-releases-between-cutoff-and-endpoint', 'calendar.days-since-and-until-high-impact-events', 'data.quality-gate-for-abstention'],
    probes: [
      'Does a scheduled release inside the session change the expected direction, the expected dispersion, or only the confidence?',
      'What is the honest treatment when the collector input is stale or missing: abstain, shrink or score neutral?',
      'Which releases matter for the dollar over this window, and are the timestamps verifiable at the cutoff?',
      'Can an abstention rule be evaluated at all without a frozen label instrument, and what would it take?'
    ],
    next_step: 'Not dispatched. Each factor under this label has its own written and checked research prompt; open a chain and take its stage 1 prompt when the batch opens.'
  }
];

// buildCatalog is defined below; the topic map above only prepares grouping labels and prompt text.
function buildCatalog() {
  const built = buildChains();
  return {
    schema_version: 'research-library-catalog-v1',
    generated_at: TODAY,
    asset_order: ResearchLibrary.ASSET_ORDER.slice(),
    scope_note: 'Research management only. Preparing a task writes nothing to a model, uploading a report records evidence, and a returned report becomes a rule only after a review accepts it and a backtest supports it.',
    storage: STORAGE,
    tasks: TASKS,
    topics: built.topics,
    factor_chains: built.factor_chains,
    final_chain: built.final_chain,
    synthesis_topic: built.synthesis_topic,
    engine_documents: ENGINE_DOCUMENTS,
    repo_documents: REGISTRY_DOCUMENTS,
    research_briefs: {
      bundle: Handoff.OUT_DIR,
      generated_by: 'scripts/build_research_handoff.js',
      start_here_path: Handoff.START_HERE_PATH,
      index_path: Handoff.BRIEF_INDEX_PATH,
      download_path: Handoff.ZIP_PATH,
      document_prefix: 'usd-brief-',
      total: ALL_BRIEF_FACTOR_IDS.length,
      live_engine_audits: Handoff.LIVE_FACTORS.length,
      session_research: ALL_BRIEF_FACTOR_IDS.length - Handoff.LIVE_FACTORS.length,
      note: 'One self-contained brief per USD factor, carrying its context, its research prompt and its output instructions: a baseline audit for a factor the deployed node computes today, a research assignment for a factor with no rule in force. Covering every factor is not progress: a brief is an assignment, no research status moves because a brief exists, and a returned card is evidence rather than an approval.'
    },
    assets: [USD_ASSET, ...OTHER_ASSETS]
  };
}

const STORAGE_CONTRACT = {
  registry_path: 'data/research-library/documents.json',
  library_root: '.local/research-library',
  service_bind: '127.0.0.1',
  service_endpoint: STORAGE.service.default_endpoint,
  token_file: STORAGE.service.token_file,
  public_upload: false,
  public_download: false,
  immutable_versions: true,
  note: 'Repo-backed documents are published with the site and are downloadable by anyone. Uploaded reports are stored as research evidence outside Git and are readable only through the local authenticated service.'
};

function render(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hashFile(absPath) {
  const buffer = fs.readFileSync(absPath);
  return { sha256: crypto.createHash('sha256').update(buffer).digest('hex'), bytes: buffer.length };
}

// REGISTRY_ANCHOR
function seedRegistry(existing) {
  const registry = existing && Array.isArray(existing.documents)
    ? existing
    : { schema_version: 'research-library-documents-v1', storage_contract: STORAGE_CONTRACT, documents: [] };
  registry.schema_version = 'research-library-documents-v1';
  registry.storage_contract = STORAGE_CONTRACT;
  const byId = new Map(registry.documents.map(document => [document.document_id, document]));
  const problems = [];
  let added = 0;
  let versioned = 0;

  REGISTRY_DOCUMENTS.forEach(entry => {
    const absPath = path.join(root, entry.repo_path);
    if (!fs.existsSync(absPath)) {
      problems.push(`repo document ${entry.document_id} is missing: ${entry.repo_path}`);
      return;
    }
    const { sha256, bytes } = hashFile(absPath);
    const current = byId.get(entry.document_id);
    if (!current) {
      const document = {
        ...entry,
        origin: 'coordinator_repo',
        storage: 'repo_path',
        public_download: true,
        versions: [{ version: 1, sha256, bytes, registered_at: TODAY, note: 'first registration' }]
      };
      registry.documents.push(document);
      byId.set(document.document_id, document);
      added += 1;
      return;
    }
    Object.assign(current, entry, { origin: current.origin || 'coordinator_repo', storage: 'repo_path', public_download: true });
    const versions = Array.isArray(current.versions) ? current.versions : [];
    current.versions = versions;
    const latest = versions.reduce((best, item) => (best === null || Number(item.version) > Number(best.version) ? item : best), null);
    if (!latest) {
      versions.push({ version: 1, sha256, bytes, registered_at: TODAY, note: 'first registration' });
      versioned += 1;
      return;
    }
    if (latest.sha256 !== sha256) {
      versions.push({
        version: Number(latest.version) + 1,
        sha256,
        bytes,
        registered_at: TODAY,
        note: `content changed; version ${latest.version} kept immutable`
      });
      versioned += 1;
    }
  });

  registry.documents.sort((left, right) => {
    const leftUpload = left.storage === 'repo_path' ? 0 : 1;
    const rightUpload = right.storage === 'repo_path' ? 0 : 1;
    if (leftUpload !== rightUpload) return leftUpload - rightUpload;
    return String(left.document_id).localeCompare(String(right.document_id));
  });
  return { registry, problems, added, versioned };
}

function verifyRepoHashes(registry) {
  const problems = [];
  (registry?.documents || []).forEach(document => {
    if (document.storage !== 'repo_path') return;
    const absPath = path.join(root, document.repo_path || '');
    if (!fs.existsSync(absPath)) {
      problems.push(`document ${document.document_id} is repo-backed but ${document.repo_path} is missing`);
      return;
    }
    const { sha256 } = hashFile(absPath);
    const latest = ResearchLibrary.latestVersion(document);
    if (!latest || latest.sha256 !== sha256) {
      problems.push(`document ${document.document_id} hash mismatch: registry says ${latest ? latest.sha256 : 'nothing'}, file is ${sha256}`);
    }
  });
  return problems;
}

function report(label, problems) {
  if (problems.length === 0) {
    console.log(`${label}: ok`);
    return true;
  }
  console.log(`${label}: ${problems.length} problem(s)`);
  problems.forEach(problem => console.log(`  - ${problem}`));
  return false;
}

// Written from the chain map above, so the prompt files and the catalogue cannot disagree: the catalogue
// carries each prompt's hash, and the check command re-reads the files. Nothing here or anywhere else sends
// a prompt to a model. One writer serves both kinds of chain: a factor chain and the gated asset-level
// final chain differ only in their folder, identifiers and whether a dispatched brief sits behind stage 1.
// ---------------------------------------------------------------------------------------------
// Prompt rendering
//
// Every one of the seventy-eight chain prompts is rendered by lib/research_prompt_templates.js.
// The builder owns the facts - chain ids, factor entries, hashes, the gate - and the template owns
// every word, so a workflow instruction cannot survive in one chain after being removed from
// another. Nothing here sends a prompt to a model: a prompt is copied by hand and the returned
// document is uploaded by hand.
// ---------------------------------------------------------------------------------------------

// The final chain's catalogue stage ids are kept because the registry and the page key on them;
// the template calls the same three stages research, red_team and adjudication.
const TEMPLATE_STAGE = {
  research: 'research',
  red_team: 'red_team',
  adjudication: 'adjudication',
  final_analysis: 'research',
  final_red_team: 'red_team',
  final_adjudication: 'adjudication'
};

function chainDeliverable(chain, kind, stageId) {
  return Prompts.deliverableFileName({ asset: chain.asset, slug: chain.slug, kind, stage: TEMPLATE_STAGE[stageId] });
}

function factorEntryContext(chain, factor) {
  const entry = factor || {};
  return {
    factor_id: chain.factor_id,
    label: chain.factor_label,
    brief: entry.brief || chain.summary,
    role: chain.factor_role,
    group: chain.factor_group,
    research_status: entry.research_status || 'not stated',
    current_rules: entry.current_rules || [],
    threshold: entry.threshold,
    lookback: entry.lookback,
    sources: entry.sources || [],
    blockers: entry.blockers || [],
    pack: (chain.packs || [])[0]
  };
}

function givenDocuments(chain, kind, stageId, factorChains) {
  if (kind === 'factor') {
    const report = {
      file_name: chainDeliverable(chain, 'factor', 'research'),
      note: 'the stage 1 report for this chain, at the version and hash registered against its stage 1'
    };
    const review = {
      file_name: chainDeliverable(chain, 'factor', 'red_team'),
      note: 'the stage 2 review for this chain, at the version and hash registered against its stage 2'
    };
    if (stageId === 'red_team') return [report];
    if (stageId === 'adjudication') return [report, review];
    return [];
  }
  const analysis = { file_name: chainDeliverable(chain, 'asset_synthesis', 'final_analysis'), note: 'the final analysis for this asset, at the version registered against its stage 1' };
  const redTeam = { file_name: chainDeliverable(chain, 'asset_synthesis', 'final_red_team'), note: 'the final red-team for this asset, at the version registered against its stage 2' };
  if (stageId === 'final_analysis') {
    return (factorChains || []).map(factorChain => ({
      file_name: chainDeliverable(factorChain, 'factor', 'adjudication'),
      note: `the stage 3 adjudication of \`${factorChain.chain_id}\`, at the version and hash registered against that chain`
    }));
  }
  if (stageId === 'final_red_team') {
    return [analysis, { file_name: 'usd-factor-*-s3-adjudication.md', note: 'every supporting adjudication the final analysis recorded, at the version and hash it recorded for each' }];
  }
  return [analysis, redTeam, { file_name: 'usd-factor-*-s3-adjudication.md', note: 'every supporting adjudication the final analysis recorded, at the version and hash it recorded for each' }];
}

function programmeContext(chain) {
  const dispatch = chain.dispatch || {};
  const programme = { dispatched: dispatch.state === 'dispatched' };
  if (programme.dispatched) {
    programme.task_id = dispatch.task_id;
    programme.pack_version = dispatch.pack_version;
    programme.context_version = dispatch.context_version;
  }
  // A brief that set out an older workflow is named, hashed and refused. Its text is not spliced
  // into the prompt: a prompt that carries two assignments is the defect this template replaces.
  if (dispatch.prompt_path && dispatch.prompt_sha256) {
    programme.superseded = [{ repo_path: dispatch.prompt_path, sha256: dispatch.prompt_sha256 }];
  }
  return programme;
}

function chainPromptContext(chain, stageId, kind, factor, factorChains) {
  const isFinal = kind === 'asset_synthesis';
  const topic = {
    topic_id: isFinal ? chain.chain_id : chain.topic_id,
    slug: chain.slug,
    title: chain.title,
    question: (chain.probes || [])[0] || `${chain.title} on ${chain.asset}.`,
    probes: (chain.probes || []).slice(),
    group_title: chain.group_title
  };
  return {
    kind,
    stage: TEMPLATE_STAGE[stageId],
    date: TODAY,
    asset: chain.asset,
    profile: Prompts.assetProfile(chain.asset),
    subject: { noun: 'chain', id: chain.chain_id },
    topic,
    factor_id: isFinal ? null : chain.factor_id,
    factor_entry: isFinal ? null : factorEntryContext(chain, factor),
    entries: isFinal ? [] : [factorEntryContext(chain, factor)],
    companions: (chain.companions || []).map(entry => ({ repo_path: entry.repo_path, role: entry.role, sha256: entry.sha256 })),
    given: givenDocuments(chain, kind, stageId, factorChains),
    deliverable: { file_name: chainDeliverable(chain, kind, stageId) },
    programme: programmeContext(chain),
    gate: isFinal && chain.gate ? { requires: chain.gate.requires, factor_count: chain.gate.factor_count } : null
  };
}

function renderChainPrompt(chain, stageId, kind, factor, factorChains) {
  return Prompts.buildStagePrompt(chainPromptContext(chain, stageId, kind, factor, factorChains));
}

function chainStagesFor(chain, dir, files, factor, factorChains) {
  const isFactor = Boolean(chain.factor_id);
  const stageIds = isFactor ? FACTOR_STAGE_IDS : FINAL_STAGE_IDS;
  const kind = isFactor ? 'factor' : 'asset_synthesis';
  const text = {};
  stageIds.forEach(stageId => {
    text[stageId] = renderChainPrompt(chain, stageId, kind, factor, factorChains);
  });
  const fileSlugs = {
    research: 'research',
    red_team: 'red-team',
    adjudication: 'adjudication',
    final_analysis: 'final-analysis',
    final_red_team: 'final-red-team',
    final_adjudication: 'final-adjudication'
  };
  const parentStages = {
    research: null,
    red_team: 'research',
    adjudication: 'red_team',
    final_analysis: null,
    final_red_team: 'final_analysis',
    final_adjudication: 'final_red_team'
  };
  const inputStages = {
    final_analysis: [],
    final_red_team: ['final_analysis'],
    final_adjudication: ['final_analysis', 'final_red_team']
  };
  const stages = stageIds.map(stageId => {
    const meta = stageMeta(stageId);
    const repoPath = `${dir}/${chain.slug}/0${stageOrder(stageId)}-${fileSlugs[stageId]}-prompt.md`;
    files.push({
      repo_path: repoPath,
      stage: stageId,
      chain_id: chain.chain_id,
      factor_id: chain.factor_id || null,
      text: text[stageId]
    });
    const hasSupersededBrief = stageId === 'research' && chain.dispatch && chain.dispatch.prompt_path;
    const sha256 = crypto.createHash('sha256').update(text[stageId], 'utf8').digest('hex');
    return {
      stage: stageId,
      order: stageOrder(stageId),
      label: meta.label,
      prompt_path: repoPath,
      prompt_sha256: sha256,
      prompt_bytes: Buffer.byteLength(text[stageId], 'utf8'),
      prompt_source: {
        kind: 'generated',
        repo_path: repoPath,
        sha256,
        template_version: Prompts.TEMPLATE_VERSION,
        note: hasSupersededBrief
          ? `Generated from the catalogue and the chain map by \`${Prompts.TEMPLATE_VERSION}\`. The dispatched brief \`${chain.dispatch.prompt_path}\` is named inside the prompt and refused, not reproduced: this file is the one assignment.`
          : `Generated from the catalogue and the chain map by \`${Prompts.TEMPLATE_VERSION}\`, and shown on the page before it is copied.`
      },
      document_type: meta.document_type,
      parent_stage: parentStages[stageId],
      ...(isFactor ? {} : { input_stages: inputStages[stageId] }),
      deliverable: meta.deliverable,
      returns: meta.returns
    };
  });
  return stages;
}

// The catalogue carries prompts by path and hash, not by value: the page reads the file and verifies the
// hash, so the registry never depends on a copy of prompt text.
function publicChain(chain) {
  const { dispatched_brief_text, programme_red_team_text, ...rest } = chain;
  return rest;
}

function buildChains() {
  const problems = [];
  const files = [];
  const briefByFactor = new Map(BRIEF_DOCUMENTS.map(entry => [entry.factor_id, entry]));
  const factorById = new Map(USD_ASSET.factors.map(factor => [factor.factor_id, factor]));
  const sha256Of = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

  // Step 1: the six topics are grouping labels. They carry no stages and own no research; they name
  // factors, shared context and the order the page groups them in.
  const groups = TOPIC_MAP.map(spec => {
    const companions = (spec.companion_paths || []).map(entry => {
      const absPath = path.join(root, entry.repo_path);
      if (!fs.existsSync(absPath)) {
        problems.push(`topic ${spec.topic_id} names a companion that does not exist: ${entry.repo_path}`);
        return null;
      }
      const { sha256, bytes } = hashFile(absPath);
      return { repo_path: entry.repo_path, role: entry.role, sha256, bytes };
    }).filter(Boolean);

    const packs = (spec.pack_factor_ids || []).map(factorId => {
      const entry = briefByFactor.get(factorId);
      if (!entry) {
        problems.push(`topic ${spec.topic_id} has no published brief for ${factorId}`);
        return null;
      }
      const absPath = path.join(root, entry.repo_path);
      if (!fs.existsSync(absPath)) {
        problems.push(`topic ${spec.topic_id} brief is missing on disk: ${entry.repo_path}`);
        return null;
      }
      const { sha256, bytes } = hashFile(absPath);
      return { factor_id: factorId, repo_path: entry.repo_path, sha256, bytes };
    }).filter(Boolean);

    const topic = {
      topic_id: spec.topic_id,
      asset: 'USD',
      slug: spec.slug,
      title: spec.title,
      summary: spec.summary,
      factor_ids: spec.factor_ids.slice(),
      overlaps: (spec.overlaps || []).slice(),
      next_step: spec.next_step,
      dispatch: { ...(spec.dispatch || { state: 'queued' }) },
      companions,
      packs,
      probes: (spec.probes || []).slice()
    };

    if (spec.dispatched_brief_path) {
      const absPath = path.join(root, spec.dispatched_brief_path);
      if (!fs.existsSync(absPath)) {
        problems.push(`topic ${spec.topic_id} names a dispatched brief that does not exist: ${spec.dispatched_brief_path}`);
      } else {
        topic.dispatched_brief_text = fs.readFileSync(absPath, 'utf8');
        topic.dispatch.prompt_path = spec.dispatched_brief_path;
        topic.dispatch.prompt_sha256 = hashFile(absPath).sha256;
      }
    }
    if (spec.programme_red_team_path) {
      const absPath = path.join(root, spec.programme_red_team_path);
      if (!fs.existsSync(absPath)) {
        problems.push(`topic ${spec.topic_id} names a programme brief that does not exist: ${spec.programme_red_team_path}`);
      } else {
        topic.programme_red_team_path = spec.programme_red_team_path;
        topic.programme_red_team_text = fs.readFileSync(absPath, 'utf8');
      }
    }

    return topic;
  });

  // Step 2: every factor owns one research chain. The chain inherits the groups shared context and
  // pack, and carries a factor-specific probe so the report is written for that entry, not for the topic.
  const chains = [];
  const chainIds = new Set();
  groups.forEach(group => {
    group.factor_ids.forEach(factorId => {
      const factor = factorById.get(factorId);
      if (!factor) {
        problems.push(`group ${group.topic_id} names factor ${factorId}, which is not in the catalogue`);
        return;
      }
      const chainId = `usd-factor-${factorId.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()}`;
      if (chainIds.has(chainId)) {
        problems.push(`factor ${factorId} produced a duplicate chain id ${chainId}`);
        return;
      }
      chainIds.add(chainId);
      // The group's dispatched brief belongs to one factor only. Copy the dispatch state, not its prompt
      // path, so a sibling factor chain cannot claim the same brief as its own research source.
      const chainDispatch = { ...group.dispatch };
      delete chainDispatch.prompt_path;
      delete chainDispatch.prompt_sha256;
      // The dispatched assignment covers one factor only. A sibling factor chain has not been dispatched and
      // must not present the group's task id as its own research source.
      if (factorId !== 'live.f1-vix-level' && chainDispatch.state === 'dispatched') {
        chainDispatch.state = 'queued';
        delete chainDispatch.task_id;
        delete chainDispatch.pack_version;
        delete chainDispatch.context_version;
        delete chainDispatch.dispatched_at;
      }
      const chain = {
        chain_id: chainId,
        factor_id: factorId,
        asset: 'USD',
        topic_id: group.topic_id,
        group_title: group.title,
        slug: factorId.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase(),
        title: `${factor.label} - ${factorId}`,
        summary: factor.brief,
        factor_label: factor.label,
        factor_group: factor.group,
        factor_role: factor.role,
        dispatch: chainDispatch,
        companions: group.companions.map(entry => ({ ...entry })),
        packs: group.packs.filter(pack => pack.factor_id === factorId).map(pack => ({ ...pack })),
        probes: [
          `Chain question: does \`${factorId}\` - ${factor.label} - carry information about the next 24-hour dollar move, and in which quantity? ${factor.brief}`,
          ...group.probes
        ]
      };
      // The registered VIX evidence was written under the programme brief, so it stays attached to the
      // VIX factor it was dispatched for and does not become a second, independent result elsewhere.
      if (group.dispatched_brief_text && factorId === 'live.f1-vix-level') {
        chain.dispatched_brief_text = group.dispatched_brief_text;
        chain.dispatch.prompt_path = group.dispatch.prompt_path;
        chain.dispatch.prompt_sha256 = group.dispatch.prompt_sha256;
      }
      if (group.programme_red_team_text && factorId === 'live.f1-vix-level') {
        chain.programme_red_team_path = group.programme_red_team_path;
        chain.programme_red_team_text = group.programme_red_team_text;
      }
      chain.stages = chainStagesFor(chain, FACTOR_DIR, files, factor);
      chains.push(publicChain(chain));
    });
  });

  // Step 3: one asset-level final chain, gated on every factor chain delivering all three stages. It runs
  // final analysis, an independent final red-team of that analysis and its evidence, then a final adjudication
  // that produces the candidate Layer 1 logic for an isolated backtest.
  const finalInventoryPath = 'docs/research/usd-session/v1/inventory.md';
  const finalInventory = fs.existsSync(path.join(root, finalInventoryPath)) ? hashFile(path.join(root, finalInventoryPath)) : null;
  const finalChain = {
    chain_id: 'usd-final-asset-analysis',
    asset: 'USD',
    slug: 'final-asset-analysis',
    title: 'USD asset-level final analysis',
    summary: 'The three-stage final chain over all 25 factor chains: final analysis, an independent red-team of that analysis and its supporting evidence, then a final adjudication that produces the complete candidate Layer 1 logic for isolated backtesting. It opens only when every factor has research, red team and adjudication against current versions.',
    dispatch: { state: 'queued' },
    companions: finalInventory
      ? [{ repo_path: finalInventoryPath, role: 'the input and decision inventory the synthesis closes out', sha256: finalInventory.sha256 }]
      : [],
    packs: [],
    probes: [
      'Which relation across the 25 factor chains survives its red team and adjudication, and which were only plausible mechanisms?',
      'Where two factor chains disagree, what evidence decides between them, and what stays unresolved?',
      'What is the smallest asset-level treatment the evidence supports, and which parameters remain unvalidated?'
    ],
    gate: {
      requires: 'all-factor-chains',
      factor_count: chains.length,
      stage_count: Object.keys(FACTOR_STAGE_ORDER).length,
      final_stage_count: Object.keys(FINAL_STAGE_ORDER).length,
      note: 'Unlocked by the registry: every factor chain must deliver research, red team and adjudication against the current parent versions. The final chain then runs final analysis, final red-team and final adjudication, with each stage recording its input package.'
    },
    factor_chain_ids: chains.map(chain => chain.chain_id)
  };
  finalChain.stages = chainStagesFor(finalChain, FINAL_DIR, files, null, chains);

  // Step 4: the asset_synthesis topic spec. It is a catalogue entry in its own right, with the three
  // stages it owns and the gate that opens them, so the final chain's assignment is explicit rather than
  // implied by a chain record. It is not a seventh grouping label, it owns no factor, and it cannot be
  // reached before every factor chain has delivered all three stages against current parent versions:
  // the library's gate decides that, and nothing in this spec changes the gate.
  const synthesisTopic = {
    topic_id: 'usd-topic-asset-synthesis',
    asset: 'USD',
    chain_id: finalChain.chain_id,
    slug: finalChain.slug,
    title: finalChain.title,
    question: finalChain.probes[0],
    chain_kind: 'asset_synthesis',
    template_version: Prompts.TEMPLATE_VERSION,
    summary: finalChain.summary,
    stage_ids: FINAL_STAGE_IDS.slice(),
    stage_paths: finalChain.stages.map(stage => ({ stage: stage.stage, order: stage.order, prompt_path: stage.prompt_path, prompt_sha256: stage.prompt_sha256 })),
    factor_ids: finalChain.factor_chain_ids.slice(),
    gate: { ...finalChain.gate, state_source: 'registry' },
    unlock_note: 'Locked until every one of the factor chains has delivered research, red team and adjudication against current parent versions. This spec records the gate; it does not open it, and no stage of it may be run early.',
    next_step: 'Run stages 1 to 3 only when the library reports the gate open, and take the prompt from this catalogue entry rather than from a copy.'
  };

  const covered = new Set(chains.map(chain => chain.factor_id));
  USD_ASSET.factors.forEach(factor => {
    if (!covered.has(factor.factor_id)) problems.push(`factor ${factor.factor_id} carries no research chain`);
  });
  return { topics: groups, factor_chains: chains, final_chain: finalChain, synthesis_topic: synthesisTopic, files, problems };
}

function writePromptFiles(built) {
  built.files.forEach(file => {
    const absPath = path.join(root, file.repo_path);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, file.text);
  });
}

function chainsCommand(flag) {
  const built = buildChains();
  if (!report('chains', built.problems)) return 1;
  if (flag === '--write') {
    writePromptFiles(built);
    console.log(`chains written: ${built.files.length} prompt files under ${FACTOR_DIR} and ${FINAL_DIR}`);
    return 0;
  }
  const drifted = built.files.filter(file => {
    const absPath = path.join(root, file.repo_path);
    return !fs.existsSync(absPath) || fs.readFileSync(absPath, 'utf8') !== file.text;
  });
  if (drifted.length) {
    console.log(`chains check: ${drifted.length} prompt file(s) differ from the authored prompts. Run chains --write.`);
    drifted.forEach(file => console.log(`  - ${file.repo_path}`));
    return 1;
  }
  const committed = readJsonIfExists(catalogPath);
  if (committed && JSON.stringify(built.factor_chains) !== JSON.stringify(committed.factor_chains || [])) {
    console.log('chains check: the committed catalogue carries a different factor chain map. Run catalog --write.');
    return 1;
  }
  if (committed && JSON.stringify(built.final_chain) !== JSON.stringify(committed.final_chain || null)) {
    console.log('chains check: the committed catalogue carries a different final chain. Run catalog --write.');
    return 1;
  }
  if (committed && JSON.stringify(built.synthesis_topic) !== JSON.stringify(committed.synthesis_topic || null)) {
    console.log('chains check: the committed catalogue carries a different asset_synthesis topic spec. Run catalog --write.');
    return 1;
  }
  console.log(`chains check: ${built.factor_chains.length} factor chains, ${built.files.length} prompt files, the final chain and the asset_synthesis topic spec match the authored chains.`);
  return 0;
}

function catalogCommand(flag) {
  const rendered = render(buildCatalog());
  if (!report('catalog validation', ResearchLibrary.validateCatalog(JSON.parse(rendered)))) return 1;
  if (flag === '--write') {
    fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
    fs.writeFileSync(catalogPath, rendered);
    console.log(`catalog written: ${path.relative(root, catalogPath)}`);
    // The prompt files are written with the catalogue they are hashed into, so the two cannot disagree.
    const built = buildChains();
    if (!report('chains', built.problems)) return 1;
    writePromptFiles(built);
    console.log(`chain prompts written: ${built.files.length} files under ${FACTOR_DIR} and ${FINAL_DIR}`);
    return 0;
  }
  const committed = fs.existsSync(catalogPath) ? fs.readFileSync(catalogPath, 'utf8') : '';
  if (committed !== rendered) {
    console.log('catalog check: the committed file differs from the authored catalog. Run catalog --write.');
    return 1;
  }
  console.log('catalog check: committed file matches the authored catalog.');
  return 0;
}

function registryCommand(flag) {
  const seeded = seedRegistry(readJsonIfExists(registryPath));
  if (!report('registry seed', seeded.problems)) return 1;
  const rendered = render(seeded.registry);
  if (flag === '--write') {
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, rendered);
    console.log(`registry written: ${path.relative(root, registryPath)} (${seeded.added} added, ${seeded.versioned} versioned)`);
    return 0;
  }
  const committed = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8') : '';
  if (committed !== rendered) {
    console.log('registry check: the committed registry differs from the seed. Run registry --write.');
    return 1;
  }
  console.log('registry check: committed registry matches the seed.');
  return 0;
}

function verifyCommand() {
  const catalog = readJsonIfExists(catalogPath);
  if (!catalog) {
    console.log('verify: no catalog on disk. Run catalog --write first.');
    return 1;
  }
  const registry = readJsonIfExists(registryPath);
  if (!registry) {
    console.log('verify: no registry on disk. Run registry --write first.');
    return 1;
  }
  let ok = report('catalog', ResearchLibrary.validateCatalog(catalog));
  ok = report('registry', ResearchLibrary.validateDocuments(registry, catalog)) && ok;
  ok = report('repo hashes', verifyRepoHashes(registry)) && ok;
  // The chain prompts are checked against the authored text, not just against the hash in the catalogue: a
  // prompt file edited on disk after the catalogue was written has to fail this guard.
  const builtChains = buildChains();
  ok = report('chains', builtChains.problems) && ok;
  ok = report('chain prompts', builtChains.files
    .filter(file => {
      const absPath = path.join(root, file.repo_path);
      return !fs.existsSync(absPath) || fs.readFileSync(absPath, 'utf8') !== file.text;
    })
    .map(file => `${file.repo_path} differs from the authored prompt; run catalog --write`)) && ok;
  const coverage = ResearchLibrary.factorCoverage(catalog);
  const counts = ResearchLibrary.progressCounts(ResearchLibrary.listFactors(catalog));
  console.log(`assets ${ResearchLibrary.listAssets(catalog).length}, factors ${counts.total}, tasks ${coverage.tasks.length}`);
  console.log(`research ${JSON.stringify(counts.research)}`);
  console.log(`review ${JSON.stringify(counts.review)}`);
  console.log(`backtest ${JSON.stringify(counts.backtest)}`);
  console.log(`factors not covered by any task: ${coverage.uncovered.length}`);
  coverage.uncovered.forEach(entry => console.log(`  - ${entry.asset} ${entry.factor_id}`));
  const factorChains = ResearchLibrary.listFactorChains(catalog);
  console.log(`factor chains: ${factorChains.length}, ${ResearchLibrary.FACTOR_STAGES.length} stages each`);
  factorChains.forEach(chain => {
    const progress = ResearchLibrary.chainProgress(chain, registry);
    const stages = progress.stages.map(stage => `${stage.stage}=${stage.state}`).join(', ');
    console.log(`chain ${chain.chain_id} (${chain.factor_id}): ${stages}; next ${progress.next_stage || 'none'}`);
  });
  const topics = ResearchLibrary.listTopics(catalog);
  console.log(`topic labels: ${topics.length}`);
  topics.forEach(topic => {
    const progress = ResearchLibrary.topicProgress(topic, registry, catalog);
    const chains = progress.chains || [];
    console.log(`topic ${topic.topic_id}: ${progress.factors_complete}/${progress.factors_total} factor chains complete; ${progress.delivered_stages}/${progress.total_stages} stages; ready for final analysis ${progress.ready_for_synthesis}; chains ${chains.map(chain => chain.chain_id).join(', ')}`);
  });
  const gate = ResearchLibrary.finalChainStatus(catalog, registry);
  ok = report('final chain', gate && gate.stages.length === ResearchLibrary.FINAL_CHAIN_STAGES.length
    ? []
    : [`final chain must carry ${ResearchLibrary.FINAL_CHAIN_STAGES.length} stages`]) && ok;
  const gateNext = gate.stages.find(stage => stage.state !== 'delivered');
  console.log(`final chain: ${gate.chain_id} ${gate.state} (${gate.factors_complete}/${gate.factors_total} factor chains complete, ${gate.delivered_stages}/${gate.total_stages} final stages); next ${gateNext ? gateNext.stage : 'none'}; gate ${gate.unlocked ? 'open' : 'locked'}`);
  if (gate.pending.length) console.log(`final chain pending factors: ${gate.pending.map(entry => `${entry.factor_id} (${entry.delivered_stages}/${entry.total_stages}, next ${entry.next_stage})`).join(', ')}`);
  coverage.tasks.forEach(task => {
    const record = ResearchLibrary.taskById(catalog, task.task_id);
    const prompt = record ? ResearchLibrary.fingerprint(record.prompt) : 'missing';
    console.log(`task ${task.task_id}: covers ${task.covers.length}, status ${task.status}, prompt fingerprint ${prompt}`);
  });
  return ok ? 0 : 1;
}

function main() {
  const [command, flag] = process.argv.slice(2);
  if (command === 'catalog') process.exit(catalogCommand(flag));
  if (command === 'registry') process.exit(registryCommand(flag));
  if (command === 'topics' || command === 'chains') process.exit(chainsCommand(flag));
  if (command === 'verify') process.exit(verifyCommand());
  console.log('usage: node scripts/build_research_library.js <catalog|registry|chains|topics|verify> [--write|--check]');
  process.exit(1);
}

main();
