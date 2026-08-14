
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  GOLD_DRAGONBORN_BREATH_RESOURCE_ID,
  GOLD_DRAGONBORN_RESISTANCE_DAMAGE,
  GoldDragonbornRaceLeaf,
  RACE_DOMAIN_LEAF,
  createGoldDragonbornScenario,
  getCanonicalGoldDragonbornTraits,
  hasCanonicalGoldDragonbornRules,
  resolveGoldDragonbornBreath,
  resolveGoldDragonbornResistance,
} from '../goldDragonbornRaceLeaf';

/**
 * This file proves the Gold Dragonborn leaf against canonical ACTIVE_RACES,
 * production character assembly, and native combat/save helpers.
 *
 * It covers Fire resistance and a non-Fire comparison, canonical
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

describe('Gold Dragonborn Race leaf', () => {
  const goldDragonborn = ACTIVE_RACES.find(race => race.id === 'gold_dragonborn')!;

  it('exports exactly one discoverable registration linked to ACTIVE_RACES', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('gold-dragonborn-resistance-breath');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(goldDragonborn.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(GoldDragonbornRaceLeaf);
    expect(discoverRaceDomainLeaves().filter(leaf => leaf.raceId === 'gold_dragonborn')).toEqual([RACE_DOMAIN_LEAF]);
  });

  it('links Gold resistance, shapes, save, scaling, and resource to canonical parser output', () => {
    const parsed = getCanonicalGoldDragonbornTraits(goldDragonborn)!;

    expect(hasCanonicalGoldDragonbornRules(goldDragonborn)).toBe(true);
    expect(parsed.resistance).toContain('Fire');
    expect(parsed.breath.saveAbility).toBe('Constitution');
    expect(parsed.breath.damageDice).toBe('1d10');
    expect(parsed.breath.damageType.toLowerCase()).toBe('fire');
    expect(parsed.breath.scaling).toContainEqual({ level: 5, dice: '2d10' });
    expect(parsed.breathShapes).toEqual([
      { shape: 'cone', sizeFeet: 15 },
      { shape: 'line', sizeFeet: 30 },
    ]);
    expect(parsed.breathTrait.resources).toContainEqual(expect.objectContaining({
      id: 'gold_dragonborn__breath_weapon__resource',
      maxUses: 'proficiency_bonus',
      resetOn: 'long_rest',
    }));

    const baseline = createGoldDragonbornScenario(goldDragonborn);
    expect(baseline.actor).toMatchObject({
      class: { id: 'fighter' },
      level: 5,
      resistances: ['Fire'],
    });
    expect(baseline.actor?.abilities.find(ability => ability.id === 'racial_breath_weapon')).toMatchObject({
      areaShape: 'cone',
      areaSize: 3,
      saveAbility: 'Constitution',
      saveDC: 13,
      effects: [{ dice: '2d10', damageType: 'Fire' }],
    });
    expect(baseline.actor?.limitedUses?.[GOLD_DRAGONBORN_BREATH_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
  });

  it('uses native damage mitigation for Fire and leaves Lightning unchanged', () => {
    const fire = resolveGoldDragonbornResistance(createGoldDragonbornScenario(goldDragonborn), 'fire');
    const lightning = resolveGoldDragonbornResistance(createGoldDragonbornScenario(goldDragonborn), 'lightning');

    expect(GOLD_DRAGONBORN_RESISTANCE_DAMAGE).toBe(15);
    expect(fire.resistanceFinalDamage).toBe(7);
    expect(fire.outcome).toContain('resistance applied');
    expect(lightning.resistanceFinalDamage).toBe(15);
    expect(lightning.outcome).toContain('non-fire comparison unchanged');
  });

  it('resolves deterministic cone and line Breath Weapon branches through native helpers', () => {
    const failedCone = resolveGoldDragonbornBreath(
      createGoldDragonbornScenario(goldDragonborn),
      'cone',
      'failed',
    );
    const successfulLine = resolveGoldDragonbornBreath(
      createGoldDragonbornScenario(goldDragonborn),
      'line',
      'successful',
    );

    expect(failedCone.breathRawDamage).toBe(12);
    expect(failedCone.breathFinalDamage).toBe(12);
    expect(failedCone.breathSaveTotal).toBe(5);
    expect(failedCone.actor?.actionEconomy.action.remaining).toBe(0);
    expect(failedCone.actor?.limitedUses?.[GOLD_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(failedCone.outcome).toContain('15-foot cone');
    expect(failedCone.outcome).toContain('Attack action replaced');

    expect(successfulLine.breathRawDamage).toBe(12);
    expect(successfulLine.breathFinalDamage).toBe(6);
    expect(successfulLine.breathSaveTotal).toBe(24);
    expect(successfulLine.target?.currentHP).toBeLessThan(successfulLine.target?.maxHP ?? Number.POSITIVE_INFINITY);
    expect(successfulLine.outcome).toContain('30-foot line');
    expect(successfulLine.outcome).toContain('AoE placement not claimed');
  });

  it('rejects a second Breath Weapon atomically after the Attack action is spent', () => {
    const first = resolveGoldDragonbornBreath(
      createGoldDragonbornScenario(goldDragonborn),
      'cone',
      'failed',
    );
    const rejected = resolveGoldDragonbornBreath(first, 'line', 'successful');

    expect(rejected.outcome).toContain('rejected atomically');
    expect(rejected.outcome).toContain('Attack action replacement is unavailable');
    expect(rejected.actor).toBe(first.actor);
    expect(rejected.target).toBe(first.target);
    expect(rejected.actor?.limitedUses?.[GOLD_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(rejected.target?.currentHP).toBe(first.target?.currentHP);

    // Resetting the action economy alone cannot restore a depleted PB resource.
    const resourceDepleted = createGoldDragonbornScenario(goldDragonborn);
    const depletedActor = resourceDepleted.actor!;
    const noResource = {
      ...resourceDepleted,
      actor: {
        ...depletedActor,
        limitedUses: {
          ...depletedActor.limitedUses,
          [GOLD_DRAGONBORN_BREATH_RESOURCE_ID]: {
            ...depletedActor.limitedUses![GOLD_DRAGONBORN_BREATH_RESOURCE_ID],
            current: 0,
          },
        },
      },
    };
    const resourceRejected = resolveGoldDragonbornBreath(noResource, 'cone', 'failed');
    expect(resourceRejected.outcome).toContain('no PB-scaled long-rest use remains');
    expect(resourceRejected.actor).toBe(noResource.actor);
    expect(resourceRejected.target).toBe(noResource.target);
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
      <GoldDragonbornRaceLeaf
        race={goldDragonborn}
        state={createRaceDomainScenarioState(goldDragonborn.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('gold-dragonborn-canonical-traits')).toHaveTextContent('15-foot cone');
    expect(screen.getByTestId('gold-dragonborn-canonical-traits')).toHaveTextContent('30-foot line');
    expect(screen.getByTestId('gold-dragonborn-canonical-traits')).toHaveTextContent('Darkvision 60 feet');
    expect(screen.getByTestId('gold-dragonborn-actor')).toHaveTextContent('Fire resistance: Fire');
    expect(screen.getByTestId('gold-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('gold-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');

    fireEvent.click(screen.getByRole('button', { name: /resolve native resistance/i }));
    expect(screen.getByTestId('gold-dragonborn-resistance-result')).toHaveTextContent('Final 7');
    expect(events.at(-1)).toContain('Gold Dragonborn RESISTANCE FIRE');

    fireEvent.click(screen.getByRole('button', { name: /use native breath weapon/i }));
    expect(screen.getByTestId('gold-dragonborn-breath-result')).toHaveTextContent('Raw 12');
    expect(screen.getByTestId('gold-dragonborn-outcome')).toHaveTextContent('Native Breath Weapon resolved');
    expect(events.at(-1)).toContain('Gold Dragonborn BREATH CONE');

    rerender(
      <GoldDragonbornRaceLeaf
        race={goldDragonborn}
        state={createRaceDomainScenarioState(goldDragonborn.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('gold-dragonborn-actor')).toHaveTextContent('Action 1 remaining');
    expect(screen.getByTestId('gold-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('gold-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');
    expect(screen.getByTestId('gold-dragonborn-boundary')).toHaveTextContent('AoE targeting/placement is not claimed');
    expect(screen.getByTestId('gold-dragonborn-boundary')).toHaveTextContent('Darkvision is shown as a canonical fact');
    expect(screen.getByTestId('gold-dragonborn-boundary')).toHaveTextContent('Draconic Flight remains an explicit deferred boundary');
  });
});
