#!/usr/bin/env node
/**
 * export-canid-v2-rig-tokens.mjs — agora-fdbb (IDEA - SkinTokens canid-v2
 * rigging comparison).
 *
 * WHAT THIS IS. The task asks to compare one disposable "canid-v2" SkinTokens
 * auto-rigging candidate against Aralia's current deterministic rig, using
 * declared joints, weights, deformation poses, exact hashes, tool provenance,
 * and licence context. As of this run:
 *   - SkinTokens is not installed or reachable offline on this host (checked
 *     `where skintokens`/`where SkinTokens`, `C:\Program Files`,
 *     `C:\Program Files (x86)`, `node_modules`, and grepped the whole repo —
 *     see the protocol doc's "Tool availability" section for the exact
 *     commands and output).
 *   - No literal `canid-v2` identifier exists under src/systems/entities3d
 *     and no Idea Board record matches `idea:skin-tokens-auto-rigging`
 *     (confirmed by sibling pass agora-63e3, PREMISE of this task's dispatch
 *     prompt — not re-proven here).
 * Per the dispatch premise, this script exports the CURRENT SIDE of the
 * comparison only: Aralia's own deterministic procedural quadruped body (the
 * "beast" plan template — wolf/big-cat/bear archetype,
 * src/systems/entities3d/creaturePlans.ts `beastPlan()`, matched by cues
 * ['wolf','beast','horse','hound','dog'] in `planForCreature()`) as the
 * canid-v2 stand-in, compiled through the same `generateEntityBlueprint`
 * pipeline (`profileForCreature` -> `planForCreature` -> `compilePlan`) used
 * in production. No SkinTokens candidate exists to compare against — this
 * script produces one half of the receipt the protocol doc defines, and
 * marks the run itself as "requires SkinTokens".
 *
 * WHY "JOINTS" = SEGMENT ENDPOINTS. The current rig has no vertex-mesh +
 * bone-weight skin at all. `src/systems/entities3d/types.ts` defines the
 * per-frame skeleton contract explicitly:
 *
 *   "One rigid body bone: a tapered segment between two joints ... Radii are
 *   FRAME-CONSTANT per id; only the endpoints move frame to frame."
 *
 * and `src/systems/entities3d/three/gaits.ts` (GaitDriver.buildBody doc):
 *
 *   "Segment ids are stable across frames and radii are frame-constant per
 *   id."
 *
 * So the rig's own vocabulary already calls a segment's two endpoints
 * "joints" — this script does not invent that term. A joint is wherever two
 * or more segment endpoints (or a ball center) occupy the same point in
 * entity-local space at the rest frame; the script detects those by spatial
 * clustering (epsilon 1e-4 m) rather than guessing anatomy from id strings,
 * so the joint list is DERIVED, not asserted.
 *
 * WHY "WEIGHTS" ARE RIGID, NOT SMOOTH. There is no vertex-level skin in this
 * rig (Body v2 sends bones straight to the sink as capsule primitives — see
 * the "Body v2" comment in gaits.ts). Each segment is therefore its own
 * rigid body with weight 1.0 on itself; at a joint where multiple segments
 * meet, there is no blended weight region, only two independent rounded caps
 * that happen to coincide. This script declares that plainly (rigid weight
 * table + a flag on which joints are "junctions" — 2+ segments meeting) so a
 * later comparison against a real SkinTokens smooth-skin export has an
 * honest, non-fabricated baseline rather than an invented smooth-weight
 * table that does not exist in the current rig.
 *
 * WHY PURE NODE, NO BROWSER. Same reasoning as the agora-63e3 sibling script
 * (`scripts/idea-board/experiments/export-canid-candidate-clip.mjs`):
 * creaturePlans.ts/gaits.ts/compilePlan.ts depend only on three's math
 * classes, not WebGL/DOM, so the whole export runs deterministically under
 * plain Node via tsx — no dev server, no GPU context, not a "heavy command"
 * per AGENTS.md rule 6. This script deliberately does NOT import
 * generateEntityBlueprint.ts either, for the same reason the sibling avoided
 * it: its static `import { ALL_RACES_DATA } from '../../data/races'` pulls a
 * Vite-only `import.meta.glob()` that throws under plain Node.
 *
 * USAGE
 *   npx tsx scripts/idea-board/experiments/export-canid-v2-rig-tokens.mjs
 *
 * Deterministic: fixed seed, fixed frame count, fixed dt. Re-running produces
 * a byte-identical file and hash as long as creaturePlans.ts/gaits.ts/
 * compilePlan.ts are unchanged.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rngFromPath, streamPath, makeSeedPath, fnv1a } from '../../../src/systems/worldforge/seedPath.ts';
import { profileForCreature } from '../../../src/systems/entities3d/creatureProfiles.ts';
import { planForCreature, bellyToneFor } from '../../../src/systems/entities3d/creaturePlans.ts';
import { compilePlan } from '../../../src/systems/entities3d/textPlan/compilePlan.ts';
import { createGaitDriver } from '../../../src/systems/entities3d/three/gaits.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = path.join(REPO, '.agent', 'scratch', 'agora-fdbb');

// ---- fixed candidate identity (the "canid-v2" stand-in) --------------------
const RECIPE = Object.freeze({
  kind: 'creature',
  creatureType: 'Beast',
  size: 'Medium',
  seed: 'agora-fdbb:skintokens-canid-v2-candidate',
  cues: ['wolf', 'beast', 'hound'],
});

const POSE_SAMPLE_COUNT = 24; // one gait cycle, 24 evenly spaced deformation poses
const SPEED_MPS = 3.2; // a settled trot (idle collapses the cycle to a near-static pose)
const JOINT_EPSILON_M = 1e-4; // spatial clustering tolerance for shared endpoints

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
  return value;
}

function sha256(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

function uniform(rng, lo, hi) {
  return lo + rng.next() * (hi - lo);
}

/** Same derivation generateEntityBlueprint.ts uses for `kind: 'creature'`
 * (deliberately duplicated here, not imported — see the header note). */
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
  const skinHex = '#8a7a63'; // fixed candidate palette — visuals do not affect joints/weights
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

/** Collect this frame's segments + balls via the SegmentSink contract. */
function sampleFrame(driver, t, dt, loco) {
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
  return { segs, balls };
}

/** Every "endpoint" the rest frame offers a joint-detector: segment a/b ends
 * plus ball centers, each tagged with its owning segment/ball id and role. */
function endpointsOf(frame) {
  const pts = [];
  for (const s of frame.segs) {
    pts.push({ segmentId: s.id, end: 'a', p: s.a });
    pts.push({ segmentId: s.id, end: 'b', p: s.b });
  }
  for (const b of frame.balls) {
    pts.push({ segmentId: b.id, end: 'c', p: b.c });
  }
  return pts;
}

function dist(p, q) {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const dz = p[2] - q[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Union-find clustering of rest-frame endpoints within JOINT_EPSILON_M,
 * producing the declared joint list: one joint per cluster, membership =
 * which segment/ball ends meet there. A cluster with 1 member is a free
 * (unconnected) endpoint — e.g. a foot/toe tip with nothing attached beyond
 * it — still a joint by the rig's own "segment between two joints" contract. */
function detectJoints(restFrame) {
  const pts = endpointsOf(restFrame);
  const parent = pts.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i, j) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  };
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (dist(pts[i].p, pts[j].p) <= JOINT_EPSILON_M) union(i, j);
    }
  }
  const clusters = new Map();
  for (let i = 0; i < pts.length; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(pts[i]);
  }
  // Stable, deterministic joint ids: sort clusters by their lexically
  // smallest member (segmentId+end), independent of Map iteration order.
  const clusterList = [...clusters.values()].sort((a, b) => {
    const ka = [...a].sort((x, y) => (x.segmentId + x.end < y.segmentId + y.end ? -1 : 1))[0];
    const kb = [...b].sort((x, y) => (x.segmentId + x.end < y.segmentId + y.end ? -1 : 1))[0];
    const sa = `${ka.segmentId}.${ka.end}`;
    const sb = `${kb.segmentId}.${kb.end}`;
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });
  return clusterList.map((members, idx) => {
    const sortedMembers = [...members].sort((a, b) =>
      a.segmentId === b.segmentId ? (a.end < b.end ? -1 : 1) : a.segmentId < b.segmentId ? -1 : 1,
    );
    const centroid = sortedMembers
      .reduce((acc, m) => [acc[0] + m.p[0], acc[1] + m.p[1], acc[2] + m.p[2]], [0, 0, 0])
      .map((v) => v / sortedMembers.length);
    return {
      id: `joint${String(idx).padStart(3, '0')}`,
      restPosition: centroid,
      isJunction: sortedMembers.length > 1,
      members: sortedMembers.map((m) => ({ segmentId: m.segmentId, end: m.end })),
    };
  });
}

/** Rigid weight table: every segment is 100% weighted to itself. No smooth
 * blend exists between segments meeting at a junction joint — see header. */
function declareWeights(restFrame) {
  return restFrame.segs
    .map((s) => ({ segmentId: s.id, kind: 'rigid_self', weights: [{ segmentId: s.id, weight: 1 }] }))
    .sort((a, b) => (a.segmentId < b.segmentId ? -1 : 1));
}

/** For each declared joint, its position across all sampled deformation
 * poses — the centroid of its rest-frame member endpoints, recomputed from
 * that frame's actual segment/ball geometry (topology is fixed at rest;
 * positions move with the gait). */
function jointPositionsPerFrame(joints, frame) {
  const bySeg = new Map();
  for (const s of frame.segs) bySeg.set(s.id, s);
  const byBall = new Map();
  for (const b of frame.balls) byBall.set(b.id, b);
  return joints.map((j) => {
    const pts = j.members.map((m) => {
      if (m.end === 'c') return byBall.get(m.segmentId).c;
      const seg = bySeg.get(m.segmentId);
      return m.end === 'a' ? seg.a : seg.b;
    });
    const centroid = pts
      .reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
      .map((v) => v / pts.length);
    return { id: j.id, position: centroid };
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
  const loco = { position: { x: 0, y: 0, z: 0 }, heading: { x: 0, y: 0, z: 1 }, speed: SPEED_MPS };
  const dt = 1 / POSE_SAMPLE_COUNT;

  // Rest frame (t=0) declares joint topology + rigid weights.
  const restFrame = sampleFrame(driver, 0, dt, loco);
  const joints = detectJoints(restFrame);
  const weights = declareWeights(restFrame);

  // Deformation poses: one gait cycle, POSE_SAMPLE_COUNT samples, joint
  // positions only (topology is fixed; segment radii are frame-constant per
  // the rig's own contract, so they are not re-recorded per pose).
  const deformationPoses = [];
  for (let i = 0; i < POSE_SAMPLE_COUNT; i++) {
    const t = i * dt;
    const frame = sampleFrame(driver, t, dt, loco);
    deformationPoses.push({
      frame: i,
      t,
      gaitPhase: driver.gaitPhase,
      joints: jointPositionsPerFrame(joints, frame),
    });
  }

  const output = {
    schema: 'agora-fdbb.rig-export.v1',
    idea: 'idea:skin-tokens-auto-rigging',
    task: 'agora-fdbb',
    candidateLabel:
      'canid-v2 (stand-in: deterministic wolf/beast quadruped plan) — CURRENT rig side only; no SkinTokens candidate exists',
    recipe: RECIPE,
    jointEpsilonM: JOINT_EPSILON_M,
    poseSampleCount: POSE_SAMPLE_COUNT,
    speedMps: SPEED_MPS,
    frame: blueprint.frame,
    label: blueprint.label,
    segmentCountRestFrame: restFrame.segs.length,
    ballCountRestFrame: restFrame.balls.length,
    joints,
    weights,
    deformationPoses,
    requiresSkinTokens: true,
    skinTokensNote:
      'SkinTokens (external auto-rigging tool) was not found on this host — see the protocol doc. ' +
      'This export is the CURRENT deterministic rig side of the comparison only; it does not and ' +
      'cannot include a SkinTokens candidate joints/weights/deformation set.',
  };

  const canonicalOutput = canonicalize(output);
  const json = `${JSON.stringify(canonicalOutput, null, 2)}\n`;
  const hash = sha256(json);

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'current-rig-tokens.json');
  const hashPath = path.join(OUT_DIR, 'current-rig-tokens.sha256');
  writeFileSync(outPath, json, 'utf8');
  writeFileSync(hashPath, `${hash}  current-rig-tokens.json\n`, 'utf8');

  console.log(`current-rig export written: ${path.relative(REPO, outPath)}`);
  console.log(`hash (sha256): ${hash}`);
  console.log(
    `joints: ${joints.length} (junctions: ${joints.filter((j) => j.isJunction).length}) ` +
      `segments/frame: ${restFrame.segs.length} balls/frame: ${restFrame.balls.length} poses: ${POSE_SAMPLE_COUNT}`,
  );
  console.log('NEXT STEP (blocked): run SkinTokens on this candidate, export its joints/weights/deformation');
  console.log('poses in the same shape, hash them, and fill the receipt comparison in the protocol doc.');
  console.log('SkinTokens is not installed on this host — see docs/projects/idea-board/experiments/');
  console.log('skintokens-canid-v2-rigging-comparison.md for the full protocol and tool-availability check.');
}

main();
