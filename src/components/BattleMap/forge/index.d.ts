/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 19:18:29
 * Dependents: components/DesignPreview/steps/PreviewAssetForge.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
export interface AssetSet {
    id: string;
    label: string;
    /** One-line description shown on the showcase page. */
    description: string;
    /** Logical canvas size the sheet is authored at. */
    width: number;
    height: number;
    /** Draw the whole showcase sheet, seeded. */
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) => void;
}
export declare const ASSET_SETS: AssetSet[];
export * from './caveForge';
export * from './dungeonForge';
