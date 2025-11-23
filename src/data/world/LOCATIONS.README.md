# Locations Data (`src/data/world/locations.ts`)

## Purpose

The `src/data/world/locations.ts` file defines all the predefined, static locations within the Aralia RPG. This data is crucial for world structure, navigation, and populating areas with items and NPCs.

## Structure

The file exports two main constants:

1.  **`STARTING_LOCATION_ID: string`**:
    *   The `id` of the location where new player characters begin their adventure.
    *   Example: `"clearing"`

2.  **`LOCATIONS: Record<string, Location>`**:
    *   This is an object where each key is a unique string identifier for a location (e.g., `'clearing'`, `'forest_path'`). This ID is used internally to reference the location.
    *   The value for each key is a `Location` object, defined in `src/types.ts`.

### `Location` Object Properties

Each `Location` object has the following properties (as defined in `src/types.ts`):

*   **`id: string`**: The unique identifier for the location.
*   **`name: string`**: The display name of the location.
*   **`baseDescription: string`**: A fallback or initial textual description of the location. Gemini may generate more dynamic descriptions during gameplay.
*   **`exits: { [direction: string]: string }`**: An object mapping exit directions (e.g., "North", "East") to the `id` of the connecting location.
*   **`itemIds?: string[]`**: An optional array of item IDs (referencing items in `ITEMS` data from `src/data/items/index.ts`) that can initially be found in this location. Item presence can change dynamically during gameplay (managed by `App.tsx`).
*   **`npcIds?: string[]`**: An optional array of NPC IDs (referencing NPCs in `NPCS` data from `src/data/world/npcs.ts`) present in this location.
*   **`mapCoordinates: { x: number; y: number }`**: The (x, y) coordinates of this location on the world map grid.
*   **`biomeId: string`**: The ID of the primary biome (from `src/data/biomes.ts`) this location belongs to, influencing map generation and potentially atmosphere.

## Example Entry

```typescript
// From src/data/world/locations.ts
export const LOCATIONS: Record<string, Location> = {
  'clearing': {
    id: 'clearing',
    name: 'Forest Clearing',
    baseDescription: 'You are in a sun-dappled clearing...',
    exits: { 'North': 'forest_path', 'East': 'ancient_ruins_entrance', 'South': 'hidden_grove' },
    itemIds: ['old_map_fragment'],
    mapCoordinates: { x: 15, y: 10 },
    biomeId: 'plains',
  },
  // ... other locations
};
```

## Usage

*   **`src/constants.ts`**: Imports and re-exports `LOCATIONS` and `STARTING_LOCATION_ID` for global access.
*   **`App.tsx`**:
    *   Uses `LOCATIONS` to get details of the current location.
    *   Uses `STARTING_LOCATION_ID` to initialize the player's position.
    *   `dynamicLocationItemIds` state in `App.tsx` is initialized based on the `itemIds` from `LOCATIONS` but can change as players take items.
*   **`ActionPane.tsx`**: Uses `currentLocation.exits` (derived from `LOCATIONS` data) to display movement actions.
*   **`mapService.ts`**: Uses `LOCATIONS` data (specifically `mapCoordinates` and `biomeId`) to seed the world map generation.

## Adding a New Location

1.  Define a new entry in the `LOCATIONS` object in `src/data/world/locations.ts`.
2.  Ensure the `id` is unique.
3.  Provide all required fields: `name`, `baseDescription`, `exits`, `mapCoordinates`, `biomeId`.
4.  Optionally, add `itemIds` or `npcIds`.
5.  Make sure any referenced `itemIds`, `npcIds`, `biomeId`, or exit location IDs exist in their respective data files.
6.  If this new location can be an exit from other locations, update their `exits` accordingly.