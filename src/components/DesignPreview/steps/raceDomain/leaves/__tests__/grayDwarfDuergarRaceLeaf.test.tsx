import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { DUERGAR_DATA } from '../../../../../../data/races/duergar';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  applyGrayDwarfDuergarConditionContext,
  createGrayDwarfDuergarScenario,
  getCanonicalGrayDwarfDuergarTrait,
  getGrayDwarfDuergarCanonicalFacts,
  getGrayDwarfDuergarSaveAdapter,
  GrayDwarfDuergarRaceLeaf,
  hasCanonicalGrayDwarfDuergarFeatures,
  hasGrayDwarfDuergarParserProjection,
  resolveGrayDwarfDuergarPoisonResistance,
  resolveGrayDwarfDuergarSaves,
  RACE_DOMAIN_LEAF,
} from '../grayDwarfDuergarRaceLeaf';

/**
 * This file proves that the Gray Dwarf (Duergar) leaf stays linked to the
 * canonical race row, uses production assembly and native mechanics, and
 * exposes visible results, logs, reset, and honest unsupported boundaries.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, canonical Duergar data, the Race registry, and
 * the leaf's production-backed scenario helpers.
 */

// ============================================================================
// Canonical Identity And Automatic Discovery
// ============================================================================
// These checks prevent a plausible-looking preview from drifting away from
// the selectable race row or being registered more than once.
// ============================================================================

describe('Gray Dwarf (Duergar) Race domain leaf', () => {
  it('links identity, canonical traits, and spell gates to Duergar data', () => {
    const facts = getGrayDwarfDuergarCanonicalFacts(DUERGAR_DATA);

    expect(ACTIVE_RACES.filter(race => race.id === 'duergar')).toHaveLength(1);
    expect(RACE_DOMAIN_LEAF.id).toBe('gray-dwarf-duergar-resilience');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(DUERGAR_DATA.id);
    expect(RACE_DOMAIN_LEAF.label).toContain('Gray Dwarf (Duergar)');
    expect(hasCanonicalGrayDwarfDuergarFeatures(DUERGAR_DATA)).toBe(true);
    expect(facts.darkvision).toContain('120 feet');
    expect(facts.duergarMagic).toContain('Enlarge/Reduce');
    expect(facts.dwarvenResilience).toContain('poisoned condition');
    expect(facts.psionicFortitude).toContain('charmed or stunned');
    expect(facts.spellGates).toEqual([
      'Level 3: enlarge-reduce',
      'Level 5: invisibility',
    ]);
    expect(facts.spellAbilityChoice).toContain('Choose your spellcasting ability');
    expect(getCanonicalGrayDwarfDuergarTrait(DUERGAR_DATA, 'Dwarven Resilience')).toBe(facts.dwarvenResilience);
  });

  it('has exactly one discoverable registration for duergar', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('duergar');

    expect(leaves).toHaveLength(1);
    expect(leaves[0]).toEqual(RACE_DOMAIN_LEAF);
  });

  // ========================================================================
  // Production Assembly And Native Defense Mechanics
  // ========================================================================
  // The parser owns the raw projection; the leaf only narrows its condition
  // context before calling the native save helper.
  // ========================================================================

  it('assembles the production actor with native parser projection and poison resistance', () => {
    const scenario = createGrayDwarfDuergarScenario(DUERGAR_DATA);

    expect(scenario.actor?.id).toBe('gray-dwarf-duergar-race-actor');
    expect(scenario.actor?.level).toBe(5);
    expect(hasGrayDwarfDuergarParserProjection(scenario.actor)).toBe(true);
    expect(scenario.actor?.resistances?.map(type => type.toLowerCase())).toContain('poison');
    expect(getGrayDwarfDuergarSaveAdapter(DUERGAR_DATA, 'poisoned')).toMatchObject({
      type: 'advantage',
      context: 'saving_throw',
      against: ['poisoned'],
    });
    expect(getGrayDwarfDuergarSaveAdapter(DUERGAR_DATA, 'charmed')).toMatchObject({ against: ['charmed'] });
    expect(getGrayDwarfDuergarSaveAdapter(DUERGAR_DATA, 'stunned')).toMatchObject({ against: ['stunned'] });
  });

  it('strips only the parser projection from the ordinary baseline', () => {
    const scenario = createGrayDwarfDuergarScenario(DUERGAR_DATA);
    if (!scenario.actor || !scenario.ordinaryActor) throw new Error('Expected the production Duergar actor.');

    expect(hasGrayDwarfDuergarParserProjection(scenario.actor)).toBe(true);
    expect(hasGrayDwarfDuergarParserProjection(scenario.ordinaryActor)).toBe(false);
    expect(getCanonicalGrayDwarfDuergarTrait(DUERGAR_DATA, 'Psionic Fortitude')).toContain('advantage');
    expect(applyGrayDwarfDuergarConditionContext(scenario.actor).modifiers?.advantage).not.toContainEqual(
      expect.stringMatching(/poisoned|charmed|stunned/i),
    );
  });

  it('resolves native Dwarven Resilience from 15 raw Poison damage to 7', () => {
    const baseline = createGrayDwarfDuergarScenario(DUERGAR_DATA);
    const resolved = resolveGrayDwarfDuergarPoisonResistance(baseline);

    expect(resolved.lastPoisonResistance).toMatchObject({
      rawDamage: 15,
      finalDamage: 7,
      resistanceApplied: true,
      hitPointsAfter: (baseline.actor?.currentHP ?? 0) - 7,
    });
    expect(resolved.actor?.currentHP).toBe((baseline.actor?.currentHP ?? 0) - 7);
    expect(resolved.eventLog[0]).toContain('15 raw Poison -> 7');
  });

  it('resolves deterministic Poisoned, Charmed, and Stunned advantage only in matching contexts', () => {
    const baseline = createGrayDwarfDuergarScenario(DUERGAR_DATA);
    const randomValues = [0.15, 0.15, 0.15, 0.75, 0.15, 0.75, 0.15, 0.75];
    const resolved = resolveGrayDwarfDuergarSaves(
      baseline,
      DUERGAR_DATA,
      () => randomValues.shift() ?? 0.5,
    );

    expect(resolved.lastSaves).toMatchObject({ status: 'resolved', reason: 'resolved' });
    expect(resolved.lastSaves?.ordinary?.d20Rolls).toEqual([4]);
    expect(resolved.lastSaves?.nonApplicable?.d20Rolls).toEqual([4]);
    expect(resolved.lastSaves?.poisoned?.d20Rolls).toEqual([4, 16]);
    expect(resolved.lastSaves?.charmed?.d20Rolls).toEqual([4, 16]);
    expect(resolved.lastSaves?.stunned?.d20Rolls).toEqual([4, 16]);
    expect(resolved.lastSaves?.ordinary?.save.success).toBe(false);
    expect(resolved.lastSaves?.nonApplicable?.save.success).toBe(false);
    expect(resolved.lastSaves?.poisoned?.save.success).toBe(true);
    expect(resolved.lastSaves?.charmed?.save.success).toBe(true);
    expect(resolved.lastSaves?.stunned?.save.success).toBe(true);
    expect(resolved.outcome).toContain('Fire kept 4');
    expect(resolved.outcome).toContain('Poisoned kept 16');
    expect(resolved.outcome).toContain('Charmed kept 16');
    expect(resolved.outcome).toContain('Stunned kept 16');
  });

  // ========================================================================
  // Visible Receipt, Parent Reset, And Honest Boundaries
  // ========================================================================
  // The mounted proof checks callback logging and the keyed reset without
  // making a 2D or 3D render claim.
  // ========================================================================

  it('shows canonical facts, visible/logged results, resets, and names boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <GrayDwarfDuergarRaceLeaf
        race={DUERGAR_DATA}
        state={createRaceDomainScenarioState(DUERGAR_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('gray-dwarf-duergar-actor-facts')).toHaveTextContent('parser projection native');
    expect(screen.getByTestId('gray-dwarf-duergar-canonical-facts')).toHaveTextContent('120 feet');
    expect(screen.getByTestId('gray-dwarf-duergar-canonical-facts')).toHaveTextContent('Level 3: enlarge-reduce');
    expect(screen.getByTestId('gray-dwarf-duergar-canonical-facts')).toHaveTextContent('Level 5: invisibility');
    expect(screen.getByTestId('gray-dwarf-duergar-boundary')).toHaveTextContent('does not claim map-sense integration');

    fireEvent.click(screen.getByRole('button', { name: /resolve poisoned, charmed, and stunned saves/i }));
    fireEvent.click(screen.getByRole('button', { name: /resolve 15 poison damage/i }));

    expect(screen.getByTestId('gray-dwarf-duergar-save-result')).toHaveTextContent('Non-applicable Fire save');
    expect(screen.getByTestId('gray-dwarf-duergar-save-result')).toHaveTextContent('Avoid/end Poisoned');
    expect(screen.getByTestId('gray-dwarf-duergar-save-result')).toHaveTextContent('Avoid/end Charmed');
    expect(screen.getByTestId('gray-dwarf-duergar-save-result')).toHaveTextContent('Avoid/end Stunned');
    expect(screen.getByTestId('gray-dwarf-duergar-save-result')).toHaveTextContent('advantage applied');
    expect(screen.getByTestId('gray-dwarf-duergar-hp')).toHaveTextContent('last damage 15 -> 7');
    expect(screen.getByTestId('gray-dwarf-duergar-event-log')).toHaveTextContent('Duergar saves resolved');
    expect(screen.getByTestId('gray-dwarf-duergar-event-log')).toHaveTextContent('15 raw Poison -> 7');
    expect(events.at(-1)).toContain('Gray Dwarf (Duergar) POISON');

    rerender(
      <GrayDwarfDuergarRaceLeaf
        race={DUERGAR_DATA}
        state={createRaceDomainScenarioState(DUERGAR_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('gray-dwarf-duergar-save-result')).toHaveTextContent('No Duergar save comparison resolved yet');
    expect(screen.getByTestId('gray-dwarf-duergar-hp')).not.toHaveTextContent('last damage');
    expect(screen.getByTestId('gray-dwarf-duergar-event-log')).toHaveTextContent('No Duergar transaction yet');
    expect(screen.getByTestId('gray-dwarf-duergar-boundary')).toHaveTextContent('does not apply or remove conditions');
    expect(screen.getByTestId('gray-dwarf-duergar-boundary')).toHaveTextContent('does not claim map-sense integration');
    expect(screen.getByTestId('gray-dwarf-duergar-boundary')).toHaveTextContent('2D/3D rendered proof');
  });
});
