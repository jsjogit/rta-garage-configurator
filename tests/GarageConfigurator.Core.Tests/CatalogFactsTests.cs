using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

/// <summary>
/// One test per bullet in the "Catalog facts" section of docs/SOLVER_RULES.md.
/// Each would fail if the corresponding catalog fact changed.
/// </summary>
public class CatalogFactsTests
{
    private static readonly Catalog Catalog = TestCatalog.Load();

    [Fact]
    public void Catalog_has_18_cabinets()
    {
        Catalog.Cabinets.Count.ShouldBe(18);
    }

    [Fact]
    public void Catalog_has_3_countertops()
    {
        Catalog.Countertops.Count.ShouldBe(3);
    }

    [Fact]
    public void Every_sku_is_unique()
    {
        var skus = Catalog.Cabinets.Select(c => c.Sku)
            .Concat(Catalog.Countertops.Select(c => c.Sku))
            .ToList();

        skus.ShouldBeUnique();
    }

    [Fact]
    public void Every_cabinet_width_is_3_15_24_or_30()
    {
        Catalog.Cabinets.ShouldNotBeEmpty();
        Catalog.Cabinets.Select(c => c.Width).ShouldBeSubsetOf(new[] { 3m, 15m, 24m, 30m });
    }

    [Fact]
    public void Every_base_cabinet_is_34_5_high_and_24_deep()
    {
        var bases = Catalog.Cabinets.Where(c => c.Zone == Zone.Base).ToList();

        bases.ShouldNotBeEmpty();
        bases.ShouldAllBe(c => c.Height == 34.5m && c.Depth == 24m);
    }

    [Fact]
    public void Waste_pullout_is_a_normal_34_5_high_base()
    {
        var wastePullout = Catalog.Cabinet("MV-BWB15-PS");

        wastePullout.Zone.ShouldBe(Zone.Base);
        wastePullout.Height.ShouldBe(34.5m);
    }

    [Fact]
    public void Every_wall_cabinet_is_12_deep_and_15_or_30_high()
    {
        var walls = Catalog.Cabinets.Where(c => c.Zone == Zone.Wall).ToList();

        walls.Count.ShouldBe(5);
        walls.ShouldAllBe(c => c.Depth == 12m);
        walls.Select(c => c.Height).ShouldBeSubsetOf(new[] { 15m, 30m });
    }

    [Fact]
    public void Every_tall_cabinet_is_84_high_24_deep_and_24_or_30_wide()
    {
        var talls = Catalog.Cabinets.Where(c => c.Zone == Zone.Tall).ToList();

        talls.Count.ShouldBe(2);
        talls.ShouldAllBe(c => c.Height == 84m && c.Depth == 24m);
        talls.Select(c => c.Width).ShouldBe(new[] { 24m, 30m }, ignoreOrder: true);
    }

    [Fact]
    public void Filler_is_3_by_84_by_24()
    {
        var filler = Catalog.Cabinet("MV-F384");

        filler.Zone.ShouldBe(Zone.Filler);
        (filler.Width, filler.Height, filler.Depth).ShouldBe((3m, 84m, 24m));
    }

    [Fact]
    public void Every_countertop_is_25_deep_and_1_5_thick()
    {
        Catalog.Countertops.ShouldNotBeEmpty();
        Catalog.Countertops.ShouldAllBe(c => c.Depth == 25m && c.Thickness == 1.5m);
    }

    [Fact]
    public void Every_countertop_ideal_run_is_its_width_minus_2()
    {
        Catalog.Countertops.ShouldNotBeEmpty();
        Catalog.Countertops.ShouldAllBe(c => c.IdealRun == c.Width - 2m);
    }

    [Fact]
    public void Countertop_widths_are_50_74_and_98()
    {
        Catalog.Countertops.Select(c => c.Width).ShouldBe(new[] { 50m, 74m, 98m }, ignoreOrder: true);
    }

    [Fact]
    public void Kitchen_line_18_inch_inserts_are_not_in_the_cabinet_list()
    {
        var skus = Catalog.Cabinets.Select(c => c.Sku).ToList();

        skus.ShouldNotContain("RV-BWB18GRAY");
        skus.ShouldNotContain("RV-BWB18GRAYPREMIER");
    }

    [Fact]
    public void Marketplace_kit_is_excluded_from_the_solver()
    {
        Catalog.Cabinets.Select(c => c.Sku).ToList().ShouldNotContain("MV-GARAGE-KIT-6");
    }

    [Fact]
    public void Line_has_one_finish_and_one_door_style()
    {
        Catalog.Line.Finish.ShouldBe("Gray TFL");
        Catalog.Line.DoorStyle.ShouldBe("Full overlay slab");
    }
}
