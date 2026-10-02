namespace GarageConfigurator.Core;

/// <summary>
/// A countertop SKU. Cut to length on site, so <see cref="IdealRun"/> is the zero-waste base run
/// it was designed around (always Width - 2).
/// </summary>
public sealed record Countertop(
    string Sku,
    string Name,
    decimal Width,
    decimal Thickness,
    decimal Depth,
    decimal IdealRun);
