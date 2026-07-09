/**
 * @file index.ts
 * Registry of procedural asset sets for the forge. Each set draws a showcase
 * sheet onto a canvas at a logical size, seeded. Add a new set (dungeon,
 * swamp, …) by writing its `<name>Forge.ts` and appending one entry here.
 */
import { drawCaveSheet } from './caveForge';

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

export const ASSET_SETS: AssetSet[] = [
  {
    id: 'cave',
    label: 'Cave',
    description:
      'Ore rocks, crystal-ore nodes, chunky crystal clusters, stalagmites, and glowing mushrooms — one owned stylized language (light upper-left, ink outlines).',
    width: 1480,
    height: 1040,
    draw: drawCaveSheet,
  },
];

export * from './caveForge';
