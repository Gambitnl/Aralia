/**
 * @file budgets.ts — triangle budgets shared by the perf regression tests and
 * the hero-mesh optimization stage. One source: a creature that passes the
 * test suite also fits the optimizer's gate, and vice versa.
 */

/** Ceiling for any planned creature's body (fixtures + hero meshes). */
export const PLAN_TRIANGLE_BUDGET = 30_000;

/** Ceiling for a standard humanoid body. */
export const HUMANOID_TRIANGLE_BUDGET = 12_000;
