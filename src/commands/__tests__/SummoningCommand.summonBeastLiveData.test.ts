import { describe, expect, it } from 'vitest';
import { SummoningCommand } from '../effects/SummoningCommand';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState } from '../../types/combat';
import type { SummoningEffect } from '../../types/spells';
import summonBeast from '../../../public/data/spells/level-2/summon-beast.json';

/**
 * This file proves the live Summon Beast spell data reaches summon metadata.
 *
 * The movement and opportunity-attack tests can only trust selected form
 * metadata if the summon command copies it from the real spell packet when the
 * player chooses Air, Land, or Water. These focused checks execute the command
 * with live Summon Beast data and inspect the created actor.
 *
 * Called by: focused summon runtime tests.
 * Depends on: SummoningCommand and the public Summon Beast spell packet.
 */

describe('SummoningCommand live Summon Beast metadata bridge', () => {
  it('stores selected Air form and live form traits on the summoned actor', () => {
    const caster = {
      id: 'summon-beast-caster',
      name: 'Summon Beast Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      currentHP: 30,
      maxHP: 30
    } as unknown as CombatCharacter;
    const summonEffect = summonBeast.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: summonBeast.id,
      spellName: summonBeast.name,
      castAtLevel: 2,
      caster,
      targets: [],
      playerInput: 'Air',
      gameState: {}
    } as CommandContext;
    const state = {
      characters: [caster],
      currentTurn: 1,
      round: 1,
      combatLog: []
    } as CombatState;

    // The command should preserve the player's live mode choice on the actor
    // itself. Later map movement and opportunity-attack systems read this
    // metadata instead of reopening the original spell JSON.
    const command = new SummoningCommand(summonEffect, context);
    const nextState = command.execute(state);
    const summonedActor = nextState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === summonBeast.id
    );

    expect(summonedActor?.summonMetadata).toEqual(expect.objectContaining({
      formName: 'Air',
      sourceName: summonBeast.name,
      formTraits: summonEffect.summon?.formTraits,
      actionPermissions: summonEffect.summon?.actionPermissions
    }));
    expect(summonedActor?.stats.extraMovementSpeeds).toEqual(expect.objectContaining({
      fly: 60
    }));
    expect(summonedActor?.stats.extraMovementSpeeds).not.toHaveProperty('climb');
    expect(summonedActor?.stats.extraMovementSpeeds).not.toHaveProperty('swim');
    expect(summonedActor?.summonMetadata?.formTraits).toContainEqual(expect.objectContaining({
      name: 'Flyby',
      appliesToForms: ['Air'],
      movementModeRequired: 'fly'
    }));
  });

  it('stores selected Land movement metadata without leaking Air flight', () => {
    const caster = {
      id: 'summon-beast-land-caster',
      name: 'Summon Beast Land Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      currentHP: 30,
      maxHP: 30
    } as unknown as CombatCharacter;
    const summonEffect = summonBeast.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: summonBeast.id,
      spellName: summonBeast.name,
      castAtLevel: 2,
      caster,
      targets: [],
      playerInput: 'Land',
      gameState: {}
    } as CommandContext;
    const state = {
      characters: [caster],
      currentTurn: 1,
      round: 1,
      combatLog: []
    } as CombatState;

    // Land uses the same live summon packet as Air, but should receive only
    // the movement capability that belongs to the selected Land form. This
    // prevents the later Flyby opportunity-attack gate from seeing accidental
    // flight metadata on a non-Air spirit.
    const command = new SummoningCommand(summonEffect, context);
    const nextState = command.execute(state);
    const summonedActor = nextState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === summonBeast.id
    );

    expect(summonedActor?.summonMetadata?.formName).toBe('Land');
    expect(summonedActor?.stats.extraMovementSpeeds).toEqual(expect.objectContaining({
      climb: 30
    }));
    expect(summonedActor?.stats.extraMovementSpeeds).not.toHaveProperty('fly');
    expect(summonedActor?.stats.extraMovementSpeeds).not.toHaveProperty('swim');
  });

  it('stores selected Water movement metadata without leaking Air flight', () => {
    const caster = {
      id: 'summon-beast-water-caster',
      name: 'Summon Beast Water Caster',
      team: 'player',
      position: { x: 0, y: 0 },
      currentHP: 30,
      maxHP: 30
    } as unknown as CombatCharacter;
    const summonEffect = summonBeast.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: summonBeast.id,
      spellName: summonBeast.name,
      castAtLevel: 2,
      caster,
      targets: [],
      playerInput: 'Water',
      gameState: {}
    } as CommandContext;
    const state = {
      characters: [caster],
      currentTurn: 1,
      round: 1,
      combatLog: []
    } as CombatState;

    // Water keeps the shared Bestial Spirit stat block but must not receive
    // the Air form's flight metadata. The selected-form movement split keeps
    // opportunity-attack suppression tied to the actual chosen movement mode.
    const command = new SummoningCommand(summonEffect, context);
    const nextState = command.execute(state);
    const summonedActor = nextState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === summonBeast.id
    );

    expect(summonedActor?.summonMetadata?.formName).toBe('Water');
    expect(summonedActor?.stats.extraMovementSpeeds).toEqual(expect.objectContaining({
      swim: 30
    }));
    expect(summonedActor?.stats.extraMovementSpeeds).not.toHaveProperty('fly');
    expect(summonedActor?.stats.extraMovementSpeeds).not.toHaveProperty('climb');
  });
});
