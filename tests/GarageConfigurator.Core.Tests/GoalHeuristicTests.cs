using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

/// <summary>One test per goal in the "Goal heuristics" section of docs/SOLVER_RULES.md.</summary>
public class GoalHeuristicTests
{
    private static readonly WallSolver Solver = new(TestCatalog.Load());
    private static readonly PriceMap Prices = TestCatalog.LoadSeedPrices();
    private static readonly Wall CleanWall = WallFixtures.Get("single-car-clean");

    private static Layout Best(Goal goal, Wall? wall = null) =>
        Solver.Solve(wall ?? CleanWall, goal, Prices).Options.First().Standard;

    private static Layout BestPremiere(Goal goal, Wall? wall = null) =>
        Solver.Solve(wall ?? CleanWall, goal, Prices).Options.First().Premiere;

    [Fact]
    public void Workbench_gives_the_customer_a_countertop()
    {
        Best(Goal.Workbench).Items.ShouldContain(i => i.Zone == Zone.Counter);
    }

    [Fact]
    public void Workbench_puts_a_drawer_bank_under_the_counter_in_the_premiere_tier()
    {
        var layout = BestPremiere(Goal.Workbench);
        var counter = layout.Items.First(i => i.Zone == Zone.Counter);

        layout.Items
            .Where(i => i.Sku.StartsWith("MV-DB", StringComparison.Ordinal))
            .ShouldContain(db => db.X >= counter.X && db.Right <= counter.Right);
    }

    [Fact]
    public void Workbench_hangs_wall_cabinets_above_the_bench_for_tools()
    {
        Best(Goal.Workbench).Items.ShouldContain(i => i.Zone == Zone.Wall);
    }

    [Fact]
    public void Storage_favours_tall_cabinets_over_a_workbench()
    {
        var storage = Best(Goal.Storage);
        var workbench = Best(Goal.Workbench);

        storage.Items.Count(i => i.Zone == Zone.Tall)
            .ShouldBeGreaterThan(workbench.Items.Count(i => i.Zone == Zone.Tall));
    }

    [Fact]
    public void Hide_the_mess_closes_the_wall_with_doors_rather_than_open_counter()
    {
        var hidden = Best(Goal.HideTheMess);

        hidden.Items.ShouldContain(i =>
            i.Zone == Zone.Tall || i.Sku.EndsWith("-F", StringComparison.Ordinal));
        hidden.Items.Where(i => i.Zone == Zone.Counter).Sum(i => i.Width)
            .ShouldBeLessThan(Best(Goal.Workbench).Items.Where(i => i.Zone == Zone.Counter).Sum(i => i.Width));
    }

    [Fact]
    public void Balanced_builds_a_counter_run_and_keeps_tall_storage_too()
    {
        var balanced = Best(Goal.Balanced);

        balanced.Items.ShouldContain(i => i.Zone == Zone.Counter);
        balanced.Items.ShouldContain(i => i.Zone == Zone.Tall);
    }

    [Fact]
    public void A_120_inch_ceiling_lets_storage_stack_a_short_cabinet_on_a_tall_one()
    {
        var result = Solver.Solve(WallFixtures.Get("tall-ceiling-120"), Goal.Storage, Prices);

        result.Options.SelectMany(o => o.Standard.Items)
            .ShouldContain(i => i.Zone == Zone.Wall && i.Y == 84m);
    }
}
