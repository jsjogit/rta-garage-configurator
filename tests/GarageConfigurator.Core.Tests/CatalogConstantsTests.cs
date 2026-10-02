using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

/// <summary>
/// Constants are the configurable defaults behind the rules in docs/SOLVER_RULES.md.
/// The solver and validator read them from here, never from inline literals.
/// </summary>
public class CatalogConstantsTests
{
    private static readonly Constants Constants = TestCatalog.Load().Constants;

    [Fact]
    public void Vertical_datums_match_the_solver_rules()
    {
        Constants.BaseHeight.ShouldBe(34.5m);
        Constants.CounterThickness.ShouldBe(1.5m);
        Constants.WallCabinetBottomAboveCounter.ShouldBe(54m);
        Constants.DatumTop.ShouldBe(84m);
    }

    [Fact]
    public void Base_plus_counter_thickness_equals_the_counter_top_height_of_36()
    {
        (Constants.BaseHeight + Constants.CounterThickness).ShouldBe(36m);
    }

    [Fact]
    public void Thirty_inch_wall_cabinet_sitting_at_54_tops_out_on_the_datum()
    {
        (Constants.WallCabinetBottomAboveCounter + 30m).ShouldBe(Constants.DatumTop);
    }

    [Fact]
    public void Ceiling_bands_are_configured()
    {
        Constants.DefaultCeiling.ShouldBe(96m);
        Constants.MinCeiling.ShouldBe(36m);
        Constants.MinCeilingForTallsAndWalls.ShouldBe(84m);
        Constants.MinCeilingForStackedWall.ShouldBe(108m);
    }

    [Fact]
    public void Minimum_wall_length_equals_the_narrowest_cabinet()
    {
        var narrowestCabinet = TestCatalog.Load().Cabinets
            .Where(c => c.Zone != Zone.Filler)
            .Min(c => c.Width);

        Constants.MinWallLength.ShouldBe(narrowestCabinet);
    }

    [Fact]
    public void Counter_run_cap_equals_the_widest_countertop()
    {
        Constants.MaxCounterRunWidth.ShouldBe(TestCatalog.Load().Countertops.Max(c => c.Width));
    }

    [Fact]
    public void Electrical_panel_keep_out_runs_from_the_floor_and_is_at_least_30_wide()
    {
        var panel = Constants.ClearanceFor(ObstructionType.ElectricalPanel);

        panel.MinKeepOutWidth.ShouldBe(30m);
        panel.KeepOutFromFloorToY.ShouldBe(78m);
    }

    [Fact]
    public void Side_door_keep_out_adds_a_casing_margin_each_side()
    {
        Constants.ClearanceFor(ObstructionType.SideDoor).SideMargin.ShouldBe(3m);
    }

    [Fact]
    public void Obstructions_without_a_configured_clearance_fall_back_to_no_margin()
    {
        var window = Constants.ClearanceFor(ObstructionType.Window);

        window.SideMargin.ShouldBe(0m);
        window.KeepOutFromFloorToY.ShouldBeNull();
    }
}
