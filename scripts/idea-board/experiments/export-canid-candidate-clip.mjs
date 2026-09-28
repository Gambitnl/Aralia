#!/usr/bin/env node
/**
 * export-canid-candidate-clip.mjs — agora-63e3 (IDEA - Cascadeur collision-cleanup round-trip).
 *
 * WHAT THIS IS. The task asks to prove one optional Cascadeur collision-cleanup
 * round trip for "canid-v2, the deterministic quadruped candidate". As of this
 * run there is no literal `canid-v2` identifier anywhere under
 * src/systems/entities3d (checked by grep; see the protocol doc's "Premise
 * check" section) and no Idea Board record for the
 * `idea:cascadeur-collision-penetration-cleaning` ref in
 * public/idea-board/records.json. This script therefore exports the closest
 * real thing that exists: Aralia's own deterministic procedural quadruped
 * body — the "beast" plan template (wolf/big-cat/bear archetype,
 * src/systems/entities3d/creaturePlans.ts, matched by cues
 * ['wolf','beast','horse','hound','dog']) compiled through the normal
 * generateEntityBlueprint → compilePlan → 'plan' gait driver pipeline used in
 * production. Treat its export identity as the stand-in "canid-v2 candidate"
 * until a real canid-v2 asset/spec exists to point at instead.
 *
 * WHY PURE NODE, NO BROWSER. gaits.ts and creaturePlans.ts only depend on
 * three's math classes (Matrix4/Quaternion/Vector3), not on WebGL/DOM, so the
 * whole procedural body + one gait cycle can be sampled deterministically in
 * plain Node via tsx — no headless Chrome, no dev server, no GPU context, and
 * therefore no "heavy command" per AGENTS.md rule 6.
 *
 * WHAT IT PRODUCES. A canonical JSON "clip": N evenly spaced samples across
 * one full gait cycle (t in [0,1)), each sample listing every skeleton
 * segment/ball the driver emits that frame (id, endpoints or center, radius).
 * This is the candidate's pre-Cascadeur export — the exact input a real
 * Cascadeur round trip would ingest as an FBX/GLB bone-and-collider rig. The
 * file is written under .agent/scratch/ (gitignored, throwaway) together with
 * its SHA-256 hash, which the protocol doc records as the experiment's input
 * hash.
 *
 * WHAT IT DOES NOT DO. It does not open Cascadeur, does not perform any
 * collision cleanup, and does not write anything under public/, src/, or any
 * tracked path. The actual round trip (import candidate → Cascadeur physics
 * cleanup pass → export → hash the result → diff the changed interval) needs
 * the desktop app installed; see the protocol doc for the receipt this script
 * leaves half-filled.
 *
 * USAGE
 *   npx tsx scripts/idea-board/experiments/export-canid-candidate-clip.mjs
 *
 * Deterministic: fixed seed, fixed frame count, fixed dt. Re-running produces
 * a byte-identical file and hash as long as creaturePlans.ts/gaits.ts/
 * compilePlan.ts are unchanged.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// NOTE: deliberately NOT importing generateEntityBlueprint.ts — its static
// `import { ALL_RACES_DATA } from '../../data/races'` pulls in a Vite-only
// `import.meta.glob()` (src/data/races/index.ts) that throws under plain
// Node/tsx even though the humanoid race path is never taken here. Going
// straight through the creature-plan pipeline (planForCreature + compilePlan)
// is the same code generateEntityBlueprint calls for `kind: 'creature'` and
// avoids that Vite-only dependency entirely.
import { rngFromPath, streamPath, makeSeedPath, fnv1a } from '../../../src/systems/worldforge/seedPath.ts';
import { profileForCreature } from '../../../src/systems/entities3d/creatureProfiles.ts';
import { planForCreature, bellyToneFor } from '../../../src/systems/entities3d/creaturePlans.ts';
import { compilePlan } from '../../../src/systems/entities3d/textPlan/compilePlan.ts';
import { createGaitDriver } from '../../../src/systems/entities3d/three/gaits.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = path.join(REPO, '.agent', 'scratch', 'agora-63e3');

// ---- fixed candidate identity (the "canid-v2" stand-in) --------------------
const RECIPE = Object.freeze({
  kind: 'creature',
  // CreatureType.Beast (src/types/creatures.ts) is the type bucket; the
  // 'wolf'/'hound' cues steer profileForCreature's cueOverrides and
  // creaturePlans.ts's planForCreature onto the quadruped beastPlan template
  // (the wolf/big-cat/bear body) rather than a biped/other Beast shape.
  creatureType: 'Beast',
  size: 'Medium',
  seed: 'agora-63e3:cascadeur-canid-v2-candidate',
  cues: ['wolf', 'beast', 'hound'],
});

const SAMPLE_COUNT = 24; // one gait cycle, 24 evenly spaced samples
const SPEED_MPS = 3.2; // a settled trot, not idle (idle emits a degenerate/flat cycle)

function canonicalize(value) {
  // Stable key order + fixed float precision so the hash is reproducible
  // across platforms/Node versions (float->string formatting is otherwise
  // not guaranteed identical to the last ULP).
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
  return value;
}

function uniform(rng, lo, hi) {
  return lo + rng.next() * (hi - lo);
}

/** Same derivation generateEntityBlueprint.ts uses for `kind: 'creature'`
 * (deliberately duplicated here, not imported — see the note above). */
function buildBlueprint(recipe) {
  const base = makeSeedPath(fnv1a(recipe.seed), `entity:${fnv1a(`salt:${recipe.seed}`)}`);
  const frameRng = rngFromPath(streamPath(base, 'frame'));
  const anatomyRng = rngFromPath(streamPath(base, 'anatomy'));

  const resolved = profileForCreature(recipe.creatureType, recipe.size, recipe.cues ?? []);
  const heightFt = resolved.frame.heightFt * uniform(frameRng, 0.92, 1.08);
  const bulk = resolved.frame.bulk * uniform(frameRng, 0.9, 1.1);
  const template = planForCreature(recipe.creatureType, recipe.size, recipe.cues ?? [], heightFt, bulk, anatomyRng);
  if (!template) {
    throw new Error(
      `entities3d: recipe ${JSON.stringify(recipe)} has no plan template (planForCreature returned null). ` +
        'The wolf/beast cue match may have moved; re-check creaturePlans.ts planForCreature().',
    );
  }
  const skinHex = '#8a7a63'; // fixed candidate palette — visuals do not affect the clip/skeleton
  return compilePlan({
    ...template,
    palette: {
      bodyHex: skinHex,
      accentHex: resolved.palette.accentHex,
      bellyHex: bellyToneFor(skinHex),
      eyeHex: resolved.palette.eyeHex,
    },
  });
}

function main() {
  const blueprint = buildBlueprint(RECIPE);
  if (blueprint.gait !== 'plan' || !blueprint.planSpec) {
    throw new Error(
      `entities3d: recipe ${JSON.stringify(RECIPE)} did not resolve to a compiled 'plan' quadruped ` +
        `(got gait="${blueprint.gait}"). The wolf/beast plan template may have moved; re-check ` +
        'creaturePlans.ts planForCreature() before trusting this export.',
    );
  }

  const driver = createGaitDriver('plan', blueprint.frame, blueprint.planSpec);
  const loco = {
    position: { x: 0, y: 0, z: 0 },
    heading: { x: 0, y: 0, z: 1 },
    speed: SPEED_MPS,
  };
  const dt = 1 / SAMPLE_COUNT;

  const samples = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = i * dt;
    driver.setPhase(t);
    driver.update(t, dt, loco);

    const segs = [];
    const balls = [];
    const sink = {
      seg(id, ax, ay, az, bx, by, bz, r0, r1) {
        segs.push({ id, a: [ax, ay, az], b: [bx, by, bz], r0, r1 });
      },
      ball(id, x, y, z, r) {
        balls.push({ id, c: [x, y, z], r });
      },
    };
    driver.buildBody(sink);
    segs.sort((s1, s2) => (s1.id < s2.id ? -1 : s1.id > s2.id ? 1 : 0));
    balls.sort((s1, s2) => (s1.id < s2.id ? -1 : s1.id > s2.id ? 1 : 0));

    samples.push({
      frame: i,
      t,
      gaitPhase: driver.gaitPhase,
      verticalOffsetM: driver.verticalOffsetM,
      segments: segs,
      balls,
    });
  }

  const clip = {
    schema: 'agora-63e3.candidate-clip.v1',
    idea: 'idea:cascadeur-collision-penetration-cleaning',
    task: 'agora-63e3',
    candidateLabel: 'canid-v2 (stand-in: deterministic wolf/beast quadruped plan)',
    recipe: RECIPE,
    sampleCount: SAMPLE_COUNT,
    speedMps: SPEED_MPS,
    frame: blueprint.frame,
    label: blueprint.label,
    samples,
  };

  const canonicalClip = canonicalize(clip);
  const json = `${JSON.stringify(canonicalClip, null, 2)}\n`;

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'candidate-clip.json');
  writeFileSync(outPath, json, 'utf8');

  const hash = createHash('sha256').update(json, 'utf8').digest('hex');
  const hashPath = path.join(OUT_DIR, 'candidate-clip.sha256');
  writeFileSync(hashPath, `${hash}  candidate-clip.json\n`, 'utf8');

  console.log('candidate export written:', path.relative(REPO, outPath));
  console.log('input hash (sha256):', hash);
  console.log('samples:', SAMPLE_COUNT, 'segments/frame:', clip.samples[0]?.segments.length ?? 0, 'balls/frame:', clip.samples[0]?.balls.length ?? 0);
  console.log('NEXT STEP (blocked): import this clip as FBX/GLB into Cascadeur, run the collision-');
  console.log('cleanup pass, export, then hash the result to fill the receipt output_hash field.');
  console.log('Cascadeur is not installed on this host - see the protocol doc for the receipt format.');
}

main();
