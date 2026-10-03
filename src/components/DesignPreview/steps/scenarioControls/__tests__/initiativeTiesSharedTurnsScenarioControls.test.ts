/**
 * This file proves the Initiative Ties & Shared Turns scenario-owned facts.
 *
 * It verifies the authored spent ledgers and own-turn markers, both deterministic
 * Dexterity inputs, the shared summon metadata consumed by production ordering,
 * the member-state transaction, and production mid-turn removal request.
 *
 * Exercises: initiativeTiesSharedTurnsScenarioControls.
 * Depends on: the shared combat-character test factory.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import { buildInitiativeOrder } from '../../../../../utils/combat/initiativeUtils';
import initiativeTiesSharedTurnsScenarioControls, {
  INITIATIVE_TIES_BASELINE_RIVAL_DEXTERITY,
  INITIATIVE_TIES_CAPTAIN_ID,
  INITIATIVE_TIES_LATE_GUARD_ID,
  INITIATIVE_TIES_RIVAL_ID,
  INITIATIVE_TIES_SHARED_ECHO_ID,
  INITIATIVE_TIES_SPENT_MOVEMENT_FEET,
  INITIATIVE_TIES_TURN_MARKER,
  prepareInitiativeTiesSharedTurnsCharacters,
} from '../initiativeTiesSharedTurnsScenarioControls';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
} from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Four-Actor Board Fixture
// ============================================================================
// The source factory supplies complete production shapes. Scenario preparation
// then owns every fact this lane promises to display and mutate.
// ============================================================================

function createCharacters(): CombatCharacter[] {
  return [
    [INITIATIVE_TIES_CAPTAIN_ID, 'Tie Captain'],
    [INITIATIVE_TIES_RIVAL_ID, 'Agile Rival'],
    [INITIATIVE_TIES_SHARED_ECHO_ID, 'Shared Echo'],
    [INITIATIVE_TIES_LATE_GUARD_ID, 'Late Guard'],
  ].map(([id, name]) => createMockCombatCharacter({ id, name }));
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: null,
    characters: prepareInitiativeTiesSharedTurnsCharacters(createCharacters()),
    activeLightSources: [],
    reactiveTriggers: [],
    spellZones: [],
  };
}

function applyControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
  value: string | boolean,
): PreviewCombatScenarioControlPatch {
  return initiativeTiesSharedTurnsScenarioControls.applyControl({
    controlId,
    value,
    snapshot,
  });
}

describe('initiativeTiesSharedTurnsScenarioControls', () => {
  it('prepares tied totals, shared metadata, spent ledgers, and own-turn markers', () => {
    const characters = prepareInitiativeTiesSharedTurnsCharacters(createCharacters());
    const captain = characters.find(character => character.id === INITIATIVE_TIES_CAPTAIN_ID);
    const rival = characters.find(character => character.id === INITIATIVE_TIES_RIVAL_ID);
    const echo = characters.find(character => character.id === INITIATIVE_TIES_SHARED_ECHO_ID);
    const lateGuard = characters.find(character => character.id === INITIATIVE_TIES_LATE_GUARD_ID);

    expect(captain).toMatchObject({ initiative: 15, stats: { dexterity: 16 } });
    expect(rival).toMatchObject({
      initiative: 15,
      stats: { dexterity: INITIATIVE_TIES_BASELINE_RIVAL_DEXTERITY },
    });
    expect(echo?.summonMetadata).toMatchObject({
      casterId: INITIATIVE_TIES_CAPTAIN_ID,
      initiativePolicy: 'shared',
    });
    expect(lateGuard?.initiative).toBe(11);

    for (const character of characters) {
      expect(character.actionEconomy).toMatchObject({
        action: { used: true, remaining: 0 },
        reaction: { used: true, remaining: 0 },
        movement: { used: INITIATIVE_TIES_SPENT_MOVEMENT_FEET },
        freeActions: 0,
      });
      expect(character.conditions?.map(condition => condition.name))
        .toContain(INITIATIVE_TIES_TURN_MARKER);
    }
  });

  it('rebuilds baseline and alternate tie inputs through the canonical sorter', () => {
    const snapshot = createSnapshot();
    const baselinePatch = applyControl(snapshot, 'tie-break-input', 'captain_first');
    const alternatePatch = applyControl(snapshot, 'tie-break-input', 'rival_first');

    expect(baselinePatch.reinitializeCombat).toBe(true);
    expect(buildInitiativeOrder(baselinePatch.characters ?? []).map(character => character.id))
      .toEqual([
        INITIATIVE_TIES_CAPTAIN_ID,
        INITIATIVE_TIES_SHARED_ECHO_ID,
        INITIATIVE_TIES_RIVAL_ID,
        INITIATIVE_TIES_LATE_GUARD_ID,
      ]);
    expect(buildInitiativeOrder(alternatePatch.characters ?? []).map(character => character.id))
      .toEqual([
        INITIATIVE_TIES_RIVAL_ID,
        INITIATIVE_TIES_CAPTAIN_ID,
        INITIATIVE_TIES_SHARED_ECHO_ID,
        INITIATIVE_TIES_LATE_GUARD_ID,
      ]);
    expect(alternatePatch.logMessage).toContain('Agile Rival DEX 18 precedes Tie Captain DEX 16');
  });

  it('labels the deterministic tie ladder as Aralia policy instead of canonical 5e', () => {
    const control = initiativeTiesSharedTurnsScenarioControls.controls.find(candidate => (
      candidate.id === 'tie-break-input'
    ));

    expect(control?.label).toContain('Aralia House');
    expect(control?.description).toContain('not a canonical 5e tie ladder');
  });

  it('applies Incapacitated to only the shared member without rebuilding combat', () => {
    const snapshot = {
      ...createSnapshot(),
      controlValues: { 'shared-member-case': 'incapacitated' },
    };
    const patch = applyControl(snapshot, 'apply-member-case', true);
    const echo = patch.characters?.find(character => character.id === INITIATIVE_TIES_SHARED_ECHO_ID);
    const captain = patch.characters?.find(character => character.id === INITIATIVE_TIES_CAPTAIN_ID);

    expect(patch.reinitializeCombat).toBeUndefined();
    expect(echo?.conditions?.map(condition => condition.name)).toContain('Incapacitated');
    expect(captain?.conditions?.map(condition => condition.name)).not.toContain('Incapacitated');
    expect(patch.logMessage).toContain('keeps its own start/end effect boundary');
  });

  it('requests exact production removal without mutating a shadow roster', () => {
    const patch = applyControl(createSnapshot(), 'remove-shared-member', true);

    expect(patch.characters).toBeUndefined();
    expect(patch.reinitializeCombat).toBeUndefined();
    expect(patch.removeCharacterFromCombatId).toBe(INITIATIVE_TIES_SHARED_ECHO_ID);
    expect(patch.logMessage).toContain('without reinitializing combat');
  });

  it('leaves state untouched for an unknown control id', () => {
    const patch = applyControl(createSnapshot(), 'unknown-control', true);

    expect(patch.characters).toBeUndefined();
    expect(patch.logMessage).toContain('ignored unknown control');
  });
});
