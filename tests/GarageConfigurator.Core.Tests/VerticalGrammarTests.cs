using GarageConfigurator.Core;
using Shouldly;
using static GarageConfigurator.Core.Tests.Build;

namespace GarageConfigurator.Core.Tests;

/// <summary>One test per rule in the "Vertical grammar" section of docs/SOLVER_RULES.md.</summary>
public class VerticalGrammarTests
{
    private static readonly LayoutValidator Validator = new(TestCatalog.Load());

    [Fact]
    public void Base_cabinet_must_sit_on_the_floor()
    {
        var layout = Layout(Base("MV-B24", x: 0m, width: 24m, y: 2m));

        Validator.Validate(layout, new Wall(24m, 96m)).Codes()
            .ShouldContain(ViolationCode.BaseNotOnFloor);
    }

    [Fact]
    public void Tall_cabinet_must_sit_on_the_floor()
    {
        var layout = Layout(Tall("MV-PC2484", x: 0m, width: 24m, y: 1m));

        Validator.Validate(layout, new Wall(24m, 96m)).Codes()
            .ShouldContain(ViolationCode.TallNotOnFloor);
    }

    [Fact]
    public void Counter_sits_directly_on_the_base_run_at_34_5()
    {
        var layout = Layout(
            Base("MV-B24", 0m, 24m),
            Base("MV-B24", 24m, 24m),
            Counter("MV-CTHW5025", x: -1m, width: 50m, y: 36m));

        Validator.Validate(layout, new Wall(48m, 96m)).Codes()
            .ShouldContain(ViolationCode.CounterAtWrongHeight);
    }

    [Fact]
    public void Wall_cabinet_above_a_counter_run_sits_at_54()
    {
        var layout = Layout(
            Base("MV-B30", 0m, 30m),
            WallCab("MV-W3030", x: 0m, width: 30m, height: 30m, y: 50m));

        Validator.Validate(layout, new Wall(30m, 96m)).Codes()
            .ShouldContain(ViolationCode.WallCabinetAtWrongHeight);
    }

    [Fact]
    public void Thirty_inch_wall_cabinet_at_54_tops_out_on_the_datum_and_is_valid()
    {
        var layout = Layout(
            Base("MV-B30", 0m, 30m),
            WallCab("MV-W3030", x: 0m, width: 30m, height: 30m, y: 54m));

        Validator.Validate(layout, new Wall(30m, 96m)).ShouldBeEmpty();
    }

    [Fact]
    public void Fifteen_inch_wall_cabinet_used_alone_aligns_its_top_to_the_84_datum()
    {
        var atDatum = Layout(
            Base("MV-B30", 0m, 30m),
            WallCab("IC-MW-W3015", x: 0m, width: 30m, height: 15m, y: 69m));

        Validator.Validate(atDatum, new Wall(30m, 96m)).ShouldBeEmpty();
    }

    [Fact]
    public void Fifteen_inch_wall_cabinet_hung_at_54_breaks_the_datum()
    {
        var belowDatum = Layout(
            Base("MV-B30", 0m, 30m),
            WallCab("IC-MW-W3015", x: 0m, width: 30m, height: 15m, y: 54m));

        Validator.Validate(belowDatum, new Wall(30m, 96m)).Codes()
            .ShouldContain(ViolationCode.WallCabinetAtWrongHeight);
    }

    [Fact]
    public void Fifteen_inch_wall_stacked_on_a_thirty_inch_wall_requires_a_108_ceiling()
    {
        var layout = Layout(
            Base("MV-B30", 0m, 30m),
            WallCab("MV-W3030", 0m, 30m, 30m, y: 54m),
            WallCab("IC-MW-W3015", 0m, 30m, 15m, y: 84m));

        Validator.Validate(layout, new Wall(30m, 96m)).Codes()
            .ShouldContain(ViolationCode.StackedWallNeedsTallerCeiling);
    }

    [Fact]
    public void Fifteen_inch_wall_may_stack_on_a_thirty_inch_wall_at_a_108_ceiling()
    {
        var layout = Layout(
            Base("MV-B30", 0m, 30m),
            WallCab("MV-W3030", 0m, 30m, 30m, y: 54m),
            WallCab("IC-MW-W3015", 0m, 30m, 15m, y: 84m));

        Validator.Validate(layout, new Wall(30m, 108m)).ShouldBeEmpty();
    }

    [Fact]
    public void Nothing_may_be_placed_above_a_tall_cabinet()
    {
        var layout = Layout(
            Tall("MV-PC2484", 0m, 24m),
            WallCab("MV-W2415", x: 0m, width: 24m, height: 15m, y: 84m));

        Validator.Validate(layout, new Wall(24m, 108m)).Codes()
            .ShouldContain(ViolationCode.ItemAboveTall);
    }

    [Fact]
    public void Item_may_not_poke_through_the_ceiling()
    {
        var layout = Layout(Tall("MV-PC2484", 0m, 24m));

        Validator.Validate(layout, new Wall(24m, 80m)).Codes()
            .ShouldContain(ViolationCode.ItemExceedsCeiling);
    }

    [Fact]
    public void A_pantry_needs_room_to_tilt_upright_even_when_it_fits_standing()
    {
        // 85" clears the 84" pantry standing, but you cannot get it upright: tilting sweeps ~87.4".
        var layout = Layout(Tall("MV-PC2484", 0m, 24m));

        Validator.Validate(layout, new Wall(24m, 85m)).Codes()
            .ShouldContain(ViolationCode.TallNeedsTipUpClearance);
    }

    [Fact]
    public void A_pantry_under_a_96_inch_ceiling_has_room_to_tilt_upright()
    {
        Validator.Validate(Layout(Tall("MV-PC2484", 0m, 24m)), new Wall(24m, 96m)).Codes()
            .ShouldNotContain(ViolationCode.TallNeedsTipUpClearance);
    }

    [Fact]
    public void Wall_cabinets_do_not_need_tip_up_room_the_way_pantries_do()
    {
        var layout = Layout(
            Base("MV-B30-F", 0m, 30m),
            WallCab("MV-W3030", 0m, 30m, 30m, y: 54m));

        Validator.Validate(layout, new Wall(30m, 85m)).ShouldBeEmpty();
    }

    [Fact]
    public void Ceiling_below_84_excludes_tall_cabinets()
    {
        var layout = Layout(Tall("MV-PC2484", 0m, 24m));

        Validator.Validate(layout, new Wall(24m, 80m)).Codes()
            .ShouldContain(ViolationCode.CeilingTooLowForItem);
    }

    [Fact]
    public void Ceiling_below_84_excludes_wall_cabinets()
    {
        var layout = Layout(
            Base("MV-B30", 0m, 30m),
            WallCab("MV-W3030", 0m, 30m, 30m, y: 54m));

        Validator.Validate(layout, new Wall(30m, 80m)).Codes()
            .ShouldContain(ViolationCode.CeilingTooLowForItem);
    }
}
