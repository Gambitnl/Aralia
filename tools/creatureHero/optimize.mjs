/**
 * Hero pipeline stage 3: master.glb → hero.glb (game-ready).
 *
 * gltf-transform pass: weld → dedup → prune → simplify (ratio stepped down
 * until the mesh fits the shared triangle budget). Over budget at the lowest
 * ratio = LOUD FAILURE, no silent ship. Texture downsizing is deferred (needs
 * the sharp native dep; TRELLIS textures ship at 1–2K already).
 *
 * Usage: npx tsx tools/creatureHero/optimize.mjs <entryId> [--base src/data/creatures3d/hero]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const [entryId, ...rest] = process.argv.slice(2);
if (!entryId) {
  console.error('usage: npx tsx tools/creatureHero/optimize.mjs <entryId> [--base dir]');
  process.exit(1);
}
const baseFlag = rest.indexOf('--base');
const baseDir = baseFlag >= 0 ? rest[baseFlag + 1] : 'public/creatures3d/hero';

// heroStore + budgets are TypeScript — load through tsx's loader when present,
// else re-implement the tiny bits here. Tools run via `npx tsx` for TS access.
const { assertStage, heroDir, readHero, writeHero } = await import(
  pathToFileURL(path.resolve('src/systems/entities3d/library/heroStore.ts')).href
);
const { PLAN_TRIANGLE_BUDGET } = await import(
  pathToFileURL(path.resolve('src/systems/entities3d/textPlan/budgets.ts')).href
);

assertStage(baseDir, entryId, 'master');
const dir = heroDir(baseDir, entryId);
const masterPath = path.join(dir, 'master.glb');
const heroPath = path.join(dir, 'hero.glb');

// register KHR material/texture extensions so clearcoat, transmission, and
// texture transforms survive the optimize pass instead of being dropped
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function triangleCount(document) {
  let tris = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const position = prim.getAttribute('POSITION');
      tris += Math.floor((indices ? indices.getCount() : position.getCount()) / 3);
    }
  }
  return tris;
}

const master = await io.read(masterPath);
const masterTris = triangleCount(master);
console.log(`master.glb: ${masterTris.toLocaleString()} triangles`);

let best = null;
let bestTris = Infinity;
for (const ratio of [1, 0.75, 0.5, 0.35, 0.25, 0.15, 0.1]) {
  const doc = await io.read(masterPath);
  await doc.transform(
    weld(),
    dedup(),
    prune(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001 + (1 - ratio) * 0.01 }),
  );
  const tris = triangleCount(doc);
  console.log(`  ratio ${ratio}: ${tris.toLocaleString()} triangles`);
  if (tris < bestTris) {
    best = doc;
    bestTris = tris;
  }
  if (tris <= PLAN_TRIANGLE_BUDGET) break;
}

if (bestTris > PLAN_TRIANGLE_BUDGET) {
  console.error(
    `optimization cannot reach ${PLAN_TRIANGLE_BUDGET.toLocaleString()} triangles (best: ${bestTris.toLocaleString()})`,
  );
  process.exit(1);
}

await io.write(heroPath, best);
const record = readHero(baseDir, entryId) ?? { entryId, stages: {}, status: 'generated' };
record.stages.hero = { at: new Date().toISOString() };
record.triangles = { master: masterTris, hero: bestTris };
// Hero Lab keeps the target creature id inside a job record whose directory is
// the immutable job id. Preserve that provenance, but always write optimizer
// results beside the input artifacts instead of redirecting by record.entryId.
if (record.entryId === entryId) {
  writeHero(baseDir, record);
} else {
  writeFileSync(path.join(dir, 'hero.json'), JSON.stringify(record, null, 2) + '\n');
}
console.log(`hero.glb written: ${bestTris.toLocaleString()} triangles (budget ${PLAN_TRIANGLE_BUDGET.toLocaleString()})`);
