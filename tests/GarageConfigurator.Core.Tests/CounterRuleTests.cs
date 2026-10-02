using GarageConfigurator.Core;
using Shouldly;
using static GarageConfigurator.Core.Tests.Build;

namespace GarageConfigurator.Core.Tests;

/// <summary>One test per rule in the "Counter rules" section of docs/SOLVER_RULES.md.</summary>
public class CounterRuleTests
{
    private static readonly LayoutValidator Validator = new(TestCatalog.Load());

    [Fact]
    public void Counter_must_span_a_run_of_base_cabinets()
    {
        var layout = Layout(
            Tall("MV-PC2484", 0m, 24m),
            Counter("MV-CTHW5025", 0m, 50m));

        Validator.Validate(layout, new Wall(50m, 96m)).Codes()
            .ShouldContain(ViolationCode.CounterNotOverBases);
    }

    [Fact]
    public void Counter_must_be_at_least_as_wide_as_the_run_it_covers()
    {
        var layout = Layout(
            Base("MV-B15", 0m, 15m),
            Base("MV-B30", 15m, 30m),
            Base("MV-B24", 45m, 24m),
            Counter("MV-CTHW5025", 0m, 50m));

        Validator.Validate(layout, new Wall(69m, 96m)).Codes()
            .ShouldContain(ViolationCode.CounterTooShortForRun);
    }

    [Fact]
    public void Counter_too_short_names_the_run_and_suggests_a_bigger_top()
    {
        var layout = Layout(
            Base("MV-B15", 0m, 15m),
            Base("MV-B30", 15m, 30m),
            Base("MV-B24", 45m, 24m),
            Counter("MV-CTHW5025", 0m, 50m));

        var violation = Validator.Validate(layout, new Wall(69m, 96m))
            .First(v => v.Code == ViolationCode.CounterTooShortForRun);

        violation.Message.ShouldContain("69");
        violation.Message.ShouldContain("74");
    }

    [Fact]
    public void Counter_overhang_at_an_open_end_may_not_exceed_4_inches()
    {
        var layout = Layout(
            Base("MV-B15", 0m, 15m),
            Base("MV-B30", 15m, 30m),
            Counter("MV-CTHW5025", 0m, 50m));

        Validator.Validate(layout, new Wall(50m, 96m)).Codes()
            .ShouldContain(ViolationCode.CounterOverhangTooDeep);
    }

    [Fact]
    public void Counter_with_a_small_overhang_at_each_open_end_is_valid()
    {
        var layout = Layout(
            Base("MV-B24", 1m, 24m),
            Base("MV-B24", 25m, 24m),
            Counter("MV-CTHW5025", 0m, 50m));

        Validator.Validate(layout, new Wall(50m, 96m)).ShouldBeEmpty();
    }

    [Fact]
    public void Counter_may_not_overlap_a_tall_cabinet()
    {
        var layout = Layout(
            Tall("MV-PC2484", 0m, 24m),
            Base("MV-B24", 24m, 24m),
            Base("MV-B24", 48m, 24m),
            Counter("MV-CTHW5025", 20m, 50m));

        Validator.Validate(layout, new Wall(74m, 96m)).Codes()
            .ShouldContain(ViolationCode.CounterOverlapsTall);
    }

    [Fact]
    public void Counter_cut_flush_against_a_tall_cabinet_is_valid()
    {
        var layout = Layout(
            Tall("MV-PC2484", 0m, 24m),
            Base("MV-B24", 24m, 24m),
            Base("MV-B24", 48m, 24m),
            Counter("MV-CTHW5025", 24m, 50m));

        Validator.Validate(layout, new Wall(74m, 96m)).ShouldBeEmpty();
    }

    [Fact]
    public void Counter_cannot_be_cut_longer_than_the_stock_top_it_came_from()
    {
        // Placed 60" wide, but MV-CTHW5025 is only a 50" top — you cannot cut a top longer.
        var layout = Layout(
            Base("MV-B30", 0m, 30m),
            Base("MV-B30", 30m, 30m),
            Counter("MV-CTHW5025", 0m, 60m));

        Validator.Validate(layout, new Wall(60m, 96m)).Codes()
            .ShouldContain(ViolationCode.CounterTooShortForRun);
    }

    [Fact]
    public void Counter_cut_to_length_between_a_tall_and_the_wall_end_is_valid()
    {
        var layout = Layout(
            Tall("MV-PC2484", 0m, 24m),
            Base("MV-B24", 24m, 24m),
            Base("MV-B24", 48m, 24m),
            Base("MV-B24", 72m, 24m),
            Base("MV-B24", 96m, 24m),
            Counter("MV-CTHW9825", 24m, 96m));

        Validator.Validate(layout, new Wall(120m, 96m)).ShouldBeEmpty();
    }

    [Fact]
    public void Counters_may_not_be_joined_end_to_end_over_one_run()
    {
        var layout = Layout(
            Base("MV-B24", 0m, 24m),
            Base("MV-B24", 24m, 24m),
            Base("MV-B24", 48m, 24m),
            Base("MV-B24", 72m, 24m),
            Counter("MV-CTHW5025", 0m, 48m),
            Counter("MV-CTHW5025", 48m, 48m));

        Validator.Validate(layout, new Wall(96m, 96m)).Codes()
            .ShouldContain(ViolationCode.CountersJoinedEndToEnd);
    }

    [Fact]
    public void Counter_run_may_not_exceed_98_inches()
    {
        var layout = Layout(
            Base("MV-B30", 0m, 30m),
            Base("MV-B30", 30m, 30m),
            Base("MV-B30", 60m, 30m),
            Base("MV-B30", 90m, 30m),
            Counter("MV-CTHW9825", 0m, 98m));

        Validator.Validate(layout, new Wall(120m, 96m)).Codes()
            .ShouldContain(ViolationCode.CounterRunTooLong);
    }
}
