using System.Reflection;
using System.Text.RegularExpressions;
using GarageConfigurator.Api.Functions;
using Microsoft.Azure.Functions.Worker;
using Shouldly;

namespace GarageConfigurator.Api.Tests;

/// <summary>
/// The spec is hand-maintained, so it drifts unless something checks. This walks the actual
/// [HttpTrigger] routes and asserts each one is documented, and that nothing is documented twice.
/// </summary>
public class OpenApiContractTests
{
    private static readonly string Spec =
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "openapi.yaml"));

    public static TheoryData<string, string> DeclaredRoutes()
    {
        var data = new TheoryData<string, string>();

        foreach (var method in typeof(GarageFunctions).GetMethods(BindingFlags.Public | BindingFlags.Instance))
        {
            foreach (var parameter in method.GetParameters())
            {
                var trigger = parameter.GetCustomAttribute<HttpTriggerAttribute>();

                if (trigger is not null && trigger.Route is not null)
                {
                    data.Add(trigger.Route, string.Join(",", trigger.Methods ?? Array.Empty<string>()));
                }
            }
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(DeclaredRoutes))]
    public void Every_http_route_is_documented_in_the_openapi_spec(string route, string methods)
    {
        if (route == "openapi.yaml")
        {
            return; // The spec does not document the endpoint that serves the spec.
        }

        // "design/{configId}" in code is "/design/{configId}" in the spec.
        Spec.ShouldContain($"  /{route}:", Case.Sensitive, $"route {route} ({methods}) is not in openapi.yaml");
    }

    [Fact]
    public void The_spec_documents_no_route_the_api_does_not_serve()
    {
        var specRoutes = Regex.Matches(Spec, @"^  (/[A-Za-z0-9{}/._-]*):$", RegexOptions.Multiline)
            .Select(m => m.Groups[1].Value.TrimStart('/'))
            .ToList();

        var codeRoutes = DeclaredRoutes().Select(row => (string)row[0]!).ToList();

        specRoutes.ShouldAllBe(r => codeRoutes.Contains(r));
    }

    [Fact]
    public void Every_goal_the_solver_accepts_is_listed_in_the_spec()
    {
        foreach (var goal in Enum.GetNames<Core.Goal>())
        {
            Spec.ShouldContain(goal);
        }
    }

    [Fact]
    public void Every_failure_reason_the_api_can_return_is_listed_in_the_spec()
    {
        foreach (var reason in Enum.GetNames<Core.SolveReason>())
        {
            Spec.ShouldContain(reason);
        }
    }

    [Fact]
    public void Ceiling_is_documented_as_required_because_it_changes_what_fits()
    {
        Spec.ShouldContain("required: [length, ceiling]");
    }
}
