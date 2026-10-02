namespace GarageConfigurator.Core;

/// <summary>
/// What the solver returns: up to three ranked layouts, or none plus a reason the customer can read.
/// </summary>
public sealed record SolveResult(
    IReadOnlyList<Layout> Layouts,
    SolveFailure? Failure = null,
    IReadOnlyList<Notice>? Notices = null)
{
    public IReadOnlyList<Notice> Notices { get; } = Notices ?? Array.Empty<Notice>();

    internal static SolveResult Failed(SolveReason code, string message) =>
        new(Array.Empty<Layout>(), new SolveFailure(code, message));
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
