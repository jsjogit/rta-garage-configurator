namespace GarageConfigurator.Core;

/// <summary>
/// The wall being solved. Ceiling is required rather than defaulted: assuming 96" on an older 84"
/// garage quotes talls that do not fit (see docs/DECISIONS.md 2026-10-02).
/// </summary>
public sealed record Wall(
    decimal Length,
    decimal Ceiling,
    IReadOnlyList<Obstruction>? Obstructions = null)
{
    public IReadOnlyList<Obstruction> Obstructions { get; } = Obstructions ?? Array.Empty<Obstruction>();
}
