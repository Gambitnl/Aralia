import { describe, expect, it } from 'vitest';
import { DefensiveCommand } from '../effects/DefensiveCommand';
import { DamageCommand } from '../effects/DamageCommand';
import { BreakConcentrationCommand } from '../effects/ConcentrationCommands';
import type { CommandContext } from '../base/SpellCommand';
import type { ActiveEffect, CombatCharacter, CombatState, Position } from '@/types/combat';
import type { DamageEffect, DefensiveEffect } from '@/types/spells';
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
  legendary: { used: 0, total: 0 },
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

    mapData: null
  }) as GameState
});

describe('DefensiveCommand', () => {
  it('adds an AC bonus and tracks the active effect', async () => {
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
    const result = await command.execute(state);

    const updated = result.characters.find(c => c.id === 'target');
    expect(updated?.armorClass).toBe(17);
    // DefensiveCommand stores effect type as 'buff' with the mechanic in mechanics.acBonus
    expect(updated?.activeEffects?.[0]?.type).toBe('buff');
    expect(updated?.activeEffects?.[0]?.mechanics?.acBonus).toBe(5);
  });

  it('stores exactly one chosen damage type for Resistance and keeps the rider structured', async () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = makeCharacter('target', { x: 1, y: 0 });
    const state = makeState([caster, target]);

    const effect: DefensiveEffect = {
      type: 'DEFENSIVE',
      defenseType: 'damage_reduction',
      damageType: ['acid', 'fire', 'cold'],
      damageTypeSource: 'chosen_damage_type',
      damageReduction: {
        dice: '1d4',
        appliesTo: 'damage_taken',
        frequency: 'once_per_turn'
      },
      duration: { type: 'rounds', value: 10 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const command = new DefensiveCommand(effect, {
      ...makeContext(caster, [target]),
      spellId: 'resistance',
      spellName: 'Resistance',
      playerInput: 'Fire'
    });
    const result = await command.execute(state);

    const updated = result.characters.find(c => c.id === 'target');
    const activeEffect = updated?.activeEffects?.find(effectEntry => effectEntry.spellId === 'resistance');

    // Resistance should not flatten into the permanent resistances array.
    expect(updated?.resistances ?? []).toEqual([]);
    expect(activeEffect?.mechanics?.damageResistance).toBeUndefined();
    expect(activeEffect?.mechanics?.damageReduction).toMatchObject({
      dice: '1d4',
      appliesTo: 'damage_taken',
      frequency: 'once_per_turn',
      damageType: 'fire'
    });
    expect(result.combatLog.at(-1)?.message).toContain('prepares fire damage reduction');
  });

  it('spends Resistance only on the chosen damage type and only once per turn', async () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = {
      ...makeCharacter('target', { x: 1, y: 0 }),
      tempHP: 0,
      activeEffects: [{
        id: 'resistance-fire',
        spellId: 'resistance',
        casterId: caster.id,
        sourceName: 'Resistance',
        type: 'buff',
        duration: { type: 'minutes', value: 1 },
        startTime: 2,
        mechanics: {
          damageReduction: {
            dice: '1d4',
            appliesTo: 'damage_taken',
            frequency: 'once_per_turn',
            damageType: 'Fire'
          }
        }
      } as ActiveEffect]
    };
    const state = makeState([caster, target]);
    const fireDamage: DamageEffect = {
      type: 'DAMAGE',
      damage: { dice: '1d1', type: 'Fire' },
      trigger: { type: 'immediate' },
      condition: { type: 'hit' }
    };
    const coldDamage: DamageEffect = {
      ...fireDamage,
      damage: { dice: '1d1', type: 'Cold' }
    };

    const firstFire = await new DamageCommand(fireDamage, makeContext(caster, [target])).execute(state);
    const afterFirst = firstFire.characters.find(c => c.id === 'target');
    expect(afterFirst?.currentHP).toBe(18);
    expect(afterFirst?.activeEffects?.[0]?.mechanics?.damageReduction?.lastAppliedTurn).toBe(2);

    const secondFire = await new DamageCommand(fireDamage, makeContext(caster, [afterFirst!])).execute(firstFire);
    const afterSecond = secondFire.characters.find(c => c.id === 'target');
    expect(afterSecond?.currentHP).toBe(17);

    const nextTurnState = {
      ...secondFire,
      turnState: { ...secondFire.turnState, currentTurn: 3 },
      characters: secondFire.characters.map(character =>
        character.id === 'target'
          ? { ...character, currentHP: 18 }
          : character
      )
    };
    const nextTurnTarget = nextTurnState.characters.find(c => c.id === 'target')!;
    const nextTurnFire = await new DamageCommand(fireDamage, makeContext(caster, [nextTurnTarget])).execute(nextTurnState);
    expect(nextTurnFire.characters.find(c => c.id === 'target')?.currentHP).toBe(18);

    const coldState = {
      ...state,
      characters: [caster, { ...target, currentHP: 18 }]
    };
    const coldTarget = coldState.characters.find(c => c.id === 'target')!;
    const coldResult = await new DamageCommand(coldDamage, makeContext(caster, [coldTarget])).execute(coldState);
    expect(coldResult.characters.find(c => c.id === 'target')?.currentHP).toBe(17);
  });

  it('replaces an older Resistance choice instead of stacking damage-reduction riders', async () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = makeCharacter('target', { x: 1, y: 0 });
    const state = makeState([caster, target]);
    const effect: DefensiveEffect = {
      type: 'DEFENSIVE',
      defenseType: 'damage_reduction',
      damageType: ['Acid', 'Fire', 'Cold'],
      damageTypeSource: 'chosen_damage_type',
      damageReduction: {
        dice: '1d4',
        appliesTo: 'damage_taken',
        frequency: 'once_per_turn'
      },
      duration: { type: 'minutes', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const fireState = await new DefensiveCommand(effect, {
      ...makeContext(caster, [target]),
      spellId: 'resistance',
      spellName: 'Resistance',
      playerInput: 'Fire'
    }).execute(state);
    const fireTarget = fireState.characters.find(c => c.id === 'target')!;
    const coldState = await new DefensiveCommand(effect, {
      ...makeContext(caster, [fireTarget]),
      spellId: 'resistance',
      spellName: 'Resistance',
      playerInput: 'Cold'
    }).execute(fireState);
    const updated = coldState.characters.find(c => c.id === 'target');
    const resistanceEffects = updated?.activeEffects?.filter(effectEntry => effectEntry.spellId === 'resistance') ?? [];

    // Recasting Resistance is a replacement, not a stack. Only the newest
    // chosen damage type should survive on the target.
    expect(resistanceEffects).toHaveLength(1);
    expect(resistanceEffects[0].mechanics?.damageReduction?.damageType).toBe('Cold');
  });

  it('removes Resistance damage-reduction mirrors when concentration breaks', async () => {
    const caster = {
      ...makeCharacter('caster', { x: 0, y: 0 }),
      concentratingOn: {
        spellId: 'resistance',
        spellName: 'Resistance',
        spellLevel: 0,
        startedTurn: 2,
        effectIds: [],
        canDropAsFreeAction: true
      }
    };
    const target = {
      ...makeCharacter('target', { x: 1, y: 0 }),
      activeEffects: [{
        id: 'resistance-fire',
        spellId: 'resistance',
        casterId: caster.id,
        sourceName: 'Resistance',
        type: 'buff',
        duration: { type: 'minutes', value: 1 },
        startTime: 2,
        mechanics: {
          damageReduction: {
            dice: '1d4',
            appliesTo: 'damage_taken',
            frequency: 'once_per_turn',
            damageType: 'Fire'
          }
        }
      } as ActiveEffect]
    };
    const state = makeState([caster, target]);
    const result = await new BreakConcentrationCommand({
      ...makeContext(caster, []),
      spellId: 'resistance',
      spellName: 'Resistance'
    }).execute(state);

    // Resistance lives as a spell-linked activeEffect. Breaking concentration
    // must remove that mirror so later fire damage does not keep reducing.
    expect(result.characters.find(c => c.id === 'target')?.activeEffects).toEqual([]);
    expect(result.characters.find(c => c.id === 'caster')?.concentratingOn).toBeUndefined();
  });

  it('keeps the higher temporary HP value instead of stacking', async () => {
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
    const result = await command.execute(state);

    const updated = result.characters.find(c => c.id === 'target');
    expect(updated?.tempHP).toBe(5);
    expect(result.combatLog.at(-1)?.message).toContain('temporary HP');
  });

  it('records which spell granted temporary HP when the grant is accepted', async () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = {
      ...makeCharacter('target', { x: 1, y: 0 }),
      tempHP: 0
    };
    const state = makeState([caster, target]);

    const effect: DefensiveEffect = {
      type: 'DEFENSIVE',
      defenseType: 'temporary_hp',
      value: 5,
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    };

    const command = new DefensiveCommand(effect, {
      ...makeContext(caster, [target]),
      spellId: 'armor-of-agathys',
      spellName: 'Armor of Agathys'
    });
    const result = await command.execute(state);

    const updated = result.characters.find(c => c.id === 'target');
    expect(updated?.tempHP).toBe(5);
    // Armor-style retaliation needs to know whether the remaining temporary
    // HP came from that same spell, not from a generic racial trait or another
    // defensive effect.
    expect(updated?.temporaryHitPointSource).toEqual({
      spellId: 'armor-of-agathys',
      spellName: 'Armor of Agathys',
      casterId: caster.id
    });
  });

  it('calculates set_base_ac correctly including Dexterity modifier', async () => {
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
    const result = await command.execute(state);

    const updated = result.characters.find(c => c.id === 'target');
    // Expected: 13 (base) + 1 (Dex) = 14
    expect(updated?.armorClass).toBe(14);
    // DefensiveCommand stores effect type as 'buff'; the set_base_ac is tracked by the effect existing
    expect(updated?.activeEffects?.[0]?.type).toBe('buff');
    expect(updated?.activeEffects?.[0]?.sourceName).toBe('Defensive Spell');
  });

  it('applies Shield-style force immunity as combat state and active-effect mechanics', async () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 });
    const target = makeCharacter('target', { x: 1, y: 0 });
    const state = makeState([caster, target]);

    const effect: DefensiveEffect = {
      type: 'DEFENSIVE',
      defenseType: 'immunity',
      damageType: ['force'],
      value: 0,
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      reactionTrigger: {
        event: 'when_targeted',
        includesSpells: ['magic-missile']
      }
    };

    const command = new DefensiveCommand(effect, {
      ...makeContext(caster, [target]),
      spellId: 'shield',
      spellName: 'Shield'
    });
    const result = await command.execute(state);

    const updated = result.characters.find(c => c.id === 'target');
    // Shield has a second structured row for Magic Missile. This proves that
    // row becomes real force immunity in combat state, not just dormant JSON.
    expect(updated?.immunities).toContain('force');
    expect(updated?.activeEffects?.[0]?.mechanics?.damageImmunity).toEqual(['force']);
    expect(result.combatLog.at(-1)?.message).toContain('immunity');
  });
});
