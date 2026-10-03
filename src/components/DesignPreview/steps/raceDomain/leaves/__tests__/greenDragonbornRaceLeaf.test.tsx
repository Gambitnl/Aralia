import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  GREEN_DRAGONBORN_BREATH_RESOURCE_ID,
  GREEN_DRAGONBORN_RESISTANCE_DAMAGE,
  GreenDragonbornRaceLeaf,
  RACE_DOMAIN_LEAF,
  createGreenDragonbornScenario,
  getCanonicalGreenDragonbornTraits,
  hasCanonicalGreenDragonbornRules,
  resolveGreenDragonbornBreath,
  resolveGreenDragonbornResistance,
} from '../greenDragonbornRaceLeaf';

/**
 * This file proves the Green Dragonborn leaf against canonical race data,
 * production character assembly, and native combat/save helpers.
 *
 * The focused suite covers automatic discovery, Poison resistance, both
 * deterministic Breath Weapon shapes and save outcomes, action/resource/HP
 * mutations, atomic rejection, visible event receipts, keyed reset, and the
 * explicit map/sense/flight runtime boundary. Mounted 2D/3D proof is outside
 * this leaf-owned test file and is intentionally not claimed here.
 */

// ============================================================================
// Canonical Link And Native Mechanic Proof
// ============================================================================
// These assertions protect the source link and native transaction outcomes
// before a parent-owned browser integration pass inspects the mounted domain.
// ============================================================================

describe('Green Dragonborn Race leaf', () => {
  const greenDragonborn = ACTIVE_RACES.find(race => race.id === 'green_dragonborn')!;

  it('exports exactly one discoverable registration linked to ACTIVE_RACES', () => {
    const discovered = discoverRaceDomainLeaves().filter(leaf => leaf.raceId === greenDragonborn.id);

    expect(discovered).toHaveLength(1);
    expect(RACE_DOMAIN_LEAF.id).toBe('green-dragonborn-resistance-breath');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(greenDragonborn.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(GreenDragonbornRaceLeaf);
    expect(discovered).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('links resistance, shapes, save, scaling, senses, flight, and resource to canonical data', () => {
    const parsed = getCanonicalGreenDragonbornTraits(greenDragonborn)!;
    const baseline = createGreenDragonbornScenario(greenDragonborn);

    expect(hasCanonicalGreenDragonbornRules(greenDragonborn)).toBe(true);
    expect(parsed.resistance).toContain('Poison');
    expect(parsed.breath.saveAbility).toBe('Constitution');
    expect(parsed.breath.damageDice).toBe('1d10');
    expect(parsed.breath.damageType).toBe('Poison');
    expect(parsed.breath.scaling).toContainEqual({ level: 5, dice: '2d10' });
    expect(parsed.breathShapes).toEqual([
      { shape: 'cone', sizeFeet: 15 },
      { shape: 'line', sizeFeet: 30 },
    ]);
    expect(parsed.darkvisionFeet).toBe(60);
    expect(parsed.flightTrait).toContain('Draconic Flight');
    expect(parsed.breathTrait.resources).toContainEqual(expect.objectContaining({
      id: 'green_dragonborn__breath_weapon__resource',
      maxUses: 'proficiency_bonus',
      resetOn: 'long_rest',
    }));

    expect(baseline.actor).toMatchObject({
      class: { id: 'fighter' },
      level: 5,
      resistances: ['Poison'],
    });
    expect(baseline.actor?.abilities.find(ability => ability.id === 'racial_breath_weapon')).toMatchObject({
      areaShape: 'cone',
      areaSize: 3,
      saveAbility: 'Constitution',
      saveDC: 13,
      effects: [{ dice: '2d10', damageType: 'Poison' }],
    });
    expect(baseline.actor?.limitedUses?.[GREEN_DRAGONBORN_BREATH_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
  });

  it('uses native damage mitigation for Poison and leaves acid unchanged', () => {
    const poison = resolveGreenDragonbornResistance(
      createGreenDragonbornScenario(greenDragonborn),
      'poison',
    );
    const acid = resolveGreenDragonbornResistance(
      createGreenDragonbornScenario(greenDragonborn),
      'acid',
    );

    expect(GREEN_DRAGONBORN_RESISTANCE_DAMAGE).toBe(15);
    expect(poison.resistanceFinalDamage).toBe(7);
    expect(poison.outcome).toContain('resistance applied');
    expect(acid.resistanceFinalDamage).toBe(15);
    expect(acid.outcome).toContain('non-poison comparison unchanged');
  });

  it('resolves deterministic cone and line Breath Weapon branches through native helpers', () => {
    const failedCone = resolveGreenDragonbornBreath(
      createGreenDragonbornScenario(greenDragonborn),
      'cone',
      'failed',
    );
    const successfulLine = resolveGreenDragonbornBreath(
      createGreenDragonbornScenario(greenDragonborn),
      'line',
      'successful',
    );

    expect(failedCone.breathRawDamage).toBe(12);
    expect(failedCone.breathFinalDamage).toBe(12);
    expect(failedCone.breathSaveTotal).toBe(5);
    expect(failedCone.actor?.actionEconomy.action.remaining).toBe(0);
    expect(failedCone.actor?.limitedUses?.[GREEN_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(failedCone.target?.currentHP).toBe(0);
    expect(failedCone.target?.damagedThisTurn).toBe(true);
    expect(failedCone.outcome).toContain('15-foot cone');
    expect(failedCone.outcome).toContain('Attack action replaced');

    expect(successfulLine.breathRawDamage).toBe(12);
    expect(successfulLine.breathFinalDamage).toBe(6);
    expect(successfulLine.breathSaveTotal).toBe(24);
    expect(successfulLine.actor?.actionEconomy.action.remaining).toBe(0);
    expect(successfulLine.actor?.limitedUses?.[GREEN_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(successfulLine.target?.currentHP).toBe(6);
    expect(successfulLine.target?.damagedThisTurn).toBe(true);
    expect(successfulLine.outcome).toContain('30-foot line');
    expect(successfulLine.outcome).toContain('AoE placement not claimed');
  });

  it('rejects spent action and depleted resource atomically', () => {
    const first = resolveGreenDragonbornBreath(
      createGreenDragonbornScenario(greenDragonborn),
      'cone',
      'failed',
    );
    const actionRejected = resolveGreenDragonbornBreath(first, 'line', 'successful');

    expect(actionRejected.outcome).toContain('rejected atomically');
    expect(actionRejected.outcome).toContain('Attack action replacement is unavailable');
    expect(actionRejected.actor).toBe(first.actor);
    expect(actionRejected.target).toBe(first.target);
    expect(actionRejected.actor?.limitedUses?.[GREEN_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(actionRejected.target?.currentHP).toBe(first.target?.currentHP);

    const resourceBaseline = createGreenDragonbornScenario(greenDragonborn);
    const baselineActor = resourceBaseline.actor;
    if (!baselineActor) throw new Error('Expected a production Green Dragonborn actor');
    const baselineResource = baselineActor.limitedUses?.[GREEN_DRAGONBORN_BREATH_RESOURCE_ID];
    if (!baselineResource) throw new Error('Expected a canonical Green Dragonborn resource');
    const depletedActor = {
      ...baselineActor,
      limitedUses: {
        ...baselineActor.limitedUses,
        [GREEN_DRAGONBORN_BREATH_RESOURCE_ID]: {
          ...baselineResource,
          current: 0,
        },
      },
    };
    const resourceRejected = resolveGreenDragonbornBreath(
      { ...resourceBaseline, actor: depletedActor },
      'cone',
      'failed',
    );

    expect(resourceRejected.outcome).toContain('rejected atomically');
    expect(resourceRejected.outcome).toContain('no PB-scaled long-rest use remains');
    expect(resourceRejected.actor).toBe(depletedActor);
    expect(resourceRejected.target).toBe(resourceBaseline.target);
    expect(resourceRejected.target?.currentHP).toBe(resourceBaseline.target?.currentHP);
  });

  // ========================================================================
  // Visible Event, Keyed Reset, And Boundary Proof
  // ========================================================================
  // The component publishes native outcomes and parent resetCount restores the
  // complete deterministic baseline rather than only clearing result text.
  // ========================================================================

  it('shows actor/resource facts, publishes receipts, resets, and labels deferred runtime boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <GreenDragonbornRaceLeaf
        race={greenDragonborn}
        state={createRaceDomainScenarioState(greenDragonborn.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('green-dragonborn-canonical-traits')).toHaveTextContent('15-foot cone');
    expect(screen.getByTestId('green-dragonborn-canonical-traits')).toHaveTextContent('30-foot line');
    expect(screen.getByTestId('green-dragonborn-canonical-traits')).toHaveTextContent('Darkvision 60 feet');
    expect(screen.getByTestId('green-dragonborn-actor')).toHaveTextContent('Poison resistance: Poison');
    expect(screen.getByTestId('green-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('green-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');

    fireEvent.click(screen.getByRole('button', { name: /resolve native resistance/i }));
    expect(screen.getByTestId('green-dragonborn-resistance-result')).toHaveTextContent('Final 7');
    expect(events.at(-1)).toContain('Green Dragonborn RESISTANCE POISON');

    fireEvent.click(screen.getByRole('button', { name: /use native breath weapon/i }));
    expect(screen.getByTestId('green-dragonborn-breath-result')).toHaveTextContent('Raw 12');
    expect(screen.getByTestId('green-dragonborn-actor')).toHaveTextContent('Action 0 remaining');
    expect(screen.getByTestId('green-dragonborn-actor')).toHaveTextContent('Breath uses 2/proficiency_bonus');
    expect(screen.getByTestId('green-dragonborn-actor')).toHaveTextContent('Target HP 0/12');
    expect(events.at(-1)).toContain('Green Dragonborn BREATH CONE');

    rerender(
      <GreenDragonbornRaceLeaf
        race={greenDragonborn}
        state={createRaceDomainScenarioState(greenDragonborn.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('green-dragonborn-actor')).toHaveTextContent('Action 1 remaining');
    expect(screen.getByTestId('green-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('green-dragonborn-actor')).toHaveTextContent('Target HP 12/12');
    expect(screen.getByTestId('green-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');
    expect(screen.getByTestId('green-dragonborn-boundary')).toHaveTextContent('map AoE placement');
    expect(screen.getByTestId('green-dragonborn-boundary')).toHaveTextContent('native sense integration');
    expect(screen.getByTestId('green-dragonborn-boundary')).toHaveTextContent('Draconic Flight runtime remain deferred');
  });
});
