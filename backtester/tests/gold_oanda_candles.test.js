const test=require('node:test');
const assert=require('node:assert/strict');
const {candleTime,normalizeGoldOandaPayload,goldDownloadWindows,combineGoldOandaPages}=require('../lib/gold_oanda_candles');
function page() {return {instrument:'XAU_USD',granularity:'M1',candles:[{time:'2024-01-08T14:00:00.000000000Z',complete:true,mid:{o:'2000',h:'2002',l:'1999',c:'2001'}}]};}
test('OANDA nanosecond minute boundaries normalize without retiming prices',()=>{
  const r=normalizeGoldOandaPayload(page());assert.equal(r.candles[0].open_time,'2024-01-08T14:00:00.000Z');
  assert.equal(r.candles[0].close_time,'2024-01-08T14:01:00.000Z');assert.equal(r.candles[0].open,2000);
  assert.equal(candleTime('2024-01-08T14:00:00.000000001Z'),null);
  assert.equal(candleTime('2024-01-08T14:00:01Z'),null);
});
test('incomplete candles are counted; invalid prices and other instruments fail',()=>{
  const p=page();p.candles[0].complete=false;assert.equal(normalizeGoldOandaPayload(p).incomplete_candle_times.length,1);
  assert.equal(normalizeGoldOandaPayload(p).candles.length,0);p.candles[0].complete=true;p.candles[0].mid.o=true;
  assert.throws(()=>normalizeGoldOandaPayload(p),/OHLC/);p.instrument='EUR_USD';assert.throws(()=>normalizeGoldOandaPayload(p),/XAU_USD/);
  assert.throws(()=>normalizeGoldOandaPayload(page(),'ask'),/OHLC/);
});
test('identical page boundaries deduplicate but conflicting revisions fail',()=>{
  assert.equal(combineGoldOandaPages([page(),page()]).candles.length,1);
  assert.equal(combineGoldOandaPages([page(),page()]).identical_boundary_duplicates,1);
  const p=page();p.candles[0].mid.c='2002';assert.throws(()=>combineGoldOandaPages([page(),p]),/Conflicting/);
});
test('download windows merge, cover final minute, chunk under 5000 and cap future horizons',()=>{
  const calls=[{entry_time:'2024-01-08T14:00:00Z',horizon_end:'2024-01-12T14:00:00Z'},
    {entry_time:'2024-01-08T15:00:00Z',horizon_end:'2024-01-09T14:00:00Z'}];
  const windows=goldDownloadWindows(calls,'2024-01-12T13:59:20Z');
  assert.equal(windows.length,2);assert.equal(windows[0].to,windows[1].from);
  assert.equal(windows.at(-1).to,'2024-01-12T13:59:00.000Z');
  assert.equal(Date.parse(windows[0].to)-Date.parse(windows[0].from),4800*60000);
  assert.deepEqual(goldDownloadWindows(calls,'2024-01-07T00:00:00Z'),[]);
});
