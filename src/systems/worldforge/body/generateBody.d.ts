/**
 * @file generateBody.ts — Worldforge parametric body generator.
 *
 * Spec: docs/projects/worldforge/SPEC.md §4 L4 + §7 (decision #13).
 * Generates BodyPlan deterministically from Occupant identity.
 *
 * PURE DATA only — no rendering, no fallback, no asset-service calls.
 * All randomness seeded via seedPath (never Math.random/Date.now).
 *
 * What changed: new module (build-order item 8 — entity pipeline).
 * Why: occupants currently render as a clothed box + skin-toned head (v0);
 * this provides parametric proportions for future AI-gen body rendering.
 */
import type { Occupant } from '../roster/types';
import type { SeedPath } from '../seedPath';
import type { BodyPlan } from './types';
/**
 * Main entry point: generate a BodyPlan from an Occupant.
 *
 * @param occupant — The roster occupant to generate a body for.
 * @param seedPath — Hierarchical seed path for deterministic randomness.
 * @returns A complete BodyPlan (pure data, no rendering).
 */
export declare function generateBody(occupant: Occupant, seedPath: SeedPath): BodyPlan;
