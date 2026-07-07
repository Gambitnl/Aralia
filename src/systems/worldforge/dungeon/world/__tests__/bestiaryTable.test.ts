/**
 * @file bestiaryTable.test.ts — Pillar 2, Task 5.
 *
 * THE VALIDATION TEST: the bestiary table is authored statically (the generator
 * stays sync and must never import the multi-MB generated monster data), so
 * this suite is what makes the ids REAL — it imports the actual ingested
 * monster data and proves every monsterId in the table (all themes, all biome
 * variants) exists, and that every tier's cr/xp match the monster's actual CR
 * and its DMG XP award.
 */
import { describe, it, expect } from 'vitest';
import { INGESTED_MONSTERS } from '../../../../../data/monsters.generated';
import { crToXp } from '../../../../../utils/combat/encounterDifficulty';
import {
  DUNGEON_BESTIARY,
  bestiaryForSite,
  type BestiaryTier,
} from '../bestiaryTable';
import { generateDungeon } from '../../generateDungeon';
import type { DungeonTheme } from '../../types';

const THEMES: DungeonTheme[] = ['crypt', 'cavern', 'frost', 'sewer', 'fungal'];

/** Biome names that exercise every flavor group, plus no-swap controls.
 * Spelled like FMG biomesData names. */
const BIOME_NAMES = [
  undefined,
  'Hot desert',
  'Cold desert',
  'Wetland',
  'Tropical rainforest',
  'Tundra',
  'Glacier',
  'Taiga',
  'Grassland', // no flavor group → base ladder
  'Temperate deciduous forest', // no flavor group → base ladder
];

/** Every distinct ladder the table can produce. */
function allLadders(): Array<{ label: string; tiers: BestiaryTier[] }> {
  const out: Array<{ label: string; tiers: BestiaryTier[] }> = [];
  for (const theme of THEMES) {
    out.push({ label: `${theme} (base)`, tiers: DUNGEON_BESTIARY[theme] });
    for (const biome of BIOME_NAMES) {
      out.push({ label: `${theme} × ${biome ?? 'none'}`, tiers: bestiaryForSite(theme, biome) });
    }
  }
  return out;
}

describe('bestiaryTable — every id is a real monster with honest CR/XP', () => {
  it('every monsterId in every theme/biome ladder exists in INGESTED_MONSTERS', () => {
    for (const { label, tiers } of allLadders()) {
      for (const tier of tiers) {
        expect(
          INGESTED_MONSTERS[tier.monsterId],
          `${label}: monsterId "${tier.monsterId}" is not a key in the generated monster data`,
        ).toBeDefined();
      }
    }
  });

  it("every tier's cr equals the monster's actual CR, and xp equals crToXp(cr)", () => {
    for (const { label, tiers } of allLadders()) {
      for (const tier of tiers) {
        const data = INGESTED_MONSTERS[tier.monsterId];
        expect(
          tier.cr,
          `${label}: tier for "${tier.monsterId}" claims CR ${tier.cr} but the monster is CR ${data.baseStats.cr}`,
        ).toBe(data.baseStats.cr);
        expect(
          tier.xp,
          `${label}: tier xp ${tier.xp} for "${tier.monsterId}" ≠ crToXp(${tier.cr}) = ${crToXp(tier.cr)}`,
        ).toBe(crToXp(tier.cr));
        // Belt-and-braces: the XP also matches the mapping applied to the
        // monster's OWN cr (catches a tier whose cr/xp agree but drifted from
        // the real monster).
        expect(tier.xp).toBe(crToXp(data.baseStats.cr));
      }
    }
  });

  it('spot-check XP awards against known DMG values on real entries', () => {
    expect(crToXp(INGESTED_MONSTERS.skeleton.baseStats.cr)).toBe(50);
    expect(crToXp(INGESTED_MONSTERS.ghoul.baseStats.cr)).toBe(200);
    expect(crToXp(INGESTED_MONSTERS.wight.baseStats.cr)).toBe(700);
    expect(crToXp(INGESTED_MONSTERS.otyugh.baseStats.cr)).toBe(1800);
    expect(crToXp(INGESTED_MONSTERS.shrieker.baseStats.cr)).toBe(10);
  });
});

describe('bestiaryTable — shape and ladder invariants', () => {
  it('every theme has exactly 6 tiers, weakest → apex (non-decreasing xp)', () => {
    for (const { label, tiers } of allLadders()) {
      expect(tiers.length, label).toBe(6);
      for (let i = 1; i < tiers.length; i++) {
        expect(
          tiers[i].xp,
          `${label}: tier ${i} xp ${tiers[i].xp} < tier ${i - 1} xp ${tiers[i - 1].xp}`,
        ).toBeGreaterThanOrEqual(tiers[i - 1].xp);
      }
      for (const tier of tiers) expect(tier.family.length, label).toBeGreaterThan(0);
    }
  });

  it('bestiaryForSite is pure: same inputs → same ladder, and never mutates the base table', () => {
    const before = JSON.stringify(DUNGEON_BESTIARY);
    for (const theme of THEMES) {
      for (const biome of BIOME_NAMES) {
        expect(bestiaryForSite(theme, biome)).toEqual(bestiaryForSite(theme, biome));
      }
    }
    // Returned arrays are copies — writing into one must not corrupt the table.
    const copy = bestiaryForSite('crypt', 'Hot desert');
    copy[0] = { cr: '30', xp: 155000, monsterId: 'tarrasque', family: 'titan' };
    expect(JSON.stringify(DUNGEON_BESTIARY)).toBe(before);
    expect(bestiaryForSite('crypt', 'Hot desert')[0].monsterId).toBe('giant_rat');
  });

  it('unknown or absent biome returns the base ladder', () => {
    for (const theme of THEMES) {
      expect(bestiaryForSite(theme)).toEqual(DUNGEON_BESTIARY[theme]);
      expect(bestiaryForSite(theme, 'Grassland')).toEqual(DUNGEON_BESTIARY[theme]);
    }
  });

  it('biome flavor swaps land where authored', () => {
    // Desert crypt: the apex wight yields to a mummy.
    const desertCrypt = bestiaryForSite('crypt', 'Hot desert');
    expect(desertCrypt[5].monsterId).toBe('mummy');
    expect(DUNGEON_BESTIARY.crypt[5].monsterId).toBe('wight');
    // Swamp sewer: giant toads mid-ladder, otyugh apex.
    const swampSewer = bestiaryForSite('sewer', 'Wetland');
    expect(swampSewer[3].monsterId).toBe('giant_toad');
    expect(swampSewer[5].monsterId).toBe('otyugh');
    // Glacier cavern: ice mephits + yeti apex.
    const iceCavern = bestiaryForSite('cavern', 'Glacier');
    expect(iceCavern[2].monsterId).toBe('ice_mephit');
    expect(iceCavern[5].monsterId).toBe('yeti');
    // A swap changes ONLY the authored tiers; the rest stay base.
    for (let i = 0; i < 6; i++) {
      if (i === 5) continue;
      expect(desertCrypt[i]).toEqual(DUNGEON_BESTIARY.crypt[i]);
    }
  });
});

describe('generateDungeon — spawns carry real bestiary ids', () => {
  it('every spawn monsterKey resolves through the site ladder into real monster data', () => {
    for (const theme of THEMES) {
      const plan = generateDungeon({ seed: 4242, params: { theme, roomCount: 14 } });
      expect(plan.spawns.length).toBeGreaterThan(0);
      const ladder = bestiaryForSite(theme);
      const ids = new Set(ladder.map((t) => t.monsterId));
      for (const s of plan.spawns) {
        expect(ids.has(s.monsterKey), `${theme}: spawn key "${s.monsterKey}" not in ladder`).toBe(true);
        const data = INGESTED_MONSTERS[s.monsterKey];
        expect(data, `${theme}: "${s.monsterKey}" missing from monster data`).toBeDefined();
        expect(s.cr).toBe(data.baseStats.cr);
        expect(s.xp).toBe(crToXp(data.baseStats.cr));
      }
    }
  });

  it('params.biomeName steers spawn resolution (desert crypt boss is the mummy)', () => {
    const base = generateDungeon({ seed: 777, params: { theme: 'crypt', roomCount: 14 } });
    const desert = generateDungeon({
      seed: 777,
      params: { theme: 'crypt', roomCount: 14, biomeName: 'Hot desert' },
    });
    // biomeName draws nothing from the rng — geometry is identical.
    expect(desert.rooms.length).toBe(base.rooms.length);
    expect(desert.spawns.length).toBe(base.spawns.length);
    const bossSpawnBase = base.spawns.find((s) => s.roomId === base.bossId);
    const bossSpawnDesert = desert.spawns.find((s) => s.roomId === desert.bossId);
    expect(bossSpawnBase?.monsterKey).toBe('wight');
    expect(bossSpawnDesert?.monsterKey).toBe('mummy');
    expect(bossSpawnDesert?.xp).toBe(crToXp(INGESTED_MONSTERS.mummy.baseStats.cr));
  });
});
