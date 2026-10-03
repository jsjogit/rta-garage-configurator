namespace GarageConfigurator.Core;

/// <summary>A complete wall of placed items. Immutable: edits in the UI produce a new layout.</summary>
public sealed record Layout(
    IReadOnlyList<PlacedItem> Items,
    string? Label = null,
    string? ConfigId = null,
    Tier Tier = Tier.Standard)
{
    /// <summary>
    /// Placements rolled up by SKU, in the order each SKU first appears on the wall. Knee spaces are
    /// not products, so they never appear.
    /// Computed on access rather than stored: a record `with { Items = ... }` copies backing fields,
    /// so a stored roll-up would survive an edit and quote the layout we no longer have.
    /// </summary>
    public IReadOnlyList<LineItem> LineItems => Items
        .Where(item => item.Zone != Zone.KneeSpace)
        .GroupBy(item => item.Sku, StringComparer.Ordinal)
        .Select(group => new LineItem(group.Key, group.Count()))
        .ToList();

    /// <summary>Leftmost edge to rightmost edge, for comparing against the wall length.</summary>
    public decimal OccupiedWidth => Items.Count == 0
        ? 0m
        : Items.Max(item => item.Right) - Items.Min(item => item.X);
}
