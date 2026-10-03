// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: Focused proof for the Astral Elf Race-domain leaf.
 *
 * MULTI-AGENT SAFETY:
 * This test owns only the Astral Elf leaf contract and its deterministic helper proof.
 */
// @dependencies-end

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { ASTRAL_ELF_DATA } from '../../../../../../data/races/astral_elf';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID,
  AstralElfRaceLeaf,
  createAstralElfStarlightStepScenario,
  getCanonicalStarlightStepTrait,
  hasCanonicalStarlightStep,
  resolveAstralElfStarlightStep,
  RACE_DOMAIN_LEAF,
} from '../astralElfRaceLeaf';

/**
 * This file proves that the Astral Elf Race leaf stays linked to canonical
 * Starlight Step text and that its narrow native-helper adapter is atomic.
 *
 * Called by: Vitest focused and cumulative Race-domain checks.
 * Depends on: ACTIVE_RACES, the Race registry discovery seam, and the Astral
 * Elf leaf's deterministic assembly and transaction helpers.
 */

// ============================================================================
// Canonical Linkage And Discovery
// ============================================================================
// These checks prevent a visually plausible leaf from drifting away from the
// active race record or from the automatic leaves/ discovery contract.
// ============================================================================

describe('Astral Elf Race domain leaf', () => {
  it('links to the active canonical race and preserves the exact Starlight Step facts', () => {
    const trait = getCanonicalStarlightStepTrait(ASTRAL_ELF_DATA);

    expect(ACTIVE_RACES.some(race => race.id === 'astral_elf')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('astral_elf');
    expect(RACE_DOMAIN_LEAF.id).toBe('astral-elf-starlight-step');
    expect(hasCanonicalStarlightStep(ASTRAL_ELF_DATA)).toBe(true);
    expect(trait).toContain('Bonus Action');
    expect(trait).toContain('30 feet');
    expect(trait).toContain('unoccupied space you can see');
    expect(trait).toContain('Proficiency Bonus');
    expect(trait).toContain('Long Rest');
    expect(ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID).toBe('racial_feature_astral_elf__starlight_step__resource');
  });

  it('is discovered for astral_elf by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('astral_elf');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Native Helper Transaction And Atomic Limits
  // ========================================================================
  // The adapter must move only after native range, visibility, placement, and
  // Bonus Action checks pass. Every rejection must retain the original state.
  // ========================================================================

  it('uses production assembly and resolves the representative native subset with one charge', () => {
    const baseline = createAstralElfStarlightStepScenario(ASTRAL_ELF_DATA);
    const actor = baseline.characters.find(character => character.id.includes('starlight-step-actor'))!;
    const resolved = resolveAstralElfStarlightStep(baseline, 'legal');
    const movedActor = resolved.characters.find(character => character.id === actor.id)!;

    expect(actor.level).toBe(5);
    expect(actor.limitedUses?.[ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
    expect(resolved.lastResolution?.status).toBe('teleported');
    expect(resolved.lastResolution?.reason).toBe('teleported');
    expect(movedActor.position).toEqual({ x: 6, y: 4 });
    expect(movedActor.actionEconomy.bonusAction.used).toBe(true);
    expect(movedActor.actionEconomy.movement.used).toBe(0);
    expect(movedActor.limitedUses?.[ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID]?.current).toBe(2);
    expect(resolved.outcome).toContain('Bonus Action paid');
  });

  it.each([
    ['occupied', 'destination_occupied'],
    ['out-of-range', 'destination_out_of_range'],
    ['hidden', 'destination_not_visible'],
  ] as const)('rejects %s atomically before payment', (targetId, reason) => {
    const baseline = createAstralElfStarlightStepScenario(ASTRAL_ELF_DATA);
    const actor = baseline.characters.find(character => character.id.includes('starlight-step-actor'))!;
    const rejected = resolveAstralElfStarlightStep(baseline, targetId);
    const unchangedActor = rejected.characters.find(character => character.id === actor.id)!;

    expect(rejected.lastResolution?.status).toBe('rejected');
    expect(rejected.lastResolution?.reason).toBe(reason);
    expect(rejected.characters).toBe(baseline.characters);
    expect(unchangedActor.position).toEqual(actor.position);
    expect(unchangedActor.actionEconomy.bonusAction.used).toBe(false);
    expect(unchangedActor.limitedUses?.[ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID]?.current).toBe(3);
  });

  it('rejects a second use after the Bonus Action and resource are exhausted', () => {
    const baseline = createAstralElfStarlightStepScenario(ASTRAL_ELF_DATA);
    let scenario = baseline;
    scenario = resolveAstralElfStarlightStep(scenario, 'legal');
    const actorWithExhaustedResource = scenario.characters.find(character => character.id.includes('starlight-step-actor'))!;
    const exhaustedResource = actorWithExhaustedResource.limitedUses?.[ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID];
    if (!exhaustedResource) throw new Error('Expected the production-assembled Starlight Step resource.');
    scenario = {
      ...scenario,
      characters: scenario.characters.map(character => character.id.includes('starlight-step-actor')
        ? {
            ...character,
            actionEconomy: {
              ...character.actionEconomy,
              bonusAction: { used: false, remaining: 1 },
            },
            limitedUses: {
              ...character.limitedUses,
              [ASTRAL_ELF_STARLIGHT_STEP_RESOURCE_ID]: {
                ...exhaustedResource,
                current: 0,
              },
            },
          }
        : character),
    };
    const rejected = resolveAstralElfStarlightStep(scenario, 'legal');

    expect(rejected.lastResolution?.reason).toBe('insufficient_starlight_uses');
    expect(rejected.outcome).toContain('no Proficiency Bonus uses remain');
  });

  // ========================================================================
  // Visible Event, Reset, And Honest Boundary
  // ========================================================================
  // The component publishes the native result through the shell callback and
  // remounts from resetCount without pretending to provide a rendered map.
  // ========================================================================

  it('shows actor/resource facts, logs the result, resets, and labels the adapter boundary', () => {
    const events: string[] = [];
    const { rerender } = render(
      <AstralElfRaceLeaf
        race={ASTRAL_ELF_DATA}
        state={createRaceDomainScenarioState(ASTRAL_ELF_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('astral-elf-canonical-trait')).toHaveTextContent('Bonus Action');
    expect(screen.getByTestId('astral-elf-actor')).toHaveTextContent('PB +3');
    expect(screen.getByTestId('astral-elf-actor')).toHaveTextContent('Uses 3/3');
    fireEvent.click(screen.getByRole('button', { name: /resolve starlight step/i }));

    expect(screen.getByTestId('astral-elf-outcome')).toHaveTextContent('Bonus Action paid');
    expect(screen.getByTestId('astral-elf-actor')).toHaveTextContent('Uses 2/3');
    expect(events.at(-1)).toContain('Astral Elf STARLIGHT STEP RESOLVED');

    rerender(
      <AstralElfRaceLeaf
        race={ASTRAL_ELF_DATA}
        state={createRaceDomainScenarioState(ASTRAL_ELF_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('astral-elf-actor')).toHaveTextContent('Position 2,4');
    expect(screen.getByTestId('astral-elf-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('astral-elf-assembly-boundary')).toHaveTextContent('production quick character assembly');
    expect(screen.getByTestId('astral-elf-unsupported-boundary')).toHaveTextContent('spell-only teleportation resolver');
    expect(screen.getByTestId('astral-elf-unsupported-boundary')).toHaveTextContent('2D/3D teleport animation');
  });
});
