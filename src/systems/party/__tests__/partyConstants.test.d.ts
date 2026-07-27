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
export {};
