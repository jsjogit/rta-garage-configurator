namespace GarageConfigurator.Core;

/// <summary>
/// How far an obstruction's keep-out rectangle extends beyond the obstruction itself.
/// See docs/SOLVER_RULES.md "Horizontal grammar" and catalog.json constants.obstructionClearance.
/// </summary>
/// <param name="SideMargin">Extra inches cleared on each side.</param>
/// <param name="MinKeepOutWidth">Minimum total keep-out width, centred on the obstruction.</param>
/// <param name="KeepOutFromFloorToY">
/// When set, the keep-out runs from the floor up to this height regardless of where the obstruction
/// itself sits — this is what stops a base cabinet being placed under a wall-mounted electrical panel.
/// </param>
public sealed record Clearance(
    decimal SideMargin = 0m,
    decimal MinKeepOutWidth = 0m,
    decimal? KeepOutFromFloorToY = null)
{
    public static readonly Clearance None = new();
}
