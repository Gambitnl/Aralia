import { describe, expect, it } from 'vitest';
import { UtilityCommand } from '../effects/UtilityCommand';
import { createMockCombatCharacter } from '../../utils/factories';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatLogEntry, CombatState } from '../../types/combat';
import type { UtilityEffect } from '../../types/spells';
import createHomunculus from '../../../public/data/spells/level-6/create-homunculus.json';

/**
 * Create Homunculus turns expensive material components into a persistent
 * construct companion. The spell is authored as utility/creation data, so this
 * proof protects the runtime bridge that must create and track the companion
 * rather than leaving creation, one-homunculus failure, death link, same-plane
 * bond, and Hit Dice transfer facts as prose-only metadata.
 */

describe('UtilityCommand live Create Homunculus companion bridge', () => {
  it('creates one persistent Homunculus companion with bond and lifecycle metadata', () => {
    const caster = createMockCombatCharacter({
      id: 'homunculus-caster',
      name: 'Homunculus Caster',
      team: 'player',
      position: { x: 4, y: 4 },
      initiative: 11
    });
    const utilityEffect = createHomunculus.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;
    const context = buildContext(caster, []);
    const state = createCombatState([caster]);

    expect(utilityEffect).toBeDefined();

    const afterCast = new UtilityCommand(utilityEffect!, context).execute(state);
    const homunculus = afterCast.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === createHomunculus.id &&
      character.summonMetadata?.casterId === caster.id
    );

    expect(homunculus).toBeDefined();
    expect(homunculus?.name).toContain('Homunculus');
    expect(homunculus?.creatureTypes).toContain('Construct');
    expect(homunculus?.abilities?.some(ability => ability.name === 'Telepathic Bond')).toBe(true);
    expect(homunculus?.summonMetadata).toEqual(expect.objectContaining({
      entityType: 'construct_companion',
      formName: 'Homunculus',
      sourceName: createHomunculus.name,
      persistent: true,
      dismissable: false,
      travelDetails: expect.objectContaining({
        mode: 'homunculus_range_awareness',
        telepathicRange: 'same plane as caster, per spell bond'
      }),
      lifecycle: expect.objectContaining({
        zeroHpEnding: 'homunculus dies if reduced to 0 Hit Points',
        recastEnding: 'spell fails while caster already has a living homunculus'
      }),
      aftermathState: expect.objectContaining({
        deathLink: 'homunculus dies if caster dies',
        oneHomunculusLimit: true,
        hitPointTransfer: expect.objectContaining({
          mode: 'homunculus_maximum_hit_point_transfer'
        })
      })
    }));
    expect(afterCast.combatLog.some(entry =>
      entry.type === 'summon' &&
      entry.data?.spellId === createHomunculus.id &&
      entry.data?.companionSurface === 'create-homunculus'
    )).toBe(true);
  });

  it('fails recast while the caster already has a living homunculus', () => {
    const caster = createMockCombatCharacter({
      id: 'homunculus-caster',
      name: 'Homunculus Caster',
      team: 'player',
      position: { x: 4, y: 4 },
      initiative: 11
    });
    const utilityEffect = createHomunculus.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;
    const context = buildContext(caster, []);
    const firstCast = new UtilityCommand(utilityEffect!, context).execute(createCombatState([caster]));
    const existingHomunculus = firstCast.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === createHomunculus.id
    );

    expect(existingHomunculus).toBeDefined();

    const secondCast = new UtilityCommand(utilityEffect!, context).execute(firstCast);
    const homunculi = secondCast.characters.filter(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === createHomunculus.id &&
      character.summonMetadata?.casterId === caster.id
    );

    expect(homunculi).toHaveLength(1);
    expect(secondCast.combatLog.some(entry =>
      entry.type === 'status' &&
      entry.data?.spellId === createHomunculus.id &&
      entry.data?.companionSurface === 'create-homunculus' &&
      entry.data?.creationState === 'blocked_existing_living_homunculus'
    )).toBe(true);
  });
});

function buildContext(caster: CombatCharacter, targets: CombatCharacter[]): CommandContext {
  return {
    spellId: createHomunculus.id,
    spellName: createHomunculus.name,
    castAtLevel: createHomunculus.level,
    caster,
    targets,
    gameState: {}
  } as CommandContext;
}

function createCombatState(characters: CombatCharacter[]): CombatState {
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
