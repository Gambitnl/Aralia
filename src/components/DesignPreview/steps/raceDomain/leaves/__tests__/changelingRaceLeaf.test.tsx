import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  CHANGELING_APPEARANCE_OPTIONS,
  ChangelingRaceLeaf,
  RACE_DOMAIN_LEAF,
  createChangelingShapechangerScenario,
  getCanonicalShapechangerTrait,
  hasCanonicalShapechanger,
  resolveChangelingShapechanger,
} from '../changelingRaceLeaf';

/**
 * This file proves that the Changeling leaf is discoverable and that its
 * Shapechanger transaction keeps the production combat actor intact.
 *
 * The checks stay at the leaf boundary. The parent Race shell owns integrated
 * mounted proof, while these tests protect deterministic actor, Action,
 * appearance, reset, logging, and unsupported-boundary behavior.
 * Called by: focused Vitest checks for the Race domain.
 * Depends on: ACTIVE_RACES and the Changeling leaf's exported test seams.
 */

// ============================================================================
// Canonical Registration And Identity Proof
// ============================================================================
// These assertions protect automatic discovery and the source-data link before
// testing the native Action transaction.
// ============================================================================

describe('Changeling Race leaf', () => {
  const changeling = ACTIVE_RACES.find(race => race.id === 'changeling')!;

  it('exports the canonical identity and automatic-discovery registration', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('changeling');
    expect(RACE_DOMAIN_LEAF.raceId).toBe('changeling');
    expect(RACE_DOMAIN_LEAF.label).toBe('Changeling');
    expect(RACE_DOMAIN_LEAF.Component).toBe(ChangelingRaceLeaf);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('discovers the canonical Shapechanger facts', () => {
    expect(getCanonicalShapechangerTrait(changeling)).toContain('Shapechanger:');
    expect(hasCanonicalShapechanger(changeling)).toBe(true);
    expect(CHANGELING_APPEARANCE_OPTIONS.map(option => option.size)).toEqual(['Medium', 'Small']);
  });

  // ========================================================================
  // Native Action Transaction And Invariant Proof
  // ========================================================================
  // Shapechanger may alter the adapter appearance, but it must not replace or
  // mutate the production combat actor's game statistics, HP, or equipment.
  // ========================================================================

  it('changes deterministic appearance and voice while preserving combat facts', () => {
    const baseline = createChangelingShapechangerScenario(changeling);
    const actorBefore = baseline.actor!;
    const resolved = resolveChangelingShapechanger(baseline, 'cinder-small');
    const actorAfter = resolved.actor!;

    expect(resolved.lastResolution?.status).toBe('resolved');
    expect(resolved.appearance).toMatchObject({
      id: 'cinder-small',
      voice: 'quiet tenor',
      size: 'Small',
    });
    expect(actorAfter.actionEconomy.action.used).toBe(true);
    expect(actorAfter.currentHP).toBe(actorBefore.currentHP);
    expect(actorAfter.maxHP).toBe(actorBefore.maxHP);
    expect(actorAfter.stats).toEqual(actorBefore.stats);
    expect(actorAfter.class).toEqual(actorBefore.class);
    expect(actorAfter.abilities).toEqual(actorBefore.abilities);
    expect(actorAfter.equippedItems).toEqual(actorBefore.equippedItems);
    expect(actorAfter.actionEconomy.bonusAction).toEqual(actorBefore.actionEconomy.bonusAction);
    expect(actorAfter.actionEconomy.reaction).toEqual(actorBefore.actionEconomy.reaction);
    expect(actorAfter.actionEconomy.movement).toEqual(actorBefore.actionEconomy.movement);
    expect(resolved.outcome).toContain('Combat statistics, HP, equipment, and other mechanics unchanged');
  });

  it('pays the Action once and rejects a second use atomically', () => {
    const baseline = createChangelingShapechangerScenario(changeling);
    const firstUse = resolveChangelingShapechanger(baseline, 'moonlit-medium');
    const secondUse = resolveChangelingShapechanger(firstUse, 'cinder-small');

    expect(firstUse.actor?.actionEconomy.action.used).toBe(true);
    expect(firstUse.appearance.id).toBe('moonlit-medium');
    expect(secondUse.lastResolution?.status).toBe('rejected');
    expect(secondUse.actor).toBe(firstUse.actor);
    expect(secondUse.appearance).toBe(firstUse.appearance);
    expect(secondUse.outcome).toContain('the Action is already used');
    expect(secondUse.outcome).toContain('unchanged');
  });

  // ========================================================================
  // Visible Event, Reset, And Boundary Proof
  // ========================================================================
  // The component must publish the transaction outcome and remount cleanly
  // when the parent increments resetCount.
  // ========================================================================

  it('shows the outcome, logs it, resets through the keyed boundary, and names the limit', () => {
    const events: string[] = [];
    const { rerender } = render(
      <ChangelingRaceLeaf
        race={changeling}
        state={createRaceDomainScenarioState(changeling.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('changeling-actor')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('changeling-appearance')).toHaveTextContent('Original face');
    fireEvent.change(screen.getByLabelText(/shapechanger appearance/i), { target: { value: 'cinder-small' } });
    fireEvent.click(screen.getByRole('button', { name: /use shapechanger/i }));

    expect(screen.getByTestId('changeling-appearance')).toHaveTextContent('Cinder mask');
    expect(screen.getByTestId('changeling-actor')).toHaveTextContent('Action used');
    expect(screen.getByTestId('changeling-outcome')).toHaveTextContent('Shapechanger resolved');
    expect(events.at(-1)).toContain('Changeling SHAPECHANGER RESOLVED');

    rerender(
      <ChangelingRaceLeaf
        race={changeling}
        state={createRaceDomainScenarioState(changeling.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('changeling-appearance')).toHaveTextContent('Original face');
    expect(screen.getByTestId('changeling-actor')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('changeling-appearance-boundary')).toHaveTextContent('no production race-aware appearance resolver exists');
    expect(screen.getByTestId('changeling-appearance-boundary')).toHaveTextContent('does not fake a mechanical transformation');
  });

  it('rejects unavailable canonical Shapechanger data without changing the actor', () => {
    const invalidRace = { ...changeling, traits: changeling.traits.filter(trait => !trait.startsWith('Shapechanger:')) };
    const baseline = createChangelingShapechangerScenario(invalidRace);
    const rejected = resolveChangelingShapechanger(baseline, 'moonlit-medium');

    expect(baseline.actor).toBeNull();
    expect(rejected.lastResolution?.status).toBe('rejected');
    expect(rejected.actor).toBeNull();
    expect(rejected.appearance).toEqual(baseline.appearance);
    expect(rejected.outcome).toContain('production-assembled actor is unavailable');
  });
});
