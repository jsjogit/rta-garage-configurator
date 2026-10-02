using GarageConfigurator.Core;
using Shouldly;
using static GarageConfigurator.Core.Tests.Build;

namespace GarageConfigurator.Core.Tests;

/// <summary>Price(Layout, PriceMap) from the "Validation API" section of docs/SOLVER_RULES.md.</summary>
public class PricingTests
{
    private static readonly PriceMap Prices = new(new Dictionary<string, Money>
    {
        ["MV-B24"] = new Money(List: 801.90m, Promo: 601.42m),
        ["MV-B30"] = new Money(List: 1013.76m, Promo: null)
    });

    private static Layout TwoB24AndOneB30 => Layout(
        Base("MV-B24", 0m, 24m),
        Base("MV-B24", 24m, 24m),
        Base("MV-B30", 48m, 30m));

    [Fact]
    public void Line_items_carry_the_quantity_of_each_sku()
    {
        var priced = Pricing.Price(TwoB24AndOneB30, Prices);

        priced.LineItems.Single(i => i.Sku == "MV-B24").Quantity.ShouldBe(2);
    }

    [Fact]
    public void Extended_price_is_the_unit_price_times_the_quantity()
    {
        var priced = Pricing.Price(TwoB24AndOneB30, Prices);
        var line = priced.LineItems.Single(i => i.Sku == "MV-B24");

        line.ExtendedList.ShouldBe(1603.80m);
    }

    [Fact]
    public void List_subtotal_adds_up_the_extended_list_prices()
    {
        Pricing.Price(TwoB24AndOneB30, Prices).SubtotalList.ShouldBe(2617.56m);
    }

    [Fact]
    public void Promo_subtotal_uses_promo_prices_where_they_are_supplied()
    {
        // 2 x 601.42 promo + 1 x 1013.76 with no promo of its own.
        Pricing.Price(TwoB24AndOneB30, Prices).SubtotalPromo.ShouldBe(2216.60m);
    }

    [Fact]
    public void A_sku_with_no_promo_price_falls_back_to_list()
    {
        var priced = Pricing.Price(TwoB24AndOneB30, Prices);

        priced.LineItems.Single(i => i.Sku == "MV-B30").UnitPromo.ShouldBe(1013.76m);
    }

    [Fact]
    public void Pricing_a_layout_with_an_unpriced_sku_throws_rather_than_quoting_zero()
    {
        var layout = Layout(Base("MV-B15", 0m, 15m));

        Should.Throw<KeyNotFoundException>(() => Pricing.Price(layout, Prices))
            .Message.ShouldContain("MV-B15");
    }

    [Fact]
    public void Money_stays_decimal_all_the_way_through()
    {
        var priced = Pricing.Price(TwoB24AndOneB30, Prices);

        priced.SubtotalList.GetType().ShouldBe(typeof(decimal));
    }
}
