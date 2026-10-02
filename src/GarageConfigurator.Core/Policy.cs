namespace GarageConfigurator.Core;

/// <summary>
/// One way of filling a wall for a goal. Several policies per goal give the solver genuinely
/// different layouts to rank, rather than three near-identical walls.
/// </summary>
internal sealed record Policy(
    string Name,
    int MaxTalls,
    bool PreferDrawers = false,
    bool PreferFullDoors = false,
    bool WantCounter = false,
    bool StackWallCabinets = false);

internal static class Policies
{
    internal static IReadOnlyList<Policy> For(Goal goal, bool tallsAllowed)
    {
        var policies = goal switch
        {
            Goal.Workbench => new[]
            {
                new Policy("workbench with towers", MaxTalls: 2, PreferDrawers: true, WantCounter: true),
                new Policy("long workbench", MaxTalls: 1, PreferDrawers: true, WantCounter: true),
                new Policy("bench and boxes", MaxTalls: 0, PreferDrawers: true, WantCounter: true)
            },
            Goal.Storage => new[]
            {
                new Policy("wall of towers", MaxTalls: 6, StackWallCabinets: true),
                new Policy("towers and uppers", MaxTalls: 4, StackWallCabinets: true),
                new Policy("towers with a counter", MaxTalls: 3, WantCounter: true, StackWallCabinets: true)
            },
            Goal.HideTheMess => new[]
            {
                new Policy("closed wall", MaxTalls: 6, PreferFullDoors: true),
                new Policy("closed wall with bench", MaxTalls: 3, PreferFullDoors: true, WantCounter: true),
                new Policy("full-height doors", MaxTalls: 0, PreferFullDoors: true)
            },
            _ => new[]
            {
                new Policy("flanked workbench", MaxTalls: 2, PreferDrawers: true, WantCounter: true),
                new Policy("one tower", MaxTalls: 1, PreferDrawers: true, WantCounter: true),
                new Policy("open bench", MaxTalls: 0, WantCounter: true)
            }
        };

        return tallsAllowed
            ? policies
            : policies.Select(p => p with { MaxTalls = 0, StackWallCabinets = false }).ToList();
    }
}
