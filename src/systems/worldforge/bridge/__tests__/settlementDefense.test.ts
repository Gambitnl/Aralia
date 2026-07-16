/**
 * This file proves that settlement defenses come from the generated atlas.
 *
 * The fixed Legium assertions guard the exact state, regiment, troop count, and
 * composition used by the battle-map scenario. If WorldForge generation changes
 * those facts, the tactical fixture must be reviewed instead of quietly keeping
 * an obsolete hand-authored guard roster.
 *
 * Covers: settlementDefenseForBurg
 */
import { describe, expect, it } from 'vitest';
import { settlementDefenseForBurg } from '../settlementDefense';

// ============================================================================
// Generated Settlement Defense Facts
// ============================================================================

describe('settlementDefenseForBurg', () => {
  it('retains Legium state identity and every regiment stationed in its source cell', () => {
    const defense = settlementDefenseForBurg(42, 14);

    expect(defense).toMatchObject({
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
    });
    expect(defense?.stationedRegiments).toEqual([
      expect.objectContaining({
        sourceIndex: 0,
        name: '1st (Legium) Regiment',
        totalTroops: 4565,
        sourceCellId: 829,
        naval: false,
        units: [
          { unitType: 'archers', count: 2299 },
          { unitType: 'artillery', count: 61 },
          { unitType: 'cavalry', count: 323 },
          { unitType: 'infantry', count: 1882 },
        ],
      }),
      expect.objectContaining({
        sourceIndex: 1,
        name: '1st Fleet',
        totalTroops: 15,
        naval: true,
        units: [{ unitType: 'fleet', count: 15 }],
      }),
    ]);
  });

  it('does not fabricate a defense for an unknown burg', () => {
    expect(settlementDefenseForBurg(42, 999_999)).toBeNull();
  });
});
