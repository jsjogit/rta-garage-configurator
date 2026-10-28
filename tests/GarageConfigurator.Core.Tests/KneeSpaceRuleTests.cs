using GarageConfigurator.Core;
using Shouldly;
using static GarageConfigurator.Core.Tests.Build;

namespace GarageConfigurator.Core.Tests;

/// <summary>One test per knee-space rule in the "Counter rules" section of docs/SOLVER_RULES.md.</summary>
public class KneeSpaceRuleTests
{
    private static readonly LayoutValidator Validator = new(TestCatalog.Load());

    /// <summary>B24 + 24" knee + B24 under a 74" top, with a width-matched 15" bridge above.</summary>
    private static Layout VendorVignette => Layout(
        Base("MV-B24-F", 0m, 24m),
        Knee(24m, 24m),
        Base("MV-B24-F", 48m, 24m),
        Counter("MV-CTHW7425", 0m, 72m),
        WallCab("MV-W2430", 0m, 24m, 30m, y: 54m),
        WallCab("MV-W2415", 24m, 24m, 15m, y: 69m),
        WallCab("MV-W2430", 48m, 24m, 30m, y: 54m));

    [Fact]
    public void The_vendor_vignette_validates_clean()
    {
        Validator.Validate(VendorVignette, new Wall(72m, 96m)).ShouldBeEmpty();
    }

    [Fact]
    public void A_knee_space_never_reaches_the_quote()
    {
        VendorVignette.LineItems.Select(i => i.Sku).ShouldNotContain(string.Empty);
    }

    [Fact]
    public void A_knee_space_still_takes_up_wall_length()
    {
        VendorVignette.OccupiedWidth.ShouldBe(72m);
    }

    [Fact]
    public void Messages_name_a_knee_space_rather_than_its_blank_sku()
    {
        // Found in the browser: removing the base beside a knee space read
        // "a 30" gap between MV-B24-F and ; cabinets butt together."
        var layout = Layout(
            Base("MV-B24-F", 0m, 24m),
            Knee(54m, 24m),
            Base("MV-B24-F", 78m, 24m),
            Counter("MV-CTHW9825", 0m, 102m));

        var gap = Validator.Validate(layout, new Wall(102m, 96m))
            .Single(v => v.Code == ViolationCode.GapBetweenCabinets);

        gap.Message.ShouldBe("There is a 30\" gap between MV-B24-F and the knee space; cabinets butt together.");
    }

    [Fact]
    public void A_knee_space_must_be_24_or_30_wide()
    {
        var layout = Layout(
            Base("MV-B24-F", 0m, 24m),
            Knee(24m, 15m),
            Base("MV-B24-F", 39m, 24m),
            Counter("MV-CTHW7425", 0m, 63m));

        Validator.Validate(layout, new Wall(63m, 96m)).Codes()
            .ShouldContain(ViolationCode.KneeSpaceWrongWidth);
    }

    [Fact]
    public void A_knee_space_may_not_open_the_run()
    {
        var layout = Layout(
            Knee(0m, 24m),
            Base("MV-B24-F", 24m, 24m),
            Base("MV-B24-F", 48m, 24m),
            Counter("MV-CTHW7425", 0m, 72m));

        Validator.Validate(layout, new Wall(72m, 96m)).Codes()
            .ShouldContain(ViolationCode.KneeSpaceAtRunEnd);
    }

    [Fact]
    public void A_knee_space_may_not_close_the_run()
    {
        var layout = Layout(
            Base("MV-B24-F", 0m, 24m),
            Base("MV-B24-F", 24m, 24m),
            Knee(48m, 24m),
            Counter("MV-CTHW7425", 0m, 72m));

        Validator.Validate(layout, new Wall(72m, 96m)).Codes()
            .ShouldContain(ViolationCode.KneeSpaceAtRunEnd);
    }

    [Fact]
    public void Only_one_knee_space_is_allowed_in_a_counter_run()
    {
        var layout = Layout(
            Base("MV-B24-F", 0m, 24m),
            Knee(24m, 24m),
            Base("MV-B24-F", 48m, 24m),
            Knee(72m, 24m),
            Base("MV-B24-F", 96m, 24m),
            Counter("MV-CTHW9825", 0m, 120m));

        Validator.Validate(layout, new Wall(120m, 96m)).Codes()
            .ShouldContain(ViolationCode.TooManyKneeSpaces);
    }

    [Fact]
    public void The_counter_has_to_cover_the_knee_space_as_well_as_the_cabinets()
    {
        // A 50" top cannot cover 24 + 24 + 24 once the knee space counts toward the run.
        var layout = Layout(
            Base("MV-B24-F", 0m, 24m),
            Knee(24m, 24m),
            Base("MV-B24-F", 48m, 24m),
            Counter("MV-CTHW5025", 0m, 72m));

        Validator.Validate(layout, new Wall(72m, 96m)).Codes()
            .ShouldContain(ViolationCode.CounterTooShortForRun);
    }

    [Fact]
    public void A_knee_space_sits_under_a_countertop()
    {
        // Found on a 20 ft "A bit of both" wall: a 120" run had no top long enough, so it was left
        // bare with an open gap in the middle and a bridge hung over nothing to work at.
        var layout = Layout(
            Base("MV-B30-F", 0m, 30m),
            Knee(30m, 30m),
            Base("MV-B30-F", 60m, 30m));

        Validator.Validate(layout, new Wall(90m, 96m)).Codes()
            .ShouldContain(ViolationCode.KneeSpaceWithoutCounter);
    }

    [Fact]
    public void A_knee_space_carries_no_sku_because_it_is_not_a_product()
    {
        var layout = Layout(
            Base("MV-B24-F", 0m, 24m),
            new PlacedItem("MV-B24", 24m, 0m, 24m, 34.5m, 24m, Zone.KneeSpace),
            Base("MV-B24-F", 48m, 24m),
            Counter("MV-CTHW7425", 0m, 72m));

        Validator.Validate(layout, new Wall(72m, 96m)).Codes()
            .ShouldContain(ViolationCode.KneeSpaceMustHaveNoSku);
    }
}
