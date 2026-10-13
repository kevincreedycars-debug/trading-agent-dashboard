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
const TODAY = '2026-10-13';

const SESSION_OBJECTIVE =
  'One directional USD call per day over the 05:00 Europe/London to 17:00 America/New_York session, '
  + 'from factors whose value is observable at the cutoff, with the label instrument and quote source declared.';

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
    schema_version: 'research-card-v1',
    format: 'one JSON document per card, collected into a single file per task on return',
    verdict: 'A card may conclude that the factor should not be used. A returned card is research evidence, not an approved rule.',
    required_fields: [
      'card_id',
      'asset',
      'family',
      'mechanism',
      'sign_and_conditions',
      'role',
      'inputs_required',
      'observable_at_cutoff',
      'programmable_hypothesis',
      'allowed_parameter_values',
      'falsifying_result',
      'overlap_and_double_counting',
      'sources'
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
// exports/usd_layer1_agent.json (workflow OCt1tB9yVMUgFTha v154) and logic/agent_usd_direction.md v2.1.
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
    brief: 'Trailing 1-day and 5-day move in the label instrument, read at the cutoff: continuation or fade inside the 17-hour window.',
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
  'card_id', 'asset', 'family', 'mechanism', 'sign_and_conditions', 'role', 'inputs_required',
  'observable_at_cutoff', 'programmable_hypothesis', 'allowed_parameter_values', 'falsifying_result',
  'overlap_and_double_counting', 'sources'
];
const ISSUE_SCHEMA_PATH = 'docs/research/usd-session/v1/review-issue-register.schema.json';


const DATA_INFORMATION = [
  'No intraday dollar index print exists in this repository or in the live collector, so the cutoff and endpoint prices are unverified at both ends.',
  'The live collector takes one snapshot per day at the 09:30 ET pipeline time and prices the dollar with FRED DTWEXBGS, a daily index published with a one to two business-day lag.',
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
    'Cutoff: 05:00 Europe/London. Endpoint: 17:00 America/New_York on the same local date. The two zones change on different dates, so the window is 17 hours on most days and 16 hours in the spring and autumn mismatch weeks.',
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
    `Output schema: ${CARD_SCHEMA_PATH} (research-card-v1), one JSON document per card, carrying every one of: ${CARD_SCHEMA_FIELDS.join(', ')}. A card that leaves a required field empty is not accepted.`,
    '',
    'Every card must answer, in its own words: the mechanism that would operate inside this specific 17-hour window; when the relation changes sign, weakens, or stops being informative because it is already priced; whether the factor is direction, regime context, a quality gate or an abstention gate; what exactly was observable at the cutoff and how stale each input is; the programmable hypothesis with its bounded parameter values; the result that would falsify it; and which other cards share the same information and what would be double-counted.',
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
    `The cards under review follow ${CARD_SCHEMA_PATH} (research-card-v1): use it to check that each card answers every required field, and say so when one does not.`,
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
    `The cards and reviews you combine follow ${CARD_SCHEMA_PATH} (research-card-v1) and ${ISSUE_SCHEMA_PATH}; keep both shapes so the synthesis can be checked mechanically.`,
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
  'Deployed 24h weights as coded in Calculate USD Conviction, workflow OCt1tB9yVMUgFTha v154: F1 10, F2 14, F3 10,',
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
    covers: ALL_RESEARCH_CARD_IDS,
    gaps: [
      'This review cannot start until both field packages return their cards.',
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
      lens: 'Lens: economic and market mechanism. Judge whether each proposed card would actually operate inside this 17-hour window.',
      subject: 'Subject: the fifteen research cards returned by the two field packages, taken as written. Read them as claims to be attacked rather than as findings to be summarised.',
      extra: [
        'For every card ask: is the stated mechanism true, and is it true on this horizon rather than on a daily or monthly one; is the sign right and does it flip in any plausible regime; is the timing right, that is when inside the window does it act; is the information already in the price by 05:00 London; and which other card carries the same information, so that weighting both would double-count one idea.',
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
    covers: ALL_RESEARCH_CARD_IDS,
    gaps: [
      'This review cannot start until both field packages return their cards.',
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
      subject: 'Subject: the fifteen research cards returned by the two field packages, plus the proposed frozen evaluation design.',
      extra: [
        'For every card ask: is the input genuinely available at 05:00 London, and at what publication lag; is any value used that could only be known later; is the parameter bounded tightly enough to avoid a fitted curve; is the stated falsifying test real; and does the card quietly depend on a proxy that changes what is being measured.',
        'Then judge the evaluation design: the development, validation and holdout split, the flat band, the abstention rule, the scoring metric, the uncertainty reporting and the sealed set. Say approved, approved with conditions or refused, and name the clause you would change.',
        'Call out any card that cannot be tested at all with the data named in this package.'
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
    covers: ALL_RESEARCH_CARD_IDS,
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
      subject: 'Subject: the fifteen field cards, Reviewer A and Reviewer B, and the frozen evaluation design. Produce the specification the field cards and the reviews jointly support, which is likely to be smaller than the card set.',
      closing: 'Return the specification, the issue register, the conflicts you could not resolve, what remains unverifiable, and the decisions only the user can take.'
    })
  }
];

const USD_ASSET = {
  asset: 'USD',
  label: 'US Dollar',
  standfirst: 'The first asset in the library and the only one with factors under research today.',
  status: 'active',
  next_step: "Run the two field packages in the reader's own ChatGPT session, upload the returns against their task ids, then run the two reviews.",
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
  { document_id: 'usd-session-contract', title: 'Session target contract v1', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/session_contract_v1.json', note: 'The 05:00 London to 17:00 New York target, with the label decision left open.' },
  { document_id: 'usd-session-exposed-periods', title: 'Exposed periods record', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/exposed_periods.md', note: 'What has already been read, so nothing is later called unseen.' },
  { document_id: 'usd-session-implementation-plan', title: 'Implementation and experiment plan', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/implementation_plan.md', note: 'Includes the evaluation design Reviewer B must approve.' },
  { document_id: 'usd-session-isolation', title: 'Isolation note', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/isolation.md', note: 'What actually stops a research run writing into production.' },
  { document_id: 'usd-session-checkpoint-1', title: 'Checkpoint 1', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/CHECKPOINT_1.md', note: 'The first checkpoint return.' },
  { document_id: 'usd-session-checkpoint-2', title: 'Checkpoint 2', document_type: 'brief', repo_path: 'docs/research/usd-session/v1/CHECKPOINT_2.md', note: 'This cycle: macro inventory, source assessment, weight vectors and the research library.' },
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

function buildCatalog() {
  return {
    schema_version: 'research-library-catalog-v1',
    generated_at: TODAY,
    asset_order: ResearchLibrary.ASSET_ORDER.slice(),
    scope_note: 'Research management only. Preparing a task writes nothing to a model, uploading a report records evidence, and a returned report becomes a rule only after a review accepts it and a backtest supports it.',
    storage: STORAGE,
    tasks: TASKS,
    engine_documents: ENGINE_DOCUMENTS,
    repo_documents: REPO_DOCUMENTS,
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

  REPO_DOCUMENTS.forEach(entry => {
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

function catalogCommand(flag) {
  const rendered = render(buildCatalog());
  if (!report('catalog validation', ResearchLibrary.validateCatalog(JSON.parse(rendered)))) return 1;
  if (flag === '--write') {
    fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
    fs.writeFileSync(catalogPath, rendered);
    console.log(`catalog written: ${path.relative(root, catalogPath)}`);
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
  const coverage = ResearchLibrary.factorCoverage(catalog);
  const counts = ResearchLibrary.progressCounts(ResearchLibrary.listFactors(catalog));
  console.log(`assets ${ResearchLibrary.listAssets(catalog).length}, factors ${counts.total}, tasks ${coverage.tasks.length}`);
  console.log(`research ${JSON.stringify(counts.research)}`);
  console.log(`review ${JSON.stringify(counts.review)}`);
  console.log(`backtest ${JSON.stringify(counts.backtest)}`);
  console.log(`factors not covered by any task: ${coverage.uncovered.length}`);
  coverage.uncovered.forEach(entry => console.log(`  - ${entry.asset} ${entry.factor_id}`));
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
  if (command === 'verify') process.exit(verifyCommand());
  console.log('usage: node scripts/build_research_library.js <catalog|registry|verify> [--write|--check]');
  process.exit(1);
}

main();
