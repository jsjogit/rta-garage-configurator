namespace GarageConfigurator.Core;

/// <summary>
/// The rectangle an obstruction actually denies to cabinets, once its clearance is applied.
/// Wider and often taller than the obstruction itself — an electrical panel's working space runs
/// to the floor even though the panel does not.
/// </summary>
public sealed record KeepOut(decimal Left, decimal Right, decimal Bottom, decimal Top)
{
    public bool Blocks(PlacedItem item) =>
        item.X < Right && Left < item.Right && item.Y < Top && Bottom < item.Top;

    /// <summary>True when the span between two cabinets is there because this keep-out forced it.</summary>
    public bool Explains(decimal spanLeft, decimal spanRight) =>
        spanLeft <= Left && spanRight >= Right;

    public bool TouchesAt(decimal x) => x == Left || x == Right;
}
