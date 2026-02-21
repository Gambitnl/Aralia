// @dependencies-start
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
// @dependencies-end

// TODO: Add an ESLint rule (no-restricted-syntax or similar) to globally prevent direct calls to crypto.randomUUID(), enforcing the use of generateId() to prevent regressions.
/**
 * Generates a unique identifier.
 * Uses `crypto.randomUUID()` where available for stronger uniqueness,
 * falling back to a timestamp + random string combination.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (e.g. older browsers/Node)
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}
