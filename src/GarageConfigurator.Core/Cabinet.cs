namespace GarageConfigurator.Core;

/// <summary>
/// A cabinet SKU. Dimensions in inches. Carries no price — prices arrive via <see cref="PriceMap"/>.
/// </summary>
public sealed record Cabinet(
    string Sku,
    string Name,
    Zone Zone,
    CabinetType Type,
    decimal Width,
    decimal Height,
    decimal Depth,
    int? Drawers = null,
    string? Notes = null);
