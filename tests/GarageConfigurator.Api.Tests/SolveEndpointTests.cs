using GarageConfigurator.Api.Contracts;
using Shouldly;

namespace GarageConfigurator.Api.Tests;

public class SolveEndpointTests
{
    private static readonly WallDto TwentyFootWall = new(240m, 96m);

    [Fact]
    public void Solving_a_clean_wall_returns_priced_layouts()
    {
        var response = ApiFixture.Api().Solve(new SolveRequest(TwentyFootWall, "Balanced"));

        response.Failure.ShouldBeNull();
        response.Options.ShouldNotBeEmpty();
        response.Options.ShouldAllBe(o => o.Standard.SubtotalList > 0m && o.Premiere.SubtotalList > 0m);
    }

    [Fact]
    public void Each_returned_layout_carries_line_items_the_cart_can_use()
    {
        var layout = ApiFixture.Api().Solve(new SolveRequest(TwentyFootWall, "Workbench")).Options.First().Standard;

        layout.LineItems.ShouldNotBeEmpty();
        layout.LineItems.ShouldAllBe(i => i.Quantity > 0 && i.ExtendedList == i.UnitList * i.Quantity);
    }

    [Fact]
    public void The_promo_subtotal_is_never_above_the_list_subtotal()
    {
        var response = ApiFixture.Api().Solve(new SolveRequest(TwentyFootWall, "Storage"));

        response.Options.ShouldAllBe(o => o.Standard.SubtotalPromo <= o.Standard.SubtotalList);
    }

    [Fact]
    public void A_wall_that_cannot_be_solved_returns_a_failure_rather_than_an_error()
    {
        var response = ApiFixture.Api().Solve(new SolveRequest(new WallDto(12m, 96m), "Balanced"));

        response.Options.ShouldBeEmpty();
        response.Failure!.Code.ShouldBe("WallTooShort");
        response.Failure.Message.ShouldBe("This wall is too short for our smallest cabinet.");
    }

    [Fact]
    public void A_low_ceiling_comes_back_with_the_notice_attached()
    {
        var response = ApiFixture.Api().Solve(new SolveRequest(new WallDto(240m, 80m), "Storage"));

        response.Notices.Select(n => n.Code).ShouldContain("TallsExcludedLowCeiling");
    }

    [Fact]
    public void An_unknown_goal_is_rejected_with_the_list_of_valid_goals()
    {
        var api = ApiFixture.Api();

        var error = Should.Throw<BadRequestException>(() => api.Solve(new SolveRequest(TwentyFootWall, "Tidy")));

        error.Message.ShouldContain("Workbench");
    }

    [Fact]
    public void A_wall_with_no_ceiling_is_rejected_rather_than_assumed()
    {
        var api = ApiFixture.Api();

        Should.Throw<BadRequestException>(() => api.Solve(new SolveRequest(new WallDto(240m, 0m), "Balanced")))
            .Message.ShouldContain("ceiling");
    }

    [Fact]
    public void An_obstruction_hanging_off_the_end_of_the_wall_is_rejected()
    {
        var wall = new WallDto(240m, 96m, new[] { new ObstructionDto("WaterHeater", 230m, 30m, 72m, 0m) });
        var api = ApiFixture.Api();

        Should.Throw<BadRequestException>(() => api.Solve(new SolveRequest(wall, "Balanced")))
            .Message.ShouldContain("outside");
    }
}
