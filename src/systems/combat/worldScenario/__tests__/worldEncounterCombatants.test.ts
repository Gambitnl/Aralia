/**
 * This file proves that projected regiment roles become real combat actors.
 *
 * It loads the same bestiary registry used by production encounters, then
 * verifies stable names, source receipts, and actual Guard/Scout mechanics.
 * This prevents the visual scenario from quietly falling back to the old demo
 * enemies when a bestiary bridge changes.
 *
 * Covers: createWorldDefenderCombatants
 */
import { describe, expect, it } from 'vitest';
import type { BattleMapDefendingForce } from '@/types/combat';
import { createWorldDefenderCombatants } from '../worldEncounterCombatants';

// ============================================================================
// Projected Force Fixture
// ============================================================================

const FORCE: BattleMapDefendingForce = {
  source: {
    kind: 'worldforge-state-regiment',
    burgId: 14,
    burgName: 'Legium',
    stateId: 14,
    stateName: 'Turino',
    stateFullName: 'Grand Duchy of Turino',
    stateForm: 'Monarchy',
    stateAlert: 4.25,
    regimentIndex: 0,
    regimentName: '1st (Legium) Regiment',
    regimentTroops: 4565,
    sourceCellId: 829,
  },
  projection: {
    kind: 'gate-patrol-alert-sample-v1',
    tacticalActorBudget: 4,
    tacticalActors: 4,
    units: [
      {
        sourceUnitType: 'archers',
        sourceTroops: 2299,
        tacticalActors: 2,
        bestiaryName: 'Scout',
        roleLabel: 'Archer',
      },
      {
        sourceUnitType: 'infantry',
        sourceTroops: 1882,
        tacticalActors: 2,
        bestiaryName: 'Guard',
        roleLabel: 'Infantry',
      },
    ],
    excludedUnits: [],
    hostility: {
      rule: 'explicit-trigger-plus-matching-relation-v1',
      verdict: 'hostile',
      trigger: {
        kind: 'watch-confrontation',
        source: 'player-interaction',
        sourceId: 'test:legium-watch',
        locationId: 'cell_829',
        summary: 'Legium watch confronts a wanted party.',
      },
      relation: {
        kind: 'wanted-in-location',
        source: 'player-crime-state',
        locationId: 'cell_829',
        witnessedCrimeIds: ['crime:legium-assault'],
      },
      detail: 'Matching watch confrontation and witnessed local crime authorize combat.',
    },
  },
};

// ============================================================================
// Runtime Bestiary Bridge
// ============================================================================

describe('createWorldDefenderCombatants', () => {
  it('creates stable sourced enemies with real ranged and infantry abilities', async () => {
    const combatants = await createWorldDefenderCombatants(FORCE);

    expect(combatants.map((combatant) => combatant.name)).toEqual([
      'Turino Archer 1',
      'Turino Archer 2',
      'Turino Infantry 1',
      'Turino Infantry 2',
    ]);
    expect(combatants.map((combatant) => combatant.id)).toEqual([
      'worldforge-defender:14:0:archers:1',
      'worldforge-defender:14:0:archers:2',
      'worldforge-defender:14:0:infantry:1',
      'worldforge-defender:14:0:infantry:2',
    ]);
    expect(combatants.every((combatant) => combatant.team === 'enemy')).toBe(true);
    expect(combatants.every((combatant) => combatant.worldSource?.stateId === 14)).toBe(true);
    // The canonical Scout stat block uses a longbow; the source role remains
    // "archers" without narrowing the generated regiment to one weapon model.
    expect(combatants[0].abilities.some((ability) => ability.name.toLowerCase().includes('longbow')))
      .toBe(true);
    expect(combatants[2].abilities.some((ability) => ability.name.toLowerCase().includes('spear')))
      .toBe(true);
  }, 30_000);

  it('returns no enemies when a scenario has no source defending force', async () => {
    await expect(createWorldDefenderCombatants(undefined)).resolves.toEqual([]);
  });

  it('keeps a projected regiment out of the enemy team when combat is withheld', async () => {
    const contextualForce: BattleMapDefendingForce = {
      ...FORCE,
      projection: {
        ...FORCE.projection,
        hostility: {
          rule: 'explicit-trigger-plus-matching-relation-v1',
          verdict: 'withhold-combat',
          trigger: { kind: 'none', source: 'none', summary: 'No confrontation.' },
          relation: { kind: 'none', source: 'none', detail: 'No relation evaluated.' },
          detail: 'Military presence remains context only.',
        },
      },
    };

    await expect(createWorldDefenderCombatants(contextualForce)).resolves.toEqual([]);
  });
});
