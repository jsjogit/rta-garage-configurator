namespace GarageConfigurator.Core;

/// <summary>
/// What the solver returns: up to three ranked layouts, or none plus a reason the customer can read.
/// </summary>
public sealed record SolveResult(
    IReadOnlyList<LayoutOption> Options,
    SolveFailure? Failure = null,
    IReadOnlyList<Notice>? Notices = null)
{
    public IReadOnlyList<Notice> Notices { get; } = Notices ?? Array.Empty<Notice>();

    internal static SolveResult Failed(SolveReason code, string message) =>
        new(Array.Empty<LayoutOption>(), new SolveFailure(code, message));
}

/// <summary>
/// One footprint at two price points. Standard and Premiere place the same boxes in the same places;
/// only the base cabinets, and therefore the price, differ.
/// </summary>
public sealed record LayoutOption(string Label, Layout Standard, Layout Premiere)
{
    public IReadOnlyList<Layout> Tiers => new[] { Standard, Premiere };
}

/// <summary>Why no layout came back.</summary>
public sealed record SolveFailure(SolveReason Code, string Message);

public enum SolveReason
{
    WallTooShort,
    CeilingTooLow,
    NoLayoutFits
}

/// <summary>Something the customer should know about a layout we *did* return.</summary>
public sealed record Notice(NoticeCode Code, string Message);

public enum NoticeCode
{
    TallsExcludedLowCeiling
}
