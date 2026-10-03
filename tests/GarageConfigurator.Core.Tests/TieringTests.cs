using GarageConfigurator.Core;
using Shouldly;
using static GarageConfigurator.Core.Tests.Build;

namespace GarageConfigurator.Core.Tests;

/// <summary>The "Tiers" section of docs/SOLVER_RULES.md: one footprint, two price points.</summary>
public class TieringTests
{
    private static readonly Catalog Catalog = TestCatalog.Load();

    private static Layout Footprint => Layout(
        Base("MV-B24-F", 0m, 24m),
        Base("MV-B30-F", 24m, 30m),
        Knee(54m, 24m),
        Base("MV-B24-F", 78m, 24m),
        Base("MV-B15", 102m, 15m),
        Counter("MV-CTHW9825", 0m, 117m),
        Tall("MV-PC2484", 117m, 24m),
        WallCab("MV-W2415", 54m, 24m, 15m, y: 69m));

    [Fact]
    public void The_standard_tier_keeps_the_full_height_door_bases()
    {
        var standard = Tiering.Apply(Footprint, Tier.Standard, Catalog);

        standard.Items.Where(i => i.Zone == Zone.Base && i.Width == 24m)
            .ShouldAllBe(i => i.Sku == "MV-B24-F");
    }

    [Fact]
    public void The_premiere_tier_swaps_wide_bases_for_drawer_banks()
    {
        var premiere = Tiering.Apply(Footprint, Tier.Premiere, Catalog);

        premiere.Items.Where(i => i.Zone == Zone.Base && i.Width >= 24m)
            .ShouldAllBe(i => i.Sku.StartsWith("MV-DB", StringComparison.Ordinal));
    }

    [Fact]
    public void The_first_base_in_a_run_gets_the_three_drawer_unit()
    {
        var premiere = Tiering.Apply(Footprint, Tier.Premiere, Catalog);
        var bases = premiere.Items.Where(i => i.Zone == Zone.Base).OrderBy(i => i.X).ToList();

        bases[0].Sku.ShouldBe("MV-DB24-3");
        bases[1].Sku.ShouldBe("MV-DB30-4");
    }

    [Fact]
    public void Fifteen_inch_bases_have_no_drawer_equivalent_so_they_do_not_change()
    {
        var premiere = Tiering.Apply(Footprint, Tier.Premiere, Catalog);

        premiere.Items.Single(i => i.Width == 15m && i.Zone == Zone.Base).Sku.ShouldBe("MV-B15");
    }

    [Fact]
    public void Both_tiers_describe_exactly_the_same_footprint()
    {
        var standard = Tiering.Apply(Footprint, Tier.Standard, Catalog);
        var premiere = Tiering.Apply(Footprint, Tier.Premiere, Catalog);

        premiere.Items.Select(i => (i.X, i.Y, i.Width, i.Height, i.Zone))
            .ShouldBe(standard.Items.Select(i => (i.X, i.Y, i.Width, i.Height, i.Zone)));
    }

    [Fact]
    public void Counters_talls_uppers_and_knee_spaces_are_untouched_by_tier()
    {
        var premiere = Tiering.Apply(Footprint, Tier.Premiere, Catalog);

        premiere.Items.Where(i => i.Zone != Zone.Base)
            .Select(i => i.Sku)
            .ShouldBe(Footprint.Items.Where(i => i.Zone != Zone.Base).Select(i => i.Sku));
    }

    [Fact]
    public void A_layout_knows_which_tier_it_is()
    {
        Tiering.Apply(Footprint, Tier.Premiere, Catalog).Tier.ShouldBe(Tier.Premiere);
    }

    [Fact]
    public void Premiere_costs_more_than_standard()
    {
        var prices = TestCatalog.LoadSeedPrices();

        var standard = Pricing.Price(Tiering.Apply(Footprint, Tier.Standard, Catalog), prices);
        var premiere = Pricing.Price(Tiering.Apply(Footprint, Tier.Premiere, Catalog), prices);

        premiere.SubtotalList.ShouldBeGreaterThan(standard.SubtotalList);
    }
}
