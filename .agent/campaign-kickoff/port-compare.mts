import { generateFmgBase } from '../../src/systems/worldforge/fmg/generateBase';
const r = generateFmgBase('123456789', { width: 1200, height: 800, cellsDesired: 10000, template: 'lowIsland' }) as any;
const h = r.grid.cells.h as Uint8Array;
console.log(JSON.stringify({
  cells: h.length,
  heightsSum: Array.from(h).reduce((a: number, b: number) => a + b, 0),
  template: r.template,
}));
