import { describe, expect, it } from 'vitest';
import { SummoningCommand } from '../effects/SummoningCommand';
import { createMockCombatCharacter } from '../../utils/core';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../types/combat';
import type { SummoningEffect } from '../../types/spells';
import phantomSteed from '../../../public/data/spells/level-3/phantom-steed.json';

/**
 * This file proves the live Phantom Steed packet creates a mount with its lifecycle data.
 *
 * Phantom Steed is a spell-created mount, but its important behavior is not an
 * attack. The runtime needs to preserve the 100-foot travel contract, the
 * damage-ending rule, and the one-minute fade aftermath on the actor so later
 * damage and riding systems can clean it up from combat state.
 *
 * Called by: focused G16 summon runtime checks.
 * Depends on: SummoningCommand and the public Phantom Steed spell packet.
 */

describe('SummoningCommand live Phantom Steed mount bridge', () => {
  it('stores travel, damage-ending, and fade metadata on the spawned mount', () => {
    // The caster is intentionally simple because this proof only checks the
    // mount actor produced from the real spell data.
    const caster = createMockCombatCharacter({
      id: 'phantom-steed-caster',
      name: 'Phantom Steed Caster',
      team: 'player',
      position: { x: 3, y: 3 },
      initiative: 11
    }) as CombatCharacter;

    // Use live spell data so stale bucket wording or synthetic fixtures cannot
    // hide missing runtime metadata on the spawned mount.
    const summonEffect = phantomSteed.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect | undefined;
    const context = {
      spellId: phantomSteed.id,
      spellName: phantomSteed.name,
      castAtLevel: 3,
      caster,
      targets: [],
      gameState: {}
    } as CommandContext;
    const state = createCombatState([caster]);

    expect(summonEffect).toBeDefined();

    // Casting should create the quasi-real mount as a real actor, carrying the
    // same travel and lifecycle facts authored in the spell packet.
    const afterCast = new SummoningCommand(summonEffect!, context).execute(state);
    const steed = afterCast.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === phantomSteed.id &&
      character.summonMetadata?.casterId === caster.id
    );
    const metadata = steed?.summonMetadata;

    expect(steed).toBeDefined();
    expect(steed?.name).toContain('Phantom Steed');
    expect(steed?.stats.speed).toBe(100);
    expect(metadata).toEqual(expect.objectContaining({
      entityType: 'mount',
      formName: 'Phantom Steed',
      sourceName: phantomSteed.name,
      persistent: false,
      commandCost: 'none',
      initiativePolicy: 'shared',
      travelDetails: expect.objectContaining({
        speedFeet: 100,
        travelPaceMilesPerHour: 13,
        rider: 'caster or chosen rider'
      }),
      conditionalEndings: expect.arrayContaining([
        expect.objectContaining({
          trigger: 'created_entity_takes_damage',
          scope: 'spell'
        })
      ]),
      aftermathState: expect.objectContaining({
        kind: 'steed_fade_grace_period',
        gracePeriod: '1_minute_for_rider_to_dismount'
      })
    }));
  });
});

function createCombatState(characters: CombatCharacter[]): CombatState {
  // Keep this state combat-shaped but narrow. Turn-order and damage cleanup
  // have separate focused proofs; this file checks the live summon actor.
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
