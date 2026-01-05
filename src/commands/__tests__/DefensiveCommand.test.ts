import { describe, expect, it } from 'vitest';
import { DefensiveCommand } from '../effects/DefensiveCommand';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState, Position } from '@/types/combat';
import type { DefensiveEffect } from '@/types/spells';
import type { Class, GameState } from '@/types';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/factories';

const baseStats = {
  strength: 10,
  dexterity: 12,
  constitution: 12,
  intelligence: 10,
  wisdom: 10,
  charisma: 8,
  baseInitiative: 0,
  speed: 30,
  cr: '0'
};

const baseEconomy = {
  action: { used: false, remaining: 1 },
  bonusAction: { used: false, remaining: 1 },
  reaction: { used: false, remaining: 1 },
  movement: { used: 0, total: 30 },
  freeActions: 0
};

const mockClass: Class = {
  id: 'wizard',
  name: 'Wizard',
  description: 'A prepared arcane caster.',
  hitDie: 6,
  primaryAbility: ['Intelligence'],
  savingThrowProficiencies: ['Intelligence', 'Wisdom'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: []
};

const makeCharacter = (id: string, position: Position): CombatCharacter => ({
  id,
  name: id,
  level: 5,
  class: mockClass,
  position,
  stats: { ...baseStats },
  abilities: [],
  team: 'player',
  currentHP: 18,
  maxHP: 18,
  initiative: 0,
  statusEffects: [],
  conditions: [],
  actionEconomy: { ...baseEconomy },
  armorClass: 12,
  activeEffects: [],
  tempHP: 5
});

const makeState = (characters: CombatCharacter[]): CombatState => ({
  isActive: true,
  characters,
  turnState: {
    currentTurn: 2,
    turnOrder: characters.map(c => c.id),
    currentCharacterId: characters[0]?.id ?? null,
    phase: 'action',
    actionsThisTurn: []
  },
  selectedCharacterId: null,
  selectedAbilityId: null,
  actionMode: 'select',
  validTargets: [],
  validMoves: [],
  combatLog: [],
  reactiveTriggers: [],
  activeLightSources: []
});

const makeContext = (caster: CombatCharacter, targets: CombatCharacter[]): CommandContext => ({
  spellId: 'defensive-spell',
  spellName: 'Defensive Spell',
  castAtLevel: 1,
  caster,
  targets,
  // TODO(lint-intent): Preserve stub until command context consumes more of GameState; supply minimal shape to keep intent visible.
  gameState: createMockGameState({
    party: [createMockPlayerCharacter({
      id: caster.id,
      name: caster.name,
      // TODO: merge combat + overworld actor models so defensive buffs persist across modes.
    })],
    currentEnemies: targets,
    currentLocationId: 'arena',
    subMapCoordinates: { x: 0, y: 0 },
    mapData: null
  }) as GameState
});

describe('DefensiveCommand', () => {
  it('adds an AC bonus and tracks the active effect', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = makeCharacter('target', { x: 1, y: 0 });
    const state = makeState([caster, target]);

    const effect: DefensiveEffect = {
      type: 'DEFENSIVE',
      defenseType: 'ac_bonus',
      value: 5,
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const command = new DefensiveCommand(effect, makeContext(caster, [target]));
    const result = command.execute(state);

    const updated = result.characters.find(c => c.id === 'target');
    expect(updated?.armorClass).toBe(17);
    // DefensiveCommand stores effect type as 'buff' with the mechanic in mechanics.acBonus
    expect(updated?.activeEffects?.[0]?.type).toBe('buff');
    expect(updated?.activeEffects?.[0]?.mechanics?.acBonus).toBe(5);
  });

  it('keeps the higher temporary HP value instead of stacking', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = makeCharacter('target', { x: 1, y: 0 });
    const state = makeState([caster, target]);

    const effect: DefensiveEffect = {
      type: 'DEFENSIVE',
      defenseType: 'temporary_hp',
      value: 3,
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const command = new DefensiveCommand(effect, makeContext(caster, [target]));
    const result = command.execute(state);

    const updated = result.characters.find(c => c.id === 'target');
    expect(updated?.tempHP).toBe(5);
    expect(result.combatLog.at(-1)?.message).toContain('temporary HP');
  });

  it('calculates set_base_ac correctly including Dexterity modifier', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = makeCharacter('target', { x: 1, y: 0 });
    // Target has Dex 12 (+1 mod)
    // Base AC is 12 (from makeCharacter default which assumes some armor or natural)
    const state = makeState([caster, target]);

    const effect: DefensiveEffect = {
      type: 'DEFENSIVE',
      defenseType: 'set_base_ac',
      value: 13, // e.g., Mage Armor
      duration: { type: 'rounds', value: 8 * 60 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const command = new DefensiveCommand(effect, makeContext(caster, [target]));
    const result = command.execute(state);

    const updated = result.characters.find(c => c.id === 'target');
    // Expected: 13 (base) + 1 (Dex) = 14
    expect(updated?.armorClass).toBe(14);
    // DefensiveCommand stores effect type as 'buff'; the set_base_ac is tracked by the effect existing
    expect(updated?.activeEffects?.[0]?.type).toBe('buff');
    expect(updated?.activeEffects?.[0]?.sourceName).toBe('Defensive Spell');
  });
});
