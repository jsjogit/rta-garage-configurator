using System.Text.Json;
using GarageConfigurator.Api.Contracts;
using Shouldly;

namespace GarageConfigurator.Api.Tests;

/// <summary>
/// Writes real /solve payloads into web/src/fixtures so the web app's tests render exactly what the
/// API returns. Regenerate with GOLDEN_UPDATE=1; otherwise this asserts the committed fixtures are
/// still what the API produces, which is what stops the web drifting from the solver.
/// </summary>
public class WebFixtureExportTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private static readonly (string Name, WallDto Wall, string Goal)[] Cases =
    {
        ("vignette-72", new WallDto(72m, 96m), "Workbench"),
        ("single-car-clean", new WallDto(240m, 96m), "Balanced"),
        ("two-car-panel", new WallDto(240m, 96m,
            new[] { new ObstructionDto("ElectricalPanel", 180m, 16m, 30m, 48m) }), "Workbench"),
        ("storage-240", new WallDto(240m, 96m), "Storage"),
        ("tip-up-84", new WallDto(240m, 84m), "Storage"),
        ("too-short", new WallDto(12m, 96m), "Balanced")
    };

    public static TheoryData<string> Names()
    {
        var data = new TheoryData<string>();

        foreach (var (name, _, _) in Cases)
        {
            data.Add(name);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Names))]
    public void Web_fixture_matches_what_the_api_returns(string name)
    {
        var (_, wall, goal) = Cases.Single(c => c.Name == name);
        var json = JsonSerializer.Serialize(ApiFixture.Api().Solve(new SolveRequest(wall, goal)), Web);

        var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        var path = Path.Combine(repoRoot, "web", "src", "fixtures", $"{name}.json");

        if (Environment.GetEnvironmentVariable("GOLDEN_UPDATE") == "1")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, json);
            return;
        }

        File.Exists(path).ShouldBeTrue($"missing web fixture {name} — run GOLDEN_UPDATE=1 dotnet test");
        json.ShouldBe(File.ReadAllText(path), $"web fixture {name} is stale; regenerate with GOLDEN_UPDATE=1");
    }
}
