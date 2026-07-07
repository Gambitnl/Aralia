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
export const DUNGEON_BESTIARY: Record<DungeonTheme, BestiaryTier[]> = {
  crypt: [
    { cr: '1/8', xp: 25, monsterId: 'giant_rat', family: 'vermin' },
    { cr: '1/4', xp: 50, monsterId: 'skeleton', family: 'undead' },
    { cr: '1/2', xp: 100, monsterId: 'shadow', family: 'undead' },
    { cr: '1', xp: 200, monsterId: 'ghoul', family: 'undead' },
    { cr: '2', xp: 450, monsterId: 'ghast', family: 'undead' },
    { cr: '3', xp: 700, monsterId: 'wight', family: 'undead' },
  ],
  cavern: [
    { cr: '1/8', xp: 25, monsterId: 'stirge', family: 'vermin' },
    { cr: '1/4', xp: 50, monsterId: 'giant_bat', family: 'beast' },
    { cr: '1/2', xp: 100, monsterId: 'gray_ooze', family: 'ooze' },
    { cr: '1', xp: 200, monsterId: 'giant_spider', family: 'beast' },
    { cr: '2', xp: 450, monsterId: 'ochre_jelly', family: 'ooze' },
    { cr: '3', xp: 700, monsterId: 'hook_horror', family: 'monstrosity' },
  ],
  frost: [
    { cr: '1/8', xp: 25, monsterId: 'blood_hawk', family: 'beast' },
    { cr: '1/4', xp: 50, monsterId: 'wolf', family: 'beast' },
    { cr: '1/2', xp: 100, monsterId: 'ice_mephit', family: 'elemental' },
    { cr: '1', xp: 200, monsterId: 'brown_bear', family: 'beast' },
    { cr: '2', xp: 450, monsterId: 'polar_bear', family: 'beast' },
    { cr: '3', xp: 700, monsterId: 'winter_wolf', family: 'monstrosity' },
  ],
  sewer: [
    { cr: '1/8', xp: 25, monsterId: 'giant_rat', family: 'vermin' },
    { cr: '1/4', xp: 50, monsterId: 'swarm_of_rats', family: 'vermin' },
    { cr: '1/2', xp: 100, monsterId: 'gray_ooze', family: 'ooze' },
    { cr: '1', xp: 200, monsterId: 'ghoul', family: 'undead' },
    { cr: '2', xp: 450, monsterId: 'carrion_crawler', family: 'monstrosity' },
    { cr: '3', xp: 700, monsterId: 'water_weird', family: 'elemental' },
  ],
  fungal: [
    { cr: '0', xp: 10, monsterId: 'shrieker', family: 'fungus' },
    { cr: '1/4', xp: 50, monsterId: 'violet_fungus', family: 'fungus' },
    { cr: '1/2', xp: 100, monsterId: 'myconid_adult', family: 'fungus' },
    { cr: '1', xp: 200, monsterId: 'quaggoth_spore_servant', family: 'fungus' },
    { cr: '2', xp: 450, monsterId: 'myconid_sovereign', family: 'fungus' },
    { cr: '3', xp: 700, monsterId: 'grell', family: 'aberration' },
  ],
};

/** Coarse biome flavor groups matched against FMG biome names
 * ("Hot desert", "Wetland", "Tropical rainforest", "Tundra", "Glacier", ...). */
type BiomeGroup = 'desert' | 'wet' | 'cold';

function biomeGroup(biomeName?: string): BiomeGroup | undefined {
  if (!biomeName) return undefined;
  const n = biomeName.toLowerCase();
  if (n.includes('desert') || n.includes('dune')) return 'desert';
  if (n.includes('wetland') || n.includes('swamp') || n.includes('marsh') || n.includes('rainforest')) return 'wet';
  if (n.includes('tundra') || n.includes('glacier') || n.includes('taiga')) return 'cold';
  return undefined;
}

/** Per-(theme, biome group) tier swaps — 1–2 flavored alternates each. Tier
 * indices are 0-based into the 6-tier ladder (5 = boss/apex). */
const BIOME_SWAPS: Partial<Record<DungeonTheme, Partial<Record<BiomeGroup, Array<{ tier: number; alt: BestiaryTier }>>>>> = {
  crypt: {
    // Desert tombs keep mummies; the wight yields the apex seat.
    desert: [{ tier: 5, alt: { cr: '3', xp: 700, monsterId: 'mummy', family: 'undead' } }],
    // Bog burials raise heavier, waterlogged dead.
    wet: [{ tier: 4, alt: { cr: '2', xp: 450, monsterId: 'ogre_zombie', family: 'undead' } }],
  },
  cavern: {
    desert: [{ tier: 5, alt: { cr: '3', xp: 700, monsterId: 'giant_scorpion', family: 'vermin' } }],
    wet: [
      { tier: 1, alt: { cr: '1/4', xp: 50, monsterId: 'giant_frog', family: 'beast' } },
      { tier: 3, alt: { cr: '1', xp: 200, monsterId: 'giant_toad', family: 'beast' } },
    ],
    cold: [
      { tier: 2, alt: { cr: '1/2', xp: 100, monsterId: 'ice_mephit', family: 'elemental' } },
      { tier: 5, alt: { cr: '3', xp: 700, monsterId: 'yeti', family: 'monstrosity' } },
    ],
  },
  frost: {
    // Deep-cold sites trade the winter wolf apex for a yeti.
    cold: [{ tier: 5, alt: { cr: '3', xp: 700, monsterId: 'yeti', family: 'monstrosity' } }],
  },
  sewer: {
    wet: [
      { tier: 3, alt: { cr: '1', xp: 200, monsterId: 'giant_toad', family: 'beast' } },
      { tier: 5, alt: { cr: '5', xp: 1800, monsterId: 'otyugh', family: 'aberration' } },
    ],
  },
  fungal: {
    wet: [{ tier: 5, alt: { cr: '5', xp: 1800, monsterId: 'shambling_mound', family: 'plant' } }],
  },
};

/**
 * Resolve the encounter ladder for a dungeon site. Pure and synchronous:
 * returns the theme's base ladder, with 1–2 tiers swapped for biome-flavored
 * alternates when `biomeName` (an FMG biome name) matches a flavor group.
 * Unknown/absent biomes return the base ladder. Never mutates the base table.
 */
export function bestiaryForSite(theme: DungeonTheme, biomeName?: string): BestiaryTier[] {
  const base = DUNGEON_BESTIARY[theme];
  const group = biomeGroup(biomeName);
  const swaps = group ? BIOME_SWAPS[theme]?.[group] : undefined;
  if (!swaps || swaps.length === 0) return base.slice();
  const tiers = base.slice();
  for (const s of swaps) tiers[s.tier] = s.alt;
  return tiers;
}
