/**
 * @file explorationBattlefieldContext.ts — exploration state → battlefield context.
 *
 * Fight-in-place slice 1, sub-feature 9C ("full-freedom initiation"): combat must
 * be startable from ANY exploration state, not only from scripted encounters, and
 * the battlefield it produces must match where the player actually stands —
 * a forest fight in a forest, a snowfield fight on a glacier, a built-up fight in
 * a settlement.
 *
 * The picking rule already existed, but only as three inline ternary branches
 * inside `useInPlaceCombatTransition` (desert / swamp / else-forest). That
 * covered three of WorldForge's thirteen biomes, was unreachable from any other
 * combat entry point, and could not be tested without mounting the whole ground
 * world. This module lifts that decision out unchanged in spirit and completes
 * it, so every entry point — the walk-into-an-enemy trigger, the dev
 * fight-in-place command, and any later placeless route — reaches the same
 * battlefield for the same standing position.
 *
 * Pure: no React, no Three, no worldforge imports. It reads a small context
 * object the caller already has in hand.
 *
 * KNOWN GAP (registered in docs/projects/GLOBAL_GAPS.md): `BATTLE_MAP_BIOMES`
 * has no urban/town theme, so a settlement fight currently routes to `ruins` —
 * the only built-environment theme the painter knows. That is a real theme gap,
 * not a picking bug; when a `town` biome is added to `BATTLE_MAP_BIOMES` and the
 * ground painter, only {@link SETTLEMENT_BATTLEFIELD_THEME} changes here.
 */
import type { BattleMapBiome } from '../../../types/combat';

/** Theme used for a fight inside a settlement footprint. See the KNOWN GAP above. */
export const SETTLEMENT_BATTLEFIELD_THEME: BattleMapBiome = 'ruins';

/** Theme used when the context tells us nothing at all. Matches the prior default. */
export const FALLBACK_BATTLEFIELD_THEME: BattleMapBiome = 'forest';

/**
 * One entity standing near the player when the fight starts. Deliberately loose:
 * the picker never reads stats, only enough to tell a caller which world actors
 * the encounter should pull in.
 */
export interface ExplorationNearbyEntity {
  /** Stable world identity of the entity, when it has one. */
  id?: string;
  /** Display or archetype name, for diagnostics and roster building. */
  name?: string;
  /** World-meters position, used to rank by distance. */
  xM: number;
  zM: number;
  /** Whether this entity is hostile to the player right now. */
  hostile?: boolean;
}

/**
 * Everything a combat entry point needs to know about where the player is
 * standing. Every field except `positionM` is optional so a caller that only
 * knows the position still gets a valid, honest battlefield context.
 */
export interface ExplorationCombatContext {
  /** The player's exact position in world meters — the patch extraction anchor. */
  positionM: { x: number; z: number };
  /**
   * The terrain identifier under the player. Accepts either an FMG biome NAME
   * ("Temperate deciduous forest") or a legacy ground slug ("wetland_marsh");
   * both vocabularies are live in this codebase and callers hold different ones.
   */
  terrainId?: string;
  /** True when the player stands inside a settlement footprint (town, village). */
  inSettlement?: boolean;
  /** True when the player is underground (dungeon/cave interior). */
  underground?: boolean;
  /** Entities in the immediate area, unsorted. */
  nearbyEntities?: readonly ExplorationNearbyEntity[];
}

/**
 * FMG biome NAME (lowercased) → battle-map theme. This is the exact list from
 * `wfBiomeToLegacy`'s `WF_INDEX_TO_NAME`, so every biome WorldForge can generate
 * has a decided answer rather than falling through to forest.
 *
 * Grassland and Savanna map to `forest` because `BATTLE_MAP_BIOMES` has no open
 * plains theme; forest is the closest painter that still yields walkable ground
 * with scattered cover. Same class of gap as the settlement theme above.
 */
const FMG_NAME_TO_BATTLEFIELD_THEME: Readonly<Record<string, BattleMapBiome>> = {
  'marine': 'coast',
  'hot desert': 'desert',
  'cold desert': 'desert',
  'savanna': 'forest',
  'grassland': 'forest',
  'tropical seasonal forest': 'jungle',
  'temperate deciduous forest': 'forest',
  'tropical rainforest': 'jungle',
  'temperate rainforest': 'forest',
  'taiga': 'snow',
  'tundra': 'snow',
  'glacier': 'snow',
  'wetland': 'swamp',
};

/**
 * Substring rules for legacy ground slugs and any free-form terrain label. Order
 * matters — the first match wins — so more specific tokens are listed first.
 * This preserves and widens the original inline behavior, which matched
 * `includes('desert')`, `includes('swamp')`, and `includes('wetland')`.
 */
const TERRAIN_SUBSTRING_RULES: ReadonlyArray<readonly [string, BattleMapBiome]> = [
  ['volcan', 'volcanic'],
  ['lava', 'volcanic'],
  ['dungeon', 'dungeon'],
  ['crypt', 'dungeon'],
  ['ruin', 'ruins'],
  ['cave', 'cave'],
  ['cavern', 'cave'],
  ['desert', 'desert'],
  ['swamp', 'swamp'],
  ['wetland', 'swamp'],
  ['marsh', 'swamp'],
  ['bog', 'swamp'],
  ['glacier', 'snow'],
  ['permafrost', 'snow'],
  ['tundra', 'snow'],
  ['taiga', 'snow'],
  ['snow', 'snow'],
  ['rainforest', 'jungle'],
  ['jungle', 'jungle'],
  ['tropical', 'jungle'],
  ['coast', 'coast'],
  ['shore', 'coast'],
  ['beach', 'coast'],
  ['marine', 'coast'],
  ['ocean', 'coast'],
  ['forest', 'forest'],
  ['wood', 'forest'],
  ['grass', 'forest'],
  ['savanna', 'forest'],
  ['plain', 'forest'],
];

/**
 * Pick the battle-map theme for an exploration context. Pure and total: every
 * input produces a theme, and identical inputs always produce the same one.
 *
 * Precedence, highest first:
 *  1. underground — an interior fight is never a forest, whatever the surface
 *     biome above it says.
 *  2. settlement — standing in a town beats the town's surrounding biome.
 *  3. the terrain id — exact FMG name, then substring rules.
 *  4. the forest fallback.
 */
export function pickBattlefieldTheme(context: ExplorationCombatContext): BattleMapBiome {
  if (context.underground) return 'dungeon';
  if (context.inSettlement) return SETTLEMENT_BATTLEFIELD_THEME;

  const raw = (context.terrainId ?? '').trim().toLowerCase();
  if (!raw) return FALLBACK_BATTLEFIELD_THEME;

  const exact = FMG_NAME_TO_BATTLEFIELD_THEME[raw];
  if (exact) return exact;

  for (const [token, theme] of TERRAIN_SUBSTRING_RULES) {
    if (raw.includes(token)) return theme;
  }

  return FALLBACK_BATTLEFIELD_THEME;
}

/** The picker's full verdict — the theme plus everything the caller must carry. */
export interface ExplorationBattlefieldPlan {
  /** The battle-map theme to generate/extract with. */
  theme: BattleMapBiome;
  /** The patch extraction anchor: exactly where the player stands. */
  anchorM: { x: number; z: number };
  /** Hostile nearby entities, nearest first — the encounter's opening roster. */
  hostiles: readonly ExplorationNearbyEntity[];
  /** Every nearby entity, nearest first. Non-hostiles become world occupants. */
  bystanders: readonly ExplorationNearbyEntity[];
  /** Why this theme was chosen. Surfaced in dev logging and combat diagnostics. */
  reason: string;
}

function distanceSq(from: { x: number; z: number }, entity: ExplorationNearbyEntity): number {
  const dx = entity.xM - from.x;
  const dz = entity.zM - from.z;
  return dx * dx + dz * dz;
}

/**
 * Turn a raw exploration context into the plan a combat entry point needs:
 * where to cut the battlefield, what theme to cut it with, and which nearby
 * actors belong in the fight.
 *
 * This is the "accepts current position, nearby entities, terrain type" contract
 * from 9C in one call, so no entry point has to reassemble it by hand.
 */
export function planBattlefieldFromExploration(
  context: ExplorationCombatContext,
): ExplorationBattlefieldPlan {
  const theme = pickBattlefieldTheme(context);
  const sorted = [...(context.nearbyEntities ?? [])].sort(
    (a, b) => distanceSq(context.positionM, a) - distanceSq(context.positionM, b),
  );

  const reason = context.underground
    ? 'underground interior — dungeon battlefield'
    : context.inSettlement
      ? `inside a settlement — ${SETTLEMENT_BATTLEFIELD_THEME} battlefield (no urban theme exists yet)`
      : context.terrainId
        ? `terrain "${context.terrainId}" → ${theme} battlefield`
        : `no terrain id supplied — ${FALLBACK_BATTLEFIELD_THEME} battlefield fallback`;

  return {
    theme,
    anchorM: { ...context.positionM },
    hostiles: sorted.filter(entity => entity.hostile === true),
    bystanders: sorted.filter(entity => entity.hostile !== true),
    reason,
  };
}
