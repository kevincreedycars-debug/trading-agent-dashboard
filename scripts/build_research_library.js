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
  next_step: "Work one topic at a time through its three stages. Stage 1: copy the research prompt from the topic page and run it in your own session, then upload the one Markdown report it returns against that topic. Stage 2: download the exact research version the card names, run the red-team prompt, upload the review. Stage 3: download both documents, run the adjudication prompt, upload the conclusion. The stages of the other five topics are written and hash-checked and can be released as a batch at any time. The legacy task list (USD-SESSION-A1 to A5) is kept as history and is not the workflow.",
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
    next_step: 'Wait for the USD programme to reach a synthesis, then decide per asset whether the same question is asked.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'No USD sign, weight, threshold or factor transfers to another asset without its own research.'
  },
  {
    asset: 'GBP',
    label: 'British Pound',
    standfirst: 'No GBP session research has started.',
    status: 'not_started',
    next_step: 'Wait for the USD synthesis.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'No USD result transfers here.'
  },
  {
    asset: 'GOLD',
    label: 'Gold',
    standfirst: 'No gold session research has started in this programme; the gold backtesting lane keeps its own scope.',
    status: 'not_started',
    next_step: 'Keep the existing gold lane scope until the USD synthesis says what is worth repeating.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'Gold keeps its own horizon policy and backtesting loop.'
  },
  {
    asset: 'SILVER',
    label: 'Silver',
    standfirst: 'No silver session research has started.',
    status: 'not_started',
    next_step: 'Wait for the USD synthesis.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'No USD result transfers here.'
  },
  {
    asset: 'NQ',
    label: 'Nasdaq 100',
    standfirst: 'No NQ session research has started.',
    status: 'not_started',
    next_step: 'Wait for the USD synthesis.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'The only NQ input in the live USD collector is a QQQ quote, which is an ETF, not the index.'
  },
  {
    asset: 'BTC',
    label: 'Bitcoin',
    standfirst: 'No BTC session research has started.',
    status: 'not_started',
    next_step: 'Wait for the USD synthesis.',
    blockers: ['No assignment is published for this asset.'],
    factors: [],
    note: 'No USD result transfers here.'
  },
  {
    asset: 'WTI',
    label: 'Crude Oil (WTI)',
    standfirst: 'No WTI session research has started.',
    status: 'not_started',
    next_step: 'Wait for the USD synthesis.',
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
// Topics: one research question, three numbered stages
//
// A topic is the unit a reader works on. It names the factor entries its answer is evidence for, the three
// prompts in order, and the document type each stage returns. The prompts are generated from this file, so a
// prompt cannot drift from the catalogue, and each prompt's hash goes into the catalogue so the page can say
// which prompt was copied. Nothing here authorises a model call: a prompt is copied by hand into the
// reader's own session, and the returned document is uploaded by hand as evidence.
// ---------------------------------------------------------------------------------------------

const TOPIC_DIR = 'docs/research/topics/usd';
const DEEP_RESEARCH_DIR = 'docs/research/handoff/usd/v1/deep-research';
const VIX_DISPATCHED_BRIEF = `${DEEP_RESEARCH_DIR}/VIX_COMPREHENSIVE_REPORT_BRIEF.md`;
const CONTEXT_PACK_NEUTRAL = `${DEEP_RESEARCH_DIR}/CONTEXT_PACK_NEUTRAL.md`;
const TOPIC_STAGE_ORDER = { research: 1, red_team: 2, adjudication: 3 };
const TOPIC_STAGE_META = {
  research: {
    label: 'Research',
    document_type: 'report',
    deliverable: 'One Markdown report: the assignment answered in full, with the source note as a section inside the same document.',
    returns: 'Sections in the order the prompt asks for, an explicit what-is-not-claimed section, and the source note naming every source you fetched, the passage you relied on, the window it concerns and whether it is primary.'
  },
  red_team: {
    label: 'Red-team',
    document_type: 'review',
    deliverable: 'One Markdown issue register: every load-bearing claim quoted, given a verdict, a severity and the evidence that would settle it.',
    returns: 'The issue register, the two closing lists (what survives unchanged, what the review could not reach), the sources you re-fetched and the questions you could not resolve.'
  },
  adjudication: {
    label: 'Adjudication',
    document_type: 'synthesis',
    deliverable: 'One Markdown adjudication: corrected conclusions, a decision on every material objection, and a handoff to central USD synthesis.',
    returns: 'Corrected conclusions; finding-by-finding decisions; accepted, rejected and unresolved claims; proposed treatment of the factor in the engine; inputs, transformations, timing, interactions and missing-data treatment; explicitly unvalidated parameters; required empirical tests and remaining blockers; the handoff section.'
  }
};

// The session every stage is written for. It is repeated in every prompt because a prompt has to stand alone.
const TOPIC_SESSION_BLOCK = [
  '- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.',
  '- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.',
  "- **The deployed engine is not this window**: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps the corrected session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to."
];

const TOPIC_PROHIBITIONS = [
  'Do not invent a backtest, a performance figure, an accuracy rate or a sample size. If you have not measured it, say it is unmeasured. Numbers you remember are not evidence.',
  'Do not use hindsight: never state what a past period would have predicted using information that was not available at that time, and do not present a later revision as a first print.',
  'Cite only sources you actually fetched in this session, with the link and the passage you relied on.',
  'Where you are uncertain, say so and give the reason; an unresolved question is a valid return.',
  'State effects that are already in the price at the cutoff rather than counting them again as predictive.',
  'Treat the deployed weights, thresholds and signs as a baseline to audit, never as evidence for your claim.',
  'Name the instrument a claim is really about. Never present another instrument as DXY.',
  'No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this prompt, and none may be proposed as part of the deliverable.'
];

function promptFrontmatter(topic, stageId, extraLines = []) {
  const meta = TOPIC_STAGE_META[stageId];
  return [
    `# ${topic.title} - stage ${TOPIC_STAGE_ORDER[stageId]} of 3: ${meta.label}`,
    '',
    `- Topic \`${topic.topic_id}\` on asset USD; stage \`${stageId}\`; this stage returns exactly one Markdown document (${meta.document_type}).`,
    `- Factors this stage is evidence for: ${topic.factor_ids.map(id => `\`${id}\``).join(', ')}. One document can carry evidence for more than one factor entry; that is a mapping, not a second independent result.`,
    '- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.',
    ...extraLines,
    ''
  ].join('\n');
}

function sessionSection() {
  return ['## The session this is written for', '', ...TOPIC_SESSION_BLOCK, ''].join('\n');
}

function prohibitionsSection() {
  return ['## Prohibitions', '', ...TOPIC_PROHIBITIONS, ''].join('\n');
}

function factorContextBlock(topic) {
  const byId = new Map(USD_ASSET.factors.map(factor => [factor.factor_id, factor]));
  const lines = [];
  topic.factor_ids.forEach(factorId => {
    const factor = byId.get(factorId);
    if (!factor) {
      lines.push(`- \`${factorId}\` is named by this topic but is not in the catalogue.`);
      return;
    }
    const status = factor.research_status === 'blocked' ? ' (research blocked on data access)' : '';
    lines.push(`- **${factor.factor_id}** - ${factor.label}${status}. Role: ${factor.role}. Group: ${factor.group}.`);
    lines.push(`  - The question this entry stands for: ${factor.brief}`);
    if ((factor.current_rules || []).length) {
      lines.push(`  - Rule in force today, as context to audit and never as evidence: ${factor.current_rules.join('; ')}.`);
    }
    if (factor.threshold) lines.push(`  - Threshold: ${factor.threshold}; lookback: ${factor.lookback || 'not stated'}.`);
    if ((factor.sources || []).length) lines.push(`  - Series the collector reads: ${factor.sources.join('; ')}.`);
  });
  return [
    '## The factor entries this topic is evidence for',
    '',
    'These entries are context to audit. They are not evidence for any claim, and they are not the scope limit of this assignment.',
    '',
    ...lines,
    ''
  ].join('\n');
}

function companionBlock(topic, stageId) {
  const lines = (topic.companions || []).map(entry => `- \`${entry.repo_path}\` (${entry.role}) - sha256 \`${entry.sha256}\``);
  if (stageId === 'research') {
    (topic.packs || []).forEach(pack => lines.push(`- \`${pack.repo_path}\` - the published brief for \`${pack.factor_id}\`; sha256 \`${pack.sha256}\``));
  }
  if (!lines.length) return '';
  const header = stageId === 'research'
    ? 'Files in the checkout this topic rests on, if you can reach them. They are aids: the prompt has to stand on its own without them.'
    : 'Files in the checkout behind this topic, if you can reach them. They are aids, not attachments you must have.';
  return ['## Companion files in the repository', '', header, '', ...lines, ''].join('\n');
}

function returnSection(topic, stageId) {
  const meta = TOPIC_STAGE_META[stageId];
  const lines = ['## What to return', '', `- Required content: ${meta.returns}`];
  if (stageId === 'research') {
    lines.push('- Return one Markdown document. The report and its source note belong inside that one file: sections in order, then the source note, then the what-is-not-claimed section.');
  } else {
    lines.push('- Return one Markdown document. Put these identifier lines at the top of the file, before the body, and fill them from the stage card you downloaded:');
    lines.push('');
    lines.push('```');
    lines.push(`Reviewed topic: ${topic.topic_id}`);
    lines.push('Reviewed document: <document id shown on the stage card you downloaded>');
    lines.push('Reviewed version: <version>');
    lines.push('Reviewed sha256: <sha256 shown on that card>');
    lines.push('```');
  }
  lines.push('- Keep it in one file. Tables, sources, hypotheses, candidate relations and appendices all belong inside that document; nothing here needs a second file, a JSON payload or a hand-built schema.');
  lines.push('- The dashboard records the topic, the stage and the exact version this document judged, so that metadata is not yours to assemble: pick the stage card, choose the file, upload it.');
  lines.push('');
  return lines.join('\n');
}

function researchPrompt(topic) {
  const dispatchLine = topic.dispatch && topic.dispatch.state === 'dispatched'
    ? `- The programme has already dispatched this topic: it is deep-research step 1 under task \`${topic.dispatch.task_id}\`, pack version ${topic.dispatch.pack_version}, context version ${topic.dispatch.context_version}.`
    : '- This topic has not been dispatched yet. This is the next research assignment, written and hash-checked so it is ready to run.';
  const sections = [
    promptFrontmatter(topic, 'research', [dispatchLine]),
    '## What this stage is for',
    '',
    'Produce one comprehensive, source-backed report investigating how the inputs of this topic - their levels, their changes and their interactions with each other and with the rest of the system - relate to the subsequent direction of the US dollar over one session: 05:00 Europe/London to 05:00 Europe/London on the next local date.',
    '',
    'Rules are in force for some of these entries, and the session is defined but unmeasured because the instrument that would label it has no verified quote source. Neither is the question. The question is what the evidence actually says about where the dollar goes next inside this window, and where that evidence is thin, contradictory or absent.',
    '',
    '## What the report must cover',
    '',
    '1. **Measurement**: what each input is and what it measures, from sources - the index or series family around it, any futures or forward structure, the publication and revision process, and the exact window each measurement refers to. Name the instrument and the window of every claim.',
    '2. **Mechanisms**: the channels by which each input could move the dollar inside a 24-hour London-to-London window - safe-haven demand, risk appetite and cross-asset correlation, carry and funding, policy expectations, positioning and flows - and the observable each mechanism would leave at the cutoff.',
    '3. **Regimes**: whether the relation is stable or regime-dependent (volatility level, direction of the dollar, policy cycle, liquidity), and on what evidence that judgement rests.',
    '4. **Level against change**: whether the level, a one-day change or a longer change is the informative quantity, and on what evidence.',
    '5. **Interactions**: for each pair of entries the sources support - inside this topic and with the other factor entries - the sign, the mechanism, the window, and whether the pair is the same information counted twice.',
    '6. **Timing**: what is observable at 05:00 Europe/London, what is already in the price by then, and what arrives only during the session.',
    '7. **Predictive evidence**: what has actually been measured about the subsequent 24-hour direction, with the sample, the window and the era stated; and where the honest answer is that nothing has been measured for this instrument and window.',
    '8. **Contradictory findings**: the strongest contrary evidence you found, named as such rather than omitted.',
    '9. **Hypotheses**: the candidate relation or relations worth testing, each with a falsifiable statement, what would refute it, and how it could be measured in this repository.',
    '10. **Data requirements**: the series, resolution, vintage handling and history the test would need, and which of them are missing or behind a paywall.',
    '',
    '## Questions for this topic',
    '',
    ...topic.probes.map((probe, index) => `${index + 1}. ${probe}`),
    '',
    '## Existing thresholds are context, not the scope limit',
    '',
    'The rules in force are listed below because they are what the deployed engine does today. Audit them rather than defend them, and do not treat them as the limit of what may be investigated: if the sources support a different quantity, window, sign or interaction, say so and say what it rests on.',
    ''
  ];
  if (topic.dispatched_brief_text) {
    sections.push(
      '## The dispatched assignment',
      '',
      `The programme sent this brief for this topic. It is reproduced here in full so that this one prompt is sufficient on its own; its own file is \`${topic.dispatch.prompt_path}\`, and its hash is recorded in the topic index.`,
      '',
      '--- begin dispatched brief ---',
      '',
      topic.dispatched_brief_text.trimEnd(),
      '',
      '--- end dispatched brief ---',
      ''
    );
  }
  sections.push(
    sessionSection(),
    factorContextBlock(topic),
    companionBlock(topic, 'research'),
    returnSection(topic, 'research'),
    prohibitionsSection(),
    '## What happens after you return it',
    '',
    'An independent red team attacks the report claim by claim (stage 2). Only what survives is carried into the adjudication (stage 3), which decides what, if anything, enters central USD synthesis. Nothing is scored before the session and data contract is frozen, and no weight, sign, threshold, lookback or live call changes because a report exists.',
    ''
  );
  return sections.join('\n');
}

function redTeamPrompt(topic) {
  const sections = [
    promptFrontmatter(topic, 'red_team', [
      `- Reviewed document: the research return registered against topic \`${topic.topic_id}\`, stage \`research\`. The stage 1 card shows its document id, its version and its sha256: attach exactly that version.`
    ]),
    '## What this stage is for',
    '',
    'Find what is wrong, unsupported or overstated in the research report before the adjudication carries it further. A report that survives an honest attack is worth more than one that was never attacked, so this stage is expected to damage claims and to say which ones stood up. It is not a summary, not a rewrite and not a vote, and it does not manufacture disagreement.',
    '',
    '## Which version you are attacking',
    '',
    '- Attach the exact research version the stage 1 card points to, and nothing else about its reasoning.',
    "- Copy that card's document id, version and sha256 into the identifier lines at the top of your return.",
    '- If the copy you hold has a different hash from the one on the card, say so and stop: you would not be reviewing the registered version.',
    '',
    '## Independence rules',
    '',
    "- You are not the author's session and you did not write the report; do not ask it what it meant. The report must stand on the words it contains.",
    '- Open the sources yourself wherever they are reachable, and say which ones you could re-fetch. Where a source is behind a login or a paywall, judge only on the quotation given and mark the claim status accordingly.',
    '- Judge claims, not style, and attack the strongest version of a claim rather than a weakened one.',
    "- Say when a claim is right and only its scope is too wide: a narrower true claim is a result, not a loss.",
    '',
    '## What to attack, claim by claim',
    '',
    '- **Traceability**: does the passage cited actually say what the claim says, and is the link the source itself rather than a summary of it?',
    '- **Window**: is the evidence about our 05:00 London to 05:00 London session, or about a close-to-close day, an intraday slice or another window, presented as if it were ours?',
    '- **Instrument**: is a claim really about EUR/USD, a basket or a future, presented under the DXY name?',
    '- **Mechanism against measurement**: is a plausible channel being used as if the relation had been measured?',
    '- **Already priced**: does the claim count an effect as predictive that the cutoff has already absorbed?',
    '- **Identification and scope**: sample period, era dependence, regime dependence, conditioning on the outcome, survivorship in the sources chosen, base rates behind a conditional claim, and any number with no stated origin.',
    '- **Counter-evidence**: is the strongest contrary evidence in the sources the report fetched absent, or present and dismissed without a reason?',
    '- **Internal consistency**: does one section contradict another, and does the what-is-not-claimed section match what the body actually does?',
    '- **Overlap**: does the report lean on an interaction that counts one input twice across factor entries, and does it say so?',
    '',
    '## A verdict for every load-bearing claim',
    '',
    '`SUPPORTED` - the sources given support it as stated. `NARROWED` - something in it is supported, and the supported part is stated in your own words. `NOT_SUPPORTED` - the sources given do not support it, or contradict it; say which. `UNASSESSABLE` - it could not be judged from the sources given; say what would settle it.',
    '',
    'For each claim also give the claim quoted, its severity (fatal, material, cosmetic), what is wrong, and the evidence that would resolve it. End with two lists: what survives the attack unchanged, and what the review could not reach at all.',
    ''
  ];
  if (topic.programme_red_team_text) {
    sections.push(
      '## The programme brief this stage follows',
      '',
      `The deep-research tier wrote this step-2 brief for the dispatched topic. It is reproduced in full so that this one prompt is sufficient; its own file is \`${topic.programme_red_team_path}\`.`,
      '',
      '--- begin programme brief ---',
      '',
      topic.programme_red_team_text.trimEnd(),
      '',
      '--- end programme brief ---',
      ''
    );
  }
  sections.push(
    sessionSection(),
    factorContextBlock(topic),
    companionBlock(topic, 'red_team'),
    returnSection(topic, 'red_team'),
    prohibitionsSection(),
    '## What happens after you return it',
    '',
    'The adjudication (stage 3) reads the report and this review together and decides every material objection. Nothing here approves a hypothesis, scores a factor or changes a live call: an upload records evidence and moves no status.',
    ''
  );
  return sections.join('\n');
}

function adjudicationPrompt(topic) {
  return [
    promptFrontmatter(topic, 'adjudication', [
      `- Attach both documents this stage judges: the research return for topic \`${topic.topic_id}\` and the red-team review of it. Each stage card shows its document id, version and sha256; attach those exact versions.`
    ]),
    '## What this stage is for',
    '',
    'Read the research report and the red-team review together and produce the best-supported conclusion. Resolve each material objection on the evidence; do not split the difference, do not average the two documents, and do not treat agreement between them as evidence. Where the evidence does not decide, say which finding is unresolved and what would decide it.',
    '',
    '## Which versions you are judging',
    '',
    '- Reproduce the research document id, version and sha256, and the red-team document id, version and sha256, in the identifier lines at the top of your return.',
    '- If either attachment does not match the card it came from, say so and stop.',
    '',
    '## How to decide',
    '',
    '- Answer a material objection on the evidence the two documents give, and on sources you fetched yourself; say which it was.',
    '- Reject an objection the evidence does not support, and say what is wrong with it.',
    '- A claim that neither document settles stays unresolved and is listed as unresolved rather than quietly dropped.',
    '- A narrowing that keeps the true part of a claim is a decision, not a compromise.',
    '',
    '## What the adjudication must contain',
    '',
    '1. **Corrected conclusions** - the best-supported version of each conclusion, stated plainly.',
    '2. **Finding-by-finding decisions** - every material objection from the review, decided as accepted, rejected or unresolved, each with its reason.',
    '3. **Accepted, rejected and unresolved claims** - as three explicit lists.',
    '4. **Proposed treatment of the factor in the engine** - only where the evidence supports it: the input, the transformation, the sign, the threshold, the lookback, the timing and how any interaction is handled. Where the evidence does not support a treatment, say that instead. The rules in force are context to be tested, never a target to agree with.',
    '5. **Inputs, transformations, timing, interactions and missing-data considerations** - including what the collector does not record today and what it would have to record.',
    '6. **Explicitly unvalidated parameters** - every number or choice you propose that has not been measured, named as unvalidated.',
    '7. **Required empirical tests and remaining blockers** - what would have to be measured, on what sample and window, with what data, and what is missing or behind a paywall.',
    '8. **Handoff to central USD synthesis** - a short, self-contained section a later central synthesis can read on its own: what this topic contributes, what it rules out, what stays unresolved, and what it does not claim.',
    '',
    '## The line this stage must not cross',
    '',
    'Research accepted for synthesis is not a validated trading rule. This stage proposes; it does not implement, score, deploy or change a live call, and it asserts no performance figure it has not measured.',
    '',
    sessionSection(),
    factorContextBlock(topic),
    companionBlock(topic, 'adjudication'),
    returnSection(topic, 'adjudication'),
    prohibitionsSection(),
    '## What happens after you return it',
    '',
    'Central USD synthesis is a separate step: it reads the adjudications of every topic, resolves what conflicts between them, and only then can an isolated implementation and validation step follow. Nothing enters the live engine because a document exists.',
    ''
  ].join('\n');
}

// The topic map. Every USD factor sits in exactly one topic, and a topic may name the topics it interacts
// with, so a returned report is mapped to the factor entries it is evidence for without being treated as
// independent evidence a second time. The VIX topic is the one the programme has actually dispatched.
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
    next_step: 'The research report is registered. Run stage 2 (red-team) against research version 1, then stage 3 (adjudication).'
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
    next_step: 'Not dispatched. The research prompt is written and checked; take it from the stage 1 card when the batch opens.'
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
    next_step: 'Not dispatched. The research prompt is written and checked; take it from the stage 1 card when the batch opens.'
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
    next_step: 'Not dispatched. The research prompt is written and checked; take it from the stage 1 card when the batch opens.'
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
    next_step: 'Not dispatched. The research prompt is written and checked; take it from the stage 1 card when the batch opens.'
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
    next_step: 'Not dispatched. The research prompt is written and checked; take it from the stage 1 card when the batch opens.'
  }
];

// buildCatalog is defined below; the topic section above only prepares prompt text and hashes.
function buildCatalog() {
  return {
    schema_version: 'research-library-catalog-v1',
    generated_at: TODAY,
    asset_order: ResearchLibrary.ASSET_ORDER.slice(),
    scope_note: 'Research management only. Preparing a task writes nothing to a model, uploading a report records evidence, and a returned report becomes a rule only after a review accepts it and a backtest supports it.',
    storage: STORAGE,
    tasks: TASKS,
    topics: buildTopics().topics,
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

// Written from the topic map above, so the prompt files and the catalogue cannot disagree: the catalogue
// carries each prompt's hash, and the check command re-reads the files. Nothing here or anywhere else sends
// a prompt to a model.
function buildTopics() {
  const problems = [];
  const files = [];
  const briefByFactor = new Map(BRIEF_DOCUMENTS.map(entry => [entry.factor_id, entry]));
  const sha256Of = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

  const topics = TOPIC_MAP.map(spec => {
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

    const text = {
      research: researchPrompt(topic),
      red_team: redTeamPrompt(topic),
      adjudication: adjudicationPrompt(topic)
    };
    const stages = Object.keys(TOPIC_STAGE_ORDER).map(stageId => {
      const fileSlug = stageId === 'red_team' ? 'red-team' : stageId;
      const repoPath = `${TOPIC_DIR}/${spec.slug}/0${TOPIC_STAGE_ORDER[stageId]}-${fileSlug}-prompt.md`;
      files.push({ repo_path: repoPath, stage: stageId, topic_id: spec.topic_id, text: text[stageId] });
      const sourceKind = stageId === 'research' && topic.dispatch.prompt_path ? 'dispatched_brief' : 'generated';
      return {
        stage: stageId,
        order: TOPIC_STAGE_ORDER[stageId],
        label: TOPIC_STAGE_META[stageId].label,
        prompt_path: repoPath,
        prompt_sha256: sha256Of(text[stageId]),
        prompt_bytes: Buffer.byteLength(text[stageId], 'utf8'),
        prompt_source: sourceKind === 'dispatched_brief'
          ? {
            kind: sourceKind,
            repo_path: topic.dispatch.prompt_path,
            sha256: topic.dispatch.prompt_sha256,
            note: 'Generated from the dispatched brief and reproduced in full inside this prompt.'
          }
          : {
            kind: sourceKind,
            repo_path: repoPath,
            sha256: sha256Of(text[stageId]),
            note: 'Generated from the catalogue and the topic map, and shown on the page before it is copied.'
          },
        document_type: TOPIC_STAGE_META[stageId].document_type,
        parent_stage: stageId === 'research' ? null : stageId === 'red_team' ? 'research' : 'red_team',
        deliverable: TOPIC_STAGE_META[stageId].deliverable,
        returns: TOPIC_STAGE_META[stageId].returns
      };
    });

    return {
      topic_id: topic.topic_id,
      asset: topic.asset,
      slug: topic.slug,
      title: topic.title,
      summary: topic.summary,
      factor_ids: topic.factor_ids,
      overlaps: topic.overlaps,
      next_step: topic.next_step,
      dispatch: topic.dispatch,
      companions: topic.companions,
      packs: topic.packs,
      probes: topic.probes,
      stages
    };
  });

  const factorIds = new Set(topics.flatMap(topic => topic.factor_ids));
  USD_ASSET.factors.forEach(factor => {
    if (!factorIds.has(factor.factor_id)) problems.push(`factor ${factor.factor_id} sits in no topic`);
  });
  return { topics, files, problems };
}

function writeTopicFiles(built) {
  built.files.forEach(file => {
    const absPath = path.join(root, file.repo_path);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, file.text);
  });
}

function topicsCommand(flag) {
  const built = buildTopics();
  if (!report('topics', built.problems)) return 1;
  if (flag === '--write') {
    writeTopicFiles(built);
    console.log(`topics written: ${built.files.length} prompt files under ${TOPIC_DIR}`);
    return 0;
  }
  const drifted = built.files.filter(file => {
    const absPath = path.join(root, file.repo_path);
    return !fs.existsSync(absPath) || fs.readFileSync(absPath, 'utf8') !== file.text;
  });
  if (drifted.length) {
    console.log(`topics check: ${drifted.length} prompt file(s) differ from the authored prompts. Run topics --write.`);
    drifted.forEach(file => console.log(`  - ${file.repo_path}`));
    return 1;
  }
  const committed = readJsonIfExists(catalogPath);
  if (committed && JSON.stringify(built.topics) !== JSON.stringify(committed.topics || [])) {
    console.log('topics check: the committed catalogue carries a different topic map. Run catalog --write.');
    return 1;
  }
  console.log(`topics check: ${built.files.length} prompt files and the topic map match the authored topics.`);
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
    const built = buildTopics();
    if (!report('topics', built.problems)) return 1;
    writeTopicFiles(built);
    console.log(`topic prompts written: ${built.files.length} files under ${TOPIC_DIR}`);
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
  // The topic prompts are checked against the authored text, not just against the hash in the catalogue: a
  // prompt file edited on disk after the catalogue was written has to fail this guard.
  const builtTopics = buildTopics();
  ok = report('topics', builtTopics.problems) && ok;
  ok = report('topic prompts', builtTopics.files
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
  const topics = ResearchLibrary.listTopics(catalog);
  console.log(`topics: ${topics.length}, ${ResearchLibrary.TOPIC_STAGES.length} stages each`);
  topics.forEach(topic => {
    const progress = ResearchLibrary.topicProgress(topic, registry);
    const stages = progress.stages.map(stage => `${stage.stage}=${stage.state}`).join(', ');
    console.log(`topic ${topic.topic_id}: ${stages}; next ${progress.next_stage || 'none'}; ready for synthesis ${progress.ready_for_synthesis}`);
  });
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
  if (command === 'topics') process.exit(topicsCommand(flag));
  if (command === 'verify') process.exit(verifyCommand());
  console.log('usage: node scripts/build_research_library.js <catalog|registry|topics|verify> [--write|--check]');
  process.exit(1);
}

main();
