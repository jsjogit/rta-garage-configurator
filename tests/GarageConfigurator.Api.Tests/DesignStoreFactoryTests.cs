using GarageConfigurator.Api.Services;
using Shouldly;

namespace GarageConfigurator.Api.Tests;

public class DesignStoreFactoryTests
{
    [Fact]
    public void Without_a_connection_string_a_local_run_keeps_designs_in_memory()
    {
        DesignStoreFactory.Create(connection: null, environment: "Development")
            .ShouldBeOfType<InMemoryDesignStore>();
    }

    [Fact]
    public void Without_a_connection_string_a_deployed_run_refuses_to_start()
    {
        // Falling back to memory in production would hand customers share links that expire
        // silently the next time the app restarts.
        var start = () => DesignStoreFactory.Create(connection: null, environment: "Production");

        Should.Throw<InvalidOperationException>(start)
            .Message.ShouldContain("DesignStorageConnection");
    }

    [Fact]
    public void A_blank_connection_string_counts_as_missing()
    {
        Should.Throw<InvalidOperationException>(
            () => DesignStoreFactory.Create(connection: "   ", environment: "Production"));
    }
}
