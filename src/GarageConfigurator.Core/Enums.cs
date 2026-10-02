namespace GarageConfigurator.Core;

/// <summary>Where an item lives in the vertical grammar. See docs/SOLVER_RULES.md.</summary>
public enum Zone
{
    Base,
    Counter,
    Wall,
    Tall,
    Filler
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
