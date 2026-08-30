const layer1Url = "./data/layer1.json";
const layer2Url = "./data/layer2.json";
const workflowControlUrl = "./data/workflow-control.json";
const workflowStatusUrlDefault = "./data/workflow-status.json";
const workflowRuntimeProfileUrlDefault = "./data/refresh-runtime-profile.json";
const economicEventRefreshUrlDefault = "./data/economic-event-refresh.json?v=20260723-operational-warning-modules-v2";
const economicEventsSourceUrlDefault = "./data/economic-events-source.json?v=20260727-input-health-overview-release";
const inputHealthUrlDefault = "./data/input-health.json?v=20260723-operational-warning-modules-v2";
let economicEventRefreshUrl = economicEventRefreshUrlDefault;
let economicEventsSourceUrl = economicEventsSourceUrlDefault;
let inputHealthUrl = inputHealthUrlDefault;
const checkerDataUrls = {
  USD: "./data/backtester-checker-usd-24h-2024-01.json?v=20260629-usd-flatband-010",
  EUR: "./data/backtester-checker-eur-24h-2024-2026.json?v=20260629-eur-flatband-015",
  GOLD: "./data/backtester-checker-gold-24h-2024-2026.json?v=20260630-gold-xauusd-dashboard",
  NQ: "./data/backtester-checker-nq-24h-2024-2026.json?v=20260702-nq-qqq-proxy-dashboard",
  BTC: "./data/backtester-checker-btc-24h-2024-2026.json?v=20260702-btc-benchmark-dashboard"
};
const adrReachResearchUrl = "./data/adr-reach-research.json?v=20260705-l2l-1h-sequence";
const halfL2lReachResearchUrl = "./data/half-l2l-reach-research.json?v=20260809-half-l2l-reach-v2";
const factorEdgeLabUrl = "./data/factor-edge-lab.json?v=20260706-review-summary";
const phase2ShadowBacktestUrl = "./data/phase-2-shadow-backtest.json?v=20260707-phase2-shadow-v1";
const confidenceCalibrationUrl = "./data/confidence-calibration.json?v=20260728-confidence-calibration-v1";
const confidenceBandDeliveryUrl = "./data/confidence-band-delivery.json?v=20260728-confidence-band-delivery-v1";
const architectureManifestUrlDefault = "./data/architecture-map.json?v=20260721-architecture-mirror-v1";
const researchSupabaseUrl = "https://eaolqbrlywczinfordvg.supabase.co/rest/v1";
const researchSupabaseKey = "sb_publishable_k6YbEuuk3GyB9GVTQDtNVA_J1gCRYaY";
const headlineConfidenceLib = globalThis.HeadlineConfidence;
const layer2PairLogicLib = globalThis.Layer2PairLogic;
const economicEventRefreshLib = globalThis.EconomicEventRefresh;

if (!headlineConfidenceLib) {
  throw new Error("HeadlineConfidence shared helper is required before loading script.js");
}

if (!layer2PairLogicLib) {
  throw new Error("Layer2PairLogic shared helper is required before loading script.js");
}

if (!economicEventRefreshLib) {
  throw new Error("EconomicEventRefresh shared helper is required before loading script.js");
}

const labels = {
  "24h": "24H",
  "3d": "3-Day",
  "current_week": "This Week",
  "next_week": "Next Week",
  "current_month": "Month"
};

const orderedAgents = ["USD", "EUR", "GOLD", "NQ", "BTC"];
const weekdayBreakdownBuckets = [
  { key: "WEAK", label: "Weak", min: 0, max: 49 },
  { key: "MODERATE", label: "Moderate", min: 50, max: 64 },
  { key: "STRONG", label: "Strong", min: 65, max: 79 },
  { key: "VERY_STRONG", label: "Very Strong", min: 80, max: 100 }
];
const weekdayBreakdownLabels = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday"
};
const weekdayBreakdownColumnsByAsset = {
  USD: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  EUR: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  GBP: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  GOLD: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  SILVER: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  WTI: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  NQ: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  BTC: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
};
const pairTradeResearchConfigs = [
  {
    targetAssetCode: "EUR",
    pairCode: "EUR_USD",
    pairLabel: "EUR/USD",
    weekdayKeys: weekdayBreakdownColumnsByAsset.EUR,
    liveEligibility: "READY"
  },
  {
    targetAssetCode: "GBP",
    pairCode: "GBP_USD",
    pairLabel: "GBP/USD",
    weekdayKeys: weekdayBreakdownColumnsByAsset.GBP,
    liveEligibility: "ONBOARDING",
    onboardingReason: "Layer 1 and historical replay onboarding in progress."
  },
  {
    targetAssetCode: "GOLD",
    pairCode: "XAU_USD",
    pairLabel: "XAU/USD",
    weekdayKeys: weekdayBreakdownColumnsByAsset.GOLD,
    liveEligibility: "READY"
  },
  {
    targetAssetCode: "SILVER",
    pairCode: "XAG_USD",
    pairLabel: "XAG/USD",
    weekdayKeys: weekdayBreakdownColumnsByAsset.SILVER,
    liveEligibility: "ONBOARDING",
    onboardingReason: "Layer 1 and historical replay onboarding in progress."
  },
  {
    targetAssetCode: "WTI",
    pairCode: "WTI_USD",
    pairLabel: "WTI/USD",
    weekdayKeys: weekdayBreakdownColumnsByAsset.WTI,
    liveEligibility: "ONBOARDING",
    onboardingReason: "Layer 1 and historical replay onboarding in progress."
  },
  {
    targetAssetCode: "NQ",
    pairCode: "NQ_USD",
    pairLabel: "NQ/USD",
    weekdayKeys: weekdayBreakdownColumnsByAsset.NQ,
    liveEligibility: "READY"
  },
  {
    targetAssetCode: "BTC",
    pairCode: "BTC_USD",
    pairLabel: "BTC/USD",
    weekdayKeys: weekdayBreakdownColumnsByAsset.BTC,
    liveEligibility: "READY"
  }
];
// User-supplied historical snapshot. Updated July 20, 2026. Not live-refresh data.
const overviewPairPerformanceSnapshot = {
  updated_label: "20 July 2026",
  qualifier: "Completed tracked trades only. This table is not updated by the live refresh workflow.",
  rows: [
    { pair: "BTCUSD", trades: 24, wins: 10, losses: 14, win_rate: "41.7%", net_pl: "$302.17", net_pl_direction: "positive" },
    { pair: "EURUSD", trades: 21, wins: 4, losses: 17, win_rate: "19.0%", net_pl: "-$309.26", net_pl_direction: "negative" },
    { pair: "US100.cash", trades: 22, wins: 6, losses: 16, win_rate: "27.3%", net_pl: "-$106.52", net_pl_direction: "negative" },
    { pair: "XAUUSD", trades: 7, wins: 2, losses: 5, win_rate: "42.9%", net_pl: "$87.37", net_pl_direction: "positive" }
  ]
};
const directionalTrustGroupDefinitions = [
  {
    key: "COMBINED",
    label: "Combined Directional",
    shortLabel: "Combined",
    directionalCallTypes: ["CLEAN_DIRECTIONAL", "LEAN_DIRECTIONAL"]
  },
  {
    key: "CLEAN",
    label: "Clean Directional Only",
    shortLabel: "Clean",
    directionalCallTypes: ["CLEAN_DIRECTIONAL"]
  },
  {
    key: "LEAN",
    label: "Lean Directional Only",
    shortLabel: "Lean",
    directionalCallTypes: ["LEAN_DIRECTIONAL"]
  }
];
const directionalTrustStrengthDefinitions = [
  { key: "ALL", label: "All" },
  { key: "WEAK", label: "Weak" },
  { key: "MODERATE", label: "Moderate" },
  { key: "STRONG", label: "Strong" },
  { key: "VERY_STRONG", label: "Very Strong" },
  { key: "STRONG_PLUS", label: "Strong+" }
];
const architectureAllowedVerificationStatuses = new Set(["verified", "partially_verified", "unverified"]);
let layer1Data = null;
let layer2Data = null;
let backtestData = null;
let factorEdgeLabData = null;
let phase2ShadowBacktestData = null;
let confidenceBandDeliveryData = null;
let economicEventRefreshData = null;
let economicEventsSourceData = null;
let inputHealthData = null;
let workflowControl = null;
let workflowStatus = null;
let workflowStatusUrlOverride = "";
let workflowPollTimer = null;
let workflowTriggerInFlight = false;
let workflowStatusLoadError = null;
let workflowRuntimeProfile = null;
let workflowRefreshState = null;
let workflowRefreshRenderTimer = null;
let workflowRefreshTabId = "";
const halfL2lReviewStorageKey = "halfL2lDirectionalAccuracyReviewState";
const halfL2lReviewImportInputId = "halfL2lReviewImportInput";
let halfL2lExplorerState = {
  search: "",
  layer: "ALL",
  entity: "ALL",
  direction: "ALL",
  halfOutcome: "ALL",
  fullOutcome: "ALL",
  confidenceBand: "ALL",
  fold: "ALL",
  status: "ALL",
  startDate: "",
  endDate: ""
};
let activeTab = "overview";
let activeBacktestTab = "accuracy";
let activeCheckerRowId = null;
let architectureManifestUrl = architectureManifestUrlDefault;
let architectureState = {
  status: "idle",
  manifest: null,
  error: "",
  activeViewId: null,
  selectedNodeId: null,
  verifiedOnly: false,
  loadingPromise: null,
  renderModel: null
};
const architectureViewGroups = [
  {
    label: "System",
    viewIds: ["overview-map", "production-flow", "research-flow", "failure-and-status-paths"]
  },
  {
    label: "Production",
    viewIds: ["layer1", "layer2", "n8n-execution", "artifact-publication"]
  },
  {
    label: "Research",
    viewIds: ["historical-replay-and-checker", "factor-edge-lab", "phase-2-shadow-backtest", "phase-3-validation", "adr-l2l-research"]
  }
];
const architectureOverviewGroups = [
  {
    id: "overview_external_data",
    label: "External Data",
    subtitle: "Economic events and market feeds",
    memberNodeIds: ["economic_events", "eco_events_collector"],
    environmentLabel: "External Inputs",
    summary: "Upstream market and calendar context enters the platform through economic-event collection and asset-specific market feeds.",
    details: "This grouped stage summarizes the platform's external information intake without claiming extra provider-level architecture that is not explicitly represented in the repository."
  },
  {
    id: "overview_collection_storage",
    label: "Collection and Storage",
    subtitle: "Collectors plus runtime tables",
    memberNodeIds: ["usd_collector", "eur_collector", "gold_collector", "nq_collector", "btc_collector", "market_snapshots", "agent_outputs"],
    environmentLabel: "Runtime",
    summary: "Collectors gather current asset context and write canonical runtime stores for downstream agent and pair-selection use.",
    details: "This stage groups the five production collectors plus the verified runtime storage tables that support Layer 1 and Layer 2."
  },
  {
    id: "overview_orchestration",
    label: "Master Orchestration",
    subtitle: "Sequential workflow control",
    memberNodeIds: ["workflow_control_json", "master_orchestrator", "workflow_status_builder", "workflow_status_json"],
    environmentLabel: "n8n Runtime",
    summary: "The browser triggers the Master Orchestrator through the published control contract, and status publication closes the loop.",
    details: "The orchestrator remains the verified sequential execution spine for production refreshes and published workflow status."
  },
  {
    id: "overview_layer1",
    label: "Layer 1 Agents",
    subtitle: "5 sealed directional agents",
    memberNodeIds: ["usd_layer1_agent", "eur_layer1_agent", "gold_layer1_agent", "nq_layer1_agent", "btc_layer1_agent"],
    environmentLabel: "Production Logic",
    summary: "Five sealed Layer 1 agents produce independent raw directional outputs for USD, EUR, Gold, NQ, and BTC.",
    details: "The Overview keeps Layer 1 grouped to preserve readability while still surfacing the asset-isolated architecture contract."
  },
  {
    id: "overview_layer2",
    label: "Layer 2 Selection",
    subtitle: "Downstream pair selection",
    memberNodeIds: ["layer2_trade_selection_agent", "layer2_json"],
    environmentLabel: "Production Logic",
    summary: "Layer 2 remains downstream of Layer 1 outputs and publishes the pair-selection artifact consumed by the dashboard.",
    details: "Explicit uncertain event-adjustment and publication-split relationships remain unverified rather than inferred into the Overview."
  },
  {
    id: "overview_publication",
    label: "Artifact Publication",
    subtitle: "Published JSON contracts",
    memberNodeIds: ["dashboard_writer", "layer1_json", "layer2_json", "workflow_status_json", "github_pages"],
    environmentLabel: "Publication",
    summary: "Dashboard artifacts are written, checked in, and served as static contracts for the dashboard surface.",
    details: "This stage groups the verified publication artifacts and host surface without inventing extra publication responsibilities."
  },
  {
    id: "overview_dashboard",
    label: "Dashboard",
    subtitle: "Renderer and operator browser",
    memberNodeIds: ["dashboard_renderer", "dashboard_browser"],
    environmentLabel: "Browser Surface",
    summary: "The browser-side renderer consumes the published contracts and research artifacts without changing production outputs.",
    details: "Architecture remains lazy-loaded and isolated so the main dashboard continues to render even if the Architecture manifest fails."
  },
  {
    id: "overview_research",
    label: "Research System",
    subtitle: "Replay, checker, and labs",
    memberNodeIds: ["repo_docs_and_logic", "historical_snapshot_builders", "replay_runners", "outcome_evaluators", "checker_artifacts", "factor_edge_lab_artifact", "phase2_shadow_backtest_artifact", "phase3_validation_modules", "repo_local_candle_sources", "adr_l2l_research_artifact", "research_supabase_views"],
    environmentLabel: "Research Stack",
    summary: "Historical replay, checker artifacts, downstream labs, and read-only research tabs remain separate from live production logic.",
    details: "The Overview represents the full research platform as a grouped stage so the system map stays readable at standard desktop widths."
  }
];
const architectureWaterfallViewConfigs = {
  "production-flow": {
    stages: [
      { id: "external-data", label: "External Data", subtitle: "Upstream providers and event sources", boundaryId: "supabase_runtime", nodeIds: ["economic_events"] },
      { id: "collectors", label: "Collectors", subtitle: "Event and asset collection workflows", boundaryId: "n8n_runtime", nodeIds: ["eco_events_collector", "usd_collector", "eur_collector", "gold_collector", "nq_collector", "btc_collector"] },
      { id: "runtime-stores", label: "Runtime Stores", subtitle: "Canonical runtime tables", boundaryId: "supabase_runtime", nodeIds: ["market_snapshots", "agent_outputs"] },
      { id: "orchestrator", label: "Master Orchestration", subtitle: "Sequential workflow control and status", boundaryId: "n8n_runtime", nodeIds: ["workflow_control_json", "master_orchestrator", "workflow_status_builder", "workflow_status_json"] },
      { id: "layer1", label: "Layer 1", subtitle: "Sealed directional agents", boundaryId: "n8n_runtime", nodeIds: ["usd_layer1_agent", "eur_layer1_agent", "gold_layer1_agent", "nq_layer1_agent", "btc_layer1_agent"] },
      { id: "layer2", label: "Layer 2", subtitle: "Pair-selection engine", boundaryId: "n8n_runtime", nodeIds: ["layer2_trade_selection_agent"] },
      { id: "publication", label: "Artifact Publication", subtitle: "Published contracts and hosting", boundaryId: "github_publication", nodeIds: ["dashboard_writer", "layer1_json", "layer2_json", "github_pages"] },
      { id: "browser", label: "Browser", subtitle: "Dashboard renderer and operator surface", boundaryId: "browser_surface", nodeIds: ["dashboard_renderer", "dashboard_browser"] }
    ]
  },
  "layer1": {
    stages: [
      { id: "collectors", label: "Collectors", subtitle: "Asset intake workflows", boundaryId: "n8n_runtime", nodeIds: ["usd_collector", "eur_collector", "gold_collector", "nq_collector", "btc_collector"] },
      { id: "market-snapshots", label: "Runtime Inputs", subtitle: "Market snapshot storage", boundaryId: "supabase_runtime", nodeIds: ["market_snapshots"] },
      { id: "layer1-agents", label: "Layer 1 Agents", subtitle: "Five independent directional agents", boundaryId: "n8n_runtime", nodeIds: ["usd_layer1_agent", "eur_layer1_agent", "gold_layer1_agent", "nq_layer1_agent", "btc_layer1_agent"] },
      { id: "agent-outputs", label: "Agent Outputs", subtitle: "Stored Layer 1 results", boundaryId: "supabase_runtime", nodeIds: ["agent_outputs"] },
      { id: "publication", label: "Layer 1 Publication", subtitle: "Published dashboard artifact", boundaryId: "github_publication", nodeIds: ["dashboard_writer", "layer1_json"] }
    ]
  },
  "layer2": {
    stages: [
      { id: "runtime-inputs", label: "Runtime Inputs", subtitle: "Event context and Layer 1 outputs", boundaryId: "supabase_runtime", nodeIds: ["economic_events", "agent_outputs"] },
      { id: "layer2-engine", label: "Layer 2 Selection", subtitle: "Trade-selection workflow", boundaryId: "n8n_runtime", nodeIds: ["layer2_trade_selection_agent"] },
      { id: "publication", label: "Published Artifact", subtitle: "Dashboard-facing Layer 2 contract", boundaryId: "github_publication", nodeIds: ["layer2_json"] },
      { id: "browser", label: "Dashboard Consumers", subtitle: "Read-only browser consumption", boundaryId: "browser_surface", nodeIds: ["dashboard_renderer", "dashboard_browser"] }
    ]
  },
  "n8n-execution": {
    stages: [
      { id: "trigger", label: "Trigger Contract", subtitle: "Browser request into n8n", boundaryId: "browser_surface", nodeIds: ["workflow_control_json", "dashboard_renderer"] },
      { id: "orchestrator", label: "Master Orchestrator", subtitle: "Sequential execution spine", boundaryId: "n8n_runtime", nodeIds: ["master_orchestrator"] },
      { id: "collection", label: "Collection Workflows", subtitle: "Collectors executed under orchestration", boundaryId: "n8n_runtime", nodeIds: ["eco_events_collector", "usd_collector", "eur_collector", "gold_collector", "nq_collector", "btc_collector"] },
      { id: "layer1", label: "Layer 1 Workflows", subtitle: "Directional agent runs", boundaryId: "n8n_runtime", nodeIds: ["usd_layer1_agent", "eur_layer1_agent", "gold_layer1_agent", "nq_layer1_agent", "btc_layer1_agent"] },
      { id: "downstream", label: "Downstream Workflows", subtitle: "Selection, publication, and status", boundaryId: "n8n_runtime", nodeIds: ["layer2_trade_selection_agent", "dashboard_writer", "workflow_status_builder"] },
      { id: "publication", label: "Published Outputs", subtitle: "Status contract", boundaryId: "github_publication", nodeIds: ["workflow_status_json"] }
    ]
  },
  "artifact-publication": {
    stages: [
      { id: "workflow-writers", label: "Workflow Writers", subtitle: "n8n steps with publication responsibility", boundaryId: "n8n_runtime", nodeIds: ["workflow_status_builder", "layer2_trade_selection_agent", "dashboard_writer"] },
      { id: "artifacts", label: "Published Artifacts", subtitle: "Checked-in JSON contracts", boundaryId: "github_publication", nodeIds: ["workflow_status_json", "layer2_json", "layer1_json"] },
      { id: "hosting", label: "Static Hosting", subtitle: "GitHub Pages surface", boundaryId: "github_publication", nodeIds: ["github_pages"] },
      { id: "browser", label: "Browser Surface", subtitle: "Read-only dashboard consumption", boundaryId: "browser_surface", nodeIds: ["dashboard_renderer", "dashboard_browser"] }
    ]
  },
  "historical-replay-and-checker": {
    stages: [
      { id: "baseline", label: "Baseline Logic", subtitle: "Reference rules and frozen logic", boundaryId: "research_stack", nodeIds: ["repo_docs_and_logic"] },
      { id: "snapshots", label: "Snapshot Builders", subtitle: "Historical input construction", boundaryId: "research_stack", nodeIds: ["historical_snapshot_builders"] },
      { id: "replay", label: "Replay Engines", subtitle: "Asset-specific historical replay", boundaryId: "research_stack", nodeIds: ["replay_runners"] },
      { id: "evaluation", label: "Outcome Evaluation", subtitle: "Replay outcome scoring", boundaryId: "research_stack", nodeIds: ["outcome_evaluators"] },
      { id: "checker", label: "Checker and Views", subtitle: "Checker artifacts and read-only views", boundaryId: "research_stack", nodeIds: ["checker_artifacts", "research_supabase_views"] },
      { id: "browser", label: "Dashboard Readout", subtitle: "Research tab presentation", boundaryId: "browser_surface", nodeIds: ["dashboard_renderer"] }
    ]
  },
  "factor-edge-lab": {
    stages: [
      { id: "checker", label: "Checker Artifacts", subtitle: "Replay evidence baseline", boundaryId: "research_stack", nodeIds: ["checker_artifacts"] },
      { id: "lab", label: "Factor Edge Lab", subtitle: "Research-only factor analysis", boundaryId: "research_stack", nodeIds: ["factor_edge_lab_artifact"] },
      { id: "browser", label: "Dashboard Readout", subtitle: "Research tab presentation", boundaryId: "browser_surface", nodeIds: ["dashboard_renderer", "dashboard_browser"] }
    ]
  },
  "phase-2-shadow-backtest": {
    stages: [
      { id: "research-inputs", label: "Research Inputs", subtitle: "Checker and factor evidence", boundaryId: "research_stack", nodeIds: ["checker_artifacts", "factor_edge_lab_artifact"] },
      { id: "phase2", label: "Phase 2 Shadow", subtitle: "Shadow comparison artifact", boundaryId: "research_stack", nodeIds: ["phase2_shadow_backtest_artifact"] },
      { id: "browser", label: "Dashboard Readout", subtitle: "Research tab presentation", boundaryId: "browser_surface", nodeIds: ["dashboard_renderer", "dashboard_browser"] }
    ]
  },
  "phase-3-validation": {
    stages: [
      { id: "frozen-baseline", label: "Frozen Baseline", subtitle: "Reference logic and checker evidence", boundaryId: "research_stack", nodeIds: ["repo_docs_and_logic", "checker_artifacts"] },
      { id: "phase3", label: "Phase 3 Validation", subtitle: "Walk-forward and stability modules", boundaryId: "research_stack", nodeIds: ["phase3_validation_modules"] },
      { id: "views", label: "Research Views", subtitle: "Published read-only views", boundaryId: "research_stack", nodeIds: ["research_supabase_views"] },
      { id: "browser", label: "Dashboard Readout", subtitle: "Research tab presentation", boundaryId: "browser_surface", nodeIds: ["dashboard_renderer"] }
    ]
  },
  "adr-l2l-research": {
    stages: [
      { id: "inputs", label: "Research Inputs", subtitle: "Checker outputs and local candles", boundaryId: "research_stack", nodeIds: ["checker_artifacts", "repo_local_candle_sources"] },
      { id: "adr", label: "ADR / L2L Module", subtitle: "Reach and sequence research", boundaryId: "research_stack", nodeIds: ["adr_l2l_research_artifact"] },
      { id: "browser", label: "Dashboard Readout", subtitle: "Research tab presentation", boundaryId: "browser_surface", nodeIds: ["dashboard_renderer", "dashboard_browser"] }
    ]
  },
  "research-flow": {
    stages: [
      { id: "inputs", label: "Historical Inputs", subtitle: "Frozen docs and local candles", boundaryId: "research_stack", nodeIds: ["repo_docs_and_logic", "repo_local_candle_sources"] },
      { id: "snapshots", label: "Snapshot Builders", subtitle: "Historical state construction", boundaryId: "research_stack", nodeIds: ["historical_snapshot_builders"] },
      { id: "replay", label: "Replay Engines", subtitle: "Historical replay runners", boundaryId: "research_stack", nodeIds: ["replay_runners"] },
      { id: "evaluation", label: "Outcome Evaluation", subtitle: "Replay scoring and labelling", boundaryId: "research_stack", nodeIds: ["outcome_evaluators"] },
      { id: "checker", label: "Checker Artifacts", subtitle: "Reusable evidence baseline", boundaryId: "research_stack", nodeIds: ["checker_artifacts"] },
      { id: "labs", label: "Downstream Labs", subtitle: "Factor Edge, Phase 2, Phase 3, ADR/L2L, views", boundaryId: "research_stack", nodeIds: ["factor_edge_lab_artifact", "phase2_shadow_backtest_artifact", "phase3_validation_modules", "adr_l2l_research_artifact", "research_supabase_views"] },
      { id: "browser", label: "Research Tabs", subtitle: "Dashboard research surfaces", boundaryId: "browser_surface", nodeIds: ["dashboard_renderer"] }
    ]
  },
  "failure-and-status-paths": {
    stages: [
      { id: "browser", label: "Browser Trigger", subtitle: "Operator action and dashboard request", boundaryId: "browser_surface", nodeIds: ["dashboard_browser", "dashboard_renderer"] },
      { id: "orchestrator", label: "Orchestrator", subtitle: "Master run control", boundaryId: "n8n_runtime", nodeIds: ["master_orchestrator"] },
      { id: "child-workflows", label: "Child Workflows", subtitle: "Failure-prone downstream steps", boundaryId: "n8n_runtime", nodeIds: ["eco_events_collector", "layer2_trade_selection_agent", "dashboard_writer"] },
      { id: "status", label: "Status Publication", subtitle: "Published workflow status", boundaryId: "n8n_runtime", nodeIds: ["workflow_status_builder", "workflow_status_json"] }
    ]
  }
};
const navigationStateKey = "dashboard-navigation-state";
const workflowRefreshStateKey = "dashboard-workflow-refresh-state";
const workflowRefreshTabIdKey = "dashboard-workflow-refresh-tab-id";

function storageAvailable() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch (err) {
    return false;
  }
}

function parseTimestamp(value) {
  if (!value) return NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

function createWorkflowRefreshTabId() {
  if (workflowRefreshTabId) return workflowRefreshTabId;

  if (storageAvailable()) {
    try {
      const existing = String(window.sessionStorage?.getItem(workflowRefreshTabIdKey) || "").trim();
      if (existing) {
        workflowRefreshTabId = existing;
        return workflowRefreshTabId;
      }
    } catch (err) {
      console.warn("Could not read workflow refresh tab id", err);
    }
  }

  workflowRefreshTabId = `tab-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;

  if (storageAvailable()) {
    try {
      window.sessionStorage?.setItem(workflowRefreshTabIdKey, workflowRefreshTabId);
    } catch (err) {
      console.warn("Could not persist workflow refresh tab id", err);
    }
  }

  return workflowRefreshTabId;
}

function createRefreshRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `refresh-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

function getAvailableTopLevelTabs() {
  return Array.from(document.querySelectorAll(".tab-button"))
    .map(btn => btn.dataset.tab)
    .filter(Boolean);
}

function getAvailableBacktestTabs() {
  return Array.from(document.querySelectorAll(".subtab-button"))
    .map(btn => btn.dataset.backtestTab)
    .filter(Boolean);
}

function saveNavigationState() {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(navigationStateKey, JSON.stringify({
      activeTab,
      activeBacktestTab
    }));
  } catch (err) {
    console.warn("Could not save dashboard navigation state", err);
  }
}

function restoreNavigationState() {
  const availableTabs = getAvailableTopLevelTabs();
  const availableBacktestTabs = getAvailableBacktestTabs();

  if (!storageAvailable()) {
    activeTab = availableTabs.includes("overview") ? "overview" : (availableTabs[0] || "overview");
    activeBacktestTab = availableBacktestTabs.includes("accuracy") ? "accuracy" : (availableBacktestTabs[0] || "accuracy");
    return;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(navigationStateKey) || "{}");
    const savedTopLevelTab = String(parsed.activeTab || "").trim();
    const savedBacktestTab = String(parsed.activeBacktestTab || "").trim();

    activeTab = availableTabs.includes(savedTopLevelTab)
      ? savedTopLevelTab
      : (availableTabs.includes("overview") ? "overview" : (availableTabs[0] || "overview"));

    activeBacktestTab = availableBacktestTabs.includes(savedBacktestTab)
      ? savedBacktestTab
      : (availableBacktestTabs.includes("accuracy") ? "accuracy" : (availableBacktestTabs[0] || "accuracy"));
  } catch (err) {
    console.warn("Could not restore dashboard navigation state", err);
    activeTab = availableTabs.includes("overview") ? "overview" : (availableTabs[0] || "overview");
    activeBacktestTab = availableBacktestTabs.includes("accuracy") ? "accuracy" : (availableBacktestTabs[0] || "accuracy");
  }
}

function updateClock() {
  const el = document.getElementById("currentTime");
  const topbarClock = document.getElementById("topbarClock");
  const currentDate = document.getElementById("currentDate");
  const now = new Date();
  const ukClockFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const etClockFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const ukZoneFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  });
  const etZoneFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  });
  const ukTime = ukClockFormatter.format(now);
  const etTime = etClockFormatter.format(now);
  const ukZone = zoneAbbreviation(ukZoneFormatter, now);
  const etZone = zoneAbbreviation(etZoneFormatter, now);
  const dualClock = `UK ${ukTime} | ET ${etTime}`;

  if (el) el.textContent = dualClock;
  if (topbarClock) {
    topbarClock.textContent = dualClock;
    topbarClock.setAttribute("aria-label", `UK time ${ukTime} ${ukZone}. Eastern Time ${etTime} ${etZone}.`);
    topbarClock.setAttribute("title", `UK time automatically switches between GMT and BST. ET automatically switches between EST and EDT. Currently ${ukZone} and ${etZone}.`);
  }
  if (currentDate) {
    currentDate.textContent = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(now);
  }
}

function zoneAbbreviation(formatter, date) {
  const parts = formatter.formatToParts(date);
  return parts.find((part) => part.type === "timeZoneName")?.value || "";
}

function initMarketGlobe() {
  const canvas = document.getElementById("marketGlobeCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 118;
  let rotation = 0;
  let tick = 0;

  const cities = [
    { lat: 51.5, lng: -0.1 },
    { lat: 40.7, lng: -74 },
    { lat: 35.7, lng: 139.7 },
    { lat: 1.3, lng: 103.8 },
    { lat: 25.2, lng: 55.3 },
    { lat: 22.3, lng: 114.2 },
    { lat: -33.9, lng: 151.2 }
  ];
  const routes = [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [0, 4], [4, 3], [2, 5], [3, 6]];
  const travelers = routes.map((route, index) => ({
    route: index,
    progress: index / routes.length,
    speed: 0.0013 + (index % 4) * 0.00022
  }));

  function toPoint(lat, lng, r = radius) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lng + rotation * 180 / Math.PI) * Math.PI / 180;
    return {
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.cos(phi),
      z: r * Math.sin(phi) * Math.sin(theta)
    };
  }

  function normalise(point) {
    const size = Math.sqrt(point.x ** 2 + point.y ** 2 + point.z ** 2);
    return { x: point.x / size, y: point.y / size, z: point.z / size };
  }

  function slerp(a, b, amount) {
    const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
    const omega = Math.acos(dot);
    if (Math.abs(omega) < 0.001) {
      return {
        x: a.x + (b.x - a.x) * amount,
        y: a.y + (b.y - a.y) * amount,
        z: a.z + (b.z - a.z) * amount
      };
    }

    const sin = Math.sin(omega);
    return {
      x: (Math.sin((1 - amount) * omega) / sin) * a.x + (Math.sin(amount * omega) / sin) * b.x,
      y: (Math.sin((1 - amount) * omega) / sin) * a.y + (Math.sin(amount * omega) / sin) * b.y,
      z: (Math.sin((1 - amount) * omega) / sin) * a.z + (Math.sin(amount * omega) / sin) * b.z
    };
  }

  function drawRoute(route) {
    const start = normalise(toPoint(cities[route[0]].lat, cities[route[0]].lng, 1));
    const end = normalise(toPoint(cities[route[1]].lat, cities[route[1]].lng, 1));
    let drawing = false;

    ctx.beginPath();
    for (let step = 0; step <= 44; step += 1) {
      const arc = slerp(start, end, step / 44);
      const x = cx + arc.x * radius * 1.03;
      const y = cy - arc.y * radius * 1.03;
      const visible = arc.z * radius > -radius * 0.04;
      if (!visible) {
        drawing = false;
      } else if (!drawing) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = "rgba(67, 200, 176, 0.18)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < 58; i += 1) {
      const sx = (Math.sin(i * 137.5) * 0.5 + 0.5) * width;
      const sy = (Math.cos(i * 97.3) * 0.5 + 0.5) * height;
      if (Math.hypot(sx - cx, sy - cy) > radius + 8) {
        const opacity = 0.08 + 0.32 * (Math.sin(tick * 0.4 + i) * 0.5 + 0.5);
        ctx.beginPath();
        ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${opacity})`;
        ctx.fill();
      }
    }

    const atmosphere = ctx.createRadialGradient(cx, cy, radius - 4, cx, cy, radius + 20);
    atmosphere.addColorStop(0, "rgba(67, 200, 176, 0.16)");
    atmosphere.addColorStop(0.55, "rgba(209, 165, 58, 0.07)");
    atmosphere.addColorStop(1, "rgba(67, 200, 176, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
    ctx.fillStyle = atmosphere;
    ctx.fill();

    const ocean = ctx.createRadialGradient(cx - 24, cy - 26, 8, cx, cy, radius);
    ocean.addColorStop(0, "#244777");
    ocean.addColorStop(0.55, "#142951");
    ocean.addColorStop(1, "#07101f");
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = ocean;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    for (let lat = -60; lat <= 60; lat += 30) {
      const phi = (90 - lat) * Math.PI / 180;
      const rx = radius * Math.sin(phi);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, rx * 0.15, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(237, 243, 250, 0.09)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    for (let line = 0; line < 12; line += 1) {
      const lng = rotation + line * Math.PI / 6;
      ctx.beginPath();
      let first = true;
      for (let step = 0; step <= 36; step += 1) {
        const lat = (step / 36) * Math.PI - Math.PI / 2;
        const x = cx + radius * Math.cos(lat) * Math.cos(lng);
        const y = cy - radius * Math.sin(lat);
        const visible = Math.cos(lat) * Math.cos(lng);
        ctx.globalAlpha = visible > 0 ? 0.12 : 0.03;
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = "#edf3fa";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    routes.forEach(drawRoute);

    travelers.forEach(traveler => {
      const route = routes[traveler.route];
      const start = normalise(toPoint(cities[route[0]].lat, cities[route[0]].lng, 1));
      const end = normalise(toPoint(cities[route[1]].lat, cities[route[1]].lng, 1));
      const arc = slerp(start, end, traveler.progress);
      const x = cx + arc.x * radius * 1.03;
      const y = cy - arc.y * radius * 1.03;

      if (arc.z * radius > -radius * 0.04) {
        const trail = slerp(start, end, Math.max(0, traveler.progress - 0.08));
        const tx = cx + trail.x * radius * 1.03;
        const ty = cy - trail.y * radius * 1.03;
        const gradient = ctx.createLinearGradient(tx, ty, x, y);
        gradient.addColorStop(0, "rgba(67, 200, 176, 0)");
        gradient.addColorStop(1, "rgba(67, 200, 176, 0.75)");
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#43c8b0";
        ctx.fill();
      }

      traveler.progress += traveler.speed;
      if (traveler.progress > 1) traveler.progress = 0;
    });

    cities.forEach((city, index) => {
      const point = toPoint(city.lat, city.lng);
      if (point.z < -radius * 0.04) return;

      const pulse = Math.sin(tick * 2 + index * 1.4) * 0.5 + 0.5;
      const x = cx + point.x;
      const y = cy - point.y;
      ctx.beginPath();
      ctx.arc(x, y, 4 + pulse * 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(67, 200, 176, ${0.12 + pulse * 0.14})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = "#43c8b0";
      ctx.fill();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(237, 243, 250, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    rotation += 0.006;
    tick += 0.028;
    requestAnimationFrame(draw);
  }

  draw();
}

function formatDashboardTime(value) {
  if (!value || value === "pending") return "Pending";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(date);
}

function formatContractTime(value, timeZone = "America/New_York", options = {}) {
  if (!value || value === "pending") return "Pending";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);

  if (options.includeZoneLabel === false) return formatted;
  return `${formatted} ${options.zoneLabel || "ET"}`;
}

function formatContractTimeWithTimezoneAbbreviation(value, timeZone = "Europe/London", fallbackZoneLabel = "UK") {
  if (!value || value === "pending") return "Pending";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  });
  const parts = formatter.formatToParts(date);
  const zoneLabel = parts.find((part) => part.type === "timeZoneName")?.value || fallbackZoneLabel;
  const formatted = parts
    .filter((part) => part.type !== "timeZoneName")
    .map((part) => part.value)
    .join("")
    .trim()
    .replace(/\s+,/g, ",");

  return `${formatted} ${zoneLabel}`.trim();
}

function formatRelativeAge(value) {
  if (!value || value === "pending") return "Pending";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function workflowStatusClass(status = "") {
  const value = String(status || "pending").toLowerCase();
  if (["success_degraded", "degraded", "warning"].includes(value)) return "warning";
  if (["success", "complete", "completed"].includes(value)) return "success";
  if (["failed", "failure", "error"].includes(value)) return "failed";
  if (["running", "started", "starting", "queued", "triggered"].includes(value)) return "running";
  if (["not_configured", "disabled", "missing_config"].includes(value)) return "not-configured";
  return "pending";
}

function workflowStatusLabel(status = "") {
  const value = String(status || "pending").replaceAll("_", " ");
  return value ? value.toUpperCase() : "PENDING";
}

function workflowRefreshPhaseBadgeLabel(phase = "") {
  const value = String(phase || "").toLowerCase();
  if (value === "accepted") return "Accepted";
  if (value === "complete") return "Completed";
  if (value === "published") return "Published";
  if (value === "sending") return "Sending";
  if (value === "publishing") return "Publishing";
  if (value === "incomplete") return "Incomplete";
  if (value === "delayed") return "Delayed";
  if (value === "verification_expired") return "Verification expired";
  if (value === "status_unavailable") return "Status unavailable";
  if (value === "association_unverified") return "Association unverified";
  if (value === "failed_dispatch") return "Dispatch failed";
  if (value === "failed") return "Failed";
  return workflowStatusLabel(value || "pending");
}

function workflowRefreshPhaseClass(phase = "") {
  const value = String(phase || "").toLowerCase();
  if (value === "complete") return "success";
  if (value === "published") return "success";
  if (value === "association_unverified") return "warning";
  if (value === "incomplete" || value === "verification_expired" || value === "status_unavailable" || value === "delayed") return "warning";
  if (value === "failed_dispatch" || value === "failed") return "failed";
  if (value === "accepted" || value === "sending" || value === "publishing") return "running";
  return "pending";
}

function buildWorkflowRefreshPresentation(state) {
  if (!state) return null;

  const reconciled = reconcileWorkflowRefreshState();
  if (!reconciled) return null;
  const elapsedSeconds = workflowRefreshElapsedSeconds(reconciled.requested_at);
  const medianSeconds = getRuntimeProfilePercentileSeconds("median");
  const delayedThreshold = getRuntimeProfilePercentileSeconds("p75");
  const strongDelayThreshold = getRuntimeProfilePercentileSeconds("p90");
  const hardExpirySeconds = getWorkflowRefreshHardExpirySeconds();
  const remainingSeconds = Number.isFinite(medianSeconds) ? Math.max(0, medianSeconds - elapsedSeconds) : null;
  const badgeClass = workflowRefreshPhaseClass(reconciled.phase);
  const badgeLabel = workflowRefreshPhaseBadgeLabel(reconciled.phase);
  const baseline = reconciled.baseline || {};
  const observed = reconciled.observed_markers || currentWorkflowMarkers();
  const markerDelta = buildWorkflowMarkerDelta(baseline, observed, reconciled.requested_at);
  const freshArtifacts = Array.isArray(reconciled.fresh_artifacts) ? reconciled.fresh_artifacts : [];
  const missingArtifacts = Array.isArray(reconciled.missing_artifacts) ? reconciled.missing_artifacts : [];
  const failure = reconciled.workflow_failure || null;
  const noteParts = [];
  let summary = "Refresh request state unavailable.";
  let etaText = "Estimate unavailable";
  let meta = `Request ${reconciled.refresh_request_id || "unknown"}`;

  if (reconciled.phase === "sending") {
    summary = "Sending refresh request to the Master Orchestrator.";
    meta = `Request ${reconciled.refresh_request_id} created ${formatDashboardTime(reconciled.requested_at)}.`;
    noteParts.push("A successful browser dispatch is not completion.");
  } else if (reconciled.phase === "accepted") {
    summary = "Refresh request dispatched. Waiting for execution confirmation from public status signals.";
    meta = `Request ${reconciled.refresh_request_id} sent ${formatDashboardTime(reconciled.requested_at)}. Opaque no-cors delivery is not verified acceptance.`;
    noteParts.push("The dashboard cannot read the webhook response body in this mode.");
    noteParts.push("Estimated time remaining is based on recent production runtimes, not a completion guarantee.");
  } else if (reconciled.phase === "complete") {
    summary = "Refresh completion was verified from fresh associated publication signals.";
    meta = `Request ${reconciled.refresh_request_id} matched a fresh completion and publication signal after ${formatDashboardTime(reconciled.requested_at)}.`;
  } else if (reconciled.phase === "published") {
    summary = "Dashboard updated after this refresh request.";
    meta = `Layer 1 ingest updated after ${formatDashboardTime(reconciled.requested_at)}.`;
  } else if (reconciled.phase === "publishing") {
    summary = "New post-request artifacts are appearing. Waiting for public publication to settle.";
    meta = `Request ${reconciled.refresh_request_id} is observing post-request signals, but exact execution association is still unavailable.`;
    noteParts.push("Fresh publication does not yet prove that this exact click completed.");
  } else if (reconciled.phase === "incomplete") {
    summary = "The verification window expired after only a partial publication.";
    meta = `Request ${reconciled.refresh_request_id} exceeded the verification window of ${formatDurationClock(hardExpirySeconds)} with only part of the required artifact set published.`;
    if (freshArtifacts.length) {
      noteParts.push(`Fresh: ${freshArtifacts.join(", ")}.`);
    }
    if (missingArtifacts.length) {
      noteParts.push(`Missing: ${missingArtifacts.join(", ")}.`);
    }
    noteParts.push("Run Refresh is available again.");
  } else if (reconciled.phase === "delayed") {
    summary = "This refresh is taking longer than usual based on recent successful production runtimes.";
    meta = `Request ${reconciled.refresh_request_id} has exceeded the usual threshold without a correlated completion signal.`;
    noteParts.push("The countdown reaching zero does not mean success.");
  } else if (reconciled.phase === "failed") {
    summary = "A fresh post-request workflow failure was observed. This refresh lock is now closed.";
    meta = `Request ${reconciled.refresh_request_id} observed a post-request workflow failure${failure?.failed_step ? ` at ${failure.failed_step}` : ""}.`;
    if (failure?.reason) {
      noteParts.push(failure.reason);
    }
    if (!failure?.exact_association) {
      noteParts.push("Exact request association remains unavailable in browser-only mode.");
    }
    if (freshArtifacts.length) {
      noteParts.push(`Fresh before failure: ${freshArtifacts.join(", ")}.`);
    }
    if (missingArtifacts.length) {
      noteParts.push(`Missing: ${missingArtifacts.join(", ")}.`);
    }
    noteParts.push("Run Refresh is available again.");
  } else if (reconciled.phase === "verification_expired") {
    summary = "Completion could not be verified. The previous refresh lock has expired.";
    meta = `Request ${reconciled.refresh_request_id} exceeded the verification window of ${formatDurationClock(hardExpirySeconds)} without a fresh associated completion signal.`;
    noteParts.push("Run Refresh is available again.");
    noteParts.push("Expiring the previous lock does not submit another request.");
  } else if (reconciled.phase === "status_unavailable") {
    summary = "Workflow status is temporarily unavailable while this refresh request is active.";
    meta = `Request ${reconciled.refresh_request_id} is still being tracked locally.`;
    noteParts.push("Public status polling failed, so the dashboard cannot confirm progress right now.");
  } else if (reconciled.phase === "association_unverified") {
    summary = "A newer refresh publication was detected after your request, but exact association remains unverified in browser-only mode.";
    meta = `Request ${reconciled.refresh_request_id} observed fresh workflow and artifact signals after ${formatDashboardTime(reconciled.requested_at)}.`;
    noteParts.push("A fresh unrelated or manual run could produce the same public signals.");
    noteParts.push("Browser-only mode will not label this request Complete.");
  } else if (reconciled.phase === "failed_dispatch") {
    summary = "The dashboard could not send the refresh request.";
    meta = `Request ${reconciled.refresh_request_id} failed before the dashboard could begin tracking execution.`;
    noteParts.push(reconciled.error_message || "No additional error detail was supplied.");
  }

  if (Number.isFinite(remainingSeconds)) {
    if (reconciled.phase === "verification_expired") {
      etaText = "Verification expired";
    } else if (reconciled.phase === "incomplete") {
      etaText = "Incomplete";
    } else if (reconciled.phase === "failed") {
      etaText = "Failed";
    } else if (reconciled.phase === "complete") {
      etaText = "Completed";
    } else if (reconciled.phase === "published") {
      etaText = "Refresh available";
    } else if (remainingSeconds >= 1) {
      etaText = `Estimated time remaining ${formatDurationClock(remainingSeconds)}`;
    } else if (activeWorkflowRefreshBlocksNewRequest(reconciled)) {
      etaText = "Verification overdue";
    } else {
      etaText = "Unable to estimate";
    }
  }

  const shouldShowDelayNotes = ["sending", "accepted", "publishing", "delayed", "status_unavailable"].includes(String(reconciled.phase || "").toLowerCase());

  if (shouldShowDelayNotes && Number.isFinite(delayedThreshold) && elapsedSeconds > delayedThreshold && reconciled.phase !== "association_unverified") {
    noteParts.push(`Taking longer than usual after ${formatDurationClock(delayedThreshold)}.`);
  }
  if (shouldShowDelayNotes && Number.isFinite(strongDelayThreshold) && elapsedSeconds > strongDelayThreshold && reconciled.phase !== "association_unverified") {
    noteParts.push(`Still running beyond the stronger delay band of ${formatDurationClock(strongDelayThreshold)}.`);
  }
  if (markerDelta.layer2Fresh && !markerDelta.layer1Fresh) {
    noteParts.push("A newer Layer 2 artifact is visible before Layer 1 publication has caught up.");
  }
  if (markerDelta.layer1Fresh && !markerDelta.workflowFinishedFresh) {
    noteParts.push("A newer Layer 1 artifact is visible before final workflow status publication has caught up.");
  }

  return {
    badgeClass,
    badgeLabel,
    etaText,
    elapsedText: `Elapsed ${formatDurationClock(elapsedSeconds)}`,
    summary,
    meta,
    note: noteParts.join(" "),
    requestId: reconciled.refresh_request_id || "",
    phase: reconciled.phase
  };
}

function inputHealthTone(status = "") {
  const value = String(status || "UNKNOWN").toUpperCase();
  if (value === "DATA_UNAVAILABLE") return "data-warning";
  if (value === "MISMATCHED") return "warning";
  if (value === "CRITICAL") return "critical";
  if (value === "DEGRADED") return "warning";
  if (value === "HEALTHY") return "success";
  return "data-warning";
}

function inputHealthStatusLabel(status = "") {
  const value = String(status || "UNKNOWN").toUpperCase();
  if (value === "HEALTHY") return "HEALTHY";
  if (value === "DEGRADED") return "DEGRADED";
  if (value === "CRITICAL") return "CRITICAL";
  if (value === "MISMATCHED") return "MISMATCHED";
  if (value === "DATA_UNAVAILABLE") return "DATA UNAVAILABLE";
  return "UNKNOWN";
}

function isEconomicEventsCollectorFailure(status = workflowStatus) {
  const failedStep = String(status?.failed_step || status?.error?.step || "").toLowerCase();
  const errorText = String(workflowErrorText(status?.error) || status?.message || "").toLowerCase();
  return failedStep.includes("economic events collector")
    && (
      errorText.includes("invalid input syntax for type date")
      || errorText.includes('type date: "null"')
      || errorText.includes("type date: null")
    );
}

function economicEventsCollectorImpactSummary(status = workflowStatus) {
  if (!isEconomicEventsCollectorFailure(status)) return "";
  return "Economic event context fallback was used after the latest collector failure. Calls that rely on US or Eurozone event context may be incomplete for this run.";
}

function normaliseDirection(direction = "") {
  return String(direction || "PENDING").replaceAll("_", " ");
}

function directionClass(direction = "") {
  const d = String(direction).toLowerCase();
  if (d.includes("pending")) return "pending";
  if (d.includes("buy")) return "buy";
  if (d.includes("sell")) return "sell";
  if (d.includes("no trade")) return "no-trade";
  if (d.includes("bullish") || d.includes("long")) return d.includes("lean") ? "lean-bullish" : "bullish";
  if (d.includes("bearish") || d.includes("short")) return d.includes("lean") ? "lean-bearish" : "bearish";
  if (d.includes("neutral") || d.includes("no clear")) return "neutral";
  if (d.includes("lean")) return "lean";
  return "neutral";
}

function signalClass(signal = "") {
  const s = String(signal).toLowerCase();
  if (s.includes("bullish")) return "bullish";
  if (s.includes("bearish")) return "bearish";
  if (s.includes("missing")) return "pending";
  return "neutral";
}

function formatConviction(value) {
  return value === null || value === undefined || value === "" ? "--" : `${Number(value)}%`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch (e) {
      return [value];
    }
  }

  return [];
}

function getCall(agent, timeframe = "24h") {
  return agent?.calls?.[timeframe] || {
    direction: "PENDING",
    confidence: null,
    conviction: null,
    reason: "Awaiting data"
  };
}

function getOutput(agent) {
  return asObject(agent?.full_output || agent?.raw_agent_output, {});
}

function getTimeframeModel(agent, timeframe = "24h") {
  const output = getOutput(agent);
  return asObject(output.timeframe_models?.[timeframe], {});
}

const FALLBACK_ELIGIBLE_SNAPSHOT_INPUTS = new Set([
  "gold_d5_pct",
  "gold_d20_pct",
  "nq_d5_pct",
  "nq_d20_pct",
  "btc_d5_pct",
  "btc_d20_pct",
  "us_10y_d20_bps",
  "us_10y_real_yield_d20_bps"
]);

const ALWAYS_VISIBLE_SNAPSHOT_GAPS = new Set([
  "latest_us_event",
  "latest_ez_event",
  "geopolitical_risk_flag",
  "btc_dominance_d5",
  "btc_dominance_d20",
  "total_crypto_market_cap_d5_pct",
  "total_crypto_market_cap_d20_pct",
  "stablecoin_supply",
  "stablecoin_supply_d5_pct",
  "stablecoin_supply_d20_pct"
]);

const CONTEXTUAL_FACTOR_LABELS = new Set([
  "US Economic Surprise Direction",
  "EZ Economic Surprise Direction",
  "Stablecoin / Crypto Liquidity",
  "BTC Dominance / Crypto Structure"
]);

const FACTOR_ROLE_BY_ASSET = {
  USD: {
    F7: "contextual",
    F9: "contextual",
    F10: "contextual"
  },
  EUR: {
    F7: "contextual",
    F8: "contextual",
    F9: "contextual",
    F10: "contextual"
  },
  GOLD: {
    F7: "contextual",
    F8: "contextual",
    F9: "contextual",
    F10: "contextual"
  },
  NQ: {
    F7: "contextual",
    F9: "contextual",
    F10: "contextual"
  },
  BTC: {
    F6: "contextual",
    F7: "contextual",
    F9: "contextual",
    F10: "contextual"
  }
};

const MISSING_NEUTRAL_WARNING_PREFIX = `Missing/neutral${" "}input:`;

function factorLabelFromWarning(value = "") {
  const text = String(value || "");
  const index = text.toLowerCase().indexOf(MISSING_NEUTRAL_WARNING_PREFIX.toLowerCase());
  if (index === -1) return "";
  return text.slice(index + MISSING_NEUTRAL_WARNING_PREFIX.length).trim();
}

function factorLabelFromKey(key = "") {
  return String(key || "")
    .replace(/^[A-Z0-9]+\s+/, "")
    .trim();
}

function factorHasMissingInputSignal(factor = {}) {
  const reason = String(factor.reason || "").toLowerCase();
  const evidence = String(factor.evidence || "").toLowerCase();
  return reason.includes("missing input") || evidence.startsWith("missing ");
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map(value => String(value)))];
}

function factorRole(agentName = "", factorKey = "", factorLabel = "") {
  if (CONTEXTUAL_FACTOR_LABELS.has(factorLabel)) return "contextual";
  return FACTOR_ROLE_BY_ASSET[agentName]?.[factorKey] || "mandatory";
}

function factorEntriesForDiagnostics(call, agent, timeframe = "24h") {
  const timeframeModel = getTimeframeModel(agent, timeframe);
  const factorBreakdown = asObject(
    timeframeModel.factor_breakdown || call?.factor_breakdown,
    {}
  );

  return Object.entries(factorBreakdown).map(([key, factor]) => {
    const label = factorLabelFromKey(key) || key;
    return {
      key: String(key || ""),
      label,
      factor: asObject(factor, {}),
      role: factorRole(agent?.agent, String(key || "").split(" ")[0], label)
    };
  });
}

function snapshotFieldLabel(field = "", options = {}) {
  const noQualifyingEvent = options.noQualifyingEvent === true;
  const labels = {
    latest_us_event: noQualifyingEvent ? "No qualifying US event found" : "US event context unavailable",
    latest_ez_event: noQualifyingEvent ? "No qualifying Eurozone event found" : "Eurozone event context unavailable",
    geopolitical_risk_flag: "Geopolitical risk flag unavailable",
    stablecoin_supply: "Stablecoin supply unavailable",
    stablecoin_supply_d5_pct: "Stablecoin supply 5D delta unavailable",
    stablecoin_supply_d20_pct: "Stablecoin supply 20D delta unavailable",
    btc_dominance_d5: "BTC dominance 5D delta unavailable",
    btc_dominance_d20: "BTC dominance 20D delta unavailable",
    total_crypto_market_cap_d5_pct: "Total crypto market cap 5D delta unavailable",
    total_crypto_market_cap_d20_pct: "Total crypto market cap 20D delta unavailable",
    gold_d5_pct: "Gold 5D delta unavailable",
    gold_d20_pct: "Gold 20D delta unavailable",
    nq_d5_pct: "NQ 5D delta unavailable",
    nq_d20_pct: "NQ 20D delta unavailable",
    btc_d5_pct: "BTC 5D delta unavailable",
    btc_d20_pct: "BTC 20D delta unavailable",
    us_10y_d20_bps: "US 10Y 20D delta unavailable",
    us_10y_real_yield_d20_bps: "US 10Y real yield 20D delta unavailable"
  };

  return labels[field] || `${String(field || "").replaceAll("_", " ")} unavailable`;
}

function factorDiagnosticLabel(entry = {}) {
  const label = entry.label || entry.key || "Factor";
  const evidence = String(entry.factor?.evidence || "");

  if (label === "US Economic Surprise Direction" && evidence.toLowerCase().includes("no recent us event")) {
    return "No qualifying US event found";
  }

  if (label === "EZ Economic Surprise Direction" && evidence.toLowerCase().includes("no recent ez event")) {
    return "No qualifying Eurozone event found";
  }

  if (label === "Stablecoin / Crypto Liquidity") {
    return "Stablecoin and crypto-liquidity context unavailable";
  }

  if (label === "BTC Dominance / Crypto Structure") {
    return "BTC dominance structure context unavailable";
  }

  return `${label} unavailable`;
}

function eventWasSimplyAbsent(agent, timeframe = "24h", field = "") {
  if (!["latest_us_event", "latest_ez_event"].includes(field)) return false;

  return factorEntriesForDiagnostics(getCall(agent, timeframe), agent, timeframe).some(entry => {
    if (field === "latest_us_event" && entry.label !== "US Economic Surprise Direction") return false;
    if (field === "latest_ez_event" && entry.label !== "EZ Economic Surprise Direction") return false;

    const evidence = String(entry.factor?.evidence || "").toLowerCase();
    const reason = String(entry.factor?.reason || "").toLowerCase();
    return evidence.includes("no recent") || reason.includes("no confirmed");
  });
}

function impactedEventContextLabels(agent, timeframe = "24h") {
  const labels = new Set();
  const entries = factorEntriesForDiagnostics(getCall(agent, timeframe), agent, timeframe);

  entries.forEach(entry => {
    const label = String(entry.label || "");
    const evidence = String(entry.factor?.evidence || "").toLowerCase();
    const reason = String(entry.factor?.reason || "").toLowerCase();
    const missingEventContext = evidence.includes("no recent") || reason.includes("no confirmed");

    if (!missingEventContext) return;
    if (label === "US Economic Surprise Direction") labels.add("US event context");
    if (label === "EZ Economic Surprise Direction") labels.add("Eurozone event context");
  });

  return Array.from(labels);
}

function agentImpactedByEconomicEventsCollector(agent, timeframe = "24h") {
  return isEconomicEventsCollectorFailure(workflowStatus)
    && impactedEventContextLabels(agent, timeframe).length > 0;
}

function renderEventCollectorAgentWarning(agent, timeframe = "24h") {
  if (!agentImpactedByEconomicEventsCollector(agent, timeframe)) return "";
  const impactedContexts = impactedEventContextLabels(agent, timeframe);
  return `
    <div class="diagnostic-section diagnostic-status">
      <h4>Collector Warning</h4>
      <div class="diagnostic-list">
        <div class="diagnostic-item">
          Economic Events Collector failed in the latest workflow run. ${escapeHtml(impactedContexts.join(" and "))} may be incomplete for this ${escapeHtml(String(timeframe).toUpperCase())} call.
        </div>
      </div>
    </div>
  `;
}

function fallbackMessageForField(field = "", timeframe = "24h") {
  const messages = {
    "24h": {
      gold_d5_pct: "Gold 5D delta unavailable — using 1D delta",
      nq_d5_pct: "NQ 5D delta unavailable — using 1D delta",
      btc_d5_pct: "BTC 5D delta unavailable — using 1D delta"
    },
    "3d": {
      gold_d20_pct: "Gold 20D delta unavailable — using 5D delta",
      nq_d20_pct: "NQ 20D delta unavailable — using 5D delta",
      btc_d20_pct: "BTC 20D delta unavailable — using 5D delta",
      us_10y_d20_bps: "US 10Y 20D delta unavailable — using 5D delta",
      us_10y_real_yield_d20_bps: "US 10Y real yield 20D unavailable — using 5D delta"
    },
    current_week: {
      gold_d20_pct: "Gold 20D delta unavailable — using 5D delta",
      nq_d20_pct: "NQ 20D delta unavailable — using 5D delta",
      btc_d20_pct: "BTC 20D delta unavailable — using 5D delta",
      us_10y_d20_bps: "US 10Y 20D delta unavailable — using 5D delta",
      us_10y_real_yield_d20_bps: "US 10Y real yield 20D unavailable — using 5D delta"
    },
    next_week: {
      gold_d20_pct: "Gold 20D delta unavailable — using 5D delta",
      nq_d20_pct: "NQ 20D delta unavailable — using 5D delta",
      btc_d20_pct: "BTC 20D delta unavailable — using 5D delta",
      us_10y_d20_bps: "US 10Y 20D delta unavailable — using 5D delta",
      us_10y_real_yield_d20_bps: "US 10Y real yield 20D unavailable — using 5D delta"
    },
    current_month: {
      gold_d20_pct: "Gold 20D delta unavailable — using 5D delta",
      nq_d20_pct: "NQ 20D delta unavailable — using 5D delta",
      btc_d20_pct: "BTC 20D delta unavailable — using 5D delta",
      us_10y_d20_bps: "US 10Y 20D delta unavailable — using 5D delta",
      us_10y_real_yield_d20_bps: "US 10Y real yield 20D unavailable — using 5D delta"
    }
  };

  return messages[timeframe]?.[field] || "";
}

function classifyDiagnostics(call, agent, timeframe = "24h") {
  const output = getOutput(agent);
  const factorEntries = factorEntriesForDiagnostics(call, agent, timeframe);
  const timeframeModel = getTimeframeModel(agent, timeframe);
  const model = call?.conviction_model || timeframeModel.conviction_model || {};
  const criticalMissing = [];
  const fallbacksUsed = [];
  const collectorHealth = [];

  for (const entry of factorEntries) {
    if (!factorHasMissingInputSignal(entry.factor)) continue;

    if (entry.role === "contextual") {
      collectorHealth.push(factorDiagnosticLabel(entry));
    } else {
      criticalMissing.push(entry.label);
    }
  }

  for (const field of asArray(output.missing_inputs)) {
    const name = String(field || "");
    if (!name) continue;

    if (ALWAYS_VISIBLE_SNAPSHOT_GAPS.has(name)) {
      collectorHealth.push(snapshotFieldLabel(name, {
        noQualifyingEvent: eventWasSimplyAbsent(agent, timeframe, name)
      }));
      continue;
    }

    if (FALLBACK_ELIGIBLE_SNAPSHOT_INPUTS.has(name)) {
      const fallback = fallbackMessageForField(name, timeframe);
      if (fallback) {
        fallbacksUsed.push(fallback);
      }
      continue;
    }
  }

  const confidenceCalculated = [
    call?.confidence,
    call?.conviction,
    model.final_conviction,
    model.bullish_argument_pct,
    model.bearish_argument_pct,
    model.net_edge_pct
  ].some(value => numberOrNull(value) !== null);
  const analysisCompleted = call?.direction && call.direction !== "PENDING";

  return {
    analysisStatus: {
      mandatoryOk: criticalMissing.length === 0,
      analysisCompleted,
      confidenceCalculated,
      criticalMissing: uniqueStrings(criticalMissing)
    },
    fallbacksUsed: uniqueStrings(fallbacksUsed),
    collectorHealth: uniqueStrings(collectorHealth)
  };
}

function liveMissingInputs(call, agent, timeframe = "24h") {
  return classifyDiagnostics(call, agent, timeframe).analysisStatus.criticalMissing;
}

function combinedConfidenceFlags(call, agent, timeframe = "24h") {
  const output = getOutput(agent);
  const timeframeModel = getTimeframeModel(agent, timeframe);

  return [
    ...asArray(agent?.warnings),
    ...asArray(call?.warnings),
    ...asArray(output.risk_flags),
    ...asArray(output.warnings),
    ...asArray(timeframeModel.risk_flags),
    ...asArray(timeframeModel.warnings),
    ...asArray(call?.conviction_model?.audit_warnings),
    ...asArray(timeframeModel.conviction_audit_warnings)
  ]
    .filter(Boolean)
    .map(value => String(value));
}

function missingInputsCount(call, agent, timeframe = "24h") {
  return liveMissingInputs(call, agent, timeframe).length;
}

function getWeeklyCandleStatus(call, agent, timeframe = "24h") {
  const output = getOutput(agent);
  const timeframeModel = getTimeframeModel(agent, timeframe);
  const model = call?.conviction_model || {};

  return (
    model.weekly_candle_status ||
    timeframeModel.weekly_candle_status ||
    output.weekly_candle_status ||
    ""
  );
}

function deriveConfidenceStrength(confidence, netEdge, participation, direction) {
  return headlineConfidenceLib.deriveConfidenceStrength(confidence, netEdge, participation, direction);
}

function confidenceData(call, agent, timeframe = "24h") {
  const model = call?.conviction_model || {};
  return headlineConfidenceLib.computeHeadlineConfidenceData({
    bullCase: model.bullish_argument_pct,
    bearCase: model.bearish_argument_pct,
    participation: model.directional_participation_pct ?? model.active_participation_pct ?? model.participation,
    netEdge: model.net_edge_pct,
    direction: call?.direction || "PENDING",
    warnings: combinedConfidenceFlags(call, agent, timeframe),
    missingInputsCount: missingInputsCount(call, agent, timeframe),
    weeklyCandleStatus: getWeeklyCandleStatus(call, agent, timeframe),
    fallbackConfidence: model.final_confidence ?? call?.confidence ?? call?.conviction ?? null,
    strengthOverride: model.confidence_strength || null
  });
}

function confidenceValue(call, agent, timeframe = "24h") {
  return confidenceData(call, agent, timeframe).value;
}

function confidenceStrength(call, agent, timeframe = "24h") {
  return confidenceData(call, agent, timeframe).strength;
}

function deriveEvidenceSummary(call, agent, timeframe = "24h") {
  const timeframeModel = getTimeframeModel(agent, timeframe);
  const model = call?.conviction_model || timeframeModel.conviction_model || {};
  const bullCase = numberOrNull(model.bullish_argument_pct);
  const bearCase = numberOrNull(model.bearish_argument_pct);
  const netEdge = numberOrNull(model.net_edge_pct);
  const participation = numberOrNull(
    model.directional_participation_pct ??
    model.active_participation_pct ??
    model.participation
  );

  if (
    !Number.isFinite(bullCase) ||
    !Number.isFinite(bearCase) ||
    !Number.isFinite(netEdge) ||
    !Number.isFinite(participation)
  ) {
    return "";
  }

  return `Derived from evidence split: Bull Case ${Math.round(bullCase)}%, Bear Case ${Math.round(bearCase)}%, Net Edge ${netEdge > 0 ? "+" : ""}${Math.round(netEdge)}%, Participation ${Math.round(participation)}%.`;
}

function displayMetricValue(value) {
  return value === null || value === undefined || value === "" ? "--" : `${Math.round(Number(value))}%`;
}

function isNoCallDirection(direction = "") {
  const normalized = String(direction || "").toUpperCase();
  return normalized === "NO CALL" || normalized === "NO 24H CALL" || normalized === "PENDING";
}

function hasUsableDirection(call) {
  return !!call && !isNoCallDirection(call.direction);
}

function formatLondonDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function formatLondonDay(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "Europe/London"
  });
}

function isWeekendDate(date) {
  const weekday = date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "Europe/London"
  });

  return weekday === "Saturday" || weekday === "Sunday";
}

function marketOpenForDate(agentName, date) {
  return agentName === "BTC" || !isWeekendDate(date);
}

function metricSourceTimeframe(agent) {
  const ordered = ["24h", "3d", "current_week", "next_week", "current_month"];
  return ordered.find(tf => {
    const call = getCall(agent, tf);
    return hasUsableDirection(call) && confidenceValue(call, agent, tf) !== null;
  }) || "24h";
}

function buildDisplayMetrics(agent, timeframe) {
  const call = getCall(agent, timeframe);
  const model = call.conviction_model || {};
  return {
    bull_case: numberOrNull(model.bullish_argument_pct),
    bear_case: numberOrNull(model.bearish_argument_pct),
    winning_side: model.winning_side || null,
    confidence: confidenceValue(call, agent, timeframe),
    conviction: numberOrNull(call.conviction ?? model.final_conviction),
    net_edge: numberOrNull(model.net_edge_pct),
    participation: numberOrNull(
      model.directional_participation_pct ??
      model.active_participation_pct ??
      model.participation
    ),
    directional_participation: numberOrNull(
      model.directional_participation_pct ??
      model.active_participation_pct ??
      model.participation
    ),
    neutral: numberOrNull(model.neutral_evidence_pct ?? model.neutral_pct),
    verdict_strength: confidenceStrength(call, agent, timeframe),
    bull_case_weight: numberOrNull(model.bull_case_weight),
    bear_case_weight: numberOrNull(model.bear_case_weight),
    source_timeframe: timeframe
  };
}

function normaliseAgentCalls(agent) {
  const calls = Object.fromEntries(
    Object.entries(agent.calls || {}).map(([timeframe, call]) => {
      const metrics = buildDisplayMetrics(agent, timeframe);
      return [timeframe, {
        ...call,
        confidence: metrics.confidence,
        bull_case: metrics.bull_case,
        bear_case: metrics.bear_case,
        net_edge: metrics.net_edge,
        participation: metrics.participation,
        strength: metrics.verdict_strength
      }];
    })
  );

  return calls;
}

function outlookSourceTimeframes(dayOffset) {
  if (dayOffset === 0) return ["24h"];
  if (dayOffset === 1) return ["24h", "3d"];
  if (dayOffset === 2 || dayOffset === 3) return ["3d"];
  if (dayOffset === 4 || dayOffset === 5) return ["current_week"];
  return ["next_week"];
}

function buildNoCallOutlookEntry(date, sourceTimeframe = "weekend_rule") {
  return {
    date: formatLondonDate(date),
    day: formatLondonDay(date),
    source_timeframe: sourceTimeframe,
    direction: "NO CALL",
    confidence: null
  };
}

function buildSevenDayOutlook(agent) {
  const baseDate = new Date();
  baseDate.setHours(12, 0, 0, 0);

  return Array.from({ length: 7 }, (_, dayOffset) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + dayOffset);

    if (!marketOpenForDate(agent.agent, date)) {
      return buildNoCallOutlookEntry(date);
    }

    const sourceTimeframe = outlookSourceTimeframes(dayOffset).find(timeframe => {
      const call = getCall(agent, timeframe);
      return hasUsableDirection(call);
    });

    if (!sourceTimeframe) {
      return buildNoCallOutlookEntry(date, outlookSourceTimeframes(dayOffset)[0]);
    }

    const call = getCall(agent, sourceTimeframe);
    return {
      date: formatLondonDate(date),
      day: formatLondonDay(date),
      source_timeframe: sourceTimeframe,
      direction: call.direction || "NO CALL",
      confidence: confidenceValue(call, agent, sourceTimeframe)
    };
  });
}

function normaliseLayer1Data(data = {}) {
  const agents = (data.agents || []).map(rawAgent => {
    const provisionalAgent = {
      ...rawAgent,
      calls: rawAgent.calls || {}
    };

    const calls = normaliseAgentCalls(provisionalAgent);
    const agent = {
      ...provisionalAgent,
      calls
    };

    const sourceTimeframe = metricSourceTimeframe(agent);
    const displayMetrics = buildDisplayMetrics(agent, sourceTimeframe);

    return {
      ...agent,
      display_metrics: {
        ...(agent.display_metrics || {}),
        ...displayMetrics
      },
      seven_day_outlook: buildSevenDayOutlook(agent)
    };
  });

  return {
    ...data,
    agents
  };
}

function getAgent(name) {
  return (layer1Data?.agents || []).find(agent => agent.agent === name);
}

function getDashboardUpdatedAt() {
  return layer1Data?.dashboard_meta?.last_updated_et || null;
}

function getAgentUpdatedAt(agent) {
  return agent?.last_run_et || agent?.created_at || null;
}

function getLayer1Validity(agent) {
  if (!agent) return null;
  return {
    generated_at: agent.generated_at || agent.priority_call?.generated_at || agent.calls?.["24h"]?.generated_at || null,
    sealed_at: agent.sealed_at || agent.priority_call?.sealed_at || agent.calls?.["24h"]?.sealed_at || null,
    valid_from: agent.valid_from || agent.priority_call?.valid_from || agent.calls?.["24h"]?.valid_from || null,
    refresh_due_at: agent.refresh_due_at || agent.priority_call?.refresh_due_at || agent.calls?.["24h"]?.refresh_due_at || null,
    forecast_window_end: agent.forecast_window_end ?? agent.priority_call?.forecast_window_end ?? agent.calls?.["24h"]?.forecast_window_end ?? null,
    expires_at: agent.expires_at ?? agent.priority_call?.expires_at ?? agent.calls?.["24h"]?.expires_at ?? null,
    status_at_build: agent.status_at_build || agent.priority_call?.status_at_build || agent.calls?.["24h"]?.status_at_build || null,
    effective_status: agent.effective_status || agent.priority_call?.effective_status || agent.calls?.["24h"]?.effective_status || null,
    status_resolved_at: agent.status_resolved_at || agent.priority_call?.status_resolved_at || agent.calls?.["24h"]?.status_resolved_at || null,
    timezone: agent.timezone || agent.priority_call?.timezone || agent.calls?.["24h"]?.timezone || "America/New_York"
  };
}

function resolveLayer1DisplayStatus(agent) {
  return getLayer1Validity(agent)?.effective_status || getLayer1Validity(agent)?.status_at_build || "UNAVAILABLE";
}

function validityStatusLabel(status = "") {
  return String(status || "UNAVAILABLE").replaceAll("_", " ");
}

function validityStatusClass(status = "") {
  return `status-${String(status || "unavailable").toLowerCase()}`;
}

function renderOverviewExpirySection(validity = null, displayStatus = "UNAVAILABLE", assetName = "") {
  const forecastExpiresAt = validity?.forecast_window_end || validity?.expires_at || null;
  const expiryValue = forecastExpiresAt
    ? formatContractTime(forecastExpiresAt, validity?.timezone || "America/New_York", { zoneLabel: "ET" })
    : "No active 24H expiry";
  const ukExpiryValue = forecastExpiresAt
    ? formatContractTimeWithTimezoneAbbreviation(forecastExpiresAt, "Europe/London", "UK")
    : null;
  const refreshDueAt = validity?.refresh_due_at
    ? formatContractTime(validity.refresh_due_at, validity?.timezone || "America/New_York", { zoneLabel: "ET" })
    : "Pending";
  const expiryNote = forecastExpiresAt
    ? "Expiry = when this forecast stops being valid."
    : "No active 24H directional forecast is currently published.";
  const tooltipId = assetName
    ? `overview-expiry-tooltip-${String(assetName).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    : "overview-expiry-tooltip";
  const triggerLabel = forecastExpiresAt
    ? `24H call valid until ${expiryValue}. UK time ${ukExpiryValue}.`
    : `24H call valid until ${expiryValue}.`;

  return `
    <section class="overview-expiry-card ${escapeHtml(validityStatusClass(displayStatus))}" data-overview-expiry-card="true" data-validity-status="${escapeHtml(displayStatus)}">
      <div class="overview-expiry-head">
        <div class="overview-expiry-copy">
          <span class="validity-label">24H call valid until</span>
          <span
            class="overview-expiry-trigger${forecastExpiresAt ? " has-tooltip" : ""}"
            ${forecastExpiresAt ? `tabindex="0" aria-describedby="${escapeHtml(tooltipId)}" aria-label="${escapeHtml(triggerLabel)}"` : ""}
          >
            <strong class="overview-expiry-value">${escapeHtml(expiryValue)}</strong>
            ${forecastExpiresAt ? `
              <span id="${escapeHtml(tooltipId)}" class="overview-expiry-tooltip" role="tooltip">
                UK time: ${escapeHtml(ukExpiryValue)}
              </span>
            ` : ""}
          </span>
        </div>
        <span class="badge ${escapeHtml(validityStatusClass(displayStatus))} overview-expiry-badge">${escapeHtml(validityStatusLabel(displayStatus))}</span>
      </div>
      <div class="overview-expiry-meta">
        <span>${escapeHtml(expiryNote)}</span>
        <span>Refresh due: ${escapeHtml(refreshDueAt)}</span>
      </div>
    </section>
  `;
}

function bestLiveAgent() {
  const live = (layer1Data?.agents || []).filter(agent => {
    const call24 = getCall(agent, "24h");
    return confidenceValue(call24, agent, "24h") !== null && call24.direction !== "PENDING";
  });

  return live.sort((a, b) => {
    return Number(confidenceValue(getCall(b, "24h"), b, "24h") || 0) - Number(confidenceValue(getCall(a, "24h"), a, "24h") || 0);
  })[0] || null;
}

function renderOverviewStats() {
  const container = document.getElementById("overviewStats");
  if (!container) return;

  const strongest = bestLiveAgent();
  const liveCount = (layer1Data?.agents || []).filter(agent => agent.status === "live").length;
  const heroLiveAgents = document.getElementById("heroLiveAgents");
  const heroStrongestSignal = document.getElementById("heroStrongestSignal");
  const heroLastRun = document.getElementById("heroLastRun");

  const dashboardUpdated = getDashboardUpdatedAt();
  const formattedDashboardUpdated = formatDashboardTime(dashboardUpdated);
  const dashboardAge = formatRelativeAge(dashboardUpdated);

  if (heroLiveAgents) heroLiveAgents.textContent = `${liveCount} / ${orderedAgents.length}`;
  if (heroStrongestSignal) {
    heroStrongestSignal.textContent = strongest
      ? `${strongest.agent} ${formatConviction(confidenceValue(getCall(strongest, "24h"), strongest, "24h"))}`
      : "Pending";
  }
  if (heroLastRun) heroLastRun.textContent = dashboardAge || (dashboardUpdated ? "Live" : "Pending");

  container.innerHTML = `
    <article class="metric-card hero-metric">
      <p class="eyebrow">Strongest 24H Signal</p>
      <h3>${strongest ? strongest.agent : "PENDING"}</h3>
      <strong class="direction ${directionClass(getCall(strongest, "24h").direction)}">
        ${strongest ? normaliseDirection(getCall(strongest, "24h").direction) : "PENDING"}
      </strong>
      <span>${strongest ? formatConviction(confidenceValue(getCall(strongest, "24h"), strongest, "24h")) : "--"} confidence</span>
    </article>

    <article class="metric-card">
      <p class="eyebrow">Live Agents</p>
      <h3>${liveCount} / ${orderedAgents.length}</h3>
      <span>Layer 1 raw producers</span>
    </article>

    <article class="metric-card">
      <p class="eyebrow">Last n8n Ingest</p>
      <h3>${dashboardUpdated ? "Live" : "Pending"}</h3>
      <span>${escapeHtml(formattedDashboardUpdated)}${dashboardAge ? ` · ${escapeHtml(dashboardAge)}` : ""}</span>
    </article>
  `;
}

function collectOverviewMacroContext(layer1Calls = []) {
  const upcomingEvents = [];
  const scalarContext = {
    latestUsEvent: null,
    latestEzEvent: null,
    fedBias: null,
    ecbBias: null,
    dxyDayMove: null,
    dxyFiveDayMove: null,
    vixDayMove: null,
    vixFiveDayMove: null,
    realYieldFiveDayMove: null
  };

  layer1Calls.forEach((row) => {
    const marketInputs = asObject(row.marketInputs, {});
    const eventItems = asArray(marketInputs.upcoming_events).filter(item => item && typeof item === "object");
    upcomingEvents.push(...eventItems);

    if (scalarContext.latestUsEvent === null && marketInputs.latest_us_event) scalarContext.latestUsEvent = marketInputs.latest_us_event;
    if (scalarContext.latestEzEvent === null && marketInputs.latest_ez_event) scalarContext.latestEzEvent = marketInputs.latest_ez_event;
    if (scalarContext.fedBias === null && metricAvailable(marketInputs.fed_bias)) scalarContext.fedBias = marketInputs.fed_bias;
    if (scalarContext.ecbBias === null && metricAvailable(marketInputs.ecb_bias)) scalarContext.ecbBias = marketInputs.ecb_bias;
    if (scalarContext.dxyDayMove === null && metricAvailable(marketInputs.dxy_d1)) scalarContext.dxyDayMove = Number(marketInputs.dxy_d1);
    if (scalarContext.dxyFiveDayMove === null && metricAvailable(marketInputs.dxy_d5)) scalarContext.dxyFiveDayMove = Number(marketInputs.dxy_d5);
    if (scalarContext.vixDayMove === null && metricAvailable(marketInputs.vix_d1)) scalarContext.vixDayMove = Number(marketInputs.vix_d1);
    if (scalarContext.vixFiveDayMove === null && metricAvailable(marketInputs.vix_d5)) scalarContext.vixFiveDayMove = Number(marketInputs.vix_d5);
    if (scalarContext.realYieldFiveDayMove === null && metricAvailable(marketInputs.us_10y_real_yield_d5_bps)) scalarContext.realYieldFiveDayMove = Number(marketInputs.us_10y_real_yield_d5_bps);
  });

  const highImpactEvents = upcomingEvents.filter((event) => {
    const priority = Number(event.priority ?? event.impact_rank ?? 0);
    return Number.isFinite(priority) && priority >= 70;
  });

  return {
    ...scalarContext,
    upcomingEvents,
    highImpactEvents
  };
}

function collectOverviewBriefingState() {
  const layer1Calls = (layer1Data?.agents || []).map((agent) => {
    const call24 = getCall(agent, "24h");
    return {
      agent: agent.agent,
      direction: call24.direction || "PENDING",
      confidence: confidenceValue(call24, agent, "24h"),
      strength: confidenceStrength(call24, agent, "24h"),
      warnings: combinedConfidenceFlags(call24, agent, "24h"),
      missingInputs: liveMissingInputs(call24, agent, "24h"),
      participation: participationValue(call24),
      marketInputs: asObject(agent.market_inputs || getOutput(agent).market_inputs_seen_by_workflow, {})
    };
  });

  return {
    layer1Calls,
    derivedLayer2: deriveLiveLayer2Dashboard(),
    macroContext: collectOverviewMacroContext(layer1Calls)
  };
}

function buildOverviewBriefing(state = {}) {
  const layer1Calls = Array.isArray(state.layer1Calls) ? state.layer1Calls : [];
  const derivedLayer2 = state.derivedLayer2 || {};
  const macroContext = state.macroContext || {};
  const validCalls = layer1Calls.filter(row => metricAvailable(row.confidence) && String(row.direction || "").toUpperCase() !== "PENDING");
  const usdRow = validCalls.find(row => row.agent === "USD") || null;

  if (validCalls.length < 3 || !usdRow) {
    return {
      unavailable: true,
      marketConditions: "Market briefing unavailable because current agent outputs are incomplete.",
      weekAhead: "Refresh the dashboard after the next successful Master Orchestrator run to rebuild the current macro summary.",
      macroRegime: { label: "High Uncertainty", tone: "high-uncertainty", detail: "Not enough complete Layer 1 inputs are available to produce a reliable briefing." },
      outlookConfidence: { label: "Low", tone: "low", detail: "Overview confidence stays low until the current asset set is complete." }
    };
  }

  const strongest = validCalls.slice().sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0];
  const weakest = validCalls.slice().sort((a, b) => Number(a.confidence || 0) - Number(b.confidence || 0))[0];
  const bullishCount = validCalls.filter(row => String(row.direction || "").toUpperCase().includes("BULLISH")).length;
  const bearishCount = validCalls.filter(row => String(row.direction || "").toUpperCase().includes("BEARISH")).length;
  const leanCount = validCalls.filter(row => String(row.direction || "").toUpperCase().includes("LEAN")).length;
  const opportunities = Array.isArray(derivedLayer2.tradeOpportunities) ? derivedLayer2.tradeOpportunities : [];
  const averageConfidence = validCalls.reduce((sum, row) => sum + Number(row.confidence || 0), 0) / validCalls.length;
  const missingInputsCount = validCalls.reduce((sum, row) => sum + (Array.isArray(row.missingInputs) ? row.missingInputs.length : 0), 0);
  const warningCount = validCalls.reduce((sum, row) => sum + (Array.isArray(row.warnings) ? row.warnings.length : 0), 0);
  const lowParticipationCount = validCalls.filter(row => Number(row.participation || 0) > 0 && Number(row.participation || 0) < 35).length;

  let breadthLabel = "mostly no-trade";
  let breadthDetail = "with most pairs constrained by conflicting, non-directional, or incomplete legs.";
  if (opportunities.length >= 3) {
    breadthLabel = "broad";
    breadthDetail = "with multiple tradable pair setups surviving the current confidence gate.";
  } else if (opportunities.length >= 1) {
    breadthLabel = "limited";
    breadthDetail = opportunities.length === 1
      ? "with one tradable pair and the broader set still constrained by weak or conflicting legs."
      : "with a small tradable set but the broader board still constrained by weak or conflicting legs.";
  }

  const marketConditions = [
    `24H conditions are ${bullishCount > bearishCount ? "slightly pro-risk" : bullishCount < bearishCount ? "defensive" : "mixed"}, with ${bullishCount} bullish and ${bearishCount} bearish calls${leanCount ? `, including ${leanCount} lean signal${leanCount === 1 ? "" : "s"}` : ""}. ${strongest.agent} is currently the strongest 24H call at ${Math.round(Number(strongest.confidence || 0))}% ${normaliseDirection(strongest.direction).toLowerCase()}, while ${weakest.agent} is the weakest at ${Math.round(Number(weakest.confidence || 0))}% ${normaliseDirection(weakest.direction).toLowerCase()}.`,
    `USD, the common Layer 2 pair leg, is ${normaliseDirection(usdRow.direction).toLowerCase()} at ${Math.round(Number(usdRow.confidence || 0))}% headline confidence. Layer 2 opportunities are ${breadthLabel}, ${breadthDetail}`
  ].join(" ");

  const eventLead = macroContext.highImpactEvents?.length
    ? "Upcoming high-impact calendar inputs are present in the current snapshot, so scheduled catalysts should be treated as the first watchpoint into the next refresh cycle."
    : "Economic calendar detail is limited in the current snapshot, so the next set of high-impact releases and policy communication should be treated as the main catalyst risk.";
  const yieldClause = Number.isFinite(macroContext.realYieldFiveDayMove)
    ? macroContext.realYieldFiveDayMove > 0
      ? "Firm real yields would keep pressure on gold and can reinforce USD support."
      : "Easing real yields would favor gold and can weaken the current USD impulse."
    : "Real-yield direction remains an important swing factor for gold and USD.";
  const dxyClause = Number.isFinite(macroContext.dxyFiveDayMove)
    ? macroContext.dxyFiveDayMove > 0
      ? "A stronger DXY backdrop would matter most for EUR and gold."
      : "A softer DXY backdrop would matter most for EUR, gold, and cross-asset risk tone."
    : "DXY repricing remains one of the cleanest ways the board can rotate quickly.";
  const riskClause = Number.isFinite(macroContext.vixFiveDayMove)
    ? macroContext.vixFiveDayMove < 0
      ? "If VIX and broader risk tone stay calm, NQ and BTC can hold their risk appetite bid."
      : "If VIX and risk tone deteriorate, NQ and BTC can flip faster than the rates-sensitive assets."
    : "Risk tone across VIX, NQ, and BTC should be watched closely for regime change.";

  const weekAhead = [
    eventLead,
    `${dxyClause} ${yieldClause} ${riskClause} Fed and ECB communication, surprise data, and any break in gold/real-yield alignment can all change the next dashboard output materially.`
  ].join(" ");

  let macroRegime = { label: "Stable", tone: "stable", detail: "Cross-asset signals are mostly aligned and current inputs are broadly complete." };
  if (missingInputsCount >= 6 || warningCount >= 8 || lowParticipationCount >= 2) {
    macroRegime = { label: "High Uncertainty", tone: "high-uncertainty", detail: "Multiple missing inputs, warnings, or low-participation calls are reducing board clarity." };
  } else if (missingInputsCount >= 3 || warningCount >= 4 || opportunities.length <= 1) {
    macroRegime = { label: "Developing", tone: "developing", detail: "The board has direction, but cross-asset confirmation is still uneven." };
  }

  let outlookConfidence = { label: "High", tone: "high", detail: "Average 24H headline confidence is strong across the current board." };
  if (averageConfidence < 55 || missingInputsCount >= 6) {
    outlookConfidence = { label: "Low", tone: "low", detail: "Headline confidence is soft enough that the next catalyst can reshape the board quickly." };
  } else if (averageConfidence < 72 || warningCount >= 4) {
    outlookConfidence = { label: "Moderate", tone: "moderate", detail: "Signals are usable, but still depend on rates, DXY, and risk tone holding together." };
  }

  return {
    unavailable: false,
    marketConditions,
    weekAhead,
    macroRegime,
    outlookConfidence
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.__dashboardTestHooks = {
    ...(globalThis.__dashboardTestHooks || {}),
    buildOverviewBriefing,
    buildWorkflowMarkerDelta,
    buildWorkflowRefreshPresentation,
    buildWorkflowRuntimeProfileFallback,
    createRefreshRequestId,
    currentWorkflowMarkers,
    formatDurationClock,
    getLayer1Validity,
    isTerminalWorkflowRefreshPhase,
    loadDashboardForTest: loadDashboard,
    loadWorkflowRuntimeProfileForTest: loadWorkflowRuntimeProfile,
    loadWorkflowStatusForTest: loadWorkflowStatus,
    readStoredWorkflowRefreshState,
    renderAgentCard,
    resolveLayer1DisplayStatus,
    restoreWorkflowRefreshStateForTest: restoreWorkflowRefreshState,
    writeStoredWorkflowRefreshState,
    workflowRefreshElapsedSeconds,
    workflowRefreshPhaseBadgeLabel,
    validateArchitectureManifest,
    setArchitectureManifestUrlForTest(url) {
      architectureManifestUrl = url || architectureManifestUrlDefault;
      resetArchitectureState();
    },
    resetArchitectureManifestUrlForTest() {
      architectureManifestUrl = architectureManifestUrlDefault;
      resetArchitectureState();
    },
    async reloadArchitectureManifestForTest() {
      try {
        await loadArchitectureManifest({ force: true });
      } catch (err) {
        return {
          status: architectureState.status,
          error: architectureState.error
        };
      }
      return {
        status: architectureState.status,
        error: architectureState.error,
        activeViewId: architectureState.activeViewId,
        selectedNodeId: architectureState.selectedNodeId
      };
    },
    getArchitectureGeometryForTest() {
      const renderModel = architectureState.renderModel;
      if (!renderModel) return null;
      return {
        viewId: architectureState.activeViewId,
        stageIds: (renderModel.stages || []).map((stage) => stage.id),
        nodeIds: renderModel.nodes.map((node) => node.id),
        edgeIds: renderModel.edges.map((edge) => edge.id)
      };
    },
    setOperationalArtifactUrlsForTest(urls = {}) {
      economicEventRefreshUrl = urls.economicEventRefreshUrl || economicEventRefreshUrlDefault;
      economicEventsSourceUrl = urls.economicEventsSourceUrl || economicEventsSourceUrlDefault;
      inputHealthUrl = urls.inputHealthUrl || inputHealthUrlDefault;
      workflowStatusUrlOverride = urls.workflowStatusUrl || workflowStatusUrlOverride;
    },
    resetOperationalArtifactUrlsForTest() {
      economicEventRefreshUrl = economicEventRefreshUrlDefault;
      economicEventsSourceUrl = economicEventsSourceUrlDefault;
      inputHealthUrl = inputHealthUrlDefault;
      workflowStatusUrlOverride = "";
    },
    async reloadDashboardForTest() {
      await loadDashboard();
      await loadWorkflowStatus();
      return {
        economicEventPanelState: document.querySelector("[data-economic-event-panel='true']")?.getAttribute("data-economic-event-panel-state") || "",
        inputHealthPanelState: document.querySelector("[data-input-health-panel='true']")?.getAttribute("data-input-health-panel-state") || "",
        workflowStatusTone: document.querySelector("[data-overview-status='true']")?.getAttribute("data-overview-status-tone") || ""
      };
    }
  };
}

function renderOverviewBriefing() {
  const container = document.getElementById("overviewBriefing");
  if (!container) return;

  const briefing = buildOverviewBriefing(collectOverviewBriefingState());
  const macroRegimeClass = String(briefing.macroRegime?.tone || "").toLowerCase().replace(/\s+/g, "-");
  const outlookConfidenceClass = String(briefing.outlookConfidence?.tone || "").toLowerCase().replace(/\s+/g, "-");

  container.innerHTML = `
    <div class="overview-briefing-shell" data-overview-briefing="true">
      <div class="overview-briefing-copy">
        <div class="panel-head compact-panel-head">
          <div>
            <p class="eyebrow">Overview Briefing</p>
            <h3>Institutional Snapshot</h3>
          </div>
        </div>
        <section class="overview-briefing-block" data-overview-briefing-section="market-conditions">
          <h3>24H Market Conditions</h3>
          <p>${escapeHtml(briefing.marketConditions)}</p>
        </section>
        <section class="overview-briefing-block" data-overview-briefing-section="week-ahead">
          <h3>Week Ahead / What Could Change</h3>
          <p>${escapeHtml(briefing.weekAhead)}</p>
        </section>
      </div>
      <aside class="overview-briefing-chips" aria-label="Overview status chips">
        <div class="overview-briefing-chip ${escapeHtml(macroRegimeClass)}" data-overview-briefing-chip="macro-regime">
          <span>Current Macro Regime</span>
          <strong>${escapeHtml(briefing.macroRegime?.label || "Unavailable")}</strong>
          <small>${escapeHtml(briefing.macroRegime?.detail || "")}</small>
        </div>
        <div class="overview-briefing-chip ${escapeHtml(outlookConfidenceClass)}" data-overview-briefing-chip="outlook-confidence">
          <span>Outlook Confidence</span>
          <strong>${escapeHtml(briefing.outlookConfidence?.label || "Unavailable")}</strong>
          <small>${escapeHtml(briefing.outlookConfidence?.detail || "")}</small>
        </div>
      </aside>
    </div>
  `;
}

function formatCompactSignalValue(value, fallback = "--") {
  return metricAvailable(value) ? String(value) : fallback;
}

function compactTitleLabel(value = "", fallback = "--") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function compactOverviewStateLabel(value = "") {
  const text = String(value || "").trim();
  if (!text) return "No setup";
  if (/^rank\s+/i.test(text)) return text.toUpperCase();
  if (/awaiting refresh/i.test(text)) return "Awaiting refresh";
  if (/no setup/i.test(text)) return "No setup";
  return "Filtered";
}

function buildOverviewLayer2SummaryRows() {
  const derivedLayer2 = deriveLiveLayer2Dashboard();
  const opportunityMap = new Map(
    (derivedLayer2.tradeOpportunities || []).map((item) => [String(item.pairCode || "").toUpperCase(), item])
  );
  const avoidMap = new Map(
    (derivedLayer2.avoidToday || []).map((item) => [String(item.pairCode || "").toUpperCase(), item])
  );

  return pairTradeResearchConfigs.map((config) => {
    if (config.liveEligibility !== "READY") {
      return {
        pair: config.pairLabel,
        signal: "RESEARCH",
        confidence: "--",
        strength: "--",
        state: "Onboarding",
        onboarding: true,
        marketClosed: false
      };
    }
    const key = String(config.pairCode || "").toUpperCase();
    const opportunity = opportunityMap.get(key);
    if (opportunity) {
      return {
        pair: config.pairLabel,
        signal: String(opportunity.direction || "NO TRADE").replaceAll("_", " "),
        confidence: metricAvailable(opportunity.confidence) ? `${Math.round(Number(opportunity.confidence))}%` : "--",
        strength: compactTitleLabel(opportunity.strengthBucket, "--"),
        state: `Rank ${opportunity.rank || "--"}`,
        onboarding: false,
        marketClosed: false
      };
    }
    const avoided = avoidMap.get(key);
    return {
      pair: config.pairLabel,
      signal: "NO TRADE",
      confidence: "--",
      strength: "--",
      state: avoided?.marketStatus === "CLOSED" ? "Market closed" : avoided?.reason ? compactOverviewStateLabel(String(avoided.reason)) : "No setup",
      onboarding: false,
      marketClosed: avoided?.marketStatus === "CLOSED"
    };
  });
}

function renderOverviewSignalBoard() {
  const container = document.getElementById("overviewSignalBoard");
  if (!container) return;

  const layer2Cards = buildOverviewLayer2SummaryRows().map((row) => ({
    tier: "Layer 2",
    status: row.state,
    asset: row.pair,
    signal: row.signal,
    signalClass: directionClass(row.signal),
    isActiveTrade: row.signal === "BUY" || row.signal === "SELL",
    isOnboarding: row.onboarding === true,
    isMarketClosed: row.marketClosed === true,
    metrics: [
      { label: "Conf.", value: row.confidence },
      { label: "Strength", value: row.strength }
    ],
    footer: row.onboarding
      ? "Layer 1 and replay required"
      : row.marketClosed
        ? "Market closed - no trade permitted"
        : row.signal === "NO TRADE" ? "No trade filter active" : "Trade setup candidate"
  }));

  const fallbackLayer2Cards = [
    "Setup scan",
    "Relative strength",
    "Pair ranking",
    "Trade filter"
  ].map((asset) => ({
    tier: "Layer 2",
    status: "Awaiting refresh",
    asset,
    signal: "Pending",
    signalClass: directionClass("PENDING"),
    metrics: [
      { label: "Conf.", value: "--" },
      { label: "Strength", value: "--" }
    ],
    footer: "Awaiting setup"
  }));

  const renderMiniCard = (card) => `
    <article class="signal-mini-card${card.isActiveTrade ? " is-active-trade" : ""}${card.isOnboarding ? " is-onboarding" : ""}${card.isMarketClosed ? " is-market-closed" : ""}">
      <div class="signal-mini-card-topline">
        <p class="signal-mini-label">${escapeHtml(card.tier)}</p>
        <span class="signal-mini-status">${escapeHtml(card.status)}</span>
      </div>
      <div class="signal-mini-asset">${escapeHtml(card.asset)}</div>
      <div class="signal-mini-signal direction ${escapeHtml(card.signalClass)}">${escapeHtml(card.signal)}</div>
      <div class="signal-mini-metrics">
        ${card.metrics
          .map(
            (metric) => `
              <div class="signal-mini-metric-pill">
                <span>${escapeHtml(metric.label)}</span>
                <strong>${escapeHtml(metric.value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="signal-mini-footer">${escapeHtml(card.footer || "")}</div>
    </article>
  `;

  const finalLayer2Cards = (layer2Cards.length ? layer2Cards : fallbackLayer2Cards).map(renderMiniCard).join("");
  const activeTradeCount = layer2Cards.filter((card) => card.isActiveTrade).length;
  const livePairCount = pairTradeResearchConfigs.filter((config) => config.liveEligibility === "READY").length;
  const onboardingPairCount = pairTradeResearchConfigs.length - livePairCount;

  container.innerHTML = `
    <div class="panel-head compact-panel-head overview-signal-board-head">
      <div>
        <p class="eyebrow">Quick Overview</p>
        <h3>Signal Board</h3>
      </div>
      <p class="summary">Fast scan of live trade eligibility, closed-market blocks, and assets still in research onboarding.</p>
    </div>
    <div class="overview-signal-board-grid">
      <section class="overview-signal-strip">
        <div class="overview-signal-strip-head">
          <p class="overview-signal-strip-label">Layer 2 signal board</p>
          <p class="overview-signal-strip-meta">${activeTradeCount} active / ${livePairCount} live pairs${onboardingPairCount ? ` / ${onboardingPairCount} onboarding` : ""}</p>
        </div>
        <div class="overview-signal-mini-grid">${finalLayer2Cards}</div>
      </section>
    </div>
  `;
}

function createEconomicEventRefreshFallback(errorMessage = "") {
  const warningCodes = errorMessage ? ["artifact_unavailable"] : [];
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source_run_id: null,
    consistency_status: "UNKNOWN",
    consistency_warnings: errorMessage ? ["artifact_unavailable"] : [],
    event_source: {
      name: "dashboard_fallback",
      source_status: errorMessage ? "DATA_UNAVAILABLE" : "SOURCE_UNAVAILABLE",
      source_timezone: economicEventRefreshLib.DEFAULT_SOURCE?.source_timezone_label || "Unknown",
      policy_version: null,
      rows_seen: null
    },
    summary: {
      panel_state: errorMessage ? "DATA_UNAVAILABLE" : "SOURCE_UNAVAILABLE",
      total_events_in_scope: 0,
      unresolved_event_count: 0,
      highest_priority_event_id: null,
      imminent_threshold_minutes: economicEventRefreshLib.DEFAULT_IMMINENT_THRESHOLD_MINUTES || 60,
      selection_rule: "Include today's in-scope major events, unresolved earlier-today or previous-day events, and future events that fall within at least one affected agent's active forecast window.",
      data_quality_warnings: warningCodes
    },
    agents: {},
    events: [],
    error: errorMessage || "",
    fallback_kind: errorMessage ? "artifact_unavailable" : "bootstrap"
  };
}

function createInputHealthFallback(errorMessage = "") {
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    overall_status: errorMessage ? "DATA_UNAVAILABLE" : "UNKNOWN",
    affected_agent_count: 0,
    critical_issue_count: 0,
    missing_input_count: 0,
    stale_input_count: 0,
    placeholder_input_count: 0,
    source_failure_count: 0,
    last_full_health_at: null,
    sources: {},
    agents: {},
    fallback_kind: errorMessage ? "artifact_unavailable" : "bootstrap",
    issues: errorMessage ? [{
      agent: "SYSTEM",
      input_id: "input_health_artifact",
      label: "Input health artifact",
      category: "artifact",
      importance: "high",
      status: "UNKNOWN",
      reason: errorMessage,
      default_applied: false,
      fallback_applied: false,
      confidence_effect: "No extra confidence adjustment beyond the canonical model",
      recovery_action: "Republish the input-health artifact"
    }] : []
  };
}

function createEconomicEventsSourceFallback(errorMessage = "") {
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: {
      source_name: "dashboard_fallback",
      source_status: errorMessage ? "DATA_UNAVAILABLE" : "SOURCE_UNAVAILABLE",
      warning: errorMessage || "The economic-event source artifact is unavailable."
    },
    events: [],
    error: errorMessage || "",
    fallback_kind: errorMessage ? "artifact_unavailable" : "bootstrap"
  };
}

function firstNonEmptyTimestamp(...values) {
  return values.find((value) => value) || null;
}

function latestIsoTimestamp(values = []) {
  const validTimes = values
    .map((value) => {
      const ms = value ? new Date(value).getTime() : Number.NaN;
      return Number.isNaN(ms) ? null : { value, ms };
    })
    .filter(Boolean)
    .sort((a, b) => b.ms - a.ms);
  return validTimes[0]?.value || null;
}

function countLiveLayer1Agents(data = layer1Data) {
  return Array.isArray(data?.agents)
    ? data.agents.filter((agent) => String(agent?.status || "").toLowerCase() === "live").length
    : 0;
}

function countRenderableLayer2Pairs(data = layer2Data) {
  return Array.isArray(data?.pairs) ? data.pairs.length : 0;
}

function getLayer1PublishedAt(data = layer1Data) {
  const candidates = [data?.dashboard_meta?.last_updated_et];
  if (Array.isArray(data?.agents)) {
    for (const agent of data.agents) {
      candidates.push(firstNonEmptyTimestamp(agent?.sealed_at, agent?.generated_at, agent?.last_run_et));
    }
  }
  return latestIsoTimestamp(candidates);
}

function getLayer2PublishedAt(data = layer2Data) {
  const candidates = [data?.dashboard_meta?.last_updated_et];
  if (Array.isArray(data?.pairs)) {
    for (const pair of data.pairs) {
      candidates.push(firstNonEmptyTimestamp(pair?.sealed_at, pair?.generated_at, pair?.valid_from));
    }
  }
  return latestIsoTimestamp(candidates);
}

function workflowFailed(status = workflowStatus) {
  return workflowStatusClass(status?.status || "pending") === "failed";
}

function callsRemainVisible() {
  return countLiveLayer1Agents() > 0 || countRenderableLayer2Pairs() > 0;
}

function getWorkflowFailureSummary(status = workflowStatus) {
  return {
    failedStep: status?.failed_step || status?.error?.step || "Refresh workflow",
    reason: workflowErrorText(status?.error) || status?.message || "No error reason supplied."
  };
}

function getEconomicSourceStatus() {
  const sourceStatus = economicEventsSourceData?.source?.source_status
    || economicEventRefreshData?.event_source?.source_status
    || inputHealthData?.sources?.economic_events?.data_status
    || "";
  return String(sourceStatus || "UNKNOWN").toUpperCase();
}

function getEconomicSourceWarning() {
  return economicEventsSourceData?.source?.warning
    || economicEventRefreshData?.event_source?.warning
    || inputHealthData?.sources?.economic_events?.warning
    || "";
}

function isArtifactBehindCurrentCalls(artifactGeneratedAt, referencePublishedAt) {
  if (!artifactGeneratedAt || !referencePublishedAt) return false;
  const artifactMs = new Date(artifactGeneratedAt).getTime();
  const referenceMs = new Date(referencePublishedAt).getTime();
  if (Number.isNaN(artifactMs) || Number.isNaN(referenceMs)) return false;
  return referenceMs - artifactMs > 300000;
}

function publicIssueStatusLabel(status = "") {
  const normalized = String(status || "UNKNOWN").toUpperCase();
  if (normalized === "SOURCE_UNAVAILABLE") return "SOURCE UNAVAILABLE";
  if (normalized === "STALE") return "STALE";
  if (normalized === "MISSING" || normalized === "PLACEHOLDER") return "MISSING";
  if (normalized === "PARTIAL") return "DEGRADED";
  return normalized.replaceAll("_", " ");
}

function formatPublicIssueSummary(issue) {
  if (!issue) return "No specific issue recorded.";
  const label = issue.label || "Input";
  const status = String(issue.status || "UNKNOWN").toUpperCase();
  const timestamp = firstNonEmptyTimestamp(issue.collected_timestamp, issue.observation_timestamp);
  const updateText = timestamp ? ` Last updated ${formatDashboardTime(timestamp)}.` : "";

  if (status === "SOURCE_UNAVAILABLE") return `${label} source unavailable.${updateText}`;
  if (status === "STALE") return `${label} is stale.${updateText}`;
  if (status === "MISSING" || status === "PLACEHOLDER") return `${label} is missing.${updateText}`;
  if (status === "PARTIAL") return `${label} is degraded because upstream source evidence is incomplete.${updateText}`;
  return `${label}: ${publicIssueStatusLabel(status)}.${updateText}`;
}

function summarizeInputHealthAgentIssues(agentCode, health) {
  const issues = Array.isArray(health?.issues) ? health.issues : [];
  if (!issues.length) return "No active issues recorded.";
  const orderedIssues = issues.slice().sort((left, right) => {
    const priority = (value) => {
      const status = String(value?.status || "").toUpperCase();
      if (status === "SOURCE_UNAVAILABLE") return 0;
      if (status === "STALE") return 1;
      if (status === "MISSING" || status === "PLACEHOLDER") return 2;
      if (status === "PARTIAL") return 3;
      return 4;
    };
    return priority(left) - priority(right);
  });
  return formatPublicIssueSummary(orderedIssues[0]);
}

function formatAgeOrUnavailable(value) {
  const age = formatRelativeAge(value);
  return age || "Unavailable";
}

function durationPhraseFromSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  if (minutes < 60) return remainderSeconds ? `${minutes}m ${remainderSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return remainderMinutes ? `${hours}h ${remainderMinutes}m` : `${hours}h`;
}

function buildPublicationSyncModel(layer1PublishedAt, layer2PublishedAt) {
  const layer1Ms = parseTimestamp(layer1PublishedAt);
  const layer2Ms = parseTimestamp(layer2PublishedAt);
  if (!Number.isFinite(layer1Ms) && !Number.isFinite(layer2Ms)) {
    return {
      tone: "warning",
      label: "Unavailable",
      detail: "No published Layer 1 or Layer 2 timestamps are currently available."
    };
  }
  if (Number.isFinite(layer1Ms) && !Number.isFinite(layer2Ms)) {
    return {
      tone: "warning",
      label: "Layer 2 unavailable",
      detail: "Layer 1 is published, but no Layer 2 publish timestamp is available yet."
    };
  }
  if (!Number.isFinite(layer1Ms) && Number.isFinite(layer2Ms)) {
    return {
      tone: "warning",
      label: "Layer 1 unavailable",
      detail: "Layer 2 is published, but no Layer 1 publish timestamp is available yet."
    };
  }

  const diffSeconds = Math.abs(layer1Ms - layer2Ms) / 1000;
  if (diffSeconds <= 180) {
    return {
      tone: "success",
      label: "In sync",
      detail: `Layer 1 and Layer 2 published within ${durationPhraseFromSeconds(diffSeconds)} of each other.`
    };
  }

  if (layer1Ms > layer2Ms) {
    return {
      tone: "warning",
      label: "Layer 2 lagging",
      detail: `Layer 1 is newer than Layer 2 by ${durationPhraseFromSeconds(diffSeconds)}.`
    };
  }

  return {
    tone: "warning",
    label: "Layer 2 ahead",
    detail: `Layer 2 is newer than Layer 1 by ${durationPhraseFromSeconds(diffSeconds)}.`
  };
}

function buildPublicationCatchupModel(latestRunFinished, layer1PublishedAt, layer2PublishedAt) {
  const finishedMs = parseTimestamp(latestRunFinished);
  if (!Number.isFinite(finishedMs)) {
    return {
      tone: "warning",
      label: "Workflow finish unavailable",
      detail: "The dashboard cannot compare publication timing because the latest workflow finish timestamp is missing."
    };
  }

  const layer1Ms = parseTimestamp(layer1PublishedAt);
  const layer2Ms = parseTimestamp(layer2PublishedAt);
  const staleThresholdSeconds = 180;
  const layer1CaughtUp = Number.isFinite(layer1Ms) && layer1Ms >= (finishedMs - (staleThresholdSeconds * 1000));
  const layer2CaughtUp = Number.isFinite(layer2Ms) && layer2Ms >= (finishedMs - (staleThresholdSeconds * 1000));

  if (layer1CaughtUp && layer2CaughtUp) {
    return {
      tone: "success",
      label: "Publication caught up",
      detail: "Both published call layers are at or beyond the latest recorded workflow finish."
    };
  }

  if (layer1CaughtUp && !layer2CaughtUp) {
    return {
      tone: "warning",
      label: "Layer 2 still behind",
      detail: "Layer 1 caught up to the latest workflow finish, but Layer 2 still appears older."
    };
  }

  if (!layer1CaughtUp && layer2CaughtUp) {
    return {
      tone: "warning",
      label: "Layer 1 still behind",
      detail: "Layer 2 caught up to the latest workflow finish, but Layer 1 still appears older."
    };
  }

  return {
    tone: "warning",
    label: "Publication behind workflow",
    detail: "The latest published call timestamps still predate the latest workflow finish."
  };
}

function buildFreshnessVerdictModel(layer1PublishedAt, layer2PublishedAt, publicationSync, publicationCatchup) {
  const layer1Ms = parseTimestamp(layer1PublishedAt);
  const layer2Ms = parseTimestamp(layer2PublishedAt);

  if (!Number.isFinite(layer1Ms) && !Number.isFinite(layer2Ms)) {
    return {
      tone: "warning",
      label: "No live publish window",
      detail: "Neither Layer 1 nor Layer 2 currently exposes a publish timestamp."
    };
  }

  if (!Number.isFinite(layer1Ms) || !Number.isFinite(layer2Ms)) {
    return {
      tone: "warning",
      label: "Partial publish window",
      detail: publicationSync.detail
    };
  }

  if (publicationSync.tone === "success" && publicationCatchup.tone === "success") {
    return {
      tone: "success",
      label: "Both layers live",
      detail: "Layer 1 and Layer 2 are aligned to the same publish window and caught up to the latest workflow finish."
    };
  }

  if (publicationSync.tone === "warning") {
    return {
      tone: "warning",
      label: "Mixed publish window",
      detail: publicationSync.detail
    };
  }

  return {
    tone: publicationCatchup.tone,
    label: "Older publish window",
    detail: publicationCatchup.detail
  };
}

function buildLayerFreshnessModel(layerLabel, publishedAt, siblingLabel, siblingPublishedAt, latestRunFinished) {
  const publishedMs = parseTimestamp(publishedAt);
  const siblingMs = parseTimestamp(siblingPublishedAt);
  const finishedMs = parseTimestamp(latestRunFinished);
  const toleranceSeconds = 180;

  if (!Number.isFinite(publishedMs)) {
    return {
      tone: "warning",
      label: "Unavailable",
      value: "Unavailable",
      detail: `No published ${layerLabel} timestamp is currently available.`
    };
  }

  let tone = "success";
  let label = "Aligned";
  const detailParts = [`Published ${formatDashboardTime(publishedAt)}.`, `${formatAgeOrUnavailable(publishedAt)}.`];

  if (Number.isFinite(siblingMs)) {
    const diffSeconds = Math.abs(publishedMs - siblingMs) / 1000;
    if (diffSeconds <= toleranceSeconds) {
      detailParts.push(`Within ${durationPhraseFromSeconds(diffSeconds)} of ${siblingLabel}.`);
    } else if (publishedMs > siblingMs) {
      tone = "neutral";
      label = `Newer than ${siblingLabel}`;
      detailParts.push(`${layerLabel} is newer by ${durationPhraseFromSeconds(diffSeconds)}.`);
    } else {
      tone = "warning";
      label = `Older than ${siblingLabel}`;
      detailParts.push(`${layerLabel} is older by ${durationPhraseFromSeconds(diffSeconds)}.`);
    }
  } else {
    tone = "neutral";
    label = `${siblingLabel} unavailable`;
    detailParts.push(`${siblingLabel} does not currently expose a publish timestamp.`);
  }

  if (Number.isFinite(finishedMs)) {
    const workflowLagSeconds = (finishedMs - publishedMs) / 1000;
    if (workflowLagSeconds > toleranceSeconds) {
      tone = "warning";
      label = "Behind workflow";
      detailParts.push(`Still predates the latest workflow finish by ${durationPhraseFromSeconds(workflowLagSeconds)}.`);
    } else {
      detailParts.push("Caught up to the latest workflow finish.");
    }
  }

  return {
    tone,
    label,
    value: formatDashboardTime(publishedAt),
    detail: detailParts.join(" ")
  };
}

function buildOverviewStatusModel() {
  const inputStatus = String(inputHealthData?.overall_status || "UNKNOWN").toUpperCase();
  const economicSourceStatus = getEconomicSourceStatus();
  const layer1PublishedAt = getLayer1PublishedAt();
  const layer2PublishedAt = getLayer2PublishedAt();
  const publicationSync = buildPublicationSyncModel(layer1PublishedAt, layer2PublishedAt);
  const publicationCatchup = buildPublicationCatchupModel(workflowStatus?.last_run_finished_at || null, layer1PublishedAt, layer2PublishedAt);
  const freshnessVerdict = buildFreshnessVerdictModel(layer1PublishedAt, layer2PublishedAt, publicationSync, publicationCatchup);
  const healthArtifactBehind = isArtifactBehindCurrentCalls(inputHealthData?.generated_at, layer1PublishedAt);
  const economicArtifactBehind = isArtifactBehindCurrentCalls(
    economicEventRefreshData?.generated_at || economicEventsSourceData?.generated_at,
    layer1PublishedAt
  );
  const retainedCalls = callsRemainVisible();
  const latestRunFinished = workflowStatus?.last_run_finished_at || null;
  const latestSuccessfulRun = workflowStatus?.status === "success"
    ? workflowStatus?.last_run_finished_at
    : workflowStatus?.last_successful_run_finished_at || null;
  const affectedAgents = Object.entries(inputHealthData?.agents || {})
    .filter(([, health]) => String(health?.overall_status || "").toUpperCase() !== "HEALTHY")
    .map(([agent]) => agent);
  const issueCards = [];

  let tone = "success";
  let badge = "HEALTHY";
  let title = "System working normally";
  let summary = "All critical inputs are available and the latest refresh completed successfully.";

  if (workflowFailed()) {
    tone = "critical";
    badge = "REFRESH FAILED";
    title = "Latest refresh failed";
    summary = retainedCalls
      ? "The latest refresh failed. The dashboard is still showing the most recently published calls."
      : "The latest refresh failed and no current published calls are available to show.";
    const failure = getWorkflowFailureSummary();
    issueCards.push({
      label: failure.failedStep,
      status: "REFRESH FAILED",
      detail: failure.reason
    });
  } else if (economicSourceStatus === "SOURCE_UNAVAILABLE" || inputStatus === "CRITICAL") {
    tone = "critical";
    badge = "CRITICAL";
    title = "Needs review";
    summary = retainedCalls
      ? "Critical trading inputs are unavailable or stale. Current published calls remain visible, but they should be treated with caution."
      : "Critical trading inputs are unavailable and current published calls are not available.";
  } else if (inputStatus === "DEGRADED" || inputStatus === "DATA_UNAVAILABLE" || healthArtifactBehind || economicArtifactBehind) {
    tone = "warning";
    badge = "NEEDS REVIEW";
    title = "Needs review";
    summary = retainedCalls
      ? "One or more inputs are degraded or not fully verified for the current calls. Current published calls remain visible."
      : "Input evidence is degraded and there are no current published calls to verify.";
  }

  if (economicSourceStatus === "SOURCE_UNAVAILABLE") {
    issueCards.push({
      label: "Economic events",
      status: "SOURCE UNAVAILABLE",
      detail: getEconomicSourceWarning() || "Economic-event source coverage is currently unavailable."
    });
  }

  if (healthArtifactBehind) {
    issueCards.push({
      label: "Input health snapshot",
      status: "STALE",
      detail: "The published input-health snapshot predates the current Layer 1 calls."
    });
  }

  if (economicArtifactBehind) {
    issueCards.push({
      label: "Economic-event snapshot",
      status: "STALE",
      detail: "The published economic-event warning snapshot predates the current Layer 1 calls."
    });
  }

  if (publicationSync.tone === "warning") {
    issueCards.push({
      label: "Layer 1 / Layer 2 publication",
      status: publicationSync.label.toUpperCase(),
      detail: publicationSync.detail
    });
  }

  if (publicationCatchup.tone === "warning") {
    issueCards.push({
      label: "Workflow publication catch-up",
      status: publicationCatchup.label.toUpperCase(),
      detail: publicationCatchup.detail
    });
  }

  for (const agent of affectedAgents.slice(0, 5)) {
    issueCards.push({
      label: agent === "GOLD" ? "Gold" : agent,
      status: inputHealthData?.agents?.[agent]?.overall_status || "UNKNOWN",
      detail: summarizeInputHealthAgentIssues(agent, inputHealthData?.agents?.[agent])
    });
  }

  return {
    tone,
    badge,
    title,
    summary,
    retainedCalls,
    latestRunFinished,
    latestSuccessfulRun,
    latestPublishedLayer1: layer1PublishedAt,
    latestPublishedLayer2: layer2PublishedAt,
    layer1Age: formatAgeOrUnavailable(layer1PublishedAt),
    layer2Age: formatAgeOrUnavailable(layer2PublishedAt),
    freshnessVerdict,
    layer1Freshness: buildLayerFreshnessModel("Layer 1", layer1PublishedAt, "Layer 2", layer2PublishedAt, latestRunFinished),
    layer2Freshness: buildLayerFreshnessModel("Layer 2", layer2PublishedAt, "Layer 1", layer1PublishedAt, latestRunFinished),
    publicationSync,
    publicationCatchup,
    economicSourceStatus,
    issueCards: issueCards.slice(0, 6)
  };
}

function renderOverviewStatusPanel() {
  const container = document.getElementById("overviewStatusPanel");
  if (!container) return;

  const model = buildOverviewStatusModel();
  const latestSuccessfulLabel = model.latestSuccessfulRun
    ? formatDashboardTime(model.latestSuccessfulRun)
    : "Not published";
  const latestFinishedLabel = model.latestRunFinished
    ? formatDashboardTime(model.latestRunFinished)
    : "Not published";
  const callsMessage = model.retainedCalls
    ? "Published Layer 1 and Layer 2 calls remain visible."
    : "Published calls are currently unavailable.";

  container.innerHTML = `
    <div class="overview-status-shell ${escapeHtml(model.tone)}" data-overview-status="true" data-overview-status-tone="${escapeHtml(model.tone)}">
      <div class="overview-status-head">
        <div>
          <p class="eyebrow">Overview</p>
          <h3>SYSTEM STATUS</h3>
        </div>
        <span class="overview-status-badge ${escapeHtml(model.tone)}">${escapeHtml(model.badge)}</span>
      </div>
      <div class="overview-status-copy">
        <strong>${escapeHtml(model.title)}</strong>
        <p>${escapeHtml(model.summary)}</p>
        <p>${escapeHtml(callsMessage)}</p>
      </div>
      <div class="overview-status-actions">
        <a class="overview-status-link" href="standing-dashboard.html">Open standing dashboard</a>
        <a class="overview-status-link" href="project-progress-log.md">Open progress log</a>
      </div>
      <div class="overview-status-metrics">
        <div><strong>Latest refresh</strong><span>${escapeHtml(latestFinishedLabel)}</span></div>
        <div><strong>Last successful refresh</strong><span>${escapeHtml(latestSuccessfulLabel)}</span></div>
        <div><strong>Input health</strong><span>${escapeHtml(inputHealthStatusLabel(inputHealthData?.overall_status || "UNKNOWN"))}</span></div>
        <div><strong>Layer 1 calls</strong><span>${escapeHtml(model.latestPublishedLayer1 ? formatDashboardTime(model.latestPublishedLayer1) : "Unavailable")}</span></div>
        <div><strong>Layer 2 calls</strong><span>${escapeHtml(model.latestPublishedLayer2 ? formatDashboardTime(model.latestPublishedLayer2) : "Unavailable")}</span></div>
        <div><strong>Economic-event source</strong><span>${escapeHtml(publicIssueStatusLabel(model.economicSourceStatus))}</span></div>
        <div><strong>Affected agents</strong><span>${escapeHtml(String(Object.keys(inputHealthData?.agents || {}).filter((agent) => String(inputHealthData?.agents?.[agent]?.overall_status || "").toUpperCase() !== "HEALTHY").length))}</span></div>
        <div><strong>Layer 1 age</strong><span>${escapeHtml(model.layer1Age)}</span></div>
        <div><strong>Layer 2 age</strong><span>${escapeHtml(model.layer2Age)}</span></div>
      </div>
      <div class="overview-status-liveops">
        <article class="overview-status-liveops-card ${escapeHtml(model.freshnessVerdict.tone)}">
          <strong>Freshness verdict</strong>
          <span>${escapeHtml(model.freshnessVerdict.label)}</span>
          <p>${escapeHtml(model.freshnessVerdict.detail)}</p>
        </article>
        <article class="overview-status-liveops-card ${escapeHtml(model.layer1Freshness.tone)}">
          <strong>Layer 1 publish</strong>
          <span>${escapeHtml(model.layer1Freshness.value)}</span>
          <p>${escapeHtml(model.layer1Freshness.label)}. ${escapeHtml(model.layer1Freshness.detail)}</p>
        </article>
        <article class="overview-status-liveops-card ${escapeHtml(model.layer2Freshness.tone)}">
          <strong>Layer 2 publish</strong>
          <span>${escapeHtml(model.layer2Freshness.value)}</span>
          <p>${escapeHtml(model.layer2Freshness.label)}. ${escapeHtml(model.layer2Freshness.detail)}</p>
        </article>
        <article class="overview-status-liveops-card ${escapeHtml(model.publicationSync.tone)}">
          <strong>Layer 1 / Layer 2 sync</strong>
          <span>${escapeHtml(model.publicationSync.label)}</span>
          <p>${escapeHtml(model.publicationSync.detail)}</p>
        </article>
        <article class="overview-status-liveops-card ${escapeHtml(model.publicationCatchup.tone)}">
          <strong>Workflow to publish</strong>
          <span>${escapeHtml(model.publicationCatchup.label)}</span>
          <p>${escapeHtml(model.publicationCatchup.detail)}</p>
        </article>
      </div>
      ${model.issueCards.length ? `
        <div class="overview-status-issues">
          ${model.issueCards.map((issue) => `
            <article class="overview-status-issue">
              <div class="overview-status-issue-head">
                <strong>${escapeHtml(issue.label)}</strong>
                <span>${escapeHtml(publicIssueStatusLabel(issue.status))}</span>
              </div>
              <p>${escapeHtml(issue.detail)}</p>
            </article>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function economicEventStateLabel(state = "") {
  const labelsByState = {
    DATA_UNAVAILABLE: "DATA UNAVAILABLE",
    UNKNOWN: "UNKNOWN",
    SOURCE_UNAVAILABLE: "ECONOMIC EVENT DATA UNAVAILABLE",
    STALE_SOURCE: "ECONOMIC EVENT DATA STALE",
    INVALID_SOURCE: "ECONOMIC EVENT DATA INVALID",
    NO_MAJOR_EVENTS: "NO MAJOR EVENTS",
    UPCOMING: "UPCOMING",
    EVENT_IMMINENT: "EVENT IMMINENT",
    REFRESH_REQUIRED: "REFRESH REQUIRED",
    PARTIALLY_REFRESHED: "PARTIALLY REFRESHED",
    CLEARED: "CLEARED",
    REFRESH_EVIDENCE_UNAVAILABLE: "REFRESH EVIDENCE UNAVAILABLE",
    INVALID_EVENT_TIME: "INVALID EVENT TIME"
  };
  return labelsByState[state] || "UNKNOWN";
}

function economicEventStateTone(state = "") {
  if (state === "DATA_UNAVAILABLE") return "data-warning";
  if (state === "SOURCE_UNAVAILABLE") return "data-warning";
  if (state === "STALE_SOURCE") return "warning";
  if (state === "INVALID_SOURCE") return "data-warning";
  if (state === "REFRESH_EVIDENCE_UNAVAILABLE" || state === "INVALID_EVENT_TIME") return "data-warning";
  if (state === "REFRESH_REQUIRED") return "critical";
  if (state === "PARTIALLY_REFRESHED" || state === "EVENT_IMMINENT") return "warning";
  if (state === "UPCOMING") return "upcoming";
  if (state === "CLEARED") return "cleared";
  return "neutral";
}

function warningModuleIndicatorLabel(artifact, type) {
  const sourceRunId = artifact?.source_run_id;
  if (!sourceRunId) return "RUN-LINK EVIDENCE UNAVAILABLE";
  if (String(artifact?.consistency_status || "").toUpperCase() !== "MATCHED") return "HEALTH EVIDENCE MISMATCHED";
  if (type === "economic" && String(artifact?.event_source?.name || "").toLowerCase().includes("unverified")) {
    return "SOURCE COVERAGE DEGRADED";
  }
  return "";
}

function formatWarningValue(value, fallback = "Unavailable") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function uniqueAgentList(values = []) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value).toUpperCase())));
}

function renderWarningModuleIndicator(label) {
  if (!label) return "";
  return `<span class="warning-module-indicator">${escapeHtml(label)}</span>`;
}

function economicEventAgentLabel(agentCode = "") {
  const normalized = String(agentCode || "").toUpperCase();
  if (normalized === "GOLD") return "Gold";
  return normalized;
}

function joinEconomicEventAgentLabels(agents = []) {
  return agents.map((agent) => economicEventAgentLabel(agent.agent || agent)).join(", ");
}

function economicEventWarningLabel(code = "") {
  const labelsByCode = {
    no_source_rows_available: "No economic event source rows are present in the current published snapshot.",
    artifact_unavailable: "The dashboard could not load the published economic-event refresh artifact.",
    ambiguous_source_timezone: "At least one event row has an ambiguous source timezone and was excluded.",
    missing_source_date: "At least one event row is missing its source date.",
    invalid_source_date: "At least one event row contains an invalid source date.",
    ambiguous_time_text: "At least one event row has a non-deterministic release time.",
    missing_time_text: "At least one event row is missing its release time."
  };
  return labelsByCode[code] || code.replaceAll("_", " ");
}

function formatEconomicEventEvidenceTimestamp(value) {
  if (!value) return "Unavailable";
  return formatDashboardTime(value);
}

function describeEconomicEventState(event) {
  const displayTimeUk = event?.display_times?.uk || "an unknown UK time";
  const requiredAgents = (event?.affected_agents || []).filter((agent) => agent.refresh_required);
  const requiredAgentLabels = joinEconomicEventAgentLabels(requiredAgents);
  const refreshedAgents = requiredAgents.filter((agent) => agent.refresh_state === "CLEARED");
  const pendingAgents = requiredAgents.filter((agent) => agent.refresh_state === "REFRESH_REQUIRED");
  const evidenceUnavailableAgents = requiredAgents.filter((agent) => agent.refresh_state === "REFRESH_EVIDENCE_UNAVAILABLE");

  switch (event?.state) {
    case "UPCOMING":
      return `Current affected calls predate this release. Refresh ${requiredAgentLabels} after the event.`;
    case "EVENT_IMMINENT":
      return `This release is within the next ${economicEventRefreshData?.summary?.imminent_threshold_minutes || 60} minutes. Refresh ${requiredAgentLabels} after the event boundary.`;
    case "REFRESH_REQUIRED":
      return `The event passed at ${displayTimeUk}. None of the required affected agents has published a qualifying post-event output yet.`;
    case "PARTIALLY_REFRESHED":
      return `The event passed at ${displayTimeUk}. Some affected agents have refreshed, but the warning remains active until all required agents clear the boundary.`;
    case "CLEARED":
      return `All refresh-required affected agents have published a successful output at or after the event boundary.`;
    case "REFRESH_EVIDENCE_UNAVAILABLE":
      return `The event time is valid, but at least one required agent lacks enough successful-output evidence for a trustworthy comparison.`;
    case "INVALID_EVENT_TIME":
      return `This event row could not be assigned a trustworthy canonical UTC timestamp and is excluded from ordinary refresh comparisons.`;
    default:
      if (evidenceUnavailableAgents.length) {
        return `Refresh evidence is unavailable for ${joinEconomicEventAgentLabels(evidenceUnavailableAgents)}.`;
      }
      if (pendingAgents.length) {
        return `${joinEconomicEventAgentLabels(pendingAgents)} still requires a post-event refresh.`;
      }
      if (refreshedAgents.length) {
        return `${joinEconomicEventAgentLabels(refreshedAgents)} has already refreshed after the event.`;
      }
      return "No additional event refresh detail is available.";
  }
}

function buildWorkflowRuntimeProfileFallback() {
  return {
    version: "2026-08-01-prod13",
    workflow_id: "X75RKU34ikiM5RMU",
    sample_count: 13,
    percentiles_seconds: {
      median: 296.103,
      p75: 317.972,
      p80: 318.2,
      p90: 325.913,
      p95: 333.783,
      max: 342.754
    }
  };
}

function readStoredWorkflowRefreshState() {
  if (!storageAvailable()) return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(workflowRefreshStateKey) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    console.warn("Could not read workflow refresh state", err);
    return null;
  }
}

function isTerminalWorkflowRefreshPhase(phase = "") {
  return ["association_unverified", "incomplete", "verification_expired", "failed_dispatch", "failed", "complete", "published"].includes(String(phase || "").toLowerCase());
}

function writeStoredWorkflowRefreshState(state) {
  workflowRefreshState = state || null;
  if (!storageAvailable()) return;

  try {
    if (state) {
      window.localStorage.setItem(workflowRefreshStateKey, JSON.stringify(state));
    } else {
      window.localStorage.removeItem(workflowRefreshStateKey);
    }
  } catch (err) {
    console.warn("Could not save workflow refresh state", err);
  }
}

function currentWorkflowMarkers() {
  return {
    workflow_finished_at: workflowStatus?.last_run_finished_at || null,
    workflow_started_at: workflowStatus?.last_run_started_at || null,
    workflow_status: workflowStatus?.status || null,
    workflow_failed_step: workflowStatus?.failed_step || workflowStatus?.error?.step || null,
    workflow_error_reason: workflowStatus?.error?.reason || null,
    workflow_refresh_request_id: workflowStatus?.refresh_request_id || workflowStatus?.request_id || null,
    workflow_source_run_id: workflowStatus?.source_run_id || null,
    layer1_generated_at: getLayer1PublishedAt(layer1Data),
    layer1_refresh_request_id: layer1Data?.refresh_request_id || layer1Data?.request_id || null,
    layer1_source_run_id: layer1Data?.source_run_id || null,
    layer2_generated_at: getLayer2PublishedAt(layer2Data),
    layer2_refresh_request_id: layer2Data?.refresh_request_id || layer2Data?.request_id || null,
    layer2_source_run_id: layer2Data?.source_run_id || null
  };
}

function isTimestampAfter(reference, candidate) {
  const referenceMs = parseTimestamp(reference);
  const candidateMs = parseTimestamp(candidate);
  return Number.isFinite(referenceMs) && Number.isFinite(candidateMs) && candidateMs > referenceMs;
}

function markerChanged(baselineValue, currentValue) {
  return Boolean(currentValue) && currentValue !== (baselineValue || null);
}

function buildWorkflowMarkerDelta(baseline = {}, current = {}, requestedAt = "") {
  return {
    workflowFinishedFresh: markerChanged(baseline.workflow_finished_at, current.workflow_finished_at)
      && isTimestampAfter(requestedAt, current.workflow_finished_at),
    workflowStartedFresh: markerChanged(baseline.workflow_started_at, current.workflow_started_at)
      && isTimestampAfter(requestedAt, current.workflow_started_at),
    layer1Fresh: markerChanged(baseline.layer1_generated_at, current.layer1_generated_at)
      && isTimestampAfter(requestedAt, current.layer1_generated_at),
    layer2Fresh: markerChanged(baseline.layer2_generated_at, current.layer2_generated_at)
      && isTimestampAfter(requestedAt, current.layer2_generated_at)
  };
}

function isFailedWorkflowStatus(status = "") {
  return ["failed", "failure", "error"].includes(String(status || "").toLowerCase());
}

function listWorkflowFreshArtifacts(delta = {}) {
  const fresh = [];
  const missing = [];
  [
    ["workflowFinishedFresh", "workflow status"],
    ["layer1Fresh", "Layer 1"],
    ["layer2Fresh", "Layer 2"]
  ].forEach(([key, label]) => {
    if (delta[key]) {
      fresh.push(label);
    } else {
      missing.push(label);
    }
  });
  return { fresh, missing };
}

function workflowRunIdsConsistent(current = {}) {
  const runIds = [
    current.workflow_source_run_id,
    current.layer1_source_run_id,
    current.layer2_source_run_id
  ].map((value) => String(value || "").trim()).filter(Boolean);
  return runIds.length <= 1 || runIds.every((value) => value === runIds[0]);
}

function buildWorkflowFailureSignal(state, current, delta, baseline) {
  const requestId = String(state?.refresh_request_id || "").trim();
  const workflowFailedFresh = markerChanged(baseline.workflow_finished_at, current.workflow_finished_at)
    && isTimestampAfter(state?.requested_at, current.workflow_finished_at)
    && isFailedWorkflowStatus(current.workflow_status);

  if (!workflowFailedFresh) {
    return {
      observed: false,
      exactAssociation: false,
      relevantPartialPublication: false
    };
  }

  return {
    observed: true,
    exactAssociation: Boolean(requestId) && hasExactRefreshAssociation(state, current),
    relevantPartialPublication: Boolean(delta.layer1Fresh || delta.layer2Fresh || delta.workflowStartedFresh),
    failedStep: current.workflow_failed_step || null,
    reason: current.workflow_error_reason || null
  };
}

function activeWorkflowRefreshBlocksNewRequest(state = workflowRefreshState) {
  return Boolean(state && !isTerminalWorkflowRefreshPhase(state.phase));
}

function clearWorkflowRefreshPollingTimer() {
  if (workflowRefreshRenderTimer) {
    clearInterval(workflowRefreshRenderTimer);
    workflowRefreshRenderTimer = null;
  }
}

function ensureWorkflowRefreshRenderTimer() {
  if (workflowRefreshRenderTimer) return;
  workflowRefreshRenderTimer = setInterval(() => renderWorkflowStatus(workflowStatus), 1000);
}

function getRuntimeProfilePercentileSeconds(key, fallback = null) {
  const value = Number(workflowRuntimeProfile?.percentiles_seconds?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function workflowRefreshElapsedSeconds(requestedAt) {
  const requestedMs = parseTimestamp(requestedAt);
  if (!Number.isFinite(requestedMs)) return 0;
  return Math.max(0, (Date.now() - requestedMs) / 1000);
}

function formatDurationClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function getWorkflowRefreshHardExpirySeconds() {
  const observedMax = getRuntimeProfilePercentileSeconds("max", 342.754);
  const observedP95 = getRuntimeProfilePercentileSeconds("p95", observedMax);
  const observedMedian = getRuntimeProfilePercentileSeconds("median", observedMax);
  return Math.max(
    1800,
    Math.ceil(observedMax * 3),
    Math.ceil(observedP95 + 900),
    Math.ceil(observedMedian + 1200)
  );
}

function captureWorkflowRefreshBaseline() {
  return currentWorkflowMarkers();
}

function hasExactRefreshAssociation(state, current = currentWorkflowMarkers()) {
  const requestId = String(state?.refresh_request_id || "").trim();
  if (!requestId) return false;
  const candidates = [
    current.workflow_refresh_request_id,
    current.layer1_refresh_request_id,
    current.layer2_refresh_request_id
  ].map((value) => String(value || "").trim()).filter(Boolean);
  return candidates.includes(requestId);
}

function workflowRefreshTerminalMarkersAdvanced(state, current = currentWorkflowMarkers()) {
  const observed = state?.observed_markers || {};
  const fallbackReference = state?.last_updated_at || state?.requested_at || null;
  return [
    [observed.workflow_finished_at || fallbackReference, current.workflow_finished_at],
    [observed.workflow_started_at || fallbackReference, current.workflow_started_at]
  ].some(([reference, candidate]) => isTimestampAfter(reference, candidate));
}

function shouldRetireStoredWorkflowRefreshState(state, current = currentWorkflowMarkers()) {
  if (!state || !isTerminalWorkflowRefreshPhase(state.phase)) return false;
  if (hasExactRefreshAssociation(state, current)) return false;
  return workflowRefreshTerminalMarkersAdvanced(state, current);
}

function reconcileWorkflowRefreshState() {
  const state = workflowRefreshState;
  if (!state) {
    clearWorkflowRefreshPollingTimer();
    return null;
  }

  const baseline = state.baseline || {};
  const current = currentWorkflowMarkers();
  if (shouldRetireStoredWorkflowRefreshState(state, current)) {
    writeStoredWorkflowRefreshState(null);
    clearWorkflowRefreshPollingTimer();
    return null;
  }
  const delta = buildWorkflowMarkerDelta(baseline, current, state.requested_at);
  const elapsedSeconds = workflowRefreshElapsedSeconds(state.requested_at);
  const delayedThreshold = getRuntimeProfilePercentileSeconds("p75", 317.972);
  const hardExpirySeconds = getWorkflowRefreshHardExpirySeconds();
  const anyFresh = delta.workflowFinishedFresh || delta.workflowStartedFresh || delta.layer1Fresh || delta.layer2Fresh;
  const allFresh = delta.workflowFinishedFresh && delta.layer1Fresh && delta.layer2Fresh;
  const exactAssociation = hasExactRefreshAssociation(state, current);
  const freshArtifacts = listWorkflowFreshArtifacts(delta);
  const consistentRunIds = workflowRunIdsConsistent(current);
  const failureSignal = buildWorkflowFailureSignal(state, current, delta, baseline);
  let nextPhase = state.phase || "sending";

  if (state.phase === "failed_dispatch") {
    nextPhase = "failed_dispatch";
  } else if (failureSignal.observed && (failureSignal.exactAssociation || failureSignal.relevantPartialPublication)) {
    nextPhase = "failed";
  } else if (exactAssociation && allFresh && consistentRunIds) {
    nextPhase = "complete";
  } else if (delta.layer1Fresh) {
    nextPhase = "published";
  } else if (elapsedSeconds > hardExpirySeconds) {
    if (allFresh) {
      nextPhase = "association_unverified";
    } else {
      nextPhase = freshArtifacts.fresh.length ? "incomplete" : "verification_expired";
    }
  } else if (anyFresh) {
    nextPhase = allFresh ? "association_unverified" : "publishing";
  } else if (workflowStatusLoadError) {
    nextPhase = "status_unavailable";
  } else if (elapsedSeconds > delayedThreshold) {
    nextPhase = "delayed";
  } else if (state.phase === "sending") {
    nextPhase = "accepted";
  } else if (!state.phase || state.phase === "pending") {
    nextPhase = "accepted";
  }

  const updated = {
    ...state,
    phase: nextPhase,
    last_updated_at: new Date().toISOString(),
    observed_markers: current,
    fresh_artifacts: freshArtifacts.fresh,
    missing_artifacts: freshArtifacts.missing,
    workflow_failure: failureSignal.observed ? {
      failed_step: failureSignal.failedStep || null,
      reason: failureSignal.reason || null,
      exact_association: failureSignal.exactAssociation,
      relevant_partial_publication: failureSignal.relevantPartialPublication
    } : null
  };

  if (nextPhase !== state.phase) {
    writeStoredWorkflowRefreshState(updated);
  } else {
    workflowRefreshState = updated;
  }

  if (isTerminalWorkflowRefreshPhase(updated.phase)) {
    clearWorkflowRefreshPollingTimer();
  } else {
    ensureWorkflowRefreshRenderTimer();
  }

  return updated;
}

function restoreWorkflowRefreshState() {
  workflowRefreshState = readStoredWorkflowRefreshState();
  if (activeWorkflowRefreshBlocksNewRequest()) {
    ensureWorkflowRefreshRenderTimer();
  }
  return workflowRefreshState;
}

function renderEconomicEventAgentLine(title, agents, className = "") {
  if (!agents.length) return "";
  return `
    <div class="economic-event-agent-line ${className}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(joinEconomicEventAgentLabels(agents))}</span>
    </div>
  `;
}

function renderEconomicEventEvidenceList(agents) {
  if (!agents.length) return "";
  return `
    <div class="economic-event-evidence-list">
      ${agents.map((agent) => `
        <div class="economic-event-evidence-chip">
          <strong>${escapeHtml(economicEventAgentLabel(agent.agent))}</strong>
          <span>${escapeHtml(formatEconomicEventEvidenceTimestamp(agent.latest_successful_output_timestamp))}</span>
          <small>${escapeHtml(agent.latest_successful_output_timestamp_source === "generated_at" ? "generated_at fallback" : "sealed_at")}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function renderEconomicEventCard(event) {
  const tone = economicEventStateTone(event.state);
  const requiredAgents = (event.affected_agents || []).filter((agent) => agent.refresh_required);
  const refreshedAgents = requiredAgents.filter((agent) => agent.refresh_state === "CLEARED");
  const pendingAgents = requiredAgents.filter((agent) => agent.refresh_state === "REFRESH_REQUIRED");
  const evidenceUnavailableAgents = requiredAgents.filter((agent) => agent.refresh_state === "REFRESH_EVIDENCE_UNAVAILABLE");
  const impactLabel = event.impact || `Impact ${event.impact_rank || "--"}`;
  const marketLabel = [event.currency, event.region].filter(Boolean).join(" / ") || "Unspecified market";
  const componentSummary = (event.component_event_names || []).length > 1
    ? `Grouped release: ${event.component_event_names.join(", ")}.`
    : "";

  return `
    <article class="economic-event-card ${escapeHtml(tone)}" data-economic-event-card="true" data-economic-event-state="${escapeHtml(event.state)}">
      <div class="economic-event-card-head">
        <div>
          <p class="eyebrow">Economic Event Refresh Watch</p>
          <h3>${escapeHtml(event.event_name || "Economic event")}</h3>
        </div>
        <span class="economic-event-status-badge ${escapeHtml(tone)}">${escapeHtml(economicEventStateLabel(event.state))}</span>
      </div>
      <div class="economic-event-meta">
        <span><strong>UK:</strong> ${escapeHtml(event.display_times?.uk || "Unavailable")}</span>
        <span><strong>ET:</strong> ${escapeHtml(event.display_times?.et || "Unavailable")}</span>
        <span><strong>Market:</strong> ${escapeHtml(marketLabel)}</span>
        <span><strong>Impact:</strong> ${escapeHtml(impactLabel)}</span>
      </div>
      <p class="economic-event-copy">${escapeHtml(describeEconomicEventState(event))}</p>
      ${componentSummary ? `<p class="economic-event-subcopy">${escapeHtml(componentSummary)}</p>` : ""}
      <div class="economic-event-agent-grid">
        ${renderEconomicEventAgentLine("Refresh required", requiredAgents)}
        ${renderEconomicEventAgentLine("Still waiting", pendingAgents, "critical")}
        ${renderEconomicEventAgentLine("Already refreshed", refreshedAgents, "cleared")}
        ${renderEconomicEventAgentLine("Evidence unavailable", evidenceUnavailableAgents, "data-warning")}
      </div>
      ${refreshedAgents.length ? renderEconomicEventEvidenceList(refreshedAgents) : ""}
      ${(event.data_quality_warnings || []).length ? `
        <div class="economic-event-warning-list">
          ${(event.data_quality_warnings || []).map((warning) => `<span>${escapeHtml(economicEventWarningLabel(warning))}</span>`).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderEconomicEventRefreshPanel() {
  const container = document.getElementById("economicEventRefreshPanel");
  if (!container) return;

  const artifact = economicEventRefreshData || createEconomicEventRefreshFallback();
  const summary = artifact.summary || {};
  const events = Array.isArray(artifact.events) ? artifact.events : [];
  const warnings = Array.isArray(summary.data_quality_warnings) ? summary.data_quality_warnings : [];
  const fallbackUnavailable = artifact.fallback_kind === "artifact_unavailable";
  const sourceStatus = economicEventsSourceData?.source?.source_status
    || artifact?.event_source?.source_status
    || inputHealthData?.sources?.economic_events?.data_status
    || "";
  const sourceUnavailable = !fallbackUnavailable && (
    warnings.includes("no_source_rows_available")
    || String(sourceStatus).toUpperCase() === "SOURCE_UNAVAILABLE"
  );
  const effectivePanelState = fallbackUnavailable
    ? "DATA_UNAVAILABLE"
    : sourceUnavailable
    ? "SOURCE_UNAVAILABLE"
    : (summary.panel_state || "UNKNOWN");
  const primaryTone = economicEventStateTone(effectivePanelState);
  const visibleEvents = events.filter((event) => event.state !== "CLEARED");
  const nextClearedEvent = events.find((event) => event.state === "CLEARED");
  const affectedAgents = uniqueAgentList([
    ...Object.keys(artifact.agents || {}),
    ...((inputHealthData?.source_groups || []).find((group) => group.source_id === "economic_events")?.affected_agents || [])
  ]);
  const latestSourceTimestamp = economicEventsSourceData?.generated_at
    || artifact?.event_source?.source_collected_at
    || artifact?.generated_at
    || null;
  const currentOrNextEvent = visibleEvents[0] || nextClearedEvent || null;
  const bootstrapLabel = warningModuleIndicatorLabel(artifact, "economic");
  const summaryCopy = fallbackUnavailable
    ? "The economic-event warning artifact could not be loaded."
    : effectivePanelState === "SOURCE_UNAVAILABLE"
    ? "Economic-event timing is currently unavailable. Layer 1 calls may have reduced event awareness."
    : visibleEvents.length
    ? `${visibleEvents.length} in-scope major event${visibleEvents.length === 1 ? "" : "s"} currently visible in the refresh watch window.`
    : effectivePanelState === "NO_MAJOR_EVENTS"
    ? "No major refresh-triggering events are currently in scope for today's published Layer 1 calls."
    : "Economic-event status is available, but there are no active warning rows to display.";
  const warningCopy = warnings.length
    ? `<div class="economic-event-summary-warnings">${warnings.map((warning) => `<span>${escapeHtml(economicEventWarningLabel(warning))}</span>`).join("")}</div>`
    : "";
  const clearedCopy = !visibleEvents.length && nextClearedEvent
    ? `<p class="economic-event-subcopy">Most recent cleared event: ${escapeHtml(nextClearedEvent.event_name)}.</p>`
    : "";

  container.innerHTML = `
    <div class="economic-event-panel-shell ${escapeHtml(primaryTone)}" data-economic-event-panel="true" data-economic-event-panel-state="${escapeHtml(effectivePanelState)}">
      <div class="economic-event-panel-head">
        <div>
          <p class="eyebrow">Operational Warnings</p>
          <h3>ECONOMIC EVENT STATUS</h3>
          ${renderWarningModuleIndicator(bootstrapLabel)}
        </div>
        <span class="economic-event-status-badge ${escapeHtml(primaryTone)}">${escapeHtml(effectivePanelState === "SOURCE_UNAVAILABLE" ? "SOURCE UNAVAILABLE" : economicEventStateLabel(effectivePanelState))}</span>
      </div>
      <p class="economic-event-copy">${escapeHtml(summaryCopy)}</p>
      <p class="economic-event-subcopy">The panel remains visible in healthy, degraded, stale, mismatched, bootstrap, and unavailable states so event-awareness status stays explicit on Overview.</p>
      <div class="operational-summary-grid warning-module-summary-grid">
        <div><strong>Affected agents</strong><span>${escapeHtml(affectedAgents.join(", ") || "None recorded")}</span></div>
        <div><strong>Source status</strong><span>${escapeHtml(formatWarningValue(sourceStatus || effectivePanelState).replaceAll("_", " "))}</span></div>
        <div><strong>Rows seen</strong><span>${escapeHtml(formatWarningValue(artifact?.event_source?.rows_seen, "Unavailable"))}</span></div>
        <div><strong>Latest source timestamp</strong><span>${escapeHtml(latestSourceTimestamp ? formatDashboardTime(latestSourceTimestamp) : "Unavailable")}</span></div>
        <div><strong>Current / next event</strong><span>${escapeHtml(currentOrNextEvent?.event_name || "None in scope")}</span></div>
        <div><strong>Refresh requirement</strong><span>${escapeHtml(visibleEvents.length ? "Refresh review required" : fallbackUnavailable ? "Artifact recovery required" : effectivePanelState === "SOURCE_UNAVAILABLE" ? "Source recovery required" : "No immediate refresh requirement")}</span></div>
      </div>
      ${warningCopy}
      ${artifact.error ? `<div class="economic-event-warning-list"><span>${escapeHtml(artifact.error)}</span></div>` : ""}
      ${visibleEvents.length ? `<div class="economic-event-card-list">${visibleEvents.map(renderEconomicEventCard).join("")}</div>` : ""}
      ${!visibleEvents.length ? clearedCopy : ""}
    </div>
  `;
}

function renderOperationalWarningsPanel() {
  const container = document.getElementById("operationalWarningsPanel");
  if (!container) return;

  const artifact = inputHealthData || createInputHealthFallback("Input-health artifact unavailable");
  const issues = Array.isArray(artifact.issues) ? artifact.issues : [];
  const sourceGroups = Array.isArray(artifact.source_groups) ? artifact.source_groups : [];
  const affectedAgentKeys = Object.entries(artifact.agents || {})
    .filter(([, health]) => health && health.overall_status && health.overall_status !== "HEALTHY")
    .map(([agent]) => agent);
  const topIssues = issues.slice(0, 8);
  const tone = inputHealthTone(artifact.overall_status);
  const latestHealthy = artifact.last_full_health_at ? formatDashboardTime(artifact.last_full_health_at) : "Not yet recorded";
  const economicSource = artifact.sources?.economic_events || null;
  const fallbackUnavailable = artifact.fallback_kind === "artifact_unavailable";
  const bootstrapLabel = warningModuleIndicatorLabel(artifact, "input_health");
  const statusLabel = inputHealthStatusLabel(artifact.overall_status);

  container.innerHTML = `
    <div class="operational-warnings-shell ${escapeHtml(tone)}" data-operational-warnings-state="${escapeHtml(artifact.overall_status || "UNKNOWN")}" data-input-health-panel="true" data-input-health-panel-state="${escapeHtml(artifact.overall_status || "UNKNOWN")}">
      <div class="operational-warnings-head">
        <div>
          <p class="eyebrow">Operational Warnings</p>
          <h3>INPUT HEALTH</h3>
          ${renderWarningModuleIndicator(bootstrapLabel)}
        </div>
        <span class="economic-event-status-badge ${escapeHtml(tone)}">${escapeHtml(statusLabel)}</span>
      </div>
      <p class="economic-event-copy">
        ${fallbackUnavailable
          ? "The input-health artifact could not be loaded."
          : artifact.overall_status === "HEALTHY"
          ? "All monitored Layer 1 inputs are currently healthy within the published contract."
          : "Calls produced with degraded event inputs or stale upstream sources remain visible here. This surface separates workflow execution, input completeness, and call validity."}
      </p>
      <div class="operational-summary-grid">
        <div><strong>Overall health</strong><span>${escapeHtml(statusLabel)}</span></div>
        <div><strong>Affected agents</strong><span>${escapeHtml(String(artifact.affected_agent_count || 0))}</span></div>
        <div><strong>Critical issues</strong><span>${escapeHtml(String(artifact.critical_issue_count || 0))}</span></div>
        <div><strong>Missing inputs</strong><span>${escapeHtml(String(artifact.missing_input_count || 0))}</span></div>
        <div><strong>Stale inputs</strong><span>${escapeHtml(String(artifact.stale_input_count || 0))}</span></div>
        <div><strong>Source failures</strong><span>${escapeHtml(String(artifact.source_failure_count || 0))}</span></div>
        <div><strong>Last full health</strong><span>${escapeHtml(latestHealthy)}</span></div>
      </div>
      ${economicSource ? `
        <div class="operational-source-note">
          <strong>Economic events</strong>
          <span>${escapeHtml(String(economicSource.data_status || "UNKNOWN").replaceAll("_", " "))}</span>
          ${economicSource.warning ? `<small>${escapeHtml(economicSource.warning)}</small>` : ""}
        </div>
      ` : ""}
      ${sourceGroups.length ? `
        <div class="operational-issue-list">
          ${sourceGroups.map((group) => `
            <article class="operational-issue-card">
              <div class="operational-issue-head">
                <strong>${escapeHtml(group.label || group.source_id)}</strong>
                <span>${escapeHtml(String(group.status || "UNKNOWN").replaceAll("_", " "))}</span>
              </div>
              <p>${escapeHtml(group.warning || "Shared source degradation is affecting one or more Layer 1 agents.")}</p>
              <small>Affected agents: ${escapeHtml((group.affected_agents || []).join(", ") || "None recorded")}</small>
            </article>
          `).join("")}
        </div>
      ` : ""}
      ${affectedAgentKeys.length ? `
        <div class="operational-agent-list">
          ${affectedAgentKeys.map((agent) => {
            const health = artifact.agents[agent];
            const healthIssues = Array.isArray(health?.issues) ? health.issues : [];
            return `
              <article class="operational-agent-card ${escapeHtml(inputHealthTone(health.overall_status))}">
                <div class="operational-agent-head">
                  <strong>${escapeHtml(agent)}</strong>
                  <span>${escapeHtml(inputHealthStatusLabel(health.overall_status))}</span>
                </div>
                <p>${escapeHtml(summarizeInputHealthAgentIssues(agent, health))}</p>
                <small>${escapeHtml(`Issues recorded: ${healthIssues.length}`)}</small>
              </article>
            `;
          }).join("")}
        </div>
      ` : `
        <div class="operational-agent-list">
          <article class="operational-agent-card success">
            <div class="operational-agent-head">
              <strong>System</strong>
              <span>${escapeHtml(statusLabel)}</span>
            </div>
            <p>No per-agent degradations are currently published.</p>
          </article>
        </div>
      `}
      ${topIssues.length ? `
        <div class="operational-issue-list">
          ${topIssues.map((issue) => `
            <article class="operational-issue-card">
              <div class="operational-issue-head">
                <strong>${escapeHtml(issue.agent)} - ${escapeHtml(issue.label)}</strong>
                <span>${escapeHtml(String(issue.status || "").replaceAll("_", " "))}</span>
              </div>
              <p>${escapeHtml(issue.reason || "No reason supplied.")}</p>
              <small>${escapeHtml(issue.confidence_effect || "No confidence note supplied.")}</small>
            </article>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderAgentCard(agent) {
  const call24 = getCall(agent, "24h");
  const call24Confidence = confidenceValue(call24, agent, "24h");
  const l2lTrustStatus = currentOverviewLayer1L2lTrustStatus(agent);
  const directionalTrustStatus = currentOverviewLayer1DirectionalTrustStatus(agent);
  const metrics = agent.display_metrics || {};
  const assetUpdated = getAgentUpdatedAt(agent);
  const formattedAssetUpdated = formatDashboardTime(assetUpdated);
  const assetAge = formatRelativeAge(assetUpdated);
  const validity = getLayer1Validity(agent);
  const displayStatus = resolveLayer1DisplayStatus(agent);

  const calls = Object.entries(agent.calls || {}).map(([tf, call]) => {
    const direction = call.direction || "PENDING";
    const metric = confidenceValue(call, agent, tf);

    return `
      <div class="call-row compact-call">
        <div class="call-row-head">
          <span class="timeframe">${labels[tf] || tf}</span>
          <span class="direction ${directionClass(direction)}">${normaliseDirection(direction)} ${formatConviction(metric)}</span>
        </div>
      </div>
    `;
  }).join("");

  return `
    <article class="agent-card clickable-card" data-agent="${escapeHtml(agent.agent)}">
      <div class="agent-top">
        <div>
          <p class="eyebrow">Layer 1</p>
          <h3>${escapeHtml(agent.agent)}</h3>
        </div>
        <span class="badge ${escapeHtml(validityStatusClass(displayStatus))}">${escapeHtml(validityStatusLabel(displayStatus))}</span>
      </div>

      <div class="main-signal">
        <span class="direction ${directionClass(call24.direction)}">${normaliseDirection(call24.direction)}</span>
        <strong>${formatConviction(call24Confidence)}</strong>
      </div>
      ${renderOverviewExpirySection(validity, displayStatus, agent.agent)}
      <div class="overview-validation-panel-stack" data-overview-validation-panels="true">
        ${buildOverviewL2lTrustBadge(l2lTrustStatus)}
        ${buildOverviewDirectionalTrustBadge(directionalTrustStatus)}
      </div>

      ${renderEventCollectorAgentWarning(agent, "24h")}

      <div class="agent-metrics">
        <div class="agent-metric-chip">
          <span>Confidence</span>
          <strong>${displayMetricValue(metrics.confidence)}</strong>
        </div>
        <div class="agent-metric-chip">
          <span>Bull Case</span>
          <strong>${displayMetricValue(metrics.bull_case)}</strong>
        </div>
        <div class="agent-metric-chip">
          <span>Bear Case</span>
          <strong>${displayMetricValue(metrics.bear_case)}</strong>
        </div>
        <div class="agent-metric-chip">
          <span>Net Edge</span>
          <strong>${displayMetricValue(metrics.net_edge)}</strong>
        </div>
        <div class="agent-metric-chip">
          <span>Participation</span>
          <strong>${displayMetricValue(metrics.participation)}</strong>
        </div>
        <div class="agent-metric-chip">
          <span>Strength</span>
          <strong>${escapeHtml(metrics.verdict_strength || "--")}</strong>
        </div>
      </div>

      <p class="asset-update">
        <strong>Last asset update:</strong>
        ${escapeHtml(formattedAssetUpdated)}${assetAge ? ` · ${escapeHtml(assetAge)}` : ""}
      </p>

      <div class="call-list">${calls}</div>
      <button class="inspect-button" data-agent="${escapeHtml(agent.agent)}">Inspect ${escapeHtml(agent.agent)} Engine</button>
    </article>
  `;
}

function renderLayer1(data) {
  const layer1Updated = document.getElementById("layer1Updated");
  if (layer1Updated) {
    layer1Updated.textContent = `Last n8n ingest: ${formatDashboardTime(data.dashboard_meta?.last_updated_et)}`;
  }

  renderOperationalWarningsPanel();
  renderEconomicEventRefreshPanel();
  renderOverviewStatusPanel();
  renderOverviewSignalBoard();
  renderOverviewBriefing();
  renderOverviewStats();
  renderSevenDayOutlook(data);
  renderOverviewPerformancePanel();
  renderOverviewConfidenceBandPanel();

  const grid = document.getElementById("layer1Grid");
  if (!grid) return;

  grid.innerHTML = (data.agents || []).map(renderAgentCard).join("");

  grid.querySelectorAll("[data-agent]").forEach(el => {
    el.addEventListener("click", () => setTab(el.dataset.agent));
  });
}

function renderSevenDayOutlook(data) {
  const container = document.getElementById("overviewOutlook");
  if (!container) return;

  container.innerHTML = (data?.agents || []).map(agent => `
    <article class="detail-panel outlook-card">
      <div class="panel-head compact-panel-head">
        <div>
          <p class="eyebrow">Layer 1 Outlook</p>
          <h3>${escapeHtml(agent.agent)}</h3>
        </div>
      </div>
      <div class="outlook-list">
        ${(agent.seven_day_outlook || []).map(entry => `
          <div class="outlook-row">
            <span class="outlook-day">${escapeHtml(entry.day)}</span>
            <span class="direction ${directionClass(entry.direction)}">${escapeHtml(normaliseDirection(entry.direction))}</span>
            <span class="outlook-confidence">${displayMetricValue(entry.confidence)}</span>
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderOverviewPerformancePanel() {
  const container = document.getElementById("overviewPerformancePanel");
  if (!container) return;

  const rows = overviewPairPerformanceSnapshot.rows.map((row) => `
    <tr>
      <th scope="row">${escapeHtml(row.pair)}</th>
      <td class="table-number">${escapeHtml(String(row.trades))}</td>
      <td class="table-number">${escapeHtml(String(row.wins))}</td>
      <td class="table-number">${escapeHtml(String(row.losses))}</td>
      <td class="table-number">${escapeHtml(row.win_rate)}</td>
      <td class="table-number overview-performance-pl ${escapeHtml(row.net_pl_direction)}">
        <span class="overview-performance-pl-label">${row.net_pl_direction === "positive" ? "Profit" : "Loss"}</span>
        <span>${escapeHtml(row.net_pl)}</span>
      </td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div class="panel-head compact-panel-head">
      <div>
        <p class="eyebrow">Historical Snapshot</p>
        <h3>PAIR PERFORMANCE</h3>
        <p class="overview-performance-meta">Historical results snapshot · Last updated ${escapeHtml(overviewPairPerformanceSnapshot.updated_label)}</p>
      </div>
    </div>
    <p class="overview-performance-copy">${escapeHtml(overviewPairPerformanceSnapshot.qualifier)}</p>
    <div class="overview-performance-table-wrap">
      <table class="overview-performance-table">
        <thead>
          <tr>
            <th scope="col">Pair</th>
            <th scope="col" class="table-number">Trades</th>
            <th scope="col" class="table-number">Wins</th>
            <th scope="col" class="table-number">Losses</th>
            <th scope="col" class="table-number">Win rate</th>
            <th scope="col" class="table-number">Net P/L</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function normalizeConfidenceBandRows(payload = {}) {
  return {
    marketRows: Array.isArray(payload.rows) ? payload.rows : [],
    pooledRows: Array.isArray(payload.pooled_reference_rows) ? payload.pooled_reference_rows : [],
    thresholds: payload.sample_size_thresholds || {}
  };
}

function findConfidenceBandRow(rows = [], marketKey, confidence) {
  const numeric = numberOrNull(confidence);
  if (!marketKey || numeric === null) return null;
  const clamped = Math.max(0, Math.min(100, numeric));
  return rows.find((row) =>
    String(row.market_key || "").trim().toUpperCase() === String(marketKey || "").trim().toUpperCase()
    && clamped >= Number(row.confidence_band_min ?? 0)
    && clamped <= Number(row.confidence_band_max ?? 0)
  ) || null;
}

function formatSampleStatusLabel(status = "") {
  return String(status || "").trim() || "Not yet available";
}

function overviewAccuracySampleText(row = {}) {
  return `Based on ${row.directional_sample ?? 0} correct-or-wrong directional outcomes and ${row.flat ?? 0} flat outcomes.`;
}

function renderOverviewConfidenceBandMetrics(row = {}, options = {}) {
  const isInsufficient = Boolean(row.insufficient_historical_sample);
  return `
    <div class="overview-confidence-band-kpis">
      <div class="overview-confidence-band-kpi">
        <span>Historical directional accuracy</span>
        <strong>${isInsufficient ? "Insufficient historical sample" : (metricAvailable(row.ex_flat_win_rate) ? percentValue(row.ex_flat_win_rate) : displayDash())}</strong>
      </div>
      <div class="overview-confidence-band-kpi">
        <span>All-outcome accuracy</span>
        <strong>${isInsufficient ? "Secondary only" : (metricAvailable(row.all_outcome_accuracy) ? percentValue(row.all_outcome_accuracy) : displayDash())}</strong>
      </div>
      <div class="overview-confidence-band-kpi">
        <span>Sample</span>
        <strong>${row.correct ?? 0} correct · ${row.wrong ?? 0} wrong · ${row.flat ?? 0} flat</strong>
      </div>
      <div class="overview-confidence-band-kpi">
        <span>Sample-size status</span>
        <strong>${escapeHtml(formatSampleStatusLabel(row.sample_size_status))}</strong>
      </div>
    </div>
    <p class="overview-confidence-band-copy">${isInsufficient
      ? `<strong>Insufficient historical sample.</strong> Market-specific directional accuracy is not emphasised for this confidence band.`
      : `<strong>${escapeHtml(options.marketLabel || "Market")}</strong> Historical calls for this market in the same confidence band were directionally correct ${escapeHtml(metricAvailable(row.ex_flat_win_rate) ? `${row.ex_flat_win_rate}%` : displayDash())} of the time, excluding flat outcomes.`}
    </p>
    <p class="overview-confidence-band-copy">${isInsufficient
      ? "Use the labelled pooled reference below only as secondary context."
      : `Including flat outcomes, the call was correct ${escapeHtml(metricAvailable(row.all_outcome_accuracy) ? `${row.all_outcome_accuracy}%` : displayDash())} of the time.`}</p>
    <p class="overview-confidence-band-copy">${escapeHtml(overviewAccuracySampleText(row))}</p>
  `;
}

function renderOverviewConfidenceBandReference(referenceRow = {}, label = "") {
  if (!referenceRow) return "";
  return `
    <p class="overview-confidence-band-reference">
      <strong>${escapeHtml(label)}</strong>
      ${metricAvailable(referenceRow.ex_flat_win_rate) ? `${referenceRow.ex_flat_win_rate}% ex-flat` : "Not yet available"} ·
      ${referenceRow.correct ?? 0} correct · ${referenceRow.wrong ?? 0} wrong · ${referenceRow.flat ?? 0} flat ·
      ${escapeHtml(formatSampleStatusLabel(referenceRow.sample_size_status))}
    </p>
  `;
}

function renderOverviewConfidenceBandLayer1Card(agent, contract) {
  const call24 = getCall(agent, "24h");
  const direction = call24.direction || "PENDING";
  const confidence = confidenceValue(call24, agent, "24h");
  const strength = confidenceStrength(call24, agent, "24h");
  const marketRow = findConfidenceBandRow(contract.marketRows, agent.agent, confidence);
  const pooledRow = findConfidenceBandRow(contract.pooledRows, "LAYER1_POOLED", confidence);
  const normalizedDirection = String(direction || "").trim().toUpperCase();
  const directional = normalizedDirection.startsWith("BULLISH") || normalizedDirection.startsWith("BEARISH");
  const bandLabel = marketRow?.confidence_band || "Not yet available";

  return `
    <article class="overview-confidence-band-card${marketRow?.insufficient_historical_sample ? " is-low-sample" : ""}" data-overview-confidence-card="true" data-overview-confidence-market="${escapeHtml(agent.agent)}">
      <div class="overview-confidence-band-head">
        <div class="overview-confidence-band-headline">
          <div>
            <p class="eyebrow">Layer 1</p>
            <h3>${escapeHtml(agent.agent)}</h3>
          </div>
          <span class="badge">${escapeHtml(directional ? "Directional Call" : "No Active Directional Call")}</span>
        </div>
        <p class="overview-confidence-band-meta">
          Current call: ${escapeHtml(normaliseDirection(direction))}
          · Model conviction: ${escapeHtml(metricAvailable(confidence) ? String(confidence) : "--")}
          · ${escapeHtml(formatReviewLabel(String(strength || "not_available").toLowerCase()))}
        </p>
        <p class="overview-confidence-band-meta">Confidence band: ${escapeHtml(bandLabel)}</p>
      </div>
      ${directional && marketRow
        ? renderOverviewConfidenceBandMetrics(marketRow, { marketLabel: agent.agent })
        : `<p class="overview-confidence-band-copy"><strong>No active directional call.</strong> Historical directional accuracy is not shown because the current 24H state is non-directional.</p>`}
      ${directional && marketRow?.insufficient_historical_sample ? renderOverviewConfidenceBandReference(pooledRow, "Pooled Layer 1 reference") : ""}
      <p class="overview-confidence-band-contract"><strong>Horizon:</strong> ${escapeHtml(marketRow?.horizon || "following 24hrs")} · <strong>Contract:</strong> ${escapeHtml(marketRow?.checker_contract || "locked following-24-hours checker contract")}</p>
    </article>
  `;
}

function renderOverviewConfidenceBandLayer2Card(pair, contract) {
  const marketRow = findConfidenceBandRow(contract.marketRows, pair.pair_code, pair.combined_confidence);
  const pooledRow = findConfidenceBandRow(contract.pooledRows, "LAYER2_POOLED", pair.combined_confidence);
  const isDirectional = String(pair.decision || "").trim().toUpperCase() !== "NO_TRADE" && metricAvailable(pair.combined_confidence);
  const currentDirection = isDirectional ? String(pair.direction || "").trim().toUpperCase() : "NO TRADE";
  const bandLabel = marketRow?.confidence_band || "Not yet available";

  return `
    <article class="overview-confidence-band-card${marketRow?.insufficient_historical_sample ? " is-low-sample" : ""}" data-overview-confidence-card="true" data-overview-confidence-market="${escapeHtml(pair.pair_code || pair.pair || "")}">
      <div class="overview-confidence-band-head">
        <div class="overview-confidence-band-headline">
          <div>
            <p class="eyebrow">Layer 2</p>
            <h3>${escapeHtml(pair.pair || pair.pair_code || "Pair")}</h3>
          </div>
          <span class="badge">${escapeHtml(isDirectional ? "Directional Pair" : "No Active Directional Call")}</span>
        </div>
        <p class="overview-confidence-band-meta">
          Current call: ${escapeHtml(currentDirection)}
          · Model conviction: ${escapeHtml(metricAvailable(pair.combined_confidence) ? String(pair.combined_confidence) : "--")}
          · ${escapeHtml(pair.strength || "Not yet available")}
        </p>
        <p class="overview-confidence-band-meta">Confidence band: ${escapeHtml(bandLabel)}</p>
      </div>
      ${isDirectional && marketRow
        ? renderOverviewConfidenceBandMetrics(marketRow, { marketLabel: pair.pair || pair.pair_code || "Pair" })
        : `<p class="overview-confidence-band-copy"><strong>No active directional call.</strong> Historical directional accuracy is not shown because the current Layer 2 state is NO TRADE.</p>`}
      ${isDirectional && marketRow?.insufficient_historical_sample ? renderOverviewConfidenceBandReference(pooledRow, "Pooled Layer 2 reference") : ""}
      <p class="overview-confidence-band-contract"><strong>Horizon:</strong> ${escapeHtml(marketRow?.horizon || "following 24hrs")} · <strong>Contract:</strong> ${escapeHtml(marketRow?.checker_contract || "locked following-24-hours checker contract")}</p>
    </article>
  `;
}

function renderOverviewConfidenceBandPanel() {
  const container = document.getElementById("overviewConfidenceBandPanel");
  if (!container) return;

  if (!layer1Data || !layer2Data || !confidenceBandDeliveryData) {
    container.innerHTML = `
      <div class="panel-head compact-panel-head">
        <div>
          <p class="eyebrow">Historical Confidence-Band Accuracy</p>
          <h3>Current call delivery by market and confidence band</h3>
        </div>
      </div>
      <div class="empty-state overview-confidence-band-empty">Historical confidence-band delivery is not yet available from the local research artifact.</div>
    `;
    return;
  }

  const contract = normalizeConfidenceBandRows(confidenceBandDeliveryData);
  const layer1Cards = (layer1Data.agents || []).map((agent) => renderOverviewConfidenceBandLayer1Card(agent, contract));
  const layer2Cards = (layer2Data.pairs || []).map((pair) => renderOverviewConfidenceBandLayer2Card(pair, contract));

  container.innerHTML = `
    <div class="panel-head compact-panel-head">
      <div>
        <p class="eyebrow">Historical Confidence-Band Accuracy</p>
        <h3>Current call delivery under the locked following-24-hours contract</h3>
      </div>
    </div>
    <p class="overview-confidence-band-note">Confidence is the model's internal conviction score, not a guaranteed probability. Historical accuracy shows how calls in the same confidence band actually performed under the locked following-24-hours backtest contract.</p>
    <p class="overview-confidence-band-note">Historical performance does not guarantee the current call will succeed.</p>
    <div class="overview-confidence-band-grid">
      ${layer1Cards.join("")}
      ${layer2Cards.join("")}
    </div>
    <div class="overview-confidence-band-summary-stack">
      <p class="overview-confidence-band-note">These tables show how many historical calls fell into each model-confidence band and how often those calls delivered the predicted direction under the locked following-24-hours checker contract.</p>
      <p class="overview-confidence-band-note">Confidence is model conviction, not a guaranteed probability. Ex-flat accuracy excludes flat outcomes; all-outcome accuracy includes them.</p>
      ${renderOverviewConfidenceBandSummaryTable("Layer 1", contract)}
      ${renderOverviewConfidenceBandSummaryTable("Layer 2", contract)}
    </div>
  `;
}

function pooledConfidenceBandRows(contract, layer) {
  const pooledKey = layer === "Layer 1" ? "LAYER1_POOLED" : "LAYER2_POOLED";
  const rows = contract.rows
    .filter((row) =>
      String(row.scope_type || "") === "pooled_layer_band"
      && String(row.layer || "") === layer
      && String(row.market_key || "") === pooledKey
      && String(row.direction || "") === "BOTH"
    )
    .slice()
    .sort((left, right) => Number(left.confidence_band_min || 0) - Number(right.confidence_band_min || 0));
  return rows;
}

function currentDirectionalBandsForLayer(layer) {
  const bands = new Set();
  if (layer === "Layer 1") {
    for (const agent of (layer1Data?.agents || [])) {
      const call24 = getCall(agent, "24h");
      const direction = deriveOverviewLayer1DeliveryDirection(call24.direction || "");
      if (!direction) continue;
      const confidence = confidenceValue(call24, agent, "24h");
      const clamped = numberOrNull(confidence);
      if (clamped === null) continue;
      const row = findConfidenceBandReferenceRow(normalizeConfidenceBandRows(confidenceBandDeliveryData).rows, {
        scopeType: "pooled_layer_band",
        layer: "Layer 1",
        marketKey: "LAYER1_POOLED",
        direction: "BOTH",
        confidence: clamped
      });
      if (row?.confidence_band) bands.add(row.confidence_band);
    }
  } else {
    for (const pair of (layer2Data?.pairs || [])) {
      const direction = deriveOverviewLayer2DeliveryDirection(pair);
      const confidence = numberOrNull(pair?.combined_confidence);
      if (!direction || confidence === null) continue;
      const row = findConfidenceBandReferenceRow(normalizeConfidenceBandRows(confidenceBandDeliveryData).rows, {
        scopeType: "pooled_layer_band",
        layer: "Layer 2",
        marketKey: "LAYER2_POOLED",
        direction: "BOTH",
        confidence
      });
      if (row?.confidence_band) bands.add(row.confidence_band);
    }
  }
  return bands;
}

function pooledConfidenceBandMetric(value, formatter = percentValue) {
  return metricAvailable(value) ? formatter(value) : "n/a";
}

function renderOverviewConfidenceBandSummaryTable(layer, contract) {
  const rows = pooledConfidenceBandRows(contract, layer);
  const highlightedBands = currentDirectionalBandsForLayer(layer);
  const tableId = layer === "Layer 1" ? "overviewLayer1ConfidenceBandTable" : "overviewLayer2ConfidenceBandTable";

  return `
    <div class="overview-confidence-band-table-panel" data-overview-confidence-summary="${escapeHtml(layer)}">
      <div class="overview-confidence-band-table-head">
        <div>
          <p class="eyebrow">Pooled Reference</p>
          <h3>${escapeHtml(layer)} confidence-band performance</h3>
        </div>
        <p class="overview-confidence-band-table-meta">Pooled ${escapeHtml(layer)} reference only. These rows are not market-specific.</p>
      </div>
      <div class="overview-confidence-band-table-scroll">
        <table class="overview-confidence-band-table" id="${escapeHtml(tableId)}">
          <thead>
            <tr>
              <th>Confidence band</th>
              <th>Total calls</th>
              <th>Correct</th>
              <th>Wrong</th>
              <th>Flat</th>
              <th>Directional sample</th>
              <th>Ex-flat accuracy</th>
              <th>All-outcome accuracy</th>
              <th>Flat rate</th>
              <th>Evidence label</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
              const isCurrentBand = highlightedBands.has(row.confidence_band);
              return `
                <tr class="${isCurrentBand ? "is-current-band" : ""}" data-overview-confidence-band-row="true" data-overview-confidence-band="${escapeHtml(row.confidence_band)}" data-overview-confidence-layer="${escapeHtml(layer)}">
                  <th>${escapeHtml(row.confidence_band)}</th>
                  <td>${escapeHtml(String(row.total_sample ?? 0))}</td>
                  <td>${escapeHtml(String(row.correct ?? 0))}</td>
                  <td>${escapeHtml(String(row.wrong ?? 0))}</td>
                  <td>${escapeHtml(String(row.flat ?? 0))}</td>
                  <td>${escapeHtml(String(row.directional_sample ?? 0))}</td>
                  <td>${escapeHtml(pooledConfidenceBandMetric(row.ex_flat_win_rate))}</td>
                  <td>${escapeHtml(pooledConfidenceBandMetric(row.all_outcome_accuracy))}</td>
                  <td>${escapeHtml(pooledConfidenceBandMetric(row.flat_rate))}</td>
                  <td>${escapeHtml(formatSampleStatusLabel(row.sample_size_status))}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderOverviewConfidenceBandPanel() {
  const container = document.getElementById("overviewConfidenceBandPanel");
  if (!container) return;

  if (!layer1Data || !layer2Data || !confidenceBandDeliveryData) {
    container.innerHTML = `
      <div class="panel-head compact-panel-head">
        <div>
          <p class="eyebrow">Historical Confidence-Band Accuracy</p>
          <h3>Current call delivery by market and confidence band</h3>
        </div>
      </div>
      <div class="empty-state overview-confidence-band-empty">Historical confidence-band delivery is not yet available from the local research artifact.</div>
    `;
    return;
  }

  const contract = normalizeConfidenceBandRows(confidenceBandDeliveryData);
  const layer1Cards = (layer1Data.agents || []).map((agent) => renderOverviewConfidenceBandLayer1Card(agent, contract));
  const layer2Cards = (layer2Data.pairs || []).map((pair) => renderOverviewConfidenceBandLayer2Card(pair, contract));

  container.innerHTML = `
    <div class="panel-head compact-panel-head">
      <div>
        <p class="eyebrow">Historical Confidence-Band Accuracy</p>
        <h3>Current call delivery under the locked following-24-hours contract</h3>
      </div>
    </div>
    <p class="overview-confidence-band-note">Confidence is the model's internal conviction score, not a guaranteed probability. Historical accuracy shows how calls in the same confidence band actually performed under the locked following-24-hours backtest contract.</p>
    <p class="overview-confidence-band-note">Historical performance does not guarantee the current call will succeed.</p>
    <div class="overview-confidence-band-grid">
      ${layer1Cards.join("")}
      ${layer2Cards.join("")}
    </div>
    <div class="overview-confidence-band-summary-stack">
      <p class="overview-confidence-band-note">These tables show how many historical calls fell into each model-confidence band and how often those calls delivered the predicted direction under the locked following-24-hours checker contract.</p>
      <p class="overview-confidence-band-note">Confidence is model conviction, not a guaranteed probability. Ex-flat accuracy excludes flat outcomes; all-outcome accuracy includes them.</p>
      ${renderOverviewConfidenceBandSummaryTable("Layer 1", contract)}
      ${renderOverviewConfidenceBandSummaryTable("Layer 2", contract)}
    </div>
  `;
}

function normalizeConfidenceBandRows(payload = {}) {
  return {
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    thresholds: payload.sample_size_thresholds || {}
  };
}

function findConfidenceBandReferenceRow(rows = [], options = {}) {
  const {
    scopeType = "",
    layer = "",
    marketKey = "",
    direction = null,
    confidence = null
  } = options;
  const numeric = numberOrNull(confidence);
  if (numeric === null) return null;
  const clamped = Math.max(0, Math.min(100, numeric));
  return rows.find((row) =>
    (!scopeType || String(row.scope_type || "").trim() === String(scopeType || "").trim())
    && (!layer || String(row.layer || "").trim().toUpperCase() === String(layer || "").trim().toUpperCase())
    && (!marketKey || String(row.market_key || "").trim().toUpperCase() === String(marketKey || "").trim().toUpperCase())
    && (direction === null || String(row.direction || "").trim().toUpperCase() === String(direction || "").trim().toUpperCase())
    && clamped >= Number(row.confidence_band_min ?? 0)
    && clamped <= Number(row.confidence_band_max ?? 0)
  ) || null;
}

function deriveOverviewLayer1DeliveryDirection(direction = "") {
  const normalized = String(direction || "").trim().toUpperCase();
  if (normalized.startsWith("BULLISH")) return "BULLISH";
  if (normalized.startsWith("BEARISH")) return "BEARISH";
  return null;
}

function deriveOverviewLayer2DeliveryDirection(pair = {}) {
  const decision = String(pair?.decision || "").trim().toUpperCase();
  const direction = String(pair?.direction || "").trim().toUpperCase();
  if (decision === "BUY" || decision === "SELL") return decision;
  if (decision === "TRADE" && (direction === "BUY" || direction === "SELL")) return direction;
  return null;
}

function findFirstUsableConfidenceReference(candidates = []) {
  return candidates.find((row) => row && !row.insufficient_historical_sample) || null;
}

function resolveOverviewConfidenceBandReferences(contract, options = {}) {
  const {
    layer,
    marketKey,
    direction,
    confidence
  } = options;
  const pooledKey = layer === "Layer 1" ? "LAYER1_POOLED" : "LAYER2_POOLED";
  const exactRow = direction ? findConfidenceBandReferenceRow(contract.rows, {
    scopeType: "exact_market_direction",
    layer,
    marketKey,
    direction,
    confidence
  }) : null;
  const marketBandRow = findConfidenceBandReferenceRow(contract.rows, {
    scopeType: "market_band_both_directions",
    layer,
    marketKey,
    direction: "BOTH",
    confidence
  });
  const layerDirectionRow = direction ? findConfidenceBandReferenceRow(contract.rows, {
    scopeType: "pooled_layer_direction",
    layer,
    marketKey: pooledKey,
    direction,
    confidence
  }) : null;
  const layerBandRow = findConfidenceBandReferenceRow(contract.rows, {
    scopeType: "pooled_layer_band",
    layer,
    marketKey: pooledKey,
    direction: "BOTH",
    confidence
  });
  const primaryRow = findFirstUsableConfidenceReference([exactRow, marketBandRow, layerDirectionRow, layerBandRow]);

  return {
    exactRow,
    marketBandRow,
    layerDirectionRow,
    layerBandRow,
    primaryRow,
    fallbackRows: [exactRow, marketBandRow, layerDirectionRow, layerBandRow].filter((row) => row && row !== primaryRow)
  };
}

function renderOverviewConfidenceBandReference(referenceRow = {}, label = "") {
  if (!referenceRow) return "";
  return `
    <p class="overview-confidence-band-reference">
      <strong>${escapeHtml(label)}</strong>
      ${metricAvailable(referenceRow.ex_flat_win_rate) ? `${referenceRow.ex_flat_win_rate}% ex-flat` : "Not yet available"} |
      ${referenceRow.correct ?? 0} correct | ${referenceRow.wrong ?? 0} wrong | ${referenceRow.flat ?? 0} flat |
      ${escapeHtml(formatSampleStatusLabel(referenceRow.sample_size_status))}
    </p>
  `;
}

function renderOverviewConfidenceBandMetrics(row = {}, options = {}) {
  const {
    marketLabel = "Market",
    deliveryDirection = "",
    referenceLabel = "",
    exactRow = null
  } = options;
  const primaryInsufficient = Boolean(!row || row.insufficient_historical_sample);
  const exactInsufficient = Boolean(exactRow && exactRow.insufficient_historical_sample);
  const normalizedDirection = String(deliveryDirection || "").trim().toLowerCase();
  let headlineCopy = "Insufficient historical evidence.";

  if (row) {
    if (referenceLabel === "Exact market and direction") {
      headlineCopy = `Historical ${normalizedDirection} ${marketLabel} calls in the same confidence band were directionally correct ${escapeHtml(metricAvailable(row.ex_flat_win_rate) ? `${row.ex_flat_win_rate}%` : displayDash())} of the time, excluding flat outcomes.`;
    } else if (referenceLabel === "Market band, both directions") {
      headlineCopy = `Insufficient ${normalizedDirection} ${marketLabel} evidence in this confidence band. Across ${marketLabel} calls in either direction, historical directional accuracy was ${escapeHtml(metricAvailable(row.ex_flat_win_rate) ? `${row.ex_flat_win_rate}%` : displayDash())}.`;
    } else if (referenceLabel === "Pooled Layer 1 directional reference" || referenceLabel === "Pooled Layer 2 directional reference") {
      headlineCopy = `Insufficient ${normalizedDirection} ${marketLabel} evidence in this confidence band. Across ${escapeHtml(referenceLabel.replace(" reference", "").toLowerCase())}, historical directional accuracy was ${escapeHtml(metricAvailable(row.ex_flat_win_rate) ? `${row.ex_flat_win_rate}%` : displayDash())}.`;
    } else {
      headlineCopy = `Insufficient ${normalizedDirection} ${marketLabel} evidence in this confidence band. Across pooled ${escapeHtml(String(row.layer || "").toLowerCase())} calls in this confidence band, historical directional accuracy was ${escapeHtml(metricAvailable(row.ex_flat_win_rate) ? `${row.ex_flat_win_rate}%` : displayDash())}.`;
    }
  }

  return `
    <div class="overview-confidence-band-kpis">
      <div class="overview-confidence-band-kpi">
        <span>Historical directional accuracy</span>
        <strong>${primaryInsufficient ? "Insufficient historical evidence" : (metricAvailable(row.ex_flat_win_rate) ? percentValue(row.ex_flat_win_rate) : displayDash())}</strong>
      </div>
      <div class="overview-confidence-band-kpi">
        <span>All-outcome accuracy</span>
        <strong>${primaryInsufficient ? "Secondary only" : (metricAvailable(row.all_outcome_accuracy) ? percentValue(row.all_outcome_accuracy) : displayDash())}</strong>
      </div>
      <div class="overview-confidence-band-kpi">
        <span>Sample</span>
        <strong>${row.correct ?? 0} correct | ${row.wrong ?? 0} wrong | ${row.flat ?? 0} flat</strong>
      </div>
      <div class="overview-confidence-band-kpi">
        <span>Evidence status</span>
        <strong>${escapeHtml(formatSampleStatusLabel(row.sample_size_status))}</strong>
      </div>
    </div>
    <p class="overview-confidence-band-copy"><strong>${escapeHtml(referenceLabel || "Insufficient historical evidence")}</strong> ${headlineCopy}</p>
    ${exactInsufficient && referenceLabel !== "Exact market and direction"
      ? `<p class="overview-confidence-band-copy">The exact market-and-direction sample for this call remains below the primary-emphasis threshold.</p>`
      : ""}
    <p class="overview-confidence-band-copy">Including flat outcomes, the call was correct ${escapeHtml(metricAvailable(row.all_outcome_accuracy) ? `${row.all_outcome_accuracy}%` : displayDash())} of the time.</p>
    <p class="overview-confidence-band-copy">${escapeHtml(overviewAccuracySampleText(row))}</p>
  `;
}

function renderOverviewConfidenceBandLayer1Card(agent, contract) {
  const call24 = getCall(agent, "24h");
  const direction = call24.direction || "PENDING";
  const confidence = confidenceValue(call24, agent, "24h");
  const strength = confidenceStrength(call24, agent, "24h");
  const deliveryDirection = deriveOverviewLayer1DeliveryDirection(direction);
  const directional = Boolean(deliveryDirection);
  const references = resolveOverviewConfidenceBandReferences(contract, {
    layer: "Layer 1",
    marketKey: agent.agent,
    direction: deliveryDirection,
    confidence
  });
  const primaryRow = references.primaryRow || references.exactRow || references.marketBandRow || references.layerDirectionRow || references.layerBandRow;
  const bandLabel = primaryRow?.confidence_band || "Not yet available";
  const emphasizedAsLimited = Boolean(references.exactRow?.insufficient_historical_sample || primaryRow?.insufficient_historical_sample);

  return `
    <article class="overview-confidence-band-card${emphasizedAsLimited ? " is-low-sample" : ""}" data-overview-confidence-card="true" data-overview-confidence-market="${escapeHtml(agent.agent)}">
      <div class="overview-confidence-band-head">
        <div class="overview-confidence-band-headline">
          <div>
            <p class="eyebrow">Layer 1</p>
            <h3>${escapeHtml(agent.agent)}</h3>
          </div>
          <span class="badge">${escapeHtml(directional ? "Directional Call" : "No Active Directional Call")}</span>
        </div>
        <p class="overview-confidence-band-meta">
          Current call: ${escapeHtml(normaliseDirection(direction))}
          | Model conviction: ${escapeHtml(metricAvailable(confidence) ? String(confidence) : "--")}
          | ${escapeHtml(formatReviewLabel(String(strength || "not_available").toLowerCase()))}
        </p>
        <p class="overview-confidence-band-meta">Confidence band: ${escapeHtml(bandLabel)}</p>
      </div>
      ${directional && primaryRow
        ? renderOverviewConfidenceBandMetrics(primaryRow, {
          marketLabel: agent.agent,
          deliveryDirection,
          referenceLabel: primaryRow.reference_label,
          exactRow: references.exactRow
        })
        : `<p class="overview-confidence-band-copy"><strong>No active directional call.</strong> Historical directional accuracy is not shown because the current 24H state is non-directional.</p>`}
      ${directional ? references.fallbackRows.map((row) => renderOverviewConfidenceBandReference(row, row.reference_label)).join("") : ""}
      <p class="overview-confidence-band-contract"><strong>Horizon:</strong> ${escapeHtml(primaryRow?.horizon || "following 24hrs")} | <strong>Contract:</strong> ${escapeHtml(primaryRow?.checker_contract || "locked following-24-hours checker contract")}</p>
    </article>
  `;
}

function renderOverviewConfidenceBandLayer2Card(pair, contract) {
  const deliveryDirection = deriveOverviewLayer2DeliveryDirection(pair);
  const isDirectional = Boolean(deliveryDirection) && metricAvailable(pair.combined_confidence);
  const references = resolveOverviewConfidenceBandReferences(contract, {
    layer: "Layer 2",
    marketKey: pair.pair_code,
    direction: deliveryDirection,
    confidence: pair.combined_confidence
  });
  const primaryRow = references.primaryRow || references.exactRow || references.marketBandRow || references.layerDirectionRow || references.layerBandRow;
  const currentDirection = isDirectional ? deliveryDirection : "NO TRADE";
  const bandLabel = primaryRow?.confidence_band || "Not yet available";
  const emphasizedAsLimited = Boolean(references.exactRow?.insufficient_historical_sample || primaryRow?.insufficient_historical_sample);

  return `
    <article class="overview-confidence-band-card${emphasizedAsLimited ? " is-low-sample" : ""}" data-overview-confidence-card="true" data-overview-confidence-market="${escapeHtml(pair.pair_code || pair.pair || "")}">
      <div class="overview-confidence-band-head">
        <div class="overview-confidence-band-headline">
          <div>
            <p class="eyebrow">Layer 2</p>
            <h3>${escapeHtml(pair.pair || pair.pair_code || "Pair")}</h3>
          </div>
          <span class="badge">${escapeHtml(isDirectional ? "Directional Pair" : "No Active Directional Call")}</span>
        </div>
        <p class="overview-confidence-band-meta">
          Current call: ${escapeHtml(currentDirection)}
          | Model conviction: ${escapeHtml(metricAvailable(pair.combined_confidence) ? String(pair.combined_confidence) : "--")}
          | ${escapeHtml(pair.strength || "Not yet available")}
        </p>
        <p class="overview-confidence-band-meta">Confidence band: ${escapeHtml(bandLabel)}</p>
      </div>
      ${isDirectional && primaryRow
        ? renderOverviewConfidenceBandMetrics(primaryRow, {
          marketLabel: pair.pair || pair.pair_code || "Pair",
          deliveryDirection,
          referenceLabel: primaryRow.reference_label,
          exactRow: references.exactRow
        })
        : `<p class="overview-confidence-band-copy"><strong>No active directional call.</strong> Historical directional accuracy is not shown because the current Layer 2 state is NO TRADE.</p>`}
      ${isDirectional ? references.fallbackRows.map((row) => renderOverviewConfidenceBandReference(row, row.reference_label)).join("") : ""}
      <p class="overview-confidence-band-contract"><strong>Horizon:</strong> ${escapeHtml(primaryRow?.horizon || "following 24hrs")} | <strong>Contract:</strong> ${escapeHtml(primaryRow?.checker_contract || "locked following-24-hours checker contract")}</p>
    </article>
  `;
}

function renderOverviewConfidenceBandPanel() {
  const container = document.getElementById("overviewConfidenceBandPanel");
  if (!container) return;

  if (!layer1Data || !layer2Data || !confidenceBandDeliveryData) {
    container.innerHTML = `
      <div class="panel-head compact-panel-head">
        <div>
          <p class="eyebrow">Historical Confidence-Band Accuracy</p>
          <h3>Current call delivery by market and confidence band</h3>
        </div>
      </div>
      <div class="empty-state overview-confidence-band-empty">Historical confidence-band delivery is not yet available from the local research artifact.</div>
    `;
    return;
  }

  const contract = normalizeConfidenceBandRows(confidenceBandDeliveryData);
  const layer1Cards = (layer1Data.agents || []).map((agent) => renderOverviewConfidenceBandLayer1Card(agent, contract));
  const layer2Cards = (layer2Data.pairs || []).map((pair) => renderOverviewConfidenceBandLayer2Card(pair, contract));

  container.innerHTML = `
    <div class="panel-head compact-panel-head">
      <div>
        <p class="eyebrow">Historical Confidence-Band Accuracy</p>
        <h3>Current call delivery under the locked following-24-hours contract</h3>
      </div>
    </div>
    <p class="overview-confidence-band-note">Confidence is the model's internal conviction score, not a guaranteed probability. Historical accuracy shows how calls in the same confidence band actually performed under the locked following-24-hours backtest contract.</p>
    <p class="overview-confidence-band-note">Historical performance does not guarantee the current call will succeed.</p>
    <div class="overview-confidence-band-grid">
      ${layer1Cards.join("")}
      ${layer2Cards.join("")}
    </div>
    <div class="overview-confidence-band-summary-stack">
      <p class="overview-confidence-band-note">These tables show how many historical calls fell into each model-confidence band and how often those calls delivered the predicted direction under the locked following-24-hours checker contract.</p>
      <p class="overview-confidence-band-note">Confidence is model conviction, not a guaranteed probability. Ex-flat accuracy excludes flat outcomes; all-outcome accuracy includes them.</p>
      ${renderOverviewConfidenceBandSummaryTable("Layer 1", contract)}
      ${renderOverviewConfidenceBandSummaryTable("Layer 2", contract)}
    </div>
  `;
}

function normalizeConfidenceBandRows(payload = {}) {
  return {
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    strengthRows: Array.isArray(payload.strength_rows) ? payload.strength_rows : [],
    noTradeRows: Array.isArray(payload.no_trade_rows) ? payload.no_trade_rows : [],
    asymmetryRows: Array.isArray(payload.asymmetry_rows) ? payload.asymmetry_rows : [],
    thresholds: payload.sample_size_thresholds || {},
    coverage: payload.coverage || {},
    reconciliation: payload.reconciliation || {},
    checkerContract: payload.checker_contract || "locked following-24-hours checker contract",
    timeframe: payload.timeframe || "following 24hrs",
    directionMapping: payload.direction_mapping || {}
  };
}

function getOverviewConfidenceDashboardState(contract) {
  const fallbackLayer1Market = contract.coverage?.layer1_markets?.[0] || "USD";
  const fallbackLayer2Pair = contract.coverage?.layer2_pairs?.[0] || "EUR_USD";
  if (!globalThis.__overviewConfidenceDashboardState) {
    globalThis.__overviewConfidenceDashboardState = {
      activeTab: "layer1",
      layer1Market: fallbackLayer1Market,
      layer1Direction: "BULLISH",
      layer2Pair: fallbackLayer2Pair,
      layer2Direction: "BUY",
      strengthLayer: "Layer 1",
      strengthEntityKey: "LAYER1_POOLED",
      asymmetryLayer: "Layer 1",
      pooledLayer: "Layer 1"
    };
  }

  const state = globalThis.__overviewConfidenceDashboardState;
  const layer1Markets = contract.coverage?.layer1_markets || [];
  const layer2Pairs = contract.coverage?.layer2_pairs || [];
  if (!layer1Markets.includes(state.layer1Market)) state.layer1Market = fallbackLayer1Market;
  if (!layer2Pairs.includes(state.layer2Pair)) state.layer2Pair = fallbackLayer2Pair;

  const validStrengthKeys = new Set([
    "LAYER1_POOLED",
    "LAYER2_POOLED",
    ...(contract.coverage?.layer1_markets || []),
    ...(contract.coverage?.layer2_pairs || [])
  ]);
  if (!validStrengthKeys.has(state.strengthEntityKey)) {
    state.strengthEntityKey = state.strengthLayer === "Layer 2" ? "LAYER2_POOLED" : "LAYER1_POOLED";
  }

  return state;
}

function overviewConfidenceBandRowsByScope(contract, scopeType, layer, marketKey, direction) {
  return contract.rows
    .filter((row) =>
      String(row.scope_type || "") === String(scopeType || "")
      && String(row.layer || "") === String(layer || "")
      && String(row.market_key || "") === String(marketKey || "")
      && String(row.direction || "") === String(direction || "")
    )
    .slice()
    .sort((left, right) => Number(left.confidence_band_min || 0) - Number(right.confidence_band_min || 0));
}

function findConfidenceBandReferenceRow(rows = [], options = {}) {
  const {
    scopeType = "",
    layer = "",
    marketKey = "",
    direction = null,
    confidence = null
  } = options;
  const numeric = numberOrNull(confidence);
  if (numeric === null) return null;
  const clamped = Math.max(0, Math.min(100, numeric));
  return rows.find((row) =>
    (!scopeType || String(row.scope_type || "").trim() === String(scopeType || "").trim())
    && (!layer || String(row.layer || "").trim().toUpperCase() === String(layer || "").trim().toUpperCase())
    && (!marketKey || String(row.market_key || "").trim().toUpperCase() === String(marketKey || "").trim().toUpperCase())
    && (direction === null || String(row.direction || "").trim().toUpperCase() === String(direction || "").trim().toUpperCase())
    && clamped >= Number(row.confidence_band_min ?? 0)
    && clamped <= Number(row.confidence_band_max ?? 0)
  ) || null;
}

function deriveOverviewLayer1DeliveryDirection(direction = "") {
  const normalized = String(direction || "").trim().toUpperCase();
  if (normalized.startsWith("BULLISH")) return "BULLISH";
  if (normalized.startsWith("BEARISH")) return "BEARISH";
  return null;
}

function deriveOverviewLayer2DeliveryDirection(pair = {}) {
  const decision = String(pair?.decision || "").trim().toUpperCase();
  const direction = String(pair?.direction || "").trim().toUpperCase();
  if (decision === "BUY" || decision === "SELL") return decision;
  if (decision === "TRADE" && (direction === "BUY" || direction === "SELL")) return direction;
  return null;
}

function findFirstUsableConfidenceReference(candidates = []) {
  return candidates.find((row) => row && !row.insufficient_historical_sample) || null;
}

function resolveOverviewConfidenceBandReferences(contract, options = {}) {
  const {
    layer,
    marketKey,
    direction,
    confidence
  } = options;
  const pooledKey = layer === "Layer 1" ? "LAYER1_POOLED" : "LAYER2_POOLED";
  const exactRow = direction ? findConfidenceBandReferenceRow(contract.rows, {
    scopeType: "exact_market_direction",
    layer,
    marketKey,
    direction,
    confidence
  }) : null;
  const marketBandRow = findConfidenceBandReferenceRow(contract.rows, {
    scopeType: "market_band_both_directions",
    layer,
    marketKey,
    direction: "BOTH",
    confidence
  });
  const layerDirectionRow = direction ? findConfidenceBandReferenceRow(contract.rows, {
    scopeType: "pooled_layer_direction",
    layer,
    marketKey: pooledKey,
    direction,
    confidence
  }) : null;
  const layerBandRow = findConfidenceBandReferenceRow(contract.rows, {
    scopeType: "pooled_layer_band",
    layer,
    marketKey: pooledKey,
    direction: "BOTH",
    confidence
  });
  const primaryRow = findFirstUsableConfidenceReference([exactRow, marketBandRow, layerDirectionRow, layerBandRow]);

  return {
    exactRow,
    marketBandRow,
    layerDirectionRow,
    layerBandRow,
    primaryRow,
    fallbackRows: [exactRow, marketBandRow, layerDirectionRow, layerBandRow].filter((row) => row && row !== primaryRow)
  };
}

function overviewConfidenceCurrentLayer1Meta(agent, contract) {
  const call24 = getCall(agent, "24h");
  const deliveryDirection = deriveOverviewLayer1DeliveryDirection(call24.direction || "");
  const confidence = confidenceValue(call24, agent, "24h");
  const references = resolveOverviewConfidenceBandReferences(contract, {
    layer: "Layer 1",
    marketKey: agent.agent,
    direction: deliveryDirection,
    confidence
  });
  const primaryRow = references.primaryRow || references.exactRow || references.marketBandRow || references.layerDirectionRow || references.layerBandRow || null;
  return {
    market: agent.agent,
    layer: "Layer 1",
    stateLabel: deliveryDirection ? normaliseDirection(call24.direction || "") : (call24.direction || "NO CLEAR BIAS"),
    deliveryDirection,
    confidence,
    strength: confidenceStrength(call24, agent, "24h"),
    currentBand: primaryRow?.confidence_band || null,
    horizon: primaryRow?.horizon || contract.timeframe,
    checkerContract: primaryRow?.checker_contract || contract.checkerContract,
    references
  };
}

function overviewConfidenceCurrentLayer2Meta(pair, contract) {
  const deliveryDirection = deriveOverviewLayer2DeliveryDirection(pair);
  const confidence = numberOrNull(pair?.combined_confidence);
  const references = resolveOverviewConfidenceBandReferences(contract, {
    layer: "Layer 2",
    marketKey: pair.pair_code,
    direction: deliveryDirection,
    confidence
  });
  const primaryRow = references.primaryRow || references.exactRow || references.marketBandRow || references.layerDirectionRow || references.layerBandRow || null;
  return {
    market: pair.pair_code,
    layer: "Layer 2",
    stateLabel: deliveryDirection || "NO TRADE",
    deliveryDirection,
    confidence,
    strength: pair?.strength || null,
    currentBand: primaryRow?.confidence_band || null,
    horizon: primaryRow?.horizon || contract.timeframe,
    checkerContract: primaryRow?.checker_contract || contract.checkerContract,
    references
  };
}

function currentConfidenceMetaForMarket(contract, layer, marketKey) {
  if (layer === "Layer 1") {
    const agent = (layer1Data?.agents || []).find((entry) => entry.agent === marketKey);
    return agent ? overviewConfidenceCurrentLayer1Meta(agent, contract) : null;
  }
  const pair = (layer2Data?.pairs || []).find((entry) => entry.pair_code === marketKey);
  return pair ? overviewConfidenceCurrentLayer2Meta(pair, contract) : null;
}

function formatSampleStatusLabel(status = "") {
  return String(status || "").trim() || "Not yet available";
}

function overviewAccuracySampleText(row = {}) {
  return `Based on ${row.evaluated_directional_calls ?? 0} evaluated directional calls and ${row.flat ?? 0} flat outcomes.`;
}

function overviewConfidenceMetricCell(value) {
  return metricAvailable(value) ? percentValue(value) : "n/a";
}

function overviewConfidenceComparisonLabel(referenceLabel = "") {
  const normalized = String(referenceLabel || "").trim();
  const replacements = {
    "Exact market and direction": "Exact match: same market, direction and confidence band",
    "Market band, both directions": "Fallback: same market and confidence band, both directions",
    "Pooled Layer 1 directional reference": "Fallback: pooled Layer 1, same direction and confidence band",
    "Pooled Layer 1 reference": "Fallback: pooled Layer 1 confidence band",
    "Pooled Layer 2 directional reference": "Fallback: pooled Layer 2, same direction and confidence band",
    "Pooled Layer 2 reference": "Fallback: pooled Layer 2 confidence band"
  };
  return replacements[normalized] || normalized || "Not yet available";
}

function overviewConfidenceComparisonBadge(referenceRow = null) {
  if (!referenceRow) return "";
  return String(referenceRow.scope_type || "") === "exact_market_direction" ? "EXACT MATCH" : "FALLBACK";
}

function overviewConfidenceLiveBadge(summary = {}) {
  if (summary.layer === "Layer 2") {
    return summary.deliveryDirection ? "LIVE TRADE" : "LIVE STATE";
  }
  return summary.deliveryDirection ? "LIVE CALL" : "LIVE STATE";
}

function overviewConfidenceLiveStateText(summary = {}) {
  if (!summary.deliveryDirection) {
    if (summary.layer === "Layer 2") {
      return "Current live state: NO TRADE. No directional historical accuracy is shown because there is no active BUY or SELL call.";
    }
    return "Current live state: NO CLEAR BIAS. No directional historical accuracy is shown because there is no active directional call.";
  }

  const headline = `${summary.market} — ${summary.stateLabel || "Not yet available"}`;
  const confidenceLine = metricAvailable(summary.confidence)
    ? `Confidence ${summary.confidence}${summary.strength ? ` · ${summary.strength}` : ""}`
    : (summary.strength ? `Strength ${summary.strength}` : "");
  const bandLine = summary.currentBand ? `Band ${summary.currentBand}` : "";
  return [headline, confidenceLine, bandLine].filter(Boolean).join("\n");
}

function overviewConfidenceDirectionLabel(direction = "", layer = "Layer 1") {
  const normalized = String(direction || "").trim().toUpperCase();
  if (normalized === "BULLISH" || normalized === "BEARISH" || normalized === "BUY" || normalized === "SELL") {
    return normalized;
  }
  if (normalized === "BOTH") return layer === "Layer 2" ? "Both trade directions" : "Both directions";
  return normalized || "Not yet available";
}

function overviewConfidenceButton(options = {}) {
  const {
    label,
    value,
    active = false,
    currentLive = false,
    dataAttr
  } = options;
  return `
    <button
      type="button"
      class="overview-confidence-band-chip${active ? " is-active" : ""}${currentLive ? " is-current-live" : ""}"
      ${dataAttr}="${escapeHtml(String(value || ""))}">
      <span>${escapeHtml(label)}</span>
      ${currentLive ? '<small>Current</small>' : ""}
    </button>
  `;
}

function renderOverviewConfidenceCurrentSummaryRow(summary = {}) {
  const row = summary.references?.primaryRow || summary.references?.exactRow || summary.references?.marketBandRow || summary.references?.layerDirectionRow || summary.references?.layerBandRow || null;
  const directional = Boolean(summary.deliveryDirection);
  const label = overviewConfidenceComparisonLabel(row?.reference_label || "");
  const comparisonBadge = overviewConfidenceComparisonBadge(row);
  const lowEvidence = Boolean(row?.insufficient_historical_sample);
  const liveBadge = overviewConfidenceLiveBadge(summary);
  const liveStateText = overviewConfidenceLiveStateText(summary);
  const liveStateHtml = directional
    ? `
        <div class="overview-confidence-band-live-call">
          <strong>${escapeHtml(`${summary.market} — ${summary.stateLabel || "Not yet available"}`)}</strong>
          <span>${metricAvailable(summary.confidence)
            ? escapeHtml(`Confidence ${summary.confidence}${summary.strength ? ` · ${summary.strength}` : ""}`)
            : escapeHtml(summary.strength ? `Strength ${summary.strength}` : "Confidence not available")}</span>
          <span>${escapeHtml(summary.currentBand ? `Band ${summary.currentBand}` : "Band not available")}</span>
        </div>
      `
    : `<div class="overview-confidence-band-state-only">${escapeHtml(liveStateText)}</div>`;
  return `
    <tr data-overview-confidence-current-row="true" data-overview-confidence-market="${escapeHtml(summary.market)}" class="${lowEvidence ? "is-low-evidence" : ""}">
      <th scope="row">
        <div class="overview-confidence-band-market-cell">
          <strong>${escapeHtml(summary.market)}</strong>
          <span class="overview-confidence-band-badge">${escapeHtml(liveBadge)}</span>
        </div>
      </th>
      <td>${liveStateHtml}</td>
      ${directional && row ? `
        <td>${escapeHtml(String(row.total_calls ?? 0))}</td>
        <td>${escapeHtml(String(row.correct ?? 0))}</td>
        <td>${escapeHtml(String(row.wrong ?? 0))}</td>
        <td>${escapeHtml(String(row.flat ?? 0))}</td>
        <td class="${lowEvidence ? "is-muted-metric" : ""}">${escapeHtml(overviewConfidenceMetricCell(row.directional_accuracy))}</td>
        <td class="${lowEvidence ? "is-muted-metric" : ""}">${escapeHtml(overviewConfidenceMetricCell(row.all_outcome_accuracy))}</td>
        <td>${escapeHtml(overviewConfidenceMetricCell(row.flat_rate))}</td>
        <td>${escapeHtml(row.evidence_quality || "Not yet available")}</td>
        <td>${escapeHtml(label)}</td>
        <td><span class="overview-confidence-band-badge ${comparisonBadge === "FALLBACK" ? "is-fallback" : "is-exact"}">${escapeHtml(comparisonBadge)}</span></td>
      ` : `
        <td colspan="9" class="overview-confidence-band-nondirectional">${escapeHtml(liveStateText)}</td>
      `}
    </tr>
  `;
}

function renderOverviewConfidenceCurrentSummaryTable(layer, summaries = []) {
  const heading = layer === "Layer 1"
    ? "Current Live Layer 1 Calls — Historical Accuracy"
    : "Current Live Layer 2 Calls — Historical Accuracy";
  const intro = layer === "Layer 1"
    ? "These rows show the currently live Layer 1 directional calls and how often comparable historical calls were correct over the following 24 hours."
    : "These rows show the currently live Layer 2 trade decisions and how often comparable historical BUY or SELL calls were correct over the following 24 hours.";
  const fallbackNote = layer === "Layer 1"
    ? "The comparison uses the same market, direction and confidence band where sufficient history exists. Broader comparisons are used only when the exact historical record is too limited, and every fallback is clearly labelled."
    : "The comparison uses the same pair, trade direction and confidence band where sufficient history exists. Broader comparisons are used only when the exact historical record is too limited, and every fallback is clearly labelled.";
  return `
    <article class="overview-confidence-band-table-panel overview-confidence-band-summary-table-panel" data-overview-confidence-current-summary="${escapeHtml(layer)}">
      <div class="overview-confidence-band-table-head">
        <div>
          <p class="eyebrow">${escapeHtml(layer)}</p>
          <h3>${escapeHtml(heading)}</h3>
        </div>
        <p class="overview-confidence-band-table-meta">How to read this section: the live call is shown first, followed by the historical delivery rate for comparable past calls. Directional accuracy excludes flat outcomes; all-outcome accuracy includes them.</p>
      </div>
      <p class="overview-confidence-band-note">${escapeHtml(intro)}</p>
      <p class="overview-confidence-band-note">${escapeHtml(fallbackNote)}</p>
      <div class="overview-confidence-band-table-scroll">
        <table class="overview-confidence-band-table overview-confidence-band-current-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Current live call</th>
              <th>Historical calls</th>
              <th>Correct</th>
              <th>Wrong</th>
              <th>Flat</th>
              <th>Directional accuracy</th>
              <th>All-outcome accuracy</th>
              <th>Flat rate</th>
              <th>Evidence quality</th>
              <th>Historical comparison used</th>
              <th>Comparison</th>
            </tr>
          </thead>
          <tbody>
            ${summaries.map((summary) => renderOverviewConfidenceCurrentSummaryRow(summary)).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderOverviewConfidenceBandTableRows(rows = [], options = {}) {
  const {
    currentMeta = null
  } = options;
  return rows.map((row) => {
    const isCurrentBand = Boolean(currentMeta?.currentBand && row.confidence_band === currentMeta.currentBand);
    const lowEvidence = Boolean(row.insufficient_historical_sample);
    return `
      <tr class="${isCurrentBand ? "is-current-band" : ""}${lowEvidence ? " is-low-evidence" : ""}" data-overview-confidence-band-row="true" data-overview-confidence-band="${escapeHtml(row.confidence_band)}">
        <th scope="row">
          <div class="overview-confidence-band-band-cell">
            <strong>${escapeHtml(row.confidence_band)}</strong>
            ${isCurrentBand ? '<span class="overview-confidence-band-row-tag">Current call band</span>' : ""}
          </div>
        </th>
        <td>${escapeHtml(String(row.total_calls ?? 0))}</td>
        <td>${escapeHtml(String(row.correct ?? 0))}</td>
        <td>${escapeHtml(String(row.wrong ?? 0))}</td>
        <td>${escapeHtml(String(row.flat ?? 0))}</td>
        <td>${escapeHtml(String(row.evaluated_directional_calls ?? 0))}</td>
        <td class="${lowEvidence ? "is-muted-metric" : ""}">${escapeHtml(overviewConfidenceMetricCell(row.directional_accuracy))}</td>
        <td class="${lowEvidence ? "is-muted-metric" : ""}">${escapeHtml(overviewConfidenceMetricCell(row.all_outcome_accuracy))}</td>
        <td>${escapeHtml(overviewConfidenceMetricCell(row.flat_rate))}</td>
        <td>${metricAvailable(row.mean_confidence) ? escapeHtml(percentValue(row.mean_confidence)) : "n/a"}</td>
        <td>${escapeHtml(row.evidence_quality || "Not yet available")}</td>
      </tr>
    `;
  }).join("");
}

function renderOverviewConfidenceBandDataTable(title, subtitle, rows = [], options = {}) {
  const {
    currentMeta = null,
    tableId = "",
    dataAttrs = ""
  } = options;
  return `
    <article class="overview-confidence-band-table-panel">
      <div class="overview-confidence-band-table-head">
        <div>
          <p class="eyebrow">${escapeHtml(subtitle)}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
      </div>
      <div class="overview-confidence-band-table-scroll">
        <table class="overview-confidence-band-table" ${tableId ? `id="${escapeHtml(tableId)}"` : ""} ${dataAttrs}>
          <thead>
            <tr>
              <th>Confidence band</th>
              <th>Historical calls</th>
              <th>Correct</th>
              <th>Wrong</th>
              <th>Flat</th>
              <th>Evaluated directional calls</th>
              <th>Directional accuracy</th>
              <th>All-outcome accuracy</th>
              <th>Flat rate</th>
              <th>Average confidence</th>
              <th>Evidence quality</th>
            </tr>
          </thead>
          <tbody>${renderOverviewConfidenceBandTableRows(rows, { currentMeta })}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderOverviewConfidenceStrengthTable(title, subtitle, rows = []) {
  return `
    <article class="overview-confidence-band-table-panel">
      <div class="overview-confidence-band-table-head">
        <div>
          <p class="eyebrow">${escapeHtml(subtitle)}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
      </div>
      <div class="overview-confidence-band-table-scroll">
        <table class="overview-confidence-band-table" data-overview-confidence-strength-table="true" data-overview-confidence-analysis-table="strength">
          <thead>
            <tr>
              <th>Strength band</th>
              <th>Historical calls</th>
              <th>Correct</th>
              <th>Wrong</th>
              <th>Flat</th>
              <th>Directional accuracy</th>
              <th>All-outcome accuracy</th>
              <th>Flat rate</th>
              <th>Evidence quality</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
              const lowEvidence = Boolean(row.insufficient_historical_sample);
              return `
                <tr class="${lowEvidence ? "is-low-evidence" : ""}">
                  <th scope="row">${escapeHtml(row.strength_label || row.strength_key || "Not yet available")}</th>
                  <td>${escapeHtml(String(row.total_calls ?? 0))}</td>
                  <td>${escapeHtml(String(row.correct ?? 0))}</td>
                  <td>${escapeHtml(String(row.wrong ?? 0))}</td>
                  <td>${escapeHtml(String(row.flat ?? 0))}</td>
                  <td class="${lowEvidence ? "is-muted-metric" : ""}">${escapeHtml(overviewConfidenceMetricCell(row.directional_accuracy))}</td>
                  <td class="${lowEvidence ? "is-muted-metric" : ""}">${escapeHtml(overviewConfidenceMetricCell(row.all_outcome_accuracy))}</td>
                  <td>${escapeHtml(overviewConfidenceMetricCell(row.flat_rate))}</td>
                  <td>${escapeHtml(row.evidence_quality || "Not yet available")}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderOverviewConfidenceAsymmetryTable(title, subtitle, rows = [], options = {}) {
  const {
    bullishLabel = "Bullish",
    bearishLabel = "Bearish"
  } = options;
  if (!rows.length) {
    return `
      <article class="overview-confidence-band-table-panel">
        <div class="panel-head compact-panel-head">
          <div>
            <p class="eyebrow">${escapeHtml(subtitle)}</p>
            <h3>${escapeHtml(title)}</h3>
          </div>
        </div>
        <div class="empty-state">No asymmetry rows met the minimum evaluated-call threshold on both sides.</div>
      </article>
    `;
  }

  return `
    <article class="overview-confidence-band-table-panel">
      <div class="overview-confidence-band-table-head">
        <div>
          <p class="eyebrow">${escapeHtml(subtitle)}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <p class="overview-confidence-band-table-meta">Rows are shown only when both directions have at least 30 evaluated directional calls in the same confidence band.</p>
      </div>
      <div class="overview-confidence-band-table-scroll">
        <table class="overview-confidence-band-table" data-overview-confidence-asymmetry-table="true" data-overview-confidence-analysis-table="asymmetry">
          <thead>
            <tr>
              <th>Market</th>
              <th>Confidence band</th>
              <th>${escapeHtml(bullishLabel)} directional accuracy</th>
              <th>${escapeHtml(bearishLabel)} directional accuracy</th>
              <th>Difference</th>
              <th>${escapeHtml(bullishLabel)} historical calls</th>
              <th>${escapeHtml(bearishLabel)} historical calls</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <th scope="row">${escapeHtml(row.market || row.market_key || "Not yet available")}</th>
                <td>${escapeHtml(row.confidence_band || "Not yet available")}</td>
                <td>${escapeHtml(overviewConfidenceMetricCell(row.bullish_directional_accuracy))}</td>
                <td>${escapeHtml(overviewConfidenceMetricCell(row.bearish_directional_accuracy))}</td>
                <td>${metricAvailable(row.difference_pct_points) ? `${row.difference_pct_points > 0 ? "+" : ""}${escapeHtml(percentValue(row.difference_pct_points))}` : "n/a"}</td>
                <td>${escapeHtml(String(row.bullish_historical_calls ?? 0))}</td>
                <td>${escapeHtml(String(row.bearish_historical_calls ?? 0))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderOverviewConfidenceNoTradeSummary(noTradeRow = null) {
  if (!noTradeRow) return "";
  return `
    <div class="overview-confidence-band-mini-note">
      <strong>NO TRADE summary:</strong>
      ${escapeHtml(String(noTradeRow.no_trade_outcomes ?? 0))} NO TRADE outcomes,
      ${metricAvailable(noTradeRow.no_trade_rate) ? escapeHtml(percentValue(noTradeRow.no_trade_rate)) : "n/a"} of all Layer 2 observations for this pair.
    </div>
  `;
}

function renderOverviewConfidenceSelectorGroup(title, buttonsHtml, options = {}) {
  const note = options.note ? `<p class="overview-confidence-band-selector-note">${escapeHtml(options.note)}</p>` : "";
  return `
    <div class="overview-confidence-band-selector-group">
      <div class="overview-confidence-band-selector-head">
        <strong>${escapeHtml(title)}</strong>
        ${note}
      </div>
      <div class="overview-confidence-band-chip-row">${buttonsHtml}</div>
    </div>
  `;
}

function renderOverviewConfidenceLayer1Tab(contract, state) {
  const currentMeta = currentConfidenceMetaForMarket(contract, "Layer 1", state.layer1Market);
  const rows = overviewConfidenceBandRowsByScope(
    contract,
    state.layer1Direction === "BOTH" ? "market_band_both_directions" : "exact_market_direction",
    "Layer 1",
    state.layer1Market,
    state.layer1Direction === "BOTH" ? "BOTH" : state.layer1Direction
  );
  const marketButtons = (contract.coverage?.layer1_markets || []).map((marketKey) =>
    overviewConfidenceButton({
      label: marketKey,
      value: marketKey,
      active: state.layer1Market === marketKey,
      dataAttr: "data-overview-confidence-layer1-market"
    })
  ).join("");
  const currentDirection = currentMeta?.deliveryDirection || "";
  const directionButtons = ["BULLISH", "BEARISH", "BOTH"].map((direction) =>
    overviewConfidenceButton({
      label: direction === "BOTH" ? "Both directions" : direction,
      value: direction,
      active: state.layer1Direction === direction,
      currentLive: direction !== "BOTH" && direction === currentDirection,
      dataAttr: "data-overview-confidence-layer1-direction"
    })
  ).join("");

  return `
    <div class="overview-confidence-band-analysis-section" data-overview-confidence-analysis="layer1">
      <p class="overview-confidence-band-note">Layer 1 tables show exact historical rows for each market, direction, and confidence band under the locked following-24-hours checker contract. BULLISH_LEAN is evaluated with BULLISH, and BEARISH_LEAN is evaluated with BEARISH.</p>
      ${renderOverviewConfidenceSelectorGroup("Market", marketButtons)}
      ${renderOverviewConfidenceSelectorGroup("Direction", directionButtons, { note: currentDirection ? `${state.layer1Market} is currently ${currentDirection}.` : `${state.layer1Market} has no active directional call.` })}
      ${renderOverviewConfidenceBandDataTable(
        `${state.layer1Market} ${overviewConfidenceDirectionLabel(state.layer1Direction, "Layer 1")} historical accuracy`,
        "Layer 1 full historical accuracy",
        rows,
        {
          currentMeta,
          tableId: "overviewLayer1HistoricalAccuracyTable",
          dataAttrs: 'data-overview-confidence-analysis-table="layer1"'
        }
      )}
    </div>
  `;
}

function renderOverviewConfidenceLayer2Tab(contract, state) {
  const currentMeta = currentConfidenceMetaForMarket(contract, "Layer 2", state.layer2Pair);
  const rows = overviewConfidenceBandRowsByScope(
    contract,
    state.layer2Direction === "BOTH" ? "market_band_both_directions" : "exact_market_direction",
    "Layer 2",
    state.layer2Pair,
    state.layer2Direction === "BOTH" ? "BOTH" : state.layer2Direction
  );
  const pairButtons = (contract.coverage?.layer2_pairs || []).map((pairKey) =>
    overviewConfidenceButton({
      label: pairKey.replaceAll("_", "/"),
      value: pairKey,
      active: state.layer2Pair === pairKey,
      dataAttr: "data-overview-confidence-layer2-pair"
    })
  ).join("");
  const currentDirection = currentMeta?.deliveryDirection || "";
  const directionButtons = ["BUY", "SELL", "BOTH"].map((direction) =>
    overviewConfidenceButton({
      label: direction === "BOTH" ? "Both trade directions" : direction,
      value: direction,
      active: state.layer2Direction === direction,
      currentLive: direction !== "BOTH" && direction === currentDirection,
      dataAttr: "data-overview-confidence-layer2-direction"
    })
  ).join("");
  const noTradeRow = contract.noTradeRows.find((row) => String(row.market_key || "") === String(state.layer2Pair || ""));

  return `
    <div class="overview-confidence-band-analysis-section" data-overview-confidence-analysis="layer2">
      <p class="overview-confidence-band-note">Layer 2 tables show exact historical rows for BUY, SELL, and combined trade directions. NO TRADE stays outside directional-accuracy calculations and is summarised separately.</p>
      ${renderOverviewConfidenceSelectorGroup("Pair", pairButtons)}
      ${renderOverviewConfidenceSelectorGroup("Trade direction", directionButtons, { note: currentDirection ? `${state.layer2Pair.replaceAll("_", "/")} is currently ${currentDirection}.` : `${state.layer2Pair.replaceAll("_", "/")} is currently NO TRADE.` })}
      ${renderOverviewConfidenceNoTradeSummary(noTradeRow)}
      ${renderOverviewConfidenceBandDataTable(
        `${state.layer2Pair.replaceAll("_", "/")} ${overviewConfidenceDirectionLabel(state.layer2Direction, "Layer 2")} historical accuracy`,
        "Layer 2 full historical accuracy",
        rows,
        {
          currentMeta,
          tableId: "overviewLayer2HistoricalAccuracyTable",
          dataAttrs: 'data-overview-confidence-analysis-table="layer2"'
        }
      )}
    </div>
  `;
}

function renderOverviewConfidenceStrengthTab(contract, state) {
  const layer = state.strengthLayer;
  const entityKey = state.strengthEntityKey;
  const pooledKey = layer === "Layer 2" ? "LAYER2_POOLED" : "LAYER1_POOLED";
  const entityButtons = [
    overviewConfidenceButton({
      label: "Pooled",
      value: pooledKey,
      active: entityKey === pooledKey,
      dataAttr: "data-overview-confidence-strength-entity"
    }),
    ...((layer === "Layer 2" ? contract.coverage?.layer2_pairs : contract.coverage?.layer1_markets) || []).map((key) =>
      overviewConfidenceButton({
        label: layer === "Layer 2" ? key.replaceAll("_", "/") : key,
        value: key,
        active: entityKey === key,
        dataAttr: "data-overview-confidence-strength-entity"
      })
    )
  ].join("");
  const rows = contract.strengthRows
    .filter((row) =>
      String(row.layer || "") === layer
      && String(row.market_key || "") === entityKey
      && (
        (entityKey.startsWith("LAYER") && row.scope_type === "pooled_strength_band")
        || (!entityKey.startsWith("LAYER") && row.scope_type === "entity_strength_band")
      )
    )
    .slice()
    .sort((left, right) => ["Weak", "Moderate", "Strong", "Very Strong"].indexOf(left.strength_label) - ["Weak", "Moderate", "Strong", "Very Strong"].indexOf(right.strength_label));
  const layerButtons = ["Layer 1", "Layer 2"].map((layerLabel) =>
    overviewConfidenceButton({
      label: layerLabel,
      value: layerLabel,
      active: layer === layerLabel,
      dataAttr: "data-overview-confidence-strength-layer"
    })
  ).join("");
  const titleTarget = entityKey.startsWith("LAYER") ? (layer === "Layer 2" ? "Pooled Layer 2 reference" : "Pooled Layer 1 reference") : (layer === "Layer 2" ? entityKey.replaceAll("_", "/") : entityKey);

  return `
    <div class="overview-confidence-band-analysis-section" data-overview-confidence-analysis="strength">
      <p class="overview-confidence-band-note">Strength-band accuracy uses the current production Weak, Moderate, Strong, and Very Strong thresholds without altering live scoring. Market-specific and pair-specific rows are available alongside pooled references.</p>
      ${renderOverviewConfidenceSelectorGroup("Layer", layerButtons)}
      ${renderOverviewConfidenceSelectorGroup(layer === "Layer 2" ? "Pair scope" : "Market scope", entityButtons)}
      ${renderOverviewConfidenceStrengthTable(`${titleTarget} strength-band accuracy`, "Strength-band accuracy", rows)}
    </div>
  `;
}

function renderOverviewConfidenceAsymmetryTab(contract, state) {
  const layer = state.asymmetryLayer;
  const rows = contract.asymmetryRows
    .filter((row) => String(row.layer || "") === layer && row.adequate_evidence)
    .slice()
    .sort((left, right) => Math.abs(Number(right.difference_pct_points || 0)) - Math.abs(Number(left.difference_pct_points || 0)));
  const layerButtons = ["Layer 1", "Layer 2"].map((layerLabel) =>
    overviewConfidenceButton({
      label: layerLabel,
      value: layerLabel,
      active: layer === layerLabel,
      dataAttr: "data-overview-confidence-asymmetry-layer"
    })
  ).join("");

  return `
    <div class="overview-confidence-band-analysis-section" data-overview-confidence-analysis="asymmetry">
      <p class="overview-confidence-band-note">Directional asymmetry is shown only when both sides have at least 30 evaluated directional calls in the same confidence band. This keeps small-sample spikes from being overemphasised.</p>
      ${renderOverviewConfidenceSelectorGroup("Layer", layerButtons)}
      ${renderOverviewConfidenceAsymmetryTable(
        `${layer} directional asymmetry`,
        "Directional asymmetry",
        rows,
        layer === "Layer 2" ? { bullishLabel: "BUY", bearishLabel: "SELL" } : { bullishLabel: "Bullish", bearishLabel: "Bearish" }
      )}
    </div>
  `;
}

function renderOverviewConfidencePooledTab(contract, state) {
  const layer = state.pooledLayer;
  const pooledKey = layer === "Layer 2" ? "LAYER2_POOLED" : "LAYER1_POOLED";
  const rows = overviewConfidenceBandRowsByScope(contract, "pooled_layer_band", layer, pooledKey, "BOTH");
  const layerButtons = ["Layer 1", "Layer 2"].map((layerLabel) =>
    overviewConfidenceButton({
      label: layerLabel,
      value: layerLabel,
      active: layer === layerLabel,
      dataAttr: "data-overview-confidence-pooled-layer"
    })
  ).join("");

  return `
    <div class="overview-confidence-band-analysis-section" data-overview-confidence-analysis="pooled">
      <p class="overview-confidence-band-note">These pooled tables remain secondary reference only. They aggregate all markets within the layer and are not market-specific.</p>
      ${renderOverviewConfidenceSelectorGroup("Layer", layerButtons)}
      ${renderOverviewConfidenceBandDataTable(
        layer === "Layer 2" ? "Pooled Layer 2 reference" : "Pooled Layer 1 reference",
        "Pooled reference",
        rows,
        {
          currentMeta: null,
          tableId: layer === "Layer 2" ? "overviewPooledLayer2Table" : "overviewPooledLayer1Table",
          dataAttrs: 'data-overview-confidence-analysis-table="pooled"'
        }
      )}
    </div>
  `;
}

function renderOverviewConfidenceAnalysisTab(contract, state) {
  if (state.activeTab === "layer1") return renderOverviewConfidenceLayer1Tab(contract, state);
  if (state.activeTab === "layer2") return renderOverviewConfidenceLayer2Tab(contract, state);
  if (state.activeTab === "strength") return renderOverviewConfidenceStrengthTab(contract, state);
  if (state.activeTab === "asymmetry") return renderOverviewConfidenceAsymmetryTab(contract, state);
  return renderOverviewConfidencePooledTab(contract, state);
}

function attachOverviewConfidenceBandInteractions(container, contract) {
  if (container.dataset.overviewConfidenceBound === "true") return;
  container.dataset.overviewConfidenceBound = "true";

  container.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    const state = getOverviewConfidenceDashboardState(contract);

    if (target.dataset.overviewConfidenceTab) {
      state.activeTab = target.dataset.overviewConfidenceTab;
    } else if (target.dataset.overviewConfidenceLayer1Market) {
      state.layer1Market = target.dataset.overviewConfidenceLayer1Market;
    } else if (target.dataset.overviewConfidenceLayer1Direction) {
      state.layer1Direction = target.dataset.overviewConfidenceLayer1Direction;
    } else if (target.dataset.overviewConfidenceLayer2Pair) {
      state.layer2Pair = target.dataset.overviewConfidenceLayer2Pair;
    } else if (target.dataset.overviewConfidenceLayer2Direction) {
      state.layer2Direction = target.dataset.overviewConfidenceLayer2Direction;
    } else if (target.dataset.overviewConfidenceStrengthLayer) {
      state.strengthLayer = target.dataset.overviewConfidenceStrengthLayer;
      state.strengthEntityKey = state.strengthLayer === "Layer 2" ? "LAYER2_POOLED" : "LAYER1_POOLED";
    } else if (target.dataset.overviewConfidenceStrengthEntity) {
      state.strengthEntityKey = target.dataset.overviewConfidenceStrengthEntity;
    } else if (target.dataset.overviewConfidenceAsymmetryLayer) {
      state.asymmetryLayer = target.dataset.overviewConfidenceAsymmetryLayer;
    } else if (target.dataset.overviewConfidencePooledLayer) {
      state.pooledLayer = target.dataset.overviewConfidencePooledLayer;
    } else {
      return;
    }

    renderOverviewConfidenceBandPanel();
  });
}

function renderOverviewConfidenceBandPanel() {
  const container = document.getElementById("overviewConfidenceBandPanel");
  if (!container) return;

  if (!layer1Data || !layer2Data || !confidenceBandDeliveryData) {
    container.innerHTML = `
      <div class="panel-head compact-panel-head">
        <div>
          <p class="eyebrow">Historical Confidence-Band Accuracy</p>
          <h3>Historical market accuracy by confidence band</h3>
        </div>
      </div>
      <div class="empty-state overview-confidence-band-empty">Historical confidence-band delivery is not yet available from the local research artifact.</div>
    `;
    return;
  }

  const contract = normalizeConfidenceBandRows(confidenceBandDeliveryData);
  const state = getOverviewConfidenceDashboardState(contract);
  attachOverviewConfidenceBandInteractions(container, contract);

  const layer1Summaries = (layer1Data.agents || []).map((agent) => overviewConfidenceCurrentLayer1Meta(agent, contract));
  const layer2Summaries = (layer2Data.pairs || []).map((pair) => overviewConfidenceCurrentLayer2Meta(pair, contract));
  const tabs = [
    { key: "layer1", label: "Layer 1" },
    { key: "layer2", label: "Layer 2" },
    { key: "strength", label: "Strength Bands" },
    { key: "asymmetry", label: "Directional Asymmetry" },
    { key: "pooled", label: "Pooled Reference" }
  ];

  container.innerHTML = `
    <div class="panel-head compact-panel-head">
      <div>
        <p class="eyebrow">Current Live Calls and Historical Accuracy</p>
        <h3>Current Live Calls and Historical Accuracy</h3>
      </div>
    </div>
    <p class="overview-confidence-band-note">Today’s live directional calls compared with the full historical accuracy record under the locked following-24-hours contract.</p>
    <p class="overview-confidence-band-note">Confidence is the model's internal conviction score, not a guaranteed probability. Historical performance is shown for information only and does not feed back into live call generation.</p>
    <p class="overview-confidence-band-note">Forecast horizon: ${escapeHtml(contract.timeframe)}. Checker contract: ${escapeHtml(contract.checkerContract)}.</p>
    <div class="overview-confidence-band-summary-shell">
      <div class="overview-confidence-band-summary-stack">
        ${renderOverviewConfidenceCurrentSummaryTable("Layer 1", layer1Summaries)}
        ${renderOverviewConfidenceCurrentSummaryTable("Layer 2", layer2Summaries)}
      </div>
    </div>
    <div class="overview-confidence-band-analysis-shell" data-overview-confidence-dashboard="true">
      <div class="overview-confidence-band-tab-row" role="tablist" aria-label="Historical accuracy sections">
        ${tabs.map((tab) => `
          <button
            type="button"
            role="tab"
            class="overview-confidence-band-tab${state.activeTab === tab.key ? " is-active" : ""}"
            aria-selected="${state.activeTab === tab.key ? "true" : "false"}"
            data-overview-confidence-tab="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</button>
        `).join("")}
      </div>
      ${renderOverviewConfidenceAnalysisTab(contract, state)}
    </div>
  `;
}

function cleanDecisionReason(reason = "") {
  return String(reason || "")
    .replaceAll("_", " ")
    .replace(/^(24h|3d|current week|next week|current month)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";

  const match = text.match(/^(.+?[.!?])(?:\s|$)/);
  return (match ? match[1] : text).trim();
}

function factorEntriesFrom(value) {
  const factorObj = asObject(value, {});
  return Object.entries(factorObj)
    .map(([name, raw]) => {
      const detail = typeof raw === "object" && raw !== null ? raw : { signal: String(raw) };
      const signal = detail.signal || "NEUTRAL";
      return {
        name,
        signal,
        evidence: detail.evidence || "",
        reason: detail.reason || "",
        weight: Number.isFinite(Number(detail.weight)) ? Number(detail.weight) : null
      };
    })
    .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0));
}

function getTodayFactors(agent, options = {}) {
  const includeMissing = options.includeMissing === true;
  const today = getCall(agent, "24h");
  const entries = factorEntriesFrom(today.factor_breakdown || agent.factor_breakdown || {});
  return includeMissing ? entries : entries.filter(entry => !factorHasMissingInputSignal(entry));
}

function splitTodayDrivers(agent) {
  const factors = getTodayFactors(agent);

  return {
    bullish: factors.filter(f => signalClass(f.signal) === "bullish"),
    bearish: factors.filter(f => signalClass(f.signal) === "bearish"),
    neutral: factors.filter(f => !["bullish", "bearish"].includes(signalClass(f.signal)))
  };
}

function renderDriverList(drivers, emptyText) {
  if (!drivers.length) {
    return `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
  }

  return drivers.map(driver => `
    <div class="driver-row">
      <div>
        <strong>${escapeHtml(driver.name)}</strong>
        ${driver.evidence ? `<p>${escapeHtml(driver.evidence)}</p>` : ""}
        ${driver.reason ? `<small>${escapeHtml(driver.reason)}</small>` : ""}
      </div>
      <span class="signal-pill ${signalClass(driver.signal)}">${escapeHtml(driver.signal)}</span>
    </div>
  `).join("");
}

function renderNeutralDrivers(drivers) {
  if (!drivers.length) return "";

  return `
    <details class="neutral-drivers">
      <summary>${drivers.length} neutral or inactive drivers</summary>
      <div class="driver-list muted-list">
        ${renderDriverList(drivers, "No neutral drivers.")}
      </div>
    </details>
  `;
}

function decisionFallbackSentence(agent) {
  const today = getCall(agent, "24h");
  const drivers = splitTodayDrivers(agent);
  const direction = normaliseDirection(today.direction).toLowerCase();
  const leading = today.direction && !String(today.direction).toLowerCase().includes("no clear")
    ? `${escapeHtml(agent.agent)} is ${escapeHtml(direction)} today`
    : `${escapeHtml(agent.agent)} has no clear 24H bias today`;

  const bullishNames = drivers.bullish.slice(0, 2).map(driver => driver.name).join(", ");
  const bearishNames = drivers.bearish.slice(0, 2).map(driver => driver.name).join(", ");

  if (bullishNames && bearishNames) {
    return `${leading} because ${escapeHtml(bullishNames)} outweighs or offsets ${escapeHtml(bearishNames)}.`;
  }
  if (bullishNames) return `${leading} because ${escapeHtml(bullishNames)} is supporting the 24H call.`;
  if (bearishNames) return `${leading} because ${escapeHtml(bearishNames)} is pressuring the 24H call.`;
  return `${leading}; no active 24H driver explanation was supplied.`;
}

function todayExplanation(agent) {
  const today = getCall(agent, "24h");
  const cleaned = firstSentence(cleanDecisionReason(today.reason));

  if (cleaned && cleaned.length > 32) return cleaned;
  return decisionFallbackSentence(agent);
}

function participationValue(call) {
  const model = call.conviction_model || {};
  return Number(
    model.directional_participation_pct ??
    model.active_participation_pct ??
    model.participation ??
    NaN
  );
}

function describeEventRisk(event) {
  if (!event) return "No explicit event risk supplied by Layer 1.";
  if (typeof event === "string") return firstSentence(event).slice(0, 220);

  const eventName = event.event || event.name || event.event_name || "event";
  const currency = event.currency ? `${event.currency} ` : "";
  const surprise = event.surprise ? `surprise: ${event.surprise}` : "";
  const signal = event.usd_signal || event.eur_signal || event.signal || "";
  const parts = [`${currency}${eventName}`, surprise, signal].filter(Boolean);

  return parts.length ? `Event context present: ${parts.join(" | ")}` : "Event context present.";
}

function renderTodayCall(agent) {
  const today = getCall(agent, "24h");
  const confidence = confidenceValue(today, agent, "24h");
  const assetUpdated = getAgentUpdatedAt(agent);
  const strength = confidenceStrength(today, agent, "24h") || "Not supplied";

  return `
    <section class="today-call-panel">
      <div class="today-copy">
        <p class="eyebrow">Today's Trading Bias</p>
        <h2>${escapeHtml(agent.agent)}</h2>
        <div class="today-meta">
          <span><strong>Timeframe:</strong> 24H only</span>
          <span><strong>Strength:</strong> ${escapeHtml(strength)}</span>
          <span><strong>Last updated:</strong> ${escapeHtml(formatDashboardTime(assetUpdated))}${formatRelativeAge(assetUpdated) ? ` | ${escapeHtml(formatRelativeAge(assetUpdated))}` : ""}</span>
        </div>
      </div>

      <div class="today-signal-card">
        <span>24H only</span>
        <strong class="direction ${directionClass(today.direction)}">${normaliseDirection(today.direction)}</strong>
        <b>${formatConviction(confidence)}</b>
        <small>Confidence in the current trading-session bias</small>
      </div>
      ${renderEventCollectorAgentWarning(agent, "24h")}
    </section>
  `;
}

function renderExecutiveSummary(agent) {
  return `
    <article class="detail-panel wide-panel executive-summary-panel">
      <div class="panel-head">
        <p class="eyebrow">Executive Summary</p>
        <h3>Today, Is This Asset More Likely Bullish Or Bearish?</h3>
      </div>
      <p class="today-answer compact-answer">${escapeHtml(todayExplanation(agent))}</p>
    </article>
  `;
}

function renderTodayDrivers(agent) {
  const drivers = splitTodayDrivers(agent);

  return `
    <article class="detail-panel wide-panel today-drivers-panel">
      <div class="panel-head">
        <p class="eyebrow">Why Today's Call Was Made</p>
        <h3>Active 24H Drivers</h3>
      </div>

      <div class="driver-columns">
        <section>
          <h4>Bullish Drivers</h4>
          <div class="driver-list">${renderDriverList(drivers.bullish, "No bullish drivers affected today's call.")}</div>
        </section>
        <section>
          <h4>Bearish Drivers</h4>
          <div class="driver-list">${renderDriverList(drivers.bearish, "No bearish drivers affected today's call.")}</div>
        </section>
      </div>

      ${renderNeutralDrivers(drivers.neutral)}
    </article>
  `;
}

function renderInvalidationPanel(agent) {
  return renderStructuredDiagnostics(agent, "24h");
}

function renderStructuredDiagnostics(agent, timeframe = "24h") {
  const call = getCall(agent, timeframe);
  const output = asObject(agent.full_output || agent.raw_agent_output, {});
  const marketInputs = asObject(agent.market_inputs || output.market_inputs_seen_by_workflow, {});
  const diagnostics = classifyDiagnostics(call, agent, timeframe);

  const participation = participationValue(call);
  const latestEvent = marketInputs.latest_us_event || marketInputs.latest_ez_event || null;
  const eventText = describeEventRisk(latestEvent);
  const statusLines = [
    diagnostics.analysisStatus.analysisCompleted ? "Analysis completed" : "Analysis pending",
    diagnostics.analysisStatus.confidenceCalculated ? "Confidence calculated" : "Confidence not available",
    diagnostics.analysisStatus.mandatoryOk ? "All mandatory inputs available" : "Critical inputs missing",
    diagnostics.analysisStatus.criticalMissing.length ? `Critical inputs missing: ${diagnostics.analysisStatus.criticalMissing.join(", ")}` : "No critical missing inputs"
  ];

  if (Number.isFinite(participation) && participation < 35) {
    statusLines.push(`Low ${String(timeframe).replaceAll("_", " ").toUpperCase()} participation: only ${participation}% of weighted evidence is directional.`);
  }

  if (agentImpactedByEconomicEventsCollector(agent, timeframe)) {
    statusLines.push(`Economic Events Collector failed in the latest workflow run. ${impactedEventContextLabels(agent, timeframe).join(" and ")} may be incomplete for this call.`);
  }

  const sectionHtml = (title, items, emptyText, variant = "") => `
    <section class="diagnostic-section ${variant}">
      <h4>${escapeHtml(title)}</h4>
      ${items.length
        ? `<div class="diagnostic-list">${items.map(item => `<div class="diagnostic-item">${escapeHtml(item)}</div>`).join("")}</div>`
        : `<div class="empty-state">${escapeHtml(emptyText)}</div>`}
    </section>
  `;

  return `
    <article class="detail-panel wide-panel invalidation-panel">
      <div class="panel-head">
        <p class="eyebrow">Analysis Diagnostics</p>
        <h3>What This Call Used</h3>
      </div>
      <div class="diagnostic-sections">
        ${sectionHtml("Analysis Status", statusLines, "No analysis status available.", "diagnostic-status")}
        ${sectionHtml("Fallbacks Used", diagnostics.fallbacksUsed, "No fallbacks used in today's 24H analysis.")}
        ${sectionHtml("Collector Health", diagnostics.collectorHealth, "No collector health gaps surfaced for today's 24H view.")}
        <div class="event-risk-note">${escapeHtml(eventText)}</div>
      </div>
    </article>
  `;
}

function renderSecondaryTimeframes(agent) {
  const timeframeKeys = ["3d", "current_week", "next_week", "current_month"];

  return timeframeKeys.map(tf => {
    const call = getCall(agent, tf);
    const confidence = confidenceValue(call, agent, tf);
    const timeframeModel = getTimeframeModel(agent, tf);
    const explicitReason = [
      call.reason,
      timeframeModel.reason,
      call?.conviction_model?.final_conviction_logic,
      timeframeModel?.conviction_model?.final_conviction_logic
    ]
      .map(value => cleanDecisionReason(value))
      .find(Boolean);
    const fallbackReason = explicitReason || deriveEvidenceSummary(call, agent, tf);
    return `
      <div class="secondary-timeframe-card">
        <span class="timeframe">${labels[tf] || tf}</span>
        <strong class="direction ${directionClass(call.direction)}">${normaliseDirection(call.direction)}</strong>
        <b>${formatConviction(confidence)}</b>
        <p>${escapeHtml(firstSentence(fallbackReason) || "No reason supplied.")}</p>
      </div>
    `;
  }).join("");
}

function renderRawModelDetails(agent) {
  const today = getCall(agent, "24h");
  const model = today.conviction_model || agent.conviction_model || {};
  const output = asObject(agent.full_output || agent.raw_agent_output, {});
  const bullish = agent.score_bullish ?? output.score_bullish ?? "--";
  const bearish = agent.score_bearish ?? output.score_bearish ?? "--";
  const neutral = agent.score_neutral ?? output.score_neutral ?? "--";

  return `
    <article class="detail-panel wide-panel raw-model-panel">
      <div class="panel-head">
        <p class="eyebrow">Raw Model Details</p>
        <h3>Source Values</h3>
      </div>
      <details class="raw-model-details">
        <summary>Show raw details</summary>
        <div class="raw-detail-grid">
          <p><strong>Bullish factors:</strong> ${escapeHtml(bullish)}</p>
          <p><strong>Bearish factors:</strong> ${escapeHtml(bearish)}</p>
          <p><strong>Neutral factors:</strong> ${escapeHtml(neutral)}</p>
          <p><strong>Winning side:</strong> ${escapeHtml(model.winning_side || "--")}</p>
          <p><strong>Participation:</strong> ${formatModelPercent(model.directional_participation_pct)}</p>
          <p><strong>Net edge:</strong> ${model.net_edge_pct ?? "--"}%</p>
        </div>
      </details>
    </article>
  `;
}

function renderCallMatrix(agent) {
  return renderSecondaryTimeframes(agent);
}

function renderFactorRows(agent) {
  const entries = getTodayFactors(agent);

  if (!entries.length && Array.isArray(agent.key_factors)) {
    return agent.key_factors.map(f => `
      <div class="factor-row">
        <div><strong>${escapeHtml(f)}</strong></div>
        <span class="signal-pill neutral">INFO</span>
      </div>
    `).join("");
  }

  return renderDriverList(entries, "No factor breakdown available yet.");
}

function valueOrPending(value) {
  return value === null || value === undefined || value === "" ? "pending" : value;
}

function formatModelPercent(value) {
  if (value === null || value === undefined || value === "") return "pending";

  const n = Number(value);
  if (!Number.isFinite(n)) return escapeHtml(value);

  return `${n <= 1 ? Math.round(n * 100) : Math.round(n)}%`;
}

function renderScoreBreakdown(agent) {
  const output = getOutput(agent);
  const today = getCall(agent, "24h");
  const model = agent.conviction_model || output.conviction_model || {};

  const bullish = agent.score_bullish ?? output.score_bullish ?? "--";
  const bearish = agent.score_bearish ?? output.score_bearish ?? "--";
  const neutral = agent.score_neutral ?? output.score_neutral ?? "--";

  const bullCase = model.bullish_argument_pct;
  const bearCase = model.bearish_argument_pct;
  const neutralPct = model.neutral_pct;
  const netEdge = model.net_edge_pct;
  const confidence = confidenceValue(today, agent, "24h");
  const participation = model.directional_participation_pct;
  const winningSide = model.winning_side;
  const verdictStrength = confidenceStrength(today, agent, "24h");

  return `
    <div class="score-grid">
      <div class="score-box"><span>Bullish Factors</span><strong>${bullish}</strong></div>
      <div class="score-box"><span>Bearish Factors</span><strong>${bearish}</strong></div>
      <div class="score-box"><span>Neutral Factors</span><strong>${neutral}</strong></div>
      <div class="score-box"><span>Winning Side</span><strong>${winningSide || "--"}</strong></div>
    </div>

    <div class="conviction-model">
      <p><strong>Bull Case:</strong> ${formatModelPercent(bullCase)}</p>
      <p><strong>Bear Case:</strong> ${formatModelPercent(bearCase)}</p>
      <p><strong>Confidence:</strong> ${formatModelPercent(confidence)}</p>
      <p><strong>Net Edge:</strong> ${netEdge ?? "--"}%</p>
      <p><strong>Participation:</strong> ${formatModelPercent(participation)}</p>
      <p><strong>Neutral factors:</strong> ${formatModelPercent(neutralPct)}</p>
      <p><strong>Strength:</strong> ${verdictStrength || "--"}</p>
      <p><strong>Model Logic:</strong> ${escapeHtml(model.final_conviction_logic ?? "No confidence model supplied yet.")}</p>
    </div>
  `;
}

function renderAgentDetailLegacy(agentName) {
  renderAgentDetail(agentName);
  return;

  const view = document.getElementById("agentView");
  const agent = getAgent(agentName);

  if (!view) return;

  if (!agent) {
    view.innerHTML = `
      <section class="detail-shell">
        <div class="empty-state">No ${escapeHtml(agentName)} agent output available yet.</div>
      </section>
    `;
    return;
  }

  const call24 = getCall(agent, "24h");
  const dashboardUpdated = getDashboardUpdatedAt();
  const assetUpdated = getAgentUpdatedAt(agent);

  const warnings = asArray(agent.warnings)
    .map(w => `<div class="warning-card">⚠ ${escapeHtml(w)}</div>`)
    .join("") || `<div class="empty-state">No warnings reported.</div>`;

  view.innerHTML = `
    <section class="agent-detail-hero">
      <div>
        <p class="eyebrow">Layer 1 Independent Agent</p>
        <h2>${escapeHtml(agent.agent)} Direction Engine</h2>
        <p class="subcopy">${escapeHtml(agent.summary || "Raw directional agent output.")}</p>

        <div class="update-strip">
          <span><strong>Last asset update:</strong> ${escapeHtml(formatDashboardTime(assetUpdated))}${formatRelativeAge(assetUpdated) ? ` · ${escapeHtml(formatRelativeAge(assetUpdated))}` : ""}</span>
          <span><strong>Last n8n ingest:</strong> ${escapeHtml(formatDashboardTime(dashboardUpdated))}${formatRelativeAge(dashboardUpdated) ? ` · ${escapeHtml(formatRelativeAge(dashboardUpdated))}` : ""}</span>
        </div>
      </div>

      <div class="signal-tower">
        <span>24H Call</span>
        <strong class="direction ${directionClass(call24.direction)}">${normaliseDirection(call24.direction)}</strong>
        <b>${formatConviction(confidenceValue(call24, agent, "24h"))}</b>
        <small>Last asset update: ${escapeHtml(formatDashboardTime(assetUpdated))}</small>
      </div>
    </section>

    <section class="detail-grid">
      <article class="detail-panel wide-panel">
        <div class="panel-head">
          <p class="eyebrow">Other Timeframes</p>
          <h3>Directional Calls</h3>
        </div>
        <div class="detail-call-grid">${renderCallMatrix(agent)}</div>
      </article>

      <article class="detail-panel">
        <div class="panel-head">
          <p class="eyebrow">Factor Engine</p>
          <h3>Metrics Being Read</h3>
        </div>
        <div class="factor-table">${renderFactorRows(agent)}</div>
      </article>

      <article class="detail-panel">
        <div class="panel-head">
          <p class="eyebrow">Confidence</p>
          <h3>Evidence Split And Call Quality</h3>
        </div>
        ${renderScoreBreakdown(agent)}
      </article>

      <article class="detail-panel wide-panel">
        <div class="panel-head">
          <p class="eyebrow">Interpretation</p>
          <h3>Why The Agent Reached This Outcome</h3>
        </div>
        <p class="long-reason">${escapeHtml(agent.reasoning_summary || call24.reason || "No reasoning supplied yet.")}</p>
      </article>

      <article class="detail-panel">
        <div class="panel-head">
          <p class="eyebrow">Warnings</p>
          <h3>Missing Inputs / Risk Flags</h3>
        </div>
        <div class="warning-list">${warnings}</div>
      </article>

      <article class="detail-panel">
        <div class="panel-head">
          <p class="eyebrow">Source of Truth</p>
          <h3>Logic Document</h3>
        </div>
        <div class="logic-box">
          <p><strong>Document:</strong> ${escapeHtml(agent.logic_document || "agent logic pending")}</p>
          <p><strong>Version:</strong> ${escapeHtml(agent.logic_document_version || "unknown")}</p>
          <p><strong>Isolation:</strong> Layer 1 raw call. No cross-agent contamination.</p>
        </div>
      </article>
    </section>
  `;
}

function renderAgentDetail(agentName) {
  const view = document.getElementById("agentView");
  const agent = getAgent(agentName);

  if (!view) return;

  if (!agent) {
    view.innerHTML = `
      <section class="detail-shell">
        <div class="empty-state">No ${escapeHtml(agentName)} agent output available yet.</div>
      </section>
    `;
    return;
  }

  const dashboardUpdated = getDashboardUpdatedAt();
  const assetUpdated = getAgentUpdatedAt(agent);

  view.innerHTML = `
    ${renderTodayCall(agent)}

    <section class="detail-grid">
      ${renderExecutiveSummary(agent)}

      ${renderTodayDrivers(agent)}

      ${renderInvalidationPanel(agent)}

      <article class="detail-panel wide-panel">
        <div class="panel-head">
          <p class="eyebrow">Other Timeframes</p>
          <h3>Secondary Directional Context</h3>
        </div>
        <div class="secondary-timeframes">${renderCallMatrix(agent)}</div>
      </article>

      <article class="detail-panel">
        <div class="panel-head">
          <p class="eyebrow">Source of Truth</p>
          <h3>Logic Document</h3>
        </div>
        <div class="logic-box">
          <p><strong>Document:</strong> ${escapeHtml(agent.logic_document || "agent logic pending")}</p>
          <p><strong>Version:</strong> ${escapeHtml(agent.logic_document_version || "unknown")}</p>
          <p><strong>Isolation:</strong> Layer 1 raw call. No cross-agent contamination.</p>
          <p><strong>Last n8n ingest:</strong> ${escapeHtml(formatDashboardTime(dashboardUpdated))}${formatRelativeAge(dashboardUpdated) ? ` | ${escapeHtml(formatRelativeAge(dashboardUpdated))}` : ""}</p>
          <p><strong>Last asset update:</strong> ${escapeHtml(formatDashboardTime(assetUpdated))}${formatRelativeAge(assetUpdated) ? ` | ${escapeHtml(formatRelativeAge(assetUpdated))}` : ""}</p>
        </div>
      </article>

      ${renderRawModelDetails(agent)}
    </section>
  `;
}

function confidenceLabel(value) {
  const bucket = layer2PairLogicLib.confidenceBucketFromValue(value);
  return bucket ? bucket.label : "Awaiting selection";
}

function rankLabel(rank) {
  if (rank === 1) return "#1 Best Trade Today";
  if (rank === 2) return "#2 Second Best";
  if (rank === 3) return "#3 Third Best";
  return rank ? `#${rank} Trade Setup` : "";
}

function renderTradeOpportunityCard(opportunity, label = "") {
  const direction = opportunity.direction || "NO TRADE";
  const confidence = opportunity.confidence ?? null;
  const strengthLabel = opportunity.strengthBucket || (confidence === null ? "Awaiting selection" : confidenceLabel(Number(confidence)));
  const trustStatus = currentOverviewLayer2L2lTrustStatus(opportunity);
  const directionalTrustStatus = currentOverviewLayer2DirectionalTrustStatus(opportunity);

  return `
    <article class="trade-opportunity-card ${directionClass(direction)}">
      <div class="trade-card-head">
        <div>
          ${label ? `<p class="eyebrow">${escapeHtml(label)}</p>` : ""}
          <h3>${escapeHtml(opportunity.instrument)}</h3>
        </div>
        <strong class="trade-direction ${directionClass(direction)}">${escapeHtml(direction)}</strong>
      </div>
      <div class="trade-confidence">
        <span>Confidence</span>
        <b>${formatConviction(confidence)}</b>
        <small>${escapeHtml(strengthLabel)}</small>
      </div>
      <div class="overview-validation-panel-stack" data-overview-validation-panels="true">
        ${buildOverviewL2lTrustBadge(trustStatus)}
        ${buildOverviewDirectionalTrustBadge(directionalTrustStatus)}
      </div>
      <p class="trade-reason">${escapeHtml(opportunity.reason || "No reason supplied.")}</p>
    </article>
  `;
}

function renderAvoidCard(item) {
  const trustStatus = { label: "Trust unavailable", icon: "–", canUse: null };
  return `
    <article class="trade-opportunity-card no-trade">
      <div class="trade-card-head">
        <div>
          <h3>${escapeHtml(item.instrument || "Instrument")}</h3>
        </div>
        <strong class="trade-direction no-trade">NO TRADE</strong>
      </div>
      <div class="overview-validation-panel-stack" data-overview-validation-panels="true">
        ${buildOverviewL2lTrustBadge({ label: "L2L Not Tradable", detail: "No valid call", canUse: false })}
        ${buildOverviewDirectionalTrustBadge({ label: "Directional Not Viable", detail: "No 24H call", canUse: false, exFlatWinRatePct: null })}
      </div>
      <p class="trade-reason">${escapeHtml(item.reason || "No clear Layer 2 trade selection.")}</p>
    </article>
  `;
}

function deriveLiveLayer2Dashboard() {
  const rawTradeOpportunities = Array.isArray(layer2Data?.trade_opportunities) ? layer2Data.trade_opportunities : [];
  const rawAvoidToday = Array.isArray(layer2Data?.avoid_today) ? layer2Data.avoid_today : [];

  if (!Array.isArray(layer1Data?.agents) || !layer1Data.agents.length) {
    return {
      tradeOpportunities: rawTradeOpportunities,
      avoidToday: rawAvoidToday
    };
  }

  const usdAgent = layer1Data.agents.find((agent) => agent?.agent === "USD") || null;
  const opportunities = [];
  const avoided = [];

  pairTradeResearchConfigs.forEach((config) => {
    if (config.liveEligibility !== "READY") {
      avoided.push({
        pairCode: config.pairCode,
        instrument: config.pairLabel,
        reason: config.onboardingReason || "Layer 1 and historical replay onboarding required.",
        marketStatus: "ONBOARDING"
      });
      return;
    }

    const marketDate = new Date();
    if (!marketOpenForDate(config.targetAssetCode, marketDate) || !marketOpenForDate("USD", marketDate)) {
      avoided.push({
        pairCode: config.pairCode,
        instrument: config.pairLabel,
        reason: "Market closed: no live trade is permitted outside the active market session.",
        marketStatus: "CLOSED"
      });
      return;
    }

    const targetAgent = layer1Data.agents.find((agent) => agent?.agent === config.targetAssetCode) || null;
    const targetCall = getCall(targetAgent, "24h");
    const usdCall = getCall(usdAgent, "24h");
    const targetDirection = layer2PairLogicLib.normalizeDirectionalSignalKey(targetCall?.direction);
    const usdDirection = layer2PairLogicLib.normalizeDirectionalSignalKey(usdCall?.direction);
    const targetConfidence = confidenceValue(targetCall, targetAgent, "24h");
    const usdConfidence = confidenceValue(usdCall, usdAgent, "24h");
    const pairSignal = layer2PairLogicLib.deriveLayer2PairSignal({
      instrument: config.pairLabel,
      targetDirection,
      usdDirection,
      targetConfidence,
      usdConfidence
    });

    if (pairSignal.tradable) {
      opportunities.push({
        pairCode: config.pairCode,
        instrument: config.pairLabel,
        direction: pairSignal.direction,
        confidence: pairSignal.combinedConfidence,
        strengthBucket: pairSignal.strengthBucket,
        reason: `${config.targetAssetCode} is independently ${targetDirection.toLowerCase()} while USD is independently ${usdDirection.toLowerCase()} during today's session.`
      });
      return;
    }

    avoided.push({
      pairCode: config.pairCode,
      instrument: config.pairLabel,
      reason: pairSignal.reason
    });
  });

  opportunities.sort((a, b) => {
    const confidenceDelta = Number(b.confidence || 0) - Number(a.confidence || 0);
    if (confidenceDelta !== 0) return confidenceDelta;
    return String(a.instrument || "").localeCompare(String(b.instrument || ""));
  });

  opportunities.forEach((opportunity, index) => {
    opportunity.rank = index + 1;
  });

  return {
    tradeOpportunities: opportunities,
    avoidToday: avoided
  };
}

function renderLayer2(data = {}) {
  const layer2Updated = document.getElementById("layer2Updated");
  if (layer2Updated) {
    layer2Updated.textContent = `Last updated: ${formatDashboardTime(data.dashboard_meta?.last_updated_et)}`;
  }
  const overviewLayer2Updated = document.getElementById("overviewLayer2Updated");
  if (overviewLayer2Updated) {
    overviewLayer2Updated.textContent = `Last updated: ${formatDashboardTime(data.dashboard_meta?.last_updated_et)}`;
  }

  const derivedLayer2 = deriveLiveLayer2Dashboard();
  renderOverviewBriefing();
  const opportunities = derivedLayer2.tradeOpportunities;
  const avoided = derivedLayer2.avoidToday;
  const html = `
    <div class="layer2-summary trade-layer-summary">
      <div>
        <p class="eyebrow">Pair Analysis</p>
        <h3>Layer 2 Trade Selection</h3>
      </div>
      <p class="summary">Layer 2 derives live pair trades from 24H Layer 1 headline confidence and direction state. Tradable pairs require opposite directional target/USD signals, and combined confidence is always the lower Layer 1 confidence.</p>
    </div>
    <div class="trade-grid">
      ${opportunities.length
        ? opportunities
            .slice()
            .sort((a, b) => Number(a.rank || 999) - Number(b.rank || 999))
            .map(opportunity => renderTradeOpportunityCard(opportunity, rankLabel(Number(opportunity.rank)))).join("")
        : `<div class="empty-state">Awaiting Layer 2 Trade Selection Agent.</div>`}
    </div>
    <section class="avoid-section">
      <div class="panel-head">
        <p class="eyebrow">Avoid Today</p>
        <h3>No Trade Setups</h3>
      </div>
      <div class="avoid-grid">
        ${avoided.length
          ? avoided.map(renderAvoidCard).join("")
          : `<div class="empty-state">No instruments are currently flagged for avoidance.</div>`}
      </div>
    </section>
  `;

  ["layer2Panel", "overviewLayer2Panel"].forEach(id => {
    const panel = document.getElementById(id);
    if (panel) panel.innerHTML = html;
  });

  renderOverviewPerformancePanel();
  renderOverviewConfidenceBandPanel();
}

function resultClass(result = "") {
  const r = String(result).toLowerCase();
  if (r.includes("win")) return "success";
  if (r.includes("loss")) return "failed";
  if (r.includes("pending")) return "pending";
  if (r.includes("no call")) return "neutral";
  return "neutral";
}

function percentValue(value) {
  return value === null || value === undefined || value === "" ? "--" : `${Number(value)}%`;
}

function displayDash() {
  return "—";
}

function renderBacktestMetric(label, value, detail = "") {
  return `
    <article class="backtest-metric-card">
      <p class="eyebrow">${escapeHtml(label)}</p>
      <h3>${escapeHtml(value)}</h3>
      ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
    </article>
  `;
}

function renderBacktestKpiMetric(label, primary, secondary = "", detail = "") {
  return `
    <article class="backtest-metric-card backtest-kpi-card">
      <p class="eyebrow">${escapeHtml(label)}</p>
      <h3>${escapeHtml(primary)}</h3>
      ${secondary ? `<strong class="backtest-kpi-secondary">${escapeHtml(secondary)}</strong>` : ""}
      ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
    </article>
  `;
}

function renderSimpleMetricValue(value, formatter = null) {
  if (!metricAvailable(value) && value !== 0) return displayDash();
  return formatter ? formatter(value) : String(value);
}

function formatReviewLabel(value) {
  if (!value) return "Not yet available";
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderFactorEdgeStatusPill(available, blocker = "") {
  if (available === false) {
    return `
      <div class="factor-edge-pill unavailable">
        <strong>Unavailable</strong>
        <span>${escapeHtml(blocker || "No repo-local joinable ADR/L2L export exists for factor-level attribution.")}</span>
      </div>
    `;
  }

  return `
    <div class="factor-edge-pill available">
      <strong>Available</strong>
      <span>Repo-local evidence exists for this research field.</span>
    </div>
  `;
}

function renderFactorEdgeSummaryCards(entityName, entity = {}, options = {}) {
  const summary = entity.summary || {};
  const dateRange = entity.date_range || {};
  const matchedLabel = options.matchedLabel || "Observations";
  const factorCountLabel = options.factorCountLabel || "Factor Entries";

  return `
    <section class="backtest-grid three-column factor-edge-summary-grid">
      ${renderBacktestKpiMetric(matchedLabel, renderSimpleMetricValue(summary.total_observations), `${formatDateValue(dateRange.start)} to ${formatDateValue(dateRange.end)}`, "Checked-in historical rows used for this research-only factor study")}
      ${renderBacktestKpiMetric(factorCountLabel, renderSimpleMetricValue(summary.factor_count), entity.outcome_market || "Not yet available", "Directional outcomes reuse the existing checked-in evaluation market only")}
      ${renderBacktestKpiMetric("ADR/L2L Factor Join", entity.adr_l2l_factor_join?.available === false ? "Unavailable" : "Available", entity.adr_l2l_factor_join?.blocker || "", "Factor-level ADR/L2L opportunity metrics must stay unavailable unless a full joinable export exists locally")}
    </section>
  `;
}

function renderFactorEdgeEntityHighlights(entity = {}) {
  const summary = entity.summary || {};
  const cards = [
    { label: "Strongest Bullish Factor", value: summary.strongest_bullish_factor },
    { label: "Strongest Bearish Factor", value: summary.strongest_bearish_factor },
    { label: "Highest Sample Reliable Factor", value: summary.highest_sample_reliable_factor },
    { label: "Biggest Weight Mismatch", value: summary.biggest_weight_mismatch },
    { label: "Weakest Factor", value: summary.weakest_factor }
  ];

  return `
    <section class="research-factor-grid factor-edge-highlight-grid">
      ${cards.map(card => `
        <article class="detail-panel factor-edge-highlight-card">
          <p class="eyebrow">${escapeHtml(card.label)}</p>
          <h3>${escapeHtml(card.value?.factor_name || "Not yet available")}</h3>
          <p class="factor-edge-highlight-copy">
            <strong>${escapeHtml(card.value?.factor_id || displayDash())}</strong>
            <span>${escapeHtml(metricAvailable(card.value?.score) ? String(card.value.score) : "No scored output")}</span>
          </p>
        </article>
      `).join("")}
    </section>
  `;
}

function renderFactorEdgeTopEvidence(entity = {}, options = {}) {
  const summary = entity.top_evidence_summary || {};
  const strongestSingles = asArray(summary.strongest_reliable_single_factors);
  const weakestFactors = asArray(summary.weakest_failing_factors);
  const strongestCombinations = asArray(summary.strongest_reliable_combinations);
  const lowSampleWarning = summary.low_sample_warning || {};
  const edgeBalance = summary.layer2_edge_balance;

  const renderEvidenceList = (items, type) => {
    if (!items.length) {
      return `<li>${escapeHtml(type === "combination" ? "No reliable combination evidence surfaced yet." : "No reliable factor evidence surfaced yet.")}</li>`;
    }

    return items.map((item) => {
      const title = type === "combination" ? asArray(item.factor_names).join(" + ") : item.factor_name;
      const subtitle = type === "combination" ? asArray(item.factor_ids).join(" · ") : item.factor_id;
      const score = type === "combination"
        ? (metricAvailable(item.ex_flat_wr_pct) ? percentValue(item.ex_flat_wr_pct) : displayDash())
        : (metricAvailable(item.weight_mismatch?.combined_factor_reliability_pct) ? percentValue(item.weight_mismatch.combined_factor_reliability_pct) : displayDash());
      return `<li><strong>${escapeHtml(title || "Not yet available")}</strong> <span>${escapeHtml(subtitle || displayDash())} · ${escapeHtml(score)} · ${escapeHtml(formatReviewLabel(item.review_label))}</span></li>`;
    }).join("");
  };

  return `
    <section class="detail-panel factor-edge-top-evidence-card">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Top Evidence</p>
          <h4>${escapeHtml(options.title || "Review Readiness")}</h4>
        </div>
        <p class="research-panel-copy">Research-only review summary. These labels flag evidence for human inspection and do not change any production weighting or live logic.</p>
      </div>
      <section class="backtest-grid three-column factor-edge-summary-grid">
        ${renderBacktestKpiMetric("Low-Sample Warning", formatReviewLabel(lowSampleWarning.label), `${renderSimpleMetricValue(lowSampleWarning.insufficient_single_factor_count)} factors · ${renderSimpleMetricValue(lowSampleWarning.exploratory_combination_count)} exploratory combos`, "Counts of factors or combinations that still need more sample before review confidence increases")}
        ${renderBacktestKpiMetric("Unavailable Combos", renderSimpleMetricValue(lowSampleWarning.unavailable_combination_count), "Held back by minimum sample gating", "Tiny-sample combinations remain unavailable instead of being surfaced as strong edge")}
        ${renderBacktestKpiMetric("Layer 2 Edge Balance", edgeBalance ? formatReviewLabel(edgeBalance) : displayDash(), "", "Which Layer 2 side appears to carry more realized edge in this research-only view")}
      </section>
      <div class="factor-edge-combination-grid">
        <article class="detail-panel factor-edge-combination-card">
          <p class="eyebrow">Strongest Reliable Single Factors</p>
          <ul class="adr-unavailable-list factor-edge-limitations-list">${renderEvidenceList(strongestSingles, "factor")}</ul>
        </article>
        <article class="detail-panel factor-edge-combination-card">
          <p class="eyebrow">Weakest / Failing Factors</p>
          <ul class="adr-unavailable-list factor-edge-limitations-list">${renderEvidenceList(weakestFactors, "factor")}</ul>
        </article>
        <article class="detail-panel factor-edge-combination-card">
          <p class="eyebrow">Strongest Reliable Combinations</p>
          <ul class="adr-unavailable-list factor-edge-limitations-list">${renderEvidenceList(strongestCombinations, "combination")}</ul>
        </article>
      </div>
    </section>
  `;
}

function renderFactorEdgeFactorTable(entity = {}) {
  const rows = asArray(entity.factors);
  if (!rows.length) {
    return `<div class="empty-state">No factor rows were present in the checked-in Factor Edge Lab artifact.</div>`;
  }

  return `
    <div class="table-scroll factor-edge-table-scroll">
      <table class="dashboard-table research-evidence-table factor-edge-table factor-edge-factor-table">
        <thead>
          <tr>
            <th class="factor-edge-col-factor">Factor</th>
            <th class="factor-edge-col-source">Source</th>
            <th class="factor-edge-col-weight">Weight</th>
            <th class="factor-edge-col-review">Review Label</th>
            <th class="factor-edge-col-counts">Signal Counts</th>
            <th class="factor-edge-col-reliability">Bullish Reliability</th>
            <th class="factor-edge-col-reliability">Bearish Reliability</th>
            <th class="factor-edge-col-flats">Flats</th>
            <th class="factor-edge-col-alignment">Final-Call Alignment</th>
            <th class="factor-edge-col-mismatch">Weight Mismatch</th>
            <th class="factor-edge-col-status">ADR/L2L</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td class="factor-edge-col-factor">${renderAdrCompactTextCell(row.factor_name || displayDash(), row.factor_id || "", { className: "adr-table-tight-cell" })}</td>
              <td class="factor-edge-col-source">${renderAdrCompactTextCell(row.source_asset || displayDash(), row.source_side || "", { className: "adr-table-tight-cell" })}</td>
              <td class="factor-edge-col-weight">${renderAdrCompactTextCell(renderSimpleMetricValue(row.original_weight), row.suggested_interpretation || "", { className: "adr-table-tight-cell" })}</td>
              <td class="factor-edge-col-review">${renderAdrCompactTextCell(
                formatReviewLabel(row.review_label),
                row.weight_mismatch?.suggested_interpretation || row.suggested_interpretation || "No interpretation",
                { className: "adr-table-tight-cell" }
              )}</td>
              <td class="factor-edge-col-counts">${renderAdrCompactTextCell(
                `${row.factor_profile?.bullish_sample_count ?? 0}B / ${row.factor_profile?.bearish_sample_count ?? 0}Br`,
                `${row.factor_profile?.neutral_no_signal_count ?? 0} neutral · ${row.factor_profile?.directional_sample_count ?? 0} directional`,
                { className: "adr-table-tight-cell" }
              )}</td>
              <td class="factor-edge-col-reliability">${renderAdrCompactTextCell(
                metricAvailable(row.bullish_state?.ex_flat_wr_pct) ? percentValue(row.bullish_state.ex_flat_wr_pct) : displayDash(),
                metricAvailable(row.bullish_state?.sample_count) ? `${row.bullish_state.sample_count} sample · ${row.bullish_state.reliability_label || "No label"}` : "No directional sample",
                { className: "adr-table-tight-cell" }
              )}</td>
              <td class="factor-edge-col-reliability">${renderAdrCompactTextCell(
                metricAvailable(row.bearish_state?.ex_flat_wr_pct) ? percentValue(row.bearish_state.ex_flat_wr_pct) : displayDash(),
                metricAvailable(row.bearish_state?.sample_count) ? `${row.bearish_state.sample_count} sample · ${row.bearish_state.reliability_label || "No label"}` : "No directional sample",
                { className: "adr-table-tight-cell" }
              )}</td>
              <td class="factor-edge-col-flats">${renderAdrCompactTextCell(
                metricAvailable(row.factor_profile?.flat_rate_pct) ? percentValue(row.factor_profile.flat_rate_pct) : displayDash(),
                `${row.factor_profile?.flat_count ?? 0} flats across all factor states`,
                { className: "adr-table-tight-cell" }
              )}</td>
              <td class="factor-edge-col-alignment">${renderAdrCompactTextCell(
                metricAvailable(row.alignment_with_final_call?.agrees_with_final_call?.ex_flat_wr_pct)
                  ? `Agree ${percentValue(row.alignment_with_final_call.agrees_with_final_call.ex_flat_wr_pct)}`
                  : "Agree —",
                [
                  `${row.alignment_with_final_call?.agrees_with_final_call?.sample_count ?? 0} agree`,
                  `${row.alignment_with_final_call?.contradicts_final_call?.sample_count ?? 0} contradict`,
                  `C ex-flat ${metricAvailable(row.alignment_with_final_call?.contradicts_final_call?.ex_flat_wr_pct) ? percentValue(row.alignment_with_final_call.contradicts_final_call.ex_flat_wr_pct) : displayDash()}`,
                  `A flat ${metricAvailable(row.alignment_with_final_call?.agrees_with_final_call?.flat_rate_pct) ? percentValue(row.alignment_with_final_call.agrees_with_final_call.flat_rate_pct) : displayDash()}`,
                  `C flat ${metricAvailable(row.alignment_with_final_call?.contradicts_final_call?.flat_rate_pct) ? percentValue(row.alignment_with_final_call.contradicts_final_call.flat_rate_pct) : displayDash()}`
                ].join(" · "),
                { className: "adr-table-tight-cell" }
              )}</td>
              <td class="factor-edge-col-mismatch">${renderAdrCompactTextCell(
                metricAvailable(row.weight_mismatch?.combined_factor_reliability_pct) ? percentValue(row.weight_mismatch.combined_factor_reliability_pct) : displayDash(),
                `${row.weight_mismatch?.suggested_interpretation || "No interpretation"} · ${metricAvailable(row.weight_mismatch?.directional_sample) ? `${row.weight_mismatch.directional_sample} dir` : "No dir sample"}`,
                { className: "adr-table-tight-cell" }
              )}</td>
              <td class="factor-edge-col-status">${renderFactorEdgeStatusPill(
                row.bullish_state?.adr_l2l_opportunity?.available,
                row.bullish_state?.adr_l2l_opportunity?.blocker || row.bearish_state?.adr_l2l_opportunity?.blocker || entity.adr_l2l_factor_join?.blocker || ""
              )}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFactorEdgeCombinationTable(bucket = {}, title = "Combinations") {
  const rows = asArray(bucket.combinations);
  if (!rows.length) {
    return `
      <article class="detail-panel factor-edge-combination-card">
        <p class="eyebrow">${escapeHtml(title)}</p>
        <div class="empty-state">No combination rows were generated for this scope.</div>
      </article>
    `;
  }

  return `
    <article class="detail-panel factor-edge-combination-card">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">${escapeHtml(title)}</p>
          <h4>${escapeHtml(`${bucket.combination_size || rows[0]?.factor_ids?.length || "?"}-Factor Combinations`)}</h4>
        </div>
        <p class="research-panel-copy">
          Min sample ${escapeHtml(String(bucket.minimum_sample_count || displayDash()))} ·
          Exploratory from ${escapeHtml(String(bucket.exploratory_sample_count || displayDash()))} ·
          Usable ${escapeHtml(String(bucket.usable_combination_count || 0))}
        </p>
      </div>
      <div class="table-scroll factor-edge-table-scroll">
        <table class="dashboard-table research-evidence-table factor-edge-table factor-edge-combination-table">
          <thead>
            <tr>
              <th class="factor-edge-col-combination">Combination</th>
              <th class="factor-edge-col-direction">Direction</th>
              <th class="factor-edge-col-sample">Sample</th>
              <th class="factor-edge-col-rate">Ex-Flat WR</th>
              <th class="factor-edge-col-flats">Flats</th>
              <th class="factor-edge-col-alignment">Final-Call Alignment</th>
              <th class="factor-edge-col-reliability">Reliability</th>
              <th class="factor-edge-col-status">ADR/L2L</th>
            </tr>
          </thead>
          <tbody>
            ${rows.slice(0, 12).map((row) => `
              <tr>
                <td class="factor-edge-col-combination">${renderAdrCompactTextCell(
                  escapeHtml(asArray(row.factor_names).join(" + ") || displayDash()),
                  escapeHtml(asArray(row.factor_ids).join(" · ") || displayDash()),
                  { className: "adr-table-tight-cell" }
                )}</td>
                <td class="factor-edge-col-direction">${renderAdrCompactTextCell(
                  escapeHtml(row.direction_tested || displayDash()),
                  row.bullish_direction_tested ? "Bullish setup" : row.bearish_direction_tested ? "Bearish setup" : "No directional setup",
                  { className: "adr-table-tight-cell" }
                )}</td>
                <td class="factor-edge-col-sample">${renderAdrCompactTextCell(
                  renderSimpleMetricValue(row.sample_count),
                  row.sample_size_label || "No sample label",
                  { className: "adr-table-tight-cell" }
                )}</td>
                <td class="factor-edge-col-rate">${renderAdrCompactTextCell(
                  metricAvailable(row.ex_flat_wr_pct) ? percentValue(row.ex_flat_wr_pct) : displayDash(),
                  `${renderSimpleMetricValue(row.bullish_sample_count)} bull moves · ${renderSimpleMetricValue(row.bearish_sample_count)} bear moves · ${formatReviewLabel(row.review_label)}`,
                  { className: "adr-table-tight-cell" }
                )}</td>
                <td class="factor-edge-col-flats">${renderAdrCompactTextCell(
                  metricAvailable(row.flat_rate_pct) ? percentValue(row.flat_rate_pct) : displayDash(),
                  `${renderSimpleMetricValue(row.flat_count)} flats`,
                  { className: "adr-table-tight-cell" }
                )}</td>
                <td class="factor-edge-col-alignment">${renderAdrCompactTextCell(
                  `${renderSimpleMetricValue(row.agrees_with_final_call?.sample_count)} agree · ${renderSimpleMetricValue(row.contradicts_final_call?.sample_count)} contra`,
                  [
                    metricAvailable(row.agrees_with_final_call?.ex_flat_wr_pct) ? `Agree WR ${percentValue(row.agrees_with_final_call.ex_flat_wr_pct)}` : "Agree WR unavailable",
                    metricAvailable(row.contradicts_final_call?.ex_flat_wr_pct) ? `Contra WR ${percentValue(row.contradicts_final_call.ex_flat_wr_pct)}` : "Contra WR unavailable",
                    row.skipped_no_final_call_count ? `${row.skipped_no_final_call_count} no final call` : "All rows had a final call"
                  ].join(" · "),
                  { className: "adr-table-tight-cell" }
                )}</td>
                <td class="factor-edge-col-reliability">${renderAdrCompactTextCell(
                  row.reliability_label || "Not yet available",
                  `${formatReviewLabel(row.review_label)} · ${row.interpretation || "No interpretation"}`,
                  { className: "adr-table-tight-cell" }
                )}</td>
                <td class="factor-edge-col-status">${renderFactorEdgeStatusPill(
                  row.adr_l2l_factor_join?.available,
                  row.adr_l2l_factor_join?.blocker || ""
                )}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderFactorEdgeCombinationSection(entity = {}, options = {}) {
  const combinations = entity.factor_combinations || {};
  if (!Object.keys(combinations).length) {
    return `<div class="empty-state">No factor combination analysis was present in the checked-in artifact.</div>`;
  }

  const title = options.title || "Factor Combinations";
  return `
    <section class="factor-edge-combination-shell">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Factor Combinations</p>
          <h4>${escapeHtml(title)}</h4>
        </div>
        <p class="research-panel-copy">${escapeHtml(options.copy || "Research-only combination evidence. Low-sample results stay exploratory or unavailable and do not imply production weighting changes.")}</p>
      </div>
      <div class="factor-edge-combination-grid">
        ${renderFactorEdgeCombinationTable(combinations.two_factor || {}, "Two-Factor")}
        ${renderFactorEdgeCombinationTable(combinations.three_factor || {}, "Three-Factor")}
      </div>
    </section>
  `;
}

function renderFactorEdgePairSideSummary(side = {}) {
  const summary = side.summary || {};
  const carryingFactor = summary.carrying_edge_factor || null;
  return `
    <article class="detail-panel factor-edge-side-summary-card">
      <p class="eyebrow">${escapeHtml(side.label || "Pair Side")}</p>
      <h3>${escapeHtml(side.sourceAsset || "Unknown")} · ${escapeHtml(String(side.mapping || "unavailable").toUpperCase())}</h3>
      <p class="research-panel-copy">${escapeHtml(side.description || "No explicit pair-side mapping note was provided.")}</p>
      <section class="backtest-grid three-column factor-edge-side-grid">
        ${renderBacktestKpiMetric("Factors", renderSimpleMetricValue(summary.factor_count), renderSimpleMetricValue(summary.directional_sample_count), "Directional sample count is aggregated from the side's factor rows only")}
        ${renderBacktestKpiMetric("Avg Reliability", metricAvailable(summary.average_combined_factor_reliability_pct) ? percentValue(summary.average_combined_factor_reliability_pct) : displayDash(), summary.edge_label || "Not yet available", "Average combined factor reliability across this side's factors")}
        ${renderBacktestKpiMetric("Carrying Factor", carryingFactor?.factor_name || "Not yet available", carryingFactor?.factor_id || "", "Highest combined reliability factor on this side")}
      </section>
    </article>
  `;
}

function renderFactorEdgePairSideSection(entity = {}, sideKey = "base_side") {
  const side = entity.pair_side_analysis?.[sideKey] || null;
  if (!side) {
    return `<div class="empty-state">No explicit pair-side analysis was present for this side.</div>`;
  }

  const sideRows = asArray(entity.factors).filter((row) => row.source_side === side.sideKey);
  const sideCombinations = entity.factor_combinations?.[sideKey] || {};
  return `
    <section class="factor-edge-pair-side-section">
      ${renderFactorEdgePairSideSummary(side)}
      ${renderFactorEdgeFactorTable({ ...entity, factors: sideRows })}
      ${renderFactorEdgeCombinationSection({ factor_combinations: sideCombinations }, {
        title: `${side.label || "Pair Side"} Combinations`,
        copy: `${side.sourceAsset || "Unknown"} side combinations stay ${String(side.mapping || "unavailable").toLowerCase()}-mapped and separate from the opposite pair side in this phase.`
      })}
    </section>
  `;
}

function renderFactorEdgeEntitySection(entityName, entity = {}, options = {}) {
  const isLayer2 = options.eyebrow === "Layer 2";
  return `
    <article class="research-section detail-panel factor-edge-entity-panel">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">${escapeHtml(options.eyebrow || "Factor Edge Lab")}</p>
          <h3>${escapeHtml(entityName)}</h3>
        </div>
        <p class="research-panel-copy">${escapeHtml(options.copy || "Research-only factor evidence from checked-in historical artifacts. This view does not modify production weighting, live calls, replay methodology, or ADR/L2L logic.")}</p>
      </div>
      ${renderFactorEdgeSummaryCards(entityName, entity, options)}
      ${renderFactorEdgeEntityHighlights(entity)}
      ${renderFactorEdgeTopEvidence(entity, { title: `${entityName} Review Summary` })}
      ${isLayer2 ? `
        <section class="factor-edge-pair-sides-shell">
          ${renderFactorEdgePairSideSection(entity, "base_side")}
          ${renderFactorEdgePairSideSection(entity, "quote_usd_side")}
        </section>
      ` : `
        ${renderFactorEdgeFactorTable(entity)}
        ${renderFactorEdgeCombinationSection(entity, {
          title: `${entityName} Factor Combinations`,
          copy: "Combination analysis stays research-only. Tiny samples remain exploratory or unavailable rather than being treated as strong edge."
        })}
      `}
    </article>
  `;
}

function renderFactorEdgeLab(payload = {}) {
  const updated = document.getElementById("factorEdgeLabUpdated");
  if (updated) {
    updated.textContent = payload?.meta?.error
      ? `Factor Edge Lab unavailable: ${payload.meta.error}`
      : `Last synced: ${formatDashboardTime(payload.generated_at)}`;
  }

  const panel = document.getElementById("factorEdgeLabPanel");
  if (!panel) return;

  if (payload?.meta?.error) {
    panel.innerHTML = `
      <article class="detail-panel wide-panel research-status-card">
        <p class="eyebrow">Factor Edge Lab</p>
        <h3>Artifact unavailable</h3>
        <div class="empty-state">${escapeHtml(payload.meta.error)}</div>
      </article>
    `;
    return;
  }

  const layer1Entries = Object.entries(payload.layer1 || {});
  const layer2Entries = Object.entries(payload.layer2 || {});
  const limitationItems = asArray(payload.methodology?.known_limitations);

  panel.innerHTML = `
    <section class="research-status-hero">
      <article class="detail-panel wide-panel research-status-card factor-edge-status-card">
        <div class="research-section-head">
          <div>
            <p class="eyebrow">Research Only</p>
            <h3>Factor evidence for later weighting review</h3>
          </div>
          <p class="research-panel-copy">This dashboard reads only from the checked-in <code>data/factor-edge-lab.json</code> artifact. It exposes historical factor evidence so weighting decisions can be reviewed later without altering live Layer 1, live Layer 2, replay, Directional Trust, L2L/ADR, or Overview badge logic.</p>
        </div>
        <section class="backtest-grid three-column factor-edge-summary-grid">
          ${renderBacktestKpiMetric("Version", payload.version || "Not yet available", payload.timeframe || "", "Artifact contract for the current research-only builder")}
          ${renderBacktestKpiMetric("Layer 1 Coverage", String(layer1Entries.length), Object.keys(payload.layer1 || {}).join(", "), "Entities present in the checked-in Layer 1 factor artifact")}
          ${renderBacktestKpiMetric("Layer 2 Coverage", String(layer2Entries.length), Object.keys(payload.layer2 || {}).join(", "), "Pairs present in the checked-in Layer 2 factor artifact")}
        </section>
        <section class="detail-panel factor-edge-methodology-panel">
          <p class="eyebrow">Methodology Guardrails</p>
          <div class="factor-edge-methodology-grid">
            <div class="factor-edge-methodology-card">
              <strong>Primary Metric</strong>
              <span>${escapeHtml(payload.primary_metric || displayDash())}</span>
            </div>
            <div class="factor-edge-methodology-card">
              <strong>Directional Outcome</strong>
              <span>${escapeHtml(payload.methodology?.directional_outcome || "Not yet available")}</span>
            </div>
            <div class="factor-edge-methodology-card">
              <strong>ADR/L2L Handling</strong>
              <span>${escapeHtml(payload.methodology?.adr_l2l || "Not yet available")}</span>
            </div>
          </div>
          <ul class="adr-unavailable-list factor-edge-limitations-list">
            ${limitationItems.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </section>
      </article>
    </section>

    <section class="research-section factor-edge-section-stack">
      ${layer1Entries.map(([entityName, entity]) => renderFactorEdgeEntitySection(entityName, entity, {
        eyebrow: "Layer 1",
        matchedLabel: "Observations",
        factorCountLabel: "Factors",
        copy: "Independent Layer 1 factor evidence only. This is a read-only review surface for historical realized edge versus original factor weighting."
      })).join("")}
    </section>

    <section class="research-section factor-edge-section-stack">
      ${layer2Entries.map(([entityName, entity]) => renderFactorEdgeEntitySection(entityName, entity, {
        eyebrow: "Layer 2",
        matchedLabel: "Matched Dates",
        factorCountLabel: "Factor Entries",
        copy: entity.methodology_note || "Layer 2 factor evidence is derived downstream from checked-in target-side and USD-side research artifacts only."
      })).join("")}
    </section>
  `;
}

function signedMetricValue(value, suffix = "") {
  if (!metricAvailable(value) && value !== 0) return displayDash();
  const numeric = Number(value);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric}${suffix}`;
}

function renderShadowBacktestStatusBadge(status = "WARN") {
  const normalized = String(status || "WARN").toUpperCase();
  const tone = normalized === "PASS" ? "pass" : (normalized === "FAIL" ? "fail" : "warn");
  return `<span class="shadow-backtest-status-badge ${tone}">${escapeHtml(normalized)}</span>`;
}

function renderShadowBacktestSummaryCards(payload = {}) {
  const overall = payload.overall || {};
  return `
    <section class="backtest-grid three-column shadow-backtest-summary-grid">
      ${renderBacktestKpiMetric("Assets Compared", renderSimpleMetricValue(overall.assets_compared), "Current phase compares Layer 1 24H assets only", "This artifact stays downstream of the checked-in checker and Factor Edge evidence")}
      ${renderBacktestKpiMetric("Improved Assets", renderSimpleMetricValue(overall.improved_assets), `${renderSimpleMetricValue(overall.degraded_assets)} degraded`, "PASS means shadow ex-flat win rate improved by at least 3 points with enough directional sample")}
      ${renderBacktestKpiMetric("Average Ex-Flat Delta", metricAvailable(overall.average_ex_flat_change_pct_points) ? signedMetricValue(overall.average_ex_flat_change_pct_points, " pp") : displayDash(), `${renderSimpleMetricValue(overall.mixed_or_warn_assets)} mixed or warn`, "Positive means the shadow logic improved directional ex-flat win rate on average")}
    </section>
  `;
}

function renderShadowBacktestMethodology(payload = {}) {
  const methodology = payload.methodology || {};
  const renderList = (items = []) => items.length
    ? `<ul class="adr-unavailable-list factor-edge-limitations-list shadow-backtest-list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<div class="empty-state">No methodology notes were supplied in the checked-in artifact.</div>`;

  return `
    <section class="detail-panel shadow-backtest-status-card research-status-card">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Phase 2 Shadow Logic</p>
          <h3>Original Logic vs Evidence-Reweighted Shadow Logic</h3>
        </div>
        <p class="research-panel-copy">This dashboard reads only from the checked-in <code>data/phase-2-shadow-backtest.json</code> artifact. It compares current production outcomes against a research-only shadow model without changing live Layer 1, live Layer 2, replay, checker, Directional Trust, ADR/L2L, or Factor Edge evidence calculations.</p>
      </div>
      ${renderShadowBacktestSummaryCards(payload)}
      <div class="shadow-backtest-methodology-grid">
        <article class="detail-panel shadow-backtest-methodology-card">
          <p class="eyebrow">Shadow Engine</p>
          <p class="research-panel-copy">${escapeHtml(methodology.shadow_engine || "Not yet available.")}</p>
        </article>
        <article class="detail-panel shadow-backtest-methodology-card">
          <p class="eyebrow">Scope</p>
          <p class="research-panel-copy">${escapeHtml(methodology.scope || "Not yet available.")}</p>
        </article>
      </div>
      <section class="shadow-backtest-methodology-grid">
        <article class="detail-panel shadow-backtest-methodology-card">
          <p class="eyebrow">Weight Formula</p>
          ${renderList(methodology.weight_formula || [])}
        </article>
        <article class="detail-panel shadow-backtest-methodology-card">
          <p class="eyebrow">Decision Gate</p>
          ${renderList(methodology.shadow_decision_gate || [])}
        </article>
        <article class="detail-panel shadow-backtest-methodology-card">
          <p class="eyebrow">Known Limitations</p>
          ${renderList(methodology.known_limitations || [])}
        </article>
      </section>
    </section>
  `;
}

function renderShadowBacktestOverviewTable(payload = {}) {
  const assets = Object.values(payload.assets || {});
  return renderResearchBreakdownTable("Asset comparison", "Original vs Shadow", assets, [
    {
      label: "Asset / TF",
      render: row => renderAdrCompactTextCell(row.asset_label || displayDash(), row.timeframe || displayDash(), { className: "adr-table-tight-cell" })
    },
    {
      label: "Original Logic",
      render: row => renderAdrCompactTextCell(
        metricAvailable(row.original_logic?.ex_flat_wr_pct) ? percentValue(row.original_logic.ex_flat_wr_pct) : displayDash(),
        `${row.original_logic?.wins ?? 0}W / ${row.original_logic?.losses ?? 0}L / ${row.original_logic?.flats ?? 0}F · ${row.original_logic?.directional_call_count ?? 0} calls`,
        { className: "adr-table-tight-cell" }
      )
    },
    {
      label: "Shadow Logic",
      render: row => renderAdrCompactTextCell(
        metricAvailable(row.shadow_logic?.ex_flat_wr_pct) ? percentValue(row.shadow_logic.ex_flat_wr_pct) : displayDash(),
        `${row.shadow_logic?.wins ?? 0}W / ${row.shadow_logic?.losses ?? 0}L / ${row.shadow_logic?.flats ?? 0}F · ${row.shadow_logic?.directional_call_count ?? 0} calls`,
        { className: "adr-table-tight-cell" }
      )
    },
    {
      label: "Delta",
      render: row => renderAdrCompactTextCell(
        metricAvailable(row.comparison?.ex_flat_change_pct_points) ? signedMetricValue(row.comparison.ex_flat_change_pct_points, " pp") : displayDash(),
        `Flat ${metricAvailable(row.comparison?.flat_rate_change_pct_points) ? signedMetricValue(row.comparison.flat_rate_change_pct_points, " pp") : displayDash()} · Wins ${signedMetricValue(row.comparison?.directional_wins_delta || 0)} · Losses ${signedMetricValue(row.comparison?.directional_losses_delta || 0)}`,
        { className: "adr-table-tight-cell" }
      )
    },
    {
      label: "Comparison",
      render: row => `
        <div class="shadow-backtest-status-cell">
          ${renderShadowBacktestStatusBadge(row.comparison?.status || "WARN")}
          <span>${escapeHtml(formatReviewLabel(row.comparison?.headline || "mixed_or_small_sample"))}</span>
        </div>
      `
    },
    {
      label: "Sample Warning",
      render: row => renderAdrCompactTextCell(
        formatReviewLabel(row.sample_warning?.label || "not_available"),
        row.sample_warning?.detail || "Not yet available",
        { className: "adr-table-tight-cell" }
      )
    }
  ], {
    panelClass: "shadow-backtest-overview-panel",
    tableClass: "research-evidence-table shadow-backtest-table shadow-backtest-overview-table",
    scrollClass: "shadow-backtest-table-scroll",
    description: "Pass / warn / fail remains research-only. Small samples and shadow no-call behaviour are intentionally kept visible instead of being hidden."
  });
}

function renderShadowBacktestComparisonTable(asset = {}) {
  return renderResearchBreakdownTable(`${asset.asset_label} 24H comparison`, "Original vs Shadow", [
    {
      logic: "Original Logic",
      metrics: asset.original_logic || {}
    },
    {
      logic: "Shadow Logic",
      metrics: asset.shadow_logic || {}
    }
  ], [
    { label: "Logic", render: row => renderAdrCompactTextCell(row.logic, asset.outcome_market || displayDash(), { className: "adr-table-tight-cell" }) },
    { label: "Sample Count", render: row => renderAdrCompactTextCell(renderSimpleMetricValue(row.metrics?.sample_count), `${row.metrics?.directional_call_count ?? 0} directional calls`, { className: "adr-table-tight-cell" }) },
    { label: "Ex-Flat WR", render: row => renderAdrCompactTextCell(metricAvailable(row.metrics?.ex_flat_wr_pct) ? percentValue(row.metrics.ex_flat_wr_pct) : displayDash(), `${row.metrics?.wins ?? 0}W / ${row.metrics?.losses ?? 0}L`, { className: "adr-table-tight-cell" }) },
    { label: "Flat Rate", render: row => renderAdrCompactTextCell(metricAvailable(row.metrics?.flat_rate_pct) ? percentValue(row.metrics.flat_rate_pct) : displayDash(), `${row.metrics?.flats ?? 0} flats`, { className: "adr-table-tight-cell" }) },
    { label: "No Call", render: row => renderAdrCompactTextCell(renderSimpleMetricValue(row.metrics?.no_call_count), `${row.metrics?.not_evaluable_count ?? 0} not evaluable`, { className: "adr-table-tight-cell" }) }
  ], {
    panelClass: "shadow-backtest-detail-panel",
    tableClass: "research-evidence-table shadow-backtest-table shadow-backtest-detail-table",
    scrollClass: "shadow-backtest-table-scroll"
  });
}

function renderShadowBacktestWeightTable(asset = {}) {
  const rows = asArray(asset.weight_changes);
  return renderResearchBreakdownTable(`${asset.asset_label} weight changes`, "Shadow Factor Weight Changes", rows, [
    { label: "Factor", render: row => renderAdrCompactTextCell(row.factor_name || displayDash(), row.factor_id || displayDash(), { className: "adr-table-tight-cell" }) },
    { label: "Original Weight", render: row => renderAdrCompactTextCell(renderSimpleMetricValue(row.original_weight), row.suggested_interpretation || displayDash(), { className: "adr-table-tight-cell" }) },
    { label: "Shadow Weight", render: row => renderAdrCompactTextCell(renderSimpleMetricValue(row.shadow_weight), metricAvailable(row.row_multiplier) ? `${row.row_multiplier}x row multiplier` : displayDash(), { className: "adr-table-tight-cell" }) },
    { label: "Change %", render: row => renderAdrCompactTextCell(metricAvailable(row.change_pct) ? signedMetricValue(row.change_pct, "%") : displayDash(), `Score ${renderSimpleMetricValue(row.score)}`, { className: "adr-table-tight-cell" }) },
    { label: "Reason", render: row => renderAdrCompactTextCell(formatReviewLabel(row.reason_label), formatReviewLabel(row.review_label), { className: "adr-table-tight-cell" }) },
    { label: "Evidence Snapshot", render: row => renderAdrCompactTextCell(metricAvailable(row.combined_reliability_pct) ? `${row.combined_reliability_pct}% rel` : displayDash(), `${row.directional_sample ?? 0} sample | Agree ${metricAvailable(row.agree_ex_flat_wr_pct) ? `${row.agree_ex_flat_wr_pct}%` : displayDash()} | Contra ${metricAvailable(row.contradiction_ex_flat_wr_pct) ? `${row.contradiction_ex_flat_wr_pct}%` : displayDash()} | Flat ${metricAvailable(row.flat_rate_pct) ? `${row.flat_rate_pct}%` : displayDash()}`, { className: "adr-table-tight-cell" }) },
    { label: "Rationale", render: row => renderAdrCompactTextCell(row.pair_side_adjustment || displayDash(), row.rationale || displayDash(), { className: "adr-table-tight-cell" }) }
  ], {
    panelClass: "shadow-backtest-detail-panel",
    tableClass: "research-evidence-table shadow-backtest-table shadow-backtest-weight-table",
    scrollClass: "shadow-backtest-table-scroll"
  });
}

function renderShadowBacktestChangedRows(asset = {}) {
  const rows = asArray(asset.changed_row_preview);
  if (!rows.length) return "";
  return renderResearchBreakdownTable(`${asset.asset_label} changed-row preview`, "Direction Changes", rows, [
    { label: "Date", render: row => renderAdrCompactTextCell(row.snapshot_date || displayDash(), row.prediction_id || displayDash(), { className: "adr-table-tight-cell" }) },
    { label: "Original", render: row => renderAdrCompactTextCell(row.original_direction || displayDash(), row.original_result || displayDash(), { className: "adr-table-tight-cell" }) },
    { label: "Shadow", render: row => renderAdrCompactTextCell(row.shadow_direction || displayDash(), row.shadow_result || displayDash(), { className: "adr-table-tight-cell" }) },
    { label: "Outcome", render: row => renderAdrCompactTextCell(row.outcome_direction || displayDash(), "Research-only preview of rows where the shadow model changed the call or outcome bucket", { className: "adr-table-tight-cell" }) }
  ], {
    panelClass: "shadow-backtest-detail-panel",
    tableClass: "research-evidence-table shadow-backtest-table shadow-backtest-detail-table",
    scrollClass: "shadow-backtest-table-scroll"
  });
}

function renderShadowBacktestAssetSection(asset = {}) {
  return `
    <article class="research-section detail-panel shadow-backtest-asset-panel">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Asset / Timeframe</p>
          <h3>${escapeHtml(asset.asset_label || "Unknown")} ${escapeHtml(asset.timeframe || displayDash())}</h3>
        </div>
        <p class="research-panel-copy">Research-only comparison against the existing checked-in ${escapeHtml(asset.outcome_market || "outcome market")} outcome surface. Small samples and extra no-call behaviour remain visible instead of being smoothed away.</p>
      </div>
      <section class="backtest-grid three-column shadow-backtest-summary-grid">
        ${renderBacktestKpiMetric("Sample Count", renderSimpleMetricValue(asset.original_logic?.sample_count), `${asset.original_logic?.directional_call_count ?? 0} original directional calls`, "Rows compared against the same checked-in 24H checker history")}
        ${renderBacktestKpiMetric("Ex-Flat Delta", metricAvailable(asset.comparison?.ex_flat_change_pct_points) ? signedMetricValue(asset.comparison.ex_flat_change_pct_points, " pp") : displayDash(), `Wins ${signedMetricValue(asset.comparison?.directional_wins_delta || 0)} · Losses ${signedMetricValue(asset.comparison?.directional_losses_delta || 0)}`, "Positive means the shadow model improved directional ex-flat win rate")}
        ${renderBacktestKpiMetric("Sample Warning", formatReviewLabel(asset.sample_warning?.label || "not_available"), asset.sample_warning?.detail || "", "Warnings remain explicit so the shadow model does not overstate reliability")}
      </section>
      <article class="detail-panel shadow-backtest-warning">
        <div class="shadow-backtest-warning-copy">
          ${renderShadowBacktestStatusBadge(asset.comparison?.status || "WARN")}
          <strong>${escapeHtml(formatReviewLabel(asset.comparison?.headline || "mixed_or_small_sample"))}</strong>
          <span>${escapeHtml(asset.sample_warning?.detail || "No sample warning supplied.")}</span>
        </div>
      </article>
      ${renderShadowBacktestComparisonTable(asset)}
      ${renderShadowBacktestWeightTable(asset)}
      ${renderShadowBacktestChangedRows(asset)}
    </article>
  `;
}

function renderShadowLogicBacktest(payload = {}) {
  const updated = document.getElementById("shadowLogicBacktestUpdated");
  if (updated) {
    updated.textContent = payload?.meta?.error
      ? `Shadow backtest unavailable: ${payload.meta.error}`
      : `Last synced: ${formatDashboardTime(payload.generated_at)}`;
  }

  const panel = document.getElementById("shadowLogicBacktestPanel");
  if (!panel) return;

  const assets = Object.values(payload.assets || {});
  panel.innerHTML = `
    <div class="backtest-report shadow-backtest-report">
      ${renderShadowBacktestMethodology(payload)}
      ${renderShadowBacktestOverviewTable(payload)}
      <section class="research-section shadow-backtest-section-stack">
        ${assets.map(renderShadowBacktestAssetSection).join("")}
      </section>
    </div>
  `;
}

function renderProgressPill(label = "", value = "") {
  return `
    <div class="progress-pill">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function formatDateValue(value) {
  if (!value) return "Not yet available";
  return escapeHtml(String(value));
}

function metricAvailable(value) {
  return value !== null && value !== undefined && value !== "";
}

function renderUnavailableMetric(label, detail) {
  return renderBacktestMetric(label, "Not yet available", detail);
}

function renderResearchBreakdownTable(title, subtitle, rows, columns, options = {}) {
  const panelClass = ["detail-panel", "research-table-panel", options.panelClass || ""].filter(Boolean).join(" ");
  const tableClass = ["dashboard-table", "research-table", options.tableClass || ""].filter(Boolean).join(" ");
  const scrollClass = ["table-scroll", "research-table-scroll", options.scrollClass || ""].filter(Boolean).join(" ");

  if (!rows.length) {
    return `
      <article class="${panelClass}">
        <div class="panel-head">
          <p class="eyebrow">${escapeHtml(subtitle)}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="empty-state">Not yet available from the research layer.</div>
      </article>
    `;
  }

  return `
    <article class="${panelClass}">
      <div class="panel-head">
        <p class="eyebrow">${escapeHtml(subtitle)}</p>
        <h3>${escapeHtml(title)}</h3>
      </div>
      ${options.description ? `<p class="research-panel-copy">${escapeHtml(options.description)}</p>` : ""}
      <div class="${scrollClass}">
        <table class="${tableClass}">
          <thead>
            <tr>${columns.map(column => `<th${column.className ? ` class="${escapeHtml(column.className)}"` : ""}>${escapeHtml(column.label)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>${columns.map(column => `<td${column.className ? ` class="${escapeHtml(column.className)}"` : ""}>${column.render(row)}</td>`).join("")}</tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function researchDataCell(primary, secondary = "") {
  return `
    <div class="research-cell">
      <strong>${escapeHtml(metricAvailable(primary) ? String(primary) : "Not yet available")}</strong>
      ${secondary ? `<span>${escapeHtml(secondary)}</span>` : ""}
    </div>
  `;
}

function renderAdrStatusCell(row = {}, secondaryAvailable = "", secondaryUnavailable = "") {
  return `
    <div class="research-cell adr-compact-cell adr-status-cell">
      <strong>${escapeHtml(row.available ? "Available" : "Unavailable")}</strong>
      <span>${escapeHtml(row.available ? secondaryAvailable : (secondaryUnavailable || row.blocker || "Supportable OHLC unavailable"))}</span>
    </div>
  `;
}

function renderAdrCompactMetricCell(primary = "", secondary = "", options = {}) {
  const className = ["research-cell", "adr-compact-cell", options.className || ""].filter(Boolean).join(" ");
  return `
    <div class="${className}">
      <strong>${escapeHtml(metricAvailable(primary) ? String(primary) : displayDash())}</strong>
      ${secondary ? `<span>${escapeHtml(secondary)}</span>` : ""}
    </div>
  `;
}

function formatAdrAuditCoverage(row = {}) {
  const coverage = row.sourceCoverage || null;
  if (!coverage?.daily?.startDate || !coverage?.daily?.endDate || !metricAvailable(coverage?.daily?.rowCount)) {
    return "Coverage unavailable";
  }

  const dailyWeekendNote = Number(coverage.daily.weekendRowCount || 0) > 0
    ? ` · ${coverage.daily.weekendRowCount} weekend daily rows`
    : "";
  const intradayCoverage = coverage.intraday
    ? `${coverage.intraday.startDate} to ${coverage.intraday.endDate} · ${coverage.intraday.sessionCount} sessions · ${coverage.intraday.candleCount} candles`
    : "Intraday coverage unavailable";
  return `Daily ${coverage.daily.startDate} to ${coverage.daily.endDate} · ${coverage.daily.rowCount} rows${dailyWeekendNote} | 1H ${intradayCoverage}`;
}

function researchPairCell(primary, secondary) {
  return `
    <div class="research-cell">
      <strong>${escapeHtml(primary || "Unknown")}</strong>
      <span>${escapeHtml(secondary || "Unknown")}</span>
    </div>
  `;
}

function computeResearchNotEvaluable(overall = {}, infrastructure = {}) {
  const predictionCount = numberOrNull(infrastructure.prediction_count);
  const evaluated = numberOrNull(overall.evaluated_predictions);
  if (predictionCount === null || evaluated === null) return null;
  return Math.max(0, predictionCount - evaluated);
}

function renderResearchStatusHeader(data = {}) {
  const overall = data.accuracy?.overall || {};
  const infrastructure = data.infrastructure || {};
  const lastSynced = data.meta?.error ? "Unavailable" : formatDashboardTime(data.meta?.last_updated);
  const replayCoverage = infrastructure.replay_coverage || "Not yet available";
  const evaluatedRows = metricAvailable(overall.evaluated_predictions) ? String(overall.evaluated_predictions) : "Not yet available";

  return `
    <section class="research-status-hero">
      <article class="detail-panel wide-panel research-status-strip">
        <div class="research-status-label">
          <p class="eyebrow">Research Status</p>
          <strong>USD historical benchmark dashboard</strong>
        </div>
        <div class="research-status-grid">
          ${renderProgressPill("Last Synced", lastSynced)}
          ${renderProgressPill("Benchmark Market", "DXY")}
          ${renderProgressPill("Replay Coverage", replayCoverage)}
          ${renderProgressPill("Rows Evaluated", evaluatedRows)}
          ${renderProgressPill("Research Mode", "Read-only")}
        </div>
      </article>
    </section>
  `;
}

function renderResearchInfrastructureSummary(data = {}) {
  const infrastructure = data.infrastructure || {};

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Infrastructure</p>
          <h3>Pipeline status</h3>
        </div>
        <p class="research-panel-copy">The research warehouse, replay engine, and evaluation pipeline feed this page. This section stays secondary to the headline USD benchmark result.</p>
      </div>
      <section class="backtest-metric-grid research-progress-grid research-infra-grid">
        ${renderBacktestMetric("Historical Warehouse", infrastructure.historical_warehouse_status || "Not yet available", "Historical source tables populated")}
        ${renderBacktestMetric("Snapshot Builder", infrastructure.snapshot_builder_status || "Not yet available", "Historical USD market snapshots available")}
        ${renderBacktestMetric("Replay Engine", infrastructure.replay_engine_status || "Not yet available", "Research observations and predictions written")}
        ${renderBacktestMetric("Outcome Evaluation", infrastructure.outcome_evaluation_status || "Not yet available", "Predictions evaluated against realised outcomes")}
        ${renderBacktestMetric("Research SQL", infrastructure.research_sql_status || "Not yet available", "Dashboard reads research views only")}
      </section>
    </section>
  `;
}

const matrixStrengthBuckets = [
  {
    key: "weak",
    label: "Weak",
    rangeLabel: "0-49%",
    definition: "Live dashboard confidence band."
  },
  {
    key: "moderate",
    label: "Moderate",
    rangeLabel: "50-64%",
    definition: "Live dashboard confidence band."
  },
  {
    key: "strong",
    label: "Strong",
    rangeLabel: "65-79%",
    definition: "Live dashboard confidence band."
  },
  {
    key: "very_strong",
    label: "Very Strong",
    rangeLabel: "80-100%",
    definition: "Live dashboard confidence band."
  }
];

const matrixDirectionBuckets = [
  { key: "bullish", label: "Bullish" },
  { key: "bearish", label: "Bearish" },
  { key: "neutral", label: "Neutral / Flat" }
];

function normalizeResearchMatrixDirection(value = "") {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized.startsWith("BULLISH")) return "bullish";
  if (normalized.startsWith("BEARISH")) return "bearish";
  if (["NO_CLEAR_BIAS", "NO CALL", "NO_CALL", "NEUTRAL", "FLAT"].includes(normalized)) return "neutral";
  return null;
}

function confidenceBandStrengthKey(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric >= 80) return "very_strong";
  if (numeric >= 65) return "strong";
  if (numeric >= 50) return "moderate";
  if (numeric >= 0) return "weak";
  return null;
}

function parseConfidenceCandidate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/%/g, "").replace(/,/g, "");
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function deriveHeadlineConfidencePercent(source = {}) {
  const confidence = headlineConfidenceLib.computeHeadlineConfidenceFromRow(source).value;
  return Number.isFinite(confidence) ? roundTo(confidence, 1) : null;
}

function normalizeConfidencePercent(row = {}) {
  const derivedHeadline = deriveHeadlineConfidencePercent(row);
  const candidates = [
    row.displayed_headline_confidence_pct,
    derivedHeadline,
    row.headline_confidence_pct,
    row.predicted_conviction,
    row.agent_conviction,
    row.confidence,
    row.conviction
  ];

  for (const candidate of candidates) {
    const numeric = parseConfidenceCandidate(candidate);
    if (!Number.isFinite(numeric)) continue;

    if (numeric >= 0.5 && numeric <= 1) {
      return roundTo(numeric * 100, 1);
    }

    if (numeric >= 0 && numeric <= 100) {
      return roundTo(numeric, 1);
    }
  }

  return null;
}

function normalizeResearchMatrixStrength(row = {}) {
  const confidencePct = normalizeConfidencePercent(row);
  return confidenceBandStrengthKey(confidencePct);
}

function normaliseResearchRows(rows) {
  return Array.isArray(rows) ? rows.filter(row => row && typeof row === "object") : [];
}

function roundTo(value, decimals = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const factor = 10 ** Math.max(0, Number(decimals) || 0);
  return Math.round(numeric * factor) / factor;
}

function computeResearchMatrix(rows = [], options = {}) {
  const assetCode = options.assetCode || "USD";
  const timeframe = options.timeframe || "following 24hrs";
  const safeRows = normaliseResearchRows(rows);
  const filteredRows = safeRows.filter(row =>
    (!assetCode || row.asset_code === assetCode) &&
    (!timeframe || row.timeframe === timeframe)
  );
  const matrix = {};
  let usableRowCount = 0;
  const exclusionCounts = {};

  const trackExclusion = (reason) => {
    exclusionCounts[reason] = (exclusionCounts[reason] || 0) + 1;
  };

  matrixDirectionBuckets.forEach(direction => {
    matrix[direction.key] = {};
    matrixStrengthBuckets.forEach(strength => {
      matrix[direction.key][strength.key] = {
        callCount: 0,
        accurateCount: 0,
        wrongCount: 0,
        flatCount: 0,
        exFlatAccuracyPct: null,
        flatRatePct: null
      };
    });
  });

  filteredRows.forEach(row => {
      const directionKey = normalizeResearchMatrixDirection(row.predicted_direction || row.agent_direction);
      const strengthKey = normalizeResearchMatrixStrength(row);
      const result = String(row.combined_result || "").trim().toUpperCase();

      if (!["CORRECT", "WRONG", "FLAT"].includes(result)) {
        trackExclusion("unsupported_result");
        return;
      }
      if (!directionKey) {
        trackExclusion("unsupported_direction");
        return;
      }
      if (!metricAvailable(normalizeConfidencePercent(row))) {
        trackExclusion("missing_confidence");
        return;
      }
      if (!strengthKey) {
        trackExclusion("unsupported_confidence_band");
        return;
      }

      const bucket = matrix[directionKey][strengthKey];
      usableRowCount += 1;
      bucket.callCount += 1;

      if (result === "CORRECT") {
        bucket.accurateCount += 1;
      } else if (result === "WRONG") {
        bucket.wrongCount += 1;
      } else if (result === "FLAT") {
        bucket.flatCount += 1;
      }
    });

  matrixDirectionBuckets.forEach(direction => {
    matrixStrengthBuckets.forEach(strength => {
      const bucket = matrix[direction.key][strength.key];
      const exFlatCalls = bucket.accurateCount + bucket.wrongCount;
      bucket.exFlatAccuracyPct = exFlatCalls
        ? roundTo((bucket.accurateCount / exFlatCalls) * 100, 1)
        : null;
      bucket.flatRatePct = bucket.callCount
        ? roundTo((bucket.flatCount / bucket.callCount) * 100, 1)
        : null;
    });
  });

  const mostCommonExclusionReason = Object.entries(exclusionCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "none";

  return {
    matrix,
    sourceRowCount: filteredRows.length,
    usableRowCount,
    excludedRowCount: Math.max(0, filteredRows.length - usableRowCount),
    mostCommonExclusionReason,
    exclusionCounts
  };
}

function getResearchRowIdentifier(row = {}) {
  return row.prediction_id || row.research_id || row.id || row.prediction_uuid || null;
}

function getResearchRowExclusionReason(row = {}) {
  const directionKey = normalizeResearchMatrixDirection(row.predicted_direction || row.agent_direction);
  const confidencePct = normalizeConfidencePercent(row);
  const strengthKey = confidenceBandStrengthKey(confidencePct);
  const result = String(row.combined_result || "").trim().toUpperCase();

  if (!["CORRECT", "WRONG", "FLAT"].includes(result)) return "unsupported_result";
  if (!directionKey) return "unsupported_direction";
  if (!metricAvailable(confidencePct)) return "missing_confidence";
  if (!strengthKey) return "unsupported_confidence_band";
  return null;
}

function formatMatrixAccuracy(value) {
  if (!metricAvailable(value)) return `${displayDash()} ex-flat`;
  const numeric = Number(value);
  const rounded = Math.abs(numeric - Math.round(numeric)) < 0.05
    ? Math.round(numeric)
    : roundTo(numeric, 1);
  return `${rounded}% ex-flat`;
}

function matrixCellTone(callCount, accuracyPct) {
  if (!callCount || !metricAvailable(accuracyPct)) return "empty";
  if (accuracyPct >= 65) return "high";
  if (accuracyPct >= 50) return "medium";
  return "low";
}

function matrixDirectionLabel(key = "") {
  const entry = matrixDirectionBuckets.find(item => item.key === key);
  return entry?.label || "Unknown";
}

function matrixStrengthLabel(key = "") {
  const entry = matrixStrengthBuckets.find(item => item.key === key);
  return entry?.label || "Unknown";
}

function titleCaseWords(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function formatMatrixCorrectCount(value) {
  return metricAvailable(value) ? `${value} correct` : `${displayDash()} correct`;
}

function formatResearchTimeframeLabel(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "following 24hrs") return "24H";
  if (normalized === "3d from call") return "3D";
  return String(value || "Unknown");
}

function formatBenchmarkMove(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return displayDash();
  const rounded = roundTo(numeric, 2);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

function formatEvaluationResult(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "Unknown";
  if (normalized === "CORRECT") return "Correct";
  if (normalized === "WRONG") return "Wrong";
  if (normalized === "FLAT") return "Flat";
  if (normalized === "NOT_EVALUABLE") return "Not evaluable";
  return normalized.replaceAll("_", " ");
}

function formatConvictionPercent(value) {
  const numeric = parseConfidenceCandidate(value);
  if (!Number.isFinite(numeric)) return displayDash();
  const normalized = numeric >= 0.5 && numeric <= 1 ? numeric * 100 : numeric;
  const rounded = roundTo(normalized, 1);
  const display = Math.abs(rounded - Math.round(rounded)) < 0.05 ? Math.round(rounded) : rounded;
  return `${display}%`;
}

function formatProductionStrength(value = "") {
  const key = confidenceBandStrengthKey(value);
  return key ? matrixStrengthLabel(key) : "Unknown";
}

function formatBenchmarkPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return displayDash();
  return String(roundTo(numeric, 4));
}

function formatFallbackCell(value) {
  if (value === null || value === undefined) return displayDash();
  const text = String(value).trim();
  return text ? escapeHtml(text) : displayDash();
}

function buildResearchEvidenceAudit(rows = [], options = {}) {
  const assetCode = options.assetCode || "USD";
  const timeframe = options.timeframe || "following 24hrs";
  const sourceView = options.sourceView || "research_prediction_usd_benchmark_summary";
  const filteredRows = normaliseResearchRows(rows).filter(row =>
    (!assetCode || row.asset_code === assetCode) &&
    (!timeframe || row.timeframe === timeframe)
  );

  const matrixComputation = computeResearchMatrix(filteredRows, {
    assetCode: "",
    timeframe: ""
  });
  const includedRows = [];
  const excludedRows = [];
  const directionCounts = {};
  const strengthCounts = {};
  const matrixCellCounts = {};
  const resultCounts = {
    correct: 0,
    wrong: 0,
    flat: 0
  };

  filteredRows.forEach(row => {
    const directionKey = normalizeResearchMatrixDirection(row.predicted_direction || row.agent_direction);
    const confidencePct = normalizeConfidencePercent(row);
    const strengthKey = confidenceBandStrengthKey(confidencePct);
    const resultRaw = String(row.combined_result || "").trim().toUpperCase();
    const exclusionReason = getResearchRowExclusionReason(row);
    const rowEvidence = {
      snapshotDate: row.snapshot_date || row.call_date || "",
      assetCode: row.asset_code || assetCode || "",
      timeframe: formatResearchTimeframeLabel(row.timeframe),
      directionKey,
      directionLabel: directionKey ? matrixDirectionLabel(directionKey) : titleCaseWords(normaliseDirection(row.agent_direction || row.predicted_direction || "Unknown")),
      convictionPctValue: confidencePct,
      convictionPct: formatConvictionPercent(confidencePct),
      strengthKey,
      strengthBucket: strengthKey ? matrixStrengthLabel(strengthKey) : "Unknown",
      benchmark: row.benchmark_market || "",
      startPrice: formatBenchmarkPrice(row.open_price),
      endPrice: formatBenchmarkPrice(row.close_price),
      benchmarkMove: formatBenchmarkMove(row.pct_change),
      resultKey: resultRaw,
      result: formatEvaluationResult(resultRaw),
      matrixCell: directionKey && strengthKey
        ? `${matrixDirectionLabel(directionKey)} / ${matrixStrengthLabel(strengthKey)}`
        : "Unmapped",
      matrixCellKey: directionKey && strengthKey ? `${directionKey}__${strengthKey}` : "unmapped",
      predictionId: getResearchRowIdentifier(row),
      predictionIdDisplay: getResearchRowIdentifier(row) ? escapeHtml(String(getResearchRowIdentifier(row))) : displayDash(),
      exclusionReasonKey: exclusionReason,
      exclusionReason: exclusionReason ? titleCaseWords(exclusionReason) : "Included"
    };

    if (exclusionReason) {
      excludedRows.push(rowEvidence);
      return;
    }

    includedRows.push(rowEvidence);
    directionCounts[directionKey] = (directionCounts[directionKey] || 0) + 1;
    strengthCounts[strengthKey] = (strengthCounts[strengthKey] || 0) + 1;
    matrixCellCounts[rowEvidence.matrixCell] = (matrixCellCounts[rowEvidence.matrixCell] || 0) + 1;
    if (resultRaw === "CORRECT") resultCounts.correct += 1;
    if (resultRaw === "WRONG") resultCounts.wrong += 1;
    if (resultRaw === "FLAT") resultCounts.flat += 1;
  });

  includedRows.sort((a, b) => String(b.snapshotDate).localeCompare(String(a.snapshotDate)));
  excludedRows.sort((a, b) => String(b.snapshotDate).localeCompare(String(a.snapshotDate)));

  const totals = computeMatrixTotals(matrixComputation.matrix);
  const evidenceRowsTotal = includedRows.length;
  const matrixTotal = totals.evaluatedCalls;
  const difference = matrixTotal - evidenceRowsTotal;
  const directionalDecisions = resultCounts.correct + resultCounts.wrong;
  const overallAccuracyPct = evidenceRowsTotal ? roundTo((totals.correctCalls / evidenceRowsTotal) * 100, 1) : null;
  const decisionWinRateExFlatPct = directionalDecisions ? roundTo((totals.correctCalls / directionalDecisions) * 100, 1) : null;
  const flatOutcomePct = evidenceRowsTotal ? roundTo((resultCounts.flat / evidenceRowsTotal) * 100, 1) : null;

  return {
    sourceView,
    sourceRowCount: filteredRows.length,
    includedRows,
    excludedRows,
    exclusionCounts: matrixComputation.exclusionCounts || {},
    directionCounts,
    strengthCounts,
    matrixCellCounts,
    resultCounts,
    matrix: matrixComputation.matrix,
    matrixTotal,
    evidenceRowsTotal,
    difference,
    reconciliationPassed: difference === 0,
    totalCorrect: totals.correctCalls,
    totalWrong: resultCounts.wrong,
    totalFlat: resultCounts.flat,
    overallAccuracyPct,
    decisionWinRateExFlatPct,
    flatOutcomePct,
    directionalDecisions
  };
}

function computeMatrixTotals(matrix = {}) {
  let evaluatedCalls = 0;
  let correctCalls = 0;
  let wrongCalls = 0;
  let flatCalls = 0;

  matrixDirectionBuckets.forEach(direction => {
    matrixStrengthBuckets.forEach(strength => {
      const cell = matrix?.[direction.key]?.[strength.key];
      evaluatedCalls += Number(cell?.callCount || 0);
      correctCalls += Number(cell?.accurateCount || 0);
      wrongCalls += Number(cell?.wrongCount || 0);
      flatCalls += Number(cell?.flatCount || 0);
    });
  });

  return { evaluatedCalls, correctCalls, wrongCalls, flatCalls };
}

function computeMatrixSummary(rows = [], options = {}) {
  const assetCode = options.assetCode || "USD";
  const timeframe = options.timeframe || "following 24hrs";
  const directionTotals = {
    bullish: { total: 0, correct: 0, wrong: 0, flat: 0 },
    bearish: { total: 0, correct: 0, wrong: 0, flat: 0 },
    neutral: { total: 0, correct: 0, wrong: 0, flat: 0 }
  };
  const resultTotals = {
    evaluated: 0,
    correct: 0,
    wrong: 0,
    flat: 0
  };

  normaliseResearchRows(rows)
    .filter(row =>
      (!assetCode || row.asset_code === assetCode) &&
      (!timeframe || row.timeframe === timeframe)
    )
    .forEach(row => {
      const directionKey = normalizeResearchMatrixDirection(row.predicted_direction || row.agent_direction);
      const strengthKey = normalizeResearchMatrixStrength(row);
      const result = String(row.combined_result || "").trim().toUpperCase();

      if (!directionKey || !strengthKey) return;
      if (!["CORRECT", "WRONG", "FLAT"].includes(result)) return;

      resultTotals.evaluated += 1;
      if (result === "CORRECT") resultTotals.correct += 1;
      if (result === "WRONG") resultTotals.wrong += 1;
      if (result === "FLAT") resultTotals.flat += 1;

      const bucket = directionTotals[directionKey];
      bucket.total += 1;
      if (result === "WRONG") bucket.wrong += 1;
      if (result === "FLAT") bucket.flat += 1;
      if (result === "CORRECT") {
        bucket.correct += 1;
      }
    });

  return { directionTotals, resultTotals };
}

function computeResearchOutcomeTotals(rows = [], options = {}) {
  const assetCode = options.assetCode || "USD";
  const timeframe = options.timeframe || "following 24hrs";
  const resultTotals = {
    total: 0,
    correct: 0,
    wrong: 0,
    flat: 0,
    no_call: 0,
    not_evaluable: 0
  };

  normaliseResearchRows(rows)
    .filter(row =>
      (!assetCode || row.asset_code === assetCode) &&
      (!timeframe || row.timeframe === timeframe)
    )
    .forEach(row => {
      const result = String(row.combined_result || "").trim().toUpperCase();
      if (!result) return;
      resultTotals.total += 1;
      if (result === "CORRECT") resultTotals.correct += 1;
      if (result === "WRONG") resultTotals.wrong += 1;
      if (result === "FLAT") resultTotals.flat += 1;
      if (result === "NO_CALL") resultTotals.no_call += 1;
      if (result === "NOT_EVALUABLE") resultTotals.not_evaluable += 1;
    });

  return resultTotals;
}

function formatAccuracyWithCounts(correct, total) {
  const safeCorrect = Number(correct || 0);
  const safeTotal = Number(total || 0);
  const accuracyPct = safeTotal ? roundTo((safeCorrect / safeTotal) * 100, 1) : null;
  return {
    countLine: `${safeCorrect} / ${safeTotal} correct`,
    accuracyLine: metricAvailable(accuracyPct) ? `${formatMatrixAccuracy(accuracyPct)}` : `${displayDash()} accuracy`
  };
}

function formatRateLine(numerator, denominator, label) {
  const safeNumerator = Number(numerator || 0);
  const safeDenominator = Number(denominator || 0);
  if (!safeDenominator) return `${label}: ${displayDash()}`;
  const pct = roundTo((safeNumerator / safeDenominator) * 100, 1);
  return `${label}: ${safeNumerator} / ${safeDenominator} = ${percentValue(pct)}`;
}

function formatCompactRateMetric(numerator, denominator, options = {}) {
  const safeNumerator = Number(numerator || 0);
  const safeDenominator = Number(denominator || 0);
  const numeratorLabel = options.numeratorLabel || null;
  const countSuffix = options.countSuffix || "";

  if (!safeDenominator) {
    return {
      primary: displayDash(),
      secondary: numeratorLabel ? `${safeNumerator} / ${safeDenominator} ${numeratorLabel}`.trim() : `${safeNumerator} / ${safeDenominator}`.trim(),
      detail: options.emptyDetail || "No evaluated rows"
    };
  }

  const pct = roundTo((safeNumerator / safeDenominator) * 100, 1);
  const secondaryBase = numeratorLabel
    ? `${safeNumerator} / ${safeDenominator} ${numeratorLabel}`.trim()
    : `${safeNumerator} / ${safeDenominator}`;

  return {
    primary: percentValue(pct),
    secondary: `${secondaryBase}${countSuffix}`.trim(),
    detail: options.detail || ""
  };
}

function formatMatrixRateBundle(correct, wrong, flat, total) {
  const safeCorrect = Number(correct || 0);
  const safeWrong = Number(wrong || 0);
  const safeFlat = Number(flat || 0);
  const safeTotal = Number(total || 0);
  const exFlatDenominator = safeCorrect + safeWrong;

  return {
    includingFlat: formatRateLine(safeCorrect, safeTotal, "Accuracy Including Flat"),
    exFlat: formatRateLine(safeCorrect, exFlatDenominator, "Decision Win Rate Ex-Flat"),
    flat: formatRateLine(safeFlat, safeTotal, "Flat Outcomes")
  };
}

function buildMatrixSummaryCards(directionTotals = {}, resultTotals = {}, outcomeTotals = {}) {
  const overallIncludingFlat = formatCompactRateMetric(resultTotals.correct, resultTotals.evaluated, {
    numeratorLabel: "correct"
  });
  const overallExFlat = formatCompactRateMetric(resultTotals.correct, resultTotals.correct + resultTotals.wrong, {
    detail: "(excludes flat)"
  });
  const overallFlat = formatCompactRateMetric(resultTotals.flat, resultTotals.evaluated);

  const buildDirectionCard = (label, totals) => {
    const exFlat = formatCompactRateMetric(totals.correct, totals.correct + totals.wrong, {
      emptyDetail: "Ex-flat: —"
    });
    return renderBacktestKpiMetric(
      label,
      exFlat.primary,
      `${totals.correct} win / ${totals.wrong} loss / ${totals.flat} flat`,
      `Ex-flat: ${exFlat.primary} · Flat: ${totals.flat} / ${totals.total}`
    );
  };

  return `
    ${renderBacktestKpiMetric("Total Evaluated", String(resultTotals.evaluated), "Included matrix rows")}
    ${renderBacktestKpiMetric("Correct", String(resultTotals.correct), "Directional wins")}
    ${renderBacktestKpiMetric("Wrong", String(resultTotals.wrong), "Directional misses")}
    ${renderBacktestKpiMetric("Flat", String(resultTotals.flat), "Flat benchmark outcomes")}
    ${renderBacktestKpiMetric("No Call", String(outcomeTotals.no_call ?? 0), "Not included in matrix")}
    ${renderBacktestKpiMetric("Not Evaluable", String(outcomeTotals.not_evaluable ?? 0), "Missing evaluation-window coverage")}
    ${renderBacktestKpiMetric("Accuracy (Incl. Flat)", overallIncludingFlat.primary, overallIncludingFlat.secondary, "Secondary diagnostic only")}
    ${renderBacktestKpiMetric("Decision Win Rate", overallExFlat.primary, overallExFlat.secondary, "Primary directional metric")}
    ${renderBacktestKpiMetric("Flat Outcomes", overallFlat.primary, overallFlat.secondary, "Neutral market outcomes")}
    ${buildDirectionCard("Bullish", directionTotals.bullish)}
    ${buildDirectionCard("Bearish", directionTotals.bearish)}
    ${buildDirectionCard("Neutral", directionTotals.neutral)}
  `;
}

function buildResearchEvidenceRows(rows = [], options = {}) {
  return buildResearchEvidenceAudit(rows, options).includedRows.map(row => ({
    snapshotDate: row.snapshotDate,
    assetCode: row.assetCode,
    timeframe: row.timeframe,
    direction: row.directionLabel,
    convictionPct: row.convictionPct,
    strengthBucket: row.strengthBucket,
    benchmark: row.benchmark,
    startPrice: row.startPrice,
    endPrice: row.endPrice,
    benchmarkMove: row.benchmarkMove,
    result: row.result,
    matrixCell: row.matrixCell,
    predictionId: row.predictionId
  }));
}

function renderResearch24hContext(summary = null) {
  const benchmark = summary?.benchmark_market || "DXY";

  return `
    <article class="detail-panel wide-panel research-matrix-panel">
      <div class="research-matrix-meta">
        <span><strong>Asset:</strong> USD</span>
        <span><strong>Timeframe:</strong> 24H</span>
        <span><strong>Benchmark:</strong> ${escapeHtml(benchmark)}</span>
      </div>
      <p class="research-panel-copy research-matrix-rule">
        <strong>Evaluation rule:</strong> USD bullish is correct when ${escapeHtml(benchmark)} rises over the following 24hrs; USD bearish is correct when ${escapeHtml(benchmark)} falls; flat is a neutral market outcome when ${escapeHtml(benchmark)} remains inside the flat threshold.
      </p>
    </article>
  `;
}

function renderResearchAsset24hContext(options = {}) {
  const assetCode = options.assetCode || "USD";
  const benchmark = options.benchmark
    || (assetCode === "EUR"
      ? "EURUSD"
      : (assetCode === "GOLD" ? "XAUUSD" : (assetCode === "BTC" ? "BTCUSD" : "DXY")));
  const ruleText = options.ruleText || (
    assetCode === "EUR"
      ? `EUR bullish is correct when ${benchmark} rises over the following 24hrs; EUR bearish is correct when ${benchmark} falls; flat is a neutral market outcome when ${benchmark} remains inside the EUR/USD flat threshold.`
      : assetCode === "GOLD"
        ? `Gold bullish is correct when ${benchmark} rises over the following 24hrs; Gold bearish is correct when ${benchmark} falls; flat is a neutral market outcome when ${benchmark} remains inside the Gold 24H flat threshold.`
      : assetCode === "BTC"
        ? `BTC bullish is correct when ${benchmark} rises over the following 24hrs; BTC bearish is correct when ${benchmark} falls; flat is a neutral market outcome when ${benchmark} remains inside the BTC 24H flat threshold.`
      : `USD bullish is correct when ${benchmark} rises over the following 24hrs; USD bearish is correct when ${benchmark} falls; flat is a neutral market outcome when ${benchmark} remains inside the flat threshold.`
  );

  return `
    <article class="detail-panel wide-panel research-matrix-panel">
      <div class="research-matrix-meta">
        <span><strong>Asset:</strong> ${escapeHtml(assetCode)}</span>
        <span><strong>Timeframe:</strong> 24H</span>
        <span><strong>Benchmark:</strong> ${escapeHtml(benchmark)}</span>
      </div>
      <p class="research-panel-copy research-matrix-rule">
        <strong>Evaluation rule:</strong> ${escapeHtml(ruleText)}
      </p>
    </article>
  `;
}

function renderMatrixEvidenceCountItems(counts = {}, orderedLabels = []) {
  const entries = orderedLabels.length
    ? orderedLabels
      .map(([key, label]) => [label, Number(counts[key] || 0)])
      .filter(([, count]) => count > 0)
    : Object.entries(counts)
      .map(([label, count]) => [label, Number(count || 0)])
      .filter(([, count]) => count > 0);

  if (!entries.length) {
    return `<span class="matrix-evidence-count empty">None</span>`;
  }

  return entries
    .map(([label, count]) => `<span class="matrix-evidence-count"><strong>${count}</strong> ${escapeHtml(label)}</span>`)
    .join("");
}

function renderMatrixEvidenceSummaryGrid(audit = {}) {
  const exclusionReasonCounts = Object.fromEntries(
    Object.entries(audit.exclusionCounts || {}).map(([key, count]) => [titleCaseWords(key), count])
  );
  const rateBundle = formatMatrixRateBundle(
    audit.totalCorrect,
    audit.totalWrong,
    audit.totalFlat,
    audit.includedRows?.length || 0
  );

  return `
    <div class="matrix-evidence-summary-grid">
      <div class="matrix-evidence-summary-card">
        <span>Source View</span>
        <strong>${escapeHtml(audit.sourceView || "research_prediction_usd_benchmark_summary")}</strong>
      </div>
      <div class="matrix-evidence-summary-card">
        <span>Total Rows Fetched</span>
        <strong>${audit.sourceRowCount ?? 0}</strong>
      </div>
      <div class="matrix-evidence-summary-card">
        <span>Included In Matrix</span>
        <strong>${audit.includedRows?.length ?? 0}</strong>
      </div>
      <div class="matrix-evidence-summary-card">
        <span>Excluded</span>
        <strong>${audit.excludedRows?.length ?? 0}</strong>
      </div>
      <div class="matrix-evidence-summary-card">
        <span>Total Correct</span>
        <strong>${audit.totalCorrect ?? 0}</strong>
      </div>
      <div class="matrix-evidence-summary-card">
        <span>Total Wrong</span>
        <strong>${audit.totalWrong ?? 0}</strong>
      </div>
      <div class="matrix-evidence-summary-card">
        <span>Total Flat</span>
        <strong>${audit.totalFlat ?? 0}</strong>
      </div>
      <div class="matrix-evidence-summary-card">
        <span>Accuracy Including Flat</span>
        <strong>${metricAvailable(audit.overallAccuracyPct) ? percentValue(audit.overallAccuracyPct) : displayDash()}</strong>
        <small>${rateBundle.includingFlat}</small>
      </div>
      <div class="matrix-evidence-summary-card">
        <span>Decision Win Rate Ex-Flat</span>
        <strong>${metricAvailable(audit.decisionWinRateExFlatPct) ? percentValue(audit.decisionWinRateExFlatPct) : displayDash()}</strong>
        <small>${rateBundle.exFlat}</small>
      </div>
      <div class="matrix-evidence-summary-card">
        <span>Flat Outcomes</span>
        <strong>${metricAvailable(audit.flatOutcomePct) ? percentValue(audit.flatOutcomePct) : displayDash()}</strong>
        <small>${rateBundle.flat}</small>
      </div>
    </div>
    <p class="matrix-evidence-note">Flat outcomes are not counted as wins or losses in the ex-flat decision win rate. They remain visible as a separate bucket because they matter for evaluating whether the call produced tradable directional movement.</p>
    <div class="matrix-evidence-breakdown-grid">
      <div class="matrix-evidence-breakdown-card">
        <span>Exclusion Reasons</span>
        <div class="matrix-evidence-count-list">${renderMatrixEvidenceCountItems(exclusionReasonCounts)}</div>
      </div>
      <div class="matrix-evidence-breakdown-card">
        <span>Counts By Direction</span>
        <div class="matrix-evidence-count-list">${renderMatrixEvidenceCountItems(audit.directionCounts, [
          ["bullish", "Bullish"],
          ["bearish", "Bearish"],
          ["neutral", "Neutral / Flat"]
        ])}</div>
      </div>
      <div class="matrix-evidence-breakdown-card">
        <span>Counts By Strength Bucket</span>
        <div class="matrix-evidence-count-list">${renderMatrixEvidenceCountItems(audit.strengthCounts, matrixStrengthBuckets.map(bucket => [bucket.key, bucket.label]))}</div>
      </div>
      <div class="matrix-evidence-breakdown-card matrix-evidence-breakdown-card-wide">
        <span>Counts By Matrix Cell</span>
        <div class="matrix-evidence-count-list">${renderMatrixEvidenceCountItems(audit.matrixCellCounts)}</div>
      </div>
    </div>
  `;
}

function renderMatrixEvidenceRows(rows = [], kind = "included") {
  if (!rows.length) {
    return `<div class="empty-state matrix-evidence-empty">${kind === "excluded" ? "No excluded rows for this matrix." : "No evidence rows available for this matrix."}</div>`;
  }

  return `
    <div class="matrix-evidence-table-scroll">
      <table class="dashboard-table research-evidence-table matrix-evidence-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Asset</th>
            <th>Timeframe</th>
            <th>Direction</th>
            <th>Conviction %</th>
            <th>Strength Bucket</th>
            <th>Benchmark</th>
            <th>Benchmark Start</th>
            <th>Benchmark End</th>
            <th>Benchmark Move</th>
            <th>Evaluation Result</th>
            <th>Matrix Cell</th>
            <th>Prediction / Research ID</th>
            ${kind === "excluded" ? "<th>Exclusion Reason</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr data-evidence-result="${escapeHtml((row.resultKey || "").toLowerCase())}" data-evidence-direction="${escapeHtml(row.directionKey || "")}" data-evidence-strength="${escapeHtml(row.strengthKey || "")}">
              <td>${formatFallbackCell(row.snapshotDate)}</td>
              <td>${formatFallbackCell(row.assetCode)}</td>
              <td>${formatFallbackCell(row.timeframe)}</td>
              <td>${formatFallbackCell(row.directionLabel)}</td>
              <td>${row.convictionPct || displayDash()}</td>
              <td>${formatFallbackCell(row.strengthBucket)}</td>
              <td>${formatFallbackCell(row.benchmark)}</td>
              <td>${row.startPrice || displayDash()}</td>
              <td>${row.endPrice || displayDash()}</td>
              <td>${row.benchmarkMove || displayDash()}</td>
              <td>${formatFallbackCell(row.result)}</td>
              <td>${formatFallbackCell(row.matrixCell)}</td>
              <td>${row.predictionIdDisplay || displayDash()}</td>
              ${kind === "excluded" ? `<td>${formatFallbackCell(row.exclusionReason)}</td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMatrixEvidenceAccordion(rows = [], options = {}) {
  const audit = buildResearchEvidenceAudit(rows, options);
  const exportKey = options.exportKey || `${String(options.assetCode || "usd").toLowerCase()}-24h`;
  const filterButtons = [
    { key: "all", label: "All" },
    { key: "correct", label: "Correct" },
    { key: "wrong", label: "Wrong" },
    { key: "flat", label: "Flat" },
    { key: "bullish", label: "Bullish" },
    { key: "bearish", label: "Bearish" },
    { key: "weak", label: "Weak" },
    { key: "moderate", label: "Moderate" },
    { key: "strong", label: "Strong" },
    { key: "very_strong", label: "Very Strong" }
  ];

  return `
    <details class="matrix-evidence-accordion">
      <summary>Show rows behind this matrix</summary>
      <div class="matrix-evidence-body">
        <div class="matrix-evidence-reconciliation ${audit.reconciliationPassed ? "pass" : "fail"}">
          <div class="matrix-evidence-reconciliation-grid">
            <div><span>Matrix Total</span><strong>${audit.matrixTotal}</strong></div>
            <div><span>Evidence Rows Total</span><strong>${audit.evidenceRowsTotal}</strong></div>
            <div><span>Difference</span><strong>${audit.difference}</strong></div>
            <div><span>Reconciliation</span><strong>${audit.reconciliationPassed ? "PASS" : "FAIL"}</strong></div>
          </div>
        </div>
        ${renderMatrixEvidenceSummaryGrid(audit)}
        <div class="matrix-evidence-toolbar">
          <div class="matrix-evidence-filter-group" role="group" aria-label="Matrix evidence filters">
            ${filterButtons.map(button => `
              <button class="matrix-evidence-filter-button${button.key === "all" ? " active" : ""}" type="button" data-matrix-evidence-filter="${button.key}">
                ${escapeHtml(button.label)}
              </button>
            `).join("")}
          </div>
          <button class="matrix-evidence-export-button" type="button" data-export-matrix-evidence="${escapeHtml(exportKey)}">Export Matrix Evidence CSV</button>
        </div>
        <div class="matrix-evidence-table-wrap">
          ${renderMatrixEvidenceRows(audit.includedRows, "included")}
        </div>
        ${audit.excludedRows.length ? `
          <div class="matrix-evidence-excluded-block">
            <p class="research-panel-copy">Excluded rows were fetched from the same source view but did not qualify for the matrix. They are listed here with the exclusion reason for auditability.</p>
            ${renderMatrixEvidenceRows(audit.excludedRows, "excluded")}
          </div>
        ` : ""}
      </div>
    </details>
  `;
}

function renderResearchEvidenceAudit(rows = [], totals = {}, sourceView = "research_prediction_usd_benchmark_summary") {
  const evidenceRows = buildResearchEvidenceRows(rows, {
    assetCode: "USD",
    timeframe: "following 24hrs"
  });
  const shownRows = evidenceRows.slice(0, 10);

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Backtest Data Checker</p>
          <h3>Recent evaluated 24H rows</h3>
        </div>
        <p class="research-panel-copy">These are real benchmark evaluation rows from the research layer. They prove the dated calls that feed the 24H matrix buckets.</p>
      </div>
      ${renderResearchBreakdownTable("Backtest Data Checker", "Evidence Audit", shownRows, [
        { label: "Date", render: row => researchDataCell(row.snapshotDate || "Unknown") },
        { label: "Asset", render: row => researchDataCell(row.assetCode) },
        { label: "Timeframe", render: row => researchDataCell(row.timeframe) },
        { label: "Direction", render: row => researchDataCell(row.direction) },
        { label: "Conviction %", render: row => researchDataCell(row.convictionPct) },
        { label: "Strength Bucket", render: row => researchDataCell(row.strengthBucket) },
        { label: "Benchmark", render: row => researchDataCell(row.benchmark) },
        { label: "Start", render: row => researchDataCell(row.startPrice) },
        { label: "End", render: row => researchDataCell(row.endPrice) },
        { label: "Move", render: row => researchDataCell(row.benchmarkMove) },
        { label: "Result", render: row => researchDataCell(row.result) },
        { label: "Matrix Cell", render: row => researchDataCell(row.matrixCell) }
      ], {
        description: "Latest evaluated USD following-24hrs rows only. Conviction % is the original recorded confidence score. Matrix Cell uses the same direction and strength mapping as the table above.",
        panelClass: "research-evidence-panel",
        tableClass: "research-evidence-table"
      })}
      <article class="detail-panel research-secondary-panel">
        <p class="research-audit-line">
          <strong>Matrix evaluated calls:</strong> ${totals.evaluatedCalls ?? 0}
          <span>Evidence rows shown: latest ${shownRows.length} of ${evidenceRows.length}</span>
          <span>Source view: ${escapeHtml(sourceView)}</span>
        </p>
      </article>
    </section>
  `;
}

function renderResearch24hEvidenceSummary(summary = null, data = {}) {
  const overall = data.accuracy?.overall || null;
  const infrastructure = data.infrastructure || {};
  const replayCoverage = infrastructure.replay_coverage || "Not yet available";
  const evaluatedRows = metricAvailable(summary?.evaluated_calls)
    ? String(summary.evaluated_calls)
    : (metricAvailable(overall?.evaluated_predictions) ? String(overall.evaluated_predictions) : "Not yet available");

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Supporting Evidence</p>
          <h3>24H benchmark context</h3>
        </div>
        <p class="research-panel-copy">The matrix is the headline view. These supporting cards show the current replay scope and the record behind the 24H result. Incl-flat accuracy is secondary context; ex-flat win rate is the main directional read.</p>
      </div>
      <section class="backtest-metric-grid research-summary-grid">
        ${summary
          ? renderBacktestMetric("Overall 24H Accuracy (Incl. Flat)", percentValue(summary.overall_accuracy_pct), "Secondary diagnostic only; directional read should use ex-flat win rate")
          : renderUnavailableMetric("Overall 24H Accuracy (Incl. Flat)", "Waiting for populated research views")}
        ${renderBacktestMetric("Replay Coverage", replayCoverage, "Current warehouse-backed USD replay window")}
        ${renderBacktestMetric("Rows Evaluated", evaluatedRows, "CORRECT, WRONG, or FLAT rows used in 24H benchmark totals")}
        ${summary
          ? renderBacktestMetric("Wins / Losses / Flats", `${summary.wins ?? "--"} / ${summary.losses ?? "--"} / ${summary.flats ?? "--"}`, "Benchmark record behind the 24H matrix")
          : renderUnavailableMetric("Wins / Losses / Flats", "Waiting for populated research views")}
      </section>
    </section>
  `;
}

function checkerStatusBadge(status = "") {
  const normalized = String(status || "").trim().toUpperCase();
  const tone = normalized === "PASS"
    ? "pass"
    : normalized === "TOLERANCE_PASS"
      ? "tolerance"
      : normalized === "FAIL"
        ? "fail"
        : "missing";
  const label = normalized === "TOLERANCE_PASS"
    ? "Tolerance Pass"
    : normalized === "MISSING_DATA"
      ? "Missing Data"
      : (normalized || "Unknown");
  return `<span class="checker-status-badge ${tone}">${escapeHtml(label)}</span>`;
}

function formatCheckerValue(value) {
  if (value === null || value === undefined || value === "") return displayDash();
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(roundTo(value, 3));
  }
  return escapeHtml(String(value));
}

function formatCheckerDifference(value) {
  if (value === null || value === undefined || value === "") return displayDash();
  if (typeof value === "number") {
    const rounded = roundTo(value, 3);
    return `${rounded > 0 ? "+" : ""}${rounded}`;
  }
  return escapeHtml(String(value));
}

function displayDash() {
  return "—";
}

function checkerRowItems(row = {}) {
  return [
    ...(Array.isArray(row.differences) ? row.differences : []),
    ...(Array.isArray(row.factor_comparisons)
      ? row.factor_comparisons.flatMap(item => [item.signal, item.weight].filter(Boolean))
      : [])
  ];
}

function checkerMismatchCount(row = {}) {
  return checkerRowItems(row).filter(item => {
    const status = String(item?.status || "").trim().toUpperCase();
    return status && status !== "PASS";
  }).length;
}

function checkerRowTone(status = "") {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "FAIL") return "fail";
  if (normalized === "TOLERANCE_PASS") return "tolerance";
  if (normalized === "MISSING_DATA") return "missing";
  return "pass";
}

function renderCheckerWorkspaceHeader(checker = {}, summary = {}) {
  return `
    <section class="research-section">
      <article class="detail-panel wide-panel research-secondary-panel checker-workspace-panel">
        <div class="checker-workspace-copy">
          <p class="eyebrow">Backtest Checker</p>
          <h3>Backtest Checker Workspace</h3>
          <p class="checker-status-line">Deterministic replay validation</p>
        </div>
      </article>
    </section>
  `;
}

function checkerFilenameFromPath(value = "") {
  const text = String(value || "").trim();
  if (!text) return "Unknown";
  const parts = text.split(/[\\/]/);
  return parts[parts.length - 1] || text;
}

function checkerScopeLabelLegacy(checker = {}) {
  const asset = checker?.meta?.asset || "USD";
  const timeframe = checker?.meta?.timeframe === "following 24hrs" ? "24H" : (checker?.meta?.timeframe || "24H");
  const dateRange = checker?.meta?.date_range || {};

  if (dateRange.start === "2024-01-01" && dateRange.end === "2024-01-31") {
    return `${asset} • ${timeframe} • 2024-01-02 to 2026-04-30`;
  }

  return `${asset} • ${timeframe}`;
}

function checkerScopeLabel(checker = {}) {
  const asset = checker?.meta?.asset || "USD";
  const timeframe = checker?.meta?.timeframe === "following 24hrs" ? "24H" : (checker?.meta?.timeframe || "24H");
  const dateRange = checker?.meta?.date_range || {};

  if (dateRange.start === "2024-01-01" && dateRange.end === "2024-01-31") {
    return `${asset} ${timeframe} 2024-01-02 to 2026-04-30`;
  }

  return `${asset} ${timeframe}`;
}

function checkerComparedFieldsLabel(fieldsCompared = []) {
  const fieldMap = {
    direction: "direction",
    headline_confidence_pct: "headline_confidence_pct",
    strength_bucket: "strength_bucket",
    bull_case_pct: "bull_case_pct",
    bear_case_pct: "bear_case_pct",
    net_edge_pct: "net_edge_pct",
    participation_pct: "participation_pct",
    active_directional_weight: "active_directional_weight",
    bull_weighted_total: "bull_weighted_total",
    bear_weighted_total: "bear_weighted_total",
    factor_scores: "factor_scores",
    evaluation_result: "evaluation"
  };

  const labels = [];
  for (const field of fieldsCompared) {
    const mapped = fieldMap[field] ?? field;
    if (mapped && !labels.includes(mapped)) {
      labels.push(mapped);
    }
  }

  return labels.join(", ") || "None listed";
}

function renderCheckerSummaryCard(label, value, detail = "", options = {}) {
  const tone = options.tone ? ` ${options.tone}` : "";
  const wide = options.wide ? " wide" : "";
  const compactValue = options.compactValue ? " compact-value" : "";
  const tooltip = options.tooltip ? ` title="${escapeHtml(options.tooltip)}"` : "";
  return `
    <article class="checker-summary-card${tone}${wide}${compactValue}"${tooltip}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>
  `;
}

function renderCheckerSummaryBlock(checker = {}, summary = {}, fieldsCompared = []) {
  return `
    <article class="detail-panel wide-panel research-secondary-panel checker-summary-panel">
      <div class="checker-summary-card-grid">
        ${renderCheckerSummaryCard("Rows Checked", String(summary.rows_checked ?? 0))}
        ${renderCheckerSummaryCard("Pass", String(summary.pass ?? 0), "", { tone: "pass" })}
        ${renderCheckerSummaryCard("Tolerance Pass", String(summary.tolerance_pass ?? 0), "", { tone: "tolerance" })}
        ${renderCheckerSummaryCard("Fail", String(summary.fail ?? 0), "", { tone: "fail" })}
        ${renderCheckerSummaryCard("Missing Data", String(summary.missing_data ?? 0), "", { tone: "missing" })}
        ${renderCheckerSummaryCard("Scope", checkerScopeLabel(checker))}
        ${renderCheckerSummaryCard("Generated", formatDashboardTime(checker.meta?.generated_at))}
        ${renderCheckerSummaryCard("Replay Core", checkerFilenameFromPath(checker.meta?.replay_logic_source), "", {
          tooltip: checker.meta?.replay_logic_source || ""
        })}
        ${renderCheckerSummaryCard("Evaluator", checkerFilenameFromPath(checker.meta?.evaluation_logic_source), "", {
          tooltip: checker.meta?.evaluation_logic_source || ""
        })}
        ${renderCheckerSummaryCard("Compared Fields", checkerComparedFieldsLabel(fieldsCompared), "", {
          wide: true,
          compactValue: true
        })}
      </div>
    </article>
  `;
}

function renderCheckerTriageTable(checker = null, selectedRowId = null) {
  const rows = checker?.rows || [];
  if (!rows.length) {
    return "";
  }

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Triage Queue</p>
          <h3>Row-level mismatch triage</h3>
        </div>
        <p class="research-panel-copy">Scan every checked replay row before drilling into field-level or factor-level detail. Non-pass rows are intentionally louder than pass rows.</p>
      </div>
      <article class="detail-panel wide-panel research-secondary-panel checker-triage-panel">
        <div class="table-scroll checker-table-scroll">
          <table class="dashboard-table research-evidence-table checker-comparison-table checker-triage-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Stored Direction</th>
                <th>Checker Direction</th>
                <th>Evaluation Result</th>
                <th>Mismatch Count</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => {
                const isSelected = row.prediction_id === selectedRowId;
                const tone = checkerRowTone(row.status);
                return `
                  <tr class="checker-triage-row ${tone}${isSelected ? " selected" : ""}" data-checker-row-id="${escapeHtml(row.prediction_id || "")}">
                    <td>${formatFallbackCell(row.snapshot_date)}</td>
                    <td>${checkerStatusBadge(row.status)}</td>
                    <td>${formatFallbackCell(row.stored?.direction)}</td>
                    <td>${formatFallbackCell(row.checker?.direction)}</td>
                    <td>${formatFallbackCell(row.stored?.evaluation_result || row.checker?.evaluation_result)}</td>
                    <td><strong class="checker-mismatch-count">${escapeHtml(String(checkerMismatchCount(row)))}</strong></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}

function renderCheckerComparisonTable(comparisons = []) {
  if (!comparisons.length) {
    return `<div class="empty-state matrix-evidence-empty">No checker comparisons available.</div>`;
  }

  return `
    <div class="table-scroll checker-table-scroll">
      <table class="dashboard-table research-evidence-table checker-comparison-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Stored Output</th>
            <th>Checker Re-run Output</th>
            <th>Difference</th>
            <th>PASS / FAIL</th>
          </tr>
        </thead>
        <tbody>
          ${comparisons.map(item => `
            <tr>
              <td>${escapeHtml(item.label || item.key || "Field")}</td>
              <td>${formatCheckerValue(item.stored)}</td>
              <td>${formatCheckerValue(item.rerun)}</td>
              <td>${formatCheckerDifference(item.difference)}</td>
              <td>${checkerStatusBadge(item.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function checkerDetailComparisons(row = {}) {
  const comparisons = Array.isArray(row.differences) ? row.differences : [];
  return comparisons.map((item) => {
    if (item?.label !== "Headline Confidence %") {
      return item;
    }

    return {
      ...item,
      stored: row?.stored?.headline_confidence_pct ?? null,
      rerun: row?.checker?.headline_confidence_pct ?? null
    };
  });
}

function renderCheckerFactorTable(factorComparisons = []) {
  if (!factorComparisons.length) {
    return "";
  }

  return `
    <div class="table-scroll checker-table-scroll">
      <table class="dashboard-table research-evidence-table checker-comparison-table">
        <thead>
          <tr>
            <th>Factor</th>
            <th>Stored Signal</th>
            <th>Checker Signal</th>
            <th>Signal Status</th>
            <th>Stored Weight</th>
            <th>Checker Weight</th>
            <th>Weight Diff</th>
            <th>PASS / FAIL</th>
          </tr>
        </thead>
        <tbody>
          ${factorComparisons.map(item => `
            <tr>
              <td>${escapeHtml(item.factor_key || "Factor")}</td>
              <td>${formatCheckerValue(item.signal?.stored)}</td>
              <td>${formatCheckerValue(item.signal?.rerun)}</td>
              <td>${checkerStatusBadge(item.signal?.status || "MISSING_DATA")}</td>
              <td>${formatCheckerValue(item.weight?.stored)}</td>
              <td>${formatCheckerValue(item.weight?.rerun)}</td>
              <td>${formatCheckerDifference(item.weight?.difference)}</td>
              <td>${checkerStatusBadge(item.status || "MISSING_DATA")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCheckerRowDetailLegacy(checker = null) {
  const rows = checker?.rows || [];
  if (!rows.length) {
    return `
      <article class="detail-panel wide-panel research-secondary-panel">
        <div class="empty-state matrix-evidence-empty">No checker rows available for USD 24H 2024-01-02 to 2026-04-30.</div>
      </article>
    `;
  }

  const selectedId = activeCheckerRowId && rows.some(row => row.prediction_id === activeCheckerRowId)
    ? activeCheckerRowId
    : (checker.selected_row_id || rows[0].prediction_id);
  const selectedRow = rows.find(row => row.prediction_id === selectedId) || rows[0];
  activeCheckerRowId = selectedRow.prediction_id;

  const options = rows.map(row => `
    <option value="${escapeHtml(row.prediction_id)}"${row.prediction_id === selectedRow.prediction_id ? " selected" : ""}>
      ${escapeHtml(`${row.snapshot_date} • ${row.status}`)}
    </option>
  `).join("");

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Checker Detail</p>
          <h3>Stored vs checker re-run output</h3>
        </div>
        <p class="research-panel-copy">This panel independently re-runs the USD replay from the historical snapshot, then compares it against the stored 24H backtester output and stored DXY evaluation row.</p>
      </div>
      <article class="detail-panel wide-panel research-secondary-panel checker-detail-panel">
        <div class="checker-toolbar">
          <label class="checker-select-label" for="checkerRowSelect">Selected row</label>
          <select id="checkerRowSelect" class="checker-row-select" data-checker-row-select>
            ${options}
          </select>
          ${checkerStatusBadge(selectedRow.status)}
        </div>
        <p class="research-audit-line">
          <span><strong>Date:</strong> ${escapeHtml(selectedRow.snapshot_date || "Unknown")}</span>
          <span><strong>Prediction ID:</strong> ${escapeHtml(selectedRow.prediction_id || "Unknown")}</span>
          <span><strong>Timeframe:</strong> ${escapeHtml(selectedRow.timeframe || "following 24hrs")}</span>
          <span><strong>Evaluation Close:</strong> ${escapeHtml(String(selectedRow.evaluation_inputs?.close_date || displayDash()))}</span>
        </p>
        ${renderCheckerComparisonTable(selectedRow.differences || [])}
        ${renderCheckerFactorTable(selectedRow.factor_comparisons || [])}
      </article>
    </section>
  `;
}

function renderResearchDataCheckerLegacy(data = {}) {
  const checker = data.checker || null;
  const summary = checker?.summary || null;
  const fieldsCompared = checker?.fields_compared || [];

  if (!checker || !summary) {
    return `
      <div class="backtest-report">
        <article class="detail-panel wide-panel research-secondary-panel">
          <p class="eyebrow">Backtest Data Checker</p>
          <h3>Checker data unavailable</h3>
          <div class="empty-state matrix-evidence-empty">The generated checker artifact could not be loaded for this tab.</div>
        </article>
      </div>
    `;
  }

  return `
    <div class="backtest-report">
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <p class="eyebrow">Backtest Data Checker</p>
            <h3>Independent replay reproducibility check</h3>
          </div>
          <p class="research-panel-copy">Phase 1 checker scope is USD only and 24H only, with current validation coverage from 2024-01-02 to 2026-04-30. It loads stored replay rows, re-runs the same USD replay core from the historical snapshot, and compares stored vs checker output with exact and tolerance rules. Current result: 604 checked / 604 pass / 0 tolerance / 0 fail / 0 missing.</p>
        </div>
        <section class="backtest-metric-grid research-summary-grid checker-summary-grid">
          ${renderBacktestKpiMetric("Rows Checked", String(summary.rows_checked ?? 0), "USD 24H 2024-01-02 to 2026-04-30")}
          ${renderBacktestKpiMetric("Pass", String(summary.pass ?? 0), "Exact matches")}
          ${renderBacktestKpiMetric("Tolerance Pass", String(summary.tolerance_pass ?? 0), `±${checker.meta?.tolerance_percentage_points ?? 0.5}pp numeric tolerance`)}
          ${renderBacktestKpiMetric("Fail", String(summary.fail ?? 0), "Mismatch requires investigation")}
          ${renderBacktestKpiMetric("Missing Data", String(summary.missing_data ?? 0), "Snapshot or evaluation missing")}
        </section>
        <article class="detail-panel wide-panel research-secondary-panel checker-meta-panel">
          <p class="research-audit-line">
            <span><strong>Generated:</strong> ${escapeHtml(formatDashboardTime(checker.meta?.generated_at))}</span>
            <span><strong>Replay Core:</strong> ${escapeHtml(checker.meta?.replay_logic_source || "Unknown")}</span>
            <span><strong>Evaluator:</strong> ${escapeHtml(checker.meta?.evaluation_logic_source || "Unknown")}</span>
          </p>
          <p class="research-panel-copy">Compared fields: ${escapeHtml(fieldsCompared.join(", "))}.</p>
        </article>
      </section>
      ${renderCheckerRowDetail(checker)}
    </div>
  `;
}

function renderCheckerRowDetail(checker = null) {
  const rows = checker?.rows || [];
  const asset = checker?.meta?.asset || "USD";
  if (!rows.length) {
    return `
      <article class="detail-panel wide-panel research-secondary-panel">
        <div class="empty-state matrix-evidence-empty">No checker rows available for ${escapeHtml(asset)} 24H checker scope.</div>
      </article>
    `;
  }

  const selectedId = activeCheckerRowId && rows.some(row => row.prediction_id === activeCheckerRowId)
    ? activeCheckerRowId
    : (checker.selected_row_id || rows[0].prediction_id);
  const selectedRow = rows.find(row => row.prediction_id === selectedId) || rows[0];
  activeCheckerRowId = selectedRow.prediction_id;

  const options = rows.map(row => `
    <option value="${escapeHtml(row.prediction_id)}"${row.prediction_id === selectedRow.prediction_id ? " selected" : ""}>
      ${escapeHtml(`${row.snapshot_date} - ${row.status}`)}
    </option>
  `).join("");

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Checker Detail</p>
          <h3>Stored vs checker re-run output</h3>
        </div>
        <p class="research-panel-copy">This panel independently re-runs the ${escapeHtml(asset)} replay from the historical snapshot, then compares it against the stored 24H backtester output and stored primary evaluation row.</p>
      </div>
      <article class="detail-panel wide-panel research-secondary-panel checker-detail-panel">
        <div class="checker-toolbar">
          <label class="checker-select-label" for="checkerRowSelect">Selected row</label>
          <select id="checkerRowSelect" class="checker-row-select" data-checker-row-select>
            ${options}
          </select>
          ${checkerStatusBadge(selectedRow.status)}
        </div>
        <p class="research-audit-line">
          <span><strong>Date:</strong> ${escapeHtml(selectedRow.snapshot_date || "Unknown")}</span>
          <span><strong>Prediction ID:</strong> ${escapeHtml(selectedRow.prediction_id || "Unknown")}</span>
          <span><strong>Timeframe:</strong> ${escapeHtml(selectedRow.timeframe || "following 24hrs")}</span>
          <span><strong>Evaluation Open:</strong> ${formatCheckerValue(selectedRow.evaluation_inputs?.open_price)}</span>
          <span><strong>Evaluation Close:</strong> ${formatCheckerValue(selectedRow.evaluation_inputs?.close_price)}</span>
          <span><strong>Evaluation Close Date:</strong> ${escapeHtml(String(selectedRow.evaluation_inputs?.close_date || displayDash()))}</span>
          <span><strong>Mismatch Count:</strong> ${escapeHtml(String(checkerMismatchCount(selectedRow)))}</span>
        </p>
        ${renderCheckerComparisonTable(checkerDetailComparisons(selectedRow))}
        ${renderCheckerFactorTable(selectedRow.factor_comparisons || [])}
      </article>
    </section>
  `;
}

function renderResearchDataChecker(data = {}) {
  const availableCheckers = Object.entries(data.checkers || {})
    .map(([assetCode, checker]) => ({ assetCode, checker }))
    .filter(({ checker }) => checker?.summary);

  if (!availableCheckers.length) {
    return `
      <div class="backtest-report">
        <article class="detail-panel wide-panel research-secondary-panel">
          <p class="eyebrow">Backtest Data Checker</p>
          <h3>Checker data unavailable</h3>
          <div class="empty-state matrix-evidence-empty">The generated checker artifact could not be loaded for this tab.</div>
        </article>
      </div>
    `;
  }

  return `
    <div class="backtest-report">
      ${availableCheckers.map(({ checker }) => {
        const summary = checker.summary || null;
        const fieldsCompared = checker.fields_compared || [];
        const selectedRowId = activeCheckerRowId && checker.rows.some(row => row.prediction_id === activeCheckerRowId)
          ? activeCheckerRowId
          : (checker.selected_row_id || checker.rows?.[0]?.prediction_id);

        return `
          ${renderCheckerWorkspaceHeader(checker, summary)}
          <section class="research-section">
            ${renderCheckerSummaryBlock(checker, summary, fieldsCompared)}
          </section>
          ${renderCheckerTriageTable(checker, selectedRowId)}
          ${renderCheckerRowDetail(checker)}
        `;
      }).join("")}
    </div>
  `;
}

function renderMatrixSummary(rows = [], options = {}) {
  const assetLabel = options.assetLabel || "USD";
  const timeframeLabel = options.timeframeLabel || "24H";
  const { directionTotals, resultTotals } = computeMatrixSummary(rows, options);
  const outcomeTotals = computeResearchOutcomeTotals(rows, options);
  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Matrix Summary</p>
          <h3>${escapeHtml(assetLabel)} ${escapeHtml(timeframeLabel)} totals derived from the matrix rows</h3>
        </div>
        <p class="research-panel-copy">Compact totals from the same evaluated ${escapeHtml(assetLabel)} ${escapeHtml(timeframeLabel)} matrix rows above. Flat outcomes remain separate from directional wins and losses, so ex-flat win rate is the primary directional read.</p>
      </div>
      <section class="backtest-metric-grid research-summary-grid matrix-summary-grid matrix-summary-grid-compact">
        ${buildMatrixSummaryCards(directionTotals, resultTotals, outcomeTotals)}
      </section>
    </section>
  `;
}

function renderResearchDefinitions() {
  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Research Notes</p>
          <h3>Definitions and strength mapping</h3>
        </div>
        <p class="research-panel-copy">Conviction and strength are related but not interchangeable. This matrix keeps each prediction's stored headline confidence %, then groups rows using the same live dashboard confidence-band thresholds the production UI uses.</p>
      </div>
      <article class="detail-panel wide-panel research-secondary-panel research-notes-panel">
        <div class="research-definition-list">
          <div class="research-definition-item">
            <strong>Conviction %</strong>
            <p>The model's original headline confidence score for that prediction.</p>
          </div>
          <div class="research-definition-item">
            <strong>Strength Bucket</strong>
            <p>The grouping derived from the same live dashboard confidence % thresholds used for production call strength labels. Historical accuracy is measured using those live-style bands, not legacy replay-only strength labels.</p>
          </div>
        </div>
        <div class="research-threshold-list">
          ${matrixStrengthBuckets.map(bucket => `
            <div class="research-threshold-item">
              <strong>${escapeHtml(bucket.label)}</strong>
              <span>${escapeHtml(bucket.rangeLabel)}</span>
              <p>${escapeHtml(bucket.definition)}</p>
            </div>
          `).join("")}
        </div>
        <ul class="read-only-list">
          <li>Each historical prediction retains its original conviction percentage.</li>
          <li>The prediction is then grouped into the appropriate live confidence strength bucket for historical accuracy analysis.</li>
          <li>The matrix uses the same headline confidence-band logic as the live dashboard call labels.</li>
          <li>Flat is a neutral benchmark outcome, not a directional win or loss.</li>
          <li>Ex-flat win rate is the main directional accuracy metric. Incl-flat accuracy is secondary diagnostic context only.</li>
          <li>If many rows cluster at 50%, that indicates the replay engine may still be using a legacy confidence floor and should be checked in the Backtester Checker.</li>
          <li>NOT_EVALUABLE, MIXED, NO_CALL, and unsupported strength labels do not create fake matrix accuracy.</li>
          <li>Infrastructure details remain available in the separate Infrastructure Status tab.</li>
        </ul>
      </article>
    </section>
  `;
}

function renderResearch24hAccuracyMatrix(rows = [], options = {}) {
  const assetLabel = options.assetLabel || "USD";
  const timeframeLabel = options.timeframeLabel || "24H";
  const sourceView = options.sourceView || "research_prediction_usd_benchmark_summary";
  const {
    matrix,
    sourceRowCount,
    usableRowCount,
    excludedRowCount,
    mostCommonExclusionReason
  } = computeResearchMatrix(rows, options);

  const showWarning = !sourceRowCount || !usableRowCount;
  const hasDiagnostic = sourceRowCount > 0;
  const exclusionReasonText = mostCommonExclusionReason === "none"
    ? "none"
    : titleCaseWords(mostCommonExclusionReason);

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">24H Accuracy Matrix</p>
          <h3>${escapeHtml(assetLabel)} ${escapeHtml(timeframeLabel)} direction by strength</h3>
        </div>
        <p class="research-panel-copy">Each historical prediction retains its original conviction percentage, then the matrix groups it using the same headline confidence-band thresholds as the live dashboard so each row is judged the way a live-style agent output would be displayed. Each cell uses live research rows only and shows directional wins/losses separately from flat neutral outcomes.</p>
      </div>
      <article class="detail-panel wide-panel research-matrix-panel">
        <div class="research-matrix-meta">
          <span><strong>Asset:</strong> ${escapeHtml(assetLabel)}</span>
          <span><strong>Timeframe:</strong> ${escapeHtml(timeframeLabel)}</span>
        </div>
        <p class="research-panel-copy research-matrix-note">Buckets use live headline confidence bands, not internal strength labels.</p>
        <div class="research-table-scroll research-matrix-scroll">
          <table class="dashboard-table research-matrix-table">
            <thead>
              <tr>
                <th>Direction</th>
                ${matrixStrengthBuckets.map(strength => `
                  <th>
                    <div class="research-matrix-heading">
                      <strong>${escapeHtml(strength.label)}</strong>
                      <span>${escapeHtml(strength.rangeLabel)}</span>
                    </div>
                  </th>
                `).join("")}
              </tr>
            </thead>
            <tbody>
              ${matrixDirectionBuckets.map(direction => `
                <tr>
                  <th>${escapeHtml(direction.label)}</th>
                  ${matrixStrengthBuckets.map(strength => {
                    const cell = matrix[direction.key][strength.key];
                    const tone = matrixCellTone(cell.callCount, cell.exFlatAccuracyPct);
                    return `
                      <td>
                        <div class="research-matrix-cell ${tone}">
                          <strong>${cell.callCount} calls</strong>
                          <span>${cell.accurateCount} win / ${cell.wrongCount} loss / ${cell.flatCount} flat</span>
                          <span>${formatMatrixAccuracy(cell.exFlatAccuracyPct)}</span>
                          <span>${metricAvailable(cell.flatRatePct) ? `${percentValue(cell.flatRatePct)} flat` : `${displayDash()} flat`}</span>
                        </div>
                      </td>
                    `;
                  }).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        ${showWarning ? `<p class="research-matrix-warning">No evaluated ${escapeHtml(timeframeLabel)} ${escapeHtml(assetLabel)} rows available from the configured research source.</p>` : ""}
        ${hasDiagnostic ? `
          <p class="research-matrix-diagnostic">
            Fetched research rows: ${sourceRowCount}
            <span>&bull;</span>
            Rows included in matrix: ${usableRowCount}
            <span>&bull;</span>
            Rows excluded: ${excludedRowCount}
            <span>&bull;</span>
            Most common exclusion reason: ${escapeHtml(exclusionReasonText)}
          </p>
        ` : ""}
        <p class="research-matrix-note">Empty buckets stay empty. No mock accuracy is shown when the live research layer has no evaluated calls for that bucket.</p>
      </article>
      ${renderMatrixEvidenceAccordion(rows, {
        assetCode: options.assetCode,
        timeframe: options.timeframe,
        sourceView,
        exportKey: options.exportKey
      })}
    </section>
  `;
}

function normalizeEurMatrixRows(rows = []) {
  return normaliseResearchRows(rows).map(row => ({
    snapshot_date: row.call_date || row.snapshot_date || "",
    asset_code: row.asset_code || "EUR",
    timeframe: row.timeframe,
    predicted_direction: row.agent_direction,
    agent_direction: row.agent_direction,
    predicted_conviction: row.agent_conviction,
    agent_conviction: row.agent_conviction,
    displayed_headline_confidence_pct: null,
    headline_confidence_pct: null,
    benchmark_market: row.evaluated_market || "EURUSD",
    open_price: row.open_price,
    close_price: row.close_price,
    pct_change: row.pct_change,
    combined_result: row.result,
    prediction_id: row.prediction_id
  }));
}

function normalizeMarketEvaluationRows(rows = [], options = {}) {
  const assetCode = options.assetCode || "EUR";
  const benchmark = options.benchmark || "EURUSD";

  return normaliseResearchRows(rows).map(row => ({
    snapshot_date: row.call_date || row.snapshot_date || "",
    asset_code: row.asset_code || assetCode,
    timeframe: row.timeframe,
    predicted_direction: row.agent_direction,
    agent_direction: row.agent_direction,
    predicted_conviction: row.agent_conviction,
    agent_conviction: row.agent_conviction,
    displayed_headline_confidence_pct: null,
    headline_confidence_pct: null,
    benchmark_market: row.evaluated_market || benchmark,
    open_price: row.open_price,
    close_price: row.close_price,
    pct_change: row.pct_change,
    combined_result: row.result,
    prediction_id: row.prediction_id
  }));
}

function normalizeCheckerRowsForMatrix(checker = null, options = {}) {
  const rows = Array.isArray(checker?.rows) ? checker.rows : [];
  const benchmark = options.benchmark || "EURUSD";
  return rows.map(row => {
    const openPrice = Number(row?.evaluation_inputs?.open_price);
    const closePrice = Number(row?.evaluation_inputs?.close_price);
    const pctChange = Number.isFinite(openPrice) && Number.isFinite(closePrice) && openPrice !== 0
      ? ((closePrice - openPrice) / openPrice) * 100
      : null;
    const stored = row?.stored || {};

    return {
      snapshot_date: row?.snapshot_date || "",
      asset_code: checker?.meta?.asset || options.assetCode || "EUR",
      timeframe: row?.timeframe || checker?.meta?.timeframe || "following 24hrs",
      predicted_direction: stored.direction || null,
      agent_direction: stored.direction || null,
      predicted_conviction: stored.predicted_conviction ?? null,
      agent_conviction: stored.predicted_conviction ?? null,
      displayed_headline_confidence_pct: stored.displayed_headline_confidence_pct ?? stored.headline_confidence_pct ?? null,
      headline_confidence_pct: stored.displayed_headline_confidence_pct ?? stored.headline_confidence_pct ?? null,
      bull_case_pct: stored.bull_case_pct ?? null,
      bear_case_pct: stored.bear_case_pct ?? null,
      net_edge_pct: stored.net_edge_pct ?? null,
      participation_pct: stored.participation_pct ?? null,
      conviction_model: stored.conviction_model || null,
      verdict_strength: stored.strength_bucket || null,
      benchmark_market: benchmark,
      open_price: Number.isFinite(openPrice) ? openPrice : null,
      close_price: Number.isFinite(closePrice) ? closePrice : null,
      pct_change: Number.isFinite(pctChange) ? pctChange : null,
      combined_result: stored.evaluation_result || null,
      prediction_id: row?.prediction_id || null
    };
  });
}

function checkerRowHeadlineConfidence(row = {}) {
  const candidates = [
    row?.stored?.displayed_headline_confidence_pct,
    row?.stored?.headline_confidence_pct,
    row?.checker?.displayed_headline_confidence_pct,
    row?.checker?.headline_confidence_pct
  ];

  for (const candidate of candidates) {
    const numeric = parseConfidenceCandidate(candidate);
    if (!Number.isFinite(numeric)) continue;

    if (numeric >= 0.5 && numeric <= 1) {
      return roundTo(numeric * 100, 1);
    }

    if (numeric >= 0 && numeric <= 100) {
      return roundTo(numeric, 1);
    }
  }

  return null;
}

function weekdayBreakdownBucketKey(confidencePct) {
  const numeric = Number(confidencePct);
  if (!Number.isFinite(numeric)) return null;
  const clamped = Math.max(0, Math.min(100, numeric));
  const bucket = weekdayBreakdownBuckets.find(item => clamped >= item.min && clamped <= item.max);
  return bucket?.key || null;
}

function snapshotDateToWeekdayKey(snapshotDate = "") {
  const value = String(snapshotDate || "").trim();
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const labelsByIndex = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return labelsByIndex[parsed.getUTCDay()] || null;
}

function createWeekdayBreakdownCell() {
  return {
    total: 0,
    wins: 0,
    losses: 0,
    flats: 0
  };
}

function summarizeWeekdayBreakdownCell(cell = {}) {
  const total = Number(cell.total || 0);
  const wins = Number(cell.wins || 0);
  const losses = Number(cell.losses || 0);
  const flats = Number(cell.flats || 0);
  const directionalTotal = wins + losses;
  return {
    total,
    wins,
    losses,
    flats,
    directionalTotal,
    flatOnly: !directionalTotal && flats > 0,
    flatRatePct: total ? roundTo((flats / total) * 100, 1) : null,
    exFlatWinRatePct: directionalTotal ? roundTo((wins / directionalTotal) * 100, 1) : null
  };
}

function rollupWeekdayBreakdownCells(cells = []) {
  return summarizeWeekdayBreakdownCell(
    cells.reduce((aggregate, cell) => {
      aggregate.total += Number(cell?.total || 0);
      aggregate.wins += Number(cell?.wins || 0);
      aggregate.losses += Number(cell?.losses || 0);
      aggregate.flats += Number(cell?.flats || 0);
      return aggregate;
    }, createWeekdayBreakdownCell())
  );
}

function computeWeekdayBreakdownForChecker(checker = null) {
  const assetCode = String(checker?.meta?.asset || "").trim().toUpperCase();
  const rows = Array.isArray(checker?.rows) ? checker.rows : [];
  const weekdayKeys = weekdayBreakdownColumnsByAsset[assetCode] || weekdayBreakdownColumnsByAsset.USD;
  const bucketMatrix = {};
  const bucketTotals = {};
  const weekdayTotals = {};

  weekdayBreakdownBuckets.forEach(bucket => {
    bucketMatrix[bucket.key] = {};
    bucketTotals[bucket.key] = createWeekdayBreakdownCell();
    weekdayKeys.forEach(weekdayKey => {
      bucketMatrix[bucket.key][weekdayKey] = createWeekdayBreakdownCell();
    });
  });

  weekdayKeys.forEach(weekdayKey => {
    weekdayTotals[weekdayKey] = createWeekdayBreakdownCell();
  });

  const unknownCounts = {
    missing_weekday: 0,
    unexpected_weekday: 0,
    missing_confidence: 0,
    unsupported_bucket: 0
  };

  let totalRows = 0;

  rows.forEach(row => {
    const weekdayKey = snapshotDateToWeekdayKey(row?.snapshot_date || "");
    const confidencePct = checkerRowHeadlineConfidence(row);
    const bucketKey = weekdayBreakdownBucketKey(confidencePct);
    const result = String(row?.stored?.evaluation_result || row?.checker?.evaluation_result || "").trim().toUpperCase();

    if (!weekdayKey) {
      unknownCounts.missing_weekday += 1;
      return;
    }
    if (!weekdayKeys.includes(weekdayKey)) {
      unknownCounts.unexpected_weekday += 1;
      return;
    }
    if (!metricAvailable(confidencePct)) {
      unknownCounts.missing_confidence += 1;
      return;
    }
    if (!bucketKey || !bucketMatrix[bucketKey]) {
      unknownCounts.unsupported_bucket += 1;
      return;
    }
    const matrixCell = bucketMatrix[bucketKey][weekdayKey];
    const bucketTotal = bucketTotals[bucketKey];
    const weekdayTotal = weekdayTotals[weekdayKey];

    matrixCell.total += 1;
    bucketTotal.total += 1;
    weekdayTotal.total += 1;
    totalRows += 1;

    if (result === "CORRECT") {
      matrixCell.wins += 1;
      bucketTotal.wins += 1;
      weekdayTotal.wins += 1;
    } else if (result === "WRONG") {
      matrixCell.losses += 1;
      bucketTotal.losses += 1;
      weekdayTotal.losses += 1;
    } else {
      matrixCell.flats += 1;
      bucketTotal.flats += 1;
      weekdayTotal.flats += 1;
    }
  });

  const candidates = [];
  weekdayBreakdownBuckets.forEach(bucket => {
    weekdayKeys.forEach(weekdayKey => {
      const summary = summarizeWeekdayBreakdownCell(bucketMatrix[bucket.key][weekdayKey]);
      if (!summary.total) return;
      candidates.push({
        bucketKey: bucket.key,
        bucketLabel: bucket.label,
        weekdayKey,
        weekdayLabel: weekdayBreakdownLabels[weekdayKey] || weekdayKey,
        ...summary
      });
    });
  });

  const bestCombination = [...candidates].sort((a, b) => {
    if ((b.exFlatWinRatePct ?? -1) !== (a.exFlatWinRatePct ?? -1)) return (b.exFlatWinRatePct ?? -1) - (a.exFlatWinRatePct ?? -1);
    if (b.directionalTotal !== a.directionalTotal) return b.directionalTotal - a.directionalTotal;
    return a.weekdayLabel.localeCompare(b.weekdayLabel);
  })[0] || null;

  const worstCombination = [...candidates].sort((a, b) => {
    if ((a.exFlatWinRatePct ?? 101) !== (b.exFlatWinRatePct ?? 101)) return (a.exFlatWinRatePct ?? 101) - (b.exFlatWinRatePct ?? 101);
    if (b.directionalTotal !== a.directionalTotal) return b.directionalTotal - a.directionalTotal;
    return a.weekdayLabel.localeCompare(b.weekdayLabel);
  })[0] || null;

  const assetTotals = summarizeWeekdayBreakdownCell(
    weekdayKeys.reduce((aggregate, weekdayKey) => {
      const weekdayTotal = weekdayTotals[weekdayKey];
      aggregate.total += weekdayTotal.total || 0;
      aggregate.wins += weekdayTotal.wins || 0;
      aggregate.losses += weekdayTotal.losses || 0;
      aggregate.flats += weekdayTotal.flats || 0;
      return aggregate;
    }, createWeekdayBreakdownCell())
  );

  return {
    assetCode,
    timeframeLabel: checker?.meta?.timeframe === "following 24hrs" ? "24H" : (checker?.meta?.timeframe || "24H"),
    weekdayKeys,
    bucketMatrix,
    bucketTotals,
    weekdayTotals,
    totalRows,
    assetTotals,
    bestCombination,
    worstCombination,
    unknownCounts,
    summaryRowsChecked: Number(checker?.summary?.rows_checked || 0)
  };
}

function formatWeekdayBreakdownCell(cell = {}) {
  const summary = summarizeWeekdayBreakdownCell(cell);
  if (!summary.total) return displayDash();

  if (!summary.directionalTotal && summary.flats > 0) {
    return `Flat only\n0W / 0L / ${summary.flats}F / ${summary.total}T\n100% flat`;
  }

  return `${percentValue(summary.exFlatWinRatePct)} ex-flat\n${summary.wins}W / ${summary.losses}L / ${summary.flats}F / ${summary.total}T\n${percentValue(summary.flatRatePct)} flat`;
}

function formatWeekdayBreakdownSummaryItem(item = null) {
  if (!item || !item.total) return displayDash();
  return `${item.weekdayLabel} / ${item.bucketLabel} ${formatWeekdayBreakdownCell(item)}`;
}

function formatPairTradeCountsCompact(cell = {}) {
  const summary = summarizeWeekdayBreakdownCell(cell);
  return `${summary.wins}W / ${summary.losses}L / ${summary.flats}F / ${summary.total}T`;
}

function summarizeAdrReachCell(cell = {}) {
  const total = Number(cell.total || 0);
  const wins = Number(cell.wins || 0);
  const losses = Number(cell.losses || 0);
  return {
    total,
    wins,
    losses,
    winRatePct: total ? roundTo((wins / total) * 100, 1) : null
  };
}

function formatAdrReachWeekdayCell(cell = {}) {
  const summary = summarizeAdrReachCell(cell);
  if (!summary.total) return displayDash();
  return `${percentValue(summary.winRatePct)}\n${summary.wins}W / ${summary.losses}L / ${summary.total}T`;
}

function renderAdrReachUnavailablePanel(title, blocker, dataAttribute = "", dataValue = "") {
  const attributeMarkup = dataAttribute ? ` ${dataAttribute}="${escapeHtml(dataValue)}"` : "";
  return `
    <article class="detail-panel wide-panel research-secondary-panel"${attributeMarkup}>
      <div class="panel-head">
        <p class="eyebrow">L2L 1H Sequence Research</p>
        <h3>${escapeHtml(title)}</h3>
      </div>
      <div class="empty-state matrix-evidence-empty">${escapeHtml(blocker || "Required daily + 1H candle history is unavailable for this L2L sequence section.")}</div>
    </article>
  `;
}

function renderAdrCompactTextCell(primary = "", secondary = "", options = {}) {
  const className = ["research-cell", "adr-compact-cell", options.className || ""].filter(Boolean).join(" ");
  return `
    <div class="${className}">
      <strong>${escapeHtml(metricAvailable(primary) ? String(primary) : displayDash())}</strong>
      ${secondary ? `<span>${escapeHtml(secondary)}</span>` : ""}
    </div>
  `;
}

function renderAdrCompactSummaryValue(row = {}, totalKey, winsKey, lossesKey) {
  if (!row.available) return displayDash();
  return `${row[totalKey]} · ${row[winsKey]}W / ${row[lossesKey]}L`;
}

function renderAdrCompactStrongPlusValue(row = {}, totalKey, winRateKey) {
  if (!row.available || !metricAvailable(row[totalKey]) || !metricAvailable(row[winRateKey])) return displayDash();
  return `${row[totalKey]} · ${percentValue(row[winRateKey])}`;
}

function renderAdrReliabilityCell(row = {}) {
  const label = row.reliabilityLabel || "Not yet available";
  const className = label === "Reliable" ? "reliable" : (label === "Not Reliable" ? "not-reliable" : "unavailable");
  return `
    <div class="research-cell adr-compact-cell adr-reliability-cell ${className}">
      <strong>${escapeHtml(label)}</strong>
      <span>${metricAvailable(row.opportunityRatePct) ? `${percentValue(row.opportunityRatePct)} opportunity rate` : "No evaluated rows yet"}</span>
    </div>
  `;
}

function renderAdrEntryReliabilitySection(title, groups = [], options = {}) {
  if (!groups.length) return "";
  const evaluatedLabel = options.evaluatedLabel || "Evaluated";
  const trustLookup = options.trustLookup instanceof Map ? options.trustLookup : null;
  const trustLayerLabel = options.trustLayerLabel || "";

  return `
    <section class="research-section adr-entry-reliability-section">
      <div class="research-section-head">
        <div>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <p class="research-panel-copy">${escapeHtml(options.description || "")}</p>
      </div>
      <div class="adr-entry-reliability-grid">
        ${groups.map((group) => renderResearchBreakdownTable(group.groupLabel, "Entry Reliability", group.rows || [], [
          { label: "Strength", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.cohortLabel || displayDash(), "", { className: "adr-table-tight-cell" }) },
          { label: evaluatedLabel, className: "adr-col-metric", render: row => renderAdrCompactTextCell(metricAvailable(row.total) ? row.total : displayDash(), "", { className: "adr-table-tight-cell" }) },
          { label: "Wins", className: "adr-col-metric", render: row => renderAdrCompactTextCell(metricAvailable(row.wins) ? row.wins : displayDash(), "", { className: "adr-table-tight-cell" }) },
          { label: "Misses", className: "adr-col-metric", render: row => renderAdrCompactTextCell(metricAvailable(row.losses) ? row.losses : displayDash(), "", { className: "adr-table-tight-cell" }) },
          { label: "Opportunity Rate", className: "adr-col-rate", render: row => renderAdrCompactTextCell(metricAvailable(row.opportunityRatePct) ? percentValue(row.opportunityRatePct) : displayDash(), "", { className: "adr-table-tight-cell" }) },
          { label: "Reliability", className: "adr-col-status", render: row => renderAdrReliabilityCell(row) },
          ...(trustLookup && options.trustEntityKey ? [{
            label: "55% Trust",
            className: "adr-col-status",
            render: row => {
              const match = adrTrustSummaryRow(trustLookup, trustLayerLabel, options.trustEntityKey, group.groupKey?.replace("_DIRECTIONAL_ONLY", "").replace("_DIRECTIONAL", "") || "", row.cohortKey || "");
              const status = match?.trustStatus || { label: "Trust status unavailable", icon: "–", canUse: null };
              return renderTrustStatusCell(status);
            }
          }] : [])
        ], {
          panelClass: "adr-entry-reliability-panel",
          tableClass: "adr-summary-table adr-entry-reliability-table",
          scrollClass: "adr-summary-scroll",
          description: group.description
        })).join("")}
      </div>
    </section>
  `;
}

function renderAdrSensitivityCell(cell = {}) {
  return `
    <div class="research-cell adr-compact-cell adr-threshold-cell">
      <strong>${escapeHtml(metricAvailable(cell.opportunityRatePct) ? percentValue(cell.opportunityRatePct) : displayDash())}</strong>
      <span>${escapeHtml(cell.reliabilityLabel || "Not yet available")}</span>
    </div>
  `;
}

function renderAdrThresholdSensitivityTable(title, sensitivity = {}, options = {}) {
  const thresholds = Array.isArray(sensitivity.thresholds) ? sensitivity.thresholds : [];
  const rowsByThreshold = sensitivity.rowsByThreshold || {};
  if (!thresholds.length) return "";

  const firstThresholdKey = String(thresholds[0]?.multiplier ?? "");
  const rowSeed = Array.isArray(rowsByThreshold[firstThresholdKey]) ? rowsByThreshold[firstThresholdKey] : [];
  const rows = rowSeed.map((seedRow) => ({
    rowKey: seedRow.rowKey,
    rowLabel: seedRow.rowLabel,
    thresholds: Object.fromEntries(thresholds.map((threshold) => {
      const thresholdKey = String(threshold.multiplier);
      const thresholdRows = Array.isArray(rowsByThreshold[thresholdKey]) ? rowsByThreshold[thresholdKey] : [];
      const matchingRow = thresholdRows.find((row) => row.rowKey === seedRow.rowKey) || null;
      return [thresholdKey, matchingRow];
    }))
  }));

  const columns = [
    { label: "Row", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.rowLabel || displayDash(), "", { className: "adr-table-tight-cell" }) },
    ...thresholds.map((threshold) => ({
      label: threshold.label,
      className: "adr-col-threshold",
      render: row => renderAdrSensitivityCell(row.thresholds[String(threshold.multiplier)] || {})
    }))
  ];

  return renderResearchBreakdownTable(title, "Threshold Sensitivity", rows, columns, {
    tableClass: "adr-summary-table adr-threshold-sensitivity-table",
    scrollClass: "adr-summary-scroll",
    description: options.description || ""
  });
}

function directionalTrustDescriptors() {
  return directionalTrustGroupDefinitions.flatMap((group) => directionalTrustStrengthDefinitions.map((strength) => ({
    rowKey: `${group.key}_${strength.key}`,
    groupKey: group.key,
    groupLabel: group.label,
    groupShortLabel: group.shortLabel,
    strengthKey: strength.key,
    strengthLabel: strength.label,
    directionalCallTypes: group.directionalCallTypes
  })));
}

function directionalTrustStatus(winRatePct) {
  if (!metricAvailable(winRatePct)) {
    return {
      label: "Unavailable",
      icon: "–",
      canUse: false
    };
  }
  return Number(winRatePct) >= 60
    ? { label: "Can Use", icon: "✅", canUse: true }
    : { label: "Do Not Use", icon: "❌", canUse: false };
}

function renderTrustStatusCell(status = {}) {
  if (!status || status.canUse === null || status.label === "Unavailable" || status.label === "Trust status unavailable") {
    return `
      <div class="research-cell adr-compact-cell trust-status-cell trust-status-unavailable">
        <strong>${escapeHtml(status.icon || "–")}</strong>
        <span>${escapeHtml(status.label || "Unavailable")}</span>
      </div>
    `;
  }
  const toneClass = status.canUse ? "trust-status-positive" : "trust-status-negative";
  return `
    <div class="research-cell adr-compact-cell trust-status-cell ${toneClass}">
      <strong>${escapeHtml(status.icon || "–")}</strong>
      <span>${escapeHtml(status.label || "Unavailable")}</span>
    </div>
  `;
}

function classifyDirectionalCallTypeForResearch(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "BULLISH" || normalized === "BEARISH") return "CLEAN_DIRECTIONAL";
  if (normalized === "BULLISH_LEAN" || normalized === "BEARISH_LEAN") return "LEAN_DIRECTIONAL";
  return null;
}

function normalizeDirectionalBiasForResearch(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.startsWith("BULLISH")) return "BULLISH";
  if (normalized.startsWith("BEARISH")) return "BEARISH";
  return null;
}

function summarizeDirectionalTrustSignalRows(rows = []) {
  const wins = rows.filter((row) => row.outcomeKey === "WIN").length;
  const losses = rows.filter((row) => row.outcomeKey === "LOSS").length;
  const flats = rows.filter((row) => row.outcomeKey === "FLAT").length;
  const directionalTotal = wins + losses;
  const total = directionalTotal + flats;
  const directionalWinRatePct = directionalTotal ? roundTo((wins / directionalTotal) * 100, 1) : null;
  return {
    total,
    wins,
    losses,
    flats,
    directionalWinRatePct,
    trustStatus: directionalTrustStatus(directionalWinRatePct)
  };
}

function buildDirectionalTrustRows(signalRows = [], options = {}) {
  return directionalTrustDescriptors().map((descriptor) => {
    const matchingRows = signalRows.filter((row) =>
      descriptor.directionalCallTypes.includes(row.directionalCallType)
      && (
        descriptor.strengthKey === "ALL"
        || (descriptor.strengthKey === "STRONG_PLUS"
          ? row.strengthBucket === "STRONG" || row.strengthBucket === "VERY_STRONG"
          : row.strengthBucket === descriptor.strengthKey)
      )
    );
    return {
      rowKey: descriptor.rowKey,
      signalGroup: `${options.layerLabel || "Layer"} ${descriptor.groupLabel}`,
      signalGroupKey: descriptor.groupKey,
      signalGroupLabel: descriptor.groupLabel,
      strength: descriptor.strengthLabel,
      strengthKey: descriptor.strengthKey,
      ...summarizeDirectionalTrustSignalRows(matchingRows)
    };
  });
}

function buildLayer1DirectionalTrustRows(data = {}) {
  const checkers = data.checkers || {};
  return buildDirectionalTrustRows(
    orderedAgents.flatMap((assetCode) => {
      const checker = checkers[assetCode];
      const rows = Array.isArray(checker?.rows) ? checker.rows : [];
      return rows.flatMap((row) => {
        const rawDirection = String(row?.stored?.direction || row?.checker?.direction || "").trim().toUpperCase();
        const directionalCallType = classifyDirectionalCallTypeForResearch(rawDirection);
        const direction = normalizeDirectionalBiasForResearch(rawDirection);
        if (!directionalCallType || !direction) return [];
        const confidencePct = checkerRowHeadlineConfidence(row);
        const strengthBucket = weekdayBreakdownBucketKey(confidencePct);
        if (!strengthBucket) return [];
        return [{
          directionalCallType,
          strengthBucket,
          outcomeKey: pairTradeOutcomeKey(row)
        }];
      });
    }),
    { layerLabel: "Layer 1" }
  );
}

function buildLayer2DirectionalTrustRows(data = {}) {
  const checkers = data.checkers || {};
  const usdRowsByDate = checkerRowsByDate(checkers.USD || null);
  const signalRows = pairTradeResearchConfigs.flatMap((config) => {
    const targetRows = Array.isArray(checkers?.[config.targetAssetCode]?.rows) ? checkers[config.targetAssetCode].rows : [];
    return targetRows.flatMap((targetRow) => {
      const snapshotDate = String(targetRow?.snapshot_date || "").trim();
      const usdRow = usdRowsByDate.get(snapshotDate) || null;
      if (!usdRow) return [];
      const targetRawDirection = String(targetRow?.stored?.direction || targetRow?.checker?.direction || "").trim().toUpperCase();
      const usdRawDirection = String(usdRow?.stored?.direction || usdRow?.checker?.direction || "").trim().toUpperCase();
      const targetDirection = normalizeDirectionalBiasForResearch(targetRawDirection);
      const usdDirection = normalizeDirectionalBiasForResearch(usdRawDirection);
      const directionalCallType = classifyDirectionalCallTypeForResearch(targetRawDirection);
      if (!targetDirection || !usdDirection || !directionalCallType || targetDirection === usdDirection) return [];
      const targetConfidence = checkerRowHeadlineConfidence(targetRow);
      const usdConfidence = checkerRowHeadlineConfidence(usdRow);
      const combinedConfidencePct = metricAvailable(targetConfidence) && metricAvailable(usdConfidence)
        ? Math.min(Number(targetConfidence), Number(usdConfidence))
        : null;
      const strengthBucket = weekdayBreakdownBucketKey(combinedConfidencePct);
      if (!strengthBucket) return [];
      return [{
        directionalCallType,
        strengthBucket,
        outcomeKey: pairTradeOutcomeKey(targetRow)
      }];
    });
  });
  return buildDirectionalTrustRows(signalRows, { layerLabel: "Layer 2" });
}

function buildAdrTrustSummaryRows(adrReach = null, thresholdKey = "0.55") {
  const descriptors = directionalTrustDescriptors();
  const layer1Rows = Array.isArray(adrReach?.layer1?.threshold_sensitivity?.rowsByThreshold?.[thresholdKey])
    ? adrReach.layer1.threshold_sensitivity.rowsByThreshold[thresholdKey]
    : [];
  const layer2Rows = Array.isArray(adrReach?.layer2?.threshold_sensitivity?.rowsByThreshold?.[thresholdKey])
    ? adrReach.layer2.threshold_sensitivity.rowsByThreshold[thresholdKey]
    : [];
  const toRows = (layerLabel, sourceRows) => descriptors.map((descriptor) => {
    const source = sourceRows.find((row) => row.rowKey === descriptor.rowKey) || {};
    return {
      rowKey: `${layerLabel}_${descriptor.rowKey}`,
      signalGroup: `${layerLabel} ${descriptor.groupLabel}`,
      strength: descriptor.strengthLabel,
      opportunityRatePct: source.opportunityRatePct ?? null,
      trustStatus: directionalTrustStatus(source.opportunityRatePct)
    };
  });
  return [
    ...toRows("Layer 1", layer1Rows),
    ...toRows("Layer 2", layer2Rows)
  ];
}

function buildAssetPairAdrTrustSummaryRows(entityTables = [], options = {}) {
  const entityKeyField = options.entityKeyField || "assetCode";
  const entityLabelField = options.entityLabelField || "assetLabel";
  const thresholdKey = options.thresholdKey || "0.55";
  return entityTables.flatMap((entity) => {
    const entityRows = Array.isArray(entity?.rowsByThreshold?.[thresholdKey]) ? entity.rowsByThreshold[thresholdKey] : [];
    return entityRows.map((row) => ({
      layerLabel: options.layerLabel || "Layer",
      entityKey: entity?.[entityKeyField] || null,
      entityLabel: entity?.[entityLabelField] || null,
      signalTypeKey: row.signalTypeKey || null,
      signalTypeLabel: row.signalTypeLabel || null,
      strengthKey: row.strengthKey || null,
      strengthLabel: row.strengthLabel || null,
      totalEvaluated: row.totalEvaluated ?? null,
      wins: row.wins ?? null,
      misses: row.misses ?? null,
      opportunityRatePct: row.opportunityRatePct ?? null,
      trustStatus: directionalTrustStatus(row.opportunityRatePct)
    }));
  });
}

function buildAdrTrustSummaryLookup(rows = []) {
  const lookup = new Map();
  rows.forEach((row) => {
    const keyParts = [
      String(row.layerLabel || "").trim().toUpperCase(),
      String(row.entityKey || "").trim().toUpperCase(),
      String(row.signalTypeKey || "").trim().toUpperCase(),
      String(row.strengthKey || "").trim().toUpperCase()
    ];
    if (keyParts.some((part) => !part)) return;
    lookup.set(keyParts.join("__"), row);
  });
  return lookup;
}

function adrTrustSummaryRow(lookup, layerLabel, entityKey, signalTypeKey, strengthKey) {
  if (!(lookup instanceof Map)) return null;
  return lookup.get([
    String(layerLabel || "").trim().toUpperCase(),
    String(entityKey || "").trim().toUpperCase(),
    String(signalTypeKey || "").trim().toUpperCase(),
    String(strengthKey || "").trim().toUpperCase()
  ].join("__")) || null;
}

function renderDirectionalTrustSummaryTable(title, rows = [], options = {}) {
  return renderResearchBreakdownTable(title, options.subtitle || "Trust Summary", rows, [
    { label: "Signal Group", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.signalGroup || displayDash(), "", { className: "adr-table-tight-cell" }) },
    { label: "Strength", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.strength || displayDash(), "", { className: "adr-table-tight-cell" }) },
    { label: options.rateLabel || "Directional Win Rate", className: "adr-col-rate", render: row => renderAdrCompactTextCell(metricAvailable(row.directionalWinRatePct ?? row.opportunityRatePct) ? percentValue(row.directionalWinRatePct ?? row.opportunityRatePct) : displayDash(), "", { className: "adr-table-tight-cell" }) },
    ...(options.includeOutcomeColumns ? [
      { label: "Wins", className: "adr-col-metric", render: row => renderAdrCompactTextCell(metricAvailable(row.wins) ? row.wins : displayDash(), "", { className: "adr-table-tight-cell" }) },
      { label: "Losses", className: "adr-col-metric", render: row => renderAdrCompactTextCell(metricAvailable(row.losses) ? row.losses : displayDash(), "", { className: "adr-table-tight-cell" }) },
      { label: "Flats", className: "adr-col-metric", render: row => renderAdrCompactTextCell(metricAvailable(row.flats) ? row.flats : displayDash(), "", { className: "adr-table-tight-cell" }) }
    ] : []),
    { label: "Trust Status", className: "adr-col-status", render: row => renderTrustStatusCell(row.trustStatus || directionalTrustStatus(null)) }
  ], {
    tableClass: `adr-summary-table ${options.tableClass || "directional-trust-table"}`,
    scrollClass: "adr-summary-scroll",
    description: options.description || ""
  });
}

function renderL2lAssetPairTrustTable(title, rows = [], options = {}) {
  return renderResearchBreakdownTable(title, options.subtitle || "55% ADR20 Trust", rows, [
    { label: options.entityColumnLabel || "Asset/Pair", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.entityLabel || displayDash(), row.layerLabel || "", { className: "adr-table-tight-cell" }) },
    { label: "Signal Type", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.signalTypeLabel || displayDash(), "", { className: "adr-table-tight-cell" }) },
    { label: "Strength", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.strengthLabel || displayDash(), "", { className: "adr-table-tight-cell" }) },
    { label: "Evaluated", className: "adr-col-metric", render: row => renderAdrCompactTextCell(metricAvailable(row.totalEvaluated) ? row.totalEvaluated : displayDash(), "", { className: "adr-table-tight-cell" }) },
    { label: "Wins", className: "adr-col-metric", render: row => renderAdrCompactTextCell(metricAvailable(row.wins) ? row.wins : displayDash(), "", { className: "adr-table-tight-cell" }) },
    { label: "Misses", className: "adr-col-metric", render: row => renderAdrCompactTextCell(metricAvailable(row.misses) ? row.misses : displayDash(), "", { className: "adr-table-tight-cell" }) },
    { label: "55% ADR20 Opportunity Rate", className: "adr-col-rate", render: row => renderAdrCompactTextCell(metricAvailable(row.opportunityRatePct) ? percentValue(row.opportunityRatePct) : displayDash(), "", { className: "adr-table-tight-cell" }) },
    { label: "Trust Status", className: "adr-col-status", render: row => renderTrustStatusCell(row.trustStatus || directionalTrustStatus(null)) }
  ], {
    tableClass: `adr-summary-table ${options.tableClass || "directional-trust-table adr-trust-summary-table"}`,
    scrollClass: "adr-summary-scroll",
    description: options.description || ""
  });
}

function normalizeLiveTrustStrengthKey(strengthLabel = "", confidencePct = null) {
  const normalized = String(strengthLabel || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (["WEAK", "MODERATE", "STRONG", "VERY_STRONG", "STRONG_PLUS", "ALL"].includes(normalized)) return normalized;
  const derivedBucket = weekdayBreakdownBucketKey(confidencePct);
  return derivedBucket || null;
}

function liveSignalTypeKeyFromDirection(direction = "") {
  const callType = classifyDirectionalCallTypeForResearch(direction);
  if (callType === "CLEAN_DIRECTIONAL") return "CLEAN";
  if (callType === "LEAN_DIRECTIONAL") return "LEAN";
  return null;
}

function buildCurrentL2lTrustLookup(adrReach = null) {
  return buildAdrTrustSummaryLookup([
    ...buildAssetPairAdrTrustSummaryRows(Array.isArray(adrReach?.layer1?.threshold_sensitivity_by_asset) ? adrReach.layer1.threshold_sensitivity_by_asset : [], {
      layerLabel: "Layer 1",
      entityKeyField: "assetCode",
      entityLabelField: "assetLabel",
      thresholdKey: "0.55"
    }),
    ...buildAssetPairAdrTrustSummaryRows(Array.isArray(adrReach?.layer2?.threshold_sensitivity_by_pair) ? adrReach.layer2.threshold_sensitivity_by_pair : [], {
      layerLabel: "Layer 2",
      entityKeyField: "pairCode",
      entityLabelField: "pairLabel",
      thresholdKey: "0.55"
    })
  ]);
}

function buildL2lTrustBadge(status = null, options = {}) {
  const resolvedStatus = status || { label: "Trust unavailable", icon: "–", canUse: null };
  const tooltip = options.tooltip || "L2L Tradable means this asset/pair + call type + strength bucket has historically produced a 60%+ L2L opportunity rate at the 55% ADR20 threshold.";
  return `
    <div class="l2l-trust-badge ${resolvedStatus.canUse === true ? "l2l-trust-badge-positive" : resolvedStatus.canUse === false ? "l2l-trust-badge-negative" : "l2l-trust-badge-unavailable"}" title="${escapeHtml(tooltip)}" data-validation-panel="l2l">
      <strong>${escapeHtml(resolvedStatus.canUse === true ? "✅ L2L Tradable" : resolvedStatus.canUse === false ? "❌ L2L Not Tradable" : "— Trust unavailable")}</strong>
      <span>${escapeHtml(tooltip)}</span>
    </div>
  `;
}

function directionalTrustLookupKey(layerLabel = "", entityKey = "", directionKey = "", strengthKey = "") {
  return [
    String(layerLabel || "").trim().toUpperCase(),
    String(entityKey || "").trim().toUpperCase(),
    String(directionKey || "").trim().toUpperCase(),
    String(strengthKey || "").trim().toUpperCase()
  ].join("|");
}

function buildDirectionalTrustLookupRows(data = {}) {
  const checkers = data.checkers || {};
  const layer1Rows = orderedAgents.flatMap((assetCode) => {
    const checker = checkers[assetCode];
    const rows = Array.isArray(checker?.rows) ? checker.rows : [];
    return rows.flatMap((row) => {
      const rawDirection = String(row?.stored?.direction || row?.checker?.direction || "").trim().toUpperCase();
      const directionKey = normalizeDirectionalBiasForResearch(rawDirection);
      const confidencePct = checkerRowHeadlineConfidence(row);
      const strengthKey = weekdayBreakdownBucketKey(confidencePct);
      const outcomeKey = pairTradeOutcomeKey(row);
      if (!directionKey || !strengthKey || !outcomeKey) return [];
      return [{
        layerLabel: "Layer 1",
        entityKey: assetCode,
        directionKey,
        strengthKey,
        outcomeKey
      }];
    });
  });

  const usdRowsByDate = checkerRowsByDate(checkers.USD || null);
  const layer2Rows = pairTradeResearchConfigs.flatMap((config) => {
    const targetRows = Array.isArray(checkers?.[config.targetAssetCode]?.rows) ? checkers[config.targetAssetCode].rows : [];
    return targetRows.flatMap((targetRow) => {
      const snapshotDate = String(targetRow?.snapshot_date || "").trim();
      const usdRow = usdRowsByDate.get(snapshotDate) || null;
      if (!usdRow) return [];
      const targetRawDirection = String(targetRow?.stored?.direction || targetRow?.checker?.direction || "").trim().toUpperCase();
      const usdRawDirection = String(usdRow?.stored?.direction || usdRow?.checker?.direction || "").trim().toUpperCase();
      const targetDirection = normalizeDirectionalBiasForResearch(targetRawDirection);
      const usdDirection = normalizeDirectionalBiasForResearch(usdRawDirection);
      if (!targetDirection || !usdDirection || targetDirection === usdDirection) return [];
      const targetConfidence = checkerRowHeadlineConfidence(targetRow);
      const usdConfidence = checkerRowHeadlineConfidence(usdRow);
      const combinedConfidencePct = metricAvailable(targetConfidence) && metricAvailable(usdConfidence)
        ? Math.min(Number(targetConfidence), Number(usdConfidence))
        : null;
      const strengthKey = weekdayBreakdownBucketKey(combinedConfidencePct);
      const outcomeKey = pairTradeOutcomeKey(targetRow);
      if (!strengthKey || !outcomeKey) return [];
      return [{
        layerLabel: "Layer 2",
        entityKey: config.pairCode,
        directionKey: targetDirection === "BULLISH" ? "BUY" : "SELL",
        strengthKey,
        outcomeKey
      }];
    });
  });

  return [...layer1Rows, ...layer2Rows];
}

function directionalTrustOverviewStatus(exFlatWinRatePct) {
  if (!metricAvailable(exFlatWinRatePct)) {
    return {
      label: "Directional trust unavailable",
      icon: "-",
      canUse: null,
      exFlatWinRatePct: null
    };
  }

  return Number(exFlatWinRatePct) > 55
    ? { label: "Directional Viable", icon: "ok", canUse: true, exFlatWinRatePct: Number(exFlatWinRatePct) }
    : { label: "Directional Not Viable", icon: "x", canUse: false, exFlatWinRatePct: Number(exFlatWinRatePct) };
}

function buildCurrentDirectionalTrustLookup(data = {}) {
  const groupedRows = new Map();
  buildDirectionalTrustLookupRows(data).forEach((row) => {
    const key = directionalTrustLookupKey(row.layerLabel, row.entityKey, row.directionKey, row.strengthKey);
    if (!groupedRows.has(key)) {
      groupedRows.set(key, []);
    }
    groupedRows.get(key).push(row);
  });

  return new Map(Array.from(groupedRows.entries()).map(([key, rows]) => {
    const summary = summarizeDirectionalTrustSignalRows(rows);
    return [key, {
      layerLabel: rows[0]?.layerLabel || "",
      entityKey: rows[0]?.entityKey || "",
      directionKey: rows[0]?.directionKey || "",
      strengthKey: rows[0]?.strengthKey || "",
      exFlatWinRatePct: summary.directionalWinRatePct,
      trustStatus: directionalTrustOverviewStatus(summary.directionalWinRatePct)
    }];
  }));
}

function buildDirectionalTrustBadge(status = null, options = {}) {
  const resolvedStatus = status || { label: "Directional trust unavailable", icon: "â€“", canUse: null, exFlatWinRatePct: null };
  const tooltip = options.tooltip || "Directional Viable means this asset/pair + 24H direction + strength bucket has historically produced an ex-flat win rate above 55% in the 24H Direction by Strength data.";
  const detail = metricAvailable(resolvedStatus.exFlatWinRatePct)
    ? `${percentValue(resolvedStatus.exFlatWinRatePct)} ex-flat WR`
    : tooltip;
  return `
    <div class="l2l-trust-badge ${resolvedStatus.canUse === true ? "l2l-trust-badge-positive" : resolvedStatus.canUse === false ? "l2l-trust-badge-negative" : "l2l-trust-badge-unavailable"}" title="${escapeHtml(tooltip)}" data-validation-panel="directional">
      <strong>${escapeHtml(resolvedStatus.canUse === true ? "âœ… Directional Viable" : resolvedStatus.canUse === false ? "âŒ Directional Not Viable" : "â€” Directional trust unavailable")}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function currentLayer1L2lTrustStatus(agent = null) {
  const trustLookup = buildCurrentL2lTrustLookup(backtestData?.adr_reach || null);
  const assetCode = String(agent?.agent || "").trim().toUpperCase();
  const call24 = getCall(agent, "24h");
  const signalTypeKey = liveSignalTypeKeyFromDirection(call24?.direction || "");
  const strengthKey = normalizeLiveTrustStrengthKey("", confidenceValue(call24, agent, "24h"));
  const row = adrTrustSummaryRow(trustLookup, "Layer 1", assetCode, signalTypeKey, strengthKey);
  return row?.trustStatus || { label: "Trust unavailable", icon: "–", canUse: null };
}

function currentLayer2L2lTrustStatus(item = {}) {
  const trustLookup = buildCurrentL2lTrustLookup(backtestData?.adr_reach || null);
  const pairCode = String(item?.pairCode || "").trim().toUpperCase();
  const signalTypeKey = item?.direction ? "CLEAN" : null;
  const strengthKey = normalizeLiveTrustStrengthKey(item?.strengthBucket || "", item?.confidence ?? null);
  const row = adrTrustSummaryRow(trustLookup, "Layer 2", pairCode, signalTypeKey, strengthKey);
  return row?.trustStatus || { label: "Trust unavailable", icon: "–", canUse: null };
}

function currentLayer1DirectionalTrustStatus(agent = null) {
  const trustLookup = buildCurrentDirectionalTrustLookup(backtestData || {});
  const assetCode = String(agent?.agent || "").trim().toUpperCase();
  const call24 = getCall(agent, "24h");
  const directionKey = normalizeDirectionalBiasForResearch(call24?.direction || "");
  const strengthKey = weekdayBreakdownBucketKey(confidenceValue(call24, agent, "24h"));
  if (!assetCode || !directionKey || !strengthKey) {
    return { label: "Directional trust unavailable", icon: "â€“", canUse: null, exFlatWinRatePct: null };
  }
  const row = trustLookup.get(directionalTrustLookupKey("Layer 1", assetCode, directionKey, strengthKey)) || null;
  return row?.trustStatus || { label: "Directional trust unavailable", icon: "â€“", canUse: null, exFlatWinRatePct: null };
}

function currentLayer2DirectionalTrustStatus(item = {}) {
  const trustLookup = buildCurrentDirectionalTrustLookup(backtestData || {});
  const pairCode = String(item?.pairCode || "").trim().toUpperCase();
  const directionKey = String(item?.direction || "").trim().toUpperCase();
  const strengthKey = normalizeLiveTrustStrengthKey(item?.strengthBucket || "", item?.confidence ?? null);
  if (!pairCode || !directionKey || !strengthKey) {
    return { label: "Directional trust unavailable", icon: "â€“", canUse: null, exFlatWinRatePct: null };
  }
  const row = trustLookup.get(directionalTrustLookupKey("Layer 2", pairCode, directionKey, strengthKey)) || null;
  return row?.trustStatus || { label: "Directional trust unavailable", icon: "â€“", canUse: null, exFlatWinRatePct: null };
}

function buildDirectionalTrustBadgePanel(status = null, options = {}) {
  const resolvedStatus = status || { label: "Directional trust unavailable", icon: "-", canUse: null, exFlatWinRatePct: null };
  const tooltip = options.tooltip || "Directional Viable means this asset/pair + 24H direction + strength bucket has historically produced an ex-flat win rate above 55% in the 24H Direction by Strength data.";
  const detail = metricAvailable(resolvedStatus.exFlatWinRatePct)
    ? `${percentValue(resolvedStatus.exFlatWinRatePct)} ex-flat WR`
    : tooltip;
  const headline = resolvedStatus.canUse === true
    ? "\u2705 Directional Viable"
    : resolvedStatus.canUse === false
      ? "\u274C Directional Not Viable"
      : "\u2014 Directional trust unavailable";
  return `
    <div class="l2l-trust-badge ${resolvedStatus.canUse === true ? "l2l-trust-badge-positive" : resolvedStatus.canUse === false ? "l2l-trust-badge-negative" : "l2l-trust-badge-unavailable"}" title="${escapeHtml(tooltip)}" data-validation-panel="directional">
      <strong>${headline}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function buildOverviewL2lTrustBadge(status = null, options = {}) {
  const resolvedStatus = status || { label: "L2L Not Tradable", detail: "No L2L validation", canUse: false };
  const tooltip = options.tooltip || "L2L Tradable means this asset/pair + call type + strength bucket has historically produced a 60%+ L2L opportunity rate at the 55% ADR20 threshold.";
  const headline = resolvedStatus.canUse === true ? "✅ L2L Tradable" : `❌ ${resolvedStatus.label || "L2L Not Tradable"}`;
  const detail = resolvedStatus.detail || tooltip;
  return `
    <div class="l2l-trust-badge ${resolvedStatus.canUse === true ? "l2l-trust-badge-positive" : "l2l-trust-badge-negative"}" title="${escapeHtml(tooltip)}" data-validation-panel="l2l">
      <strong>${escapeHtml(headline)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function currentOverviewLayer1L2lTrustStatus(agent = null) {
  const trustLookup = buildCurrentL2lTrustLookup(backtestData?.adr_reach || null);
  const assetCode = String(agent?.agent || "").trim().toUpperCase();
  const call24 = getCall(agent, "24h");
  const signalTypeKey = liveSignalTypeKeyFromDirection(call24?.direction || "");
  const strengthKey = normalizeLiveTrustStrengthKey("", confidenceValue(call24, agent, "24h"));
  if (!assetCode || !signalTypeKey || !strengthKey) {
    return { label: "L2L Not Tradable", detail: "No valid call", canUse: false };
  }
  const row = adrTrustSummaryRow(trustLookup, "Layer 1", assetCode, signalTypeKey, strengthKey);
  return row?.trustStatus
    ? {
        label: row.trustStatus.canUse === true ? "L2L Tradable" : "L2L Not Tradable",
        detail: row.trustStatus.canUse === true
          ? "Historical L2L validation passed at the 55% ADR20 threshold."
          : "Historical L2L validation did not pass at the 55% ADR20 threshold.",
        canUse: row.trustStatus.canUse === true
      }
    : { label: "L2L Not Tradable", detail: "No L2L validation", canUse: false };
}

function currentOverviewLayer2L2lTrustStatus(item = {}) {
  const trustLookup = buildCurrentL2lTrustLookup(backtestData?.adr_reach || null);
  const pairCode = String(item?.pairCode || "").trim().toUpperCase();
  const signalTypeKey = item?.direction ? "CLEAN" : null;
  const strengthKey = normalizeLiveTrustStrengthKey(item?.strengthBucket || "", item?.confidence ?? null);
  if (!pairCode || !signalTypeKey || !strengthKey) {
    return { label: "L2L Not Tradable", detail: "No valid call", canUse: false };
  }
  const row = adrTrustSummaryRow(trustLookup, "Layer 2", pairCode, signalTypeKey, strengthKey);
  return row?.trustStatus
    ? {
        label: row.trustStatus.canUse === true ? "L2L Tradable" : "L2L Not Tradable",
        detail: row.trustStatus.canUse === true
          ? "Historical L2L validation passed at the 55% ADR20 threshold."
          : "Historical L2L validation did not pass at the 55% ADR20 threshold.",
        canUse: row.trustStatus.canUse === true
      }
    : { label: "L2L Not Tradable", detail: "No L2L validation", canUse: false };
}

function buildOverviewDirectionalTrustBadge(status = null, options = {}) {
  const resolvedStatus = status || { label: "Directional Not Viable", detail: "No matching directional evidence", canUse: false, exFlatWinRatePct: null };
  const tooltip = options.tooltip || "Directional Viable means this asset/pair + 24H direction + strength bucket has historically produced an ex-flat win rate above 55% in the 24H Direction by Strength data.";
  const detail = resolvedStatus.detail || (metricAvailable(resolvedStatus.exFlatWinRatePct)
    ? `${percentValue(resolvedStatus.exFlatWinRatePct)} ex-flat WR`
    : tooltip);
  const headline = resolvedStatus.canUse === true ? "✅ Directional Viable" : "❌ Directional Not Viable";
  return `
    <div class="l2l-trust-badge ${resolvedStatus.canUse === true ? "l2l-trust-badge-positive" : "l2l-trust-badge-negative"}" title="${escapeHtml(tooltip)}" data-validation-panel="directional">
      <strong>${escapeHtml(headline)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function currentOverviewLayer1DirectionalTrustStatus(agent = null) {
  const trustLookup = buildCurrentDirectionalTrustLookup(backtestData || {});
  const assetCode = String(agent?.agent || "").trim().toUpperCase();
  const call24 = getCall(agent, "24h");
  const directionKey = normalizeDirectionalBiasForResearch(call24?.direction || "");
  const strengthKey = weekdayBreakdownBucketKey(confidenceValue(call24, agent, "24h"));
  if (!assetCode || !directionKey || !strengthKey) {
    return { label: "Directional Not Viable", detail: "No 24H call", canUse: false, exFlatWinRatePct: null };
  }
  const row = trustLookup.get(directionalTrustLookupKey("Layer 1", assetCode, directionKey, strengthKey)) || null;
  return row?.trustStatus || { label: "Directional Not Viable", detail: "No matching directional evidence", canUse: false, exFlatWinRatePct: null };
}

function currentOverviewLayer2DirectionalTrustStatus(item = {}) {
  const trustLookup = buildCurrentDirectionalTrustLookup(backtestData || {});
  const pairCode = String(item?.pairCode || "").trim().toUpperCase();
  const directionKey = String(item?.direction || "").trim().toUpperCase();
  const strengthKey = normalizeLiveTrustStrengthKey(item?.strengthBucket || "", item?.confidence ?? null);
  if (!pairCode || !directionKey || !strengthKey) {
    return { label: "Directional Not Viable", detail: "No 24H call", canUse: false, exFlatWinRatePct: null };
  }
  const row = trustLookup.get(directionalTrustLookupKey("Layer 2", pairCode, directionKey, strengthKey)) || null;
  return row?.trustStatus || { label: "Directional Not Viable", detail: "No matching directional evidence", canUse: false, exFlatWinRatePct: null };
}

function renderResearchDirectionalTrustSummary(data = {}) {
  const layer1Rows = buildLayer1DirectionalTrustRows(data);
  const layer2Rows = buildLayer2DirectionalTrustRows(data);
  return `
    <div class="backtest-report">
      ${renderResearchStatusHeader(data)}
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>Directional Trust Summary</h3>
          </div>
          <p class="research-panel-copy">This table isolates clean Bullish/Bearish calls from Lean calls using the existing historical directional evaluation data. It does not use L2L opportunity results. Trust status is based on ex-flat directional win rate only.</p>
        </div>
      </section>
      ${renderDirectionalTrustSummaryTable("Layer 1 Directional Trust", layer1Rows, {
        subtitle: "Historical Accuracy Trust",
        rateLabel: "Directional Win Rate",
        includeOutcomeColumns: true,
        description: "Layer 1 uses stored checker directions, displayed headline confidence buckets, and stored evaluation outcomes from the current historical accuracy dataset."
      })}
      ${renderDirectionalTrustSummaryTable("Layer 2 Directional Trust", layer2Rows, {
        subtitle: "Historical Accuracy Trust",
        rateLabel: "Directional Win Rate",
        includeOutcomeColumns: true,
        description: "Layer 2 uses same-date target and USD checker rows, requires opposite directional sides, combines confidence as the lower leg, and uses the target leg's stored directional evaluation outcome."
      })}
    </div>
  `;
}

function renderAdrUnavailableDetails(title, rows = [], options = {}) {
  if (!rows.length) return "";
  const dataAttribute = options.dataAttribute ? ` ${options.dataAttribute}="true"` : "";
  return `
    <article class="detail-panel wide-panel research-secondary-panel adr-unavailable-panel"${dataAttribute}>
      <div class="panel-head">
        <h3>${escapeHtml(title)}</h3>
      </div>
      <details class="adr-unavailable-details">
        <summary>Show unavailable reasons</summary>
        <ul class="adr-unavailable-list">
          ${rows.map(row => `
            <li>
              <strong>${escapeHtml(row.assetLabel || row.pairLabel || row.assetCode || row.pairCode || "Row")}</strong>
              <span>${escapeHtml(row.blocker || "Unavailable")}</span>
            </li>
          `).join("")}
        </ul>
      </details>
    </article>
  `;
}

function renderAdrReachDayTotals(item = {}, options = {}) {
  const weekdayKeys = Array.isArray(item.weekdayKeys) ? item.weekdayKeys : [];
  const weekdayHeaders = weekdayKeys.map(weekdayKey => `<th>${escapeHtml(weekdayBreakdownLabels[weekdayKey] || weekdayKey)}</th>`).join("");
  const cells = weekdayKeys.map(weekdayKey => `<td>${escapeHtml(formatAdrReachWeekdayCell(item.weekdayTotals?.[weekdayKey]))}</td>`).join("");
  const title = options.title || `${item.assetLabel || item.pairLabel || "L2L Range"} weekday totals across all confidence buckets`;
  const dataAttribute = options.dataAttribute ? ` ${options.dataAttribute}="${escapeHtml(options.dataValue || "")}"` : "";

  return `
    <article class="detail-panel wide-panel research-secondary-panel weekday-breakdown-panel"${dataAttribute}>
      <div class="panel-head">
        <h3>${escapeHtml(title)}</h3>
      </div>
      <div class="research-table-scroll weekday-breakdown-scroll">
        <table class="dashboard-table weekday-breakdown-table weekday-breakdown-totals-table">
          <thead>
            <tr>
              <th>Day Totals</th>
              ${weekdayHeaders}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">All Confidence Buckets</th>
              ${cells}
              <td class="weekday-breakdown-total-cell">${escapeHtml(formatAdrReachWeekdayCell(item.dayTotals))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderAdrReachWeekdayBreakdown(item = {}, options = {}) {
  const weekdayKeys = Array.isArray(item.weekdayKeys) ? item.weekdayKeys : [];
  const weekdayHeaders = weekdayKeys.map(weekdayKey => `<th>${escapeHtml(weekdayBreakdownLabels[weekdayKey] || weekdayKey)}</th>`).join("");
  const bucketRows = weekdayBreakdownBuckets.map(bucket => {
    const cells = weekdayKeys.map(weekdayKey => `<td>${escapeHtml(formatAdrReachWeekdayCell(item.bucketMatrix?.[bucket.key]?.[weekdayKey]))}</td>`).join("");
    return `
      <tr>
        <th scope="row">${escapeHtml(bucket.label)}</th>
        ${cells}
        <td class="weekday-breakdown-total-cell">${escapeHtml(formatAdrReachWeekdayCell(item.bucketTotals?.[bucket.key]))}</td>
      </tr>
    `;
  }).join("");
  const title = options.title || `${item.assetLabel || item.pairLabel || "L2L Range"} by confidence bucket and weekday`;
  const dataAttribute = options.dataAttribute ? ` ${options.dataAttribute}="${escapeHtml(options.dataValue || "")}"` : "";

  return `
    <article class="detail-panel wide-panel research-secondary-panel weekday-breakdown-panel"${dataAttribute}>
      <div class="panel-head">
        <h3>${escapeHtml(title)}</h3>
      </div>
      <div class="research-table-scroll weekday-breakdown-scroll">
        <table class="dashboard-table weekday-breakdown-table">
          <thead>
            <tr>
              <th>Confidence Bucket</th>
              ${weekdayHeaders}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${bucketRows}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderAdrDiagnosticsTable(title, rows = [], options = {}) {
  if (!rows.length) return "";
  const displayRows = rows.slice(0, options.limit || 20);
  return renderResearchBreakdownTable(title, "Diagnostics", displayRows, [
    { label: "Date", className: "adr-col-date", render: row => renderAdrCompactTextCell(row.date || displayDash(), row.layer || "", { className: "adr-table-tight-cell" }) },
    { label: "Signal", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.assetOrPair || displayDash(), row.callDirection || displayDash(), { className: "adr-table-tight-cell" }) },
    { label: "Strength", className: "adr-col-strength", render: row => renderAdrCompactTextCell(row.strengthBucket || displayDash(), metricAvailable(row.confidencePct) ? `${Number(row.confidencePct).toFixed(1)} conf` : "", { className: "adr-table-tight-cell" }) },
    { label: "Candles", className: "adr-col-metric", render: row => renderAdrCompactTextCell(metricAvailable(row.numberOf1hCandlesLoaded) ? row.numberOf1hCandlesLoaded : displayDash(), row.instrumentSymbol || displayDash(), { className: "adr-table-tight-cell" }) },
    { label: "ADR20 / Req", className: "adr-col-metric", render: row => renderAdrCompactTextCell(metricAvailable(row.adr20) ? row.adr20 : displayDash(), metricAvailable(row.requiredL2lDistance) ? `Req ${row.requiredL2lDistance}` : (row.notEvaluatedReason || ""), { className: "adr-table-tight-cell" }) },
    { label: "Trigger", className: "adr-col-trigger", render: row => renderAdrCompactTextCell(row.triggerCandleTime || displayDash(), metricAvailable(row.triggerPrice) ? `Price ${row.triggerPrice}` : (row.notEvaluatedReason || "No trigger"), { className: "adr-table-tight-cell" }) },
    { label: "Reached", className: "adr-col-status", render: row => renderAdrCompactTextCell(row.reached === true ? "WIN" : (row.reached === false ? "MISS" : "N/E"), metricAvailable(row.margin) ? `Margin ${row.margin}` : "", { className: "adr-table-tight-cell" }) }
  ], {
    tableClass: "adr-summary-table adr-confidence-table",
    scrollClass: "adr-summary-scroll"
  });
}

function renderAdrHowToReadPanel() {
  return `
    <section class="detail-panel overview-briefing-panel adr-howto-panel" data-adr-howto-read="true">
      <div class="overview-briefing-shell adr-howto-shell">
        <div class="overview-briefing-copy">
          <div class="panel-head compact-panel-head adr-howto-head">
            <div>
              <p class="eyebrow">Info Guide</p>
              <h3>L2L 1H Sequence Research</h3>
            </div>
            <span class="adr-howto-icon" aria-hidden="true">i</span>
          </div>
          <section class="overview-briefing-block">
            <h3>What this measures</h3>
            <p>This is not close-to-close accuracy. It asks whether a tradable intraday opportunity existed in the direction of the call. The required move is 50% of rolling ADR20. One-hour candles are replayed in chronological order. For bullish calls, the test tracks the lowest low seen so far and counts a win if any later candle high reaches that low plus the required move. For bearish calls, it tracks the highest high seen so far and counts a win if any later candle low reaches that high minus the required move. The market does not need to close in the predicted direction.</p>
          </section>
          <section class="overview-briefing-block">
            <h3>What the percentages mean</h3>
            <p>These are Opportunity Rates. Given this directional signal, how often did the market provide a tradable L2L opportunity during that trading day?</p>
          </section>
        </div>
        <aside class="overview-briefing-chips adr-howto-comparison" aria-label="L2L research comparison">
          <div class="overview-briefing-chip adr-howto-compare-card">
            <span>Difference From Historical Accuracy</span>
            <div class="adr-howto-compare-block">
              <strong>Historical Accuracy</strong>
              <small>Measures whether the market ultimately moved in the predicted direction over the evaluation window.</small>
            </div>
            <div class="adr-howto-compare-block">
              <strong>This Research View</strong>
              <small>Measures whether the market provided a tradable intraday move in the predicted direction during the session.</small>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function renderAdrReachLayer1Asset(asset = {}) {
  if (!asset.available) {
    return "";
  }

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
            <h3>${escapeHtml(asset.assetLabel)} 1H sequence research from Layer 1 checker artifacts</h3>
        </div>
          <p class="research-panel-copy">This section stays downstream of the stored checker artifact and evaluates whether 1H candles confirm the required L2L move occurred after the relevant intraday swing.</p>
      </div>
      ${renderResearchBreakdownTable(`${asset.assetLabel} confidence buckets`, "Confidence Breakdown", asset.bucketSummaryRows || [], [
        { label: "Bucket", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.bucketLabel, "", { className: "adr-table-tight-cell" }) },
        { label: "Outcomes", className: "adr-col-metric", render: row => renderAdrCompactTextCell(`${row.wins}W / ${row.losses}L / ${row.total}T`, "", { className: "adr-table-tight-cell" }) },
          { label: "Win Rate", className: "adr-col-rate", render: row => renderAdrCompactTextCell(metricAvailable(row.l2lRangeAvailablePct) ? percentValue(row.l2lRangeAvailablePct) : displayDash(), "", { className: "adr-table-tight-cell" }) }
      ], {
        tableClass: "adr-summary-table adr-confidence-table",
        scrollClass: "adr-summary-scroll"
      })}
      ${renderAdrReachDayTotals(asset, {
        title: `${asset.assetLabel} weekday totals across all confidence buckets`
      })}
      ${renderAdrReachWeekdayBreakdown(asset, {
        title: `${asset.assetLabel} by confidence bucket and weekday`,
        dataAttribute: "data-adr-reach-asset",
        dataValue: asset.assetCode
      })}
      ${renderAdrDiagnosticsTable(`${asset.assetLabel} diagnostics samples`, asset.diagnosticRowsSample || [], {
        limit: 20
      })}
    </section>
  `;
}

function renderAdrReachLayer2Pair(pair = {}) {
  if (!pair.available) {
    return "";
  }

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
            <h3>${escapeHtml(pair.pairLabel)} 1H sequence research from existing Pair Trade Research signal selection</h3>
        </div>
          <p class="research-panel-copy">This section reuses the existing Layer 2 pair-trade eligibility logic. Only actual tradable pair signals are included, and the metric asks whether 1H candles confirm the required L2L move occurred after the relevant intraday swing.</p>
      </div>
      ${renderResearchBreakdownTable(`${pair.pairLabel} confidence buckets`, "Confidence Breakdown", pair.bucketSummaryRows || [], [
        { label: "Bucket", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.bucketLabel, "", { className: "adr-table-tight-cell" }) },
        { label: "Outcomes", className: "adr-col-metric", render: row => renderAdrCompactTextCell(`${row.wins}W / ${row.losses}L / ${row.total}T`, "", { className: "adr-table-tight-cell" }) },
          { label: "Win Rate", className: "adr-col-rate", render: row => renderAdrCompactTextCell(metricAvailable(row.l2lRangeAvailablePct) ? percentValue(row.l2lRangeAvailablePct) : displayDash(), "", { className: "adr-table-tight-cell" }) }
      ], {
        tableClass: "adr-summary-table adr-confidence-table",
        scrollClass: "adr-summary-scroll"
      })}
      ${renderAdrReachDayTotals(pair, {
        title: `${pair.pairLabel} weekday totals across all confidence buckets`
      })}
      ${renderAdrReachWeekdayBreakdown(pair, {
        title: `${pair.pairLabel} by combined confidence bucket and weekday`,
        dataAttribute: "data-adr-reach-pair",
        dataValue: pair.pairCode
      })}
      ${renderAdrDiagnosticsTable(`${pair.pairLabel} diagnostics samples`, pair.diagnosticRowsSample || [], {
        limit: 20
      })}
    </section>
  `;
}

function renderResearchAdrReach(data = {}) {
  const adrReach = data.adr_reach || null;
  const layer1SummaryRows = Array.isArray(adrReach?.layer1?.summary_rows) ? adrReach.layer1.summary_rows : [];
  const layer1StrengthRows = Array.isArray(adrReach?.layer1?.strength_summary_rows) ? adrReach.layer1.strength_summary_rows : [];
  const layer1ComparisonRows = Array.isArray(adrReach?.layer1?.comparison_rows) ? adrReach.layer1.comparison_rows : [];
  const layer1EntryReliabilityGroups = Array.isArray(adrReach?.layer1?.entry_reliability_groups) ? adrReach.layer1.entry_reliability_groups : [];
  const layer1Assets = Array.isArray(adrReach?.layer1?.assets) ? adrReach.layer1.assets : [];
  const layer2SummaryRows = Array.isArray(adrReach?.layer2?.summary_rows) ? adrReach.layer2.summary_rows : [];
  const layer2StrengthRows = Array.isArray(adrReach?.layer2?.strength_summary_rows) ? adrReach.layer2.strength_summary_rows : [];
  const layer2ComparisonRows = Array.isArray(adrReach?.layer2?.comparison_rows) ? adrReach.layer2.comparison_rows : [];
  const layer2EntryReliabilityGroups = Array.isArray(adrReach?.layer2?.entry_reliability_groups) ? adrReach.layer2.entry_reliability_groups : [];
  const layer2Pairs = Array.isArray(adrReach?.layer2?.pairs) ? adrReach.layer2.pairs : [];
  const sourceAuditRows = Array.isArray(adrReach?.source_audit) ? adrReach.source_audit : [];
  const trustSummaryLookup = buildAdrTrustSummaryLookup(buildAdrTrustSummaryRows(adrReach, "0.55"));
  const unavailableLayer1Rows = layer1SummaryRows.filter(row => !row.available);
  const unavailableLayer2Rows = layer2SummaryRows.filter(row => !row.available);

  if (!layer1SummaryRows.length && !layer2SummaryRows.length) {
    return `
      <div class="backtest-report">
        <article class="detail-panel wide-panel research-secondary-panel">
            <h3>L2L 1H sequence research unavailable</h3>
            <div class="empty-state matrix-evidence-empty">The downstream L2L 1H sequence artifact could not be loaded.</div>
        </article>
      </div>
    `;
  }

  return `
    <div class="backtest-report">
      ${renderResearchStatusHeader(data)}
      ${renderAdrHowToReadPanel()}
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>Entry Reliability</h3>
          </div>
          <p class="research-panel-copy">This section separates clean Bullish/Bearish calls from Lean calls so the minimum viable entry threshold can be identified. Rows marked Reliable have produced a 60%+ L2L opportunity rate historically.</p>
        </div>
      </section>
      ${renderAdrEntryReliabilitySection("Layer 1 Entry Reliability", layer1EntryReliabilityGroups, {
        evaluatedLabel: "Evaluated",
        description: "Layer 1 reliability is grouped by the original call type while keeping the same L2L 1H sequence calculation and 50% ADR20 threshold.",
        trustLookup: trustSummaryLookup,
        trustLayerLabel: "Layer 1"
      })}
      ${renderAdrEntryReliabilitySection("Layer 2 Entry Reliability", layer2EntryReliabilityGroups, {
        evaluatedLabel: "Evaluated",
        description: "Layer 2 reliability remains downstream-only. Opposite-side target/USD directional pairings are required, and Lean directional calls are now separated from clean Bullish/Bearish calls in this research view.",
        trustLookup: trustSummaryLookup,
        trustLayerLabel: "Layer 2"
      })}
      <section class="research-section" data-adr-reach-layer1-summary="true">
        <div class="research-section-head">
          <div>
              <h3>Method and Source Audit</h3>
          </div>
            <p class="research-panel-copy">This measures whether 1H intraday candles show price moved at least the required L2L distance in the direction of the call after the relevant intraday swing. It uses 50% of ADR20 as the required move. This is sequence-aware and does not rely on daily high-low alone.</p>
        </div>
        <article class="detail-panel wide-panel research-secondary-panel weekday-breakdown-intro-panel">
            <p class="research-panel-copy">Bullish rows require a later 1H candle high to reach the prior lowest low plus required distance. Bearish rows require a later 1H candle low to reach the prior highest high minus required distance. Daily candles are used only for ADR20 and fixed reference values remain diagnostics only.</p>
        </article>
          ${renderResearchBreakdownTable("L2L source audit", "Warehouse Audit", sourceAuditRows, [
          { label: "Asset", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.assetLabel, "", { className: "adr-table-tight-cell" }) },
          { label: "Status", className: "adr-col-status", render: row => renderAdrCompactTextCell(row.available ? "Available" : "Unavailable", "", { className: "adr-table-tight-cell" }) },
          { label: "Source", className: "adr-col-source", render: row => renderAdrCompactTextCell(row.available ? (row.candleSourceLabel || displayDash()) : displayDash(), row.available ? formatAdrAuditCoverage(row) : "", { className: "adr-table-tight-cell adr-source-cell" }) },
            { label: "Instrument", className: "adr-col-reference", render: row => renderAdrCompactTextCell(row.available ? (row.instrument || displayDash()) : displayDash(), metricAvailable(row.fixedReferenceL2lDistance) ? `Fixed ref ${row.fixedReferenceL2lDistance}` : "", { className: "adr-table-tight-cell" }) }
        ], {
          tableClass: "adr-summary-table adr-audit-table",
          scrollClass: "adr-summary-scroll"
        })}
          ${renderAdrUnavailableDetails("L2L unavailable source blockers", sourceAuditRows.filter(row => !row.available), {
          dataAttribute: "data-adr-unavailable-audit"
        })}
      </section>
      <section class="research-section" data-adr-reach-layer2-summary="true">
        <div class="research-section-head">
          <div>
              <h3>Layer 1 By Asset</h3>
          </div>
          <p class="research-panel-copy">Layer 1 rows use stored displayed headline confidence and directional calls from the canonical checker artifacts.</p>
        </div>
        ${renderResearchBreakdownTable("Layer 1 by asset", "Summary", layer1SummaryRows, [
          { label: "Asset", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.assetLabel, "", { className: "adr-table-tight-cell" }) },
          { label: "Status", className: "adr-col-status", render: row => renderAdrCompactTextCell(row.available ? "Available" : "Unavailable", "", { className: "adr-table-tight-cell" }) },
          { label: "Evaluated", className: "adr-col-metric", render: row => renderAdrCompactTextCell(renderAdrCompactSummaryValue(row, "evaluatedCalls", "l2lRangeAvailableWins", "l2lRangeAvailableLosses"), "", { className: "adr-table-tight-cell" }) },
          { label: "Win Rate", className: "adr-col-rate", render: row => renderAdrCompactTextCell(row.available && metricAvailable(row.l2lRangeAvailablePct) ? percentValue(row.l2lRangeAvailablePct) : displayDash(), "", { className: "adr-table-tight-cell" }) },
          { label: "Strong+", className: "adr-col-strongplus", render: row => renderAdrCompactTextCell(renderAdrCompactStrongPlusValue(row, "strongPlusCalls", "strongPlusL2lRangeAvailablePct"), "", { className: "adr-table-tight-cell" }) }
        ], {
          tableClass: "adr-summary-table adr-layer1-summary-table",
          scrollClass: "adr-summary-scroll"
        })}
        ${renderResearchBreakdownTable("Layer 1 by strength", "Summary", layer1StrengthRows, [
          { label: "Strength", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.bucketLabel, "", { className: "adr-table-tight-cell" }) },
          { label: "Evaluated", className: "adr-col-metric", render: row => renderAdrCompactTextCell(`${row.total} · ${row.wins}W / ${row.losses}L`, "", { className: "adr-table-tight-cell" }) },
          { label: "Win Rate", className: "adr-col-rate", render: row => renderAdrCompactTextCell(metricAvailable(row.l2lRangeAvailablePct) ? percentValue(row.l2lRangeAvailablePct) : displayDash(), "", { className: "adr-table-tight-cell" }) }
        ], {
          tableClass: "adr-summary-table adr-layer1-summary-table",
          scrollClass: "adr-summary-scroll"
        })}
        ${renderResearchBreakdownTable("Layer 1 all signals vs Strong+", "Summary", layer1ComparisonRows, [
          { label: "Cohort", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.cohort, "", { className: "adr-table-tight-cell" }) },
          { label: "Evaluated", className: "adr-col-metric", render: row => renderAdrCompactTextCell(`${row.total} · ${row.wins}W / ${row.losses}L`, "", { className: "adr-table-tight-cell" }) },
          { label: "Win Rate", className: "adr-col-rate", render: row => renderAdrCompactTextCell(metricAvailable(row.l2lRangeAvailablePct) ? percentValue(row.l2lRangeAvailablePct) : displayDash(), "", { className: "adr-table-tight-cell" }) }
        ], {
          tableClass: "adr-summary-table adr-layer1-summary-table",
          scrollClass: "adr-summary-scroll"
        })}
        ${renderAdrUnavailableDetails("Layer 1 unavailable reasons", unavailableLayer1Rows, {
          dataAttribute: "data-adr-unavailable-layer1"
        })}
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
              <h3>Layer 2 By Pair</h3>
          </div>
          <p class="research-panel-copy">Layer 2 rows reuse the existing Pair Trade Research signal-selection rules. Only actual tradable pair signals are evaluated, while conflict, no-trade, and neutral setups stay excluded.</p>
        </div>
          ${renderResearchBreakdownTable("Layer 2 by pair", "Summary", layer2SummaryRows, [
          { label: "Pair", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.pairLabel, "", { className: "adr-table-tight-cell" }) },
          { label: "Status", className: "adr-col-status", render: row => renderAdrCompactTextCell(row.available ? "Available" : "Unavailable", "", { className: "adr-table-tight-cell" }) },
          { label: "Tradable", className: "adr-col-metric", render: row => renderAdrCompactTextCell(renderAdrCompactSummaryValue(row, "tradableSignals", "l2lRangeAvailableWins", "l2lRangeAvailableLosses"), "", { className: "adr-table-tight-cell" }) },
          { label: "Win Rate", className: "adr-col-rate", render: row => renderAdrCompactTextCell(row.available && metricAvailable(row.l2lRangeAvailablePct) ? percentValue(row.l2lRangeAvailablePct) : displayDash(), "", { className: "adr-table-tight-cell" }) },
          { label: "Strong+", className: "adr-col-strongplus", render: row => renderAdrCompactTextCell(renderAdrCompactStrongPlusValue(row, "strongPlusSignals", "strongPlusL2lRangeAvailablePct"), "", { className: "adr-table-tight-cell" }) }
        ], {
          tableClass: "adr-summary-table adr-layer2-summary-table",
          scrollClass: "adr-summary-scroll"
        })}
        ${renderResearchBreakdownTable("Layer 2 by strength", "Summary", layer2StrengthRows, [
          { label: "Strength", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.bucketLabel, "", { className: "adr-table-tight-cell" }) },
          { label: "Tradable", className: "adr-col-metric", render: row => renderAdrCompactTextCell(`${row.total} · ${row.wins}W / ${row.losses}L`, "", { className: "adr-table-tight-cell" }) },
          { label: "Win Rate", className: "adr-col-rate", render: row => renderAdrCompactTextCell(metricAvailable(row.l2lRangeAvailablePct) ? percentValue(row.l2lRangeAvailablePct) : displayDash(), "", { className: "adr-table-tight-cell" }) }
        ], {
          tableClass: "adr-summary-table adr-layer2-summary-table",
          scrollClass: "adr-summary-scroll"
        })}
        ${renderResearchBreakdownTable("Layer 2 all signals vs Strong+", "Summary", layer2ComparisonRows, [
          { label: "Cohort", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.cohort, "", { className: "adr-table-tight-cell" }) },
          { label: "Tradable", className: "adr-col-metric", render: row => renderAdrCompactTextCell(`${row.total} · ${row.wins}W / ${row.losses}L`, "", { className: "adr-table-tight-cell" }) },
          { label: "Win Rate", className: "adr-col-rate", render: row => renderAdrCompactTextCell(metricAvailable(row.l2lRangeAvailablePct) ? percentValue(row.l2lRangeAvailablePct) : displayDash(), "", { className: "adr-table-tight-cell" }) }
        ], {
          tableClass: "adr-summary-table adr-layer2-summary-table",
          scrollClass: "adr-summary-scroll"
        })}
        ${renderAdrUnavailableDetails("Layer 2 unavailable reasons", unavailableLayer2Rows, {
          dataAttribute: "data-adr-unavailable-layer2"
        })}
      </section>
      ${layer1Assets.map(renderAdrReachLayer1Asset).join("")}
      ${layer2Pairs.map(renderAdrReachLayer2Pair).join("")}
    </div>
  `;
}

function formatHalfL2lRate(summary = {}) {
  if (!summary || !metricAvailable(summary.hitRatePct)) {
    return renderAdrCompactTextCell(displayDash(), "", { className: "adr-table-tight-cell" });
  }

  const ciText = metricAvailable(summary.wilson95LowPct) && metricAvailable(summary.wilson95HighPct)
    ? `95% CI ${summary.wilson95LowPct}-${summary.wilson95HighPct}%`
    : "";
  return renderAdrCompactTextCell(
    percentValue(summary.hitRatePct),
    `${summary.hits ?? 0}/${summary.eligibleCalls ?? 0}${ciText ? ` | ${ciText}` : ""}`,
    { className: "adr-table-tight-cell" }
  );
}

function formatHalfL2lCoverage(row = {}) {
  const full = row.fullStandard || {};
  const half = row.halfOfStandard || {};
  return renderAdrCompactTextCell(
    metricAvailable(full.eligibleCalls) ? full.eligibleCalls : displayDash(),
    `Unresolved ${full.unresolvedRows ?? 0} | Excl ${full.exclusions ?? 0} | Half hits ${half.hits ?? 0}`,
    { className: "adr-table-tight-cell" }
  );
}

function formatHalfL2lDelta(row = {}) {
  return renderAdrCompactTextCell(
    metricAvailable(row.halfMinusFullPctPoints) ? signedMetricValue(row.halfMinusFullPctPoints, "pp") : displayDash(),
    `Full med ${metricAvailable(row.fullStandard?.medianTimeToTargetHours) ? `${row.fullStandard.medianTimeToTargetHours}h` : displayDash()} | Half med ${metricAvailable(row.halfOfStandard?.medianTimeToTargetHours) ? `${row.halfOfStandard.medianTimeToTargetHours}h` : displayDash()}`,
    { className: "adr-table-tight-cell" }
  );
}

function renderHalfL2lComparisonTable(title, subtitle, rows = [], options = {}) {
  if (!rows.length) return "";
  return renderResearchBreakdownTable(title, subtitle, rows, [
    {
      label: options.entityLabel || "Entity",
      className: "adr-col-entity",
      render: row => renderAdrCompactTextCell(options.entityRenderer ? options.entityRenderer(row) : (row.assetLabel || row.pairLabel || row.label || displayDash()), options.entitySecondaryRenderer ? options.entitySecondaryRenderer(row) : "", { className: "adr-table-tight-cell" })
    },
    { label: "100% Standard", className: "adr-col-rate", render: row => formatHalfL2lRate(row.fullStandard) },
    { label: "50% Of Standard", className: "adr-col-rate", render: row => formatHalfL2lRate(row.halfOfStandard) },
    { label: "Delta / Median", className: "adr-col-metric", render: row => formatHalfL2lDelta(row) },
    { label: "Coverage", className: "adr-col-metric", render: row => formatHalfL2lCoverage(row) }
  ], {
    tableClass: "adr-summary-table adr-layer1-summary-table",
    scrollClass: "adr-summary-scroll"
  });
}

function renderResearchHalfL2lReach(data = {}) {
  const halfL2l = data.half_l2l_reach || null;
  const comparisons = halfL2l?.comparisons || {};
  const sourceAuditRows = Array.isArray(halfL2l?.source_audit) ? halfL2l.source_audit : [];
  const layer1AssetRows = Array.isArray(comparisons.layer1_assets) ? comparisons.layer1_assets : [];
  const layer2PairRows = Array.isArray(comparisons.layer2_pairs) ? comparisons.layer2_pairs : [];
  const layer1DirectionRows = Array.isArray(comparisons.layer1_directions) ? comparisons.layer1_directions : [];
  const layer2DirectionRows = Array.isArray(comparisons.layer2_directions) ? comparisons.layer2_directions : [];
  const layer1StrengthRows = Array.isArray(comparisons.layer1_strength_bands) ? comparisons.layer1_strength_bands : [];
  const layer2StrengthRows = Array.isArray(comparisons.layer2_strength_bands) ? comparisons.layer2_strength_bands : [];
  const layer1ExactRows = (Array.isArray(comparisons.layer1_exact_confidence_buckets) ? comparisons.layer1_exact_confidence_buckets : []).filter(row => Number(row?.fullStandard?.eligibleCalls || 0) >= 20);
  const layer2ExactRows = (Array.isArray(comparisons.layer2_exact_confidence_buckets) ? comparisons.layer2_exact_confidence_buckets : []).filter(row => Number(row?.fullStandard?.eligibleCalls || 0) >= 20);
  const layer1FoldRows = Array.isArray(comparisons.layer1_chronological_folds) ? comparisons.layer1_chronological_folds : [];
  const layer2FoldRows = Array.isArray(comparisons.layer2_chronological_folds) ? comparisons.layer2_chronological_folds : [];
  const latestLayer1Rows = Array.isArray(comparisons.layer1_latest_period) ? comparisons.layer1_latest_period : [];
  const latestLayer2Rows = Array.isArray(comparisons.layer2_latest_period) ? comparisons.layer2_latest_period : [];
  const monotonicityRows = Array.isArray(halfL2l?.monotonicity) ? halfL2l.monotonicity : [];

  if (!halfL2l || (!layer1AssetRows.length && !layer2PairRows.length)) {
    return `
      <div class="backtest-report">
        <article class="detail-panel wide-panel research-secondary-panel">
          <h3>50% L2L Reach unavailable</h3>
          <div class="empty-state matrix-evidence-empty">The downstream 50% L2L Reach artifact could not be loaded.</div>
        </article>
      </div>
    `;
  }

  return `
    <div class="backtest-report">
      ${renderResearchStatusHeader(data)}
      <section class="detail-panel overview-briefing-panel adr-howto-panel" data-half-l2l-summary="true">
        <div class="overview-briefing-shell adr-howto-shell">
          <div class="overview-briefing-copy">
            <div class="panel-head compact-panel-head adr-howto-head">
              <div>
                <p class="eyebrow">Research Only</p>
                <h3>50% L2L Reach</h3>
              </div>
              <span class="adr-howto-icon" aria-hidden="true">50%</span>
            </div>
            <section class="overview-briefing-block">
              <h3>Definition</h3>
              <p>This tab does not change live trading logic. The existing standard L2L research uses <code>ADR20 × 0.5</code>. This new view tests <code>50% of that existing standard</code>, which equals <code>ADR20 × 0.25</code>, while keeping the same directional calls, same evaluation-day session, same source candles, and same exclusions.</p>
            </section>
            <section class="overview-briefing-block">
              <h3>Guardrails</h3>
              <p>Reach rate is not trade profitability. The current contract has no entry, spread, stop, slippage, or target-before-stop sequence rule, so these results are research-only evidence for a later confidence redesign.</p>
            </section>
          </div>
          <aside class="overview-briefing-chips adr-howto-comparison" aria-label="50% L2L research comparison">
            <div class="overview-briefing-chip adr-howto-compare-card">
              <span>Current Baseline</span>
              <div class="adr-howto-compare-block">
                <strong>100% Of Current Standard</strong>
                <small>${escapeHtml(halfL2l?.meta?.current_standard_definition || "ADR20 × 0.5")}</small>
              </div>
              <div class="adr-howto-compare-block">
                <strong>50% Of Current Standard</strong>
                <small>${escapeHtml(halfL2l?.meta?.half_target_definition || "ADR20 × 0.25")}</small>
              </div>
            </div>
          </aside>
        </div>
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>Overall Comparison</h3>
          </div>
          <p class="research-panel-copy">Both layers are shown side by side with numerator, denominator, Wilson 95% interval, unresolved rows, exclusions, and median time to target.</p>
        </div>
        ${renderHalfL2lComparisonTable("Layer totals", "Research summary", [
          comparisons.overall?.layer1 || {},
          comparisons.overall?.layer2 || {}
        ], {
          entityLabel: "Layer",
          entityRenderer: row => row.label || row.layer || displayDash()
        })}
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>Source Contract</h3>
          </div>
          <p class="research-panel-copy">The same repo-local OANDA and Binance caches used by the existing L2L 1H Sequence Research are reused here. Unsupported USD/DXY remains unavailable.</p>
        </div>
        ${renderResearchBreakdownTable("Source audit", "Coverage", sourceAuditRows, [
          { label: "Asset", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.assetLabel || displayDash(), row.instrument || "", { className: "adr-table-tight-cell" }) },
          { label: "Status", className: "adr-col-status", render: row => renderAdrCompactTextCell(row.available ? "Available" : "Unavailable", "", { className: "adr-table-tight-cell" }) },
          { label: "Coverage", className: "adr-col-source", render: row => renderAdrCompactTextCell(row.sourceCoverage?.intraday?.startDate || displayDash(), row.sourceCoverage?.intraday?.endDate ? `1H to ${row.sourceCoverage.intraday.endDate}` : (row.blocker || ""), { className: "adr-table-tight-cell" }) },
          { label: "Hashes", className: "adr-col-reference", render: row => renderAdrCompactTextCell(row.dailySourceHash?.sha256 ? row.dailySourceHash.sha256.slice(0, 12) : displayDash(), row.intradaySourceHash?.sha256 ? row.intradaySourceHash.sha256.slice(0, 12) : "", { className: "adr-table-tight-cell" }) }
        ], {
          tableClass: "adr-summary-table adr-audit-table",
          scrollClass: "adr-summary-scroll"
        })}
        ${renderAdrUnavailableDetails("Unavailable source blockers", sourceAuditRows.filter(row => !row.available).map(row => ({
          assetOrPair: row.assetLabel,
          callDirection: row.instrument || "",
          notEvaluatedReason: row.blocker || "Unavailable source",
          date: row.sourceCoverage?.intraday?.startDate || "",
          layer: "Source Audit"
        })), {
          dataAttribute: "data-half-l2l-unavailable"
        })}
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>By Asset And Pair</h3>
          </div>
          <p class="research-panel-copy">This is the first place to compare the current baseline against the half-target relaxation without conflating it with profitability.</p>
        </div>
        ${renderHalfL2lComparisonTable("Layer 1 by asset", "Asset results", layer1AssetRows, {
          entityLabel: "Asset",
          entityRenderer: row => row.assetLabel || displayDash()
        })}
        ${renderHalfL2lComparisonTable("Layer 2 by pair", "Pair results", layer2PairRows, {
          entityLabel: "Pair",
          entityRenderer: row => row.pairLabel || displayDash()
        })}
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>Direction And Confidence</h3>
          </div>
          <p class="research-panel-copy">These tables split results by direction, current strength band, and finer exact confidence buckets where sample size is at least 20 eligible rows.</p>
        </div>
        ${renderHalfL2lComparisonTable("Layer 1 by direction", "Direction split", layer1DirectionRows, {
          entityLabel: "Direction",
          entityRenderer: row => row.assetLabel || displayDash(),
          entitySecondaryRenderer: row => row.callDirection || ""
        })}
        ${renderHalfL2lComparisonTable("Layer 2 by direction", "Direction split", layer2DirectionRows, {
          entityLabel: "Direction",
          entityRenderer: row => row.pairLabel || displayDash(),
          entitySecondaryRenderer: row => row.callDirection || ""
        })}
        ${renderHalfL2lComparisonTable("Layer 1 by strength", "Current confidence bands", layer1StrengthRows, {
          entityLabel: "Strength",
          entityRenderer: row => row.assetLabel || displayDash(),
          entitySecondaryRenderer: row => row.strengthBucket || ""
        })}
        ${renderHalfL2lComparisonTable("Layer 2 by strength", "Current confidence bands", layer2StrengthRows, {
          entityLabel: "Strength",
          entityRenderer: row => row.pairLabel || displayDash(),
          entitySecondaryRenderer: row => row.strengthBucket || ""
        })}
        ${renderHalfL2lComparisonTable("Layer 1 exact confidence buckets", "Sample size >= 20", layer1ExactRows, {
          entityLabel: "Confidence",
          entityRenderer: row => row.assetLabel || displayDash(),
          entitySecondaryRenderer: row => row.exactConfidenceBucketLabel || ""
        })}
        ${renderHalfL2lComparisonTable("Layer 2 exact confidence buckets", "Sample size >= 20", layer2ExactRows, {
          entityLabel: "Confidence",
          entityRenderer: row => row.pairLabel || displayDash(),
          entitySecondaryRenderer: row => row.exactConfidenceBucketLabel || ""
        })}
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>Chronological Stability</h3>
          </div>
          <p class="research-panel-copy">Rows are split into chronological folds by entity, and the latest untouched fold is shown separately so a strong point estimate cannot hide a weak most-recent period.</p>
        </div>
        ${renderHalfL2lComparisonTable("Layer 1 chronological folds", "Fold stability", layer1FoldRows, {
          entityLabel: "Fold",
          entityRenderer: row => row.assetLabel || displayDash(),
          entitySecondaryRenderer: row => `${row.foldKey || ""} | ${row.foldStartDate || ""} to ${row.foldEndDate || ""}`
        })}
        ${renderHalfL2lComparisonTable("Layer 2 chronological folds", "Fold stability", layer2FoldRows, {
          entityLabel: "Fold",
          entityRenderer: row => row.pairLabel || displayDash(),
          entitySecondaryRenderer: row => `${row.foldKey || ""} | ${row.foldStartDate || ""} to ${row.foldEndDate || ""}`
        })}
        ${renderHalfL2lComparisonTable("Latest untouched chronological period", "Most recent fold only", [...latestLayer1Rows, ...latestLayer2Rows], {
          entityLabel: "Latest",
          entityRenderer: row => row.assetLabel || row.pairLabel || displayDash(),
          entitySecondaryRenderer: row => `${row.foldKey || ""} | ${row.foldStartDate || ""} to ${row.foldEndDate || ""}`
        })}
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>Confidence Monotonicity</h3>
          </div>
          <p class="research-panel-copy">Higher displayed confidence is tested against the half-target reach rate only. A higher point estimate is not enough by itself; sample size and interval stability remain visible.</p>
        </div>
        ${renderResearchBreakdownTable("Half-target monotonicity", "Half target only", monotonicityRows, [
          { label: "Layer", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.layerLabel || displayDash(), row.monotonicNonDecreasing ? "Non-decreasing" : "Violations found", { className: "adr-table-tight-cell" }) },
          { label: "Checked buckets", className: "adr-col-metric", render: row => renderAdrCompactTextCell(row.checkedBuckets?.length ?? 0, `${row.minimumSampleForCheck ?? 0}+ sample`, { className: "adr-table-tight-cell" }) },
          { label: "Result", className: "adr-col-status", render: row => renderAdrCompactTextCell(row.monotonicNonDecreasing ? "Pass" : "Fail", row.violations?.length ? `${row.violations.length} reversal(s)` : "", { className: "adr-table-tight-cell" }) },
          { label: "Buckets", className: "adr-col-source", render: row => renderAdrCompactTextCell((row.checkedBuckets || []).map(bucket => `${bucket.bucketKey}:${metricAvailable(bucket.hitRatePct) ? `${bucket.hitRatePct}%` : "-"}`).join(" | ") || displayDash(), "", { className: "adr-table-tight-cell" }) }
        ], {
          tableClass: "adr-summary-table adr-audit-table",
          scrollClass: "adr-summary-scroll"
        })}
      </section>
    </div>
  `;
}

function getDirectionalAccuracyArtifact(data = {}) {
  return data.half_l2l_reach || null;
}

function getDirectionalAccuracyRows(data = {}) {
  const artifact = getDirectionalAccuracyArtifact(data);
  if (Array.isArray(artifact?.row_level?.all)) return artifact.row_level.all;
  return [
    ...(Array.isArray(artifact?.row_level?.layer1) ? artifact.row_level.layer1 : []),
    ...(Array.isArray(artifact?.row_level?.layer2) ? artifact.row_level.layer2 : [])
  ];
}

function getDirectionalAccuracyReviewSignature(artifact = null) {
  return JSON.stringify({
    version: artifact?.meta?.version || null,
    hashes: (artifact?.source_audit || []).map(row => `${row.assetCode}:${row.dailySourceHash?.sha256 || ""}:${row.intradaySourceHash?.sha256 || ""}`),
    sampleRecordIds: (artifact?.manual_review?.sample_rows || []).map(row => row?.recordId).filter(Boolean)
  });
}

function compareDirectionalAccuracySampleRow(left, right) {
  const leftDate = String(left?.evaluationDate || "");
  const rightDate = String(right?.evaluationDate || "");
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  return String(left?.recordId || "").localeCompare(String(right?.recordId || ""));
}

function getDirectionalAccuracyManualSampleRows(artifact = null) {
  return Array.isArray(artifact?.manual_review?.sample_rows)
    ? artifact.manual_review.sample_rows.slice().sort(compareDirectionalAccuracySampleRow)
    : [];
}

function getDirectionalAccuracyManualGroups(artifact = null) {
  const sampleRows = getDirectionalAccuracyManualSampleRows(artifact);
  const configuredGroups = Array.isArray(artifact?.manual_review?.groups) ? artifact.manual_review.groups : [];
  if (configuredGroups.length) {
    return configuredGroups.map((group) => ({
      ...group,
      sampleRows: sampleRows
        .filter((row) => row.layer === group.layer && row.entityCode === group.entityCode)
        .sort(compareDirectionalAccuracySampleRow)
    }));
  }

  const orderedKeys = [];
  sampleRows.forEach((row) => {
    const key = `${row.layer}:${row.entityCode}`;
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  });
  return orderedKeys.map((key) => {
    const [layer, entityCode] = key.split(":");
    const rows = sampleRows.filter((row) => row.layer === layer && row.entityCode === entityCode).sort(compareDirectionalAccuracySampleRow);
    return {
      layer,
      layerLabel: layer === "LAYER_1" ? "Layer 1" : "Layer 2",
      entityCode,
      entityLabel: rows[0]?.entityLabel || entityCode,
      sampleRows: rows
    };
  });
}

function getDirectionalAccuracyRetainedReviewRows(artifact = null, store = null) {
  const effectiveStore = store || loadDirectionalAccuracyReviewStore(artifact);
  return getDirectionalAccuracyManualSampleRows(artifact).map((row) => ({
    row,
    review: effectiveStore.reviews?.[row.recordId] || {}
  }));
}

function loadDirectionalAccuracyReviewStore(artifact = null) {
  const signature = getDirectionalAccuracyReviewSignature(artifact);
  const fallback = { artifactSignature: signature, staleArtifactSignature: null, reviews: {} };
  if (!storageAvailable()) return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(halfL2lReviewStorageKey) || "null");
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      artifactSignature: signature,
      staleArtifactSignature: parsed.staleArtifactSignature || (parsed.artifactSignature && parsed.artifactSignature !== signature ? parsed.artifactSignature : null),
      reviews: parsed.reviews && typeof parsed.reviews === "object" ? parsed.reviews : {}
    };
  } catch (err) {
    return fallback;
  }
}

function saveDirectionalAccuracyReviewStore(store) {
  if (!storageAvailable()) return;
  window.localStorage.setItem(halfL2lReviewStorageKey, JSON.stringify(store));
}

function exportDirectionalAccuracyReviewJson(artifact = null) {
  const store = loadDirectionalAccuracyReviewStore(artifact);
  const retainedRows = getDirectionalAccuracyRetainedReviewRows(artifact, store);
  const manualGroups = getDirectionalAccuracyManualGroups(artifact);
  const payload = {
    review_contract_version: "half-l2l-manual-review-export-v1",
    sample_contract_version: "half-l2l-manual-review-export-v2",
    research_contract_version: artifact?.meta?.version || null,
    artifact_signature: getDirectionalAccuracyReviewSignature(artifact),
    source_hashes: (artifact?.source_audit || []).map(row => ({
      assetCode: row.assetCode,
      dailySourceHash: row.dailySourceHash?.sha256 || null,
      intradaySourceHash: row.intradaySourceHash?.sha256 || null
    })),
    sample_size: retainedRows.length,
    sample_layer_counts: retainedRows.reduce((acc, entry) => {
      acc[entry.row.layer] = (acc[entry.row.layer] || 0) + 1;
      return acc;
    }, {}),
    sample_record_ids: retainedRows.map((entry) => entry.row.recordId),
    sample_groups: manualGroups.map((group) => ({
      layer: group.layer,
      entityCode: group.entityCode,
      entityLabel: group.entityLabel,
      sampleSize: group.sampleRows.length,
      recordIds: group.sampleRows.map((row) => row.recordId)
    })),
    reviews: retainedRows.map(({ row, review }) => ({
      recordId: row.recordId,
      layer: row.layer,
      entityCode: row.entityCode,
      entityLabel: row.entityLabel || row.entityCode,
      evaluationDate: row.evaluationDate || null,
      callDirection: row.callDirection || null,
      backtesterHalfOutcome: review.backtesterHalfOutcome || row.outcomes?.HALF_OF_STANDARD?.outcome || null,
      backtesterFullOutcome: review.backtesterFullOutcome || row.outcomes?.FULL_STANDARD?.outcome || null,
      manualVerdict: review.manualVerdict || "NOT_CHECKED",
      notes: review.notes || "",
      reviewTimestamp: review.reviewTimestamp || null
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "half-l2l-manual-review.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportDirectionalAccuracyReviewCsv(artifact = null) {
  const store = loadDirectionalAccuracyReviewStore(artifact);
  const retainedRows = getDirectionalAccuracyRetainedReviewRows(artifact, store);
  const headers = ["record_id", "layer", "entity_code", "entity_label", "evaluation_date", "call_direction", "manual_verdict", "notes", "review_timestamp", "backtester_half_outcome", "backtester_full_outcome"];
  const lines = [
    headers.join(","),
    ...retainedRows.map(({ row, review }) => [
      row.recordId,
      row.layer || "",
      row.entityCode || "",
      row.entityLabel || "",
      row.evaluationDate || "",
      row.callDirection || "",
      review.manualVerdict || "NOT_CHECKED",
      review.notes || "",
      review.reviewTimestamp || "",
      review.backtesterHalfOutcome || row.outcomes?.HALF_OF_STANDARD?.outcome || "",
      review.backtesterFullOutcome || row.outcomes?.FULL_STANDARD?.outcome || ""
    ].map(escapeCsvCell).join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "half-l2l-manual-review.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function applyDirectionalAccuracyFilters(rows = []) {
  const search = String(halfL2lExplorerState.search || "").trim().toLowerCase();
  return rows.filter((row) => {
    const statusKey = row.status === "ELIGIBLE" ? "RESOLVED" : row.status;
    if (halfL2lExplorerState.layer !== "ALL" && row.layer !== halfL2lExplorerState.layer) return false;
    if (halfL2lExplorerState.entity !== "ALL" && row.entityCode !== halfL2lExplorerState.entity) return false;
    if (halfL2lExplorerState.direction !== "ALL" && row.callDirection !== halfL2lExplorerState.direction) return false;
    if (halfL2lExplorerState.halfOutcome !== "ALL" && String(row.outcomes?.HALF_OF_STANDARD?.outcome || "N/A") !== halfL2lExplorerState.halfOutcome) return false;
    if (halfL2lExplorerState.fullOutcome !== "ALL" && String(row.outcomes?.FULL_STANDARD?.outcome || "N/A") !== halfL2lExplorerState.fullOutcome) return false;
    if (halfL2lExplorerState.confidenceBand !== "ALL" && row.strengthBucket !== halfL2lExplorerState.confidenceBand) return false;
    if (halfL2lExplorerState.fold !== "ALL" && row.chronologicalFoldKey !== halfL2lExplorerState.fold) return false;
    if (halfL2lExplorerState.status !== "ALL" && statusKey !== halfL2lExplorerState.status) return false;
    if (halfL2lExplorerState.startDate && String(row.evaluationDate || "") < halfL2lExplorerState.startDate) return false;
    if (halfL2lExplorerState.endDate && String(row.evaluationDate || "") > halfL2lExplorerState.endDate) return false;
    if (!search) return true;
    const haystack = [
      row.recordId,
      row.evaluationDate,
      row.layer,
      row.entityCode,
      row.entityLabel,
      row.callDirection,
      row.strengthBucket,
      row.status,
      row.statusReason,
      row.candleSourceLabel
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(search);
  });
}

function renderDirectionalAccuracyOverviewCard(title, summary = {}, dateRange = {}) {
  const rangeText = dateRange?.earliest && dateRange?.latest ? `${dateRange.earliest} to ${dateRange.latest}` : "Range unavailable";
  return renderBacktestMetric(
    title,
    metricAvailable(summary.hitRatePct) ? `${summary.hits}/${summary.eligibleCalls} (${summary.hitRatePct}%)` : displayDash(),
    metricAvailable(summary.wilson95LowPct) && metricAvailable(summary.wilson95HighPct) ? `95% CI ${summary.wilson95LowPct}-${summary.wilson95HighPct}%` : "95% CI unavailable",
    `Unresolved ${summary.unresolvedRows ?? 0} | Excluded ${summary.exclusions ?? 0} | Coverage ${summary.dataCoveragePct ?? displayDash()}% | ${rangeText}`
  );
}

function renderDirectionalAccuracyHistoryTable(rows = []) {
  const filteredRows = applyDirectionalAccuracyFilters(rows);
  const entities = uniqueStrings(rows.map(row => row.entityCode)).sort();
  const folds = uniqueStrings(rows.map(row => row.chronologicalFoldKey)).sort();
  const directions = uniqueStrings(rows.map(row => row.callDirection)).sort();
  const bands = uniqueStrings(rows.map(row => row.strengthBucket)).sort();

  return `
    <section class="research-section" data-half-l2l-history="true">
      <div class="research-section-head">
        <div>
          <h3>Historical Record Explorer</h3>
        </div>
        <p class="research-panel-copy">Complete canonical history. Resolved, unresolved, and excluded rows stay visible rather than being silently converted into misses.</p>
      </div>
      <article class="detail-panel wide-panel research-secondary-panel">
        <div class="architecture-filter-row">
          <input type="search" data-half-l2l-filter="search" placeholder="Search record, date, asset, direction" value="${escapeHtml(halfL2lExplorerState.search || "")}">
          <select data-half-l2l-filter="layer"><option value="ALL">All layers</option><option value="LAYER_1"${halfL2lExplorerState.layer === "LAYER_1" ? " selected" : ""}>Layer 1</option><option value="LAYER_2"${halfL2lExplorerState.layer === "LAYER_2" ? " selected" : ""}>Layer 2</option></select>
          <select data-half-l2l-filter="entity"><option value="ALL">All assets/pairs</option>${entities.map(value => `<option value="${escapeHtml(value)}"${halfL2lExplorerState.entity === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select>
          <select data-half-l2l-filter="direction"><option value="ALL">All directions</option>${directions.map(value => `<option value="${escapeHtml(value)}"${halfL2lExplorerState.direction === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select>
          <select data-half-l2l-filter="halfOutcome"><option value="ALL">All half outcomes</option>${["HIT", "MISS", "N/A"].map(value => `<option value="${escapeHtml(value)}"${halfL2lExplorerState.halfOutcome === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select>
          <select data-half-l2l-filter="fullOutcome"><option value="ALL">All full outcomes</option>${["HIT", "MISS", "N/A"].map(value => `<option value="${escapeHtml(value)}"${halfL2lExplorerState.fullOutcome === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select>
          <select data-half-l2l-filter="confidenceBand"><option value="ALL">All confidence bands</option>${bands.map(value => `<option value="${escapeHtml(value)}"${halfL2lExplorerState.confidenceBand === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select>
          <select data-half-l2l-filter="fold"><option value="ALL">All folds</option>${folds.map(value => `<option value="${escapeHtml(value)}"${halfL2lExplorerState.fold === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select>
          <select data-half-l2l-filter="status"><option value="ALL">All statuses</option><option value="RESOLVED"${halfL2lExplorerState.status === "RESOLVED" ? " selected" : ""}>Resolved</option><option value="UNRESOLVED_MISSING_DATA"${halfL2lExplorerState.status === "UNRESOLVED_MISSING_DATA" ? " selected" : ""}>Unresolved</option><option value="EXCLUDED"${halfL2lExplorerState.status === "EXCLUDED" ? " selected" : ""}>Excluded</option></select>
          <input type="date" data-half-l2l-filter="startDate" value="${escapeHtml(halfL2lExplorerState.startDate || "")}">
          <input type="date" data-half-l2l-filter="endDate" value="${escapeHtml(halfL2lExplorerState.endDate || "")}">
        </div>
        <p class="research-panel-copy">Showing ${filteredRows.length} of ${rows.length} rows.</p>
        <div class="research-table-scroll">
          <table class="dashboard-table research-evidence-table">
            <thead>
              <tr>
                <th>Record</th>
                <th>Call</th>
                <th>Distances</th>
                <th>Window</th>
                <th>Half L2L</th>
                <th>Full L2L</th>
                <th>Evidence</th>
                <th>Source / Reason</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRows.map(row => `
                <tr>
                  <td>${researchDataCell(row.recordId || displayDash(), `${row.layer} | ${row.evaluationDate || displayDash()} | ${row.entityLabel || row.entityCode || displayDash()}`)}</td>
                  <td>${researchDataCell(row.callDirection || displayDash(), `${metricAvailable(row.confidencePct) ? `${row.confidencePct}%` : displayDash()} | ${row.strengthBucket || displayDash()} | ${row.chronologicalFoldKey || "No fold"}`)}</td>
                  <td>${researchDataCell(metricAvailable(row.halfL2lDistance) ? row.halfL2lDistance : displayDash(), `Full ${metricAvailable(row.currentStandardL2lDistance) ? row.currentStandardL2lDistance : displayDash()} | ADR20 ${metricAvailable(row.adr20) ? row.adr20 : displayDash()}`)}</td>
                  <td>${researchDataCell(row.evaluationStartTime || displayDash(), row.evaluationEndTime || "Window unavailable")}</td>
                  <td>${researchDataCell(
                    row.outcomes?.HALF_OF_STANDARD?.outcome || "N/A",
                    row.outcomes?.HALF_OF_STANDARD?.outcome === "HIT"
                      ? (row.outcomes?.HALF_OF_STANDARD?.confirmingTime || row.outcomes?.HALF_OF_STANDARD?.triggerCandleTime || "Completion time unavailable")
                      : "No qualifying confirming point"
                  )}</td>
                  <td>${researchDataCell(
                    row.outcomes?.FULL_STANDARD?.outcome || "N/A",
                    row.outcomes?.FULL_STANDARD?.outcome === "HIT"
                      ? (row.outcomes?.FULL_STANDARD?.confirmingTime || row.outcomes?.FULL_STANDARD?.triggerCandleTime || "Completion time unavailable")
                      : "No qualifying confirming point"
                  )}</td>
                  <td>${researchDataCell(
                    `${row.outcomes?.HALF_OF_STANDARD?.initiatingPrice ?? row.outcomes?.FULL_STANDARD?.initiatingPrice ?? displayDash()} @ ${row.outcomes?.HALF_OF_STANDARD?.initiatingTime || row.outcomes?.FULL_STANDARD?.initiatingTime || displayDash()}`,
                    ((row.outcomes?.HALF_OF_STANDARD?.outcome === "HIT" || row.outcomes?.FULL_STANDARD?.outcome === "HIT")
                      ? `Confirm ${row.outcomes?.HALF_OF_STANDARD?.confirmingPrice ?? row.outcomes?.FULL_STANDARD?.confirmingPrice ?? displayDash()} @ ${row.outcomes?.HALF_OF_STANDARD?.confirmingTime || row.outcomes?.FULL_STANDARD?.confirmingTime || displayDash()}`
                      : "No qualifying confirming point")
                    + ` | Max fav ${row.outcomes?.FULL_STANDARD?.maxFavourableDistance ?? row.outcomes?.HALF_OF_STANDARD?.maxFavourableDistance ?? displayDash()}`
                  )}</td>
                  <td>${researchDataCell([row.sourceVendor, row.candleSourceLabel].filter(Boolean).join(" | ") || displayDash(), row.status === "ELIGIBLE" ? (row.instrumentSymbol || "") : (row.statusReason || row.status || displayDash()))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}

function renderDirectionalAccuracyManualVerification(data = {}) {
  const artifact = getDirectionalAccuracyArtifact(data);
  const sampleRows = getDirectionalAccuracyManualSampleRows(artifact);
  const manualGroups = getDirectionalAccuracyManualGroups(artifact);
  const reviewStore = loadDirectionalAccuracyReviewStore(artifact);
  const reviews = reviewStore.reviews || {};
  const reviewed = sampleRows.filter(row => (reviews[row.recordId]?.manualVerdict || "NOT_CHECKED") !== "NOT_CHECKED");
  const matches = reviewed.filter(row => reviews[row.recordId]?.manualVerdict === "MATCHES").length;
  const mismatches = reviewed.filter(row => reviews[row.recordId]?.manualVerdict === "DOES_NOT_MATCH").length;
  const agreementPct = reviewed.length ? `${((matches / reviewed.length) * 100).toFixed(1)}%` : displayDash();

  return `
    <section class="research-section" data-half-l2l-manual="true">
      <div class="research-section-head">
        <div>
          <h3>Manual Backtester Verification</h3>
        </div>
        <p class="research-panel-copy">Manual verification is stored in this browser unless exported.</p>
      </div>
      <article class="detail-panel wide-panel research-secondary-panel">
        <div class="diagnostic-item">
          1. Open the named market and date on an independent chart. 2. Match the chart timezone and session to the displayed UTC evaluation window. 3. Check the initiating extreme and later confirming extreme in chronological order. 4. Confirm the calculated distance against the displayed ADR20 requirement. 5. Select MATCHES only if the independent chart agrees with the backtester. 6. Select DOES NOT MATCH if the price, timestamp, sequence, session or outcome differs. 7. Record the reason in Notes. 8. Leave uncertain cases NOT CHECKED. Chart-platform candle construction or session differences should be recorded, not automatically treated as a backtester defect.
        </div>
        <div class="workflow-step-grid">
          <div class="workflow-step"><span>Reviewed</span><strong id="halfL2lReviewedCount">${reviewed.length}</strong></div>
          <div class="workflow-step"><span>Remaining</span><strong id="halfL2lRemainingCount">${sampleRows.length - reviewed.length}</strong></div>
          <div class="workflow-step success"><span>Matches</span><strong id="halfL2lMatchesCount">${matches}</strong></div>
          <div class="workflow-step failed"><span>Mismatches</span><strong id="halfL2lMismatchesCount">${mismatches}</strong></div>
          <div class="workflow-step"><span>Agreement</span><strong id="halfL2lAgreementPct">${agreementPct}</strong></div>
        </div>
        ${reviewStore.staleArtifactSignature ? `<div class="diagnostic-item">Saved reviews were created against a different artifact signature. Re-check before relying on them.</div>` : ""}
        <div class="architecture-filter-row">
          <button type="button" data-half-l2l-export-json="true">Export Review JSON</button>
          <button type="button" data-half-l2l-export-csv="true">Export Review CSV</button>
          <button type="button" data-half-l2l-import-json="true">Import Review JSON</button>
          <button type="button" data-half-l2l-reset-review="true">Reset Review</button>
          <input id="${halfL2lReviewImportInputId}" type="file" accept=".json,application/json" hidden>
        </div>
        <div class="diagnostic-item">Current sample: ${sampleRows.length} retained records. Exports include only the current 32-row verification sample even if older local review entries still exist for retired sample rows.</div>
        <div class="diagnostic-item" data-half-l2l-selection-rule="true">Selection rule: MISS/HIT is impossible because any full-target hit necessarily implies the half target was hit first. Non-EUR groups retain the oldest eligible HIT/HIT, HIT/MISS, and MISS/MISS examples from the prior eight-row sample, plus the oldest remaining row. EUR retains the four authoritative previously reviewed stable IDs.</div>
        ${manualGroups.map((group) => {
          const groupReviewed = group.sampleRows.filter((row) => (reviews[row.recordId]?.manualVerdict || "NOT_CHECKED") !== "NOT_CHECKED").length;
          return `
            <section class="research-section" data-half-l2l-manual-group="${escapeHtml(group.entityCode)}">
              <div class="research-section-head">
                <div>
                  <h4 data-half-l2l-manual-group-heading="${escapeHtml(group.entityCode)}">${escapeHtml(group.entityLabel || group.entityCode)} - ${groupReviewed} of ${group.sampleRows.length} reviewed</h4>
                </div>
                <p class="research-panel-copy">${escapeHtml(group.layerLabel || (group.layer === "LAYER_1" ? "Layer 1" : "Layer 2"))} manual verification group in deterministic call-date order.</p>
              </div>
              <div class="research-table-scroll">
                <table class="dashboard-table research-evidence-table">
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th>Backtester</th>
                      <th>Evidence</th>
                      <th>Manual review</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${group.sampleRows.map((row) => {
                      const review = reviews[row.recordId] || {};
                      const verdict = review.manualVerdict || "NOT_CHECKED";
                      return `
                        <tr data-half-l2l-sample-row="${escapeHtml(row.recordId)}">
                          <td>${researchDataCell(row.recordId || displayDash(), `${row.layer} | ${row.entityLabel || row.entityCode} | ${row.evaluationDate || displayDash()} | ${row.callDirection || displayDash()} | ${metricAvailable(row.confidencePct) ? `${row.confidencePct}%` : displayDash()} | ${row.strengthBucket || displayDash()}`)}</td>
                          <td>${researchDataCell(`Half ${row.outcomes?.HALF_OF_STANDARD?.outcome || "N/A"} | Full ${row.outcomes?.FULL_STANDARD?.outcome || "N/A"}`, `ADR20 ${row.adr20 ?? displayDash()} | Half ${row.halfL2lDistance ?? displayDash()} | Full ${row.currentStandardL2lDistance ?? displayDash()} | ${row.evaluationStartTime || displayDash()} to ${row.evaluationEndTime || displayDash()} UTC`)}</td>
                          <td>${researchDataCell(
                            `Init ${row.outcomes?.HALF_OF_STANDARD?.initiatingPrice ?? row.outcomes?.FULL_STANDARD?.initiatingPrice ?? displayDash()} @ ${row.outcomes?.HALF_OF_STANDARD?.initiatingTime || row.outcomes?.FULL_STANDARD?.initiatingTime || displayDash()}`,
                            ((row.outcomes?.HALF_OF_STANDARD?.outcome === "HIT" || row.outcomes?.FULL_STANDARD?.outcome === "HIT")
                              ? `Confirm ${row.outcomes?.HALF_OF_STANDARD?.confirmingPrice ?? row.outcomes?.FULL_STANDARD?.confirmingPrice ?? displayDash()} @ ${row.outcomes?.HALF_OF_STANDARD?.confirmingTime || row.outcomes?.FULL_STANDARD?.confirmingTime || displayDash()}`
                              : "No qualifying confirming point")
                            + ` | Max fav ${row.outcomes?.FULL_STANDARD?.maxFavourableDistance ?? row.outcomes?.HALF_OF_STANDARD?.maxFavourableDistance ?? displayDash()} | ${row.candleSourceLabel || displayDash()}`
                          )}</td>
                          <td>
                            <div class="research-cell">
                              <label><input type="radio" name="half-l2l-review-${escapeHtml(row.recordId)}" value="MATCHES" data-half-l2l-verdict="${escapeHtml(row.recordId)}"${verdict === "MATCHES" ? " checked" : ""}> MATCHES</label>
                              <label><input type="radio" name="half-l2l-review-${escapeHtml(row.recordId)}" value="DOES_NOT_MATCH" data-half-l2l-verdict="${escapeHtml(row.recordId)}"${verdict === "DOES_NOT_MATCH" ? " checked" : ""}> DOES NOT MATCH</label>
                              <label><input type="radio" name="half-l2l-review-${escapeHtml(row.recordId)}" value="NOT_CHECKED" data-half-l2l-verdict="${escapeHtml(row.recordId)}"${verdict === "NOT_CHECKED" ? " checked" : ""}> NOT CHECKED</label>
                              <textarea data-half-l2l-notes="${escapeHtml(row.recordId)}" rows="3" placeholder="Optional notes">${escapeHtml(review.notes || "")}</textarea>
                              <small>Last checked: ${escapeHtml(review.reviewTimestamp || "Not yet checked")}</small>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>
              </div>
            </section>
          `;
        }).join("")}
      </article>
    </section>
  `;
}

function renderResearchL2lDirectionalAccuracy(data = {}) {
  const artifact = getDirectionalAccuracyArtifact(data);
  const comparisons = artifact?.comparisons || {};
  const sourceAuditRows = Array.isArray(artifact?.source_audit) ? artifact.source_audit : [];
  const allRows = getDirectionalAccuracyRows(data);
  const layer1AssetRows = Array.isArray(comparisons.layer1_assets) ? comparisons.layer1_assets : [];
  const layer2PairRows = Array.isArray(comparisons.layer2_pairs) ? comparisons.layer2_pairs : [];
  const layer1DirectionRows = Array.isArray(comparisons.layer1_directions) ? comparisons.layer1_directions : [];
  const layer2DirectionRows = Array.isArray(comparisons.layer2_directions) ? comparisons.layer2_directions : [];
  const layer1StrengthRows = Array.isArray(comparisons.layer1_strength_bands) ? comparisons.layer1_strength_bands : [];
  const layer2StrengthRows = Array.isArray(comparisons.layer2_strength_bands) ? comparisons.layer2_strength_bands : [];
  const layer1ExactRows = (Array.isArray(comparisons.layer1_exact_confidence_buckets) ? comparisons.layer1_exact_confidence_buckets : []).filter(row => Number(row?.fullStandard?.eligibleCalls || 0) >= 20);
  const layer2ExactRows = (Array.isArray(comparisons.layer2_exact_confidence_buckets) ? comparisons.layer2_exact_confidence_buckets : []).filter(row => Number(row?.fullStandard?.eligibleCalls || 0) >= 20);
  const layer1YearRows = Array.isArray(comparisons.layer1_years) ? comparisons.layer1_years : [];
  const layer2YearRows = Array.isArray(comparisons.layer2_years) ? comparisons.layer2_years : [];
  const layer1MonthRows = Array.isArray(comparisons.layer1_months) ? comparisons.layer1_months : [];
  const layer2MonthRows = Array.isArray(comparisons.layer2_months) ? comparisons.layer2_months : [];
  const layer1FoldRows = Array.isArray(comparisons.layer1_chronological_folds) ? comparisons.layer1_chronological_folds : [];
  const layer2FoldRows = Array.isArray(comparisons.layer2_chronological_folds) ? comparisons.layer2_chronological_folds : [];
  const latestLayer1Rows = Array.isArray(comparisons.layer1_latest_period) ? comparisons.layer1_latest_period : [];
  const latestLayer2Rows = Array.isArray(comparisons.layer2_latest_period) ? comparisons.layer2_latest_period : [];
  const monotonicityRows = Array.isArray(artifact?.monotonicity) ? artifact.monotonicity : [];

  if (!artifact || (!layer1AssetRows.length && !layer2PairRows.length)) {
    return `
      <div class="backtest-report">
        <article class="detail-panel wide-panel research-secondary-panel">
          <h3>L2L Directional Accuracy unavailable</h3>
          <div class="empty-state matrix-evidence-empty">The downstream L2L Directional Accuracy artifact could not be loaded.</div>
        </article>
      </div>
    `;
  }

  return `
    <div class="backtest-report">
      ${renderResearchStatusHeader(data)}
      <section class="detail-panel overview-briefing-panel adr-howto-panel" data-half-l2l-summary="true">
        <div class="overview-briefing-shell adr-howto-shell">
          <div class="overview-briefing-copy">
            <div class="panel-head compact-panel-head adr-howto-head">
              <div>
                <p class="eyebrow">Research Only</p>
                <h3>L2L Directional Accuracy</h3>
              </div>
              <span class="adr-howto-icon" aria-hidden="true">L2L</span>
            </div>
            <section class="overview-briefing-block">
              <h3>Definition</h3>
              <p>Did the trading day provide a chronological opportunity to cover the required distance in the direction of the morning call? This view tests exactly <code>0.25 x ADR20</code> and <code>0.50 x ADR20</code>.</p>
            </section>
            <section class="overview-briefing-block">
              <h3>Warnings</h3>
              <p>Research only - not a live trading signal. Accuracy here means that the required chronological directional opportunity occurred during the evaluated session. It does not mean a trade entered at an arbitrary price would have made a profit.</p>
            </section>
            <section class="overview-briefing-block">
              <h3>Timing contract</h3>
              <p>The established contract is date-based and UTC-keyed. Each row maps to the source 1H session attached to <code>evaluation_inputs.close_date</code>. Exact session start and end timestamps are shown in the explorer and manual sample below. Because exact morning publication times are unavailable, some source sessions may include pre-call candles.</p>
            </section>
          </div>
          <aside class="overview-briefing-chips adr-howto-comparison" aria-label="L2L directional accuracy contract">
            <div class="overview-briefing-chip adr-howto-compare-card">
              <span>Current contract</span>
              <div class="adr-howto-compare-block">
                <strong>Half L2L</strong>
                <small>${escapeHtml(artifact?.meta?.half_target_definition || "ADR20 x 0.25")}</small>
              </div>
              <div class="adr-howto-compare-block">
                <strong>Full / current L2L</strong>
                <small>${escapeHtml(artifact?.meta?.current_standard_definition || "ADR20 x 0.50")}</small>
              </div>
              <div class="adr-howto-compare-block">
                <strong>Exact evaluated dates</strong>
                <small>Layer 1 ${escapeHtml(artifact?.meta?.evaluated_date_ranges?.layer1?.earliest || displayDash())} to ${escapeHtml(artifact?.meta?.evaluated_date_ranges?.layer1?.latest || displayDash())} | Layer 2 ${escapeHtml(artifact?.meta?.evaluated_date_ranges?.layer2?.earliest || displayDash())} to ${escapeHtml(artifact?.meta?.evaluated_date_ranges?.layer2?.latest || displayDash())}</small>
              </div>
            </div>
          </aside>
        </div>
      </section>
      <section class="backtest-metric-grid research-progress-grid">
        ${renderDirectionalAccuracyOverviewCard("Layer 1 Half L2L", comparisons.overall?.layer1?.halfOfStandard, artifact?.meta?.evaluated_date_ranges?.layer1)}
        ${renderDirectionalAccuracyOverviewCard("Layer 1 Full L2L", comparisons.overall?.layer1?.fullStandard, artifact?.meta?.evaluated_date_ranges?.layer1)}
        ${renderDirectionalAccuracyOverviewCard("Layer 2 Half L2L", comparisons.overall?.layer2?.halfOfStandard, artifact?.meta?.evaluated_date_ranges?.layer2)}
        ${renderDirectionalAccuracyOverviewCard("Layer 2 Full L2L", comparisons.overall?.layer2?.fullStandard, artifact?.meta?.evaluated_date_ranges?.layer2)}
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>Overall Comparison</h3>
          </div>
          <p class="research-panel-copy">Half and full directional-opportunity rates with hits, eligible calls, Wilson 95% confidence intervals, unresolved counts, excluded counts, exact date ranges, and coverage percentages.</p>
        </div>
        ${renderHalfL2lComparisonTable("Layer totals", "Research summary", [comparisons.overall?.layer1 || {}, comparisons.overall?.layer2 || {}], {
          entityLabel: "Layer",
          entityRenderer: row => row.label || row.layer || displayDash()
        })}
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>Source Contract</h3>
          </div>
          <p class="research-panel-copy">The same repo-local OANDA and Binance caches used by the existing L2L 1H Sequence Research are reused here. Unsupported USD/DXY remains unavailable.</p>
        </div>
        ${renderResearchBreakdownTable("Source audit", "Coverage", sourceAuditRows, [
          { label: "Asset", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.assetLabel || displayDash(), row.instrument || "", { className: "adr-table-tight-cell" }) },
          { label: "Status", className: "adr-col-status", render: row => renderAdrCompactTextCell(row.available ? "Available" : "Unavailable", "", { className: "adr-table-tight-cell" }) },
          { label: "Coverage", className: "adr-col-source", render: row => renderAdrCompactTextCell(row.sourceCoverage?.intraday?.startDate || displayDash(), row.sourceCoverage?.intraday?.endDate ? `1H to ${row.sourceCoverage.intraday.endDate}` : (row.blocker || ""), { className: "adr-table-tight-cell" }) },
          { label: "Hashes", className: "adr-col-reference", render: row => renderAdrCompactTextCell(row.dailySourceHash?.sha256 ? row.dailySourceHash.sha256.slice(0, 12) : displayDash(), row.intradaySourceHash?.sha256 ? row.intradaySourceHash.sha256.slice(0, 12) : "", { className: "adr-table-tight-cell" }) }
        ], {
          tableClass: "adr-summary-table adr-audit-table",
          scrollClass: "adr-summary-scroll"
        })}
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>By Asset, Pair, Direction, And Confidence</h3>
          </div>
          <p class="research-panel-copy">Half versus full L2L by asset/pair, bullish or bearish direction, confidence band, exact confidence bucket, year, and month.</p>
        </div>
        ${renderHalfL2lComparisonTable("Layer 1 by asset", "Asset results", layer1AssetRows, { entityLabel: "Asset", entityRenderer: row => row.assetLabel || displayDash() })}
        ${renderHalfL2lComparisonTable("Layer 2 by pair", "Pair results", layer2PairRows, { entityLabel: "Pair", entityRenderer: row => row.pairLabel || displayDash() })}
        ${renderHalfL2lComparisonTable("Layer 1 by direction", "Direction split", layer1DirectionRows, { entityLabel: "Direction", entityRenderer: row => row.assetLabel || displayDash(), entitySecondaryRenderer: row => row.callDirection || "" })}
        ${renderHalfL2lComparisonTable("Layer 2 by direction", "Direction split", layer2DirectionRows, { entityLabel: "Direction", entityRenderer: row => row.pairLabel || displayDash(), entitySecondaryRenderer: row => row.callDirection || "" })}
        ${renderHalfL2lComparisonTable("Layer 1 by strength", "Confidence bands", layer1StrengthRows, { entityLabel: "Band", entityRenderer: row => row.assetLabel || displayDash(), entitySecondaryRenderer: row => row.strengthBucket || "" })}
        ${renderHalfL2lComparisonTable("Layer 2 by strength", "Confidence bands", layer2StrengthRows, { entityLabel: "Band", entityRenderer: row => row.pairLabel || displayDash(), entitySecondaryRenderer: row => row.strengthBucket || "" })}
        ${renderHalfL2lComparisonTable("Layer 1 exact confidence buckets", "Sample size >= 20", layer1ExactRows, { entityLabel: "Bucket", entityRenderer: row => row.assetLabel || displayDash(), entitySecondaryRenderer: row => row.exactConfidenceBucketLabel || "" })}
        ${renderHalfL2lComparisonTable("Layer 2 exact confidence buckets", "Sample size >= 20", layer2ExactRows, { entityLabel: "Bucket", entityRenderer: row => row.pairLabel || displayDash(), entitySecondaryRenderer: row => row.exactConfidenceBucketLabel || "" })}
        ${renderHalfL2lComparisonTable("Layer 1 by year", "Calendar year", layer1YearRows, { entityLabel: "Year", entityRenderer: row => row.assetLabel || displayDash(), entitySecondaryRenderer: row => row.evaluationYear || "" })}
        ${renderHalfL2lComparisonTable("Layer 2 by year", "Calendar year", layer2YearRows, { entityLabel: "Year", entityRenderer: row => row.pairLabel || displayDash(), entitySecondaryRenderer: row => row.evaluationYear || "" })}
        ${renderHalfL2lComparisonTable("Layer 1 by month", "Calendar month", layer1MonthRows, { entityLabel: "Month", entityRenderer: row => row.assetLabel || displayDash(), entitySecondaryRenderer: row => row.evaluationMonth || "" })}
        ${renderHalfL2lComparisonTable("Layer 2 by month", "Calendar month", layer2MonthRows, { entityLabel: "Month", entityRenderer: row => row.pairLabel || displayDash(), entitySecondaryRenderer: row => row.evaluationMonth || "" })}
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>Chronological Stability</h3>
          </div>
          <p class="research-panel-copy">Rows are split into chronological folds by entity, and the latest untouched fold is shown separately so a strong point estimate cannot hide a weak most-recent period.</p>
        </div>
        ${renderHalfL2lComparisonTable("Layer 1 chronological folds", "Fold stability", layer1FoldRows, { entityLabel: "Fold", entityRenderer: row => row.assetLabel || displayDash(), entitySecondaryRenderer: row => `${row.foldKey || ""} | ${row.foldStartDate || ""} to ${row.foldEndDate || ""}` })}
        ${renderHalfL2lComparisonTable("Layer 2 chronological folds", "Fold stability", layer2FoldRows, { entityLabel: "Fold", entityRenderer: row => row.pairLabel || displayDash(), entitySecondaryRenderer: row => `${row.foldKey || ""} | ${row.foldStartDate || ""} to ${row.foldEndDate || ""}` })}
        ${renderHalfL2lComparisonTable("Latest untouched chronological period", "Most recent fold only", [...latestLayer1Rows, ...latestLayer2Rows], { entityLabel: "Latest", entityRenderer: row => row.assetLabel || row.pairLabel || displayDash(), entitySecondaryRenderer: row => `${row.foldKey || ""} | ${row.foldStartDate || ""} to ${row.foldEndDate || ""}` })}
      </section>
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>Confidence Monotonicity</h3>
          </div>
          <p class="research-panel-copy">Higher displayed confidence is tested against the half-target reach rate only.</p>
        </div>
        ${renderResearchBreakdownTable("Half-target monotonicity", "Half target only", monotonicityRows, [
          { label: "Layer", className: "adr-col-entity", render: row => renderAdrCompactTextCell(row.layerLabel || displayDash(), row.monotonicNonDecreasing ? "Non-decreasing" : "Violations found", { className: "adr-table-tight-cell" }) },
          { label: "Checked buckets", className: "adr-col-metric", render: row => renderAdrCompactTextCell(row.checkedBuckets?.length ?? 0, `${row.minimumSampleForCheck ?? 0}+ sample`, { className: "adr-table-tight-cell" }) },
          { label: "Result", className: "adr-col-status", render: row => renderAdrCompactTextCell(row.monotonicNonDecreasing ? "Pass" : "Fail", row.violations?.length ? `${row.violations.length} reversal(s)` : "", { className: "adr-table-tight-cell" }) },
          { label: "Buckets", className: "adr-col-source", render: row => renderAdrCompactTextCell((row.checkedBuckets || []).map(bucket => `${bucket.bucketKey}:${metricAvailable(bucket.hitRatePct) ? `${bucket.hitRatePct}%` : "-"}`).join(" | ") || displayDash(), "", { className: "adr-table-tight-cell" }) }
        ], {
          tableClass: "adr-summary-table adr-audit-table",
          scrollClass: "adr-summary-scroll"
        })}
      </section>
      ${renderDirectionalAccuracyHistoryTable(allRows)}
      ${renderDirectionalAccuracyManualVerification(data)}
    </div>
  `;
}

function renderResearchAdrThresholdSensitivity(data = {}) {
  const adrReach = data.adr_reach || null;
  const layer1Sensitivity = adrReach?.layer1?.threshold_sensitivity || {};
  const layer2Sensitivity = adrReach?.layer2?.threshold_sensitivity || {};
  const aggregateTrustSummaryRows = buildAdrTrustSummaryRows(adrReach, "0.55");
  const layer1TrustByAssetRows = buildAssetPairAdrTrustSummaryRows(Array.isArray(adrReach?.layer1?.threshold_sensitivity_by_asset) ? adrReach.layer1.threshold_sensitivity_by_asset : [], {
    layerLabel: "Layer 1",
    entityKeyField: "assetCode",
    entityLabelField: "assetLabel",
    thresholdKey: "0.55"
  });
  const layer2TrustByPairRows = buildAssetPairAdrTrustSummaryRows(Array.isArray(adrReach?.layer2?.threshold_sensitivity_by_pair) ? adrReach.layer2.threshold_sensitivity_by_pair : [], {
    layerLabel: "Layer 2",
    entityKeyField: "pairCode",
    entityLabelField: "pairLabel",
    thresholdKey: "0.55"
  });

  return `
    <div class="backtest-report">
      ${renderResearchStatusHeader(data)}
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>55% ADR20 L2L Trust Summary — Can We Use This Signal?</h3>
          </div>
          <p class="research-panel-copy">✅ Can Use means this signal group has a 60%+ historical L2L opportunity rate at the 55% ADR20 threshold. ❌ Do Not Use means it is currently below the 60% trust cut-off.</p>
        </div>
      </section>
      ${renderL2lAssetPairTrustTable("Layer 1 55% ADR20 Trust By Asset", layer1TrustByAssetRows, {
        subtitle: "Asset-Specific Trust",
        entityColumnLabel: "Asset",
        tableClass: "directional-trust-table adr-trust-summary-table",
        description: "At present, signal strength is not consistently reliable for this type of directional L2L confluence. The table should be read by actual historical opportunity rate, not by assuming higher strength always means better performance."
      })}
      ${renderL2lAssetPairTrustTable("Layer 2 55% ADR20 Trust By Pair", layer2TrustByPairRows, {
        subtitle: "Pair-Specific Trust",
        entityColumnLabel: "Pair",
        tableClass: "directional-trust-table adr-trust-summary-table",
        description: "L2L Tradable means this asset/pair + call type + strength bucket has historically produced a 60%+ L2L opportunity rate at the 55% ADR20 threshold."
      })}
      ${renderDirectionalTrustSummaryTable("All Assets Aggregate / All Pairs Aggregate", aggregateTrustSummaryRows, {
        subtitle: "Aggregate Trust",
        rateLabel: "55% ADR20 Opportunity Rate",
        includeOutcomeColumns: false,
        tableClass: "directional-trust-table adr-trust-summary-table",
        description: "Aggregate rows are directional-family rollups across all supported assets and pairs. Use the asset-specific and pair-specific tables above for actual tradeability decisions."
      })}
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <h3>L2L Threshold Sensitivity</h3>
          </div>
          <p class="research-panel-copy">This sensitivity table tests the same L2L 1H Sequence Research engine using different required move thresholds. The production baseline is 50% ADR20. The goal is to see how far the directional edge persists as the required move increases.</p>
        </div>
      </section>
      ${renderAdrThresholdSensitivityTable("Layer 1 Sensitivity", layer1Sensitivity, {
        description: "Layer 1 sensitivity uses the same historical sequence engine and separates combined, clean, and lean directional call families across the configured ADR20 thresholds."
      })}
      ${renderAdrThresholdSensitivityTable("Layer 2 Sensitivity", layer2Sensitivity, {
        description: "Layer 2 sensitivity remains downstream-only. It requires opposite directional target/USD sides and reports how opportunity rates change as the required move threshold increases."
      })}
      <article class="detail-panel overview-briefing-panel adr-threshold-conclusion-panel">
        <div class="panel-head compact-panel-head">
          <div>
            <p class="eyebrow">Sensitivity Conclusion</p>
            <h3>Production Threshold Read</h3>
          </div>
        </div>
        <div class="legend-grid adr-threshold-conclusion-grid">
          <div class="legend-item"><strong>50% ADR20</strong><span>50% ADR20 is the production baseline.</span></div>
          <div class="legend-item"><strong>Through 55%</strong><span>Directional opportunity remains broadly reliable through 55% ADR20.</span></div>
          <div class="legend-item"><strong>At 60%</strong><span>60% ADR20 becomes selective.</span></div>
          <div class="legend-item"><strong>At 65% and 70%</strong><span>65% and 70% are above the current reliable edge.</span></div>
          <div class="legend-item"><strong>Current Support</strong><span>This supports 50% ADR20 as the current production L2L threshold.</span></div>
        </div>
      </article>
    </div>
  `;
}

function formatPairTradeExFlatInline(cell = {}) {
  const summary = summarizeWeekdayBreakdownCell(cell);
  if (!summary.total) return displayDash();
  if (!summary.directionalTotal && summary.flats > 0) return "Flat only";
  return `${percentValue(summary.exFlatWinRatePct)} ex-flat`;
}

function formatPairTradeFlatRateInline(cell = {}) {
  const summary = summarizeWeekdayBreakdownCell(cell);
  if (!summary.total) return displayDash();
  return `${percentValue(summary.flatRatePct)} flat`;
}

function renderPairTradeSummaryCell(primary = "", secondary = "", options = {}) {
  const className = ["research-cell", "pair-summary-cell", options.className || ""].filter(Boolean).join(" ");
  return `
    <div class="${className}">
      <strong>${escapeHtml(metricAvailable(primary) ? String(primary) : displayDash())}</strong>
      ${secondary ? `<span>${escapeHtml(secondary)}</span>` : ""}
    </div>
  `;
}

function renderPairSummaryMetricLine(label = "", value = "") {
  return `
    <div class="pair-summary-metric-line">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(metricAvailable(value) ? String(value) : displayDash())}</strong>
    </div>
  `;
}

function renderWeekdayBreakdownAsset(assetSummary = null) {
  if (!assetSummary) return "";
  const assetLabel = assetSummary.assetCode || "Asset";
  const weekdayHeaders = assetSummary.weekdayKeys.map(weekdayKey => `
    <th>${escapeHtml(weekdayBreakdownLabels[weekdayKey] || weekdayKey)}</th>
  `).join("");
  const dayTotalsCells = assetSummary.weekdayKeys.map(weekdayKey => `
    <td>${escapeHtml(formatWeekdayBreakdownCell(assetSummary.weekdayTotals?.[weekdayKey]))}</td>
  `).join("");
  const bucketRows = weekdayBreakdownBuckets.map(bucket => {
    const cells = assetSummary.weekdayKeys.map(weekdayKey => `
      <td>${escapeHtml(formatWeekdayBreakdownCell(assetSummary.bucketMatrix?.[bucket.key]?.[weekdayKey]))}</td>
    `).join("");

    return `
      <tr>
        <th scope="row">${escapeHtml(bucket.label)}</th>
        ${cells}
        <td class="weekday-breakdown-total-cell">${escapeHtml(formatWeekdayBreakdownCell(assetSummary.bucketTotals?.[bucket.key]))}</td>
      </tr>
    `;
  }).join("");

  return `
    <section class="research-section weekday-breakdown-asset-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Weekday Breakdown</p>
          <h3>${escapeHtml(assetLabel)} ${escapeHtml(assetSummary.timeframeLabel)} by confidence bucket and weekday</h3>
        </div>
        <p class="research-panel-copy">Stored displayed headline confidence buckets from the checker artifact. Directional win rate excludes flats, while the count line keeps wins, losses, and non-directional flat/neutral rows visible so every checker row still reconciles cleanly.</p>
      </div>
      <article class="detail-panel wide-panel research-secondary-panel weekday-breakdown-panel" data-weekday-breakdown-asset="${escapeHtml(assetLabel)}">
        <div class="weekday-breakdown-summary-strip">
          <span><strong>Best:</strong> ${escapeHtml(formatWeekdayBreakdownSummaryItem(assetSummary.bestCombination))}</span>
          <span><strong>Worst:</strong> ${escapeHtml(formatWeekdayBreakdownSummaryItem(assetSummary.worstCombination))}</span>
          <span><strong>Total Evaluated Rows:</strong> ${escapeHtml(String(assetSummary.totalRows))}</span>
        </div>
        <div class="weekday-breakdown-summary-strip weekday-breakdown-summary-strip-strong">
          <span><strong>Wins:</strong> ${escapeHtml(String(assetSummary.assetTotals?.wins ?? 0))}</span>
          <span><strong>Losses:</strong> ${escapeHtml(String(assetSummary.assetTotals?.losses ?? 0))}</span>
          <span><strong>Flats:</strong> ${escapeHtml(String(assetSummary.assetTotals?.flats ?? 0))}</span>
          <span><strong>Total Rows:</strong> ${escapeHtml(String(assetSummary.assetTotals?.total ?? 0))}</span>
          <span><strong>Flat Rate:</strong> ${escapeHtml(metricAvailable(assetSummary.assetTotals?.flatRatePct) ? percentValue(assetSummary.assetTotals.flatRatePct) : displayDash())}</span>
          <span><strong>Ex-Flat Win Rate:</strong> ${escapeHtml(metricAvailable(assetSummary.assetTotals?.exFlatWinRatePct) ? `${percentValue(assetSummary.assetTotals.exFlatWinRatePct)} ex-flat` : (assetSummary.assetTotals?.flats ? "Flat only" : displayDash()))}</span>
        </div>
        <div class="research-table-scroll weekday-breakdown-scroll">
          <table class="dashboard-table weekday-breakdown-table weekday-breakdown-totals-table">
            <thead>
              <tr>
                <th>Day Totals</th>
                ${weekdayHeaders}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">All Confidence Buckets</th>
                ${dayTotalsCells}
                <td class="weekday-breakdown-total-cell">${escapeHtml(formatWeekdayBreakdownCell(assetSummary.assetTotals))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="research-table-scroll weekday-breakdown-scroll">
          <table class="dashboard-table weekday-breakdown-table">
            <thead>
              <tr>
                <th>Confidence Bucket</th>
                ${weekdayHeaders}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${bucketRows}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}

function renderResearchWeekdayBreakdown(data = {}) {
  const availableCheckers = orderedAgents
    .map(assetCode => data.checkers?.[assetCode] || null)
    .filter(checker => checker?.summary && Array.isArray(checker?.rows));
  const breakdowns = availableCheckers.map(computeWeekdayBreakdownForChecker);

  if (!breakdowns.length) {
    return `
      <div class="backtest-report">
        <article class="detail-panel wide-panel research-secondary-panel">
          <p class="eyebrow">Weekday Breakdown</p>
          <h3>Weekday breakdown unavailable</h3>
          <div class="empty-state matrix-evidence-empty">No checker artifacts could be loaded for the weekday breakdown tab.</div>
        </article>
      </div>
    `;
  }

  return `
    <div class="backtest-report">
      ${renderResearchStatusHeader(data)}
      <section class="research-section">
        <div class="research-section-head">
        <div>
          <p class="eyebrow">Weekday Breakdown</p>
          <h3>Day-of-week performance by displayed headline confidence</h3>
        </div>
        <p class="research-panel-copy">This view stays downstream of the deterministic checker artifacts. It uses each stored row's displayed headline confidence and evaluation result directly, without recalculating replay confidence or changing checker semantics.</p>
      </div>
      <article class="detail-panel wide-panel research-secondary-panel weekday-breakdown-intro-panel">
          <p class="research-panel-copy">Confidence buckets are fixed to Weak 0-49, Moderate 50-64, Strong 65-79, and Very Strong 80-100. Directional win rate is wins / (wins + losses), excluding flats. USD, EUR, Gold, and NQ stay Monday-Friday only. BTC extends the same table through Saturday and Sunday.</p>
        </article>
      </section>
      ${breakdowns.map(renderWeekdayBreakdownAsset).join("")}
    </div>
  `;
}

function normalizeDirectionalSignalKey(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "BULLISH" || normalized === "BEARISH") return normalized;
  return null;
}

function pairTradeNoTradeReasonLabel(reason = "") {
  const labelsByKey = {
    missing_usd_snapshot: "Missing USD Snapshot",
    unsupported_target_direction: "Target Non-Directional",
    unsupported_usd_direction: "USD Non-Directional",
    missing_combined_confidence: "Missing Combined Confidence",
    unsupported_confidence_bucket: "Unsupported Confidence Bucket",
    same_direction_conflict: "Same-Direction Conflict"
  };
  return labelsByKey[reason] || titleCaseWords(reason);
}

function checkerRowsByDate(checker = null) {
  const rows = Array.isArray(checker?.rows) ? checker.rows : [];
  const byDate = new Map();
  rows.forEach((row) => {
    const dateKey = String(row?.snapshot_date || "").trim();
    if (dateKey && !byDate.has(dateKey)) {
      byDate.set(dateKey, row);
    }
  });
  return byDate;
}

function pairTradeOutcomeKey(row = {}) {
  const result = String(row?.stored?.evaluation_result || row?.checker?.evaluation_result || "").trim().toUpperCase();
  if (result === "CORRECT") return "WIN";
  if (result === "WRONG") return "LOSS";
  return "FLAT";
}

function buildPairTradeResearchForConfig(config = {}, checkers = {}) {
  const targetChecker = checkers?.[config.targetAssetCode] || null;
  const usdChecker = checkers?.USD || null;
  const targetRows = Array.isArray(targetChecker?.rows) ? targetChecker.rows : [];
  const usdRowsByDate = checkerRowsByDate(usdChecker);
  const weekdayKeys = Array.isArray(config.weekdayKeys) ? config.weekdayKeys : weekdayBreakdownColumnsByAsset.USD;
  const bucketMatrix = {};
  const bucketTotals = {};
  const weekdayTotals = {};
  const noTradeReasonCounts = {};
  const tradableRows = [];
  const noTradeRows = [];

  weekdayBreakdownBuckets.forEach(bucket => {
    bucketMatrix[bucket.key] = {};
    bucketTotals[bucket.key] = createWeekdayBreakdownCell();
    weekdayKeys.forEach(weekdayKey => {
      bucketMatrix[bucket.key][weekdayKey] = createWeekdayBreakdownCell();
    });
  });

  weekdayKeys.forEach((weekdayKey) => {
    weekdayTotals[weekdayKey] = createWeekdayBreakdownCell();
  });

  targetRows.forEach((targetRow) => {
    const snapshotDate = String(targetRow?.snapshot_date || "").trim();
    const weekdayKey = snapshotDateToWeekdayKey(snapshotDate);
    const usdRow = usdRowsByDate.get(snapshotDate) || null;
    const targetDirectionKey = normalizeDirectionalSignalKey(targetRow?.stored?.direction || targetRow?.checker?.direction || "");
    const usdDirectionKey = normalizeDirectionalSignalKey(usdRow?.stored?.direction || usdRow?.checker?.direction || "");
    const targetConfidence = checkerRowHeadlineConfidence(targetRow);
    const usdConfidence = checkerRowHeadlineConfidence(usdRow);
    const combinedConfidencePct = metricAvailable(targetConfidence) && metricAvailable(usdConfidence)
      ? Math.min(Number(targetConfidence), Number(usdConfidence))
      : null;
    const combinedBucketKey = weekdayBreakdownBucketKey(combinedConfidencePct);

    let noTradeReason = null;
    if (!usdRow) {
      noTradeReason = "missing_usd_snapshot";
    } else if (!targetDirectionKey) {
      noTradeReason = "unsupported_target_direction";
    } else if (!usdDirectionKey) {
      noTradeReason = "unsupported_usd_direction";
    } else if (!metricAvailable(combinedConfidencePct)) {
      noTradeReason = "missing_combined_confidence";
    } else if (!combinedBucketKey || !bucketMatrix[combinedBucketKey]) {
      noTradeReason = "unsupported_confidence_bucket";
    } else if (targetDirectionKey === usdDirectionKey) {
      noTradeReason = "same_direction_conflict";
    }

    if (noTradeReason) {
      noTradeReasonCounts[noTradeReason] = (noTradeReasonCounts[noTradeReason] || 0) + 1;
      noTradeRows.push({
        snapshotDate,
        weekdayKey,
        reasonKey: noTradeReason,
        reasonLabel: pairTradeNoTradeReasonLabel(noTradeReason)
      });
      return;
    }

    const pairBias = targetDirectionKey === "BULLISH" && usdDirectionKey === "BEARISH"
      ? "PAIR_BULLISH"
      : "PAIR_BEARISH";
    const outcomeKey = pairTradeOutcomeKey(targetRow);
    const cell = bucketMatrix[combinedBucketKey][weekdayKey] || null;
    const bucketTotal = bucketTotals[combinedBucketKey] || null;
    const weekdayTotal = weekdayTotals[weekdayKey] || null;

    [cell, bucketTotal, weekdayTotal].forEach((target) => {
      if (!target) return;
      target.total += 1;
      if (outcomeKey === "WIN") {
        target.wins += 1;
      } else if (outcomeKey === "LOSS") {
        target.losses += 1;
      } else {
        target.flats += 1;
      }
    });

    tradableRows.push({
      snapshotDate,
      weekdayKey,
      pairBias,
      combinedConfidencePct,
      combinedBucketKey,
      outcomeKey,
      targetDirectionKey,
      usdDirectionKey
    });
  });

  const assetTotals = summarizeWeekdayBreakdownCell(
    weekdayKeys.reduce((aggregate, weekdayKey) => {
      const weekdayTotal = weekdayTotals[weekdayKey];
      aggregate.total += weekdayTotal.total || 0;
      aggregate.wins += weekdayTotal.wins || 0;
      aggregate.losses += weekdayTotal.losses || 0;
      aggregate.flats += weekdayTotal.flats || 0;
      return aggregate;
    }, createWeekdayBreakdownCell())
  );

  const bucketSummaryRows = weekdayBreakdownBuckets.map(bucket => {
    const totals = summarizeWeekdayBreakdownCell(bucketTotals[bucket.key]);
    return {
      bucketKey: bucket.key,
      bucketLabel: bucket.label,
      combinedConfidenceBand: `${bucket.min}-${bucket.max}`,
      ...totals
    };
  });

  const conflictSummaryRows = Object.entries(noTradeReasonCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([reasonKey, count]) => ({
      reasonKey,
      reasonLabel: pairTradeNoTradeReasonLabel(reasonKey),
      count,
      sharePct: targetRows.length ? roundTo((count / targetRows.length) * 100, 1) : null
    }));

  const strongPlusTotals = rollupWeekdayBreakdownCells([
    bucketTotals.STRONG,
    bucketTotals.VERY_STRONG
  ]);
  const matchedHistoricalDays = targetRows.length - (noTradeReasonCounts.missing_usd_snapshot || 0);
  const layer2Summary = {
    pairedRows: targetRows.length,
    matchedHistoricalDays,
    tradableSignals: tradableRows.length,
    coveragePct: targetRows.length ? roundTo((tradableRows.length / targetRows.length) * 100, 1) : null,
    tradeDaysPct: matchedHistoricalDays ? roundTo((tradableRows.length / matchedHistoricalDays) * 100, 1) : null,
    allSignalTotals: assetTotals,
    strongPlusSignals: strongPlusTotals.total,
    strongPlusCoveragePct: targetRows.length ? roundTo((strongPlusTotals.total / targetRows.length) * 100, 1) : null,
    strongPlusTradeDaysPct: matchedHistoricalDays ? roundTo((strongPlusTotals.total / matchedHistoricalDays) * 100, 1) : null,
    strongPlusTotals
  };

  return {
    ...config,
    targetRowsCount: targetRows.length,
    usdRowsCount: Array.isArray(usdChecker?.rows) ? usdChecker.rows.length : 0,
    matchedUsdRowsCount: targetRows.length - (noTradeReasonCounts.missing_usd_snapshot || 0),
    tradableRowsCount: tradableRows.length,
    noTradeRowsCount: noTradeRows.length,
    missingUsdRowsCount: noTradeReasonCounts.missing_usd_snapshot || 0,
    conflictRowsCount: noTradeReasonCounts.same_direction_conflict || 0,
    bucketMatrix,
    bucketTotals,
    weekdayTotals,
    assetTotals,
    layer2Summary,
    bucketSummaryRows,
    conflictSummaryRows,
    tradableRows,
    noTradeRows
  };
}

function renderPairTradeSummaryCards(pairResearch = null) {
  if (!pairResearch) return "";
  return `
    <section class="backtest-metric-grid research-summary-grid pair-trade-kpi-grid pair-trade-card-grid" data-pair-trade-card-grid="${escapeHtml(pairResearch.pairCode)}">
      ${renderBacktestKpiMetric("Target Rows", String(pairResearch.targetRowsCount ?? 0), "Rows available from target checker")}
      ${renderBacktestKpiMetric("Matched USD Rows", String(pairResearch.matchedUsdRowsCount ?? 0), "Same-date USD rows")}
      ${renderBacktestKpiMetric("Tradable Pairs", String(pairResearch.tradableRowsCount ?? 0), "Opposite directional target/USD signals")}
      ${renderBacktestKpiMetric("No Trade", String(pairResearch.noTradeRowsCount ?? 0), "Missing USD or conflict/non-directional setup")}
      ${renderBacktestKpiMetric("Wins", String(pairResearch.assetTotals?.wins ?? 0), "Tradable pair rows marked CORRECT")}
      ${renderBacktestKpiMetric("Losses", String(pairResearch.assetTotals?.losses ?? 0), "Tradable pair rows marked WRONG")}
      ${renderBacktestKpiMetric("Flats", String(pairResearch.assetTotals?.flats ?? 0), "Tradable pair rows marked FLAT / neutral")}
      ${renderBacktestKpiMetric("Ex-Flat Win Rate", metricAvailable(pairResearch.assetTotals?.exFlatWinRatePct) ? `${percentValue(pairResearch.assetTotals.exFlatWinRatePct)} ex-flat` : (pairResearch.assetTotals?.flats ? "Flat only" : displayDash()), `${pairResearch.assetTotals?.wins ?? 0}W / ${pairResearch.assetTotals?.losses ?? 0}L`)}
    </section>
  `;
}

function renderLayer2PairSummary(pairResearchRows = []) {
  if (!pairResearchRows.length) return "";

  const summaryRows = pairResearchRows.map((pairResearch) => {
    const summary = pairResearch.layer2Summary || {};
    return `
      <div class="pair-summary-row" data-layer2-pair-summary-row="${escapeHtml(pairResearch.pairCode)}">
        <div class="pair-summary-compare-cell pair-summary-pair-cell">
          <strong>${escapeHtml(pairResearch.pairLabel)}</strong>
          <span>${escapeHtml(pairResearch.targetAssetCode)} paired with USD</span>
        </div>
        <div class="pair-summary-compare-cell pair-summary-signal-cell">
          ${renderPairSummaryMetricLine("Tradable signals", `${summary.tradableSignals ?? 0}`)}
          ${renderPairSummaryMetricLine("Trade Days %", metricAvailable(summary.tradeDaysPct) ? percentValue(summary.tradeDaysPct) : displayDash())}
          ${renderPairSummaryMetricLine("Ex-flat WR", formatPairTradeExFlatInline(summary.allSignalTotals))}
          ${renderPairSummaryMetricLine("W / L / F / T", formatPairTradeCountsCompact(summary.allSignalTotals))}
        </div>
        <div class="pair-summary-compare-cell pair-summary-signal-cell pair-summary-strongplus-cell">
          ${renderPairSummaryMetricLine("Strong+ signals", `${summary.strongPlusSignals ?? 0}`)}
          ${renderPairSummaryMetricLine("Strong+ Trade Days %", metricAvailable(summary.strongPlusTradeDaysPct) ? percentValue(summary.strongPlusTradeDaysPct) : displayDash())}
          ${renderPairSummaryMetricLine("Strong+ ex-flat WR", formatPairTradeExFlatInline(summary.strongPlusTotals))}
          ${renderPairSummaryMetricLine("Strong+ W / L / F / T", formatPairTradeCountsCompact(summary.strongPlusTotals))}
          ${renderPairSummaryMetricLine("Strong+ flat rate", formatPairTradeFlatRateInline(summary.strongPlusTotals))}
        </div>
      </div>
    `;
  }).join("");

  return `
    <section class="research-section pair-trade-summary-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Layer 2 Pair Summary</p>
          <h3>How accurate are our Layer 2 pair signals historically?</h3>
        </div>
        <p class="research-panel-copy">Trade Days % = the share of matched historical days where the pair logic produced an actual tradable signal. For BTC, matched historical days only include days where a same-date USD row exists.</p>
      </div>
      <article class="detail-panel wide-panel research-secondary-panel pair-summary-compare-panel">
        <div class="pair-summary-compare-grid" data-layer2-pair-summary="comparison-grid">
          <div class="pair-summary-compare-head">Pair</div>
          <div class="pair-summary-compare-head">All Signals</div>
          <div class="pair-summary-compare-head pair-summary-strongplus-head">Strong+</div>
          ${summaryRows}
        </div>
      </article>
      <div class="pair-summary-grid-sentinel" data-layer2-pair-summary-cards="0" hidden>
      </div>
    </section>
  `;
}

function renderPairTradeDayTotals(pairResearch = null) {
  if (!pairResearch) return "";
  const weekdayHeaders = pairResearch.weekdayKeys.map(weekdayKey => `<th>${escapeHtml(weekdayBreakdownLabels[weekdayKey] || weekdayKey)}</th>`).join("");
  const dayTotalCells = pairResearch.weekdayKeys.map(weekdayKey => `<td>${escapeHtml(formatWeekdayBreakdownCell(pairResearch.weekdayTotals?.[weekdayKey]))}</td>`).join("");
  return `
    <article class="detail-panel wide-panel research-secondary-panel weekday-breakdown-panel">
      <div class="panel-head">
        <p class="eyebrow">Day Totals</p>
        <h3>${escapeHtml(pairResearch.pairLabel)} weekday totals across all confidence buckets</h3>
      </div>
      <div class="research-table-scroll weekday-breakdown-scroll">
        <table class="dashboard-table weekday-breakdown-table weekday-breakdown-totals-table" data-pair-trade-day-totals="${escapeHtml(pairResearch.pairCode)}">
          <thead>
            <tr>
              <th>Day Totals</th>
              ${weekdayHeaders}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">All Confidence Buckets</th>
              ${dayTotalCells}
              <td class="weekday-breakdown-total-cell">${escapeHtml(formatWeekdayBreakdownCell(pairResearch.assetTotals))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderPairTradeWeekdayBreakdown(pairResearch = null) {
  if (!pairResearch) return "";
  const weekdayHeaders = pairResearch.weekdayKeys.map(weekdayKey => `<th>${escapeHtml(weekdayBreakdownLabels[weekdayKey] || weekdayKey)}</th>`).join("");
  const bucketRows = weekdayBreakdownBuckets.map(bucket => {
    const cells = pairResearch.weekdayKeys.map(weekdayKey => `<td>${escapeHtml(formatWeekdayBreakdownCell(pairResearch.bucketMatrix?.[bucket.key]?.[weekdayKey]))}</td>`).join("");
    return `
      <tr>
        <th scope="row">${escapeHtml(bucket.label)}</th>
        ${cells}
        <td class="weekday-breakdown-total-cell">${escapeHtml(formatWeekdayBreakdownCell(pairResearch.bucketTotals?.[bucket.key]))}</td>
      </tr>
    `;
  }).join("");

  return `
    <article class="detail-panel wide-panel research-secondary-panel weekday-breakdown-panel" data-pair-trade-asset="${escapeHtml(pairResearch.pairCode)}">
      <div class="panel-head">
        <p class="eyebrow">Weekday Breakdown</p>
        <h3>${escapeHtml(pairResearch.pairLabel)} by combined confidence bucket and weekday</h3>
      </div>
      <p class="research-panel-copy">Combined confidence is the lower of target headline confidence and same-date USD headline confidence. Only opposite-direction target/USD setups are treated as tradable pair rows.</p>
      <div class="research-table-scroll weekday-breakdown-scroll">
        <table class="dashboard-table weekday-breakdown-table">
          <thead>
            <tr>
              <th>Confidence Bucket</th>
              ${weekdayHeaders}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${bucketRows}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderPairTradeResearchAsset(pairResearch = null) {
  if (!pairResearch) return "";

  return `
    <section class="research-section pair-trade-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Pair Trade Research</p>
          <h3>${escapeHtml(pairResearch.pairLabel)} from ${escapeHtml(pairResearch.targetAssetCode)} + USD</h3>
        </div>
        <p class="research-panel-copy">Pair trade research remains downstream-only. It uses same-date target and USD checker rows, requires opposite directional calls to form a tradable pair setup, and uses the target asset's stored evaluation result as the realized pair outcome proxy.</p>
      </div>
      ${renderPairTradeSummaryCards(pairResearch)}
      ${renderResearchBreakdownTable(`${pairResearch.pairLabel} confidence buckets`, "Confidence Bucket Table", pairResearch.bucketSummaryRows, [
        { label: "Bucket", className: "pair-trade-col-bucket", render: row => researchDataCell(row.bucketLabel, `${row.combinedConfidenceBand}% combined confidence`) },
        { label: "Coverage", className: "pair-trade-col-coverage", render: row => researchDataCell(row.total, formatPairTradeCountsCompact(row)) },
        { label: "Ex-Flat Win Rate", className: "pair-trade-col-exflat", render: row => researchDataCell(metricAvailable(row.exFlatWinRatePct) ? `${percentValue(row.exFlatWinRatePct)} ex-flat` : (row.flats ? "Flat only" : displayDash()), `${row.wins + row.losses} directional`) },
        { label: "Flat Rate", className: "pair-trade-col-flatrate", render: row => researchDataCell(metricAvailable(row.flatRatePct) ? percentValue(row.flatRatePct) : displayDash(), `${row.flats} of ${row.total}`) }
      ], {
        scrollClass: "pair-trade-table-scroll",
        tableClass: "pair-trade-bucket-table",
        description: "Confidence buckets use min(target headline confidence, USD headline confidence) so pair trade confidence never exceeds the weaker side of the setup."
      })}
      ${renderPairTradeDayTotals(pairResearch)}
      ${renderPairTradeWeekdayBreakdown(pairResearch)}
      ${renderResearchBreakdownTable(`${pairResearch.pairLabel} conflict / no-trade summary`, "Conflict / No-Trade Summary", pairResearch.conflictSummaryRows, [
        { label: "Reason", render: row => researchDataCell(row.reasonLabel, row.reasonKey) },
        { label: "Count", render: row => researchDataCell(row.count, `${pairResearch.targetRowsCount ? roundTo((row.count / pairResearch.targetRowsCount) * 100, 1) : 0}% of target rows`) },
        { label: "Share", render: row => researchDataCell(metricAvailable(row.sharePct) ? percentValue(row.sharePct) : displayDash(), "Target-row share") }
      ], {
        description: "No-trade rows include missing USD snapshots, same-direction target/USD conflicts, and non-directional or missing-confidence setups."
      })}
    </section>
  `;
}

function renderResearchPairTrade(data = {}) {
  const pairResearchRows = pairTradeResearchConfigs
    .map(config => buildPairTradeResearchForConfig(config, data.checkers || {}))
    .filter(item => item.targetRowsCount > 0);

  if (!pairResearchRows.length) {
    return `
      <div class="backtest-report">
        <article class="detail-panel wide-panel research-secondary-panel">
          <p class="eyebrow">Pair Trade Research</p>
          <h3>Pair trade research unavailable</h3>
          <div class="empty-state matrix-evidence-empty">Required checker artifacts could not be loaded for pair trade research.</div>
        </article>
      </div>
    `;
  }

  return `
    <div class="backtest-report">
      ${renderResearchStatusHeader(data)}
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <p class="eyebrow">Pair Trade Research</p>
            <h3>Layer 2 pair confirmation research from Layer 1 checker artifacts</h3>
          </div>
          <p class="research-panel-copy">This tab does not create live Layer 2 logic. It only studies same-date target + USD pair setups from the canonical checker artifacts, using stored displayed headline confidence and stored evaluation outcomes.</p>
        </div>
        <article class="detail-panel wide-panel research-secondary-panel weekday-breakdown-intro-panel">
          <p class="research-panel-copy">Tradable pair rows require opposite target/USD directions. Combined confidence is the lower of the two stored headline confidence values. Same-direction target/USD rows are treated as conflicts, and BTC weekend rows with no same-date USD row remain visible in the conflict / no-trade summary.</p>
        </article>
      </section>
      ${renderLayer2PairSummary(pairResearchRows)}
      ${pairResearchRows.map(renderPairTradeResearchAsset).join("")}
    </div>
  `;
}

function renderResearchVerdictQuality(data = {}) {
  const byVerdictStrength = data.accuracy?.by_verdict_strength || [];
  const byConfidenceBucket = data.accuracy?.by_confidence_bucket || [];
  const strength24h = byVerdictStrength.filter(row => row.timeframe === "following 24hrs");
  const strengthRows = strength24h.length ? strength24h : byVerdictStrength;
  const confidence24h = byConfidenceBucket.filter(row => row.timeframe === "following 24hrs");
  const confidenceRows = confidence24h.length ? confidence24h : byConfidenceBucket;

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Verdict Quality</p>
          <h3>Accuracy by Signal Strength</h3>
        </div>
        <p class="research-panel-copy">Overall accuracy answers: "Was the model directionally right?" Strength accuracy qualifies that headline by answering: "Were stronger verdicts actually more reliable?" Direction, confidence, and strength are one verdict-quality system, not separate side metrics.</p>
      </div>
      <section class="backtest-grid research-regime-grid">
        ${renderResearchBreakdownTable("Accuracy by Signal Strength", "Verdict Quality", strengthRows, [
          { label: "Strength", render: row => researchDataCell(row.verdict_strength, `${row.benchmark_market} • ${row.timeframe}`) },
          { label: "Evaluated", render: row => researchDataCell(row.evaluated_calls, `${row.wins} wins / ${row.losses} losses`) },
          { label: "Win Rate", render: row => researchDataCell(percentValue(row.win_rate_pct), `${row.flats} flat`) },
          { label: "Avg Confidence", render: row => researchDataCell(percentValue(row.avg_predicted_confidence), metricAvailable(row.avg_abs_move_pct) ? `${row.avg_abs_move_pct}% abs move` : "Abs move n/a") }
        ], {
          description: "DXY-only benchmark rows. Low overall accuracy does not automatically mean the agent is unusable if high-confidence or VERY_STRONG calls are materially more accurate. Conversely, high overall accuracy is less useful if high-confidence calls are not better than weak calls."
        })}
      </section>
    </section>

    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Verdict Quality</p>
          <h3>Confidence Calibration</h3>
        </div>
        <p class="research-panel-copy">Confidence calibration qualifies headline accuracy by answering: "Did the confidence % match realised accuracy?" This 24H-priority view tests whether higher-confidence calls were actually more reliable, and whether the model was overconfident or underconfident by confidence band.</p>
      </div>
      <section class="backtest-grid research-regime-grid">
        ${renderResearchBreakdownTable("Confidence Calibration", "Verdict Quality", confidenceRows, [
          { label: "Confidence", render: row => researchDataCell(row.confidence_bucket, `${row.benchmark_market} • ${row.timeframe}`) },
          { label: "Evaluated", render: row => researchDataCell(row.evaluated_calls, `${row.wins} wins / ${row.losses} losses`) },
          { label: "Predicted", render: row => researchDataCell(percentValue(row.avg_predicted_confidence), `${row.flats} flat`) },
          { label: "Actual", render: row => researchDataCell(percentValue(row.actual_win_rate_pct), metricAvailable(row.calibration_gap_pct) ? `${row.calibration_gap_pct > 0 ? "+" : ""}${row.calibration_gap_pct}% gap` : "Gap n/a") }
        ], {
          description: "Positive calibration gap means the bucket outperformed its average predicted confidence. Negative gap means the model was overconfident. Confidence is useful only if higher predicted confidence is matched by higher realised accuracy."
        })}
      </section>
    </section>
  `;
}

function renderResearchTradeQuality(data = {}) {
  const tradeQuality = data.accuracy?.trade_quality || [];
  const tradeQuality24h = tradeQuality.filter(row => row.timeframe === "following 24hrs");
  const tradeQualityRows = tradeQuality24h.length ? tradeQuality24h : tradeQuality;

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Trade Quality</p>
          <h3>Which subsets may have been worth taking</h3>
        </div>
        <p class="research-panel-copy">Overall accuracy treats every prediction equally. Trade Quality asks what would have happened if only higher-confidence or stronger verdicts were considered tradeable.</p>
      </div>
      <section class="backtest-grid research-regime-grid">
        ${renderResearchBreakdownTable("Trade Quality", "Filtered Thresholds", tradeQualityRows, [
          { label: "Threshold", render: row => researchDataCell(row.threshold_label, `${row.benchmark_market} • ${row.timeframe}`) },
          { label: "Coverage", render: row => researchDataCell(percentValue(row.coverage_pct), `${row.tradeable_predictions} of ${row.total_available_predictions}`) },
          { label: "Evaluated", render: row => researchDataCell(row.evaluated_calls, `${row.wins} wins / ${row.losses} losses`) },
          { label: "Win Rate", render: row => researchDataCell(percentValue(row.win_rate_pct), `${row.flats} flat`) },
          { label: "Avg Confidence", render: row => researchDataCell(percentValue(row.avg_predicted_confidence), metricAvailable(row.avg_abs_move_pct) ? `${row.avg_abs_move_pct}% abs move` : "Abs move n/a") }
        ], {
          description: "A lower overall win rate may still hide high-quality tradeable subsets. A high threshold with strong accuracy but tiny coverage means rare edge. A broad threshold with weaker accuracy may not be useful as a trade filter."
        })}
      </section>
    </section>
  `;
}

function renderResearchAccuracy(data = {}) {
  const summary24h = data.accuracy?.summary_24h || null;
  const usdMatrix24hRows = data.accuracy?.matrix_24h_rows || [];
  const eurMatrix24hRows = data.accuracy?.eur_matrix_24h_rows || [];
  const goldMatrix24hRows = data.accuracy?.gold_matrix_24h_rows || [];
  const nqMatrix24hRows = data.accuracy?.nq_matrix_24h_rows || [];
  const btcMatrix24hRows = data.accuracy?.btc_matrix_24h_rows || [];

  if (data.meta?.error) {
    return `
      <article class="detail-panel wide-panel research-matrix-panel">
        <p class="eyebrow">Backtest / Accuracy</p>
        <h3>Research view unavailable</h3>
        <div class="empty-state research-matrix-empty">The research layer could not be loaded for this tab.</div>
      </article>
    `;
  }

  return `
    <div class="backtest-report">
      ${renderResearchStatusHeader(data)}
      ${renderResearchAsset24hContext({
        assetCode: "USD",
        benchmark: summary24h?.benchmark_market || "DXY"
      })}
      ${renderResearch24hAccuracyMatrix(usdMatrix24hRows, {
        assetCode: "USD",
        assetLabel: "USD",
        timeframe: "following 24hrs",
        timeframeLabel: "24H",
        sourceView: "research_prediction_usd_benchmark_summary",
        exportKey: "usd-24h"
      })}
      ${renderMatrixSummary(usdMatrix24hRows, {
        assetCode: "USD",
        timeframe: "following 24hrs",
        assetLabel: "USD",
        timeframeLabel: "24H"
      })}
      ${renderResearchAsset24hContext({
        assetCode: "EUR",
        benchmark: "EURUSD"
      })}
      ${renderResearch24hAccuracyMatrix(eurMatrix24hRows, {
        assetCode: "EUR",
        assetLabel: "EUR",
        timeframe: "following 24hrs",
        timeframeLabel: "24H",
        sourceView: "research_prediction_evaluations",
        exportKey: "eur-24h"
      })}
      ${renderMatrixSummary(eurMatrix24hRows, {
        assetCode: "EUR",
        timeframe: "following 24hrs",
        assetLabel: "EUR",
        timeframeLabel: "24H"
      })}
      ${renderResearchAsset24hContext({
        assetCode: "GOLD",
        benchmark: "XAUUSD"
      })}
      ${renderResearch24hAccuracyMatrix(goldMatrix24hRows, {
        assetCode: "GOLD",
        assetLabel: "Gold",
        timeframe: "following 24hrs",
        timeframeLabel: "24H",
        sourceView: "research_prediction_evaluations",
        exportKey: "gold-24h"
      })}
      ${renderMatrixSummary(goldMatrix24hRows, {
        assetCode: "GOLD",
        timeframe: "following 24hrs",
        assetLabel: "Gold",
        timeframeLabel: "24H"
      })}
      ${renderResearchAsset24hContext({
        assetCode: "NQ",
        benchmark: "QQQ_NQ_PROXY"
      })}
      ${renderResearch24hAccuracyMatrix(nqMatrix24hRows, {
        assetCode: "NQ",
        assetLabel: "NQ",
        timeframe: "following 24hrs",
        timeframeLabel: "24H",
        sourceView: "research_prediction_evaluations",
        exportKey: "nq-24h"
      })}
      ${renderMatrixSummary(nqMatrix24hRows, {
        assetCode: "NQ",
        timeframe: "following 24hrs",
        assetLabel: "NQ",
        timeframeLabel: "24H"
      })}
      ${renderResearchAsset24hContext({
        assetCode: "BTC",
        benchmark: "BTCUSD"
      })}
      ${renderResearch24hAccuracyMatrix(btcMatrix24hRows, {
        assetCode: "BTC",
        assetLabel: "BTC",
        timeframe: "following 24hrs",
        timeframeLabel: "24H",
        sourceView: "research_prediction_evaluations",
        exportKey: "btc-24h"
      })}
      ${renderMatrixSummary(btcMatrix24hRows, {
        assetCode: "BTC",
        timeframe: "following 24hrs",
        assetLabel: "BTC",
        timeframeLabel: "24H"
      })}
      ${renderConfidenceCalibrationSummary(data.confidence_calibration || {})}
      ${renderResearchDefinitions()}
    </div>
  `;
}

function renderResearchInfrastructure(data = {}) {
  const infrastructure = data.infrastructure || {};

  return `
    <article class="detail-panel wide-panel explanation-card">
      <p class="eyebrow">Infrastructure Status</p>
      <h3>USD historical research pipeline state</h3>
      <p>The dashboard reads infrastructure state from research SQL views only. This section is downstream-only and cannot feed back into live Layer 1 outputs.</p>
    </article>

    <section class="backtest-metric-grid research-progress-grid">
      ${renderBacktestMetric("Historical Warehouse", infrastructure.historical_warehouse_status || "Not yet available", "Historical source tables populated")}
      ${renderBacktestMetric("Snapshot Builder", infrastructure.snapshot_builder_status || "Not yet available", "Historical USD market snapshots available")}
      ${renderBacktestMetric("Replay Engine", infrastructure.replay_engine_status || "Not yet available", "Research observations and predictions written")}
      ${renderBacktestMetric("Outcome Evaluation", infrastructure.outcome_evaluation_status || "Not yet available", "Predictions evaluated against realised outcomes")}
      ${renderBacktestMetric("Research SQL", infrastructure.research_sql_status || "Not yet available", "Dashboard reads research views only")}
      ${renderBacktestMetric("Last Replay Date", formatDateValue(infrastructure.last_replay_date), "Most recent replayed snapshot date")}
      ${renderBacktestMetric("Replay Coverage", infrastructure.replay_coverage || "Not yet available", "Full currently available USD replay range")}
      ${renderBacktestMetric("Observations", String(infrastructure.observation_count ?? "Not yet available"), "Research observations written")}
      ${renderBacktestMetric("Predictions", String(infrastructure.prediction_count ?? "Not yet available"), "Research timeframe predictions written")}
      ${renderBacktestMetric("Evaluation Rows", String(infrastructure.evaluation_row_count ?? "Not yet available"), "Prediction evaluation rows written")}
    </section>
  `;
}

function renderBacktest(data = {}) {
  const updated = document.getElementById("backtestUpdated");
  if (updated) {
    const marker = data.meta?.error
      ? `Research data unavailable: ${data.meta.error}`
      : `Last synced: ${formatDashboardTime(data.meta?.last_updated)}`;
    updated.textContent = marker;
  }

  const panel = document.getElementById("backtestPanel");
  if (!panel) return;
  try {
    panel.innerHTML = activeBacktestTab === "infrastructure"
      ? renderResearchInfrastructure(data)
      : (activeBacktestTab === "checker"
        ? renderResearchDataChecker(data)
        : (activeBacktestTab === "weekday-breakdown"
          ? renderResearchWeekdayBreakdown(data)
        : (activeBacktestTab === "pair-trade-research"
          ? renderResearchPairTrade(data)
          : (activeBacktestTab === "adr-reach-research"
            ? renderResearchAdrReach(data)
            : (activeBacktestTab === "half-l2l-reach"
              ? renderResearchL2lDirectionalAccuracy(data)
            : (activeBacktestTab === "adr-threshold-sensitivity"
              ? renderResearchAdrThresholdSensitivity(data)
              : (activeBacktestTab === "directional-trust-summary"
                ? renderResearchDirectionalTrustSummary(data)
                : renderResearchAccuracy(data))))))));
    applyMatrixEvidenceFilter("all");
  } catch (err) {
    console.error("Backtest render failed", err);
    panel.innerHTML = `
      <article class="detail-panel wide-panel research-matrix-panel">
        <p class="eyebrow">Backtest / Accuracy</p>
        <h3>Research view unavailable</h3>
        <div class="empty-state research-matrix-empty">The Backtest / Accuracy panel could not render cleanly. Reload the page or inspect the research layer response.</div>
      </article>
    `;
  }
}

function applyMatrixEvidenceFilter(filterKey = "all") {
  const panel = document.getElementById("backtestPanel");
  if (!panel) return;

  const normalizedFilter = String(filterKey || "all").trim().toLowerCase();
  panel.querySelectorAll("[data-matrix-evidence-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.matrixEvidenceFilter === normalizedFilter);
  });

  panel.querySelectorAll(".matrix-evidence-table-wrap tbody tr").forEach(row => {
    const result = String(row.dataset.evidenceResult || "").toLowerCase();
    const direction = String(row.dataset.evidenceDirection || "").toLowerCase();
    const strength = String(row.dataset.evidenceStrength || "").toLowerCase();
    const matches = normalizedFilter === "all"
      || result === normalizedFilter
      || direction === normalizedFilter
      || strength === normalizedFilter;
    row.hidden = !matches;
  });
}

function escapeCsvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const escaped = text.replace(/"/g, "\"\"");
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function exportMatrixEvidenceCsv(exportKey = "usd-24h") {
  const normalizedKey = String(exportKey || "usd-24h").toLowerCase();
  const exportConfig = {
    "usd-24h": {
      rows: backtestData?.accuracy?.matrix_24h_rows || [],
      assetCode: "USD",
      sourceView: "research_prediction_usd_benchmark_summary"
    },
    "eur-24h": {
      rows: backtestData?.accuracy?.eur_matrix_24h_rows || [],
      assetCode: "EUR",
      sourceView: "research_prediction_evaluations"
    },
    "gold-24h": {
      rows: backtestData?.accuracy?.gold_matrix_24h_rows || [],
      assetCode: "GOLD",
      sourceView: "research_prediction_evaluations"
    },
    "nq-24h": {
      rows: backtestData?.accuracy?.nq_matrix_24h_rows || [],
      assetCode: "NQ",
      sourceView: "research_prediction_evaluations"
    },
    "btc-24h": {
      rows: backtestData?.accuracy?.btc_matrix_24h_rows || [],
      assetCode: "BTC",
      sourceView: "research_prediction_evaluations"
    }
  };
  const selectedExport = exportConfig[normalizedKey] || exportConfig["usd-24h"];
  const matrix24hRows = selectedExport.rows;
  const assetCode = selectedExport.assetCode;
  const sourceView = selectedExport.sourceView;
  const audit = buildResearchEvidenceAudit(matrix24hRows, {
    assetCode,
    timeframe: "following 24hrs",
    sourceView
  });

  if (!audit.includedRows.length) {
    console.warn("No matrix evidence rows available to export");
    return;
  }

  const headers = [
    "Date",
    "Asset",
    "Timeframe",
    "Direction",
    "Conviction %",
    "Strength Bucket",
    "Benchmark",
    "Benchmark Start",
    "Benchmark End",
    "Benchmark Move",
    "Evaluation Result",
    "Matrix Cell",
    "Prediction / Research ID"
  ];
  const lines = [
    headers.join(","),
    ...audit.includedRows.map(row => [
      row.snapshotDate || "",
      row.assetCode || "",
      row.timeframe || "",
      row.directionLabel || "",
      row.convictionPctValue ?? "",
      row.strengthBucket || "",
      row.benchmark || "",
      row.startPrice === displayDash() ? "" : row.startPrice,
      row.endPrice === displayDash() ? "" : row.endPrice,
      row.benchmarkMove === displayDash() ? "" : row.benchmarkMove,
      row.result || "",
      row.matrixCell || "",
      row.predictionId || ""
    ].map(escapeCsvCell).join(","))
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${normalizedKey}-matrix-evidence.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function workflowErrorText(error) {
  if (!error) return "";
  if (typeof error === "string") return error;

  const step = error.step || error.workflow || error.node || "";
  const reason = error.reason || error.message || error.error || "";

  return [step, reason].filter(Boolean).join(": ");
}

function renderWorkflowSteps(steps = []) {
  const container = document.getElementById("workflowStepReport");
  if (!container) return;

  if (!Array.isArray(steps) || !steps.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="workflow-step-grid">
      ${steps.map(step => {
        const executionStatus = step.execution_status || step.status;
        const dataStatus = step.data_status || null;
        const status = workflowStatusClass(dataStatus && String(dataStatus).toUpperCase() !== "HEALTHY" ? "warning" : executionStatus);
        const error = workflowErrorText(step.error || step.reason || step.message);
        return `
          <div class="workflow-step ${status}">
            <span>${escapeHtml(step.name || step.workflow || "Workflow step")}</span>
            <strong>${escapeHtml(workflowStatusLabel(executionStatus))}</strong>
            ${dataStatus ? `<small>Data: ${escapeHtml(workflowStatusLabel(dataStatus))}</small>` : ""}
            ${error && status === "failed" ? `<small>${escapeHtml(error)}</small>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function workflowEtaText(status, statusClass) {
  if (status?.eta) return status.eta;
  if (status?.eta_seconds !== undefined) return `${Math.max(0, Math.ceil(Number(status.eta_seconds) / 60))}m ETA`;
  if (statusClass === "running" && status?.last_run_started_at) {
    const startedAt = new Date(status.last_run_started_at).getTime();
    const windowMs = Number(workflowControl?.poll_after_trigger_ms || 180000);
    if (!Number.isNaN(startedAt)) {
      const remainingMs = Math.max(0, startedAt + windowMs - Date.now());
      return remainingMs > 0 ? `~${Math.ceil(remainingMs / 60000)}m ETA` : "Checking completion";
    }
  }
  if (statusClass === "success") return status?.last_run_finished_at ? `Completed ${formatRelativeAge(status.last_run_finished_at)}` : "Completed";
  if (statusClass === "failed") return "Needs review";
  if (statusClass === "not-configured") return "Not configured";
  return "Ready";
}

function renderWorkflowStatus(status = workflowStatus) {
  const summary = document.getElementById("workflowStatusSummary");
  const badge = document.getElementById("workflowStatusBadge");
  const button = document.getElementById("runWorkflowButton");
  const errorReport = document.getElementById("workflowErrorReport");
  const eta = document.getElementById("workflowEta");
  const elapsed = document.getElementById("workflowElapsed");
  const meta = document.getElementById("workflowProgressMeta");
  const note = document.getElementById("workflowProgressNote");

  const configured = Boolean(workflowControl?.enabled && workflowControl?.webhook_url);
  const activeRefreshPresentation = buildWorkflowRefreshPresentation(workflowRefreshState);
  const dataStatus = status?.overall_data_status || status?.data_status || (
    inputHealthData?.overall_status === "CRITICAL" || inputHealthData?.overall_status === "DEGRADED"
      ? "DEGRADED"
      : inputHealthData?.overall_status === "UNKNOWN"
        ? "UNKNOWN"
        : "HEALTHY"
  );
  const currentStatus = status?.status || (configured ? "pending" : "not_configured");
  const effectiveStatus = currentStatus === "success" && dataStatus && String(dataStatus).toUpperCase() !== "HEALTHY"
    ? "success_degraded"
    : currentStatus;
  const statusClass = workflowStatusClass(effectiveStatus);
  const started = status?.last_run_started_at ? formatDashboardTime(status.last_run_started_at) : null;
  const finished = status?.last_run_finished_at ? formatDashboardTime(status.last_run_finished_at) : null;
  const age = status?.last_run_finished_at ? formatRelativeAge(status.last_run_finished_at) : "";
  const message = status?.message || "";
  const blockedByStoredRefresh = activeWorkflowRefreshBlocksNewRequest();

  if (badge) {
    badge.className = `workflow-status-badge ${activeRefreshPresentation?.badgeClass || statusClass}`;
    badge.textContent = activeRefreshPresentation?.badgeLabel || workflowStatusLabel(effectiveStatus);
  }

  if (button) {
    button.disabled = workflowTriggerInFlight || blockedByStoredRefresh || !configured;
    button.textContent = workflowTriggerInFlight ? "Starting..." : "Run Refresh";
    button.title = configured
      ? (blockedByStoredRefresh
        ? "A refresh request is already being tracked in this browser profile."
        : "Trigger the n8n Master Orchestrator")
      : "Add the n8n webhook URL to data/workflow-control.json";
  }

  if (eta) {
    eta.textContent = activeRefreshPresentation?.etaText || workflowEtaText(status, statusClass);
    eta.className = `workflow-eta ${activeRefreshPresentation?.badgeClass || statusClass}`;
  }

  if (elapsed) {
    elapsed.textContent = activeRefreshPresentation?.elapsedText || "Elapsed pending";
    elapsed.className = `workflow-elapsed ${activeRefreshPresentation?.badgeClass || statusClass}`;
  }

  if (meta) {
    meta.textContent = activeRefreshPresentation?.meta || `Latest published workflow status: ${workflowStatusLabel(effectiveStatus)}.`;
  }

  if (note) {
    note.hidden = !activeRefreshPresentation?.note;
    note.textContent = activeRefreshPresentation?.note || "";
    note.className = `workflow-progress-note ${activeRefreshPresentation?.badgeClass || statusClass}`;
  }

  if (summary) {
    if (activeRefreshPresentation) {
      summary.textContent = activeRefreshPresentation.summary;
    } else if (!configured) {
      summary.textContent = "Dashboard trigger is waiting for the Master Orchestrator webhook URL.";
    } else if (statusClass === "running") {
      summary.textContent = `Workflow run is in progress${started ? `, started ${started}` : ""}.`;
    } else if (statusClass === "success") {
      summary.textContent = `Last run completed${finished ? ` ${finished}` : ""}${age ? ` (${age})` : ""}.`;
    } else if (statusClass === "warning") {
      summary.textContent = `Last run completed${finished ? ` ${finished}` : ""}${age ? ` (${age})` : ""}, but monitored input data remains degraded.`;
    } else if (statusClass === "failed") {
      summary.textContent = `Last run failed${finished ? ` ${finished}` : ""}.`;
    } else {
      summary.textContent = message || "Ready to run the Master Orchestrator.";
    }
  }

  const errorText = workflowErrorText(status?.error);
  if (errorReport) {
    if (!activeRefreshPresentation && (statusClass === "failed" || errorText)) {
      const impactSummary = economicEventsCollectorImpactSummary(status);
      errorReport.hidden = false;
      errorReport.innerHTML = `
        <p class="eyebrow">Error Report</p>
        <h3>${escapeHtml(status?.failed_step || status?.error?.step || "Workflow run failed")}</h3>
        <p>${escapeHtml(errorText || message || "No error reason was supplied by n8n.")}</p>
        ${impactSummary ? `<div class="diagnostic-item">${escapeHtml(impactSummary)}</div>` : ""}
      `;
    } else {
      errorReport.hidden = true;
      errorReport.innerHTML = "";
    }
  }

  renderWorkflowSteps(status?.steps || []);
  renderOverviewStatusPanel();
}

async function loadWorkflowControl() {
  try {
    const response = await fetch(workflowControlUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`workflow-control ${response.status}`);
    workflowControl = await response.json();
  } catch (err) {
    console.warn("Could not load workflow control config", err);
    workflowControl = {
      enabled: false,
      webhook_url: "",
      status_url: "./data/workflow-status.json",
      poll_interval_ms: 10000,
      poll_after_trigger_ms: 180000
    };
  }

  renderWorkflowStatus();
}

async function loadWorkflowRuntimeProfile() {
  const runtimeProfileUrl = workflowControl?.runtime_profile_url || workflowRuntimeProfileUrlDefault;

  try {
    const response = await fetch(runtimeProfileUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`refresh-runtime-profile ${response.status}`);
    workflowRuntimeProfile = await response.json();
  } catch (err) {
    console.warn("Could not load workflow runtime profile", err);
    workflowRuntimeProfile = null;
  }

  renderWorkflowStatus(workflowStatus);
}

async function loadWorkflowStatus() {
  const statusUrl = workflowStatusUrlOverride || workflowControl?.status_url || workflowStatusUrlDefault;

  try {
    const response = await fetch(statusUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`workflow-status ${response.status}`);
    workflowStatus = await response.json();
    workflowStatusLoadError = null;
  } catch (err) {
    console.warn("Could not load workflow status", err);
    workflowStatusLoadError = err;
    workflowStatus = {
      status: workflowControl?.enabled ? "pending" : "not_configured",
      message: "Workflow status has not been published yet.",
      steps: [],
      error: null
    };
  }

  renderWorkflowStatus(workflowStatus);
}

function startWorkflowStatusPolling(durationMs) {
  if (workflowPollTimer) {
    clearInterval(workflowPollTimer);
    workflowPollTimer = null;
  }

  const intervalMs = Number(workflowControl?.poll_interval_ms || 10000);
  workflowPollTimer = setInterval(loadWorkflowStatus, intervalMs);

  if (durationMs) {
    setTimeout(() => {
      if (workflowPollTimer) {
        clearInterval(workflowPollTimer);
        workflowPollTimer = null;
      }
    }, durationMs);
  }
}

async function triggerWorkflowRun() {
  if (workflowTriggerInFlight || activeWorkflowRefreshBlocksNewRequest()) return;

  if (!workflowControl?.enabled || !workflowControl?.webhook_url) {
    renderWorkflowStatus({
      status: "not_configured",
      message: "Add the Master Orchestrator webhook URL before running from the dashboard.",
      steps: [],
      error: null
    });
    return;
  }

  workflowTriggerInFlight = true;
  const requestedAt = new Date().toISOString();
  const refreshRequestId = createRefreshRequestId();
  const refreshState = {
    refresh_request_id: refreshRequestId,
    requested_at: requestedAt,
    source: "dashboard",
    phase: "sending",
    owner_tab_id: createWorkflowRefreshTabId(),
    runtime_profile_version: workflowRuntimeProfile?.version || null,
    baseline: captureWorkflowRefreshBaseline(),
    last_updated_at: requestedAt
  };
  writeStoredWorkflowRefreshState(refreshState);
  ensureWorkflowRefreshRenderTimer();
  renderWorkflowStatus(workflowStatus);

  try {
    const method = workflowControl.method || "POST";
    const requestMode = workflowControl.request_mode || "cors";
    const payload = {
      source: "dashboard",
      requested_at: requestedAt
    };

    await fetch(workflowControl.webhook_url, {
      method,
      mode: requestMode,
      headers: requestMode === "no-cors" ? undefined : { "content-type": "application/json" },
      body: method.toUpperCase() === "GET" ? undefined : JSON.stringify(payload)
    });

    writeStoredWorkflowRefreshState({
      ...refreshState,
      phase: "accepted",
      last_updated_at: new Date().toISOString()
    });
    renderWorkflowStatus(workflowStatus);
    const pollWindowMs = Math.max(
      Number(workflowControl.poll_after_trigger_ms || 180000),
      Math.ceil((getRuntimeProfilePercentileSeconds("max", 342.754) * 1000) + 120000)
    );
    startWorkflowStatusPolling(pollWindowMs);
    loadWorkflowStatus();
    loadDashboard();
  } catch (err) {
    writeStoredWorkflowRefreshState({
      ...refreshState,
      phase: "failed_dispatch",
      error_message: err.message || String(err),
      last_updated_at: new Date().toISOString()
    });
    renderWorkflowStatus(workflowStatus);
  } finally {
    workflowTriggerInFlight = false;
    renderWorkflowStatus(workflowStatus);
  }
}

function setupWorkflowControls() {
  const button = document.getElementById("runWorkflowButton");
  if (button) {
    button.addEventListener("click", triggerWorkflowRun);
  }
}

function setupWorkflowRefreshStorageSync() {
  if (typeof window === "undefined") return;

  window.addEventListener("storage", (event) => {
    if (event.key !== workflowRefreshStateKey) return;
    workflowRefreshState = readStoredWorkflowRefreshState();
    if (activeWorkflowRefreshBlocksNewRequest()) {
      ensureWorkflowRefreshRenderTimer();
      const pollWindowMs = Math.max(
        Number(workflowControl?.poll_after_trigger_ms || 180000),
        Math.ceil((getRuntimeProfilePercentileSeconds("max", 342.754) * 1000) + 120000)
      );
      startWorkflowStatusPolling(pollWindowMs);
      loadWorkflowStatus();
      loadDashboard();
    } else {
      clearWorkflowRefreshPollingTimer();
    }
    renderWorkflowStatus(workflowStatus);
  });
}

function humanizeArchitectureStatus(status = "") {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function resetArchitectureState() {
  architectureState = {
    status: "idle",
    manifest: null,
    error: "",
    activeViewId: null,
    selectedNodeId: null,
    verifiedOnly: false,
    loadingPromise: null,
    renderModel: null
  };
}

function validateArchitectureManifest(manifest) {
  const errors = [];
  const requiredTopLevel = ["metadata", "nodes", "edges", "views", "legends", "boundaries"];

  requiredTopLevel.forEach((key) => {
    if (!(key in (manifest || {}))) errors.push(`Missing top-level field: ${key}`);
  });

  if (!Array.isArray(manifest?.nodes)) errors.push("nodes must be an array");
  if (!Array.isArray(manifest?.edges)) errors.push("edges must be an array");
  if (!Array.isArray(manifest?.views)) errors.push("views must be an array");
  if (!Array.isArray(manifest?.legends)) errors.push("legends must be an array");
  if (!Array.isArray(manifest?.boundaries)) errors.push("boundaries must be an array");
  if (errors.length) return errors;

  const nodeIds = new Set();
  const edgeIds = new Set();
  const boundaryIds = new Set();
  const edgeById = new Map();

  manifest.nodes.forEach((node) => {
    if (!node?.id) errors.push("Every node requires an id");
    if (!node?.label) errors.push(`Node ${node?.id || "<missing>"} requires a label`);
    if (!node?.kind) errors.push(`Node ${node?.id || "<missing>"} requires a kind`);
    if (!node?.summary) errors.push(`Node ${node?.id || "<missing>"} requires a summary`);
    if (!node?.verification?.status) errors.push(`Node ${node?.id || "<missing>"} requires verification.status`);
    if (node?.verification?.status && !architectureAllowedVerificationStatuses.has(node.verification.status)) {
      errors.push(`Node ${node.id} has invalid verification status: ${node.verification.status}`);
    }
    if (nodeIds.has(node?.id)) errors.push(`Duplicate node id: ${node.id}`);
    nodeIds.add(node?.id);
  });

  manifest.edges.forEach((edge) => {
    if (!edge?.id) errors.push("Every edge requires an id");
    if (!edge?.source) errors.push(`Edge ${edge?.id || "<missing>"} requires a source`);
    if (!edge?.target) errors.push(`Edge ${edge?.id || "<missing>"} requires a target`);
    if (!edge?.label) errors.push(`Edge ${edge?.id || "<missing>"} requires a label`);
    if (!edge?.verification?.status) errors.push(`Edge ${edge?.id || "<missing>"} requires verification.status`);
    if (edge?.verification?.status && !architectureAllowedVerificationStatuses.has(edge.verification.status)) {
      errors.push(`Edge ${edge.id} has invalid verification status: ${edge.verification.status}`);
    }
    if (edgeIds.has(edge?.id)) errors.push(`Duplicate edge id: ${edge.id}`);
    if (edge?.source && !nodeIds.has(edge.source)) errors.push(`Edge ${edge.id} references missing source node: ${edge.source}`);
    if (edge?.target && !nodeIds.has(edge.target)) errors.push(`Edge ${edge.id} references missing target node: ${edge.target}`);
    edgeIds.add(edge?.id);
    edgeById.set(edge?.id, edge);
  });

  manifest.boundaries.forEach((boundary) => {
    if (!boundary?.id) errors.push("Every boundary requires an id");
    if (!boundary?.label) errors.push(`Boundary ${boundary?.id || "<missing>"} requires a label`);
    if (!boundary?.description) errors.push(`Boundary ${boundary?.id || "<missing>"} requires a description`);
    if (boundaryIds.has(boundary?.id)) errors.push(`Duplicate boundary id: ${boundary.id}`);
    boundaryIds.add(boundary?.id);
  });

  manifest.views.forEach((view) => {
    if (!view?.id) {
      errors.push("Every view requires an id");
      return;
    }
    if (!Array.isArray(view.node_ids)) errors.push(`View ${view.id} requires node_ids`);
    if (!Array.isArray(view.edge_ids)) errors.push(`View ${view.id} requires edge_ids`);
    if (!Array.isArray(view.boundary_ids)) errors.push(`View ${view.id} requires boundary_ids`);
    if (!view?.layout || typeof view.layout !== "object") {
      errors.push(`View ${view.id} requires a layout object`);
      return;
    }

    const viewNodeSet = new Set(view.node_ids || []);
    const viewBoundarySet = new Set(view.boundary_ids || []);

    (view.node_ids || []).forEach((nodeId) => {
      if (!nodeIds.has(nodeId)) errors.push(`View ${view.id} references missing node ${nodeId}`);
      if (!view.layout?.nodes?.[nodeId]) errors.push(`View ${view.id} is missing layout coordinates for node ${nodeId}`);
    });

    (view.edge_ids || []).forEach((edgeId) => {
      const edge = edgeById.get(edgeId);
      if (!edge) {
        errors.push(`View ${view.id} references missing edge ${edgeId}`);
        return;
      }
      if (!viewNodeSet.has(edge.source) || !viewNodeSet.has(edge.target)) {
        errors.push(`View ${view.id} includes edge ${edgeId} without both endpoint nodes`);
      }
    });

    (view.boundary_ids || []).forEach((boundaryId) => {
      if (!boundaryIds.has(boundaryId)) errors.push(`View ${view.id} references missing boundary ${boundaryId}`);
      if (!view.layout?.boundaries?.[boundaryId]) errors.push(`View ${view.id} is missing layout coordinates for boundary ${boundaryId}`);
    });

    Object.keys(view.layout?.nodes || {}).forEach((nodeId) => {
      if (!viewNodeSet.has(nodeId)) errors.push(`View ${view.id} layout.nodes contains undeclared node ${nodeId}`);
    });

    Object.keys(view.layout?.boundaries || {}).forEach((boundaryId) => {
      if (!viewBoundarySet.has(boundaryId)) errors.push(`View ${view.id} layout.boundaries contains undeclared boundary ${boundaryId}`);
    });
  });

  return errors;
}

function normalizeArchitectureManifest(manifest) {
  return {
    ...manifest,
    nodeById: new Map((manifest.nodes || []).map((node) => [node.id, node])),
    edgeById: new Map((manifest.edges || []).map((edge) => [edge.id, edge])),
    boundaryById: new Map((manifest.boundaries || []).map((boundary) => [boundary.id, boundary])),
    viewById: new Map((manifest.views || []).map((view) => [view.id, view]))
  };
}

function getArchitectureCurrentView() {
  return architectureState.manifest?.viewById?.get(architectureState.activeViewId) || null;
}

function getArchitectureCurrentNode(view = getArchitectureCurrentView()) {
  const renderModel = architectureState.renderModel || (architectureState.manifest && view ? buildArchitectureViewModel(architectureState.manifest, view) : null);
  if (!renderModel) return null;
  if (architectureState.selectedNodeId && renderModel.nodeById.has(architectureState.selectedNodeId)) {
    return renderModel.nodeById.get(architectureState.selectedNodeId) || null;
  }
  return renderModel.nodes[0] || null;
}

function setArchitectureSelection(nodeId) {
  const renderModel = architectureState.renderModel || (architectureState.manifest ? buildArchitectureViewModel(architectureState.manifest, getArchitectureCurrentView()) : null);
  if (!renderModel?.nodeById.has(nodeId)) return;
  architectureState.selectedNodeId = nodeId;
  renderArchitecture();
}

function setArchitectureView(viewId) {
  if (!architectureState.manifest?.viewById?.has(viewId)) return;
  architectureState.activeViewId = viewId;
  const view = getArchitectureCurrentView();
  architectureState.renderModel = view ? buildArchitectureViewModel(architectureState.manifest, view) : null;
  if (!architectureState.renderModel?.nodeById.has(architectureState.selectedNodeId)) {
    architectureState.selectedNodeId = architectureState.renderModel?.nodes?.[0]?.id || null;
  }
  renderArchitecture();
}

function setArchitectureVerifiedOnly(nextValue) {
  architectureState.verifiedOnly = nextValue;
  renderArchitecture();
}

async function loadArchitectureManifest(options = {}) {
  if (!options.force && architectureState.status === "ready" && architectureState.manifest) {
    return architectureState.manifest;
  }

  if (!options.force && architectureState.status === "unavailable") {
    return Promise.reject(new Error(architectureState.error || "Architecture manifest unavailable"));
  }

  if (architectureState.loadingPromise && !options.force) return architectureState.loadingPromise;

  if (options.force) {
    architectureState.status = "idle";
    architectureState.manifest = null;
    architectureState.error = "";
    architectureState.loadingPromise = null;
    architectureState.renderModel = null;
  }

  architectureState.status = "loading";
  architectureState.error = "";
  renderArchitecture();

  const request = fetchLocalJson(architectureManifestUrl)
    .then((manifest) => {
      if (manifest?.unavailable === true) {
        throw new Error(manifest?.message || "Architecture manifest was marked unavailable.");
      }

      const validationErrors = validateArchitectureManifest(manifest);
      if (validationErrors.length) {
        throw new Error(`Manifest validation failed: ${validationErrors[0]}`);
      }

      architectureState.manifest = normalizeArchitectureManifest(manifest);
      architectureState.status = "ready";
      architectureState.activeViewId = architectureState.manifest.views?.[0]?.id || null;
      architectureState.selectedNodeId = null;
      architectureState.error = "";
      architectureState.loadingPromise = null;
      architectureState.renderModel = null;
      renderArchitecture();
      return architectureState.manifest;
    })
    .catch((err) => {
      architectureState.status = "unavailable";
      architectureState.manifest = null;
      architectureState.error = err?.message || String(err);
      architectureState.loadingPromise = null;
      architectureState.renderModel = null;
      renderArchitecture();
      throw err;
    });

  architectureState.loadingPromise = request;
  return request;
}

function architectureNodeSummary(node) {
  const verificationLabel = humanizeArchitectureStatus(node?.verification?.status || "unverified");
  return `${node?.label || "Unknown node"}. ${node?.kind || "Node"}. ${verificationLabel}. ${node?.summary || ""}`.trim();
}

function aggregateArchitectureStatus(statuses = []) {
  if (!statuses.length) return "unverified";
  if (statuses.every((status) => status === "verified")) return "verified";
  if (statuses.includes("partially_verified") || (statuses.includes("verified") && statuses.includes("unverified"))) {
    return "partially_verified";
  }
  return statuses[0] || "unverified";
}

function architectureViewLabel(manifest, viewId) {
  return manifest.viewById.get(viewId)?.label || viewId;
}

function architectureBoundaryLabel(manifest, boundaryId) {
  return manifest.boundaryById.get(boundaryId)?.label || "Cross-System";
}

function normalizeArchitectureRenderNode(node, options = {}) {
  return {
    id: node.id,
    label: node.label,
    shortLabel: node.short_label || node.label,
    subtitle: options.subtitle || "",
    kind: options.kind || node.kind,
    summary: options.summary || node.summary || "",
    details: options.details || node.details || "",
    verification: options.verification || node.verification || { status: "unverified", evidence: "", notes: [] },
    files: options.files || node.files || [],
    environmentLabel: options.environmentLabel || "Cross-System",
    memberNodeIds: options.memberNodeIds || [node.id],
    memberLabels: options.memberLabels || [],
    producerItems: [],
    consumerItems: []
  };
}

function buildArchitectureOverviewRenderModel(manifest) {
  const nodes = architectureOverviewGroups.map((group) => {
    const members = group.memberNodeIds.map((nodeId) => manifest.nodeById.get(nodeId)).filter(Boolean);
    const statuses = members.map((node) => node.verification?.status || "unverified");
    return {
      id: group.id,
      label: group.label,
      shortLabel: group.label,
      subtitle: group.subtitle,
      kind: "System Group",
      summary: group.summary,
      details: group.details,
      verification: {
        status: aggregateArchitectureStatus(statuses),
        evidence: `${members.length} repository-backed architecture nodes are represented in this grouped stage.`,
        notes: []
      },
      files: [],
      environmentLabel: group.environmentLabel,
      memberNodeIds: members.map((node) => node.id),
      memberLabels: members.map((node) => node.short_label || node.label),
      producerItems: [],
      consumerItems: []
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `overview_edge_${index + 1}`,
    source: node.id,
    target: nodes[index + 1].id,
    label: index === nodes.length - 2 ? "Feeds research system" : "Feeds next stage",
    verification: { status: "verified" }
  }));

  edges.forEach((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return;
    source.consumerItems.push({ edge, node: target });
    target.producerItems.push({ edge, node: source });
  });

  return {
    type: "overview",
    selectedNodeId: nodeById.has(architectureState.selectedNodeId) ? architectureState.selectedNodeId : nodes[0]?.id || null,
    nodes,
    nodeById,
    edges,
    stages: nodes.map((node, stageIndex) => ({
      id: node.id,
      label: node.label,
      subtitle: node.subtitle,
      boundaryLabel: node.environmentLabel,
      boundaryClass: `architecture-stage-boundary-${String(node.environmentLabel || "cross-system").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      nodes: [node],
      index: stageIndex
    }))
  };
}

function buildArchitectureWaterfallRenderModel(manifest, view, config) {
  const nodes = [];
  const nodeById = new Map();
  const stages = [];

  (config.stages || []).forEach((stage, index) => {
    const stageNodes = (stage.nodeIds || [])
      .map((nodeId) => manifest.nodeById.get(nodeId))
      .filter(Boolean)
      .filter((node) => (view.node_ids || []).includes(node.id))
      .map((node) => normalizeArchitectureRenderNode(node, {
        environmentLabel: architectureBoundaryLabel(manifest, stage.boundaryId)
      }));

    if (!stageNodes.length) return;

    stageNodes.forEach((node) => {
      node.stageId = stage.id;
      nodes.push(node);
      nodeById.set(node.id, node);
    });

    stages.push({
      id: stage.id,
      label: stage.label,
      subtitle: stage.subtitle || "",
      boundaryId: stage.boundaryId,
      boundaryLabel: architectureBoundaryLabel(manifest, stage.boundaryId),
      boundaryClass: `architecture-stage-boundary-${String(stage.boundaryId || "cross-system").replace(/_/g, "-")}`,
      index,
      nodes: stageNodes
    });
  });

  const edges = (view.edge_ids || [])
    .map((edgeId) => manifest.edgeById.get(edgeId))
    .filter(Boolean)
    .filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))
    .filter((edge) => !architectureState.verifiedOnly || edge?.verification?.status === "verified");

  edges.forEach((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return;
    source.consumerItems.push({ edge, node: target });
    target.producerItems.push({ edge, node: source });
  });

  return {
    type: "waterfall",
    selectedNodeId: nodeById.has(architectureState.selectedNodeId) ? architectureState.selectedNodeId : nodes[0]?.id || null,
    nodes,
    nodeById,
    edges,
    stages
  };
}

function buildArchitectureViewModel(manifest, view) {
  if (!manifest || !view) return null;
  if (view.id === "overview-map") return buildArchitectureOverviewRenderModel(manifest);
  const config = architectureWaterfallViewConfigs[view.id] || {
    stages: [{ id: "default", label: view.label, subtitle: view.description || "", boundaryId: view.boundary_ids?.[0] || "n8n_runtime", nodeIds: view.node_ids || [] }]
  };
  return buildArchitectureWaterfallRenderModel(manifest, view, config);
}

function renderArchitectureControlsV2(manifest) {
  return `
    <section class="detail-panel architecture-controls-panel">
      <div class="panel-head compact-panel-head">
        <div>
          <p class="eyebrow">Architecture Views</p>
          <h3>Read-Only Mirror Controls</h3>
        </div>
      </div>
      <div class="architecture-view-groups" data-architecture-view-controls="true">
        ${architectureViewGroups.map((group) => `
          <section class="architecture-view-group">
            <h4>${escapeHtml(group.label)}</h4>
            <div class="architecture-view-group-row">
              ${group.viewIds.map((viewId) => `
                <button
                  type="button"
                  class="architecture-view-button ${viewId === architectureState.activeViewId ? "active" : ""}"
                  data-architecture-view="${escapeHtml(viewId)}"
                  aria-pressed="${viewId === architectureState.activeViewId ? "true" : "false"}"
                >${escapeHtml(architectureViewLabel(manifest, viewId))}</button>
              `).join("")}
            </div>
          </section>
        `).join("")}
      </div>
      <div class="architecture-filter-row">
        <button
          type="button"
          class="architecture-filter-button ${architectureState.verifiedOnly ? "active" : ""}"
          data-architecture-filter="verified-only"
          aria-pressed="${architectureState.verifiedOnly ? "true" : "false"}"
        >${architectureState.verifiedOnly ? "Showing verified links only" : "Show verified links only"}</button>
        <span class="architecture-filter-copy">Node labels always show verification state. The filter only hides non-verified relationships.</span>
      </div>
    </section>
  `;
}

function renderConfidenceCalibrationDirectionAccuracy(row = {}, directionKey = "bullish") {
  const value = directionKey === "bullish" ? row.bullish_accuracy_pct : row.bearish_accuracy_pct;
  return metricAvailable(value) ? percentValue(value) : displayDash();
}

function renderConfidenceCalibrationBucketTable(entity = {}) {
  return renderResearchBreakdownTable(`${entity.entity_label || "Entity"} confidence buckets`, "Confidence Calibration", entity.bucket_rows || [], [
    { label: "Bucket", render: row => researchDataCell(row.bucket_label, `${row.bucket_min_confidence_pct}-${row.bucket_max_confidence_pct}%`) },
    { label: "Rows", render: row => researchDataCell(row.total_rows, `${row.directional_calls} directional · ${row.no_calls} no-call`) },
    { label: "Results", render: row => researchDataCell(`${row.correct} / ${row.wrong} / ${row.flat}`, "correct / wrong / flat") },
    { label: "Ex-Flat", render: row => researchDataCell(metricAvailable(row.ex_flat_win_rate_pct) ? percentValue(row.ex_flat_win_rate_pct) : displayDash(), metricAvailable(row.calibration_gap_pct) ? `${signedMetricValue(row.calibration_gap_pct, " pp")} gap` : "Gap n/a") },
    { label: "Incl. Flat", render: row => researchDataCell(metricAvailable(row.all_outcome_accuracy_pct) ? percentValue(row.all_outcome_accuracy_pct) : displayDash(), metricAvailable(row.flat_rate_pct) ? `${percentValue(row.flat_rate_pct)} flat` : "Flat n/a") },
    { label: "Bull / Bear", render: row => researchDataCell(renderConfidenceCalibrationDirectionAccuracy(row, "bullish"), `${renderConfidenceCalibrationDirectionAccuracy(row, "bearish")} bear`) },
    { label: "Return", render: row => researchDataCell(metricAvailable(row.average_normalized_return_pct) ? `${row.average_normalized_return_pct}% avg` : displayDash(), metricAvailable(row.median_normalized_return_pct) ? `${row.median_normalized_return_pct}% median` : "Median n/a") },
    { label: "Mean Conf.", render: row => researchDataCell(metricAvailable(row.mean_confidence_pct) ? percentValue(row.mean_confidence_pct) : displayDash(), row.sample_size_warning?.label ? formatReviewLabel(row.sample_size_warning.label) : "Sample n/a") },
    { label: "Chron. Folds", render: row => researchDataCell(formatReviewLabel(row.chronological_fold_consistency?.label || "not_available"), metricAvailable(row.chronological_fold_consistency?.spread_pct_points) ? `${row.chronological_fold_consistency.spread_pct_points} pp spread` : "Spread n/a") }
  ], {
    description: entity.note || "Confidence buckets stay diagnostic only and remain tied to the checked-in following-24hrs checker contract."
  });
}

function renderConfidenceCalibrationStrengthTable(entity = {}) {
  return renderResearchBreakdownTable(`${entity.entity_label || "Entity"} strength bands`, "Strength Calibration", entity.strength_band_rows || [], [
    { label: "Strength", render: row => researchDataCell(row.strength_label, `${row.directional_calls} directional`) },
    { label: "Rows", render: row => researchDataCell(row.total_rows, `${row.no_calls} no-call`) },
    { label: "Results", render: row => researchDataCell(`${row.correct} / ${row.wrong} / ${row.flat}`, "correct / wrong / flat") },
    { label: "Ex-Flat", render: row => researchDataCell(metricAvailable(row.ex_flat_win_rate_pct) ? percentValue(row.ex_flat_win_rate_pct) : displayDash(), metricAvailable(row.all_outcome_accuracy_pct) ? `${percentValue(row.all_outcome_accuracy_pct)} incl. flat` : "Incl. flat n/a") }
  ], {
    description: "Strength rows use the exact current production strength contract for the relevant layer rather than a new calibration-specific threshold set."
  });
}

function renderConfidenceCalibrationEntitySection(entity = {}) {
  const monotonic = entity.monotonic_accuracy || {};
  const reliability = entity.reliability_summary || {};
  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">${escapeHtml(entity.entity_type || "Calibration")}</p>
          <h3>${escapeHtml(entity.entity_label || "Confidence calibration")}</h3>
        </div>
        <p class="research-panel-copy">${escapeHtml(entity.note || "Read-only calibration diagnostic built from the current checked-in research outputs.")}</p>
      </div>
      <section class="backtest-grid three-column research-summary-grid">
        ${renderBacktestKpiMetric("Rows", renderSimpleMetricValue(entity.rows_with_bucket), `${renderSimpleMetricValue(entity.rows_without_bucket)} without confidence bucket`, "Rows in the current checked-in artifact for this entity")}
        ${renderBacktestKpiMetric("Monotonicity", formatReviewLabel(monotonic.label || "not_available"), monotonic.monotonic === null ? "Insufficient data" : (monotonic.monotonic ? "No decreasing bucket step" : `${monotonic.breaks?.length || 0} break(s)`), "Whether ex-flat accuracy rose monotonically as confidence increased")}
        ${renderBacktestKpiMetric("Reliability", formatReviewLabel(reliability.ordinal_conviction_label || "not_available"), formatReviewLabel(reliability.probability_label || "not_available"), "Ordinal-vs-probability diagnostic only; not a production recalibration")}
      </section>
      ${renderConfidenceCalibrationBucketTable(entity)}
      ${renderConfidenceCalibrationStrengthTable(entity)}
    </section>
  `;
}

function renderConfidenceCalibrationSummary(payload = {}) {
  const layer1Pooled = payload.layer1?.pooled || {};
  const layer2Pooled = payload.layer2?.pooled || {};
  const existingAudit = payload.existing_analysis_audit || {};
  const layer1Assets = Object.values(payload.layer1?.assets || {});
  const layer2Pairs = Object.values(payload.layer2?.pairs || {});

  if (payload.meta?.error) {
    return `
      <section class="research-section">
        <div class="research-section-head">
          <div>
            <p class="eyebrow">Confidence Calibration</p>
            <h3>Local calibration artifact unavailable</h3>
          </div>
          <p class="research-panel-copy">${escapeHtml(payload.meta.error || "Confidence calibration artifact unavailable.")}</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="research-section">
      <div class="research-section-head">
        <div>
          <p class="eyebrow">Confidence Calibration</p>
          <h3>Research-only confidence-band calibration on the current checker contract</h3>
        </div>
        <p class="research-panel-copy">${escapeHtml(payload.outcome_contract_note || "Diagnostic only. No production confidence mapping or threshold change is implied.")}</p>
      </div>
      <section class="backtest-grid three-column research-summary-grid">
        ${renderBacktestKpiMetric("Version", payload.version || "Not yet available", payload.timeframe || "", "Local artifact contract for calibration diagnostics")}
        ${renderBacktestKpiMetric("Layer 1 Pooled", metricAvailable(layer1Pooled.reliability_summary?.average_absolute_calibration_gap_pct_points) ? `${layer1Pooled.reliability_summary.average_absolute_calibration_gap_pct_points} pp avg gap` : displayDash(), formatReviewLabel(layer1Pooled.monotonic_accuracy?.label || "not_available"), "Pooled Layer 1 calibration across all five checker artifacts")}
        ${renderBacktestKpiMetric("Layer 2 Pooled", metricAvailable(layer2Pooled.reliability_summary?.average_absolute_calibration_gap_pct_points) ? `${layer2Pooled.reliability_summary.average_absolute_calibration_gap_pct_points} pp avg gap` : displayDash(), formatReviewLabel(layer2Pooled.monotonic_accuracy?.label || "not_available"), "Pooled Layer 2 calibration across reconstructed historically emitted pair calls")}
      </section>
      ${renderResearchBreakdownTable("What already existed before this artifact", "Calibration Audit", (existingAudit.existing_dashboard_views || []).map((item, index) => ({ id: index + 1, text: item })), [
        { label: "Existing", render: row => researchDataCell(row.id, row.text) }
      ], {
        description: "The dashboard already had confidence-oriented research views, but they were not sufficient to establish calibration."
      })}
      ${renderResearchBreakdownTable("What was missing before this artifact", "Calibration Audit", (existingAudit.missing_before_this_artifact || []).map((item, index) => ({ id: index + 1, text: item })), [
        { label: "Missing", render: row => researchDataCell(row.id, row.text) }
      ], {
        description: "These gaps are what this local artifact closes without changing production scoring."
      })}
      ${renderConfidenceCalibrationEntitySection(layer1Pooled)}
      ${layer1Assets.map(renderConfidenceCalibrationEntitySection).join("")}
      ${renderConfidenceCalibrationEntitySection(layer2Pooled)}
      ${layer2Pairs.map(renderConfidenceCalibrationEntitySection).join("")}
    </section>
  `;
}

function renderArchitectureLegendV2() {
  return `
    <details class="detail-panel architecture-legend-panel" data-architecture-legend="true">
      <summary class="architecture-legend-summary">
        <span>How to read this map</span>
        <span class="architecture-legend-summary-copy">Compact legend for statuses, links, and boundaries</span>
      </summary>
      <div class="architecture-legend-compact-grid">
        <div class="architecture-legend-swatch architecture-status-verified"><strong>Verified</strong><span>Direct repository evidence</span></div>
        <div class="architecture-legend-swatch architecture-status-partially_verified"><strong>Partially Verified</strong><span>Scope verified, boundary incomplete</span></div>
        <div class="architecture-legend-swatch architecture-status-unverified"><strong>Unverified</strong><span>Explicitly uncertain relationship</span></div>
        <div class="architecture-legend-line architecture-legend-line-verified"><strong>Stage connector</strong><span>Top-to-bottom flow between stages</span></div>
        <div class="architecture-legend-line architecture-legend-line-unverified"><strong>Verified-only filter</strong><span>Non-verified relationships hide from highlights and detail lists</span></div>
        <div class="architecture-legend-boundary"><strong>Boundary badge</strong><span>Each stage shows its primary environment or surface</span></div>
      </div>
    </details>
  `;
}

function renderArchitectureDetailListV2(items, emptyText) {
  if (!items.length) return `<p class="architecture-detail-empty">${escapeHtml(emptyText)}</p>`;
  return `
    <ul class="architecture-detail-list">
      ${items.map((item) => `
        <li>
          <strong>${escapeHtml(item.node?.label || item.label || "Unknown")}</strong>
          <span>${escapeHtml(item.edge ? `${item.edge.label} · ${humanizeArchitectureStatus(item.edge.verification?.status || "unverified")}` : (item.description || ""))}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderArchitectureDetailSectionV2(title, body, open = false) {
  return `
    <details class="architecture-detail-section" ${open ? "open" : ""}>
      <summary>${escapeHtml(title)}</summary>
      <div class="architecture-detail-section-body">${body}</div>
    </details>
  `;
}

function renderArchitectureDetailV2(renderModel) {
  const selectedNode = getArchitectureCurrentNode();
  if (!selectedNode) {
    return `
      <section class="detail-panel architecture-detail-panel" data-architecture-detail="true">
        <div class="empty-state architecture-empty-state">No selectable node was available for this architecture view.</div>
      </section>
    `;
  }

  const includedSystems = (selectedNode.memberLabels || []).map((label) => ({ label, description: "" }));
  return `
    <section class="detail-panel architecture-detail-panel" data-architecture-detail="true">
      <div class="panel-head compact-panel-head architecture-detail-head">
        <div>
          <p class="eyebrow">Selected Node</p>
          <h3>${escapeHtml(selectedNode.label)}</h3>
        </div>
        <div class="architecture-detail-badges">
          <span class="architecture-chip">${escapeHtml(selectedNode.kind || "")}</span>
          <span class="architecture-chip">${escapeHtml(selectedNode.environmentLabel || "Cross-System")}</span>
          <span class="architecture-chip architecture-chip-status architecture-status-${escapeHtml(selectedNode.verification?.status || "unverified")}">${escapeHtml(humanizeArchitectureStatus(selectedNode.verification?.status || "unverified"))}</span>
        </div>
      </div>
      <div class="architecture-detail-grid">
        <div class="architecture-detail-card">
          <h4>Purpose and Process</h4>
          <p class="architecture-detail-summary">${escapeHtml(selectedNode.summary || "No summary recorded.")}</p>
          <p>${escapeHtml(selectedNode.details || "No additional detail recorded.")}</p>
        </div>
        <div class="architecture-detail-card">
          <h4>Inputs and Upstream Producers</h4>
          ${renderArchitectureDetailListV2(selectedNode.producerItems || [], "No upstream producers in this view.")}
        </div>
        <div class="architecture-detail-card">
          <h4>Outputs and Downstream Consumers</h4>
          ${renderArchitectureDetailListV2(selectedNode.consumerItems || [], "No downstream consumers in this view.")}
        </div>
      </div>
      <div class="architecture-detail-sections">
        ${renderArchitectureDetailSectionV2("Implementation Files", Array.isArray(selectedNode.files) && selectedNode.files.length
          ? `<ul class="architecture-detail-list">${selectedNode.files.map((file) => `<li>${escapeHtml(file)}</li>`).join("")}</ul>`
          : `<p class="architecture-detail-empty">No direct file list is shown for this grouped or derived node.</p>`)}
        ${renderArchitectureDetailSectionV2("Included Systems", renderArchitectureDetailListV2(includedSystems, "No grouped systems recorded for this node."), renderModel.type === "overview")}
        ${renderArchitectureDetailSectionV2("Verification Evidence", `
          <p>${escapeHtml(selectedNode.verification?.evidence || "No evidence recorded.")}</p>
          ${Array.isArray(selectedNode.verification?.notes) && selectedNode.verification.notes.length
            ? `<ul class="architecture-detail-list">${selectedNode.verification.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
            : `<p class="architecture-detail-empty">No additional verification notes were recorded.</p>`}
        `)}
      </div>
    </section>
  `;
}

function renderArchitectureCanvasV2(view, renderModel) {
  const stagesMarkup = (renderModel.stages || []).map((stage, stageIndex) => {
    const stageStatuses = stage.nodes.map((node) => node.verification?.status || "unverified");
    const stageStatus = aggregateArchitectureStatus(stageStatuses);
    const nodeMarkup = stage.nodes.map((node) => {
      const relationshipLabel = node.id === renderModel.selectedNodeId
        ? "Selected"
        : (node.producerItems || []).some((entry) => entry.node?.id === renderModel.selectedNodeId)
          ? "Feeds selected"
          : (node.consumerItems || []).some((entry) => entry.node?.id === renderModel.selectedNodeId)
            ? "Used by selected"
            : "";
      const classes = [
        "architecture-node",
        `architecture-node-status-${node?.verification?.status || "unverified"}`,
        node.id === renderModel.selectedNodeId ? "is-selected" : "",
        relationshipLabel ? "is-connected" : ""
      ].filter(Boolean).join(" ");

      return `
        <button
          type="button"
          class="${classes}"
          data-architecture-node="${escapeHtml(node.id)}"
          data-architecture-node-kind="${escapeHtml(node.kind || "")}"
          aria-label="${escapeHtml(architectureNodeSummary(node))}"
          title="${escapeHtml(architectureNodeSummary(node))}"
        >
          <span class="architecture-node-title">${escapeHtml(node.shortLabel || node.label)}</span>
          <span class="architecture-node-purpose">${escapeHtml(node.summary || node.details || "No summary recorded.")}</span>
          <span class="architecture-node-meta">
            <span>${escapeHtml(node.kind)}</span>
            <span>${escapeHtml(node.environmentLabel || "Cross-System")}</span>
          </span>
          <span class="architecture-node-badge-row">
            <span class="architecture-node-badge architecture-node-badge-status architecture-status-${escapeHtml(node.verification?.status || "unverified")}">${escapeHtml(humanizeArchitectureStatus(node.verification?.status || "unverified"))}</span>
            ${relationshipLabel ? `<span class="architecture-node-badge architecture-node-badge-relationship">${escapeHtml(relationshipLabel)}</span>` : ""}
          </span>
        </button>
      `;
    }).join("");

    return `
      <section
        class="architecture-stage ${escapeHtml(stage.boundaryClass || "")}"
        data-architecture-stage="${escapeHtml(stage.id)}"
        data-architecture-stage-index="${stageIndex}"
      >
        <div class="architecture-stage-head">
          <div>
            <p class="architecture-stage-heading">${escapeHtml(stage.label)}</p>
            ${stage.subtitle ? `<p class="architecture-stage-subtitle">${escapeHtml(stage.subtitle)}</p>` : ""}
          </div>
          <div class="architecture-stage-badges">
            <span class="architecture-chip">${escapeHtml(stage.boundaryLabel || "Cross-System")}</span>
            <span class="architecture-chip architecture-chip-status architecture-status-${escapeHtml(stageStatus)}">${escapeHtml(humanizeArchitectureStatus(stageStatus))}</span>
          </div>
        </div>
        <div class="architecture-stage-grid" data-architecture-stage-grid="true" data-architecture-stage-count="${stage.nodes.length}">
          ${nodeMarkup}
        </div>
      </section>
      ${stageIndex < renderModel.stages.length - 1 ? `
        <div class="architecture-stage-connector" aria-hidden="true">
          <span class="architecture-stage-connector-line"></span>
          <span class="architecture-stage-connector-arrow"></span>
        </div>
      ` : ""}
    `;
  }).join("");
  return `
    <section class="detail-panel architecture-canvas-panel">
      <div class="panel-head compact-panel-head architecture-canvas-head">
        <div>
          <p class="eyebrow">Architecture Canvas</p>
          <h3>${escapeHtml(view.label)}</h3>
        </div>
        <span class="architecture-canvas-summary">${escapeHtml(view.description || "")}</span>
      </div>
      <div class="architecture-canvas-shell" data-architecture-shell="true">
        <div class="architecture-canvas" data-architecture-canvas="true" data-architecture-view-id="${escapeHtml(view.id)}" role="img" aria-label="${escapeHtml(`${view.label}. ${view.description}`)}">
          <div class="architecture-stage-stack">
            ${stagesMarkup}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderArchitectureUnavailable(message) {
  return `
    <section class="detail-panel architecture-unavailable-panel" data-architecture-state="unavailable">
      <div class="panel-head compact-panel-head">
        <div>
          <p class="eyebrow">Architecture</p>
          <h3>Architecture view unavailable</h3>
        </div>
      </div>
      <div class="empty-state architecture-empty-state">
        The Architecture tab could not load a valid manifest. Other dashboard tabs remain unaffected.
      </div>
      <div class="architecture-error-copy">${escapeHtml(message || "No manifest error detail was available.")}</div>
    </section>
  `;
}


function renderArchitectureEdgeList(title, edges, direction = "consumer") {
  if (!edges.length) {
    return `
      <div class="architecture-detail-block">
        <h4>${escapeHtml(title)}</h4>
        <p class="architecture-detail-empty">None in this view.</p>
      </div>
    `;
  }

  return `
    <div class="architecture-detail-block">
      <h4>${escapeHtml(title)}</h4>
      <ul class="architecture-detail-list">
        ${edges.map(({ edge, node }) => `
          <li>
            <strong>${escapeHtml(node?.label || "Unknown")}</strong>
            <span>${escapeHtml(direction === "producer" ? "Feeds" : "Uses")} via ${escapeHtml(edge.label || "")} · ${escapeHtml(humanizeArchitectureStatus(edge?.verification?.status || ""))}</span>
          </li>
        `).join("")}
      </ul>
    </div>
  `;
}

function renderArchitectureDetail(manifest, view, visibleEdges) {
  const selectedNode = getArchitectureCurrentNode(view);
  if (!selectedNode) {
    return `
      <section class="detail-panel architecture-detail-panel">
        <div class="empty-state architecture-empty-state">No selectable node was available for this architecture view.</div>
      </section>
    `;
  }

  const incoming = visibleEdges
    .filter((edge) => edge.target === selectedNode.id)
    .map((edge) => ({ edge, node: manifest.nodeById.get(edge.source) }))
    .filter((entry) => entry.node);
  const outgoing = visibleEdges
    .filter((edge) => edge.source === selectedNode.id)
    .map((edge) => ({ edge, node: manifest.nodeById.get(edge.target) }))
    .filter((entry) => entry.node);

  return `
    <section class="detail-panel architecture-detail-panel" data-architecture-detail="true">
      <div class="panel-head compact-panel-head">
        <div>
          <p class="eyebrow">Selected Node</p>
          <h3>${escapeHtml(selectedNode.label)}</h3>
        </div>
        <div class="architecture-detail-badges">
          <span class="architecture-chip">${escapeHtml(selectedNode.kind || "")}</span>
          <span class="architecture-chip architecture-chip-status architecture-status-${escapeHtml(selectedNode.verification?.status || "unverified")}">${escapeHtml(humanizeArchitectureStatus(selectedNode.verification?.status || "unverified"))}</span>
        </div>
      </div>
      <p class="architecture-detail-summary">${escapeHtml(selectedNode.summary || "")}</p>
      <div class="architecture-detail-block">
        <h4>Details</h4>
        <p>${escapeHtml(selectedNode.details || "No additional detail recorded.")}</p>
      </div>
      <div class="architecture-detail-block">
        <h4>Verification</h4>
        <p>${escapeHtml(selectedNode.verification?.evidence || "No evidence recorded.")}</p>
        ${(selectedNode.verification?.notes || []).length ? `
          <ul class="architecture-detail-list">
            ${(selectedNode.verification.notes || []).map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
          </ul>
        ` : ""}
      </div>
      ${renderArchitectureNodeFiles(selectedNode)}
      ${renderArchitectureEdgeList("Upstream Producers", incoming, "producer")}
      ${renderArchitectureEdgeList("Downstream Consumers", outgoing, "consumer")}
    </section>
  `;
}

function renderArchitectureCanvas(manifest, view) {
  const selectedNode = getArchitectureCurrentNode(view);
  const visibleEdges = (view.edge_ids || [])
    .map((edgeId) => manifest.edgeById.get(edgeId))
    .filter(Boolean)
    .filter((edge) => !architectureState.verifiedOnly || edge?.verification?.status === "verified");
  const selectedNodeId = selectedNode?.id || null;
  const connectedOutgoing = new Set(visibleEdges.filter((edge) => edge.source === selectedNodeId).map((edge) => edge.target));
  const connectedIncoming = new Set(visibleEdges.filter((edge) => edge.target === selectedNodeId).map((edge) => edge.source));
  const highlightedEdgeIds = new Set(visibleEdges
    .filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId)
    .map((edge) => edge.id));

  const edgeMarkup = visibleEdges.map((edge) => {
    const source = view.layout.nodes?.[edge.source];
    const target = view.layout.nodes?.[edge.target];
    if (!source || !target) return "";
    const classes = [
      "architecture-edge",
      `architecture-edge-status-${edge?.verification?.status || "unverified"}`,
      highlightedEdgeIds.has(edge.id) ? "is-highlighted" : ""
    ].filter(Boolean).join(" ");
    return `
      <line
        class="${classes}"
        x1="${source.x}"
        y1="${source.y}"
        x2="${target.x}"
        y2="${target.y}"
        marker-end="url(#architectureArrow)"
      ></line>
    `;
  }).join("");

  const boundaryMarkup = (view.boundary_ids || []).map((boundaryId) => {
    const boundary = manifest.boundaryById.get(boundaryId);
    const layout = view.layout.boundaries?.[boundaryId];
    if (!boundary || !layout) return "";
    return `
      <g class="architecture-boundary-group">
        <rect class="architecture-boundary-box" x="${layout.x}" y="${layout.y}" width="${layout.width}" height="${layout.height}" rx="18"></rect>
        <text class="architecture-boundary-label" x="${layout.x + 18}" y="${layout.y + 28}">${escapeHtml(boundary.label)}</text>
      </g>
    `;
  }).join("");

  const nodeMarkup = (view.node_ids || []).map((nodeId) => {
    const node = manifest.nodeById.get(nodeId);
    const layout = view.layout.nodes?.[nodeId];
    if (!node || !layout) return "";
    const relationshipLabel = nodeId === selectedNodeId
      ? "Selected"
      : connectedOutgoing.has(nodeId)
        ? "Consumes"
        : connectedIncoming.has(nodeId)
          ? "Produces"
          : "";
    const classes = [
      "architecture-node",
      `architecture-node-status-${node?.verification?.status || "unverified"}`,
      nodeId === selectedNodeId ? "is-selected" : "",
      connectedOutgoing.has(nodeId) ? "is-consumer" : "",
      connectedIncoming.has(nodeId) ? "is-producer" : ""
    ].filter(Boolean).join(" ");

    return `
      <button
        type="button"
        class="${classes}"
        data-architecture-node="${escapeHtml(nodeId)}"
        style="left:${(layout.x / view.layout.width) * 100}%; top:${(layout.y / view.layout.height) * 100}%;"
        aria-label="${escapeHtml(architectureNodeSummary(node))}"
        title="${escapeHtml(architectureNodeSummary(node))}"
      >
        <span class="architecture-node-title">${escapeHtml(node.short_label || node.label)}</span>
        <span class="architecture-node-meta">
          <span>${escapeHtml(node.kind)}</span>
          <span>${escapeHtml(humanizeArchitectureStatus(node.verification?.status || "unverified"))}</span>
        </span>
        ${relationshipLabel ? `<span class="architecture-node-relationship">${escapeHtml(relationshipLabel)}</span>` : ""}
      </button>
    `;
  }).join("");

  return {
    visibleEdges,
    markup: `
      <section class="detail-panel architecture-canvas-panel">
        <div class="panel-head compact-panel-head">
          <div>
            <p class="eyebrow">Architecture Canvas</p>
            <h3>${escapeHtml(view.label)}</h3>
          </div>
          <span class="architecture-canvas-summary">${escapeHtml(view.description || "")}</span>
        </div>
        <div class="architecture-canvas-shell">
          <div
            class="architecture-canvas"
            data-architecture-canvas="true"
            style="--architecture-aspect:${escapeHtml(String(view.layout.width))} / ${escapeHtml(String(view.layout.height))};"
          >
            <svg
              class="architecture-canvas-svg"
              viewBox="0 0 ${view.layout.width} ${view.layout.height}"
              role="img"
              aria-label="${escapeHtml(`${view.label}. ${view.description}`)}"
            >
              <defs>
                <marker id="architectureArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" class="architecture-arrow-head"></path>
                </marker>
              </defs>
              ${boundaryMarkup}
              ${edgeMarkup}
            </svg>
            <div class="architecture-node-layer">
              ${nodeMarkup}
            </div>
          </div>
        </div>
      </section>
    `
  };
}

function renderArchitecture() {
  const panel = document.getElementById("architecturePanel");
  const updated = document.getElementById("architectureUpdated");
  if (!panel) return;

  if (updated) {
    if (architectureState.status === "ready") {
      const verifiedAt = architectureState.manifest?.metadata?.last_verified_at || "unknown";
      updated.textContent = `Manifest verified: ${verifiedAt}`;
    } else if (architectureState.status === "loading") {
      updated.textContent = "Loading architecture manifest...";
    } else if (architectureState.status === "unavailable") {
      updated.textContent = "Architecture manifest unavailable";
    } else {
      updated.textContent = "Architecture manifest pending";
    }
  }

  if (architectureState.status === "loading") {
    panel.innerHTML = `
      <section class="detail-panel architecture-loading-panel" data-architecture-state="loading">
        <div class="empty-state architecture-empty-state">Loading the checked-in Architecture Mirror manifest...</div>
      </section>
    `;
    return;
  }

  if (architectureState.status === "idle") {
    panel.innerHTML = `
      <section class="detail-panel architecture-loading-panel" data-architecture-state="loading">
        <div class="empty-state architecture-empty-state">Architecture manifest is ready to load when this tab is opened.</div>
      </section>
    `;
    return;
  }

  if (architectureState.status !== "ready" || !architectureState.manifest) {
    panel.innerHTML = renderArchitectureUnavailable(architectureState.error);
    return;
  }

  const manifest = architectureState.manifest;
  const view = getArchitectureCurrentView();
  if (!view) {
    panel.innerHTML = renderArchitectureUnavailable("No architecture view definitions were available.");
    return;
  }

  architectureState.renderModel = buildArchitectureViewModel(manifest, view);
  if (!architectureState.renderModel?.nodeById.has(architectureState.selectedNodeId)) {
    architectureState.selectedNodeId = architectureState.renderModel?.nodes?.[0]?.id || null;
  }
  architectureState.renderModel.selectedNodeId = architectureState.selectedNodeId;

  panel.innerHTML = `
    ${renderArchitectureControlsV2(manifest)}
    ${renderArchitectureCanvasV2(view, architectureState.renderModel)}
    ${renderArchitectureDetailV2(architectureState.renderModel)}
    ${renderArchitectureLegendV2()}
  `;
}

function setupArchitectureControls() {
  const panel = document.getElementById("architecturePanel");
  if (!panel) return;

  panel.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-architecture-view]");
    if (viewButton) {
      setArchitectureView(viewButton.dataset.architectureView || "");
      return;
    }

    const nodeButton = event.target.closest("[data-architecture-node]");
    if (nodeButton) {
      setArchitectureSelection(nodeButton.dataset.architectureNode || "");
      return;
    }

    const filterButton = event.target.closest("[data-architecture-filter='verified-only']");
    if (filterButton) {
      setArchitectureVerifiedOnly(!architectureState.verifiedOnly);
    }
  });

  panel.addEventListener("keydown", (event) => {
    const nodeButton = event.target.closest("[data-architecture-node]");
    if (!nodeButton) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setArchitectureSelection(nodeButton.dataset.architectureNode || "");
    }
  });
}

function setTab(tab) {
  const availableTabs = getAvailableTopLevelTabs();
  const fallbackTab = availableTabs.includes("overview") ? "overview" : (availableTabs[0] || "overview");
  activeTab = availableTabs.includes(tab) ? tab : fallbackTab;
  saveNavigationState();

  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === activeTab);
  });

  const overviewView = document.getElementById("overviewView");
  const layer2View = document.getElementById("layer2View");
  const backtestView = document.getElementById("backtestView");
  const factorEdgeLabView = document.getElementById("factorEdgeLabView");
  const shadowLogicBacktestView = document.getElementById("shadowLogicBacktestView");
  const architectureView = document.getElementById("architectureView");
  const agentView = document.getElementById("agentView");

  if (overviewView) overviewView.classList.toggle("active-view", activeTab === "overview");
  if (layer2View) layer2View.classList.toggle("active-view", activeTab === "layer2");
  if (backtestView) backtestView.classList.toggle("active-view", activeTab === "backtest");
  if (factorEdgeLabView) factorEdgeLabView.classList.toggle("active-view", activeTab === "factor-edge-lab");
  if (shadowLogicBacktestView) shadowLogicBacktestView.classList.toggle("active-view", activeTab === "shadow-logic-backtest");
  if (architectureView) architectureView.classList.toggle("active-view", activeTab === "architecture");
  if (agentView) agentView.classList.toggle("active-view", orderedAgents.includes(activeTab));

  if (orderedAgents.includes(activeTab)) renderAgentDetail(activeTab);
  if (activeTab === "backtest") renderBacktest(backtestData || {});
  if (activeTab === "factor-edge-lab") renderFactorEdgeLab(factorEdgeLabData || {});
  if (activeTab === "shadow-logic-backtest") renderShadowLogicBacktest(phase2ShadowBacktestData || {});
  if (activeTab === "architecture") {
    renderArchitecture();
    loadArchitectureManifest().catch(() => {});
  }
}

function setBacktestTab(tab, options = {}) {
  const availableTabs = getAvailableBacktestTabs();
  const fallbackTab = availableTabs.includes("accuracy") ? "accuracy" : (availableTabs[0] || "accuracy");
  activeBacktestTab = availableTabs.includes(tab) ? tab : fallbackTab;

  document.querySelectorAll(".subtab-button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.backtestTab === activeBacktestTab);
  });

  saveNavigationState();

  if (!options.skipRender) {
    renderBacktest(backtestData || {});
  }
}

function setupTabs() {
  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  document.querySelectorAll(".subtab-button").forEach(btn => {
    btn.addEventListener("click", () => setBacktestTab(btn.dataset.backtestTab || "accuracy"));
  });
}

function setupBacktestEvidenceControls() {
  const panel = document.getElementById("backtestPanel");
  if (!panel) return;

  panel.addEventListener("click", event => {
    const checkerRow = event.target.closest("[data-checker-row-id]");
    if (checkerRow) {
      activeCheckerRowId = checkerRow.dataset.checkerRowId || null;
      renderBacktest(backtestData || {});
      return;
    }

    const filterButton = event.target.closest("[data-matrix-evidence-filter]");
    if (filterButton) {
      applyMatrixEvidenceFilter(filterButton.dataset.matrixEvidenceFilter || "all");
      return;
    }

    const exportButton = event.target.closest("[data-export-matrix-evidence]");
    if (exportButton) {
      exportMatrixEvidenceCsv(exportButton.dataset.exportMatrixEvidence || "usd-24h");
      return;
    }

    const exportReviewJsonButton = event.target.closest("[data-half-l2l-export-json]");
    if (exportReviewJsonButton) {
      exportDirectionalAccuracyReviewJson(getDirectionalAccuracyArtifact(backtestData || {}));
      return;
    }

    const exportReviewCsvButton = event.target.closest("[data-half-l2l-export-csv]");
    if (exportReviewCsvButton) {
      exportDirectionalAccuracyReviewCsv(getDirectionalAccuracyArtifact(backtestData || {}));
      return;
    }

    const importReviewButton = event.target.closest("[data-half-l2l-import-json]");
    if (importReviewButton) {
      const input = document.getElementById(halfL2lReviewImportInputId);
      if (input) {
        input.value = "";
        input.click();
      }
      return;
    }

    const resetReviewButton = event.target.closest("[data-half-l2l-reset-review]");
    if (resetReviewButton) {
      if (window.confirm("Reset all local manual review state for L2L Directional Accuracy?")) {
        saveDirectionalAccuracyReviewStore({
          artifactSignature: getDirectionalAccuracyReviewSignature(getDirectionalAccuracyArtifact(backtestData || {})),
          staleArtifactSignature: null,
          reviews: {}
        });
        renderBacktest(backtestData || {});
      }
    }
  });

  panel.addEventListener("change", event => {
    const checkerSelect = event.target.closest("[data-checker-row-select]");
    if (checkerSelect) {
      activeCheckerRowId = checkerSelect.value || null;
      renderBacktest(backtestData || {});
      return;
    }

    const filterInput = event.target.closest("[data-half-l2l-filter]");
    if (filterInput) {
      halfL2lExplorerState[filterInput.dataset.halfL2lFilter] = filterInput.value || "";
      renderBacktest(backtestData || {});
      return;
    }

    const verdictInput = event.target.closest("[data-half-l2l-verdict]");
    if (verdictInput) {
      const artifact = getDirectionalAccuracyArtifact(backtestData || {});
      const row = getDirectionalAccuracyRows(backtestData || {}).find(item => item.recordId === verdictInput.dataset.halfL2lVerdict);
      const store = loadDirectionalAccuracyReviewStore(artifact);
      const existing = store.reviews[verdictInput.dataset.halfL2lVerdict] || {};
      store.reviews[verdictInput.dataset.halfL2lVerdict] = {
        ...existing,
        manualVerdict: verdictInput.value || "NOT_CHECKED",
        notes: existing.notes || "",
        reviewTimestamp: new Date().toISOString(),
        backtesterHalfOutcome: row?.outcomes?.HALF_OF_STANDARD?.outcome || null,
        backtesterFullOutcome: row?.outcomes?.FULL_STANDARD?.outcome || null
      };
      saveDirectionalAccuracyReviewStore(store);
      renderBacktest(backtestData || {});
      return;
    }

    if (event.target.id === halfL2lReviewImportInputId && event.target.files?.[0]) {
      const file = event.target.files[0];
      file.text().then((text) => {
        const parsed = JSON.parse(text);
        const reviews = {};
        (parsed?.reviews || []).forEach((review) => {
          if (!review?.recordId) return;
          reviews[review.recordId] = {
            manualVerdict: review.manualVerdict || "NOT_CHECKED",
            notes: review.notes || "",
            reviewTimestamp: review.reviewTimestamp || null,
            backtesterHalfOutcome: review.backtesterHalfOutcome || null,
            backtesterFullOutcome: review.backtesterFullOutcome || null
          };
        });
        saveDirectionalAccuracyReviewStore({
          artifactSignature: getDirectionalAccuracyReviewSignature(getDirectionalAccuracyArtifact(backtestData || {})),
          staleArtifactSignature: parsed?.artifact_signature && parsed.artifact_signature !== getDirectionalAccuracyReviewSignature(getDirectionalAccuracyArtifact(backtestData || {}))
            ? parsed.artifact_signature
            : null,
          reviews
        });
        renderBacktest(backtestData || {});
      }).catch((err) => {
        console.warn("Could not import half-L2L review JSON", err);
      });
    }
  });

  panel.addEventListener("input", event => {
    const filterInput = event.target.closest("[data-half-l2l-filter='search']");
    if (filterInput) {
      halfL2lExplorerState.search = filterInput.value || "";
      renderBacktest(backtestData || {});
      return;
    }

    const notesInput = event.target.closest("[data-half-l2l-notes]");
    if (notesInput) {
      const artifact = getDirectionalAccuracyArtifact(backtestData || {});
      const row = getDirectionalAccuracyRows(backtestData || {}).find(item => item.recordId === notesInput.dataset.halfL2lNotes);
      const store = loadDirectionalAccuracyReviewStore(artifact);
      const existing = store.reviews[notesInput.dataset.halfL2lNotes] || {};
      store.reviews[notesInput.dataset.halfL2lNotes] = {
        ...existing,
        manualVerdict: existing.manualVerdict || "NOT_CHECKED",
        notes: notesInput.value || "",
        reviewTimestamp: existing.reviewTimestamp || null,
        backtesterHalfOutcome: existing.backtesterHalfOutcome || row?.outcomes?.HALF_OF_STANDARD?.outcome || null,
        backtesterFullOutcome: existing.backtesterFullOutcome || row?.outcomes?.FULL_STANDARD?.outcome || null
      };
      saveDirectionalAccuracyReviewStore(store);
    }
  });
}

async function fetchLocalJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} ${response.status}`);
  }
  return response.json();
}

async function fetchResearchView(viewName, options = {}) {
  const url = new URL(`${researchSupabaseUrl}/${viewName}`);
  url.searchParams.set("select", options.select || "*");

  if (options.order) url.searchParams.set("order", options.order);
  if (metricAvailable(options.limit)) url.searchParams.set("limit", String(options.limit));
  if (options.filters) {
    Object.entries(options.filters).forEach(([field, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(field, value);
      }
    });
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      apikey: researchSupabaseKey,
      Authorization: `Bearer ${researchSupabaseKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`${viewName} ${response.status}`);
  }

  return response.json();
}

async function fetchResearchDashboardData() {
  const resolveResearchTask = async (label, task, fallback) => {
    try {
      return await task;
    } catch (err) {
      console.warn(`Could not load research task ${label}`, err);
      return fallback;
    }
  };

  const adrReachResearchPromise = resolveResearchTask("adr_reach_research", fetchLocalJson(adrReachResearchUrl), null);
  const halfL2lReachResearchPromise = resolveResearchTask("half_l2l_reach_research", fetchLocalJson(halfL2lReachResearchUrl), null);
  const confidenceCalibrationPromise = resolveResearchTask("confidence_calibration", fetchLocalJson(confidenceCalibrationUrl), null);
  const matrix24hRowsPromise = resolveResearchTask("research_prediction_usd_benchmark_summary", fetchResearchView("research_prediction_usd_benchmark_summary", {
    select: "snapshot_date,asset_code,timeframe,predicted_direction,agent_direction,agent_conviction,predicted_conviction,headline_confidence_pct,bull_case_pct,bear_case_pct,net_edge_pct,participation_pct,verdict_strength,combined_result,benchmark_market,open_price,close_price,pct_change",
    order: "timeframe.asc,predicted_direction.asc,verdict_strength.asc",
    filters: {
      timeframe: "eq.following 24hrs"
    }
  }), []);
  const eurMatrix24hRowsPromise = resolveResearchTask("research_prediction_evaluations.EUR.24h", fetchResearchView("research_prediction_evaluations", {
    select: "call_date,asset_code,timeframe,agent_direction,agent_conviction,evaluated_market,open_price,close_price,pct_change,result,prediction_id",
    order: "call_date.asc",
    filters: {
      asset_code: "eq.EUR",
      evaluated_market: "eq.EURUSD",
      timeframe: "eq.following 24hrs",
      evaluation_mode: "eq.primary",
      evaluation_version: "eq.phase1_outcome_eval_v1"
    }
  }).then(rows => normalizeMarketEvaluationRows(rows, {
    assetCode: "EUR",
    benchmark: "EURUSD"
  })), []);
  const goldMatrix24hRowsPromise = resolveResearchTask("research_prediction_evaluations.GOLD.24h", fetchResearchView("research_prediction_evaluations", {
    select: "call_date,asset_code,timeframe,agent_direction,agent_conviction,evaluated_market,open_price,close_price,pct_change,result,prediction_id",
    order: "call_date.asc",
    filters: {
      asset_code: "eq.GOLD",
      evaluated_market: "eq.XAUUSD",
      timeframe: "eq.following 24hrs",
      evaluation_mode: "eq.primary",
      evaluation_version: "eq.phase1_outcome_eval_v1"
    }
  }).then(rows => normalizeMarketEvaluationRows(rows, {
    assetCode: "GOLD",
    benchmark: "XAUUSD"
  })), []);
  const nqMatrix24hRowsPromise = resolveResearchTask("research_prediction_evaluations.NQ.24h", fetchResearchView("research_prediction_evaluations", {
    select: "call_date,asset_code,timeframe,agent_direction,agent_conviction,evaluated_market,open_price,close_price,pct_change,result,prediction_id",
    order: "call_date.asc",
    filters: {
      asset_code: "eq.NQ",
      evaluated_market: "eq.QQQ_NQ_PROXY",
      timeframe: "eq.following 24hrs",
      evaluation_mode: "eq.primary",
      evaluation_version: "eq.phase1_outcome_eval_v1"
    }
  }).then(rows => normalizeMarketEvaluationRows(rows, {
    assetCode: "NQ",
    benchmark: "QQQ_NQ_PROXY"
  })), []);
  const btcMatrix24hRowsPromise = resolveResearchTask("research_prediction_evaluations.BTC.24h", fetchResearchView("research_prediction_evaluations", {
    select: "call_date,asset_code,timeframe,agent_direction,agent_conviction,evaluated_market,open_price,close_price,pct_change,result,prediction_id",
    order: "call_date.asc",
    filters: {
      asset_code: "eq.BTC",
      evaluated_market: "eq.BTCUSD",
      timeframe: "eq.following 24hrs",
      evaluation_mode: "eq.primary",
      evaluation_version: "eq.phase1_outcome_eval_v1"
    }
  }).then(rows => normalizeMarketEvaluationRows(rows, {
    assetCode: "BTC",
    benchmark: "BTCUSD"
  })), []);
  const usdCheckerDataPromise = resolveResearchTask("checker.USD", fetchLocalJson(checkerDataUrls.USD), null);
  const eurCheckerDataPromise = resolveResearchTask("checker.EUR", fetchLocalJson(checkerDataUrls.EUR), null);
  const goldCheckerDataPromise = resolveResearchTask("checker.GOLD", fetchLocalJson(checkerDataUrls.GOLD), null);
  const nqCheckerDataPromise = resolveResearchTask("checker.NQ", fetchLocalJson(checkerDataUrls.NQ), null);
  const btcCheckerDataPromise = resolveResearchTask("checker.BTC", fetchLocalJson(checkerDataUrls.BTC), null);

  const [
    overallRows,
    summary24hRows,
    matrix24hRows,
    eurMatrix24hRows,
    goldMatrix24hRows,
    nqMatrix24hRows,
    btcMatrix24hRows,
    verdictStrengthRows,
    confidenceBucketRows,
    tradeQualityRows,
    timeframeRows,
    convictionRows,
    weekdayRows,
    magnitudeRows,
    regimeRows,
    factorReliabilityRows,
    factorContributionRows,
    factorComboRows,
    infrastructureRows,
    usdCheckerData,
    eurCheckerData,
    goldCheckerData,
    nqCheckerData,
    btcCheckerData,
    adrReachResearchData,
    halfL2lReachResearchData,
    confidenceCalibrationData
  ] = await Promise.all([
    resolveResearchTask("research_overall_win_rate", fetchResearchView("research_overall_win_rate"), []),
    resolveResearchTask("research_usd_24h_direction_accuracy", fetchResearchView("research_usd_24h_direction_accuracy"), []),
    matrix24hRowsPromise,
    eurMatrix24hRowsPromise,
    goldMatrix24hRowsPromise,
    nqMatrix24hRowsPromise,
    btcMatrix24hRowsPromise,
    resolveResearchTask("research_accuracy_by_verdict_strength", fetchResearchView("research_accuracy_by_verdict_strength", { order: "timeframe.asc,strength_rank.asc" }), []),
    resolveResearchTask("research_accuracy_by_confidence_bucket", fetchResearchView("research_accuracy_by_confidence_bucket", { order: "timeframe.asc,confidence_bucket_rank.asc" }), []),
    resolveResearchTask("research_trade_quality_thresholds", fetchResearchView("research_trade_quality_thresholds", { order: "timeframe.asc,threshold_rank.asc" }), []),
    resolveResearchTask("research_win_rate_by_timeframe", fetchResearchView("research_win_rate_by_timeframe", { order: "timeframe.asc" }), []),
    resolveResearchTask("research_win_rate_by_conviction_bucket", fetchResearchView("research_win_rate_by_conviction_bucket"), []),
    resolveResearchTask("research_win_rate_by_weekday", fetchResearchView("research_win_rate_by_weekday"), []),
    resolveResearchTask("research_win_rate_by_magnitude_bucket", fetchResearchView("research_win_rate_by_magnitude_bucket"), []),
    resolveResearchTask("research_win_rate_by_market_regime", fetchResearchView("research_win_rate_by_market_regime"), []),
    resolveResearchTask("research_factor_reliability", fetchResearchView("research_factor_reliability", {
      order: "win_rate_pct.desc,factor_occurrences.desc,avg_factor_weight.desc",
      limit: 8
    }), []),
    resolveResearchTask("research_factor_contribution", fetchResearchView("research_factor_contribution", {
      order: "weighted_contribution_score.desc,contribution_score.desc,factor_occurrences.desc",
      limit: 8
    }), []),
    resolveResearchTask("research_best_factor_combinations", fetchResearchView("research_best_factor_combinations", {
      order: "win_rate_pct.desc,combo_occurrences.desc,avg_combined_weight.desc",
      limit: 8
    }), []),
    resolveResearchTask("research_dashboard_infrastructure_status", fetchResearchView("research_dashboard_infrastructure_status"), []),
    usdCheckerDataPromise,
    eurCheckerDataPromise,
    goldCheckerDataPromise,
    nqCheckerDataPromise,
    btcCheckerDataPromise,
    adrReachResearchPromise,
    halfL2lReachResearchPromise,
    confidenceCalibrationPromise
  ]);

  const resolvedEurMatrix24hRows = eurCheckerData?.rows?.length
    ? normalizeCheckerRowsForMatrix(eurCheckerData, {
      assetCode: "EUR",
      benchmark: "EURUSD"
    })
    : eurMatrix24hRows;
  const resolvedGoldMatrix24hRows = goldCheckerData?.rows?.length
    ? normalizeCheckerRowsForMatrix(goldCheckerData, {
      assetCode: "GOLD",
      benchmark: "XAUUSD"
    })
    : goldMatrix24hRows;
  const resolvedNqMatrix24hRows = nqCheckerData?.rows?.length
    ? normalizeCheckerRowsForMatrix(nqCheckerData, {
      assetCode: "NQ",
      benchmark: "QQQ_NQ_PROXY"
    })
    : nqMatrix24hRows;
  const resolvedBtcMatrix24hRows = btcCheckerData?.rows?.length
    ? normalizeCheckerRowsForMatrix(btcCheckerData, {
      assetCode: "BTC",
      benchmark: "BTCUSD"
    })
    : btcMatrix24hRows;

  return {
    meta: {
      last_updated: new Date().toISOString(),
      source: "supabase_research_views",
      read_only: true
    },
    accuracy: {
      overall: overallRows[0] || null,
      summary_24h: summary24hRows[0] || null,
      matrix_24h_rows: matrix24hRows,
      eur_matrix_24h_rows: resolvedEurMatrix24hRows,
      gold_matrix_24h_rows: resolvedGoldMatrix24hRows,
      nq_matrix_24h_rows: resolvedNqMatrix24hRows,
      btc_matrix_24h_rows: resolvedBtcMatrix24hRows,
      by_verdict_strength: verdictStrengthRows,
      by_confidence_bucket: confidenceBucketRows,
      trade_quality: tradeQualityRows,
      by_timeframe: timeframeRows,
      by_conviction_bucket: convictionRows,
      by_weekday: weekdayRows,
      by_magnitude_bucket: magnitudeRows,
      by_market_regime: regimeRows,
      top_factor_reliability: factorReliabilityRows,
      top_factor_contribution: factorContributionRows,
      best_factor_combinations: factorComboRows
    },
    infrastructure: infrastructureRows[0] || {},
    adr_reach: adrReachResearchData,
    half_l2l_reach: halfL2lReachResearchData,
    confidence_calibration: confidenceCalibrationData,
    checker: usdCheckerData,
    checkers: {
      USD: usdCheckerData,
      EUR: eurCheckerData,
      GOLD: goldCheckerData,
      NQ: nqCheckerData,
      BTC: btcCheckerData
    }
  };
}

async function loadDashboard() {
  const [layer1Result, layer2Result, researchResult, factorEdgeLabResult, phase2ShadowBacktestResult, confidenceBandDeliveryResult, economicEventRefreshResult, economicEventsSourceResult, inputHealthResult] = await Promise.allSettled([
    fetch(layer1Url, { cache: "no-store" }),
    fetch(layer2Url, { cache: "no-store" }),
    fetchResearchDashboardData(),
    fetchLocalJson(factorEdgeLabUrl),
    fetchLocalJson(phase2ShadowBacktestUrl),
    fetchLocalJson(confidenceBandDeliveryUrl),
    fetchLocalJson(economicEventRefreshUrl),
    fetchLocalJson(economicEventsSourceUrl),
    fetchLocalJson(inputHealthUrl)
  ]);

  try {
    if (layer1Result.status === "fulfilled") {
      layer1Data = normaliseLayer1Data(await layer1Result.value.json());
      renderLayer1(layer1Data);
    } else {
      throw layer1Result.reason;
    }

    if (layer2Result.status === "fulfilled") {
      layer2Data = await layer2Result.value.json();
      renderLayer2(layer2Data);
    } else {
      throw layer2Result.reason;
    }
  } catch (err) {
    console.error(err);
    const grid = document.getElementById("layer1Grid");
    if (grid) {
      grid.innerHTML = `<p class="warning">Could not load dashboard JSON.</p>`;
    }
    renderOverviewPerformancePanel();
  }

  if (researchResult.status === "fulfilled") {
    backtestData = researchResult.value;
  } else {
    console.error(researchResult.reason);
    backtestData = {
      meta: {
        last_updated: new Date().toISOString(),
        error: researchResult.reason?.message || String(researchResult.reason)
      },
      accuracy: {},
      infrastructure: {}
    };
  }

  if (factorEdgeLabResult.status === "fulfilled") {
    factorEdgeLabData = factorEdgeLabResult.value;
  } else {
    console.error(factorEdgeLabResult.reason);
    factorEdgeLabData = {
      generated_at: new Date().toISOString(),
      meta: {
        error: factorEdgeLabResult.reason?.message || String(factorEdgeLabResult.reason)
      },
      methodology: {},
      layer1: {},
      layer2: {}
    };
  }

  if (phase2ShadowBacktestResult.status === "fulfilled") {
    phase2ShadowBacktestData = phase2ShadowBacktestResult.value;
  } else {
    console.error(phase2ShadowBacktestResult.reason);
    phase2ShadowBacktestData = {
      generated_at: new Date().toISOString(),
      meta: {
        error: phase2ShadowBacktestResult.reason?.message || String(phase2ShadowBacktestResult.reason)
      },
      overall: {},
      assets: {}
    };
  }

  if (confidenceBandDeliveryResult.status === "fulfilled") {
    confidenceBandDeliveryData = confidenceBandDeliveryResult.value;
  } else {
    console.error(confidenceBandDeliveryResult.reason);
    confidenceBandDeliveryData = {
      meta: {
        error: confidenceBandDeliveryResult.reason?.message || String(confidenceBandDeliveryResult.reason)
      },
      rows: [],
      pooled_reference_rows: []
    };
  }

  if (economicEventRefreshResult.status === "fulfilled") {
    economicEventRefreshData = economicEventRefreshResult.value;
  } else {
    console.error(economicEventRefreshResult.reason);
    economicEventRefreshData = createEconomicEventRefreshFallback(
      economicEventRefreshResult.reason?.message || String(economicEventRefreshResult.reason || "Economic event refresh artifact unavailable")
    );
  }

  if (economicEventsSourceResult.status === "fulfilled") {
    economicEventsSourceData = economicEventsSourceResult.value;
  } else {
    console.error(economicEventsSourceResult.reason);
    economicEventsSourceData = createEconomicEventsSourceFallback(
      economicEventsSourceResult.reason?.message || String(economicEventsSourceResult.reason || "Economic event source artifact unavailable")
    );
  }

  if (inputHealthResult.status === "fulfilled") {
    inputHealthData = inputHealthResult.value;
  } else {
    console.error(inputHealthResult.reason);
    inputHealthData = createInputHealthFallback(
      inputHealthResult.reason?.message || String(inputHealthResult.reason || "Input health artifact unavailable")
    );
  }

  if (layer1Data) {
    renderLayer1(layer1Data);
  } else {
    renderOverviewStatusPanel();
    renderOperationalWarningsPanel();
    renderEconomicEventRefreshPanel();
  }
  if (layer2Data) renderLayer2(layer2Data);

  renderBacktest(backtestData);
  renderFactorEdgeLab(factorEdgeLabData);
  renderShadowLogicBacktest(phase2ShadowBacktestData);
  renderWorkflowStatus(workflowStatus);
  renderOverviewStatusPanel();
  renderOverviewConfidenceBandPanel();

  if (orderedAgents.includes(activeTab) && layer1Data) {
    renderAgentDetail(activeTab);
  }
}

setupTabs();
setupBacktestEvidenceControls();
setupArchitectureControls();
restoreNavigationState();
createWorkflowRefreshTabId();
restoreWorkflowRefreshState();
setBacktestTab(activeBacktestTab, { skipRender: true });
setTab(activeTab);
setupWorkflowControls();
renderWorkflowStatus();
setupWorkflowRefreshStorageSync();
initMarketGlobe();
updateClock();
setInterval(updateClock, 1000);

loadWorkflowControl().then(async () => {
  await loadWorkflowRuntimeProfile();
  await loadWorkflowStatus();
  if (activeWorkflowRefreshBlocksNewRequest()) {
    const pollWindowMs = Math.max(
      Number(workflowControl?.poll_after_trigger_ms || 180000),
      Math.ceil((getRuntimeProfilePercentileSeconds("max", 342.754) * 1000) + 120000)
    );
    startWorkflowStatusPolling(pollWindowMs);
  }
});
loadDashboard();
setInterval(loadDashboard, 60000);
setInterval(loadWorkflowStatus, 60000);
