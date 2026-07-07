/**
 * @file encounterBudget.ts
 * @description 5e-flavored per-room encounter XP budget for the dungeon
 * generator. Pure data, zero rng, zero THREE — mirrors the contract of
 * bestiaryTable.ts (static + synchronous).
 *
 * WHY THIS EXISTS
 * ---------------
 * The original spawn resolver sized counts by raw area (`round(area/24 ×
 * (0.5+difficulty))`) and ignored `partyLevel` entirely — a 20-room crypt could
 * stamp 37 ghouls (8100 XP) with no encounter budget at all. The original
 * acceptance criterion demands: every room's total (multiplier-adjusted) XP sits
 * within ±20% of a difficulty-derived budget for `partyLevel`. This module owns
 * that budget math; generateDungeon consumes it to fill rooms.
 *
 * THE FORMULA
 * -----------
 * 1. Party assumption: a standard party of {@link ASSUMED_PARTY_SIZE} = 4
 *    characters, all at `partyLevel`.
 * 2. Per-character 5e XP thresholds (2014 DMG p.82) give four rungs — easy /
 *    medium / hard / deadly — for levels 1–10 (hardcoded {@link THRESHOLDS}).
 *    Party rung = per-character rung × 4.
 * 3. A room's `difficulty` (0.15 shallow → 1.0 boss) is mapped onto those rungs
 *    by piecewise-linear interpolation ({@link roomBudget}):
 *      difficulty 0.15 → ~easy
 *      difficulty 0.60 → ~medium-hard (between medium and hard)
 *      difficulty 1.00 → deadly
 *    So a shallow guard post asks an easy budget and the approach to the boss
 *    asks a deadly one, all scaled to the party's level.
 *
 * The budget is the *adjusted* (post-multiplier) XP target: generateDungeon
 * applies the standard mob multiplier (1×, 1.5×, 2×, …) when it checks a room's
 * running adjusted total against `budget × 1.2`, so mob counts stay honest —
 * 37 ghouls can never fit any sane budget.
 */

/** Assumed party size for budget scaling (5e default four-person party). */
export const ASSUMED_PARTY_SIZE = 4;

interface Thresholds { easy: number; medium: number; hard: number; deadly: number; }

/**
 * Per-CHARACTER 5e encounter XP thresholds, 2014 DMG p.82. Index = character
 * level. Levels 1–10 are the band this generator targets (CR 0–3 bestiary);
 * levels above 10 clamp to the level-10 row (documented; no dungeon here spawns
 * above CR 5). Index 0 is a zero row so `partyLevel` 0 never divides by a live
 * threshold.
 */
const THRESHOLDS: Thresholds[] = [
  /* 0  */ { easy: 0,   medium: 0,   hard: 0,   deadly: 0 },
  /* 1  */ { easy: 25,  medium: 50,  hard: 75,  deadly: 100 },
  /* 2  */ { easy: 50,  medium: 100, hard: 150, deadly: 200 },
  /* 3  */ { easy: 75,  medium: 150, hard: 225, deadly: 400 },
  /* 4  */ { easy: 125, medium: 250, hard: 375, deadly: 500 },
  /* 5  */ { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  /* 6  */ { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  /* 7  */ { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  /* 8  */ { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  /* 9  */ { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  /* 10 */ { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
];

/** Clamp a party level into the table's supported band [0, 10]. */
function levelRow(partyLevel: number): Thresholds {
  const lvl = Math.max(0, Math.min(10, Math.floor(partyLevel)));
  return THRESHOLDS[lvl];
}

/**
 * Per-room ADJUSTED-XP budget for a party of {@link ASSUMED_PARTY_SIZE} at
 * `partyLevel`, interpolated by room `difficulty` (0..1).
 *
 * Difficulty anchors (piecewise-linear between them):
 *   ≤ 0.15 → easy
 *     0.60 → halfway between medium and hard
 *     1.00 → deadly
 * Below 0.15 clamps to easy; above 1.0 clamps to deadly. The returned value is
 * the PARTY budget (per-character rung × ASSUMED_PARTY_SIZE), i.e. the target the
 * caller compares a room's multiplier-adjusted spawn XP against.
 */
export function roomBudget(partyLevel: number, difficulty: number): number {
  const t = levelRow(partyLevel);
  const easy = t.easy * ASSUMED_PARTY_SIZE;
  const medium = t.medium * ASSUMED_PARTY_SIZE;
  const hard = t.hard * ASSUMED_PARTY_SIZE;
  const deadly = t.deadly * ASSUMED_PARTY_SIZE;

  const d = Math.max(0, Math.min(1, difficulty));
  // Piecewise-linear over the three anchor segments.
  const mediumHard = (medium + hard) / 2;
  if (d <= 0.15) return easy;
  if (d <= 0.6) {
    // easy → medium-hard across [0.15, 0.6]
    const f = (d - 0.15) / (0.6 - 0.15);
    return easy + (mediumHard - easy) * f;
  }
  // medium-hard → deadly across [0.6, 1.0]
  const f = (d - 0.6) / (1.0 - 0.6);
  return mediumHard + (deadly - mediumHard) * f;
}

/**
 * Standard 5e encounter multiplier for a monster count (2014 DMG p.82). Used to
 * convert raw summed XP into ADJUSTED XP when checking a room against its budget,
 * so many weak mobs cost what they should (a swarm is deadlier than its raw sum).
 */
export function encounterMultiplier(monsterCount: number): number {
  if (monsterCount <= 1) return 1;
  if (monsterCount === 2) return 1.5;
  if (monsterCount <= 6) return 2;
  if (monsterCount <= 10) return 2.5;
  if (monsterCount <= 14) return 3;
  return 4;
}
