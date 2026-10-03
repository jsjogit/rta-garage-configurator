using GarageConfigurator.Api.Contracts;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace GarageConfigurator.Api.Functions;

/// <summary>
/// HTTP surface. Every method is a thin wrapper: parse, call <see cref="GarageApi"/>, shape the
/// response. All the behaviour worth testing lives behind it, so these need no host to verify.
/// </summary>
public sealed class GarageFunctions
{
    private readonly GarageApi _api;
    private readonly ILogger<GarageFunctions> _log;

    public GarageFunctions(GarageApi api, ILogger<GarageFunctions> log)
    {
        _api = api;
        _log = log;
    }

    [Function("solve")]
    public Task<IActionResult> Solve(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "solve")] HttpRequest request) =>
        Handle(request, async () => new OkObjectResult(_api.Solve(await Read<SolveRequest>(request))));

    [Function("validate")]
    public Task<IActionResult> Validate(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "validate")] HttpRequest request) =>
        Handle(request, async () => new OkObjectResult(_api.Validate(await Read<ValidateRequest>(request))));

    [Function("price")]
    public Task<IActionResult> Price(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "price")] HttpRequest request) =>
        Handle(request, async () => new OkObjectResult(_api.Price(await Read<PriceRequest>(request))));

    [Function("saveDesign")]
    public Task<IActionResult> SaveDesign(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "design")] HttpRequest request) =>
        Handle(request, async () =>
            new OkObjectResult(await _api.SaveDesignAsync(await Read<SaveDesignRequest>(request), request.HttpContext.RequestAborted)));

    [Function("getDesign")]
    public Task<IActionResult> GetDesign(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "design/{configId}")] HttpRequest request,
        string configId) =>
        Handle(request, async () =>
        {
            var design = await _api.GetDesignAsync(configId, request.HttpContext.RequestAborted);

            return design is null
                ? new NotFoundObjectResult(new { message = $"No design found for '{configId}'." })
                : new OkObjectResult(design);
        });

    [Function("swaps")]
    public Task<IActionResult> Swaps(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "swaps/{sku}")] HttpRequest request,
        string sku) =>
        Handle(request, () => Task.FromResult<IActionResult>(new OkObjectResult(_api.Swaps(sku))));

    [Function("cart")]
    public Task<IActionResult> Cart(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "cart")] HttpRequest request) =>
        Handle(request, async () => new OkObjectResult(_api.BuildCart(await Read<CartRequestDto>(request))));

    [Function("lead")]
    public Task<IActionResult> Lead(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "lead")] HttpRequest request) =>
        Handle(request, async () => new OkObjectResult(
            await _api.CaptureLeadAsync(await Read<LeadRequest>(request), request.HttpContext.RequestAborted)));

    /// <summary>
    /// The funnel in SPEC.md. The browser posts each step here and it lands in App Insights as a
    /// custom event, so the funnel is queryable next to the API's own telemetry.
    /// </summary>
    [Function("events")]
    public Task<IActionResult> Events(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "events")] HttpRequest request) =>
        Handle(request, async () =>
        {
            var funnelEvent = await Read<FunnelEvent>(request);

            if (string.IsNullOrWhiteSpace(funnelEvent.Name))
            {
                throw new BadRequestException("An event needs a name.");
            }

            _log.LogInformation(
                "ai_funnel {EventName} config={ConfigId} props={Properties}",
                funnelEvent.Name,
                funnelEvent.ConfigId ?? "-",
                funnelEvent.Properties is null ? "{}" : string.Join(";", funnelEvent.Properties.Select(p => $"{p.Key}={p.Value}")));

            return new AcceptedResult();
        });

    [Function("openapi")]
    public async Task<IActionResult> OpenApi(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "openapi.yaml")] HttpRequest request)
    {
        _ = request;
        var path = Path.Combine(AppContext.BaseDirectory, "openapi.yaml");

        return new ContentResult
        {
            Content = await File.ReadAllTextAsync(path),
            ContentType = "application/yaml",
            StatusCode = StatusCodes.Status200OK
        };
    }

    private async Task<IActionResult> Handle(HttpRequest request, Func<Task<IActionResult>> handler)
    {
        try
        {
            return await handler();
        }
        catch (BadRequestException bad)
        {
            _log.LogInformation("Rejected {Path}: {Reason}", request.Path, bad.Message);
            return new BadRequestObjectResult(new { message = bad.Message });
        }
        catch (KeyNotFoundException missing)
        {
            // An unknown SKU reached pricing — a client sent something not in the catalogue.
            _log.LogWarning("Unknown SKU on {Path}: {Reason}", request.Path, missing.Message);
            return new BadRequestObjectResult(new { message = missing.Message });
        }
    }

    private static async Task<T> Read<T>(HttpRequest request)
    {
        try
        {
            return await request.ReadFromJsonAsync<T>()
                ?? throw new BadRequestException("A JSON body is required.");
        }
        catch (System.Text.Json.JsonException json)
        {
            throw new BadRequestException($"The request body is not valid JSON: {json.Message}");
        }
    }
}
