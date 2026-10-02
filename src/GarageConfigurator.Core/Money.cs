namespace GarageConfigurator.Core;

/// <summary>List and optional promotional price for one SKU. Decimal USD, never float.</summary>
public sealed record Money(decimal List, decimal? Promo = null);
