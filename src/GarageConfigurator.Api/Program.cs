using GarageConfigurator.Api;
using GarageConfigurator.Api.Services;
using Azure.Data.Tables;
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

        // SKU -> nopCommerce product id. Empty until RTA supplies it; the cart hand-off refuses
        // rather than adding part of a wall. See docs/DECISIONS.md.
        var productIdsPath = Path.Combine(AppContext.BaseDirectory, "data", "nop-product-ids.json");

        services.AddSingleton(File.Exists(productIdsPath)
            ? ProductIdMap.FromJson(File.ReadAllText(productIdsPath))
            : ProductIdMap.Empty);

        services.AddSingleton<ILeadStore>(_ =>
        {
            var connection = Environment.GetEnvironmentVariable("DesignStorageConnection");

            if (string.IsNullOrWhiteSpace(connection))
            {
                return new InMemoryLeadStore();
            }

            var table = new TableClient(connection, "leads");
            table.CreateIfNotExists();

            return new TableLeadStore(table);
        });

        services.AddSingleton(provider => new DesignService(
            provider.GetRequiredService<IDesignStore>(),
            Random.Shared));

        services.AddSingleton<GarageApi>();
    })
    .Build();

host.Run();
