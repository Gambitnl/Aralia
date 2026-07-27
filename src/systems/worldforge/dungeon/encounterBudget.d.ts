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
export declare const ASSUMED_PARTY_SIZE = 4;
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
export declare function roomBudget(partyLevel: number, difficulty: number): number;
/**
 * Standard 5e encounter multiplier for a monster count (2014 DMG p.82). Used to
 * convert raw summed XP into ADJUSTED XP when checking a room against its budget,
 * so many weak mobs cost what they should (a swarm is deadlier than its raw sum).
 */
export declare function encounterMultiplier(monsterCount: number): number;
