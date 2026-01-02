import { describe, expect, it, vi } from 'vitest';
import { HealingCommand } from '../effects/HealingCommand';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState, Position } from '@/types/combat';
import type { HealingEffect } from '@/types/spells';
import type { Class, GameState } from '@/types';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/factories';

const baseStats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
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
  id: 'cleric',
  name: 'Cleric',
  description: 'A divine healer.',
  hitDie: 8,
  primaryAbility: ['Wisdom'],
  savingThrowProficiencies: ['Wisdom', 'Charisma'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: [],
  features: []
};

const makeCharacter = (id: string, position: Position): CombatCharacter => ({
  id,
  name: id,
  level: 2,
  class: mockClass,
  position,
  stats: { ...baseStats },
  abilities: [],
  team: 'player',
  currentHP: 7,
  maxHP: 10,
  initiative: 0,
  statusEffects: [],
  conditions: [],
  actionEconomy: { ...baseEconomy }
});

const makeState = (characters: CombatCharacter[]): CombatState => ({
  isActive: true,
  characters,
  turnState: {
    currentTurn: 1,
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
  spellId: 'cure-wounds',
  spellName: 'Cure Wounds',
  castAtLevel: 1,
  caster,
  targets,
  // TODO(lint-intent): Provide minimal game state for now; future healing effects may need richer context.
  gameState: createMockGameState({
    party: [caster, ...targets].map(targetAsCompanion => createMockPlayerCharacter({
      id: targetAsCompanion.id,
      name: targetAsCompanion.name,
      // TODO: when combat + overworld models merge, carry HP state through a shared shape instead of casting.
    })),
    currentLocationId: 'arena',
    subMapCoordinates: { x: 0, y: 0 },
    mapData: null
  }) as GameState
});

describe('HealingCommand', () => {
  it('heals the target and caps at max HP', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = { ...makeCharacter('target', { x: 1, y: 0 }), currentHP: 5 };
    const state = makeState([caster, target]);

    const effect: HealingEffect = {
      type: 'HEALING',
      healing: { dice: '1d8' },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    // Control randomness so the roll is deterministic (1d8 -> 5)
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const command = new HealingCommand(effect, makeContext(caster, [target]));
    const result = command.execute(state);
    vi.restoreAllMocks();

    const updated = result.characters.find(c => c.id === 'target');
    expect(updated?.currentHP).toBe(10); // 5 + 5 healing, but capped at maxHP 10
    expect(result.combatLog.some(entry => entry.type === 'heal')).toBe(true);
  });
});
