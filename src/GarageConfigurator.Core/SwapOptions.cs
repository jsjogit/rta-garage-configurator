namespace GarageConfigurator.Core;

/// <summary>What a customer may put in a cabinet's place without the rest of the wall moving.</summary>
public sealed record SwapOption(string Sku, string Name, Zone Zone, decimal Width, decimal Height, decimal Depth);

public static class SwapOptions
{
    /// <summary>
    /// Same zone, same width — anything else and the wall stops adding up. A base of knee-space width
    /// can also be opened up, and a knee space filled back in, since that is a swap in every sense
    /// except that one side of it is not a product.
    /// </summary>
    public static IReadOnlyList<SwapOption> For(Catalog catalog, PlacedItem item)
    {
        if (item.Zone is Zone.Counter or Zone.Filler)
        {
            return Array.Empty<SwapOption>();
        }

        var options = new List<SwapOption>();

        if (item.Zone != Zone.KneeSpace)
        {
            options.AddRange(catalog.Cabinets
                .Where(c => c.Zone == item.Zone && c.Width == item.Width && c.Sku != item.Sku)
                .Select(c => new SwapOption(c.Sku, c.Name, c.Zone, c.Width, c.Height, c.Depth)));
        }

        var kneeWidth = item.Width is 24m or 30m;

        if (item.Zone == Zone.Base && kneeWidth)
        {
            options.Add(new SwapOption(
                string.Empty,
                "Open knee space",
                Zone.KneeSpace,
                item.Width,
                item.Height,
                item.Depth));
        }

        if (item.Zone == Zone.KneeSpace)
        {
            options.AddRange(catalog.Cabinets
                .Where(c => c.Zone == Zone.Base && c.Width == item.Width)
                .Select(c => new SwapOption(c.Sku, c.Name, c.Zone, c.Width, c.Height, c.Depth)));
        }

        return options;
    }
}
