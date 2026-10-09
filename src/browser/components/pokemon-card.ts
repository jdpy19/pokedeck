import type { Pokemon } from "../models.js";

const TYPE_COLORS: Readonly<Record<string, string>> = Object.freeze({
  normal: "#b8b89d", fire: "#ff8b59", water: "#55aef0", electric: "#f5cf59",
  grass: "#6ed47a", ice: "#79d8dc", fighting: "#e15b4f", poison: "#b66aca",
  ground: "#d9b967", flying: "#93aef0", psychic: "#ef6e9e", bug: "#a8c13a",
  rock: "#b7a24f", ghost: "#806bb6", dragon: "#7a69ed", dark: "#6d5b52",
  steel: "#a8adc2", fairy: "#ef9fbd",
});

export const pokemonTypes = Object.keys(TYPE_COLORS).sort();
export const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export function createPokemonCard(pokemon: Pokemon, doc: Document = document): HTMLElement {
  const article = doc.createElement("article");
  article.className = "pokemon-card";

  const top = doc.createElement("div");
  top.className = "card-top";
  const number = doc.createElement("span");
  number.textContent = `NO. ${String(pokemon.id).padStart(3, "0")}`;
  const dot = doc.createElement("span");
  dot.className = "caught-dot";
  dot.setAttribute("aria-hidden", "true");
  top.append(number, dot);

  const stage = doc.createElement("div");
  stage.className = "sprite-stage";
  const image = doc.createElement("img");
  image.src = pokemon.sprite;
  image.alt = `${titleCase(pokemon.name)} sprite`;
  image.width = 132;
  image.height = 132;
  image.loading = "lazy";
  stage.append(image);

  const heading = doc.createElement("h3");
  heading.textContent = pokemon.name;
  const types = doc.createElement("div");
  types.className = "types";
  for (const type of pokemon.types) {
    const pill = doc.createElement("span");
    pill.className = "type-pill";
    pill.style.setProperty("--type-color", TYPE_COLORS[type] ?? "#58d5c9");
    pill.textContent = type;
    types.append(pill);
  }
  article.append(top, stage, heading, types);
  return article;
}
