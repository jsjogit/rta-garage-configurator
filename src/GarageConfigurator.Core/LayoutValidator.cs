namespace GarageConfigurator.Core;

/// <summary>
/// Checks a layout against every rule in docs/SOLVER_RULES.md. Used by the editor so a customer
/// edit re-validates instantly, and by the solver's own tests.
/// </summary>
public sealed class LayoutValidator
{
    private readonly Catalog _catalog;

    public LayoutValidator(Catalog catalog) => _catalog = catalog;

    private Constants Constants => _catalog.Constants;

    public IReadOnlyList<Violation> Validate(Layout layout, Wall wall)
    {
        var violations = new List<Violation>();

        ValidateVerticalGrammar(layout, wall, violations);
        ValidateHorizontalGrammar(layout, wall, violations);
        ValidateCounterRules(layout, violations);

        return violations;
    }

    /// <summary>Bases, talls and fillers — the items that stand on the floor and consume wall length.</summary>
    private static IReadOnlyList<PlacedItem> FloorRun(Layout layout) =>
        layout.Items
            .Where(i => i.Zone is Zone.Base or Zone.Tall or Zone.Filler)
            .OrderBy(i => i.X)
            .ToList();

    private void ValidateHorizontalGrammar(Layout layout, Wall wall, List<Violation> violations)
    {
        var keepOuts = KeepOutsFor(wall);

        ValidateWithinWall(layout, wall, violations);
        ValidateNothingOverlaps(layout, violations);
        ValidateObstructions(layout, keepOuts, violations);

        var floorRun = FloorRun(layout);

        ValidateFloorRunButtsTogether(floorRun, keepOuts, violations);
        ValidateEndGaps(floorRun, wall, violations);
        ValidateFillerPlacement(floorRun, wall, keepOuts, violations);
    }

    private IReadOnlyList<KeepOut> KeepOutsFor(Wall wall) =>
        wall.Obstructions.Select(o => o.KeepOutWith(Constants.ClearanceFor(o.Type))).ToList();

    private static void ValidateObstructions(
        Layout layout,
        IReadOnlyList<KeepOut> keepOuts,
        List<Violation> violations)
    {
        foreach (var item in layout.Items)
        {
            if (keepOuts.Any(keepOut => keepOut.Blocks(item)))
            {
                violations.Add(new Violation(
                    ViolationCode.ItemOverlapsObstruction,
                    "This cabinet runs into something on the wall — we need to leave that area clear.",
                    item.Sku));
            }
        }
    }

    private static void ValidateWithinWall(Layout layout, Wall wall, List<Violation> violations)
    {
        foreach (var item in layout.Items.Where(i => i.X < 0m || i.Right > wall.Length))
        {
            violations.Add(new Violation(
                ViolationCode.ItemOutsideWall,
                $"This cabinet runs from {item.X}\" to {item.Right}\", outside the {wall.Length}\" wall.",
                item.Sku));
        }
    }

    private static void ValidateNothingOverlaps(Layout layout, List<Violation> violations)
    {
        var items = layout.Items;

        for (var i = 0; i < items.Count; i++)
        {
            for (var j = i + 1; j < items.Count; j++)
            {
                if (OverlapsHorizontally(items[i], items[j]) && OverlapsVertically(items[i], items[j]))
                {
                    violations.Add(new Violation(
                        ViolationCode.ItemsOverlap,
                        $"{items[i].Sku} and {items[j].Sku} occupy the same space.",
                        items[i].Sku));
                }
            }
        }
    }

    private static void ValidateFloorRunButtsTogether(
        IReadOnlyList<PlacedItem> floorRun,
        IReadOnlyList<KeepOut> keepOuts,
        List<Violation> violations)
    {
        for (var i = 1; i < floorRun.Count; i++)
        {
            var gap = floorRun[i].X - floorRun[i - 1].Right;

            // A break the run had to leave for an obstruction is not a mistake.
            var forcedByObstruction = keepOuts.Any(k => k.Explains(floorRun[i - 1].Right, floorRun[i].X));

            if (gap > 0m && !forcedByObstruction)
            {
                violations.Add(new Violation(
                    ViolationCode.GapBetweenCabinets,
                    $"There is a {gap}\" gap between {floorRun[i - 1].Sku} and {floorRun[i].Sku}; cabinets butt together.",
                    floorRun[i].Sku));
            }
        }
    }

    /// <summary>
    /// A gap of 3" or more at an end must be closed with a filler — but only while a filler can actually
    /// close it. Anything wider is an underfilled wall, which the solver scores down rather than rejects
    /// (see docs/DECISIONS.md).
    /// </summary>
    private void ValidateEndGaps(IReadOnlyList<PlacedItem> floorRun, Wall wall, List<Violation> violations)
    {
        if (floorRun.Count == 0)
        {
            return;
        }

        AddEndGapViolation(floorRun[0].X, "left", violations);
        AddEndGapViolation(wall.Length - floorRun[^1].Right, "right", violations);
    }

    private void AddEndGapViolation(decimal gap, string end, List<Violation> violations)
    {
        if (gap >= Constants.EndGapNeedsFillerAt && gap < Constants.EndGapPenaltyAt)
        {
            violations.Add(new Violation(
                ViolationCode.EndGapNeedsFiller,
                $"There is a {gap}\" gap at the {end} end — close it with a filler strip."));
        }
    }

    /// <summary>
    /// Fillers close gaps at the ends of the wall. A filler stranded between two cabinets is a
    /// mistake, and one end never takes more than a single filler.
    /// </summary>
    private void ValidateFillerPlacement(
        IReadOnlyList<PlacedItem> floorRun,
        Wall wall,
        IReadOnlyList<KeepOut> keepOuts,
        List<Violation> violations)
    {
        foreach (var group in ContiguousFillerGroups(floorRun))
        {
            var touchesAnEnd = group[0].X == 0m || group[^1].Right == wall.Length;
            var touchesAnObstruction = keepOuts.Any(k => k.TouchesAt(group[0].X) || k.TouchesAt(group[^1].Right));

            if (!touchesAnEnd && !touchesAnObstruction)
            {
                violations.Add(new Violation(
                    ViolationCode.FillerBetweenCabinets,
                    "A filler strip belongs at the end of a wall or against an obstruction, not between two cabinets.",
                    group[0].Sku));
            }
            else if (group.Count > Constants.MaxFillersPerEnd)
            {
                violations.Add(new Violation(
                    ViolationCode.TooManyFillers,
                    $"Only {Constants.MaxFillersPerEnd} filler strip fits at each end of the wall; this end has {group.Count}.",
                    group[0].Sku));
            }
        }
    }

    private static IEnumerable<IReadOnlyList<PlacedItem>> ContiguousFillerGroups(IReadOnlyList<PlacedItem> floorRun)
    {
        var group = new List<PlacedItem>();

        foreach (var item in floorRun)
        {
            if (item.Zone != Zone.Filler)
            {
                if (group.Count > 0)
                {
                    yield return group;
                    group = new List<PlacedItem>();
                }

                continue;
            }

            if (group.Count > 0 && group[^1].Right != item.X)
            {
                yield return group;
                group = new List<PlacedItem>();
            }

            group.Add(item);
        }

        if (group.Count > 0)
        {
            yield return group;
        }
    }

    private void ValidateCounterRules(Layout layout, List<Violation> violations)
    {
        var runs = ContiguousBaseRuns(layout);
        var talls = layout.Items.Where(i => i.Zone == Zone.Tall).ToList();

        var counters = layout.Items.Where(i => i.Zone == Zone.Counter).ToList();
        var countersPerRun = new Dictionary<int, int>();

        foreach (var counter in counters)
        {
            var coveredRunIndexes = runs
                .Select((run, index) => (run, index))
                .Where(entry => entry.run.Any(b => OverlapsHorizontally(b, counter)))
                .ToList();

            if (coveredRunIndexes.Count != 1)
            {
                violations.Add(new Violation(
                    ViolationCode.CounterNotOverBases,
                    "A countertop spans one unbroken run of base cabinets.",
                    counter.Sku));
                continue;
            }

            var (coveredRun, runIndex) = coveredRunIndexes[0];
            countersPerRun[runIndex] = countersPerRun.GetValueOrDefault(runIndex) + 1;

            ValidateCounterAgainstRun(counter, coveredRun, talls, violations);
        }

        // Phase 1 does not join tops end to end — one run takes one countertop.
        foreach (var runIndex in countersPerRun.Where(entry => entry.Value > 1).Select(entry => entry.Key))
        {
            violations.Add(new Violation(
                ViolationCode.CountersJoinedEndToEnd,
                "We don't join countertops end to end — this run needs a single top, or splitting into two runs."));
        }
    }

    private void ValidateCounterAgainstRun(
        PlacedItem counter,
        IReadOnlyList<PlacedItem> run,
        IReadOnlyList<PlacedItem> talls,
        List<Violation> violations)
    {
        var runLeft = run.Min(b => b.X);
        var runRight = run.Max(b => b.Right);
        var runWidth = runRight - runLeft;

        if (runWidth > Constants.MaxCounterRunWidth)
        {
            violations.Add(new Violation(
                ViolationCode.CounterRunTooLong,
                $"A {runWidth}\" run is longer than our widest countertop ({Constants.MaxCounterRunWidth}\") — " +
                "split it into two runs.",
                counter.Sku));
        }

        // Counters are cut to length, so the placed width is the cut size — the constraint is the
        // stock top it was cut from.
        var stockWidth = StockWidthOf(counter);

        if (stockWidth < Math.Max(runWidth, counter.Width))
        {
            violations.Add(new Violation(
                ViolationCode.CounterTooShortForRun,
                $"A {stockWidth}\" countertop can't cover this {runWidth}\" run{SuggestCountertop(runWidth)}.",
                counter.Sku));
        }

        // Counters are cut to length, so an overhang is only allowed where the run ends in open air.
        ValidateOverhang(runLeft - counter.X, counter, violations);
        ValidateOverhang(counter.Right - runRight, counter, violations);

        if (talls.Any(tall => OverlapsHorizontally(tall, counter)))
        {
            violations.Add(new Violation(
                ViolationCode.CounterOverlapsTall,
                "A countertop is cut flush where it meets a tall cabinet — it can't run past it.",
                counter.Sku));
        }
    }

    private void ValidateOverhang(decimal overhang, PlacedItem counter, List<Violation> violations)
    {
        if (overhang > Constants.MaxCounterOverhangPerSide)
        {
            violations.Add(new Violation(
                ViolationCode.CounterOverhangTooDeep,
                $"This countertop overhangs by {overhang}\"; keep it to {Constants.MaxCounterOverhangPerSide}\" or less.",
                counter.Sku));
        }
    }

    private decimal StockWidthOf(PlacedItem counter) =>
        _catalog.Countertops.FirstOrDefault(c => c.Sku == counter.Sku)?.Width ?? counter.Width;

    private string SuggestCountertop(decimal runWidth)
    {
        var next = _catalog.Countertops
            .Where(c => c.Width >= runWidth)
            .OrderBy(c => c.Width)
            .FirstOrDefault();

        return next is null ? string.Empty : $" — try the {next.Width}\"";
    }

    /// <summary>Base cabinets grouped into unbroken runs. BWB15-PS is a base, so it joins a run like any other.</summary>
    private static IReadOnlyList<IReadOnlyList<PlacedItem>> ContiguousBaseRuns(Layout layout)
    {
        var runs = new List<IReadOnlyList<PlacedItem>>();
        var current = new List<PlacedItem>();

        foreach (var cabinet in layout.Items.Where(i => i.Zone == Zone.Base).OrderBy(i => i.X))
        {
            if (current.Count > 0 && current[^1].Right != cabinet.X)
            {
                runs.Add(current);
                current = new List<PlacedItem>();
            }

            current.Add(cabinet);
        }

        if (current.Count > 0)
        {
            runs.Add(current);
        }

        return runs;
    }

    private void ValidateVerticalGrammar(Layout layout, Wall wall, List<Violation> violations)
    {
        foreach (var item in layout.Items)
        {
            ValidateRestsOnFloor(item, violations);
            ValidateHangingHeight(item, layout, wall, violations);
            ValidateNothingAboveATall(item, layout, violations);
            ValidateFitsUnderTheCeiling(item, wall, violations);
            ValidateCeilingBand(item, wall, violations);
        }
    }

    private void ValidateRestsOnFloor(PlacedItem item, List<Violation> violations)
    {
        if (item.Y == 0m)
        {
            return;
        }

        if (item.Zone == Zone.Base)
        {
            violations.Add(new Violation(
                ViolationCode.BaseNotOnFloor,
                $"Base cabinets sit on the floor; this one is {item.Y}\" up.",
                item.Sku));
        }
        else if (item.Zone == Zone.Tall)
        {
            violations.Add(new Violation(
                ViolationCode.TallNotOnFloor,
                $"Tall cabinets sit on the floor; this one is {item.Y}\" up.",
                item.Sku));
        }
    }

    private void ValidateHangingHeight(PlacedItem item, Layout layout, Wall wall, List<Violation> violations)
    {
        if (item.Zone == Zone.Counter && item.Y != Constants.BaseHeight)
        {
            violations.Add(new Violation(
                ViolationCode.CounterAtWrongHeight,
                $"A countertop rests on the base run at {Constants.BaseHeight}\", not {item.Y}\".",
                item.Sku));
            return;
        }

        if (item.Zone != Zone.Wall)
        {
            return;
        }

        if (IsStackedOnAWallCabinet(item, layout))
        {
            if (wall.Ceiling < Constants.MinCeilingForStackedWall)
            {
                violations.Add(new Violation(
                    ViolationCode.StackedWallNeedsTallerCeiling,
                    $"Stacking a {item.Height}\" cabinet on top of a wall cabinet needs a ceiling of at least " +
                    $"{Constants.MinCeilingForStackedWall}\"; this garage is {wall.Ceiling}\".",
                    item.Sku));
            }

            return;
        }

        // Wall-cabinet tops align with pantry tops on the datum line.
        var expectedY = Constants.DatumTop - item.Height;

        if (item.Y != expectedY)
        {
            violations.Add(new Violation(
                ViolationCode.WallCabinetAtWrongHeight,
                $"A {item.Height}\" wall cabinet hangs at {expectedY}\" so its top lands on the " +
                $"{Constants.DatumTop}\" line; this one is at {item.Y}\".",
                item.Sku));
        }
    }

    private static bool IsStackedOnAWallCabinet(PlacedItem item, Layout layout) =>
        layout.Items.Any(other =>
            other.Zone == Zone.Wall
            && !ReferenceEquals(other, item)
            && other.Top == item.Y
            && OverlapsHorizontally(other, item));

    private static void ValidateNothingAboveATall(PlacedItem item, Layout layout, List<Violation> violations)
    {
        var tallBelow = layout.Items.FirstOrDefault(other =>
            other.Zone == Zone.Tall
            && !ReferenceEquals(other, item)
            && item.Y >= other.Top
            && OverlapsHorizontally(other, item));

        if (tallBelow is not null)
        {
            violations.Add(new Violation(
                ViolationCode.ItemAboveTall,
                "Nothing can be mounted above a tall cabinet — it already reaches the top of the run.",
                item.Sku));
        }
    }

    private static void ValidateFitsUnderTheCeiling(PlacedItem item, Wall wall, List<Violation> violations)
    {
        if (item.Top > wall.Ceiling)
        {
            violations.Add(new Violation(
                ViolationCode.ItemExceedsCeiling,
                $"This cabinet reaches {item.Top}\", above the {wall.Ceiling}\" ceiling.",
                item.Sku));
        }
    }

    /// <summary>
    /// Below 84" the datum does not fit, so talls and wall cabinets are off the table entirely —
    /// bases and counters only.
    /// </summary>
    private void ValidateCeilingBand(PlacedItem item, Wall wall, List<Violation> violations)
    {
        if (wall.Ceiling >= Constants.MinCeilingForTallsAndWalls)
        {
            return;
        }

        if (item.Zone is Zone.Tall or Zone.Wall)
        {
            violations.Add(new Violation(
                ViolationCode.CeilingTooLowForItem,
                $"A {wall.Ceiling}\" ceiling is too low for tall and wall cabinets — " +
                $"they need at least {Constants.MinCeilingForTallsAndWalls}\". Base cabinets and a countertop still fit.",
                item.Sku));
        }
    }

    private static bool OverlapsHorizontally(PlacedItem a, PlacedItem b) =>
        a.X < b.Right && b.X < a.Right;

    private static bool OverlapsVertically(PlacedItem a, PlacedItem b) =>
        a.Y < b.Top && b.Y < a.Top;
}
