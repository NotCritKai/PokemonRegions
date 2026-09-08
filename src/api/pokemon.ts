export type Pokemon = {
  name: string;
  url: string;
  types: string[];
  generation: number;
};

const generationNumbers: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
};

export async function getPokemon(limit = 20, offset = 0): Promise<Pokemon[]> {
  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Pokémon: ${response.status}`);
  }

  const data: { results: { name: string; url: string }[] } =
    await response.json();

  return Promise.all(
    data.results.map(async (pokemon) => {
      const detailsResponse = await fetch(pokemon.url);
      if (!detailsResponse.ok) {
        throw new Error(
          `Failed to fetch ${pokemon.name}: ${detailsResponse.status}`,
        );
      }

      const details: {
        types: { type: { name: string } }[];
        species: { url: string };
      } = await detailsResponse.json();
      const speciesResponse = await fetch(details.species.url);
      if (!speciesResponse.ok) {
        throw new Error(`Failed to fetch species for ${pokemon.name}`);
      }

      const species: { generation: { name: string } } =
        await speciesResponse.json();
      const generationName = species.generation.name.replace("generation-", "");
      const generation = generationNumbers[generationName] ?? 0;

      return {
        ...pokemon,
        types: details.types.map(({ type }) => type.name),
        generation,
      };
    }),
  );
}
