/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 18:28:36
 * Dependents: components/BattleMap/forge/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
export declare function drawRock(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number, gold?: boolean): number;
export interface CrystalPalette {
    glow: string;
    hi: string;
    light: string;
    mid: string;
    dark: string;
    darker: string;
    ink: string;
}
export declare const CRYSTAL_BLUE: CrystalPalette;
export declare const CRYSTAL_PURPLE: CrystalPalette;
export declare function drawCrystal(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number, pal: CrystalPalette): void;
export declare function drawStalagmite(ctx: CanvasRenderingContext2D, cx: number, cy: number, Hh: number, seed: number): void;
export declare function drawGlowMushroom(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number, glow: string): void;
export declare function drawGemNode(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number, pal: CrystalPalette): void;
/** Draw the full cave showcase sheet at logical size W×H, seeded. */
export declare function drawCaveSheet(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number): void;
