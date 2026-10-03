/**
 * @file src/data/races/__tests__/racialSpeed.test.ts
 *
 * SYS-1 racial speed data audit (task agora-3d12.1).
 *
 * WHAT this guards: every race in `src/data/races/` must resolve a walking
 * speed through the character-utils facade, and that resolved speed must come
 * from the race's own data rather than from the 30 ft fallback inside
 * `calculateCharacterSpeedFromRace` (src/utils/character/stats.ts).
 *
 * WHY it exists: racial speed is entirely data-driven. `characterUtils.ts` is a
 * re-export facade and holds no per-race speed constants, so a race added
 * without a `Speed:` trait, or with one the parser cannot read, fails silently
 * at 30 ft instead of throwing. The audit that produced this test found 111/111
 * races carrying a parseable `Speed:` trait and zero orphaned overrides
 * anywhere in `src/`, so this test locks that clean state in place.
 *
 * PRESERVED: the fallback itself stays in stats.ts — it keeps ad-hoc and
 * in-progress race objects usable outside the shipped catalog. This test only
 * asserts the shipped catalog never relies on it.
 */
import { describe, it, expect } from 'vitest';
import { ALL_RACES_DATA } from '../index.js';
// Imported through the facade named in the audit task, so the test also proves
// the re-export path (characterUtils -> stats) still exposes speed resolution.
import { calculateCharacterSpeedFromRace } from '../../../utils/character/characterUtils.js';
import type { Race } from '../../../types/index.js';

/** Pulls the number out of a race's own `Speed:` trait, or null when absent. */
function declaredSpeed(race: Race): number | null {
  const trait = (race.traits ?? []).find(t => t.toLowerCase().startsWith('speed:'));
  if (!trait) return null;
  const match = trait.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

const raceEntries = Object.entries(ALL_RACES_DATA) as Array<[string, Race]>;

describe('racial speed data audit', () => {
  it('ships a non-empty race catalog', () => {
    expect(raceEntries.length).toBeGreaterThanOrEqual(100);
  });

  it('every race declares a parseable Speed: trait', () => {
    const missing = raceEntries
      .filter(([, race]) => declaredSpeed(race) === null)
      .map(([id]) => id);
    expect(missing, `races with no parseable "Speed:" trait: ${missing.join(', ')}`).toEqual([]);
  });

  it('every race resolves a sane walking speed', () => {
    const bad: string[] = [];
    for (const [id, race] of raceEntries) {
      const speed = calculateCharacterSpeedFromRace(race, {});
      if (!Number.isFinite(speed) || speed <= 0 || speed > 60 || speed % 5 !== 0) {
        bad.push(`${id}=${speed}`);
      }
    }
    expect(bad, `races resolving an implausible speed: ${bad.join(', ')}`).toEqual([]);
  });

  it('resolved speed matches the speed the race declares', () => {
    const mismatched: string[] = [];
    for (const [id, race] of raceEntries) {
      const declared = declaredSpeed(race);
      const resolved = calculateCharacterSpeedFromRace(race, {});
      if (declared !== null && declared !== resolved) {
        mismatched.push(`${id}: declared ${declared} vs resolved ${resolved}`);
      }
    }
    expect(mismatched, mismatched.join('; ')).toEqual([]);
  });

  it('reads the walking speed, not a trailing swim/climb figure', () => {
    // These races write "Speed: 30 feet, swim 30 feet" or similar; the parser
    // must take the first number, not the movement-mode one.
    const multiMode = ['giff', 'hadozee', 'lizardfolk', 'sea_elf', 'triton', 'water_genasi'];
    for (const id of multiMode) {
      const race = ALL_RACES_DATA[id];
      expect(race, `${id} missing from ALL_RACES_DATA`).toBeDefined();
      expect(calculateCharacterSpeedFromRace(race, {}), id).toBe(30);
    }
  });

  it('honors the non-default speeds the catalog declares', () => {
    const expected: Record<string, number> = {
      human: 30,
      centaur: 40,
      goliath: 35,
      air_genasi: 35,
      wood_elf: 35,
      leonin: 35,
      satyr: 35,
      wayfarer_human: 35,
    };
    for (const [id, speed] of Object.entries(expected)) {
      expect(calculateCharacterSpeedFromRace(ALL_RACES_DATA[id], {}), id).toBe(speed);
    }
  });

  it('detects the silent 30 ft fallback the catalog must never hit', () => {
    // Guard-the-guard: a race with no `Speed:` trait resolves to 30 without any
    // error, which is exactly the failure the catalog-wide checks above catch.
    const synthetic = {
      id: 'synthetic_no_speed',
      name: 'Synthetic',
      description: '',
      traits: ['Darkvision: 60 feet'],
    } as unknown as Race;
    expect(declaredSpeed(synthetic)).toBeNull();
    expect(calculateCharacterSpeedFromRace(synthetic, {})).toBe(30);
  });

  it('applies the wood elf lineage speed increase on top of the base elf speed', () => {
    const elf = ALL_RACES_DATA['elf'];
    expect(calculateCharacterSpeedFromRace(elf, {})).toBe(30);
    expect(
      calculateCharacterSpeedFromRace(elf, { elf: { choiceId: 'wood_elf' } } as never),
    ).toBe(35);
  });
});

/**
 * Added for Agora task agora-0202. The audit above proves the catalog data is
 * clean; this block proves the sandbox assembly path does not introduce a
 * SECOND speed source. `quickCharacterGenerator` used to write its own
 * `race.id === 'dwarf' || race.id === 'gnome' ? 25 : 30` constant, which no
 * race id in the catalog could ever match, so every quick-assembled character
 * walked at 30 ft regardless of its race.
 */
describe('sandbox assembly reads the same racial speed as the facade', () => {
  it('has no race whose id is the bare "dwarf" or "gnome" the old constant keyed on', () => {
    expect(ALL_RACES_DATA['dwarf']).toBeUndefined();
    expect(ALL_RACES_DATA['gnome']).toBeUndefined();
  });

  it('assembles every race at exactly its facade-derived speed', async () => {
    const { createQuickCharacter } = await import('../../../utils/sandbox/quickCharacterGenerator.js');
    const mismatched: string[] = [];
    for (const [id, race] of raceEntries) {
      const character = createQuickCharacter({ raceId: id, classId: 'fighter', level: 5 });
      if (!character) {
        mismatched.push(`${id}: sandbox assembly returned null`);
        continue;
      }
      const facade = calculateCharacterSpeedFromRace(race, {});
      if (character.speed !== facade) {
        mismatched.push(`${id}: assembled ${character.speed} vs facade ${facade}`);
      }
    }
    expect(mismatched, mismatched.join('; ')).toEqual([]);
  });
});
