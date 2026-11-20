// The BTCUSD acceptance test on the FTMO cTrader Challenge account, written as a guarded state machine before any
// connection exists.
//
// The owner's instruction is the specification: confirm the account and read the BTCUSD contract, take the
// smallest volume the contract allows, refuse if BTCUSD already carries an exposure, send exactly one buy at
// market with a broker-valid protected stop, never send a second entry, start a two-minute clock from the
// broker's own fill time, close the recorded position at 120 seconds, close it at once if the stop cannot be
// confirmed, verify the final state with the broker, disarm, and report the numbers.
//
// The module is pure over an injected destination client: no socket, no credential, no terminal and no timer of
// its own. Every gate is a refusal that happens before the send, and every uncertain send is reconciled rather
// than repeated. It cannot read MT5 at all, which is what keeps the ftmo-1 lane read-only: there is no MT5 path
// in this file to switch off.
"use strict";

const TEST_SYMBOL = "BTCUSD";
const TEST_SIDE = "buy";
const HOLD_MS = 120000;

// The refusal codes. Each is a stop, not a warning: the run ends before the send.
const REFUSALS = Object.freeze({
  account_unconfirmed: "the account id has not been confirmed against the destination",
  account_mismatch: "the destination reports a different account than the one confirmed",
  symbol_mismatch: "the contract read is not the test symbol",
  symbol_disabled: "the destination reports the symbol as not tradeable",
  spec_incomplete: "the contract read is missing a field the size or the stop depends on",
  volume_below_min: "the requested volume is below the contract minimum",
  volume_off_step: "the requested volume is not on the contract's volume step",
  exposure_present: "BTCUSD already carries an open position",
  pending_present: "BTCUSD already carries a pending order",
  copying_enabled: "continuous copying is switched on",
  not_armed: "the relay is not armed for this test",
  kill_switch: "the kill switch is engaged",
  clock_missing: "no clock was injected, so the two-minute deadline cannot be honest",
  risk_unpriced: "the reference price is missing, so the stop cannot be placed"
});

function num(value) {
  if (value === null || value === undefined || value === "") return Number.NaN;
  return Number(value);
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function floorTo(value, digits) {
  const scale = 10 ** digits;
  return Math.floor(value * scale) / scale;
}

// BTC exposure is volume times the contract's own lot size. The lot size is read, never assumed: cTrader
// brokers differ, and a test that assumes one BTC per lot can be a hundred times too large.
function exposureFor(volume, lotSizeBtc) {
  return { volume, btc: volume * lotSizeBtc };
}

// The size and the stop, from the contract as read. The stop is the contract's own minimum distance, placed on
// the loss side of the reference price and rounded away from the entry so rounding can never shorten it below
// the minimum the broker enforces.
function planTest({ spec, referencePrice, volume }) {
  const digits = num(spec.digits);
  const lotSizeBtc = num(spec.lotSizeBtc);
  const minVolume = num(spec.minVolume);
  const step = num(spec.volumeStep);
  const minStop = num(spec.minStopDistance);
  const wanted = volume === undefined || volume === null ? minVolume : num(volume);
  const ref = num(referencePrice);
  const refusals = [];

  if (!Number.isInteger(digits) || digits < 0) refusals.push("spec_incomplete:digits");
  if (!finite(lotSizeBtc) || lotSizeBtc <= 0) refusals.push("spec_incomplete:lotSizeBtc");
  if (!finite(minVolume) || minVolume <= 0) refusals.push("spec_incomplete:minVolume");
  if (!finite(step) || step <= 0) refusals.push("spec_incomplete:volumeStep");
  if (!finite(minStop) || minStop < 0) refusals.push("spec_incomplete:minStopDistance");
  if (!finite(ref) || ref <= 0) refusals.push("risk_unpriced:referencePrice");
  if (finite(minVolume) && finite(wanted) && wanted < minVolume) refusals.push("volume_below_min");
  if (finite(step) && finite(wanted) && Math.abs(wanted / step - Math.round(wanted / step)) > 1e-9) {
    refusals.push("volume_off_step");
  }
  if (refusals.length) return { ok: false, refusals, plan: null };

  const stopDistance = minStop;
  const stopPrice = floorTo(ref - stopDistance, digits);
  const exposure = exposureFor(wanted, lotSizeBtc);
  const plan = {
    symbol: TEST_SYMBOL,
    side: TEST_SIDE,
    volume: wanted,
    lot_size_btc: lotSizeBtc,
    exposure_btc: exposure.btc,
    notional_usd: exposure.btc * ref,
    reference_price: ref,
    stop_price: stopPrice,
    stop_distance: round(ref - stopPrice),
    stop_distance_min: stopDistance,
    risk_usd: round(exposure.btc * (ref - stopPrice)),
    comment: "btc-test-120s"
  };
  return { ok: true, refusals: [], plan };
}

function round(value) {
  return Math.round(value * 1e8) / 1e8;
}

// Every gate, in the order the instruction states them: the account, the contract, an existing exposure, the
// copying switch, the arming, then the size. A single refusal ends the run.
function preflight({ config, account, spec, exposures, planResult }) {
  const refusals = [];
  const confirm = String(config.confirmedAccountId || "").trim();
  if (!confirm) refusals.push("account_unconfirmed");
  if (confirm && account && String(account.accountId || "") !== confirm) refusals.push("account_mismatch");
  if (!spec || String(spec.symbol || "") !== TEST_SYMBOL) refusals.push("symbol_mismatch");
  if (spec && spec.tradeMode !== undefined && String(spec.tradeMode).toLowerCase() !== "full") {
    refusals.push(`symbol_disabled:${spec.tradeMode}`);
  }
  const positions = (exposures && exposures.positions) || [];
  const orders = (exposures && exposures.orders) || [];
  if (positions.length) refusals.push(`exposure_present:${positions.map((p) => p.positionId).join(",")}`);
  if (orders.length) refusals.push(`pending_present:${orders.map((o) => o.orderId).join(",")}`);
  if (config.copyingEnabled === true) refusals.push("copying_enabled");
  if (config.armed !== true) refusals.push("not_armed");
  if (config.killSwitch === true) refusals.push("kill_switch");
  if (typeof config.now !== "function") refusals.push("clock_missing");
  if (planResult && !planResult.ok) refusals.push(...planResult.refusals);

  const risk = planResult && planResult.plan
    ? {
      exposure_btc: planResult.plan.exposure_btc,
      risk_usd: planResult.plan.risk_usd,
      balance_usd: finite(num(config.balanceUsd)) ? num(config.balanceUsd) : (account ? num(account.balance) : null)
    }
    : null;
  if (risk && finite(risk.balance_usd) && finite(num(config.maxRiskUsd)) && risk.risk_usd > num(config.maxRiskUsd)) {
    refusals.push(`risk_above_limit:${risk.risk_usd}`);
  }
  return {
    ok: refusals.length === 0,
    refusals,
    reasons: refusals.map((code) => REFUSALS[String(code).split(":")[0]] || code),
    plan: planResult ? planResult.plan : null,
    risk
  };
}


// A single-use action. The second call is a fault, not a retry: one entry and one close per run.
function once(name, counters, action) {
  return async function attempt() {
    counters[name] += 1;
    if (counters[name] > 1) throw new Error(`${name} called twice: a second ${name} is refused by design`);
    return action();
  };
}

function fillTimeMs(exec) {
  const t = Date.parse(exec && exec.fillTimeUtc ? exec.fillTimeUtc : "");
  if (!Number.isFinite(t)) throw new Error("the broker did not return a fill time; the two-minute clock cannot start");
  return t;
}

// The stop the broker actually holds, not the one we asked for. A missing, wrong-side or short stop is not a
// protection, and the run closes the position at once rather than waiting for anything else.
function stopConfirmed(position, plan, tolerance) {
  if (!position || position.state !== "open") return { ok: false, cause: "position_not_open" };
  const held = num(position.protectionStop ?? position.stopPrice);
  if (!finite(held)) return { ok: false, cause: "no_stop" };
  if (!(held < num(position.entryPrice ?? plan.reference_price))) return { ok: false, cause: "stop_not_below_entry" };
  const slack = finite(num(tolerance)) ? num(tolerance) : 1e-6;
  if (held > plan.stop_price * (1 + slack)) return { ok: false, cause: `stop_short:${held}` };
  return { ok: true, held };
}

async function runTest({ client, config, sleep }) {
  const now = config.now;
  const pollMs = num(config.pollMs) > 0 ? num(config.pollMs) : 5000;
  const holdMs = finite(num(config.holdMs)) ? num(config.holdMs) : HOLD_MS;
  const closeTimeoutMs = num(config.closeTimeoutMs) > 0 ? num(config.closeTimeoutMs) : 30000;
  const wait = typeof sleep === "function" ? sleep : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const counters = { send: 0, close: 0, disarm: 0 };
  const alerts = [];

  // Every terminal path disarms once and returns the same counters, so no outcome leaves the relay armed.
  const finish = async (result) => {
    counters.disarm += 1;
    if (counters.disarm === 1 && typeof client.setArmed === "function") {
      try {
        await client.setArmed(false);
      } catch (err) {
        alerts.push(`disarm failed: ${err && err.message ? err.message : err}`);
      }
    }
    return { ...result, counters, alerts: [...(result.alerts || []), ...alerts] };
  };

  const account = await client.getAccount();
  const spec = await client.getSymbolSpec(TEST_SYMBOL);
  const exposures = await client.listExposures(TEST_SYMBOL);
  const referencePrice = await client.getReferencePrice(TEST_SYMBOL);
  const planResult = planTest({ spec, referencePrice, volume: config.volume });
  const pre = preflight({ config, account, spec, exposures, planResult });
  if (!pre.ok) {
    return finish({ status: "refused", preflight: pre, plan: pre.plan, entry: null, exit: null, report: null });
  }

  const plan = pre.plan;
  const requestId = String(config.requestId || `btc-test-${new Date(now()).toISOString().replace(/[^0-9]/g, "")}`);
  const send = once("send", counters, () => client.sendMarketOrder({
    requestId,
    symbol: plan.symbol,
    side: plan.side,
    volume: plan.volume,
    stopPrice: plan.stop_price,
    comment: plan.comment,
    type: "market"
  }));
  const sent = await send();
  if (sent.outcome === "refused") {
    alerts.push(sent.message || "destination refused the entry");
    return finish({ status: "refused_by_destination", requestId, preflight: pre, plan, entry: null, exit: null, report: null });
  }

  let orderId = sent.orderId || null;
  let positionId = sent.positionId || null;
  if (sent.outcome === "unknown") {
    // Never a resend: look the request id up at the destination, adopt what is found, stop if nothing is found.
    const found = await client.findByRequestId(requestId);
    if (!found || !found.position) {
      alerts.push(`send outcome unknown and no position for request ${requestId}: reconcile on cTrader by hand before anything else`);
      return finish({ status: "uncertain_escalate", requestId, preflight: pre, plan, entry: null, exit: null, report: null });
    }
    orderId = found.order ? found.order.orderId : null;
    positionId = found.position.positionId;
  }

  const exec = await client.getExecution({ orderId, positionId, timeoutMs: num(config.fillTimeoutMs) || 15000 });
  if (!exec || !finite(num(exec.filledVolume)) || num(exec.filledVolume) <= 0) {
    const found = await client.findByRequestId(requestId);
    if (!found || !found.position) {
      alerts.push(`entry not filled and no position for request ${requestId}; nothing was sent again`);
      return finish({ status: "not_filled", requestId, preflight: pre, plan, entry: null, exit: null, report: null });
    }
    alerts.push("a position exists but no fill execution came back; verify with cTrader and close by hand if no stop is visible");
    return finish({ status: "unconfirmed_fill", requestId, positionId: found.position.positionId, preflight: pre, plan, entry: null, exit: null, report: null });
  }

  const entry = {
    request_id: requestId,
    order_id: orderId,
    position_id: positionId,
    filled_volume: num(exec.filledVolume),
    fill_price: num(exec.fillPrice),
    fill_time_utc: exec.fillTimeUtc,
    fill_time_ms: fillTimeMs(exec),
    commission: finite(num(exec.commission)) ? num(exec.commission) : null
  };

  const pos0 = await client.getPosition(positionId);
  const guard = stopConfirmed(pos0, plan, config.stopTolerance);
  if (!guard.ok) {
    alerts.push(`stop not confirmed after entry (${guard.cause}); closing the test position at once`);
    const closed = await once("close", counters, () => client.closePosition({
      positionId, volume: num(pos0.volume) || entry.filled_volume, requestId: `${requestId}-x`, reason: "stop_unconfirmed"
    }))();
    return finish({ status: "closed_stop_unconfirmed", requestId, positionId, preflight: pre, plan, entry, exit: closed, report: null });
  }
  // The clock runs from the broker's fill time, not from the send. The stop is watched on every poll: if it takes
  // the position, the run ends there and the exit is the broker's own exit, not a close of ours.
  const deadlineMs = entry.fill_time_ms + holdMs;
  let exitPosition = null;
  let polls = 0;
  for (;;) {
    polls += 1;
    const p = await client.getPosition(positionId);
    if (p && p.state === "closed") { exitPosition = p; break; }
    if (now() >= deadlineMs) break;
    await wait(Math.max(0, Math.min(pollMs, deadlineMs - now())));
  }

  let closeOutcome = null;
  let status = "closed_by_stop";
  if (!exitPosition) {
    const here = await client.getPosition(positionId);
    const closeVolume = num(here && here.volume) || entry.filled_volume;
    const close = once("close", counters, () => client.closePosition({
      positionId, volume: closeVolume, requestId: `${requestId}-x`, reason: "deadline"
    }));
    closeOutcome = await close();
    if (closeOutcome && closeOutcome.outcome === "unknown") {
      const check = await client.getPosition(positionId);
      if (check && check.state === "open") alerts.push(`close outcome unknown and position ${positionId} still open: check cTrader now`);
    }
    // Wait for the broker to confirm, rather than assuming a request is a closure.
    const closeDeadline = now() + closeTimeoutMs;
    let last = await client.getPosition(positionId);
    while (last && last.state === "open" && now() < closeDeadline) {
      await wait(Math.min(pollMs, Math.max(0, closeDeadline - now())));
      last = await client.getPosition(positionId);
    }
    if (last && last.state === "open") {
      alerts.push(`closure not confirmed for position ${positionId}: it may still be open on cTrader and must be checked by hand`);
      status = "close_failed";
    } else {
      exitPosition = last;
      status = "closed_at_deadline";
    }
  }

  const openNow = typeof client.getOpenExposure === "function" ? await client.getOpenExposure(TEST_SYMBOL) : null;
  const remaining = (openNow && openNow.positions) || [];
  if (remaining.length) {
    alerts.push(`test exposure remains after the run: ${remaining.map((p) => p.positionId).join(",")}`);
  }
  const deals = typeof client.listDeals === "function" ? await client.listDeals(positionId) : [];
  const exit = {
    price: exitPosition ? num(exitPosition.closePrice) : null,
    time_utc: exitPosition ? exitPosition.closeTimeUtc || null : null,
    reason: status === "closed_by_stop" ? "stop" : status === "closed_at_deadline" ? "deadline_close" : "unconfirmed",
    close_outcome: closeOutcome ? closeOutcome.outcome : null
  };
  const report = buildReport({ plan, entry, exit, deals, remaining });
  return finish({ status, requestId, positionId, preflight: pre, plan, entry, exit, report, polls });
}

// The numbers the owner asked for, from the broker's own record: entry and exit times, holding time, size,
// prices, fees and net, plus the flat check.
function buildReport({ plan, entry, exit, deals, remaining }) {
  const sum = (key) => (deals && deals.length
    ? deals.reduce((total, deal) => total + (finite(num(deal[key])) ? num(deal[key]) : 0), 0)
    : null);
  const gross = exit && finite(num(exit.price))
    ? round((num(exit.price) - entry.fill_price) * plan.exposure_btc)
    : null;
  const commission = sum("commission");
  const swap = sum("swap");
  const net = gross === null ? null : round(gross + (commission || 0) + (swap || 0));
  const holdSeconds = exit && exit.time_utc
    ? round((Date.parse(exit.time_utc) - entry.fill_time_ms) / 1000)
    : null;
  return {
    symbol: plan.symbol,
    side: plan.side,
    position_id: entry.position_id,
    volume: entry.filled_volume,
    planned_volume: plan.volume,
    exposure_btc: round(entry.filled_volume * plan.lot_size_btc),
    planned_exposure_btc: plan.exposure_btc,
    entry_time_utc: entry.fill_time_utc,
    exit_time_utc: exit ? exit.time_utc : null,
    hold_seconds: holdSeconds,
    entry_price: entry.fill_price,
    exit_price: exit ? exit.price : null,
    stop_price: plan.stop_price,
    gross_usd: gross,
    commission_usd: commission,
    swap_usd: swap,
    net_usd: net,
    remaining_positions: (remaining || []).map((p) => p.positionId),
    flat: (remaining || []).length === 0,
    exit_reason: exit ? exit.reason : null
  };
}



module.exports = {
  TEST_SYMBOL,
  TEST_SIDE,
  HOLD_MS,
  REFUSALS,
  exposureFor,
  planTest,
  preflight,
  stopConfirmed,
  buildReport,
  runTest
};