namespace GarageConfigurator.Api.Contracts;

// Wire contracts. Deliberately separate from the Core records so the public JSON shape can stay
// stable while the domain evolves, and so enums cross the wire as readable strings.

public sealed record ObstructionDto(string Type, decimal StartX, decimal Width, decimal Height, decimal BottomY);

public sealed record WallDto(decimal Length, decimal Ceiling, ObstructionDto[]? Obstructions = null);

public sealed record PlacedItemDto(string Sku, decimal X, decimal Y, decimal Width, decimal Height, decimal Depth, string Zone);

public sealed record LayoutDto(PlacedItemDto[] Items, string? Label = null, string? ConfigId = null, string? Tier = null);

public sealed record LineItemDto(string Sku, int Quantity, decimal UnitList, decimal UnitPromo, decimal ExtendedList, decimal ExtendedPromo);

public sealed record PricedLayoutDto(LayoutDto Layout, LineItemDto[] LineItems, decimal SubtotalList, decimal SubtotalPromo);

public sealed record ViolationDto(string Code, string Message, string? Sku);

public sealed record NoticeDto(string Code, string Message);

public sealed record FailureDto(string Code, string Message);

public sealed record SolveRequest(WallDto Wall, string Goal);

public sealed record LayoutOptionDto(string Label, PricedLayoutDto Standard, PricedLayoutDto Premiere);

public sealed record SolveResponse(LayoutOptionDto[] Options, FailureDto? Failure, NoticeDto[] Notices);

public sealed record ValidateRequest(LayoutDto Layout, WallDto Wall);

public sealed record ValidateResponse(ViolationDto[] Violations);

public sealed record PriceRequest(LayoutDto Layout);

public sealed record SwapOptionDto(string Sku, string Name, string Zone, decimal Width, decimal Height, decimal Depth);

public sealed record SwapsResponse(string Sku, SwapOptionDto[] Options);

public sealed record LeadRequest(string Kind, string Email, string? ConfigId, string? Name, string? Message);

public sealed record LeadResponse(bool Received);

public sealed record FunnelEvent(string Name, string? ConfigId, Dictionary<string, string>? Properties);

public sealed record CartRequestDto(LayoutDto Layout, string? ConfigId = null);

public sealed record CartLineDto(string Sku, int Quantity, int ProductId);

/// <summary>What the storefront should post, in order, to put this wall in the cart.</summary>
public sealed record CartRequestStep(string Url, string Method);

public sealed record CartHandoffDto(
    string? ConfigId,
    CartLineDto[] Lines,
    bool Ready,
    string[] UnmappedSkus,
    CartRequestStep[] Requests,
    string CartUrl);

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
