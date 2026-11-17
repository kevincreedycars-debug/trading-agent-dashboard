'use strict';
const inputs = require('./inputs.json');
const book = require('./rows.json');
const benchmark = require('./reference/backtester/lib/usd_layer1_backtester/current_model');
const contracts = require('./reference/backtester/lib/usd_layer1_backtester/contracts');
const vote = (value, threshold) => Math.abs(value) >= threshold ? Math.sign(value) : 0;
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const candidate = {
  version:book.candidate, inputs,
  decide(v) {
    if (!Number.isSafeInteger(v.calendar) || v.calendar < 0 || v.vix <= 0)
      return {status:'blocked', direction:null, conviction:null, trade:false, trace:['invalid calendar count or VIX']};
    const votes = {front:vote(v.front,5), spread:vote(v.spread,5), real:vote(v.real,5),
      broad:vote(v.broad,0.3), ice:vote(v.ice,0.15), gold:-vote(v.gold,1), qqq:-vote(v.qqq,1)};
    // The US front-end and its relative spread share the same US leg. Use the relative measure only.
    const families = {rates:mean([votes.spread,votes.real]), momentum:mean([votes.broad,votes.ice]),
      crossMarket:mean([votes.gold,votes.qqq])};
    const score = mean(Object.values(families));
    const magnitude = Math.abs(score);
    const abstain = v.vix >= 30 || magnitude < 0.20;
    const band = abstain ? null : 1 + [0.35,0.50,0.65,0.80].filter(t => magnitude >= t).length;
    return {status:abstain?'abstained':'directional', direction:abstain?null:score>0?'BULLISH':'BEARISH',
      conviction:band, trade:!abstain && band >= 3 && v.calendar === 0,
      trace:{factors:book.rows.map(row=>({id:row.id,role:row.prescribed_role,source:row.source_key,
        value:v[row.source_key]??null})), votes, families, score, vixGate:v.vix>=30, deadband:magnitude<0.20,
        eventGate:v.calendar>0, frontCounted:false}};
  }
};
const current = {version:contracts.CURRENT_MODEL_VERSION, inputs:Object.fromEntries(['vix','front','real','broad'].map(k=>[k,inputs[k]])),
  decide(v,date) {
    const native = benchmark.evaluate({date, values:{vix_level:v.vix,us_2y_d5_bps:v.front,
      us_10y_real_d5_bps:v.real,broad_dollar_d5_pct:v.broad}});
    const called = native.direction !== 'NO_CALL';
    return {status:called?'directional':'abstained', direction:called?native.direction:null,
      conviction:called?native.conviction:null, trade:called && native.conviction >= contracts.CONVICTION.trade_threshold, trace:native};
  }};
module.exports = {candidate,current};
