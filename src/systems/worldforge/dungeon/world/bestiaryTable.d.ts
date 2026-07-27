/**
 * @file bestiaryTable.ts — real bestiary tiers per dungeon theme (Pillar 2, Task 5).
 *
 * Replaces the fictional `CR_TIERS` placeholder in generateDungeon with monster
 * ids that are REAL keys into the ingested 5etools data
 * (`src/data/monsters.generated.ts`, `INGESTED_MONSTERS` — lowercase snake_case
 * ids like 'skeleton', 'bandit_captain').
 *
 * CONTRACT:
 * - STATIC + SYNCHRONOUS. The dungeon generator stays sync, so this module must
 *   NEVER import the async monster loader or the multi-MB generated data file.
 *   Ids/CRs/XP are authored here and validated against the real data by
 *   `__tests__/bestiaryTable.test.ts` (which IS allowed to import the data).
 * - Every tier's `cr` and `xp` match the referenced monster's actual CR and its
 *   DMG XP award (`crToXp` in utils/combat/encounterDifficulty.ts).
 * - Tiers are ordered weakest → apex; the last tier is the boss tier
 *   (generateDungeon seats it in the boss room).
 * - `bestiaryForSite` is PURE (no rng): same (theme, biomeName) → same tiers.
 */
import type { DungeonTheme } from '../types';
/** One rung of a theme's encounter ladder. `monsterId` is a real key into
 * `INGESTED_MONSTERS`; `xp` is the DMG award for `cr`. */
export interface BestiaryTier {
    cr: string;
    xp: number;
    monsterId: string;
    /** Loose creature family, for lore/roster flavor (not a data key). */
    family: string;
}
/**
 * Six tiers per theme, weakest → apex. Ladders stay in the CR 0–3 band the old
 * placeholder used (tier XP 10/25–700) so dungeon difficulty is unchanged;
 * biome variants may push the apex higher (see BIOME_SWAPS).
 */
export declare const DUNGEON_BESTIARY: Record<DungeonTheme, BestiaryTier[]>;
/**
 * Resolve the encounter ladder for a dungeon site. Pure and synchronous:
 * returns the theme's base ladder, with 1–2 tiers swapped for biome-flavored
 * alternates when `biomeName` (an FMG biome name) matches a flavor group.
 * Unknown/absent biomes return the base ladder. Never mutates the base table.
 */
export declare function bestiaryForSite(theme: DungeonTheme, biomeName?: string): BestiaryTier[];
