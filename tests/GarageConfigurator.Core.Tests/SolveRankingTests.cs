using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

public class SolveRankingTests
{
    private static readonly WallSolver Solver = new(TestCatalog.Load());
    private static readonly LayoutValidator Validator = new(TestCatalog.Load());
    private static readonly PriceMap Prices = TestCatalog.LoadSeedPrices();

    public static TheoryData<string, Goal> EveryFixtureAndGoal()
    {
        var data = new TheoryData<string, Goal>();

        foreach (var id in WallFixtures.All.Keys)
        {
            foreach (var goal in Enum.GetValues<Goal>())
            {
                data.Add(id, goal);
            }
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(EveryFixtureAndGoal))]
    public void Every_returned_layout_passes_validation(string fixtureId, Goal goal)
    {
        var wall = WallFixtures.Get(fixtureId);

        foreach (var layout in Solver.Solve(wall, goal, Prices).Options.SelectMany(o => o.Tiers))
        {
            Validator.Validate(layout, wall).ShouldBeEmpty();
        }
    }

    [Theory]
    [MemberData(nameof(EveryFixtureAndGoal))]
    public void Never_more_than_three_layouts_come_back(string fixtureId, Goal goal)
    {
        Solver.Solve(WallFixtures.Get(fixtureId), goal, Prices).Options.Count.ShouldBeLessThanOrEqualTo(3);
    }

    [Theory]
    [MemberData(nameof(EveryFixtureAndGoal))]
    public void Returned_layouts_are_distinct_from_one_another(string fixtureId, Goal goal)
    {
        var layouts = Solver.Solve(WallFixtures.Get(fixtureId), goal, Prices).Options.Select(o => o.Standard).ToList();

        var signatures = layouts.Select(l => string.Join(
            "|",
            l.LineItems.OrderBy(i => i.Sku, StringComparer.Ordinal).Select(i => $"{i.Sku}x{i.Quantity}")));

        signatures.ShouldBeUnique();
    }

    [Theory]
    [MemberData(nameof(EveryFixtureAndGoal))]
    public void A_wall_never_gets_more_than_one_waste_pullout(string fixtureId, Goal goal)
    {
        var layouts = Solver.Solve(WallFixtures.Get(fixtureId), goal, Prices).Options.SelectMany(o => o.Tiers).ToList();

        foreach (var layout in layouts)
        {
            layout.Items.Count(i => i.Sku == "MV-BWB15-PS").ShouldBeLessThanOrEqualTo(1);
        }
    }

    [Fact]
    public void The_first_layout_is_the_recommended_one()
    {
        Solver.Solve(WallFixtures.Get("single-car-clean"), Goal.Balanced, Prices)
            .Options[0].Label.ShouldBe("Recommended");
    }

    [Theory]
    [MemberData(nameof(EveryFixtureAndGoal))]
    public void No_two_results_carry_the_same_label(string fixtureId, Goal goal)
    {
        var labels = Solver.Solve(WallFixtures.Get(fixtureId), goal, Prices)
            .Options.Select(o => o.Label)
            .ToList();

        labels.ShouldBeUnique();
    }

    [Fact]
    public void Every_layout_is_labelled_for_the_results_card()
    {
        Solver.Solve(WallFixtures.Get("single-car-clean"), Goal.Balanced, Prices)
            .Options.ShouldAllBe(o => o.Label.Length > 0);
    }

    [Fact]
    public void Nothing_is_placed_in_the_electrical_panel_keep_out()
    {
        var result = Solver.Solve(WallFixtures.Get("two-car-panel"), Goal.Workbench, Prices);

        result.Options.ShouldNotBeEmpty();
        result.Options.SelectMany(o => o.Standard.Items)
            .ShouldAllBe(i => i.Right <= 173m || i.X >= 203m || i.Y >= 78m);
    }
}
