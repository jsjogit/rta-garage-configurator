namespace GarageConfigurator.Core;

/// <summary>
/// Two price points over one footprint. Standard is full-height door bases; Premiere swaps in drawer
/// banks wherever the width allows. Positions, counters, talls and uppers never move.
/// </summary>
public static class Tiering
{
    private static readonly IReadOnlyDictionary<decimal, string> StandardBases = new Dictionary<decimal, string>
    {
        [24m] = "MV-B24-F",
        [30m] = "MV-B30-F"
    };

    private static readonly IReadOnlyDictionary<decimal, string> FirstInRunDrawers = new Dictionary<decimal, string>
    {
        [24m] = "MV-DB24-3",
        [30m] = "MV-DB30-3"
    };

    private static readonly IReadOnlyDictionary<decimal, string> RestOfRunDrawers = new Dictionary<decimal, string>
    {
        [24m] = "MV-DB24-4",
        [30m] = "MV-DB30-4"
    };

    public static Layout Apply(Layout layout, Tier tier, Catalog catalog)
    {
        var firstBaseInEachRun = FirstBasePerRun(layout);

        var items = layout.Items
            .Select(item => item.Zone == Zone.Base
                ? item with { Sku = BaseSkuFor(item, tier, firstBaseInEachRun.Contains(item.X), catalog) }
                : item)
            .ToList();

        return layout with { Items = items, Tier = tier };
    }

    private static string BaseSkuFor(PlacedItem item, Tier tier, bool firstInRun, Catalog catalog)
    {
        var table = tier == Tier.Standard
            ? StandardBases
            : firstInRun ? FirstInRunDrawers : RestOfRunDrawers;

        // 15" positions have no drawer equivalent in the line, and the waste pullout stays put.
        if (!table.TryGetValue(item.Width, out var sku))
        {
            return item.Sku;
        }

        // Never emit a SKU the catalogue does not carry.
        return catalog.Cabinets.Any(c => c.Sku == sku) ? sku : item.Sku;
    }

    /// <summary>X positions of the first base cabinet in each unbroken run.</summary>
    private static HashSet<decimal> FirstBasePerRun(Layout layout)
    {
        var firsts = new HashSet<decimal>();
        PlacedItem? previous = null;

        foreach (var item in layout.Items
                     .Where(i => i.Zone is Zone.Base or Zone.KneeSpace)
                     .OrderBy(i => i.X))
        {
            var startsARun = previous is null || previous.Right != item.X;

            if (startsARun && item.Zone == Zone.Base)
            {
                firsts.Add(item.X);
            }
            else if (startsARun && firsts.Count == 0)
            {
                // Run opens on a knee space (invalid, but the validator reports that, not us).
            }

            previous = item;
        }

        return firsts;
    }
}
