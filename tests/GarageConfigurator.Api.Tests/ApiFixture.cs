using GarageConfigurator.Api.Services;
using GarageConfigurator.Core;

namespace GarageConfigurator.Api.Tests;

internal static class ApiFixture
{
    internal static string CatalogJson() =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "data", "catalog.json"));

    internal static Catalog Catalog() => CatalogLoader.FromJson(CatalogJson());

    internal static GarageApi Api(IDesignStore? store = null, Random? random = null) =>
        new(Catalog(),
            new SeedPriceSource(CatalogJson()),
            new DesignService(store ?? new InMemoryDesignStore(), random ?? new Random(1)));
}
