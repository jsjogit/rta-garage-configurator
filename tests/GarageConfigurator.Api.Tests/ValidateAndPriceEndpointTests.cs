using GarageConfigurator.Api.Contracts;
using Shouldly;

namespace GarageConfigurator.Api.Tests;

public class ValidateAndPriceEndpointTests
{
    private static readonly WallDto Wall = new(240m, 96m);

    private static LayoutDto SolvedLayout(GarageApi api) =>
        api.Solve(new SolveRequest(Wall, "Balanced")).Layouts.First().Layout;

    [Fact]
    public void A_layout_the_solver_produced_validates_clean()
    {
        var api = ApiFixture.Api();

        api.Validate(new ValidateRequest(SolvedLayout(api), Wall)).Violations.ShouldBeEmpty();
    }

    [Fact]
    public void An_edited_layout_that_breaks_a_rule_comes_back_with_the_violation()
    {
        var api = ApiFixture.Api();
        var layout = SolvedLayout(api);

        // Drag the first cabinet off the floor, the way a bad edit would.
        var broken = layout with { Items = layout.Items.Select((item, i) => i == 0 ? item with { Y = 5m } : item).ToArray() };

        var response = api.Validate(new ValidateRequest(broken, Wall));

        response.Violations.ShouldNotBeEmpty();
        response.Violations.ShouldAllBe(v => v.Message.Length > 0);
    }

    [Fact]
    public void Validation_messages_are_written_for_a_customer_not_a_developer()
    {
        var api = ApiFixture.Api();
        var layout = SolvedLayout(api);
        var broken = layout with { Items = layout.Items.Select((item, i) => i == 0 ? item with { Y = 5m } : item).ToArray() };

        var message = api.Validate(new ValidateRequest(broken, Wall)).Violations[0].Message;

        message.ShouldNotContain("Exception");
        message.ShouldContain(" ");
    }

    [Fact]
    public void Pricing_a_layout_returns_both_subtotals()
    {
        var api = ApiFixture.Api();

        var priced = api.Price(new PriceRequest(SolvedLayout(api)));

        priced.SubtotalList.ShouldBeGreaterThan(0m);
        priced.SubtotalPromo.ShouldBeLessThanOrEqualTo(priced.SubtotalList);
        priced.SubtotalList.ShouldBe(priced.LineItems.Sum(i => i.ExtendedList));
    }

    [Fact]
    public void Pricing_an_empty_layout_is_rejected_at_the_edge()
    {
        var api = ApiFixture.Api();

        Should.Throw<BadRequestException>(() => api.Price(new PriceRequest(new LayoutDto(Array.Empty<PlacedItemDto>()))));
    }

    [Fact]
    public void An_unknown_zone_is_rejected_with_the_valid_zones_listed()
    {
        var api = ApiFixture.Api();
        var layout = new LayoutDto(new[] { new PlacedItemDto("MV-B24", 0m, 0m, 24m, 34.5m, 24m, "Cupboard") });

        Should.Throw<BadRequestException>(() => api.Price(new PriceRequest(layout)))
            .Message.ShouldContain("Base");
    }
}
