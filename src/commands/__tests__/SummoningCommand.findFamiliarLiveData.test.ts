import { describe, expect, it } from 'vitest';
import { SummoningCommand } from '../effects/SummoningCommand';
import type { CommandContext } from '../base/SpellCommand';
import { findTouchDeliveryActor } from '../../hooks/combat/useTargetValidator';
import type { Ability, CombatCharacter, CombatState } from '../../types/combat';
import type { SummoningEffect } from '../../types/spells';
import findFamiliar from '../../../public/data/spells/level-1/find-familiar.json';

/**
 * This file proves the live Find Familiar spell data reaches summon metadata.
 *
 * The touch-delivery validator reads permissions from the summoned actor, not
 * directly from spell JSON. This focused proof executes the summon command with
 * the real Find Familiar packet and checks that the actor receives the shared
 * touch-delivery permission, range, and reaction-cost metadata.
 *
 * Called by: focused summon runtime tests.
 * Depends on: SummoningCommand and the public Find Familiar spell packet.
 */

describe('SummoningCommand live Find Familiar metadata bridge', () => {
  it('stores live touch-delivery permissions on the summoned familiar actor', () => {
    const caster = {
      id: 'find-familiar-caster',
      name: 'Find Familiar Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      currentHP: 20,
      maxHP: 20
    } as unknown as CombatCharacter;
    const summonEffect = findFamiliar.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: findFamiliar.id,
      spellName: findFamiliar.name,
      castAtLevel: 1,
      caster,
      targets: [],
      playerInput: 'Owl',
      gameState: {}
    } as CommandContext;
    const state = {
      characters: [caster],
      currentTurn: 1,
      round: 1,
      combatLog: []
    } as CombatState;

    // The command should copy Find Familiar's live action permissions onto the
    // created actor. Later target validation should not need to reopen spell
    // JSON to know the familiar can deliver touch spells by spending Reaction.
    const command = new SummoningCommand(summonEffect, context);
    const nextState = command.execute(state);
    const summonedActor = nextState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === findFamiliar.id
    );

    expect(summonedActor).toBeDefined();
    const createdFamiliar = summonedActor as CombatCharacter;

    expect(summonedActor?.summonMetadata).toEqual(expect.objectContaining({
      formName: 'Owl',
      entityType: 'familiar',
      sourceName: findFamiliar.name,
      actionPermissions: expect.objectContaining({
        canDeliverTouchSpells: true,
        touchDeliveryRangeFeet: 100,
        touchDeliveryCost: 'reaction'
      }),
      telepathyRange: 100,
      sharedSenses: true,
      dismissable: true
    }));

    const touchSpellAbility: Ability = {
      id: 'live-cure-wounds-like',
      name: 'Live Cure Wounds Like',
      description: 'A live touch spell proxy used to prove command-created familiar delivery.',
      type: 'spell',
      cost: { type: 'action' },
      targeting: 'single_any',
      range: 1,
      effects: [{ type: 'heal', value: 1 }],
      spell: {
        range: {
          type: 'touch'
        }
      }
    };
    const touchTarget = {
      id: 'live-touch-target',
      name: 'Live Touch Target',
      team: 'player',
      position: {
        x: createdFamiliar.position.x + 1,
        y: createdFamiliar.position.y
      },
      currentHP: 10,
      maxHP: 10
    } as unknown as CombatCharacter;

    // This proves the actor created by SummoningCommand is not merely carrying
    // decorative metadata. The shared delivery helper can use that exact actor
    // as the touch-spell origin, then rejects the same actor once its declared
    // Find Familiar Reaction has already been spent.
    expect(findTouchDeliveryActor(touchSpellAbility, caster, touchTarget, [
      ...nextState.characters,
      touchTarget
    ])).toMatchObject({
      deliveryActor: expect.objectContaining({ id: createdFamiliar.id }),
      targetDistance: 1
    });
    expect(findTouchDeliveryActor(touchSpellAbility, caster, touchTarget, [
      caster,
      {
        ...createdFamiliar,
        actionEconomy: {
          ...createdFamiliar.actionEconomy,
          reaction: { used: true, remaining: 0 }
        }
      } as CombatCharacter,
      touchTarget
    ])).toBeNull();
  });
});
