namespace GarageConfigurator.Core;

/// <summary>Where an item lives in the vertical grammar. See docs/SOLVER_RULES.md.</summary>
public enum Zone
{
    Base,
    Counter,
    Wall,
    Tall,
    Filler,

    /// <summary>An open gap in a counter run where someone can sit. Not a product: no SKU, no price.</summary>
    KneeSpace
}

/// <summary>
/// Two price points over one footprint. Only the base cabinets differ.
/// </summary>
public enum Tier
{
    Standard,
    Premiere
}

public enum CabinetType
{
    Door,
    Drawer,
    FullDoor,
    WastePull,
    Pantry,
    Filler
}

public enum ObstructionType
{
    ElectricalPanel,
    WaterHeater,
    Window,
    SideDoor,
    GarageDoorTrack,
    Outlet
}

public enum Goal
{
    Workbench,
    Storage,
    HideTheMess,
    Balanced
}
