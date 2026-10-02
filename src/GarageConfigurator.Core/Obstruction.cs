namespace GarageConfigurator.Core;

/// <summary>
/// Something on the wall that cabinets must avoid. The rectangle here is the obstruction itself;
/// the solver expands it into a keep-out using <see cref="Constants.ClearanceFor"/>.
/// </summary>
public sealed record Obstruction(
    ObstructionType Type,
    decimal StartX,
    decimal Width,
    decimal Height,
    decimal BottomY)
{
    public decimal Right => StartX + Width;

    public decimal Top => BottomY + Height;

    /// <summary>Floor-standing obstructions block bases and talls; wall-mounted ones may only block walls.</summary>
    public bool ReachesFloor => BottomY == 0m;

    /// <summary>
    /// Expand this obstruction into the rectangle cabinets must avoid. A minimum keep-out width is
    /// centred on the obstruction; a floor-to-Y clearance overrides the obstruction's own bottom.
    /// </summary>
    public KeepOut KeepOutWith(Clearance clearance)
    {
        var width = Math.Max(Width + (clearance.SideMargin * 2m), clearance.MinKeepOutWidth);
        var centre = StartX + (Width / 2m);

        return new KeepOut(
            Left: centre - (width / 2m),
            Right: centre + (width / 2m),
            Bottom: clearance.KeepOutFromFloorToY is null ? BottomY : 0m,
            Top: Math.Max(Top, clearance.KeepOutFromFloorToY ?? 0m));
    }
}
