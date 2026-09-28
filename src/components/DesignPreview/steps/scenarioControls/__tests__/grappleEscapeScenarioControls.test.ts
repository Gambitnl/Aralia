/**
 * This file proves the Grapple & Escape buttons exercise canonical combat rules.
 *
 * Each action runs through the shared scenario-control contract, then production
 * movement, status, action-economy, and maintenance facts are inspected. An
 * unrelated bystander proves the disjoint module preserves foreign combatants.
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import { calculateMovementTotal } from '../../../../../utils/combat/actionEconomyUtils';
import { applyGrappledCondition } from '../../../../../utils/combat/grappleUtils';
import grappleEscapeScenarioControls, {
  GRAPPLE_ESCAPE_DC,
  GRAPPLE_ESCAPE_GRAPPLER_INITIATIVE,
  GRAPPLE_ESCAPE_GRAPPLER_ID,
  GRAPPLE_ESCAPE_TARGET_INITIATIVE,
  GRAPPLE_ESCAPE_TARGET_ID,
  getGrappleEscapeInitiativeTotal,
} from '../grappleEscapeScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Scenario Snapshot
// ============================================================================
// Actor ids and positions match the live 16-by-12 board. The target begins held
// and the bystander remains outside every control's ownership.
// ============================================================================

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const grappler = createMockCombatCharacter({
    id: GRAPPLE_ESCAPE_GRAPPLER_ID,
    name: 'Grappler (5 ft Reach)',
    position: { x: 6, y: 5 },
    team: 'player',
  });
  const target = applyGrappledCondition(createMockCombatCharacter({
    id: GRAPPLE_ESCAPE_TARGET_ID,
    name: 'Escape Target',
    position: { x: 7, y: 5 },
    team: 'enemy',
    stats: {
      ...createMockCombatCharacter().stats,
      dexterity: 16,
    },
    modifiers: {
      advantage: [],
      disadvantage: [],
      bonuses: [],
      ...createMockCombatCharacter().modifiers,
      skillProficiencies: ['Acrobatics'],
    },
  }), {
    grapplerId: GRAPPLE_ESCAPE_GRAPPLER_ID,
    escapeDc: GRAPPLE_ESCAPE_DC,
    source: 'Tactical Sandbox Grapple',
  });
  const bystander = createMockCombatCharacter({
    id: 'grapple-bystander',
    name: 'Unrelated Bystander',
    position: { x: 12, y: 9 },
    team: 'neutral',
  });

  return {
    mapData: null,
    characters: [grappler, target, bystander],
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

function runAction(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
): { snapshot: PreviewCombatScenarioControlSnapshot; logMessage: string } {
  const patch = grappleEscapeScenarioControls.applyControl({
    controlId,
    value: true,
    snapshot,
  });

  return {
    snapshot: {
      ...snapshot,
      characters: patch.characters ?? snapshot.characters,
    },
    logMessage: patch.logMessage,
  };
}

function findCharacter(
  snapshot: PreviewCombatScenarioControlSnapshot,
  characterId: string,
): CombatCharacter {
  const character = snapshot.characters.find(candidate => candidate.id === characterId);
  if (!character) throw new Error(`Missing Grapple & Escape actor ${characterId}.`);
  return character;
}

describe('grappleEscapeScenarioControls', () => {
  it('registers exactly four inert action controls', () => {
    expect(grappleEscapeScenarioControls.scenarioId).toBe('grapple_escape');
    expect(grappleEscapeScenarioControls.controls).toHaveLength(4);
    expect(grappleEscapeScenarioControls.controls.map(control => control.kind)).toEqual([
      'action',
      'action',
      'action',
      'action',
    ]);
    expect(grappleEscapeScenarioControls.controls.every(control => control.defaultValue === false)).toBe(true);
  });

  it('publishes stable authored initiative totals with the Grappler first', () => {
    const snapshot = createSnapshot();
    const grappler = findCharacter(snapshot, GRAPPLE_ESCAPE_GRAPPLER_ID);
    const target = findCharacter(snapshot, GRAPPLE_ESCAPE_TARGET_ID);

    expect(getGrappleEscapeInitiativeTotal(grappler)).toBe(GRAPPLE_ESCAPE_GRAPPLER_INITIATIVE);
    expect(getGrappleEscapeInitiativeTotal(target)).toBe(GRAPPLE_ESCAPE_TARGET_INITIATIVE);
    expect(GRAPPLE_ESCAPE_GRAPPLER_INITIATIVE).toBeGreaterThan(GRAPPLE_ESCAPE_TARGET_INITIATIVE);
  });

  it('applies and voluntarily releases paired Grappled movement state', () => {
    const initial = createSnapshot();
    const released = runAction(initial, 'release-grapple');
    const mobileTarget = findCharacter(released.snapshot, GRAPPLE_ESCAPE_TARGET_ID);

    expect(calculateMovementTotal(mobileTarget)).toBe(30);
    expect(mobileTarget.conditions?.some(condition => condition.name === 'Grappled')).toBe(false);

    const applied = runAction(released.snapshot, 'apply-grapple');
    const heldTarget = findCharacter(applied.snapshot, GRAPPLE_ESCAPE_TARGET_ID);
    expect(heldTarget.statusEffects).toContainEqual(expect.objectContaining({
      name: 'Grappled',
      sourceCasterId: GRAPPLE_ESCAPE_GRAPPLER_ID,
    }));
    expect(heldTarget.conditions).toContainEqual(expect.objectContaining({ name: 'Grappled' }));
    expect(heldTarget.actionEconomy.movement.total).toBe(0);
    expect(applied.logMessage).toContain('5-foot reach');
  });

  it('spends an action on the fixed successful escape and logs the canonical total', () => {
    const initial = createSnapshot();
    const escaped = runAction(initial, 'attempt-escape');
    const target = findCharacter(escaped.snapshot, GRAPPLE_ESCAPE_TARGET_ID);

    expect(target.actionEconomy.action.used).toBe(true);
    expect(target.statusEffects.some(effect => effect.name === 'Grappled')).toBe(false);
    expect(target.actionEconomy.movement.total).toBe(30);
    expect(escaped.logMessage).toMatch(/d20 18, total \d+ vs DC 13 — success/);
  });

  it('auto-releases when the grappler becomes incapacitated and preserves bystanders', () => {
    const initial = createSnapshot();
    const originalBystander = findCharacter(initial, 'grapple-bystander');
    const result = runAction(initial, 'incapacitate-grappler');
    const grappler = findCharacter(result.snapshot, GRAPPLE_ESCAPE_GRAPPLER_ID);
    const target = findCharacter(result.snapshot, GRAPPLE_ESCAPE_TARGET_ID);

    expect(grappler.conditions).toContainEqual(expect.objectContaining({ name: 'Incapacitated' }));
    expect(target.conditions?.some(condition => condition.name === 'Grappled')).toBe(false);
    expect(target.actionEconomy.movement.total).toBe(30);
    expect(findCharacter(result.snapshot, 'grapple-bystander')).toBe(originalBystander);
    expect(result.logMessage).toContain('Auto-release');
  });

  it('keeps false defaults and malformed controls as state-preserving no-ops', () => {
    const snapshot = createSnapshot();
    const inert = grappleEscapeScenarioControls.applyControl({
      controlId: 'apply-grapple',
      value: false,
      snapshot,
    });
    const unknown = grappleEscapeScenarioControls.applyControl({
      controlId: 'stale-grapple-control',
      value: true,
      snapshot,
    });

    expect(inert.characters).toBeUndefined();
    expect(unknown.characters).toBeUndefined();
    expect(unknown.logMessage).toContain('Unknown');
  });
});
