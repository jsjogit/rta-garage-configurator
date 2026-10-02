using System.Text.Json;
using Azure;
using Azure.Data.Tables;

namespace GarageConfigurator.Api.Services;

/// <summary>A saved design, stored as JSON so the stored shape does not pin the domain model.</summary>
public sealed record StoredDesign(string ConfigId, string WallJson, string Goal, string LayoutJson, DateTimeOffset SavedAtUtc);

public interface IDesignStore
{
    Task<StoredDesign?> GetAsync(string configId, CancellationToken cancellationToken = default);

    /// <summary>Returns false when the id is already taken, so the caller can draw another.</summary>
    Task<bool> TrySaveAsync(StoredDesign design, CancellationToken cancellationToken = default);
}

/// <summary>For tests and local runs without Azurite.</summary>
public sealed class InMemoryDesignStore : IDesignStore
{
    private readonly Dictionary<string, StoredDesign> _designs = new(StringComparer.Ordinal);

    public Task<StoredDesign?> GetAsync(string configId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_designs.TryGetValue(configId, out var design) ? design : null);

    public Task<bool> TrySaveAsync(StoredDesign design, CancellationToken cancellationToken = default)
    {
        lock (_designs)
        {
            return Task.FromResult(_designs.TryAdd(design.ConfigId, design));
        }
    }
}

/// <summary>Azure Table Storage — Azurite locally, a storage account in Azure.</summary>
public sealed class TableDesignStore : IDesignStore
{
    private const string PartitionKey = "design";

    private readonly TableClient _table;

    public TableDesignStore(TableClient table) => _table = table;

    public async Task<StoredDesign?> GetAsync(string configId, CancellationToken cancellationToken = default)
    {
        try
        {
            var entity = await _table.GetEntityAsync<TableEntity>(PartitionKey, configId, cancellationToken: cancellationToken);

            return new StoredDesign(
                configId,
                entity.Value.GetString("WallJson"),
                entity.Value.GetString("Goal"),
                entity.Value.GetString("LayoutJson"),
                entity.Value.GetDateTimeOffset("SavedAtUtc") ?? DateTimeOffset.UtcNow);
        }
        catch (RequestFailedException failure) when (failure.Status == 404)
        {
            return null;
        }
    }

    public async Task<bool> TrySaveAsync(StoredDesign design, CancellationToken cancellationToken = default)
    {
        var entity = new TableEntity(PartitionKey, design.ConfigId)
        {
            ["WallJson"] = design.WallJson,
            ["Goal"] = design.Goal,
            ["LayoutJson"] = design.LayoutJson,
            ["SavedAtUtc"] = design.SavedAtUtc
        };

        try
        {
            // AddEntity fails rather than overwriting, which is what makes id collisions safe.
            await _table.AddEntityAsync(entity, cancellationToken);
            return true;
        }
        catch (RequestFailedException failure) when (failure.Status == 409)
        {
            return false;
        }
    }
}

/// <summary>
/// Chooses where designs live. In-memory is fine for a local run; in a deployed environment it would
/// hand customers share links that vanish on the next restart, so we refuse to start instead.
/// </summary>
public static class DesignStoreFactory
{
    public static IDesignStore Create(string? connection, string? environment)
    {
        if (!string.IsNullOrWhiteSpace(connection))
        {
            var table = new TableClient(connection, "designs");
            table.CreateIfNotExists();

            return new TableDesignStore(table);
        }

        if (!string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "DesignStorageConnection is not set. Saved designs would be lost on restart, " +
                "breaking every share link. Point it at the storage account (or Azurite locally).");
        }

        return new InMemoryDesignStore();
    }
}

/// <summary>Issues config ids and persists designs, redrawing the id when one is already taken.</summary>
public sealed class DesignService
{
    private const int MaxIdAttempts = 8;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly IDesignStore _store;
    private readonly Random _random;

    public DesignService(IDesignStore store, Random random)
    {
        _store = store;
        _random = random;
    }

    public async Task<string> SaveAsync<TWall, TLayout>(
        TWall wall,
        string goal,
        TLayout layout,
        CancellationToken cancellationToken = default)
    {
        var design = new StoredDesign(
            string.Empty,
            JsonSerializer.Serialize(wall, Json),
            goal,
            JsonSerializer.Serialize(layout, Json),
            DateTimeOffset.UtcNow);

        for (var attempt = 0; attempt < MaxIdAttempts; attempt++)
        {
            var configId = Core.ConfigId.New(_random);

            if (await _store.TrySaveAsync(design with { ConfigId = configId }, cancellationToken))
            {
                return configId;
            }
        }

        throw new InvalidOperationException(
            $"Could not find an unused config id in {MaxIdAttempts} attempts.");
    }

    public async Task<(TWall Wall, string Goal, TLayout Layout, DateTimeOffset SavedAtUtc)?> GetAsync<TWall, TLayout>(
        string configId,
        CancellationToken cancellationToken = default)
    {
        var stored = await _store.GetAsync(configId, cancellationToken);

        if (stored is null)
        {
            return null;
        }

        return (
            JsonSerializer.Deserialize<TWall>(stored.WallJson, Json)!,
            stored.Goal,
            JsonSerializer.Deserialize<TLayout>(stored.LayoutJson, Json)!,
            stored.SavedAtUtc);
    }
}
