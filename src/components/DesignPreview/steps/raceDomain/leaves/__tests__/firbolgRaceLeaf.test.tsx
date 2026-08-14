import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { FIRBOLG_DATA } from '../../../../../../data/races/firbolg';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  advanceFirbolgHiddenStepToNextTurn,
  breakFirbolgHiddenStep,
  createFirbolgHiddenStepScenario,
  FIRBOLG_HIDDEN_STEP_ACTOR_ID,
  FIRBOLG_HIDDEN_STEP_RESOURCE_ID,
  FirbolgRaceLeaf,
  getCanonicalFirbolgHiddenStepTrait,
  getCanonicalFirbolgMagicTrait,
  getCanonicalFirbolgPowerfulBuildTrait,
  getCanonicalFirbolgSpeechTrait,
  getFirbolgHiddenStepResource,
  hasCanonicalFirbolgFeatures,
  hasFirbolgPowerfulBuildProjection,
  resolveFirbolgHiddenStep,
  RACE_DOMAIN_LEAF,
} from '../firbolgRaceLeaf';

/**
 * This file proves that the Firbolg leaf stays linked to canonical race data,
 * automatic discovery, production actor assembly, native action/resource and
 * paired Invisible condition helpers, deterministic break/expiry, reset, and
 * honest spell/carrying/social/lifecycle boundaries.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry, canonical Firbolg data, and the
 * Firbolg leaf's bounded production-backed transaction helpers.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking preview from drifting away from
// active Firbolg facts or the automatic leaf discovery contract.
// ============================================================================

describe('Firbolg Race domain leaf', () => {
  it('links Hidden Step and all fact panels to canonical Firbolg data', () => {
    expect(ACTIVE_RACES.some(race => race.id === 'firbolg')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('firbolg');
    expect(RACE_DOMAIN_LEAF.id).toBe('firbolg-hidden-step');
    expect(hasCanonicalFirbolgFeatures(FIRBOLG_DATA)).toBe(true);
    expect(getCanonicalFirbolgMagicTrait(FIRBOLG_DATA)).toContain('detect magic');
    expect(getCanonicalFirbolgHiddenStepTrait(FIRBOLG_DATA)).toContain('bonus action');
    expect(getCanonicalFirbolgPowerfulBuildTrait(FIRBOLG_DATA)).toContain('carrying capacity');
    expect(getCanonicalFirbolgSpeechTrait(FIRBOLG_DATA)).toContain('Beasts');
    expect(FIRBOLG_HIDDEN_STEP_RESOURCE_ID).toBe('racial_feature_firbolg__hidden_step__resource');
  });

  it('is discovered for firbolg by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('firbolg');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Native Assembly, Activation, And Atomic Bookkeeping
  // ========================================================================
  // The transaction must pay the shared Bonus Action and parsed resource only
  // after every guard passes, then publish both Invisible runtime mirrors.
  // ========================================================================

  it('assembles the actor with canonical PB resource and Powerful Build projection', () => {
    const baseline = createFirbolgHiddenStepScenario(FIRBOLG_DATA);
    const actor = baseline.actor;

    expect(actor?.id).toBe(FIRBOLG_HIDDEN_STEP_ACTOR_ID);
    expect(hasFirbolgPowerfulBuildProjection(actor)).toBe(true);
    expect(getFirbolgHiddenStepResource(actor)).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
  });

  it('activates Hidden Step with atomic Bonus Action, resource, and Invisible bookkeeping', () => {
    const baseline = createFirbolgHiddenStepScenario(FIRBOLG_DATA);
    const resolved = resolveFirbolgHiddenStep(baseline);

    expect(resolved.lastResolution).toMatchObject({ status: 'activated', reason: 'activated' });
    expect(resolved.actor?.actionEconomy.bonusAction.used).toBe(true);
    expect(getFirbolgHiddenStepResource(resolved.actor)?.current).toBe(2);
    expect(resolved.actor?.conditions).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Invisible', source: 'Firbolg Hidden Step' }),
    ]));
    expect(resolved.actor?.statusEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Invisible', source: 'Firbolg Hidden Step' }),
    ]));
    expect(resolved.outcome).toContain('start of the next turn');
  });

  it('rejects exhaustion atomically without spending the Bonus Action or changing status', () => {
    const baseline = createFirbolgHiddenStepScenario(FIRBOLG_DATA);
    const actor = baseline.actor!;
    const exhausted = {
      ...baseline,
      actor: {
        ...actor,
        limitedUses: {
          ...actor.limitedUses,
          [FIRBOLG_HIDDEN_STEP_RESOURCE_ID]: {
            ...actor.limitedUses?.[FIRBOLG_HIDDEN_STEP_RESOURCE_ID],
            current: 0,
          },
        },
      },
    };
    const rejected = resolveFirbolgHiddenStep(exhausted);

    expect(rejected.lastResolution).toMatchObject({ status: 'rejected', reason: 'resource_unavailable' });
    expect(rejected.actor).toBe(exhausted.actor);
    expect(rejected.actor?.actionEconomy.bonusAction.used).toBe(false);
    expect(rejected.actor?.conditions ?? []).toEqual([]);
    expect(rejected.outcome).toContain('unchanged');
  });

  // ========================================================================
  // Native Break, Explicit Expiry, Visible Logging, And Reset
  // ========================================================================
  // Break/expiry use native exact-owned removal, while the rendered surface
  // reports the same result to the shell event log and resets from resetCount.
  // ========================================================================

  it('ends Invisible on a deterministic damage trigger without refunding the charge', () => {
    const active = resolveFirbolgHiddenStep(createFirbolgHiddenStepScenario(FIRBOLG_DATA));
    const broken = breakFirbolgHiddenStep(active, 'damage');

    expect(broken.lastResolution).toMatchObject({ status: 'ended', reason: 'ended_on_damage', trigger: 'damage' });
    expect(broken.actor?.conditions).toEqual([]);
    expect(broken.actor?.statusEffects).toEqual([]);
    expect(getFirbolgHiddenStepResource(broken.actor)?.current).toBe(2);
  });

  it('expires Invisible at the deterministic next-turn boundary without refunding the charge', () => {
    const active = resolveFirbolgHiddenStep(createFirbolgHiddenStepScenario(FIRBOLG_DATA));
    const expired = advanceFirbolgHiddenStepToNextTurn(active);

    expect(expired.lastResolution).toMatchObject({ status: 'ended', reason: 'ended_on_next_turn', trigger: 'next_turn' });
    expect(expired.actor?.conditions).toEqual([]);
    expect(getFirbolgHiddenStepResource(expired.actor)?.current).toBe(2);
  });

  it('shows facts, action/resource/status state, event log, lifecycle boundary, and reset', () => {
    const events: string[] = [];
    const { rerender } = render(
      <FirbolgRaceLeaf
        race={FIRBOLG_DATA}
        state={createRaceDomainScenarioState(FIRBOLG_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('firbolg-hidden-step-canonical-trait')).toHaveTextContent('bonus action');
    expect(screen.getByTestId('firbolg-hidden-step-actor')).toHaveTextContent('PB +3');
    expect(screen.getByTestId('firbolg-hidden-step-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('firbolg-hidden-step-facts')).toHaveTextContent('Firbolg Magic');
    expect(screen.getByTestId('firbolg-hidden-step-facts')).toHaveTextContent('Powerful Build');
    expect(screen.getByTestId('firbolg-hidden-step-facts')).toHaveTextContent('Speech of Beast and Leaf');
    expect(screen.getByTestId('firbolg-hidden-step-lifecycle-boundary')).toHaveTextContent('not wired into this leaf');

    fireEvent.click(screen.getByRole('button', { name: /resolve hidden step/i }));
    expect(screen.getByTestId('firbolg-hidden-step-actor')).toHaveTextContent('Bonus Action used');
    expect(screen.getByTestId('firbolg-hidden-step-actor')).toHaveTextContent('Invisible active');
    expect(screen.getByTestId('firbolg-hidden-step-actor')).toHaveTextContent('Uses 2/3');
    expect(events.at(-1)).toContain('Firbolg HIDDEN STEP ACTIVATED');

    fireEvent.click(screen.getByRole('button', { name: /break on attack/i }));
    expect(screen.getByTestId('firbolg-hidden-step-actor')).toHaveTextContent('Invisible inactive');
    expect(events.at(-1)).toContain('Firbolg HIDDEN STEP ENDED');

    rerender(
      <FirbolgRaceLeaf
        race={FIRBOLG_DATA}
        state={createRaceDomainScenarioState(FIRBOLG_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );
    expect(screen.getByTestId('firbolg-hidden-step-actor')).toHaveTextContent('Bonus Action ready');
    expect(screen.getByTestId('firbolg-hidden-step-actor')).toHaveTextContent('Invisible inactive');
    expect(screen.getByTestId('firbolg-hidden-step-actor')).toHaveTextContent('Uses 3/3');
  });
});
