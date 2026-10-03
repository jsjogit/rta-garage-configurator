using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

public class LayoutTests
{
    private static PlacedItem Base24(decimal x) =>
        new("MV-B24", x, Y: 0m, Width: 24m, Height: 34.5m, Depth: 24m, Zone: Zone.Base);

    private static PlacedItem Base30(decimal x) =>
        new("MV-B30", x, Y: 0m, Width: 30m, Height: 34.5m, Depth: 24m, Zone: Zone.Base);

    [Fact]
    public void Repeated_skus_roll_up_into_one_line_item_carrying_the_quantity()
    {
        var layout = new Layout(new[] { Base24(0m), Base24(24m), Base30(48m) });

        layout.LineItems.ShouldBe(
            new[] { new LineItem("MV-B24", 2), new LineItem("MV-B30", 1) },
            ignoreOrder: true);
    }

    [Fact]
    public void Line_items_are_ordered_by_first_appearance_on_the_wall()
    {
        var layout = new Layout(new[] { Base30(0m), Base24(30m), Base30(54m) });

        layout.LineItems.Select(item => item.Sku).ShouldBe(new[] { "MV-B30", "MV-B24" });
    }

    [Fact]
    public void An_empty_layout_has_no_line_items()
    {
        new Layout(Array.Empty<PlacedItem>()).LineItems.ShouldBeEmpty();
    }

    [Fact]
    public void Replacing_the_items_recomputes_the_line_items()
    {
        var layout = new Layout(new[] { Base24(0m) });

        var edited = layout with { Items = new[] { Base24(0m), Base30(24m) } };

        edited.LineItems.Select(i => i.Sku).ShouldBe(new[] { "MV-B24", "MV-B30" });
    }

    [Fact]
    public void Layout_width_spans_from_the_leftmost_item_to_the_rightmost()
    {
        var layout = new Layout(new[] { Base24(0m), Base30(24m) });

        layout.OccupiedWidth.ShouldBe(54m);
    }
}
