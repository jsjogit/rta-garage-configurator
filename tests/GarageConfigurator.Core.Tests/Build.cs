using GarageConfigurator.Core;

namespace GarageConfigurator.Core.Tests;

/// <summary>Terse constructors for placed items, so a test reads as the wall it describes.</summary>
internal static class Build
{
    internal const decimal BaseTop = 34.5m;

    internal static PlacedItem Base(string sku, decimal x, decimal width, decimal y = 0m) =>
        new(sku, x, y, width, BaseTop, 24m, Zone.Base);

    internal static PlacedItem Tall(string sku, decimal x, decimal width, decimal y = 0m) =>
        new(sku, x, y, width, 84m, 24m, Zone.Tall);

    internal static PlacedItem Counter(string sku, decimal x, decimal width, decimal y = BaseTop) =>
        new(sku, x, y, width, 1.5m, 25m, Zone.Counter);

    internal static PlacedItem WallCab(string sku, decimal x, decimal width, decimal height, decimal y) =>
        new(sku, x, y, width, height, 12m, Zone.Wall);

    internal static PlacedItem Knee(decimal x, decimal width) =>
        new(string.Empty, x, 0m, width, BaseTop, 24m, Zone.KneeSpace);

    internal static PlacedItem Filler(decimal x, decimal height = BaseTop) =>
        new("MV-F384", x, 0m, 3m, height, 24m, Zone.Filler);

    internal static Layout Layout(params PlacedItem[] items) => new(items);

    internal static IReadOnlyList<ViolationCode> Codes(this IReadOnlyList<Violation> violations) =>
        violations.Select(v => v.Code).ToList();
}
