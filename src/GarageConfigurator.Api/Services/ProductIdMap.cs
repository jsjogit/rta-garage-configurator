using System.Text.Json;

namespace GarageConfigurator.Api.Services;

/// <summary>
/// SKU to nopCommerce product id. nopCommerce adds to cart by integer id and the solver only ever
/// knows SKUs, so the store has to supply this. It is deliberately a hard dependency: a missing
/// entry stops the whole hand-off rather than quietly shipping part of a wall.
/// </summary>
public sealed class ProductIdMap
{
    private readonly IReadOnlyDictionary<string, int> _ids;

    public ProductIdMap(IReadOnlyDictionary<string, int> ids) => _ids = ids;

    public static ProductIdMap Empty { get; } = new(new Dictionary<string, int>(StringComparer.Ordinal));

    public int Count => _ids.Count;

    public bool TryGet(string sku, out int productId) => _ids.TryGetValue(sku, out productId);

    /// <summary>Reads data/nop-product-ids.json: a flat object of "SKU": productId.</summary>
    public static ProductIdMap FromJson(string json)
    {
        var ids = JsonSerializer.Deserialize<Dictionary<string, int>>(json)
                  ?? new Dictionary<string, int>();

        return new ProductIdMap(new Dictionary<string, int>(ids, StringComparer.Ordinal));
    }
}
