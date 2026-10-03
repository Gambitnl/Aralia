import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  DRACONBLOOD_FORCEFUL_PRESENCE_CANONICAL_RESOURCE_ID,
  DRACONBLOOD_FORCEFUL_PRESENCE_RESOURCE_ID,
  DraconbloodDragonbornRaceLeaf,
  RACE_DOMAIN_LEAF,
  createDraconbloodScenario,
  getCanonicalDraconbloodFacts,
  hasCanonicalDraconbloodRules,
  resolveDraconbloodForcefulPresence,
} from '../draconbloodDragonbornRaceLeaf';

/**
 * This file proves the Draconblood Dragonborn Race leaf against canonical data,
 * production assembly, and native check/dice helpers. It covers discovery,
 * deterministic advantage, resource exhaustion, visible event logging, keyed
 * reset, canonical spell facts, and the explicit sensing/casting boundaries.
 * Parent-owned mounted 2D/3D proof remains outside this focused leaf suite.
 */

// ============================================================================
// Canonical Link And Native Mechanic Proof
// ============================================================================
// These tests protect the source link and real resolver outcome before a
// browser integration pass inspects the mounted Race domain.
// ============================================================================

describe('Draconblood Dragonborn Race leaf', () => {
  const draconblood = ACTIVE_RACES.find(race => race.id === 'draconblood_dragonborn')!;

  it('exports one discoverable registration linked to ACTIVE_RACES', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('draconblood-dragonborn-forceful-presence');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(draconblood.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(DraconbloodDragonbornRaceLeaf);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('links Forceful Presence and Ancestral Legacy facts to canonical parser/data', () => {
    const facts = getCanonicalDraconbloodFacts(draconblood);

    expect(hasCanonicalDraconbloodRules(draconblood)).toBe(true);
    expect(facts.forcefulTrait?.traitName).toBe('Forceful Presence');
    expect(facts.forcefulResource).toMatchObject({
      id: DRACONBLOOD_FORCEFUL_PRESENCE_CANONICAL_RESOURCE_ID,
      maxUses: 1,
      resetOn: 'short_rest',
    });
    expect(facts.ancestralLegacySpells).toEqual(expect.arrayContaining([
      expect.objectContaining({ spellId: 'thaumaturgy', minLevel: 1 }),
      expect.objectContaining({ spellId: 'comprehend-languages', minLevel: 1 }),
      expect.objectContaining({ spellId: 'detect-magic', minLevel: 5 }),
    ]));
    expect(facts.spellAbilityChoices).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
    expect(facts.visionTrait).toContain('60 feet');
  });

  it('uses the native ability check with deterministic advantage and decrements the resource', () => {
    const baseline = createDraconbloodScenario(draconblood);
    const resolved = resolveDraconbloodForcefulPresence(baseline, 'Persuasion');
    const expectedCharismaModifier = Math.floor(((baseline.actor?.stats.charisma ?? 10) - 10) / 2);

    expect(baseline.actor?.id).toBe('draconblood-dragonborn-race-actor');
    expect(baseline.actor?.stats.charisma).toEqual(expect.any(Number));
    expect(resolved.d20Faces).toEqual([5, 17]);
    expect(resolved.selectedD20).toBe(17);
    expect(resolved.check).toMatchObject({ roll: 17, total: 17 + expectedCharismaModifier });
    expect(resolved.actor?.limitedUses?.[DRACONBLOOD_FORCEFUL_PRESENCE_RESOURCE_ID]).toMatchObject({
      current: 0,
      max: 1,
      resetOn: 'short_rest',
    });
    expect(resolved.outcome).toContain('at advantage');
  });

  it('rejects exhaustion without consuming another check or changing actor state', () => {
    const first = resolveDraconbloodForcefulPresence(
      createDraconbloodScenario(draconblood),
      'Intimidation',
    );
    const rejected = resolveDraconbloodForcefulPresence(first, 'Persuasion');

    expect(rejected.outcome).toContain('no short-or-long-rest use remains');
    expect(rejected.actor).toBe(first.actor);
    expect(rejected.d20Faces).toEqual(first.d20Faces);
    expect(rejected.check).toBe(first.check);
  });

  // ========================================================================
  // Visible Event, Keyed Reset, And Boundary Proof
  // ========================================================================
  // The component must publish the same native result it renders, and a parent
  // resetCount change must restore the production baseline and visible facts.
  // ========================================================================

  it('shows faces/result/resource, publishes keyed events, resets, and labels boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <DraconbloodDragonbornRaceLeaf
        race={draconblood}
        state={createRaceDomainScenarioState(draconblood.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('draconblood-forceful-canonical')).toHaveTextContent('at advantage');
    expect(screen.getByTestId('draconblood-forceful-actor')).toHaveTextContent('uses 1/1');
    expect(screen.getByTestId('draconblood-forceful-result')).toHaveTextContent('not resolved');

    fireEvent.click(screen.getByRole('button', { name: /use forceful presence/i }));
    expect(screen.getByTestId('draconblood-forceful-result')).toHaveTextContent('d20 faces 5 and 17');
    expect(screen.getByTestId('draconblood-forceful-result')).toHaveTextContent('kept 17');
    const expectedTotal = 17 + Math.floor(((createDraconbloodScenario(draconblood).actor?.stats.charisma ?? 10) - 10) / 2);
    expect(screen.getByTestId('draconblood-forceful-result')).toHaveTextContent(`total ${expectedTotal}`);
    expect(screen.getByTestId('draconblood-forceful-actor')).toHaveTextContent('uses 0/1');
    expect(events.at(-1)).toContain('Draconblood Dragonborn FORCEFUL PRESENCE');

    fireEvent.click(screen.getByRole('button', { name: /use forceful presence/i }));
    expect(screen.getByTestId('draconblood-forceful-outcome')).toHaveTextContent('no short-or-long-rest use remains');
    expect(events.at(-1)).toContain('no short-or-long-rest use remains');

    expect(screen.getByTestId('draconblood-ancestral-legacy-facts')).toHaveTextContent('detect-magic at level 5');
    expect(screen.getByTestId('draconblood-ancestral-legacy-facts')).toHaveTextContent('Intelligence, Wisdom, Charisma');
    expect(screen.getByTestId('draconblood-sensing-boundary')).toHaveTextContent('canonical Vision is 60 feet');
    expect(screen.getByTestId('draconblood-sensing-boundary')).toHaveTextContent('no darkvision/sensing transaction is claimed');
    expect(screen.getByTestId('draconblood-boundary')).toHaveTextContent('spell casting/resource payment');

    rerender(
      <DraconbloodDragonbornRaceLeaf
        race={draconblood}
        state={createRaceDomainScenarioState(draconblood.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('draconblood-forceful-actor')).toHaveTextContent('uses 1/1');
    expect(screen.getByTestId('draconblood-forceful-result')).toHaveTextContent('not resolved');
  });
});
