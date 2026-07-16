/**
 * This file verifies the explicit regiment-to-gate-patrol conversion policy.
 *
 * The test keeps atlas troop counts separate from tactical actor counts and
 * proves that mounted and siege roles remain visible omissions. That prevents
 * a future UI change from making the patrol look source-authored while silently
 * replacing unsupported military roles with generic enemies.
 *
 * Covers: projectSettlementDefendingForce
 */
import { describe, expect, it } from 'vitest';
import type { GroundSettlementDefense } from '@/systems/worldforge/bridge/settlementDefense';
import { projectSettlementDefendingForce } from '../settlementDefenderProjection';

// ============================================================================
// Fixed Defense Fixtures
// ============================================================================

const LEGION_DEFENSE: GroundSettlementDefense = {
  burgId: 14,
  burgName: 'Legium',
  sourceCellId: 829,
  stateId: 14,
  stateName: 'Turino',
  stateFullName: 'Grand Duchy of Turino',
  stateForm: 'Monarchy',
  stateAlert: 4.25,
  capital: true,
  walled: true,
  citadel: true,
  stationedRegiments: [{
    sourceIndex: 0,
    name: '1st (Legium) Regiment',
    totalTroops: 4565,
    sourceCellId: 829,
    sourceAtlasPoint: { x: 644.97, y: 147.84 },
    naval: false,
    units: [
      { unitType: 'archers', count: 2299 },
      { unitType: 'artillery', count: 61 },
      { unitType: 'cavalry', count: 323 },
      { unitType: 'infantry', count: 1882 },
    ],
  }],
};

// ============================================================================
// Projection Policy
// ============================================================================

describe('projectSettlementDefendingForce', () => {
  it('uses generated alert and regiment composition for a deterministic four-actor patrol', () => {
    const force = projectSettlementDefendingForce(LEGION_DEFENSE);

    expect(force).toMatchObject({
      source: {
        stateName: 'Turino',
        regimentName: '1st (Legium) Regiment',
        regimentTroops: 4565,
        stateAlert: 4.25,
      },
      projection: {
        kind: 'gate-patrol-alert-sample-v1',
        tacticalActorBudget: 4,
        tacticalActors: 4,
        hostility: {
          verdict: 'withhold-combat',
          trigger: { kind: 'none' },
          relation: { kind: 'none' },
        },
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
        excludedUnits: [
          {
            sourceUnitType: 'artillery',
            sourceTroops: 61,
            reason: 'not-gate-patrol-role',
          },
          {
            sourceUnitType: 'cavalry',
            sourceTroops: 323,
            reason: 'not-gate-patrol-role',
          },
        ],
      },
    });
  });

  it('does not invent a land patrol from a naval-only station', () => {
    const navalOnly: GroundSettlementDefense = {
      ...LEGION_DEFENSE,
      stationedRegiments: [{
        ...LEGION_DEFENSE.stationedRegiments[0],
        name: '1st Fleet',
        naval: true,
        units: [{ unitType: 'fleet', count: 15 }],
      }],
    };

    expect(projectSettlementDefendingForce(navalOnly)).toBeUndefined();
  });
});
