import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES, getRacialSpellCastingAbilityChoicesForRace } from '../../../../../../data/races';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  FIRE_GENASI_RESISTANCE_DAMAGE,
  FireGenasiRaceLeaf,
  RACE_DOMAIN_LEAF,
  createFireGenasiResistanceScenario,
  getCanonicalFireGenasiDamageResistances,
  getCanonicalFireGenasiSpellAbilityChoices,
  getCanonicalFireGenasiSpellProgression,
  getCanonicalReachToTheBlazeTrait,
  hasCanonicalFireGenasiFireResistance,
  resolveFireGenasiResistance,
} from '../fireGenasiRaceLeaf';

/**
 * This file proves that the Fire Genasi leaf stays linked to canonical Race
 * data and that its deterministic damage transaction uses native mitigation
 * and HP helpers. It also protects repeat, reset, event, and honest spell
 * boundaries without claiming mounted browser or 2D/3D render proof.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, the production racial parser, Race registry
 * discovery, and the Fire Genasi leaf's exported test seams.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These assertions stop a plausible-looking preview from drifting away from
// the active Fire Genasi record or automatic leaves/ discovery contract.
// ============================================================================

describe('Fire Genasi Race domain leaf', () => {
  const fireGenasi = ACTIVE_RACES.find(race => race.id === 'fire_genasi')!;

  it('exports the canonical identity and automatic-discovery registration', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('fire-genasi-resistance');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(fireGenasi.id);
    expect(RACE_DOMAIN_LEAF.label).toContain('Fire Genasi');
    expect(RACE_DOMAIN_LEAF.Component).toBe(FireGenasiRaceLeaf);
    expect(createRaceDomainRegistry(ACTIVE_RACES).getLeavesForRace('fire_genasi')).toEqual([RACE_DOMAIN_LEAF]);
  });

  it('reads Fire Resistance and Reach to the Blaze facts from canonical data and parsers', () => {
    expect(getCanonicalFireGenasiDamageResistances(fireGenasi)).toEqual(['Fire']);
    expect(hasCanonicalFireGenasiFireResistance(fireGenasi)).toBe(true);
    expect(getCanonicalReachToTheBlazeTrait(fireGenasi)).toContain('Burning Hands once per long rest');
    expect(getCanonicalFireGenasiSpellProgression(fireGenasi)).toEqual([
      { minLevel: 1, spellId: 'produce-flame' },
      { minLevel: 3, spellId: 'burning-hands' },
      { minLevel: 5, spellId: 'flame-blade' },
    ]);
    expect(getCanonicalFireGenasiSpellAbilityChoices(fireGenasi)).toEqual([
      'Intelligence',
      'Wisdom',
      'Charisma',
    ]);
    expect(getRacialSpellCastingAbilityChoicesForRace(fireGenasi.id)[0]?.requiredSpellIds).toEqual([
      'produce-flame',
      'burning-hands',
      'flame-blade',
    ]);
  });

  // ========================================================================
  // Native Resistance And HP Transaction
  // ========================================================================
  // The deterministic odd packet proves floor rounding, then a repeat proves
  // that HP is committed through the shared helper rather than copied locally.
  // ========================================================================

  it('uses the production actor, native Fire resistance math, and native HP helper', () => {
    const baseline = createFireGenasiResistanceScenario(fireGenasi);
    const actor = baseline.actor!;

    expect(actor.id).toBe('fire-genasi-resistance-actor');
    expect(actor.resistances).toContain('Fire');
    expect(actor.currentHP).toBe(actor.maxHP);
    expect(FIRE_GENASI_RESISTANCE_DAMAGE).toBe(15);

    const resolved = resolveFireGenasiResistance(baseline);
    expect(resolved.finalDamage).toBe(7);
    expect(resolved.actor?.currentHP).toBe(Math.max(0, actor.maxHP - 7));
    expect(resolved.outcome).toContain('resistance applied');

    const repeated = resolveFireGenasiResistance(resolved);
    expect(repeated.finalDamage).toBe(7);
    expect(repeated.actor?.currentHP).toBe(Math.max(0, actor.maxHP - 14));
    expect(repeated.outcome).toContain('HP');
  });

  // ========================================================================
  // Visible Event, Repeat, Reset, And Honest Spell Boundary
  // ========================================================================
  // The component publishes each native result, repeats the fixed packet, and
  // remounts from resetCount without pretending to cast Reach to the Blaze.
  // ========================================================================

  it('shows facts and HP, logs repeats, resets, and names unsupported spell execution', () => {
    const events: string[] = [];
    const { rerender } = render(
      <FireGenasiRaceLeaf
        race={fireGenasi}
        state={createRaceDomainScenarioState(fireGenasi.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('fire-genasi-canonical-facts')).toHaveTextContent('Fire resistance');
    expect(screen.getByTestId('fire-genasi-canonical-facts')).toHaveTextContent('level 3 burning-hands');
    expect(screen.getByTestId('fire-genasi-canonical-facts')).toHaveTextContent('level 5 flame-blade');
    expect(screen.getByTestId('fire-genasi-canonical-facts')).toHaveTextContent('ability choices: Intelligence, Wisdom, Charisma');
    expect(screen.getByTestId('fire-genasi-resistance-actor')).toHaveTextContent(/HP \d+\/\d+/);
    expect(screen.getByTestId('fire-genasi-resistance-packet')).toHaveTextContent('Raw 15; Final not resolved');

    const resolveButton = screen.getByRole('button', { name: /resolve fire genasi damage/i });
    fireEvent.click(resolveButton);
    fireEvent.click(resolveButton);

    expect(screen.getByTestId('fire-genasi-resistance-packet')).toHaveTextContent('Raw 15; Final 7');
    expect(screen.getByTestId('fire-genasi-resistance-outcome')).toHaveTextContent('Native damage resolved');
    expect(events).toHaveLength(2);
    expect(events.at(-1)).toContain('Fire Genasi RESISTANCE FIRE');

    rerender(
      <FireGenasiRaceLeaf
        race={fireGenasi}
        state={createRaceDomainScenarioState(fireGenasi.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('fire-genasi-resistance-packet')).toHaveTextContent('Raw 15; Final not resolved');
    expect(screen.getByTestId('fire-genasi-resistance-actor')).toHaveTextContent(/HP \d+\/\d+/);
    expect(screen.getByTestId('fire-genasi-assembly-boundary')).toHaveTextContent('materialized into CombatCharacter.resistances');
    expect(screen.getByTestId('fire-genasi-spell-boundary')).toHaveTextContent('does not claim');
    expect(screen.getByTestId('fire-genasi-spell-boundary')).toHaveTextContent('spell-slot or rest-resource projection');
  });
});
