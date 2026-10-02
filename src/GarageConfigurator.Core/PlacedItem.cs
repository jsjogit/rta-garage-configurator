namespace GarageConfigurator.Core;

/// <summary>One SKU placed at a position on the wall. X/Y measured in inches from the floor at the left end.</summary>
public sealed record PlacedItem(
    string Sku,
    decimal X,
    decimal Y,
    decimal Width,
    decimal Height,
    decimal Depth,
    Zone Zone)
{
    public decimal Right => X + Width;

    public decimal Top => Y + Height;
}
