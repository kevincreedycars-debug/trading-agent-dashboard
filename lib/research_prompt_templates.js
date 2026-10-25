'use strict';

// Versioned research-prompt templates for the Research Library topic chains.
//
// One template version, one skeleton, three stages. Every prompt the library publishes is rendered from
// this file, so a defect is fixed once instead of being copy-pasted into twenty-five chains, and the
// audit at the bottom of this module fails the build rather than shipping a contradictory prompt.
//
// The authoring rules, in the order the audit checks them:
//
//   1. One objective per prompt, stated once, in its own section, before any question.
//   2. The asset, the factor entries and the session are named from data, never left to the reader to
//      infer from a repository or a dashboard.
//   3. Inputs are listed exactly: which file, which hash, which sections, and which document the
//      operator supplies at stages 2 and 3.
//   4. One deliverable: one Markdown file with one fixed section list. No JSON, no card, no second file.
//   5. No placeholders. A value the reader may not have is written as `unknown`, never as an empty angle
//      bracket, and never requires the reader to read the library's own metadata back out of the page.
//   6. No instruction from an older workflow survives in the text: no four-step brief, no stage card, no
//      dashboard navigation, no implementation step presented as the deliverable.
//
// This module is data and rendering only. It reads nothing from disk, sends nothing anywhere and holds
// no credential.

const TEMPLATE_VERSION = 'research-prompt-v3.0.0';

// The fixed section list of every prompt, in order. A prompt is the same skeleton at every stage and for
// every chain, so a reader who has answered one stage knows where everything is in the next.
const SECTION_TITLES = [
  '## Assignment',
  '## Objective',
  '## The session and the instrument',
  '## Inputs',
  '## Questions to answer',
  '## Evidence standard',
  '## Deliverable',
  '## Completion checklist',
  '## Prohibitions',
  '## What happens next'
];

// Two chain shapes share the skeleton:
//
//   factor            one research question about a set of factor entries, then a review of that report,
//                     then an adjudication of both. Six of these in the USD programme.
//   asset_synthesis   one reconciliation of the topic adjudications into a single candidate model and a
//                     validation plan, then a review of that plan, then an adjudication of both. This
//                     chain is what turns a set of topics into an engine proposal, and it exists because
//                     a sum of per-factor scores is not a model.
const CHAINS = {
  factor: {
    kind: 'factor',
    stages: {
      research: { order: 1, file_slug: 'research', label: 'Research', document_type: 'report', deliverable_kind: 'research' },
      red_team: { order: 2, file_slug: 'red-team', label: 'Red-team', document_type: 'review', deliverable_kind: 'red-team' },
      adjudication: { order: 3, file_slug: 'adjudication', label: 'Adjudication', document_type: 'synthesis', deliverable_kind: 'adjudication' }
    }
  },
  asset_synthesis: {
    kind: 'asset_synthesis',
    stages: {
      research: { order: 1, file_slug: 'proposal', label: 'Final analysis', document_type: 'report', deliverable_kind: 'final-analysis' },
      red_team: { order: 2, file_slug: 'red-team', label: 'Red-team', document_type: 'review', deliverable_kind: 'red-team' },
      adjudication: { order: 3, file_slug: 'adjudication', label: 'Adjudication', document_type: 'synthesis', deliverable_kind: 'adjudication' }
    }
  }
};

const CHAIN_KINDS = Object.keys(CHAINS);
const STAGE_ORDER = ['research', 'red_team', 'adjudication'];

function chainOf(kind) {
  return CHAINS[kind] || CHAINS.factor;
}

function stageMeta(kind, stage) {
  const chain = chainOf(kind);
  return chain.stages[stage] || null;
}

// The file a stage returns. One name per topic and stage, derived rather than typed, so the prompt, the
// section that lists upstream documents and the operator's upload all agree without a second list.
function deliverableFileName({ asset, slug, kind, stage }) {
  const meta = stageMeta(kind, stage);
  if (!meta) return '';
  const assetPart = String(asset || '').trim().toLowerCase();
  return `${assetPart}-${slug}-s${meta.order}-${meta.file_slug}.md`;
}

const FILE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*-s[123]-(?:research|proposal|red-team|adjudication)\.md$/;

// ------------------------------------------------------------------------------------------------
// Asset profiles
//
// A prompt cannot be asset-agnostic in the one place it matters: the session, the instrument that
// labels it and the data that can actually be reached. Those three are data per asset, so a new asset
// is a profile plus its own factor entries rather than a copy of another asset's prompt with the
// currency symbol changed.
//
// Only USD is `active`. Every other asset is `draft`, which means its prompt states its open decisions
// as open decisions. Nothing here invents a session time, a quote source or a licence for an asset
// whose source assessment has not been written.
// ------------------------------------------------------------------------------------------------

const ASSET_PROFILES = {
  USD: {
    asset: 'USD',
    label: 'US Dollar',
    status: 'active',
    session: {
      title: '05:00 Europe/London to 05:00 Europe/London, next local date',
      cutoff: '05:00 Europe/London',
      contract: 'docs/research/usd-session/v1/session_contract_v1.json',
      lines: [
        'Session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.',
        'Label instrument: DXY, and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. If a claim is really about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence and say what its window is.',
        'The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps this session for about 14.5 nominal hours and leaves the session\'s first 9.5 hours unmeasured. Say which window every number belongs to.',
        'The window is closed to later information: a value published after 05:00 London, or a revision published later, may not be used as what was known at the cutoff.'
      ]
    },
    label_instrument: {
      name: 'DXY',
      status: 'unverified',
      note: 'Proposed and unverified: no intraday dollar-index print exists in this repository or in the live collector.'
    },
    open_questions: []
  },
  EUR: {
    asset: 'EUR',
    label: 'Euro',
    status: 'draft',
    session: { title: 'not decided', cutoff: 'not decided', contract: null, lines: [] },
    label_instrument: { name: 'EUR/USD spot', status: 'undecided', note: 'Candidate only. No source assessment exists for this asset.' },
    open_questions: [
      { id: 'EUR-Q1', question: 'Which window is the label window: the USD 05:00 London to 05:00 London session, a Frankfurt-to-New York day, or another one?' },
      { id: 'EUR-Q2', question: 'Which instrument labels the euro: EUR/USD spot from a named venue, a futures contract with its expiry, or a synthetic index?' },
      { id: 'EUR-Q3', question: 'Is the only cached euro series, the hourly OANDA EUR/USD file that ends 2026-04-30, enough for a historical test, or does a paid intraday source have to be bought first?' }
    ]
  },
  GBP: {
    asset: 'GBP',
    label: 'British Pound',
    status: 'draft',
    session: { title: 'not decided', cutoff: 'not decided', contract: null, lines: [] },
    label_instrument: { name: 'GBP/USD spot', status: 'undecided', note: 'Candidate only. No source assessment exists for this asset.' },
    open_questions: [
      { id: 'GBP-Q1', question: 'Which window is the label window, given that the London fix and the Bank of England announcement sit inside it?' },
      { id: 'GBP-Q2', question: 'Which instrument labels sterling: GBP/USD spot from a named venue, a futures contract, or a trade-weighted index, and what is its quote source?' },
      { id: 'GBP-Q3', question: 'No hourly sterling series is cached in this checkout, so what would the first test actually be run on?' }
    ]
  },
  GOLD: {
    asset: 'GOLD',
    label: 'Gold',
    status: 'draft',
    session: { title: 'not decided', cutoff: 'not decided', contract: null, lines: [] },
    label_instrument: { name: 'XAU/USD spot', status: 'undecided', note: 'The cached OANDA XAU/USD series is the only gold history in this checkout and ends 2026-04-30.' },
    open_questions: [
      { id: 'GOLD-Q1', question: 'Which window is the label window, and does the existing gold lane horizon policy govern it or the USD session contract?' },
      { id: 'GOLD-Q2', question: 'Which instrument labels gold: XAU/USD spot from a named venue, a COMEX futures contract with its expiry, or a trust share price?' },
      { id: 'GOLD-Q3', question: 'Does the gold lane keep its own evaluation design, so that this chain answers a different question rather than repeating it?' }
    ]
  },
  SILVER: {
    asset: 'SILVER',
    label: 'Silver',
    status: 'draft',
    session: { title: 'not decided', cutoff: 'not decided', contract: null, lines: [] },
    label_instrument: { name: 'XAG/USD spot', status: 'undecided', note: 'No silver series is cached in this checkout.' },
    open_questions: [
      { id: 'SILVER-Q1', question: 'Which window is the label window, and what would make it differ from the gold window?' },
      { id: 'SILVER-Q2', question: 'Which instrument labels silver, and is the ratio to gold a separate entry or the same information twice?' },
      { id: 'SILVER-Q3', question: 'No silver series is cached here: what would the first test be run on, and is a paid source needed before any of it is asked?' }
    ]
  },
  NQ: {
    asset: 'NQ',
    label: 'Nasdaq 100',
    status: 'draft',
    session: { title: 'not decided', cutoff: 'not decided', contract: null, lines: [] },
    label_instrument: { name: 'Nasdaq 100 index or future', status: 'undecided', note: 'The live collector prices NQ with a QQQ quote, which is an ETF on the index and not the index or its future.' },
    open_questions: [
      { id: 'NQ-Q1', question: 'Which window is the label window: the cash session, the futures day that opens at 18:00 New York, or the USD 05:00 London to 05:00 London session?' },
      { id: 'NQ-Q2', question: 'Which instrument labels NQ: the index, the front futures contract with its expiry, or the QQQ ETF the collector stores today?' },
      { id: 'NQ-Q3', question: 'Is the cached hourly NAS100 file that ends 2026-04-30 the same instrument as the label, and if not, what is?' }
    ]
  },

  BTC: {
    asset: 'BTC',
    label: 'Bitcoin',
    status: 'draft',
    session: { title: 'not decided', cutoff: 'not decided', contract: null, lines: [] },
    label_instrument: { name: 'BTC spot', status: 'undecided', note: 'Spot quotes from one venue only; a 24/7 market has no natural local-date boundary.' },
    open_questions: [
      { id: 'BTC-Q1', question: 'Which window is the label window for a market that never closes, and what fixes its two ends?' },
      { id: 'BTC-Q2', question: 'Which venue and instrument label bitcoin, and how is the weekend treated when a local-date boundary does not exist?' },
      { id: 'BTC-Q3', question: 'Is a venue-specific spot quote evidence about bitcoin, or about that venue?' }
    ]
  },
  WTI: {
    asset: 'WTI',
    label: 'Crude Oil (WTI)',
    status: 'draft',
    session: { title: 'not decided', cutoff: 'not decided', contract: null, lines: [] },
    label_instrument: { name: 'WTI front-month future', status: 'undecided', note: 'Contract roll decides what a continuous series measures; no oil series is cached here.' },
    open_questions: [
      { id: 'WTI-Q1', question: 'Which window is the label window, given that the settlement price and the weekly inventory release fall inside a London-to-London day?' },
      { id: 'WTI-Q2', question: 'Which instrument labels WTI: the front-month contract with its expiry, a continuous series with a stated roll rule, or a dated contract?' },
      { id: 'WTI-Q3', question: 'No oil series is cached here: what would the first test be run on?' }
    ]
  }
};

const ASSET_ORDER = ['USD', 'EUR', 'GBP', 'GOLD', 'SILVER', 'NQ', 'BTC', 'WTI'];

function assetProfile(asset) {
  const key = String(asset || '').trim().toUpperCase();
  return ASSET_PROFILES[key] || null;
}

// ------------------------------------------------------------------------------------------------
// Rendering
//
// Every block below returns text without a trailing newline; buildStagePrompt joins them. Nothing is
// conditional on a repository path beyond the hashes and the section anchors passed in, so the same
// code renders a USD chain and a draft EUR chain.
// ------------------------------------------------------------------------------------------------

function titleLine(context) {
  const meta = stageMeta(context.kind, context.stage);
  const profile = context.profile || assetProfile('USD');
  return `# ${context.topic.title} - ${profile.asset} stage ${meta.order} of 3: ${meta.label}`;
}

function sessionLines(profile) {
  if (!profile) return ['Session: not stated. Say which window every claim concerns.'];
  if (profile.status === 'active') return profile.session.lines.slice();
  const lines = [
    'Session: not decided for this asset. The decisions below are what a stage would have to state before it could be run; until they are taken, every claim must name the window and the instrument it actually uses.'
  ];
  lines.push(`Label instrument: undecided, with \`${profile.label_instrument.name}\` as the candidate only. ${profile.label_instrument.note}`);
  (profile.open_questions || []).forEach(entry => lines.push(`${entry.id}: ${entry.question}`));
  return lines;
}

function objectiveText(context) {
  const profile = context.profile || assetProfile('USD');
  const topicTitle = context.topic.title;
  const assetLabel = profile.label;
  const stage = context.stage;

  if (context.kind === 'asset_synthesis') {
    if (stage === 'research') {
      return [
        `Produce one candidate ${assetLabel} model specification and one empirical validation plan, reconciled from the topic adjudications, and state what the evidence does and does not support.`,
        'The question is not which factor scored best. It is whether the topics, read together, describe one coherent decision rule for the session above, which entries actually carry it, and what a fair test of it would look like.',
        'A list of per-factor scores added together is not a model: state the aggregation policy, the reason for it and the evidence behind it. Nothing in this stage is fitted, scored, validated or deployed.'
      ].join(' ');
    }
    if (stage === 'red_team') {
      return [
        `Attack the ${assetLabel} candidate model specification and validation plan in the document you are given, claim by claim, and return one issue register.`,
        'Attack both halves: whether the specification is computable, timely and free of double counting, and whether the plan could tell a real relation from an artefact of the sample, the benchmarks or the number of comparisons tried.',
        'Do not rewrite the specification. Say what is wrong, how much it matters and what evidence would settle it.'
      ].join(' ');
    }
    return [
      `Decide the ${assetLabel} proposal: settle every material objection against the final analysis and its review, and return the accepted specification, the accepted validation plan and the list of what remains unresolved.`,
      'Where the evidence does not decide, say so and say what would. Do not average the two documents, and do not treat their agreement as evidence.',
      'This stage proposes; it does not fit, score, deploy or change a live call.'
    ].join(' ');
  }

  if (stage === 'research') {
    return [
      `Answer one question in one report: ${context.topic.question}`,
      `Return a source-backed report that states what the evidence supports for the ${assetLabel} session above, what it does not, and what would refute each claim, using the entries named below as the scope of evidence.`,
      'The rules in force are the baseline to audit, not the target and not evidence. The report is evidence about this topic; it is not a trading rule, and nothing you return changes a live call.'
    ].join(' ');
  }
  if (stage === 'red_team') {
    return [
      `Attack one document: the stage 1 report for ${topicTitle}, which the operator supplies, and return one issue register.`,
      'Judge every load-bearing claim on the passage it cites and on the sources you fetch yourself, give each claim a verdict, a severity and the evidence that would settle it, and keep separate what the report gets right, what it cannot support and what you could not reach.',
      'Do not rewrite the report and do not propose an implementation; a narrower true claim is a result, not a loss.'
    ].join(' ');
  }
  return [
    `Decide one topic: settle every material objection against the stage 1 report and the stage 2 review for ${topicTitle}, and return the corrected, best-supported conclusion.`,
    'State what the topic rules out, what stays unresolved and what would settle it, and state a treatment of the entries only where the evidence supports one, naming every parameter that has not been measured.',
    `This stage decides on the evidence available when it is run; it does not fit, score, deploy or change a live call.`
  ].join(' ');
}

function assignmentBlock(context) {
  const meta = stageMeta(context.kind, context.stage);
  const profile = context.profile || assetProfile('USD');
  const lines = [
    '## Assignment',
    '',
    `- Topic: \`${context.topic.topic_id}\` on ${profile.asset} (${profile.label}), chain \`${context.kind}\`.`,
    `- Stage: ${meta.order} of 3, ${meta.label.toLowerCase()}. This stage returns exactly one Markdown document (${meta.document_type}), named \`${context.deliverable.file_name}\`.`,
    `- Prompt template: \`${TEMPLATE_VERSION}\`, written ${context.date}. The template is versioned: if a newer \`${TEMPLATE_VERSION.split('-v')[0]}\` template exists, that one governs and this file is superseded.`,
    '- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.',
    profile.status === 'active'
      ? '- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.'
      : '- Asset status: draft. No stage of this chain has been run, and this prompt states its open decisions as open decisions instead of assuming them.'
  ];
  lines.push(...programmeLines(context));
  return lines.join('\n');
}

function programmeLines(context) {
  const programme = context.programme || {};
  const lines = [];
  if (programme.dispatched) {
    const detail = [
      programme.pack_version ? `pack version ${programme.pack_version}` : '',
      programme.context_version ? `context version ${programme.context_version}` : ''
    ].filter(Boolean).join(', ');
    lines.push(`- Programme record: this topic was dispatched as task \`${programme.task_id}\`${detail ? `, ${detail}` : ''}. Anything already returned for it is an earlier version of this topic and is not an input here unless the inputs section names it.`);
  } else {
    lines.push('- Programme record: this topic has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.');
  }
  (programme.superseded || []).forEach(entry => {
    lines.push(`- Superseded brief: \`${entry.repo_path}\` (sha256 \`${entry.sha256}\`) set out an earlier workflow for this topic. It is kept as programme history and must not be followed or answered; the one deliverable this stage asks for is the one named above.`);
  });
  return lines;
}

function sessionBlock(context) {
  const profile = context.profile || assetProfile('USD');
  const lines = sessionLines(profile).map(line => `- ${line}`);
  if (profile.status !== 'active' && profile.session && profile.session.contract) {
    lines.push(`- Contract: \`${profile.session.contract}\`. If what you read there and this prompt disagree, say so in the report and use the contract.`);
  }
  return ['## The session and the instrument', '', ...lines].join('\n');
}

function entryLines(entry) {
  const lines = [
    `- \`${entry.factor_id}\` - ${entry.label}. Role: ${entry.role || 'not stated'}. Group: ${entry.group || 'not stated'}. Research status: ${entry.research_status || 'not stated'}.`,
    `  - What the entry stands for: ${entry.brief}`
  ];
  if ((entry.current_rules || []).length) {
    lines.push(`  - Rule in force today, the baseline to audit and never evidence: ${entry.current_rules.join('; ')}.`);
  }
  if (entry.threshold) lines.push(`  - Threshold: ${entry.threshold}. Lookback: ${entry.lookback || 'not stated'}.`);
  if ((entry.sources || []).length) lines.push(`  - Series the collector reads: ${entry.sources.join('; ')}.`);
  if ((entry.blockers || []).length) lines.push(`  - Recorded blocker: ${entry.blockers.join('; ')}.`);
  if (entry.pack) {
    lines.push(`  - Published brief: \`${entry.pack.repo_path}\` (sha256 \`${entry.pack.sha256}\`, ${entry.pack.bytes} bytes). Read it with this prompt if it is attached; the questions below stand without it.`);
  }
  return lines;
}

function companionLines(companions) {
  return (companions || []).map(entry => {
    const anchor = entry.anchor ? ` Read: ${entry.anchor}.` : '';
    return `- \`${entry.repo_path}\` - ${entry.role}.${anchor} sha256 \`${entry.sha256}\`.`;
  });
}

function givenPreamble(context) {
  if (context.kind === 'asset_synthesis' && context.stage === 'research') {
    return 'These are the topic adjudications this stage reconciles, supplied by the operator. If some are missing, name which and continue: an incomplete reconciliation that says so is a usable result, a silent one is not.';
  }
  if (context.stage === 'red_team') {
    return 'Supplied by the operator. Record the file name and the first heading of the document you judge in the header lines your deliverable asks for. If what you were given is clearly another topic or another stage, stop and say so.';
  }
  if (context.stage === 'adjudication') {
    return 'Supplied by the operator. Record the file name and the first heading of each document you judge in the header lines your deliverable asks for. If either is clearly another topic or another stage, stop and say so.';
  }
  return 'Supplied by the operator.';
}

function givenLine(entry, withIdentity) {
  const head = `- \`${entry.file_name}\` - ${entry.note}`;
  if (!withIdentity) return head;
  const joined = head.endsWith('.') ? head : `${head}.`;
  const identity = [`version \`${entry.version || 'unknown'}\``, `sha256 \`${entry.sha256 || 'unknown'}\``];
  return `${joined} As supplied: ${identity.join(', ')}.`;
}

function inputsBlock(context) {
  const sections = ['## Inputs', ''];
  if (context.kind === 'asset_synthesis') {
    sections.push(
      context.stage === 'research'
        ? '### The topic adjudications this stage reconciles'
        : '### Documents you are given',
      '',
      givenPreamble(context),
      '',
      ...(context.given || []).map(entry => givenLine(entry, context.stage !== 'research')),
      ''
    );
    sections.push(
      '### The entries in scope',
      '',
      'Every entry below belongs to at least one of those topics. They are the catalogue\'s record of what is being proposed, not evidence, and not the scope limit of the reconciliation.',
      '',
      ...(context.entries || []).flatMap(entryLines),
      ''
    );
  } else {
    sections.push(
      '### The factor entries this topic answers for',
      '',
      'These are the catalogue entries this topic is evidence for. They are context to audit, never evidence for a claim, and never the scope limit of the assignment.',
      '',
      ...(context.entries || []).flatMap(entryLines),
      ''
    );
    if ((context.given || []).length) {
      sections.push(
        '### Documents you are given',
        '',
        givenPreamble(context),
        '',
        ...(context.given || []).map(entry => givenLine(entry, context.stage !== 'research')),
        ''
      );
    }
  }
  const companions = companionLines(context.companions);
  if (companions.length) {
    sections.push(
      '### Documents in this checkout',
      '',
      'Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.',
      '',
      ...companions,
      ''
    );
  }
  return sections.join('\n').trimEnd();
}

function entryQuestions(entry) {
  const lookback = entry.lookback || 'not stated';
  const measurement = `\`${entry.factor_id}\` (${entry.label}): ${entry.brief} What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (${lookback}), or another transform?`;
  const audit = (entry.current_rules || []).length
    ? `\`${entry.factor_id}\` audit: the rule in force reads ${entry.current_rules.join('; ')}, with threshold ${entry.threshold || 'none stated'} and lookback ${lookback}. Is that sign, that threshold and that lookback supported for this window, and what would refute it?`
    : `\`${entry.factor_id}\`: no rule is in force. State the candidate relation worth testing for this entry, what would refute it, and how it could be measured with the data named in this prompt.`;
  return [measurement, audit];
}

const QUESTION_GROUPS = {
  'factor/research': [
    { title: 'Questions about this topic', source: 'probes' },
    {
      title: 'Questions that apply to the whole topic',
      items: [
        'Which entries in this topic are the same information counted twice, which one carries it, and what would tell them apart?',
        'What is observable at the cutoff, what has the cutoff already absorbed, and what arrives only during the session?',
        'What has actually been measured about this window with this instrument - the sample, the era, the regime and the number of independent observations - and where is the honest answer that nothing has?',
        'What is the strongest contrary evidence you found, and what would refute the relation you would propose?',
        'What would the test need that this repository or the collector does not have, and what sits behind a paywall?'
      ]
    },
    { title: 'Questions about each entry', entry: true }
  ],
  'factor/red_team': [
    {
      title: 'Questions to answer, claim by claim',
      items: [
        'For each load-bearing claim: what exactly does it assert, and does the passage it cites support it as stated?',
        'Window: is the evidence about the session above, or about a close-to-close day, an intraday slice or another window presented as if it were ours?',
        'Instrument: is a claim really about EUR/USD, a basket, a futures contract or an ETF, presented under another name?',
        'Mechanism against measurement: is a plausible channel being used as though the relation had been measured?',
        'Already priced: does the claim count as predictive something the cutoff has already absorbed?',
        'Identification: sample period, era and regime dependence, conditioning on the outcome, survivorship in the sources chosen, the base rate behind a conditional claim, and any number with no stated origin.',
        'Counter-evidence: is the strongest contrary evidence in the sources the report fetched missing, or present and dismissed without a reason?',
        'Internal consistency and scope: does one section contradict another, does the what-is-not-claimed section match the body, and is any true claim only too wide?',
        'Coverage: does every entry in scope get an answer, and is every question the report could not answer named as unanswered?'
      ]
    }
  ],
  'factor/adjudication': [
    {
      title: 'Questions to decide, finding by finding',
      items: [
        'For each material objection: do the two documents and the sources you fetch decide it, or does it stay open?',
        'Where the report and the review agree, do they rest on the same source - and if so, is that agreement evidence, or one source counted twice?',
        'Which conclusion survives in corrected form, and exactly what changed in it?',
        'Which objection is rejected, and what is wrong with it?',
        'Which claim stays unresolved, and what measurement would settle it?',
        'Is any proposed treatment computable from the data named in this prompt, and which of its parameters have not been measured?',
        'Does the proposed treatment count one input twice across entries or topics, and if so, which topic owns it?',
        'What must the asset synthesis decide that this topic cannot?'
      ]
    }
  ]
};

// The synthesis chain asks the questions a set of per-factor scores cannot answer, which is why it is a
// separate chain rather than a seventh topic.
Object.assign(QUESTION_GROUPS, {
  'asset_synthesis/research': [
    {
      title: 'Questions about the reconciliation',
      items: [
        'What do the topic adjudications agree on, and where do they conflict - each conflict named as a pair of claims rather than a general tension?',
        'Which conflicts are real disagreements, and which are different windows or different instruments being compared?',
        'Which entries survive as separate evidence, which are one idea under two names, and which are dropped or stay blocked - each with the reason and the topic it came from?'
      ]
    },
    {
      title: 'Questions about the candidate specification',
      items: [
        'What is the decision rule, stated so that it can be computed: inputs, transforms, timing, sign logic, interactions, abstention and the missing-data policy?',
        'What is the aggregation policy, and what is the evidence for it? Equal weights, a fixed rule and a fitted vector are three different claims; say which you propose and what would validate it.',
        'Does the rule double-count anything the topics already flagged, and is the overlap removed rather than reweighted?',
        'What is unvalidated in the specification, stated as a named parameter rather than a caveat?'
      ]
    },
    {
      title: 'Questions about the validation plan',
      items: [
        'What is the plan: dataset, label, eras, holdout, benchmarks, metrics with their base rates, abstention and coverage, and sensitivity to costs?',
        'Are the benchmarks fair - a no-call baseline, the deployed engine and a shuffled control - or is the plan trivially beatable?',
        'How many independent comparisons does this design buy after the overlaps, and what does that do to the significance of anything it finds?',
        'What would falsify the whole specification, and what result would make you withdraw it?',
        'What cannot be tested with the data reachable from this repository, and what would have to be bought or recorded first?'
      ]
    }
  ],
  'asset_synthesis/red_team': [
    {
      title: 'Questions to answer, claim by claim',
      items: [
        'Can the specification be computed from the inputs it names, at the cutoff it names, with the vintage discipline it claims?',
        'Is the timing honest: is every input observable at the cutoff, or does one of them only arrive later?',
        'Is any input counted twice - across entries, across topics, or through an interaction term?',
        'Is the aggregation policy justified, or is it a sum of scores dressed as a model? Where a weight is fitted, on what sample and with what protection?',
        'Are the signs and thresholds supported by the evidence cited, or inherited from the deployed baseline?',
        'Is the label the same instrument and window as the analysis, or has an ETF, a basket or a different closing time slipped in?',
        'Could the validation plan tell a real relation from a lucky one: sample size, era splits, multiplicity, holdout, and the number of variants tried?',
        'Are the benchmarks fair or trivially beatable - the no-call baseline, the deployed engine and a shuffled control?',
        'Do the metrics measure what matters, including base rates, coverage when the rule abstains, and sensitivity to costs?',
        'What is unvalidated but presented as settled, and what would falsify the whole specification?'
      ]
    }
  ],
  'asset_synthesis/adjudication': [
    {
      title: 'Questions to decide, finding by finding',
      items: [
        'For each material objection: is it accepted, rejected or unresolved, and on what evidence?',
        'Which parts of the specification are accepted as they stand, and which are narrowed or dropped?',
        'Which parts of the validation plan are accepted, and which would produce a result nobody could interpret?',
        'What is the single candidate specification now, stated so that a later implementation step could build it without reading the debate?',
        'What is the acceptance criterion for the validation, and what would make the whole model be abandoned?',
        'What remains unresolved, and what measurement would settle each item?',
        'Which decisions belong to the user alone - data purchase, instrument choice, risk appetite, scope?',
        'What does this handoff not claim, in one short list a reader can quote?'
      ]
    }
  ]
});

function questionsBlock(context) {
  const groups = QUESTION_GROUPS[`${context.kind}/${context.stage}`] || [];
  const lines = [
    '## Questions to answer',
    '',
    'Answer every question below, in order. Where the evidence does not exist, write that and what would settle it: an honest "not answerable from the sources I can reach" is a complete answer, a guess is not.',
    ''
  ];
  let number = 0;
  groups.forEach(group => {
    lines.push(`### ${group.title}`, '');
    const items = group.entry
      ? (context.entries || []).flatMap(entryQuestions)
      : group.source === 'probes' ? (context.topic.probes || []) : group.items;
    items.forEach(item => {
      number += 1;
      lines.push(`${number}. ${item}`);
    });
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

const EVIDENCE_STANDARD = [
  'Name the source for every load-bearing claim: publication, series id, table or section, and the date you read it. A claim with no source is written as your reading, not as a finding.',
  'Cite the passage you rely on. Where a source only partly supports a claim, write what it does support and what it leaves out.',
  'Separate measurement from mechanism. A channel is a hypothesis; say which part of a claim has been measured and which part has not.',
  'State the sample behind any relation: instrument, window, era and the number of non-overlapping observations. A number with no sample is not evidence.',
  'Prefer the primary source to a summary, and the series documentation to a post about the series.',
  'Report what you could not reach: paywalls, undated pages, dead links, series with no documented vintage. Do not fill the gap with a plausible number.',
  'Where two sources disagree, say so and say which you would trust and why.',
  'Every claim about timing is about this session and this cutoff, not about a general close-to-close convention.'
];

const DELIVERABLE_SECTIONS = {
  'factor/research': [
    'Summary - the answer, in at most ten lines',
    'What this topic asks and what this report answers',
    'Evidence by entry - one subsection per entry, with its series, its publication process and the sources you read',
    'What is observable at the cutoff, and what has the cutoff already absorbed',
    'What the evidence supports, by entry, with the sample behind each claim',
    'What the evidence does not support, and the claims it refutes',
    'Overlap - which entries carry the same information twice',
    'Contrary evidence, and what would refute the reading you propose',
    'What could not be established, and what would establish it',
    'Implications for the entries, each marked unvalidated, with the parameter that is unmeasured',
    'Sources'
  ],
  'factor/red_team': [
    'Summary - the verdict, in at most ten lines',
    'The document judged - file name, first heading, the version and hash you were given',
    'Claims checked - one row per load-bearing claim: claim as stated, where it is, verdict, severity, the evidence and the reason',
    'What the report gets right',
    'What the report cannot support, and the sentence that breaks it',
    'What you could not check, and what would settle it',
    'Window, instrument and timing defects',
    'Identification, sample and inference defects',
    'Overlap and double counting the report leaves unaddressed',
    'Questions the report should have answered and did not',
    'What a corrected version of the strongest surviving claim would say',
    'Sources consulted'
  ],
  'factor/adjudication': [
    'Summary - the decision, in at most ten lines',
    'The documents judged - file names, first headings, versions and hashes',
    'Decision register - one row per material objection: accepted, rejected or unresolved, with the evidence and the reason',
    'The conclusion for this topic, in corrected form',
    'What the evidence supports, by entry, with the sample behind each claim',
    'What this topic rules out',
    'Unresolved items, and the measurement that would settle each',
    'Proposed treatment, if the evidence supports one, with every unvalidated parameter named',
    'Ownership of inputs that overlap another topic',
    'What the asset synthesis must decide that this topic cannot',
    'Sources'
  ]
};

Object.assign(DELIVERABLE_SECTIONS, {
  'asset_synthesis/research': [
    'Summary - the proposal, in at most fifteen lines',
    'The adjudications reconciled - which you were given, which were missing',
    'Where the topics agree, and how strong that agreement is',
    'Where the topics conflict, and how each conflict is resolved',
    'The entries that survive as separate evidence, the ones merged, and the ones dropped, each with its reason',
    'The candidate specification - inputs, transforms, timing, sign logic, interactions, abstention, missing data and aggregation, with the evidence for each',
    'What is unvalidated in the specification, as named parameters rather than caveats',
    'The validation plan - dataset, label, eras, holdout, benchmarks, metrics with base rates, coverage, costs and multiplicity',
    'What would falsify the specification',
    'What cannot be tested here, and what would have to be bought or recorded first',
    'Sources'
  ],
  'asset_synthesis/red_team': [
    'Summary - the verdict, in at most ten lines',
    'The document judged - file name, first heading, the version and hash you were given',
    'Claims checked - one row per load-bearing claim: claim as stated, where it is, verdict, severity, the evidence and the reason',
    'Specification defects - computability, timing, double counting, aggregation, signs and thresholds, the label',
    'Validation-plan defects - splits, multiplicity, benchmarks, metrics, costs, coverage',
    'What the proposal gets right',
    'What is unvalidated but presented as settled',
    'What a corrected version would have to change, and what it should not change',
    'Questions the proposal should have answered and did not',
    'Sources consulted'
  ],
  'asset_synthesis/adjudication': [
    'Summary - the decision, in at most ten lines',
    'The documents judged - file names, first headings, versions and hashes',
    'Decision register - one row per material objection: accepted, rejected or unresolved, with the evidence and the reason',
    'The accepted specification, stated so it could be built without reading this debate',
    'The accepted validation plan, stated the same way',
    'The acceptance criterion, and the result that would abandon the model',
    'Unresolved items, and the measurement that would settle each',
    'Decisions reserved to the user - data purchase, instrument, scope, risk appetite',
    'What this handoff does not claim, in a form a reader can quote',
    'Sources'
  ]
});

const CHECKLISTS = {
  'factor/research': [
    'Every question in "Questions to answer" is answered, or named as unanswerable with what would settle it.',
    'Every entry in the inputs has a subsection in "Evidence by entry".',
    'Every load-bearing claim names its source and the sample behind it.',
    'The overlap between the entries is addressed, not assumed away.',
    'The report says what would refute the reading it proposes.',
    'Any treatment is marked unvalidated, with its unmeasured parameter named.',
    'The file name and every section heading match the instructions exactly.'
  ],
  'factor/red_team': [
    'Every load-bearing claim in the document has a row in the register.',
    'Every verdict carries a reason and a severity, not only a label.',
    'The header lines record the file name and first heading you were given, and never invent a hash.',
    'What the report gets right is listed as such.',
    'What you could not check is kept separate from what you checked and found wrong.',
    'No rewritten report, no replacement section and no proposed implementation.',
    'The file name and every section heading match the instructions exactly.'
  ],
  'factor/adjudication': [
    'Every material objection from the review has a decision.',
    'Every decision names the evidence it rests on.',
    'Agreement between the two documents that rests on one source is identified as such.',
    'The corrected conclusion can be used without reading either input document.',
    'Every unresolved item carries the measurement that would settle it.',
    'Any treatment names its unmeasured parameters and the topic that owns each overlapping input.',
    'Nothing here changes a live call, and no parameter is presented as validated.'
  ]
};

Object.assign(CHECKLISTS, {
  'asset_synthesis/research': [
    'Every adjudication you were given is used, and any missing one is named.',
    'Every conflict between topics is named as a pair of claims, with a resolution or an open flag.',
    'The specification states inputs, transforms, timing, sign logic, interactions, abstention, missing data and aggregation.',
    'The aggregation policy is stated and argued, not implied by a sum of scores.',
    'Double counting is addressed explicitly.',
    'The validation plan names data, label, eras, holdout, benchmarks, metrics with base rates, coverage and costs.',
    'What is unvalidated is listed as named parameters.',
    'The file name and every section heading match the instructions exactly.'
  ],
  'asset_synthesis/red_team': [
    'Both halves of the proposal are attacked: the specification and the validation plan.',
    'Every load-bearing claim has a row in the register with a verdict, a severity and a reason.',
    'Computability at the stated cutoff is checked input by input.',
    'Double counting is checked across entries, across topics and through interactions.',
    'The multiplicity of the validation design is assessed, not only its metrics.',
    'What the proposal gets right is listed as such.',
    'The file name and every section heading match the instructions exactly.'
  ],
  'asset_synthesis/adjudication': [
    'Every material objection has a decision with the evidence it rests on.',
    'The accepted specification is stated so it could be built without reading the debate.',
    'The accepted validation plan states its acceptance criterion before any result is known.',
    'The kill condition is stated as a result, not as a sentiment.',
    'Unresolved items are listed with the measurement that would settle each.',
    'Decisions reserved to the user are listed separately from decisions taken here.',
    'Nothing here fits, scores, deploys or changes a live call.'
  ]
});

const PROHIBITIONS = [
  'Do not treat a rule in force as evidence for itself. It is the baseline you are auditing.',
  'Do not propose or make a change to a live engine, a live call or a deployed workflow.',
  'Do not invent a number, a series id, a citation, a date or a hash. `unknown` is allowed; a guess is not.',
  'Do not return JSON, a dashboard card, a zip, a spreadsheet, a second file, or this prompt pasted back.',
  'Do not add, rename, reorder or merge the deliverable sections.',
  'Do not report a directional edge from a sample you have not described.',
  'Do not use a value published after the cutoff, or a later revision, as what was known at the cutoff.',
  'Do not treat a local export, a passing replay test or a workflow run as evidence that anything is deployed, timely or profitable.',
  'Do not assume access to data this prompt does not name; if a test needs it, say what it is and where it would come from.'
];

const NEXT_STEP = {
  'factor/research': 'The operator supplies this file, unchanged and under the same name, to stage 2 (red-team) for the same topic. Nothing else happens to it: no engine reads it, no call changes, and the report is evidence for an adjudication, not a rule.',
  'factor/red_team': 'The operator supplies this review and the report it judges, unchanged and under their own names, to stage 3 (adjudication) for the same topic. The review does not replace the report, and no engine reads either.',
  'factor/adjudication': 'The adjudication becomes the record for this topic. It is the input to the asset synthesis chain, which reconciles the topics into one candidate model and one validation plan. Nothing is fitted or deployed at this step, and a treatment named here stays unvalidated until that plan runs and is itself reviewed.',
  'asset_synthesis/research': 'The operator supplies this file, unchanged and under the same name, to stage 2 (red-team) for the same asset. Nothing is fitted, scored or deployed at this step, and no engine reads this file.',
  'asset_synthesis/red_team': 'The operator supplies this review and the final analysis it judges, unchanged, to stage 3 (adjudication) for the same asset. The review does not replace the proposal.',
  'asset_synthesis/adjudication': 'The accepted specification and the accepted validation plan are handed to the user as a proposal. Implementation, data purchase and fitting are a separate authorised step, and none of them follows automatically from this document.'
};
function deliverableBlock(context) {
  const meta = stageMeta(context.kind, context.stage);
  const file = context.deliverable.file_name;
  const sections = DELIVERABLE_SECTIONS[`${context.kind}/${context.stage}`] || [];
  const lines = [
    '## Deliverable',
    '',
    'Return exactly one Markdown file and nothing else.',
    '',
    `- File name: \`${file}\`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.`,
    '- Format: one Markdown file. No JSON, no zip, no PDF, no spreadsheet, no second file, no separate sources note, no filled-in card.',
    '- Length: as long as the material needs, and no longer. A short file that answers every question beats a long one that answers some.'
  ];
  if (meta.order > 1) {
    lines.push(
      '- Header lines, above the first heading, in this form:',
      '',
      '```',
      `Reviewed topic: ${context.topic.topic_id}`,
      'Reviewed document: <the file name you were given>',
      'Reviewed version: <the version you were given, or unknown>',
      'Reviewed sha256: <the hash you were given, or unknown>',
      'Reviewed first heading: <the first heading of that document, verbatim>',
      '```',
      '',
      'Write `unknown` where a version or a hash was not supplied. Do not invent one, and do not stop because it is missing.',
      ''
    );
  }
  lines.push('- Sections: exactly these, in this order, each as a `## ` heading with the exact title:', '');
  sections.forEach((title, index) => lines.push(`  ${index + 1}. \`## ${title}\``));
  lines.push(
    '',
    'Keep a section that turns out to be empty, and say in one sentence why it is empty.',
    'Do not restate these instructions, and do not add a section that summarises the prompt.'
  );
  return lines.join('\n');
}

function checklistBlock(context) {
  const items = CHECKLISTS[`${context.kind}/${context.stage}`] || [];
  return [
    '## Completion checklist',
    '',
    'Walk this list before you return the file. A "no" means the file is not ready.',
    '',
    ...items.map(item => `- [ ] ${item}`)
  ].join('\n');
}


// ------------------------------------------------------------------------------------------------
// Assembly and audit
// ------------------------------------------------------------------------------------------------

// Phrases that belonged to the older workflow this template replaces. None of them has a legitimate
// use in a prompt, so their presence is a regression rather than a style question.
const FORBIDDEN_PHRASES = [
  'four-step',
  '4-step',
  'stage card',
  'research card',
  'navigate to the dashboard',
  'paste the JSON',
  'TODO',
  'TBD',
  'lorem ipsum'
];

function validateContext(context) {
  const problems = [];
  if (!context || typeof context !== 'object') return ['context is required'];
  if (!CHAINS[context.kind]) problems.push(`unknown chain kind: ${context.kind}`);
  if (!stageMeta(context.kind, context.stage)) problems.push(`unknown stage: ${context.stage}`);
  if (!context.profile) problems.push('asset profile is required');
  const topic = context.topic || {};
  ['topic_id', 'slug', 'title', 'question'].forEach(key => {
    if (!topic[key]) problems.push(`topic.${key} is required`);
  });
  if (!context.deliverable || !context.deliverable.file_name) problems.push('deliverable.file_name is required');
  else if (!FILE_NAME_RE.test(context.deliverable.file_name)) problems.push(`deliverable.file_name does not match the library naming rule: ${context.deliverable.file_name}`);
  if (!context.date) problems.push('date is required');
  if (context.kind === 'factor' && context.stage === 'research' && !(topic.probes || []).length) {
    problems.push('a factor research prompt needs at least one topic question');
  }
  return problems;
}

function buildStagePrompt(context) {
  const problems = validateContext(context);
  if (problems.length) throw new Error(`research prompt context is incomplete: ${problems.join('; ')}`);
  const key = `${context.kind}/${context.stage}`;
  const blocks = [
    titleLine(context),
    assignmentBlock(context),
    ['## Objective', '', objectiveText(context)].join('\n'),
    sessionBlock(context),
    inputsBlock(context),
    questionsBlock(context),
    ['## Evidence standard', '', ...EVIDENCE_STANDARD.map(line => `- ${line}`)].join('\n'),
    deliverableBlock(context),
    checklistBlock(context),
    ['## Prohibitions', '', ...PROHIBITIONS.map(line => `- ${line}`), '', 'If a question can only be answered by breaking one of these, say so in the file rather than breaking it.'].join('\n'),
    ['## What happens next', '', NEXT_STEP[key]].join('\n')
  ];
  const prompt = `${blocks.join('\n\n')}\n`;
  const audit = auditPrompt(prompt, context);
  if (audit.length) throw new Error(`rendered prompt failed its own audit (${context.topic.topic_id} ${key}): ${audit.join('; ')}`);
  return prompt;
}

function auditPrompt(prompt, context) {
  const problems = [];
  if (!prompt.endsWith('\n') || prompt.endsWith('\n\n')) problems.push('the prompt must end with exactly one newline');
  const plain = prompt.replace(/```[\s\S]*?```/g, '```\n```');

  let cursor = -1;
  SECTION_TITLES.forEach(title => {
    const at = prompt.indexOf(`${title}\n`);
    if (at === -1) problems.push(`missing section ${title}`);
    else if (at < cursor) problems.push(`section out of order ${title}`);
    else cursor = at;
    if (at !== -1 && prompt.startsWith(`${title}\n\n## `, at)) problems.push(`empty section ${title}`);
  });
  if ((prompt.match(/^## Objective$/gm) || []).length !== 1) problems.push('exactly one objective section is required');
  if ((prompt.match(/^## Deliverable$/gm) || []).length !== 1) problems.push('exactly one deliverable section is required');

  const file = context && context.deliverable ? context.deliverable.file_name : '';
  if (file && prompt.split(file).length - 1 < 2) problems.push('the deliverable file name is named less than twice');

  ((context && context.entries) || []).forEach(entry => {
    if (prompt.indexOf(`\`${entry.factor_id}\``) === -1) problems.push(`entry not named in the prompt: ${entry.factor_id}`);
  });

  FORBIDDEN_PHRASES.forEach(phrase => {
    if (plain.toLowerCase().includes(phrase.toLowerCase())) problems.push(`phrase from the older workflow survived: ${phrase}`);
  });
  if (/<[a-z][a-z0-9 _-]{0,48}>/i.test(plain)) problems.push('an unfilled angle-bracket placeholder survived');
  if (/\b\d+\.\s*\(to be/i.test(plain)) problems.push('a to-be-filled list item survived');
  return problems;
}

module.exports = {
  TEMPLATE_VERSION,
  SECTION_TITLES,
  CHAINS,
  CHAIN_KINDS,
  STAGE_ORDER,
  chainOf,
  stageMeta,
  deliverableFileName,
  FILE_NAME_RE,
  ASSET_PROFILES,
  ASSET_ORDER,
  assetProfile,
  DELIVERABLE_SECTIONS,
  QUESTION_GROUPS,
  CHECKLISTS,
  EVIDENCE_STANDARD,
  PROHIBITIONS,
  NEXT_STEP,
  FORBIDDEN_PHRASES,
  sessionLines,
  titleLine,
  objectiveText,
  buildStagePrompt,
  renderStagePrompt: buildStagePrompt,
  auditPrompt,
  validateContext
};

