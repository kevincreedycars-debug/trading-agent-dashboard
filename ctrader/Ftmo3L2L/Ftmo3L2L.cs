using System;
using System.Linq;
using System.Globalization;
using cAlgo.API;

namespace cAlgo.Robots;

[Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.None)]
public class Ftmo3L2L : Robot
{
    [Parameter("Expected account number", DefaultValue = 0)]
    public int ExpectedAccount { get; set; }

    [Parameter("Expected cTrader symbol", DefaultValue = "")]
    public string ExpectedSymbol { get; set; }

    [Parameter("Original L2L prices (comma separated)", DefaultValue = "")]
    public string OriginalLevels { get; set; }

    [Parameter("Enable orders", DefaultValue = false)]
    public bool EnableOrders { get; set; }

    private const string Label = "FTMO3-L2L-5R";
    private decimal[] levels;
    private decimal tick;
    private int lower;
    private int upper;
    private DateTime resetAt;
    private DateTime lastSignal;

    protected override void OnStart()
    {
        if (Account.Number != ExpectedAccount || SymbolName != ExpectedSymbol || TimeFrame != TimeFrame.Minute5)
        {
            Print("Check account, symbol and M5 chart.");
            Stop();
            return;
        }
        tick = (decimal)Symbol.TickSize;
        try
        {
            levels = OriginalLevels.Split(',').Select(value => decimal.Parse(value.Trim(),
                NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture)).Distinct().OrderBy(x => x).ToArray();
            if (levels.Length < 3 || tick <= 0 || levels.Any(x => x <= 0 || x % tick != 0))
                throw new FormatException();
        }
        catch (Exception error) when (error is FormatException || error is OverflowException)
        {
            Print("Supply original L2L prices for this instrument, each aligned to its cTrader tick.");
            Stop();
            return;
        }
        Reset((decimal)Symbol.Bid);
        Positions.Closed += OnExit;
        PendingOrders.Cancelled += OnCancellation;
    }

    private void Reset(decimal price)
    {
        lower = Array.FindLastIndex(levels, x => x < price);
        upper = Array.FindIndex(levels, x => x > price);
        resetAt = Server.TimeInUtc;
    }

    private void OnExit(PositionClosedEventArgs e)
    {
        if (e.Position.SymbolName == SymbolName && e.Position.Label == Label)
            Reset((decimal)Symbol.Bid);
    }

    private void OnCancellation(PendingOrderCancelledEventArgs e)
    {
        if (e.PendingOrder.SymbolName == SymbolName && e.PendingOrder.Label == Label)
            Reset((decimal)Symbol.Bid);
    }

    protected override void OnBarClosed()
    {
        if (Bars.Count < 2 || Account.Number != ExpectedAccount || SymbolName != ExpectedSymbol) return;
        if (Positions.Any(p => p.SymbolName == SymbolName) || PendingOrders.Any(o => o.SymbolName == SymbolName)) return;
        var closedAt = Bars.OpenTimes.Last(0).AddMinutes(5);
        if (closedAt <= resetAt || closedAt <= lastSignal || Server.TimeInUtc >= closedAt.AddMinutes(5)
            || Bars.OpenTimes.Last(1).AddMinutes(5) != Bars.OpenTimes.Last(0)) return;

        decimal previous = (decimal)Bars.ClosePrices.Last(1);
        decimal newest = (decimal)Bars.ClosePrices.Last(0);
        bool buy = upper >= 0 && previous <= levels[upper] && newest >= levels[upper] + tick;
        bool sell = lower >= 0 && previous >= levels[lower] && newest <= levels[lower] - tick;
        if (!buy && !sell) return;

        int entryIndex = buy ? upper : lower;
        int targetIndex = entryIndex + (buy ? 1 : -1);
        if (targetIndex < 0 || targetIndex >= levels.Length) return;
        decimal entry = levels[entryIndex];
        decimal target = levels[targetIndex];
        decimal riskTicks = Math.Round(Math.Abs(target - entry) / (5 * tick), MidpointRounding.AwayFromZero);
        if (riskTicks < 1) return;
        decimal stop = entry + (buy ? -1 : 1) * riskTicks * tick;
        if (buy ? (decimal)Symbol.Ask <= entry || (decimal)Symbol.Bid >= target
                : (decimal)Symbol.Bid >= entry || (decimal)Symbol.Ask <= target) return;

        lastSignal = closedAt;
        Print("{0} {1} close={2:o} previous={3} newest={4} entry={5} SL={6} TP={7} units={8}",
            EnableOrders ? "Signal" : "Preview", buy ? "buy" : "sell", closedAt, previous, newest,
            entry, stop, target, Symbol.VolumeInUnitsMin);
        if (!EnableOrders) return;
        var result = PlaceLimitOrder(buy ? TradeType.Buy : TradeType.Sell, SymbolName,
            Symbol.VolumeInUnitsMin, (double)entry, Label, (double)stop, (double)target,
            ProtectionType.Absolute, null, "Full L2L 5R");
        Print(result.IsSuccessful ? "Limit accepted" : "Limit refused: " + result.Error);
    }

    protected override void OnStop()
    {
        Positions.Closed -= OnExit;
        PendingOrders.Cancelled -= OnCancellation;
    }
}
