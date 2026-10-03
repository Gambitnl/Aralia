// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: Focused proof for the Beasthide Shifter Race-domain leaf.
 *
 * MULTI-AGENT SAFETY:
 * This test owns only the Beasthide leaf contract and deterministic helper proof.
 */
// @dependencies-end

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { BEASTHIDE_SHIFTER_DATA } from '../../../../../../data/races/beasthide_shifter';
import { discoverRaceDomainLeaves, createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  BEASTHIDE_SHIFTER_RESOURCE_ID,
  BeasthideShifterRaceLeaf,
  createBeasthideShifterScenario,
  getCanonicalBeasthideShifterResource,
  getCanonicalBeasthideShifterTrait,
  hasCanonicalBeasthideShifterRules,
  resolveBeasthideShifter,
  rollBeasthideDurability,
  RACE_DOMAIN_LEAF,
} from '../beasthideShifterRaceLeaf';

/**
 * This file proves that the Beasthide leaf stays linked to ACTIVE_RACES and
 * the production racial parser, then checks the native action/temp-HP
 * transaction, PB/dice math, atomic rejections, event callback, reset, and
 * explicitly labelled lifecycle boundary.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry discovery seam, the canonical
 * Beasthide data record, and the leaf's deterministic production adapter.
 */

// ============================================================================
// Canonical Linkage And Discovery
// ============================================================================
// These checks prevent a plausible-looking UI from drifting from the active
// race record or from automatic ./leaves discovery.
// ============================================================================

describe('Beasthide Shifter Race domain leaf', () => {
  it('links to the active canonical race and parser-created Shifting resource', () => {
    const shifting = getCanonicalBeasthideShifterTrait(BEASTHIDE_SHIFTER_DATA, /^Shifting:\s*/i);
    const durability = getCanonicalBeasthideShifterTrait(BEASTHIDE_SHIFTER_DATA, /^Bestial Durability:\s*/i);
    const resource = getCanonicalBeasthideShifterResource(BEASTHIDE_SHIFTER_DATA);

    expect(ACTIVE_RACES.some(race => race.id === 'beasthide_shifter')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('beasthide_shifter');
    expect(RACE_DOMAIN_LEAF.id).toBe('beasthide-shifter-shifting');
    expect(hasCanonicalBeasthideShifterRules(BEASTHIDE_SHIFTER_DATA)).toBe(true);
    expect(shifting).toContain('Bonus Action');
    expect(shifting).toContain('1 minute');
    expect(durability).toContain('1d6');
    expect(durability).toContain('+1 bonus to your Armor Class');
    expect(resource).toMatchObject({ id: 'beasthide_shifter__shifting__resource', maxUses: 'proficiency_bonus', resetOn: 'long_rest' });
    expect(BEASTHIDE_SHIFTER_RESOURCE_ID).toBe('racial_feature_beasthide_shifter__shifting__resource');
  });

  it('is discovered for beasthide_shifter by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('beasthide_shifter');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  // ========================================================================
  // Native Transaction, Dice, PB, AC, And Temporary HP
  // ========================================================================
  // The successful path must show the same roster carrying action payment,
  // resource consumption, temp HP, and the one-minute native AC effect.
  // ========================================================================

  it('uses native action/temp-HP helpers and commits PB plus deterministic d6 math atomically', () => {
    const baseline = createBeasthideShifterScenario(BEASTHIDE_SHIFTER_DATA);
    const actor = baseline.actor!;

    expect(actor.level).toBe(5);
    expect(baseline.proficiencyBonus).toBe(3);
    expect(actor.limitedUses?.[BEASTHIDE_SHIFTER_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
    expect(rollBeasthideDurability(4)).toBe(4);

    const resolved = resolveBeasthideShifter(baseline, BEASTHIDE_SHIFTER_DATA, 4);
    const shifted = resolved.actor!;

    expect(resolved.lastResolution).toMatchObject({ status: 'committed', reason: 'committed', proficiencyBonus: 3, temporaryHitPoints: 10 });
    expect(shifted.actionEconomy.bonusAction.used).toBe(true);
    expect(shifted.actionEconomy.action.used).toBe(false);
    expect(shifted.tempHP).toBe(10);
    expect(shifted.limitedUses?.[BEASTHIDE_SHIFTER_RESOURCE_ID]?.current).toBe(2);
    expect(shifted.armorClass).toBe((baseline.baselineArmorClass ?? 0) + 1);
    expect(shifted.activeEffects).toContainEqual(expect.objectContaining({
      id: 'feature_beasthide_shifter__bestial_durability',
      duration: { type: 'minutes', value: 1 },
      mechanics: { acBonus: 1 },
    }));
    expect(resolved.outcome).toContain('resolveHitPointAction resolved');
    expect(resolved.outcome).toContain('Bonus Action paid');
  });

  // ========================================================================
  // Atomic Rejection And Visible State
  // ========================================================================
  // Rejections must preserve actor identity and every ledger value, including
  // a used Bonus Action or an exhausted parsed PB resource.
  // ========================================================================

  it('rejects a spent Bonus Action without changing resource, HP, or AC', () => {
    const baseline = createBeasthideShifterScenario(BEASTHIDE_SHIFTER_DATA);
    const actor = baseline.actor!;
    const rejected = resolveBeasthideShifter({
      ...baseline,
      actor: {
        ...actor,
        actionEconomy: {
          ...actor.actionEconomy,
          bonusAction: { used: true, remaining: 1 },
        },
      },
    }, BEASTHIDE_SHIFTER_DATA, 4);

    expect(rejected.lastResolution?.reason).toBe('native_rejected');
    expect(rejected.actor?.actionEconomy.bonusAction.used).toBe(true);
    expect(rejected.actor?.tempHP ?? 0).toBe(0);
    expect(rejected.actor?.limitedUses?.[BEASTHIDE_SHIFTER_RESOURCE_ID]?.current).toBe(3);
    expect(rejected.shiftedArmorClass).toBeNull();
  });

  it('rejects an exhausted PB resource before native payment', () => {
    const baseline = createBeasthideShifterScenario(BEASTHIDE_SHIFTER_DATA);
    const actor = baseline.actor!;
    const rejected = resolveBeasthideShifter({
      ...baseline,
      actor: {
        ...actor,
        limitedUses: {
          ...actor.limitedUses,
          [BEASTHIDE_SHIFTER_RESOURCE_ID]: {
            ...actor.limitedUses![BEASTHIDE_SHIFTER_RESOURCE_ID],
            current: 0,
          },
        },
      },
    }, BEASTHIDE_SHIFTER_DATA, 6);

    expect(rejected.lastResolution?.reason).toBe('resource_unavailable');
    expect(rejected.actor).not.toBeNull();
    expect(rejected.actor?.actionEconomy.bonusAction.used).toBe(false);
    expect(rejected.actor?.tempHP ?? 0).toBe(0);
    expect(rejected.actor?.limitedUses?.[BEASTHIDE_SHIFTER_RESOURCE_ID]?.current).toBe(0);
  });

  // ========================================================================
  // Rendered Facts, Event Callback, Reset, And Boundary
  // ========================================================================
  // The leaf renders the transaction facts and the parent reset contract. No
  // rendered 2D/3D claim is made by this focused unit test.
  // ========================================================================

  it('shows facts, publishes the event, resets keyed state, and labels the boundary', () => {
    const events: string[] = [];
    const { rerender } = render(
      <BeasthideShifterRaceLeaf
        race={BEASTHIDE_SHIFTER_DATA}
        state={createRaceDomainScenarioState(BEASTHIDE_SHIFTER_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('beasthide-shifter-canonical-traits')).toHaveTextContent('Bonus Action');
    expect(screen.getByTestId('beasthide-shifter-actor')).toHaveTextContent('PB +3');
    expect(screen.getByTestId('beasthide-shifter-actor')).toHaveTextContent('Bonus Action ready');
    expect(screen.getByTestId('beasthide-shifter-actor')).toHaveTextContent('Uses 3/3');
    fireEvent.change(screen.getByLabelText(/deterministic bestial durability/i), { target: { value: '6' } });
    expect(screen.getByTestId('beasthide-shifter-roll')).toHaveTextContent('formula 2 x PB + 1d6 = 12');
    fireEvent.click(screen.getByRole('button', { name: /resolve shifting/i }));

    expect(screen.getByTestId('beasthide-shifter-outcome')).toHaveTextContent('Bonus Action paid');
    expect(screen.getByTestId('beasthide-shifter-actor')).toHaveTextContent('Temp HP 12');
    expect(screen.getByTestId('beasthide-shifter-actor')).toHaveTextContent('Uses 2/3');
    expect(events.at(-1)).toContain('Beasthide Shifter SHIFTING COMMITTED');

    rerender(
      <BeasthideShifterRaceLeaf
        race={BEASTHIDE_SHIFTER_DATA}
        state={createRaceDomainScenarioState(BEASTHIDE_SHIFTER_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('beasthide-shifter-actor')).toHaveTextContent('Bonus Action ready');
    expect(screen.getByTestId('beasthide-shifter-actor')).toHaveTextContent('Temp HP 0');
    expect(screen.getByTestId('beasthide-shifter-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('beasthide-shifter-assembly-boundary')).toHaveTextContent('applyRacialSpellGrantsByLevel');
    expect(screen.getByTestId('beasthide-shifter-unsupported-boundary')).toHaveTextContent('timed expiry');
    expect(screen.getByTestId('beasthide-shifter-unsupported-boundary')).toHaveTextContent('No spell record');
  });
});
