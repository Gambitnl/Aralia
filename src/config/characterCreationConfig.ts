/**
 * @file src/config/characterCreationConfig.ts
 * Centralizes configuration variables for the character creation process.
 */

// Point Buy System Constants
export const POINT_BUY_TOTAL_POINTS = 27;
export const POINT_BUY_MIN_SCORE = 8;
export const POINT_BUY_MAX_SCORE = 15;
export const ABILITY_SCORE_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};
