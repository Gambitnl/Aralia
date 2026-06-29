import { describe, it, expect } from 'vitest';
import { assembleSelectedFeats } from '../useCharacterAssembly';
import { initialCharacterCreatorState } from '../../state/characterCreatorState';

describe('assembleSelectedFeats', () => {
  it('returns both feats when the origin and racial slots differ', () => {
    const state = {
      ...initialCharacterCreatorState,
      backgroundFeatId: 'alert',
      racialFeatId: 'tough',
    };

    expect(assembleSelectedFeats(state)).toEqual(['alert', 'tough']);
  });

  it('dedupes when the same feat lands in both slots (invalid-character guard)', () => {
    // Before the fix, the origin and racial feat slots shared one eligibility list,
    // so the same feat could be selected twice and assemble into an invalid character.
    const state = {
      ...initialCharacterCreatorState,
      backgroundFeatId: 'alert',
      racialFeatId: 'alert',
    };

    expect(assembleSelectedFeats(state)).toEqual(['alert']);
  });

  it('omits empty slots', () => {
    const state = {
      ...initialCharacterCreatorState,
      backgroundFeatId: 'alert',
      racialFeatId: null,
    };

    expect(assembleSelectedFeats(state)).toEqual(['alert']);
  });
});
