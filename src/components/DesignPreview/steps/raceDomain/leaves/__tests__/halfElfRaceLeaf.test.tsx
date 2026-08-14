import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  HALF_ELF_CHARMED_SAVE_DC,
  HALF_ELF_ACTOR_ID,
  HalfElfRaceLeaf,
  applyHalfElfFeyAncestryContext,
  createHalfElfScenario,
  getCanonicalHalfElfAbilityBonusFacts,
  getCanonicalHalfElfDarkvisionRangeFeet,
  getCanonicalHalfElfFeyAncestryTrait,
  getCanonicalHalfElfSkillVersatilityTrait,
  getHalfElfFeyAncestrySaveAdapter,
  hasCanonicalHalfElfFeatures,
  hasHalfElfFeyAncestryParserProjection,
  resolveHalfElfFeyAncestry,
  RACE_DOMAIN_LEAF,
} from '../halfElfRaceLeaf';

/**
 * This file proves that the base Half-Elf leaf stays linked to canonical race
 * data, automatic discovery, production actor/parser assembly, native saving
 * throws, deterministic faces, visible logging, keyed reset, and explicit
 * facts-only boundaries.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES and the Half-Elf leaf's production-backed seams.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking panel from drifting away from the
// active canonical race or the automatic registry contract.
// ============================================================================

describe('Half-Elf Race domain leaf', () => {
  const halfElf = ACTIVE_RACES.find(race => race.id === 'half_elf')!;

  it('links identity and surfaced facts to canonical data', () => {
    expect(halfElf).toBeDefined();
    expect(RACE_DOMAIN_LEAF.id).toBe('half-elf-fey-ancestry');
    expect(RACE_DOMAIN_LEAF.raceId).toBe('half_elf');
    expect(RACE_DOMAIN_LEAF.label).toContain('Half-Elf');
    expect(RACE_DOMAIN_LEAF.Component).toBe(HalfElfRaceLeaf);
    expect(hasCanonicalHalfElfFeatures(halfElf)).toBe(true);
    expect(getCanonicalHalfElfDarkvisionRangeFeet(halfElf)).toBe(60);
    expect(getCanonicalHalfElfFeyAncestryTrait(halfElf)).toContain('magic can\'t put you to sleep');
    expect(getCanonicalHalfElfSkillVersatilityTrait(halfElf)).toContain('two skills of your choice');
    expect(getCanonicalHalfElfAbilityBonusFacts(halfElf)).toEqual([
      'Charisma +2',
      'Any +1 (choose 2)',
    ]);
  });

  it('is discovered for half_elf by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('half_elf');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Production Assembly And Native Save Comparison
  // ========================================================================
  // The actor must retain the parser projection, while the adapter keeps an
  // ordinary save free from the Charmed-only advantage.
  // ========================================================================

  it('assembles the production actor and exposes the parser-backed projection', () => {
    const scenario = createHalfElfScenario(halfElf);

    expect(scenario.actor?.id).toBe(HALF_ELF_ACTOR_ID);
    expect(scenario.actor?.level).toBe(5);
    expect(scenario.actor?.stats.charisma).toBe(12);
    expect(hasHalfElfFeyAncestryParserProjection(scenario.actor)).toBe(true);
    expect(getHalfElfFeyAncestrySaveAdapter(halfElf)).toMatchObject({
      type: 'advantage',
      context: 'saving_throw',
      against: ['charmed'],
    });
  });

  it('compares ordinary one-roll and Charmed two-roll saves with pinned faces', () => {
    const scenario = createHalfElfScenario(halfElf);
    const randomValues = [0.15, 0.15, 0.75];
    const resolved = resolveHalfElfFeyAncestry(
      scenario,
      halfElf,
      () => randomValues.shift() ?? 0.5,
    );

    expect(resolved.lastResolution).toMatchObject({ status: 'resolved', reason: 'resolved' });
    expect(resolved.lastResolution?.ordinary?.condition).toBe('ordinary save');
    expect(resolved.lastResolution?.ordinary?.d20Rolls).toEqual([4]);
    expect(resolved.lastResolution?.ordinary?.save.roll).toBe(4);
    expect(resolved.lastResolution?.ordinary?.save.total).toBe(5);
    expect(resolved.lastResolution?.ordinary?.save.dc).toBe(HALF_ELF_CHARMED_SAVE_DC);
    expect(resolved.lastResolution?.ordinary?.save.success).toBe(false);
    expect(resolved.lastResolution?.charmed?.condition).toBe('avoid/end Charmed');
    expect(resolved.lastResolution?.charmed?.d20Rolls).toEqual([4, 16]);
    expect(resolved.lastResolution?.charmed?.save.roll).toBe(16);
    expect(resolved.lastResolution?.charmed?.save.total).toBe(17);
    expect(resolved.lastResolution?.charmed?.save.success).toBe(true);
    expect(resolved.outcome).toContain('Charmed kept 16 from 4 / 16');
  });

  it('strips only the parser projection before applying the context adapter', () => {
    const scenario = createHalfElfScenario(halfElf);
    const actor = scenario.actor;
    if (!actor) throw new Error('Expected the production Half-Elf actor.');

    const contextFree = applyHalfElfFeyAncestryContext(actor);

    expect(hasHalfElfFeyAncestryParserProjection(actor)).toBe(true);
    expect(hasHalfElfFeyAncestryParserProjection(contextFree)).toBe(false);
  });
});

// ============================================================================
// Visible Result, Reset, And Boundary Proof
// ============================================================================
// The mounted proof checks the event callback and keyed reset without making a
// 2D or 3D render claim.
// ============================================================================

describe('Half-Elf visible leaf contract', () => {
  const halfElf = ACTIVE_RACES.find(race => race.id === 'half_elf')!;

  it('shows facts, resolves and logs the comparison, resets, and names boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <HalfElfRaceLeaf
        race={halfElf}
        state={createRaceDomainScenarioState(halfElf.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('half-elf-actor')).toHaveTextContent('parser Fey Ancestry projection native');
    expect(screen.getByTestId('half-elf-canonical-facts')).toHaveTextContent('Darkvision: 60 ft');
    expect(screen.getByTestId('half-elf-canonical-facts')).toHaveTextContent('Skill Versatility');
    expect(screen.getByTestId('half-elf-canonical-facts')).toHaveTextContent('two skills of your choice');
    expect(screen.getByTestId('half-elf-canonical-facts')).toHaveTextContent('Charisma +2');
    expect(screen.getByTestId('half-elf-canonical-facts')).toHaveTextContent('Any +1 (choose 2)');

    fireEvent.click(screen.getByRole('button', { name: /resolve fey ancestry save/i }));

    expect(screen.getByTestId('half-elf-save-result')).toHaveTextContent('Ordinary context');
    expect(screen.getByTestId('half-elf-save-result')).toHaveTextContent('one d20 face');
    expect(screen.getByTestId('half-elf-save-result')).toHaveTextContent('Avoid/end Charmed context');
    expect(screen.getByTestId('half-elf-save-result')).toHaveTextContent('kept face 16');
    expect(screen.getByTestId('half-elf-save-result')).toHaveTextContent('advantage applied');
    expect(screen.getByTestId('half-elf-save-result')).toHaveTextContent('total 17');
    expect(events.at(-1)).toContain('Half-Elf FEY ANCESTRY RESOLVED');

    rerender(
      <HalfElfRaceLeaf
        race={halfElf}
        state={createRaceDomainScenarioState(halfElf.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('half-elf-save-result')).toHaveTextContent('No Fey Ancestry save comparison resolved yet');
    expect(screen.getByTestId('half-elf-boundary')).toHaveTextContent('does not simulate condition application');
    expect(screen.getByTestId('half-elf-boundary')).toHaveTextContent('native magic sleep immunity');
    expect(screen.getByTestId('half-elf-boundary')).toHaveTextContent('choose the two skills');
    expect(screen.getByTestId('half-elf-boundary')).toHaveTextContent('2D/3D render proof');
  });
});
