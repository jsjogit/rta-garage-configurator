namespace GarageConfigurator.Core;

/// <summary>
/// Prices supplied per request. In production these come from nopCommerce; in development they come
/// from the seed block in catalog.json. The solver never reads prices from a file at runtime.
/// </summary>
public sealed class PriceMap
{
    private readonly IReadOnlyDictionary<string, Money> _prices;

    public PriceMap(IReadOnlyDictionary<string, Money> prices) => _prices = prices;

    public IEnumerable<string> Skus => _prices.Keys;

    public bool Contains(string sku) => _prices.ContainsKey(sku);

    /// <summary>List price. Throws rather than defaulting to zero — a missing price is a bug, not a freebie.</summary>
    public decimal List(string sku) => Lookup(sku).List;

    /// <summary>Promotional price, falling back to list when the SKU has no promo.</summary>
    public decimal Promo(string sku)
    {
        var money = Lookup(sku);
        return money.Promo ?? money.List;
    }

    private Money Lookup(string sku) =>
        _prices.TryGetValue(sku, out var money)
            ? money
            : throw new KeyNotFoundException($"No price supplied for SKU '{sku}'.");
}
