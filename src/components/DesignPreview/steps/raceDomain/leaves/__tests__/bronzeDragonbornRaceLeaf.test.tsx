import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  BRONZE_DRAGONBORN_BREATH_RESOURCE_ID,
  BRONZE_DRAGONBORN_RESISTANCE_DAMAGE,
  BronzeDragonbornRaceLeaf,
  RACE_DOMAIN_LEAF,
  createBronzeDragonbornScenario,
  getCanonicalBronzeDragonbornTraits,
  hasCanonicalBronzeDragonbornRules,
  resolveBronzeDragonbornBreath,
  resolveBronzeDragonbornResistance,
} from '../bronzeDragonbornRaceLeaf';

/**
 * This file proves the Bronze Dragonborn leaf against canonical ACTIVE_RACES,
 * production character assembly, and native combat/save helpers.
 *
 * It covers Lightning resistance and a non-Lightning comparison, canonical
 * Breath Weapon scaling/resource facts, deterministic save and damage branches,
 * atomic rejection, visible event/reset state, and explicit no-AoE and Flight
 * boundaries. Parent-owned mounted 2D/3D proof is separate.
 */

// ============================================================================
// Canonical Link And Native Mechanic Proof
// ============================================================================
// These tests protect source linkage and real resolver outcomes before a parent
// performs a mounted Race-domain integration pass.
// ============================================================================

describe('Bronze Dragonborn Race leaf', () => {
  const bronzeDragonborn = ACTIVE_RACES.find(race => race.id === 'bronze_dragonborn')!;

  it('exports exactly one discoverable registration linked to ACTIVE_RACES', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('bronze-dragonborn-resistance-breath');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(bronzeDragonborn.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(BronzeDragonbornRaceLeaf);
    expect(discoverRaceDomainLeaves().filter(leaf => leaf.raceId === 'bronze_dragonborn')).toEqual([RACE_DOMAIN_LEAF]);
  });

  it('links Bronze resistance, shapes, save, scaling, and resource to canonical parser output', () => {
    const parsed = getCanonicalBronzeDragonbornTraits(bronzeDragonborn)!;

    expect(hasCanonicalBronzeDragonbornRules(bronzeDragonborn)).toBe(true);
    expect(parsed.resistance).toContain('Lightning');
    expect(parsed.breath.saveAbility).toBe('Constitution');
    expect(parsed.breath.damageDice).toBe('1d10');
    expect(parsed.breath.damageType.toLowerCase()).toBe('lightning');
    expect(parsed.breath.scaling).toContainEqual({ level: 5, dice: '2d10' });
    expect(parsed.breathShapes).toEqual([
      { shape: 'cone', sizeFeet: 15 },
      { shape: 'line', sizeFeet: 30 },
    ]);
    expect(parsed.breathTrait.resources).toContainEqual(expect.objectContaining({
      id: 'bronze_dragonborn__breath_weapon__resource',
      maxUses: 'proficiency_bonus',
      resetOn: 'long_rest',
    }));

    const baseline = createBronzeDragonbornScenario(bronzeDragonborn);
    expect(baseline.actor).toMatchObject({
      class: { id: 'fighter' },
      level: 5,
      resistances: ['Lightning'],
    });
    expect(baseline.actor?.abilities.find(ability => ability.id === 'racial_breath_weapon')).toMatchObject({
      areaShape: 'cone',
      areaSize: 3,
      saveAbility: 'Constitution',
      saveDC: 13,
      effects: [{ dice: '2d10', damageType: 'Lightning' }],
    });
    expect(baseline.actor?.limitedUses?.[BRONZE_DRAGONBORN_BREATH_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
  });

  it('uses native damage mitigation for Lightning and leaves Fire unchanged', () => {
    const lightning = resolveBronzeDragonbornResistance(createBronzeDragonbornScenario(bronzeDragonborn), 'lightning');
    const fire = resolveBronzeDragonbornResistance(createBronzeDragonbornScenario(bronzeDragonborn), 'fire');

    expect(BRONZE_DRAGONBORN_RESISTANCE_DAMAGE).toBe(15);
    expect(lightning.resistanceFinalDamage).toBe(7);
    expect(lightning.outcome).toContain('resistance applied');
    expect(fire.resistanceFinalDamage).toBe(15);
    expect(fire.outcome).toContain('non-lightning comparison unchanged');
  });

  it('resolves deterministic cone and line Breath Weapon branches through native helpers', () => {
    const failedCone = resolveBronzeDragonbornBreath(
      createBronzeDragonbornScenario(bronzeDragonborn),
      'cone',
      'failed',
    );
    const successfulLine = resolveBronzeDragonbornBreath(
      createBronzeDragonbornScenario(bronzeDragonborn),
      'line',
      'successful',
    );

    expect(failedCone.breathRawDamage).toBe(12);
    expect(failedCone.breathFinalDamage).toBe(12);
    expect(failedCone.breathSaveTotal).toBe(5);
    expect(failedCone.actor?.actionEconomy.action.remaining).toBe(0);
    expect(failedCone.actor?.limitedUses?.[BRONZE_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(failedCone.outcome).toContain('15-foot cone');
    expect(failedCone.outcome).toContain('Attack action replaced');

    expect(successfulLine.breathRawDamage).toBe(12);
    expect(successfulLine.breathFinalDamage).toBe(6);
    expect(successfulLine.breathSaveTotal).toBe(24);
    expect(successfulLine.outcome).toContain('30-foot line');
    expect(successfulLine.outcome).toContain('AoE placement not claimed');
  });

  it('rejects a second Breath Weapon atomically after the Attack action is spent', () => {
    const first = resolveBronzeDragonbornBreath(
      createBronzeDragonbornScenario(bronzeDragonborn),
      'cone',
      'failed',
    );
    const rejected = resolveBronzeDragonbornBreath(first, 'line', 'successful');

    expect(rejected.outcome).toContain('rejected atomically');
    expect(rejected.outcome).toContain('Attack action replacement is unavailable');
    expect(rejected.actor).toBe(first.actor);
    expect(rejected.target).toBe(first.target);
    expect(rejected.actor?.limitedUses?.[BRONZE_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(rejected.target?.currentHP).toBe(first.target?.currentHP);
  });

  // ========================================================================
  // Visible Event, Keyed Reset, And Boundary Proof
  // ========================================================================
  // The UI must publish the native result it renders and restore baseline state
  // when the parent increments resetCount.
  // ========================================================================

  it('shows actor/resource facts, publishes events, resets, and labels boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <BronzeDragonbornRaceLeaf
        race={bronzeDragonborn}
        state={createRaceDomainScenarioState(bronzeDragonborn.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('bronze-dragonborn-canonical-traits')).toHaveTextContent('15-foot cone');
    expect(screen.getByTestId('bronze-dragonborn-canonical-traits')).toHaveTextContent('30-foot line');
    expect(screen.getByTestId('bronze-dragonborn-actor')).toHaveTextContent('Lightning resistance: Lightning');
    expect(screen.getByTestId('bronze-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('bronze-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');

    fireEvent.click(screen.getByRole('button', { name: /resolve native resistance/i }));
    expect(screen.getByTestId('bronze-dragonborn-resistance-result')).toHaveTextContent('Final 7');
    expect(events.at(-1)).toContain('Bronze Dragonborn RESISTANCE LIGHTNING');

    fireEvent.click(screen.getByRole('button', { name: /use native breath weapon/i }));
    expect(screen.getByTestId('bronze-dragonborn-breath-result')).toHaveTextContent('Raw 12');
    expect(screen.getByTestId('bronze-dragonborn-outcome')).toHaveTextContent('Native Breath Weapon resolved');
    expect(events.at(-1)).toContain('Bronze Dragonborn BREATH CONE');

    rerender(
      <BronzeDragonbornRaceLeaf
        race={bronzeDragonborn}
        state={createRaceDomainScenarioState(bronzeDragonborn.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('bronze-dragonborn-actor')).toHaveTextContent('Action 1 remaining');
    expect(screen.getByTestId('bronze-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('bronze-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');
    expect(screen.getByTestId('bronze-dragonborn-boundary')).toHaveTextContent('AoE targeting/placement is not claimed');
    expect(screen.getByTestId('bronze-dragonborn-boundary')).toHaveTextContent('Draconic Flight remains an explicit deferred boundary');
  });
});
