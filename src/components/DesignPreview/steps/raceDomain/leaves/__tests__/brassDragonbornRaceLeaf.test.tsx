import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  BRASS_DRAGONBORN_BREATH_RESOURCE_ID,
  BRASS_DRAGONBORN_RESISTANCE_DAMAGE,
  BrassDragonbornRaceLeaf,
  RACE_DOMAIN_LEAF,
  createBrassDragonbornScenario,
  getCanonicalBrassDragonbornTraits,
  hasCanonicalBrassDragonbornRules,
  resolveBrassDragonbornBreath,
  resolveBrassDragonbornResistance,
} from '../brassDragonbornRaceLeaf';

/**
 * This file proves the Brass Dragonborn leaf against canonical ACTIVE_RACES,
 * production character assembly, and native combat/save helpers.
 *
 * It covers fire resistance and a non-fire comparison, canonical Breath Weapon
 * scaling/resource facts, deterministic save and damage branches, atomic
 * rejection, visible event/reset state, and the explicit no-AoE and Draconic
 * Flight boundaries. Parent-owned mounted 2D/3D proof is separate.
 */

// ============================================================================
// Canonical Link And Native Mechanic Proof
// ============================================================================
// These tests protect the source link and real resolver outcomes before the
// parent performs a mounted Race-domain integration pass.
// ============================================================================

describe('Brass Dragonborn Race leaf', () => {
  const brassDragonborn = ACTIVE_RACES.find(race => race.id === 'brass_dragonborn')!;

  it('exports exactly one discoverable registration linked to ACTIVE_RACES', () => {
    expect(RACE_DOMAIN_LEAF.id).toBe('brass-dragonborn-resistance-breath');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(brassDragonborn.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(BrassDragonbornRaceLeaf);
    expect(discoverRaceDomainLeaves().filter(leaf => leaf.raceId === 'brass_dragonborn')).toEqual([RACE_DOMAIN_LEAF]);
  });

  it('links Brass resistance, shapes, save, scaling, and resource to canonical parser output', () => {
    const parsed = getCanonicalBrassDragonbornTraits(brassDragonborn)!;

    expect(hasCanonicalBrassDragonbornRules(brassDragonborn)).toBe(true);
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
      id: 'brass_dragonborn__breath_weapon__resource',
      maxUses: 'proficiency_bonus',
      resetOn: 'long_rest',
    }));

    const baseline = createBrassDragonbornScenario(brassDragonborn);
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
    expect(baseline.actor?.limitedUses?.[BRASS_DRAGONBORN_BREATH_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
  });

  it('uses native damage mitigation for fire and leaves acid unchanged', () => {
    const fire = resolveBrassDragonbornResistance(createBrassDragonbornScenario(brassDragonborn), 'fire');
    const acid = resolveBrassDragonbornResistance(createBrassDragonbornScenario(brassDragonborn), 'acid');

    expect(BRASS_DRAGONBORN_RESISTANCE_DAMAGE).toBe(15);
    expect(fire.resistanceFinalDamage).toBe(7);
    expect(fire.outcome).toContain('resistance applied');
    expect(acid.resistanceFinalDamage).toBe(15);
    expect(acid.outcome).toContain('non-fire comparison unchanged');
  });

  it('resolves deterministic cone and line breath branches through native helpers', () => {
    const failedCone = resolveBrassDragonbornBreath(
      createBrassDragonbornScenario(brassDragonborn),
      'cone',
      'failed',
    );
    const successfulLine = resolveBrassDragonbornBreath(
      createBrassDragonbornScenario(brassDragonborn),
      'line',
      'successful',
    );

    expect(failedCone.breathRawDamage).toBe(12);
    expect(failedCone.breathFinalDamage).toBe(12);
    expect(failedCone.breathSaveTotal).toBe(5);
    expect(failedCone.actor?.actionEconomy.action.remaining).toBe(0);
    expect(failedCone.actor?.limitedUses?.[BRASS_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(failedCone.outcome).toContain('15-foot cone');
    expect(failedCone.outcome).toContain('Attack action replaced');

    expect(successfulLine.breathRawDamage).toBe(12);
    expect(successfulLine.breathFinalDamage).toBe(6);
    expect(successfulLine.breathSaveTotal).toBe(24);
    expect(successfulLine.outcome).toContain('30-foot line');
    expect(successfulLine.outcome).toContain('AoE placement not claimed');
  });

  it('rejects a second breath atomically after the Attack action is spent', () => {
    const first = resolveBrassDragonbornBreath(
      createBrassDragonbornScenario(brassDragonborn),
      'cone',
      'failed',
    );
    const rejected = resolveBrassDragonbornBreath(first, 'line', 'successful');

    expect(rejected.outcome).toContain('rejected atomically');
    expect(rejected.outcome).toContain('Attack action replacement is unavailable');
    expect(rejected.actor).toBe(first.actor);
    expect(rejected.target).toBe(first.target);
    expect(rejected.actor?.limitedUses?.[BRASS_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
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
      <BrassDragonbornRaceLeaf
        race={brassDragonborn}
        state={createRaceDomainScenarioState(brassDragonborn.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('brass-dragonborn-canonical-traits')).toHaveTextContent('15-foot cone');
    expect(screen.getByTestId('brass-dragonborn-canonical-traits')).toHaveTextContent('30-foot line');
    expect(screen.getByTestId('brass-dragonborn-actor')).toHaveTextContent('Fire resistance: Fire');
    expect(screen.getByTestId('brass-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('brass-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');

    fireEvent.click(screen.getByRole('button', { name: /resolve native resistance/i }));
    expect(screen.getByTestId('brass-dragonborn-resistance-result')).toHaveTextContent('Final 7');
    expect(events.at(-1)).toContain('Brass Dragonborn RESISTANCE FIRE');

    fireEvent.click(screen.getByRole('button', { name: /use native breath weapon/i }));
    expect(screen.getByTestId('brass-dragonborn-breath-result')).toHaveTextContent('Raw 12');
    expect(screen.getByTestId('brass-dragonborn-outcome')).toHaveTextContent('Native Breath Weapon resolved');
    expect(events.at(-1)).toContain('Brass Dragonborn BREATH CONE');

    rerender(
      <BrassDragonbornRaceLeaf
        race={brassDragonborn}
        state={createRaceDomainScenarioState(brassDragonborn.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('brass-dragonborn-actor')).toHaveTextContent('Action 1 remaining');
    expect(screen.getByTestId('brass-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('brass-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');
    expect(screen.getByTestId('brass-dragonborn-boundary')).toHaveTextContent('AoE targeting/placement is not claimed');
    expect(screen.getByTestId('brass-dragonborn-boundary')).toHaveTextContent('Draconic Flight remains an explicit deferred boundary');
  });
});
