namespace GarageConfigurator.Core;

/// <summary>
/// The solver-visible catalog: everything a layout may be built from, plus the rule constants.
/// Items excluded from the solver (kitchen-line inserts, the virtual marketplace kit) are not here.
/// </summary>
public sealed record Catalog(
    Line Line,
    IReadOnlyList<Cabinet> Cabinets,
    IReadOnlyList<Countertop> Countertops,
    Constants Constants)
{
    public Cabinet Cabinet(string sku) =>
        Cabinets.FirstOrDefault(c => c.Sku == sku)
        ?? throw new KeyNotFoundException($"No cabinet with SKU '{sku}' in the catalog.");

    public Countertop Countertop(string sku) =>
        Countertops.FirstOrDefault(c => c.Sku == sku)
        ?? throw new KeyNotFoundException($"No countertop with SKU '{sku}' in the catalog.");
}
