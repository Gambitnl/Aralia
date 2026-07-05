// Agora Orchestrator — codifies the multi-agent campaign loop so an orchestrator
// drives a wave by command instead of hand-writing the coordination contract per
// agent. See tools/agora/ORCHESTRATOR.md for the full playbook.
//
//   node tools/agora/orchestrate.mjs <command> [args]
//
//   prompt   <plan.json> <packetId>     print the ready-to-dispatch agent prompt
//   seed     <plan.json>                register orchestrator + announce the wave on the board
//   dispatch <plan.json> <packetId>     launch an EXTERNAL packet (codex|gemini) in the bg; claude => print prompt
//   gate     <plan.json> [--exclude s]  run the integration typecheck, filter to the wave's files, baseline delta
//   status                              board snapshot (agents / locks / tasks)
//   feedback [--since N]                dump WORKFLOW: messages from the board
//   help                                this message
//
// A PLAN is JSON:
//   { "wave": "name", "baseUrl": "http://localhost:4319", "baseline": 220,
//     "packets": [ { "id":"PK-x", "handle":"fixer-x", "agent":"claude|codex|gemini",
//                    "scope":"one-line", "files":["src/a.ts"], "issues":["X1"],
//                    "guidance":"optional extra instructions" } ] }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { run as clientRun } from './client.mjs';
import { OPEN_STATUSES, CLOSED_STATUSES, indexGaps } from './gapIndex.mjs';

const DEFAULT_URL = 'http://localhost:4319';
const REPO = process.cwd();
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_FILE = path.join(MODULE_DIR, 'agents.json');

// ------------------------------------------------------------- agent registry
// agents.json is the machine-readable Agent Matrix: which agents exist, their
// readiness status, policy roles, dispatch wiring, and date-bound constraints.
// validatePlan enforces it so a deprecated / orchestrator-only / unwired agent
// fails at PLAN time, not mid-campaign.
let registryCache = null;
export function loadRegistry(file = REGISTRY_FILE) {
  if (file === REGISTRY_FILE && registryCache) return registryCache;
  const reg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!reg || typeof reg.agents !== 'object') throw new Error('agents.json: missing "agents" map');
  if (file === REGISTRY_FILE) registryCache = reg;
  return reg;
}

/** Constraints whose expiresAt date has passed — they need re-verification, not trust. */
export function staleConstraints(agentDef, today = new Date()) {
  return (agentDef.constraints || []).filter(
    (c) => c.expiresAt && new Date(c.expiresAt).getTime() < today.getTime(),
  );
}

function assertDispatchableWorker(packetId, agentId, def) {
  if (!def) return; // caller reports unknown-agent with the known-id list
  if (def.status === 'deprecated') {
    throw new Error(`packet ${packetId}: agent "${agentId}" is DEPRECATED — ${def.notes || 'do not use for new lanes'}`);
  }
  if (!(def.roles || []).includes('worker')) {
    throw new Error(`packet ${packetId}: agent "${agentId}" is orchestrator-only / not a worker lane by policy — ${def.notes || ''}`);
  }
  if (def.status !== 'ready' && def.status !== 'quota_limited') {
    throw new Error(`packet ${packetId}: agent "${agentId}" is not supervision-ready (status: ${def.status}) — ${def.notes || ''}`);
  }
  const d = def.dispatch || {};
  if (d.type !== 'agent-tool' && !d.command) {
    throw new Error(`packet ${packetId}: agent "${agentId}" has no dispatch wiring (not wired into orchestrate.mjs yet) — ${def.notes || ''}`);
  }
}

// ---------------------------------------------------------------- plan loading
function loadPlan(file) {
  if (!file) throw new Error('plan file required');
  const abs = path.isAbsolute(file) ? file : path.resolve(REPO, file);
  const plan = JSON.parse(fs.readFileSync(abs, 'utf8'));
  validatePlan(plan, { onWarn: (m) => console.warn(`⚠ ${m}`) });
  plan.baseUrl = plan.baseUrl || DEFAULT_URL;
  return plan;
}

export function validatePlan(plan, { registry, onWarn } = {}) {
  if (!plan || typeof plan !== 'object') throw new Error('plan must be an object');
  if (!Array.isArray(plan.packets) || plan.packets.length === 0) throw new Error('plan.packets must be a non-empty array');
  const reg = registry || loadRegistry();
  const warn = onWarn || (() => {});
  const seenFiles = new Map(); // file -> packetId (disjointness check)
  const seenHandles = new Set();
  for (const p of plan.packets) {
    if (!p.id || !p.handle || !p.scope) throw new Error(`packet missing id/handle/scope: ${JSON.stringify(p)}`);
    if (!Array.isArray(p.files) || p.files.length === 0) throw new Error(`packet ${p.id} has no files`);
    if (seenHandles.has(p.handle)) throw new Error(`duplicate handle "${p.handle}" (each agent needs a unique identity)`);
    seenHandles.add(p.handle);
    p.agent = p.agent || 'claude';
    const def = reg.agents[p.agent];
    if (!def) throw new Error(`packet ${p.id}: unknown agent "${p.agent}" (registry has: ${Object.keys(reg.agents).join(', ')})`);
    assertDispatchableWorker(p.id, p.agent, def);
    // WF-G14: expired date-bound constraints mean re-verify, not trust.
    for (const c of staleConstraints(def)) {
      warn(`packet ${p.id}: agent "${p.agent}" has an EXPIRED constraint (${c.expiresAt}): ${c.note} — re-verify before dispatch`);
    }
    for (const a of p.after || []) {
      if (!plan.packets.some((x) => x.id === a)) {
        throw new Error(`packet ${p.id}: "after" references unknown packet "${a}"`);
      }
    }
    for (const f of p.files) {
      if (seenFiles.has(f)) {
        throw new Error(`DISJOINTNESS VIOLATION: "${f}" is owned by both ${seenFiles.get(f)} and ${p.id}. Packets in one wave must not share files.`);
      }
      seenFiles.set(f, p.id);
    }
  }
  return true;
}

const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim().slice(0, 80);

// ---------------------------------------------------------------- board seeding
/**
 * Create one board task per packet — priority/refs from the packet, `after`
 * packet-ids resolved to task deps — so the BOARD carries the wave's sequencing
 * and workers claim seeded tasks instead of inventing their own.
 * Returns { packetId -> taskId }. Multi-pass creation honors dependency order;
 * an `after` cycle fails honestly.
 */
/** Per-wave orchestrator identity dir (WF-G10): two concurrent campaigns must
 *  not share an identity file — last-write-wins clobbers the first one's token. */
function orchIdentityDir(plan) {
  const wave = String(plan.wave || 'unnamed').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `.agent/agora/ids/orchestrator-${wave}`;
}

export async function seedPlan(plan, { env } = {}) {
  env = env || { ...process.env, AGORA_DIR: orchIdentityDir(plan) };
  const baseUrl = plan.baseUrl || DEFAULT_URL;
  validateRefsAgainstIndex(plan); // WF-G12: fail on ambiguous refs, warn on unknown
  const reg = await clientRun(['register', `orchestrator-${plan.wave || 'unnamed'}`, '--note', `wave:${plan.wave || 'unnamed'} coordinator`], { env, baseUrl });
  if (reg.code !== 0) throw new Error(`seed: orchestrator registration failed: ${(reg.lines || []).join(' / ')}`);

  const seeded = {};
  let remaining = [...plan.packets];
  while (remaining.length) {
    const creatable = remaining.filter((p) => (p.after || []).every((a) => seeded[a]));
    if (creatable.length === 0) {
      throw new Error(`seed: circular/unresolvable "after" chain among: ${remaining.map((p) => p.id).join(', ')}`);
    }
    for (const pkt of creatable) {
      const argv = ['task', 'new', `${pkt.id}: ${pkt.scope}`, '--id-only'];
      if (pkt.files && pkt.files.length) argv.push('--body', `files: ${pkt.files.join(', ')}`);
      if (typeof pkt.priority === 'number') argv.push('--priority', String(pkt.priority));
      for (const ref of pkt.issues || []) argv.push('--ref', ref);
      for (const a of pkt.after || []) argv.push('--dep', seeded[a]);
      const r = await clientRun(argv, { env, baseUrl });
      if (r.code !== 0 || !r.task) throw new Error(`seed: task creation for ${pkt.id} failed: ${(r.lines || []).join(' / ')}`);
      seeded[pkt.id] = r.task.id;
    }
    remaining = remaining.filter((p) => !seeded[p.id]);
  }
  return seeded;
}

function seedFilePath(plan) {
  const wave = String(plan.wave || 'unnamed').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.resolve(REPO, '.agent/scratch/orchestrate', `seed-${wave}.json`);
}

/** WF-G10: a MISSING seed map is a legitimate state (un-seeded wave → workers
 *  create their own tasks) and gets a loud warning; a CORRUPT one is an error,
 *  never a silent `{}` that quietly builds TID-less prompts. */
function loadSeededMap(plan) {
  const file = seedFilePath(plan);
  if (!fs.existsSync(file)) {
    console.warn(`⚠ no seed map at ${file} — workers will create their own tasks. Run: orchestrate seed <plan> for board-tracked waves.`);
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`seed map ${file} exists but is unreadable (${e.message}) — re-run: orchestrate seed <plan>`);
  }
}

/** WF-G12: resolve packet issue-refs against the gap index at seed time.
 *  Ambiguous bare ids (same gap id in several projects) are ERRORS; unknown
 *  refs are warnings (ad-hoc issue codes like M1 are legitimate). Index
 *  unavailability skips validation (docs/projects may be absent). */
function validateRefsAgainstIndex(plan) {
  let gaps;
  try {
    gaps = indexGaps({ root: 'docs/projects' }).concat(indexGaps({ root: 'tools/agora' }));
  } catch {
    return;
  }
  const byBare = new Map();
  const qualified = new Set();
  for (const g of gaps) {
    qualified.add(`${g.project}:${g.id}`.toLowerCase());
    const bare = g.id.toLowerCase();
    if (!byBare.has(bare)) byBare.set(bare, g.project);
    else if (byBare.get(bare) !== g.project) byBare.set(bare, 'ambiguous');
  }
  for (const p of plan.packets) {
    for (const ref of p.issues || []) {
      const low = String(ref).toLowerCase();
      if (low.includes(':')) {
        if (!qualified.has(low)) console.warn(`⚠ packet ${p.id}: ref "${ref}" matches no indexed gap (typo? unindexed registry?)`);
      } else if (byBare.get(low) === 'ambiguous') {
        throw new Error(`packet ${p.id}: ref "${ref}" is AMBIGUOUS — that gap id exists in multiple projects; qualify it as <project>:${ref}`);
      } else if (!byBare.has(low)) {
        console.warn(`⚠ packet ${p.id}: ref "${ref}" matches no indexed gap (ok for ad-hoc issue codes; qualify as <project>:<id> for tracker gaps)`);
      }
    }
  }
}

// ---------------------------------------------------------------- wave lifecycle
/**
 * Where does a seeded wave stand? A seeded task id missing from the board
 * counts as pending (honest unknown). Complete = every packet done or blocked.
 */
export function waveStatus(seededMap, tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const done = [];
  const blocked = [];
  const pending = [];
  for (const [packetId, taskId] of Object.entries(seededMap)) {
    const t = byId.get(taskId);
    const entry = { packetId, taskId, task: t || null };
    if (t && t.state === 'done') done.push(entry);
    else if (t && t.state === 'blocked') blocked.push(entry);
    else pending.push(entry);
  }
  return { done, blocked, pending, complete: pending.length === 0 };
}

/** Campaign retrospective from the seeded tasks' history: timings, claimants,
 *  reap counts, recorded results. */
export function buildWaveReport(seededMap, tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const packets = [];
  const totals = { done: 0, blocked: 0, pending: 0, reaps: 0 };
  for (const [packetId, taskId] of Object.entries(seededMap)) {
    const t = byId.get(taskId);
    if (!t) {
      packets.push({ packetId, taskId, state: 'missing', reaps: 0, msToDone: null, claimedBy: null, result: null });
      totals.pending++;
      continue;
    }
    const created = t.history.find((h) => h.action === 'created');
    const doneEntry = [...t.history].reverse().find((h) => h.action === 'state' && h.state === 'done');
    const reaps = t.history.filter((h) => h.action === 'reaped').length;
    packets.push({
      packetId,
      taskId,
      state: t.state,
      claimedBy: t.claimedBy,
      reaps,
      msToDone: created && doneEntry ? doneEntry.at - created.at : null,
      result: t.result || null,
    });
    totals.reaps += reaps;
    if (t.state === 'done') totals.done++;
    else if (t.state === 'blocked') totals.blocked++;
    else totals.pending++;
  }
  return { packets, totals };
}

/**
 * The board→tracker close-loop: match done tasks' refs against the gap index.
 * Refs match a gap by `<project>:<gapId>` or bare `<gapId>`. Returns:
 *   staleOpen      — gap still open in GAPS.md but its task is done → the row needs closing
 *   alreadyClosed  — gap already closed in the tracker → nothing to do
 *   unmatchedRefs  — ref matches no gap at all → typo or unindexed registry
 */
export function reconcileGaps(doneTasks, allGaps) {
  const byKey = new Map();
  for (const g of allGaps) {
    byKey.set(`${g.project}:${g.id}`.toLowerCase(), g);
    // Bare ids are only usable when UNAMBIGUOUS — gap ids like G5 exist in
    // 30+ projects (measured 2026-07-02); first-match-wins would silently
    // reconcile against the wrong project.
    const bare = g.id.toLowerCase();
    if (!byKey.has(bare)) byKey.set(bare, g);
    else if (byKey.get(bare) !== 'ambiguous' && byKey.get(bare).project !== g.project) byKey.set(bare, 'ambiguous');
  }
  const staleOpen = [];
  const alreadyClosed = [];
  const unmatchedRefs = [];
  const ambiguousRefs = [];
  const unrecognizedStatus = [];
  for (const t of doneTasks) {
    if (t.state !== 'done') continue;
    for (const ref of t.refs || []) {
      const gap = byKey.get(String(ref).toLowerCase());
      if (gap === 'ambiguous') { ambiguousRefs.push(ref); continue; }
      if (!gap) { unmatchedRefs.push(ref); continue; }
      if (OPEN_STATUSES.has(gap.status)) staleOpen.push({ ref, task: t, gap });
      else if (CLOSED_STATUSES.has(gap.status)) alreadyClosed.push({ ref, task: t, gap });
      else unrecognizedStatus.push({ ref, task: t, gap }); // WF-G13: surface, don't swallow
    }
  }
  return { staleOpen, alreadyClosed, unmatchedRefs, ambiguousRefs, unrecognizedStatus };
}

// ---------------------------------------------------------------- prompt build
export function buildPrompt(plan, pkt, { taskId } = {}) {
  const B = plan.baseUrl || DEFAULT_URL;
  const files = pkt.files.join(' ');
  const ownedList = pkt.files.map((f) => '`' + f + '`').join(', ');
  const external = pkt.agent === 'codex' || pkt.agent === 'gemini';

  const hardRules = external
    ? `You are external fix-agent "${pkt.handle}" in a coordinated multi-agent fleet on the Aralia repo. You are ALREADY in the repo root (F:\\Repos\\Aralia). Other agents edit OTHER files in this SAME checkout right now.
HARD RULES: No git commands (no commit/reset/checkout/branch). No worktrees. Do NOT run builds/tsc/tests. Separate shell calls do NOT share env vars on this PowerShell host — set AGORA_AGENT_ID inline on each call or chain with ';'.`
    : `You are fix-agent **${pkt.handle}** in a coordinated multi-agent UX-fix fleet (Aralia, cwd F:\\Repos\\Aralia, Windows; Bash tool). ALL agents share ONE checkout — NO worktrees/branches/commits. Edit ONLY your owned files.`;

  return `${hardRules}

Packet **${pkt.id}** — ${pkt.scope}${pkt.issues && pkt.issues.length ? ` (issues: ${pkt.issues.join(', ')})` : ''}.
Owned files (edit ONLY these): ${ownedList}.
${pkt.guidance ? `\nGuidance:\n${pkt.guidance}\n` : ''}
STEP 1 — Join Agora (run via shell; set AGORA_AGENT_ID each call — shell state does not persist).
Your identity "${pkt.handle}" is ASSIGNED to you by the orchestrator and is unique across the fleet — always use it, never invent your own:
  export AGORA_AGENT_ID=${pkt.handle}
  B=${B}
  node tools/agora/client.mjs register ${pkt.handle} --note "${oneLine(pkt.scope)}" --model ${pkt.model || pkt.agent} --url $B
  #  (optional) add --session <your conversation/thread id> so peers can trace which session you are
${taskId
    ? `  TID=${taskId}
  node tools/agora/client.mjs task claim "$TID" --url $B`
    : `  TID=$(node tools/agora/client.mjs task new "${oneLine(pkt.scope)}" --id-only --url $B)
  node tools/agora/client.mjs task claim "$TID" --url $B`}
  node tools/agora/client.mjs lock ${files} --reason "${pkt.id}" --url $B
  node tools/agora/client.mjs say "starting ${pkt.id}" --url $B
If work will take >20 minutes, keep presence alive in the background (silent >60min = reaped):
  node tools/agora/client.mjs heartbeat --every 600 --url $B &
FAILURE HANDLING:
- task claim fails (409 = someone else claimed it): say "409 on task ${pkt.id} — standing down" and STOP; do not create a replacement task.
- lock returns CONFLICT/409: do NOT edit that file; say "409 CONFLICT: <file> held by <holder>" and skip that file.
- any call returns 401 mid-work: you were reaped (too long silent). Re-register with the SAME handle (add --allow-duplicate in case your old record lingers), then re-claim "$TID" and re-lock before continuing.

STEP 2 — Fix the issue(s) in ONLY your owned (successfully-locked) files, matching surrounding style. If a fix needs a file you don't own, do NOT edit it — report it as a cross-file follow-up.

STEP 3 — Do NOT run tsc/build/vitest/dev-server (the orchestrator runs the integration gate). Self-review your edits for correctness.

STEP 4 — Wrap up + REQUIRED workflow feedback (BOTH the say broadcast — live coordination — AND task done --result — the durable record the orchestrator verifies — are required):
  node tools/agora/client.mjs say "done ${pkt.id}: <one-line of what you changed>" --url $B
  node tools/agora/client.mjs task done "$TID" --result "<files changed + concrete proof (e.g. 'a.tsx,b.ts; self-reviewed, matches M1 spec')>" --url $B
  node tools/agora/client.mjs unlock --mine --url $B
  node tools/agora/client.mjs say "WORKFLOW: <any friction with THIS coordination workflow itself, or 'none'>" --url $B
${external ? `\nFINALLY write a <=8-line report to .agent/scratch/orchestrate/${pkt.handle}.md: what you changed per file + your WORKFLOW feedback.` : ''}
RETURN: per issue what you changed (file + concrete change), any cross-file follow-ups, any 409s, and your WORKFLOW feedback.`;
}

// ---------------------------------------------------------------- board ops
async function board(plan, argv) {
  const env = { ...process.env, AGORA_DIR: orchIdentityDir(plan) };
  const res = await clientRun(argv, { env, baseUrl: plan.baseUrl });
  for (const l of res.lines || []) console.log(l);
  return res;
}

async function cmdSeed(plan) {
  const seeded = await seedPlan(plan);
  const file = seedFilePath(plan);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(seeded, null, 2) + '\n');
  const ext = plan.packets.filter((p) => p.agent !== 'claude').map((p) => `${p.handle}(${p.agent})`);
  const cla = plan.packets.filter((p) => p.agent === 'claude').map((p) => p.handle);
  const msg = `WAVE ${plan.wave || ''} seeded: ${plan.packets.length} disjoint packets AS BOARD TASKS (deps gate the ready queue). claude=[${cla.join(', ')}] external=[${ext.join(', ')}]. Each agent: claim your seeded task, lock-before-edit, own files only, done --result, WORKFLOW feedback.`;
  await board(plan, ['say', msg]);
  console.log(`\n✅ seeded wave "${plan.wave || ''}" — ${plan.packets.length} packet task(s) created on the board (${plan.baseUrl}/ dashboard).`);
  for (const p of plan.packets) {
    console.log(`   ${p.id.padEnd(16)} task ${seeded[p.id]}${(p.after || []).length ? `  (after ${p.after.join(', ')})` : ''}`);
  }
  console.log(`   Seed map: ${file} (prompt/dispatch inject the task ids automatically).`);
  console.log(`   Next: dispatch each packet — claude via the Agent tool (orchestrate prompt …), external via: orchestrate dispatch ${process.argv[3] || '<plan>'} <packetId>`);
}

async function cmdStatus(plan) {
  console.log('=== agents ==='); await board(plan, ['agents']);
  console.log('=== locks ===');  await board(plan, ['locks']);
  console.log('=== tasks ===');  await board(plan, ['tasks']);
}

async function cmdFeedback(plan, since) {
  const res = await board(plan, ['inbox', '--since', String(since || 0)]);
  const lines = (res.lines || []).filter((l) => /WORKFLOW:/i.test(l));
  console.log(lines.length ? `\n${lines.length} WORKFLOW message(s):` : '\n(no WORKFLOW messages yet)');
}

// ---------------------------------------------------------------- wave commands
async function fetchTasks(plan) {
  const env = { ...process.env, AGORA_DIR: orchIdentityDir(plan) };
  const res = await clientRun(['tasks'], { env, baseUrl: plan.baseUrl });
  return res.tasks || [];
}

async function cmdWatch(plan, { intervalSec = 20, timeoutMin = 120 } = {}) {
  const seeded = loadSeededMap(plan);
  if (!Object.keys(seeded).length) {
    console.log(`no seed map at ${seedFilePath(plan)} — run: orchestrate seed <plan> first`);
    return 1;
  }
  const deadline = Date.now() + timeoutMin * 60000;
  let lastSummary = '';
  for (;;) {
    const status = waveStatus(seeded, await fetchTasks(plan));
    const summary = `done ${status.done.length} / blocked ${status.blocked.length} / pending ${status.pending.length}`;
    if (summary !== lastSummary) {
      console.log(`[${new Date().toLocaleTimeString()}] ${summary}` +
        (status.pending.length ? `  (waiting on: ${status.pending.map((p) => p.packetId).join(', ')})` : ''));
      lastSummary = summary;
    }
    if (status.complete) {
      console.log(`\n✅ wave "${plan.wave || ''}" complete.`);
      for (const d of status.done) {
        console.log(`  ${d.packetId.padEnd(16)} done${d.task && d.task.result ? ` — ${d.task.result}` : ' (no result recorded)'}`);
      }
      for (const b of status.blocked) console.log(`  ${b.packetId.padEnd(16)} ⚠ BLOCKED`);
      return status.blocked.length ? 1 : 0;
    }
    if (Date.now() >= deadline) {
      console.log(`\n⏱ watch timeout (${timeoutMin}m) — still pending: ${status.pending.map((p) => p.packetId).join(', ')}`);
      return 1;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalSec * 1000));
  }
}

async function cmdReport(plan) {
  const seeded = loadSeededMap(plan);
  if (!Object.keys(seeded).length) {
    console.log(`no seed map at ${seedFilePath(plan)} — run: orchestrate seed <plan> first`);
    return 1;
  }
  const rep = buildWaveReport(seeded, await fetchTasks(plan));
  console.log(`Wave "${plan.wave || ''}" report — ${rep.totals.done} done / ${rep.totals.blocked} blocked / ${rep.totals.pending} pending / ${rep.totals.reaps} reap(s):\n`);
  for (const p of rep.packets) {
    const mins = p.msToDone != null ? `${Math.round(p.msToDone / 60000)}m` : '—';
    console.log(`  ${p.packetId.padEnd(16)} [${p.state}]  time-to-done ${mins}${p.reaps ? `  ⚠ reaped×${p.reaps}` : ''}`);
    if (p.result) console.log(`      result: ${p.result}`);
  }
  return 0;
}

async function cmdReconcile(plan, root = 'docs/projects', { apply = false } = {}) {
  const { updateGapRow } = await import('./gapIndex.mjs');
  const tasks = (await fetchTasks(plan)).filter((t) => t.state === 'done' && (t.refs || []).length);
  // Always include the workflow registry so `workflow:WF-Gn` refs resolve.
  const gaps = indexGaps({ root }).concat(root === 'tools/agora' ? [] : indexGaps({ root: 'tools/agora' }));
  const rec = reconcileGaps(tasks, gaps);
  console.log(`Reconcile (board done-tasks vs ${root} GAPS registries)${apply ? ' — APPLYING row updates' : ''}:`);
  if (!rec.staleOpen.length) console.log('  ✅ no stale-open gaps — tracker matches the board.');
  // --apply respects Agora locks: a registry file locked by another agent is skipped.
  let heldPaths = [];
  if (apply) {
    const lr = await board(plan, ['locks']);
    heldPaths = (lr.locks || []).flatMap((l) => [...(l.paths || []), ...(l.globs || [])]);
  }
  for (const s of rec.staleOpen) {
    console.log(`  ⚠ ${s.ref} is DONE on the board but still "${s.gap.status}" in ${s.gap.file}`);
    console.log(`      task: ${s.task.title}`);
    if (s.task.result) console.log(`      evidence: ${s.task.result}`);
    if (apply) {
      const locked = heldPaths.some((p) => s.gap.file.includes(p) || p.includes(s.gap.file));
      if (locked) { console.log('      ⏭ SKIPPED — that registry file is Agora-locked by another agent.'); continue; }
      const abs = path.resolve(REPO, s.gap.file);
      const ok = updateGapRow(abs, s.gap.id, {
        status: 'resolved',
        appendEvidence: `board-reconciled 2026: task "${s.task.title}"${s.task.result ? ` — ${s.task.result}` : ''}`,
      });
      console.log(ok ? '      ✍ row updated → resolved (evidence appended).' : '      ✗ row not found in the file — update manually.');
    } else {
      console.log(`      → update that GAPS.md row (status + evidence), or re-run with --apply.`);
    }
  }
  if (rec.unrecognizedStatus && rec.unrecognizedStatus.length) {
    for (const u of rec.unrecognizedStatus) {
      console.log(`  ？ ${u.ref}: gap status "${u.gap.status}" is neither open nor closed vocabulary — inspect ${u.gap.file}`);
    }
  }
  if (rec.ambiguousRefs && rec.ambiguousRefs.length) {
    console.log(`  ⚠ AMBIGUOUS bare refs (same gap id in multiple projects — qualify as <project>:<id>): ${[...new Set(rec.ambiguousRefs)].join(', ')}`);
  }
  if (rec.unmatchedRefs.length) {
    console.log(`  ✳ refs matching no indexed gap: ${[...new Set(rec.unmatchedRefs)].join(', ')} (typo, or registry not under ${root})`);
  }
  if (rec.alreadyClosed.length) console.log(`  (${rec.alreadyClosed.length} ref(s) already closed in the tracker — consistent)`);
  return rec.staleOpen.length ? 1 : 0;
}

// ---------------------------------------------------------------- registry view
function cmdAgents() {
  const reg = loadRegistry();
  const today = new Date();
  console.log(`Agent Matrix registry (tools/agora/agents.json, updated ${reg.updated || '?'}):\n`);
  for (const [id, def] of Object.entries(reg.agents)) {
    const roles = (def.roles || []).join('+') || 'none';
    const dispatchable = (def.dispatch || {}).type === 'agent-tool' || (def.dispatch || {}).command;
    const flags = [];
    if (def.status === 'deprecated') flags.push('DO NOT DISPATCH');
    else if (!(def.roles || []).includes('worker')) flags.push('not a worker lane');
    else if (!dispatchable) flags.push('NOT WIRED for dispatch');
    const stale = staleConstraints(def, today);
    for (const c of stale) flags.push(`constraint EXPIRED ${c.expiresAt} — re-verify: ${c.note}`);
    console.log(`${id.padEnd(10)} ${String(def.status).padEnd(14)} roles:${roles.padEnd(20)} ${def.label || ''}${flags.length ? `\n${' '.repeat(11)}⚠ ${flags.join('; ')}` : ''}`);
    for (const c of def.constraints || []) {
      if (!stale.includes(c)) console.log(`${' '.repeat(11)}- ${c.note}${c.expiresAt ? ` (until ${c.expiresAt})` : ''}`);
    }
  }
  console.log('\nWorker-dispatchable = role "worker" + status ready/quota_limited + dispatch wiring. validatePlan enforces this.');
}

// ---------------------------------------------------------------- dispatch
async function cmdDispatch(plan, packetId) {
  const pkt = plan.packets.find((p) => p.id === packetId || p.handle === packetId);
  if (!pkt) throw new Error(`no packet "${packetId}" in plan`);
  const prompt = buildPrompt(plan, pkt, { taskId: loadSeededMap(plan)[pkt.id] });

  if (pkt.agent === 'claude') {
    const dir = path.resolve(REPO, '.agent/scratch/orchestrate');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${pkt.handle}.prompt.txt`);
    fs.writeFileSync(out, prompt);
    console.log(`claude packet "${pkt.id}" — a script cannot spawn Claude subagents.`);
    console.log(`Dispatch it via the Agent tool (model: opus) with the prompt written to:\n  ${out}`);
    return;
  }

  // External CLI: write prompt, probe quota, launch in background, log.
  const dir = path.resolve(REPO, '.agent/scratch/orchestrate');
  fs.mkdirSync(dir, { recursive: true });
  const promptFile = path.join(dir, `${pkt.handle}.prompt.txt`);
  const logFile = path.join(dir, `${pkt.handle}.log`);
  fs.writeFileSync(promptFile, prompt);

  const probe = probeAgent(pkt.agent);
  if (!probe.ok) {
    console.log(`⚠ ${pkt.agent} unavailable: ${probe.reason}`);
    console.log(`  Fallback: re-assign packet ${pkt.id} to another agent (claude, or the other external) and re-dispatch.`);
    return;
  }

  const { cmd, args } = launchSpec(pkt.agent, prompt);
  const logFd = fs.openSync(logFile, 'w');
  // WF-G1: external agents run no Claude hooks — prepend the git shim to their
  // PATH so destructive git funnels through the same guard.
  const shimDir = path.join(MODULE_DIR, 'git-shim');
  const env = { ...process.env, PATH: `${shimDir}${path.delimiter}${process.env.PATH || ''}` };
  const child = spawn(cmd, args, { cwd: REPO, detached: true, stdio: ['ignore', logFd, logFd], env });
  child.unref();
  console.log(`🚀 dispatched ${pkt.agent} packet "${pkt.id}" (pid ${child.pid}).`);
  console.log(`   prompt: ${promptFile}`);
  console.log(`   log:    ${logFile}   (tail it / await completion, then: orchestrate gate <plan>)`);
}

// WF-G5: quota probes and launch specs are REGISTRY-DRIVEN — a new agent needs
// only agents.json entries (dispatch.command/args + quotaProbe), zero code here.
export function probeAgent(agent, registry = loadRegistry()) {
  const def = registry.agents[agent];
  const probe = def && def.quotaProbe;
  if (!probe || !probe.command) return { ok: false, reason: `no quotaProbe defined for "${agent}" in agents.json` };
  try {
    const out = execFileSync(probe.command, probe.args || [], {
      cwd: REPO,
      timeout: probe.timeoutMs || 70000,
      encoding: 'utf8',
      // Shell only for bare command names (npm .cmd shims need it); absolute
      // paths spawn directly so arg quoting stays intact.
      shell: process.platform === 'win32' && !path.isAbsolute(probe.command),
    });
    if (probe.dryPattern && new RegExp(probe.dryPattern, 'i').test(out)) {
      return { ok: false, reason: probe.dryReason || 'quota exhausted' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).split('\n')[0] };
  }
}

export function launchSpec(agent, prompt, registry = loadRegistry()) {
  const def = registry.agents[agent];
  const d = def && def.dispatch;
  if (d && d.command) return { cmd: d.command, args: [...(d.args || []), prompt] };
  throw new Error(`no launch spec for ${agent} (agents.json dispatch.command missing)`);
}

// ---------------------------------------------------------------- gate
function cmdGate(plan, exclude, only) {
  // --only <id,id,...> restricts the gate to specific packets' files — use it to
  // gate ONE WAVE at a time (the rest of the plan's files aren't built yet, so
  // their pre-existing errors would otherwise dirty a per-wave check).
  const onlyIds = only ? only.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const inScope = onlyIds
    ? plan.packets.filter((p) => onlyIds.includes(p.id) || onlyIds.includes(p.handle))
    : plan.packets;
  if (onlyIds && inScope.length === 0) { console.log(`--only matched no packets (have: ${plan.packets.map((p) => p.id).join(', ')})`); return 1; }
  const files = [...new Set(inScope.flatMap((p) => p.files))];
  console.log(`Integration gate: typechecking, filtering to ${files.length} ${onlyIds ? `file(s) from ${inScope.length} packet(s) [${inScope.map((p) => p.id).join(', ')}]` : 'wave file(s)'}…`);
  let total = 0;
  let raw = '';
  try {
    raw = execFileSync('node', ['node_modules/typescript/lib/tsc.js', '-b'], { cwd: REPO, encoding: 'utf8', timeout: 300000 });
  } catch (e) {
    raw = (e.stdout || '') + (e.stderr || ''); // tsc exits non-zero with errors on stdout
  }
  const errLines = raw.split('\n').filter((l) => /error TS/.test(l));
  total = errLines.length;
  const norm = (s) => s.replace(/\\/g, '/');
  const fileSet = files.map(norm);
  const excludeRe = exclude ? new RegExp(exclude) : null;
  const waveErrors = errLines.filter((l) => {
    const n = norm(l);
    if (excludeRe && excludeRe.test(n)) return false;
    return fileSet.some((f) => n.includes(f));
  });

  console.log(`\nTotal project errors: ${total}` + (plan.baseline != null ? `  (baseline ${plan.baseline}; delta ${total - plan.baseline >= 0 ? '+' : ''}${total - plan.baseline})` : ''));
  if (waveErrors.length === 0) {
    console.log('✅ GATE PASS — no errors in the scoped file(s)' + (excludeRe ? ' (excluding the known-preexisting filter)' : '') + '.');
    if (!onlyIds && plan.baseline != null && total > plan.baseline) console.log(`⚠ total rose above baseline (${plan.baseline}→${total}) but not in scoped files — investigate non-wave fallout.`);
    return 0;
  }
  console.log(`❌ GATE FAIL — ${waveErrors.length} error(s) in this wave's files:`);
  for (const l of waveErrors.slice(0, 40)) console.log('  ' + l.trim());
  return 1;
}

// ---------------------------------------------------------------- cli
const HELP = `Agora Orchestrator — drive a multi-agent campaign wave.
  node tools/agora/orchestrate.mjs agents                    print the Agent Matrix registry (statuses, policy, expired constraints)
  node tools/agora/orchestrate.mjs prompt   <plan.json> <packetId>
  node tools/agora/orchestrate.mjs seed     <plan.json>
  node tools/agora/orchestrate.mjs dispatch <plan.json> <packetId>
  node tools/agora/orchestrate.mjs gate     <plan.json> [--exclude <regex>] [--only <id,id>]   (--only = gate ONE wave's packets)
  node tools/agora/orchestrate.mjs watch    <plan.json> [--interval s] [--timeout min]   block until every seeded task is done/blocked
  node tools/agora/orchestrate.mjs report   <plan.json>                                  wave retrospective (timings, reaps, results)
  node tools/agora/orchestrate.mjs reconcile <plan.json> [--root docs/projects] [--apply]   done tasks vs still-open GAPS.md rows (--apply writes status+evidence into the rows, honoring Agora locks)
  node tools/agora/orchestrate.mjs status   <plan.json>
  node tools/agora/orchestrate.mjs feedback <plan.json> [--since N]
See tools/agora/ORCHESTRATOR.md for the full loop.`;

function getFlag(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main() {
  const [cmd, planArg, packetArg] = process.argv.slice(2);
  if (!cmd || cmd === 'help') { console.log(HELP); return; }
  if (cmd === 'agents') { cmdAgents(); return; }
  if (cmd === 'prompt') {
    const plan = loadPlan(planArg);
    const pkt = requirePacket(plan, packetArg);
    console.log(buildPrompt(plan, pkt, { taskId: loadSeededMap(plan)[pkt.id] }));
    return;
  }
  const plan = loadPlan(planArg);
  if (cmd === 'seed') return void (await cmdSeed(plan));
  if (cmd === 'status') return void (await cmdStatus(plan));
  if (cmd === 'feedback') return void (await cmdFeedback(plan, Number(getFlag(process.argv, '--since') || 0)));
  if (cmd === 'dispatch') return void (await cmdDispatch(plan, packetArg));
  if (cmd === 'watch') {
    process.exitCode = await cmdWatch(plan, {
      intervalSec: Number(getFlag(process.argv, '--interval')) || 20,
      timeoutMin: Number(getFlag(process.argv, '--timeout')) || 120,
    });
    return;
  }
  if (cmd === 'report') { process.exitCode = await cmdReport(plan); return; }
  if (cmd === 'reconcile') {
    process.exitCode = await cmdReconcile(plan, getFlag(process.argv, '--root') || 'docs/projects', { apply: process.argv.includes('--apply') });
    return;
  }
  if (cmd === 'gate') process.exitCode = cmdGate(plan, getFlag(process.argv, '--exclude'), getFlag(process.argv, '--only'));
  else { console.log(`unknown command "${cmd}"\n\n${HELP}`); process.exitCode = 1; }
}

function requirePacket(plan, id) {
  const p = plan.packets.find((x) => x.id === id || x.handle === id);
  if (!p) throw new Error(`no packet "${id}" in plan (have: ${plan.packets.map((x) => x.id).join(', ')})`);
  return p;
}

export function isMainModule() {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return invoked === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
}

if (isMainModule()) {
  main().catch((e) => { console.error('orchestrate error:', e.message); process.exitCode = 1; });
}
