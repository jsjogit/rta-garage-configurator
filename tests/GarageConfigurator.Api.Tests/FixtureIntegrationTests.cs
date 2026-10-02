using System.Text.Json;
using GarageConfigurator.Api.Contracts;
using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Api.Tests;

/// <summary>
/// Drives the API with the real fixture walls from data/fixtures/walls.json, through the JSON
/// contracts rather than the domain types, the way the web app will.
/// </summary>
public class FixtureIntegrationTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static TheoryData<string> Fixtures()
    {
        var data = new TheoryData<string>();

        foreach (var fixture in LoadFixtures())
        {
            data.Add(fixture.GetProperty("id").GetString()!);
        }

        return data;
    }

    private static IEnumerable<JsonElement> LoadFixtures()
    {
        var json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "data", "fixtures", "walls.json"));
        using var document = JsonDocument.Parse(json);

        return document.RootElement.EnumerateArray().Select(e => e.Clone()).ToList();
    }

    private static (SolveRequest Request, string Id) RequestFor(string fixtureId)
    {
        var fixture = LoadFixtures().Single(f => f.GetProperty("id").GetString() == fixtureId);

        var obstructions = fixture.TryGetProperty("obstructions", out var list)
            ? list.EnumerateArray().Select(o => new ObstructionDto(
                o.GetProperty("type").GetString()!,
                o.GetProperty("startX").GetDecimal(),
                o.GetProperty("width").GetDecimal(),
                o.GetProperty("height").GetDecimal(),
                o.GetProperty("bottomY").GetDecimal())).ToArray()
            : Array.Empty<ObstructionDto>();

        var wall = new WallDto(
            fixture.GetProperty("length").GetDecimal(),
            fixture.GetProperty("ceiling").GetDecimal(),
            obstructions);

        return (new SolveRequest(wall, fixture.GetProperty("goal").GetString()!), fixtureId);
    }

    [Theory]
    [MemberData(nameof(Fixtures))]
    public void Every_fixture_wall_solves_into_a_coherent_response(string fixtureId)
    {
        var (request, _) = RequestFor(fixtureId);

        var response = ApiFixture.Api().Solve(request);

        if (response.Layouts.Length == 0)
        {
            response.Failure.ShouldNotBeNull($"{fixtureId} returned nothing and no reason why");
            return;
        }

        response.Failure.ShouldBeNull();
        response.Layouts.Length.ShouldBeLessThanOrEqualTo(3);
        response.Layouts.ShouldAllBe(l => l.SubtotalList > 0m && l.Layout.Items.Length > 0);
    }

    [Theory]
    [MemberData(nameof(Fixtures))]
    public void Every_layout_the_api_returns_validates_clean_through_the_api(string fixtureId)
    {
        var (request, _) = RequestFor(fixtureId);
        var api = ApiFixture.Api();

        foreach (var layout in api.Solve(request).Layouts)
        {
            api.Validate(new ValidateRequest(layout.Layout, request.Wall)).Violations.ShouldBeEmpty();
        }
    }

    [Theory]
    [MemberData(nameof(Fixtures))]
    public void Every_solve_response_round_trips_through_json(string fixtureId)
    {
        var (request, _) = RequestFor(fixtureId);

        var response = ApiFixture.Api().Solve(request);
        var json = JsonSerializer.Serialize(response, Web);
        var parsed = JsonSerializer.Deserialize<SolveResponse>(json, Web)!;

        parsed.Layouts.Length.ShouldBe(response.Layouts.Length);
        parsed.Layouts.Select(l => l.SubtotalList).ShouldBe(response.Layouts.Select(l => l.SubtotalList));
    }

    [Fact]
    public void Enums_cross_the_wire_as_readable_strings_not_numbers()
    {
        var (request, _) = RequestFor("single-car-clean");

        var json = JsonSerializer.Serialize(ApiFixture.Api().Solve(request), Web);

        json.ShouldContain("\"zone\":\"Base\"");
        json.ShouldNotContain("\"zone\":0");
    }

    [Fact]
    public void A_failure_response_names_the_reason_as_a_string()
    {
        var json = JsonSerializer.Serialize(
            ApiFixture.Api().Solve(new SolveRequest(new WallDto(12m, 96m), "Balanced")), Web);

        json.ShouldContain("WallTooShort");
    }

    [Fact]
    public void Money_crosses_the_wire_with_cents_intact()
    {
        var (request, _) = RequestFor("single-car-clean");
        var response = ApiFixture.Api().Solve(request);

        var subtotal = response.Layouts[0].SubtotalList;
        var roundTripped = JsonSerializer.Deserialize<decimal>(JsonSerializer.Serialize(subtotal, Web), Web);

        roundTripped.ShouldBe(subtotal);
        subtotal.ShouldBe(decimal.Round(subtotal, 2));
    }

    [Fact]
    public async Task A_design_saved_from_a_fixture_reloads_with_the_same_cabinets()
    {
        var (request, _) = RequestFor("two-car-panel");
        var api = ApiFixture.Api();
        var layout = api.Solve(request).Layouts.First().Layout;

        var saved = await api.SaveDesignAsync(new SaveDesignRequest(request.Wall, request.Goal, layout));
        var loaded = (await api.GetDesignAsync(saved.ConfigId))!;

        loaded.Design.Layout.Items.Select(i => i.Sku)
            .ShouldBe(layout.Items.Select(i => i.Sku));
        loaded.Wall.Obstructions!.Length.ShouldBe(1);
    }
}
