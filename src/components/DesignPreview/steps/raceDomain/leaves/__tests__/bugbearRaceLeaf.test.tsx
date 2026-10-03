import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { BUGBEAR_DATA } from '../../../../../../data/races/bugbear';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  BUGBEAR_ACTOR_ID,
  BUGBEAR_BASE_DAMAGE,
  BUGBEAR_FIXED_ATTACK_ROLL,
  BUGBEAR_TARGET_ID,
  BugbearRaceLeaf,
  createBugbearStrikeScenario,
  getCanonicalBugbearLongLimbedTrait,
  getCanonicalBugbearSurpriseAttackTrait,
  hasCanonicalBugbearRules,
  resolveBugbearStrike,
  RACE_DOMAIN_LEAF,
} from '../bugbearRaceLeaf';

/**
 * This file proves the Bugbear Race leaf stays linked to canonical rule text
 * and that its deterministic Long-Limbed adapter performs real native-helper
 * work while reporting the unsupported Surprise Attack boundary honestly.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry discovery seam, and the Bugbear
 * leaf's production assembly, range, attack, damage, and Action transaction.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking preview from drifting away from
// the active Bugbear record or automatic leaves/ discovery contract.
// ============================================================================

describe('Bugbear Race domain leaf', () => {
  it('exports the canonical Bugbear identity and representative trait facts', () => {
    expect(ACTIVE_RACES.some(race => race.id === 'bugbear')).toBe(true);
    expect(RACE_DOMAIN_LEAF.id).toBe('bugbear');
    expect(RACE_DOMAIN_LEAF.raceId).toBe('bugbear');
    expect(RACE_DOMAIN_LEAF.label).toBe('Bugbear');
    expect(RACE_DOMAIN_LEAF.Component).toBe(BugbearRaceLeaf);
    expect(hasCanonicalBugbearRules(BUGBEAR_DATA)).toBe(true);
    expect(getCanonicalBugbearLongLimbedTrait(BUGBEAR_DATA)).toContain('5 feet greater than normal');
    expect(getCanonicalBugbearSurpriseAttackTrait(BUGBEAR_DATA)).toContain('extra 2d6 damage');
  });

  it('is discovered for bugbear by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    expect(registry.getLeavesForRace('bugbear')).toEqual([RACE_DOMAIN_LEAF]);
  });

  // ========================================================================
  // Native-Helper Transaction And Atomic Limits
  // ========================================================================
  // The in-range strike must pay one Action and damage the target. An illegal
  // range or a second use must preserve the actor and target transactionally.
  // ========================================================================

  it('resolves the deterministic Long-Limbed strike with native attack, damage, and Action truth', () => {
    const baseline = createBugbearStrikeScenario(BUGBEAR_DATA, 'in-range');
    const actor = baseline.characters.find(character => character.id === BUGBEAR_ACTOR_ID)!;
    const target = baseline.characters.find(character => character.id === BUGBEAR_TARGET_ID)!;
    const resolved = resolveBugbearStrike(baseline, 'in-range');
    const resolvedActor = resolved.characters.find(character => character.id === BUGBEAR_ACTOR_ID)!;
    const resolvedTarget = resolved.characters.find(character => character.id === BUGBEAR_TARGET_ID)!;

    expect(resolved.lastResolution).toMatchObject({
      status: 'resolved',
      reason: 'hit',
      distanceFeet: 10,
      reachFeet: 10,
      // Derive the expected native attack modifier from the production-built
      // actor so this remains proof of assembly rather than a copied stat line.
      attackTotal: BUGBEAR_FIXED_ATTACK_ROLL
        + Math.floor((actor.stats.strength - 10) / 2)
        + (2 + Math.floor((actor.level - 1) / 4)),
      damage: BUGBEAR_BASE_DAMAGE,
    });
    expect(actor.actionEconomy.action.used).toBe(false);
    expect(resolvedActor.actionEconomy.action.used).toBe(true);
    expect(target.currentHP).toBe(30);
    expect(resolvedTarget.currentHP).toBe(30 - BUGBEAR_BASE_DAMAGE);
    expect(resolved.outcome).toContain('Surprise Attack extra 2d6 not resolved');
  });

  it('rejects a target beyond native Long-Limbed reach before paying the Action', () => {
    const baseline = createBugbearStrikeScenario(BUGBEAR_DATA, 'out-of-range');
    const rejected = resolveBugbearStrike(baseline, 'out-of-range');
    const actor = rejected.characters.find(character => character.id === BUGBEAR_ACTOR_ID)!;
    const target = rejected.characters.find(character => character.id === BUGBEAR_TARGET_ID)!;

    expect(rejected.lastResolution).toMatchObject({
      status: 'rejected',
      reason: 'out_of_range',
      distanceFeet: 15,
      reachFeet: 10,
      damage: 0,
    });
    expect(rejected.characters).toBe(baseline.characters);
    expect(actor.actionEconomy.action.used).toBe(false);
    expect(target.currentHP).toBe(30);
  });

  it('rejects a second strike after the Action is spent without adding damage', () => {
    const first = resolveBugbearStrike(createBugbearStrikeScenario(BUGBEAR_DATA), 'in-range');
    const second = resolveBugbearStrike(first, 'in-range');
    const actor = second.characters.find(character => character.id === BUGBEAR_ACTOR_ID)!;
    const target = second.characters.find(character => character.id === BUGBEAR_TARGET_ID)!;

    expect(second.lastResolution?.reason).toBe('action_unavailable');
    expect(actor.actionEconomy.action.used).toBe(true);
    expect(target.currentHP).toBe(30 - BUGBEAR_BASE_DAMAGE);
    expect(second.outcome).toContain('Action is already used');
  });

  // ========================================================================
  // Visible Event, Reset, And Honest Boundary
  // ========================================================================
  // The leaf reports its real transaction through the shell callback and uses
  // resetCount as a keyed remount boundary rather than hiding a local reset.
  // ========================================================================

  it('shows the native result, logs it, restores on keyed Reset, and names the gap', () => {
    const events: string[] = [];
    const { rerender } = render(
      <BugbearRaceLeaf
        race={BUGBEAR_DATA}
        state={createRaceDomainScenarioState(BUGBEAR_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('bugbear-canonical-long-limbed')).toHaveTextContent('5 feet greater than normal');
    expect(screen.getByTestId('bugbear-canonical-surprise-attack')).toHaveTextContent('extra 2d6 damage');
    expect(screen.getByTestId('bugbear-actor-facts')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('bugbear-unsupported-boundary')).toHaveTextContent('no Bugbear-aware');

    fireEvent.click(screen.getByRole('button', { name: /resolve long-limbed strike/i }));

    expect(screen.getByTestId('bugbear-outcome')).toHaveTextContent('Long-Limbed strike HIT');
    expect(screen.getByTestId('bugbear-actor-facts')).toHaveTextContent('Action used');
    expect(screen.getByTestId('bugbear-target-facts')).toHaveTextContent('HP 23/30');
    expect(events.at(-1)).toContain('Bugbear LONG-LIMBED STRIKE HIT');

    rerender(
      <BugbearRaceLeaf
        race={BUGBEAR_DATA}
        state={createRaceDomainScenarioState(BUGBEAR_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('bugbear-actor-facts')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('bugbear-target-facts')).toHaveTextContent('HP 30/30');
    expect(screen.getByTestId('bugbear-outcome')).toHaveTextContent('Ready: Bugbear');
    expect(screen.getByTestId('bugbear-unsupported-boundary')).toHaveTextContent('Surprise Attack resolver');
  });
});
