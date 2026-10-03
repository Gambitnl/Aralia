import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { HADOZEE_DATA } from '../../../../../../data/races/hadozee';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  createHadozeeScenario,
  HadozeeRaceLeaf,
  getCanonicalHadozeeFacts,
  getCanonicalHadozeeResilienceReaction,
  hasCanonicalHadozeeFacts,
  resolveHadozeeResilience,
  RACE_DOMAIN_LEAF,
} from '../hadozeeRaceLeaf';

/**
 * This file proves that the Hadozee Race leaf remains linked to canonical
 * traits and that its Resilience transaction uses native dice, reaction,
 * damage, HP, and downing helpers.
 *
 * Called by: focused and cumulative Vitest Race-domain checks.
 * Depends on: ACTIVE_RACES, automatic leaf discovery, canonical Hadozee data,
 * the racial parser, and the leaf's production actor adapter.
 */

// ============================================================================
// Canonical Identity, Parser, And Discovery
// ============================================================================
// These checks prevent a plausible-looking leaf from drifting away from the
// active race record or from bypassing the shared reaction parser.
// ============================================================================

describe('Hadozee Race domain leaf', () => {
  it('registers exactly against canonical ACTIVE_RACES and parses Resilience metadata', () => {
    const facts = getCanonicalHadozeeFacts(HADOZEE_DATA);
    const reaction = getCanonicalHadozeeResilienceReaction(HADOZEE_DATA);

    expect(ACTIVE_RACES.filter(race => race.id === 'hadozee')).toHaveLength(1);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('hadozee');
    expect(RACE_DOMAIN_LEAF.id).toBe('hadozee-resilience');
    expect(RACE_DOMAIN_LEAF.Component).toBe(HadozeeRaceLeaf);
    expect(hasCanonicalHadozeeFacts(HADOZEE_DATA)).toBe(true);
    expect(facts.size).toContain('Medium or Small');
    expect(facts.speed).toContain('climb 30 feet');
    expect(facts.dexterousFeet).toContain('manipulate objects');
    expect(facts.glide).toContain('five times your proficiency bonus');
    expect(facts.resilience).toContain('roll a d6');
    expect(reaction).toMatchObject({
      reactionId: 'hadozee__hadozee_resilience__reaction',
      dice: 'd6',
      addProficiencyBonus: true,
      triggerType: 'on_target_takes_damage',
    });
    expect(reaction?.reaction.effect.damageReduction.appliesTo).toBe('damage_taken');
  });

  it('is auto-discovered for the canonical hadozee id', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    expect(registry.getLeavesForRace('hadozee')).toContainEqual(RACE_DOMAIN_LEAF);
  });

  // ========================================================================
  // Native Apply, Decline, Reaction, And Downing Transactions
  // ========================================================================
  // Level 5 deliberately gives PB +3. The baseline is 10 HP, so a 12-damage
  // decline downs the player while a pinned face-4 Apply leaves 5 HP.
  // ========================================================================

  it('applies d6 + PB reduction, spends the native Reaction, and changes HP exactly', () => {
    const baseline = createHadozeeScenario(HADOZEE_DATA, 12, 4);
    const resolved = resolveHadozeeResilience(baseline, 'apply');

    expect(baseline.assembly.actor?.id).toBe('hadozee-resilience-actor');
    expect(baseline.assembly.actor?.level).toBe(5);
    expect(baseline.assembly.actor?.currentHP).toBe(10);
    expect(baseline.assembly.actor?.actionEconomy.reaction.used).toBe(false);
    expect(resolved.lastResolution).toMatchObject({
      status: 'applied',
      incomingDamage: 12,
      d6Face: 4,
      proficiencyBonus: 3,
      reduction: 7,
      finalDamage: 5,
      hitPointsBefore: 10,
      hitPointsAfter: 5,
      reactionBeforeAvailable: true,
      reactionAfterAvailable: false,
      reactionSpent: true,
      downed: false,
    });
    expect(resolved.assembly.actor?.currentHP).toBe(5);
    expect(resolved.assembly.actor?.actionEconomy.reaction.used).toBe(true);
    expect(resolved.outcome).toContain('d6 4 + PB 3 = reduction 7');
    expect(resolved.outcome).toContain('Reaction spent');
  });

  it('declines atomically, applies full damage, preserves Reaction, and proves native downing', () => {
    const baseline = createHadozeeScenario(HADOZEE_DATA, 12, 4);
    const resolved = resolveHadozeeResilience(baseline, 'decline');

    expect(resolved.lastResolution).toMatchObject({
      status: 'declined',
      reason: 'declined',
      d6Face: null,
      reduction: 0,
      finalDamage: 12,
      hitPointsBefore: 10,
      hitPointsAfter: 0,
      reactionBeforeAvailable: true,
      reactionAfterAvailable: true,
      reactionSpent: false,
      downed: true,
    });
    expect(resolved.assembly.actor?.actionEconomy.reaction.used).toBe(false);
    expect(resolved.assembly.actor?.deathSaves).toMatchObject({
      successes: 0,
      failures: 0,
      isStable: false,
    });
    expect(resolved.assembly.actor?.conditions?.some(condition => condition.name === 'Unconscious')).toBe(true);
    expect(resolved.outcome).toContain('declined atomically');
    expect(resolved.outcome).toContain('downed');
  });

  it('rejects an exhausted Reaction atomically without a second roll, HP change, or payment', () => {
    const baseline = createHadozeeScenario(HADOZEE_DATA, 12, 4);
    const applied = resolveHadozeeResilience(baseline, 'apply');
    const rejected = resolveHadozeeResilience(applied, 'apply');

    expect(rejected.lastResolution).toMatchObject({
      status: 'rejected',
      reason: 'reaction_unavailable',
      d6Face: null,
      reduction: 0,
      finalDamage: 0,
      hitPointsBefore: 5,
      hitPointsAfter: 5,
      reactionBeforeAvailable: false,
      reactionAfterAvailable: false,
      reactionSpent: false,
    });
    expect(rejected.assembly.actor?.currentHP).toBe(5);
    expect(rejected.assembly.actor?.actionEconomy.reaction.used).toBe(true);
    expect(rejected.outcome).toContain('no d6, damage, HP, or Reaction state changed');
  });

  // ========================================================================
  // Visible Receipt, Parent Reset, Event Callback, And Boundaries
  // ========================================================================
  // The rendered check proves accessible controls and the same exact result
  // that the leaf sends to the parent shell event log.
  // ========================================================================

  it('shows canonical facts and receipts, emits visible events, and resets through resetCount', () => {
    const events: string[] = [];
    const props = {
      race: HADOZEE_DATA,
      state: createRaceDomainScenarioState(HADOZEE_DATA.id, 0),
      onScenarioEvent: (message: string) => events.push(message),
    };
    const { rerender } = render(<HadozeeRaceLeaf {...props} />);

    expect(screen.getByTestId('hadozee-canonical-facts')).toHaveTextContent('Medium or Small');
    expect(screen.getByTestId('hadozee-canonical-facts')).toHaveTextContent('climb 30 feet');
    expect(screen.getByTestId('hadozee-canonical-facts')).toHaveTextContent('Dexterous Feet');
    expect(screen.getByTestId('hadozee-canonical-facts')).toHaveTextContent('Glide');
    expect(screen.getByTestId('hadozee-actor-facts')).toHaveTextContent('PB +3');
    expect(screen.getByTestId('hadozee-resolution')).toHaveTextContent('No Hadozee Resilience transaction resolved yet');
    expect(screen.getByTestId('hadozee-boundary')).toHaveTextContent('horizontal glide movement');

    fireEvent.change(screen.getByLabelText('Pinned Resilience d6 face'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Resilience' }));
    expect(screen.getByTestId('hadozee-outcome')).toHaveTextContent('d6 4 + PB 3 = reduction 7');
    expect(screen.getByTestId('hadozee-resolution')).toHaveTextContent('Reaction before ready, after unavailable; spent yes');
    expect(events.at(-1)).toContain('HADOZEE RESILIENCE APPLY');

    rerender(
      <HadozeeRaceLeaf
        {...props}
        state={createRaceDomainScenarioState(HADOZEE_DATA.id, 1)}
      />,
    );
    expect(screen.getByTestId('hadozee-actor-facts')).toHaveTextContent('HP 10');
    expect(screen.getByTestId('hadozee-actor-facts')).toHaveTextContent('Reaction ready');
    expect(screen.getByTestId('hadozee-resolution')).toHaveTextContent('No Hadozee Resilience transaction resolved yet');
  });
});
