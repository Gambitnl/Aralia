#!/usr/bin/env node
/**
 * planmap-to-wave.mjs — turn a plan-map topic into an orchestration wave SKELETON.
 *
 *   node tools/agora/planmap-to-wave.mjs fip-slice1 [--file fixture.json] [--out .agent/scratch/orchestrate/fip-slice1.json]
 *
 * Emits one packet per sub-feature (skipping status "done"), with:
 *   - "after": [] unless the feature explicitly names predecessor slugs
 *   - refs: ["planmap:<topicId>/<feature-slug>"] — the convention
 *     planmap-reconcile.mjs matches completed Agora tasks back against
 *   - guidance pointing at the sub-feature's spec doc
 *
 * SKELETON ONLY: fill in files/agent/guidance by hand before `orchestrate seed`.
 * (Deliberately no LLM auto-fill — that's an agent's job, not this script's.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// Repository Paths and CLI Input
// ============================================================================
// Normal operator runs read the canonical Plan Map. The optional `--file`
// override lets tests and dry fixtures exercise packet generation without ever
// reading or mutating the shared checkout's dirty Plan Map.
// ============================================================================

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const petManifest = JSON.parse(fs.readFileSync(path.join(here, 'dashboard', 'pets', 'pets.json'), 'utf8'));
const petSlugs = (petManifest.pets || []).map((pet) => pet.slug).filter(Boolean);
if (!petSlugs.length) {
  console.error('pet manifest has no identities; cannot produce a presence-valid wave');
  process.exit(1);
}

const optionValue = (flag) => {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    console.error(`${flag} requires a path`);
    process.exit(1);
  }
  return value;
};

const input = optionValue('--file');
const inputPath = input
  ? path.resolve(repo, input)
  : path.join(repo, 'public', 'planmap', 'topics.json');
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const topicId = process.argv[2];
const topic = data.topics.find((t) => t.id === topicId);
if (!topic) {
  console.error(`unknown topic "${topicId}". Known: ${data.topics.map((t) => t.id).join(', ')}`);
  process.exit(1);
}

// ============================================================================
// Stable Feature Identity
// ============================================================================
// Slugs are computed across every feature, including completed ones, so refs
// and explicit dependency declarations remain stable when work is finished.
// This scheme must stay aligned with planmap-reconcile.mjs.
// ============================================================================

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
// SHARED SCHEME with planmap-reconcile.mjs (must stay identical or the truth-loop
// breaks): slugs are computed over the FULL features array (done included, so
// indices never shift), and duplicate base slugs get -2, -3... by occurrence order.
const featureSlugs = (feats) => {
  const counts = new Map();
  return feats.map((f) => {
    const base = slug(f.title);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
};
const allFeatures = topic.features ?? [];
const allSlugs = featureSlugs(allFeatures);
const features = allFeatures
  .map((f, i) => ({ f, slug: allSlugs[i] }))
  .filter(({ f }) => f.status !== 'done');
if (!features.length) {
  console.error(`topic "${topicId}" has no non-done features to turn into packets`);
  process.exit(1);
}

// ============================================================================
// Explicit Scheduling Dependencies
// ============================================================================
// Packet IDs belong only to features that survive filtering. Feature authors
// name dependencies with stable slugs; this stage resolves those names after
// the final packet list exists. Array order and UI-only parallel fields never
// create scheduling edges.
// ============================================================================

const packetFeatures = features.map((feature, i) => ({
  ...feature,
  id: `PK-${i + 1}`,
}));
const allFeatureBySlug = new Map(
  allFeatures.map((feature, i) => [allSlugs[i], feature]),
);
const packetIdBySlug = new Map(
  packetFeatures.map((feature) => [feature.slug, feature.id]),
);

const failDependency = (featureSlug, message) => {
  console.error(`feature "${featureSlug}" has invalid after declaration: ${message}`);
  process.exit(1);
};

const resolveAfter = ({ f, slug: featureSlug, id }) => {
  if (f.after === undefined) return [];
  if (!Array.isArray(f.after)) {
    failDependency(featureSlug, 'expected an array of stable feature slugs');
  }

  const seen = new Set();
  return f.after.map((predecessorSlug) => {
    if (typeof predecessorSlug !== 'string' || predecessorSlug.length === 0) {
      failDependency(featureSlug, 'every predecessor must be a non-empty stable feature slug');
    }
    if (seen.has(predecessorSlug)) {
      failDependency(featureSlug, `duplicate predecessor "${predecessorSlug}"`);
    }
    seen.add(predecessorSlug);

    const predecessor = allFeatureBySlug.get(predecessorSlug);
    if (!predecessor) {
      failDependency(featureSlug, `unknown predecessor "${predecessorSlug}"`);
    }

    const predecessorPacketId = packetIdBySlug.get(predecessorSlug);
    if (!predecessorPacketId) {
      failDependency(
        featureSlug,
        `predecessor "${predecessorSlug}" is skipped because its status is "${predecessor.status}"`,
      );
    }
    if (predecessorPacketId === id) {
      failDependency(featureSlug, `predecessor "${predecessorSlug}" refers to the feature itself`);
    }
    return predecessorPacketId;
  });
};

const packets = packetFeatures.map(({ f, slug: fslug, id }, i) => {
  const p = {
    id,
    handle: fslug,
    // Plan Map owns campaign extraction; the wave generator also assigns each
    // worker a valid pet identity so its generated prompt can claim presence.
    pet: petSlugs[(i + 1) % petSlugs.length],
    agent: 'claude',
    scope: f.title,
    files: ['TODO: list the packet-owned files (disjoint across packets)'],
    issues: [],
    priority: i + 1,
    after: resolveAfter({ f, slug: fslug, id }),
    refs: [`planmap:${topicId}/${fslug}`],
    guidance: (f.link ? `Spec: ${f.link}. ` : '') +
      `Sub-feature of "${topic.title}"${topic.link ? ` (parent spec: ${topic.link})` : ''}. TODO: paste the grilled scope.`,
  };
  return p;
});

// ============================================================================
// Wave Skeleton Output
// ============================================================================
// Preserve the existing packet skeleton, destination default, and operator
// handoff. Only scheduling edges now require an explicit Plan Map declaration.
// ============================================================================

const plan = {
  wave: `${topicId}-wave`,
  pet: petSlugs[0],
  scope: `${topic.title} — ${topic.sub ?? ''}`.trim(),
  packets,
};

const output = optionValue('--out');
const out = output
  ? path.resolve(repo, output)
  : path.join(repo, '.agent', 'scratch', 'orchestrate', `${topicId}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(plan, null, 2) + '\n');
console.log(`wave skeleton (${packets.length} packets) → ${path.relative(repo, out)}`);
console.log('review pet identities; fill in files/guidance/agent; "after" contains only explicit feature dependencies.');
console.log('Then: orchestrate seed <plan>');
