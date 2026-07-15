// tools/agora/seed-absorption-wave.mjs
// Task 10R (planning-surface-freshness): seed one Agora board task per
// docs/projects/<slug>/ folder so subagents can absorb each tracker card into
// the planmap and delete the folder.
//
//   node tools/agora/seed-absorption-wave.mjs               # dry-run (default)
//   node tools/agora/seed-absorption-wave.mjs --dry-run     # same, explicit
//   node tools/agora/seed-absorption-wave.mjs --seed        # POST tasks to the
//                                                           # Agora daemon — GATED:
//                                                           # requires the dry-run
//                                                           # plan file to exist
//
// Dry-run prints an aligned table (slug | campaign | note) plus a count and
// writes the full task-spec plan to .agent/scratch/absorption-wave-plan.json.
// Seeding re-reads THAT plan file (Remy approves the dry-run first) and posts
// each spec to POST /tasks with the stored client identity, exactly like
// tools/agora/client.mjs does.
//
// Pure Node.js ESM, zero npm dependencies. Loud errors: anything unexpected
// throws / exits 1 with a message — no silent fallbacks.
//
// See docs/superpowers/plans/2026-07-14-planning-surface-freshness.md (Task 10R).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const PROJECTS_DIR = path.join(REPO_ROOT, 'docs', 'projects');
const PLAYBOOK_PATH = 'docs/superpowers/plans/absorption-playbook.md';
const PLAN_FILE = path.join(REPO_ROOT, '.agent', 'scratch', 'absorption-wave-plan.json');
const DEFAULT_BASE_URL = 'http://localhost:4319';
const REF = 'planmap:planning-surface-freshness/absorption-wave-tracker-cards-to-tiles-folders-deleted';

// ---------------------------------------------------------------------------
// Campaign-lane map (from the old Task 10 main_category map):
//   "Game & Simulation"            -> world
//   "Combat & Encounters"          -> combat
//   categories containing UI/Interface -> ui
//   categories containing Tool/Doc/Workflow -> tooling
//   anything else                  -> tooling + NEEDS-HUMAN note
// ---------------------------------------------------------------------------
function laneFor(mainCategory) {
  if (!mainCategory) {
    return { campaign: 'tooling', note: 'NEEDS-HUMAN: no main_category in NORTH_STAR.md' };
  }
  const c = mainCategory.toLowerCase();
  if (c === 'game & simulation') return { campaign: 'world', note: '' };
  if (c === 'combat & encounters') return { campaign: 'combat', note: '' };
  if (c.includes('ui') || c.includes('interface')) return { campaign: 'ui', note: '' };
  if (c.includes('tool') || c.includes('doc') || c.includes('workflow')) {
    return { campaign: 'tooling', note: '' };
  }
  return { campaign: 'tooling', note: `NEEDS-HUMAN: unmapped main_category "${mainCategory}"` };
}

// Pull one scalar field out of the YAML frontmatter block (no YAML lib —
// the tracker frontmatter is flat `key: value` lines).
function frontmatterField(markdown, field) {
  const m = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const line = m[1].split(/\r?\n/).find((l) => l.startsWith(`${field}:`));
  if (!line) return null;
  return line.slice(field.length + 1).trim().replace(/^["']|["']$/g, '') || null;
}

// ---------------------------------------------------------------------------
// Build the plan: one task spec per project folder.
// ---------------------------------------------------------------------------
function buildPlan() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    throw new Error(`projects dir not found: ${PROJECTS_DIR}`);
  }
  const slugs = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory()) // skip files like PROJECT_TRACKER.md, GLOBAL_GAPS.md
    .map((e) => e.name)
    .sort();

  return slugs.map((slug) => {
    const northStar = path.join(PROJECTS_DIR, slug, 'NORTH_STAR.md');
    let mainCategory = null;
    if (fs.existsSync(northStar)) {
      mainCategory = frontmatterField(fs.readFileSync(northStar, 'utf8'), 'main_category');
    }
    const { campaign, note } = laneFor(mainCategory);
    const noteWithMissing = !fs.existsSync(northStar)
      ? 'NEEDS-HUMAN: no NORTH_STAR.md in folder'
      : note;
    const description = [
      `Follow the playbook at ${PLAYBOOK_PATH} for slug "${slug}".`,
      `Suggested campaign lane: ${campaign}.`,
      noteWithMissing ? `Note: ${noteWithMissing}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    return {
      slug,
      mainCategory,
      campaign,
      note: noteWithMissing,
      title: `absorb docs/projects/${slug}`,
      refs: [REF],
      description,
    };
  });
}

// ---------------------------------------------------------------------------
// Dry-run: aligned table + count, write the plan JSON.
// ---------------------------------------------------------------------------
function dryRun(plan) {
  const wSlug = Math.max('slug'.length, ...plan.map((r) => r.slug.length));
  const wCampaign = Math.max('campaign'.length, ...plan.map((r) => r.campaign.length));
  console.log(`${'slug'.padEnd(wSlug)} | ${'campaign'.padEnd(wCampaign)} | note`);
  console.log(`${'-'.repeat(wSlug)}-+-${'-'.repeat(wCampaign)}-+-${'-'.repeat(4)}`);
  for (const r of plan) {
    console.log(`${r.slug.padEnd(wSlug)} | ${r.campaign.padEnd(wCampaign)} | ${r.note}`);
  }
  const needsHuman = plan.filter((r) => r.note.startsWith('NEEDS-HUMAN')).length;
  console.log('');
  console.log(`${plan.length} project folders -> ${plan.length} tasks (${needsHuman} NEEDS-HUMAN)`);

  fs.mkdirSync(path.dirname(PLAN_FILE), { recursive: true });
  fs.writeFileSync(
    PLAN_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), ref: REF, playbook: PLAYBOOK_PATH, tasks: plan }, null, 2) + '\n'
  );
  console.log(`plan written to ${path.relative(REPO_ROOT, PLAN_FILE)}`);
  console.log('DRY-RUN only — no tasks were created. Seed with --seed after Remy approves this list.');
}

// ---------------------------------------------------------------------------
// Seed: identity + POST /tasks, same auth scheme as tools/agora/client.mjs
// (Bearer token from .agent/agora/client-identity[.<AGORA_AGENT_ID>].json,
// keyed by base URL).
// ---------------------------------------------------------------------------
function identityFor(baseUrl) {
  const env = process.env;
  const dir = env.AGORA_DIR
    ? path.isAbsolute(env.AGORA_DIR) ? env.AGORA_DIR : path.resolve(process.cwd(), env.AGORA_DIR)
    : path.join(REPO_ROOT, '.agent', 'agora');
  const agentKey = typeof env.AGORA_AGENT_ID === 'string' && env.AGORA_AGENT_ID.trim()
    ? env.AGORA_AGENT_ID.trim().replace(/[^A-Za-z0-9._-]/g, '_')
    : null;
  const file = path.join(dir, agentKey ? `client-identity.${agentKey}.json` : 'client-identity.json');
  if (!fs.existsSync(file)) {
    throw new Error(`no Agora identity file at ${file} — run: node tools/agora/client.mjs register <handle>`);
  }
  const all = JSON.parse(fs.readFileSync(file, 'utf8'));
  const id = all[baseUrl];
  if (!id || !id.token) {
    throw new Error(`no identity stored for ${baseUrl} in ${file} — run: node tools/agora/client.mjs register <handle>`);
  }
  return id;
}

async function seed() {
  if (!fs.existsSync(PLAN_FILE)) {
    console.error(`REFUSING to seed: plan file missing (${path.relative(REPO_ROOT, PLAN_FILE)}).`);
    console.error('Run the dry-run first, get the list approved, then re-run with --seed.');
    process.exit(1);
  }
  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
  if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) {
    throw new Error(`plan file ${PLAN_FILE} holds no tasks`);
  }
  const baseUrl = (process.env.AGORA_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const { token, handle } = identityFor(baseUrl);
  console.log(`seeding ${plan.tasks.length} tasks to ${baseUrl} as "${handle}"...`);

  let created = 0;
  for (const t of plan.tasks) {
    const res = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: t.title, body: t.description, refs: t.refs }),
    });
    const json = await res.json().catch(() => null);
    if (res.status !== 201 || !json || !json.task) {
      throw new Error(`task new failed for "${t.title}" (${res.status}): ${json ? json.error : 'no body'} — ${created} tasks already created, board is PARTIAL`);
    }
    created++;
    console.log(`  ${json.task.id}  ${t.title}  [${t.campaign}]`);
  }
  console.log(`seeded ${created} tasks.`);
}

// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const wantSeed = args.includes('--seed');
  const unknown = args.filter((a) => a !== '--seed' && a !== '--dry-run');
  if (unknown.length) {
    console.error(`unknown flag(s): ${unknown.join(' ')}. Usage: seed-absorption-wave.mjs [--dry-run | --seed]`);
    process.exit(1);
  }
  if (wantSeed) await seed();
  else dryRun(buildPlan());
}

main().catch((e) => {
  console.error(`seed-absorption-wave failed: ${e.message}`);
  process.exit(1);
});
