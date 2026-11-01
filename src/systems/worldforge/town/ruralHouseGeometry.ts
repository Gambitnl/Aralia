/** The fresh farm room program and its approach share one five-foot grid.
 * An even number of columns puts the entrance half a cell off the facade
 * midpoint. Plan that real corridor center before admitting a full-width
 * track; never move an accepted house or road to compensate after loading.
 * Structural or retained-source exceptions still need actual door projection. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 13:35:11
 * Dependents: systems/worldforge/interior/ruralFamilyLayout.ts, systems/worldforge/town/ruralHomesteads.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/** Left edge of the one-cell shared corridor in a supported rectangle. */
export function ruralFamilySpineColumn(columns:number):number {
  if(!Number.isInteger(columns)||columns<5)throw new Error('Rural shared frontage needs at least five whole columns.');
  return Math.ceil((columns-1)/2);
}

/** Feet along corners 0-to-1, relative to the front facade midpoint. */
export function ruralFamilyFrontageOffsetFt(widthFt:number):number {
  const columns=Math.round(widthFt/5);
  if(!Number.isFinite(widthFt)||Math.abs(columns*5-widthFt)>1e-6)throw new Error('Rural frontage requires a five-foot lot grid.');
  return (ruralFamilySpineColumn(columns)+.5)*5-widthFt/2;
}
