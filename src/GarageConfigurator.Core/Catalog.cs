namespace GarageConfigurator.Core;

/// <summary>
/// The solver-visible catalog: everything a layout may be built from, plus the rule constants.
/// Items excluded from the solver (kitchen-line inserts, the virtual marketplace kit) are not here.
/// </summary>
public sealed record Catalog(
    Line Line,
    IReadOnlyList<Cabinet> Cabinets,
    IReadOnlyList<Countertop> Countertops,
    Constants Constants,
    IReadOnlyDictionary<string, string>? SkuAliases = null)
{
    /// <summary>Vendor sheets use a "-SF" suffix for boxes we list as "-F". See catalog.json skuAliases.</summary>
    public IReadOnlyDictionary<string, string> SkuAliases { get; } =
        SkuAliases ?? new Dictionary<string, string>(StringComparer.Ordinal);

    /// <summary>Maps an incoming SKU to the one we actually sell. Unknown SKUs pass through untouched
    /// so the caller still gets a useful "no such SKU" error rather than a silent miss.</summary>
    public string Resolve(string sku) => SkuAliases.TryGetValue(sku, out var canonical) ? canonical : sku;

    public Cabinet Cabinet(string sku)
    {
        var canonical = Resolve(sku);

        return Cabinets.FirstOrDefault(c => c.Sku == canonical)
            ?? throw new KeyNotFoundException($"No cabinet with SKU '{sku}' in the catalog.");
    }

    public Countertop Countertop(string sku)
    {
        var canonical = Resolve(sku);

        return Countertops.FirstOrDefault(c => c.Sku == canonical)
            ?? throw new KeyNotFoundException($"No countertop with SKU '{sku}' in the catalog.");
    }
}
