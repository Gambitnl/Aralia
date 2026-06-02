
import { describe, it, expect, vi } from 'vitest';
import { applyRacialSpellGrantsByLevel } from '../characterUtils';
import { createMockPlayerCharacter } from '../../core/factories';

// Mock the library to isolate the test and control the trait data
vi.mock('../../../data/races', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getRacialTraitLibrary: () => ({
      byRaceId: {
        'test-race': [
          {
            type: 'resource',
            sourceRaceId: 'test-race',
            sourceRaceName: 'Test Race',
            traitName: 'Test Resource',
            traitDescription: 'Desc',
            minLevel: 1,
            resources: [
              { id: 'test_res', maxUses: 1, resetOn: 'long_rest' }
            ]
          }
        ]
      },
      byChoiceRaceId: {},
      byActivationWindow: {}
    }),
  }
});

describe('RM-CRASH-001 Regression', () => {
  it('should not crash when a race has resources but no spell grants', () => {
    const character = createMockPlayerCharacter({
      race: { id: 'test-race', name: 'Test Race', traits: [], abilityBonuses: [] } as any,
      level: 1,
      spellbook: undefined, // No spellbook
      limitedUses: undefined // Force it to be undefined to trigger the empty init
    });

    // This would have crashed before the fix because next.limitedUses was being set to undefined
    // at line 935 if no spell grants were processed, before the resource loop at line 1034.
    
    let updated;
    expect(() => {
      updated = applyRacialSpellGrantsByLevel(character, 1);
    }).not.toThrow();
    
    expect(updated).toBeDefined();
    expect(updated!.limitedUses).toBeDefined();
    expect(updated!.limitedUses!['racial_feature_test_res']).toBeDefined();
    expect(updated!.limitedUses!['racial_feature_test_res'].name).toContain('Test Resource');
  });
});
