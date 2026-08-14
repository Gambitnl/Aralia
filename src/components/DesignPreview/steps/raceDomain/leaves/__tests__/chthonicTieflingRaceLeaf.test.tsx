import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  CHTHONIC_RESISTANCE_DAMAGE,
  CHTHONIC_DEFAULT_ABILITY,
  ChthonicTieflingRaceLeaf,
  RACE_DOMAIN_LEAF,
  createChthonicResistanceScenario,
  createChthonicTieflingActor,
  getCanonicalChthonicAbilityOptions,
  getCanonicalChthonicDamageResistances,
  getCanonicalChthonicSpellFacts,
  hasCanonicalChthonicResistance,
  resolveChthonicResistance,
} from '../chthonicTieflingRaceLeaf';

/**
 * This file proves the Chthonic Tiefling leaf's automatic discovery, canonical
 * spell gates, native necrotic resistance math, visible event output, and
 * parent Reset behavior. It does not claim rendered 2D/3D proof; the parent
 * Race shell owns that mounted integration surface.
 *
 * Called by: focused and raceDomain Vitest runs.
 * Depends on: ACTIVE_RACES, the Race registry, and the leaf's exported seams.
 */

// ============================================================================
// Canonical Registration And Assembly Proof
// ============================================================================
// These checks keep the leaf tied to live race data and the same production
// assembly helpers used by the UI rather than a hand-built combat fixture.
// ============================================================================

describe('Chthonic Tiefling Race leaf', () => {
  const chthonicTiefling = ACTIVE_RACES.find(race => race.id === 'chthonic_tiefling')!;

  it('exports the exact automatic-discovery registration for the canonical race', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('chthonic-tiefling-resistance');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(chthonicTiefling.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(ChthonicTieflingRaceLeaf);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('assembles native necrotic resistance from canonical Chthonic data', () => {
    expect(getCanonicalChthonicDamageResistances(chthonicTiefling)).toContain('necrotic');
    expect(hasCanonicalChthonicResistance(chthonicTiefling)).toBe(true);

    const assembly = createChthonicTieflingActor(chthonicTiefling);
    expect(assembly.actor).toMatchObject({
      id: 'chthonic-tiefling-resistance-actor',
      class: { id: 'wizard' },
      level: 5,
      resistances: ['Necrotic'],
    });
    expect(assembly.actor?.currentHP).toBe(assembly.actor?.maxHP);
    expect(assembly.character?.racialSelections?.chthonic_tiefling?.spellAbility)
      .toBe(CHTHONIC_DEFAULT_ABILITY);
  });
});

// ============================================================================
// Native Resistance And Atomic Repeat Proof
// ============================================================================
// The odd packet proves ResistanceCalculator's floor rule. Applying the
// returned state again proves that each repeat reads the latest HP and commits
// one complete damage transaction without mutating the prior state.
// ============================================================================

describe('Chthonic native resistance transaction', () => {
  const chthonicTiefling = ACTIVE_RACES.find(race => race.id === 'chthonic_tiefling')!;

  it('resolves odd raw necrotic damage through native resistance and HP', () => {
    const baseline = createChthonicResistanceScenario(chthonicTiefling);
    const resolved = resolveChthonicResistance(baseline, 'necrotic');

    expect(CHTHONIC_RESISTANCE_DAMAGE).toBe(15);
    expect(resolved.finalDamage).toBe(7);
    expect(resolved.assembly.actor?.currentHP)
      .toBe((baseline.assembly.actor?.maxHP ?? 0) - 7);
    expect(resolved.outcome).toContain('resistance applied');
  });

  it('repeats atomically from the returned HP and leaves the original state unchanged', () => {
    const baseline = createChthonicResistanceScenario(chthonicTiefling);
    const first = resolveChthonicResistance(baseline, 'necrotic');
    const second = resolveChthonicResistance(first, 'necrotic');

    expect(baseline.finalDamage).toBeNull();
    expect(baseline.assembly.actor?.currentHP).toBe(baseline.assembly.actor?.maxHP);
    expect(first.resolutionCount).toBe(1);
    expect(second.resolutionCount).toBe(2);
    expect(second.finalDamage).toBe(7);
    expect(second.assembly.actor?.currentHP)
      .toBe((baseline.assembly.actor?.maxHP ?? 0) - 14);
  });

  it('leaves a non-necrotic comparison packet unchanged by resistance', () => {
    const baseline = createChthonicResistanceScenario(chthonicTiefling);
    const resolved = resolveChthonicResistance(baseline, 'fire');

    expect(resolved.finalDamage).toBe(CHTHONIC_RESISTANCE_DAMAGE);
    expect(resolved.outcome).toContain('unchanged boundary');
  });
});

// ============================================================================
// Canonical Spell Facts And Honest Bridge Boundary
// ============================================================================
// The spell roster and gates are read from Race. The actor is assembled at
// multiple levels so tests prove the real grant filter without executing a
// fabricated spell cast or resource payer.
// ============================================================================

describe('Chthonic canonical spell facts', () => {
  const chthonicTiefling = ACTIVE_RACES.find(race => race.id === 'chthonic_tiefling')!;

  it('shows the canonical knownSpells roster and level gates', () => {
    expect(getCanonicalChthonicSpellFacts(chthonicTiefling)).toEqual([
      { minLevel: 1, spellId: 'thaumaturgy' },
      { minLevel: 1, spellId: 'chill-touch' },
      { minLevel: 3, spellId: 'false-life' },
      { minLevel: 5, spellId: 'ray-of-enfeeblement' },
    ]);
    expect(getCanonicalChthonicAbilityOptions(chthonicTiefling)).toEqual([
      'Intelligence',
      'Wisdom',
      'Charisma',
    ]);
  });

  it('uses the native level gate filter while retaining the chosen racial ability', () => {
    const levelOne = createChthonicTieflingActor(chthonicTiefling, 'Wisdom', 1);
    const levelThree = createChthonicTieflingActor(chthonicTiefling, 'Wisdom', 3);
    const levelFive = createChthonicTieflingActor(chthonicTiefling, 'Wisdom', 5);

    expect(levelOne.grants.map(grant => grant.spellId)).toEqual(['thaumaturgy', 'chill-touch']);
    expect(levelThree.grants.map(grant => grant.spellId)).toContain('false-life');
    expect(levelThree.grants.map(grant => grant.spellId)).not.toContain('ray-of-enfeeblement');
    expect(levelFive.grants.map(grant => grant.spellId)).toEqual([
      'thaumaturgy',
      'chill-touch',
      'false-life',
      'ray-of-enfeeblement',
    ]);
    expect(levelFive.selectedAbility).toBe('Wisdom');
    expect(levelFive.character?.racialSelections?.chthonic_tiefling?.spellAbility)
      .toBe('Wisdom');
  });
});

// ============================================================================
// Visible Event, Log, Reset, And Boundary Proof
// ============================================================================
// The leaf must expose the transaction and send its native result through the
// shell callback. Reset is represented by the parent resetCount contract.
// ============================================================================

describe('Chthonic visible proof', () => {
  const chthonicTiefling = ACTIVE_RACES.find(race => race.id === 'chthonic_tiefling')!;

  it('shows raw/resolved damage and spell facts, publishes log events, and resets', () => {
    const events: string[] = [];
    const { rerender } = render(
      <ChthonicTieflingRaceLeaf
        race={chthonicTiefling}
        state={createRaceDomainScenarioState(chthonicTiefling.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('chthonic-resistance-actor')).toHaveTextContent('Resistance: Necrotic');
    expect(screen.getByTestId('chthonic-resistance-packet'))
      .toHaveTextContent('Raw 15; Final not resolved; Resolutions 0');
    expect(screen.getByTestId('chthonic-spell-facts'))
      .toHaveTextContent('thaumaturgy (level 1); chill-touch (level 1); false-life (level 3); ray-of-enfeeblement (level 5)');
    expect(screen.getByTestId('chthonic-spell-boundary'))
      .toHaveTextContent('does not claim spell targeting, effect resolution, action payment, slot payment, or rest integration');

    fireEvent.click(screen.getByRole('button', { name: /resolve chthonic damage/i }));
    fireEvent.click(screen.getByRole('button', { name: /resolve chthonic damage/i }));

    expect(screen.getByTestId('chthonic-resistance-packet'))
      .toHaveTextContent('Packet: necrotic; Raw 15; Final 7; Resolutions 2');
    expect(screen.getByTestId('chthonic-resistance-outcome')).toHaveTextContent('Native damage resolved');
    expect(events).toHaveLength(2);
    expect(events[1]).toContain('Chthonic RESISTANCE NECROTIC');

    rerender(
      <ChthonicTieflingRaceLeaf
        race={chthonicTiefling}
        state={createRaceDomainScenarioState(chthonicTiefling.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('chthonic-resistance-packet'))
      .toHaveTextContent('Raw 15; Final not resolved; Resolutions 0');
    expect(screen.getByTestId('chthonic-resistance-actor')).toHaveTextContent('HP 32/32');
    expect(screen.getByTestId('chthonic-assembly-boundary'))
      .toHaveTextContent('applyRacialSpellGrantsByLevel');
  });
});
