
# Biomes Data (`src/data/biomes.ts`)

## Purpose

The `src/data/biomes.ts` file defines the various biome types available in the Aralia RPG world map system. This data is crucial for map generation (`mapService.ts`) and rendering (`MapPane.tsx`).

## Structure

The file exports a single constant:

*   **`BIOMES: Record<string, Biome>`**
    *   This is an object where each key is a unique string identifier for a biome (e.g., `'plains'`, `'forest'`).
    *   The value for each key is a `Biome` object, defined in `src/types.ts`.

### `Biome` Object Properties

Each `Biome` object has the following properties:

*   **`id: string`**: The unique identifier for the biome (should match the key in the `BIOMES` record).
    *   Example: `"forest"`
*   **`name: string`**: The display name of the biome.
    *   Example: `"Forest"`
*   **`color: string`**: A Tailwind CSS background color class string used for visually representing the biome on the map.
    *   Example: `"bg-green-700"`
    *   *Note*: `MapPane.tsx` currently contains a local mapping to convert these class names to actual `rgba` values for direct styling.
*   **`icon?: string`**: An optional emoji or SVG path data string used as a visual icon for the biome on discovered map tiles.
    *   Example: `"🌲"`
*   **`description: string`**: A short textual description of the biome, which might be displayed to the player (e.g., on hover or when inspecting a map tile).
    *   Example: `"Dense woodlands teeming with life and hidden paths."`
*   **`passable: boolean`**: A boolean indicating whether this biome type is generally traversable by the player.
    *   Example: `true` for plains, `false` for deep ocean.
*   **`impassableReason?: string`**: An optional string that provides a contextual message to the player if they attempt to travel into an impassable biome tile on the map. This is used by `App.tsx` in `handleTileClick`.
    *   Example: `"The vast ocean is too dangerous to cross without a sturdy vessel."`

## Example Entry

```typescript
// From src/data/biomes.ts
export const BIOMES: Record<string, Biome> = {
  // ... other biomes
  'forest': { 
    id: 'forest', 
    name: 'Forest', 
    color: 'bg-green-700', 
    icon: '🌲', 
    description: 'Dense woodlands teeming with life and hidden paths.', 
    passable: true 
  },
  'ocean': { 
    id: 'ocean', 
    name: 'Ocean', 
    color: 'bg-blue-700', 
    icon: '🌊', 
    description: 'Vast expanse of water, requires a vessel to cross.', 
    passable: false,
    impassableReason: "The vast ocean is too dangerous to cross without a sturdy vessel."
  },
  // ...
};
```

## Usage

*   **`mapService.ts`**: Uses `BIOMES` data during map generation to assign `biomeId` to `MapTile`s and to identify passable biomes.
*   **`MapPane.tsx`**: Uses `BIOMES` data to get the color, icon, and name for rendering each map tile based on its `biomeId`.
*   **`App.tsx`**: Uses `BIOMES` data (specifically `passable` and `impassableReason`) in `handleTileClick` to determine if travel to a clicked map tile is allowed and to provide feedback.
*   **`src/constants.ts`**: Imports and re-exports `BIOMES` for global access.

## Adding a New Biome

1.  Define a new entry in the `BIOMES` object in `src/data/biomes.ts`, ensuring all properties of the `Biome` type are correctly filled.
2.  If the biome has a new `color` (Tailwind class), ensure `MapPane.tsx`'s internal `colorMap` is updated if it doesn't automatically handle the new class (though ideally, the `Biome` type would store direct CSS color values in the future).
3.  The new biome will then be available for use in map generation and display.
