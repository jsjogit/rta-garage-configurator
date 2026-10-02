namespace GarageConfigurator.Core;

/// <summary>A broken rule, with copy a customer can read.</summary>
public sealed record Violation(ViolationCode Code, string Message, string? Sku = null);

/// <summary>One code per rule in docs/SOLVER_RULES.md.</summary>
public enum ViolationCode
{
    // Vertical grammar
    BaseNotOnFloor,
    TallNotOnFloor,
    CounterAtWrongHeight,
    WallCabinetAtWrongHeight,
    StackedWallNeedsTallerCeiling,
    ItemAboveTall,
    ItemExceedsCeiling,
    CeilingTooLowForItem,

    // Horizontal grammar
    GapBetweenCabinets,
    ItemsOverlap,
    ItemOutsideWall,
    EndGapNeedsFiller,
    FillerBetweenCabinets,
    TooManyFillers,

    // Counter rules
    CounterNotOverBases,
    CounterTooShortForRun,
    CounterOverhangTooDeep,
    CounterOverlapsTall,
    CounterRunTooLong,
    CountersJoinedEndToEnd,

    // Obstructions
    ItemOverlapsObstruction
}
