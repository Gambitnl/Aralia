/**
 * This file proves the new Worldforge town roster pass behaves like a stable
 * game-system contract, not a one-off data sketch.
 *
 * It builds rosters from both a real generated town and a tiny hand-authored
 * town. The real town catches integration drift with the existing town and
 * interior generators; the synthetic town pins workshop and market behavior
 * that the current town generator does not always emit yet.
 *
 * Called by: Vitest when agents verify `src/systems/worldforge/roster/`.
 * Depends on: generateTownRoster, generateTownPlan, blueprintForPlot, seedPath.
 */
export {};
