using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

/// <summary>The "No valid layout" section of docs/SOLVER_RULES.md.</summary>
public class SolveGuardTests
{
    private static readonly WallSolver Solver = new(TestCatalog.Load());
    private static readonly PriceMap Prices = TestCatalog.LoadSeedPrices();

    [Fact]
    public void Wall_shorter_than_the_narrowest_cabinet_returns_no_layouts()
    {
        var result = Solver.Solve(WallFixtures.Get("too-short"), Goal.Balanced, Prices);

        result.Options.ShouldBeEmpty();
        result.Failure!.Code.ShouldBe(SolveReason.WallTooShort);
    }

    [Fact]
    public void Wall_too_short_carries_the_copy_the_customer_sees()
    {
        var result = Solver.Solve(new Wall(12m, 96m), Goal.Balanced, Prices);

        result.Failure!.Message.ShouldBe("This wall is too short for our smallest cabinet.");
    }

    [Fact]
    public void Ceiling_below_36_returns_no_layouts()
    {
        var result = Solver.Solve(WallFixtures.Get("ceiling-too-low"), Goal.Balanced, Prices);

        result.Options.ShouldBeEmpty();
        result.Failure!.Code.ShouldBe(SolveReason.CeilingTooLow);
    }

    [Fact]
    public void Ceiling_below_84_still_solves_but_warns_that_talls_are_excluded()
    {
        var result = Solver.Solve(WallFixtures.Get("low-ceiling-80"), Goal.Storage, Prices);

        result.Notices.Select(n => n.Code).ShouldContain(NoticeCode.TallsExcludedLowCeiling);
    }

    [Fact]
    public void Ceiling_below_84_returns_no_talls_and_no_wall_cabinets()
    {
        var result = Solver.Solve(WallFixtures.Get("low-ceiling-80"), Goal.Storage, Prices);

        result.Options.ShouldNotBeEmpty();
        result.Options.SelectMany(o => o.Tiers).SelectMany(l => l.Items)
            .ShouldAllBe(i => i.Zone != Zone.Tall && i.Zone != Zone.Wall);
    }

    [Fact]
    public void A_ceiling_of_exactly_84_takes_wall_cabinets_but_not_pantries()
    {
        var result = Solver.Solve(WallFixtures.Get("ceiling-exactly-84"), Goal.Storage, Prices);

        var items = result.Options.SelectMany(o => o.Standard.Items).ToList();

        items.ShouldContain(i => i.Zone == Zone.Wall);
        items.ShouldNotContain(i => i.Zone == Zone.Tall);
    }

    [Fact]
    public void A_ceiling_too_low_to_tilt_a_pantry_upright_says_so()
    {
        var result = Solver.Solve(WallFixtures.Get("ceiling-exactly-84"), Goal.Storage, Prices);

        var notice = result.Notices.Single(n => n.Code == NoticeCode.TallsNeedTipUpRoom);

        notice.Message.ShouldContain("assembled");
        notice.Message.ShouldContain("designer");
    }

    [Fact]
    public void Just_above_the_tip_up_clearance_pantries_come_back()
    {
        var result = Solver.Solve(WallFixtures.Get("ceiling-88-tipup"), Goal.Storage, Prices);

        result.Notices.Select(n => n.Code).ShouldNotContain(NoticeCode.TallsNeedTipUpRoom);
        result.Options.SelectMany(o => o.Standard.Items).ShouldContain(i => i.Zone == Zone.Tall);
    }

    [Fact]
    public void A_wall_with_a_clearance_obstruction_offers_a_designer()
    {
        var result = Solver.Solve(WallFixtures.Get("two-car-panel"), Goal.Workbench, Prices);

        result.Notices.Select(n => n.Code).ShouldContain(NoticeCode.ObstructionsWorthADesignerLook);
    }

    [Fact]
    public void A_clean_wall_is_not_nagged_about_designers()
    {
        var result = Solver.Solve(WallFixtures.Get("single-car-clean"), Goal.Balanced, Prices);

        result.Notices.ShouldBeEmpty();
    }

    [Fact]
    public void A_normal_wall_solves_without_a_failure()
    {
        var result = Solver.Solve(WallFixtures.Get("single-car-clean"), Goal.Balanced, Prices);

        result.Failure.ShouldBeNull();
        result.Options.ShouldNotBeEmpty();
    }
}
