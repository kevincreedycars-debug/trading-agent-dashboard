const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const asset of ['usd', 'eur', 'gold', 'nq', 'btc']) {
  test(`${asset} collector uses named provider credentials in both export versions`, () => {
    const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, '../exports', `${asset}_collector.json`), 'utf8'));
    for (const version of [workflow, workflow.activeVersion].filter(Boolean)) {
      const nodes = version.nodes.filter(node => /stlouisfed\.org|finnhub\.io/.test(node.parameters?.url || ''));
      assert.ok(nodes.length > 0);
      for (const node of nodes) {
        const url = node.parameters.url;
        assert.match(url, /^=/);
        assert.doesNotMatch(url, /[?&](?:api_key|token)=[A-Za-z0-9_-]{12,}/);
        assert.ok(url.includes(url.includes('stlouisfed.org') ? '{{ $env.FRED_API_KEY }}' : '{{ $env.FINNHUB_API_KEY }}'));
      }
    }
  });
}
