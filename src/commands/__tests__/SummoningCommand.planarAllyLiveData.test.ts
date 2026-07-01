import { describe, expect, it } from 'vitest';
import { SummoningCommand } from '../effects/SummoningCommand';
import { UtilityCommand } from '../effects/UtilityCommand';
import { AbilityCommandFactory } from '../factory/AbilityCommandFactory';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState } from '../../types/combat';
import type { SummoningEffect, UtilityEffect } from '../../types/spells';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories';
import planarAlly from '../../../public/data/spells/level-6/planar-ally.json';

/**
 * This test proves the live Planar Ally packet keeps its negotiated-service
 * contract on the spawned summon actor.
 *
 * The current slice is intentionally narrow: the spell should preserve the
 * structured bargain, service, and return-home policy as runtime metadata
 * without inventing a generic command surface or pretending the ally is
 * automatically controlled by the caster.
 */

describe('SummoningCommand live Planar Ally negotiated-service bridge', () => {
  it('preserves the bargain and return-home contract on the spawned summon metadata', () => {
    // Use the real spell packet so this proof fails if the authored bargain
    // data or the summon bridge stops copying it into combat state.
    const summonEffect = planarAlly.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect | undefined;

    expect(summonEffect).toBeDefined();

    // The caster only needs a valid combat identity and position for the
    // summon command to create the ally actor.
    const caster = createMockCombatCharacter({
      id: 'planar-ally-caster',
      name: 'Planar Ally Caster',
      position: { x: 6, y: 6 },
      initiative: 13
    }) as CombatCharacter;

    const command = new SummoningCommand(summonEffect!, {
      spellId: planarAlly.id,
      spellName: planarAlly.name,
      castAtLevel: 6,
      caster,
      targets: [],
      playerInput: 'Celestial',
      gameState: createMockGameState()
    } satisfies CommandContext);

    const state = createMockCombatState({
      characters: [caster]
    });

    const nextState = command.execute(state);
    const ally = nextState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === planarAlly.id &&
      character.summonMetadata?.casterId === caster.id
    );

    // The summon should stay a structured actor record, not a hidden
    // negotiation prompt or a fully commanded ally.
    expect(ally?.abilities).toHaveLength(0);
    expect(ally?.summonMetadata).toEqual(expect.objectContaining({
      entityType: 'creature',
      sourceName: planarAlly.name,
      persistent: false,
      dismissable: false,
      initiativePolicy: 'rolled',
      formName: 'Celestial',
      control: expect.objectContaining({
        entityType: 'planar_ally',
        bargainingRequired: true,
        noCompulsion: true,
        serviceLimit: 'agreed task or duration up to 10 days',
        return: 'returns home when task complete, duration expires, or no price is agreed'
      }),
      travelDetails: expect.objectContaining({
        mode: 'ally_arrival_and_home_return',
        arrival: 'entity sends Celestial, Elemental, or Fiend to unoccupied space within 60 feet',
        returnOn: 'task complete, service duration expires, or no price agreed',
        report: 'returns to home plane after reporting back if possible',
        noAgreement: 'immediately returns to home plane'
      })
    }));
  });

  it('keeps the live utility-side bargain payload intact in the combat log', () => {
    // Execute the real utility packet so the proof fails if the command stops
    // carrying the authored negotiation fields through to the log payload.
    const utilityEffect = planarAlly.effects.find(effect => effect.type === 'UTILITY') as UtilityEffect | undefined;

    expect(utilityEffect).toBeDefined();

    const caster = createMockCombatCharacter({
      id: 'planar-ally-utility-caster',
      name: 'Planar Ally Utility Caster',
      position: { x: 6, y: 6 },
      initiative: 13
    }) as CombatCharacter;

    const command = new UtilityCommand(utilityEffect!, {
      spellId: planarAlly.id,
      spellName: planarAlly.name,
      castAtLevel: 6,
      caster,
      targets: [],
      gameState: createMockGameState()
    } satisfies CommandContext);

    const state = createMockCombatState({
      characters: [caster]
    });

    const nextState = command.execute(state);
    const logEntry = nextState.combatLog.find(entry =>
      (entry.data?.utilityEffect as UtilityEffect | undefined)?.description === utilityEffect?.description
    );

    expect(logEntry?.data?.utilityEffect).toEqual(expect.objectContaining({
      socialEffect: expect.objectContaining({
        requestedPower: 'known god, demon prince, or other cosmic power',
        negotiationRequired: true,
        communicationRequired: 'caster must communicate with creature to bargain for service',
        returnHome: 'after service completion, duration expiry, or failed bargain'
      }),
      communicationDetails: expect.objectContaining({
        mode: 'planar_ally_bargaining',
        mustCommunicateWithCreature: true,
        paymentExamples: '100 GP/minute, 1,000 GP/hour, or 10,000 GP/day, adjusted by task',
        refusal: 'creature can refuse or demand different payment; suicidal tasks may end negotiation',
        notes: 'Service depends on negotiated communication, not automatic control.'
      }),
      travelDetails: expect.objectContaining({
        mode: 'ally_arrival_and_home_return',
        arrival: 'entity sends Celestial, Elemental, or Fiend to unoccupied space within 60 feet',
        returnOn: 'task complete, service duration expires, or no price agreed',
        report: 'returns to home plane after reporting back if possible',
        noAgreement: 'immediately returns to home plane'
      }),
      resourceState: expect.objectContaining({
        kind: 'negotiated_service_payment',
        adjustedBy: 'task_nature_and_planar_ally_alignment_to_cosmic_power',
        paymentRequiredFor: 'measured_service_after_bargain',
        typicalRates: expect.arrayContaining([
          expect.objectContaining({ unit: 'minute', gp: 100 }),
          expect.objectContaining({ unit: 'hour', gp: 1000 }),
          expect.objectContaining({ unit: 'day', gp: 10000, maxDays: 10 })
        ])
      })
    }));
  });

  it('exposes explicit return-home commands that remove the ally and log return_home_plane', () => {
    // Use the live packet so this proof fails if the authored home-return
    // contract or the summon bridge stops surfacing an executable runtime path.
    const summonEffect = planarAlly.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect | undefined;

    expect(summonEffect).toBeDefined();

    const caster = createMockCombatCharacter({
      id: 'planar-ally-return-home-caster',
      name: 'Planar Ally Return-Home Caster',
      position: { x: 6, y: 6 },
      initiative: 13
    }) as CombatCharacter;

    const command = new SummoningCommand(summonEffect!, {
      spellId: planarAlly.id,
      spellName: planarAlly.name,
      castAtLevel: 6,
      caster,
      targets: [],
      playerInput: 'Celestial',
      gameState: createMockGameState()
    } satisfies CommandContext);

    const state = createMockCombatState({
      characters: [caster]
    });

    const summonedState = command.execute(state);
    const ally = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === planarAlly.id &&
      character.summonMetadata?.casterId === caster.id
    );

    expect(ally).toBeDefined();

    const updatedCaster = summonedState.characters.find(character => character.id === caster.id);
    const returnHomeAbilities = (updatedCaster?.abilities ?? []).filter(ability =>
      ability.effects?.some(effect => effect.type === 'summon_return_home')
    );

    expect(returnHomeAbilities.map(ability => ability.name)).toEqual(expect.arrayContaining([
      'Return Home (No Agreement)',
      'Return Home (Service Complete)'
    ]));

    const serviceCompleteAbility = returnHomeAbilities.find(ability =>
      ability.effects.some(effect =>
        effect.type === 'summon_return_home' &&
        effect.summonReturnHomeAction === 'service_complete'
      )
    );

    expect(serviceCompleteAbility).toBeDefined();

    const returnHomeCommands = AbilityCommandFactory.createCommands(
      serviceCompleteAbility!,
      updatedCaster!,
      [updatedCaster!],
      {} as never
    );

    expect(returnHomeCommands).toHaveLength(1);

    const returnedState = returnHomeCommands[0].execute({
      ...summonedState,
      turnState: state.turnState
    }) as CombatState;

    expect(returnedState.characters.some(character => character.id === ally?.id)).toBe(false);
    expect(returnedState.combatLog.some(entry =>
      entry.data?.returnHomeOutcome === 'return_home_plane' &&
      entry.data?.summonReturnHomeAction === 'service_complete' &&
      entry.data?.removedSummonId === ally?.id
    )).toBe(true);
  });
});
