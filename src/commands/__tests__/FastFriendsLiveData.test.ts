import { describe, expect, it, vi } from 'vitest';
import { GrantedActionCommand } from '../effects/GrantedActionCommand';
import { StatusConditionCommand } from '../effects/StatusConditionCommand';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState, Position } from '@/types/combat';
import type { StatusConditionEffect } from '@/types/spells';
import fastFriends from '../../../public/data/spells/level-3/fast-friends.json';

/**
 * This file proves the live Fast Friends request lifecycle from source data to
 * an executable follow-up action. It covers the initial status bridge, friendly
 * service acceptance, the fighting-target Advantage repeat save, and the
 * certain-death early ending rule.
 *
 * Called by: Vitest as focused G14 runtime proof.
 * Depends on: Fast Friends JSON, StatusConditionCommand, and GrantedActionCommand.
 */

// ============================================================================
// Combat Fixtures
// ============================================================================
// These fixtures intentionally contain only the fields needed by condition,
// save, and concentration cleanup code so the test does not depend on a full
// rendered encounter or a separate scenario harness.
// ============================================================================
const makeCharacter = (id: string, position: Position, team: CombatCharacter['team']): CombatCharacter => ({
  id,
  name: id,
  level: 5,
  class: {} as CombatCharacter['class'],
  position,
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 18,
    baseInitiative: 0,
    speed: 30,
    cr: '1'
  },
  abilities: [],
  team,
  currentHP: 20,
  maxHP: 20,
  initiative: 0,
  statusEffects: [],
  conditions: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    legendary: { used: 0, total: 0 },
    movement: { used: 0, total: 30 },
    freeActions: 0
  }
});

const makeState = (characters: CombatCharacter[]): CombatState => ({
  isActive: true,
  characters,
  turnState: {
    currentTurn: 1,
    turnOrder: characters.map(character => character.id),
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

const makeContext = (
  caster: CombatCharacter,
  target: CombatCharacter,
  playerInput?: string
): CommandContext => ({
  spellId: 'fast-friends',
  spellName: 'Fast Friends',
  castAtLevel: 3,
  caster,
  targets: [target],
  gameState: {},
  playerInput
} as unknown as CommandContext);

const fastFriendsStatusEffect = fastFriends.effects.find(effect => effect.type === 'STATUS_CONDITION') as unknown as StatusConditionEffect;

// ============================================================================
// Status Setup
// ============================================================================
// Apply the authored Charmed status once, then attach the concentration record
// that the real cast pipeline would create around the status command.
// ============================================================================
const applyFastFriends = async (caster: CombatCharacter, target: CombatCharacter): Promise<CombatState> => {
  const state = makeState([caster, target]);
  const applied = await new StatusConditionCommand(fastFriendsStatusEffect, makeContext(caster, target)).execute(state);
  const appliedTarget = applied.characters.find(character => character.id === target.id)!;
  const statusId = appliedTarget.statusEffects.find(effect => effect.sourceSpellId === 'fast-friends' || effect.socialLifecycle?.kind === 'fast_friends')?.id;

  return {
    ...applied,
    characters: applied.characters.map(character => character.id === caster.id
      ? {
        ...character,
        concentratingOn: {
          spellId: 'fast-friends',
          spellName: 'Fast Friends',
          spellLevel: 3,
          startedTurn: 1,
          canDropAsFreeAction: true,
          effectIds: statusId ? [statusId] : []
        }
      }
      : character)
  };
};

describe('Fast Friends live service request', () => {
  it('preserves the authored follow-up action and repeat-save metadata', async () => {
    expect(fastFriendsStatusEffect.grantedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'Request Service',
        socialServiceRequest: 'fast_friends',
        targeting: 'single_any'
      })
    ]));

    const caster = makeCharacter('caster', { x: 0, y: 0 }, 'player');
    const target = makeCharacter('target', { x: 2, y: 0 }, 'enemy');
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const state = await applyFastFriends(caster, target);
    const appliedTarget = state.characters.find(character => character.id === target.id)!;
    const status = appliedTarget.statusEffects.find(effect => effect.socialLifecycle?.kind === 'fast_friends');

    expect(status?.repeatSave).toEqual(expect.objectContaining({
      timing: 'on_social_service_request',
      saveType: 'Wisdom',
      successEnds: true,
      modifiers: { advantageWhenCasterOrCompanionsFightingTarget: true }
    }));
    expect(status?.socialLifecycle?.service).toEqual(expect.objectContaining({
      targetPerformsRequestedServices: true,
      requestCannotCauseCertainDeath: true
    }));

    vi.restoreAllMocks();
  });

  it('accepts friendly service and ends on a successful fighting-target repeat save', async () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 }, 'player');
    const target = makeCharacter('target', { x: 2, y: 0 }, 'enemy');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const state = await applyFastFriends(caster, target);

    const friendlyState = await new GrantedActionCommand(makeContext(caster, target, 'carry the supplies'), {
      socialServiceRequest: 'fast_friends'
    }).execute(state);
    expect(friendlyState.combatLog.at(-1)?.data?.outcome).toBe('service_accepted');

    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const harmfulState = await new GrantedActionCommand(makeContext(caster, target, 'attack the guard'), {
      socialServiceRequest: 'fast_friends'
    }).execute(friendlyState);

    expect(harmfulState.characters.find(character => character.id === target.id)?.statusEffects).toHaveLength(0);
    expect(harmfulState.characters.find(character => character.id === target.id)?.socialAwareness).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'post_charm_awareness' })
    ]));
    expect(harmfulState.combatLog.some(entry => entry.data?.outcome === 'spell_ended_repeat_save')).toBe(true);
    expect(harmfulState.combatLog.some(entry => entry.data?.outcome === 'repeat_save_succeeded' && entry.data?.advantageFromCombat === true)).toBe(true);

    vi.restoreAllMocks();
  });

  it('ends immediately when the requested activity would cause certain death', async () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 }, 'player');
    const target = makeCharacter('target', { x: 2, y: 0 }, 'enemy');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const state = await applyFastFriends(caster, target);

    const ended = await new GrantedActionCommand(makeContext(caster, target, 'walk into certain death'), {
      socialServiceRequest: 'fast_friends'
    }).execute(state);

    expect(ended.characters.find(character => character.id === target.id)?.statusEffects).toHaveLength(0);
    expect(ended.combatLog.some(entry => entry.data?.outcome === 'spell_ended_certain_death')).toBe(true);
    expect(ended.characters.find(character => character.id === caster.id)?.concentratingOn).toBeUndefined();

    vi.restoreAllMocks();
  });
});
