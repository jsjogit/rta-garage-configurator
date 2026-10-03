using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

/// <summary>Knee spaces, bridge uppers and tiers as the solver produces them.</summary>
public class KneeSpaceSolverTests
{
    private static readonly WallSolver Solver = new(TestCatalog.Load());
    private static readonly PriceMap Prices = TestCatalog.LoadSeedPrices();

    private static SolveResult Solve(Goal goal, decimal length = 240m, decimal ceiling = 96m) =>
        Solver.Solve(new Wall(length, ceiling), goal, Prices);

    [Fact]
    public void A_72_inch_workbench_wall_matches_the_vendor_vignette()
    {
        var standard = Solve(Goal.Workbench, 72m).Options.First().Standard;

        standard.Items.Where(i => i.Zone == Zone.Base).Select(i => i.Sku)
            .ShouldBe(new[] { "MV-B24-F", "MV-B24-F" });
        standard.Items.Count(i => i.Zone == Zone.KneeSpace).ShouldBe(1);
        standard.Items.Single(i => i.Zone == Zone.Counter).Sku.ShouldBe("MV-CTHW7425");
        standard.Items.Where(i => i.Zone == Zone.Wall).OrderBy(i => i.X).Select(i => i.Sku)
            .ShouldBe(new[] { "MV-W2430", "MV-W2415", "MV-W2430" });
    }

    [Fact]
    public void The_premiere_tier_of_the_vignette_uses_three_then_four_drawer_banks()
    {
        var premiere = Solve(Goal.Workbench, 72m).Options.First().Premiere;

        premiere.Items.Where(i => i.Zone == Zone.Base).OrderBy(i => i.X).Select(i => i.Sku)
            .ShouldBe(new[] { "MV-DB24-3", "MV-DB24-4" });
    }

    [Fact]
    public void The_bridge_over_a_knee_space_is_width_matched_and_sits_on_the_datum()
    {
        var standard = Solve(Goal.Workbench, 72m).Options.First().Standard;
        var knee = standard.Items.Single(i => i.Zone == Zone.KneeSpace);
        var bridge = standard.Items.Single(i => i.Zone == Zone.Wall && i.Height == 15m);

        bridge.Width.ShouldBe(knee.Width);
        bridge.X.ShouldBe(knee.X);
        bridge.Top.ShouldBe(84m);
    }

    [Theory]
    [InlineData(Goal.Workbench)]
    [InlineData(Goal.Balanced)]
    [InlineData(Goal.Storage)]
    [InlineData(Goal.HideTheMess)]
    public void No_knee_space_is_ever_left_under_a_full_height_upper(Goal goal)
    {
        foreach (var layout in Solve(goal).Options.SelectMany(o => o.Tiers))
        {
            foreach (var knee in layout.Items.Where(i => i.Zone == Zone.KneeSpace))
            {
                layout.Items
                    .Where(i => i.Zone == Zone.Wall && i.X < knee.Right && knee.X < i.Right)
                    .ShouldAllBe(u => u.Height == 15m);
            }
        }
    }

    [Fact]
    public void Storage_never_gives_up_wall_length_to_a_knee_space()
    {
        Solve(Goal.Storage).Options.SelectMany(o => o.Tiers).SelectMany(l => l.Items)
            .ShouldNotContain(i => i.Zone == Zone.KneeSpace);
    }

    [Theory]
    [InlineData(Goal.Workbench)]
    [InlineData(Goal.Balanced)]
    public void Every_option_comes_in_both_tiers_over_one_footprint(Goal goal)
    {
        foreach (var option in Solve(goal).Options)
        {
            option.Premiere.Items.Select(i => (i.X, i.Y, i.Width, i.Zone))
                .ShouldBe(option.Standard.Items.Select(i => (i.X, i.Y, i.Width, i.Zone)));
            option.Standard.Tier.ShouldBe(Tier.Standard);
            option.Premiere.Tier.ShouldBe(Tier.Premiere);
        }
    }

    [Theory]
    [InlineData(Goal.Workbench)]
    [InlineData(Goal.Storage)]
    public void Premiere_is_never_cheaper_than_standard(Goal goal)
    {
        foreach (var option in Solve(goal).Options)
        {
            Pricing.Price(option.Premiere, Prices).SubtotalList
                .ShouldBeGreaterThanOrEqualTo(Pricing.Price(option.Standard, Prices).SubtotalList);
        }
    }

    [Fact]
    public void A_knee_space_never_appears_on_the_quote()
    {
        foreach (var layout in Solve(Goal.Workbench, 72m).Options.SelectMany(o => o.Tiers))
        {
            layout.LineItems.Select(i => i.Sku).ShouldNotContain(string.Empty);
        }
    }
}
