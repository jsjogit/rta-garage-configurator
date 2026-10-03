using GarageConfigurator.Core;

namespace GarageConfigurator.Api.Contracts;

/// <summary>Translates between the wire contracts and the Core domain, rejecting nonsense at the edge.</summary>
internal static class Mapping
{
    /// <summary>Set once at startup so incoming vendor "-SF" SKUs resolve to what we sell.</summary>
    internal static Catalog? Catalog { get; set; }

    private static string Canonical(string sku) => Catalog?.Resolve(sku) ?? sku;

    private static string NameOf(string sku)
    {
        if (Catalog is null) return sku;

        var canonical = Catalog.Resolve(sku);

        return Catalog.Cabinets.FirstOrDefault(c => c.Sku == canonical)?.Name
            ?? Catalog.Countertops.FirstOrDefault(c => c.Sku == canonical)?.Name
            ?? sku;
    }

    internal static Wall ToDomain(this WallDto dto)
    {
        if (dto.Length <= 0m)
        {
            throw new BadRequestException("wall.length must be greater than zero.");
        }

        if (dto.Ceiling <= 0m)
        {
            throw new BadRequestException("wall.ceiling must be greater than zero — ask the customer for it.");
        }

        var obstructions = (dto.Obstructions ?? Array.Empty<ObstructionDto>())
            .Select(o => new Obstruction(
                ParseEnum<ObstructionType>(o.Type, "obstruction.type"),
                o.StartX,
                o.Width,
                o.Height,
                o.BottomY))
            .ToList();

        foreach (var obstruction in obstructions.Where(o => o.StartX < 0m || o.Right > dto.Length))
        {
            throw new BadRequestException(
                $"Obstruction '{obstruction.Type}' runs from {obstruction.StartX}\" to {obstruction.Right}\", " +
                $"outside the {dto.Length}\" wall.");
        }

        return new Wall(dto.Length, dto.Ceiling, obstructions);
    }

    internal static WallDto ToDto(this Wall wall) => new(
        wall.Length,
        wall.Ceiling,
        wall.Obstructions
            .Select(o => new ObstructionDto(o.Type.ToString(), o.StartX, o.Width, o.Height, o.BottomY))
            .ToArray());

    internal static Layout ToDomain(this LayoutDto dto)
    {
        if (dto.Items is null || dto.Items.Length == 0)
        {
            throw new BadRequestException("layout.items must contain at least one cabinet.");
        }

        var items = dto.Items
            .Select(i => new PlacedItem(
                Canonical(i.Sku),
                i.X,
                i.Y,
                i.Width,
                i.Height,
                i.Depth,
                ParseEnum<Zone>(i.Zone, "item.zone")))
            .ToList();

        var tier = dto.Tier is null ? Core.Tier.Standard : ParseEnum<Tier>(dto.Tier, "layout.tier");

        return new Layout(items, dto.Label, dto.ConfigId, tier);
    }

    internal static LayoutDto ToDto(this Layout layout) => new(
        layout.Items
            .Select(i => new PlacedItemDto(i.Sku, i.X, i.Y, i.Width, i.Height, i.Depth, i.Zone.ToString()))
            .ToArray(),
        layout.Label,
        layout.ConfigId,
        layout.Tier.ToString());

    internal static PricedLayoutDto ToDto(this PricedLayout priced) => new(
        priced.Layout.ToDto(),
        priced.LineItems
            .Select(i => new LineItemDto(
                i.Sku,
                NameOf(i.Sku),
                i.Quantity,
                i.UnitList,
                i.UnitPromo,
                i.ExtendedList,
                i.ExtendedPromo))
            .ToArray(),
        priced.SubtotalList,
        priced.SubtotalPromo);

    internal static Goal ToGoal(string goal) => ParseEnum<Goal>(goal, "goal");

    private static T ParseEnum<T>(string value, string field) where T : struct, Enum =>
        Enum.TryParse<T>(value, ignoreCase: true, out var parsed)
            ? parsed
            : throw new BadRequestException(
                $"'{value}' is not a valid {field}. Expected one of: {string.Join(", ", Enum.GetNames<T>())}.");
}
