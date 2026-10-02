namespace GarageConfigurator.Core;

/// <summary>The single finish / door style / pull the whole garage line shares.</summary>
public sealed record Line(string Name, string Finish, string DoorStyle, string Pulls);
