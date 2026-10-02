using System.Text.Json;
using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

/// <summary>
/// Snapshots the SKUs and price of every layout the solver returns for each fixture wall, so a
/// scoring change that silently reshuffles customer-facing results shows up as a diff.
/// Regenerate with GOLDEN_UPDATE=1 dotnet test — and read the diff before committing it.
/// </summary>
public class GoldenLayoutTests
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public static TheoryData<string> Fixtures()
    {
        var data = new TheoryData<string>();

        foreach (var id in WallFixtures.All.Keys)
        {
            data.Add(id);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Fixtures))]
    public void Solver_output_matches_the_golden_file(string fixtureId)
    {
        var wall = WallFixtures.Get(fixtureId);
        var goal = WallFixtures.GoalFor(fixtureId);
        var prices = TestCatalog.LoadSeedPrices();

        var result = new WallSolver(TestCatalog.Load()).Solve(wall, goal, prices);

        var snapshot = JsonSerializer.Serialize(new
        {
            fixture = fixtureId,
            goal = goal.ToString(),
            failure = result.Failure?.Code.ToString(),
            notices = result.Notices.Select(n => n.Code.ToString()).ToArray(),
            layouts = result.Layouts.Select(layout => new
            {
                label = layout.Label,
                listTotal = layout.LineItems.Sum(i => prices.List(i.Sku) * i.Quantity),
                lineItems = layout.LineItems.Select(i => $"{i.Sku} x{i.Quantity}").ToArray()
            }).ToArray()
        }, Json);

        var path = Path.Combine(AppContext.BaseDirectory, "golden", $"{fixtureId}.json");

        if (Environment.GetEnvironmentVariable("GOLDEN_UPDATE") == "1")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, snapshot);
            return;
        }

        File.Exists(path).ShouldBeTrue($"missing golden file for {fixtureId} — run GOLDEN_UPDATE=1 dotnet test");
        snapshot.ShouldBe(File.ReadAllText(path));
    }
}
