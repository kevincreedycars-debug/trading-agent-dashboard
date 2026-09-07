const { parseTimestamp } = require('./gold_timestamped_evaluation');
const { normalizeMarketPrice } = require('./outcome_evaluation');
const MINUTE = 60000;

function candleTime(value) {
  if (typeof value !== 'string') return null;
  // Preserve actual minute boundaries; no rounding a fractional candle into one.
  const normalized = value.replace(/\.0{1,9}(?=Z|[+-]\d{2}:\d{2}$)/, '');
  const timestamp = parseTimestamp(normalized);
  return timestamp !== null && timestamp % MINUTE === 0 ? timestamp : null;
}

function normalizeGoldOandaPayload(payload, basis='mid') {
  if (payload?.instrument !== 'XAU_USD' || payload.granularity !== 'M1' || !Array.isArray(payload.candles)) throw new Error('Expected OANDA XAU_USD M1 response.');
  if (!['mid','bid','ask'].includes(basis)) throw new Error('Explicit supported price basis required.');
  const rows=[], incomplete=[];
  for (const candle of payload.candles) {
    const start=candleTime(candle?.time);
    if (start===null || typeof candle.complete!=='boolean') throw new Error('Invalid OANDA candle time or completion flag.');
    if (!candle.complete) { incomplete.push(candle.time); continue; }
    const [open,high,low,close]=['o','h','l','c'].map(key=>normalizeMarketPrice(candle[basis]?.[key]));
    if ([open,high,low,close].includes(null) || low>Math.min(open,close) || high<Math.max(open,close) || low>high) throw new Error('Invalid OANDA candle OHLC.');
    rows.push({market:'XAUUSD',open_time:new Date(start).toISOString(),close_time:new Date(start+MINUTE).toISOString(),
      open,high,low,close,price_basis:basis,source:'OANDA v20 XAU_USD M1',complete:true});
  }
  return {candles:rows,incomplete_candle_times:incomplete};
}

function goldDownloadWindows(calls, asOf) {
  const now=parseTimestamp(asOf);
  if(now===null) throw new Error('Explicit as-of timestamp required.');
  const cap=Math.floor(now/MINUTE)*MINUTE;
  const windows=[];
  for(const call of calls) {
    const start=parseTimestamp(call.entry_time ?? call.call_time), end=parseTimestamp(call.horizon_end);
    if(start===null || end===null || end<=start || start%MINUTE || end%MINUTE) throw new Error('Download calls need exact minute entry and horizon boundaries.');
    if(start<cap) windows.push({start,end:Math.min(end,cap)});
  }
  windows.sort((a,b)=>a.start-b.start);
  const merged=[];
  for(const window of windows) {
    const previous=merged.at(-1);
    if(previous && window.start<=previous.end) previous.end=Math.max(previous.end,window.end);
    else merged.push({...window});
  }
  const chunks=[];
  for(const window of merged) for(let start=window.start;start<window.end;start+=4800*MINUTE) {
    chunks.push({from:new Date(start).toISOString(),to:new Date(Math.min(window.end,start+4800*MINUTE)).toISOString()});
  }
  return chunks;
}

function combineGoldOandaPages(pages,basis='mid') {
  const byTime=new Map(), incomplete=[];
  let duplicates=0;
  for(const page of pages) {
    const normalized=normalizeGoldOandaPayload(page,basis);
    incomplete.push(...normalized.incomplete_candle_times);
    for(const candle of normalized.candles) {
      const previous=byTime.get(candle.open_time);
      if(previous) {
        if(JSON.stringify(previous)!==JSON.stringify(candle)) throw new Error('Conflicting OANDA candle revisions across pages.');
        duplicates++;
      } else byTime.set(candle.open_time,candle);
    }
  }
  return {candles:[...byTime.values()].sort((a,b)=>a.open_time.localeCompare(b.open_time)),
    identical_boundary_duplicates:duplicates,incomplete_candle_times:incomplete};
}
module.exports={candleTime,normalizeGoldOandaPayload,goldDownloadWindows,combineGoldOandaPages};
