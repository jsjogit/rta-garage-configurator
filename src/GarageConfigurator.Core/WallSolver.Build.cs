namespace GarageConfigurator.Core;

public sealed partial class WallSolver
{
    private static readonly IReadOnlyDictionary<decimal, string> TallSkus = new Dictionary<decimal, string>
    {
        [30m] = "MV-PC3084",
        [24m] = "MV-PC2484"
    };

    /// <summary>
    /// Footprints are built in the Standard tier; <see cref="Tiering"/> derives Premiere from them.
    /// </summary>
    private static readonly IReadOnlyDictionary<decimal, string> BaseSkus = new Dictionary<decimal, string>
    {
        [30m] = "MV-B30-F", [24m] = "MV-B24-F", [15m] = "MV-B15"
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
        bool tallsAllowed,
        bool wallCabinetsAllowed)
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
            var slots = PlaceRun(items, runs[r], policy, x);
            x = slots.Count > 0 ? slots[^1].Right : x;

            if (policy.WantCounter)
            {
                PlaceCounter(items, runStart, x);
            }

            if (wallCabinetsAllowed)
            {
                PlaceUppers(items, slots, wall, keepOuts, policy);
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

    /// <summary>Lays a run out left to right and returns the slots, so the uppers can match them.</summary>
    private List<PlacedItem> PlaceRun(List<PlacedItem> items, List<decimal> run, Policy policy, decimal x)
    {
        var kneeIndex = KneeSlot(run, policy);
        var slots = new List<PlacedItem>();

        for (var i = 0; i < run.Count; i++)
        {
            var width = run[i];

            slots.Add(i == kneeIndex
                ? new PlacedItem(string.Empty, x, 0m, width, Constants.BaseHeight, 24m, Zone.KneeSpace)
                : FromCatalog(BaseSkus[width], x, 0m, Zone.Base));

            x += width;
        }

        items.AddRange(slots);

        return slots;
    }

    /// <summary>
    /// Which slot becomes the open knee space: a 24" or 30" module nearest the middle, never the
    /// first or last, so the counter always lands on a cabinet at both ends.
    /// </summary>
    private static int KneeSlot(List<decimal> run, Policy policy)
    {
        if (!policy.WantKneeSpace || !policy.WantCounter || run.Count < 3)
        {
            return -1;
        }

        var centre = run.Count / 2;

        for (var offset = 0; offset < run.Count; offset++)
        {
            foreach (var index in new[] { centre - offset, centre + offset })
            {
                if (index >= 1 && index <= run.Count - 2 && (run[index] == 24m || run[index] == 30m))
                {
                    return index;
                }
            }
        }

        return -1;
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

    /// <summary>
    /// One upper per slot below, width-matched. Over a knee space that is a 15" bridge hung on the
    /// datum, which is what leaves head room for whoever is sitting there.
    /// </summary>
    private void PlaceUppers(
        List<PlacedItem> items,
        IReadOnlyList<PlacedItem> slots,
        Wall wall,
        IReadOnlyList<KeepOut> keepOuts,
        Policy policy)
    {
        foreach (var slot in slots)
        {
            var isKnee = slot.Zone == Zone.KneeSpace;
            var table = isKnee ? ShortWallSkus : WallSkus;

            if (!table.TryGetValue(slot.Width, out var sku))
            {
                continue;
            }

            var height = isKnee ? 15m : 30m;
            var upper = FromCatalog(sku, slot.X, Constants.DatumTop - height, Zone.Wall);

            if (keepOuts.Any(k => k.Blocks(upper)))
            {
                continue;
            }

            items.Add(upper);

            if (!isKnee)
            {
                TryStack(items, policy, wall, keepOuts, slot.X, slot.Width);
            }
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
