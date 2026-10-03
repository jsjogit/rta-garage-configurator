namespace GarageConfigurator.Core;

/// <summary>
/// One way of filling a wall for a goal. Several policies per goal give the solver genuinely
/// different footprints to rank. Base SKUs are not a policy concern — that is the tier's job.
/// </summary>
internal sealed record Policy(
    string Name,
    int MaxTalls,
    bool WantCounter = false,
    bool WantKneeSpace = false,
    bool StackWallCabinets = false);

internal static class Policies
{
    internal static IReadOnlyList<Policy> For(Goal goal, bool tallsAllowed, bool wallCabinetsAllowed)
    {
        var policies = goal switch
        {
            Goal.Workbench => new[]
            {
                new Policy("workbench with towers", MaxTalls: 2, WantCounter: true, WantKneeSpace: true),
                new Policy("long workbench", MaxTalls: 1, WantCounter: true, WantKneeSpace: true),
                new Policy("bench and boxes", MaxTalls: 0, WantCounter: true, WantKneeSpace: true)
            },
            Goal.Storage => new[]
            {
                // Storage never gives up wall length to a knee space.
                new Policy("wall of towers", MaxTalls: 6, StackWallCabinets: true),
                new Policy("towers and uppers", MaxTalls: 4, StackWallCabinets: true),
                new Policy("towers with a counter", MaxTalls: 3, WantCounter: true, StackWallCabinets: true)
            },
            Goal.HideTheMess => new[]
            {
                new Policy("closed wall", MaxTalls: 6),
                new Policy("closed wall with bench", MaxTalls: 3, WantCounter: true),
                new Policy("doors end to end", MaxTalls: 0)
            },
            _ => new[]
            {
                new Policy("flanked workbench", MaxTalls: 2, WantCounter: true, WantKneeSpace: true),
                new Policy("one tower", MaxTalls: 1, WantCounter: true, WantKneeSpace: true),
                new Policy("open bench", MaxTalls: 0, WantCounter: true)
            }
        };

        return policies
            .Select(p => p with
            {
                MaxTalls = tallsAllowed ? p.MaxTalls : 0,
                StackWallCabinets = p.StackWallCabinets && wallCabinetsAllowed
            })
            .ToList();
    }
}
