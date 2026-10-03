using Azure;
using Azure.Data.Tables;

namespace GarageConfigurator.Api.Services;

/// <summary>Someone asking to be emailed a design, or for a designer to pick it up.</summary>
public sealed record Lead(
    string Id,
    string Kind,
    string Email,
    string? ConfigId,
    string? Name,
    string? Message,
    DateTimeOffset ReceivedAtUtc);

public interface ILeadStore
{
    Task SaveAsync(Lead lead, CancellationToken cancellationToken = default);
}

public sealed class InMemoryLeadStore : ILeadStore
{
    private readonly List<Lead> _leads = new();

    public Task SaveAsync(Lead lead, CancellationToken cancellationToken = default)
    {
        lock (_leads)
        {
            _leads.Add(lead);
        }

        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<Lead>> AllAsync()
    {
        lock (_leads)
        {
            return Task.FromResult<IReadOnlyList<Lead>>(_leads.ToList());
        }
    }
}

public sealed class TableLeadStore : ILeadStore
{
    private readonly TableClient _table;

    public TableLeadStore(TableClient table) => _table = table;

    public async Task SaveAsync(Lead lead, CancellationToken cancellationToken = default)
    {
        var entity = new TableEntity(lead.Kind, lead.Id)
        {
            ["Email"] = lead.Email,
            ["ConfigId"] = lead.ConfigId,
            ["Name"] = lead.Name,
            ["Message"] = lead.Message,
            ["ReceivedAtUtc"] = lead.ReceivedAtUtc,
        };

        try
        {
            await _table.AddEntityAsync(entity, cancellationToken);
        }
        catch (RequestFailedException failure) when (failure.Status == 409)
        {
            // Same lead submitted twice; the first one is already recorded.
        }
    }
}
