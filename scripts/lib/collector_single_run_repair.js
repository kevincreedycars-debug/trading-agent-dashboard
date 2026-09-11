const { hash } = require('./btc_rate_limit_repair');
const COLLECTORS = {
  usd: 'P1E4ZWtbDetYz1P5', eur: 'Z3v9kQNIM22THi2O', gold: '0z71FpOfKdL72hgW',
  nq: 'nYMDUSVQwEFNaH0U', btc: 'AE3Vv7ILPPiZwZHN'
};
const ENTRY = 'HTTP Request | US 2Y Treasury Yield - FRED API';
function planCollectorSingleRunRepair(workflow) {
  if (!Object.values(COLLECTORS).includes(workflow.id)) throw Error('Collector is outside the repair allowlist.');
  const triggers = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.executeWorkflowTrigger');
  const entries = workflow.nodes.filter(n => n.name === ENTRY);
  if (triggers.length !== 1 || entries.length !== 1 ||
      hash(workflow.connections[triggers[0].name]) !== hash({main: [[{node: ENTRY, type: 'main', index: 0}]]})) {
    throw Error('Collector entry topology changed.');
  }
  const node = entries[0];
  if (node.type !== 'n8n-nodes-base.httpRequest' || (node.parameters.method || 'GET') !== 'GET' ||
      JSON.stringify(node.parameters).includes('{{')) throw Error('Expected a static read-only entry request.');
  const url = new URL(node.parameters.url);
  if (url.origin !== 'https://api.stlouisfed.org' || url.pathname !== '/fred/series/observations' ||
      url.searchParams.get('series_id') !== 'DGS2') throw Error('Entry provider changed.');
  if (!workflow.activeVersion?.nodes || hash(workflow.nodes) !== hash(workflow.activeVersion.nodes) ||
      hash(workflow.connections) !== hash(workflow.activeVersion.connections)) throw Error('Active and editable versions differ.');
  const nodes = workflow.nodes.map(n => n.id === node.id ? {...n, executeOnce: true} : n);
  return {payload: {name: workflow.name, nodes, connections: workflow.connections, settings: workflow.settings || {}},
    summary: {workflowId: workflow.id, node: ENTRY, change: {executeOnce: true}, alreadyApplied: node.executeOnce === true}};
}
module.exports = {COLLECTORS, ENTRY, planCollectorSingleRunRepair};
