using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

/// <summary>Vendor sheets write "-SF" where our catalogue writes "-F". See docs/SOLVER_RULES.md.</summary>
public class SkuAliasTests
{
    private static readonly Catalog Catalog = TestCatalog.Load();

    [Theory]
    [InlineData("MV-B24-SF", "MV-B24-F")]
    [InlineData("MV-B30-SF", "MV-B30-F")]
    public void A_vendor_alias_resolves_to_the_sku_we_sell(string alias, string canonical)
    {
        Catalog.Resolve(alias).ShouldBe(canonical);
    }

    [Fact]
    public void A_canonical_sku_resolves_to_itself()
    {
        Catalog.Resolve("MV-B24-F").ShouldBe("MV-B24-F");
    }

    [Fact]
    public void Looking_a_cabinet_up_by_its_alias_finds_the_real_cabinet()
    {
        Catalog.Cabinet("MV-B30-SF").Sku.ShouldBe("MV-B30-F");
    }

    [Fact]
    public void An_alias_never_becomes_a_second_catalogue_entry()
    {
        Catalog.Cabinets.Select(c => c.Sku).ShouldNotContain("MV-B24-SF");
    }

    [Fact]
    public void An_unknown_sku_still_throws_rather_than_resolving_to_nothing()
    {
        Should.Throw<KeyNotFoundException>(() => Catalog.Cabinet("MV-NOPE"));
    }
}
