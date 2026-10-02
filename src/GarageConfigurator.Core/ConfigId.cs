using System.Text;

namespace GarageConfigurator.Core;

/// <summary>
/// The short code in a share link: /garage/design/{configId}. Crockford base32 leaves out I, L, O
/// and U so a customer can read one down the phone to a designer without ambiguity.
/// </summary>
public static class ConfigId
{
    public const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    public const int Length = 6;

    /// <summary>
    /// 32^6 is about a billion codes. The caller owns collision checking against the store, since
    /// Core cannot see what has already been issued.
    /// </summary>
    public static string New(Random random)
    {
        var builder = new StringBuilder(Length);

        for (var i = 0; i < Length; i++)
        {
            builder.Append(Alphabet[random.Next(Alphabet.Length)]);
        }

        return builder.ToString();
    }
}
