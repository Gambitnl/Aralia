
# Biomes Data (`src/data/biomes.ts`)

## Purpose

The `src/data/biomes.ts` file defines the biome catalogue for Aralia. It drives world map generation (`mapService.ts`), submap rendering (`MapPane.tsx`, `SubmapPane`), encounters/resources, and flavor text.

## Structure (50 biomes)

The file exports a single constant:

*   **`BIOMES: Record<string, Biome>`**
    *   Keys are biome ids (e.g., `forest_temperate`, `desert_dune`). Legacy aliases (`forest`, `plains`, `swamp`, `desert`, `hills`, `mountain`) still resolve to modern variants.
    *   Values are `Biome` objects (see `src/types/world.ts`).
    *   Families (10) × variants (5 each) = 50 total. Special biomes (`ocean`, `cave`, `dungeon`) remain.

### `Biome` Object Properties

Each `Biome` object has the following properties:

*   **`id: string`**: The unique identifier for the biome (should match the key in the `BIOMES` record).
    *   Example: `"forest_temperate"`
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
*   **Gameplay metadata (optional)**: `family`, `variant`, `climate`, `moisture`, `elevation`, `magic`, `waterFrequency`, `spawnWeight`, `tags`, `movementModifiers`, `visibilityModifiers`, `hazards`, `elementalInteractions`, `encounterWeights`, `resourceWeights`.

## Example Entry

```typescript
{
  id: 'forest_temperate',
  name: 'Temperate Forest',
  family: 'forest',
  variant: 'temperate',
  color: 'bg-green-700',
  rgbaColor: 'rgba(34, 109, 72, 0.7)',
  icon: '🌲',
  description: 'Mixed conifers and broadleaf trees with dappled light.',
  passable: true,
  waterFrequency: 'medium',
  spawnWeight: 3,
  movementModifiers: { speedMultiplier: 0.9 },
  visibilityModifiers: { fog: 'light', canopyShade: true },
  hazards: ['falling-branches', 'thorny-underbrush'],
  elementalInteractions: ['fire-spreads-fast'],
  encounterWeights: { beasts: 3, fey: 2, undead: 1 },
  resourceWeights: { wood: 3, herbs: 2, forage: 2 },
}
```

## Usage

*   **`mapService.ts`**: Uses `BIOMES` data during map generation to assign `biomeId` to `MapTile`s and to identify passable biomes.
*   **`MapPane.tsx`**: Uses `BIOMES` data to get the color, icon, and name for rendering each map tile based on its `biomeId`.
*   **`App.tsx`**: Uses `BIOMES` data (specifically `passable` and `impassableReason`) in `handleTileClick` to determine if travel to a clicked map tile is allowed and to provide feedback.
*   **`src/constants.ts`**: Imports and re-exports `BIOMES` for global access.
*   **`villageGenerator.ts`**: Infers biome style/architecture from biome family/magic to theme towns.

## Adding a New Biome

1. Add a new variant entry in `src/data/biomes.ts` (or extend a family). Include at least `id`, `name`, `color`, `rgbaColor`, `description`, and `passable`.
2. If the biome has a new `color` (Tailwind class), ensure `MapPane.tsx` handles it (it consumes `rgbaColor` first).
3. The new biome will then be available for world generation, town styling, and map rendering. Legacy aliases can be added to `LEGACY_ALIASES` if needed.
