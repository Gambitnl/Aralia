/**
 * This compatibility wrapper creates an Aralia master creature mesh through a
 * hosted TRELLIS Space. Use convert.py for authenticated Microsoft TRELLIS.2
 * runs: the Python Gradio client was the route proven end to end on 2026-08-12,
 * while this JavaScript client did not carry the saved token into ZeroGPU.
 *
 * A successful run writes the high-detail master.glb. optimize.mjs then owns
 * the separate reduction to Aralia's 30,000-triangle runtime budget.
 *
 * Usage: npx tsx tools/creatureHero/convert.mjs <entryId> [--base dir]
 */
import { Client, handle_file } from '@gradio/client';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const [entryId, ...rest] = process.argv.slice(2);
if (!entryId) {
  console.error('usage: npx tsx tools/creatureHero/convert.mjs <entryId>');
  process.exit(1);
}
const baseFlag = rest.indexOf('--base');
const baseDir = baseFlag >= 0 ? rest[baseFlag + 1] : 'public/creatures3d/hero';
const spaceFlag = rest.indexOf('--space');
// Official TRELLIS.2 (higher fidelity) by default; the community TRELLIS 1
// space remains reachable via --space trellis-community/TRELLIS.
const SPACE = spaceFlag >= 0 ? rest[spaceFlag + 1] : 'microsoft/TRELLIS.2';

// Microsoft TRELLIS.2 enforced this minimum during the live 2026-08-12 proof.
// Keeping the remote export large preserves detail for the local optimizer.
const TRELLIS_EXPORT_FACE_TARGET = 100_000;
const TRELLIS_TEXTURE_SIZE = 1024;

const { assertStage, heroDir, readHero, writeHero } = await import(
  pathToFileURL(path.resolve('src/systems/entities3d/library/heroStore.ts')).href
);

assertStage(baseDir, entryId, 'reference');
const dir = heroDir(baseDir, entryId);
const referencePath = path.join(dir, 'reference.png');
const masterPath = path.join(dir, 'master.glb');

const TIMEOUT_MS = 300_000;
const deadline = setTimeout(() => {
  console.error(`TRELLIS run exceeded ${TIMEOUT_MS / 1000}s — aborting`);
  process.exit(1);
}, TIMEOUT_MS);

console.log(`connecting to ${SPACE}…`);
// A Hugging Face token (free account) lifts the anonymous ZeroGPU quota.
// Set HF_TOKEN in the environment or .env.local — never hardcode it.
const hfToken = process.env.HF_TOKEN;
if (!hfToken) console.log('no HF_TOKEN set — running on the small anonymous GPU quota');
const client = await Client.connect(SPACE, hfToken ? { hf_token: hfToken } : undefined);

// microsoft/TRELLIS.2 flow (introspected 2026-07-22 via view_api):
//   /start_session() → /preprocess_image(input) → /image_to_3d(image, seed?,
//   resolution?, …) → /extract_glb(?, decimation_target?, texture_size?)
const image = handle_file(referencePath);

async function step(name, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`${name} failed:`);
    console.error(typeof e === 'object' ? JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}), 1).slice(0, 2000) : String(e));
    process.exit(1);
  }
}

console.log('start_session…');
await step('start_session', () => client.predict('/start_session', {}));

console.log('preprocess_image…');
const pre = await step('preprocess_image', () => client.predict('/preprocess_image', { input: image }));
console.log('preprocessed:', JSON.stringify(pre.data).slice(0, 160));
// generation consumes the PREPROCESSED image (background removed by the Space)
const processed = pre.data?.[0] ?? image;

console.log('image_to_3d… (the slow GPU part)');
await step('image_to_3d', () =>
  client.predict('/image_to_3d', { image: processed, seed: 1 }),
);

console.log('extract_glb…');
// TRELLIS exports the reusable master at its supported floor. The optimizer,
// rather than the hosted service, remains the owner of the game-ready budget.
const genResult = await step('extract_glb', () =>
  client.predict('/extract_glb', {
    decimation_target: TRELLIS_EXPORT_FACE_TARGET,
    texture_size: TRELLIS_TEXTURE_SIZE,
  }),
);
const flat = JSON.stringify(genResult.data);
const urlMatch = flat.match(/"(https?:[^"]+\.glb)"/) ?? flat.match(/"url":"([^"]+\.glb)"/);
if (!urlMatch) {
  console.error('generate returned no GLB url. Raw:', flat.slice(0, 2000));
  process.exit(1);
}
const glbUrl = urlMatch[1];
console.log('downloading', glbUrl);
const res = await fetch(glbUrl);
if (!res.ok) {
  console.error(`GLB download failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
writeFileSync(masterPath, Buffer.from(await res.arrayBuffer()));

const record = readHero(baseDir, entryId) ?? { entryId, stages: {}, status: 'generated' };
record.stages.master = { at: new Date().toISOString(), note: SPACE };
writeHero(baseDir, record);
clearTimeout(deadline);
console.log(`master.glb written (${(statSizeSafe(masterPath) / 1024 / 1024).toFixed(1)} MB)`);
process.exit(0); // the gradio client keeps its socket open — leave explicitly

function statSizeSafe(p) {
  try {
    return readFileSync(p).byteLength;
  } catch {
    return 0;
  }
}
