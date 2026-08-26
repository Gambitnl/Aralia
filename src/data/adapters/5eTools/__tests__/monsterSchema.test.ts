import { describe, it, expect } from 'vitest';
import { convert5eToolsMonster } from '../index';
import { parseSpellcasting, parseMonsterSpellSlots } from '../spellcastingAdapter';
import type { FiveEToolsMonster, FiveEToolsSpellcasting } from '../types';

/**
 * These tests pin the 5eTools input schema (src/data/adapters/5eTools/types.ts)
 * against the union shapes that really occur in bestiary-mm.json and
 * bestiary-xmm.json: CR as a string OR an object, creature-type tags as strings
 * OR { tag, prefix } wrappers, and alignment codes as letters OR weighted
 * { alignment, chance } entries.
 *
 * Every fixture below is typed as FiveEToolsMonster with no cast, so a schema
 * that stops describing the real data fails at compile time as well as at run time.
 */

function baseMonster(overrides: Partial<FiveEToolsMonster> = {}): FiveEToolsMonster {
  return {
    name: 'Test Beast',
    size: ['M'],
    type: 'beast',
    str: 12, dex: 14, con: 13, int: 3, wis: 11, cha: 6,
    ac: [{ ac: 13, from: ['natural armor'] }],
    hp: { average: 22, formula: '4d8 + 4' },
    speed: { walk: 30 },
    cr: '1/2',
    ...overrides,
  };
}

describe('convert5eToolsMonster — schema unions', () => {
  it('reads CR from the object form and carries the lair CR and lair XP', () => {
    const monster = baseMonster({ cr: { cr: '21', lair: '22', xpLair: 41000 } });

    const result = convert5eToolsMonster(monster);

    expect(result.baseStats.cr).toBe('21');
    expect(result.baseStats.crLair).toBe('22');
    expect(result.baseStats.xpLair).toBe(41000);
  });

  it('reads CR from the bare string form and leaves the lair fields unset', () => {
    const result = convert5eToolsMonster(baseMonster({ cr: '1/4' }));

    expect(result.baseStats.cr).toBe('1/4');
    expect(result.baseStats.crLair).toBeUndefined();
    expect(result.baseStats.xpLair).toBeUndefined();
  });

  it('expands creature-type tags whether they are strings or { tag } wrappers', () => {
    const monster = baseMonster({
      type: {
        type: 'humanoid',
        tags: ['goblinoid', { tag: 'shapechanger', prefix: 'any race', prefixHidden: true }],
      },
    });

    const result = convert5eToolsMonster(monster);

    expect(result.baseStats.creatureTypes).toEqual(['Humanoid', 'Goblinoid', 'Shapechanger']);
    expect(result.tags).toEqual(['humanoid', 'goblinoid', 'shapechanger']);
  });

  it('takes the first listed type when the stat block prints "X or Y"', () => {
    // XMM's Empyrean: { type: { choose: ["celestial", "fiend"] }, tags: ["titan"] }.
    // Before the schema pass this threw inside capitalize() and the ingest script
    // silently dropped both Empyreans from the bestiary.
    const monster = baseMonster({
      type: { type: { choose: ['celestial', 'fiend'] }, tags: ['titan'] },
    });

    const result = convert5eToolsMonster(monster);

    expect(result.baseStats.creatureTypes).toEqual(['Celestial', 'Titan']);
  });

  it('expands weighted alignment entries into their component codes', () => {
    const monster = baseMonster({
      alignment: [{ alignment: ['C', 'E'], chance: 75 }],
    });

    const result = convert5eToolsMonster(monster);

    expect(result.baseStats.alignment).toBe('Chaotic Evil');
  });

  it('still reads the plain letter alignment form', () => {
    const result = convert5eToolsMonster(baseMonster({ alignment: ['L', 'G'] }));

    expect(result.baseStats.alignment).toBe('Lawful Good');
  });

  it('turns explicit save overrides into numeric save bonuses', () => {
    const result = convert5eToolsMonster(
      baseMonster({ save: { con: '+10', int: '+12', wis: '+9' } }),
    );

    expect(result.baseStats.saveBonuses).toEqual({ con: 10, int: 12, wis: 9 });
  });

  it('derives the 2024 XMM initiative bonus from the proficiency multiplier and CR', () => {
    // CR 21 -> proficiency bonus 7; proficiency 2 -> baseInitiative 14.
    const result = convert5eToolsMonster(
      baseMonster({ cr: { cr: '21' }, initiative: { proficiency: 2 } }),
    );

    expect(result.baseStats.baseInitiative).toBe(14);
  });

  it('leaves baseInitiative at zero when the 2014 stat block has no initiative block', () => {
    expect(convert5eToolsMonster(baseMonster()).baseStats.baseInitiative).toBe(0);
  });
});

describe('parseMonsterSpellSlots', () => {
  /** The Lich's spellcasting block, trimmed to the slot table. */
  const lichSpellcasting: FiveEToolsSpellcasting[] = [
    {
      name: 'Spellcasting',
      type: 'spellcasting',
      ability: 'int',
      headerEntries: ['The lich has the following wizard spells prepared (spell save {@dc 20}):'],
      spells: {
        '0': { spells: ['{@spell mage hand}', '{@spell prestidigitation}'] },
        '1': { slots: 4, spells: ['{@spell magic missile}', '{@spell shield}'] },
        '2': { slots: 3, spells: ['{@spell invisibility}'] },
        '9': { slots: 1, spells: ['{@spell power word kill}'] },
      },
    },
  ];

  it('returns the per-level slot pool and excludes cantrips', () => {
    expect(parseMonsterSpellSlots(lichSpellcasting)).toEqual({ 1: 4, 2: 3, 9: 1 });
  });

  it('returns undefined for an at-will-only caster', () => {
    const willOnly: FiveEToolsSpellcasting[] = [
      { ability: 'cha', headerEntries: [], will: ['{@spell darkness}'] },
    ];

    expect(parseMonsterSpellSlots(willOnly)).toBeUndefined();
  });

  it('returns undefined for an N/Day-only caster', () => {
    const dailyOnly: FiveEToolsSpellcasting[] = [
      { ability: 'cha', headerEntries: [], daily: { '1e': ['{@spell fireball}'] } },
    ];

    expect(parseMonsterSpellSlots(dailyOnly)).toBeUndefined();
  });

  it('returns undefined when the creature has no spellcasting at all', () => {
    expect(parseMonsterSpellSlots(undefined)).toBeUndefined();
    expect(parseMonsterSpellSlots([])).toBeUndefined();
  });

  it('ignores levels outside 1-9 and non-positive slot counts', () => {
    const odd: FiveEToolsSpellcasting[] = [
      {
        spells: {
          '0': { slots: 4, spells: ['{@spell light}'] },
          '3': { slots: 0, spells: ['{@spell fireball}'] },
          '4': { slots: 2, spells: ['{@spell blight}'] },
        },
      },
    ];

    expect(parseMonsterSpellSlots(odd)).toEqual({ 4: 2 });
  });
});

describe('parseSpellcasting — slot-based prepared spells', () => {
  const block: FiveEToolsSpellcasting[] = [
    {
      ability: 'int',
      headerEntries: ['Spell save {@dc 20}.'],
      spells: {
        '0': { spells: ['{@spell ray of frost}'] },
        '1': { slots: 4, spells: ['{@spell magic missile}'] },
      },
    },
  ];

  it('stamps the spell level onto the ability cost so the engine can charge a slot', () => {
    const abilities = parseSpellcasting(block);

    const missile = abilities.find(a => a.name === 'Magic Missile');
    expect(missile?.cost.spellSlotLevel).toBe(1);

    const cantrip = abilities.find(a => a.name === 'Ray of Frost');
    expect(cantrip?.cost.spellSlotLevel).toBe(0);
  });

  it('reads the save DC out of the block header entries', () => {
    expect(parseSpellcasting(block)[0].saveDC).toBe(20);
  });
});
