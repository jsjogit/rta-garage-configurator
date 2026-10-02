using GarageConfigurator.Core;
using Shouldly;
using static GarageConfigurator.Core.Tests.Build;

namespace GarageConfigurator.Core.Tests;

/// <summary>
/// One test per obstruction rule in docs/SOLVER_RULES.md "Horizontal grammar".
/// Obstructions expand into keep-out rectangles; nothing may overlap one.
/// </summary>
public class ObstructionRuleTests
{
    private static readonly LayoutValidator Validator = new(TestCatalog.Load());

    private static Wall WallWith(decimal length, Obstruction obstruction) =>
        new(length, 96m, new[] { obstruction });

    private static Obstruction Window(decimal startX) =>
        new(ObstructionType.Window, startX, Width: 36m, Height: 24m, BottomY: 40m);

    private static Obstruction WaterHeater(decimal startX) =>
        new(ObstructionType.WaterHeater, startX, Width: 30m, Height: 72m, BottomY: 0m);

    [Fact]
    public void Nothing_may_overlap_an_obstruction_keep_out()
    {
        var layout = Layout(Base("MV-B24", 24m, 24m));

        Validator.Validate(layout, WallWith(100m, WaterHeater(30m))).Codes()
            .ShouldContain(ViolationCode.ItemOverlapsObstruction);
    }

    [Fact]
    public void Electrical_panel_keep_out_blocks_the_floor_beneath_it()
    {
        var layout = Layout(Base("MV-B24", 174m, 24m));

        Validator.Validate(layout, WallFixtures.Get("two-car-panel")).Codes()
            .ShouldContain(ViolationCode.ItemOverlapsObstruction);
    }

    [Fact]
    public void Electrical_panel_keep_out_is_wider_than_the_panel_itself()
    {
        // 156-180 never touches the 180-196 panel, but does sit inside the 30" working space.
        var layout = Layout(Base("MV-B24", 156m, 24m));

        Validator.Validate(layout, WallFixtures.Get("two-car-panel")).Codes()
            .ShouldContain(ViolationCode.ItemOverlapsObstruction);
    }

    [Fact]
    public void Side_door_keep_out_adds_a_casing_margin_each_side()
    {
        // 275-299 clears the 300-338 door but not its 3" casing margin.
        var layout = Layout(Base("MV-B24", 275m, 24m));

        Validator.Validate(layout, WallFixtures.Get("three-car-door")).Codes()
            .ShouldContain(ViolationCode.ItemOverlapsObstruction);
    }

    [Fact]
    public void Window_does_not_block_a_base_cabinet_beneath_it()
    {
        var layout = Layout(Base("MV-B24", 36m, 24m));

        Validator.Validate(layout, WallWith(100m, Window(40m))).Codes()
            .ShouldNotContain(ViolationCode.ItemOverlapsObstruction);
    }

    [Fact]
    public void Window_does_block_a_wall_cabinet_across_it()
    {
        var layout = Layout(
            Base("MV-B30", 40m, 30m),
            WallCab("MV-W3030", 40m, 30m, 30m, y: 54m));

        Validator.Validate(layout, WallWith(100m, Window(40m))).Codes()
            .ShouldContain(ViolationCode.ItemOverlapsObstruction);
    }

    [Fact]
    public void A_break_in_the_floor_run_at_an_obstruction_is_not_a_gap_violation()
    {
        var layout = Layout(
            Base("MV-B30", 0m, 30m),
            Base("MV-B30", 60m, 30m));

        Validator.Validate(layout, WallWith(100m, WaterHeater(30m))).Codes()
            .ShouldNotContain(ViolationCode.GapBetweenCabinets);
    }

    [Fact]
    public void Filler_may_sit_directly_against_an_obstruction_keep_out()
    {
        var layout = Layout(
            Base("MV-B30", 0m, 30m),
            Filler(30m),
            Base("MV-B30", 63m, 30m));

        Validator.Validate(layout, WallWith(100m, WaterHeater(33m))).Codes()
            .ShouldNotContain(ViolationCode.FillerBetweenCabinets);
    }

    [Fact]
    public void Filler_landing_just_short_of_an_obstruction_still_counts_as_an_end_filler()
    {
        // The 3" filler leaves 2" before the keep-out — acceptable as-is, not a stranded filler.
        var layout = Layout(
            Base("MV-B30", 0m, 30m),
            Filler(30m),
            Base("MV-B30", 65m, 30m),
            Filler(95m));

        Validator.Validate(layout, WallWith(100m, WaterHeater(35m))).Codes()
            .ShouldNotContain(ViolationCode.FillerBetweenCabinets);
    }

    [Fact]
    public void Electrical_panel_keep_out_on_the_two_car_fixture_spans_173_to_203()
    {
        var wall = WallFixtures.Get("two-car-panel");
        var panel = wall.Obstructions.Single();

        var keepOut = panel.KeepOutWith(TestCatalog.Load().Constants.ClearanceFor(panel.Type));

        keepOut.Left.ShouldBe(173m);
        keepOut.Right.ShouldBe(203m);
        keepOut.Bottom.ShouldBe(0m);
        keepOut.Top.ShouldBe(78m);
    }

    [Fact]
    public void Every_fixture_wall_loads_with_a_length_and_a_ceiling()
    {
        WallFixtures.All.Count.ShouldBe(11);
        WallFixtures.All.Values.ShouldAllBe(w => w.Length > 0m && w.Ceiling > 0m);
    }
}
