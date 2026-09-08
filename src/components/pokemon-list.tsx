import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { getPokemon, type Pokemon } from "@/api/pokemon";
import { ThemedText } from "@/components/themed-text";

export function PokemonList() {
  const [pokemon, setPokemon] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPokemon()
      .then(setPokemon)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ThemedText>Loading Pokémon...</ThemedText>;
  if (error) return <ThemedText>Error: {error}</ThemedText>;

  return (
    <>
      {pokemon.map((item) => (
        <View key={item.name} style={styles.pokemonRow}>
          <Image
            accessibilityLabel={`${item.name} sprite`}
            contentFit="contain"
            source={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${getPokemonId(item.url)}.png`}
            style={styles.pokemonImage}
          />
          <ThemedText>
            {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
          </ThemedText>
        </View>
      ))}
    </>
  );
}

function getPokemonId(url: string) {
  return url.split("/").filter(Boolean).pop();
}

const styles = StyleSheet.create({
  pokemonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  pokemonImage: {
    height: 32,
    width: 32,
  },
});
