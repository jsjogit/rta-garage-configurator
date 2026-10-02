using System.Reflection;
using System.Xml.Linq;
using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

/// <summary>
/// CLAUDE.md: Core must stay free of Azure/ASP.NET/EF so it can be referenced from the nopCommerce
/// solution later, and must add no dependencies without a note in DECISIONS.md.
/// We inspect the project file rather than the compiled assembly: an unused PackageReference is
/// trimmed out of assembly metadata, so GetReferencedAssemblies() would not catch it.
/// </summary>
public class CorePurityTests
{
    private static readonly string[] DeclaredPackages = LoadDeclaredPackages();

    private static string[] LoadDeclaredPackages()
    {
        var csproj = XDocument.Load(Path.Combine(AppContext.BaseDirectory, "GarageConfigurator.Core.csproj.txt"));

        return csproj.Descendants("PackageReference")
            .Select(e => e.Attribute("Include")?.Value ?? string.Empty)
            .ToArray();
    }

    [Theory]
    [InlineData("Azure")]
    [InlineData("Microsoft.Azure")]
    [InlineData("Microsoft.AspNetCore")]
    [InlineData("Microsoft.EntityFrameworkCore")]
    public void Core_declares_no_hosting_or_data_access_dependency(string forbiddenPrefix)
    {
        DeclaredPackages.ShouldNotContain(
            name => name.StartsWith(forbiddenPrefix, StringComparison.OrdinalIgnoreCase),
            "Core must compile standalone for the nopCommerce solution");
    }

    [Fact]
    public void Core_declares_no_nuget_dependencies_at_all()
    {
        DeclaredPackages.ShouldBeEmpty(
            "adding one needs a note in docs/DECISIONS.md — JSON parsing uses the built-in System.Text.Json");
    }

    [Fact]
    public void Core_does_no_file_io_so_callers_own_reading_the_catalog()
    {
        var ioParameters = typeof(Catalog).Assembly.GetTypes()
            .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance))
            .Where(m => m.DeclaringType?.Assembly == typeof(Catalog).Assembly)
            .SelectMany(m => m.GetParameters().Select(p => p.ParameterType))
            .Where(t => t == typeof(FileInfo) || t == typeof(DirectoryInfo) || t == typeof(Stream))
            .ToList();

        ioParameters.ShouldBeEmpty("CatalogLoader takes a JSON string, not a path or stream");
    }
}
