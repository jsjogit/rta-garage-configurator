using System.Text.Json;
using GarageConfigurator.Core;

namespace GarageConfigurator.Core.Tests;

/// <summary>The wall shapes in data/fixtures/walls.json, keyed by fixture id.</summary>
internal static class WallFixtures
{
    private static readonly Lazy<IReadOnlyDictionary<string, Wall>> Cached = new(Load);

    internal static Wall Get(string id) => Cached.Value[id];

    internal static IReadOnlyDictionary<string, Wall> All => Cached.Value;

    private static IReadOnlyDictionary<string, Wall> Load()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(TestCatalog.Path("fixtures/walls.json")));

        return document.RootElement.EnumerateArray().ToDictionary(
            fixture => fixture.GetProperty("id").GetString()!,
            fixture => new Wall(
                fixture.GetProperty("length").GetDecimal(),
                fixture.GetProperty("ceiling").GetDecimal(),
                ReadObstructions(fixture)));
    }

    private static IReadOnlyList<Obstruction> ReadObstructions(JsonElement fixture) =>
        fixture.TryGetProperty("obstructions", out var obstructions)
            ? obstructions.EnumerateArray().Select(o => new Obstruction(
                Enum.Parse<ObstructionType>(o.GetProperty("type").GetString()!),
                o.GetProperty("startX").GetDecimal(),
                o.GetProperty("width").GetDecimal(),
                o.GetProperty("height").GetDecimal(),
                o.GetProperty("bottomY").GetDecimal())).ToList()
            : Array.Empty<Obstruction>();
}
