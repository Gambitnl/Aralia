/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 19:18:10
 * Dependents: components/BattleMap/forge/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * A chunky isometric flagstone slab with a lit top face, dark side faces for
 * thickness, mortar cracks that split it into pieces, and a beveled upper-left
 * edge. Reads as a floor tile lifted just off the ground.
 */
export declare function drawFlagstone(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, seed: number): void;
/**
 * A fluted stone column: stacked base plinth, tapered shaft with vertical
 * flutes and cracks, and a flared capital. Stands on baseY, rises H.
 */
export declare function drawPillar(ctx: CanvasRenderingContext2D, cx: number, baseY: number, H: number, seed: number): void;
/** A wooden crate: planked front, iron corner brackets, and rivets. */
export declare function drawCrate(ctx: CanvasRenderingContext2D, cx: number, baseY: number, S: number, seed: number): void;
/** A treasure chest: planked body, domed iron-strapped lid, and a lock plate. */
export declare function drawChest(ctx: CanvasRenderingContext2D, cx: number, baseY: number, S: number, seed: number): void;
/** An arched dungeon door: stone frame, planked leaf, iron bands, ring pull. */
export declare function drawDoor(ctx: CanvasRenderingContext2D, cx: number, baseY: number, H: number, seed: number): void;
/**
 * A lit iron brazier: three splayed legs, a riveted bowl, glowing coals, a
 * seeded flame, a warm halo, and a few rising embers.
 */
export declare function drawBrazier(ctx: CanvasRenderingContext2D, cx: number, baseY: number, R: number, seed: number): void;
/** Draw the full dungeon showcase sheet at logical size W×H, seeded. */
export declare function drawDungeonSheet(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number): void;
