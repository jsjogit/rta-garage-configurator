using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

/// <summary>"Max storage" has to mean it: no other goal may out-store its recommended wall.</summary>
public class StorageGoalTests
{
    private static readonly WallSolver Solver = new(TestCatalog.Load());
    private static readonly PriceMap Prices = TestCatalog.LoadSeedPrices();

    private static decimal CubicFeet(Layout layout) =>
        layout.Items
            .Where(i => i.Zone is Zone.Base or Zone.Tall or Zone.Wall)
            .Sum(i => i.Width * i.Height * i.Depth) / 1728m;

    private static int Talls(Layout layout) => layout.Items.Count(i => i.Zone == Zone.Tall);

    public static IEnumerable<object[]> Obstructed()
    {
        yield return new object[] { "none", Array.Empty<Obstruction>() };

        foreach (var x in new[] { 0m, 12m, 29m, 48m, 72m })
        {
            yield return new object[] { $"window at {x}", new[] { new Obstruction(ObstructionType.Window, x, 24m, 36m, 40m) } };
        }

        yield return new object[] { "side door", new[] { new Obstruction(ObstructionType.SideDoor, 36m, 32m, 80m, 0m) } };
        yield return new object[] { "electrical panel", new[] { new Obstruction(ObstructionType.ElectricalPanel, 40m, 14m, 20m, 48m) } };
        yield return new object[] { "water heater", new[] { new Obstruction(ObstructionType.WaterHeater, 0m, 24m, 60m, 0m) } };
    }

    [Fact]
    public void Max_storage_on_the_reported_wall_has_the_most_pantries()
    {
        // Found in the demo: 11' wall, 9' ceiling, a window 29" in. "A bit of both" drew two pantries
        // and "Max storage" one, because a window over one end threw out every layout with a second.
        var wall = new Wall(132m, 108m, new[] { new Obstruction(ObstructionType.Window, 29m, 24m, 36m, 40m) });
        var storage = Solver.Solve(wall, Goal.Storage, Prices).Options.First().Standard;
        var balanced = Solver.Solve(wall, Goal.Balanced, Prices).Options.Select(o => o.Standard);

        Talls(storage).ShouldBeGreaterThanOrEqualTo(balanced.Max(Talls));
    }

    [Theory]
    [MemberData(nameof(Obstructed))]
    public void No_other_goal_out_stores_max_storage(string name, Obstruction[] obstructions)
    {
        var failures = new List<string>();

        foreach (var ceiling in new[] { 96m, 108m, 120m })
        {
            for (var length = 72m; length <= 360m; length += 6m)
            {
                var wall = new Wall(length, ceiling, obstructions);
                var storage = Solver.Solve(wall, Goal.Storage, Prices);

                if (storage.Failure is not null)
                {
                    continue;
                }

                var best = CubicFeet(storage.Options.First().Standard);

                foreach (var goal in new[] { Goal.Workbench, Goal.Balanced })
                {
                    var result = Solver.Solve(wall, goal, Prices);

                    foreach (var option in result.Options)
                    {
                        if (CubicFeet(option.Standard) > best)
                        {
                            failures.Add($"{length}\"/{ceiling}\" {goal} \"{option.Label}\" {CubicFeet(option.Standard):0.0} > {best:0.0}");
                        }
                    }
                }
            }
        }

        failures.ShouldBeEmpty($"{name}: {failures.Count} walls where another goal stores more:\n{string.Join("\n", failures)}");
    }
}
