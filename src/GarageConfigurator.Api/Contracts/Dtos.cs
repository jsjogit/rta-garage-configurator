namespace GarageConfigurator.Api.Contracts;

// Wire contracts. Deliberately separate from the Core records so the public JSON shape can stay
// stable while the domain evolves, and so enums cross the wire as readable strings.

public sealed record ObstructionDto(string Type, decimal StartX, decimal Width, decimal Height, decimal BottomY);

public sealed record WallDto(decimal Length, decimal Ceiling, ObstructionDto[]? Obstructions = null);

public sealed record PlacedItemDto(string Sku, decimal X, decimal Y, decimal Width, decimal Height, decimal Depth, string Zone);

public sealed record LayoutDto(PlacedItemDto[] Items, string? Label = null, string? ConfigId = null);

public sealed record LineItemDto(string Sku, int Quantity, decimal UnitList, decimal UnitPromo, decimal ExtendedList, decimal ExtendedPromo);

public sealed record PricedLayoutDto(LayoutDto Layout, LineItemDto[] LineItems, decimal SubtotalList, decimal SubtotalPromo);

public sealed record ViolationDto(string Code, string Message, string? Sku);

public sealed record NoticeDto(string Code, string Message);

public sealed record FailureDto(string Code, string Message);

public sealed record SolveRequest(WallDto Wall, string Goal);

public sealed record SolveResponse(PricedLayoutDto[] Layouts, FailureDto? Failure, NoticeDto[] Notices);

public sealed record ValidateRequest(LayoutDto Layout, WallDto Wall);

public sealed record ValidateResponse(ViolationDto[] Violations);

public sealed record PriceRequest(LayoutDto Layout);

public sealed record SaveDesignRequest(WallDto Wall, string Goal, LayoutDto Layout);

public sealed record SaveDesignResponse(string ConfigId);

public sealed record DesignResponse(string ConfigId, WallDto Wall, string Goal, PricedLayoutDto Design, string SavedAtUtc);

/// <summary>A request we could not make sense of. Surfaces as a 400 with this message.</summary>
public sealed class BadRequestException : Exception
{
    public BadRequestException(string message) : base(message)
    {
    }
}
