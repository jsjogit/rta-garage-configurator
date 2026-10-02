using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

public class GeometryTests
{
    [Fact]
    public void Obstruction_right_edge_is_start_plus_width()
    {
        var panel = new Obstruction(ObstructionType.ElectricalPanel, StartX: 180m, Width: 16m, Height: 30m, BottomY: 48m);

        panel.Right.ShouldBe(196m);
    }

    [Fact]
    public void Obstruction_top_is_bottom_plus_height()
    {
        var panel = new Obstruction(ObstructionType.ElectricalPanel, StartX: 180m, Width: 16m, Height: 30m, BottomY: 48m);

        panel.Top.ShouldBe(78m);
    }

    [Fact]
    public void Obstruction_resting_on_the_floor_reaches_the_floor()
    {
        var waterHeater = new Obstruction(ObstructionType.WaterHeater, StartX: 0m, Width: 30m, Height: 72m, BottomY: 0m);

        waterHeater.ReachesFloor.ShouldBeTrue();
    }

    [Fact]
    public void Wall_mounted_obstruction_does_not_reach_the_floor()
    {
        var panel = new Obstruction(ObstructionType.ElectricalPanel, StartX: 180m, Width: 16m, Height: 30m, BottomY: 48m);

        panel.ReachesFloor.ShouldBeFalse();
    }

    [Fact]
    public void Placed_item_right_edge_is_x_plus_width()
    {
        var cabinet = new PlacedItem("MV-B24", X: 30m, Y: 0m, Width: 24m, Height: 34.5m, Depth: 24m, Zone: Zone.Base);

        cabinet.Right.ShouldBe(54m);
    }

    [Fact]
    public void Placed_item_top_is_y_plus_height()
    {
        var wallCabinet = new PlacedItem("MV-W3030", X: 0m, Y: 54m, Width: 30m, Height: 30m, Depth: 12m, Zone: Zone.Wall);

        wallCabinet.Top.ShouldBe(84m);
    }

    [Fact]
    public void Wall_has_no_obstructions_unless_given_any()
    {
        var wall = new Wall(Length: 240m, Ceiling: 96m);

        wall.Obstructions.ShouldBeEmpty();
    }

    [Fact]
    public void Wall_keeps_the_obstructions_it_was_given()
    {
        var panel = new Obstruction(ObstructionType.ElectricalPanel, StartX: 180m, Width: 16m, Height: 30m, BottomY: 48m);

        var wall = new Wall(Length: 240m, Ceiling: 96m, Obstructions: new[] { panel });

        wall.Obstructions.ShouldHaveSingleItem().ShouldBe(panel);
    }
}
