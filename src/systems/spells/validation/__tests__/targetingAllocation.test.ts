import { describe, expect, it } from 'vitest';
import { SpellValidator } from '../spellValidator';
import type { Spell } from '../../../../types/spells';
import colorSpray from '../../../../../public/data/spells/level-1/color-spray.json';

/**
 * This file protects the validation bridge for target allocation.
 *
 * The runtime can now reduce an area candidate list through `targeting.allocation`,
 * but the committed 2024-style Sleep and Color Spray rows are currently save-based
 * rather than hit-point-pool based. These tests prove the live validator accepts
 * allocation-ready spell data without forcing that rule onto canonical rows that
 * do not currently describe pool mechanics.
 */

// ============================================================================
// Allocation Schema Acceptance
// ============================================================================
// The test starts from a real spell JSON row so the surrounding spell shape stays
// realistic, then adds a synthetic pool allocation block. This catches schema
// regressions while preserving the untouched source spell as committed data truth.
// ============================================================================

describe('targeting allocation validation', () => {
  it('accepts a spell targeting block with pool allocation metadata', () => {
    const allocationReadySpell = {
      ...colorSpray,
      id: 'schema-proof-color-spray-allocation',
      targeting: {
        ...colorSpray.targeting,
        allocation: {
          type: 'pool',
          pool: {
            resource: 'hp',
            dice: '6d10',
            sortOrder: 'ascending',
            strictLimit: true,
            scaling: {
              type: 'slot_level',
              scalingTiers: {
                '2': '8d10',
                '3': '10d10'
              }
            }
          }
        }
      }
    } as unknown as Spell;

    const result = SpellValidator.safeParse(allocationReadySpell);

    // This proves the validator, not just the TypeScript type, can accept the
    // allocation shape that TargetResolver and TargetAllocator now consume.
    expect(result.success).toBe(true);
  });

  it('leaves the committed Color Spray row save-based unless canonical data changes', () => {
    // This guard documents the migration decision from the current data: Color
    // Spray now says each creature makes a Constitution save, so adding HP-pool
    // allocation to the real JSON would be a mechanics rewrite rather than a
    // faithful migration.
    expect(colorSpray.targeting).not.toHaveProperty('allocation');
    expect(colorSpray.description).toContain('Constitution saving throw');
  });
});
