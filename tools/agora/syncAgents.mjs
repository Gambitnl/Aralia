/**
 * This file checks that Aralia's machine-readable agent registry (`tools/agora/agents.json`)
 * stays synchronized with the Operator Dashboard's Agent Matrix offerings ledger.
 *
 * It exists so orchestrators never dispatch a lane the operator has benched or miss a lane
 * the dashboard marked worker-ready. It queries the live dashboard API first and falls back
 * to the read-only on-disk ledger file (merging the dashboard's seeded `codex` and `gemini`
 * defaults that the dashboard strips on write, and reporting the file's modification time so
 * drift is visible, WF-G182).
 *
 * Called by: `node tools/agora/syncAgents.mjs`, `node tools/agora/orchestrate.mjs agents --matrix`,
 * and `tools/agora/orchestrate.registry.test.mjs`.
 * Depends on: `tools/agora/agents.json` and the Operator Dashboard offerings endpoint/file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// Constants & Seeded Dashboard Defaults
// ============================================================================
// Defines file paths, endpoint URLs, and the two seeded offerings (`codex` and
// `gemini`) that `Aralia-operator-dashboard` strips from `agent-offerings.json`
// whenever their readiness matches the seeded `benched` default (WF-G182).
// ============================================================================

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const REGISTRY_FILE = path.join(MODULE_DIR, 'agents.json');
export const LEDGER_URL = 'http://127.0.0.1:3040/api/agent-offerings';
export const LEDGER_FILE = path.resolve(
  MODULE_DIR,
  '../../../Aralia-operator-dashboard/.agent/orchestration/agent-offerings.json',
);

/** The one ledger value that means "this lane may take worker packets". */
export const WORKER_READY = 'worker-ready';

/**
 * Seeded offerings that the Operator Dashboard (`agentSessionManager.ts`) omits
 * from `agent-offerings.json` on disk when they match their default `benched` state,
 * but always includes in `GET /api/agent-offerings`. Merging these during offline
 * file fallback prevents false "matches no dashboard offering" errors (WF-G182).
 */
export const SEEDED_DASHBOARD_OFFERINGS = Object.freeze([
  {
    id: 'codex',
    dispatchEligibility: {
      status: 'benched',
      reason: 'Seeded dashboard default (benched for worker dispatch; omitted from on-disk ledger when unchanged)',
    },
  },
  {
    id: 'gemini',
    dispatchEligibility: {
      status: 'benched',
      reason: 'Seeded dashboard default (benched/deprecated; omitted from on-disk ledger when unchanged)',
    },
  },
]);

// ============================================================================
// Dispatch & Ledger Normalization Helpers
// ============================================================================
// Determines whether an `agents.json` entry is wired and dispatchable as a worker,
// and normalizes both the live API response and the offline fallback file into a
// uniform list of offerings.
// ============================================================================

/**
 * Dispatch wiring an orchestrator can actually launch. Three shapes count:
 * the in-process Agent tool, an external CLI command, and an HTTP API endpoint.
 * validatePlan uses this same predicate, so the registry view, the plan gate and
 * this diff can never disagree about what "wired" means.
 */
export function hasDispatchWiring(def) {
  const d = (def && def.dispatch) || {};
  if (d.type === 'agent-tool') return true;
  if (d.type === 'api') return Boolean(d.endpoint);
  return Boolean(d.command);
}

/** Registry-side answer to "can this lane take a worker packet today?". */
export function isWorkerDispatchable(def) {
  if (!def) return false;
  if (def.status === 'deprecated') return false;
  if (!(def.roles || []).includes('worker')) return false;
  if (def.status !== 'ready' && def.status !== 'quota_limited') return false;
  return hasDispatchWiring(def);
}

/**
 * The live endpoint returns { offerings: [...] } and the on-disk ledger is a
 * bare id-keyed object. Accept both shapes so an operator can diff offline.
 * When `mergeSeededDefaults` is true (used for the on-disk file fallback),
 * any seeded dashboard offering omitted by `writeOfferings()` is appended.
 */
export function normalizeOfferings(raw, { mergeSeededDefaults = false } = {}) {
  if (!raw || typeof raw !== 'object') throw new Error('agent-offerings: expected an object or an array');
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw.offerings) ? raw.offerings : Object.values(raw));
  const normalized = list.filter((o) => o && typeof o.id === 'string');
  if (!mergeSeededDefaults) return normalized;

  const presentIds = new Set(normalized.map((o) => o.id));
  const merged = [...normalized];
  for (const seeded of SEEDED_DASHBOARD_OFFERINGS) {
    if (!presentIds.has(seeded.id)) {
      merged.push(seeded);
    }
  }
  return merged;
}

/**
 * Prefer the live dashboard, fall back to the checked-in ledger. The fallback is
 * reported with the file's mtime, never hidden: the file is a fallback, not a live
 * source of truth (WF-G182).
 */
export async function loadOfferings({
  url = LEDGER_URL,
  file = LEDGER_FILE,
  timeoutMs = 8000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (url && typeof fetchImpl === 'function') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: controller.signal });
      if (res && res.ok) {
        return { offerings: normalizeOfferings(await res.json()), source: url, live: true, mtimeIso: null };
      }
    } catch {
      // fall through to the file — the reason is reported by `source` below
    } finally {
      clearTimeout(timer);
    }
  }
  if (!fs.existsSync(file)) throw new Error(`agent-offerings: no live endpoint at ${url} and no ledger file at ${file}`);
  const stat = fs.statSync(file);
  const mtimeIso = stat.mtime.toISOString();
  const offerings = normalizeOfferings(JSON.parse(fs.readFileSync(file, 'utf8')), {
    mergeSeededDefaults: true,
  });
  return { offerings, source: file, live: false, mtimeIso };
}

// ============================================================================
// Matrix Comparison & CLI Runner
// ============================================================================
// Compares every `agents.json` entry against the Operator Dashboard offerings
// list and reports any un-overridden eligibility drift.
// ============================================================================

function eligibilityOf(offering) {
  const e = offering.dispatchEligibility;
  if (!e) return { status: 'unknown', reason: '' };
  if (typeof e === 'string') return { status: e, reason: '' };
  return { status: e.status || 'unknown', reason: e.reason || '' };
}

/**
 * Every disagreement between the ledger and the registry, as rows.
 * level "error" fails the check; level "override" and "info" only report.
 */
export function diffMatrix(registry, offerings) {
  const rows = [];
  const agents = (registry && registry.agents) || {};
  const byMatrixId = new Map();

  for (const [id, def] of Object.entries(agents)) {
    if (!('matrixId' in def)) {
      rows.push({ level: 'error', agent: id, message: 'row has no "matrixId" — set the dashboard offering id, or null for a local-only lane' });
      continue;
    }
    if (def.matrixId === null) {
      rows.push({ level: 'info', agent: id, message: 'local-only lane (matrixId null) — it has no dashboard offering to diff against' });
      continue;
    }
    if (byMatrixId.has(def.matrixId)) {
      rows.push({ level: 'error', agent: id, message: `matrixId "${def.matrixId}" is already claimed by row "${byMatrixId.get(def.matrixId)}"` });
      continue;
    }
    byMatrixId.set(def.matrixId, id);
  }

  const seen = new Set();
  for (const offering of offerings) {
    const { status, reason } = eligibilityOf(offering);
    const agentId = byMatrixId.get(offering.id);
    if (!agentId) {
      if (status === WORKER_READY) {
        rows.push({ level: 'error', agent: offering.id, message: `dashboard lane is ${WORKER_READY} but no agents.json row carries matrixId "${offering.id}" — ${reason}` });
      }
      continue;
    }
    seen.add(offering.id);
    const def = agents[agentId];
    const expected = status === WORKER_READY;
    const actual = isWorkerDispatchable(def);
    if (expected === actual) continue;
    if (def.matrixOverride && def.matrixOverride.reason) {
      rows.push({ level: 'override', agent: agentId, message: `documented divergence from dashboard "${status}": ${def.matrixOverride.reason}` });
      continue;
    }
    rows.push({
      level: 'error',
      agent: agentId,
      message: expected
        ? `dashboard says ${WORKER_READY} but the row is not worker-dispatchable (roles ${JSON.stringify(def.roles || [])}, status "${def.status}", wired ${hasDispatchWiring(def)}) — ${reason}`
        : `row is worker-dispatchable but the dashboard says "${status}" — ${reason}`,
    });
  }

  for (const [matrixId, agentId] of byMatrixId) {
    if (seen.has(matrixId)) continue;
    rows.push({ level: 'error', agent: agentId, message: `matrixId "${matrixId}" matches no dashboard offering — the id is stale or the ledger dropped the lane` });
  }

  return rows;
}

/** Print the diff. Returns the process exit code: 0 when no error row exists. */
export async function runMatrixCheck({ registry, loader = loadOfferings, log = console.log } = {}) {
  const reg = registry || JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  const { offerings, source, live, mtimeIso } = await loader();
  const rows = diffMatrix(reg, offerings);
  const errors = rows.filter((r) => r.level === 'error');
  const overrides = rows.filter((r) => r.level === 'override');

  const sourceBanner = live
    ? ' (live)'
    : ` (FILE FALLBACK${mtimeIso ? `, mtime ${mtimeIso}` : ''} — the live endpoint did not answer; the file is a fallback, not a source of truth)`;
  log(`Agent Matrix sync check — ${offerings.length} dashboard offering(s) from ${source}${sourceBanner}`);
  for (const row of errors) log(`  ✗ ${row.agent}: ${row.message}`);
  for (const row of overrides) log(`  ~ ${row.agent}: ${row.message}`);
  if (errors.length === 0) log(`  ✓ zero disagreements (${overrides.length} documented override(s)).`);
  else log(`\n  ${errors.length} disagreement(s). Follow the PROCEDURE at the top of tools/agora/syncAgents.mjs.`);
  return errors.length === 0 ? 0 : 1;
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invoked === path.resolve(fileURLToPath(import.meta.url))) {
  runMatrixCheck()
    .then((code) => { process.exitCode = code; })
    .catch((e) => { console.error('syncAgents error:', e.message); process.exitCode = 1; });
}
