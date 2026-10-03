/**
 * Proves that the Design Preview Dev Player stays data-backed and disposable.
 *
 * The Battle Map panel calls the helper under test when an operator changes a
 * selector. These checks protect the important contract: valid class/race data
 * is retained, invalid early subclasses are cleared, and caster playtests are
 * given every class spell without changing ordinary character creation.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASSES_DATA } from '../../../data/classes';
import { ACTIVE_RACES } from '../../../data/races';
import type { Spell } from '../../../types/spells';
import { createPlayerCombatCharacter } from '../../combat/combatUtils';
import {
  buildDevPlayer,
  DEV_PLAYER_RACE_IDS,
  getDevPlayerReview,
  normalizeDevPlayerConfiguration,
} from '../devPlayer';

// ============================================================================
// Preview Configuration Rules
// ============================================================================
// These checks use a wizard because it has a level-three subclass and a class
// spell list, exercising each part of the fluid character contract together.
// ============================================================================

describe('Dev Player preview configuration', () => {
  it('builds the chosen race, class, level, and compatible subclass', () => {
    const character = buildDevPlayer({
      raceId: 'human',
      classId: 'wizard',
      level: 3,
      subclassId: 'evocation',
    });

    expect(character.race.id).toBe('human');
    expect(character.class.id).toBe('wizard');
    expect(character.level).toBe(3);
    expect(character.subclassId).toBe('evocation');
    expect(character.devPlaytest?.unlimitedSpellSlots).toBe(true);
  });

  it('clears an early subclass rather than carrying an invalid choice forward', () => {
    expect(normalizeDevPlayerConfiguration({
      raceId: 'human',
      classId: 'wizard',
      level: 2,
      subclassId: 'evocation',
    }).subclassId).toBeUndefined();
  });

  it('offers only the race records the character creator marks selectable', () => {
    const activeRaceIds = ACTIVE_RACES.map((race) => race.id);

    expect(DEV_PLAYER_RACE_IDS).toEqual(activeRaceIds);
    // Elf is a chooser-only family record; playable lineages such as High Elf
    // remain in ACTIVE_RACES and therefore remain available to the panel.
    expect(DEV_PLAYER_RACE_IDS).not.toContain('elf');
    expect(normalizeDevPlayerConfiguration({
      raceId: 'elf',
      classId: 'fighter',
      level: 1,
    }).raceId).toBe('human');
  });

  it('exposes every selected caster class spell for the preview', () => {
    const configuration = {
      raceId: 'human',
      classId: 'wizard',
      level: 1,
    };
    const character = buildDevPlayer(configuration);
    const review = getDevPlayerReview(configuration);
    const classSpellIds = CLASSES_DATA.wizard.spellcasting?.spellList ?? [];

    expect(character.spellbook?.preparedSpells).toEqual(classSpellIds);
    expect(review.spellIds).toEqual([...classSpellIds].sort());
  });

  it('keeps source casting times as action, bonus, and reaction costs', () => {
    // SpellContext gives the live Battle Map this same bundle. Hydrating the
    // complete Wizard list here proves the preview exception expands access
    // without rewriting how any spell spends the turn.
    const allSpells = JSON.parse(
      readFileSync('public/data/spells_bundle.json', 'utf8'),
    ) as Record<string, Spell>;
    const combatant = createPlayerCombatCharacter(buildDevPlayer({
      raceId: 'human',
      classId: 'wizard',
      level: 20,
    }), allSpells);
    const spellAbilities = combatant.abilities.filter((ability) => ability.type === 'spell');

    const expectedCost = (spell: Spell): 'action' | 'bonus' | 'reaction' => {
      const castingUnit = typeof spell.castingTime === 'string'
        ? spell.castingTime
        : spell.castingTime?.unit ?? '';
      const normalizedUnit = String(castingUnit).toLowerCase();
      if (normalizedUnit.includes('bonus')) return 'bonus';
      if (normalizedUnit.includes('reaction')) return 'reaction';
      return 'action';
    };

    // Check every hydrated class spell, then require all three turn-cost lanes
    // so a silently collapsed bonus or reaction mapping cannot pass the test.
    for (const ability of spellAbilities) {
      expect(ability.cost.type).toBe(expectedCost(allSpells[ability.id]));
    }
    expect(new Set(spellAbilities.map((ability) => ability.cost.type)))
      .toEqual(new Set(['action', 'bonus', 'reaction']));
  });
});
