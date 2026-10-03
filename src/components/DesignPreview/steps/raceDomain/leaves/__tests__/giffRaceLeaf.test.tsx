// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: Focused proof for the Giff Race-domain leaf.
 *
 * MULTI-AGENT SAFETY:
 * Race 33 owns only this test and giffRaceLeaf.tsx.
 */
// @dependencies-end

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { GIFF_DATA } from '../../../../../../data/races/giff';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  applyGiffAstralSpark,
  createGiffAstralSparkScenario,
  declineGiffAstralSpark,
  getCanonicalGiffAstralSparkTrait,
  getGiffAstralSparkResource,
  GIFF_ASTRAL_SPARK_RESOURCE_ID,
  hasCanonicalGiffFeatures,
  RACE_DOMAIN_LEAF,
  rollGiffAstralSpark,
  type GiffAstralSparkScenarioState,
} from '../giffRaceLeaf';

/**
 * This file proves canonical Giff identity, automatic discovery, native d20
 * transaction behavior, atomic Apply/Decline/exhaustion, Reset/log behavior,
 * and the honest boundaries around firearms, carrying, and swim facts.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry discovery seam, canonical Giff
 * data, and giffRaceLeaf.tsx's production-backed scenario adapter.
 */

// ============================================================================
// Canonical Linkage And Discovery
// ============================================================================
// These checks prevent a plausible-looking leaf from drifting away from the
// active race or the automatic leaves/ discovery contract.
// ============================================================================

describe('Giff Race domain leaf', () => {
  it('links Astral Spark and all requested canonical facts to the active race', () => {
    const astralSpark = getCanonicalGiffAstralSparkTrait(GIFF_DATA);

    expect(ACTIVE_RACES.some(race => race.id === 'giff')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('giff');
    expect(RACE_DOMAIN_LEAF.id).toBe('giff-astral-spark');
    expect(hasCanonicalGiffFeatures(GIFF_DATA)).toBe(true);
    expect(astralSpark).toContain('after you see the d20 roll');
    expect(astralSpark).toContain('Proficiency Bonus');
    expect(astralSpark).toContain('long rest');
    expect(GIFF_DATA.traits.find(trait => trait.startsWith('Speed:'))).toContain('swim 30 feet');
    expect(GIFF_DATA.traits.find(trait => trait.startsWith('Firearms Mastery:'))).toContain('all firearms');
    expect(GIFF_DATA.traits.find(trait => trait.startsWith('Hippo Build:'))).toContain('carrying capacity');
    expect(GIFF_ASTRAL_SPARK_RESOURCE_ID).toBe('racial_feature_giff__astral_spark__resource');
  });

  it('is discovered automatically for giff', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    expect(registry.getLeavesForRace('giff').some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Native d20 Choice And Atomic Resource Payment
  // ========================================================================
  // A fixed random stream keeps the d20 observable and lets the test prove that
  // Apply reruns the same face with PB while Decline never changes the charge.
  // ========================================================================

  it('rolls a native ability check, applies PB after seeing the d20, and spends one parsed use', () => {
    const baseline = createGiffAstralSparkScenario(GIFF_DATA);
    const rolled = rollGiffAstralSpark(baseline, 'ability-check', () => 0.45);
    const resourceBefore = getGiffAstralSparkResource(rolled.actor);

    expect(rolled.pendingRoll).toMatchObject({ transaction: 'ability-check', d20: 10 });
    expect(resourceBefore).toMatchObject({ current: 3, max: 'proficiency_bonus', resetOn: 'long_rest' });

    const applied = applyGiffAstralSpark(rolled);
    expect(applied.lastResolution).toMatchObject({
      status: 'resolved',
      reason: 'applied',
      transaction: 'ability-check',
      d20: 10,
      proficiencyBonusAdded: 3,
      usesRemaining: 2,
    });
    expect(applied.lastResolution?.baseTotal).toBe(rolled.pendingRoll?.baseTotal);
    expect(applied.lastResolution?.finalTotal).toBe((rolled.pendingRoll?.baseTotal ?? 0) + 3);
    expect(applied.pendingRoll).toBeNull();
    expect(getGiffAstralSparkResource(applied.actor)?.current).toBe(2);
  });

  it('declines without spending the resource and uses native Action payment for attacks', () => {
    const baseline = createGiffAstralSparkScenario(GIFF_DATA);
    const rolled = rollGiffAstralSpark(baseline, 'attack', () => 0.45);
    expect(rolled.pendingRoll?.d20).toBe(10);
    expect(rolled.combatActor?.actionEconomy.action.used).toBe(true);

    const declined = declineGiffAstralSpark(rolled);
    expect(declined.lastResolution).toMatchObject({ reason: 'declined', d20: 10, finalTotal: rolled.pendingRoll?.baseTotal, usesRemaining: 3 });
    expect(getGiffAstralSparkResource(declined.actor)?.current).toBe(3);
    expect(declined.outcome).toContain('resource unchanged');
  });

  it('supports native saving throws and rejects Apply atomically after PB uses are exhausted', () => {
    let scenario = createGiffAstralSparkScenario(GIFF_DATA);
    for (let index = 0; index < 3; index += 1) {
      scenario = applyGiffAstralSpark(rollGiffAstralSpark(scenario, 'saving-throw', () => 0.7));
      expect(scenario.lastResolution?.reason).toBe('applied');
    }
    expect(getGiffAstralSparkResource(scenario.actor)?.current).toBe(0);

    const pending = rollGiffAstralSpark(scenario, 'saving-throw', () => 0.7);
    const beforeActor = pending.actor;
    const exhausted = applyGiffAstralSpark(pending);
    expect(exhausted.lastResolution).toMatchObject({ status: 'rejected', reason: 'resource_exhausted', usesRemaining: 0 });
    expect(exhausted.actor).toBe(beforeActor);
    expect(exhausted.pendingRoll).toEqual(pending.pendingRoll);
    expect(exhausted.outcome).toContain('actor and roll are unchanged');
  });

  // ========================================================================
  // Visible UI, Reset, Event Log, And Boundaries
  // ========================================================================
  // The component proof checks the same visible transaction a mounted shell
  // would consume, including the parent resetCount remount seam.
  // ========================================================================

  it('shows base d20/modifier/final/resource, publishes logs, resets, and labels fact-only boundaries', () => {
    const events: string[] = [];
    const props = {
      race: GIFF_DATA,
      state: createRaceDomainScenarioState(GIFF_DATA.id, 0),
      onScenarioEvent: (message: string) => events.push(message),
    };
    const { rerender } = render(<RACE_DOMAIN_LEAF.Component {...props} />);

    expect(screen.getByTestId('giff-actor-facts')).toHaveTextContent('PB +3');
    expect(screen.getByTestId('giff-actor-facts')).toHaveTextContent('uses 3/3 (long_rest)');
    expect(screen.getByTestId('giff-canonical-facts')).toHaveTextContent('swim 30 feet');
    expect(screen.getByTestId('giff-canonical-facts')).toHaveTextContent('Firearms Mastery');
    expect(screen.getByTestId('giff-canonical-facts')).toHaveTextContent('Hippo Build');

    fireEvent.click(screen.getByRole('button', { name: /roll d20/i }));
    expect(screen.getByTestId('giff-roll-facts')).toHaveTextContent('Visible d20');
    expect(screen.getByTestId('giff-roll-facts')).toHaveTextContent('base modifier');
    expect(screen.getByTestId('giff-astral-spark-choice')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /apply pb/i }));
    expect(screen.getByTestId('giff-roll-facts')).toHaveTextContent('PB added 3');
    expect(screen.getByTestId('giff-actor-facts')).toHaveTextContent('uses 2/3');
    expect(events.at(-1)).toContain('Giff ASTRAL SPARK APPLIED');

    rerender(<RACE_DOMAIN_LEAF.Component {...props} state={createRaceDomainScenarioState(GIFF_DATA.id, 1)} />);
    expect(screen.getByTestId('giff-actor-facts')).toHaveTextContent('uses 3/3');
    expect(screen.getByTestId('giff-roll-facts')).toHaveTextContent('No d20 has been rolled yet');
    expect(screen.getByTestId('giff-boundary')).toHaveTextContent('no firearm item');
    expect(screen.getByTestId('giff-boundary')).toHaveTextContent('carrying capacity');
    expect(screen.getByTestId('giff-boundary')).toHaveTextContent('no swim movement');
    expect(screen.getByTestId('giff-boundary')).toHaveTextContent('2D/3D render proof');
  });
});

// Keep the scenario type imported in this focused file as an explicit reminder
// that future proof should preserve the state contract instead of inventing a
// second Giff-specific transaction object.
const _scenarioTypeGuard: GiffAstralSparkScenarioState | null = null;
void _scenarioTypeGuard;
