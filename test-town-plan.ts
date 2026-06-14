import { generateTownPlan } from './src/systems/worldforge/town/generateTownPlan';
import { childSeedPath, rootSeedPath } from './src/systems/worldforge/seedPath';

const site = {
  burgId: 1,
  envelope: { x: 0, y: 0, width: 2000, height: 2000 },
  gates: [[0, 1000] as [number, number], [2000, 1000] as [number, number]],
};

const seedPath = rootSeedPath(42);
const plan = generateTownPlan(site, seedPath);

console.log(`Plots generated: ${plan.plots.length}`);
console.log(`Market plots: ${plan.plots.filter(p => p.role === 'market').length}`);
console.log(`Workshop plots: ${plan.plots.filter(p => p.role === 'workshop').length}`);
console.log(`House plots: ${plan.plots.filter(p => p.role === 'house').length}`);
