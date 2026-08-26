// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 10:08:43
 * Dependents: components/BattleMap/characters/characterActor/CharacterActor.tsx, components/BattleMap/characters/characterActor/CharacterBody.tsx, components/BattleMap/characters/characterActor/CharacterSelectionRing.tsx, components/BattleMap/characters/characterActor/CharacterStatusBadges.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file characters/characterActor/actorTheme.ts
 * Shared scalars and team palette for the 3D combat-map actor.
 *
 * Extracted from CharacterActor.tsx (task agora-b70d) so the container and its
 * three new sub-components (CharacterBody / CharacterSelectionRing /
 * CharacterStatusBadges) read one palette instead of three copies. Values are
 * unchanged.
 *
 * Dependencies: none (leaf module).
 * Dependents: characterActor/CharacterActor.tsx, CharacterBody.tsx,
 *             CharacterSelectionRing.tsx, CharacterStatusBadges.tsx
 */

/** Combat map: 1 tile = 5 ft = 1 unit → 0.656 units per meter, plus the same
 * mild readability oversize the primitive models used (~1.25×). */
export const UNITS_PER_M = 1 / 1.524;
export const MODEL_SCALE = UNITS_PER_M * 1.25;

export const TILE_SIZE = 1.0;
export const ELEVATION_SCALE = 0.3;

/** One team's ring, armor, nameplate accent, and ground-glow colors. */
export interface ActorTeamColors {
  primary: number;
  selection: number;
  nameAccent: string;
  groundGlow: number;
}

// Team colors — warm/heroic for players, cold/hostile for enemies
export const TEAM_COLORS: Record<'player' | 'enemy' | 'neutral', ActorTeamColors> = {
  player: {
    primary: 0xd4a017,    // Gold armor
    selection: 0xfbbf24,  // Bright amber ring
    nameAccent: '#d4a017',
    groundGlow: 0xffd060, // Warm amber ground light
  },
  enemy: {
    primary: 0xcc1111,    // Vivid crimson armor
    selection: 0xff2020,  // Bright red ring
    nameAccent: '#ff4444',
    groundGlow: 0xff1100, // Intense red ground light
  },
  neutral: {
    primary: 0xeab308,    // Yellow
    selection: 0xfbbf24,  // Light yellow
    nameAccent: '#eab308',
    groundGlow: 0xffcc00,
  },
};
