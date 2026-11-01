# Locations Data (`src/data/world/locations.ts`)

## Purpose

The `src/data/world/locations.ts` file defines predefined locations for descriptions, items, NPCs, and authored adjacency. Its `exits` data does not create travel buttons.

## Named-Exit Navigation

The existing grid-retirement ruling removed the legacy `Go <direction>` actions and the rectangular submap's village-entry actions. Overworld travel uses the cell-native World Map. Town entry uses the map's Enter 3D route, not the retired 2D village screen.

`LOCATIONS.exits` intentionally remains authored adjacency data. The source comment preserves it for gossip and future routing; that is retained intent, not evidence that a current gossip or routing consumer reads it. `gossipLinks` is a separate optional field. Do not remove either field or rebuild direction buttons merely because `exits` still exists.

The retired rectangular submap is not the current recursive cell-native map drill-down. Tactical `BattleMapData.tiles` and legacy-save compatibility are separate boundaries.

- [Grid Retirement roadmap topic](../../../public/planmap/index.html#shipped-grid-retirement) records the retired controls, replacement, and retained data.
- [World Map domain](../../../docs/architecture/domains/world-map.md#named-exit-navigation-retirement) describes the current boundary.
- [Historical retirement plan](../../../docs/superpowers/plans/2026-07-01-grid-2d-view-retirement-plan.md) records the earlier implementation.
- [Legacy-save decision](../../../docs/adr/0003-mapdata-tiles-grid-retirement.md) explains the optional world tile grid. This is not permission to remove save support.

Navigation and data boundary checked against source on 2026-10-10 (WF-G318). This documentation check did not run a fresh gameplay or visual integration test.

## Structure

The file exports two main constants:

1.  **`STARTING_LOCATION_ID: string`**:
    *   The `id` of the location where new player characters begin their adventure.
    *   Example: `"clearing"`

2.  **`LOCATIONS: Record<string, Location>`**:
    *   This is an object where each key is a unique string identifier for a location (e.g., `'clearing'`, `'forest_path'`). This ID is used internally to reference the location.
    *   The value for each key is a `Location` object, defined in `src/types/world.ts` and exported through `src/types/index.ts`.

### `Location` Object Properties

The location data includes these properties from `src/types/world.ts`:

*   **`id: string`**: The unique identifier for the location.
*   **`name: string`**: The display name of the location.
*   **`baseDescription: string`**: A fallback or initial textual description of the location. Gemini may generate more dynamic descriptions during gameplay.
*   **`exits: { [direction: string]: string | Exit }`**: Authored adjacency, using a location ID or an `Exit` object. These entries do not render movement actions.
*   **`itemIds?: string[]`**: An optional array of item IDs (referencing items in `ITEMS` data from `src/data/items/index.ts`) that can initially be found in this location. Item presence can change dynamically during gameplay (managed by `App.tsx`).
*   **`npcIds?: string[]`**: An optional array of NPC IDs (referencing NPCs in `NPCS` data from `src/data/world/npcs.ts`) present in this location.
*   **`biomeId: string`**: The ID of the primary biome (from `src/data/biomes.ts`) this location belongs to, influencing map generation and potentially atmosphere.
*   **`gossipLinks?: string[]`**: Optional authored links, separate from `exits`. Their presence alone does not prove runtime adoption.

`Location.mapCoordinates` was removed by grid retirement. Do not add it to new location entries or use it to position the player.

## Example Entry

```typescript
// From src/data/world/locations.ts
export const LOCATIONS: Record<string, Location> = {
  'clearing': {
    id: 'clearing',
    name: 'Forest Clearing',
    baseDescription: 'You are in a sun-dappled clearing...',
    // Descriptions must not promise directional travel: named exits do not
    // render as actions since grid retirement. Point at the World Map instead.
    exits: { 'North': 'forest_path', 'East': 'ancient_ruins_entrance', 'South': 'hidden_grove' },
    itemIds: ['old_map_fragment'],
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
*   **`src/components/ActionPane/useActionGeneration.ts`**: Generates location interactions, not named-exit travel buttons. Its retirement comments identify the World Map replacement.
*   **`src/components/MapPane.tsx`**: Uses the canonical atlas and cell identity for map interaction and Enter 3D. It does not restore the retired `Location.mapCoordinates` contract.

## Adding a New Location

1.  Define a new entry in the `LOCATIONS` object in `src/data/world/locations.ts`.
2.  Ensure the `id` is unique.
3.  Provide all required fields: `name`, `baseDescription`, `exits`, `biomeId`.
4.  Optionally, add `itemIds` or `npcIds`.
5.  Make sure any referenced `itemIds`, `npcIds`, `biomeId`, or exit location IDs exist in their respective data files.
6.  If the authored adjacency changes, update `exits` deliberately. This does not add a player travel action; any new routing behavior needs a separate product decision and integration proof.
