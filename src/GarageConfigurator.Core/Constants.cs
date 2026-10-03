namespace GarageConfigurator.Core;

/// <summary>
/// Configurable defaults behind the rules in docs/SOLVER_RULES.md. The solver and validator read
/// these rather than inlining literals, so a rule change is a data change.
/// </summary>
public sealed record Constants(
    decimal BaseHeight,
    decimal CounterThickness,
    decimal WallCabinetBottomAboveCounter,
    decimal DatumTop,
    decimal DefaultCeiling,
    decimal MaxCounterOverhangPerSide,
    decimal PreferredCounterOverhangPerSide,
    decimal EndGapNeedsFillerAt,
    decimal EndGapPenaltyAt,
    decimal LegHeightMin,
    decimal LegHeightMax,
    decimal MinWallLength,
    decimal MaxCounterRunWidth,
    int MaxFillersPerEnd,
    int MaxFillersPerObstructionEdge,
    decimal MinCeiling,
    decimal MinCeilingForWallCabinets,
    decimal MinCeilingForTalls,
    decimal MinCeilingForStackedWall,
    IReadOnlyDictionary<ObstructionType, Clearance> ObstructionClearances)
{
    /// <summary>Clearance for a type, falling back to no margin when none is configured.</summary>
    public Clearance ClearanceFor(ObstructionType type) =>
        ObstructionClearances.TryGetValue(type, out var clearance) ? clearance : Clearance.None;

    /// <summary>Top of a finished counter run: base height plus counter thickness.</summary>
    public decimal CounterTop => BaseHeight + CounterThickness;
}
