import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { DROW_DATA } from '../../../../../../data/races/drow';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  DROW_ACTOR_ID,
  DrowRaceLeaf,
  createDrowSunlightSensitivityScenario,
  getCanonicalDrowMagicTrait,
  getCanonicalDrowSunlightSensitivityTrait,
  getCanonicalDrowVisionTrait,
  hasCanonicalDrowFeatures,
  hasDrowPerceptionProficiencyProjection,
  resolveDrowSunlightSensitivity,
  RACE_DOMAIN_LEAF,
} from '../drowRaceLeaf';

/**
 * This file proves that the Drow leaf stays linked to canonical race data,
 * automatic discovery, production actor assembly, and the shared ability-check
 * and dice helpers. It also proves deterministic disadvantage, visible logging,
 * keyed Reset behaviour, and the deliberate facts-only boundaries.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry, canonical Drow data, and the
 * Drow leaf's production-backed comparison helpers.
 */

// ============================================================================
// Canonical Linkage And Discovery
// ============================================================================
// These checks stop a plausible-looking Drow panel from drifting away from the
// active canonical race or automatic leaf discovery contract.
// ============================================================================

describe('Drow Race domain leaf', () => {
  it('links identity, Sunlight Sensitivity, Superior Darkvision, and Drow Magic to canonical data', () => {
    expect(ACTIVE_RACES.some(race => race.id === 'drow')).toBe(true);
    expect(RACE_DOMAIN_LEAF.id).toBe('drow-sunlight-sensitivity');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(DROW_DATA.id);
    expect(RACE_DOMAIN_LEAF.label).toContain('Drow');
    expect(hasCanonicalDrowFeatures(DROW_DATA)).toBe(true);
    expect(getCanonicalDrowSunlightSensitivityTrait(DROW_DATA)).toContain('direct sunlight');
    expect(getCanonicalDrowVisionTrait(DROW_DATA)).toContain('120 feet');
    expect(getCanonicalDrowMagicTrait(DROW_DATA)).toContain('Darkness');
  });

  it('is discovered for drow by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('drow');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Native Assembly And Conditional Check Comparison
  // ========================================================================
  // The actor comes through production assembly and parsing. The sunlight
  // condition is supplied only by the narrow adapter because the parser has no
  // scene-light context; it is never treated as an unconditional disadvantage.
  // ========================================================================

  it('assembles a parser-backed actor with native Keen Senses projection', () => {
    const scenario = createDrowSunlightSensitivityScenario(DROW_DATA);

    expect(scenario.actor?.id).toBe(DROW_ACTOR_ID);
    expect(hasDrowPerceptionProficiencyProjection(scenario.actor)).toBe(true);
    expect(scenario.actor?.modifiers?.disadvantage).toEqual([]);
    expect(scenario.actor?.modifiers?.disadvantage.some(modifier => /direct sunlight/i.test(modifier))).toBe(false);
    expect(scenario.outcome).toContain('parser-backed Drow actor');
  });

  it('compares the same Perception check with deterministic sunlight disadvantage', () => {
    const scenario = createDrowSunlightSensitivityScenario(DROW_DATA);
    const randomValues = [0.75, 0.75, 0.15];
    const resolved = resolveDrowSunlightSensitivity(scenario, DROW_DATA, () => randomValues.shift() ?? 0.5);

    expect(resolved.lastResolution).toMatchObject({ status: 'resolved', reason: 'resolved' });
    expect(resolved.lastResolution?.baseline?.d20Rolls).toEqual([16]);
    expect(resolved.lastResolution?.sunlight?.d20Rolls).toEqual([16, 4]);
    expect(resolved.lastResolution?.baseline?.check.roll).toBe(16);
    expect(resolved.lastResolution?.sunlight?.check.roll).toBe(4);
    expect(resolved.lastResolution?.sunlight?.check.total).toBe(
      (resolved.lastResolution?.baseline?.check.total ?? 0) - 12,
    );
    expect(resolved.outcome).toContain('direct sunlight kept 4');
  });

  // ========================================================================
  // Visible Event, Reset, And Honest Boundaries
  // ========================================================================
  // The component reports the native comparison through the shell callback,
  // uses resetCount as its keyed remount, and states exactly what is deferred.
  // ========================================================================

  it('shows both faces and results, logs the comparison, resets, and labels boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <DrowRaceLeaf
        race={DROW_DATA}
        state={createRaceDomainScenarioState(DROW_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('drow-canonical-trait')).toHaveTextContent('direct sunlight');
    expect(screen.getByTestId('drow-actor')).toHaveTextContent('Perception proficiency native');
    expect(screen.getByTestId('drow-canonical-facts')).toHaveTextContent('Superior Darkvision');
    expect(screen.getByTestId('drow-canonical-facts')).toHaveTextContent('Fey Ancestry');
    expect(screen.getByTestId('drow-canonical-facts')).toHaveTextContent('Keen Senses');
    expect(screen.getByTestId('drow-canonical-facts')).toHaveTextContent('Trance');
    expect(screen.getByTestId('drow-canonical-facts')).toHaveTextContent('Drow Magic');

    fireEvent.click(screen.getByRole('button', { name: /compare sunlight perception check/i }));

    expect(screen.getByTestId('drow-check-result')).toHaveTextContent('Non-sunlight baseline');
    expect(screen.getByTestId('drow-check-result')).toHaveTextContent('Direct sunlight');
    expect(screen.getByTestId('drow-check-result')).toHaveTextContent('d20 faces');
    expect(screen.getByTestId('drow-check-result')).toHaveTextContent('disadvantage applied');
    expect(events.at(-1)).toContain('Drow SUNLIGHT SENSITIVITY RESOLVED');

    rerender(
      <DrowRaceLeaf
        race={DROW_DATA}
        state={createRaceDomainScenarioState(DROW_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('drow-check-result')).toHaveTextContent('No Drow Sunlight Sensitivity comparison resolved yet');
    expect(screen.getByTestId('drow-context-boundary')).toHaveTextContent('canonical Sunlight Sensitivity trait');
    expect(screen.getByTestId('drow-context-boundary')).toHaveTextContent('does not simulate sensing');
    expect(screen.getByTestId('drow-context-boundary')).toHaveTextContent('saving throws');
    expect(screen.getByTestId('drow-context-boundary')).toHaveTextContent('spell casting');
    expect(screen.getByTestId('drow-context-boundary')).toHaveTextContent('rest');
    expect(screen.getByTestId('drow-context-boundary')).toHaveTextContent('No 2D/3D render proof');
  });
});
