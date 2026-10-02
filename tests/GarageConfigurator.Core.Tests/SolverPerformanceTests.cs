using System.Diagnostics;
using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

public class SolverPerformanceTests
{
    [Fact]
    public void Every_fixture_and_goal_solves_in_under_50ms()
    {
        var solver = new WallSolver(TestCatalog.Load());
        var prices = TestCatalog.LoadSeedPrices();
        var cases = WallFixtures.All.Keys.SelectMany(id => Enum.GetValues<Goal>().Select(g => (id, g))).ToList();

        // Warm up so we measure the solver, not the JIT.
        foreach (var (id, goal) in cases)
        {
            solver.Solve(WallFixtures.Get(id), goal, prices);
        }

        var slowest = 0.0;
        var slowestCase = string.Empty;

        foreach (var (id, goal) in cases)
        {
            var wall = WallFixtures.Get(id);
            var stopwatch = Stopwatch.StartNew();

            for (var i = 0; i < 10; i++)
            {
                solver.Solve(wall, goal, prices);
            }

            var perSolve = stopwatch.Elapsed.TotalMilliseconds / 10;

            if (perSolve > slowest)
            {
                slowest = perSolve;
                slowestCase = $"{id}/{goal}";
            }
        }

        slowest.ShouldBeLessThan(50.0, $"slowest solve was {slowestCase} at {slowest:F1}ms");
    }
}
