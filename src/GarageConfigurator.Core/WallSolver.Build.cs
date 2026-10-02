namespace GarageConfigurator.Core;

public sealed partial class WallSolver
{
    private static readonly IReadOnlyDictionary<decimal, string> TallSkus = new Dictionary<decimal, string>
    {
        [30m] = "MV-PC3084",
        [24m] = "MV-PC2484"
    };

    private static readonly IReadOnlyDictionary<decimal, string> DoorBaseSkus = new Dictionary<decimal, string>
    {
        [30m] = "MV-B30", [24m] = "MV-B24", [15m] = "MV-B15"
    };

    private static readonly IReadOnlyDictionary<decimal, string> FullDoorBaseSkus = new Dictionary<decimal, string>
    {
        [30m] = "MV-B30-F", [24m] = "MV-B24-F", [15m] = "MV-B15"
    };

    private static readonly IReadOnlyDictionary<decimal, string> DrawerBaseSkus = new Dictionary<decimal, string>
    {
        [30m] = "MV-DB30-4", [24m] = "MV-DB24-4", [15m] = "MV-BWB15-PS"
    };

    private static readonly IReadOnlyDictionary<decimal, string> WallSkus = new Dictionary<decimal, string>
    {
        [30m] = "MV-W3030", [24m] = "MV-W2430", [15m] = "MV-W1530"
    };

    private static readonly IReadOnlyDictionary<decimal, string> ShortWallSkus = new Dictionary<decimal, string>
    {
        [30m] = "IC-MW-W3015", [24m] = "MV-W2415"
    };

    private IReadOnlyList<PlacedItem> BuildSegment(
        Segment segment,
        WidthMix mix,
        Policy policy,
        Wall wall,
        IReadOnlyList<KeepOut> keepOuts,
        bool tallsAllowed)
    {
        var widths = mix.Widths().ToList();
        var tallWidths = TakeTallWidths(widths, policy, tallsAllowed);
        var runs = ChunkIntoRuns(widths, policy, tallWidths.Count);

        var items = new List<PlacedItem>();
        var x = segment.Start;
        var leftover = segment.Length - widths.Sum() - tallWidths.Sum();

        // Fillers close what the cabinet widths cannot: one per end, widest gap first.
        var leftFiller = leftover >= Constants.EndGapNeedsFillerAt * 2m;
        var rightFiller = leftover >= Constants.EndGapNeedsFillerAt;

        var endTalls = tallWidths.Count - Math.Max(0, runs.Count - 1);
        var frontTalls = Math.Max(0, (endTalls + 1) / 2);
        var tallQueue = new Queue<decimal>(tallWidths);

        if (leftFiller)
        {
            items.Add(Filler(x, tallQueue.Count > 0 && frontTalls > 0));
            x += 3m;
        }

        for (var i = 0; i < frontTalls && tallQueue.Count > 0; i++)
        {
            x = PlaceTall(items, tallQueue.Dequeue(), x);
        }

        for (var r = 0; r < runs.Count; r++)
        {
            var runStart = x;
            x = PlaceRun(items, runs[r], policy, x);

            if (policy.WantCounter)
            {
                PlaceCounter(items, runStart, x);
            }

            if (tallsAllowed)
            {
                PlaceWallCabinets(items, runStart, x, wall, keepOuts, policy);
            }

            if (r < runs.Count - 1 && tallQueue.Count > 0)
            {
                x = PlaceTall(items, tallQueue.Dequeue(), x);
            }
        }

        while (tallQueue.Count > 0)
        {
            x = PlaceTall(items, tallQueue.Dequeue(), x);
        }

        if (rightFiller)
        {
            items.Add(Filler(x, tallWidths.Count > 0 && endTalls > frontTalls));
        }

        return items;
    }

    private static List<decimal> TakeTallWidths(List<decimal> widths, Policy policy, bool tallsAllowed)
    {
        var talls = new List<decimal>();

        if (!tallsAllowed)
        {
            return talls;
        }

        foreach (var width in new[] { 30m, 24m })
        {
            while (talls.Count < policy.MaxTalls && widths.Contains(width))
            {
                widths.Remove(width);
                talls.Add(width);
            }
        }

        return talls;
    }

    /// <summary>
    /// Base cabinets grouped into runs. When the layout wants a counter, runs are capped at the widest
    /// countertop — a longer unbroken run could not be topped at all.
    /// </summary>
    private List<List<decimal>> ChunkIntoRuns(List<decimal> baseWidths, Policy policy, int tallCount)
    {
        if (!policy.WantCounter || baseWidths.Count == 0)
        {
            return baseWidths.Count == 0 ? new List<List<decimal>>() : new List<List<decimal>> { baseWidths };
        }

        var maxRuns = tallCount + 1;
        var runs = new List<List<decimal>> { new() };

        foreach (var width in baseWidths)
        {
            var current = runs[^1];

            if (current.Sum() + width > Constants.MaxCounterRunWidth && runs.Count < maxRuns)
            {
                runs.Add(new List<decimal> { width });
            }
            else
            {
                current.Add(width);
            }
        }

        return runs;
    }

    private decimal PlaceRun(List<PlacedItem> items, List<decimal> run, Policy policy, decimal x)
    {
        // A workbench needs drawers where you stand: put them at the middle of the run.
        var drawerSlots = policy.PreferDrawers ? DrawerSlots(run) : new HashSet<int>();

        for (var i = 0; i < run.Count; i++)
        {
            var width = run[i];
            var skus = drawerSlots.Contains(i) ? DrawerBaseSkus
                : policy.PreferFullDoors ? FullDoorBaseSkus
                : DoorBaseSkus;

            items.Add(FromCatalog(skus[width], x, 0m, Zone.Base));
            x += width;
        }

        return x;
    }

    private static HashSet<int> DrawerSlots(List<decimal> run)
    {
        if (run.Count == 0)
        {
            return new HashSet<int>();
        }

        var centre = run.Count / 2;
        var slots = new HashSet<int> { centre };

        if (run.Count >= 4)
        {
            slots.Add(Math.Max(0, centre - 1));
        }

        return slots;
    }

    private decimal PlaceTall(List<PlacedItem> items, decimal width, decimal x)
    {
        items.Add(FromCatalog(TallSkus[width], x, 0m, Zone.Tall));
        return x + width;
    }

    private void PlaceCounter(List<PlacedItem> items, decimal left, decimal right)
    {
        var runWidth = right - left;

        if (runWidth <= 0m)
        {
            return;
        }

        var stock = _catalog.Countertops
            .Where(c => c.Width >= runWidth)
            .OrderBy(c => c.Width)
            .FirstOrDefault();

        if (stock is null)
        {
            return;
        }

        // Cut flush to the run: no overhang to collide with whatever sits beside it.
        items.Add(new PlacedItem(stock.Sku, left, Constants.BaseHeight, runWidth, stock.Thickness, stock.Depth, Zone.Counter));
    }

    private void PlaceWallCabinets(
        List<PlacedItem> items,
        decimal left,
        decimal right,
        Wall wall,
        IReadOnlyList<KeepOut> keepOuts,
        Policy policy)
    {
        var x = left;

        while (x < right)
        {
            var width = new[] { 30m, 24m, 15m }.FirstOrDefault(w => x + w <= right);

            if (width == 0m)
            {
                return;
            }

            var cabinet = FromCatalog(WallSkus[width], x, Constants.DatumTop - 30m, Zone.Wall);

            if (!keepOuts.Any(k => k.Blocks(cabinet)))
            {
                items.Add(cabinet);
                TryStack(items, policy, wall, keepOuts, x, width);
            }

            x += width;
        }
    }

    private void TryStack(
        List<PlacedItem> items,
        Policy policy,
        Wall wall,
        IReadOnlyList<KeepOut> keepOuts,
        decimal x,
        decimal width)
    {
        if (!policy.StackWallCabinets
            || wall.Ceiling < Constants.MinCeilingForStackedWall
            || !ShortWallSkus.TryGetValue(width, out var sku))
        {
            return;
        }

        var stacked = FromCatalog(sku, x, Constants.DatumTop, Zone.Wall);

        if (!keepOuts.Any(k => k.Blocks(stacked)))
        {
            items.Add(stacked);
        }
    }

    private PlacedItem Filler(decimal x, decimal fullHeight) =>
        FromCatalog("MV-F384", x, 0m, Zone.Filler) with { Height = fullHeight };

    private PlacedItem Filler(decimal x, bool nextToTall) =>
        Filler(x, nextToTall ? Constants.DatumTop : Constants.BaseHeight);

    private PlacedItem FromCatalog(string sku, decimal x, decimal y, Zone zone)
    {
        var cabinet = _catalog.Cabinet(sku);
        return new PlacedItem(sku, x, y, cabinet.Width, cabinet.Height, cabinet.Depth, zone);
    }
}
