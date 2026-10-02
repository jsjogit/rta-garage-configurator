namespace GarageConfigurator.Core;

/// <summary>A layout's placements rolled up by SKU. Pricing is applied later, from a PriceMap.</summary>
public sealed record LineItem(string Sku, int Quantity);
