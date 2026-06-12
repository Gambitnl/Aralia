import { generateFmgAtlas } from '../../src/systems/worldforge/fmg/generateAtlas';
const a = generateFmgAtlas('world-42', { width: 960, height: 540, cellsDesired: 10000, template: 'continents' }) as any;
for (const id of [110, 347, 1928, 2275]) {
  console.log(`id ${id}: pack.h=${a.pack.cells.h[id]} grid.h=${a.grid.cells.h[id]} packLand=${a.pack.cells.h[id] >= 20} gridLand=${a.grid.cells.h[id] >= 20}`);
}
console.log('pack cells:', a.pack.cells.h.length, 'grid cells:', a.grid.cells.h.length);
