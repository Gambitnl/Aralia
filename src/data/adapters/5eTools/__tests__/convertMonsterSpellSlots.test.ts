import { describe, it, expect } from 'vitest';
import { convert5eToolsMonster } from '../index';
import type { FiveEToolsMonster, FiveEToolsSpellcasting } from '../types';

/**
 * Pins the last link of the monster spell-slot chain: the adapter orchestrator
 * must carry `parseMonsterSpellSlots` output onto MonsterData.spellSlots, so
 * ingested slot casters reach createEnemyFromMonster with a real pool.
 */

function baseMonster(overrides: Partial<FiveEToolsMonster> = {}): FiveEToolsMonster {
  return {
    name: 'Test Mage',
    size: ['M'],
    type: 'humanoid',
    str: 9, dex: 14, con: 11, int: 17, wis: 12, cha: 11,
    ac: [{ ac: 12, from: ['{@spell mage armor}'] }],
    hp: { average: 40, formula: '9d8' },
    speed: { walk: 30 },
    cr: '6',
    ...overrides,
  };
}

/** A Mage's spellcasting block, trimmed to the slot table. */
const mageSpellcasting: FiveEToolsSpellcasting[] = [
  {
    name: 'Spellcasting',
    type: 'spellcasting',
    ability: 'int',
    headerEntries: ['The mage has the following wizard spells prepared (spell save {@dc 14}):'],
    spells: {
      '0': { spells: ['{@spell fire bolt}', '{@spell light}'] },
      '1': { slots: 4, spells: ['{@spell mage armor}', '{@spell magic missile}'] },
      '2': { slots: 3, spells: ['{@spell misty step}'] },
      '3': { slots: 3, spells: ['{@spell counterspell}', '{@spell fireball}'] },
      '4': { slots: 3, spells: ['{@spell greater invisibility}'] },
      '5': { slots: 1, spells: ['{@spell cone of cold}'] },
    },
  },
];

describe('convert5eToolsMonster — spell slots', () => {
  it('carries the parsed slot pool onto MonsterData.spellSlots', () => {
    const result = convert5eToolsMonster(baseMonster({ spellcasting: mageSpellcasting }));

    expect(result.spellSlots).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 });
  });

  it('leaves spellSlots undefined for an at-will-only caster', () => {
    const willOnly: FiveEToolsSpellcasting[] = [
      {
        name: 'Spellcasting',
        ability: 'cha',
        headerEntries: ['The creature casts the following spells:'],
        will: ['{@spell darkness}', '{@spell detect magic}'],
      },
    ];

    const result = convert5eToolsMonster(baseMonster({ spellcasting: willOnly }));

    expect(result.spellSlots).toBeUndefined();
  });

  it('leaves spellSlots undefined for a monster with no spellcasting block', () => {
    expect(convert5eToolsMonster(baseMonster()).spellSlots).toBeUndefined();
  });
});
