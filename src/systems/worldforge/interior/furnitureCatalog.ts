/** Shared physical furniture dimensions, in meters, for placement and 3D rendering. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 01:49:45
 * Dependents: systems/worldforge/bridge/interiorParts.ts, systems/worldforge/interior/householdFurnish.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const FURNITURE: Record<string, { w: number; d: number; h: number; colorHex: string }> = {
  table: { w: 1.6, d: 0.9, h: 0.8, colorHex: '#c8a24a' },
  hearth: { w: 1.4, d: 0.7, h: 1.4, colorHex: '#b5552e' },
  'forge-hearth': { w: 1.6, d: 0.9, h: 1.2, colorHex: '#5a4636' },
  counter: { w: 2.2, d: 0.7, h: 1.0, colorHex: '#c8a24a' },
  shelf: { w: 1.8, d: 0.4, h: 1.8, colorHex: '#9a8458' },
  barrel: { w: 0.7, d: 0.7, h: 1.0, colorHex: '#8a6a42' },
  bed: { w: 1.0, d: 2.0, h: 0.6, colorHex: '#7da0c4' },
  chest: { w: 1.0, d: 0.6, h: 0.6, colorHex: '#a07c4a' },
  crate: { w: 0.8, d: 0.8, h: 0.8, colorHex: '#8a6a42' },
  workbench: { w: 2.0, d: 0.8, h: 0.9, colorHex: '#b08968' },
  bench: { w: 1.5, d: 0.4, h: 0.45, colorHex: '#a5824f' },
  altar: { w: 1.4, d: 0.8, h: 1.1, colorHex: '#b8b2a4' },
  desk: { w: 1.4, d: 0.7, h: 0.78, colorHex: '#8f6b45' },
  chair: { w: 0.5, d: 0.5, h: 0.9, colorHex: '#9c7a4e' },
  'weapon-rack': { w: 1.2, d: 0.4, h: 1.7, colorHex: '#6f5a3e' },
  anvil: { w: 0.9, d: 0.4, h: 0.9, colorHex: '#45464b' },
  'writing-desk': { w: 1.3, d: 0.6, h: 0.95, colorHex: '#8f6b45' },
  strongbox: { w: 0.7, d: 0.5, h: 0.5, colorHex: '#5f5140' },
};

export function furnishingSpec(kind: string) {
  const spec = FURNITURE[kind];
  if (!spec) throw new Error(`interiorParts: unknown furnishing kind "${kind}" — add a spec to FURNITURE`);
  return spec;
}
