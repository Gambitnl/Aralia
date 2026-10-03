import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  BLACK_DRAGONBORN_BREATH_RESOURCE_ID,
  BLACK_DRAGONBORN_RESISTANCE_DAMAGE,
  BlackDragonbornRaceLeaf,
  RACE_DOMAIN_LEAF,
  createBlackDragonbornScenario,
  getCanonicalBlackDragonbornTraits,
  hasCanonicalBlackDragonbornRules,
  resolveBlackDragonbornBreath,
  resolveBlackDragonbornResistance,
} from '../blackDragonbornRaceLeaf';

/**
 * This file proves the Black Dragonborn Race leaf against canonical data,
 * production character assembly, and native combat/save helpers.
 *
 * The tests cover acid resistance and a non-acid comparison, the parser-created
 * Breath Weapon resource and level scaling, deterministic save/damage outcomes,
 * atomic action/resource rejection, visible events, keyed reset, and the honest
 * no-AoE-placement boundary. Parent-owned mounted 2D/3D proof remains outside
 * this focused leaf suite.
 */

// ============================================================================
// Canonical Link And Native Mechanic Proof
// ============================================================================
// These tests protect the source link and real resolver outcomes before a
// browser integration pass inspects the mounted Race domain.
// ============================================================================

describe('Black Dragonborn Race leaf', () => {
  const blackDragonborn = ACTIVE_RACES.find(race => race.id === 'black_dragonborn')!;

  it('exports one discoverable registration linked to ACTIVE_RACES', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('black-dragonborn-resistance-breath');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(blackDragonborn.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(BlackDragonbornRaceLeaf);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('links resistance, shapes, save, scaling, and resource to the canonical parser', () => {
    const parsed = getCanonicalBlackDragonbornTraits(blackDragonborn)!;

    expect(hasCanonicalBlackDragonbornRules(blackDragonborn)).toBe(true);
    expect(parsed.resistance).toContain('Acid');
    expect(parsed.breath.saveAbility).toBe('Constitution');
    expect(parsed.breath.damageDice).toBe('1d10');
    expect(parsed.breath.scaling).toContainEqual({ level: 5, dice: '2d10' });
    expect(parsed.breathShapes).toEqual([
      { shape: 'cone', sizeFeet: 15 },
      { shape: 'line', sizeFeet: 30 },
    ]);
    expect(parsed.breathTrait.resources).toContainEqual(expect.objectContaining({
      id: 'black_dragonborn__breath_weapon__resource',
      maxUses: 'proficiency_bonus',
      resetOn: 'long_rest',
    }));

    const baseline = createBlackDragonbornScenario(blackDragonborn);
    expect(baseline.actor).toMatchObject({
      class: { id: 'fighter' },
      level: 5,
      resistances: ['Acid'],
    });
    expect(baseline.actor?.abilities.find(ability => ability.id === 'racial_breath_weapon')).toMatchObject({
      areaShape: 'cone',
      areaSize: 3,
      saveAbility: 'Constitution',
      saveDC: 13,
      effects: [{ dice: '2d10', damageType: 'Acid' }],
    });
    expect(baseline.actor?.limitedUses?.[BLACK_DRAGONBORN_BREATH_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
  });

  it('uses native damage mitigation for acid and leaves fire unchanged', () => {
    const acidBaseline = createBlackDragonbornScenario(blackDragonborn);
    const acid = resolveBlackDragonbornResistance(acidBaseline, 'acid');
    const fireBaseline = createBlackDragonbornScenario(blackDragonborn);
    const fire = resolveBlackDragonbornResistance(fireBaseline, 'fire');

    expect(BLACK_DRAGONBORN_RESISTANCE_DAMAGE).toBe(15);
    expect(acid.resistanceFinalDamage).toBe(7);
    expect(acid.outcome).toContain('resistance applied');
    expect(fire.resistanceFinalDamage).toBe(15);
    expect(fire.outcome).toContain('non-acid comparison unchanged');
  });

  it('resolves deterministic cone and line breath branches through native action/save/damage helpers', () => {
    const failedCone = resolveBlackDragonbornBreath(
      createBlackDragonbornScenario(blackDragonborn),
      'cone',
      'failed',
    );
    const successfulLine = resolveBlackDragonbornBreath(
      createBlackDragonbornScenario(blackDragonborn),
      'line',
      'successful',
    );

    expect(failedCone.breathRawDamage).toBe(12);
    expect(failedCone.breathFinalDamage).toBe(12);
    expect(failedCone.breathSaveTotal).toBe(5);
    expect(failedCone.actor?.actionEconomy.action.remaining).toBe(0);
    expect(failedCone.actor?.limitedUses?.[BLACK_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(failedCone.outcome).toContain('15-foot cone');
    expect(failedCone.outcome).toContain('Attack action replaced');

    expect(successfulLine.breathRawDamage).toBe(12);
    expect(successfulLine.breathFinalDamage).toBe(6);
    expect(successfulLine.breathSaveTotal).toBe(24);
    expect(successfulLine.outcome).toContain('30-foot line');
    expect(successfulLine.outcome).toContain('AoE placement not claimed');
  });

  it('rejects a second breath atomically after the action is spent', () => {
    const first = resolveBlackDragonbornBreath(
      createBlackDragonbornScenario(blackDragonborn),
      'cone',
      'failed',
    );
    const rejected = resolveBlackDragonbornBreath(first, 'line', 'successful');

    expect(rejected.outcome).toContain('rejected atomically');
    expect(rejected.outcome).toContain('Attack action replacement is unavailable');
    expect(rejected.actor).toBe(first.actor);
    expect(rejected.target).toBe(first.target);
    expect(rejected.actor?.limitedUses?.[BLACK_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(rejected.target?.currentHP).toBe(first.target?.currentHP);
  });

  // ========================================================================
  // Visible Event, Keyed Reset, And Boundary Proof
  // ========================================================================
  // The component must publish the same native result it renders, and a parent
  // resetCount change must restore actor/action/resource/result baseline state.
  // ========================================================================

  it('shows actor/resource facts, publishes an event, resets, and labels the AoE boundary', () => {
    const events: string[] = [];
    const { rerender } = render(
      <BlackDragonbornRaceLeaf
        race={blackDragonborn}
        state={createRaceDomainScenarioState(blackDragonborn.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('black-dragonborn-canonical-traits')).toHaveTextContent('15-foot cone');
    expect(screen.getByTestId('black-dragonborn-canonical-traits')).toHaveTextContent('30-foot line');
    expect(screen.getByTestId('black-dragonborn-actor')).toHaveTextContent('Acid resistance: Acid');
    expect(screen.getByTestId('black-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('black-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');

    fireEvent.click(screen.getByRole('button', { name: /resolve native resistance/i }));
    expect(screen.getByTestId('black-dragonborn-resistance-result')).toHaveTextContent('Final 7');
    expect(events.at(-1)).toContain('Black Dragonborn RESISTANCE ACID');

    fireEvent.click(screen.getByRole('button', { name: /use native breath weapon/i }));
    expect(screen.getByTestId('black-dragonborn-breath-result')).toHaveTextContent('Raw 12');
    expect(screen.getByTestId('black-dragonborn-outcome')).toHaveTextContent('Native Breath Weapon resolved');
    expect(events.at(-1)).toContain('Black Dragonborn BREATH CONE');

    rerender(
      <BlackDragonbornRaceLeaf
        race={blackDragonborn}
        state={createRaceDomainScenarioState(blackDragonborn.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('black-dragonborn-actor')).toHaveTextContent('Action 1 remaining');
    expect(screen.getByTestId('black-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('black-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');
    expect(screen.getByTestId('black-dragonborn-boundary')).toHaveTextContent('AoE targeting/placement is not claimed');
    expect(screen.getByTestId('black-dragonborn-boundary')).toHaveTextContent('race feature rather than a spell');
  });
});
