import { describe, it, expect } from 'vitest';
import { cellKey, EXTERIOR } from '../blueprintTypes';

describe('blueprintTypes', () => {
  it('cellKey is stable and unique', () => {
    expect(cellKey(2, 3)).toBe('2,3');
    expect(cellKey(2, 3)).not.toBe(cellKey(3, 2));
  });
  it('EXTERIOR sentinel is -1', () => { expect(EXTERIOR).toBe(-1); });
});
