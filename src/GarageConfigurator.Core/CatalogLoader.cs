using System.Text.Json;

namespace GarageConfigurator.Core;

/// <summary>
/// Parses catalog.json. Takes a JSON string, never a file path: Core does no I/O, so the caller
/// owns reading the file (see docs/DECISIONS.md).
/// </summary>
public static class CatalogLoader
{
    public static Catalog FromJson(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        var excluded = ExcludedSkus(root);

        var cabinets = root.GetProperty("cabinets").EnumerateArray()
            .Select(ReadCabinet)
            .Where(c => !excluded.Contains(c.Sku))
            .ToList();

        var countertops = root.GetProperty("countertops").EnumerateArray()
            .Select(ReadCountertop)
            .Where(c => !excluded.Contains(c.Sku))
            .ToList();

        return new Catalog(
            ReadLine(root.GetProperty("line")),
            cabinets,
            countertops,
            ReadConstants(root.GetProperty("constants")),
            ReadAliases(root));
    }

    /// <summary>
    /// The development seed prices from catalog.json. Production supplies its own map from nopCommerce.
    /// </summary>
    public static PriceMap SeedPricesFromJson(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var excluded = ExcludedSkus(root);

        var prices = new Dictionary<string, Money>(StringComparer.Ordinal);

        foreach (var element in root.GetProperty("cabinets").EnumerateArray()
                     .Concat(root.GetProperty("countertops").EnumerateArray()))
        {
            var sku = element.GetProperty("sku").GetString()!;
            if (excluded.Contains(sku))
            {
                continue;
            }

            prices[sku] = new Money(
                element.GetProperty("listPrice").GetDecimal(),
                OptionalDecimal(element, "promoPrice"));
        }

        return new PriceMap(prices);
    }

    private static IReadOnlyDictionary<string, string> ReadAliases(JsonElement root)
    {
        var aliases = new Dictionary<string, string>(StringComparer.Ordinal);

        if (root.TryGetProperty("skuAliases", out var map))
        {
            foreach (var entry in map.EnumerateObject())
            {
                aliases[entry.Name] = entry.Value.GetString()!;
            }
        }

        return aliases;
    }

    /// <summary>
    /// SKUs the solver must never emit: kitchen-line inserts and any kit flagged virtual.
    /// </summary>
    private static HashSet<string> ExcludedSkus(JsonElement root)
    {
        var excluded = new HashSet<string>(StringComparer.Ordinal);

        if (root.TryGetProperty("excludedFromSolver", out var excludedList))
        {
            foreach (var element in excludedList.EnumerateArray())
            {
                excluded.Add(element.GetProperty("sku").GetString()!);
            }
        }

        if (root.TryGetProperty("kits", out var kits))
        {
            foreach (var kit in kits.EnumerateArray())
            {
                if (kit.TryGetProperty("excludeFromSolver", out var flag) && flag.GetBoolean())
                {
                    excluded.Add(kit.GetProperty("sku").GetString()!);
                }
            }
        }

        return excluded;
    }

    private static Line ReadLine(JsonElement element) => new(
        element.GetProperty("name").GetString()!,
        element.GetProperty("finish").GetString()!,
        element.GetProperty("doorStyle").GetString()!,
        element.GetProperty("pulls").GetString()!);

    private static Cabinet ReadCabinet(JsonElement element) => new(
        element.GetProperty("sku").GetString()!,
        element.GetProperty("name").GetString()!,
        ParseEnum<Zone>(element.GetProperty("zone").GetString()!, "zone"),
        ParseEnum<CabinetType>(element.GetProperty("type").GetString()!, "type"),
        element.GetProperty("w").GetDecimal(),
        element.GetProperty("h").GetDecimal(),
        element.GetProperty("d").GetDecimal(),
        element.TryGetProperty("drawers", out var drawers) ? drawers.GetInt32() : null,
        element.TryGetProperty("notes", out var notes) ? notes.GetString() : null);

    private static Countertop ReadCountertop(JsonElement element) => new(
        element.GetProperty("sku").GetString()!,
        element.GetProperty("name").GetString()!,
        element.GetProperty("w").GetDecimal(),
        element.GetProperty("h").GetDecimal(),
        element.GetProperty("d").GetDecimal(),
        element.GetProperty("idealRun").GetDecimal());

    private static Constants ReadConstants(JsonElement element) => new(
        element.GetProperty("baseHeight").GetDecimal(),
        element.GetProperty("counterThickness").GetDecimal(),
        element.GetProperty("wallCabinetBottomAboveCounter").GetDecimal(),
        element.GetProperty("datumTop").GetDecimal(),
        element.GetProperty("defaultCeiling").GetDecimal(),
        element.GetProperty("maxCounterOverhangPerSide").GetDecimal(),
        element.GetProperty("preferredCounterOverhangPerSide").GetDecimal(),
        element.GetProperty("endGapNeedsFillerAt").GetDecimal(),
        element.GetProperty("endGapPenaltyAt").GetDecimal(),
        element.GetProperty("legHeightMin").GetDecimal(),
        element.GetProperty("legHeightMax").GetDecimal(),
        element.GetProperty("minWallLength").GetDecimal(),
        element.GetProperty("maxCounterRunWidth").GetDecimal(),
        element.GetProperty("maxFillersPerEnd").GetInt32(),
        element.GetProperty("maxFillersPerObstructionEdge").GetInt32(),
        element.GetProperty("minCeiling").GetDecimal(),
        element.GetProperty("minCeilingForWallCabinets").GetDecimal(),
        element.GetProperty("minCeilingForTalls").GetDecimal(),
        element.GetProperty("minCeilingForStackedWall").GetDecimal(),
        ReadClearances(element.GetProperty("obstructionClearance")));

    private static IReadOnlyDictionary<ObstructionType, Clearance> ReadClearances(JsonElement element)
    {
        var clearances = new Dictionary<ObstructionType, Clearance>();

        foreach (var property in element.EnumerateObject())
        {
            // Keys beginning with "_" are documentation ("_note") or the fallback ("_default").
            if (property.Name.StartsWith('_'))
            {
                continue;
            }

            clearances[ParseEnum<ObstructionType>(property.Name, "obstructionClearance key")] = new Clearance(
                OptionalDecimal(property.Value, "sideMargin") ?? 0m,
                OptionalDecimal(property.Value, "minKeepOutWidth") ?? 0m,
                OptionalDecimal(property.Value, "keepOutFromFloorToY"));
        }

        return clearances;
    }

    private static decimal? OptionalDecimal(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.Number
            ? value.GetDecimal()
            : null;

    private static T ParseEnum<T>(string value, string what) where T : struct, Enum =>
        Enum.TryParse<T>(value, ignoreCase: false, out var parsed)
            ? parsed
            : throw new InvalidOperationException(
                $"catalog.json has an unknown {what} '{value}'. Add it to {typeof(T).Name} or fix the data.");
}
