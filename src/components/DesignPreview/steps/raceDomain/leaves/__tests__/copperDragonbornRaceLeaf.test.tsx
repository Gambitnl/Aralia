import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import { discoverRaceDomainLeaves } from '../../raceDomainRegistry';
import {
  COPPER_DRAGONBORN_BREATH_RESOURCE_ID,
  COPPER_DRAGONBORN_RESISTANCE_DAMAGE,
  CopperDragonbornRaceLeaf,
  RACE_DOMAIN_LEAF,
  createCopperDragonbornScenario,
  getCanonicalCopperDragonbornTraits,
  hasCanonicalCopperDragonbornRules,
  resolveCopperDragonbornBreath,
  resolveCopperDragonbornResistance,
} from '../copperDragonbornRaceLeaf';

/**
 * This file proves Copper Dragonborn against canonical data, production actor
 * assembly, and native combat/save helpers.
 *
 * The tests cover identity and discovery, acid resistance, level 5 scaling,
 * deterministic failed and successful saves, save-half damage, action/resource
 * atomicity, keyed reset, visible events, and the unsupported Flight boundary.
 * Parent-owned mounted 2D/3D proof remains outside this focused leaf suite.
 */

// ============================================================================
// Canonical Link And Native Mechanic Proof
// ============================================================================
// These tests protect the source link and real resolver outcomes before a
// browser integration pass inspects the mounted Race domain.
// ============================================================================

describe('Copper Dragonborn Race leaf', () => {
  const copperDragonborn = ACTIVE_RACES.find(race => race.id === 'copper_dragonborn')!;

  it('exports one discoverable registration linked to ACTIVE_RACES', () => {
    // Automatic discovery must find this leaf without a sibling import or alias.
    expect(RACE_DOMAIN_LEAF.id).toBe('copper-dragonborn-resistance-breath');
    expect(RACE_DOMAIN_LEAF.raceId).toBe(copperDragonborn.id);
    expect(RACE_DOMAIN_LEAF.Component).toBe(CopperDragonbornRaceLeaf);
    expect(discoverRaceDomainLeaves()).toContainEqual(RACE_DOMAIN_LEAF);
  });

  it('links resistance, shapes, save, level 5 scaling, and resource to canonical data', () => {
    // Canonical parser output is the authority for all values shown by the leaf.
    const parsed = getCanonicalCopperDragonbornTraits(copperDragonborn)!;
    expect(hasCanonicalCopperDragonbornRules(copperDragonborn)).toBe(true);
    expect(parsed.resistance).toContain('Acid');
    expect(parsed.breath.saveAbility).toBe('Constitution');
    expect(parsed.breath.damageDice).toBe('1d10');
    expect(parsed.breath.scaling).toContainEqual({ level: 5, dice: '2d10' });
    expect(parsed.breathShapes).toEqual([
      { shape: 'cone', sizeFeet: 15 },
      { shape: 'line', sizeFeet: 30 },
    ]);
    expect(parsed.breathTrait.resources).toContainEqual(expect.objectContaining({
      id: 'copper_dragonborn__breath_weapon__resource',
      maxUses: 'proficiency_bonus',
      resetOn: 'long_rest',
    }));

    // The native actor must expose the level 5 2d10 ability, DC, and PB uses.
    const baseline = createCopperDragonbornScenario(copperDragonborn);
    expect(baseline.actor).toMatchObject({ class: { id: 'fighter' }, level: 5, resistances: ['Acid'] });
    expect(baseline.actor?.abilities.find(ability => ability.id === 'racial_breath_weapon')).toMatchObject({
      areaShape: 'cone',
      areaSize: 3,
      saveAbility: 'Constitution',
      saveDC: 13,
      effects: [{ dice: '2d10', damageType: 'Acid' }],
    });
    expect(baseline.actor?.limitedUses?.[COPPER_DRAGONBORN_BREATH_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
  });

  it('uses native damage mitigation for acid and leaves fire unchanged', () => {
    // The same 15 damage packet proves the native resistance path reduces acid
    // to 7 while a non-acid comparison remains 15.
    const acid = resolveCopperDragonbornResistance(createCopperDragonbornScenario(copperDragonborn), 'acid');
    const fire = resolveCopperDragonbornResistance(createCopperDragonbornScenario(copperDragonborn), 'fire');
    expect(COPPER_DRAGONBORN_RESISTANCE_DAMAGE).toBe(15);
    expect(acid.resistanceFinalDamage).toBe(7);
    expect(acid.outcome).toContain('resistance applied');
    expect(fire.resistanceFinalDamage).toBe(15);
    expect(fire.outcome).toContain('non-acid comparison unchanged');
  });

  it('resolves failed and successful breath saves through native action/save/damage helpers', () => {
    // Failed save keeps all 12 points; successful save uses native save-half and
    // reduces the same deterministic 2d10 roll to 6 points.
    const failedCone = resolveCopperDragonbornBreath(
      createCopperDragonbornScenario(copperDragonborn),
      'cone',
      'failed',
    );
    const successfulLine = resolveCopperDragonbornBreath(
      createCopperDragonbornScenario(copperDragonborn),
      'line',
      'successful',
    );
    expect(failedCone.breathRawDamage).toBe(12);
    expect(failedCone.breathFinalDamage).toBe(12);
    expect(failedCone.breathSaveTotal).toBe(5);
    expect(failedCone.actor?.actionEconomy.action.remaining).toBe(0);
    expect(failedCone.actor?.limitedUses?.[COPPER_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(failedCone.outcome).toContain('15-foot cone');
    expect(failedCone.outcome).toContain('DC 13 Constitution save failed');
    expect(successfulLine.breathRawDamage).toBe(12);
    expect(successfulLine.breathFinalDamage).toBe(6);
    expect(successfulLine.breathSaveTotal).toBe(24);
    expect(successfulLine.outcome).toContain('30-foot line');
    expect(successfulLine.outcome).toContain('AoE placement not claimed');
  });

  it('rejects a repeat breath atomically after action payment', () => {
    // A second attempt must preserve the first actor, target, HP, and resource
    // state rather than partially consuming another use.
    const first = resolveCopperDragonbornBreath(
      createCopperDragonbornScenario(copperDragonborn),
      'cone',
      'failed',
    );
    const rejected = resolveCopperDragonbornBreath(first, 'line', 'successful');
    expect(rejected.outcome).toContain('rejected atomically');
    expect(rejected.outcome).toContain('Attack action replacement is unavailable');
    expect(rejected.actor).toBe(first.actor);
    expect(rejected.target).toBe(first.target);
    expect(rejected.actor?.limitedUses?.[COPPER_DRAGONBORN_BREATH_RESOURCE_ID]?.current).toBe(2);
    expect(rejected.target?.currentHP).toBe(first.target?.currentHP);
  });

  // ========================================================================
  // Visible Event, Keyed Reset, And Boundary Proof
  // ========================================================================
  // The component must publish native results and restore its full scenario
  // baseline when the parent changes resetCount.
  // ========================================================================

  it('shows actor/resource facts, publishes events, resets, and labels Flight boundary', () => {
    // Render the leaf as the Race domain parent does, retaining its event log.
    const events: string[] = [];
    const { rerender } = render(
      <CopperDragonbornRaceLeaf
        race={copperDragonborn}
        state={createRaceDomainScenarioState(copperDragonborn.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );
    expect(screen.getByTestId('copper-dragonborn-canonical-traits')).toHaveTextContent('15-foot cone');
    expect(screen.getByTestId('copper-dragonborn-canonical-traits')).toHaveTextContent('30-foot line');
    expect(screen.getByTestId('copper-dragonborn-actor')).toHaveTextContent('Acid resistance: Acid');
    expect(screen.getByTestId('copper-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('copper-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');

    // Visible controls must report the same native results the pure resolver returns.
    fireEvent.click(screen.getByRole('button', { name: /resolve native resistance/i }));
    expect(screen.getByTestId('copper-dragonborn-resistance-result')).toHaveTextContent('Final 7');
    expect(events.at(-1)).toContain('Copper Dragonborn RESISTANCE ACID');
    fireEvent.click(screen.getByRole('button', { name: /use native breath weapon/i }));
    expect(screen.getByTestId('copper-dragonborn-breath-result')).toHaveTextContent('Raw 12');
    expect(screen.getByTestId('copper-dragonborn-outcome')).toHaveTextContent('Native Breath Weapon resolved');
    expect(events.at(-1)).toContain('Copper Dragonborn BREATH CONE');

    // A keyed reset restores action, resource, result, and the explicit boundary.
    rerender(
      <CopperDragonbornRaceLeaf
        race={copperDragonborn}
        state={createRaceDomainScenarioState(copperDragonborn.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );
    expect(screen.getByTestId('copper-dragonborn-actor')).toHaveTextContent('Action 1 remaining');
    expect(screen.getByTestId('copper-dragonborn-actor')).toHaveTextContent('Breath uses 3/proficiency_bonus');
    expect(screen.getByTestId('copper-dragonborn-breath-result')).toHaveTextContent('Raw not resolved');
    expect(screen.getByTestId('copper-dragonborn-boundary')).toHaveTextContent('AoE targeting/placement is not claimed');
    expect(screen.getByTestId('copper-dragonborn-boundary')).toHaveTextContent('race feature rather than a spell');
    expect(screen.getByTestId('copper-dragonborn-boundary')).toHaveTextContent('Draconic Flight is unsupported');
  });
});
