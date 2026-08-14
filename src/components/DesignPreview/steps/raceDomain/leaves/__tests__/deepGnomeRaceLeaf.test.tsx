import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { DEEP_GNOME_DATA } from '../../../../../../data/races/deep_gnome';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  DEEP_GNOME_ACTOR_ID,
  DEEP_GNOME_GNOMISH_CAMOUFLAGE_RESOURCE_ID,
  DeepGnomeRaceLeaf,
  createDeepGnomeGnomishCamouflageScenario,
  getCanonicalDeepGnomeVisionTrait,
  getCanonicalGiftOfTheSvirfneblinTrait,
  getCanonicalGnomishCamouflageTrait,
  hasCanonicalDeepGnomeFeatures,
  hasDeepGnomeStealthAdvantageProjection,
  resolveDeepGnomeGnomishCamouflage,
  RACE_DOMAIN_LEAF,
} from '../deepGnomeRaceLeaf';

/**
 * This file proves that the Deep Gnome leaf stays linked to canonical race data,
 * automatic discovery, production actor assembly, and the shared ability-check
 * and dice helpers. It also proves atomic PB-resource payment, visible logging,
 * reset behaviour, and the deliberate Darkvision/spell boundary.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry, canonical Deep Gnome data, and
 * the Deep Gnome leaf's deterministic production-backed transaction helpers.
 */

// ============================================================================
// Canonical Linkage And Discovery
// ============================================================================
// These checks prevent a plausible-looking preview from drifting away from the
// active race record or from the automatic leaf discovery contract.
// ============================================================================

describe('Deep Gnome Race domain leaf', () => {
  it('links Camouflage, Darkvision, and Gift facts to canonical Deep Gnome data', () => {
    expect(ACTIVE_RACES.some(race => race.id === 'deep_gnome')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('deep_gnome');
    expect(RACE_DOMAIN_LEAF.id).toBe('deep-gnome-gnomish-camouflage');
    expect(hasCanonicalDeepGnomeFeatures(DEEP_GNOME_DATA)).toBe(true);
    expect(getCanonicalGnomishCamouflageTrait(DEEP_GNOME_DATA)).toContain('Dexterity (Stealth)');
    expect(getCanonicalDeepGnomeVisionTrait(DEEP_GNOME_DATA)).toContain('120 feet');
    expect(getCanonicalGiftOfTheSvirfneblinTrait(DEEP_GNOME_DATA)).toContain('choose when you select this species');
    expect(DEEP_GNOME_GNOMISH_CAMOUFLAGE_RESOURCE_ID).toBe('racial_feature_deep_gnome__gnomish_camouflage__resource');
  });

  it('is discovered for deep_gnome by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('deep_gnome');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Native Assembly And Advantage Check
  // ========================================================================
  // The representative proof must come from an assembled PlayerCharacter and
  // rollAbilityCheck. A missing parser projection rejects instead of faking a
  // racial advantage or resource entry in the preview.
  // ========================================================================

  it('assembles the canonical actor, PB resource, and Stealth advantage check', () => {
    const baseline = createDeepGnomeGnomishCamouflageScenario(DEEP_GNOME_DATA);
    const actor = baseline.actor;

    expect(actor?.id).toBe(DEEP_GNOME_ACTOR_ID);
    expect(hasDeepGnomeStealthAdvantageProjection(actor)).toBe(true);
    expect(actor?.limitedUses?.[DEEP_GNOME_GNOMISH_CAMOUFLAGE_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });

    const resolved = resolveDeepGnomeGnomishCamouflage(baseline, () => [0.15, 0.75][0] ?? 0.5);
    expect(resolved.lastResolution?.status).toBe('resolved');
    expect(resolved.lastResolution?.d20Rolls).toEqual([4, 4]);
  });

  it('pins both advantage faces and reports the shared check result deterministically', () => {
    const baseline = createDeepGnomeGnomishCamouflageScenario(DEEP_GNOME_DATA);
    const randomValues = [0.15, 0.75];
    const resolved = resolveDeepGnomeGnomishCamouflage(baseline, () => randomValues.shift() ?? 0.5);

    expect(resolved.lastResolution).toMatchObject({
      status: 'resolved',
      reason: 'resolved',
      d20Rolls: [4, 16],
      check: { roll: 16, total: 22 },
    });
    expect(resolved.actor?.limitedUses?.[DEEP_GNOME_GNOMISH_CAMOUFLAGE_RESOURCE_ID]?.current).toBe(2);
    expect(resolved.outcome).toContain('kept 16');
  });

  it('rejects an exhausted resource atomically without changing the actor', () => {
    const baseline = createDeepGnomeGnomishCamouflageScenario(DEEP_GNOME_DATA);
    const actor = baseline.actor!;
    const exhausted = {
      ...baseline,
      actor: {
        ...actor,
        limitedUses: {
          ...actor.limitedUses,
          [DEEP_GNOME_GNOMISH_CAMOUFLAGE_RESOURCE_ID]: {
            ...actor.limitedUses?.[DEEP_GNOME_GNOMISH_CAMOUFLAGE_RESOURCE_ID],
            current: 0,
          },
        },
      },
    };
    const rejected = resolveDeepGnomeGnomishCamouflage(exhausted, () => 0.75);

    expect(rejected.lastResolution).toMatchObject({ status: 'rejected', reason: 'resource_unavailable' });
    expect(rejected.actor?.limitedUses?.[DEEP_GNOME_GNOMISH_CAMOUFLAGE_RESOURCE_ID]?.current).toBe(0);
    expect(rejected.outcome).toContain('actor and resource are unchanged');
  });

  // ========================================================================
  // Visible Event, Reset, And Honest Boundaries
  // ========================================================================
  // The component reports the native result through the shell callback, uses
  // resetCount as its keyed remount, and states exactly what is not simulated.
  // ========================================================================

  it('shows actor/resource/check facts, logs the result, resets, and labels boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <DeepGnomeRaceLeaf
        race={DEEP_GNOME_DATA}
        state={createRaceDomainScenarioState(DEEP_GNOME_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('deep-gnome-canonical-trait')).toHaveTextContent('Dexterity (Stealth)');
    expect(screen.getByTestId('deep-gnome-actor')).toHaveTextContent('PB +3');
    expect(screen.getByTestId('deep-gnome-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('deep-gnome-vision-fact')).toHaveTextContent('120 feet');
    expect(screen.getByTestId('deep-gnome-gift-facts')).toHaveTextContent('Disguise Self');
    expect(screen.getByTestId('deep-gnome-gift-facts')).toHaveTextContent('Nondetection');

    fireEvent.click(screen.getByRole('button', { name: /resolve gnomish camouflage check/i }));

    expect(screen.getByTestId('deep-gnome-outcome')).toHaveTextContent('Gnomish Camouflage resolved');
    expect(screen.getByTestId('deep-gnome-check-result')).toHaveTextContent('Dexterity (Stealth) total');
    expect(screen.getByTestId('deep-gnome-actor')).toHaveTextContent('Uses 2/3');
    expect(events.at(-1)).toContain('Deep Gnome GNOMISH CAMOUFLAGE RESOLVED');

    rerender(
      <DeepGnomeRaceLeaf
        race={DEEP_GNOME_DATA}
        state={createRaceDomainScenarioState(DEEP_GNOME_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('deep-gnome-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('deep-gnome-check-result')).toHaveTextContent('No Gnomish Camouflage check resolved yet');
    expect(screen.getByTestId('deep-gnome-assembly-boundary')).toHaveTextContent('rejects deep_gnome');
    expect(screen.getByTestId('deep-gnome-assembly-boundary')).toHaveTextContent('typed fixture adapter');
    expect(screen.getByTestId('deep-gnome-assembly-boundary')).toHaveTextContent('applyRacialSpellGrantsByLevel');
    expect(screen.getByTestId('deep-gnome-unsupported-boundary')).toHaveTextContent('Darkvision sensing/visibility');
    expect(screen.getByTestId('deep-gnome-unsupported-boundary')).toHaveTextContent('No 2D/3D render proof');
  });
});
