/**
 * This file proves the CS04 adapter prepares deterministic inputs for real combat.
 *
 * It checks canonical spell abilities, owned/unrelated effect records, boundary
 * damage, source-loss delivery, stable replay identity, invalid/declined cases,
 * and Reset-safe defaults without duplicating the production result engine.
 *
 * Exercises: concentrationScenarioControls.ts.
 * Depends on: canonical spell ability creation and shared combat-character mocks.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import concentrationScenarioControls, {
  CONCENTRATION_CASE_CONTROL_ID,
  CONCENTRATION_CASTER_ID,
  CONCENTRATION_DAMAGE_SOURCE_ID,
  CONCENTRATION_OTHER_ACTOR_ID,
  CONCENTRATION_OWNED_BLESS_STATUS_ID,
  CONCENTRATION_REPLAY_CONTROL_ID,
  CONCENTRATION_RESOLVE_CONTROL_ID,
  CONCENTRATION_UNRELATED_STATUS_ID,
  prepareConcentrationScenarioCharacters,
  type ConcentrationProofCase,
} from '../concentrationScenarioControls';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
} from '../PreviewCombatScenarioControlTypes';
import { getPreviewCombatScenario } from '../../PreviewCombatScenarioCatalog';
import { getPreviewCombatScenarioControlModule } from '../PreviewCombatScenarioControlRegistry';

// ============================================================================
// Stable Board Fixture and Control Driver
// ============================================================================
// The unrelated actor deliberately carries ordinary state so every preparation
// and cleanup request has preservation evidence beside the selected transaction.
// ============================================================================

function createCharacters(): CombatCharacter[] {
  return [
    createMockCombatCharacter({
      id: CONCENTRATION_CASTER_ID,
      name: 'Apprentice Mage',
      team: 'player',
    }),
    createMockCombatCharacter({
      id: CONCENTRATION_DAMAGE_SOURCE_ID,
      name: 'Orc Archer',
      team: 'enemy',
    }),
    createMockCombatCharacter({
      id: CONCENTRATION_OTHER_ACTOR_ID,
      name: 'Orc Raider',
      team: 'enemy',
      currentHP: 37,
      maxHP: 37,
    }),
    createMockCombatCharacter({
      id: 'cs04-bystander',
      name: 'Unaffected Bystander',
      currentHP: 41,
      maxHP: 41,
    }),
  ];
}

function snapshot(
  characters: CombatCharacter[] = createCharacters(),
  proofCase: ConcentrationProofCase = 'replace_owned_effect',
): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: null,
    characters,
    activeLightSources: [],
    reactiveTriggers: [],
    controlValues: { [CONCENTRATION_CASE_CONTROL_ID]: proofCase },
    turnState: {
      currentTurn: 1,
      currentCharacterId: CONCENTRATION_CASTER_ID,
      turnOrder: [CONCENTRATION_CASTER_ID, CONCENTRATION_DAMAGE_SOURCE_ID],
      phase: 'action',
      actionsThisTurn: [],
    },
  };
}

function applyCase(proofCase: ConcentrationProofCase): PreviewCombatScenarioControlPatch {
  return concentrationScenarioControls.applyControl({
    controlId: CONCENTRATION_CASE_CONTROL_ID,
    value: proofCase,
    snapshot: snapshot(createCharacters(), proofCase),
  });
}

function requestEvent(
  characters: CombatCharacter[],
  proofCase: ConcentrationProofCase,
  replay = false,
): PreviewCombatScenarioControlPatch {
  return concentrationScenarioControls.applyControl({
    controlId: replay ? CONCENTRATION_REPLAY_CONTROL_ID : CONCENTRATION_RESOLVE_CONTROL_ID,
    value: true,
    snapshot: snapshot(characters, proofCase),
  });
}

function actor(characters: CombatCharacter[], id: string): CombatCharacter {
  const found = characters.find(character => character.id === id);
  if (!found) throw new Error(`Missing CS04 actor ${id}.`);
  return found;
}

// ============================================================================
// Control, Ownership, and Production-Request Proof
// ============================================================================
// Assertions stop at the adapter boundary only where the returned request is
// explicitly handed to mounted useAbilitySystem; command results have their own
// focused and mounted tests.
// ============================================================================

describe('concentrationScenarioControls', () => {
  it('is registered against the CS04 catalog entry', () => {
    // Registration is the mounted discoverability boundary: a correct pure
    // module is not usable if the selected scenario cannot resolve it.
    expect(getPreviewCombatScenarioControlModule('concentration')).toBe(concentrationScenarioControls);
    expect(getPreviewCombatScenario('concentration')).toMatchObject({
      label: 'Spell Concentration',
      proofFocus: expect.stringMatching(/final-damage DC.*keep\/break/i),
    });
  });

  it('publishes one case selector plus resolve and stable-id replay actions', () => {
    expect(concentrationScenarioControls.scenarioId).toBe('concentration');
    expect(concentrationScenarioControls.controls).toEqual([
      expect.objectContaining({
        id: CONCENTRATION_CASE_CONTROL_ID,
        kind: 'select',
        defaultValue: 'replace_owned_effect',
      }),
      expect.objectContaining({ id: CONCENTRATION_RESOLVE_CONTROL_ID, kind: 'action' }),
      expect.objectContaining({ id: CONCENTRATION_REPLAY_CONTROL_ID, kind: 'action' }),
    ]);
  });

  it('prepares one owned Bless link and preserves a same-spell unrelated owner', () => {
    const patch = applyCase('replace_owned_effect');
    const characters = patch.characters ?? [];
    const caster = actor(characters, CONCENTRATION_CASTER_ID);
    const other = actor(characters, CONCENTRATION_OTHER_ACTOR_ID);

    expect(patch.reinitializeCombat).toBe(true);
    expect(caster.concentratingOn).toMatchObject({
      spellId: 'bless',
      effectIds: [CONCENTRATION_OWNED_BLESS_STATUS_ID],
    });
    expect(caster.statusEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: CONCENTRATION_OWNED_BLESS_STATUS_ID,
        sourceCasterId: CONCENTRATION_CASTER_ID,
      }),
    ]));
    expect(other.statusEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: CONCENTRATION_UNRELATED_STATUS_ID,
        sourceCasterId: 'unrelated-caster',
      }),
    ]));
    expect(caster.actionEconomy.action).toMatchObject({ used: false, remaining: 1 });
    expect(caster.spellSlots?.level_1).toEqual({ current: 2, max: 2 });
  });

  it('builds canonical Bless and Protection casts with the correct stable identities', () => {
    const freshCharacters = applyCase('cast_bless').characters ?? [];
    const fresh = requestEvent(freshCharacters, 'cast_bless').abilityExecution;
    const replacementCharacters = applyCase('replace_owned_effect').characters ?? [];
    const replacement = requestEvent(replacementCharacters, 'replace_owned_effect').abilityExecution;

    expect(actor(freshCharacters, CONCENTRATION_CASTER_ID).concentratingOn).toBeUndefined();
    expect(fresh).toMatchObject({
      casterId: CONCENTRATION_CASTER_ID,
      targetId: CONCENTRATION_CASTER_ID,
      playerInput: 'Apprentice Mage',
      executionEventId: 'cs04-cast_bless-event-001',
      executionDecision: 'accept',
      ability: {
        name: 'Bless',
        cost: { type: 'action', spellSlotLevel: 1 },
        spell: { id: 'bless', duration: { concentration: true } },
      },
    });
    expect(replacement).toMatchObject({
      playerInput: 'Apprentice Mage',
      executionEventId: 'cs04-replace_owned_effect-event-001',
      executionDecision: 'accept',
      ability: {
        name: 'Protection from Evil and Good',
        cost: { type: 'action', spellSlotLevel: 1 },
        spell: { id: 'protection-from-evil-and-good', duration: { concentration: true } },
      },
    });
  });

  it('prepares final-damage boundary keep and break attacks through ordinary abilities', () => {
    const keepCharacters = applyCase('damage_keep_dc10').characters ?? [];
    const keepCaster = actor(keepCharacters, CONCENTRATION_CASTER_ID);
    const keep = requestEvent(keepCharacters, 'damage_keep_dc10').abilityExecution;
    const breakCharacters = applyCase('damage_break_dc11').characters ?? [];
    const breakCaster = actor(breakCharacters, CONCENTRATION_CASTER_ID);
    const broken = requestEvent(breakCharacters, 'damage_break_dc11').abilityExecution;

    expect(keepCaster.stats.saveBonuses?.con).toBe(10);
    expect(keep?.ability.effects).toContainEqual(expect.objectContaining({ value: 20 }));
    expect(keep?.executionEventId).toBe('cs04-damage_keep_dc10-event-001');
    expect(breakCaster.stats.saveBonuses?.con).toBe(-11);
    expect(broken?.ability.effects).toContainEqual(expect.objectContaining({ value: 22 }));
    expect(broken?.executionEventId).toBe('cs04-damage_break_dc11-event-001');
  });

  it('routes source loss through a real Incapacitated status ability', () => {
    const characters = applyCase('source_incapacitated').characters ?? [];
    const request = requestEvent(characters, 'source_incapacitated').abilityExecution;

    expect(request).toMatchObject({
      casterId: CONCENTRATION_DAMAGE_SOURCE_ID,
      targetId: CONCENTRATION_CASTER_ID,
      executionEventId: 'cs04-source_incapacitated-event-001',
      ability: {
        name: 'Apply Incapacitated',
        type: 'utility',
        effects: [expect.objectContaining({
          type: 'status',
          statusEffect: expect.objectContaining({ name: 'Incapacitated' }),
        })],
      },
    });
  });

  it('keeps invalid and declined replacement requests distinguishable before payment', () => {
    const invalidCharacters = applyCase('invalid_spent_action').characters ?? [];
    const invalidCaster = actor(invalidCharacters, CONCENTRATION_CASTER_ID);
    const invalid = requestEvent(invalidCharacters, 'invalid_spent_action').abilityExecution;
    const declinedCharacters = applyCase('declined_replacement').characters ?? [];
    const declined = requestEvent(declinedCharacters, 'declined_replacement').abilityExecution;

    expect(invalidCaster.actionEconomy.action).toEqual({ used: true, remaining: 0 });
    expect(invalidCaster.concentratingOn?.spellId).toBe('bless');
    expect(invalid?.executionDecision).toBe('accept');
    expect(declined?.executionDecision).toBe('decline');
    expect(actor(declinedCharacters, CONCENTRATION_CASTER_ID).concentratingOn?.spellId).toBe('bless');
  });

  it('replays the exact same event id without preparing or mutating characters again', () => {
    const characters = applyCase('replace_owned_effect').characters ?? [];
    const first = requestEvent(characters, 'replace_owned_effect');
    const replay = requestEvent(characters, 'replace_owned_effect', true);

    expect(replay.characters).toBeUndefined();
    expect(replay.abilityExecution?.executionEventId)
      .toBe(first.abilityExecution?.executionEventId);
    expect(replay.logMessage).toContain('REPLAY REQUESTED');
  });

  it('rebuilds the default replacement fixture deterministically for Reset Board', () => {
    const original = createCharacters();
    const first = prepareConcentrationScenarioCharacters(original, 'replace_owned_effect');
    const second = prepareConcentrationScenarioCharacters(first, 'replace_owned_effect');

    expect(second).toEqual(first);
    expect(actor(second, 'cs04-bystander')).toMatchObject({ currentHP: 41, maxHP: 41 });
  });

  it('returns log-only no-ops for unknown cases, controls, and missing actors', () => {
    const unknownCase = concentrationScenarioControls.applyControl({
      controlId: CONCENTRATION_CASE_CONTROL_ID,
      value: 'not-a-case',
      snapshot: snapshot(),
    });
    const unknownControl = concentrationScenarioControls.applyControl({
      controlId: 'not-a-control',
      value: true,
      snapshot: snapshot(),
    });
    const missing = prepareConcentrationScenarioCharacters([], 'cast_bless');

    expect(unknownCase.characters).toBeUndefined();
    expect(unknownCase.logMessage).toContain('unknown case');
    expect(unknownControl.logMessage).toContain('unknown control');
    expect(missing).toEqual([]);
  });
});
