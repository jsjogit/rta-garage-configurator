using GarageConfigurator.Api.Contracts;
using GarageConfigurator.Api.Services;
using Shouldly;

namespace GarageConfigurator.Api.Tests;

public class EditorEndpointTests
{
    [Fact]
    public void Swaps_for_a_base_offer_the_same_width_in_the_same_zone()
    {
        var swaps = ApiFixture.Api().Swaps("MV-B24");

        swaps.Options.Select(o => o.Sku).ShouldContain("MV-DB24-4");
        swaps.Options.ShouldAllBe(o => o.Width == 24m);
    }

    [Fact]
    public void Swaps_accept_a_vendor_alias()
    {
        ApiFixture.Api().Swaps("MV-B24-SF").Options.ShouldNotBeEmpty();
    }

    [Fact]
    public void Swaps_for_an_unknown_sku_are_rejected_rather_than_returned_empty()
    {
        Should.Throw<BadRequestException>(() => ApiFixture.Api().Swaps("NOT-A-SKU"));
    }

    [Fact]
    public async Task A_lead_is_stored_against_the_design_it_came_from()
    {
        var leads = new InMemoryLeadStore();
        var api = ApiFixture.Api(leads: leads);

        var response = await api.CaptureLeadAsync(
            new LeadRequest("EmailMe", "someone@example.com", "7K2MQ4", null, null));

        response.Received.ShouldBeTrue();
        (await leads.AllAsync()).Single().ConfigId.ShouldBe("7K2MQ4");
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("missing@domain")]
    public async Task A_lead_without_a_usable_email_is_rejected(string email)
    {
        var api = ApiFixture.Api();

        await Should.ThrowAsync<BadRequestException>(() =>
            api.CaptureLeadAsync(new LeadRequest("EmailMe", email, null, null, null)));
    }

    [Fact]
    public async Task A_lead_of_an_unknown_kind_is_rejected_with_the_valid_kinds()
    {
        var api = ApiFixture.Api();

        var error = await Should.ThrowAsync<BadRequestException>(() =>
            api.CaptureLeadAsync(new LeadRequest("Pigeon", "someone@example.com", null, null, null)));

        error.Message.ShouldContain("DesignerHelp");
    }

    [Fact]
    public async Task A_designer_request_can_carry_what_the_customer_actually_wants()
    {
        var leads = new InMemoryLeadStore();
        var api = ApiFixture.Api(leads: leads);

        await api.CaptureLeadAsync(new LeadRequest(
            "DesignerHelp", "someone@example.com", "7K2MQ4", "Sam", "Can we fit a sink?"));

        var lead = (await leads.AllAsync()).Single();
        lead.Kind.ShouldBe("DesignerHelp");
        lead.Message.ShouldBe("Can we fit a sink?");
    }
}
