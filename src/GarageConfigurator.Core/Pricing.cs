namespace GarageConfigurator.Core;

/// <summary>One SKU on the quote, with the maths already done for the results card.</summary>
public sealed record PricedLineItem(
    string Sku,
    int Quantity,
    decimal UnitList,
    decimal UnitPromo,
    decimal ExtendedList,
    decimal ExtendedPromo);

/// <summary>A layout with money attached. The layout itself never carries prices.</summary>
public sealed record PricedLayout(
    Layout Layout,
    IReadOnlyList<PricedLineItem> LineItems,
    decimal SubtotalList,
    decimal SubtotalPromo);

public static class Pricing
{
    /// <summary>
    /// Applies a price map to a layout. Prices arrive per request — in production from nopCommerce —
    /// so the same layout can be quoted differently without rebuilding it.
    /// </summary>
    public static PricedLayout Price(Layout layout, PriceMap prices)
    {
        var lineItems = layout.LineItems
            .Select(item =>
            {
                var unitList = prices.List(item.Sku);
                var unitPromo = prices.Promo(item.Sku);

                return new PricedLineItem(
                    item.Sku,
                    item.Quantity,
                    unitList,
                    unitPromo,
                    unitList * item.Quantity,
                    unitPromo * item.Quantity);
            })
            .ToList();

        return new PricedLayout(
            layout,
            lineItems,
            lineItems.Sum(i => i.ExtendedList),
            lineItems.Sum(i => i.ExtendedPromo));
    }
}
