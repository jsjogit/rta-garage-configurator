using GarageConfigurator.Core;
using Shouldly;
using static GarageConfigurator.Core.Tests.Build;

namespace GarageConfigurator.Core.Tests;

/// <summary>One test per rule in the "Horizontal grammar" section of docs/SOLVER_RULES.md.</summary>
public class HorizontalGrammarTests
{
    private static readonly LayoutValidator Validator = new(TestCatalog.Load());

    [Fact]
    public void Cabinets_butt_together_with_no_gap()
    {
        var layout = Layout(
            Base("MV-B24", 0m, 24m),
            Base("MV-B24", 25m, 24m));

        Validator.Validate(layout, new Wall(49m, 96m)).Codes()
            .ShouldContain(ViolationCode.GapBetweenCabinets);
    }

    [Fact]
    public void Cabinets_may_not_overlap()
    {
        var layout = Layout(
            Base("MV-B24", 0m, 24m),
            Base("MV-B24", 20m, 24m));

        Validator.Validate(layout, new Wall(44m, 96m)).Codes()
            .ShouldContain(ViolationCode.ItemsOverlap);
    }

    [Fact]
    public void Items_must_fit_within_the_wall_length()
    {
        var layout = Layout(Base("MV-B30", 0m, 30m));

        Validator.Validate(layout, new Wall(24m, 96m)).Codes()
            .ShouldContain(ViolationCode.ItemOutsideWall);
    }

    [Fact]
    public void Items_may_not_start_left_of_the_wall()
    {
        var layout = Layout(Base("MV-B24", -1m, 24m));

        Validator.Validate(layout, new Wall(48m, 96m)).Codes()
            .ShouldContain(ViolationCode.ItemOutsideWall);
    }

    [Fact]
    public void End_gap_of_3_or_more_must_be_closed_with_a_filler()
    {
        var layout = Layout(Base("MV-B24", 0m, 24m));

        Validator.Validate(layout, new Wall(28m, 96m)).Codes()
            .ShouldContain(ViolationCode.EndGapNeedsFiller);
    }

    [Fact]
    public void End_gap_under_3_is_acceptable_as_is()
    {
        var layout = Layout(Base("MV-B24", 0m, 24m));

        Validator.Validate(layout, new Wall(26m, 96m)).ShouldBeEmpty();
    }

    [Fact]
    public void End_gap_wider_than_a_filler_can_close_is_a_scoring_matter_not_a_violation()
    {
        var layout = Layout(Base("MV-B24", 0m, 24m));

        Validator.Validate(layout, new Wall(40m, 96m)).Codes()
            .ShouldNotContain(ViolationCode.EndGapNeedsFiller);
    }

    [Fact]
    public void Filler_may_not_sit_between_two_cabinets()
    {
        var layout = Layout(
            Base("MV-B24", 0m, 24m),
            Filler(24m),
            Base("MV-B24", 27m, 24m));

        Validator.Validate(layout, new Wall(51m, 96m)).Codes()
            .ShouldContain(ViolationCode.FillerBetweenCabinets);
    }

    [Fact]
    public void Filler_closing_a_gap_at_a_wall_end_is_valid()
    {
        var layout = Layout(
            Base("MV-B24", 0m, 24m),
            Filler(24m));

        Validator.Validate(layout, new Wall(27m, 96m)).ShouldBeEmpty();
    }

    [Fact]
    public void Only_one_filler_is_allowed_at_each_wall_end()
    {
        var layout = Layout(
            Base("MV-B24", 0m, 24m),
            Filler(24m),
            Filler(27m));

        Validator.Validate(layout, new Wall(30m, 96m)).Codes()
            .ShouldContain(ViolationCode.TooManyFillers);
    }

    [Fact]
    public void Wall_cabinets_need_not_butt_together_the_way_the_floor_run_does()
    {
        var layout = Layout(
            Base("MV-B30", 0m, 30m),
            Base("MV-B30", 30m, 30m),
            WallCab("MV-W2430", 0m, 24m, 30m, y: 54m),
            WallCab("MV-W2430", 36m, 24m, 30m, y: 54m));

        Validator.Validate(layout, new Wall(60m, 96m)).ShouldBeEmpty();
    }
}
