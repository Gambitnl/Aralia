/**
 * @file rigBaseMeshes.mjs — run the Blender rig job over the Part Lab base
 * meshes: every `kind: 'body'` model in public/references/basemesh/ gets OUR
 * full biped skeleton with bone-heat weights, written beside it as
 * <id>.rigged.glb. The head kit is skipped (no body to bind).
 *
 * Needs Blender 4.2 LTS or newer. Resolution order for the executable:
 *   1. BLENDER_EXE environment variable
 *   2. C:\Program Files\Blender Foundation\Blender <version>\blender.exe
 * A missing Blender fails this script honestly — there is no in-engine
 * fallback rig (Remy's call 2026-08-21: Blender automatic weights).
 *
 * Run: node tools/entities3d/rigBaseMeshes.mjs [id ...]
 *   no ids = every body model in the catalog
 * Inputs:  public/references/basemesh/<id>.glb (from splitBaseMeshes.mjs)
 *          tools/entities3d/bipedBoneSpec.json (from exportBoneSpec.ts)
 * Outputs: public/references/basemesh/<id>.rigged.glb
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')), '..', '..');
const BASE_DIR = path.join(ROOT, 'public', 'references', 'basemesh');
const SPEC = path.join(ROOT, 'tools', 'entities3d', 'bipedBoneSpec.json');
const JOB = path.join(ROOT, 'tools', 'blender', 'rig_basemesh.py');

// mirrors baseMeshCatalog.ts: the body models (the head kit has no body)
const BODY_MODELS = ['lowpoly-nogender', 'lowpoly-female', 'lowpoly-male', 'stylized-figure-a', 'stylized-figure-b'];

function findBlender() {
  if (process.env.BLENDER_EXE) {
    if (!existsSync(process.env.BLENDER_EXE)) throw new Error(`BLENDER_EXE points at a missing file: ${process.env.BLENDER_EXE}`);
    return process.env.BLENDER_EXE;
  }
  // Remy's install (2026-08-21) lives on F:, so probe every fixed drive
  for (const drive of ['C', 'D', 'E', 'F', 'G']) {
    const vendor = `${drive}:\\Program Files\\Blender Foundation`;
    if (!existsSync(vendor)) continue;
    const versions = readdirSync(vendor)
      .filter((d) => /^Blender \d/.test(d) && existsSync(path.join(vendor, d, 'blender.exe')))
      .sort((a, b) => parseFloat(b.slice(8)) - parseFloat(a.slice(8)));
    if (versions.length) return path.join(vendor, versions[0], 'blender.exe');
  }
  throw new Error(
    'Blender not found. Install Blender 4.2 LTS (https://www.blender.org/download/lts/) ' +
      'or set BLENDER_EXE to blender.exe. The Part Lab skeleton track is Blender automatic weights by decision; there is no in-engine fallback.',
  );
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : BODY_MODELS;
for (const id of ids) {
  if (!BODY_MODELS.includes(id)) throw new Error(`rigBaseMeshes: "${id}" is not a body model (known: ${BODY_MODELS.join(', ')})`);
}
if (!existsSync(SPEC)) throw new Error(`missing ${SPEC} — run: npx tsx tools/entities3d/exportBoneSpec.ts`);
const blender = findBlender();
console.log(`blender: ${blender}`);

let failed = 0;
for (const id of ids) {
  const input = path.join(BASE_DIR, `${id}.glb`);
  const output = path.join(BASE_DIR, `${id}.rigged.glb`);
  if (!existsSync(input)) throw new Error(`missing ${input} — run: node tools/entities3d/splitBaseMeshes.mjs`);
  const r = spawnSync(blender, ['-b', '--python', JOB, '--', input, output, SPEC], { encoding: 'utf8', timeout: 10 * 60 * 1000 });
  const tail = (r.stdout + '\n' + r.stderr).split('\n').filter((l) => /rig_basemesh|Error|Traceback/.test(l)).slice(-6).join('\n');
  if (r.status !== 0 || !existsSync(output)) {
    failed++;
    console.error(`FAIL ${id} (exit ${r.status})\n${tail}`);
    continue;
  }
  console.log(`${id.padEnd(20)} → ${(statSync(output).size / 1024).toFixed(0)} KB\n${tail}`);
}
if (failed) process.exit(1);
