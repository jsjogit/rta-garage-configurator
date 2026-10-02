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
    private readonly WallSolver _solver;
    private readonly LayoutValidator _validator;

    public GarageApi(Catalog catalog, IPriceSource prices, DesignService designs)
    {
        _catalog = catalog;
        _prices = prices;
        _designs = designs;
        _solver = new WallSolver(catalog);
        _validator = new LayoutValidator(catalog);
    }

    public SolveResponse Solve(SolveRequest request)
    {
        var wall = request.Wall.ToDomain();
        var goal = Mapping.ToGoal(request.Goal);
        var prices = _prices.Current();

        var result = _solver.Solve(wall, goal, prices);

        return new SolveResponse(
            result.Layouts.Select(layout => Pricing.Price(layout, prices).ToDto()).ToArray(),
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
