using GarageConfigurator.Core;
using Shouldly;
using static GarageConfigurator.Core.Tests.Build;

namespace GarageConfigurator.Core.Tests;

/// <summary>
/// SPEC.md: tapping a cabinet offers "swap options (same width, same zone)".
/// </summary>
public class SwapOptionTests
{
    private static readonly Catalog Catalog = TestCatalog.Load();

    private static IReadOnlyList<string> SwapsFor(PlacedItem item) =>
        SwapOptions.For(Catalog, item).Select(s => s.Sku).ToList();

    [Fact]
    public void A_24_inch_base_can_swap_for_the_other_24_inch_bases()
    {
        var swaps = SwapsFor(Base("MV-B24", 0m, 24m));

        swaps.ShouldContain("MV-B24-F");
        swaps.ShouldContain("MV-DB24-3");
        swaps.ShouldContain("MV-DB24-4");
    }

    [Fact]
    public void A_swap_never_offers_the_cabinet_already_there()
    {
        SwapsFor(Base("MV-B24", 0m, 24m)).ShouldNotContain("MV-B24");
    }

    [Fact]
    public void A_swap_never_changes_the_width_because_the_wall_would_stop_adding_up()
    {
        SwapOptions.For(Catalog, Base("MV-B24", 0m, 24m))
            .ShouldAllBe(s => s.Width == 24m);
    }

    [Fact]
    public void A_swap_never_crosses_zones()
    {
        SwapsFor(WallCab("MV-W2430", 0m, 24m, 30m, 54m)).ShouldNotContain("MV-B24");
    }

    [Fact]
    public void A_30_inch_wall_cabinet_can_swap_for_the_short_one()
    {
        SwapsFor(WallCab("MV-W3030", 0m, 30m, 30m, 54m)).ShouldContain("IC-MW-W3015");
    }

    [Fact]
    public void A_base_can_be_opened_up_into_a_knee_space()
    {
        SwapOptions.For(Catalog, Base("MV-B24", 0m, 24m))
            .ShouldContain(s => s.Zone == Zone.KneeSpace);
    }

    [Fact]
    public void A_knee_space_can_be_filled_back_in_with_a_cabinet()
    {
        var swaps = SwapsFor(Knee(24m, 24m));

        swaps.ShouldContain("MV-B24-F");
        swaps.ShouldContain("MV-DB24-4");
    }

    [Fact]
    public void A_15_inch_knee_space_is_offered_nothing_because_no_knee_space_is_that_narrow()
    {
        SwapOptions.For(Catalog, Base("MV-B15", 0m, 15m))
            .ShouldNotContain(s => s.Zone == Zone.KneeSpace);
    }

    [Fact]
    public void Swap_options_carry_what_the_side_panel_needs_to_show()
    {
        var swap = SwapOptions.For(Catalog, Base("MV-B24", 0m, 24m))
            .First(s => s.Sku == "MV-DB24-4");

        swap.Name.ShouldBe("4-Drawer Base Cabinet");
        swap.Width.ShouldBe(24m);
        swap.Height.ShouldBe(34.5m);
    }

    [Fact]
    public void A_countertop_has_nothing_to_swap_for_because_it_is_cut_to_the_run()
    {
        SwapOptions.For(Catalog, Counter("MV-CTHW7425", 0m, 72m)).ShouldBeEmpty();
    }
}
