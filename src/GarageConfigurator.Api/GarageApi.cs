using GarageConfigurator.Api.Contracts;
using GarageConfigurator.Api.Services;
using GarageConfigurator.Core;

namespace GarageConfigurator.Api;

/// <summary>
/// Everything the HTTP layer can do, with no dependency on Functions or HTTP. The Function classes
/// are thin wrappers over this, which is what makes the API testable without a host.
/// </summary>
public sealed class GarageApi
{
    private readonly Catalog _catalog;
    private readonly IPriceSource _prices;
    private readonly DesignService _designs;
    private readonly ProductIdMap _productIds;
    private readonly ILeadStore _leads;
    private readonly WallSolver _solver;
    private readonly LayoutValidator _validator;

    public GarageApi(
        Catalog catalog,
        IPriceSource prices,
        DesignService designs,
        ProductIdMap? productIds = null,
        ILeadStore? leads = null)
    {
        _leads = leads ?? new InMemoryLeadStore();
        _catalog = catalog;
        _prices = prices;
        _designs = designs;
        _productIds = productIds ?? ProductIdMap.Empty;
        _solver = new WallSolver(catalog);
        _validator = new LayoutValidator(catalog);
        Mapping.Catalog = catalog;
    }

    public SolveResponse Solve(SolveRequest request)
    {
        var wall = request.Wall.ToDomain();
        var goal = Mapping.ToGoal(request.Goal);
        var prices = _prices.Current();

        var result = _solver.Solve(wall, goal, prices);

        return new SolveResponse(
            result.Options.Select(option => new LayoutOptionDto(
                option.Label,
                Pricing.Price(option.Standard, prices).ToDto(),
                Pricing.Price(option.Premiere, prices).ToDto())).ToArray(),
            result.Failure is null ? null : new FailureDto(result.Failure.Code.ToString(), result.Failure.Message),
            result.Notices.Select(n => new NoticeDto(n.Code.ToString(), n.Message)).ToArray());
    }

    public ValidateResponse Validate(ValidateRequest request)
    {
        var violations = _validator.Validate(request.Layout.ToDomain(), request.Wall.ToDomain());

        return new ValidateResponse(
            violations.Select(v => new ViolationDto(v.Code.ToString(), v.Message, v.Sku)).ToArray());
    }

    public PricedLayoutDto Price(PriceRequest request) =>
        Pricing.Price(request.Layout.ToDomain(), _prices.Current()).ToDto();

    /// <summary>Alternatives for one cabinet: same zone, same width, so the wall still adds up.</summary>
    public SwapsResponse Swaps(string sku)
    {
        var canonical = _catalog.Resolve(sku);
        var cabinet = _catalog.Cabinets.FirstOrDefault(c => c.Sku == canonical)
            ?? throw new BadRequestException($"'{sku}' is not a cabinet we carry.");

        var placed = new PlacedItem(cabinet.Sku, 0m, 0m, cabinet.Width, cabinet.Height, cabinet.Depth, cabinet.Zone);

        return new SwapsResponse(
            cabinet.Sku,
            SwapOptions.For(_catalog, placed)
                .Select(o => new SwapOptionDto(o.Sku, o.Name, o.Zone.ToString(), o.Width, o.Height, o.Depth))
                .ToArray());
    }

    private static readonly string[] LeadKinds = { "EmailMe", "DesignerHelp" };

    /// <summary>Someone asking for the design by email, or for a designer to take it over.</summary>
    public async Task<LeadResponse> CaptureLeadAsync(LeadRequest request, CancellationToken cancellationToken = default)
    {
        if (!LeadKinds.Contains(request.Kind, StringComparer.Ordinal))
        {
            throw new BadRequestException(
                $"'{request.Kind}' is not a lead kind. Expected one of: {string.Join(", ", LeadKinds)}.");
        }

        if (!LooksLikeAnEmail(request.Email))
        {
            throw new BadRequestException("That email address doesn't look right — check it and try again.");
        }

        await _leads.SaveAsync(
            new Lead(
                Guid.NewGuid().ToString("n"),
                request.Kind,
                request.Email.Trim(),
                request.ConfigId,
                request.Name,
                request.Message,
                DateTimeOffset.UtcNow),
            cancellationToken);

        return new LeadResponse(true);
    }

    /// <summary>A dot after an @, with something either side. Deliberately loose — the point is to
    /// catch a typo, not to adjudicate RFC 5322.</summary>
    private static bool LooksLikeAnEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;

        var parts = email.Trim().Split('@');

        return parts.Length == 2
            && parts[0].Length > 0
            && parts[1].Contains('.', StringComparison.Ordinal)
            && !parts[1].StartsWith('.')
            && !parts[1].EndsWith('.');
    }

    /// <summary>
    /// Turns a layout into the exact sequence of add-to-cart posts the storefront should make.
    /// If any SKU has no product id the hand-off is not ready and carries no requests at all —
    /// a half-added wall is worse than a wall that did not go in.
    /// </summary>
    public CartHandoffDto BuildCart(CartRequestDto request)
    {
        var layout = request.Layout.ToDomain();

        var lines = layout.LineItems
            .Select(item => (item.Sku, item.Quantity, Found: _productIds.TryGet(item.Sku, out var id), ProductId: id))
            .ToList();

        var unmapped = lines.Where(l => !l.Found).Select(l => l.Sku).ToArray();
        var ready = unmapped.Length == 0;

        return new CartHandoffDto(
            request.ConfigId,
            lines.Select(l => new CartLineDto(l.Sku, l.Quantity, l.Found ? l.ProductId : 0)).ToArray(),
            ready,
            unmapped,
            ready
                ? lines.Select(l => new CartRequestStep(
                    $"/addproducttocart/catalog/{l.ProductId}/1/{l.Quantity}", "POST")).ToArray()
                : Array.Empty<CartRequestStep>(),
            CartUrl,
            StoreOrigin);
    }

    /// <summary>Where the customer lands once the lines are in. Supplied by RTA.</summary>
    public const string CartUrl = "https://www.rtacabinetstore.com/cart";

    /// <summary>The storefront origin the add-to-cart posts have to come from.</summary>
    public const string StoreOrigin = "https://www.rtacabinetstore.com";

    public async Task<SaveDesignResponse> SaveDesignAsync(SaveDesignRequest request, CancellationToken cancellationToken = default)
    {
        // Round-trip through the domain so we never persist a design we would refuse to read back.
        var wall = request.Wall.ToDomain();
        var layout = request.Layout.ToDomain();
        Mapping.ToGoal(request.Goal);

        var configId = await _designs.SaveAsync(wall.ToDto(), request.Goal, layout.ToDto(), cancellationToken);

        return new SaveDesignResponse(configId);
    }

    public async Task<DesignResponse?> GetDesignAsync(string configId, CancellationToken cancellationToken = default)
    {
        var stored = await _designs.GetAsync<WallDto, LayoutDto>(configId, cancellationToken);

        if (stored is null)
        {
            return null;
        }

        var (wall, goal, layout, savedAt) = stored.Value;

        // Reprice on read: money comes from nopCommerce at request time, never from the stored copy.
        var priced = Pricing.Price(layout.ToDomain(), _prices.Current());

        return new DesignResponse(configId, wall, goal, priced.ToDto(), savedAt.UtcDateTime.ToString("O"));
    }

    internal Catalog Catalog => _catalog;
}
