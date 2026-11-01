// Agora Orchestrator — codifies the multi-agent campaign loop so an orchestrator
// drives a wave by command instead of hand-writing the coordination contract per
// agent. See tools/agora/ORCHESTRATOR.md for the full playbook.
//
//   node tools/agora/orchestrate.mjs <command> [args]
//
//   prompt   <plan.json> <packetId>     print the ready-to-dispatch agent prompt
//   partition <plan.json>                compare task file refs with packet ownership
//   seed     <plan.json>                register orchestrator + announce the wave on the board
//   dispatch <plan.json> [packetId]     launch one packet as before, or run a bounded external CLI wave
//   gate     <plan.json> [--exclude s]  run the integration typecheck, filter to the wave's files, baseline delta
//   status                              board snapshot (agents / locks / tasks)
//   feedback [--since N]                dump WORKFLOW: messages from the board
//   help                                this message
//
// A PLAN is JSON:
//   { "wave": "name", "pet": "orchestrator-pet-slug", "baseUrl": "http://localhost:4319", "baseline": 220,
//     "packets": [ { "id":"PK-x", "handle":"fixer-x", "agent":"claude|codex|gemini",
//                    "pet":"worker-pet-slug", "scope":"one-line", "files":["src/a.ts"], "issues":["X1"],
//                    "guidance":"optional extra instructions" } ] }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { globIterateSync, hasMagic } from 'glob';
import { run as clientRun } from './client.mjs';
import { OPEN_STATUSES, CLOSED_STATUSES, indexGaps } from './gapIndex.mjs';
import { hasDispatchWiring, runMatrixCheck } from './syncAgents.mjs';
import { publishControlNotice, publishCapabilityNotice, publishScopeNotice, publishRulingUnblock, publishSourceReview } from './controlNotice.mjs';
import {createVisualSplit,validateVisualPacket,visualHandoffPrompt,visualReviewPrompt,visualAcceptancePending} from './visualAcceptance.mjs';
import {isVisualBuildOnlyTask,visualReviewDeliveryIssue} from './visualTaskKind.mjs';
import { inspectCountSources, inspectDedupAcceptance, inspectSymbolChecks, inspectSourceReviews, inspectSourceMembers, sourceMembersProse } from './taskLint.mjs';
import { sharedTypePromptBlock } from './sharedTypeOwnership.mjs';
import { mountPointPromptBlock } from './mountOwnership.mjs';
import { inspectPacketActionWiring, actionWiringPromptBlock } from './actionWiring.mjs';
import { validatePacketUnions, unionPromptBlock } from './unionConsumerOwnership.mjs';
import { inspectProductionCallers, productionCallerPromptBlock } from './productionCallerOwnership.mjs';
import { dataValuePromptBlock } from './dataValueProvenance.mjs';
import {sourceRecordPromptBlock} from './recordSourceProvenance.mjs';
import {sourceRewritePromptBlock,inspectPacketSourceRewrites} from './sourceRewritePreflight.mjs';
import {
  checkPlanOwnership,
  checkPacketLaunchLocks,
  formatLockSnapshot,
  formatPacketOwnershipReport,
  handoffPromptBlock,
  localTestHomePromptBlock,
  forwarderOnlyPromptBlock,
  validateOwnershipDeclarations,
  assertResolvedPacketDiscovery,
  inspectPacketDataEdits,
  inspectPacketDataValueOwnership,
  inspectPacketSourceRecordOwnership,
  inspectPacketValueEquivalence,
  inspectPacketRuntimeLimitations,
} from './packetOwnership.mjs';

const DEFAULT_URL = 'http://localhost:4319';
const REPO = process.cwd();
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_FILE = path.join(MODULE_DIR, 'agents.json');
const PET_MANIFEST_FILE = path.join(MODULE_DIR, 'dashboard', 'pets', 'pets.json');
const DEFAULT_LOCAL_DISPATCH_MAX = 4;

// ------------------------------------------------------------- agent registry
// agents.json is the machine-readable Agent Matrix: which agents exist, their
// readiness status, policy roles, dispatch wiring, and date-bound constraints.
// validatePlan enforces it so a deprecated / orchestrator-only / unwired agent
// fails at PLAN time, not mid-campaign.
let registryCache = null;
let petSlugCache = null;
export function loadRegistry(file = REGISTRY_FILE) {
  if (file === REGISTRY_FILE && registryCache) return registryCache;
  const reg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!reg || typeof reg.agents !== 'object') throw new Error('agents.json: missing "agents" map');
  if (file === REGISTRY_FILE) registryCache = reg;
  return reg;
}

// Presence registration now requires a real pet identity. Validate plan slugs
// against the same local manifest the daemon and dashboard use, so a typo fails
// before an orchestrator seeds tasks or launches a worker.
function loadPetSlugs() {
  if (petSlugCache) return petSlugCache;
  const manifest = JSON.parse(fs.readFileSync(PET_MANIFEST_FILE, 'utf8'));
  petSlugCache = new Set((manifest.pets || []).map((pet) => pet.slug).filter(Boolean));
  return petSlugCache;
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
  // AM-G1: three wiring shapes are launchable — the Agent tool, an external CLI
  // command, and an HTTP API endpoint. syncAgents owns the predicate so the plan
  // gate, the registry view and the dashboard diff can never disagree.
  if (!hasDispatchWiring(def)) {
    throw new Error(`packet ${packetId}: agent "${agentId}" has no dispatch wiring (not wired into orchestrate.mjs yet) — ${def.notes || ''}`);
  }
}

// ---------------------------------------------------- dispatch concurrency
// A concurrency ceiling is safety policy, so accept only positive whole numbers.
// Rejecting malformed CLI or registry values here prevents even the first worker
// from starting under an ambiguous or accidentally unbounded configuration.
export function validateDispatchMax(value, source = 'dispatch concurrency cap') {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${source} must be a positive whole number (received ${JSON.stringify(value)})`);
  }
  return parsed;
}

// Choose one lane's ceiling without changing any other registry policy. An
// explicit operator value wins, then the agent's own declared ceiling. Only a
// lane explicitly marked as local receives the conservative default of four;
// remote/non-local lanes keep their existing unbounded-by-this-tool behavior.
export function resolveDispatchMax(agentId, packetCount, { registry = loadRegistry(), cliMax } = {}) {
  const def = registry.agents && registry.agents[agentId];
  if (!def) throw new Error(`cannot resolve dispatch cap for unknown agent "${agentId}"`);
  const dispatch = def.dispatch || {};

  if (cliMax !== undefined) return validateDispatchMax(cliMax, '--max');
  if (dispatch.maxConcurrent !== undefined) {
    return validateDispatchMax(dispatch.maxConcurrent, `agents.json ${agentId}.dispatch.maxConcurrent`);
  }
  if (dispatch.localEngine === true) return DEFAULT_LOCAL_DISPATCH_MAX;

  // A non-local lane with no declared ceiling behaves as it did before WF-G42.
  // The packet count is a finite scheduler width, not a new policy cap.
  return Math.max(1, packetCount);
}

// Run each registry lane through a small worker pool. The injected runner makes
// the queue independently testable without starting real model processes. Each
// packet always receives one terminal record, including thrown and non-zero exits.
export async function dispatchPacketWave(packets, {
  registry = loadRegistry(),
  cliMax,
  runPacket,
  onRecord = () => {},
} = {}) {
  if (!Array.isArray(packets) || packets.length === 0) throw new Error('dispatch wave requires at least one packet');
  if (typeof runPacket !== 'function') throw new Error('dispatch wave requires a runPacket function');

  // Group packets by agent so registry defaults remain lane-specific. Resolve
  // every ceiling before launching anything: one invalid lane must reject the
  // whole request before another lane can start.
  const grouped = new Map();
  packets.forEach((packet, index) => {
    if (!packet || !packet.id || !packet.agent) throw new Error('every dispatch packet requires id and agent');
    if (!registry.agents || !registry.agents[packet.agent]) {
      throw new Error(`cannot dispatch packet ${packet.id}: unknown agent "${packet.agent}"`);
    }
    if (!grouped.has(packet.agent)) grouped.set(packet.agent, []);
    grouped.get(packet.agent).push({ packet, index });
  });
  let lanes;
  if (cliMax !== undefined) {
    // An operator's explicit override is a total wave safety ceiling, including
    // mixed-agent plans. A single shared queue prevents two local lanes from
    // each consuming the full override and doubling pressure on one engine.
    lanes = [{
      agentId: 'explicit-wave-cap',
      items: packets.map((packet, index) => ({ packet, index })),
      maxConcurrent: validateDispatchMax(cliMax, '--max'),
    }];
  } else {
    lanes = [...grouped.entries()].map(([agentId, items]) => ({
      agentId,
      items,
      maxConcurrent: resolveDispatchMax(agentId, items.length, { registry }),
    }));
  }
  const records = new Array(packets.length);

  // Each lane advances through its queue only when a running slot completes.
  // Separate lanes may progress together, while no lane exceeds its own cap.
  await Promise.all(lanes.map(async (lane) => {
    let nextItem = 0;
    const consume = async () => {
      for (;;) {
        const item = lane.items[nextItem];
        if (!item) return;
        nextItem += 1;

        let outcome;
        let failure;
        try {
          outcome = (await runPacket(item.packet)) || {};
        } catch (error) {
          failure = error;
          outcome = {};
        }

        // A thrown runner and a non-zero child exit are both failures. Preserve
        // the packet identity and exit status so a dead worker cannot disappear
        // behind a generic wave-level error.
        const exitCode = failure
          ? (Number.isInteger(failure.exitCode) ? failure.exitCode : null)
          : (Number.isInteger(outcome.exitCode) ? outcome.exitCode : 0);
        const failed = Boolean(failure) || exitCode !== 0;
        const output = String(outcome.output || outcome.logFile || failure?.message || 'no worker output captured');
        const result = String(outcome.result || (failed
          ? `packet ${item.packet.id} failed with exit ${exitCode ?? 'unknown'}`
          : `packet ${item.packet.id} completed with exit 0`));
        const record = {
          packetId: item.packet.id,
          agent: item.packet.agent,
          status: failed ? 'failed' : 'succeeded',
          exitCode,
          signal: outcome.signal || null,
          output,
          result,
        };

        records[item.index] = record;
        await onRecord(record);
      }
    };

    // Starting at most the lesser of queue length and selected ceiling makes
    // excess jobs wait instead of competing for the same local engine.
    const workerCount = Math.min(lane.maxConcurrent, lane.items.length);
    await Promise.all(Array.from({ length: workerCount }, () => consume()));
  }));

  return records;
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

function validateOwnedFileGlob(packetId, declaredPath) {
  const pattern = declaredPath.replace(/\\/g, '/');
  if (!hasMagic(pattern, { magicalBraces: true })) return;
  const normalized = path.posix.normalize(pattern);
  if (path.isAbsolute(pattern) || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`packet ${packetId}: owned-file glob "${declaredPath}" must stay inside the repository`);
  }
  try {
    if (!globIterateSync(pattern, { cwd: REPO, nodir: true }).next().done) return;
  } catch (error) {
    throw new Error(`packet ${packetId}: owned-file glob "${declaredPath}" could not be checked: ${error.message}`);
  }
  throw new Error(`packet ${packetId}: owned-file glob "${declaredPath}" matches no files in the checkout (WF-G281); correct it before dispatch`);
}

// WF-G221: Vitest's shared exclude makes adjacent tests inside vendor trees
// undiscoverable. Read the current config rather than assuming the exclusion
// still exists after a later test-runner change.
function vendorOnlyVerificationNote(pkt) {
  if (!Array.isArray(pkt.files) || !pkt.files.length
      || !pkt.files.every((file) => /(?:^|\/)vendor(?:\/|$)/i.test(String(file).replace(/\\/g, '/')))) return '';
  let config;
  try {
    config = fs.readFileSync(path.join(REPO, 'vitest.config.ts'), 'utf8');
  } catch (error) {
    throw new Error(`packet ${pkt.id}: cannot check Vitest vendor exclusion (WF-G221): ${error.message}`);
  }
  const sharedExcludes = config.match(/const SHARED_EXCLUDE\s*=\s*\[([\s\S]*?)\]\s*;/)?.[1] || '';
  if (!/['"]\*\*\/vendor\/\*\*['"]/.test(sharedExcludes)) return '';
  return 'VENDOR-ONLY VERIFICATION (WF-G221): Vitest excludes **/vendor/**, so do not add an in-vendor unit test or claim one ran. Root typecheck can include pre-existing vendor errors; if Guidance names it, record the error-count baseline before edits and report the delta after edits, not an absolute clean claim. Run only checks named in Guidance.';
}

function checkedVendorVerificationNote(pkt) {
  const note = vendorOnlyVerificationNote(pkt);
  if (!note) return '';
  const guidance = sourceMembersProse(pkt.guidance);
  if (/\b(?:add|extend|write|create)\b[^.\n]*\b(?:unit\s+)?tests?\b[^.\n]*\b(?:next to|adjacent to|beside|inside|under|in)\b/i.test(guidance)
      || /\bvitest\b[^\n]*\bvendor\b/i.test(guidance)) {
    throw new Error(`packet ${pkt.id}: WF-G221 vendor files are excluded by Vitest; remove the in-vendor test demand and name an available proof instead.`);
  }
  if (/\b(?:tsc|typecheck(?::files)?)\b[^.\n]{0,100}\bclean\b|\bclean\b[^.\n]{0,100}\b(?:tsc|typecheck)\b/i.test(guidance)) {
    throw new Error(`packet ${pkt.id}: WF-G221 vendor files may have pre-existing root typecheck errors; require a baseline and delta rather than an absolute clean result.`);
  }
  return note;
}

export function packetVerificationNotes(plan) {
  return (plan.packets || []).map((pkt) => {
    const note = checkedVendorVerificationNote(pkt);
    return note ? `${pkt.id}: ${note}` : '';
  }).filter(Boolean);
}

export function validatePlan(plan, { registry, onWarn } = {}) {
  if (!plan || typeof plan !== 'object') throw new Error('plan must be an object');
  if (!Array.isArray(plan.packets) || plan.packets.length === 0) throw new Error('plan.packets must be a non-empty array');
  const petSlugs = loadPetSlugs();
  if (!plan.pet || typeof plan.pet !== 'string') throw new Error('plan.pet is required for the orchestrator presence identity');
  if (!petSlugs.has(plan.pet)) throw new Error(`plan.pet "${plan.pet}" is not in dashboard/pets/pets.json`);
  const reg = registry || loadRegistry();
  const warn = onWarn || (() => {});
  const seenFiles = new Map(); // file -> packetId (disjointness check)
  const seenHandles = new Set();
  for (const p of plan.packets) {
    if (!p.id || !p.handle || !p.scope) throw new Error(`packet missing id/handle/scope: ${JSON.stringify(p)}`);
    if (!Array.isArray(p.files) || (p.files.length === 0 && !p.visualReview)) throw new Error(`packet ${p.id} has no files`);
    if (p.visualReview) validateVisualPacket(p); // Empty files is permitted only for an explicit inspection-only review.
    assertResolvedPacketDiscovery(p);
    if (!p.pet || typeof p.pet !== 'string') throw new Error(`packet ${p.id} is missing required pet identity`);
    if (!petSlugs.has(p.pet)) throw new Error(`packet ${p.id}: pet "${p.pet}" is not in dashboard/pets/pets.json`);
    if (seenHandles.has(p.handle)) throw new Error(`duplicate handle "${p.handle}" (each agent needs a unique identity)`);
    seenHandles.add(p.handle);
    p.agent = p.agent || 'claude';
    const def = reg.agents[p.agent];
    if (!def) throw new Error(`packet ${p.id}: unknown agent "${p.agent}" (registry has: ${Object.keys(reg.agents).join(', ')})`);
    assertDispatchableWorker(p.id, p.agent, def);
    // WF-G226: enforce per-packet file count caps declared on an agent lane (e.g. cline maxFiles: 1).
    const maxFiles = def?.dispatch?.maxFiles;
    if (Number.isInteger(maxFiles) && maxFiles > 0 && Array.isArray(p.files) && p.files.length > maxFiles) {
      throw new Error(`packet ${p.id}: agent "${p.agent}" allows at most ${maxFiles} file(s) per packet (got ${p.files.length}, WF-G226)`);
    }
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
      if (typeof f !== 'string' || !f.trim()) throw new Error(`packet ${p.id}: files must contain non-empty paths`);
      validateOwnedFileGlob(p.id, f);
      if (seenFiles.has(f)) {
        throw new Error(`DISJOINTNESS VIOLATION: "${f}" is owned by both ${seenFiles.get(f)} and ${p.id}. Packets in one wave must not share files.`);
      }
      seenFiles.set(f, p.id);
    }
    checkedVendorVerificationNote(p);
    // Check command and rendered-proof contracts before seeding board work,
    // not only when a worker's prompt is eventually printed.
    buildVerificationStep(p);
    buildVisualProofStep(p);
    validateVisualPacket(p);
    checkedPacketCountSources(p);
    checkedPacketDedupAcceptance(p);
    checkedPacketSymbolChecks(p);
    checkedPacketSourceReviews(p);
    checkedPacketSourceMembers(p);
    inspectPacketValueEquivalence(p);
    inspectPacketRuntimeLimitations(p);
    for (const edit of inspectPacketDataEdits(p)) {
      if (edit.needsVerification) warn(`packet ${p.id}: WF-G327 VERIFY BEFORE EDITING ${edit.file} ${JSON.stringify(edit.field)}; no from-value recorded.`);
    }
  }
  validateOwnershipDeclarations(plan);
  return true;
}

const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim().slice(0, 80);

// WF-G291: keep the audit on both durable task briefs and worker prompts. This
// is conditional repair guidance, not a semantic doc scanner or wider permission.
const DOCUMENTATION_AUDIT_POLICY = 'DOCUMENTATION AUDIT (WF-G291): For documentation repairs, read each repaired document end to end. Historical line ranges are motivating citations, not exhaustive acceptance. File-check every repository path presented as current and recheck every absence claim anywhere in the document, including sections outside the cited ranges. Reconcile contradictory current-state sections instead of merely prepending a correction. Historical, retired and planned references need separate classification; do not silently make them current or remove unfinished intent. Record timestamp, exact scoped checks, outcomes and unchecked scope before changing Verified: metadata. Unresolved claims block the corresponding acceptance and verification-date claim. Label partial verification by section and retain older dates for unchecked behavior. File existence is not proof of wiring, test execution or rendered behavior. This audit does not grant extra files or commands: required unowned edits need parent authorization and your own locks; unavailable checks remain explicit blockers.';

// Authored metadata and literal checks never replace manual call-site review.
const SYMBOL_PREMISE_POLICY = 'FILE/SYMBOL PREMISES (WF-G272): Authors must declare every named file/symbol pair with SYMBOL-CHECK before dispatch and re-read its exact file; a global symbol hit is not exact-file proof. Workers must re-read task show and task lint, then inspect the intended definition, call site or type member before acting. An already-present field contradicts an absence prescription; do not duplicate it. A missing, stale or SYMBOL-CHECK-UNVERIFIED premise requires author reconciliation; do not fabricate call sites or guess a new implementation surface. Keep superseded prose as history. Checks are case-sensitive whole literal identifiers, not semantic proof; comments and strings can match. An absent declaration does not authorize adding an API. These declarations grant no files or commands, and no task command executes automatically. Arbitrary English pairs are not inferred by this checker; authors and workers remain responsible for coverage and meaning.';

function checkedPacketSymbolChecks(pkt) {
  if (pkt.symbolChecks !== undefined && (!Array.isArray(pkt.symbolChecks) || pkt.symbolChecks.length > 64)) throw new Error('packet ' + pkt.id + ': WF-G272 symbolChecks must be an array of at most64 declarations');
  const body = [pkt.scope || '', pkt.guidance || '', ...(pkt.symbolChecks || []).map(item => 'SYMBOL-CHECK: ' + JSON.stringify(item))].join('\n');
  const check = inspectSymbolChecks({ body }, { repoRoot: REPO });
  if (check.issues.length) throw new Error('packet ' + pkt.id + ': WF-G272 ' + check.issues.map(issue => (issue.file || '') + ' ' + (issue.symbol || '') + ': ' + issue.reason).join('; '));
  return check;
}

// The parent reviews affected behaviors; hashes only detect later literal drift.
const SOURCE_PRESERVATION_POLICY = 'SIBLING PRESERVATION (WF-G307): Before replacing a source block, the author must re-read its current anchored contents and append a timestamped SOURCE-REVIEW with reviewed affected symbols and preservation assessment. Historical line ranges and still-present old symbols do not prove the block has not grown. Workers must re-read task show and task lint after acquiring their own authorized locks and before editing. A changed, missing, ambiguous or unavailable block needs parent reconciliation through an explicitly superseding durable source-review; do not silently refresh the baseline, follow a stale deletion instruction or discard a sibling addition. Preserve earlier receipts and intervening task text. Literal hashes and parent-supplied symbols are not semantic completeness, inferred English coverage, ownership or command grants; record actual behavioral proof or blockers separately.';

function checkedPacketSourceReviews(pkt) {
  if (pkt.sourceReviews !== undefined && (!Array.isArray(pkt.sourceReviews) || pkt.sourceReviews.length > 32)) throw new Error('packet ' + pkt.id + ': WF-G307 sourceReviews must be an array of at most32 receipts');
  const body = [pkt.scope || '', pkt.guidance || '', ...(pkt.sourceReviews || []).map(item => 'SOURCE-REVIEW: ' + JSON.stringify(item))].join('\n');
  const check = inspectSourceReviews({ body }, { repoRoot: REPO });
  if (check.issues.length) throw new Error('packet ' + pkt.id + ': WF-G307 ' + check.issues.map(issue => issue.reason).join('; '));
  return check;
}

// WF-G283: a copied member list is a source premise, never ownership or runtime proof.
const SOURCE_MEMBERS_POLICY = 'SOURCE MEMBERS (WF-G283): When quoting a union or enum member list, the author must record SOURCE-MEMBERS with the exact file, symbol, declaration kind, complete current source quote and all members. Finite direct string-union literals and enum member names are checked; enum values are not evaluated. Re-read task show and task lint before acting and after acquiring your authorized locks. Extra neighboring members, omissions, duplicates, stale, ambiguous, unavailable or unsupported declarations require author reconciliation. Do not invent a concept from a wrong list, silently refresh evidence or widen file/command ownership. Preserve superseded lists as explicitly historical evidence. Obvious prose lists warn but arbitrary English coverage and semantic impact remain parent responsibilities; AST membership is not behavioral acceptance.';

function checkedPacketSourceMembers(pkt) {
  if (pkt.sourceMembers !== undefined && (!Array.isArray(pkt.sourceMembers) || pkt.sourceMembers.length > 32)) throw new Error('packet ' + pkt.id + ': WF-G283 sourceMembers must be an array of at most32 declarations');
  const body = [pkt.scope || '', pkt.guidance || '', ...(pkt.sourceMembers || []).map(item => 'SOURCE-MEMBERS: ' + JSON.stringify(item))].join('\n');
  const check = inspectSourceMembers({ body }, { repoRoot: REPO });
  if (check.issues.length) throw new Error('packet ' + pkt.id + ': WF-G283 ' + check.issues.map(issue => (issue.file || '') + ' ' + (issue.symbol || '') + ': ' + issue.reason).join('; '));
  return check;
}

export function packetTaskBody(pkt, sharedTypes) {
  inspectProductionCallers(pkt);
  inspectPacketDataValueOwnership(pkt);
  inspectPacketSourceRecordOwnership(pkt);
  const scope = sourceMembersProse(pkt.scope).replace(/\s+/g, ' ').trim();
  const sources = packetCountSources(pkt).map(command => `\nCOUNT-SOURCE: ${command}`).join('');
  inspectPacketSourceRewrites(pkt);
  const data = packetDataEditLines(pkt) + dataValuePromptBlock(pkt) + sourceRecordPromptBlock(pkt) + sourceRewritePromptBlock(pkt);
  const dedup = checkedPacketDedupAcceptance(pkt);
  const acceptance = dedup.contracts.map(({ line, ...contract }) => '\nDEDUP-ACCEPTANCE: ' + JSON.stringify(contract)).join('');
  const goals = dedup.goals.map(item => '\nDEDUP-GOAL: ' + item.claim).join('');
  const symbols = checkedPacketSymbolChecks(pkt).declarations.map(({ bodyLine, ...claim }) => '\nSYMBOL-CHECK: ' + JSON.stringify(claim)).join('');
  const reviews = checkedPacketSourceReviews(pkt).declarations.map(({ bodyLine, ...review }) => '\nSOURCE-REVIEW: ' + JSON.stringify(review)).join('');
  const members = checkedPacketSourceMembers(pkt).declarations.map(({ bodyLine, ...claim }) => '\nREFERENCE-ONLY: SOURCE-MEMBERS: ' + JSON.stringify(claim)).join('');
  return `Packet ${pkt.id}: ${scope}. Owned files: ${pkt.files.join(', ')}. Acceptance: complete the packet scope within those files and record concrete verification or blockers in the result.${sources}${data}${goals}${acceptance}${symbols}${reviews}${members}${runtimeLimitationPromptBlock(pkt)}${valueEquivalencePromptBlock(pkt)}${productionCallerPromptBlock(pkt)}${mountPointPromptBlock(pkt)}${sharedTypePromptBlock(pkt, sharedTypes)}${actionWiringPromptBlock(pkt)}${unionPromptBlock(pkt)}\n\n${visualHandoffPrompt(pkt)}\n\n${DOCUMENTATION_AUDIT_POLICY}\n\n${SYMBOL_PREMISE_POLICY}\n\n${SOURCE_PRESERVATION_POLICY}\n\n${SOURCE_MEMBERS_POLICY}\n\n${ACTION_WIRING_POLICY}\n\n${UNION_CONSUMER_POLICY}`;
}

function runtimeLimitationPromptBlock(pkt){
  const report=inspectPacketRuntimeLimitations(pkt);
  if(!report.declarations.length)return '';
  const records=report.declarations.map(({bodyLine,...item})=>'RUNTIME-LIMITATION: '+JSON.stringify(item)).join('\n');
  return '\n'+records+'\nRUNTIME PREMISE POLICY (WF-G264): Re-read task show and task lint before acting. Source boundary prose is not behavior evidence. Review the exact named entry call, failing assertion, input and diagnostic; a matching test receipt is not semantic or authenticated proof. Unverified state permits investigation only, not an implementation recipe. If the entry succeeds, preserve the observation and reconcile the false premise with the parent. Refresh evidence when source/test bytes or the two-hour receipt window change. No declared command executes automatically and no record grants ownership or permission.\n';
}

// Preserve each comparison receipt once, separate from title and permission
// text. The worker still needs current authorized proof before any deletion.
function valueEquivalencePromptBlock(pkt){
  const report=inspectPacketValueEquivalence(pkt);
  if(!report.declarations.length)return '';
  const records=report.declarations.map(({bodyLine,...item})=>'VALUE-EQUIVALENCE: '+JSON.stringify(item)).join('\n');
  return '\n'+records+'\nVALUE COMPARISON POLICY (WF-G276): Re-read task show and task lint, both current value paths and named evidence after acquiring authorized locks. reported_equal is an author report, not semantic certification. An unverified comparison permits investigation only; do not delete or follow a removal recipe until the proposed probe proves the relevant fields and consumers match and the parent reconciles the record. Do not infer removal safety merely because a parser populated a similar value. Preserve old claims as history. No record or probe grants files or commands, and no declared command executes automatically. Stale, missing, conflicting or unequal results block deletion; preserve unfinished intent.\n';
}

// Wiring changes need deliberate owners, not a reducer that nobody can reach.
const ACTION_WIRING_POLICY = 'ACTION DELIVERY (WF-G237): Authors must audit each affected UI action or payload change across its emitter, UI types/metadata/handler where applicable, AppAction, reducer and payload builder/caller. Declare reviewed actionWiring routes, current source anchors, existing/planned links and each required edit. Core reducer/AppAction packets require affected routes or a justified current unchanged-wiring review. Re-read task show and partition before editing; declared changes outside the packet need parent-assigned files or an exact owning sibling handoff. Read-only roles need a parent preservation assessment, not a silent omission. Planned links and deferred sibling work remain incomplete acceptance. Missing or unsupported evidence requires reconciliation; do not fabricate dispatches, invent a route or silently widen ownership. Syntax clues are not complete control/data flow or runtime proof. Declarations grant no files, locks or commands; preserve actual integration/test/rendered proof and approval limits.';

// Changed vocabulary consumers remain explicit delivery obligations, not scope grants.
const UNION_CONSUMER_POLICY = 'UNION DELIVERY (WF-G282): recheck the current declared member delta and full partition consumer report. Every exhaustive table and complete literal vocabulary needs owned files or an exact owning sibling handoff with companion tests. Record integration dependencies and acceptance before claiming completion. Sparse tables, value-position uses, subsets, JavaScript behavior, complex unions and other call sites need the recorded parent review and any explicitly declared additional consumer edits. Source-symbol discovery is not runtime acceptance or a complete semantic impact graph; incomplete or unsupported relevant evidence cannot clear preflight. Do not silently drop task union records or expand file, lock or command permission.';

// WF-G325: carry one role-labeled acceptance contract into the durable task,
// rather than losing it after preflight. No declared measurement is executed.
function checkedPacketDedupAcceptance(pkt) {
  const authored = pkt.dedupAcceptance === undefined ? '' : '\nDEDUP-ACCEPTANCE: ' + JSON.stringify(pkt.dedupAcceptance);
  const check = inspectDedupAcceptance([pkt.scope || '', pkt.guidance || '', authored].join('\n'));
  if (check.issues.length) throw new Error('packet ' + pkt.id + ': WF-G325 ' + check.issues.map(issue => issue.reason).join('; '));
  return check;
}

// Keep authored from-values (or their absence) on the durable task. A current
// read is a raw preflight, not semantic approval or permission to change data.
function packetDataEditLines(pkt) {
  return inspectPacketDataEdits(pkt).map(edit => '\nREFERENCE-ONLY: DATA-EDIT: ' + JSON.stringify({
    file: edit.file, field: edit.field, ...(edit.needsVerification ? {} : { from: edit.from }), to: edit.to,
    verification: edit.needsVerification ? 'VERIFY BEFORE EDITING' : 'RECHECK BEFORE EDITING',
  })).join('');
}

// Keep measurement commands on the durable task as well as the prompt. The
// declaration does not execute anything or grant edit/verification permission.
function packetCountSources(pkt) {
  const commands = pkt.countSources ?? [];
  if (!Array.isArray(commands) || commands.some(command => typeof command !== 'string' || !command.trim() || /[\r\n]/.test(command))) {
    throw new Error(`packet ${pkt.id}: countSources must be an array of nonempty single-line commands.`);
  }
  return [...new Set([...commands.map(command => command.trim()),
    ...inspectCountSources(sourceMembersProse(pkt.guidance)).sources.map(item => item.command)])];
}

function checkedPacketCountSources(pkt) {
  const commands = packetCountSources(pkt);
  const checked = inspectCountSources(`${sourceMembersProse(pkt.scope)}\n${sourceMembersProse(pkt.guidance)}\n${commands.map(command => 'COUNT-SOURCE: ' + command).join('\n')}`);
  if (checked.missingSources || checked.invalidSources.length) {
    throw new Error(`packet ${pkt.id}: WF-G343 needs a real COUNT-SOURCE measurement for count-dependent work.`);
  }
  for (const command of commands) {
    const permitted = sourceMembersProse(pkt.guidance).split(/\r?\n/).some(line => line.includes(command)
      && !/\b(?:do not|don't|never|forbid|avoid)\b/i.test(line));
    if (!permitted) throw new Error(`packet ${pkt.id}: Guidance must authorize the read-only measurement ${command}.`);
    // Count extraction is not a back door for expensive tests, builds or servers.
    if (commandsNamedInGuidance(command).length) throw new Error(`packet ${pkt.id}: test/build/typecheck/server commands are forbidden as countSources; authorize verification separately.`);
  }
  return commands;
}

function shellDoubleQuoted(value, powershell) {
  const raw = String(value);
  return powershell
    ? `"${raw.replace(/`/g, '``').replace(/\$/g, '`$').replace(/"/g, '`"')}"`
    : `"${raw.replace(/\\/g, '\\\\').replace(/\$/g, '\\$').replace(/`/g, '\\`').replace(/"/g, '\\"')}"`;
}

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

// Read the Plan Map tracker lazily so normal non-roadmap plans keep working even
// if the roadmap file is temporarily absent in a stripped checkout.
function loadPlanMapData() {
  const file = path.join(REPO, 'public', 'planmap', 'topics.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Packet authors historically used `issues`; planmap-to-wave emits `refs`.
// Seed treats both as durable task references so board->tracker reconciliation
// can see every roadmap link.
function packetRefs(pkt) {
  return [...new Set([...(pkt.issues || []), ...(pkt.refs || [])].filter((ref) => typeof ref === 'string' && ref.trim()))];
}

// Find every roadmap topic named by the plan itself or by packet refs of the
// form `planmap:<topic>/<feature>`. The topic ids drive campaign extraction.
function collectPlanMapTopicIds(plan) {
  const ids = [];
  const add = (id) => {
    if (typeof id !== 'string' || !id.trim()) return;
    if (!ids.includes(id.trim())) ids.push(id.trim());
  };
  add(plan.topicId);
  add(plan.planMapTopic);
  if (plan.planMap && typeof plan.planMap === 'object') {
    add(plan.planMap.topicId);
    for (const id of plan.planMap.topicIds || plan.planMap.topics || []) add(id);
  }
  for (const pkt of plan.packets || []) {
    for (const ref of packetRefs(pkt)) {
      const match = /^planmap:([a-z0-9-]+)(?:\/|$)/i.exec(ref);
      if (match) add(match[1]);
    }
  }
  return ids;
}

// Convert Plan Map topic metadata into the Agora campaign governance record.
// The Plan Map owns campaign labels, topic titles, and status; Agora only mirrors
// enough of that context to prevent unsafe orchestrator overlap.
function planMapCampaignForPlan(plan, planMapData = loadPlanMapData()) {
  const topicIds = collectPlanMapTopicIds(plan);
  if (!topicIds.length) return null;
  if (!planMapData || !Array.isArray(planMapData.topics)) {
    throw new Error(`plan-map data unavailable while resolving topic(s): ${topicIds.join(', ')}`);
  }
  const byId = new Map(planMapData.topics.map((topic) => [topic.id, topic]));
  const topics = topicIds.map((id) => {
    const topic = byId.get(id);
    if (!topic) throw new Error(`plan-map topic "${id}" not found in public/planmap/topics.json`);
    return topic;
  });
  const campaignKeys = [...new Set(topics.map((topic) => topic.campaign || 'uncategorized'))];
  const campaignKey = campaignKeys.length === 1 ? campaignKeys[0] : 'mixed';
  const campaignLabel = campaignKeys.length === 1
    ? ((planMapData.campaigns && planMapData.campaigns[campaignKey] && planMapData.campaigns[campaignKey].label) || campaignKey)
    : 'Mixed Plan Map';
  const topicTitles = topics.map((topic) => topic.title || topic.id).join(' + ');
  const singleSub = topics.length === 1 && topics[0].sub ? ` - ${topics[0].sub}` : '';
  return {
    id: `planmap:${campaignKey}:${topicIds.join('-')}`,
    scope: `${campaignLabel}: ${topicTitles}${singleSub}`,
  };
}

function campaignIdForPlan(plan, planMapCampaign) {
  const raw = (plan.campaign && plan.campaign.id) || plan.campaignId || plan.wave || 'unnamed';
  if (!((plan.campaign && plan.campaign.id) || plan.campaignId) && planMapCampaign && planMapCampaign.id) {
    return planMapCampaign.id;
  }
  return String(raw).replace(/[^A-Za-z0-9:_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'unnamed';
}

function campaignScopeForPlan(plan, planMapCampaign) {
  if (plan.campaign && plan.campaign.scope) return String(plan.campaign.scope);
  if (planMapCampaign && planMapCampaign.scope) return planMapCampaign.scope;
  return `wave:${plan.wave || 'unnamed'} coordinator`;
}

function campaignRoleForPlan(plan) {
  return plan.campaign && plan.campaign.role === 'deputy' ? 'deputy' : 'lead';
}

function campaignLeadForPlan(plan) {
  return (plan.campaign && (plan.campaign.leadCampaignId || plan.campaign.lead)) || '';
}

function campaignPathsForPlan(plan) {
  const explicit = plan.campaign && Array.isArray(plan.campaign.paths) ? plan.campaign.paths : [];
  const packetFiles = plan.packets.flatMap((p) => p.files || []);
  return [...new Set([...explicit, ...packetFiles])];
}

/**
 * WF-G172: the identity seed must coordinate under.
 *
 * `seed` used to register `orchestrator-<wave>` unconditionally. An
 * orchestrator that had ALREADY registered its own handle and set
 * AGORA_AGENT_ID then owned two live presence rows for one session: presence,
 * campaign ownership and the seeded tasks' creatorAgent split across them, and
 * a later `unlock --mine` or `retire` under one handle left the other's claims
 * and locks orphaned while the roster over-reported the fleet size.
 *
 * The rule: when AGORA_AGENT_ID names a LIVE agent on this board whose role is
 * orchestrator or master, seed reuses it and registers nothing. It registers a
 * fresh `orchestrator-<wave>` handle only when no such identity is set.
 *
 * Returns { handle, reuse } — `reuse` true means the caller must skip register.
 */
export async function resolveSeedIdentity(plan, { processEnv = process.env, baseUrl } = {}) {
  const wanted = String(processEnv.AGORA_AGENT_ID || '').trim();
  const fresh = { handle: `orchestrator-${plan.wave || 'unnamed'}`, reuse: false, reason: 'AGORA_AGENT_ID names no live orchestrator' };
  if (!wanted) return { ...fresh, reason: 'AGORA_AGENT_ID is not set' };
  let agents;
  try {
    const res = await fetch(`${baseUrl}/agents`);
    if (!res.ok) return { ...fresh, reason: `board answered ${res.status} for /agents` };
    agents = (await res.json()).agents || [];
  } catch (e) {
    return { ...fresh, reason: `board unreachable: ${e.message}` };
  }
  const live = agents.find((a) => a && a.handle === wanted && a.status !== 'gone' && a.status !== 'retired');
  if (!live) return { ...fresh, reason: `no live agent named "${wanted}" on this board` };
  if (live.role !== 'orchestrator' && live.role !== 'master') {
    return { ...fresh, reason: `"${wanted}" is registered as ${live.role || 'worker'}, not orchestrator or master` };
  }
  return { handle: wanted, reuse: true, reason: `AGORA_AGENT_ID names live ${live.role} "${wanted}"` };
}

export async function seedPlan(plan, { env, planMapData } = {}) {
  // Programmatic callers must pass the same contract gate as CLI readPlan;
  // refuse unsafe verification before presence, campaign or task mutations.
  validatePlan(plan);
  if(plan.packets.some(p=>p.visualHandoff||p.visualReview))throw new Error('WF-G266 split tasks already exist: use the returned assigned packets, not seed another task');
  const ownership = await checkPlanOwnership(plan);
  if (!ownership.ok) throw new Error(formatPacketOwnershipReport(ownership));
  const baseUrl = plan.baseUrl || DEFAULT_URL;
  // WF-G172: decide the identity BEFORE the identity directory, because reusing
  // a live orchestrator means reading ITS identity file, not a per-wave one.
  const identity = env ? { handle: `orchestrator-${plan.wave || 'unnamed'}`, reuse: false, reason: 'caller supplied env' }
    : await resolveSeedIdentity(plan, { baseUrl });
  // WF-G344: seeding is itself a registration path. Give a new coordinator
  // one stable key before its first client call, including when tests supply
  // only AGORA_DIR. Reuse keeps the already-registered key unchanged.
  env = env
    ? { ...env, AGORA_AGENT_ID: env.AGORA_AGENT_ID || identity.handle }
    : (identity.reuse
      ? { ...process.env }
      : { ...process.env, AGORA_DIR: orchIdentityDir(plan), AGORA_AGENT_ID: identity.handle });
  const planMapCampaign = planMapCampaignForPlan(plan, planMapData);
  validateRefsAgainstIndex(plan); // WF-G12: fail on ambiguous refs, warn on unknown
  if (identity.reuse) {
    console.log(`seed: coordinating as "${identity.handle}" (${identity.reason}) — no second orchestrator row registered (WF-G172)`);
  } else {
    const reg = await clientRun([
      'register', identity.handle,
      '--pet', plan.pet,
      '--note', `wave:${plan.wave || 'unnamed'} coordinator`,
    ], { env, baseUrl });
    if (reg.code !== 0) throw new Error(`seed: orchestrator registration failed: ${(reg.lines || []).join(' / ')}`);
  }

  const campaignId = campaignIdForPlan(plan, planMapCampaign);
  const campaignArgs = [
    'campaign', 'claim', campaignId,
    '--role', campaignRoleForPlan(plan),
    '--scope', campaignScopeForPlan(plan, planMapCampaign),
    '--wave', String(plan.wave || campaignId),
  ];
  const leadCampaignId = campaignLeadForPlan(plan);
  if (leadCampaignId) campaignArgs.push('--lead', leadCampaignId);
  for (const p of campaignPathsForPlan(plan)) campaignArgs.push('--path', p);
  for (const g of (plan.campaign && plan.campaign.globs) || []) campaignArgs.push('--glob', g);
  const campaign = await clientRun(campaignArgs, { env, baseUrl });
  if (campaign.code !== 0) throw new Error(`seed: campaign claim failed: ${(campaign.lines || []).join(' / ')}`);

  // ============================================================================
  // Connected Campaign Deputies (WF-G152)
  // ============================================================================
  // When an umbrella sweep plan defines multiple work clusters that share files,
  // each cluster is claimed as a deputy attached to the umbrella lead campaign.
  // This avoids 409 lead collision errors while keeping distinct workstreams
  // tracked under their own campaign records.
  // ============================================================================
  const leadCode = (campaign.campaign && campaign.campaign.id) || campaignId;
  const deputies = (plan.campaign && Array.isArray(plan.campaign.deputies)) ? plan.campaign.deputies : [];
  for (const dep of deputies) {
    const depId = typeof dep === 'string' ? dep : (dep.id || dep.name);
    if (!depId) continue;
    const depScope = (typeof dep === 'object' && dep.scope) ? dep.scope : `deputy of ${campaignId}`;
    const depWave = (typeof dep === 'object' && dep.wave) ? dep.wave : String(plan.wave || campaignId);
    const depPaths = (typeof dep === 'object' && Array.isArray(dep.paths)) ? dep.paths : [];
    const depGlobs = (typeof dep === 'object' && Array.isArray(dep.globs)) ? dep.globs : [];
    const depArgs = [
      'campaign', 'claim', depId,
      '--role', 'deputy',
      '--lead', leadCode,
      '--scope', depScope,
      '--wave', depWave,
    ];
    for (const p of depPaths) depArgs.push('--path', p);
    for (const g of depGlobs) depArgs.push('--glob', g);
    const depClaim = await clientRun(depArgs, { env, baseUrl });
    if (depClaim.code !== 0) {
      throw new Error(`seed: deputy campaign claim failed for ${depId}: ${(depClaim.lines || []).join(' / ')}`);
    }
  }

  const seeded = {};
  let remaining = [...plan.packets];
  while (remaining.length) {
    const creatable = remaining.filter((p) => (p.after || []).every((a) => seeded[a]));
    if (creatable.length === 0) {
      throw new Error(`seed: circular/unresolvable "after" chain among: ${remaining.map((p) => p.id).join(', ')}`);
    }
    for (const pkt of creatable) {
      const argv = ['task', 'new', `${pkt.id}: ${sourceMembersProse(pkt.scope)}`, '--id-only'];
      if (pkt.files && pkt.files.length) argv.push('--body', packetTaskBody(pkt, ownership.sharedTypes));
      argv.push('--campaign', pkt.campaign || campaignId, '--wave', String(plan.wave || campaignId));
      if (typeof pkt.priority === 'number') argv.push('--priority', String(pkt.priority));
      for (const ref of packetRefs(pkt)) argv.push('--ref', ref);
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
function loadSeededMap(plan, { warnMissing = true } = {}) {
  const file = seedFilePath(plan);
  if (!fs.existsSync(file)) {
    if (warnMissing) console.warn(`⚠ no seed map at ${file} — workers will create their own tasks. Run: orchestrate seed <plan> for board-tracked waves.`);
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`seed map ${file} exists but is unreadable (${e.message}) — re-run: orchestrate seed <plan>`);
  }
}

/** Bind seeded tasks to ordinary ownership preflight without changing the authored plan. */
export function withSeededTasks(plan, seededMap) {
  if (!seededMap || typeof seededMap !== 'object' || Array.isArray(seededMap)) throw new Error('seed map must be an object, not an unchecked task identity');
  for (const [id, taskId] of Object.entries(seededMap)) {
    if (!plan.packets.some(packet => packet.id === id) || typeof taskId !== 'string' || !/^agora-[a-z0-9]+(?:\.[0-9]+)*$/i.test(taskId)) throw new Error('seed map has unknown packet or invalid task id: ' + id);
  }
  return { ...plan, packets: plan.packets.map(packet => ({ ...packet, taskIds: [...new Set([...(packet.taskIds || []), ...(seededMap[packet.id] ? [seededMap[packet.id]] : [])])] })) };
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
    for (const ref of packetRefs(p)) {
      const low = String(ref).toLowerCase();
      if (low.startsWith('planmap:')) continue;
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
  const visualPending = visualAcceptancePending(seededMap, tasks);
  return { done, blocked, pending, visualPending, complete: pending.length === 0 && visualPending.length === 0 };
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
  return { packets, totals, visualPending: visualAcceptancePending(seededMap, tasks) };
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
  const buildOnly = [];
  const invalidVisual = [];
  const pendingRestart = [];
  const alreadyClosed = [];
  const unmatchedRefs = [];
  const ambiguousRefs = [];
  const unrecognizedStatus = [];
  for (const t of doneTasks) {
    if (t.state !== 'done') continue;
    const deliveryIssue=visualReviewDeliveryIssue(t,doneTasks,allGaps);
    if(deliveryIssue){invalidVisual.push({task:t,reason:deliveryIssue});continue;}
    for (const ref of t.refs || []) {
      const gap = byKey.get(String(ref).toLowerCase());
      if (gap === 'ambiguous') { ambiguousRefs.push(ref); continue; }
      if (!gap) { unmatchedRefs.push(ref); continue; }
      // Build receipts stay durable, but only the separately accepted review
      // can reconcile delivery. A damaged split declaration is held, not guessed.
      if (isVisualBuildOnlyTask(t)) { buildOnly.push({ ref, task:t, gap }); continue; }
      // WF-G259: a finished board task is only source-level evidence for a
      // daemon repair. Reconcile --apply must not close it before restart and
      // a separate live check.
      if (gap.status === 'pending_restart') pendingRestart.push({ ref, task: t, gap });
      else if (OPEN_STATUSES.has(gap.status)) staleOpen.push({ ref, task: t, gap });
      else if (CLOSED_STATUSES.has(gap.status)) alreadyClosed.push({ ref, task: t, gap });
      else unrecognizedStatus.push({ ref, task: t, gap }); // WF-G13: surface, don't swallow
    }
  }
  return { staleOpen, pendingRestart, alreadyClosed, unmatchedRefs, ambiguousRefs, unrecognizedStatus, buildOnly, invalidVisual };
}

// ---------------------------------------------------------------- prompt build
/**
 * WF-G175: a packet prompt could contradict itself about which commands the
 * worker may run, and nothing detected it.
 *
 * PK-IB-GAPS STEP 3 said "Do NOT run tsc/build/vitest/dev-server ... Self-review
 * your edits", while the Guidance block of the SAME prompt said "Run
 * node --test scripts/idea-board/validate.test.mjs ... and report the real
 * result". The orchestrator had to send an out-of-band override to say which
 * block won. Without it the worker either skips the proof its own packet asks
 * for or breaks the stated gate rule, and either choice reads as worker error
 * in the durable record.
 *
 * The repair has two halves:
 *   1. STEP 3 is DERIVED from the Guidance, so the allowed and the forbidden
 *      command lists live in ONE block and cannot disagree.
 *   2. A packet may still name commands it explicitly forbids
 *      (`pkt.forbidCommands`). A Guidance that names a command on that list is
 *      a real contradiction, and prompt generation FAILS on it.
 */
const COMMAND_PATTERNS = [
  { name: 'vitest', re: /\b(?:npx\s+)?vitest\b|\bnpm\s+(?:run\s+)?test\b/i },
  { name: 'node --test', re: /\bnode\s+--test\b/i },
  { name: 'tsc', re: /\b(?:npx(?:\.cmd)?\s+)?tsc\b|\bnpm(?:\.cmd)?\s+run\s+typecheck\b/i },
  { name: 'build', re: /\bnpm\s+run\s+build\b|\bvite\s+build\b/i },
  { name: 'dev-server', re: /\bnpm\s+run\s+dev\b|\bvite\s+dev\b|\bdev-server\b/i },
];

/** Every known command the Guidance text names, in the order they are listed. */
export function commandsNamedInGuidance(guidance) {
  const text = sourceMembersProse(guidance);
  return COMMAND_PATTERNS.filter(({ re }) => re.test(text)).map(({ name }) => name);
}

/**
 * The exact command lines the Guidance asks the worker to run. These are quoted
 * back in STEP 3 so the worker runs what the packet asked for and nothing else.
 */
export function commandLinesInGuidance(guidance) {
  const out = [];
  for (const raw of sourceMembersProse(guidance).split(/\r?\n/)) {
    const line = raw.trim().replace(/^[-*>\s]+/, '');
    if (!line) continue;
    if (!COMMAND_PATTERNS.some(({ re }) => re.test(line))) continue;
    if (!/^(?:run\b|node\b|npx(?:\.cmd)?\b|npm(?:\.cmd)?\b|tsc\b)/i.test(line)) continue;
    out.push(line.replace(/^run\s+/i, '').replace(/\s+and report.*$/i, '').trim());
  }
  return [...new Set(out)];
}

/**
 * STEP 3's text for one packet: the single block that says what the worker may
 * run and what it may not. It NEVER forbids a command the Guidance names.
 */
export function buildVerificationStep(pkt) {
  const named = commandsNamedInGuidance(pkt.guidance);
  const forbidden = Array.isArray(pkt.forbidCommands) ? pkt.forbidCommands : [];
  const scope = pkt.verificationScope || 'packet';
  if (!['packet', 'repository'].includes(scope)) {
    throw new Error(`packet ${pkt.id}: verificationScope must be packet or repository.`);
  }
  const wholeRepoTypecheck = sourceMembersProse(pkt.guidance).split(/[;\r\n]+/)
    .map(line => line.trim().replace(/^[-*>\s]+/, ''))
    .filter(line => !/^(?:do not|don't|never|avoid|forbid)\b/i.test(line))
    .some(line => /\btsc\b|\bnpm(?:\.cmd)?\s+run\s+typecheck(?!:files)\b/i.test(line));
  // A grep after a full compile does not make the compile scoped. Refuse
  // that old packet recipe instead of silently rewriting the user's command.
  if (wholeRepoTypecheck && (scope !== 'repository' || typeof pkt.verificationReason !== 'string' || !pkt.verificationReason.trim())) {
    throw new Error(`packet ${pkt.id}: WF-G208 ordinary task typechecks must use npm run typecheck:files -- <owned paths>. `
      + 'A full typecheck needs verificationScope: repository and verificationReason naming the explicit authorization.');
  }
  const untrackedEolNote = 'git ls-files --eol prints no result for untracked files; use the EOL reading in the lock warning before multi-line edits. ';
  const clash = named.filter((c) => forbidden.includes(c));
  if (clash.length) {
    throw new Error(
      `packet ${pkt.id}: the Guidance names ${clash.join(', ')}, which this packet also lists in forbidCommands. ` +
      'A prompt cannot both ask for a command and forbid it (WF-G175). Remove it from one of the two lists.',
    );
  }
  if (!named.length) {
    return 'STEP 3 — Run ONLY the test/build/typecheck/dev-server commands the Guidance names. '
      + 'This Guidance names none of those verification commands, so run none of them. '
      + 'Read-only git (status, diff, log, ls-files, show) is allowed for shared-checkout inspection. '
      + untrackedEolNote
      + 'The orchestrator runs the integration gate. Self-review your edits for correctness.';
  }
  const lines = commandLinesInGuidance(pkt.guidance);
  const detail = lines.length ? lines.map((l) => `
  ${l}`).join('') : `
  (see the Guidance block above: ${named.join(', ')})`;
  return `STEP 3 — Run ONLY the test/build/typecheck/dev-server commands the Guidance names, and report their real output:${detail}
`
    + `Do not run other verification commands${forbidden.length ? ` (this packet also forbids: ${forbidden.join(', ')})` : ''}. `
    + 'Read-only git (status, diff, log, ls-files, show) is allowed for shared-checkout inspection. '
    + untrackedEolNote
    + (wholeRepoTypecheck ? `Repository-wide verification only: ${pkt.verificationReason}. This does not widen edit ownership. ` : '')
    + 'The orchestrator runs the integration gate. Self-review the rest of your edits.';
}

// Rendered proof is an attachment to a named running server, not permission
// to start one. Keep it separate from heavy command authorization (WF-G213).
export function buildVisualProofStep(pkt) {
  if(pkt.visualHandoff)return visualHandoffPrompt(pkt);
  if (pkt.visualProof === undefined) {
    return pkt.files.some(file => /\.(tsx|jsx|html|css)$/i.test(file))
      ? 'RENDERED ACCEPTANCE: visible UI changes need rendered proof. No visualProof URL is declared; ask the orchestrator for the running surface and report that acceptance blocked, not done, until inspected.'
      : '';
  }
  const proof = pkt.visualProof;
  let url;
  try { url = new URL(proof?.url); } catch {}
  if (!url || !['http:', 'https:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || typeof proof?.acceptance !== 'string' || !proof.acceptance.trim()) {
    throw new Error(`packet ${pkt.id}: visualProof needs a credential-free local HTTP(S) url and acceptance text.`);
  }
  return `RENDERED ACCEPTANCE (WF-G213): attach to the already-running server at ${url.href}. `
    + `Inspect this exact surface: ${proof.acceptance}. Capture one focused screenshot in your private scratch directory with a fresh filename, confirm it is ignored, and inspect the rendered image. `
    + 'Do not start, restart or stop a dev server, or run a full build. If this surface is unavailable or the image does not prove acceptance, report the blocker rather than done. A dev-server prohibition does not forbid this bounded browser attachment.';
}

/**
 * agora-bf4d.6 / WF-G171: the campaign a worker must name when it creates its
 * OWN task, because the orchestrator seeded none.
 *
 * POST /tasks refuses a task that states no campaign decision. The seeded
 * path already passes --campaign; this branch did not, so a worker following
 * its own packet prompt got a 400 before it could start.
 */
export function promptCampaignId(plan, pkt) {
  return pkt.campaign
    || (plan.campaign && plan.campaign.id)
    || plan.campaignId
    || campaignIdForPlan(plan, planMapCampaignForPlan(plan));
}

export function buildPrompt(plan, pkt, { taskId, lockSnapshot, sharedTypes } = {}) {
  assertResolvedPacketDiscovery(pkt);
  inspectPacketActionWiring(pkt);
  validatePacketUnions(pkt);
  inspectPacketDataEdits(pkt);
  inspectPacketDataValueOwnership(pkt);
  inspectPacketSourceRecordOwnership(pkt);
  const vendorVerification = checkedVendorVerificationNote(pkt);
  inspectPacketSourceRewrites(pkt);
  checkedPacketCountSources(pkt);
  checkedPacketDedupAcceptance(pkt);
  checkedPacketSymbolChecks(pkt);
  checkedPacketSourceReviews(pkt);
  checkedPacketSourceMembers(pkt);
  if (pkt.visualReview) return visualReviewPrompt(pkt);
  // Keep each worker's temporary files private and inside the checkout so
  // Node can resolve repo dependencies. Encoding preserves distinct identities
  // without letting a wave or handle escape the ignored scratch directory.
  const scratchSegment = (value) => encodeURIComponent(String(value)).replace(/\./g, '%2E');
  const scratchDir = `.agent/scratch/orchestrate/${scratchSegment(plan.wave || 'unnamed')}/${scratchSegment(pkt.handle)}`;
  const B = plan.baseUrl || DEFAULT_URL;
  const files = pkt.files.join(' ');
  const ownedList = pkt.files.map((f) => '`' + f + '`').join(', ');
  const external = pkt.agent === 'codex' || pkt.agent === 'gemini';
  const refs = packetRefs(pkt);
  // WF-G344: registration chooses the identity file. Every command must set
  // the same scope in its OWN shell call, including the first register call.
  const scopedClient = external
    ? `$env:AGORA_AGENT_ID='${pkt.handle}'; node tools/agora/client.mjs`
    : `AGORA_AGENT_ID=${pkt.handle} node tools/agora/client.mjs`;
  const taskTitle = shellDoubleQuoted(oneLine(sourceMembersProse(pkt.scope)), external);
  const taskBody = shellDoubleQuoted(packetTaskBody(pkt, sharedTypes), external);
  // Seeded workers still need the reviewed bytes and preservation inventory in their prompt.
  const preservationReviews = checkedPacketSourceReviews(pkt).declarations
    .map(({ bodyLine, ...review }) => 'SOURCE-REVIEW: ' + JSON.stringify(review)).join('\n');
  const memberClaims = checkedPacketSourceMembers(pkt).declarations
    .map(({ bodyLine, ...claim }) => 'REFERENCE-ONLY: SOURCE-MEMBERS: ' + JSON.stringify(claim)).join('\n');
  const taskRef = taskId || 'TASK_ID_HERE';
  const followupCampaign = shellDoubleQuoted(promptCampaignId(plan, pkt), external);
  const suggestedAgents = [...Object.keys(loadRegistry().agents), 'human-operator'].sort();
  const taskSetup = taskId
    ? `  ${scopedClient} task claim "${taskRef}" --url "${B}"`
    : `  ${scopedClient} task new ${taskTitle} --campaign ${promptCampaignId(plan, pkt)} --body ${taskBody} --id-only --url "${B}"
  # Copy the returned task id and replace TASK_ID_HERE in claim and done below.
  ${scopedClient} task claim "${taskRef}" --url "${B}"`;

  const hardRules = external
    ? `You are external fix-agent "${pkt.handle}" in a coordinated multi-agent fleet on the Aralia repo. You are ALREADY in the repo root (F:\\Repos\\Aralia). Other agents edit OTHER files in this SAME checkout right now.
HARD RULES: No state-changing git (commit, branch, worktree, checkout, reset, stash, clean). Read-only git (status, diff, log, ls-files, show) is allowed and expected for pre-existing diffs and line endings. No worktrees. Run tests/build/typecheck/dev-server only when Guidance and STEP 3 name them. Separate shell calls do NOT share env vars on this PowerShell host — set AGORA_AGENT_ID inline on each call or chain with ';'.`
    : `You are fix-agent **${pkt.handle}** in a coordinated multi-agent UX-fix fleet (Aralia, cwd F:\\Repos\\Aralia, Windows; Bash tool). ALL agents share ONE checkout. No state-changing git (commit, branch, worktree, checkout, reset, stash, clean). Read-only git (status, diff, log, ls-files, show) is allowed and expected for pre-existing diffs and line endings. Edit ONLY your owned files.`;

  return `${hardRules}

Packet **${pkt.id}** — ${sourceMembersProse(pkt.scope)}${refs.length ? ` (refs: ${refs.join(', ')})` : ''}.
Owned files (edit ONLY these): ${ownedList}.
${preservationReviews ? `\nSOURCE PRESERVATION RECEIPTS (WF-G307):\n${preservationReviews}\n` : ''}
${memberClaims ? `\nCURRENT SOURCE MEMBERS (WF-G283):\n${memberClaims}\n` : ''}
${formatLockSnapshot(lockSnapshot)}
${pkt.dataEdits?.length ? `\nDATA EDIT DECLARATIONS (WF-G327):${packetDataEditLines(pkt)}\n` : ''}
${sourceMembersProse(pkt.guidance) ? `\nGuidance:\n${sourceMembersProse(pkt.guidance)}\n` : ''}
${vendorVerification ? `\n${vendorVerification}\n` : ''}
${handoffPromptBlock(pkt)}
${localTestHomePromptBlock(pkt)}
${forwarderOnlyPromptBlock(pkt)}
${mountPointPromptBlock(pkt)}
${actionWiringPromptBlock(pkt)}
${unionPromptBlock(pkt)}
${sharedTypePromptBlock(pkt, sharedTypes)}
${productionCallerPromptBlock(pkt)}
${dataValuePromptBlock(pkt)}
${sourceRecordPromptBlock(pkt)}
${sourceRewritePromptBlock(pkt)}
${valueEquivalencePromptBlock(pkt)}
${runtimeLimitationPromptBlock(pkt)}
STEP 1 — Join Agora (each line is a self-contained shell call; do not rely on earlier exports or variables).
Your identity "${pkt.handle}" is ASSIGNED to you by the orchestrator and is unique across the fleet — always use it, never invent your own. Keep the AGORA_AGENT_ID prefix on EVERY Agora command, starting with register:
  # Replace the placeholder with this worker's exact harness task/thread id; Presence rejects omission.
  ${scopedClient} register ${pkt.handle} --pet ${pkt.pet} --note "${oneLine(sourceMembersProse(pkt.scope))}" --model ${pkt.model || pkt.agent} --session <your-task-or-thread-id> --url "${B}"
${taskSetup}
  ${scopedClient} task show "${taskRef}" --url "${B}"
CAMPAIGN POLICY (WF-G251): recorded membership, deliberate standalone with a reason, and NONE RECORDED are different states. Read task show, including any legacy task assigned in this packet. Do not run task campaign or backfill legacy membership yourself; only the orchestrator/master/human may decide that. Missing membership alone does not block the assigned repair. Discovered follow-ups use assigned campaign ${followupCampaign}, not an invented campaign or a silent standalone opt-out; verify it exists before filing, and ask the orchestrator if it does not.
COUNT PREMISES (WF-G343): before acting on a corpus count, re-read task show and run its COUNT-SOURCE commands only when Guidance authorizes the reviewed read-only measurement. Do not execute task text automatically; declarations do not widen ownership or verification permissions. Record timestamp, exact command, current count and an ignored receipt in a checkpoint and the final result before relying on the count. Dated SNAPSHOT numbers are history, not a current workload. If no source is recorded, the command is unsafe/unavailable, or the corpus scan is incomplete, stop the count-dependent work and ask the orchestrator to repair the premise; do not guess, silently reuse a stale number or mark that acceptance done.

DEDUPLICATION (WF-G325): when the task declares deduplication, prove one canonical definition, zero obsolete duplicate definitions and every named consumer's behavior. Do not optimize for a legacy hit count that leaves a duplicate alive. Reconcile conflicting criteria with the parent; keep old text as history. A valid declaration is not execution proof, file permission or authorization to run a new command. Missing equivalence/consumer proof means acceptance remains blocked.
DATA EDIT PREMISES (WF-G327): before any prescribed data diff, re-read task show and the exact current field. DATA-EDIT lines record authored from-values, never automatic write authority. Missing or undeclared from-values mean VERIFY BEFORE EDITING; an owned filename is not a request to rewrite it. Check the owning normalizer for semantically equivalent representations and preserve authored source text when the goal already holds. Checkpoint the timestamp, field, current raw value, reviewed semantic evidence and needed change (or no-change decision) before editing; if the premise is stale or unclear, stop and ask the orchestrator. A raw preflight does not grant files or commands, certify semantic necessity or skip required verification.
MOUNT DELIVERY (WF-G214): before promising a new or changed mounted feature, re-read task show and the declared MOUNT POINTS, audit the actual leaf/importer, and verify owned parent/test/declaration paths or the named unfinished dependent mounting task. Missing or contradictory mount declarations require parent reconciliation, not a guessed screen, an unowned edit or a done-with-unmounted result. Planned links and import/JSX clues are not rendered acceptance. Record current integration proof or the explicit pending follow-up within unchanged command, file and approval limits.
SHARED TYPE CHANGES (WF-G228): re-read the advisory SHARED TYPE DEPENDENCIES, actual imported contract and current owners/locks before deciding an extra type change is needed. An import is read context, not edit permission. If the required field or signature is outside your owned files, stop that dependent edit and ask the parent to reconcile explicit scope, an owning sibling/dependent task and blocking order; acquire your own newly authorized lock before editing. Do not silently encode structured data into strings, invent any/cast workarounds, widen ownership or mark the affected acceptance done with an untracked required type change. Missing or incomplete audit evidence needs manual source review, not a guess. Keep existing verification and approval limits.
DISCOVERY CHECK (WF-G333): the orchestrator must resolve presumed implementation surfaces before dispatch. Re-read task show and inspect the named current files before editing. If a required UI/state/caller surface is unnamed, absent or different from the body, stop the affected work and ask the orchestrator to audit the sources and choose the location explicitly. Do not invent a settings screen, silently choose a new source path or widen ownership. An old absence claim is historical evidence, not permission to build a parallel system. Exact intentional new paths still need parent assignment, creation intent and your own lock; use the ownership-overflow flow below when extra caller/prop-chain files are needed.
  ${scopedClient} lock ${files} --reason "${pkt.id}" --url "${B}"
  ${scopedClient} say "starting ${pkt.id}" --url "${B}"
If work will take >20 minutes, use a bounded heartbeat helper (30-minute default; renew only while active):
  ${scopedClient} heartbeat --daemonize --every 600 --for 30 --url "${B}"
  # If your harness exposes its PID, also pass --owner-pid <pid> (or set AGORA_OWNER_PID).
FAILURE HANDLING:
- task claim fails (409 = someone else claimed it): say "409 on task ${pkt.id} — standing down" and STOP; do not create a replacement task.
- lock returns CONFLICT/409: do NOT edit that file; say "409 CONFLICT: <file> held by <holder>" and skip that file.
- any call returns 401 mid-work: you were reaped (too long silent). Re-register with the SAME handle and pet (--pet ${pkt.pet}; add --allow-duplicate only if the old record lingers), then re-claim "${taskRef}" and re-lock before continuing. Keep the identity prefix on recovery calls too.

STEP 2 — Fix the issue(s) in ONLY your owned (successfully-locked) files, matching surrounding style. If a fix needs a file you don't own, do NOT edit it.
SHARED CONTROL CHANGES (WF-G305): before retiring a roller, clock, ID source or test control, tell the orchestrator the old control, replacement, affected test paths and actual evidence. The orchestrator must publish a durable control-notice to each owning sibling task before the retiring packet closes. During a long wave, read inbox and re-read task show before verification/completion; follow any SHARED CONTROL CHANGE block for your owned tests. A broadcast alone is not durable packet guidance, and a notice never widens your files or command permissions. If delivery or replacement proof is missing, report the blocker rather than accepting a lucky green run.
OWNER RULINGS (WF-G323): after an owner decision, re-read the full task body, history and authoritative source before work or acceptance. A SUPERSEDED BY RULING block explicitly replaces only its matching earlier instruction; keep the original brief as history. Do not follow a stale body over the recorded ruling, infer approval from a coordinator role, or treat reopening as proof of implementation. If the body, history, source or later decision conflict, stop the affected work and ask the coordinator to reconcile them before resuming. A ruling does not grant files or commands, remove dependencies or authorize protected/external actions.
${DOCUMENTATION_AUDIT_POLICY}
${SYMBOL_PREMISE_POLICY}
${SOURCE_PRESERVATION_POLICY}
${SOURCE_MEMBERS_POLICY}
${ACTION_WIRING_POLICY}
${UNION_CONSUMER_POLICY}
CAPABILITY CLAIM CORRECTIONS (WF-G334): if current evidence disproves a capability claim in a task brief, send the orchestrator the exact old text, source task, observed time, conditions, replacement guidance and proof. The orchestrator must sweep matching unfinished campaign tasks and append a durable CAPABILITY CLAIM CORRECTION before affected verification. Read inbox and re-read task show before verification/completion. A correction supersedes the matching earlier claim for the stated conditions only; check the actual host and touched surface, record current proof or a blocker. Historical headless/GPU evidence is not today's capability proof. The notice does not grant commands, files or runtime acceptance, and chat alone is not durable delivery.
AUDIT SCOPE CORRECTIONS (WF-G246): when a deepdive or audit supersedes a brief, give the parent its current exact citation, linked audit task and corrected scope. The parent must publish a durable AUDIT SCOPE CORRECTION when the audit lands, not relay it only in chat. Re-read task show and current audit before work/acceptance; the matching narrower scope is superseded, not the rest of the original intent. The parent must reconcile packet scope, acceptance, dependencies and file owners before implementation. Uncovered work or conflicting evidence blocks implementation; no notice expands ownership, commands or runtime acceptance, and historical counts need current proof.
SEPARATE VISUAL ACCEPTANCE (WF-G266): if visual inspection/tuning belongs to another owner, the parent must create a separate blocking-dependent review task before assigning the build. Re-read the exact build/review tasks and VISUAL-HANDOFF before work/completion. A build-only done result is not overall visual acceptance; keep the named review pending and report its exact task ID. Missing, completed, contradicted or differently claimed handoffs require parent reconciliation, not done-with-unperformed-criteria. The visual reviewer needs a separately scoped packet, authorized tuning locks and actual rendered proof; this contract grants no files, commands or server restart.
OWNERSHIP OVERFLOW (WF-G252): stop the affected edit and report the exact extra paths, required change, current lock holder, completed slice and missing acceptance. A free lock is NOT authorization to expand this packet. Search the board for an existing matching follow-up first; reuse it instead of duplicating it. If none exists, create this ownership-review task with real paths and evidence (replace every placeholder):
  ${scopedClient} tasks --url "${B}"
  ${scopedClient} campaign show ${followupCampaign} --url "${B}"
  ${scopedClient} task new "Ownership review for ${taskRef}: <extra file>" --campaign ${followupCampaign} --dep "${taskRef}:discovered-from" --ref "<extra repo-relative file>" --body "Source task ${taskRef}. DO: review packet ownership for <extra repo-relative file>. Required change: <change and evidence>. Current lock holder: <holder or none>. Acceptance still missing: <proof>. Do not edit this extra file until the orchestrator assigns it in a revised packet." --id-only --url "${B}"
  # Replace FOLLOWUP_TASK_ID_HERE with the returned id, or the existing matching follow-up id.
  # Block only a follow-up you created or own; ask a peer owner to update theirs.
  ${scopedClient} task state "FOLLOWUP_TASK_ID_HERE" blocked --reason "Awaiting orchestrator ownership assignment for <extra file>; source ${taskRef}" --url "${B}"
  ${scopedClient} task state "${taskRef}" blocked --reason "Ownership overflow: <extra file>; follow-up FOLLOWUP_TASK_ID_HERE; completed <slice>; missing <acceptance proof>" --url "${B}"
  ${scopedClient} say "OWNERSHIP OVERFLOW ${taskRef}: <extra file>, follow-up FOLLOWUP_TASK_ID_HERE; no unowned edit; needs parent assignment" --url "${B}"
The discovered-from edge records origin without blocking the follow-up on its already-blocked parent. Do not mark the original task done with a known acceptance gap. The orchestrator must review locks, widen or sequence packets, link any real blocking dependency, then authorize resumption; the review task itself grants no file access. When reusing a peer-owned follow-up, ask its owner to record the blocker rather than overwriting its state.
SCRATCH RULE (WF-G222/WF-G319/WF-G324): Private scratch directory: \`${scratchDir}/\`.
Put temporary helpers, patch scripts, logs and captures there, never in a shared scratchpad or another worker's directory. Before creating a file, confirm \`git check-ignore -v "${scratchDir}/probe.mjs"\` succeeds. Scripts kept here resolve repository dependencies from this checkout's node_modules; Node resolves packages from the script location, NOT the shell's cwd. If your harness requires external scratch, import repo dependencies by an absolute file URL instead. Use the stable tracked guide tools/agora/AGENT.md#private-scratch-and-capture-helpers, not a dated scratch capture path that may not exist (WF-G332). This scratch rule does not authorize extra verification commands or starting a dev server; Guidance and STEP 3 still control that. Preserve target file line endings and use your supported edit tool for owned source files; do not assume a shell script has repository write access.
SCRIPTS WITH BACKSLASHES (WF-G160): Never pipe scripts containing backslashes through a Bash heredoc or -e string (the harness silently strips backslashes, corrupting regexes and path separators). Write any script containing backslashes to a file with Write and execute that file.
EDIT CAPABILITY (WF-G241): preserve the target EOL with your supported file edit tool. A CRLF multi-line anchor failure is not an instruction to rewrite the repo file through Bash or a shell script. If no permitted edit tool can write your locked target, report the capability blocker; do not probe a sibling file, change permissions or bypass the sandbox. A transient UNKNOWN/-4094 write race is not proof of sandbox denial; use the existing bounded scripts/writeWithRetry.mjs helper only when script writes are already permitted.

${buildVerificationStep(pkt)}
${buildVisualProofStep(pkt)}

STEP 4 — Wrap up + REQUIRED workflow feedback (BOTH the say broadcast — live coordination — AND task done --result — the durable record the orchestrator verifies — are required):
Only mark done when every assigned acceptance criterion is proved. If verification is blocked, use task state "${taskRef}" blocked --reason "<missing proof or dependency>" instead of task done; still report, unlock and retire.
  ${scopedClient} say "status ${pkt.id}: <done or blocked, changes and actual proof>" --url "${B}"
  # If workflow friction was found, search before filing. Fill every quoted field; do not file a template stub.
  ${scopedClient} gap search "<workflow defect>" --project workflow --url "${B}"
  ${scopedClient} gap add --project workflow --gap "<workflow defect>" --evidence "<observed evidence>" --why "<impact>" --next "<repair>" --proof "<next proof>" --surface "<repair component>" --detected-during "${taskRef}" --notes "Detected during task ${taskRef}" --suggested-agent "<lane>" --url "${B}"
  # --surface names a component, never a board task id. --detected-during names the task.
  # Workflow Task/thread is your registered session; Notes retains the detection task separately.
  # Accepted --suggested-agent keys from agents.json: ${suggestedAgents.join(', ')}.
  # --proof and --suggested-agent are part of the contract, not optional follow-up data (WF-G215/WF-G216).
  # Run task done ONLY when all assigned acceptance is proved; otherwise use task state blocked above.
  ${scopedClient} task done "${taskRef}" --result "<files changed + actual acceptance proof>" --url "${B}"
  ${scopedClient} unlock --mine --url "${B}"
  ${scopedClient} say "WORKFLOW: <any friction with THIS coordination workflow itself, or 'none'>" --url "${B}"
  ${scopedClient} retire --note "completed ${pkt.id}" --url "${B}"
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
    const summary = `done ${status.done.length} / blocked ${status.blocked.length} / pending ${status.pending.length} / visual acceptance pending ${status.visualPending.length}`;
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
    if (status.visualPending.some((entry) => entry.state === 'blocked' || entry.state === 'invalid')) {
      console.log('Visual acceptance is blocked or inconsistent; this wave is not complete.');
      for (const entry of status.visualPending) console.log(`  ${entry.taskId || entry.packetId}: ${entry.reason}`);
      return 1;
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
  for (const entry of rep.visualPending) console.log(`  VISUAL ACCEPTANCE PENDING ${entry.taskId || entry.packetId}: ${entry.reason}`);
  return 0;
}

async function cmdReconcile(plan, root = 'docs/projects', { apply = false } = {}) {
  const { updateGapRow } = await import('./gapIndex.mjs');
  const tasks = (await fetchTasks(plan)).filter((t) => t.state === 'done' && (t.refs || []).length);
  // Always include the workflow registry so `workflow:WF-Gn` refs resolve.
  const gaps = indexGaps({ root }).concat(root === 'tools/agora' ? [] : indexGaps({ root: 'tools/agora' }));
  const rec = reconcileGaps(tasks, gaps);
  console.log(`Reconcile (board done-tasks vs ${root} GAPS registries)${apply ? ' — APPLYING row updates' : ''}:`);
  if (!rec.staleOpen.length && !rec.pendingRestart.length && !rec.invalidVisual.length) console.log('  ✅ no stale-open gaps — tracker matches the board.');
  for (const entry of rec.buildOnly) console.log(`  BUILD ONLY ${entry.task.id}: ${entry.ref} remains held for separate visual acceptance; no gap closure.`);
  for (const entry of rec.invalidVisual) console.log(`  VISUAL DELIVERY HELD ${entry.task.id}: ${entry.reason}`);
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
  for (const p of rec.pendingRestart) {
    console.log(`  ⏳ ${p.ref} is repaired in source but pending daemon restart in ${p.gap.file}`);
    console.log('      restart the daemon, verify the live behavior, then resolve the row manually; --apply will not close it.');
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
    const dispatchable = hasDispatchWiring(def);
    const flags = [];
    if (def.status === 'deprecated') flags.push('DO NOT DISPATCH');
    else if (!(def.roles || []).includes('worker')) flags.push('not a worker lane');
    else if (!dispatchable) flags.push('NOT WIRED for dispatch');
    const stale = staleConstraints(def, today);
    for (const c of stale) flags.push(`constraint EXPIRED ${c.expiresAt} — re-verify: ${c.note}`);
    console.log(`${id.padEnd(26)} ${String(def.status).padEnd(14)} roles:${roles.padEnd(20)} ${def.label || ''}${flags.length ? `\n${' '.repeat(27)}⚠ ${flags.join('; ')}` : ''}`);
    for (const c of def.constraints || []) {
      if (!stale.includes(c)) console.log(`${' '.repeat(27)}- ${c.note}${c.expiresAt ? ` (until ${c.expiresAt})` : ''}`);
    }
  }
  console.log('\nWorker-dispatchable = role "worker" + status ready/quota_limited + dispatch wiring. validatePlan enforces this.');
}

// ---------------------------------------------------------------- dispatch
async function cmdDispatch(plan, packetId) {
  const pkt = plan.packets.find((p) => p.id === packetId || p.handle === packetId);
  if (!pkt) throw new Error(`no packet "${packetId}" in plan`);
  if (pkt.visualReview) throw new Error('WF-G266: send the checked review prompt to the named existing reviewer; automatic dispatch would create another identity');
  const seeded = loadSeededMap(plan);
  withSeededTasks(plan, seeded);
  const ownership = await checkPacketLaunchLocks(plan, pkt, { taskId: seeded[pkt.id] });
  if (!ownership.ok) throw new Error(formatPacketOwnershipReport(ownership));
  const prompt = buildPrompt(plan, pkt, { taskId: seeded[pkt.id], lockSnapshot: ownership.lockSnapshot, sharedTypes: ownership.sharedTypes });

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

  // AM-G1: an API lane is a valid packet agent, but it has no process to spawn.
  // Write the prompt and hand the operator the exact route. Do NOT pretend the
  // packet was launched — a silent no-op would read as a success on the board.
  const apiDispatch = loadRegistry().agents[pkt.agent].dispatch || {};
  if (apiDispatch.type === 'api') {
    console.log(`api packet "${pkt.id}" — agent "${pkt.agent}" is an HTTP lane, so no process is spawned.`);
    console.log(`  endpoint:   ${apiDispatch.endpoint}${apiDispatch.path || ''}`);
    console.log(`  model:      ${apiDispatch.model || '(choose one — see the lane constraints)'}`);
    console.log(`  credential: ${apiDispatch.credential || '(none recorded)'}   — read it from the vault; never paste it into a file.`);
    console.log(`  prompt:     ${promptFile}`);
    return;
  }

  const probe = probeAgent(pkt.agent);
  if (!probe.ok) {
    console.log(`⚠ ${pkt.agent} unavailable: ${probe.reason}`);
    console.log(`  Fallback: re-assign packet ${pkt.id} to another agent (claude, or the other external) and re-dispatch.`);
    return;
  }

  const { cmd, args } = launchSpec(pkt.agent, prompt, loadRegistry(), { promptFile });
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
//
// Launch one external packet in the foreground of the wave scheduler. Unlike
// the legacy one-packet path above, this promise settles only when the worker
// exits, which is what frees a queue slot and creates a truthful terminal record.
async function runAttachedExternalPacket(plan, pkt, registry) {
  if (pkt.visualReview) throw new Error('WF-G266: visual review belongs to the named existing reviewer, not a new external process');
  const seeded = loadSeededMap(plan);
  withSeededTasks(plan, seeded);
  const ownership = await checkPacketLaunchLocks(plan, pkt, { taskId: seeded[pkt.id] });
  if (!ownership.ok) throw new Error(formatPacketOwnershipReport(ownership));
  const prompt = buildPrompt(plan, pkt, { taskId: seeded[pkt.id], lockSnapshot: ownership.lockSnapshot, sharedTypes: ownership.sharedTypes });
  const dir = path.resolve(REPO, '.agent/scratch/orchestrate');
  fs.mkdirSync(dir, { recursive: true });
  const promptFile = path.join(dir, `${pkt.handle}.prompt.txt`);
  const logFile = path.join(dir, `${pkt.handle}.log`);
  fs.writeFileSync(promptFile, prompt);

  const { cmd, args } = launchSpec(pkt.agent, prompt, registry, { promptFile });
  const logFd = fs.openSync(logFile, 'w');
  const shimDir = path.join(MODULE_DIR, 'git-shim');
  const env = { ...process.env, PATH: `${shimDir}${path.delimiter}${process.env.PATH || ''}` };

  return new Promise((resolve, reject) => {
    let child;
    let settled = false;
    let externalTimer = null;
    let emptyLogTimer = null;
    const dispatchCfg = registry?.agents?.[pkt.agent]?.dispatch || {};

    // Close the shared log descriptor and clear watchdogs exactly once whether
    // process creation fails, a watchdog fires, or the worker exits normally.
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      if (externalTimer) clearTimeout(externalTimer);
      if (emptyLogTimer) clearTimeout(emptyLogTimer);
      fs.closeSync(logFd);
      callback();
    };

    try {
      child = spawn(cmd, args, { cwd: REPO, stdio: ['ignore', logFd, logFd], env });
    } catch (error) {
      finish(() => reject(error));
      return;
    }

    // WF-G226: enforce optional external wall-clock timeout and empty-log timeout
    // so a silent headless hang (e.g. cline) aborts deterministically.
    if (Number.isInteger(dispatchCfg.externalTimeoutMs) && dispatchCfg.externalTimeoutMs > 0) {
      externalTimer = setTimeout(() => {
        try { child.kill(); } catch { /* ignore */ }
        finish(() => resolve({
          exitCode: 124,
          signal: 'SIGTERM',
          output: logFile,
          result: `pid ${child.pid} killed after externalTimeoutMs (${dispatchCfg.externalTimeoutMs}ms, WF-G226)`,
          promptFile,
          logFile,
        }));
      }, dispatchCfg.externalTimeoutMs);
    }

    if (Number.isInteger(dispatchCfg.emptyLogTimeoutMs) && dispatchCfg.emptyLogTimeoutMs > 0) {
      emptyLogTimer = setTimeout(() => {
        let logSize = 0;
        try { logSize = fs.statSync(logFile).size; } catch { logSize = 0; }
        if (logSize === 0) {
          try { child.kill(); } catch { /* ignore */ }
          finish(() => resolve({
            exitCode: 124,
            signal: 'SIGTERM',
            output: logFile,
            result: `pid ${child.pid} killed after emptyLogTimeoutMs (${dispatchCfg.emptyLogTimeoutMs}ms with 0-byte log, WF-G226)`,
            promptFile,
            logFile,
          }));
        }
      }, dispatchCfg.emptyLogTimeoutMs);
    }

    console.log(`started ${pkt.agent} packet "${pkt.id}" (pid ${child.pid}); queued slots open only after exit.`);
    child.once('error', (error) => finish(() => reject(error)));
    child.once('close', (code, signal) => finish(() => resolve({
      exitCode: Number.isInteger(code) ? code : (signal ? 1 : 0),
      signal,
      output: logFile,
      result: `pid ${child.pid} exited ${Number.isInteger(code) ? code : `on signal ${signal || 'unknown'}`}`,
      promptFile,
      logFile,
    })));
  });
}

// Dispatch every CLI packet in a plan through the bounded scheduler. Agent-tool
// packets keep their established manual prompt flow, while CLI packets gain a
// terminal record and visible failure status instead of disappearing detached.
async function cmdDispatchWave(plan, { cliMax } = {}) {
  const reg = loadRegistry();
  const cliPackets = plan.packets.filter((packet) => {
    const dispatch = reg.agents[packet.agent]?.dispatch || {};
    return dispatch.type !== 'agent-tool' && Boolean(dispatch.command);
  });
  const manualPackets = plan.packets.filter((packet) => !cliPackets.includes(packet));

  // Preserve the existing manual Claude behavior in mixed plans. These packets
  // are not fake terminal successes: the operator still receives the prompt and
  // must dispatch them through the Agent tool as before.
  for (const packet of manualPackets) await cmdDispatch(plan, packet.id);
  if (cliPackets.length === 0) return [];

  // Cache each lane's synchronous quota probe so a queued wave checks once, not
  // once per packet. A dry lane returns explicit failed records without spawning.
  const probes = new Map();
  const records = await dispatchPacketWave(cliPackets, {
    registry: reg,
    cliMax,
    runPacket: async (packet) => {
      if (!probes.has(packet.agent)) probes.set(packet.agent, probeAgent(packet.agent, reg));
      const probe = probes.get(packet.agent);
      if (!probe.ok) {
        return {
          exitCode: 1,
          output: `quota probe rejected ${packet.agent}: ${probe.reason}`,
          result: `packet ${packet.id} was not launched because ${packet.agent} is unavailable`,
        };
      }
      return runAttachedExternalPacket(plan, packet, reg);
    },
    onRecord: (record) => {
      const marker = record.status === 'succeeded' ? 'completed' : 'FAILED';
      console.log(`${marker} packet "${record.packetId}" status=${record.status} exit=${record.exitCode ?? 'unknown'} output=${record.output}`);
    },
  });

  const failed = records.filter((record) => record.status === 'failed');
  console.log(`wave dispatch terminal: ${records.length - failed.length} succeeded / ${failed.length} failed / ${records.length} total.`);
  return records;
}

// Probe and command details below continue to come only from agents.json. The
// scheduler never removes or substitutes registry status, role, or constraints.
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

export function launchSpec(agent, prompt, registry = loadRegistry(), { promptFile } = {}) {
  const def = registry.agents[agent];
  const d = def && def.dispatch;
  if (d && d.type === 'api') {
    throw new Error(`agent "${agent}" is an API lane (${d.endpoint}) — it has no CLI launch spec; call the endpoint instead`);
  }
  if (d && d.command) {
    // AM-G1: several onboarded lanes read the prompt from a FILE instead of a
    // trailing argument. Such a lane declares promptMode "file" and puts the
    // {promptFile} placeholder in its args, so no prompt text is appended.
    if (d.promptMode === 'file') {
      if (!promptFile) throw new Error(`agent "${agent}" needs a prompt file (dispatch.promptMode is "file") but none was written`);
      return { cmd: d.command, args: (d.args || []).map((a) => (a === '{promptFile}' ? promptFile : a)) };
    }
    return { cmd: d.command, args: [...(d.args || []), prompt] };
  }
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
  node tools/agora/orchestrate.mjs agents --matrix           diff the registry against the dashboard offerings ledger (exit 1 on any disagreement)
  node tools/agora/orchestrate.mjs prompt   <plan.json> <packetId>
  node tools/agora/orchestrate.mjs partition <plan.json>                       read-only file-ownership report for claimed tasks
  node tools/agora/orchestrate.mjs seed     <plan.json>
  node tools/agora/orchestrate.mjs control-notice <plan.json> <notice.json> [--dry]   append shared test-control guidance to affected tasks, then broadcast
  node tools/agora/orchestrate.mjs capability-notice <plan.json> <notice.json> [--dry]   sweep campaign tasks for an exact stale capability claim; append scoped corrections
  node tools/agora/orchestrate.mjs scope-notice <plan.json> <notice.json> [--dry]   carry reviewed audit scope and citation into matching campaign briefs
  node tools/agora/orchestrate.mjs split-visual <plan.json> <split.json> [--dry]   create linked build and pending visual acceptance tasks
  node tools/agora/orchestrate.mjs ruling-unblock <plan.json> <ruling.json> [--dry]   verify recorded ruling and exact blocker; reconcile the brief before reopening
  node tools/agora/orchestrate.mjs source-review <plan.json> <review.json> [--dry]   capture reviewed current block and append preservation receipt without replacing sibling text
  node tools/agora/orchestrate.mjs dispatch <plan.json> [packetId] [--max <positive-integer>]   one packet, or a bounded external CLI wave
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

// Distinguish an omitted override from a missing/invalid value. This check runs
// before dispatch chooses either the legacy one-packet path or the wave path, so
// a malformed ceiling can never be ignored while a worker is launched.
function getDispatchMaxFlag(argv) {
  if (!argv.includes('--max')) return undefined;
  const value = getFlag(argv, '--max');
  if (value === undefined || String(value).startsWith('--')) {
    throw new Error('--max requires a positive whole number');
  }
  return validateDispatchMax(value, '--max');
}

async function main() {
  const [cmd, planArg, packetArg] = process.argv.slice(2);
  if (!cmd || cmd === 'help') { console.log(HELP); return; }
  if (cmd === 'agents') {
    // --matrix diffs this registry against the dashboard offerings ledger (AM-G1).
    if (process.argv.includes('--matrix')) { process.exitCode = await runMatrixCheck(); return; }
    cmdAgents();
    return;
  }
  if (cmd === 'prompt') {
    const plan = loadPlan(planArg);
    const seeded = loadSeededMap(plan);
    const ownership = await checkPlanOwnership(withSeededTasks(plan, seeded));
    if (!ownership.ok) throw new Error(formatPacketOwnershipReport(ownership));
    const pkt = requirePacket(plan, packetArg);
    console.log(buildPrompt(plan, pkt, { taskId: seeded[pkt.id], lockSnapshot: ownership.lockSnapshot, sharedTypes: ownership.sharedTypes }));
    return;
  }
  const plan = loadPlan(planArg);
  if (cmd === 'source-review') {
    if (!packetArg || packetArg.startsWith('--') || process.argv.slice(5).some(flag => flag !== '--dry')) throw new Error('usage: source-review <plan.json> <review.json> [--dry]');
    const review = JSON.parse(fs.readFileSync(path.resolve(packetArg), 'utf8'));
    const receipt = await publishSourceReview(plan, review, { env: process.env, dryRun: process.argv.includes('--dry') });
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }
  if (cmd === 'ruling-unblock') {
    if (!packetArg || packetArg.startsWith('--') || process.argv.slice(5).some(flag => flag !== '--dry')) {
      throw new Error('usage: ruling-unblock <plan.json> <ruling.json> [--dry]');
    }
    // Only reconcile a reviewed existing decision. No workers, products or
    // source files are changed, and no owner consent is inferred by this call.
    const ruling = JSON.parse(fs.readFileSync(path.resolve(packetArg), 'utf8'));
    const receipt = await publishRulingUnblock(plan, ruling, { env: process.env, dryRun: process.argv.includes('--dry') });
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }
  if(cmd==='split-visual'){
    if(!packetArg||packetArg.startsWith('--')||process.argv.slice(5).some(flag=>flag!=='--dry'))throw new Error('usage: split-visual <plan.json> <split.json> [--dry]');
    const input=JSON.parse(fs.readFileSync(path.resolve(packetArg),'utf8'));
    const receipt=await createVisualSplit(plan,input,{env:process.env,taskBody:packetTaskBody,dryRun:process.argv.includes('--dry')});
    console.log(JSON.stringify(receipt,null,2));return;
  }
  if (cmd === 'scope-notice') {
    if (!packetArg || packetArg.startsWith('--') || process.argv.slice(5).some(flag => flag !== '--dry')) {
      throw new Error('usage: scope-notice <plan.json> <notice.json> [--dry]');
    }
    // Reuse current campaign tasks and the atomic append delivery; no workers
    // are created, no historical tasks restored and no permissions expanded.
    const notice = JSON.parse(fs.readFileSync(path.resolve(packetArg), 'utf8'));
    const receipt = await publishScopeNotice(plan, notice, {env:process.env,dryRun:process.argv.includes('--dry')});
    console.log(JSON.stringify(receipt,null,2));
    return;
  }
  if (cmd === 'capability-notice') {
    if (!packetArg || packetArg.startsWith('--') || process.argv.slice(5).some(flag => flag !== '--dry')) {
      throw new Error('usage: capability-notice <plan.json> <notice.json> [--dry]');
    }
    // Use current campaign tasks, not a potentially incomplete packet/seed map.
    // This command neither creates tasks nor registers or dispatches workers.
    const notice = JSON.parse(fs.readFileSync(path.resolve(packetArg), 'utf8'));
    const receipt = await publishCapabilityNotice(plan, notice, { env: process.env, dryRun: process.argv.includes('--dry') });
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }
  if (cmd === 'control-notice') {
    if (!packetArg || packetArg.startsWith('--') || process.argv.slice(5).some(flag => flag !== '--dry')) {
      throw new Error('usage: control-notice <plan.json> <notice.json> [--dry]');
    }
    const notice = JSON.parse(fs.readFileSync(path.resolve(packetArg), 'utf8'));
    const receipt = await publishControlNotice(plan, notice, {
      // Explicit taskIds are sufficient here; this command never dispatches
      // workers or creates missing tasks. Corrupt existing seed maps still fail.
      seededMap: loadSeededMap(plan, { warnMissing: false }), env: process.env, dryRun: process.argv.includes('--dry'),
    });
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }
  if (cmd === 'partition') {
    const ownership = await checkPlanOwnership(withSeededTasks(plan, loadSeededMap(plan, { warnMissing: false })));
    console.log(formatPacketOwnershipReport(ownership));
    for (const note of packetVerificationNotes(plan)) console.log(note);
    process.exitCode = ownership.ok ? 0 : 1;
    return;
  }
  if (cmd === 'seed') return void (await cmdSeed(plan));
  if (cmd === 'status') return void (await cmdStatus(plan));
  if (cmd === 'feedback') return void (await cmdFeedback(plan, Number(getFlag(process.argv, '--since') || 0)));
  if (cmd === 'dispatch') {
    const cliMax = getDispatchMaxFlag(process.argv);
    const ownership = await checkPlanOwnership(withSeededTasks(plan, loadSeededMap(plan, { warnMissing: false })));
    if (!ownership.ok) throw new Error(formatPacketOwnershipReport(ownership));
    const requestedPacket = packetArg && !packetArg.startsWith('--') ? packetArg : undefined;
    if (requestedPacket) return void (await cmdDispatch(plan, requestedPacket));
    return void (await cmdDispatchWave(plan, { cliMax }));
  }
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
