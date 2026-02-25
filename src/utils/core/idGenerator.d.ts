/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 *
 * Last Sync: 26/01/2026, 01:20:01
 * Dependents: combatUtils.ts, core/index.ts, idGenerator.ts
 * Imports: None
 *
 * Tool: Codebase Visualizer (Headless Sync)
 */
/**
 * Generates a unique identifier.
 * Uses `crypto.randomUUID()` where available for stronger uniqueness,
 * falling back to a timestamp + random string combination.
 */
export declare function generateId(): string;
