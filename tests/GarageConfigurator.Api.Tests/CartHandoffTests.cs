using GarageConfigurator.Api.Contracts;
using GarageConfigurator.Api.Services;
using Shouldly;

namespace GarageConfigurator.Api.Tests;

/// <summary>
/// nopCommerce adds to cart by integer product id, and we only have SKUs. The map is supplied by the
/// store; until it covers a SKU we must refuse rather than add part of a wall to someone's cart.
/// </summary>
public class CartHandoffTests
{
    private static readonly LayoutDto Wall = new(new[]
    {
        new PlacedItemDto("MV-B24-F", 0m, 0m, 24m, 34.5m, 24m, "Base"),
        new PlacedItemDto("MV-B24-F", 24m, 0m, 24m, 34.5m, 24m, "Base"),
        new PlacedItemDto("", 48m, 0m, 24m, 34.5m, 24m, "KneeSpace"),
        new PlacedItemDto("MV-CTHW7425", 0m, 34.5m, 72m, 1.5m, 25m, "Counter"),
    });

    private static GarageApi ApiWith(params (string Sku, int Id)[] map) =>
        ApiFixture.Api(productIds: new ProductIdMap(map.ToDictionary(e => e.Sku, e => e.Id)));

    [Fact]
    public void A_fully_mapped_wall_is_ready_to_add()
    {
        var handoff = ApiWith(("MV-B24-F", 101), ("MV-CTHW7425", 202)).BuildCart(new CartRequestDto(Wall));

        handoff.Ready.ShouldBeTrue();
        handoff.UnmappedSkus.ShouldBeEmpty();
    }

    [Fact]
    public void Quantities_are_rolled_up_so_the_cart_gets_one_line_per_sku()
    {
        var handoff = ApiWith(("MV-B24-F", 101), ("MV-CTHW7425", 202)).BuildCart(new CartRequestDto(Wall));

        handoff.Lines.Single(l => l.Sku == "MV-B24-F").Quantity.ShouldBe(2);
        handoff.Lines.Length.ShouldBe(2);
    }

    [Fact]
    public void A_knee_space_never_reaches_the_cart()
    {
        var handoff = ApiWith(("MV-B24-F", 101), ("MV-CTHW7425", 202)).BuildCart(new CartRequestDto(Wall));

        handoff.Lines.ShouldAllBe(l => l.Sku.Length > 0);
    }

    [Fact]
    public void One_unmapped_sku_stops_the_whole_wall_rather_than_adding_part_of_it()
    {
        // Adding 2 base cabinets and silently dropping the countertop would ship an unusable wall.
        var handoff = ApiWith(("MV-B24-F", 101)).BuildCart(new CartRequestDto(Wall));

        handoff.Ready.ShouldBeFalse();
        handoff.Requests.ShouldBeEmpty();
        handoff.UnmappedSkus.ShouldBe(new[] { "MV-CTHW7425" });
    }

    [Fact]
    public void An_unmapped_wall_still_says_which_skus_the_store_needs_to_map()
    {
        var handoff = ApiWith().BuildCart(new CartRequestDto(Wall));

        handoff.UnmappedSkus.ShouldBe(new[] { "MV-B24-F", "MV-CTHW7425" });
    }

    [Fact]
    public void Each_request_is_a_nopcommerce_add_to_cart_post_carrying_the_quantity()
    {
        var handoff = ApiWith(("MV-B24-F", 101), ("MV-CTHW7425", 202)).BuildCart(new CartRequestDto(Wall));

        handoff.Requests.Select(r => r.Url).ShouldBe(new[]
        {
            "/addproducttocart/catalog/101/1/2",
            "/addproducttocart/catalog/202/1/1",
        });
        handoff.Requests.ShouldAllBe(r => r.Method == "POST");
    }

    [Fact]
    public void The_handoff_names_where_the_customer_ends_up()
    {
        ApiWith(("MV-B24-F", 101), ("MV-CTHW7425", 202)).BuildCart(new CartRequestDto(Wall))
            .CartUrl.ShouldBe("https://www.rtacabinetstore.com/cart");
    }

    [Fact]
    public void The_handoff_names_the_origin_the_posts_have_to_come_from()
    {
        // nopCommerce identifies the cart by session cookie. A page served from a Static Web App
        // cannot add to it, so the browser has to be told where these requests belong.
        ApiWith(("MV-B24-F", 101), ("MV-CTHW7425", 202)).BuildCart(new CartRequestDto(Wall))
            .StoreOrigin.ShouldBe("https://www.rtacabinetstore.com");
    }

    [Fact]
    public void The_requests_are_relative_so_they_only_work_from_that_origin()
    {
        var handoff = ApiWith(("MV-B24-F", 101), ("MV-CTHW7425", 202)).BuildCart(new CartRequestDto(Wall));

        handoff.Requests.ShouldAllBe(r => r.Url.StartsWith("/"));
    }

    [Fact]
    public void An_empty_layout_is_rejected_at_the_edge()
    {
        Should.Throw<BadRequestException>(() =>
            ApiWith().BuildCart(new CartRequestDto(new LayoutDto(Array.Empty<PlacedItemDto>()))));
    }

    [Fact]
    public void A_vendor_alias_is_mapped_through_to_the_sku_we_actually_sell()
    {
        var aliased = new LayoutDto(new[]
        {
            new PlacedItemDto("MV-B24-SF", 0m, 0m, 24m, 34.5m, 24m, "Base"),
        });

        var handoff = ApiWith(("MV-B24-F", 101)).BuildCart(new CartRequestDto(aliased));

        handoff.Ready.ShouldBeTrue();
        handoff.Lines.Single().Sku.ShouldBe("MV-B24-F");
    }
}
