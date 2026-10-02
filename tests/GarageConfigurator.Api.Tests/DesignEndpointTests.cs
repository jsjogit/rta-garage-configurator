using GarageConfigurator.Api.Contracts;
using GarageConfigurator.Api.Services;
using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Api.Tests;

public class DesignEndpointTests
{
    private static SaveDesignRequest ADesign(GarageApi api)
    {
        var wall = new WallDto(240m, 96m);
        var layout = api.Solve(new SolveRequest(wall, "Balanced")).Layouts.First().Layout;

        return new SaveDesignRequest(wall, "Balanced", layout);
    }

    [Fact]
    public async Task Saving_a_design_returns_a_six_character_config_id()
    {
        var api = ApiFixture.Api();

        var saved = await api.SaveDesignAsync(ADesign(api));

        saved.ConfigId.Length.ShouldBe(6);
        saved.ConfigId.ShouldAllBe(c => ConfigId.Alphabet.Contains(c));
    }

    [Fact]
    public async Task A_saved_design_can_be_loaded_back_by_its_config_id()
    {
        var api = ApiFixture.Api();
        var request = ADesign(api);

        var saved = await api.SaveDesignAsync(request);
        var loaded = await api.GetDesignAsync(saved.ConfigId);

        loaded!.ConfigId.ShouldBe(saved.ConfigId);
        loaded.Goal.ShouldBe("Balanced");
        loaded.Wall.Length.ShouldBe(240m);
        loaded.Design.Layout.Items.Length.ShouldBe(request.Layout.Items.Length);
    }

    [Fact]
    public async Task A_loaded_design_is_repriced_rather_than_served_from_stale_money()
    {
        var api = ApiFixture.Api();
        var saved = await api.SaveDesignAsync(ADesign(api));

        var loaded = await api.GetDesignAsync(saved.ConfigId);

        loaded!.Design.SubtotalList.ShouldBeGreaterThan(0m);
        loaded.Design.LineItems.ShouldAllBe(i => i.ExtendedList == i.UnitList * i.Quantity);
    }

    [Fact]
    public async Task An_unknown_config_id_comes_back_empty_so_the_route_can_404()
    {
        (await ApiFixture.Api().GetDesignAsync("ZZZZZZ")).ShouldBeNull();
    }

    [Fact]
    public async Task A_config_id_collision_is_retried_rather_than_overwriting_someone_elses_design()
    {
        // A Random that always yields the same id would collide forever without a retry.
        var store = new InMemoryDesignStore();
        var api = ApiFixture.Api(store, new PredictableRandom());

        var first = await api.SaveDesignAsync(ADesign(api));
        var second = await api.SaveDesignAsync(ADesign(api));

        second.ConfigId.ShouldNotBe(first.ConfigId);
        (await store.GetAsync(first.ConfigId)).ShouldNotBeNull();
    }

    /// <summary>Returns the same draw twice, then moves on — forces the collision path.</summary>
    private sealed class PredictableRandom : Random
    {
        private int _calls;

        public override int Next(int maxValue)
        {
            _calls++;
            return _calls <= ConfigId.Length * 2 ? 0 : 1;
        }
    }
}
