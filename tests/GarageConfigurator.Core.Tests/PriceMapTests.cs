using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

/// <summary>
/// Prices live in a PriceMap supplied per request, never on the Cabinet record.
/// See docs/DECISIONS.md 2026-10-02.
/// </summary>
public class PriceMapTests
{
    [Fact]
    public void Seed_price_map_covers_every_cabinet_and_countertop()
    {
        var catalog = TestCatalog.Load();
        var prices = TestCatalog.LoadSeedPrices();

        var allSkus = catalog.Cabinets.Select(c => c.Sku)
            .Concat(catalog.Countertops.Select(c => c.Sku))
            .ToList();

        allSkus.ShouldNotBeEmpty();
        allSkus.ShouldAllBe(sku => prices.Contains(sku));
    }

    [Fact]
    public void Seed_prices_are_decimal_and_positive()
    {
        var prices = TestCatalog.LoadSeedPrices();
        var skus = prices.Skus.ToList();

        skus.ShouldNotBeEmpty();
        skus.ShouldAllBe(sku => prices.List(sku) > 0m);
    }

    [Fact]
    public void Looking_up_an_unknown_sku_throws_rather_than_returning_zero()
    {
        var prices = TestCatalog.LoadSeedPrices();

        var exception = Should.Throw<KeyNotFoundException>(() => prices.List("NOT-A-SKU"));

        exception.Message.ShouldContain("NOT-A-SKU");
    }

    [Fact]
    public void Promo_price_falls_back_to_list_when_no_promo_is_supplied()
    {
        var prices = new PriceMap(new Dictionary<string, Money>
        {
            ["MV-B24"] = new Money(List: 801.90m, Promo: null)
        });

        prices.Promo("MV-B24").ShouldBe(801.90m);
    }
}
