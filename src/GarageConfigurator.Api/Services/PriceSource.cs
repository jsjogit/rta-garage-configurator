using GarageConfigurator.Core;

namespace GarageConfigurator.Api.Services;

/// <summary>
/// Where prices come from at request time. Phase 1 reads the development seed out of catalog.json;
/// production swaps in a nopCommerce-backed implementation. This interface is that swap point —
/// Core never reads prices itself.
/// </summary>
public interface IPriceSource
{
    PriceMap Current();
}

public sealed class SeedPriceSource : IPriceSource
{
    private readonly PriceMap _prices;

    public SeedPriceSource(string catalogJson) => _prices = CatalogLoader.SeedPricesFromJson(catalogJson);

    public PriceMap Current() => _prices;
}
