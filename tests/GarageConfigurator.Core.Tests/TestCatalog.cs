using GarageConfigurator.Core;

namespace GarageConfigurator.Core.Tests;

/// <summary>
/// Test-side file I/O. Core itself never touches the filesystem — it parses a JSON string.
/// </summary>
internal static class TestCatalog
{
    private static readonly Lazy<Catalog> Cached = new(() =>
        CatalogLoader.FromJson(File.ReadAllText(Path("catalog.json"))));

    private static readonly Lazy<PriceMap> CachedSeedPrices = new(() =>
        CatalogLoader.SeedPricesFromJson(File.ReadAllText(Path("catalog.json"))));

    internal static Catalog Load() => Cached.Value;

    internal static PriceMap LoadSeedPrices() => CachedSeedPrices.Value;

    internal static string Path(string fileName) =>
        System.IO.Path.Combine(AppContext.BaseDirectory, "data", fileName);
}
