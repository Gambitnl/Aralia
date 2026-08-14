import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { HALF_ELF_DROW_DATA } from '../../../../../../data/races/half_elf_drow';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  DROW_HALF_ELF_ACTOR_ID,
  DrowHalfElfRaceLeaf,
  applyDrowHalfElfFeyAncestryContext,
  createDrowHalfElfScenario,
  getCanonicalDrowHalfElfAbilityBonusFacts,
  getCanonicalDrowHalfElfMagicTrait,
  getCanonicalDrowHalfElfSkillVersatilityTrait,
  getCanonicalDrowHalfElfVisionTrait,
  getDrowHalfElfFeyAncestrySaveAdapter,
  hasCanonicalDrowHalfElfFeatures,
  hasDrowHalfElfFeyAncestryParserProjection,
  resolveDrowHalfElfFeyAncestry,
  RACE_DOMAIN_LEAF,
} from '../drowHalfElfRaceLeaf';

/**
 * This file proves that the Drow Half-Elf leaf stays linked to canonical race
 * data, production parser/actor assembly, native save advantage, deterministic
 * dice faces, visible logging, keyed reset, and explicit facts-only boundaries.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the Race registry, canonical Drow Half-Elf data,
 * and the leaf's production-backed save comparison helpers.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks stop a plausible-looking panel from drifting away from the
// active canonical race or automatic registry discovery.
// ============================================================================

describe('Drow Half-Elf Race domain leaf', () => {
  it('links identity and all surfaced facts to canonical data', () => {
    expect(ACTIVE_RACES.some(race => race.id === 'half_elf_drow')).toBe(true);
    expect(RACE_DOMAIN_LEAF.id).toBe('drow-half-elf-fey-ancestry');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(HALF_ELF_DROW_DATA.id);
    expect(RACE_DOMAIN_LEAF.label).toContain('Drow Half-Elf');
    expect(hasCanonicalDrowHalfElfFeatures(HALF_ELF_DROW_DATA)).toBe(true);
    expect(getCanonicalDrowHalfElfVisionTrait(HALF_ELF_DROW_DATA)).toContain('60 feet');
    expect(getCanonicalDrowHalfElfSkillVersatilityTrait(HALF_ELF_DROW_DATA)).toContain('one skill');
    expect(getCanonicalDrowHalfElfMagicTrait(HALF_ELF_DROW_DATA)).toContain('Charisma');
    expect(getCanonicalDrowHalfElfAbilityBonusFacts(HALF_ELF_DROW_DATA)).toEqual([
      'Charisma +2',
      'Any +1 (choose 2)',
    ]);
  });

  it('is discovered for half_elf_drow by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('half_elf_drow');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Production Assembly And Native Save Comparison
  // ========================================================================
  // The actor must retain the parser's raw projection, while the adapter keeps
  // an ordinary save free from the Charmed-only advantage.
  // ========================================================================

  it('assembles the production actor and exposes the parser-backed Fey projection', () => {
    const scenario = createDrowHalfElfScenario(HALF_ELF_DROW_DATA);
    const actor = scenario.actor;

    expect(actor?.id).toBe(DROW_HALF_ELF_ACTOR_ID);
    expect(actor?.level).toBe(5);
    // The quick-character bridge preserves the configured Charisma score here;
    // the canonical +2 and flexible +1 choices remain visible facts because
    // this leaf must not silently choose the two "Any" bonuses for the player.
    expect(actor?.stats.charisma).toBe(14);
    expect(hasDrowHalfElfFeyAncestryParserProjection(actor)).toBe(true);
    expect(getDrowHalfElfFeyAncestrySaveAdapter(HALF_ELF_DROW_DATA)).toMatchObject({
      type: 'advantage',
      context: 'saving_throw',
      against: ['charmed'],
    });
  });

  it('compares ordinary and Charmed saves with pinned faces through native helpers', () => {
    const scenario = createDrowHalfElfScenario(HALF_ELF_DROW_DATA);
    const randomValues = [0.15, 0.15, 0.75];
    const resolved = resolveDrowHalfElfFeyAncestry(
      scenario,
      HALF_ELF_DROW_DATA,
      () => randomValues.shift() ?? 0.5,
    );

    expect(resolved.lastResolution).toMatchObject({ status: 'resolved', reason: 'resolved' });
    expect(resolved.lastResolution?.ordinary?.d20Rolls).toEqual([4]);
    expect(resolved.lastResolution?.charmed?.d20Rolls).toEqual([4, 16]);
    expect(resolved.lastResolution?.ordinary?.save.roll).toBe(4);
    expect(resolved.lastResolution?.ordinary?.save.success).toBe(false);
    expect(resolved.lastResolution?.charmed?.save.roll).toBe(16);
    expect(resolved.lastResolution?.charmed?.save.success).toBe(true);
    expect(resolved.lastResolution?.charmed?.save.total).toBe(17);
    expect(resolved.outcome).toContain('Charmed save kept 16');
  });

  it('strips only the parser projection before applying the canonical context adapter', () => {
    const scenario = createDrowHalfElfScenario(HALF_ELF_DROW_DATA);
    const actor = scenario.actor;
    if (!actor) throw new Error('Expected the production Drow Half-Elf actor.');

    const ordinary = applyDrowHalfElfFeyAncestryContext(actor);
    const charmed = applyDrowHalfElfFeyAncestryContext(actor);

    expect(hasDrowHalfElfFeyAncestryParserProjection(actor)).toBe(true);
    expect(hasDrowHalfElfFeyAncestryParserProjection(ordinary)).toBe(false);
    expect(hasDrowHalfElfFeyAncestryParserProjection(charmed)).toBe(false);
  });

  // ========================================================================
  // Visible Result, Reset, And Boundary
  // ========================================================================
  // The mounted proof checks the event callback and keyed reset without making
  // a 2D or 3D render claim.
  // ========================================================================

  it('shows facts, resolves and logs the comparison, resets, and names boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <DrowHalfElfRaceLeaf
        race={HALF_ELF_DROW_DATA}
        state={createRaceDomainScenarioState(HALF_ELF_DROW_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('drow-half-elf-actor')).toHaveTextContent('parser Fey Ancestry projection native');
    expect(screen.getByTestId('drow-half-elf-canonical-facts')).toHaveTextContent('60-ft Darkvision');
    expect(screen.getByTestId('drow-half-elf-canonical-facts')).toHaveTextContent('Skill Versatility');
    expect(screen.getByTestId('drow-half-elf-canonical-facts')).toHaveTextContent('Charisma +2');
    expect(screen.getByTestId('drow-half-elf-canonical-facts')).toHaveTextContent('Any +1 (choose 2)');
    expect(screen.getByTestId('drow-half-elf-spell-gates')).toHaveTextContent('3rd level');
    expect(screen.getByTestId('drow-half-elf-spell-gates')).toHaveTextContent('5th level');
    expect(screen.getByTestId('drow-half-elf-spell-gates')).toHaveTextContent('no spell is cast');

    fireEvent.click(screen.getByRole('button', { name: /resolve fey ancestry save/i }));

    expect(screen.getByTestId('drow-half-elf-save-result')).toHaveTextContent('Ordinary context');
    expect(screen.getByTestId('drow-half-elf-save-result')).toHaveTextContent('Avoid/end Charmed');
    expect(screen.getByTestId('drow-half-elf-save-result')).toHaveTextContent('advantage applied');
    expect(events.at(-1)).toContain('Drow Half-Elf FEY ANCESTRY RESOLVED');

    rerender(
      <DrowHalfElfRaceLeaf
        race={HALF_ELF_DROW_DATA}
        state={createRaceDomainScenarioState(HALF_ELF_DROW_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('drow-half-elf-save-result')).toHaveTextContent('No Fey Ancestry save comparison resolved yet');
    expect(screen.getByTestId('drow-half-elf-boundary')).toHaveTextContent('canonical Charmed effect tag');
    expect(screen.getByTestId('drow-half-elf-boundary')).toHaveTextContent('sleep immunity');
    expect(screen.getByTestId('drow-half-elf-boundary')).toHaveTextContent('sensing');
    expect(screen.getByTestId('drow-half-elf-boundary')).toHaveTextContent('skill selection');
    expect(screen.getByTestId('drow-half-elf-boundary')).toHaveTextContent('spell casting');
    expect(screen.getByTestId('drow-half-elf-boundary')).toHaveTextContent('2D/3D render proof');
  });
});
