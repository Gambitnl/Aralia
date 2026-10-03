// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: Focused proof for the Goblin Race-domain leaf.
 *
 * MULTI-AGENT SAFETY:
 * Race 36 owns only this test and goblinRaceLeaf.tsx.
 */
// @dependencies-end

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { GOBLIN_DATA } from '../../../../../../data/races/goblin';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  applyGoblinFury,
  createGoblinFuryScenario,
  declineGoblinFury,
  getCanonicalGoblinFuryTrait,
  getCanonicalGoblinSize,
  getGoblinFuryResource,
  GOBLIN_BASE_DAMAGE,
  GOBLIN_FURY_RESOURCE_ID,
  GOBLIN_TARGET_ID,
  hasCanonicalGoblinFeatures,
  RACE_DOMAIN_LEAF,
  resolveGoblinAttack,
} from '../goblinRaceLeaf';

/**
 * This file proves canonical Goblin identity, automatic discovery, native
 * attack/base damage, the larger-size Fury gate, atomic optional resource
 * payment, Reset/log behavior, and the honest boundaries around other traits.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry discovery seam, canonical Goblin
 * data, and goblinRaceLeaf.tsx's production-backed scenario adapter.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking board from drifting away from the
// active Goblin record or the automatic leaves/ discovery contract.
// ============================================================================

describe('Goblin Race domain leaf', () => {
  it('links Fury, size, and requested supporting facts to canonical Goblin data', () => {
    const fury = getCanonicalGoblinFuryTrait(GOBLIN_DATA);

    expect(ACTIVE_RACES.some(race => race.id === 'goblin')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('goblin');
    expect(RACE_DOMAIN_LEAF.id).toBe('goblin-fury-of-the-small');
    expect(hasCanonicalGoblinFeatures(GOBLIN_DATA)).toBe(true);
    expect(getCanonicalGoblinSize(GOBLIN_DATA)).toBe('Small');
    expect(fury).toContain('larger than yours');
    expect(fury).toContain('proficiency bonus');
    expect(fury).toContain('long rest');
    expect(GOBLIN_DATA.traits.find(trait => trait.startsWith('Nimble Escape:'))).toContain('bonus action');
    expect(GOBLIN_DATA.traits.find(trait => trait.startsWith('Fey Ancestry:'))).toContain('advantage');
    expect(GOBLIN_DATA.traits.find(trait => trait.startsWith('Vision:'))).toContain('darkness');
    expect(GOBLIN_FURY_RESOURCE_ID).toBe('racial_feature_goblin__fury_of_the_small__resource');
  });

  it('is discovered automatically for goblin', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    expect(registry.getLeavesForRace('goblin').some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Native Attack, Size Gate, And Optional Fury Choice
  // ========================================================================
  // The fixed d20 keeps every branch deterministic while the actor, Action,
  // resource, attack, and HP changes still come from production helpers.
  // ========================================================================

  it('resolves native base damage, exposes a larger-target Fury choice, and applies PB atomically', () => {
    const baseline = createGoblinFuryScenario(GOBLIN_DATA, 'larger-hit');
    const hit = resolveGoblinAttack(baseline, 'larger-hit');
    const resourceBefore = getGoblinFuryResource(hit.actor);
    const targetAfterBase = hit.target!;

    expect(hit.lastResolution).toMatchObject({ reason: 'hit_pending_choice', d20: 12, baseDamage: GOBLIN_BASE_DAMAGE, extraDamage: 0 });
    expect(hit.pendingFury?.targetSize).toBe('Large');
    expect(targetAfterBase.currentHP).toBe(30 - GOBLIN_BASE_DAMAGE);
    expect(hit.combatActor?.actionEconomy.action.used).toBe(true);
    expect(resourceBefore).toMatchObject({ current: 3, max: 'proficiency_bonus', resetOn: 'long_rest' });

    const applied = applyGoblinFury(hit);
    expect(applied.lastResolution).toMatchObject({ reason: 'fury_applied', extraDamage: 3, usesRemaining: 2, targetSize: 'Large' });
    expect(applied.target?.currentHP).toBe(30 - GOBLIN_BASE_DAMAGE - 3);
    expect(applied.pendingFury).toBeNull();
    expect(getGoblinFuryResource(applied.actor)?.current).toBe(2);
    expect(applied.combatActor?.actionEconomy.action.used).toBe(true);
  });

  it('handles a native miss without offering Fury and keeps resource/HP atomic', () => {
    const baseline = createGoblinFuryScenario(GOBLIN_DATA, 'larger-miss');
    const miss = resolveGoblinAttack(baseline, 'larger-miss');

    expect(miss.lastResolution).toMatchObject({ reason: 'miss', baseDamage: 0, extraDamage: 0, targetSize: 'Large' });
    expect(miss.pendingFury).toBeNull();
    expect(miss.target?.currentHP).toBe(30);
    expect(getGoblinFuryResource(miss.actor)?.current).toBe(3);
    expect(miss.combatActor?.actionEconomy.action.used).toBe(true);
  });

  it('rejects equal-size damage for Fury after paying only the native Action/base damage', () => {
    const baseline = createGoblinFuryScenario(GOBLIN_DATA, 'equal-size');
    const equal = resolveGoblinAttack(baseline, 'equal-size');

    expect(equal.lastResolution).toMatchObject({ reason: 'equal_size', targetSize: 'Small', baseDamage: GOBLIN_BASE_DAMAGE, extraDamage: 0 });
    expect(equal.pendingFury).toBeNull();
    expect(equal.target?.currentHP).toBe(30 - GOBLIN_BASE_DAMAGE);
    expect(getGoblinFuryResource(equal.actor)?.current).toBe(3);
    expect(equal.outcome).toContain('size gate');
  });

  it('declines without spending Fury and rejects an exhausted resource atomically', () => {
    const hit = resolveGoblinAttack(createGoblinFuryScenario(GOBLIN_DATA), 'larger-hit');
    const declined = declineGoblinFury(hit);

    expect(declined.lastResolution).toMatchObject({ reason: 'declined', extraDamage: 0, usesRemaining: 3 });
    expect(declined.target?.currentHP).toBe(30 - GOBLIN_BASE_DAMAGE);
    expect(getGoblinFuryResource(declined.actor)?.current).toBe(3);

    const exhaustedActor = {
      ...hit.actor!,
      limitedUses: {
        ...(hit.actor!.limitedUses ?? {}),
        [GOBLIN_FURY_RESOURCE_ID]: { ...getGoblinFuryResource(hit.actor!)!, current: 0 },
      },
    };
    const exhausted = applyGoblinFury({ ...hit, actor: exhaustedActor });
    expect(exhausted.lastResolution?.reason).toBe('resource_exhausted');
    expect(exhausted.actor).toBe(exhaustedActor);
    expect(exhausted.target).toBe(hit.target);
    expect(exhausted.pendingFury).toBe(hit.pendingFury);
    expect(exhausted.outcome).toContain('atomically');
  });

  it('rejects a second native attack after Action payment without changing HP', () => {
    const first = resolveGoblinAttack(createGoblinFuryScenario(GOBLIN_DATA), 'larger-hit');
    const second = resolveGoblinAttack(first, 'larger-hit');

    expect(second.lastResolution?.reason).toBe('action_unavailable');
    expect(second.target?.currentHP).toBe(30 - GOBLIN_BASE_DAMAGE);
    expect(second.pendingFury).toBe(first.pendingFury);
    expect(second.combatActor?.actionEconomy.action.used).toBe(true);
  });

  // ========================================================================
  // Visible Event, Reset, And Honest Boundaries
  // ========================================================================
  // The component proof follows the same transaction a mounted shell uses and
  // remounts through resetCount so local Action/resource state cannot persist.
  // ========================================================================

  it('shows target size/HP/Action/resource, publishes logs, resets, and names unsupported mechanics', () => {
    const events: string[] = [];
    const props = {
      race: GOBLIN_DATA,
      state: createRaceDomainScenarioState(GOBLIN_DATA.id, 0),
      onScenarioEvent: (message: string) => events.push(message),
    };
    const { rerender } = render(<RACE_DOMAIN_LEAF.Component {...props} />);

    expect(screen.getByTestId('goblin-actor-facts')).toHaveTextContent('size Small');
    expect(screen.getByTestId('goblin-actor-facts')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('goblin-actor-facts')).toHaveTextContent('Fury uses 3/proficiency_bonus');
    expect(screen.getByTestId('goblin-target-facts')).toHaveTextContent('size Large');
    expect(screen.getByTestId('goblin-target-facts')).toHaveTextContent('HP 30/30');
    expect(screen.getByTestId('goblin-canonical-facts')).toHaveTextContent('Nimble Escape');
    expect(screen.getByTestId('goblin-canonical-facts')).toHaveTextContent('Fey Ancestry');
    expect(screen.getByTestId('goblin-boundary')).toHaveTextContent('no fake Bonus Action Hide/Disengage');

    fireEvent.click(screen.getByRole('button', { name: /resolve native attack/i }));
    expect(screen.getByTestId('goblin-fury-choice')).toBeInTheDocument();
    expect(screen.getByTestId('goblin-target-facts')).toHaveTextContent('HP 23/30');
    expect(screen.getByTestId('goblin-actor-facts')).toHaveTextContent('Action used');
    fireEvent.click(screen.getByRole('button', { name: /apply fury/i }));
    expect(screen.getByTestId('goblin-target-facts')).toHaveTextContent('HP 20/30');
    expect(screen.getByTestId('goblin-actor-facts')).toHaveTextContent('Fury uses 2/proficiency_bonus');
    expect(events.at(-1)).toContain('Goblin FURY APPLIED');

    rerender(<RACE_DOMAIN_LEAF.Component {...props} state={createRaceDomainScenarioState(GOBLIN_DATA.id, 1)} />);
    expect(screen.getByTestId('goblin-actor-facts')).toHaveTextContent('Action ready');
    expect(screen.getByTestId('goblin-actor-facts')).toHaveTextContent('Fury uses 3/proficiency_bonus');
    expect(screen.getByTestId('goblin-target-facts')).toHaveTextContent('HP 30/30');
    expect(screen.getByTestId('goblin-boundary')).toHaveTextContent('spell-damage path is not mounted');
    expect(screen.getByTestId('goblin-boundary')).toHaveTextContent('visibility');
  });

  it('keeps the canonical target identity available for focused state assertions', () => {
    const scenario = createGoblinFuryScenario(GOBLIN_DATA);
    expect(scenario.target?.id).toBe(GOBLIN_TARGET_ID);
    expect(scenario.actor?.race.id).toBe('goblin');
  });
});
