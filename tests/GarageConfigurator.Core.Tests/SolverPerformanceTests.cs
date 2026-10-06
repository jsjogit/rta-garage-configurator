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

        // The median of many single solves, per case. A shared CI machine stalls now and then; one stall
        // inflates an average and fails the build, but a median only moves if the solver itself is slow.
        const int Runs = 15;
        var slowest = 0.0;
        var slowestCase = string.Empty;

        foreach (var (id, goal) in cases)
        {
            var wall = WallFixtures.Get(id);
            var times = new double[Runs];

            for (var i = 0; i < Runs; i++)
            {
                var stopwatch = Stopwatch.StartNew();
                solver.Solve(wall, goal, prices);
                times[i] = stopwatch.Elapsed.TotalMilliseconds;
            }

            Array.Sort(times);
            var median = times[Runs / 2];

            if (median > slowest)
            {
                slowest = median;
                slowestCase = $"{id}/{goal}";
            }
        }

        slowest.ShouldBeLessThan(50.0, $"slowest case was {slowestCase} at a median of {slowest:F1}ms");
    }
}
