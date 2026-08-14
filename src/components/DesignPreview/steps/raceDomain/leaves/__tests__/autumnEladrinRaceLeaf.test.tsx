// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: Focused proof for the Autumn Eladrin Race-domain leaf.
 *
 * MULTI-AGENT SAFETY:
 * This test owns only the Autumn Eladrin leaf contract and deterministic proof.
 */
// @dependencies-end

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { AUTUMN_ELADRIN_DATA } from '../../../../../../data/races/autumn_eladrin';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  AUTUMN_ELADRIN_FEY_STEP_RESOURCE_ID,
  AutumnEladrinRaceLeaf,
  createAutumnEladrinFeyStepScenario,
  getCanonicalAutumnFeyStepTrait,
  hasCanonicalAutumnFeyStep,
  resolveAutumnEladrinFeyStep,
  RACE_DOMAIN_LEAF,
} from '../autumnEladrinRaceLeaf';

/**
 * This file proves canonical linkage, discovery, native transaction guards,
 * deterministic rider saves, visible/logged results, reset, and the honest
 * runtime boundary for Autumn Fey Step.
 *
 * Called by: focused and cumulative Vitest Race-domain checks.
 * Depends on: ACTIVE_RACES, the Race registry discovery seam, production
 * character assembly, native combat helpers, and native condition mirrors.
 */

// ============================================================================
// Canonical Linkage And Discovery
// ============================================================================
// These checks prevent a plausible preview from drifting from active race data
// or bypassing automatic leaves/ discovery.
// ============================================================================

describe('Autumn Eladrin Race domain leaf', () => {
  it('links to the active canonical race and preserves Fey Step facts', () => {
    const trait = getCanonicalAutumnFeyStepTrait(AUTUMN_ELADRIN_DATA);

    expect(ACTIVE_RACES.some(race => race.id === 'autumn_eladrin')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('autumn_eladrin');
    expect(RACE_DOMAIN_LEAF.id).toBe('autumn-eladrin-fey-step');
    expect(hasCanonicalAutumnFeyStep(AUTUMN_ELADRIN_DATA)).toBe(true);
    expect(trait).toContain('Bonus Action');
    expect(trait).toContain('30 feet');
    expect(trait).toContain('unoccupied space you can see');
    expect(trait).toContain('Proficiency Bonus');
    expect(trait).toContain('Long Rest');
    expect(trait).toContain('up to two creatures');
    expect(trait).toContain('within 10 feet');
    expect(AUTUMN_ELADRIN_FEY_STEP_RESOURCE_ID).toBe('racial_feature_autumn_eladrin__fey_step_autumn__resource');
  });

  it('is discovered for autumn_eladrin by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('autumn_eladrin');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Native Transaction And Atomic Guards
  // ========================================================================
  // Teleport payment happens only after range, visibility, placement, resource,
  // and Bonus Action checks succeed. Rejections retain the original array.
  // ========================================================================

  it('uses production assembly, parses PB/Long Rest uses, teleports, and resolves both rider saves', () => {
    const baseline = createAutumnEladrinFeyStepScenario(AUTUMN_ELADRIN_DATA);
    const actor = baseline.characters.find(character => character.id.includes('autumn-eladrin-fey-step-actor'))!;
    const resolved = resolveAutumnEladrinFeyStep(baseline, 'legal');
    const movedActor = resolved.characters.find(character => character.id === actor.id)!;
    const charmed = resolved.characters.find(character => character.id.includes('rider-one'))!;
    const resisted = resolved.characters.find(character => character.id.includes('rider-two'))!;

    expect(actor.level).toBe(5);
    expect(actor.limitedUses?.[AUTUMN_ELADRIN_FEY_STEP_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
    expect(resolved.lastResolution?.status).toBe('teleported');
    expect(resolved.lastResolution?.reason).toBe('teleported');
    expect(movedActor.position).toEqual({ x: 6, y: 4 });
    expect(movedActor.actionEconomy.bonusAction.used).toBe(true);
    expect(movedActor.actionEconomy.movement.used).toBe(0);
    expect(movedActor.limitedUses?.[AUTUMN_ELADRIN_FEY_STEP_RESOURCE_ID]?.current).toBe(2);
    expect(charmed.conditions?.some(condition => condition.name === 'Charmed')).toBe(true);
    expect(charmed.statusEffects.find(effect => effect.name === 'Charmed')).toMatchObject({
      duration: 10,
      source: 'Fey Step (Autumn)',
      breakTriggers: ['target_takes_damage'],
    });
    expect(resisted.conditions ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Charmed' }),
    ]));
    expect(resolved.lastResolution?.riderResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetId: expect.stringContaining('rider-one'), charmed: true, resisted: false }),
      expect.objectContaining({ targetId: expect.stringContaining('rider-two'), charmed: false, resisted: true }),
    ]));
    expect(resolved.outcome).toContain('Bonus Action paid');
    // The production combat assembly currently projects this preview actor's
    // chosen Charisma modifier as +0, so the native formula resolves to DC 11.
    expect(resolved.lastResolution?.saveDc).toBe(11);
    expect(resolved.outcome).toContain('DC 11');
  });

  it.each([
    ['occupied', 'destination_occupied'],
    ['out-of-range', 'destination_out_of_range'],
    ['hidden', 'destination_not_visible'],
  ] as const)('rejects %s atomically before payment', (targetId, reason) => {
    const baseline = createAutumnEladrinFeyStepScenario(AUTUMN_ELADRIN_DATA);
    const actor = baseline.characters.find(character => character.id.includes('autumn-eladrin-fey-step-actor'))!;
    const rejected = resolveAutumnEladrinFeyStep(baseline, targetId);
    const unchangedActor = rejected.characters.find(character => character.id === actor.id)!;

    expect(rejected.lastResolution?.status).toBe('rejected');
    expect(rejected.lastResolution?.reason).toBe(reason);
    expect(rejected.characters).toBe(baseline.characters);
    expect(unchangedActor.position).toEqual(actor.position);
    expect(unchangedActor.actionEconomy.bonusAction.used).toBe(false);
    expect(unchangedActor.limitedUses?.[AUTUMN_ELADRIN_FEY_STEP_RESOURCE_ID]?.current).toBe(3);
  });

  it('rejects a second use after the native Bonus Action guard is occupied', () => {
    const baseline = createAutumnEladrinFeyStepScenario(AUTUMN_ELADRIN_DATA);
    const scenario = resolveAutumnEladrinFeyStep(baseline, 'legal');
    const rejected = resolveAutumnEladrinFeyStep(scenario, 'legal');

    expect(rejected.lastResolution?.reason).toBe('bonus_action_unavailable');
    expect(rejected.characters).toBe(scenario.characters);
    expect(rejected.outcome).toContain('Bonus Action already used');
  });

  // ========================================================================
  // Visible Event, Reset, And Boundary
  // ========================================================================
  // The component publishes the result through the shell callback and remounts
  // from resetCount without claiming a rendered map or full combat lifecycle.
  // ========================================================================

  it('shows actor/rider facts, logs the result, resets, and states the boundary', () => {
    const events: string[] = [];
    const { rerender } = render(
      <AutumnEladrinRaceLeaf
        race={AUTUMN_ELADRIN_DATA}
        state={createRaceDomainScenarioState(AUTUMN_ELADRIN_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('autumn-eladrin-canonical-trait')).toHaveTextContent('Bonus Action');
    expect(screen.getByTestId('autumn-eladrin-actor')).toHaveTextContent('PB +3');
    expect(screen.getByTestId('autumn-eladrin-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('autumn-eladrin-rider-facts')).toHaveTextContent('within 10 feet');
    fireEvent.click(screen.getByRole('button', { name: /resolve fey step \(autumn\)/i }));

    expect(screen.getByTestId('autumn-eladrin-outcome')).toHaveTextContent('Bonus Action paid');
    expect(screen.getByTestId('autumn-eladrin-actor')).toHaveTextContent('Uses 2/3');
    expect(screen.getByTestId('autumn-eladrin-rider-results')).toHaveTextContent('Harvest Witness: Charmed');
    expect(screen.getByTestId('autumn-eladrin-rider-results')).toHaveTextContent('Harvest Guardian: resisted');
    expect(events.at(-1)).toContain('Autumn Eladrin FEY STEP RESOLVED');

    rerender(
      <AutumnEladrinRaceLeaf
        race={AUTUMN_ELADRIN_DATA}
        state={createRaceDomainScenarioState(AUTUMN_ELADRIN_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('autumn-eladrin-actor')).toHaveTextContent('Position 2,4');
    expect(screen.getByTestId('autumn-eladrin-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('autumn-eladrin-assembly-boundary')).toHaveTextContent('production quick character assembly');
    expect(screen.getByTestId('autumn-eladrin-unsupported-boundary')).toHaveTextContent('does not invent a spell record');
    expect(screen.getByTestId('autumn-eladrin-unsupported-boundary')).toHaveTextContent('full combat turn/damage expiry loop');
  });
});
