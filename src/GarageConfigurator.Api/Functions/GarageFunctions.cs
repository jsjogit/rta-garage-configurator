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
