/**
 * Unit tests for party count helpers + the optional soft cap.
 *
 * Validates that:
 *   - SOFT_PARTY_CAP is a positive advisory threshold.
 *   - partyCount tolerates null/undefined and reflects array length.
 *   - isOverSoftCap is a pure UI hint (strictly-greater than the cap).
 *
 * Runs on: vitest.
 * Depends on: partyConstants (pure module, no state).
 */

import { describe, it, expect } from 'vitest';
import { SOFT_PARTY_CAP, partyCount, isOverSoftCap } from '../partyConstants';

// Minimal stand-in objects — helpers only read `.length`, so we avoid
// constructing full PlayerCharacter fixtures.
const makeParty = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}` }) as any);

describe('partyConstants', () => {
  describe('SOFT_PARTY_CAP', () => {
    it('is a positive integer advisory threshold', () => {
      expect(Number.isInteger(SOFT_PARTY_CAP)).toBe(true);
      expect(SOFT_PARTY_CAP).toBeGreaterThan(0);
    });
  });

  describe('partyCount', () => {
    it('returns 0 for null', () => {
      expect(partyCount(null)).toBe(0);
    });

    it('returns 0 for undefined', () => {
      expect(partyCount(undefined)).toBe(0);
    });

    it('returns 0 for an empty party', () => {
      expect(partyCount(makeParty(0))).toBe(0);
    });

    it('returns the number of members', () => {
      expect(partyCount(makeParty(3))).toBe(3);
    });
  });

  describe('isOverSoftCap', () => {
    it('is false at the cap (boundary is inclusive — not over)', () => {
      expect(isOverSoftCap(makeParty(SOFT_PARTY_CAP))).toBe(false);
    });

    it('is false below the cap', () => {
      expect(isOverSoftCap(makeParty(SOFT_PARTY_CAP - 1))).toBe(false);
    });

    it('is true above the cap', () => {
      expect(isOverSoftCap(makeParty(SOFT_PARTY_CAP + 1))).toBe(true);
    });

    it('is false for null/undefined (count 0)', () => {
      expect(isOverSoftCap(null)).toBe(false);
      expect(isOverSoftCap(undefined)).toBe(false);
    });
  });
});
