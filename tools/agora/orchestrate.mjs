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
import { spawn, execFileSync } from 'node:child_process';
import { run as clientRun } from './client.mjs';

const DEFAULT_URL = 'http://localhost:4319';
const REPO = process.cwd();

// ---------------------------------------------------------------- plan loading
function loadPlan(file) {
  if (!file) throw new Error('plan file required');
  const abs = path.isAbsolute(file) ? file : path.resolve(REPO, file);
  const plan = JSON.parse(fs.readFileSync(abs, 'utf8'));
  validatePlan(plan);
  plan.baseUrl = plan.baseUrl || DEFAULT_URL;
  return plan;
}

export function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('plan must be an object');
  if (!Array.isArray(plan.packets) || plan.packets.length === 0) throw new Error('plan.packets must be a non-empty array');
  const seenFiles = new Map(); // file -> packetId (disjointness check)
  const seenHandles = new Set();
  for (const p of plan.packets) {
    if (!p.id || !p.handle || !p.scope) throw new Error(`packet missing id/handle/scope: ${JSON.stringify(p)}`);
    if (!Array.isArray(p.files) || p.files.length === 0) throw new Error(`packet ${p.id} has no files`);
    if (seenHandles.has(p.handle)) throw new Error(`duplicate handle "${p.handle}" (each agent needs a unique identity)`);
    seenHandles.add(p.handle);
    p.agent = p.agent || 'claude';
    if (!['claude', 'codex', 'gemini'].includes(p.agent)) throw new Error(`packet ${p.id}: unknown agent "${p.agent}"`);
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

// ---------------------------------------------------------------- prompt build
export function buildPrompt(plan, pkt) {
  const B = plan.baseUrl || DEFAULT_URL;
  const files = pkt.files.join(' ');
  const ownedList = pkt.files.map((f) => '`' + f + '`').join(', ');
  const external = pkt.agent === 'codex' || pkt.agent === 'gemini';

  const hardRules = external
    ? `You are external fix-agent "${pkt.handle}" in a coordinated multi-agent fleet on the Aralia repo. You are ALREADY in the repo root (F:\\Repos\\Aralia). Other agents edit OTHER files in this SAME checkout right now.
HARD RULES: No git commands (no commit/reset/checkout/branch). No worktrees. Do NOT run builds/tsc/tests. Separate shell calls do NOT share env vars on this PowerShell host — set AGORA_DIR inline on each call or chain with ';'.`
    : `You are fix-agent **${pkt.handle}** in a coordinated multi-agent UX-fix fleet (Aralia, cwd F:\\Repos\\Aralia, Windows; Bash tool). ALL agents share ONE checkout — NO worktrees/branches/commits. Edit ONLY your owned files.`;

  return `${hardRules}

Packet **${pkt.id}** — ${pkt.scope}${pkt.issues && pkt.issues.length ? ` (issues: ${pkt.issues.join(', ')})` : ''}.
Owned files (edit ONLY these): ${ownedList}.
${pkt.guidance ? `\nGuidance:\n${pkt.guidance}\n` : ''}
STEP 1 — Join Agora (run via shell; set AGORA_DIR each call — shell state does not persist):
  export AGORA_DIR=.agent/agora/ids/${pkt.handle}
  B=${B}
  node tools/agora/client.mjs register ${pkt.handle} --note "${oneLine(pkt.scope)}" --url $B
  TID=$(node tools/agora/client.mjs task new "${oneLine(pkt.scope)}" --id-only --url $B)
  node tools/agora/client.mjs task claim "$TID" --url $B
  node tools/agora/client.mjs lock ${files} --reason "${pkt.id}" --url $B
  node tools/agora/client.mjs say "starting ${pkt.id}" --url $B
If a lock returns CONFLICT/409: do NOT edit that file; report it and stop on that file.

STEP 2 — Fix the issue(s) in ONLY your owned (successfully-locked) files, matching surrounding style. If a fix needs a file you don't own, do NOT edit it — report it as a cross-file follow-up.

STEP 3 — Do NOT run tsc/build/vitest/dev-server (the orchestrator runs the integration gate). Self-review your edits for correctness.

STEP 4 — Wrap up + REQUIRED workflow feedback:
  node tools/agora/client.mjs say "done ${pkt.id}: <one-line of what you changed>" --url $B
  node tools/agora/client.mjs task done "$TID" --url $B
  node tools/agora/client.mjs unlock --mine --url $B
  node tools/agora/client.mjs say "WORKFLOW: <any friction with THIS coordination workflow itself, or 'none'>" --url $B
${external ? `\nFINALLY write a <=8-line report to .agent/scratch/orchestrate/${pkt.handle}.md: what you changed per file + your WORKFLOW feedback.` : ''}
RETURN: per issue what you changed (file + concrete change), any cross-file follow-ups, any 409s, and your WORKFLOW feedback.`;
}

// ---------------------------------------------------------------- board ops
async function board(plan, argv) {
  const env = { ...process.env, AGORA_DIR: '.agent/agora/ids/orchestrator' };
  const res = await clientRun(argv, { env, baseUrl: plan.baseUrl });
  for (const l of res.lines || []) console.log(l);
  return res;
}

async function cmdSeed(plan) {
  await board(plan, ['register', 'orchestrator', '--note', `wave:${plan.wave || 'unnamed'} coordinator`]);
  const ext = plan.packets.filter((p) => p.agent !== 'claude').map((p) => `${p.handle}(${p.agent})`);
  const cla = plan.packets.filter((p) => p.agent === 'claude').map((p) => p.handle);
  const msg = `WAVE ${plan.wave || ''} seeded: ${plan.packets.length} disjoint packets. claude=[${cla.join(', ')}] external=[${ext.join(', ')}]. Each agent: lock-before-edit, own files only, WORKFLOW feedback.`;
  await board(plan, ['say', msg]);
  console.log(`\n✅ seeded wave "${plan.wave || ''}" — ${plan.packets.length} packets announced on the board (${plan.baseUrl}/ dashboard).`);
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

// ---------------------------------------------------------------- dispatch
async function cmdDispatch(plan, packetId) {
  const pkt = plan.packets.find((p) => p.id === packetId || p.handle === packetId);
  if (!pkt) throw new Error(`no packet "${packetId}" in plan`);
  const prompt = buildPrompt(plan, pkt);

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
  const child = spawn(cmd, args, { cwd: REPO, detached: true, stdio: ['ignore', logFd, logFd] });
  child.unref();
  console.log(`🚀 dispatched ${pkt.agent} packet "${pkt.id}" (pid ${child.pid}).`);
  console.log(`   prompt: ${promptFile}`);
  console.log(`   log:    ${logFile}   (tail it / await completion, then: orchestrate gate <plan>)`);
}

function probeAgent(agent) {
  try {
    if (agent === 'codex') {
      const out = execFileSync('codex', ['exec', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', 'Reply with exactly: PROBE_OK'], { cwd: REPO, timeout: 60000, encoding: 'utf8' });
      if (/usage limit|quota/i.test(out)) return { ok: false, reason: 'usage limit / quota exhausted (resets ~2am)' };
      return { ok: true };
    }
    if (agent === 'gemini') {
      const out = execFileSync('gemini', ['--approval-mode', 'yolo', '-p', 'Reply with exactly: PROBE_OK'], { cwd: REPO, timeout: 70000, encoding: 'utf8' });
      if (/usage limit|quota|429/i.test(out) && !/PROBE_OK/.test(out)) return { ok: false, reason: 'quota / rate limited' };
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, reason: String(e.message || e).split('\n')[0] };
  }
  return { ok: false, reason: 'unknown agent' };
}

function launchSpec(agent, prompt) {
  if (agent === 'codex') return { cmd: 'codex', args: ['exec', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', prompt] };
  if (agent === 'gemini') return { cmd: 'gemini', args: ['--approval-mode', 'yolo', '-p', prompt] };
  throw new Error(`no launch spec for ${agent}`);
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
  node tools/agora/orchestrate.mjs prompt   <plan.json> <packetId>
  node tools/agora/orchestrate.mjs seed     <plan.json>
  node tools/agora/orchestrate.mjs dispatch <plan.json> <packetId>
  node tools/agora/orchestrate.mjs gate     <plan.json> [--exclude <regex>] [--only <id,id>]   (--only = gate ONE wave's packets)
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
  if (cmd === 'prompt') { console.log(buildPrompt(loadPlan(planArg), requirePacket(loadPlan(planArg), packetArg))); return; }
  const plan = loadPlan(planArg);
  if (cmd === 'seed') return void (await cmdSeed(plan));
  if (cmd === 'status') return void (await cmdStatus(plan));
  if (cmd === 'feedback') return void (await cmdFeedback(plan, Number(getFlag(process.argv, '--since') || 0)));
  if (cmd === 'dispatch') return void (await cmdDispatch(plan, packetArg));
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
