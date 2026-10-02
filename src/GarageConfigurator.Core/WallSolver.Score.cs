namespace GarageConfigurator.Core;

public sealed partial class WallSolver
{
    // Scoring weights. Named so a ranking argument is a conversation about numbers, not about code.
    private const decimal WorkbenchCounterInch = 2.0m;
    private const decimal WorkbenchDrawerBank = 40m;
    private const decimal WorkbenchNoDrawerBank = -80m;
    private const decimal WorkbenchUpperCabinet = 3m;
    private const decimal StorageCubicFeetPerDollar = 12000m;
    private const decimal StorageTall = 8m;
    private const decimal StorageWideBox = 2m;
    private const decimal HiddenFullDoor = 10m;
    private const decimal HiddenTall = 12m;
    private const decimal HiddenOpenCounterInch = 0.5m;
    private const decimal BalancedIdealRun = 30m;
    private const decimal BalancedFlankingTall = 10m;
    private const decimal FillRatioWeight = 40m;
    private const decimal UnusedWallPerInch = 1.5m;
    private const decimal MixedWidthsInRun = 3m;

    private ScoredLayout Score(Layout layout, Wall wall, Goal goal, PriceMap prices)
    {
        var price = layout.LineItems.Sum(item => prices.List(item.Sku) * item.Quantity);
        var cubicFeet = CubicFeet(layout);
        var counterLength = layout.Items.Where(i => i.Zone == Zone.Counter).Sum(i => i.Width);
        var occupied = layout.Items.Where(IsFloorStanding).Sum(i => i.Width);
        var fillRatio = wall.Length == 0m ? 0m : occupied / wall.Length;

        var score = goal switch
        {
            Goal.Workbench => ScoreWorkbench(layout, counterLength),
            Goal.Storage => ScoreStorage(layout, cubicFeet, price),
            Goal.HideTheMess => ScoreHidden(layout, counterLength, fillRatio),
            _ => ScoreBalanced(layout, counterLength, fillRatio)
        };

        return new ScoredLayout(layout, score - Penalties(layout, wall, occupied), price, cubicFeet, counterLength);
    }

    private static decimal ScoreWorkbench(Layout layout, decimal counterLength)
    {
        var drawerBanks = layout.Items.Count(i => i.Sku.StartsWith("MV-DB", StringComparison.Ordinal));
        var uppers = layout.Items.Count(i => i.Zone == Zone.Wall);

        return (counterLength * WorkbenchCounterInch)
            + (drawerBanks > 0 ? WorkbenchDrawerBank : WorkbenchNoDrawerBank)
            + (uppers * WorkbenchUpperCabinet);
    }

    private static decimal ScoreStorage(Layout layout, decimal cubicFeet, decimal price)
    {
        var perDollar = price == 0m ? 0m : cubicFeet / price * StorageCubicFeetPerDollar;
        var talls = layout.Items.Count(i => i.Zone == Zone.Tall);
        var wideBoxes = layout.Items.Count(i => i.Width == 30m);

        return perDollar + (talls * StorageTall) + (wideBoxes * StorageWideBox);
    }

    private static decimal ScoreHidden(Layout layout, decimal counterLength, decimal fillRatio)
    {
        var fullDoors = layout.Items.Count(i => i.Sku.EndsWith("-F", StringComparison.Ordinal));
        var talls = layout.Items.Count(i => i.Zone == Zone.Tall);

        return (fullDoors * HiddenFullDoor)
            + (talls * HiddenTall)
            - (counterLength * HiddenOpenCounterInch)
            + (fillRatio * FillRatioWeight);
    }

    private static decimal ScoreBalanced(Layout layout, decimal counterLength, decimal fillRatio)
    {
        var idealRun = counterLength is >= 72m and <= 96m ? BalancedIdealRun : 0m;
        var counters = layout.Items.Where(i => i.Zone == Zone.Counter).ToList();
        var talls = layout.Items.Where(i => i.Zone == Zone.Tall).ToList();

        var flanked = counters.Count != 1
            ? 0m
            : talls.Count(t => t.Right == counters[0].X || t.X == counters[0].Right) * BalancedFlankingTall;

        return idealRun + flanked + (fillRatio * FillRatioWeight);
    }

    private decimal Penalties(Layout layout, Wall wall, decimal occupied)
    {
        var penalty = 0m;
        var unused = wall.Length - occupied;

        if (unused > Constants.EndGapPenaltyAt)
        {
            penalty += unused * UnusedWallPerInch;
        }

        foreach (var run in ContiguousBaseRuns(layout))
        {
            if (run.Select(c => c.Width).Distinct().Count() > 1)
            {
                penalty += MixedWidthsInRun;
            }
        }

        return penalty;
    }

    private static IEnumerable<IReadOnlyList<PlacedItem>> ContiguousBaseRuns(Layout layout)
    {
        var current = new List<PlacedItem>();

        foreach (var cabinet in layout.Items.Where(i => i.Zone == Zone.Base).OrderBy(i => i.X))
        {
            if (current.Count > 0 && current[^1].Right != cabinet.X)
            {
                yield return current;
                current = new List<PlacedItem>();
            }

            current.Add(cabinet);
        }

        if (current.Count > 0)
        {
            yield return current;
        }
    }

    private static decimal CubicFeet(Layout layout) =>
        layout.Items
            .Where(i => i.Zone is Zone.Base or Zone.Tall or Zone.Wall)
            .Sum(i => i.Width * i.Height * i.Depth) / 1728m;

    private static bool IsFloorStanding(PlacedItem item) =>
        item.Zone is Zone.Base or Zone.Tall or Zone.Filler;

    // ---- ranking ----------------------------------------------------------------------------

    /// <summary>
    /// Best first, distinct layouts only. Ties break on price, then on fewer line items — a cheaper
    /// wall built from fewer different boxes is the easier sell.
    /// </summary>
    private static IReadOnlyList<Layout> Rank(List<ScoredLayout> scored)
    {
        var ordered = scored
            .OrderByDescending(s => s.Score)
            .ThenBy(s => s.Price)
            .ThenBy(s => s.Layout.LineItems.Count)
            .ToList();

        var chosen = new List<ScoredLayout>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var candidate in ordered)
        {
            if (seen.Add(Signature(candidate.Layout)) && chosen.Count < LayoutsReturned)
            {
                chosen.Add(candidate);
            }
        }

        return chosen.Select((candidate, rank) => candidate.Layout with
        {
            Label = rank == 0 ? "Recommended" : LabelAgainst(candidate, chosen[0])
        }).ToList();
    }

    /// <summary>Distinct means a different multiset of SKUs, or counters in different places.</summary>
    private static string Signature(Layout layout)
    {
        var skus = layout.LineItems
            .OrderBy(item => item.Sku, StringComparer.Ordinal)
            .Select(item => $"{item.Sku}x{item.Quantity}");

        var counters = layout.Items
            .Where(i => i.Zone == Zone.Counter)
            .OrderBy(i => i.X)
            .Select(i => $"{i.X}-{i.Right}");

        return string.Join("|", skus) + "//" + string.Join("|", counters);
    }

    /// <summary>Name a layout by whatever it does most differently from the recommended one.</summary>
    private static string LabelAgainst(ScoredLayout candidate, ScoredLayout best)
    {
        var cheaper = best.Price == 0m ? 0m : (best.Price - candidate.Price) / best.Price;
        var roomier = best.CubicFeet == 0m ? 0m : (candidate.CubicFeet - best.CubicFeet) / best.CubicFeet;
        var benchier = best.CounterLength == 0m
            ? (candidate.CounterLength > 0m ? 1m : 0m)
            : (candidate.CounterLength - best.CounterLength) / best.CounterLength;

        var biggest = Math.Max(cheaper, Math.Max(roomier, benchier));

        if (biggest <= 0.02m)
        {
            return "Another option";
        }

        return biggest == roomier ? "More storage"
            : biggest == benchier ? "Bigger workbench"
            : "Lower cost";
    }
}
