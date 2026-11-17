'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {run} = require('./engine');
const {candidate,current} = require('./models');
const spec = require('./inputs.json');
const values = {vix:17, front:8, spread:7, real:6, broad:0.4, ice:0.2, gold:-1.3, qqq:1.1, calendar:0};
const fixture = {date:'2026-11-16',endDate:'2026-11-17', evidence:'synthetic fixture',inputs:{}};
for (const [key,[source,instrument,transform]] of Object.entries(spec)) {
  const observed = key === 'ice' ? '2026-11-16T05:00:00Z' : key === 'calendar' ? '2026-11-16T04:30:00Z' : '2026-11-13T20:00:00Z';
  fixture.inputs[key] = {source,instrument,transform,observed,published:observed,received:observed,original:true,value:values[key]};
}
function variant(edit, model=candidate) { const copy=structuredClone(fixture); edit(copy); return run(model,copy); }
const call = run(candidate,fixture), baseline = run(current,fixture);
const abstain = variant(s=>s.inputs.vix.value=30);
const blocked = variant(s=>delete s.inputs.calendar);
assert.deepEqual([call.direction,call.conviction,call.trade],['BULLISH',4,true]);
assert.equal(abstain.status,'abstained');
assert.equal(blocked.status,'blocked');
assert.equal(baseline.status,'directional');
for (const change of [s=>s.inputs.gold.source='CFD',s=>s.inputs.qqq.original=false,
  s=>s.inputs.real.received='2026-11-16T05:01:00Z',s=>s.inputs.front.observed='2026-11-02T10:00:00Z',
  s=>s.inputs.broad.published=null,s=>s.inputs.ice.value=null,s=>s.evidence='historical']) {
  assert.equal(variant(change).status,'blocked');
}
assert.equal(run({...candidate,decide:null},fixture).status,'blocked');
assert.equal(variant(s=>s.inputs.calendar.value=1).trade,false);
const dst=variant(s=>{s.date='2026-10-23';s.endDate='2026-10-26';});
assert.deepEqual([dst.cutoff,dst.end],['2026-10-23T04:00:00.000Z','2026-10-26T05:00:00.000Z']);
const results={fixture,baseline,call,abstain,blocked,dst:[dst.cutoff,dst.end]};
if(process.argv.includes('--record')) fs.writeFileSync(__dirname+'/expected.json',JSON.stringify(results,null,2));
else assert.deepEqual(results,require('./expected.json'));
console.log([baseline,call,abstain,blocked].map(({model,status,direction,conviction,trade})=>({model,status,direction,conviction,trade})));
