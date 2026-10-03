namespace GarageConfigurator.Core;

/// <summary>
/// Packs a wall. Enumerates floor compositions by width, assigns SKUs under a handful of per-goal
/// policies, drapes counters and wall cabinets, then scores and ranks. Every layout it returns has
/// already passed <see cref="LayoutValidator"/>, so the rules are an invariant of the output.
/// </summary>
public sealed partial class WallSolver
{
    private const int CompositionsPerSegment = 16;
    private const int LayoutsReturned = 3;

    private readonly Catalog _catalog;
    private readonly LayoutValidator _validator;

    public WallSolver(Catalog catalog)
    {
        _catalog = catalog;
        _validator = new LayoutValidator(catalog);
    }

    private Constants Constants => _catalog.Constants;

    public SolveResult Solve(Wall wall, Goal goal, PriceMap prices)
    {
        if (wall.Length < Constants.MinWallLength)
        {
            return SolveResult.Failed(
                SolveReason.WallTooShort,
                "This wall is too short for our smallest cabinet.");
        }

        if (wall.Ceiling < Constants.MinCeiling)
        {
            return SolveResult.Failed(
                SolveReason.CeilingTooLow,
                "This ceiling is too low for garage cabinets.");
        }

        var wallCabinetsAllowed = wall.Ceiling >= Constants.MinCeilingForWallCabinets;
        var tallsAllowed = wall.Ceiling >= Constants.MinCeilingForTalls;
        var notices = NoticesFor(wall, wallCabinetsAllowed, tallsAllowed);

        var scored = Search(wall, goal, prices, tallsAllowed, wallCabinetsAllowed);

        if (scored.Count == 0)
        {
            return SolveResult.Failed(
                SolveReason.NoLayoutFits,
                "We couldn't fit a layout on this wall — there may be too little clear space.");
        }

        return new SolveResult(Rank(scored, _catalog), null, notices);
    }

    // ---- search -----------------------------------------------------------------------------

    /// <summary>What the customer should be told about a wall we could still solve.</summary>
    private List<Notice> NoticesFor(Wall wall, bool wallCabinetsAllowed, bool tallsAllowed)
    {
        var notices = new List<Notice>();

        if (!wallCabinetsAllowed)
        {
            notices.Add(new Notice(
                NoticeCode.TallsExcludedLowCeiling,
                $"At {wall.Ceiling}\" there isn't room for tall pantries or wall cabinets — both need the " +
                $"run to reach {Constants.DatumTop}\". These layouts use base cabinets and a countertop, which " +
                "fit comfortably. A designer can suggest other ways to get storage up off the floor."));
        }
        else if (!tallsAllowed)
        {
            notices.Add(new Notice(
                NoticeCode.TallsNeedTipUpRoom,
                $"We've left pantry cabinets out of these layouts. They arrive fully assembled and stand " +
                $"{Constants.DatumTop}\" tall, so tilting one upright off the floor sweeps about " +
                $"{Constants.MinCeilingForTalls}\" — more than the {wall.Ceiling}\" you have. Rather than ask you " +
                "to take one apart in the garage, we've used base and wall cabinets instead. If you want pantry " +
                "storage here, one of our designers can talk through the options."));
        }

        if (wall.Obstructions.Any(o => Constants.ClearanceFor(o.Type) != Clearance.None))
        {
            notices.Add(new Notice(
                NoticeCode.ObstructionsWorthADesignerLook,
                "This wall has something on it we have to keep clear, so these layouts leave the required space " +
                "around it. That space is often the part worth a second opinion — if the result doesn't suit your " +
                "garage, one of our designers can work around it with you."));
        }

        return notices;
    }

    private List<ScoredLayout> Search(Wall wall, Goal goal, PriceMap prices, bool tallsAllowed, bool wallCabinetsAllowed)
    {
        var keepOuts = wall.Obstructions
            .Select(o => o.KeepOutWith(Constants.ClearanceFor(o.Type)))
            .ToList();

        var segments = FloorSegments(wall, keepOuts);
        var compositions = segments
            .Select(segment => Compositions(segment.Length))
            .ToList();

        var scored = new List<ScoredLayout>();

        foreach (var policy in Policies.For(goal, tallsAllowed, wallCabinetsAllowed))
        {
            for (var variant = 0; variant < CompositionsPerSegment; variant++)
            {
                var items = new List<PlacedItem>();

                for (var s = 0; s < segments.Count; s++)
                {
                    if (compositions[s].Count == 0)
                    {
                        continue;
                    }

                    var mix = compositions[s][variant % compositions[s].Count];
                    items.AddRange(BuildSegment(segments[s], mix, policy, wall, keepOuts, tallsAllowed, wallCabinetsAllowed));
                }

                if (items.Count == 0)
                {
                    continue;
                }

                var layout = new Layout(LimitWastePullouts(items));

                if (_validator.Validate(layout, wall).Count > 0)
                {
                    continue;
                }

                scored.Add(Score(layout, wall, goal, prices));
            }
        }

        return scored;
    }

    /// <summary>
    /// The waste pullout is the only 15" drawer unit, so the run builder reaches for it whenever a
    /// narrow drawer slot comes up. One bin on a garage wall is useful; two is a mistake.
    /// </summary>
    private IReadOnlyList<PlacedItem> LimitWastePullouts(IReadOnlyList<PlacedItem> items)
    {
        var seen = false;
        var result = new List<PlacedItem>(items.Count);

        foreach (var item in items)
        {
            if (item.Sku != "MV-BWB15-PS")
            {
                result.Add(item);
                continue;
            }

            result.Add(seen ? item with { Sku = "MV-B15" } : item);
            seen = true;
        }

        return result;
    }

    /// <summary>Stretches of floor no obstruction denies us.</summary>
    private static IReadOnlyList<Segment> FloorSegments(Wall wall, IReadOnlyList<KeepOut> keepOuts)
    {
        var blockers = keepOuts.Where(k => k.Bottom <= 0m).OrderBy(k => k.Left).ToList();
        var segments = new List<Segment>();
        var cursor = 0m;

        foreach (var blocker in blockers)
        {
            if (blocker.Left > cursor)
            {
                segments.Add(new Segment(cursor, blocker.Left));
            }

            cursor = Math.Max(cursor, blocker.Right);
        }

        if (cursor < wall.Length)
        {
            segments.Add(new Segment(cursor, wall.Length));
        }

        return segments;
    }

    /// <summary>
    /// DP over width: every multiset of cabinet widths that fits the segment, best fill first.
    /// Widths are 15/24/30 — fillers close what is left over.
    /// </summary>
    private static IReadOnlyList<WidthMix> Compositions(decimal length)
    {
        var mixes = new List<WidthMix>();

        for (var n30 = 0; n30 * 30m <= length; n30++)
        {
            for (var n24 = 0; (n30 * 30m) + (n24 * 24m) <= length; n24++)
            {
                for (var n15 = 0; (n30 * 30m) + (n24 * 24m) + (n15 * 15m) <= length; n15++)
                {
                    var used = (n30 * 30m) + (n24 * 24m) + (n15 * 15m);

                    if (used > 0m)
                    {
                        mixes.Add(new WidthMix(n15, n24, n30, length - used));
                    }
                }
            }
        }

        return mixes
            .OrderBy(m => m.Leftover)
            .ThenBy(m => m.Count)
            .Take(CompositionsPerSegment)
            .ToList();
    }

    private sealed record Segment(decimal Start, decimal End)
    {
        public decimal Length => End - Start;
    }

    private sealed record WidthMix(int N15, int N24, int N30, decimal Leftover)
    {
        public int Count => N15 + N24 + N30;

        /// <summary>Widest first — wide boxes mean fewer line items and a calmer elevation.</summary>
        public IReadOnlyList<decimal> Widths()
        {
            var widths = new List<decimal>();
            widths.AddRange(Enumerable.Repeat(30m, N30));
            widths.AddRange(Enumerable.Repeat(24m, N24));
            widths.AddRange(Enumerable.Repeat(15m, N15));
            return widths;
        }
    }

    private sealed record ScoredLayout(Layout Layout, decimal Score, decimal Price, decimal CubicFeet, decimal CounterLength);
}
