import { generateFmgBase } from '../../src/systems/worldforge/fmg/generateBase';
const r = generateFmgBase('123456789', { width: 1200, height: 800, cellsDesired: 10000, template: 'lowIsland' }) as any;
const arr = r.grid.cells.h as Uint8Array;
let h = 0x811c9dc5;
for (let i = 0; i < arr.length; i++) { h ^= arr[i]; h = Math.imul(h, 0x01000193); }
console.log('port fnv1a:', h >>> 0);
