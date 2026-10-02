using GarageConfigurator.Api;
using GarageConfigurator.Api.Services;
using GarageConfigurator.Core;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication()
    .ConfigureServices(services =>
    {
        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();

        // The catalog is a deployed data file: Core parses the text, the host does the reading.
        var catalogJson = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "data", "catalog.json"));

        services.AddSingleton(CatalogLoader.FromJson(catalogJson));
        services.AddSingleton<IPriceSource>(new SeedPriceSource(catalogJson));

        services.AddSingleton<IDesignStore>(_ => DesignStoreFactory.Create(
            Environment.GetEnvironmentVariable("DesignStorageConnection"),
            Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT")));

        services.AddSingleton(provider => new DesignService(
            provider.GetRequiredService<IDesignStore>(),
            Random.Shared));

        services.AddSingleton<GarageApi>();
    })
    .Build();

host.Run();
