import { generateFmgWorld } from '../../src/systems/worldforge/fmg/generateWorld';
const w = generateFmgWorld('world-42', { width: 960, height: 540, cellsDesired: 10000, template: 'continents' }) as any;
const p = w.pack;
console.log(JSON.stringify({
  states: p.states.slice(0, 4).map((s: any) => ({ i: s.i, name: s.name, color: s.color, center: s.center })),
  burgs: p.burgs.slice(1, 4).map((b: any) => ({ i: b.i, name: b.name, x: b.x, y: b.y, capital: b.capital, port: b.port })),
  counts: { states: p.states.length, burgs: p.burgs.length, routes: p.routes.length },
  cellsHasState: !!p.cells.state, cellsHasBurg: !!p.cells.burg,
}, null, 1).slice(0, 1200));
