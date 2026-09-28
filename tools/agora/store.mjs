// tools/agora/store.mjs
// Agora coordination store — the single source of truth for all coordination state.
//
// Pure Node.js ESM, zero npm dependencies. Holds in-memory state (agents, locks,
// tasks, messages), funnels every mutation through one `emit()` path that:
//   (a) appends the Event to the append-only JSONL journal,
//   (b) fans the Event out to in-process subscribers (for SSE later),
//   (c) updates in-memory state.
// Durability is a periodic JSON snapshot + the journal tail; on construction we load
// the snapshot then replay journal events with seq > snapshot.lastSeq.
//
// See docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  registrationThreadRequirement,
  validateRegistrationThreadIdentity,
} from './identity-policy.mjs';
// The reducers and the state helpers they need live in their own module, so the
// read-only surface replays the journal with the SAME rules (WF-G168).
import {
  applyJournalText,
  clonePet,
  createReducers,
  createStateHelpers,
  loadSnapshotInto,
  normalizeCategoryInput,
  normalizeCategoryList,
} from './store-reducers.mjs';
// The charter, Plan Map contract, and triage rules live in one pure module,
// because the read-only surface must apply the SAME rules without the store.
import {
  DISPOSITIONS,
  approverRolesFor,
  buildTriageReport,
  campaignProgress,
  taskTimes,
  validateCharter,
  planMapHealth,
} from './campaign-model.mjs';

const TASK_STATES = new Set(['open', 'claimed', 'in_progress', 'blocked', 'done']);
// Result disposition is deliberately smaller than task state. A size-declined
// triage can therefore remain a `done` board event without being mistaken for
// the substantive review that the operator still needs.
const TASK_RESULT_DISPOSITIONS = new Set(['triage_only', 'substantive']);
const CAMPAIGN_STATES = new Set(['active', 'blocked', 'done']);
const CAMPAIGN_ROLES = new Set(['lead', 'deputy']);

const UNCATEGORIZED_TASK_CATEGORY = 'uncategorized';

// ===========================================================================
// Seat naming rules (D-N) — EXPORTED, because more than one thing enforces them
// ===========================================================================
//
//  These left the store's closure on 2026-09-08. A name suggester has to apply
//  exactly these rules before it offers a name, and a COPY of a rule list is a
//  rule list that drifts. One definition, imported by everything that checks.

export const SEAT_NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

// A seat named for the job is a role wearing a person's clothes. A seat named
// for a model dies the day the model changes. Both are refused by name.
export const SEAT_NAME_FORBIDDEN = [
  'orch', 'orchestrator', 'master', 'worker', 'agent', 'lead', 'deputy',
  'admin', 'bot', 'scout', 'fixer', 'reviewer', 'builder',
  'claude', 'opus', 'sonnet', 'haiku', 'fable', 'gpt', 'codex', 'gemini',
  'kimi', 'llama', 'mistral', 'anthropic', 'openai', 'google',
];

export function seatIdFor(name) {
  return 'seat-' + String(name).trim().toLowerCase();
}

/** Refuse a seat name that breaks one of the four D-N constraints. */
export function assertSeatName(raw) {
  const name = String(raw || '').trim().toLowerCase();
  if (!name) return { ok: false, error: 'a seat needs a name' };
  if (!SEAT_NAME_RE.test(name)) {
    return { ok: false, error: `seat name "${name}" must be lowercase words joined by hyphens` };
  }
  for (const part of name.split('-')) {
    if (SEAT_NAME_FORBIDDEN.includes(part)) {
      return {
        ok: false,
        error: `seat name "${name}" contains "${part}", which names a job or a model. `
          + 'A seat is a lasting identity: naming it for the job recreates the role it replaces, '
          + 'and naming it for a model kills it when the model changes (D-N).',
      };
    }
  }
  return { ok: true, name };
}

// The pet gallery is also Agora's assignment catalog. Loading it beside the
// store keeps task claims and dashboard rendering on one authoritative list;
// a missing catalog therefore becomes an explicit claim error instead of a
// task silently claiming without the pet the operator expects.
const DEFAULT_PET_CATALOG = loadPetCatalog();

// Keep only the small, public identity fields needed by task records and the
// dashboard. Package URLs and any future private metadata stay in the manifest.
function normalizePetRecord(pet) {
  if (!pet || typeof pet.slug !== 'string' || typeof pet.displayName !== 'string') return null;
  return {
    slug: pet.slug,
    displayName: pet.displayName,
    kind: typeof pet.kind === 'string' ? pet.kind : 'humanoid',
    submittedBy: typeof pet.submittedBy === 'string' ? pet.submittedBy : '',
    localPetJson: typeof pet.localPetJson === 'string' ? pet.localPetJson : '',
    localSpritesheet: typeof pet.localSpritesheet === 'string' ? pet.localSpritesheet : '',
    source: typeof pet.source === 'string' ? pet.source : '',
  };
}

// Accept either the manifest object or a test-provided array, which lets unit
// tests prove assignment order without depending on today's gallery contents.
function normalizePetCatalog(catalog) {
  const rows = Array.isArray(catalog) ? catalog : catalog && Array.isArray(catalog.pets) ? catalog.pets : [];
  return rows.map(normalizePetRecord).filter(Boolean);
}

// Read the catalog once when the module loads. A malformed file produces an
// empty catalog so operators can still open Agora and see the repair error.
function loadPetCatalog() {
  try {
    const manifestUrl = new URL('./dashboard/pets/pets.json', import.meta.url);
    return normalizePetCatalog(JSON.parse(fs.readFileSync(manifestUrl, 'utf8')));
  } catch {
    // Claiming will report the unavailable catalog. Startup remains readable so
    // operators can still inspect and repair the board instead of losing Agora.
    return [];
  }
}


// Structured, provenance-encoding handle grammar: lowercase role.domain[/child...],
// e.g. "master.desktop", "orch.planmap/glossary". Opaque auto-names ("agent-16d417")
// and bare single-segment names ("alice") are rejected so the handle itself carries
// provenance. See docs/superpowers/plans/2026-07-06-agent-identity-provenance-plan.md.
const HANDLE_RE = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+(\/[a-z0-9][a-z0-9-]*)*$/;

export function validateHandle(handle) {
  if (typeof handle !== 'string' || handle.length === 0) {
    return { ok: false, reason: 'handle is required' };
  }
  if (!HANDLE_RE.test(handle)) {
    return {
      ok: false,
      reason: 'handle must be lowercase role.domain[/child], e.g. "orch.planmap/glossary" — not an opaque name like "agent-16d417"',
    };
  }
  return { ok: true };
}


/** D-S: hierarchical task ids, so membership cannot be left out.
 *
 *  A task id is `<campaignId>.<n>` — the effort it belongs to is part of its
 *  name rather than a separate box someone has to remember. That box was
 *  missed 119 times out of 119, which is what this shape removes.
 *
 *  A task with no campaign gets a standalone `agora-<hash>`, because there is
 *  no membership to encode.
 *
 *  EVERY id an object has ever had keeps working, forever, as an alias.
 *  Fifteen finished board results and four WORKFLOW_GAPS rows quote a UUID
 *  prefix; rewriting those quotes would be editing the past, which D-E
 *  forbids outright. So the migration ADDS a name, it never removes one.
 */
const SHORT_ID_ALPHABET = '0123456789abcdef';

function shortHash(seed, length = 4) {
  const digest = crypto.createHash('sha256').update(String(seed)).digest();
  let out = '';
  for (let i = 0; i < length; i += 1) out += SHORT_ID_ALPHABET[digest[i] % 16];
  return out;
}

/** D-M / D-T: the ten dependency types, taken whole from Beads.
 *
 *  The four BLOCKING types gate readiness. The six non-blocking ones record a
 *  relationship the board can read and reason about without holding any task
 *  back — which is the point of naming them at all. Before this, one untyped
 *  arrow carried every meaning at once, so "X replaced Y" and "X cannot start
 *  until Y lands" were the same edge.
 *
 *  The store REFUSES an unknown type. That refusal is the whole decision, not
 *  a detail of it: a declared vocabulary that nothing enforces is exactly how
 *  WF-G80 held three illegal values for two days without a single complaint.
 */
export const TASK_DEP_TYPES = Object.freeze({
  // Blocking — the dependency must complete before the holder is ready.
  blocks: { blocking: true, summary: 'the dependency must finish first' },
  'parent-child': { blocking: true, summary: 'the holder is part of the dependency' },
  'waits-for': { blocking: true, summary: 'the holder waits on the dependency, without owning it' },
  'conditional-blocks': { blocking: true, summary: 'blocking only while a stated condition holds' },
  // Non-blocking — recorded meaning, no gate.
  related: { blocking: false, summary: 'the two touch the same ground' },
  tracks: { blocking: false, summary: 'the holder follows the dependency without depending on it' },
  'discovered-from': { blocking: false, summary: 'the holder was found while working the dependency' },
  'caused-by': { blocking: false, summary: 'the dependency produced the holder' },
  validates: { blocking: false, summary: 'the holder proves the dependency landed' },
  supersedes: { blocking: false, summary: 'the holder replaces the dependency' },
});

/** What an untyped dependency always meant in practice: a hard gate. Every
 *  pre-migration dep gated readiness, so this is a restatement rather than a
 *  guess about intent. */
export const DEFAULT_TASK_DEP_TYPE = 'blocks';

export function isBlockingDepType(type) {
  const spec = TASK_DEP_TYPES[type];
  return Boolean(spec && spec.blocking);
}

/** Accept a plain id (legacy shape) or { id, type }, and return the typed
 *  shape. An unknown type throws — silently coercing it to the default would
 *  reproduce the failure this decision exists to remove. */
export function normalizeTaskDeps(deps) {
  const input = Array.isArray(deps) ? deps : deps ? [deps] : [];
  const out = [];
  const seen = new Set();
  for (const raw of input) {
    if (!raw) continue;
    const id = typeof raw === 'string' ? raw.trim() : String(raw.id || '').trim();
    if (!id) continue;
    const type = typeof raw === 'string'
      ? DEFAULT_TASK_DEP_TYPE
      : String(raw.type || DEFAULT_TASK_DEP_TYPE).trim();
    if (!Object.prototype.hasOwnProperty.call(TASK_DEP_TYPES, type)) {
      throw new Error(
        'unknown dependency type: ' + type
        + ' (expected one of ' + Object.keys(TASK_DEP_TYPES).join(', ') + ')',
      );
    }
    const key = id + '\u0000' + type;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id, type });
  }
  return out;
}


function normalizeTaskPath(raw) {
  if (!raw) return '';
  let p = String(raw).trim().replace(/\\/g, '/');
  // Normalize absolute Windows / mixed paths into repo-relative style.
  const lower = p.toLowerCase();
  const marker = '/repos/aralia/';
  const markerPos = lower.indexOf(marker);
  if (markerPos >= 0) {
    p = p.slice(markerPos + marker.length);
  }
  p = p.replace(/^[a-z]:\//, '');
  p = p.replace(/^\/+/, '').replace(/\/+$/, '');
  return p;
}

function categoryFromPath(raw) {
  const p = normalizeTaskPath(raw);
  if (!p) return UNCATEGORIZED_TASK_CATEGORY;
  const lower = p.toLowerCase();
  if (lower.startsWith('.github/')) return 'github';
  if (lower.startsWith('docs/projects/')) {
    const parts = lower.split('/');
    const project = parts[2] || 'docs-project';
    return `project:${project}`;
  }
  if (lower.startsWith('docs/')) return 'docs';
  if (lower.startsWith('src/')) return 'src';
  if (lower.startsWith('tools/')) return 'tools';
  if (lower.startsWith('scripts/')) return 'scripts';
  if (lower.startsWith('tests/')) return 'tests';
  if (lower.startsWith('misc/')) return 'misc';
  return UNCATEGORIZED_TASK_CATEGORY;
}

function firstPathFromRefs(refs = []) {
  for (const ref of refs) {
    if (typeof ref !== 'string') continue;
    const match = ref.match(/([^:]+):\d+$/);
    const rawPath = match ? match[1] : ref;
    const category = categoryFromPath(rawPath);
    if (category !== UNCATEGORIZED_TASK_CATEGORY) return category;
  }
  return '';
}

function inferTodoCategoryFromBody(body) {
  if (typeof body !== 'string') return '';
  const match = /TODO\(\s*([^)]+)\s*\)/i.exec(body);
  if (!match) return '';

  const rawTag = match[1].trim().toLowerCase();
  const normalizedTag = normalizeCategoryInput(rawTag);
  if (!normalizedTag) return '';

  if (/^\d{4}-\d{2}-\d{2}/.test(normalizedTag)) return 'todo:cleanup';
  if (/\blint\b/.test(rawTag) || /lint-intent/.test(normalizedTag)) return 'todo:lint';
  if (/next-agent/.test(normalizedTag)) return 'todo:next-agent';
  if (/navigator/.test(normalizedTag)) return 'todo:navigator';
  if (/spell/.test(rawTag)) return 'todo:spells';
  if (/docs|documentation/.test(rawTag)) return 'todo:docs';
  if (/test/.test(rawTag)) return 'todo:tests';
  if (/pass|sweep|cleanup|refactor/.test(rawTag)) return 'todo:cleanup';
  if (/work|task|ticket/.test(rawTag)) return 'todo:work';
  return `todo:${normalizedTag}`;
}

function inferWorkTypeCategoryFromBody(body) {
  const todo = inferTodoCategoryFromBody(body);
  if (!todo) return '';
  return todo.startsWith('todo:') ? todo : `work:${todo}`;
}

function normalizeCategoryPath(raw) {
  const category = categoryFromPath(raw);
  if (category === UNCATEGORIZED_TASK_CATEGORY) return '';
  return `domain:${category}`;
}

function inferTaskCategories(task = {}) {
  const explicitList = normalizeCategoryList(task.categories || []);
  const explicitPrimary = normalizeCategoryInput(task.category);
  const out = [];
  const seen = new Set();
  const add = (v) => {
    const n = normalizeCategoryInput(v);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };

  if (explicitPrimary) add(explicitPrimary);
  for (const c of explicitList) add(c);

  const fromTodo = inferWorkTypeCategoryFromBody(task.body);
  if (fromTodo) add(fromTodo);

  const fromRefs = firstPathFromRefs(task.refs || []);
  const fromPath = normalizeCategoryPath(fromRefs);
  if (fromPath) add(fromPath);

  if (typeof task.body === 'string') {
    const fileMatch = /File:\s*([^\r\n]+)/i.exec(task.body);
    const bodyPath = normalizeCategoryPath(fileMatch ? fileMatch[1] : '');
    if (bodyPath) add(bodyPath);
  }

  if (!out.length) {
    add(UNCATEGORIZED_TASK_CATEGORY);
  }

  return out;
}

function inferTaskCategory(task = {}) {
  return inferTaskCategories(task)[0] || UNCATEGORIZED_TASK_CATEGORY;
}

function withCategory(task) {
  const categories = inferTaskCategories(task);
  return { ...JSON.parse(JSON.stringify(task)), category: categories[0], categories };
}

// Turn a human campaign name into a stable board id. This keeps plan-provided
// names usable in URLs, snapshot files, and task metadata without requiring a
// separate slug field in every plan.
function normalizeCampaignId(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/[^A-Za-z0-9:_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Clean campaign path/glob lists while preserving the exact token text the
// orchestrator claimed. These tokens are compared with the same overlap rules
// used by advisory locks.
function canonicalCoordinationToken(value, workspaceRoot = process.cwd()) {
  if (typeof value !== 'string') return '';
  let token = value.trim().replace(/\\/g, '/');
  if (!token) return '';
  const root = path.resolve(workspaceRoot).replace(/\\/g, '/').replace(/\/$/, '');
  if (token.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
    token = token.slice(root.length + 1);
  }
  token = path.posix.normalize(token).replace(/^\.\//, '');
  return token;
}

// WF-G119: coordination tokens are repo-relative strings, so the SAME relative
// path in two checkouts used to read as one file. A lock on
// `src/systems/entities3d/three/baseMeshCatalog.ts` in Aralia raised the WF-G91
// same-file warning against Entity-Generator's prefixed lock on a different
// file. These are the sibling checkouts an agent in this tree may legitimately
// name with a root prefix; a token starting with one of them belongs to THAT
// repo, and everything else belongs to the daemon's own workspace.
export const DEFAULT_SIBLING_REPO_ROOTS = ['entity-forge', 'Entity-Generator', 'Aralia-operator-dashboard'];

/** The repo a set of coordination tokens names, or `fallback` for this checkout. */
export function repoForTokens(tokens = [], fallback = "", siblingRoots = DEFAULT_SIBLING_REPO_ROOTS) {
  for (const token of tokens) {
    const first = String(token || '').replace(/\\/g, '/').split('/')[0];
    if (!first) continue;
    const hit = siblingRoots.find((root) => root.toLowerCase() === first.toLowerCase());
    if (hit) return hit;
  }
  return fallback;
}

function normalizePathList(raw = [], workspaceRoot = process.cwd()) {
  const input = Array.isArray(raw) ? raw : [raw];
  const out = [];
  const seen = new Set();
  for (const value of input) {
    if (typeof value !== 'string') continue;
    const trimmed = canonicalCoordinationToken(value, workspaceRoot);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

// Campaign scopes use the same path+glob token model as locks, but at the
// orchestrator-supervision level instead of the worker-edit level.
function campaignTokens(campaign) {
  return [...(campaign.paths || []), ...(campaign.globs || [])];
}

/** Does this file sit inside a claimed path or glob? */
function fileMatchesToken(file, token) {
  if (!file || !token) return false;
  const f = String(file).replace(/\\/g, '/').toLowerCase();
  const t = String(token).replace(/\\/g, '/').toLowerCase();
  if (t.includes('*')) {
    const base = t.split('*')[0].replace(/\/$/, '');
    return base ? f.startsWith(base) : true;
  }
  return f === t || f.startsWith(t.replace(/\/$/, '') + '/');
}

/** Compare a planmap reference regardless of ':' or '/' separators. */
function planKey(value) {
  return String(value).toLowerCase().replace(/^planmap[:/]/, '').replace(/[:/]+/g, '/');
}

/** WF-G170: the authoritative mapping from the evidence a task carries to a
 *  campaign id. It is a PURE function: give it a task and a candidate list and
 *  it always gives the same verdict. `inferTaskMembership` is the only caller,
 *  so the mapping the documentation states and the mapping the board applies
 *  cannot drift apart.
 *
 *  THE RANKS, strongest first. The first rank that matches decides; a later
 *  rank never runs.
 *
 *    1 roadmap  the task and the campaign name the same Plan Map topic or
 *               feature (`planmap:<topic>/<feature>`). A reference is a
 *               deliberate link, so it is the strongest evidence.
 *    2 wave     the task and the campaign carry the same wave name.
 *    3 files    the task touched a file the campaign claims.
 *    4 category ONLY when the campaign's own name or code is that exact
 *               category token. See the rule below.
 *
 *  THE CATEGORY RULE. A category is a DOMAIN LABEL, not a campaign assignment.
 *  `combat`, `spells`, `races` and `worldforge` say what a task is about; they
 *  do not say which effort owns it. Many campaigns share one domain, so a
 *  category on its own would attach a task to an effort that never asked for
 *  it. Category evidence therefore counts only when a campaign is NAMED for
 *  that category, which is an explicit choice a person made. In every other
 *  case category evidence is INSUFFICIENT and the task is standalone.
 *
 *  THE VERDICTS:
 *    recorded    the task already names its campaign. Nothing is guessed.
 *    inferred    exactly one campaign matched a rank. `campaignId` is filled.
 *    ambiguous   two or more matched. `campaignId` stays EMPTY and every
 *                candidate is listed. Never break a tie automatically.
 *    standalone  no rank matched. The task belongs to no campaign, and the
 *                verdict says which evidence was absent. There is no
 *                `unknown` verdict: silence about a task is not a verdict.
 */
export function inferCampaignForTask({ task = {}, campaigns = [] } = {}) {
  if (task.campaignId) {
    return { membership: 'recorded', campaignId: task.campaignId, evidence: '', candidates: [] };
  }

  let matches = [];
  let evidence = '';

  // RANK 1 — a planmap reference the task and the campaign share.
  //
  // WF-G207: this rank used to compare the task ref against the campaign
  // NAME, and a campaign name is chosen by a person: the live board held
  // board-drain-20260920-gaps, -w1 and -deepdives, none of which is a Plan
  // Map key, so rank 1 could almost never fire and more tasks ended
  // ambiguous than the evidence warranted. A campaign now STATES its
  // reference in `planmapRef`, and that field is compared first. The name
  // is still compared after it, so a campaign named for a topic keeps
  // working without a migration.
  const refs = (task.refs || []).filter((r) => /^planmap[:/]/i.test(r)).map(planKey);
  if (refs.length) {
    const sharesKey = (key) => Boolean(key)
      && refs.some((r) => r === key || r.startsWith(key + '/') || key.startsWith(r + '/'));
    matches = campaigns.filter((c) => sharesKey(planKey(c.planmapRef || '')));
    if (matches.length) evidence = 'shares a roadmap reference: ' + refs.join(', ');
    if (!matches.length) {
      matches = campaigns.filter((c) => sharesKey(planKey(c.name || c.id)));
      if (matches.length) evidence = 'shares a roadmap reference: ' + refs.join(', ') + ' (matched on the effort name, not a stated planmapRef)';
    }
  }

  // RANK 2 — a shared wave name.
  if (!matches.length && task.wave) {
    matches = campaigns.filter((c) => c.wave && c.wave === task.wave);
    if (matches.length) evidence = 'shares the wave name ' + task.wave;
  }

  // RANK 3 — a shared file. Weaker, so it runs after the two named links.
  if (!matches.length && (task.retraceFiles || []).length) {
    matches = campaigns.filter((c) => {
      const claimed = [...(c.paths || []), ...(c.globs || [])];
      return (task.retraceFiles || []).some((f) => claimed.some((tok) => fileMatchesToken(f, tok)));
    });
    if (matches.length) evidence = 'touches a file that effort claims';
  }

  // RANK 4 — a campaign NAMED for the task's category. The category rule above
  // says why an ordinary domain label stops here.
  const category = String(task.category || '').trim().toLowerCase();
  if (!matches.length && category && category !== UNCATEGORIZED_TASK_CATEGORY) {
    matches = campaigns.filter((c) => {
      const name = String(c.name || '').trim().toLowerCase();
      const code = String(c.id || '').trim().toLowerCase();
      return name === category || code === category;
    });
    if (matches.length) evidence = 'an effort is named for the category ' + category;
  }

  if (matches.length === 1) {
    return { membership: 'inferred', campaignId: matches[0].id, evidence, candidates: [] };
  }
  if (matches.length > 1) {
    return {
      membership: 'ambiguous',
      campaignId: '',
      evidence: evidence + ' — but ' + matches.length + ' efforts match, so none was chosen',
      candidates: matches.map((c) => ({ id: c.id, name: c.name || c.id, why: evidence })),
    };
  }
  return {
    membership: 'standalone',
    campaignId: '',
    evidence: category && category !== UNCATEGORIZED_TASK_CATEGORY
      ? `no roadmap reference, wave or claimed file links this task to an effort; the category "${category}" is a domain label and no effort is named for it`
      : 'no roadmap reference, wave, claimed file or category link this task to an effort',
    candidates: [],
  };
}

// Find the first requested token that collides with a claimed campaign domain.
// Returning the token makes conflict messages actionable before a wave is seeded.
function campaignOverlap(requestTokens, campaign, workspaceRoot) {
  for (const r of requestTokens) {
    for (const h of campaignTokens(campaign)) {
      if (tokensOverlap(r, h, workspaceRoot)) return r;
    }
  }
  return null;
}

/**
 * Translate a glob pattern (`*`, `**`, `?`) into a RegExp anchored full-string.
 * Semantics (POSIX-ish, '/' as separator):
 *   `**`  -> matches anything, including '/'        (e.g. src/**\/*.ts)
 *   `*`   -> matches anything except '/'
 *   `?`   -> matches a single char except '/'
 * All other regex metacharacters are escaped.
 */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**` — matches across path separators
        re += '.*';
        i++;
        // swallow a following slash so `src/**/x` matches `src/x`
        if (glob[i + 1] === '/') i++;
      } else {
        // single `*` — anything but '/'
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      // escape regex metacharacters
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp('^' + re + '$');
}

function isGlob(s) {
  return /[*?]/.test(s);
}

/**
 * Does one lock-token (path or glob) overlap another?
 * Rules per spec:
 *   - exact path match
 *   - a glob matches a path
 *   - two globs are equal
 */
function tokensOverlap(a, b, workspaceRoot = process.cwd()) {
  a = canonicalCoordinationToken(a, workspaceRoot);
  b = canonicalCoordinationToken(b, workspaceRoot);
  if (process.platform === 'win32') {
    a = a.toLowerCase();
    b = b.toLowerCase();
  }
  const aGlob = isGlob(a);
  const bGlob = isGlob(b);
  if (!aGlob && !bGlob) return a === b; // exact path match
  if (aGlob && bGlob) return a === b; // two globs equal
  // one glob, one path
  const glob = aGlob ? a : b;
  const p = aGlob ? b : a;
  return globToRegExp(glob).test(p);
}

/** Flatten a lock's claimed tokens (paths + globs) into one array. */
function lockTokens(lock) {
  return [...(lock.paths || []), ...(lock.globs || [])];
}

/** Does a set of requested tokens overlap a held lock? Returns the first offending path/token or null. */
// Shared with the read-only packet preflight so it predicts the same lock
// conflicts the daemon will enforce when a worker actually calls `lock`.
export function lockOverlap(requestTokens, heldLock, workspaceRoot) {
  const held = lockTokens(heldLock);
  for (const r of requestTokens) {
    for (const h of held) {
      if (tokensOverlap(r, h, workspaceRoot)) return r;
    }
  }
  return null;
}

const defaultGenId = () => crypto.randomUUID();

export function createStore({
  dir,
  now = Date.now,
  genId = defaultGenId,
  presenceTtlMs = 600000,
  presenceDropMs = 3600000,
  heartbeatOnlyLeaseMs = 7200000,
  lockTtlMs = 1800000,
  // WF-G121: a head reservation on a FREE file is released after this grace
  // when a different agent asks for the lock, so an idle reserver cannot
  // deadlock a path nobody holds.
  reservationGraceMs = 120000,
  lockExpiringWarnMs = 300000, // WF-G75: warn the holder 5 min before lapse
  snapshotEveryEvents = 200,
  petCatalog = DEFAULT_PET_CATALOG,
  workspaceRoot = process.cwd(),
  // WF-G119: sibling checkouts an agent here may name with a root prefix. A
  // test overrides the list; production takes the documented default.
  siblingRepoRoots = DEFAULT_SIBLING_REPO_ROOTS,
  // D-R: the seat roster's tracked mirror. A test passes its own path, or
  // null to switch the mirror off entirely.
  seatRosterPath = path.join(workspaceRoot, 'tools', 'agora', 'seat-roster.json'),
  // §7: charters are checked against the Plan Map. A test passes its own
  // topics; production reads the tracked file at the moment of the check, so
  // a reference that went stale since the last check is caught, not trusted.
  readPlanmap = () => JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'public', 'planmap', 'topics.json'), 'utf8')),
} = {}) {
  if (!dir) throw new Error('createStore requires a { dir }');

  // WF-G119: the name a lock or campaign carries when its paths name no
  // sibling checkout — the daemon's own workspace, by its directory name.
  const defaultRepo = path.basename(path.resolve(workspaceRoot)) || '';

  fs.mkdirSync(dir, { recursive: true });
  const journalPath = path.join(dir, 'journal.jsonl');
  const snapshotPath = path.join(dir, 'snapshot.json');

  // ---- in-memory state ----
  const state = {
    // Every id any task or campaign has ever carried, pointing at the id it
    // carries now. Never pruned: a name that once appeared in a written record
    // has to keep resolving, or that record silently becomes wrong.
    aliases: new Map(), // formerId -> canonical id
    agents: new Map(), // id -> Agent (raw stored fields)
    locks: new Map(), // id -> Lock
    reservations: new Map(), // id -> Reservation, FIFO dibs for future lock access
    reservationSeq: 0, // last assigned reservation queue number
    tasks: new Map(), // id -> Task
    campaigns: new Map(), // id -> Campaign, the active governance domains claimed by orchestrators
    // D-B/D-L/D-AB: a SEAT is a durable identity that owns a campaign. A
    // session is a day; a seat is a person. A campaign belongs to a seat, so
    // it keeps its owner when the session that opened it ends. Locks,
    // reservations, task claims and presence still belong to the session,
    // correctly — those are about work in progress, not about responsibility.
    seats: new Map(), // seatId -> Seat
    messages: [], // Message[] (ordered by seq)
    seq: 0, // last assigned event seq
    messageSeq: 0, // last assigned message seq
  };
  const {
    canonicalId, getTask, getCampaign, hasTask, hasCampaign,
    touchCampaign, mergeRetraceFiles, lockTokensForAgent,
  } = createStateHelpers(state);

  // Tests may inject a tiny catalog, while production uses the same 50-pet
  // manifest served by the dashboard. Only the public assignment fields above
  // enter agent/task records; bearer tokens and full package data never do.
  const availablePets = normalizePetCatalog(petCatalog);

  // Presence identity is now a pair: agent handle plus a selected catalog pet.
  // Validate the requested identity before generating any durable agent record.
  function requirePetIdentity(petSlug) {
    if (typeof petSlug !== 'string' || !petSlug.trim()) {
      const error = new Error('petSlug (string) is required before claiming presence');
      error.code = 'AGORA_PET_REQUIRED';
      throw error;
    }
    const pet = availablePets.find((candidate) => candidate.slug === petSlug.trim());
    if (!pet) {
      const error = new Error(`unknown petSlug "${petSlug}"; choose an identity from GET /pets`);
      error.code = 'AGORA_PET_INVALID';
      throw error;
    }
    return clonePet(pet);
  }

  // Only agents still visible in Presence reserve a pet. A dropped identity may
  // be reclaimed immediately even if its record awaits the next sweep.
  function claimedPetSlugs(excludeAgentId = '') {
    const t = now();
    return new Set(
      [...state.agents.values()]
        .filter((agent) => agent.id !== excludeAgentId && t - agent.lastSeen <= presenceDropMs)
        .map((agent) => agent.pet && agent.pet.slug)
        .filter(Boolean),
    );
  }

  // If an agent asks for a claimed pet, walk forward through the catalog and
  // assign the first free identity. This remains deterministic and race-free
  // because registration mutations are serialized inside this store.
  function assignUniquePetIdentity(petSlug) {
    const requestedPet = requirePetIdentity(petSlug);
    const claimed = claimedPetSlugs();
    if (!claimed.has(requestedPet.slug)) {
      return { pet: requestedPet, requestedSlug: requestedPet.slug, substituted: false };
    }

    const start = availablePets.findIndex((pet) => pet.slug === requestedPet.slug);
    for (let offset = 1; offset < availablePets.length; offset++) {
      const candidate = availablePets[(start + offset) % availablePets.length];
      if (!claimed.has(candidate.slug)) {
        return { pet: clonePet(candidate), requestedSlug: requestedPet.slug, substituted: true };
      }
    }

    const error = new Error('all Agora pet identities are currently claimed; retire an inactive presence before registering');
    error.code = 'AGORA_PET_CATALOG_EXHAUSTED';
    throw error;
  }

  // Legacy records may predate mandatory pet selection. Their fallback starts
  // at a stable catalog position and never duplicates a live owner's identity.
  function chooseUnclaimedPet(agentId) {
    if (!availablePets.length) return null;
    const digest = crypto.createHash('sha256').update(String(agentId)).digest();
    const start = digest.readUInt32BE(0) % availablePets.length;
    const claimed = claimedPetSlugs(agentId);
    for (let offset = 0; offset < availablePets.length; offset++) {
      const pet = availablePets[(start + offset) % availablePets.length];
      if (!claimed.has(pet.slug)) return clonePet(pet);
    }
    return null;
  }

  function choosePetForAgent(agentId) {
    const agent = state.agents.get(agentId);
    if (!agent) return null;
    if (agent.pet && agent.pet.slug) {
      const currentPet = availablePets.find((pet) => pet.slug === agent.pet.slug);
      if (currentPet) return clonePet(currentPet);
    }
    return chooseUnclaimedPet(agentId);
  }

  // Tasks outlive presence rows, so the claim stores a token-free claimant
  // snapshot together with the companion visible at assignment time.
  function taskClaimantSnapshot(agentId, pet) {
    const agent = state.agents.get(agentId);
    if (!agent) return null;
    return {
      id: agent.id,
      handle: agent.handle,
      note: agent.note || '',
      model: agent.model || '',
      sessionId: agent.sessionId || '',
      pet: clonePet(pet),
    };
  }



  const subscribers = new Set();
  let eventsSinceSnapshot = 0;
  let replaying = false;

  // ---- journal append stream (created lazily, after replay) ----
  let journalFd = null;
  function openJournal() {
    if (journalFd === null) {
      journalFd = fs.openSync(journalPath, 'a');
    }
  }

  function appendJournal(event) {
    openJournal();
    fs.writeSync(journalFd, JSON.stringify(event) + '\n');
  }


  const reducers = createReducers(state, { canonicalId, getTask, getCampaign, touchCampaign, mergeRetraceFiles, lockTokensForAgent });

  /**
   * The single mutation path. Assigns the event seq, applies the reducer to
   * in-memory state, appends to the journal, and fans out to subscribers.
   * During replay only the reducer runs (no journal append, no fan-out, seq is
   * driven by the replayed event).
   */
  // ---------------------------------------------------------------------------
  // Id minting and resolution
  // ---------------------------------------------------------------------------


  /** Mint a task id. With a campaign, the id says so: `<campaign>.<n>`, where
   *  n counts that campaign's existing tasks and skips anything already taken.
   *  Without one there is no membership to encode, so it is a standalone hash. */
  /** D-W: a campaign's id is a short code, `agora-a3f8`. Its tasks are then
   *  `agora-a3f8.1`, which is the Beads shape Remy chose.
   *
   *  The code is derived from the NAME, deliberately. Claiming
   *  "living-interiors-live-clock" twice must reach the same campaign, and a
   *  derived code does that with no lookup table to keep in step. The name
   *  itself becomes a permanent alias, so every route, document, and finished
   *  result that already quotes it keeps working, forever.
   */
  function mintCampaignId(name) {
    for (let width = 4; width <= 12; width += 2) {
      const candidate = 'agora-' + shortHash(name, width);
      const holder = state.campaigns.get(candidate);
      if (!holder || holder.name === name) return candidate;
    }
    return 'agora-' + shortHash(name + ':' + crypto.randomUUID(), 12);
  }

  function mintTaskId(campaignId) {
    if (campaignId) {
      let n = 0;
      for (const t of state.tasks.values()) if (t.campaignId === campaignId) n += 1;
      let candidate = campaignId + '.' + (n + 1);
      let bump = n + 1;
      while (hasTask(candidate) || state.aliases.has(candidate)) {
        bump += 1;
        candidate = campaignId + '.' + bump;
      }
      return candidate;
    }
    // Standalone. Seed on the clock plus a random value so two tasks minted in
    // the same millisecond cannot collide, then widen on the rare clash.
    for (let width = 4; width <= 12; width += 2) {
      const candidate = 'agora-' + shortHash(now() + ':' + crypto.randomUUID(), width);
      if (!hasTask(candidate) && !state.aliases.has(candidate)) return candidate;
    }
    return 'agora-' + crypto.randomUUID();
  }

  function emit(type, payload) {
    const reducer = reducers[type];
    if (!reducer) throw new Error('Unknown event type: ' + type);

    const event = {
      seq: ++state.seq,
      type,
      payload,
      ts: now(),
    };
    // ts on the event is authoritative; payloads that need a timestamp carry their own.
    reducer(payload);
    appendJournal(event);

    for (const fn of subscribers) {
      try {
        fn(event);
      } catch {
        // a misbehaving subscriber must not break the mutation path
      }
    }

    eventsSinceSnapshot++;
    if (eventsSinceSnapshot >= snapshotEveryEvents) snapshot();

    return event;
  }

  // ---------------------------------------------------------------------------
  // Snapshot + replay
  // ---------------------------------------------------------------------------
  function serializeState() {
    return {
      lastSeq: state.seq,
      messageSeq: state.messageSeq,
      agents: [...state.agents.values()],
      locks: [...state.locks.values()],
      reservations: [...state.reservations.values()],
      reservationSeq: state.reservationSeq,
      tasks: [...state.tasks.values()],
      campaigns: [...state.campaigns.values()],
      seats: [...state.seats.values()],
      aliases: [...state.aliases.entries()],
      messages: state.messages,
    };
  }

  // WF-G147 (2026-09-09): the snapshot is the one synchronous write on the
  // request path that grows with the board (2.9 MB today). Its cost is
  // measured and published through /health, so a stall can be attributed to
  // it (or ruled out) instead of guessed at from a failed probe.
  let lastSnapshot = null;
  function snapshot() {
    const t0 = Date.now();
    const snap = serializeState();
    const tmp = snapshotPath + '.' + process.pid + '.tmp';
    const body = JSON.stringify(snap);
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, snapshotPath); // atomic replace
    lastSnapshot = { at: t0, ms: Date.now() - t0, bytes: body.length, events: eventsSinceSnapshot };

    // Journal now only needs post-snapshot events. Close, truncate, reopen.
    if (journalFd !== null) {
      fs.closeSync(journalFd);
      journalFd = null;
    }
    fs.writeFileSync(journalPath, ''); // truncate/rotate
    eventsSinceSnapshot = 0;
  }

  function loadSnapshot() {
    if (!fs.existsSync(snapshotPath)) return 0;
    let snap;
    try {
      snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    } catch {
      return 0; // corrupt snapshot — fall back to pure journal replay
    }
    loadSnapshotInto(state, snap);
    return state.seq;
  }

  function replayJournal(snapshotSeq) {
    if (!fs.existsSync(journalPath)) return;
    const raw = fs.readFileSync(journalPath, 'utf8');
    if (!raw) return;
    replaying = true;
    applyJournalText(state, reducers, raw, snapshotSeq);
    replaying = false;
  }

  // ---- bootstrap: snapshot then journal tail ----
  const snapSeq = loadSnapshot();
  replayJournal(snapSeq);
  // Migrate older snapshots once. Legacy agents gain heartbeat lease fields;
  // agents already holding active tasks also receive the pet they would get on
  // a fresh claim, so a daemon upgrade never leaves half the board pet-less.
  let migratedStoredFields = false;
  for (const agent of state.agents.values()) {
    if (!Number.isFinite(agent.lastMeaningfulAt)) {
      agent.lastMeaningfulAt = Number.isFinite(agent.lastSeen) ? agent.lastSeen : agent.registeredAt;
      migratedStoredFields = true;
    }
    if (!Number.isFinite(agent.lastHeartbeatAt)) {
      agent.lastHeartbeatAt = null;
      migratedStoredFields = true;
    }
    if (!agent.pet || !agent.pet.slug) {
      const migrationPet = choosePetForAgent(agent.id);
      if (migrationPet) {
        agent.pet = clonePet(migrationPet);
        migratedStoredFields = true;
      }
    }
  }

  // Older daemons allowed duplicate Presence pets. Keep the earliest claimant
  // and move every later duplicate to a free identity before serving the board.
  const seenPetSlugs = new Set();
  const agentsByClaimOrder = [...state.agents.values()].sort(
    (left, right) => (left.registeredAt || 0) - (right.registeredAt || 0) || left.id.localeCompare(right.id),
  );
  for (const agent of agentsByClaimOrder) {
    const slug = agent.pet && agent.pet.slug;
    if (!slug || !seenPetSlugs.has(slug)) {
      if (slug) seenPetSlugs.add(slug);
      continue;
    }
    const replacement = chooseUnclaimedPet(agent.id);
    if (!replacement) continue;
    agent.requestedPetSlug = slug;
    agent.petSubstituted = true;
    agent.pet = clonePet(replacement);
    seenPetSlugs.add(replacement.slug);
    migratedStoredFields = true;
  }

  for (const task of state.tasks.values()) {
    if (!task.claimedBy || !['claimed', 'in_progress'].includes(task.state)) continue;
    const pet = choosePetForAgent(task.claimedBy);
    if (!pet) continue;
    const agent = state.agents.get(task.claimedBy);
    if (agent && (!agent.pet || !agent.pet.slug)) {
      agent.pet = clonePet(pet);
      migratedStoredFields = true;
    }
    if (!task.assignedPet || task.assignedPet.slug !== pet.slug) {
      task.assignedPet = clonePet(pet);
      migratedStoredFields = true;
    }
    if (!task.claimedAgent || !task.claimedAgent.id || !task.claimedAgent.pet || task.claimedAgent.pet.slug !== pet.slug) {
      task.claimedAgent = taskClaimantSnapshot(task.claimedBy, pet);
      migratedStoredFields = true;
    }
  }
  // Persist the migration immediately. Otherwise a crash before the next normal
  // snapshot could replay legacy state and grant a fresh lease on every restart.
  if (migratedStoredFields) snapshot();
  openJournal();

  // ===========================================================================
  // Presence
  // ===========================================================================
  const AGENT_ROLES = ['worker', 'orchestrator', 'master', 'human'];
  // Roles allowed to post on (and expected to read) the command channel.
  const COMMAND_CHANNEL_ROLES = ['orchestrator', 'master', 'human'];
  function registerAgent({ handle, note, model, reasoningEffort, sessionId, role, type, spawnedBy, campaign, cwd, petSlug, seat } = {}) {
    const ts = now();
    const normalizedRole = AGENT_ROLES.includes(role) ? role : 'worker';
    const threadIdentity = validateRegistrationThreadIdentity({ handle, model, sessionId, role: normalizedRole, type });
    if (!threadIdentity.ok) {
      const error = new Error(threadIdentity.error);
      error.code = 'AGORA_THREAD_ID_REQUIRED';
      throw error;
    }
    // Enforce the identity pair at the model boundary as well as HTTP/CLI.
    // Replay migration is the only fallback: no new presence event, including
    // an in-process caller, may omit its required provenance or explicit pet.
    const petAssignment = assignUniquePetIdentity(petSlug);
    const agent = {
      id: genId(),
      handle: handle || 'agent',
      token: genId(),
      registeredAt: ts, // the "checked in" moment
      lastSeen: ts, // "last touched"; refreshed by every authed call + heartbeat
      lastMeaningfulAt: ts, // refreshed by authenticated activity, never by heartbeat alone
      lastHeartbeatAt: null,
      status: 'online',
      note: note || '',
      // The assigned companion remains immutable for this Presence row.
      // If the requested identity was occupied, preserve that fact so clients
      // can explain the automatic substitution instead of silently surprising.
      pet: petAssignment.pet,
      requestedPetSlug: petAssignment.requestedSlug,
      petSubstituted: petAssignment.substituted,
      // Provenance is optional only for non-Codex workers and human identities.
      // Codex workers plus orchestrator/master roles are rejected above unless
      // their own task/thread id is supplied.
      model: typeof model === 'string' ? model : '',
      reasoningEffort: typeof reasoningEffort === 'string' ? reasoningEffort : '',
      sessionId: threadIdentity.sessionId,
      // Coordination role: workers do the tasks; orchestrator/master/human may
      // also use the command channel. Self-declared (local-trust model).
      role: normalizedRole,
      // Identity and provenance (fleet-coordination Wave 1), on top of fable's role.
      // `type` is the runtime kind. `spawnedBy`, `campaign`, and `cwd` say where the
      // agent came from. The spawner usually sets these; a root agent self-declares.
      type: typeof type === 'string' ? type : '',
      spawnedBy: typeof spawnedBy === 'string' ? spawnedBy : '',
      campaign: typeof campaign === 'string' ? campaign : '',
      cwd: typeof cwd === 'string' ? cwd : '',
      // Whether the handle follows the structured grammar. A flag, not a block.
      handleValid: validateHandle(handle || '').ok,
      // D-AB: which durable identity this session is sitting in, if any.
      seatId: '',
    };
    emit('agent.register', { agent });

    // D-AB: the seat is taken AT SIGN-IN, not when a campaign is claimed. A
    // seat that could only be held while claiming would be dropped the moment
    // its holder paused to read or review, which is most of the work.
    if (seat) {
      const seatId = resolveSeatId(seat); // WF-G140: a renamed seat answers to every name it carried
      const took = holdSeat({ seatId, agentId: agent.id });
      if (!took.ok) {
        // Registration already happened and must stand: refusing it here would
        // strand an agent with a token it cannot use. The refusal is reported
        // instead, so the caller sees exactly why the seat is not theirs.
        return { ...agent, seatError: took.error };
      }
      // The link must reach the STORED agent, not only the returned copy.
      // Setting it on the local object left claimCampaign and retireAgent
      // reading an empty seat, so the campaign lost its durable owner at the
      // moment it was claimed. It is its own event, so replay reproduces it.
      emit('agent.seat', { agentId: agent.id, seatId, at: now() });
      return { ...agent, seatId };
    }
    return { ...agent };
  }

  // Registration is open, so pet discovery must also be open. Availability
  // lets agents choose deliberately while the server remains authoritative.
  function listPetIdentities() {
    const claims = new Map(
      listAgents()
        .filter((agent) => agent.pet && agent.pet.slug)
        .map((agent) => [agent.pet.slug, {
          id: agent.id,
          handle: agent.handle,
          status: agent.status,
        }]),
    );
    return availablePets.map((pet) => ({
      ...clonePet(pet),
      available: !claims.has(pet.slug),
      claimedBy: claims.get(pet.slug) || null,
    }));
  }

  // Clean voluntary exit — the counterpart to reap (see `sweepExpired`). It releases
  // the agent's locks and reservations. It reopens the agent's in-flight tasks with a
  // `retired` marker, not the crash marker `reaped`, plus an optional final note. It
  // then drops the agent.
  function retireAgent(agentId, { note } = {}) {
    const agent = state.agents.get(agentId);
    if (!agent) return { ok: false, error: 'unknown agent' };
    const t = now();
    for (const lock of [...state.locks.values()]) {
      if (lock.agentId === agentId) {
        emit('lock.release', { lockId: lock.id, agentId, retired: true });
      }
    }
    for (const reservation of [...state.reservations.values()]) {
      if (reservation.agentId === agentId) {
        emit('reservation.release', { reservationId: reservation.id, agentId, retired: true });
      }
    }
    for (const task of [...state.tasks.values()]) {
      if (task.claimedBy === agentId && (task.state === 'claimed' || task.state === 'in_progress')) {
        const entry = { at: t, by: agentId, action: 'retired', state: 'open' };
        if (typeof note === 'string' && note) entry.note = note;
        emit('task.release', { taskId: task.id, ts: t, entry });
      }
    }
    // D-AB: a dropped session frees its seat by OBSERVATION — `seatIsHeld`
    // asks whether the holder is live, so no timer and no sweep is needed. A
    // clean exit still says so out loud, because the roster should record a
    // deliberate hand-back differently from a session that simply stopped.
    if (agent.seatId && state.seats.has(agent.seatId)) {
      const seat = state.seats.get(agent.seatId);
      if (seat.holder === agentId) {
        emit('seat.release', { seatId: agent.seatId, agentId, at: t, why: 'retired' });
        writeSeatRoster();
      }
    }
    emit('agent.drop', { agentId, retired: true });
    return { ok: true, agentId };
  }

  function touch(agentId) {
    if (!state.agents.has(agentId)) return;
    const t = now();
    emit('agent.touch', { agentId, lastSeen: t, lastMeaningfulAt: t, kind: 'activity' });
  }

  function expireHeartbeatLease(agent, t, lastMeaningfulAt, expiresAt) {
    const agentId = agent.id;
    for (const lock of [...state.locks.values()]) {
      if (lock.agentId === agentId) {
        emit('lock.release', { lockId: lock.id, agentId, heartbeatLeaseExpired: true });
      }
    }
    for (const reservation of [...state.reservations.values()]) {
      if (reservation.agentId === agentId) {
        emit('reservation.release', { reservationId: reservation.id, agentId, heartbeatLeaseExpired: true });
      }
    }
    for (const task of [...state.tasks.values()]) {
      if (task.claimedBy === agentId && (task.state === 'claimed' || task.state === 'in_progress')) {
        const entry = {
          at: t,
          by: agentId,
          action: 'heartbeat_lease_expired',
          state: 'open',
          note: `Heartbeat-only lease expired after ${heartbeatOnlyLeaseMs}ms without authenticated activity.`,
        };
        emit('task.release', { taskId: task.id, ts: t, entry });
      }
    }
    emit('agent.drop', { agentId, heartbeatLeaseExpired: true, lastMeaningfulAt, expiresAt });
    return {
      ok: false,
      error: 'heartbeat-only lease expired; re-register after confirming the agent is still active',
      code: 'heartbeat_lease_expired',
      expiresAt,
    };
  }

  // A heartbeat may bridge quiet work, but it cannot manufacture indefinite
  // liveness. Once the agent has produced no meaningful authenticated activity
  // for the configured lease, invalidate it and release its coordination claims.
  function heartbeatAgent(agentId) {
    const agent = state.agents.get(agentId);
    if (!agent) return { ok: false, error: 'unknown agent' };
    const t = now();
    const lastMeaningfulAt = Number.isFinite(agent.lastMeaningfulAt)
      ? agent.lastMeaningfulAt
      : (Number.isFinite(agent.lastSeen) ? agent.lastSeen : agent.registeredAt);
    const expiresAt = lastMeaningfulAt + heartbeatOnlyLeaseMs;
    if (t >= expiresAt) {
      return expireHeartbeatLease(agent, t, lastMeaningfulAt, expiresAt);
    }
    emit('agent.touch', { agentId, lastSeen: t, lastHeartbeatAt: t, kind: 'heartbeat' });
    return { ok: true, expiresAt, remainingMs: expiresAt - t };
  }

  function computeStatus(agent, t) {
    return t - agent.lastSeen <= presenceTtlMs ? 'online' : 'stale';
  }

  function listAgents() {
    const t = now();
    const out = [];
    for (const agent of state.agents.values()) {
      const age = t - agent.lastSeen;
      if (age > presenceDropMs) continue; // dropped from the active list
      // WF-G24: never expose the bearer token on the public roster — an agent
      // only ever learns its own token from its register response.
      const { token, ...pub } = agent;
      const threadIdRequirement = registrationThreadRequirement(agent);
      const status = computeStatus(agent, t);
      const ownsLock = activeLocks(t).some((lock) => lock.agentId === agent.id);
      const ownsReservation = [...state.reservations.values()].some((reservation) => reservation.agentId === agent.id);
      const ownsTask = [...state.tasks.values()].some(
        (task) => task.claimedBy === agent.id && ['claimed', 'in_progress'].includes(task.state),
      );
      out.push({
        ...pub,
        status,
        capacityRecoverable: status === 'stale' && !ownsLock && !ownsReservation && !ownsTask,
        threadIdRequired: Boolean(threadIdRequirement),
        threadIdRequirement,
      });
    }
    return out;
  }

  // Find a live (online-or-stale, i.e. not yet dropped) agent holding this handle.
  // Used to enforce handle-claim uniqueness at register: a name may be reclaimed
  // once its previous holder is reaped, but not while it's still active.
  function findLiveAgentByHandle(handle) {
    if (!handle) return null;
    const t = now();
    for (const agent of state.agents.values()) {
      if (agent.handle !== handle) continue;
      if (t - agent.lastSeen > presenceDropMs) continue; // dropped -> reclaimable
      return { ...agent, status: computeStatus(agent, t) };
    }
    return null;
  }

  function retireStaleIdleAgent({ requesterId, targetAgentId } = {}) {
    const requester = state.agents.get(requesterId);
    if (!requester || !COMMAND_CHANNEL_ROLES.includes(requester.role)) {
      return { ok: false, error: 'only orchestrator, master, or human may retire stale presence' };
    }
    const target = state.agents.get(targetAgentId);
    if (!target) return { ok: false, error: 'agent not found' };
    if (computeStatus(target, now()) !== 'stale') {
      return { ok: false, error: 'target is online — stale retirement refused' };
    }
    if (activeLocks().some((lock) => lock.agentId === targetAgentId)) {
      return { ok: false, error: 'target holds locks — stale retirement refused' };
    }
    if ([...state.reservations.values()].some((reservation) => reservation.agentId === targetAgentId)) {
      return { ok: false, error: 'target holds reservations — stale retirement refused' };
    }
    if ([...state.tasks.values()].some(
      (task) => task.claimedBy === targetAgentId && ['claimed', 'in_progress'].includes(task.state),
    )) {
      return { ok: false, error: 'target owns in-flight tasks — stale retirement refused' };
    }
    return retireAgent(targetAgentId, { note: `stale idle presence retired for capacity by ${requester.handle}` });
  }

  function getAgentByToken(token) {
    if (!token) return null;
    for (const agent of state.agents.values()) {
      if (agent.token === token) {
        const t = now();
        return { ...agent, status: computeStatus(agent, t) };
      }
    }
    return null;
  }

  function taskCreatorSnapshot(agentId) {
    const agent = state.agents.get(agentId);
    if (!agent) throw new Error('registered creator agent is required');

    // Tasks outlive live presence rows, so each task carries a token-free copy of
    // the creator identity. This keeps handoffs and dashboard inspection readable
    // after the creator agent has gone stale or been reaped.
    return {
      id: agent.id,
      handle: agent.handle,
      note: agent.note || '',
      model: agent.model || '',
      sessionId: agent.sessionId || '',
    };
  }

  // ===========================================================================
  // Locks (advisory)
  // ===========================================================================
  function activeLocks(t = now()) {
    const out = [];
    for (const lock of state.locks.values()) {
      if (lock.expiresAt && lock.expiresAt <= t) continue;
      out.push(lock);
    }
    return out;
  }

  function acquireLock({ agentId, paths = [], globs = [], reason, ttlMs } = {}) {
    const t = now();
    const normalizedPaths = normalizePathList(paths, workspaceRoot);
    const normalizedGlobs = normalizePathList(globs, workspaceRoot);
    const requestTokens = [...normalizedPaths, ...normalizedGlobs];
    if (requestTokens.length === 0) {
      return { ok: false, conflict: null, error: 'no paths or globs specified' };
    }

    for (const held of activeLocks(t)) {
      if (held.agentId === agentId) continue; // same agent may re-lock its own paths
      const offending = lockOverlap(requestTokens, held, workspaceRoot);
      if (offending) {
        return {
          ok: false,
          conflict: { path: offending, heldBy: held.agentId, lock: { ...held } },
        };
      }
    }

    const reservationConflict = reservationConflictFor(agentId, requestTokens);
    if (reservationConflict) {
      return {
        ok: false,
        conflict: { type: 'reservation', ...reservationConflict },
      };
    }

    // WF-G91: lock paths are free strings, so one wave held `src/mesh/sdf.ts`
    // beside `entity-forge/src/mesh/sdf.ts` — the same file, never a conflict.
    // The daemon cannot prove two spellings are one file, so it does not
    // refuse; it reports every held path that is a path-boundary suffix of a
    // requested one (or the reverse) as a warning the client prints.
    // WF-G119: which checkout THIS request is about. A first path segment that
    // names a known sibling root (entity-forge/, Entity-Generator/, ...) wins;
    // otherwise the lock belongs to the daemon's own workspace.
    const requestRepo = repoForTokens(requestTokens, defaultRepo, siblingRepoRoots);

    const warnings = [];
    const suffixOf = (shorter, longer) => longer.toLowerCase().endsWith('/' + shorter.toLowerCase());
    for (const held of activeLocks(t)) {
      if (held.agentId === agentId) continue;
      // WF-G119: two spellings of one file in ONE repo still warn; the same
      // relative path in two DIFFERENT repos is not a conflict and must not.
      const heldRepo = held.repo || repoForTokens([...(held.paths || []), ...(held.globs || [])], defaultRepo, siblingRepoRoots);
      if (heldRepo !== requestRepo) continue;
      for (const mine of normalizedPaths) {
        for (const theirs of held.paths || []) {
          if (mine === theirs) continue;
          if (suffixOf(mine, theirs) || suffixOf(theirs, mine)) {
            warnings.push(`"${mine}" may be the same file as "${theirs}" held by ${held.agentId} under another root prefix`);
          }
        }
      }
    }

    const ttl = typeof ttlMs === 'number' ? ttlMs : lockTtlMs;
    const lock = {
      id: genId(),
      paths: normalizedPaths,
      globs: normalizedGlobs,
      agentId,
      // WF-G119: the checkout this lock is about, so a cross-repo wave stops
      // producing false same-file warnings (and a real one stays visible).
      repo: requestRepo,
      reason: reason || '',
      createdAt: t,
      expiresAt: t + ttl,
      // WF-G110: remember the span the holder asked for, so a renew that names
      // no ttl extends by THIS span and not by the 30-minute default.
      ttlMs: ttl,
      // WF-G75: one-shot T-minus warning flag; reset by renewLock.
      expiringWarned: false,
    };
    emit('lock.acquire', { lock });
    fulfillHeadReservations(agentId, requestTokens);
    return { ok: true, lock: { ...lock }, warnings };
  }

  function releaseLock({ lockId, agentId, force } = {}) {
    const lock = state.locks.get(lockId);
    if (!lock) return { ok: false, error: 'lock not found' };
    if (lock.agentId !== agentId) {
      if (!force) return { ok: false, error: 'only the holder may release' };
      // Force release: allowed only when the holder is stale or gone — a live
      // agent's lock is never yanked out from under it.
      const holder = state.agents.get(lock.agentId);
      if (holder && now() - holder.lastSeen <= presenceTtlMs) {
        return { ok: false, error: 'holder is online — force release refused' };
      }
    }
    emit('lock.release', { lockId, agentId, forced: lock.agentId !== agentId || undefined });
    return { ok: true };
  }

  function renewLock({ lockId, agentId, ttlMs } = {}) {
    const lock = state.locks.get(lockId);
    if (!lock) return { ok: false, error: 'lock not found' };
    if (lock.agentId !== agentId) return { ok: false, error: 'only the holder may renew' };
    // WF-G110 (2026-09-09): the heartbeat helper renews every lock it holds with
    // no ttl. That used to reset a 180-minute lock to the 30-minute default on
    // the first beat, so two workers lost their locks mid-edit an hour in. A
    // renew without a ttl now keeps the holder's original span (legacy locks
    // without `ttlMs` fall back to the default as before).
    const ttl = typeof ttlMs === 'number' && ttlMs > 0
      ? ttlMs
      : (typeof lock.ttlMs === 'number' && lock.ttlMs > 0 ? lock.ttlMs : lockTtlMs);
    lock.expiringWarned = false; // WF-G75: fresh TTL, re-arm the T-minus warning
    const expiresAt = now() + ttl;
    lock.expiresAt = expiresAt;
    emit('lock.renew', { lockId, agentId, expiresAt });
    return { ok: true, lock: { ...state.locks.get(lockId) } };
  }

  // WF-G116: a heartbeat-renewed lock told a waiter nothing about whether the
  // holder was still working. Every listed lock now carries the holder's last
  // meaningful check-in, how long it has been idle, and its presence status, so
  // a queued agent can tell live work from a hold that is merely renewing.
  function listLocks() {
    const t = now();
    return activeLocks(t).map((l) => {
      const holder = state.agents.get(l.agentId);
      const lastSeen = holder && Number.isFinite(holder.lastSeen) ? holder.lastSeen : null;
      return {
        ...l,
        holderHandle: holder ? holder.handle : '',
        holderLastSeen: lastSeen,
        holderIdleMs: lastSeen === null ? null : Math.max(0, t - lastSeen),
        holderStatus: holder ? computeStatus(holder, t) : 'gone',
      };
    });
  }

  // ===========================================================================
  // Reservations (file-access waiting room)
  // ===========================================================================
  // Reservations are not edit permission. They are a visible FIFO queue for agents
  // that want a file after the current holder. The queue becomes enforceable when
  // a lock is requested: anyone behind #1 gets a reservation conflict instead of
  // silently jumping the line.
  // ===========================================================================
  function reservationTokens(reservation) {
    return [...(reservation.paths || []), ...(reservation.globs || [])];
  }

  function reservationOverlap(requestTokens, reservation) {
    for (const r of requestTokens) {
      for (const h of reservationTokens(reservation)) {
        if (tokensOverlap(r, h, workspaceRoot)) return r;
      }
    }
    return null;
  }

  function activeReservationsFor(requestTokens) {
    return [...state.reservations.values()]
      .filter((reservation) => reservationOverlap(requestTokens, reservation))
      .sort((a, b) => (a.queueSeq || 0) - (b.queueSeq || 0) || a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));
  }

  function withReservationPosition(reservation) {
    const queue = activeReservationsFor(reservationTokens(reservation));
    const position = queue.findIndex((item) => item.id === reservation.id) + 1;
    return { ...reservation, position: position || 1 };
  }

  function reservationConflictFor(agentId, requestTokens) {
    const t = now();
    for (;;) {
      const queue = activeReservationsFor(requestTokens);
      if (!queue.length) return null;
      const head = queue[0];
      if (head.agentId === agentId) return null;
      // WF-G121 (2026-09-09): two workers each burned a 10-minute poll on a file
      // NOBODY held, because an earlier reserver never came back to lock it.
      // FIFO dibs only make sense while the file is held. When no active lock
      // covers the request and the head reservation is older than the grace
      // window, that reservation is released (journaled, with why) and the
      // next in line is evaluated. A reservation on a HELD file keeps its place.
      const covered = activeLocks(t).some((held) => lockOverlap(requestTokens, held, workspaceRoot));
      if (covered) {
        // The file is held again: any earlier free window no longer counts.
        if (head.freeSince) emit('reservation.freeSince', { reservationId: head.id, at: null });
      } else if (!head.freeSince) {
        // First request that finds the file free while this reservation heads
        // the queue: start the grace clock (journaled, so replay agrees).
        emit('reservation.freeSince', { reservationId: head.id, at: t });
      } else if (t - head.freeSince > reservationGraceMs) {
        emit('reservation.release', { reservationId: head.id, agentId: head.agentId, idleGraceMs: t - head.freeSince, requestedBy: agentId });
        continue;
      }
      return { path: reservationOverlap(requestTokens, head), reservation: withReservationPosition(head) };
    }
  }

  /** WF-G122: drop some tokens from a lock without releasing the rest.
   *  `unlock <path>` used to resolve the path to its lock id and DELETE the
   *  whole record, so a worker asked to release one shared file lost the locks
   *  on its other files. When nothing remains the lock is released outright. */
  function shrinkLock({ lockId, agentId, paths = [], globs = [] } = {}) {
    const lock = state.locks.get(lockId);
    if (!lock) return { ok: false, error: 'lock not found' };
    if (lock.agentId !== agentId) return { ok: false, error: 'only the holder may shrink' };
    const dropPaths = new Set(normalizePathList(paths, workspaceRoot));
    const dropGlobs = new Set(normalizePathList(globs, workspaceRoot));
    const keepPaths = (lock.paths || []).filter((p) => !dropPaths.has(p));
    const keepGlobs = (lock.globs || []).filter((g) => !dropGlobs.has(g));
    const removed = (lock.paths || []).length + (lock.globs || []).length - keepPaths.length - keepGlobs.length;
    if (!removed) return { ok: false, error: 'none of those tokens are on this lock' };
    if (!keepPaths.length && !keepGlobs.length) {
      emit('lock.release', { lockId, agentId });
      return { ok: true, released: true, lock: null };
    }
    emit('lock.shrink', { lockId, agentId, paths: keepPaths, globs: keepGlobs, removed });
    return { ok: true, released: false, lock: { ...state.locks.get(lockId) } };
  }

  function fulfillHeadReservations(agentId, requestTokens) {
    for (const reservation of activeReservationsFor(requestTokens)) {
      if (reservation.agentId !== agentId) continue;
      const head = activeReservationsFor(reservationTokens(reservation))[0];
      if (!head || head.id !== reservation.id) continue;
      emit('reservation.fulfill', { reservationId: reservation.id, agentId, lockTokens: requestTokens });
    }
  }

  function reserveFiles({ agentId, paths = [], globs = [], reason } = {}) {
    const normalizedPaths = normalizePathList(paths, workspaceRoot);
    const normalizedGlobs = normalizePathList(globs, workspaceRoot);
    const requestTokens = [...normalizedPaths, ...normalizedGlobs];
    if (requestTokens.length === 0) {
      return { ok: false, error: 'no paths or globs specified' };
    }

    const reservation = {
      id: genId(),
      paths: normalizedPaths,
      globs: normalizedGlobs,
      agentId,
      reason: reason || '',
      createdAt: now(),
      queueSeq: state.reservationSeq + 1,
    };
    emit('reservation.create', { reservation });
    return { ok: true, reservation: withReservationPosition(reservation) };
  }

  function releaseReservation({ agentId, target, force } = {}) {
    if (!target) return { ok: false, error: 'reservation id or path required' };
    const targetTokens = [target];
    const reservation = state.reservations.get(target)
      || [...state.reservations.values()].find(
        (item) => item.agentId === agentId && reservationOverlap(targetTokens, item),
      );
    if (!reservation) return { ok: false, error: 'reservation not found' };
    if (reservation.agentId !== agentId) {
      if (!force) return { ok: false, error: 'only the reserver may release' };
      const holder = state.agents.get(reservation.agentId);
      if (holder && now() - holder.lastSeen <= presenceTtlMs) {
        return { ok: false, error: 'reserver is online — force release refused' };
      }
    }
    emit('reservation.release', { reservationId: reservation.id, agentId, forced: reservation.agentId !== agentId || undefined });
    return { ok: true };
  }

  function listReservations() {
    return [...state.reservations.values()]
      .sort((a, b) => (a.queueSeq || 0) - (b.queueSeq || 0) || a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)))
      .map(withReservationPosition);
  }

  // ===========================================================================
  // Campaign Governance
  // ===========================================================================
  // Orchestrator campaigns reserve broad supervisory domains before a wave is
  // seeded. This deliberately mirrors advisory locks: the board warns or refuses
  // unsafe orchestration overlap, while individual workers still lock concrete
  // files before editing.
  // ===========================================================================
  function isLiveAgent(agentId, t = now()) {
    return agentPresenceStatus(agentId, t) !== 'gone';
  }

  function agentPresenceStatus(agentId, t = now()) {
    const agent = state.agents.get(agentId);
    if (!agent || t - agent.lastSeen > presenceDropMs) return 'gone';
    return computeStatus(agent, t);
  }

  function activeCampaigns(t = now()) {
    return [...state.campaigns.values()].filter(
      (campaign) => campaign.state === 'active' && isLiveAgent(campaign.agentId, t),
    );
  }

  function activeLeadCampaign(id) {
    const campaign = getCampaign(id);
    if (!campaign || campaign.role !== 'lead' || campaign.state !== 'active') return null;
    return isLiveAgent(campaign.agentId) ? campaign : null;
  }

  function claimCampaign({
    agentId,
    campaignId,
    role = 'lead',
    leadCampaignId,
    scope,
    paths = [],
    globs = [],
    wave,
    // WF-G207: the Plan Map topic or feature this effort serves,
    // "planmap:<topic>[/<feature>]". Optional, and validated against
    // public/planmap/topics.json the way a charter reference is.
    planmapRef,
  } = {}) {
    const name = normalizeCampaignId(campaignId || '');
    if (!name) return { ok: false, error: 'campaign id is required' };
    // WF-G207: a reference that names nothing is worse than no reference,
    // because rank 1 would then match on a topic that does not exist.
    const wantedPlanmapRef = typeof planmapRef === 'string' ? planmapRef.trim() : '';
    if (wantedPlanmapRef) {
      const health = planMapHealth(wantedPlanmapRef, planmapTopics());
      if (!health.ok) {
        return { ok: false, error: `planmapRef refused: ${health.problems.join("; ")}` };
      }
    }
    // The caller may pass the name or the code; both must reach the same
    // campaign. A name never seen before mints a new code.
    const id = state.campaigns.has(canonicalId(name)) ? canonicalId(name) : mintCampaignId(name);
    const isNewCampaign = !state.campaigns.has(id);
    const normalizedRole = CAMPAIGN_ROLES.has(role) ? role : 'lead';
    const claimPaths = normalizePathList(paths);
    const claimGlobs = normalizePathList(globs);
    const requestTokens = [...claimPaths, ...claimGlobs];
    if (!requestTokens.length) return { ok: false, error: 'campaign must declare at least one path or glob' };

    const t = now();
    const existing = getCampaign(id);
    if (existing && existing.agentId !== agentId && existing.state === 'active' && isLiveAgent(existing.agentId, t)) {
      return {
        ok: false,
        error: `campaign "${id}" is already active`,
        conflict: { campaign: JSON.parse(JSON.stringify(existing)) },
      };
    }

    // A deputy names its lead by name or by code; both must find it.
    const normalizedLeadId = canonicalId(normalizeCampaignId(leadCampaignId || ''));
    if (normalizedRole === 'deputy' && !activeLeadCampaign(normalizedLeadId)) {
      return { ok: false, error: 'deputy campaign must name an active lead campaign' };
    }

    // A successor may adopt an active campaign whose owner has fallen beyond
    // the drop horizon. Keep the original creation time and history so the
    // dashboard shows continuity instead of making the old owner disappear.
    const adoptsDeadOwner = Boolean(
      existing
      && existing.state === 'active'
      && existing.agentId !== agentId
      && !isLiveAgent(existing.agentId, t),
    );

    for (const campaign of activeCampaigns(t)) {
      if (campaign.id === id) continue;
      if (campaign.role !== 'lead') continue;
      const overlap = campaignOverlap(requestTokens, campaign, workspaceRoot);
      if (!overlap) continue;
      const allowedDeputyJoin = normalizedRole === 'deputy' && campaign.id === normalizedLeadId;
      if (!allowedDeputyJoin) {
        return {
          ok: false,
          error: `campaign "${id}" overlaps active lead campaign "${campaign.id}" on "${overlap}"`,
          conflict: { path: overlap, campaign: JSON.parse(JSON.stringify(campaign)) },
        };
      }
    }

    const warnings = [];
    if (normalizedRole === 'deputy') {
      const lead = activeLeadCampaign(normalizedLeadId);
      const overlapsLead = lead ? requestTokens.some((token) => campaignOverlap([token], lead, workspaceRoot)) : false;
      if (!overlapsLead) warnings.push(`deputy campaign "${id}" does not overlap lead "${normalizedLeadId}"`);
      for (const campaign of activeCampaigns(t)) {
        if (campaign.id === id || campaign.role !== 'deputy') continue;
        if (campaign.leadCampaignId !== normalizedLeadId) continue;
        const overlap = campaignOverlap(requestTokens, campaign, workspaceRoot);
        if (overlap) warnings.push(`deputy campaign "${id}" overlaps deputy "${campaign.id}" on "${overlap}"`);
      }
    }

    const campaign = {
      id,
      // The name a person chose. The code is the id; this is what it is called.
      name: (existing && existing.name) || name,
      role: normalizedRole,
      leadCampaignId: normalizedRole === 'deputy' ? normalizedLeadId : '',
      // The SESSION that claimed it. Kept, because the history should say who
      // was actually at the keyboard.
      agentId,
      // D-B: the DURABLE owner. Taken from the seat this session is sitting
      // in, so the campaign keeps its owner after the session ends. A session
      // with no seat leaves this empty, and the campaign then reads as
      // unattended forever — which is the honest reading, not a defect.
      seatId: (state.agents.get(agentId) || {}).seatId || (existing && existing.seatId) || '',
      scope: typeof scope === 'string' ? scope.trim() : '',
      // WF-G119: campaigns carry the same repo field as locks, so an
      // orchestrator domain in a sibling checkout is not confused with one here.
      repo: repoForTokens(requestTokens, defaultRepo, siblingRepoRoots),
      paths: claimPaths,
      globs: claimGlobs,
      wave: typeof wave === 'string' ? wave.trim() : '',
      // WF-G207: kept on the record, so rank 1 of the membership mapping has
      // something to compare against that a person did not have to encode in
      // the campaign name. An omitted value never erases one already stored.
      planmapRef: wantedPlanmapRef || (existing && existing.planmapRef) || '',
      state: 'active',
      warnings,
      createdAt: existing ? existing.createdAt : t,
      updatedAt: t,
      history: [
        ...((existing && existing.history) || []),
        {
          at: t,
          by: agentId,
          action: adoptsDeadOwner ? 'adopted' : 'claimed',
          state: 'active',
          role: normalizedRole,
          ...(adoptsDeadOwner ? { previousOwner: existing.agentId } : {}),
        },
      ],
    };
    emit('campaign.claim', { campaign });
    return { ok: true, campaign: JSON.parse(JSON.stringify(campaign)), warnings };
  }

  function setCampaignState({ campaignId, agentId, state: newState, reason } = {}) {
    const id = canonicalId(normalizeCampaignId(campaignId || ''));
    const campaign = getCampaign(id);
    if (!campaign) return { ok: false, error: 'campaign not found' };
    if (!CAMPAIGN_STATES.has(newState)) return { ok: false, error: 'invalid campaign state: ' + newState };
    const why = typeof reason === 'string' ? reason.trim() : '';
    const t = now();
    // WF-G83: `setCampaignState` accepted the owner only, and every owner is a
    // session that ends, so an abandoned campaign had no closure path short of
    // re-claiming its whole file scope. The command channel (orchestrator,
    // master, human) may now move an UNATTENDED campaign — nobody in its seat,
    // owner session gone — and must say why. An attended campaign, or one whose
    // owner session is still live, is still the owner's alone.
    let adoptedClosure = false;
    if (campaign.agentId !== agentId) {
      const requester = state.agents.get(agentId);
      const commandChannel = Boolean(requester && COMMAND_CHANNEL_ROLES.includes(requester.role));
      const attended = Boolean(campaign.seatId && seatIsHeld(campaign.seatId, t));
      if (!commandChannel || attended || isLiveAgent(campaign.agentId, t)) {
        return { ok: false, error: 'only the campaign owner may change state' };
      }
      if (!why) return { ok: false, error: 'closing or moving an unattended campaign you do not own needs a reason' };
      adoptedClosure = true;
    }
    // WF-G86: blocked and done are the transitions an audit asks about.
    if ((newState === 'blocked' || newState === 'done') && !why && campaign.state !== newState) {
      return { ok: false, error: `campaign state ${newState} needs a reason` };
    }
    const ts = t;
    // WF-G86: `from` and `reason` make the entry reconstructible; readers of
    // legacy entries must tolerate their absence.
    const entry = { at: ts, by: agentId, action: 'state', from: campaign.state, state: newState };
    if (why) entry.reason = why;
    if (adoptedClosure) { entry.adoptedClosure = true; entry.previousOwner = campaign.agentId; }
    emit('campaign.state', { campaignId: id, agentId, state: newState, ts, entry });
    return { ok: true, campaign: JSON.parse(JSON.stringify(getCampaign(id))) };
  }

  function listCampaigns({ state: filterState } = {}) {
    const t = now();
    return [...state.campaigns.values()]
      .filter((campaign) => !filterState || campaign.state === filterState)
      .map((campaign) => {
        const ownerStatus = agentPresenceStatus(campaign.agentId, t);
        // D-AA: "has the owner gone?" was a broken question. A session always
        // ends, so on 2026-09-07 all 27 campaigns answered "gone" for the
        // trivial reason that no session outlives itself. ATTENDED asks
        // something answerable instead: is a live session in this seat now?
        //
        // A campaign with no seat has no durable owner at all, so it can never
        // be attended. That is stated rather than hidden: `seatId` is empty and
        // `attended` is false, which is the truth about every campaign claimed
        // before seats existed.
        const seat = campaign.seatId ? state.seats.get(campaign.seatId) : null;
        const attended = Boolean(seat && seatIsHeld(seat.id, t));
        return {
          ...JSON.parse(JSON.stringify(campaign)),
          // Ownership remains authoritative through the stale window. Only a
          // gone owner may be replaced; stale is a warning, not permission.
          ownerStatus,
          ownerLive: ownerStatus !== 'gone',
          seatName: seat ? seat.name : '',
          attended,
          // §9: adoptable is now OBSERVED — active and nobody on it — rather
          // than inferred from a session that was always going to end.
          adoptable: campaign.state === 'active' && !attended,
        };
      });
  }

  // ===========================================================================
  // Charters, the campaign read model, and triage (design §6, §7, §10, §72)
  // ===========================================================================

  /** Topics for a Plan Map check, or null when the file cannot be read. A null
   *  makes every reference fail its check loudly, rather than pass unchecked. */
  function planmapTopics() {
    try {
      return readPlanmap();
    } catch {
      return null;
    }
  }

  function isCommandChannel(agentId) {
    const agent = state.agents.get(agentId);
    return Boolean(agent && COMMAND_CHANNEL_ROLES.includes(agent.role));
  }

  function isAttended(campaign, t = now()) {
    return Boolean(campaign && campaign.seatId && seatIsHeld(campaign.seatId, t));
  }

  function campaignTasks(campaignId) {
    return [...state.tasks.values()].filter((task) => task.campaignId === campaignId);
  }

  /** §6: attach or replace a campaign's charter. A charter that fails its tier
   *  rules or its Plan Map check is REFUSED with every problem named. */
  function putCharter({ campaignId, agentId, body, summary } = {}) {
    const campaign = getCampaign(canonicalId(normalizeCampaignId(campaignId || '')));
    if (!campaign) return { ok: false, error: 'campaign not found' };
    if (campaign.agentId !== agentId && !isCommandChannel(agentId)) {
      return { ok: false, error: 'only the campaign owner or the command channel may write its charter' };
    }
    const why = typeof summary === 'string' ? summary.trim() : '';
    if (!why) return { ok: false, error: 'a charter revision needs a summary' };
    const validation = validateCharter(body, { topics: planmapTopics(), campaignState: campaign.state });
    if (!validation.ok) {
      return { ok: false, error: 'charter refused', errors: validation.errors, warnings: validation.warnings, validation };
    }
    emit('campaign.charter', { campaignId: campaign.id, by: agentId, at: now(), body, summary: why });
    return { ok: true, charter: JSON.parse(JSON.stringify(getCampaign(campaign.id).charter)), warnings: validation.warnings, validation };
  }

  /** §11: small and standard charters need a master or a human; a large one
   *  needs a human. The charter is re-checked at approval, because the Plan Map
   *  may have moved since it was written. */
  function approveCharter({ campaignId, agentId, note } = {}) {
    const campaign = getCampaign(canonicalId(normalizeCampaignId(campaignId || '')));
    if (!campaign) return { ok: false, error: 'campaign not found' };
    if (!campaign.charter) return { ok: false, error: 'campaign has no charter to approve' };
    const agent = state.agents.get(agentId);
    const role = agent ? agent.role : '';
    const tier = campaign.charter.body.tier;
    const allowed = approverRolesFor(tier);
    if (!allowed.includes(role)) {
      return { ok: false, error: `a ${tier} charter needs approval from: ${allowed.join(' or ')} (you are "${role || 'unregistered'}")` };
    }
    // §5: the creator drafts; the creator does not approve. A human may.
    if (role !== 'human' && campaign.charter.submittedBy === agentId) {
      return { ok: false, error: 'the agent that submitted a charter may not approve it' };
    }
    const why = typeof note === 'string' ? note.trim() : '';
    if (!why) return { ok: false, error: 'an approval needs a note saying what was read' };
    const validation = validateCharter(campaign.charter.body, { topics: planmapTopics(), campaignState: campaign.state });
    if (!validation.ok) return { ok: false, error: 'charter no longer validates', errors: validation.errors };
    emit('campaign.charter.approve', { campaignId: campaign.id, by: agentId, role, at: now(), note: why });
    return { ok: true, charter: JSON.parse(JSON.stringify(getCampaign(campaign.id).charter)) };
  }

  /** §13/§25: one read that joins the campaign, its charter and live validity,
   *  its tasks with computed times, and progress. Stores nothing. */
  function campaignView(campaignId) {
    const id = canonicalId(normalizeCampaignId(campaignId || ''));
    const listed = listCampaigns().find((c) => c.id === id);
    if (!listed) return { ok: false, error: 'campaign not found' };
    const tasks = campaignTasks(id).map((task) => ({ ...JSON.parse(JSON.stringify(task)), ...taskTimes(task) }));
    const validation = listed.charter
      ? validateCharter(listed.charter.body, { topics: planmapTopics(), campaignState: listed.state })
      : null;
    return {
      ok: true,
      campaign: listed,
      legacy: !listed.charter,
      validation,
      progress: campaignProgress(tasks, listed.charter && listed.charter.body),
      tasks,
    };
  }

  /** §10 step 2. A pure read: it never emits, so no record can change. */
  function triageReport(campaignId) {
    const id = canonicalId(normalizeCampaignId(campaignId || ''));
    const campaign = getCampaign(id);
    if (!campaign) return { ok: false, error: 'campaign not found' };
    const t = now();
    return buildTriageReport({
      campaign: JSON.parse(JSON.stringify(campaign)),
      tasks: campaignTasks(id).map((task) => JSON.parse(JSON.stringify(task))),
      topics: planmapTopics(),
      isAgentLive: (agent) => isLiveAgent(agent, t),
      attended: isAttended(campaign, t),
      generatedAt: t,
    });
  }

  /** §10 step 3: an explicit start by the command channel, on an adoptable
   *  campaign only, with a reason. There is no implicit start. */
  function startTriage({ campaignId, agentId, reason } = {}) {
    const campaign = getCampaign(canonicalId(normalizeCampaignId(campaignId || '')));
    if (!campaign) return { ok: false, error: 'campaign not found' };
    if (!isCommandChannel(agentId)) return { ok: false, error: 'only the command channel may start triage' };
    const why = typeof reason === 'string' ? reason.trim() : '';
    if (!why) return { ok: false, error: 'starting triage needs a reason' };
    const t = now();
    if (campaign.state !== 'active' || isAttended(campaign, t)) {
      return { ok: false, error: 'only an adoptable campaign (active, nobody in its seat) may be triaged' };
    }
    if (campaign.agentId !== agentId && isLiveAgent(campaign.agentId, t)) {
      return { ok: false, error: 'the owning session is still live; it is not abandoned' };
    }
    if (campaign.triage && campaign.triage.state === 'in-review') {
      return { ok: false, error: 'triage is already in review for this campaign' };
    }
    emit('campaign.triage.start', { campaignId: campaign.id, by: agentId, at: t, reason: why });
    return { ok: true, report: triageReport(campaign.id) };
  }

  /** §10 steps 6-8: one explicit disposition for ONE task. Bulk approval does
   *  not exist, by construction: there is no call that takes two tasks. */
  function applyDisposition({ campaignId, taskId, agentId, disposition, reason, toAgentId, blocker, supersededBy, approvalQuote, evidence } = {}) {
    const campaign = getCampaign(canonicalId(normalizeCampaignId(campaignId || '')));
    if (!campaign) return { ok: false, error: 'campaign not found' };
    if (!campaign.triage || campaign.triage.state !== 'in-review') return { ok: false, error: 'triage has not been started for this campaign' };
    if (!isCommandChannel(agentId)) return { ok: false, error: 'only the command channel may apply a disposition' };
    const spec = DISPOSITIONS[disposition];
    if (!spec) return { ok: false, error: `unknown disposition: ${disposition}; one of ${Object.keys(DISPOSITIONS).join(', ')}` };
    const t = getTask(taskId);
    if (!t || t.campaignId !== campaign.id) return { ok: false, error: 'task not found in this campaign' };
    if (campaign.triage.dispositions[t.id]) return { ok: false, error: `task ${t.id} already has a disposition: ${campaign.triage.dispositions[t.id].disposition}` };
    const why = typeof reason === 'string' ? reason.trim() : '';
    if (!why) return { ok: false, error: 'a disposition needs a reason' };
    const agent = state.agents.get(agentId);
    const quote = typeof approvalQuote === 'string' ? approvalQuote.trim() : '';
    // §10 step 7 and §11: work that is destroyed or hidden needs the human.
    // The daemon cannot see a person; it can refuse every caller that is not
    // registered as one, and keep the words of the approval on the record.
    if (spec.human && (agent.role !== 'human' || !quote)) {
      return { ok: false, error: `${disposition} needs recorded human approval: a caller registered as human, and the approval quote` };
    }
    const at = now();
    const patch = {};
    const record = { disposition, risk: spec.risk, by: agentId, role: agent.role, at, reason: why, from: t.state };
    if (disposition === 'reopen') {
      if (!['claimed', 'in_progress', 'blocked'].includes(t.state)) return { ok: false, error: `nothing to reopen: task is ${t.state}` };
      Object.assign(patch, { state: 'open', claimedBy: null, claimedAgent: null, assignedPet: null });
    } else if (disposition === 'reassign') {
      if (t.state === 'done') return { ok: false, error: 'a done task cannot be reassigned' };
      if (!toAgentId || !state.agents.has(toAgentId) || !isLiveAgent(toAgentId, at)) return { ok: false, error: 'reassign needs a live toAgentId' };
      const pet = choosePetForAgent(toAgentId);
      if (!pet) return { ok: false, error: 'pet catalog unavailable; a reassignment needs an assigned pet' };
      Object.assign(patch, { state: 'claimed', claimedBy: toAgentId, claimedAgent: taskClaimantSnapshot(toAgentId, pet), assignedPet: pet });
      record.toAgentId = toAgentId;
    } else if (disposition === 'block') {
      if (t.state === 'done') return { ok: false, error: 'a done task cannot be blocked' };
      const named = typeof blocker === 'string' ? blocker.trim() : '';
      if (!named) return { ok: false, error: 'block needs a named blocker' };
      Object.assign(patch, { state: 'blocked' });
      record.blocker = named;
    } else if (disposition === 'escalate') {
      Object.assign(patch, { escalated: true });
    } else if (disposition === 'supersede') {
      const survivor = getTask(supersededBy);
      if (!survivor || survivor.id === t.id) return { ok: false, error: 'supersede needs a different, existing surviving task' };
      Object.assign(patch, { state: 'done', closedReason: `superseded by ${survivor.id}`, supersededBy: survivor.id });
      record.supersededBy = survivor.id;
    } else if (disposition === 'close-obsolete') {
      Object.assign(patch, { state: 'done', closedReason: `obsolete: ${why}` });
    }
    if (spec.human) record.approval = { by: agentId, quote };
    if (typeof evidence === 'string' && evidence.trim()) record.evidence = evidence.trim();
    record.to = patch.state || t.state;
    const entry = { at, by: agentId, action: 'disposition', disposition, from: t.state, state: record.to, reason: why };
    if (record.evidence) entry.evidence = record.evidence;
    emit('campaign.disposition', { campaignId: campaign.id, taskId: t.id, by: agentId, at, patch, record, entry });
    return { ok: true, record, task: JSON.parse(JSON.stringify(getTask(t.id))) };
  }

  /** §10: triage ends only when every task has exactly one disposition. The
   *  successor then owns the campaign, recorded as an adoption with its reason. */
  function finishTriage({ campaignId, agentId, reason } = {}) {
    const campaign = getCampaign(canonicalId(normalizeCampaignId(campaignId || '')));
    if (!campaign) return { ok: false, error: 'campaign not found' };
    if (!campaign.triage || campaign.triage.state !== 'in-review') return { ok: false, error: 'triage has not been started for this campaign' };
    if (!isCommandChannel(agentId)) return { ok: false, error: 'only the command channel may finish triage' };
    const why = typeof reason === 'string' ? reason.trim() : '';
    if (!why) return { ok: false, error: 'finishing triage needs a reason' };
    const missing = campaignTasks(campaign.id).filter((task) => !campaign.triage.dispositions[task.id]).map((task) => task.id);
    if (missing.length) return { ok: false, error: `every task needs a disposition first; missing: ${missing.join(', ')}`, missing };
    const seatId = (state.agents.get(agentId) || {}).seatId || '';
    emit('campaign.triage.finish', { campaignId: campaign.id, by: agentId, at: now(), reason: why, seatId });
    return { ok: true, campaign: JSON.parse(JSON.stringify(getCampaign(campaign.id))) };
  }

  // ===========================================================================
  // Task board
  // ===========================================================================
  /** WF-G85: the campaign a new task inherits when the caller names none —
   *  the ONE active campaign the creator owns, or nothing. WF-G171: the HTTP
   *  intake asks the same question before it refuses a campaignless task, so
   *  the default and the gate can never disagree. */
  function defaultCampaignFor(agentId) {
    if (!agentId) return '';
    const owned = [...state.campaigns.values()].filter((c) => c.state === 'active' && c.agentId === agentId);
    return owned.length === 1 ? owned[0].id : '';
  }

  function normalizeDeliverable(raw) {
    if (typeof raw !== 'string') throw new Error('deliverable must be a string path');
    const value = raw.trim();
    if (!value) throw new Error('deliverable must be a non-empty path');
    if (/[\r\n]/.test(value)) throw new Error('deliverable must be one line');
    return value;
  }

  function createTask({ agentId, title, body, deps, priority, refs, deliverable, category, campaignId, wave, standalone = false, standaloneReason } = {}) {
    const ts = now();
    const creatorAgent = taskCreatorSnapshot(agentId);
    const depEdges = normalizeTaskDeps(deps);
    for (const d of depEdges) {
      if (!hasTask(d.id)) throw new Error('unknown dep: ' + d.id);
    }
    // A caller may name a campaign by its code or by the name a person chose.
    // Resolve to the code, so a task stores and filters on one value.
    // `campaignId: "none"` is the explicit opt-out for a standalone task.
    const askedStandalone = standalone === true
      || (typeof campaignId === 'string' && /^(none|standalone)$/i.test(campaignId.trim()));
    // WF-G171: an opt-out is a DECISION, so it carries the reason for it. A
    // task that says only "no campaign" tells a later reviewer nothing.
    const why = typeof standaloneReason === 'string' ? standaloneReason.trim() : '';
    if (standalone === true && !why) {
      throw new Error('a standalone task needs a reason: say why it belongs to no campaign');
    }
    let normalizedCampaignId = askedStandalone ? '' : canonicalId(normalizeCampaignId(campaignId || ''));
    if (normalizedCampaignId && !hasCampaign(normalizedCampaignId)) {
      throw new Error('unknown campaign: ' + normalizedCampaignId);
    }
    // WF-G85 (2): 0 of 119 tasks carried a campaignId because the correct value
    // was the extra-work value. When the creator is the live owner of exactly
    // one ACTIVE campaign, that campaign is the default. Two or more, or none,
    // and the task stays standalone as before — no guessing.
    let defaulted = false;
    if (!normalizedCampaignId && !askedStandalone) {
      const fallbackCampaign = defaultCampaignFor(agentId);
      if (fallbackCampaign) {
        normalizedCampaignId = fallbackCampaign;
        defaulted = true;
      }
    }
    // WF-G171: the intake decision, kept with the task forever.
    //   campaign    a campaign was named.
    //   defaulted   the creator's one active campaign supplied it (WF-G85).
    //   standalone  the creator said this work belongs to no campaign, and why.
    //   absent      nobody decided. The HTTP intake refuses this; the store
    //               still records it, so a legacy caller is VISIBLE instead of
    //               looking the same as a deliberate standalone task.
    let decisionKind = 'absent';
    if (askedStandalone) decisionKind = 'standalone';
    else if (defaulted) decisionKind = 'defaulted';
    else if (normalizedCampaignId) decisionKind = 'campaign';
    const campaignDecision = {
      kind: decisionKind,
      campaignId: normalizedCampaignId,
      reason: why,
      by: agentId || '',
      at: ts,
    };
    const task = {
      // D-S: the campaign is IN the name, so it cannot be left out. genId
      // stays injectable for tests that need a fixed id.
      id: genId === defaultGenId ? mintTaskId(normalizedCampaignId) : genId(),
      title: title || '',
      body: body || '',
      category: normalizeCategoryInput(category),
      campaignId: normalizedCampaignId,
      // WF-G171: WHO decided the membership, and why. It never changes shape
      // after creation; a later move writes its own history entry instead.
      campaignDecision,
      membership: decisionKind === 'standalone' ? 'standalone' : (normalizedCampaignId ? 'recorded' : ''),
      wave: typeof wave === 'string' ? wave.trim() : '',
      state: 'open',
      createdBy: agentId,
      creatorAgent,
      claimedBy: null,
      claimedAgent: null,
      assignedPet: null,
      // Durable candidate file scope for crash recovery. This union survives
      // normal lock expiry and is copied into `retrace.files` if a claimant dies.
      retraceFiles: [],
      // Orchestration metadata: deps gate readiness, priority orders the ready
      // queue, refs link out to tracker artifacts (gap IDs, doc paths).
      deps: depEdges,
      priority: typeof priority === 'number' && Number.isFinite(priority) ? priority : 0,
      refs: Array.isArray(refs) ? refs.filter((r) => typeof r === 'string') : [],
      // WF-G179: refs name inputs; this names the artifact a claimant must
      // produce. A legacy task with no deliverable keeps the empty value.
      deliverable: deliverable === undefined ? '' : normalizeDeliverable(deliverable),
      // WF-G304: a design-then-build handoff is authored separately from the
      // original task body and from a one-step checkpoint.
      design: '',
      result: null,
      // A missing disposition remains the backward-compatible shape for old
      // board records. Once a result is classified, finding and evidence stay
      // separate from the free-form result summary.
      resultDisposition: null,
      finding: null,
      evidence: null,
      createdAt: ts,
      updatedAt: ts,
      history: [{
        at: ts,
        by: agentId,
        action: 'created',
        state: 'open',
        // WF-G171: the campaign decision is part of the creation record, so it
        // survives every later edit and cannot be reconstructed wrongly.
        campaignDecision: decisionKind,
        campaignId: normalizedCampaignId,
        ...(why ? { reason: why } : {}),
      }],
    };
    emit('task.create', { task });
    return JSON.parse(JSON.stringify(task));
  }

  /** Work out which campaign an old task belonged to, and SAY it is a guess.
   *
   *  MEASURED FIRST, BUILT SECOND. A read-only probe ran the full D-O evidence
   *  ladder against the live board on 2026-09-07 and placed 0 of 189 orphan
   *  tasks. The cause was WF-G103: every campaign's active period was a single
   *  instant, so the time half of the third rank could never be satisfied.
   *
   *  Remy then chose (r9q1) to place what CAN be placed, record what cannot,
   *  and never write a guess as a fact. So:
   *
   *    recorded   the task already names its campaign. Nothing is guessed.
   *    inferred   exactly one campaign matched. campaignId is filled, and
   *               inferredFrom says what the evidence was.
   *    ambiguous  several matched. campaignId stays EMPTY and every candidate
   *               is listed. D-O: never break a tie automatically.
   *    standalone WF-G170: nothing matched, so the task belongs to no effort.
   *               The verdict names the evidence that was absent. The old
   *               `unknown` verdict is gone: it told a reader that the board
   *               had not looked, when the board HAD looked and found nothing.
   *
   *  The ranks themselves are `inferCampaignForTask`, a pure function at the
   *  top of this file. PROTOCOL.md documents the same ladder (WF-G170).
   *
   *  File overlap now counts on its own, which D-O forbade. That prohibition
   *  existed to stop a guess being recorded as a fact; the pick-none rule and
   *  the candidate list do that job directly, so its purpose is kept while its
   *  wording is not. Recorded in the design doc.
   */
  function inferTaskMembership({ agentId, note, dryRun = false } = {}) {
    const requester = state.agents.get(agentId);
    if (!requester || !COMMAND_CHANNEL_ROLES.includes(requester.role)) {
      return { ok: false, error: 'membership inference needs one of: ' + COMMAND_CHANNEL_ROLES.join(', ') };
    }

    // WF-G106: a campaign the SWEEP closed cannot be any task's home.
    //
    // The sweep closes a campaign for holding ZERO tasks, so offering one as a
    // candidate proposes a home that was proved empty. Excluding them refuses
    // no true answer, which is why this filter is `closedReason` rather than
    // `state !== 'active'` — a campaign that held real work and then finished
    // is still a legitimate answer, and must stay in the pool.
    //
    // MEASURED 2026-09-08, right after the first sweep closed 9 empty
    // campaigns. Offering them as candidates: 0 placed, 40 tied. Excluding
    // them: 28 placed, 12 tied. The same 40 tasks, the same evidence — the
    // ties were against homes that had already been proved empty.
    const campaigns = [...state.campaigns.values()].filter((c) => !c.closedReason);
    const changes = [];
    // WF-G170: `standalone` replaces the old `unknown`. `unknown` stays in the
    // tally at zero so a reader of an old report sees the key did not vanish.
    const tally = { recorded: 0, inferred: 0, ambiguous: 0, standalone: 0, unknown: 0 };

    for (const t of state.tasks.values()) {
      if (t.campaignId) {
        changes.push({ taskId: t.id, membership: 'recorded', inferredFrom: '' });
        tally.recorded += 1;
        continue;
      }

      // WF-G170: the ranks live in ONE pure function, so the mapping the
      // PROTOCOL states and the mapping the board applies are the same code.
      const verdict = inferCampaignForTask({ task: withCategory(t), campaigns });
      const change = { taskId: t.id, membership: verdict.membership, inferredFrom: verdict.evidence };
      if (verdict.campaignId) change.campaignId = verdict.campaignId;
      if (verdict.candidates.length) change.candidates = verdict.candidates;
      changes.push(change);
      tally[verdict.membership] += 1;
    }

    if (!changes.length) return { ok: true, changed: 0, tally, changes: [] };
    if (dryRun) return { ok: true, changed: changes.length, tally, changes, dryRun: true };

    const at = now();
    emit('task.membership', {
      at,
      by: agentId,
      note: note || 'D-K/D-O/r9q1: place what can be placed, list every tie, never write a guess as a fact',
      changes,
    });
    return { ok: true, changed: changes.length, tally, changes };
  }

  /** D-S: give every task a hierarchical id, in ONE journal event.
   *
   *  A task in a campaign becomes `<campaign>.<n>`, so its membership is part
   *  of its name and cannot be omitted the way it was omitted 119 times.
   *
   *  THE OLD ID KEEPS WORKING FOREVER. Fifteen finished board results and four
   *  WORKFLOW_GAPS rows quote a UUID prefix. Rewriting those quotes would be
   *  editing the past, which D-E forbids, so the migration adds a name rather
   *  than replacing one. `formerIds` records what each object used to be
   *  called, and the alias table keeps resolving it.
   *
   *  Campaigns are NOT renamed here: their ids are already short, meaningful,
   *  human-chosen names. Only tasks, whose ids are opaque UUIDs, gain from a
   *  new shape.
   *
   *  Idempotent: a task that already carries a hierarchical id is left alone.
   */
  function migrateIds({ agentId, note, dryRun = false } = {}) {
    const requester = state.agents.get(agentId);
    if (!requester || !COMMAND_CHANNEL_ROLES.includes(requester.role)) {
      return { ok: false, error: 'id migration needs one of: ' + COMMAND_CHANNEL_ROLES.join(', ') };
    }

    // Campaigns first. A campaign whose id is already a code is left alone;
    // the rest take one, keep their current name, and keep resolving by it.
    const campaigns = [];
    const campaignTaken = new Set([...state.campaigns.keys(), ...state.aliases.keys()]);
    for (const c of [...state.campaigns.values()].sort((x, y) => x.createdAt - y.createdAt)) {
      if (/^agora-[0-9a-f]+$/.test(c.id)) continue;
      let width = 4;
      let to = 'agora-' + shortHash(c.id, width);
      while (campaignTaken.has(to) && width <= 12) {
        width += 2;
        to = 'agora-' + shortHash(c.id, width);
      }
      campaignTaken.add(to);
      campaigns.push({ from: c.id, to, name: c.id });
    }

    // Count per campaign as we go, so numbering is dense and stable rather
    // than dependent on how many tasks happened to exist when each was minted.
    const counters = new Map();
    const taken = new Set([...state.tasks.keys(), ...state.aliases.keys()]);
    const tasks = [];

    // Oldest first, so task .1 is the campaign's first task rather than
    // whichever one the map happened to yield first.
    const campaignRenames = new Map(campaigns.map((c) => [c.from, c.to]));
    const ordered = [...state.tasks.values()].sort((x, y) => x.createdAt - y.createdAt);
    for (const t of ordered) {
      // Already hierarchical, or already a minted standalone id: leave it.
      if (t.campaignId && !campaignRenames.has(t.campaignId)
        && t.id.startsWith(t.campaignId + '.')) continue;
      if (!t.campaignId && t.id.startsWith('agora-')) continue;

      let to;
      if (t.campaignId) {
        // Use the code the campaign is ABOUT to get, so the task is named
        // agora-a3f8.1 rather than after a slug that is being retired.
        const owner = campaignRenames.get(t.campaignId) || t.campaignId;
        const n = (counters.get(owner) || 0) + 1;
        counters.set(owner, n);
        to = owner + '.' + n;
        let bump = n;
        while (taken.has(to)) {
          bump += 1;
          counters.set(owner, bump);
          to = owner + '.' + bump;
        }
      } else {
        let width = 4;
        to = 'agora-' + shortHash(t.id, width);
        while (taken.has(to) && width <= 12) {
          width += 2;
          to = 'agora-' + shortHash(t.id, width);
        }
      }
      taken.add(to);
      tasks.push({ from: t.id, to });
    }

    if (!tasks.length && !campaigns.length) {
      return { ok: true, migrated: 0, tasks: [], campaigns: [] };
    }
    const migrated = tasks.length + campaigns.length;
    if (dryRun) return { ok: true, migrated, tasks, campaigns, dryRun: true };

    const at = now();
    emit('ids.migrate', {
      at,
      by: agentId,
      note: note || 'D-S: hierarchical task ids; every old id kept forever as an alias',
      campaigns,
      tasks,
    });
    return { ok: true, migrated, tasks, campaigns };
  }

  /** Give every untyped dependency its type, in ONE journal event.
   *
   *  Each pre-migration dep gated readiness, so each becomes `blocks` — a
   *  restatement of what the board already did, not a new claim about intent.
   *  The event names every change it made, so the record says what happened
   *  rather than quietly showing a different past.
   *
   *  Idempotent: a second run finds nothing untyped and emits no event.
   */
  // ===========================================================================
  // Seats — durable identity for campaign ownership (D-B, D-L, D-AA, D-AB)
  // ===========================================================================
  //
  //  WHY THIS EXISTS. A campaign's owner was a SESSION. A session ends every
  //  day, so on 2026-09-07 all 27 live campaigns reported "owner gone" — not
  //  because anyone abandoned them, but because no session outlives itself.
  //  "Has the owner gone?" was therefore not a hard question, it was a broken
  //  one, and every answer to it was invented (D-AA).
  //
  //  A seat replaces it with a question that has a real answer: is any live
  //  session holding this seat right now? That is observed, not inferred.
  //
  //  WHAT A SEAT IS NOT. It is not a role and it is not a job title (D-L
  //  rejected both). Encoding the job in the name recreates the role model, so
  //  `assertSeatName` refuses a name that reads as one. It also refuses a model
  //  or vendor name, because a seat must survive a model change unchanged.

  /** D-R/D-X: mirror the roster into the tracked tree, on every change.
   *
   *  A seat is supposed to outlive everything, but all coordination state
   *  lives in `.agent/`, which is git-ignored on purpose and which
   *  `git clean -fdx` can erase. So the roster gets a second home that version
   *  control can see. Remy chose the automatic write over a manual export.
   *
   *  FOUR CONSTRAINTS, and each answers a real cost:
   *    1. ONE path only. A program writing into the working tree is what has
   *       caused trouble here before, so it may touch exactly this file.
   *    2. A PROJECTION, never truth. Nothing reads it back. The daemon is the
   *       record; this is a copy, the same relation gapIndex JSON has to
   *       GAPS.md. A second EDITABLE home is how status rot starts.
   *    3. ATOMIC. Write a temp file and rename, so a crash cannot leave half a
   *       roster that looks whole.
   *    4. NO COMMIT. Writing the working tree was decided; committing was not.
   *
   *  It also holds SEATS ONLY, never a campaign list. A roster that grew a
   *  campaign list would become the local campaign tracker that the
   *  dashboard-only rule forbids.
   */
  function writeSeatRoster() {
    if (!seatRosterPath) return { ok: false, skipped: 'no roster path' };
    try {
      const rows = [...state.seats.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({
          id: s.id,
          name: s.name,
          note: s.note || '',
          createdAt: s.createdAt,
          formerNames: s.formerNames || [],
          renames: (s.renames || []).map((r) => ({ at: r.at, from: r.from, to: r.to, why: r.why || '' })),
          diaryEntries: (s.diary || []).length,
        }));
      const doc = {
        _readme: 'A COPY. The Agora daemon holds the truth; this file is written by it and never read back. '
          + 'Do not edit by hand — an edit here changes nothing and will be overwritten. '
          + 'It exists because .agent/ is git-ignored, so a seat would otherwise not survive a clean (D-R).',
        writtenAt: new Date(now()).toISOString(),
        seats: rows,
      };
      fs.mkdirSync(path.dirname(seatRosterPath), { recursive: true });
      const tmp = seatRosterPath + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
      fs.renameSync(tmp, seatRosterPath); // atomic replace
      return { ok: true, path: seatRosterPath, seats: rows.length };
    } catch (e) {
      // The mirror is a convenience, not the record. A failure here must never
      // take down a coordination call that already succeeded.
      return { ok: false, error: String((e && e.message) || e) };
    }
  }


  /** Create a seat. Deliberate, and never a side effect of a typo.
   *
   *  A seat carries a diary and a history, so conjuring one by misspelling a
   *  name at sign-in would leave junk identities that look like people. The
   *  cost is one extra step the first time; the error message names it.
   */
  function createSeat({ agentId, name, note } = {}) {
    const requester = state.agents.get(agentId);
    if (!requester || !COMMAND_CHANNEL_ROLES.includes(requester.role)) {
      return { ok: false, error: 'creating a seat needs one of: ' + COMMAND_CHANNEL_ROLES.join(', ') };
    }
    const checked = assertSeatName(name);
    if (!checked.ok) return checked;
    const id = seatIdFor(checked.name);
    if (state.seats.has(id)) {
      return { ok: false, error: `seat "${checked.name}" already exists`, seat: readSeat(id) };
    }
    // WF-G140: a former name still resolves to its seat, so a new seat may not
    // reuse it; two seats answering to one name would make the lookup ambiguous.
    const taken = resolveSeatId(checked.name);
    if (taken !== id && state.seats.has(taken)) {
      return { ok: false, error: `"${checked.name}" is already a name of seat ${taken} (current or former); pick another name`, seat: readSeat(taken) };
    }
    const at = now();
    const seat = {
      id,
      name: checked.name,
      note: note || '',
      createdAt: at,
      updatedAt: at,
      createdBy: agentId,
      holder: null,
      heldSince: null,
      formerNames: [],
      renames: [],
      // D-L: the seat's own memory, so a successor inherits what was learned
      // rather than an empty job.
      diary: [],
      history: [{ at, action: 'created', by: agentId }],
    };
    emit('seat.create', { seat });
    writeSeatRoster();
    return { ok: true, seat: readSeat(id) };
  }

  function readSeat(id) {
    const seat = state.seats.get(id);
    return seat ? JSON.parse(JSON.stringify(seat)) : null;
  }

  /** Is a LIVE session holding this seat right now? Observed, not inferred. */
  function seatIsHeld(seatId, t = now()) {
    const seat = state.seats.get(seatId);
    if (!seat || !seat.holder) return false;
    return isLiveAgent(seat.holder, t);
  }

  /** Take a seat as a session signs in. One holder at a time (D-AB).
   *
   *  The obvious worry is a crashed agent locking a seat nobody can take. That
   *  is answered rather than traded away: the seat is free the moment the
   *  HOLDER's presence drops, and presence is already measured every few
   *  minutes. No seat-level timer is invented, and none has to be argued over.
   */
  function holdSeat({ seatId, agentId, force = false } = {}) {
    const seat = state.seats.get(seatId);
    if (!seat) {
      return {
        ok: false,
        error: `no seat "${seatId}". Create it first: seat new <name>`,
      };
    }
    const t = now();
    if (seat.holder && seat.holder !== agentId && seatIsHeld(seatId, t) && !force) {
      const holder = state.agents.get(seat.holder);
      return {
        ok: false,
        error: `seat "${seat.name}" is held by a live session (${(holder && holder.handle) || seat.holder})`,
        holder: seat.holder,
      };
    }
    if (seat.holder === agentId) return { ok: true, seat: readSeat(seatId), already: true };
    emit('seat.hold', { seatId, agentId, at: t });
    writeSeatRoster();
    return { ok: true, seat: readSeat(seatId) };
  }

  function releaseSeat({ seatId, agentId, why } = {}) {
    const seat = state.seats.get(seatId);
    if (!seat) return { ok: false, error: `no seat "${seatId}"` };
    if (!seat.holder) return { ok: true, seat: readSeat(seatId), already: true };
    if (seat.holder !== agentId) {
      return { ok: false, error: `seat "${seat.name}" is not held by this session` };
    }
    emit('seat.release', { seatId, agentId, at: now(), why: why || '' });
    writeSeatRoster();
    return { ok: true, seat: readSeat(seatId) };
  }

  /** Rename a seat. The old name is KEPT, never overwritten (D-N). */
  /** WF-G140 (2026-09-09): a seat by its CURRENT name, any FORMER name, or its id.
   *  `seatIdFor` derives the id from the name at creation and the id never
   *  changes, so after a rename every by-name lookup computed `seat-<newname>`,
   *  which does not exist, and the seat was unreachable by the only name people
   *  still used for it. The id stays immutable; only the lookup learned names. */
  function resolveSeatId(nameOrId) {
    const raw = String(nameOrId || '').trim();
    if (!raw) return raw;
    if (raw.startsWith('seat-')) return raw;
    const wanted = raw.toLowerCase();
    for (const seat of state.seats.values()) {
      if (String(seat.name).toLowerCase() === wanted) return seat.id;
    }
    for (const seat of state.seats.values()) {
      if ((seat.formerNames || []).some((n) => String(n).toLowerCase() === wanted)) return seat.id;
    }
    return seatIdFor(raw);
  }

  function renameSeat({ seatId, agentId, name, why } = {}) {
    const requester = state.agents.get(agentId);
    if (!requester || !COMMAND_CHANNEL_ROLES.includes(requester.role)) {
      return { ok: false, error: 'renaming a seat needs one of: ' + COMMAND_CHANNEL_ROLES.join(', ') };
    }
    const seat = state.seats.get(seatId);
    if (!seat) return { ok: false, error: `no seat "${seatId}"` };
    const checked = assertSeatName(name);
    if (!checked.ok) return checked;
    if (checked.name === seat.name) return { ok: true, seat: readSeat(seatId), already: true };
    // WF-G142 (2026-09-09): the same gate createSeat has. Without it a rename
    // could give two seats one name; resolveSeatId then answered with the
    // first, and the renamed seat could never be taken by its own name.
    const taken = resolveSeatId(checked.name);
    if (taken !== seatId && state.seats.has(taken)) {
      return { ok: false, error: `"${checked.name}" is already a name of seat ${taken} (current or former); pick another name`, seat: readSeat(taken) };
    }
    emit('seat.rename', { seatId, name: checked.name, from: seat.name, by: agentId, at: now(), why: why || '' });
    writeSeatRoster();
    return { ok: true, seat: readSeat(seatId) };
  }

  /** Add a line to a seat's diary — what this seat learned, for its successor. */
  function seatDiary({ seatId, agentId, text } = {}) {
    const seat = state.seats.get(seatId);
    if (!seat) return { ok: false, error: `no seat "${seatId}"` };
    if (!String(text || '').trim()) return { ok: false, error: 'a diary entry needs text' };
    emit('seat.diary', { seatId, agentId, at: now(), text: String(text).trim() });
    writeSeatRoster();
    return { ok: true, seat: readSeat(seatId) };
  }

  function listSeats() {
    const t = now();
    return [...state.seats.values()].map((seat) => {
      const held = seatIsHeld(seat.id, t);
      const holder = seat.holder ? state.agents.get(seat.holder) : null;
      return {
        ...JSON.parse(JSON.stringify(seat)),
        // ATTENDED means a live session is on it right now. UNATTENDED means
        // nobody is, which is a fact rather than a guess about abandonment.
        attended: held,
        holderHandle: held && holder ? holder.handle : '',
        campaigns: [...state.campaigns.values()]
          .filter((c) => c.seatId === seat.id)
          .map((c) => c.id),
      };
    });
  }

  /** D-AC: close campaigns that hold no work and that nobody is on.
   *
   *  MEASURED 2026-09-07: 20 of 27 campaigns hold zero tasks, and each still
   *  reserves its files against the overlap check, so an empty campaign blocks
   *  real work from claiming the ground it sits on. Closing one destroys
   *  nothing, because there is nothing in it.
   *
   *  THE RISK, and the two limits that answer it. Someone may open a campaign
   *  deliberately to reserve ground, with work planned but not yet written
   *  down. So:
   *    1. A campaign must be BOTH empty AND older than a STATED age. A freshly
   *       reserved campaign is days old, not two months.
   *    2. The list is printed before anything closes. `dryRun` is the default
   *       for the CLI, and the caller has to drop it deliberately.
   *  A third limit falls out of seats: an ATTENDED campaign is never touched,
   *  whatever its age. Somebody is on it.
   *
   *  WHY THIS EXISTS AT ALL. `setCampaignState` allows only the owner to
   *  close a campaign, and every owner is a session that has ended — so the
   *  cleanup was literally impossible to perform. This is the control-plane
   *  path, and it refuses everything the owner path would refuse plus more.
   */
  function sweepEmptyCampaigns({ agentId, minAgeDays = 30, dryRun = true, note } = {}) {
    const requester = state.agents.get(agentId);
    if (!requester || !COMMAND_CHANNEL_ROLES.includes(requester.role)) {
      return { ok: false, error: 'closing campaigns needs one of: ' + COMMAND_CHANNEL_ROLES.join(', ') };
    }
    const t = now();
    const minAgeMs = Math.max(0, Number(minAgeDays)) * 86400000;
    const taskCount = new Map();
    for (const task of state.tasks.values()) {
      const cid = task.campaignId;
      if (cid) taskCount.set(cid, (taskCount.get(cid) || 0) + 1);
    }

    const closing = [];
    const kept = [];
    for (const c of state.campaigns.values()) {
      const tasks = taskCount.get(c.id) || 0;
      const ageMs = t - (c.createdAt || t);
      const attended = Boolean(c.seatId && seatIsHeld(c.seatId, t));
      const row = { id: c.id, name: c.name || c.id, tasks, ageDays: Math.round(ageMs / 86400000 * 10) / 10, attended };
      if (c.state !== 'active') { kept.push({ ...row, why: 'not active' }); continue; }
      if (attended) { kept.push({ ...row, why: 'somebody is on it' }); continue; }
      if (tasks > 0) { kept.push({ ...row, why: `holds ${tasks} task(s)` }); continue; }
      if (ageMs < minAgeMs) { kept.push({ ...row, why: `only ${row.ageDays} days old, under the ${minAgeDays}-day limit` }); continue; }
      closing.push(row);
    }

    if (dryRun) return { ok: true, closed: 0, wouldClose: closing.length, closing, kept, dryRun: true, minAgeDays };
    if (!closing.length) return { ok: true, closed: 0, closing: [], kept, minAgeDays };

    emit('campaign.sweep', {
      at: t,
      by: agentId,
      note: note || `D-AC: closed empty campaigns untouched for ${minAgeDays}+ days; each held zero tasks and nobody was on it`,
      minAgeDays,
      closing,
    });
    return { ok: true, closed: closing.length, closing, kept, minAgeDays };
  }

  /** WF-G104: point every dependency at the id its target carries NOW.
   *
   *  The 2026-09-07 migration ran in the order the design doc stated: infer,
   *  rename, then type. That order cannot work. `ids.migrate` follows a rename
   *  into an edge by reading `d.id`, but before the typing step a dep is a bare
   *  STRING, so `d.id` is undefined and no edge matches. The typing step then
   *  wrapped each bare string and preserved the pre-rename id.
   *
   *  Nothing broke, because every lookup resolves an old id through the alias
   *  table. But the stored record names an id that appears nowhere else on the
   *  board, which reads as a dangling reference and traps any future consumer
   *  that forgets to call `canonicalId`. Remy chose the repair (r10q1).
   *
   *  This is ONE new event. It rewrites no past event, and the old id keeps
   *  resolving afterwards, so D-E holds.
   */
  function migrateDepIds({ agentId, note, dryRun = false } = {}) {
    const requester = state.agents.get(agentId);
    if (!requester || !COMMAND_CHANNEL_ROLES.includes(requester.role)) {
      return {
        ok: false,
        error: 'dep id repair needs one of: ' + COMMAND_CHANNEL_ROLES.join(', '),
      };
    }

    const changes = [];
    for (const t2 of state.tasks.values()) {
      const deps = t2.deps || [];
      if (!deps.length) continue;
      // A bare string is a PRE-typing dep. Leave it alone: `migrate-deps` owns
      // that shape, and doing both jobs in one pass is what caused this defect.
      if (deps.some((d) => typeof d === 'string')) continue;
      const to = deps.map((d) => {
        const current = canonicalId(d.id);
        return current === d.id ? d : { ...d, id: current };
      });
      if (to.every((d, i) => d.id === deps[i].id)) continue;
      changes.push({
        taskId: t2.id,
        from: JSON.parse(JSON.stringify(deps)),
        to,
      });
    }

    if (!changes.length) return { ok: true, migrated: 0, changes: [] };
    if (dryRun) return { ok: true, migrated: changes.length, changes, dryRun: true };

    const at = now();
    emit('task.deps.canonicalize', {
      at,
      by: agentId || 'migration',
      note: note || 'WF-G104: point each dependency at the id its target carries now; the old id stays an alias',
      changes,
    });
    return { ok: true, migrated: changes.length, changes };
  }

  //  `dryRun` is NOT optional politeness. The CLI has offered `--dry` on this
  //  command since it shipped, and printed "Nothing was written" — while the
  //  store had no dry branch and wrote every time. An operator who checked
  //  before committing got the commit AND the reassurance. WF-G105.
  function migrateTaskDeps({ agentId, note, dryRun = false } = {}) {
    // Control-plane only. One call retypes every dep on the board, so the same
    // roles that may drive the command channel may run it, and nobody else.
    const requester = state.agents.get(agentId);
    if (!requester || !COMMAND_CHANNEL_ROLES.includes(requester.role)) {
      return {
        ok: false,
        error: 'dep migration needs one of: ' + COMMAND_CHANNEL_ROLES.join(', '),
      };
    }
    const changes = [];
    for (const t2 of state.tasks.values()) {
      const raw = t2.deps || [];
      if (!raw.some((d) => typeof d === 'string')) continue;
      changes.push({
        taskId: t2.id,
        from: JSON.parse(JSON.stringify(raw)),
        to: normalizeTaskDeps(raw),
      });
    }
    if (!changes.length) return { ok: true, migrated: 0, changes: [] };
    if (dryRun) return { ok: true, migrated: changes.length, changes, dryRun: true };
    const at = now();
    emit('task.deps.migrate', {
      at,
      by: agentId || 'migration',
      note: note || 'D-T: untyped deps become blocks; every pre-migration dep already gated readiness',
      changes,
    });
    return { ok: true, migrated: changes.length, changes };
  }

  /** A task is ready when it is open and every dep has qualifying completion.
   *  Pre-upgrade tasks have no deps field — they count as dep-free. */
  // A completed dependency only clears its gate after real work. Triage-only
  // completion deliberately stays blocking because that review was deferred,
  // while old records with no disposition retain their historical behavior.
  function isTaskDependencySatisfied(dependencyId) {
    const dependency = getTask(dependencyId);
    return Boolean(
      dependency
      && dependency.state === 'done'
      && dependency.resultDisposition !== 'triage_only',
    );
  }

  /** Only a BLOCKING dependency holds a task back. A "supersedes" or
   *  "discovered-from" edge is a recorded fact about the work, not a gate, so
   *  reading it as one would stall a board that has done nothing wrong. */
  function blockingDeps(t) {
    return (t.deps || []).filter((d) => isBlockingDepType(d.type || DEFAULT_TASK_DEP_TYPE));
  }

  function isTaskReady(t) {
    if (t.state !== 'open') return false;
    for (const d of blockingDeps(t)) {
      if (!isTaskDependencySatisfied(d.id)) return false;
    }
    return true;
  }

  function readyOrder(a, b) {
    const pa = a.priority || 0;
    const pb = b.priority || 0;
    if (pb !== pa) return pb - pa; // higher priority first
    return a.createdAt - b.createdAt; // then FIFO
  }

  function claimTask({ taskId, agentId, force = false } = {}) {
    const t = getTask(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    if (!state.agents.has(agentId)) return { ok: false, error: 'registered claiming agent is required' };
    if ((t.state === 'claimed' || t.state === 'in_progress') && t.claimedBy && t.claimedBy !== agentId) {
      return { ok: false, error: 'task already claimed by another agent' };
    }
    // Readiness gate (WF-G55): an open task with unresolved deps must not be
    // hand-claimed, or the diamond parallelism silently reverts to a chain.
    // The task's creator (the orchestrator who seeded it) may `force` a gated
    // claim for deliberate hand-assignment; anyone else is refused.
    if (t.state === 'open' && !isTaskReady(t)) {
      if (!force || t.createdBy !== agentId) {
        // Report the same unresolved gates that the ready queue uses. This
        // keeps a triage-only dependency visible instead of returning an
        // unhelpful unknown blocker after readiness has already rejected it.
        const blocks = blockingDeps(t)
          .filter((d) => !isTaskDependencySatisfied(d.id))
          .map((d) => d.id + ' (' + d.type + ')');
        return { ok: false, error: `task not ready: blocked by dep ${blocks.join(', ') || '(unknown)'}` };
      }
    }
    const pet = choosePetForAgent(agentId);
    if (!pet) return { ok: false, error: 'pet catalog unavailable; task claims require an assigned pet' };
    const ts = now();
    const claimedAgent = taskClaimantSnapshot(agentId, pet);
    const entry = { at: ts, by: agentId, action: 'claimed', state: 'claimed', petSlug: pet.slug };
    emit('task.claim', {
      taskId,
      agentId,
      pet,
      claimedAgent,
      retraceFiles: lockTokensForAgent(agentId),
      ts,
      entry,
    });
    return { ok: true, task: JSON.parse(JSON.stringify(getTask(taskId))) };
  }

  /** WF-G130 (2026-09-09): correct a task's authored fields IN PLACE.
   *  WF-G149 (2026-09-15): allow orchestrators/master/human to annotate any task with a reason/note without claiming.
   *  WF-G153 (2026-09-15): support appendBody and note annotations.
   *  Until now a title that failed `task lint` could only be fixed by closing
   *  the task and filing a new one, which burned ids and left husks on the
   *  board. Only the creator, the current claimant, or an orchestrator/master/human
   *  may edit; the state, the claimant, the deps and the campaign are not authored
   *  fields and stay on their own commands. The history entry carries every old value. */
  const TASK_EDITABLE = new Set(['title', 'body', 'appendBody', 'priority', 'refs', 'deliverable', 'design', 'wave']);

  /** WF-G169: move ONE task to another campaign, or make it standalone.
   *
   *  The board lost campaign membership at intake 50 times out of 51, and
   *  nothing could repair it: `editTask` refuses `campaignId` on purpose,
   *  because the campaign is not an authored field. A reviewer who found the
   *  right campaign had to leave the task stale or edit the state file by
   *  hand. This command is the supported repair.
   *
   *  THE GUARDS:
   *   - only the command channel (orchestrator, master, human) may reassign;
   *   - a reason is mandatory, and goes on the record;
   *   - the target campaign must EXIST and must not be `done`, so a task
   *     cannot be filed into a finished effort;
   *   - a move that changes nothing is refused, so the history holds no
   *     entries that say nothing.
   *
   *  THE ID DOES NOT CHANGE. A task id spells its campaign (`agora-a3f8.2`),
   *  but finished results and gap rows quote ids, and rewriting a quoted id
   *  would be editing the past. `campaignId` is what every route and filter
   *  reads, so `task show` and `campaign show` agree the moment it changes.
   */
  function setTaskCampaign({ taskId, agentId, campaignId, standalone = false, reason } = {}) {
    const t = getTask(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    if (!isCommandChannel(agentId)) {
      return { ok: false, error: 'reassigning a task needs one of: ' + COMMAND_CHANNEL_ROLES.join(', ') };
    }
    const why = typeof reason === 'string' ? reason.trim() : '';
    if (!why) return { ok: false, error: 'a campaign reassignment needs a reason' };

    const asked = typeof campaignId === 'string' ? campaignId.trim() : '';
    const wantsStandalone = standalone === true || /^(none|standalone)$/i.test(asked);
    if (!wantsStandalone && !asked) {
      return { ok: false, error: 'name a campaign, or say standalone' };
    }

    let target = '';
    if (!wantsStandalone) {
      target = canonicalId(normalizeCampaignId(asked));
      const campaign = getCampaign(target);
      if (!campaign) return { ok: false, error: 'unknown campaign: ' + asked };
      if (campaign.state === 'done') {
        return { ok: false, error: `campaign "${campaign.id}" is done; a finished effort cannot take new work` };
      }
    }

    const from = t.campaignId || '';
    if (from === target) {
      return {
        ok: false,
        error: target
          ? `task ${t.id} is already in campaign ${target}`
          : `task ${t.id} is already standalone`,
      };
    }

    const ts = now();
    const fields = {
      campaignId: target,
      membership: target ? 'recorded' : 'standalone',
      inferredFrom: target
        ? `reassigned by ${agentId}: ${why}`
        : `made standalone by ${agentId}: ${why}`,
      inferredCandidates: [],
      // `campaignDecision` always states the CURRENT decision and why, so a
      // reader never has to replay the history to learn where a task stands.
      // The history keeps every earlier decision, so nothing is lost.
      campaignDecision: {
        kind: target ? 'campaign' : 'standalone',
        campaignId: target,
        reason: why,
        by: agentId,
        at: ts,
      },
    };
    const entry = {
      at: ts,
      by: agentId,
      action: 'campaign',
      from: from || 'standalone',
      to: target || 'standalone',
      reason: why,
    };
    // The `task.edit` event already writes named fields and pushes a history
    // entry, so the move needs no new journal kind and replays on old logs.
    emit('task.edit', { taskId: t.id, agentId, fields, ts, entry });
    return {
      ok: true,
      task: JSON.parse(JSON.stringify(getTask(t.id))),
      from: from || '',
      to: target || '',
    };
  }

  function editTask({ taskId, agentId, fields = {}, reason } = {}) {
    const t = getTask(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    const agent = state.agents.get(agentId);
    const isOrchestrator = agent && (agent.role === 'orchestrator' || agent.role === 'master' || agent.role === 'human');
    if (t.createdBy !== agentId && t.claimedBy !== agentId && !isOrchestrator) {
      return { ok: false, error: 'only the creator, the claimant, or an orchestrator may edit a task' };
    }
    if (t.state === 'done') return { ok: false, error: 'a done task is a record; reopen it before you edit it' };
    const next = {};
    const from = {};
    const why = typeof reason === 'string' ? reason.trim() : '';

    // WF-G153: handle appendBody by appending to existing body
    if (fields.appendBody !== undefined) {
      if (typeof fields.appendBody !== 'string') return { ok: false, error: 'appendBody must be a string' };
      const appended = fields.appendBody.trim();
      if (appended) {
        const curBody = t.body || '';
        fields.body = curBody ? `${curBody}\n${appended}` : appended;
      }
      delete fields.appendBody;
    }

    for (const [key, raw] of Object.entries(fields)) {
      if (raw === undefined) continue;
      if (!TASK_EDITABLE.has(key)) return { ok: false, error: `field "${key}" is not editable here` };
      let value = raw;
      if (key === 'title' || key === 'body' || key === 'wave') {
        if (typeof raw !== 'string') return { ok: false, error: `${key} must be a string` };
        value = key === 'title' ? raw.trim() : raw;
        if (key === 'title' && !value) return { ok: false, error: 'title cannot be empty' };
      } else if (key === 'priority') {
        value = Number(raw);
        if (!Number.isFinite(value)) return { ok: false, error: 'priority must be a number' };
      } else if (key === 'refs') {
        if (!Array.isArray(raw)) return { ok: false, error: 'refs must be an array of strings' };
        value = raw.filter((r) => typeof r === 'string');
      } else if (key === 'deliverable') {
        if (raw === null || raw === '') value = '';
        else {
          try { value = normalizeDeliverable(raw); }
          catch (error) { return { ok: false, error: error.message }; }
        }
      } else if (key === 'design') {
        if (raw === null || raw === '') value = '';
        else if (typeof raw !== 'string' || !raw.trim()) {
          return { ok: false, error: 'design must be non-empty text, or null to clear it' };
        }
      }
      if (JSON.stringify(value) === JSON.stringify(t[key])) continue;
      next[key] = value;
      from[key] = t[key] === undefined ? null : JSON.parse(JSON.stringify(t[key]));
    }
    if (!Object.keys(next).length) {
      if (why) {
        // WF-G149: Reason-only annotation (e.g. PARKED, human decision notes) without field mutations.
        const ts = now();
        const entry = { at: ts, by: agentId, action: 'note', reason: why };
        emit('task.edit', { taskId, agentId, fields: {}, ts, entry });
        return { ok: true, task: JSON.parse(JSON.stringify(getTask(taskId))), changed: [] };
      }
      return { ok: false, error: 'nothing to edit: every named field already has that value' };
    }
    const ts = now();
    const entry = { at: ts, by: agentId, action: 'edit', fields: Object.keys(next), from };
    if (why) entry.reason = why;
    emit('task.edit', { taskId, agentId, fields: next, ts, entry });
    return { ok: true, task: JSON.parse(JSON.stringify(getTask(taskId))), changed: Object.keys(next) };
  }

  function setTaskState({ taskId, agentId, state: newState, result, resultDisposition, finding, evidence, reason } = {}) {
    const t = getTask(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    if (!TASK_STATES.has(newState)) return { ok: false, error: 'invalid state: ' + newState };
    // WF-G86: a task that stops needs to say why. Every other transition may
    // carry a reason; `blocked` may not omit it.
    const why = typeof reason === 'string' ? reason.trim() : '';
    if (newState === 'blocked' && !why && t.state !== 'blocked') {
      return { ok: false, error: 'state blocked needs a reason' };
    }
    if (resultDisposition !== undefined && !TASK_RESULT_DISPOSITIONS.has(resultDisposition)) {
      return { ok: false, error: 'invalid result disposition: ' + resultDisposition };
    }
    if (finding !== undefined && typeof finding !== 'string') {
      return { ok: false, error: 'finding must be a string' };
    }
    if (evidence !== undefined && typeof evidence !== 'string') {
      return { ok: false, error: 'evidence must be a string' };
    }

    // Existing callers finish work with only `state: done` and a result string.
    // Preserve that record without classifying it: only an explicit disposition
    // may claim that a technical review was triage-only or substantive.
    const hasNewResult = typeof result === 'string' && Boolean(result);
    const hasFinding = typeof finding === 'string' && Boolean(finding.trim());
    const hasEvidence = typeof evidence === 'string' && Boolean(evidence.trim());
    const hasReviewDetail = finding !== undefined || evidence !== undefined;
    const resolvedDisposition = resultDisposition;
    const availableResult = hasNewResult ? result : t.result;
    const availableFinding = finding !== undefined ? finding : t.finding;
    const availableEvidence = evidence !== undefined ? evidence : t.evidence;
    if (resolvedDisposition === undefined && hasReviewDetail) {
      return { ok: false, error: 'finding and evidence require explicit substantive result disposition' };
    }
    if (resolvedDisposition === 'triage_only' && !availableResult) {
      return { ok: false, error: 'triage_only requires free-form result evidence' };
    }
    if (resolvedDisposition === 'triage_only' && (hasFinding || hasEvidence)) {
      return { ok: false, error: 'triage_only cannot include substantive finding or evidence fields' };
    }
    if (resolvedDisposition === 'substantive'
        && (!String(availableFinding || '').trim() || !String(availableEvidence || '').trim())) {
      return { ok: false, error: 'substantive requires non-empty finding and evidence' };
    }

    const ts = now();
    // WF-G86: `from` names the prior state, `reason` the why. Legacy entries
    // lack both; every reader treats them as optional.
    const entry = { at: ts, by: agentId, action: 'state', from: t.state, state: newState };
    if (why) entry.reason = why;
    if (hasNewResult) entry.result = result;
    if (resolvedDisposition !== undefined) entry.resultDisposition = resolvedDisposition;
    if (resolvedDisposition === 'triage_only') {
      // Clear any stale review detail if an operator deliberately reclassifies
      // the latest result as triage. The authored result summary is preserved.
      entry.finding = null;
      entry.evidence = null;
    } else {
      if (finding !== undefined) entry.finding = finding;
      if (evidence !== undefined) entry.evidence = evidence;
    }
    const payload = { taskId, agentId, state: newState, ts, entry };
    if (hasNewResult) payload.result = result;
    if (resolvedDisposition !== undefined) payload.resultDisposition = resolvedDisposition;
    if (resolvedDisposition === 'triage_only') {
      payload.finding = null;
      payload.evidence = null;
    } else {
      if (finding !== undefined) payload.finding = finding;
      if (evidence !== undefined) payload.evidence = evidence;
    }
    emit('task.state', payload);
    return { ok: true, task: JSON.parse(JSON.stringify(getTask(taskId))) };
  }

  /** Atomically claim the highest-priority ready task (worker-pull model).
   *  Returns { ok: true, task } or { ok: true, task: null } when nothing is ready. */
  function claimNextReady({ agentId, campaignId, category } = {}) {
    // A caller may name a campaign by its code or by the name a person chose.
    // Resolve to the code, so a task stores and filters on one value.
    const normalizedCampaignId = canonicalId(normalizeCampaignId(campaignId || ''));
    // WF-G127: an unknown lane is an error, not an empty lane. listTasks and
    // createTask both refuse it; without the same guard here a worker handed a
    // typo'd or renamed campaign idles forever on "no ready tasks".
    if (normalizedCampaignId && !hasCampaign(normalizedCampaignId)) {
      return { ok: false, error: 'unknown campaign: ' + normalizedCampaignId };
    }
    const normalizedCategory = normalizeCategoryInput(category);
    const ready = [...state.tasks.values()]
      .filter(isTaskReady)
      .filter((task) => !normalizedCampaignId || task.campaignId === normalizedCampaignId)
      .filter((task) => !normalizedCategory || withCategory(task).categories.includes(normalizedCategory))
      .sort(readyOrder);
    if (ready.length === 0) return { ok: true, task: null };
    return claimTask({ taskId: ready[0].id, agentId });
  }

  function handoffTask({ taskId, agentId, toAgentId } = {}) {
    const t = getTask(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    if (!toAgentId) return { ok: false, error: 'toAgentId required' };
    // Authorization (WF-G11): only the current claimant or the task's creator
    // (the orchestrator, for seeded tasks) may reassign it.
    if (t.claimedBy && t.claimedBy !== agentId && t.createdBy !== agentId) {
      return { ok: false, error: 'only the claimant or the task creator may handoff' };
    }
    const ts = now();
    if (!state.agents.has(toAgentId) || !isLiveAgent(toAgentId, ts)) {
      return { ok: false, error: 'target agent is not registered or live' };
    }
    const pet = choosePetForAgent(toAgentId);
    if (!pet) return { ok: false, error: 'pet catalog unavailable; task handoffs require an assigned pet' };
    const claimedAgent = taskClaimantSnapshot(toAgentId, pet);
    const entry = { at: ts, by: agentId, action: 'handoff', to: toAgentId, state: t.state, petSlug: pet.slug };
    emit('task.handoff', {
      taskId,
      agentId,
      toAgentId,
      pet,
      claimedAgent,
      retraceFiles: lockTokensForAgent(toAgentId),
      ts,
      entry,
    });
    return { ok: true, task: JSON.parse(JSON.stringify(getTask(taskId))) };
  }

  function setTaskCategories({ taskId, agentId, categories, category } = {}) {
    const t = getTask(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    const merged = normalizeCategoryList([
      ...(typeof category === 'string' ? [category] : []),
      ...normalizeCategoryList(categories),
    ]);
    if (!merged.length) return { ok: false, error: 'at least one category is required' };

    const ts = now();
    const entry = { at: ts, by: agentId, action: 'categories', state: t.state };
    emit('task.categories', { taskId, agentId, categories: merged, category: merged[0], ts, entry });
    return { ok: true, task: JSON.parse(JSON.stringify(getTask(taskId))) };
  }

  // Leave a resumable checkpoint on a task (agent-retrace, Wave 2). Latest-wins: the
  // newest checkpoint replaces the last. Captured into the retrace dossier on reap.
  function checkpointTask({ taskId, agentId, did, next, files } = {}) {
    const t = getTask(taskId);
    if (!t) return { ok: false, error: 'task not found' };
    // A checkpoint describes live owned work, so open, blocked, and completed
    // tasks cannot accept one even from a former/current claimant.
    if (!['claimed', 'in_progress'].includes(t.state)) {
      return { ok: false, code: 'task_not_active', error: 'task must be claimed or in_progress to checkpoint' };
    }
    // Authentication identifies the caller, but ownership is task-specific:
    // only the exact current claimant may replace the resumable note.
    if (t.claimedBy !== agentId) {
      return { ok: false, code: 'not_task_claimant', error: 'only the current task claimant may checkpoint' };
    }
    const ts = now();
    const list = Array.isArray(files)
      ? files
      : typeof files === 'string' && files
        ? files.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    const checkpoint = {
      at: ts,
      by: agentId,
      did: typeof did === 'string' ? did : '',
      next: typeof next === 'string' ? next : '',
      files: list,
    };
    emit('task.checkpoint', { taskId, checkpoint, ts });
    return { ok: true, checkpoint };
  }

  /** WF-G88: `campaignId` filters the listing the same way it already filters
   *  `claimNextReady`. An UNKNOWN campaign id throws rather than returning the
   *  whole board — the old behavior silently ignored the parameter, so a typo
   *  produced a wrong answer that looked right. Omitting it still returns
   *  everything, which is the documented default. */
  function listTasks({ state: filterState, ready, category, campaignId } = {}) {
    // A caller may name a campaign by its code or by the name a person chose.
    // Resolve to the code, so a task stores and filters on one value.
    const normalizedCampaignId = canonicalId(normalizeCampaignId(campaignId || ''));
    if (normalizedCampaignId && !hasCampaign(normalizedCampaignId)) {
      throw new Error('unknown campaign: ' + normalizedCampaignId);
    }
    let source = [...state.tasks.values()];
    if (ready) source = source.filter(isTaskReady).sort(readyOrder);
    const normalizedCategory = category == null ? '' : normalizeCategoryInput(category);
    const out = [];
    // Computed graph view (read-only; never persisted, so `state.tasks` rows and
    // the journal stay raw and replay-consistent). Each row answers the two
    // questions a diamond workflow needs: which upstream deps am I waiting on
    // (`ready` + `depStates`), and how many downstream tasks am I gating
    // (`gates`)? This is what lets a board reader "see the graph" instead of
    // re-deriving it from raw `deps` arrays. See GRAPH-ENGINEERING.md.
    for (const t of source) {
      const row = withCategory(t);
      if (normalizedCategory && !row.categories.includes(normalizedCategory)) continue;
      if (filterState && t.state !== filterState) continue;
      if (normalizedCampaignId && t.campaignId !== normalizedCampaignId) continue;
      row.ready = isTaskReady(t);
      // The type travels with each edge, so a reader can tell a gate from a
      // recorded relationship without looking the type up elsewhere.
      row.depStates = (t.deps || []).map((d) => {
        const type = d.type || DEFAULT_TASK_DEP_TYPE;
        const dep = getTask(d.id);
        return dep
          ? { id: dep.id, type, blocking: isBlockingDepType(type), state: dep.state, title: dep.title }
          : { id: d.id, type, blocking: isBlockingDepType(type), state: 'missing', title: '' };
      });
      // `gates` answers "how many tasks am I holding back", so only a blocking
      // edge counts. Counting a supersedes edge here would report a finished
      // task as gating live work.
      let gates = 0;
      for (const other of state.tasks.values()) {
        if (blockingDeps(other).some((d) => d.id === t.id)) gates += 1;
      }
      row.gates = gates;
      out.push(row);
    }
    return out;
  }

  // ===========================================================================
  // Messaging
  // ===========================================================================
  function postMessage({ agentId, to, body, channel } = {}) {
    // The command channel is a control-plane feed: only orchestrators, the
    // master, and the human may post there. Workers get a refusal, not a
    // silent drop, so a misconfigured agent learns immediately.
    if (channel === 'command') {
      const sender = state.agents.get(agentId);
      const role = (sender && sender.role) || 'worker';
      if (!COMMAND_CHANNEL_ROLES.includes(role)) {
        return { ok: false, error: `role "${role}" may not post on the command channel (need one of: ${COMMAND_CHANNEL_ROLES.join(', ')}) — register with that role if you are one` };
      }
    }
    const ts = now();
    const message = {
      id: genId(),
      seq: state.messageSeq + 1,
      from: agentId,
      to: to || 'all',
      body: body || '',
      channel: channel === 'command' ? 'command' : 'main',
      createdAt: ts,
    };
    emit('message.post', { message });
    return { ok: true, message: { ...message } };
  }

  function getMessages({ since = 0, to, channel } = {}) {
    // channel: 'main' (default — pre-channel messages count as main),
    // 'command', or 'all'. Workers polling their inbox never see command
    // traffic unless they ask for it; the gate is on POSTING, not reading.
    const wanted = channel === 'command' || channel === 'all' ? channel : 'main';
    return state.messages
      .filter((m) => m.seq > since)
      .filter((m) => {
        if (wanted === 'all') return true;
        return (m.channel || 'main') === wanted;
      })
      .filter((m) => {
        if (!to) return true;
        return m.to === 'all' || m.to === to || m.from === to;
      })
      .map((m) => ({ ...m }));
  }

  // ===========================================================================
  // Real-time pub/sub
  // ===========================================================================
  function subscribe(fn) {
    subscribers.add(fn);
    return function unsubscribe() {
      subscribers.delete(fn);
    };
  }

  // ===========================================================================
  // Board tidying
  // ===========================================================================
  // Archive done tasks that have sat untouched past the horizon: append the full
  // task record to a monthly JSONL under <dir>/archive (git-history-independent
  // paper trail), then delete it from live state via a journaled task.archived
  // event so snapshot + replay reconstruct the same tidied board.
  const archiveDir = path.join(dir, 'archive');
  function archiveDoneTasks({ olderThanDays = 14 } = {}) {
    const t = now();
    const cutoff = t - olderThanDays * 86400000;
    let archived = 0;
    for (const task of [...state.tasks.values()]) {
      if (task.state !== 'done') continue;
      // Triage-only means the first worker declined the substantive review. It
      // must stay live beyond the normal tidy horizon so another reviewer can
      // claim it and replace this disposition with evidence-backed completion.
      if (task.resultDisposition === 'triage_only') continue;
      const stamp = new Date(task.updatedAt ?? task.createdAt ?? 0).getTime();
      if (!(stamp < cutoff)) continue;
      fs.mkdirSync(archiveDir, { recursive: true });
      const month = new Date(stamp).toISOString().slice(0, 7);
      fs.appendFileSync(path.join(archiveDir, `tasks-${month}.jsonl`), JSON.stringify(task) + '\n');
      emit('task.archived', { taskId: task.id, ts: t, archivedTo: `tasks-${month}.jsonl` });
      archived += 1;
    }
    return { archived };
  }

  // TEST-ONLY seam: backdate a task's board timestamp so archive-age tests do
  // not have to wait out the horizon. Not journaled — the archive event that
  // tests trigger afterwards is what replay depends on.
  function __setTaskUpdatedAt(taskId, when) {
    const t = getTask(taskId);
    if (t) t.updatedAt = new Date(when).getTime();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  function sweepExpired() {
    const t = now();
    for (const lock of [...state.locks.values()]) {
      if (lock.expiresAt && lock.expiresAt <= t) {
        emit('lock.expired', { lockId: lock.id, agentId: lock.agentId });
        continue;
      }
      // WF-G75: one-shot T-minus warning so a holder learns its lock is about
      // to lapse while it can still renew. Sweeps run every ~30s server-side,
      // but the warned flag keeps this to a single event per TTL window.
      const remainMs = lock.expiresAt ? lock.expiresAt - t : Infinity;
      if (!lock.expiringWarned && remainMs <= lockExpiringWarnMs) {
        lock.expiringWarned = true;
        emit('lock.expiring', { lockId: lock.id, agentId: lock.agentId, expiresAt: lock.expiresAt, remainingMs: remainMs });
      }
    }

    // A queue position cannot help a worker that has stopped checking in. Release
    // only that worker's reservations as soon as it becomes stale, so the next
    // queued worker can lock without waiting for the longer agent-drop horizon.
    // Locks and tasks deliberately remain owned here: their separate expiry and
    // reap rules preserve in-progress work that may merely be quiet.
    for (const reservation of [...state.reservations.values()]) {
      const holder = state.agents.get(reservation.agentId);
      if (!holder || t - holder.lastSeen > presenceTtlMs) {
        emit('reservation.release', {
          reservationId: reservation.id,
          agentId: reservation.agentId,
          stale: true,
        });
      }
    }
    // Reap dead agents: past the drop horizon an agent is presumed crashed —
    // free its locks NOW (not at lock TTL), reopen its in-flight tasks so the
    // wave can reassign them, and retire its record (token stops working;
    // a returning agent re-registers). Presence demotion (online -> stale)
    // stays lazy in listAgents().
    for (const agent of [...state.agents.values()]) {
      const lastMeaningfulAt = Number.isFinite(agent.lastMeaningfulAt)
        ? agent.lastMeaningfulAt
        : (Number.isFinite(agent.lastSeen) ? agent.lastSeen : agent.registeredAt);
      const heartbeatIsLatest = Number.isFinite(agent.lastHeartbeatAt)
        && agent.lastHeartbeatAt >= lastMeaningfulAt;
      const heartbeatExpiresAt = lastMeaningfulAt + heartbeatOnlyLeaseMs;
      if (heartbeatIsLatest && t >= heartbeatExpiresAt) {
        expireHeartbeatLease(agent, t, lastMeaningfulAt, heartbeatExpiresAt);
        continue;
      }
      // Grace for agents mid-work (WF-G4): an agent holding a claimed/
      // in-progress task gets DOUBLE the silence horizon before reaping —
      // quiet-but-alive workers deep in an edit are the false-positive case.
      const holdsWork = [...state.tasks.values()].some(
        (task) => task.claimedBy === agent.id && (task.state === 'claimed' || task.state === 'in_progress'),
      );
      const horizon = holdsWork ? presenceDropMs * 2 : presenceDropMs;
      if (t - agent.lastSeen <= horizon) continue;
      // Preserve-on-reap (agent-retrace, Wave 2): capture WHO died and what it was
      // doing BEFORE freeing its locks and dropping it, so a successor can retrace it.
      const filesHeld = [];
      for (const lock of state.locks.values()) {
        if (lock.agentId === agent.id) {
          filesHeld.push({
            paths: [...(lock.paths || [])],
            globs: [...(lock.globs || [])],
            reason: lock.reason || '',
            lockedAt: lock.createdAt,
          });
        }
      }
      const sayTail = state.messages
        .filter((m) => m.from === agent.id)
        .slice(-8)
        .map((m) => ({ at: m.createdAt, body: m.body, channel: m.channel }));
      const dossier = {
        reapedAt: t,
        lastSeenAt: agent.lastSeen,
        agent: {
          handle: agent.handle,
          type: agent.type || '',
          role: agent.role || '',
          model: agent.model || '',
          spawnedBy: agent.spawnedBy || '',
          campaign: agent.campaign || '',
          sessionId: agent.sessionId || '',
        },
        filesHeld,
        sayTail,
      };
      for (const lock of [...state.locks.values()]) {
        if (lock.agentId === agent.id) {
          emit('lock.release', { lockId: lock.id, agentId: agent.id, reaped: true });
        }
      }
      for (const reservation of [...state.reservations.values()]) {
        if (reservation.agentId === agent.id) {
          emit('reservation.release', { reservationId: reservation.id, agentId: agent.id, reaped: true });
        }
      }
      for (const task of [...state.tasks.values()]) {
        if (task.claimedBy === agent.id && (task.state === 'claimed' || task.state === 'in_progress')) {
          const entry = { at: t, by: agent.id, action: 'reaped', state: 'open' };
          // Current locks may already be gone because their 30-minute TTL is
          // shorter than the 120-minute active-task reap horizon. The durable
          // task union restores those earlier lock tokens and every checkpoint
          // file, while the structured `filesHeld` records what remained live.
          const files = [...new Set([
            ...(task.retraceFiles || []),
            ...(task.checkpoint && Array.isArray(task.checkpoint.files) ? task.checkpoint.files : []),
            ...filesHeld.flatMap((lock) => [...(lock.paths || []), ...(lock.globs || [])]),
          ])];
          const retrace = { ...dossier, files, checkpoint: task.checkpoint || null };
          emit('task.release', { taskId: task.id, ts: t, entry, retrace });
        }
      }
      emit('agent.drop', { agentId: agent.id, reaped: true });
    }

    // Invariant repair for legacy/corrupt state: old versions could hand a
    // task to a typo or already-gone agent id. No reaper can visit an identity
    // that has no roster record, so sweep those orphan claims directly.
    for (const task of [...state.tasks.values()]) {
      if (!task.claimedBy || !['claimed', 'in_progress'].includes(task.state)) continue;
      if (state.agents.has(task.claimedBy)) continue;
      const previousClaimant = task.claimedBy;
      const entry = {
        at: t,
        by: 'system',
        action: 'reaped',
        state: 'open',
        reason: 'orphan claimant missing from roster',
        previousClaimant,
      };
      emit('task.release', { taskId: task.id, ts: t, entry, orphaned: true });
    }
  }

  function close() {
    snapshot(); // final snapshot (also rotates the journal)
    if (journalFd !== null) {
      fs.closeSync(journalFd);
      journalFd = null;
    }
    subscribers.clear();
  }

  return {
    // presence
    registerAgent,
    retireAgent,
    retireStaleIdleAgent,
    touch,
    heartbeatAgent,
    listAgents,
    getAgentByToken,
    findLiveAgentByHandle,
    listPetIdentities,
    // locks
    acquireLock,
    releaseLock,
    shrinkLock,
    renewLock,
    listLocks,
    // reservations
    reserveFiles,
    releaseReservation,
    listReservations,
    // campaigns
    claimCampaign,
    setCampaignState,
    listCampaigns,
    // charters and triage (design §6, §7, §10, §72)
    putCharter,
    approveCharter,
    campaignView,
    triageReport,
    startTriage,
    applyDisposition,
    finishTriage,
    // tasks
    createTask,
    defaultCampaignFor,
    migrateTaskDeps,
    migrateDepIds,
    migrateIds,
    // Seats: durable identity for campaign ownership (phase 3).
    createSeat,
    holdSeat,
    releaseSeat,
    renameSeat,
    resolveSeatId,
    seatDiary,
    listSeats,
    seatIdFor,
    writeSeatRoster,
    sweepEmptyCampaigns,
    inferTaskMembership,
    canonicalId,
    claimTask,
    claimNextReady,
    setTaskState,
    editTask,
    setTaskCampaign,
    /** WF-G147: when the last snapshot ran, how long it took, how big it was. */
    getSnapshotStats: () => (lastSnapshot ? { ...lastSnapshot } : null),
    setTaskCategories,
    checkpointTask,
    handoffTask,
    listTasks,
    archiveDoneTasks,
    __setTaskUpdatedAt, // test-only seam

    // messaging
    postMessage,
    getMessages,
    // pub/sub
    subscribe,
    // lifecycle
    snapshot,
    sweepExpired,
    close,
    // introspection (handy for server /health + tests)
    get lastSeq() {
      return state.seq;
    },
  };
}
