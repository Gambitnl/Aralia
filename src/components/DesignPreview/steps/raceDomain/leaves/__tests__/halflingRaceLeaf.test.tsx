// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: Focused proof for the Halfling Race-domain leaf.
 *
 * MULTI-AGENT SAFETY:
 * Race 43 owns only this test and halflingRaceLeaf.tsx.
 */
// @dependencies-end

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { HALFLING_DATA } from '../../../../../../data/races/halfling';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  createHalflingBraveScenario,
  createHalflingDeterministicRng,
  getCanonicalHalflingSize,
  getCanonicalHalflingSpeedFeet,
  getCanonicalHalflingTrait,
  getHalflingBraveSaveAdapter,
  hasCanonicalHalflingFeatures,
  hasHalflingBraveParserProjection,
  HALFLING_SAVE_DC,
  RACE_DOMAIN_LEAF,
  resolveHalflingBrave,
} from '../halflingRaceLeaf';

/**
 * This file proves canonical Halfling identity, automatic discovery, production
 * actor parsing, native Brave advantage, deterministic faces, visible event logging,
 * parent reset remounting, and honest boundaries around Luck and movement traits.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry, canonical Halfling data, and the
 * Halfling leaf's production-backed scenario adapter.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking board from drifting away from the
// active Halfling record or the automatic leaves/ discovery contract.
// ============================================================================

describe('Halfling Race domain leaf', () => {
  it('links Brave and supporting facts to canonical Halfling data', () => {
    expect(ACTIVE_RACES.some(race => race.id === 'halfling')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('halfling');
    expect(RACE_DOMAIN_LEAF.id).toBe('halfling-brave');
    expect(hasCanonicalHalflingFeatures(HALFLING_DATA)).toBe(true);
    expect(getCanonicalHalflingSize(HALFLING_DATA)).toBe('Small');
    expect(getCanonicalHalflingSpeedFeet(HALFLING_DATA)).toBe(30);
    expect(getCanonicalHalflingTrait(HALFLING_DATA, 'Brave')).toContain('Frightened');
    expect(getCanonicalHalflingTrait(HALFLING_DATA, 'Halfling Nimbleness')).toContain('size larger');
    expect(getCanonicalHalflingTrait(HALFLING_DATA, 'Naturally Stealthy')).toContain('Hide action');
    expect(getCanonicalHalflingTrait(HALFLING_DATA, 'Luck')).toContain('Mechanical implementation of reroll not yet in place');
  });

  it('is discovered automatically for halfling', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    expect(registry.getLeavesForRace('halfling')).toContainEqual(RACE_DOMAIN_LEAF);
  });

  // ========================================================================
  // Production Parser And Narrow Context Adapter
  // ========================================================================
  // The actor and raw Brave projection must come from the production assembly
  // path before this leaf applies its deliberately narrow Frightened adapter.
  // ========================================================================

  it('assembles the canonical actor and exposes the parser Brave projection', () => {
    const scenario = createHalflingBraveScenario(HALFLING_DATA);

    expect(scenario.actor?.id).toBe('halfling-brave-actor');
    expect(scenario.combatActor?.creatureTypes).toContain('Halfling');
    expect(hasHalflingBraveParserProjection(scenario.actor)).toBe(true);
    expect(scenario.actor?.modifiers?.advantage).toEqual(expect.arrayContaining([
      expect.stringMatching(/saving throws.*Frightened/i),
    ]));
    expect(getHalflingBraveSaveAdapter(HALFLING_DATA)).toMatchObject({
      type: 'advantage',
      context: 'saving_throw',
      against: ['frightened'],
    });
  });

  // ========================================================================
  // Deterministic Native Brave Advantage
  // ========================================================================
  // The fixed low/high faces make native advantage visible while both branches
  // retain the same actor-derived modifier and DC.
  // ========================================================================

  it('uses two native faces for Brave while the ordinary comparison uses one', () => {
    const scenario = createHalflingBraveScenario(HALFLING_DATA);
    const resolved = resolveHalflingBrave(scenario, HALFLING_DATA, createHalflingDeterministicRng());
    const resolution = resolved.lastResolution;

    expect(resolution).toMatchObject({ status: 'resolved', reason: 'resolved' });
    expect(resolution?.ordinary?.d20Rolls).toEqual([2]);
    expect(resolution?.frightened?.d20Rolls).toEqual([2, 20]);
    expect(resolution?.ordinary?.save.roll).toBe(2);
    expect(resolution?.frightened?.save.roll).toBe(20);
    expect(resolution?.ordinary?.save.total).toBe((resolution?.frightened?.save.total ?? 0) - 18);
    const ordinaryModifier = (resolution?.ordinary?.save.total ?? 0) - (resolution?.ordinary?.save.roll ?? 0);
    const frightenedModifier = (resolution?.frightened?.save.total ?? 0) - (resolution?.frightened?.save.roll ?? 0);
    expect(frightenedModifier).toBe(ordinaryModifier);
    expect(resolution?.ordinary?.save.total).toBeLessThan(HALFLING_SAVE_DC);
    expect(resolution?.frightened?.save.total).toBeGreaterThanOrEqual(HALFLING_SAVE_DC);
    expect(resolved.outcome).toContain('Frightened kept 20 from 2 / 20');
  });

  // ========================================================================
  // Visible Event, Parent Reset, And Honest Boundaries
  // ========================================================================
  // The host's resetCount is a keyed remount boundary. This test checks the
  // rendered transaction and event callback without claiming mounted 2D/3D proof.
  // ========================================================================

  it('shows facts/results, publishes an event, remounts on reset, and names boundaries', () => {
    const events: string[] = [];
    const props = {
      race: HALFLING_DATA,
      state: createRaceDomainScenarioState(HALFLING_DATA.id, 0),
      onScenarioEvent: (message: string) => events.push(message),
    };
    const { rerender } = render(<RACE_DOMAIN_LEAF.Component {...props} />);

    expect(screen.getByTestId('halfling-actor-facts')).toHaveTextContent('parser Brave projection native');
    expect(screen.getByTestId('halfling-canonical-facts')).toHaveTextContent('Size: Small');
    expect(screen.getByTestId('halfling-canonical-facts')).toHaveTextContent('Speed: 30 feet');
    expect(screen.getByTestId('halfling-canonical-facts')).toHaveTextContent('Halfling Nimbleness');
    expect(screen.getByTestId('halfling-canonical-facts')).toHaveTextContent('Naturally Stealthy');

    fireEvent.click(screen.getByRole('button', { name: /resolve brave frightened save/i }));
    expect(screen.getByTestId('halfling-save-result')).toHaveTextContent('d20 face 2');
    expect(screen.getByTestId('halfling-save-result')).toHaveTextContent('d20 faces 2 / 20');
    expect(screen.getByTestId('halfling-save-result')).toHaveTextContent('kept face 20');
    expect(screen.getByTestId('halfling-save-result')).toHaveTextContent('modifier');
    expect(screen.getByTestId('halfling-save-result')).toHaveTextContent('total');
    expect(screen.getByTestId('halfling-save-result')).toHaveTextContent('success');
    expect(screen.getByTestId('halfling-save-result')).toHaveTextContent('Frightened');
    expect(events.at(-1)).toContain('Halfling BRAVE RESOLVED');

    rerender(
      <RACE_DOMAIN_LEAF.Component
        {...props}
        state={createRaceDomainScenarioState(HALFLING_DATA.id, 1)}
      />,
    );
    expect(screen.getByTestId('halfling-save-result')).toHaveTextContent('No Brave save comparison resolved yet');
    expect(screen.getByTestId('halfling-boundary')).toHaveTextContent('Luck rerolls');
    expect(screen.getByTestId('halfling-boundary')).toHaveTextContent('map movement');
    expect(screen.getByTestId('halfling-boundary')).toHaveTextContent('occupancy');
    expect(screen.getByTestId('halfling-boundary')).toHaveTextContent('Hide enforcement');
    expect(screen.getByTestId('halfling-canonical-facts')).toHaveTextContent('mechanical reroll implementation is not yet in place');
  });
});
