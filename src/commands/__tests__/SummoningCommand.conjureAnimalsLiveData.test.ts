import { describe, expect, it } from 'vitest';
import { SummoningCommand } from '../effects/SummoningCommand';
import { createMockCombatCharacter } from '../../utils/core';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../types/combat';
import type { SummoningEffect } from '../../types/spells';
import conjureAnimals from '../../../public/data/spells/level-3/conjure-animals.json';

/**
 * This file proves the live Conjure Animals spell packet creates a real combat actor.
 *
 * Conjure Animals is authored as a single spectral pack instead of many separate
 * beasts. The runtime still needs a summon actor that preserves the rolled
 * initiative policy, command cadence, placement rules, and recurring threat
 * metadata so later turn-order and trigger systems can use the real spell data.
 *
 * Called by: focused G16 summon runtime checks.
 * Depends on: SummoningCommand and the public Conjure Animals spell packet.
 */

describe('SummoningCommand live Conjure Animals metadata bridge', () => {
  it('creates the spectral pack actor with rolled initiative and command metadata', () => {
    // The caster is a minimal combat participant because this proof only cares
    // about the spell-created pack and the metadata copied onto that pack.
    const caster = createMockCombatCharacter({
      id: 'conjure-animals-caster',
      name: 'Conjure Animals Caster',
      team: 'player',
      position: { x: 2, y: 2 },
      initiative: 9
    }) as CombatCharacter;

    // Use the real spell packet so this test fails if the data stops exposing
    // Conjure Animals as a summon/control effect.
    const summonEffect = conjureAnimals.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect | undefined;
    const context = {
      spellId: conjureAnimals.id,
      spellName: conjureAnimals.name,
      castAtLevel: 3,
      caster,
      targets: [],
      playerInput: 'Wolf',
      gameState: {}
    } as CommandContext;
    const state = createCombatState([caster]);

    expect(summonEffect).toBeDefined();

    // Casting should turn the live packet into a positioned combat actor,
    // rather than leaving the spectral pack as prose in spell JSON.
    const afterCast = new SummoningCommand(summonEffect!, context).execute(state);
    const spectralPack = afterCast.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === conjureAnimals.id &&
      character.summonMetadata?.casterId === caster.id
    );

    expect(spectralPack).toBeDefined();
    expect(spectralPack?.team).toBe(caster.team);
    expect(spectralPack?.summonMetadata).toEqual(expect.objectContaining({
      entityType: summonEffect!.summon?.entityType,
      formName: 'Wolf',
      sourceName: conjureAnimals.name,
      persistent: false,
      commandCost: 'free',
      commandsPerTurn: 1,
      commandsUsedThisTurn: 0,
      initiativePolicy: 'rolled',
      dismissable: false
    }));

    // The authored packet says the pack can move when the caster moves and
    // threaten nearby creatures. That still lives in structured summon effect
    // data today, so this proof keeps the actor bridge tied to the same packet.
    expect(summonEffect?.placementEligibility).toEqual(expect.objectContaining({
      initialPlacement: 'visible_unoccupied_space_within_range',
      movementDistanceFeet: 30
    }));
    expect(summonEffect?.recurringMechanics?.[0]).toEqual(expect.objectContaining({
      timing: 'on_entity_proximity',
      saveType: 'Dexterity',
      failureOutcome: 'takes_damage'
    }));

    // The command should also leave a summon log entry with the same spell id,
    // giving future audit tools a concrete runtime event to inspect.
    expect(afterCast.combatLog.some(entry =>
      entry.type === 'action' &&
      entry.data?.spellId === conjureAnimals.id &&
      entry.characterId === caster.id
    )).toBe(true);
  });
});

function createCombatState(characters: CombatCharacter[]): CombatState {
  // Keep this state small but combat-shaped. SummoningCommand only needs the
  // roster and log here, while later guardrails cover actual turn insertion.
  return {
    isActive: true,
    characters,
    turnState: {
      currentTurn: 1,
      turnOrder: characters.map(character => character.id),
      currentCharacterId: characters[0]?.id ?? '',
      phase: 'action',
      actionsThisTurn: []
    },
    selectedCharacterId: null,
    selectedAbilityId: null,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [] as CombatLogEntry[],
    reactiveTriggers: [],
    activeLightSources: []
  } as CombatState;
}
