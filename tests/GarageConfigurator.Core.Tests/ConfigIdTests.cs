using GarageConfigurator.Core;
using Shouldly;

namespace GarageConfigurator.Core.Tests;

/// <summary>SPEC.md: "a short config_id (base32, 6 chars) persisted so the layout can be reloaded/shared".</summary>
public class ConfigIdTests
{
    [Fact]
    public void A_config_id_is_six_characters()
    {
        ConfigId.New(new Random(1)).Length.ShouldBe(6);
    }

    [Fact]
    public void A_config_id_uses_only_the_unambiguous_base32_alphabet()
    {
        var ids = Enumerable.Range(0, 200).Select(seed => ConfigId.New(new Random(seed)));

        ids.ShouldAllBe(id => id.All(c => ConfigId.Alphabet.Contains(c)));
    }

    [Fact]
    public void The_alphabet_leaves_out_letters_that_look_like_digits()
    {
        // Crockford base32: no I, L, O or U — a customer reads these ids aloud to a designer.
        ConfigId.Alphabet.ShouldNotContain('I');
        ConfigId.Alphabet.ShouldNotContain('L');
        ConfigId.Alphabet.ShouldNotContain('O');
        ConfigId.Alphabet.ShouldNotContain('U');
        ConfigId.Alphabet.Length.ShouldBe(32);
    }

    [Fact]
    public void The_same_seed_produces_the_same_id_so_tests_can_pin_one()
    {
        ConfigId.New(new Random(42)).ShouldBe(ConfigId.New(new Random(42)));
    }

    [Fact]
    public void Ids_from_different_draws_collide_rarely_enough_to_be_useful()
    {
        var random = new Random(7);
        var ids = Enumerable.Range(0, 5000).Select(_ => ConfigId.New(random)).ToList();

        ids.Distinct().Count().ShouldBe(ids.Count);
    }
}
