namespace GarageConfigurator.Core;

/// <summary>A complete wall of placed items. Immutable: edits in the UI produce a new layout.</summary>
public sealed record Layout(
    IReadOnlyList<PlacedItem> Items,
    string? Label = null,
    string? ConfigId = null)
{
    /// <summary>Placements rolled up by SKU, in the order each SKU first appears on the wall.</summary>
    public IReadOnlyList<LineItem> LineItems { get; } = Items
        .GroupBy(item => item.Sku, StringComparer.Ordinal)
        .Select(group => new LineItem(group.Key, group.Count()))
        .ToList();

    /// <summary>Leftmost edge to rightmost edge, for comparing against the wall length.</summary>
    public decimal OccupiedWidth => Items.Count == 0
        ? 0m
        : Items.Max(item => item.Right) - Items.Min(item => item.X);
}
