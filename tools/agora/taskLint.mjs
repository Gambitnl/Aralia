// tools/agora/taskLint.mjs
// WF-G111 (tooling half): a freshness check for a board task BODY, so an
// orchestrator can run it before dispatch instead of a worker discovering it
// mid-packet.
//
// WHY. On 2026-09-09, 14 of 40 expanded phase-2 task bodies were stale or wrong
// about the code: they named files that do not exist, invented action names
// (`TOGGLE_LEDGER_BOOK` never existed), and described systems that had already
// shipped. Workers spent up to a third of each packet proving a negative. Every
// one of those defects is mechanically detectable from the body text alone.
//
// WHAT it checks:
//   1. Every path-shaped token in the title/body/refs that is not a file or
//      directory in the checkout. Paths that DO exist but are gitignored are
//      reported separately as a note, not a defect — `git ls-files` cannot see
//      them, so a reader who greps the index would otherwise call them missing
//      (this is the real GG-145 case: PreviewTown3D.tsx exists and is ignored).
//   2. Every backticked code identifier that does not appear anywhere under
//      `src/`. An identifier a worker cannot grep is an identifier that does
//      not exist, or lives outside the tree the task points at.
//   3. Bare file names without directories (WF-G158).
//   4. Missing test paths with split file candidate detection (WF-G167):
//      vitest treats non-existent test paths as empty filters and exits 0!
//   5. Suspect missing-schema claims (WF-G165): claims that a schema is missing
//      or needs to be added when it already exists in `src/types/**`.
//   6. Unresolved type field claims (WF-G161): claims that specific fields come
//      from a type file that does not contain those fields.
//   7. Quoted source locations survive inserted tracking comments (WF-G211).
//      A quote identifies literal evidence, not behavior or permission to edit.
//   8. Reviewed replacement blocks detect later sibling growth (WF-G307).
//      A digest proves literal freshness, not preservation of every behavior.
//   9. Data prescriptions cite current sibling values or a reviewed new value
//      (WF-G267). Literal provenance is not a claim of semantic canon.
//  10. Idea Board addresses name their current stable source/record owner
//      (WF-G294). Same-read identity is not reachability or edit permission.
//  11. Value-equivalence deletion premises name a probe and reported evidence,
//      or remain explicitly unverified (WF-G276). No probe runs automatically.
//  12. Runtime limitation premises cite a current failing assertion, or remain
//      investigation-only (WF-G264). Source comments cannot prove behavior.
//
// It NEVER refuses or rewrites a task: a body may legitimately name a file the
// task will create, or an identifier it will introduce. The output is evidence
// for a human or orchestrator decision.
//
// The filesystem and grep are injected, so the tests run without git.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {taskReferenceFreshness, formatReferenceFreshness} from './taskFreshness.mjs';
import {inspectDataValueClaims, withoutDataValuePayload} from './dataValueProvenance.mjs';
import {inspectRecordSourceClaims,withoutSourceRecordPayload} from './recordSourceProvenance.mjs';
import {validateTestBaseline} from './testBaseline.mjs';

const __filename = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

// A path-shaped token: at least one slash, no glob characters, and either a
// file extension or a top-level directory this repo actually has. The same
// shape client.mjs's WF-G81 ref check uses, widened to free body text.
const TOP_DIRS = /^(src|tools|docs|public|scripts|tests|misc|conductor|\.agent|\.claude)\//;

/**
 * Strip markdown/prose punctuation that clings to a token in a sentence.
 *
 * Underscore is deliberately NOT stripped: `__tests__` is a real directory name
 * here, and trimming it turned `src/.../__tests__/x.test.ts` into a path that
 * does not exist, which the lint then reported as a defect of its own making.
 */
function trimToken(raw) {
  return String(raw)
    .replace(/^[(\[{'"`*]+/, '')
    .replace(/[)\]}'"`*,.;:!?]+$/, '');
}

// A quoted drive path is host context, not a sequence of checkout obligations
// (WF-G350). Remove only a complete path before whitespace/basename scanning.
// Keep ordinary quoted commands and malformed quotes visible to the old checks;
// this does not validate host files or infer the end of an unquoted path.
function withoutQuotedWindowsPaths(text) {
  return String(text || '').replace(/(["'`])([A-Za-z]:[\\/][^\r\n"'`|<>]+)\1/g, (span, _quote, host) => {
    const segments = host.slice(3).replace(/[\\/]+$/, '').split(/[\\/]/);
    if (!segments.length || segments.some(segment => !segment || segment.trim() !== segment
      || !/^[A-Za-z0-9_.@() -]+$/.test(segment))) return span;
    // An executable followed by arguments is not a quoted path alone. Refuse
    // the ambiguous span rather than hiding a following source obligation.
    if (/\.[A-Za-z0-9]{1,8}\s+\S/.test(host)
      || /\s+(?:src|tools|docs|public|scripts|tests|misc|conductor|\.agent|\.claude)[\\/]/.test(host)) return span;
    return ' ';
  });
}

/** Every distinct path-shaped token in a block of text, in first-seen order. */
export function extractPathTokens(text) {
  const out = [];
  const seen = new Set();
  for (const rawToken of withoutQuotedWindowsPaths(text).split(/[\s|]+/)) {
    // Glob and placeholder characters are checked on the RAW token: trimming a
    // trailing '*' first would turn `src/a/**` into a plausible-looking path.
    if (/[*?<>]/.test(rawToken)) continue;
    // Directory refs often end in '/', and Windows-authored packets may use
    // backslashes. Normalize both before deciding whether the path exists.
    const token = trimToken(rawToken).replace(/\\/g, '/').replace(/\/+$/, '');
    if (!token || !token.includes('/')) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(token)) continue; // planmap:, https:, workflow:
    if (!/^[A-Za-z0-9_.@-]+(\/[A-Za-z0-9_.@-]+)+$/.test(token)) continue;
    if (!/\.[A-Za-z0-9]{1,8}$/.test(token) && !TOP_DIRS.test(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

/**
 * File obligations named by refs, title, body or declared title targets.
 * This is conservative, not a guess at which prose verbs imply an edit. Authors
 * can mark reference-only context and absence assertions explicitly. Creating
 * or deleting a path still needs ownership, even with an absence postcondition.
 * Consumers must grant a path or arrange a handoff; this helper grants nothing.
 */
export function extractTaskOwnershipPaths(task = {}, { repoRoot = REPO_ROOT } = {}) {
  const root = String(repoRoot).replace(/\\/g, '/').replace(/\/+$/, '');
  const escapedRoot = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const absolutePrefix = new RegExp('(^|[\\s\\[({"\'`])' + escapedRoot + '/', /^[A-Z]:/i.test(root) ? 'gi' : 'g');
  const paths = (text) => extractPathTokens(String(text || '').replace(/\\/g, '/')
    .replace(absolutePrefix, '$1')
    .replace(/(\.[A-Za-z0-9]{1,8})(?::\d+(?::\d+)?(?:#[A-Za-z0-9_.-]+)?|#[A-Za-z0-9_.-]+)(?=$|[\s`'"),.;!?\]])/g, '$1'));
  const found = new Map();
  const exempt = new Set();
  const explicitEdits = new Set();
  const add = (ref, source) => {
    if (!found.has(ref)) found.set(ref, new Set());
    found.get(ref).add(source);
  };
  for (const ref of Array.isArray(task.refs) ? task.refs : []) {
    for (const file of paths(ref)) add(file, 'refs');
  }
  // WF-G256: a short title can name the second half of a task even when its
  // refs and detailed body omit it. Read it without granting extra ownership.
  for (const file of paths(task.title)) add(file, 'title');
  for (const target of parseTaskTitleTargets(task).declarations) {
    add(target.file, 'title-target'); explicitEdits.add(target.file);
  }
  for (const line of withoutSourceRecordPayload(withoutDataValuePayload(task.body)).split(/\r?\n/)) {
    if (RUNTIME_LIMITATION_MARKER.test(line) || VALUE_EQ_MARKER.test(line) || SOURCE_CITATION_MARKER.test(line) || TITLE_TARGET_MARKER.test(line) || DEDUP_ACCEPTANCE_MARKER.test(line) || SYMBOL_CHECK_MARKER.test(line) || SOURCE_REVIEW_MARKER.test(line) || SOURCE_MEMBERS_MARKER.test(line) || ACTION_WIRING_MARKER.test(line) || UNION_METADATA_MARKER.test(line)) continue; // metadata never implies unrelated edits
    const reference = /^[ \t>*-]*(?:REFERENCE-ONLY|EXPECTED-ABSENT|ABSENT|COUNT-SOURCE)\s*:(.*)$/i.exec(line);
    if (reference) {
      for (const file of paths(reference[1])) exempt.add(file);
      continue;
    }
    const edit = /^[ \t>*-]*(?:CREATES?|NEW FILES?|DELETES?|REMOVES?)\s*:(.*)$/i.exec(line);
    for (const file of paths(line)) {
      add(file, 'body');
      if (edit) explicitEdits.add(file);
    }
  }
  return [...found].filter(([ref]) => !exempt.has(ref) || explicitEdits.has(ref))
    .map(([ref, sources]) => ({ ref, sources: [...sources] }));
}

/**
 * Every distinct backticked CODE IDENTIFIER in a block of text.
 *
 * Deliberately conservative: a backticked English word ("`open`", "`done`") is
 * not an identifier claim, so an identifier must carry an uppercase letter or
 * an underscore — the shape of a constant, a type, a component or a camelCase
 * function. A trailing `()` is stripped. Path-shaped spans are left to the path
 * check above.
 */
export function extractBacktickedIdentifiers(text) {
  const out = [];
  const seen = new Set();
  const spans = String(text || '').match(/`[^`\n]+`/g) || [];
  for (const span of spans) {
    const inner = span.slice(1, -1).trim().replace(/\(\s*\)$/, '');
    if (!inner || inner.includes('/') || inner.includes(' ')) continue;
    // A dotted or member expression is checked by its LAST segment, which is
    // the name that has to exist somewhere in the source.
    const name = inner.split('.').pop();
    if (!/^[A-Za-z_$][A-Za-z0-9_$]{2,}$/.test(name)) continue;
    if (!/[A-Z_]/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/** Default existence probe. */
function defaultExists(repoRoot, rel) {
  return fs.existsSync(path.resolve(repoRoot, rel));
}

/**
 * Default gitignore probe, batched: one `git check-ignore --stdin` for the
 * whole list rather than a process per path.
 */
export function defaultIgnoredPaths(repoRoot, paths) {
  if (!paths.length) return new Set();
  try {
    const r = spawnSync('git', ['-C', repoRoot, 'check-ignore', '--stdin'], {
      input: paths.join('\n'),
      encoding: 'utf8',
    });
    // exit 0 = some ignored, 1 = none ignored, 128 = not a repo. Only stdout matters.
    return new Set(String(r.stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** Default source grep: does this identifier appear anywhere under src/? */
export function defaultGrepSrc(repoRoot, name) {
  try {
    const r = spawnSync('git', ['-C', repoRoot, 'grep', '--no-index', '-l', '-F', '-e', name, '--', 'src'], {
      encoding: 'utf8',
    });
    return Boolean(String(r.stdout || '').trim());
  } catch {
    return true; // a broken grep must never manufacture a false "missing"
  }
}

/**
 * Every distinct BARE source file name in a block of text: `useTurnOrder.ts`,
 * `Foo.tsx`, `bar.mjs` with no directory. WF-G158 (2026-09-13): a task body
 * said "(same file or useTurnOrder.ts)" — no slash, so the path check never
 * saw it, and the file does not exist anywhere in the repo.
 */
export function extractBareFileNames(text) {
  const out = [];
  const seen = new Set();
  for (const rawToken of withoutQuotedWindowsPaths(text).split(/[\s|(),;:]+/)) {
    const token = trimToken(rawToken).replace(/^`|`$/g, '');
    if (!token || token.includes('/') || token.includes('\\')) continue;
    if (!/^[A-Za-z0-9_.-]+\.(ts|tsx|mjs|cjs|js|jsx|json|md)$/.test(token)) continue;
    if (/^\.\w/.test(token)) continue; // ".ts" style fragments
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

/** Does any tracked or untracked (non-ignored) file in the repo carry this basename? */
export function defaultBasenameExists(repoRoot, name) {
  const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', `*/${name}`, name], {
    cwd: repoRoot, encoding: 'utf8',
  });
  return r.status === 0 && r.stdout.trim().length > 0;
}

// ---------------------------------------------------------------------------
// WF-G167: Missing test paths and split test candidates.
// vitest treats a non-existent test file as an empty filter rather than an
// error, silently reporting a green run without executing the intended tests.
// ---------------------------------------------------------------------------

/** Does this path token look like a test suite? */
export function isTestPath(pathStr) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/i.test(pathStr) || pathStr.includes('/__tests__/') || pathStr.includes('\\__tests__\\');
}

/**
 * When a named test path is missing, check if its directory exists and holds
 * split test files (e.g. combatUtils_attack.test.ts instead of combatUtils.test.ts).
 */
export function defaultFindSplitCandidates(repoRoot, missingTestPath) {
  const norm = String(missingTestPath || '').replace(/\\/g, '/');
  const dir = path.resolve(repoRoot, path.dirname(norm));
  const base = path.basename(norm).replace(/\.(test|spec)\.[cm]?[jt]sx?$/i, '');
  if (!fs.existsSync(dir)) return [];
  try {
    const entries = fs.readdirSync(dir);
    return entries.filter((f) => {
      if (!isTestPath(f)) return false;
      return f.startsWith(`${base}_`) || f.startsWith(`${base}.`);
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// WF-G165: Missing schema assertion detector.
// Catches tasks claiming "no schema" or "add a schema for X" when type X is
// already defined under src/types/**, avoiding duplicate type creation.
// ---------------------------------------------------------------------------

export function extractSchemaClaims(text) {
  const claims = [];
  const seen = new Set();
  const patterns = [
    /(?:add(?: a)?|create|missing|no|needs?)\s+schema\s+(?:for\s+)?([A-Za-z0-9_$]+)/gi,
    /(?:schema\s+ors+handlers+(?:fors+)?)([A-Za-z0-9_$]+)/gi,
    /([A-Za-z0-9_$]+)(?::[^\s]*)?\s+(?:hass+nos+schema|nos+schemas+ors+handler)/gi,
  ];

  const stopWords = new Set(['in', 'for', 'a', 'the', 'and', 'or', 'to', 'of', 'with', 'from', 'this', 'that', 'no', 'schema']);

  for (const pat of patterns) {
    let match;
    while ((match = pat.exec(text)) !== null) {
      const typeName = match[1];
      if (!typeName || stopWords.has(typeName.toLowerCase()) || typeName.length < 3) continue;
      if (seen.has(typeName.toLowerCase())) continue;
      seen.add(typeName.toLowerCase());
      claims.push({ claim: match[0], typeName });
    }
  }
  return claims;
}

export function defaultGrepTypes(repoRoot, typeName) {
  try {
    const r = spawnSync('git', ['-C', repoRoot, 'grep', '--no-index', '-l', '-i', '-E', `(interface|type)\\s+${typeName}\\b|\\b${typeName}\\s*:`, '--', 'src/types'], {
      encoding: 'utf8',
    });
    if (r.status !== 0 && r.status !== 1) return [];
    return String(r.stdout || '')
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// WF-G161: Field and file contract resolution.
// Catches tasks prescribing named fields from a type/source file where that
// file does not actually declare or contain those fields.
// ---------------------------------------------------------------------------

export function extractTypeFieldClaims(text) {
  const claims = [];
  // Case 1: "(wealth, biome, dominant races from src/types/world.ts)"
  const pat1 = /\(([^)]+?)\s+from\s+([A-Za-z0-9_./-]+\.(?:ts|tsx))\)/gi;
  let match;
  while ((match = pat1.exec(text)) !== null) {
    const rawFields = match[1];
    const file = match[2];
    const fields = rawFields
      .split(/[,;\s]+/)
      .map((f) => f.trim().replace(/^[`'"]|[`'"]$/g, ''))
      .filter((f) => f && !['and', 'or', 'the', 'of', 'from', 'in', 'to', 'with'].includes(f.toLowerCase()));
    claims.push({ raw: match[0], file, fields });
  }

  // Case 2: "from src/types/world.ts (wealth, biome)"
  const pat2 = /from\s+([A-Za-z0-9_./-]+\.(?:ts|tsx))\s*\(([^)]+)\)/gi;
  while ((match = pat2.exec(text)) !== null) {
    const file = match[1];
    const rawFields = match[2];
    const fields = rawFields
      .split(/[,;\s]+/)
      .map((f) => f.trim().replace(/^[`'"]|[`'"]$/g, ''))
      .filter((f) => f && !['and', 'or', 'the', 'of', 'from', 'in', 'to', 'with'].includes(f.toLowerCase()));
    claims.push({ raw: match[0], file, fields });
  }

  return claims;
}

export function defaultCheckFileFields(repoRoot, relPath, fields) {
  const fullPath = path.resolve(repoRoot, relPath);
  if (!fs.existsSync(fullPath)) return [];
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    return fields.filter((field) => {
      const regex = new RegExp(`\\b${field}\\b`, 'i');
      return !regex.test(content);
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// WF-G191 / WF-G193: declared path markers.
//
// A task that CREATES a file must name that file, and a task whose whole point
// is "this cited path no longer exists" must name that path too. Until now the
// lint reported both as MISSING PATHS, so a correct task could never lint
// clean: agora-f821.10 opened with the words "CREATES (new file, does not exist
// yet, this task creates it)" and still exited 1, and agora-f821.26/34 had to
// be rewritten into prose that never names the path.
//
// The body now carries a machine-read marker per line:
//
//   CREATES: src/utils/visuals/conditionPalette.ts
//   EXPECTED-ABSENT: docs/projects/town/GAPS.md
//
// A CREATES path is moved out of MISSING PATHS into NEW PATHS, which is a
// NOTE, not a defect — unless the path already exists, which means the claim
// is stale and the task would overwrite work that has landed.
//
// An EXPECTED-ABSENT path is an ASSERTION the lint checks in reverse: absent
// is clean, PRESENT is the defect. That is the whole value of the marker — the
// day the file comes back, the doc-repair task fails its own lint.
//
// Several paths may share one marker line, separated by a comma or a space.
// The marker is case-insensitive and accepts the CREATE/CREATES and
// EXPECTED-ABSENT/ABSENT spellings.
// ---------------------------------------------------------------------------
// WF-G351: match the whole directive word before accepting annotations. A
// completed-file fact such as CREATED is ordinary context, not new-file intent;
// its path still receives the existing freshness and ownership checks.
const CREATES_MARKER = /^[ \t>*-]*(?:CREATES?|NEW FILES?)\b[^:\r\n]*:(.+)$/gim;
const ABSENT_MARKER = /^[ \t>*-]*(?:EXPECTED-ABSENT|ABSENT|DELETES?|REMOVES?)[^:\r\n]*:(.+)$/gim;

function markedPaths(text, pattern) {
  const out = [];
  const seen = new Set();
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(String(text || ''))) !== null) {
    for (const token of extractPathTokens(match[1])) {
      if (seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

/** Paths the body declares the task will CREATE (WF-G191). */
export function extractDeclaredCreates(text) {
  return markedPaths(text, CREATES_MARKER);
}

/** Paths the body asserts do NOT exist (WF-G193). */
export function extractDeclaredAbsent(text) {
  return markedPaths(text, ABSENT_MARKER);
}

/** Explicit roadmap assignments only: ordinary blocked Agora tasks stay valid. */
export function extractPlanmapStatusClaims(task = {}) {
  const claims = [];
  const roadmapRef = (task.refs || []).some(ref => /^planmap:/.test(String(ref)));
  const text = [task.title || '', task.body || ''].join('\n');
  const roadmap = /\b(?:plan[ -]?map|topics(?:\.schema)?\.json)\b/i;
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    if (/^\s*(?:EVIDENCE|HISTORY|REFERENCE-ONLY|KNOWN-INVALID)\s*:/i.test(raw)) continue;
    const line = raw.replace(/[`'"\u2018\u2019\u201c\u201d]/g, '');
    const marker = /^\s*PLANMAP-STATUS:\s*(topic|feature)\s+(\w+)\s*$/i.exec(line);
    if (marker) {
      claims.push({ status: marker[2], kind: marker[1].toLowerCase(), line: index + 1, claim: raw });
      continue;
    }
    const command = /\bplanmap-add\.mjs\b[^\n]*?--status(?:=|\s+)([\w-]+)/i.exec(line);
    if (command && !/\b(?:do not|never|must not|invalid|forbidden)\b/i.test(line.slice(0, command.index))) {
      claims.push({ status: command[1], kind: /--feature\b/i.test(line) ? 'feature' : 'topic', line: index + 1, claim: raw });
    }
    // Match imperative assignments, not free prose mentioning a status. With
    // an explicit roadmap ref, numbered "set status to" steps inherit context.
    const assignments = /\b(?:set|change|update)\s+([^.;!?\n]{0,100}?)\bstatus\s*(?:to|as|=|:)\s*([\w-]+)|\bmark\s+([^.;!?\n]{0,100}?)\s+(?:as|to)\s+([\w-]+)/gi;
    for (const match of line.matchAll(assignments)) {
      const before = line.slice(0, match.index);
      const sentence = before.split(/[.;!?]/).pop() || '';
      const subject = match[1] ?? match[3];
      if (/\b(?:do not|never|must not|should not|cannot|invalid|forbidden)\b/i.test(sentence)) continue;
      if (/\b(?:task|campaign|board|agora)\b/i.test(subject) && !roadmap.test(subject)) continue;
      if (!roadmap.test(subject) && !roadmap.test(sentence) && !roadmapRef) continue;
      if (match[3] !== undefined && !roadmap.test(subject)) continue;
      claims.push({ status: match[2] ?? match[4], kind: /\bfeature\b/i.test(subject + sentence) ? 'feature' : 'topic', line: index + 1, claim: raw });
    }
  }
  return claims;
}

/**
 * Count-based work needs a repeatable source, not a frozen number (WF-G343).
 * This checks declarations only: it never executes task text or proves that a
 * command is safe, authorized or current. Unrecognized prose still needs review.
 */
export function inspectCountSources(text) {
  const claims = [], sources = [], invalidSources = [];
  for (const [index, line] of String(text || '').split(/\r?\n/).entries()) {
    const source = /^[ \t>*-]*COUNT-SOURCE\s*:(.*)$/i.exec(line);
    if (source) {
      const command = source[1].trim().replace(/^`(.*)`$/, '$1');
      if (!command || /<[^>]*>|\b(?:TODO|TBD|COMMAND_HERE)\b/i.test(command)
        || /^(?:echo|printf|Write-Output)\b/i.test(command)) {
        invalidSources.push({ line: index + 1, command });
      } else if (!sources.some(item => item.command === command)) sources.push({ line: index + 1, command });
      continue;
    }
    if (/^[ \t>*-]*(?:EVIDENCE|HISTORY|SNAPSHOT|KNOWN-INVALID|REFERENCE-ONLY)\s*:/i.test(line)) continue;
    // A requested new deliverable count is not a claim about the live corpus.
    if (/^[ \t>*-]*(?:create|add|write|introduce)\b/i.test(line)) continue;
    if (/^[ \t>*-]*COUNT-CLAIM\s*:\s*\S/i.test(line)
      || /\b\d+(?:[ \t]+[A-Za-z][A-Za-z-]*){0,4}[ \t]+(?:rows|files|spells|gaps)\b/i.test(line)) {
      claims.push({ line: index + 1, claim: line.trim() });
    }
  }
  return { claims, sources, invalidSources, missingSources: claims.length > 0 && sources.length === 0 };
}

// WF-G325: preserve the goal's roles instead of accepting an unlabeled grep
// count that leaves a duplicate alive. This validates declared intent only;
// it never executes measurements or proves equivalence/consumer completeness.
const DEDUP_ACCEPTANCE_MARKER = /^[ \t>*-]*DEDUP-ACCEPTANCE\s*:\s*(.*)$/i;
export function inspectDedupAcceptance(text) {
  const goals = [], contracts = [], issues = [], legacyCounts = [], seen = new Set();
  let declared = 0;
  const meaningful = value => typeof value === 'string' && value.trim() === value && value.length > 0
    && Buffer.byteLength(value, 'utf8') <= 2048 && !/[\x00-\x1f\x7f]|<[^>]*>|\b(?:TBD|TODO|COMMAND_HERE)\b/i.test(value);
  for (const [index, raw] of String(text || '').split(/\r?\n/).entries()) {
    if (VALUE_EQ_MARKER.test(raw) || SOURCE_CITATION_MARKER.test(raw) || TITLE_TARGET_MARKER.test(raw) || SYMBOL_CHECK_MARKER.test(raw) || SOURCE_REVIEW_MARKER.test(raw) || SOURCE_MEMBERS_MARKER.test(raw) || ACTION_WIRING_MARKER.test(raw) || UNION_METADATA_MARKER.test(raw)
      || /^[ \t>*-]*(?:EVIDENCE|HISTORY|SNAPSHOT|KNOWN-INVALID|REFERENCE-ONLY|VERIFIED)\s*:/i.test(raw)) continue;
    const marker = DEDUP_ACCEPTANCE_MARKER.exec(raw);
    if (marker) {
      if (++declared > 16) { issues.push({ line: index + 1, reason: 'more than 16 deduplication contracts; split the task' }); break; }
      try {
        if (Buffer.byteLength(marker[1], 'utf8') > 16384) throw new Error('deduplication contract exceeds 16 KiB');
        const value = JSON.parse(marker[1]);
        const keys = ['canonical', 'canonicalCount', 'obsolete', 'obsoleteCount', 'consumers', 'verification'];
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error('DEDUP-ACCEPTANCE needs only canonical, canonicalCount, obsolete, obsoleteCount, consumers and verification');
        if (!meaningful(value.canonical) || !meaningful(value.obsolete) || !meaningful(value.verification)) throw new Error('name the canonical/obsolete definitions and concrete behavioral verification without placeholders');
        if (value.canonicalCount !== 1 || value.obsoleteCount !== 0) throw new Error('deduplication requires canonicalCount = 1 and obsoleteCount = 0; a surviving duplicate is not acceptance');
        if (value.canonical === value.obsolete || seen.has(value.canonical) || seen.has(value.obsolete)) throw new Error('canonical/obsolete roles are repeated or ambiguous; reconcile the definitions');
        if (!Array.isArray(value.consumers) || !value.consumers.length || value.consumers.length > 64
          || value.consumers.some(item => !meaningful(item)) || new Set(value.consumers).size !== value.consumers.length) throw new Error('name distinct affected consumers (one to 64); empty or duplicated consumers cannot prove delegation');
        seen.add(value.canonical); seen.add(value.obsolete); contracts.push({ ...value, line: index + 1 });
      } catch (error) { issues.push({ line: index + 1, reason: error.message }); }
      continue;
    }
    const explicit = /^[ \t>*-]*DEDUP-GOAL\s*:\s*(.*)$/i.exec(raw);
    const directive = /^[ \t>*-]*(?:goal\s*:\s*)?(?:deduplicat\w*\b|de-duplicat\w*\b|(?:consolidate|collapse|remove)\s+duplicates?\b|one\b[^\n]{0,160}\b(?:function|definition|table)\b[^\n]{0,40}\bnot\s+(?:two|2)\b)/i.test(raw);
    if (explicit || directive) {
      const claim = explicit ? explicit[1].trim() : raw.trim();
      if (!meaningful(claim)) issues.push({ line: index + 1, reason: 'DEDUP-GOAL needs a concrete bounded description, not an empty or placeholder goal' });
      else goals.push({ line: index + 1, claim });
    }
    if (/\b(?:acceptance|grep|rg)\b/i.test(raw) && /\b(?:zero|one|two|\d+)\s+(?:hits?|matches)\b/i.test(raw)) legacyCounts.push({ line: index + 1, claim: raw.trim() });
  }
  if (goals.length && !contracts.length) issues.push({ reason: 'active deduplication needs DEDUP-ACCEPTANCE with one canonical definition, zero obsolete definitions and consumer verification' });
  if (goals.length || contracts.length) for (const item of legacyCounts) issues.push({ ...item, reason: 'unlabeled grep-count acceptance can contradict deduplication; reconcile it into role-labeled criteria or preserve superseded text as SNAPSHOT' });
  return { goals, contracts, issues };
}

/**
 * Explicit pending discovery is not an implementation target (WF-G333).
 * Keep history and ordinary gameplay discovery separate. This is a declaration
 * check, not a source search or proof that an unnamed surface does not exist.
 */
export function extractPendingDiscoveries(text) {
  const pending = [];
  for (const [index, raw] of String(text || '').split(/\r?\n/).entries()) {
    const line = raw.replace(/^[ \t>*-]*(?:\d+[.)][ \t]+)?/, '');
    if (/^(?:EVIDENCE|HISTORY|SNAPSHOT|KNOWN-INVALID|REFERENCE-ONLY)\s*:/i.test(line)) continue;
    if (/^(?:OWNED (?:FILES?|PATHS?)\s*:\s*)?(?:(?:DISCOVER|FIND|LOCATE)\s*:|(?:DISCOVERY-REQUIRED|TO-DISCOVER)\s*:)/i.test(line)) {
      pending.push({ line: index + 1, claim: raw.trim() });
    }
  }
  return pending;
}

// WF-G276: a removal recipe must not turn an unmeasured "same value" premise
// into fact. Reported equality is an author's receipt, not certification by
// this text checker. Unverified records may support investigation, but never
// authorize deletion before the worker obtains the missing comparison proof.
const VALUE_EQ_MARKER = /^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?VALUE-EQUIVALENCE\s*:\s*(.*)$/i;
export function withoutEquivalencePayload(text) {
  return String(text || '').split(/\r?\n/).filter(line=>!VALUE_EQ_MARKER.test(line)).join('\n');
}
export function inspectValueEquivalence(task={}, {now=Date.now()}={}) {
  const declarations=[],unverified=[],issues=[],seen=new Set();let declared=0;
  const input=[task.title||'',task.body||''].join('\n');
  const historical=/^[ \t>*-]*(?:EVIDENCE|HISTORY|SNAPSHOT|KNOWN-INVALID|REFERENCE-ONLY|DATA-VALUE|SOURCE-RECORD|DEDUP-ACCEPTANCE)\s*:/i;
  const metadata=raw=>RUNTIME_LIMITATION_MARKER.test(raw)||VALUE_EQ_MARKER.test(raw)||SOURCE_CITATION_MARKER.test(raw)||SYMBOL_CHECK_MARKER.test(raw)||SOURCE_REVIEW_MARKER.test(raw)||SOURCE_MEMBERS_MARKER.test(raw)||ACTION_WIRING_MARKER.test(raw)||UNION_METADATA_MARKER.test(raw)||historical.test(raw);
  // The premise and its removal recipe may be on different lines. Neither an
  // incidental "verify formatting" nor a negated probe clears that premise.
  const removalContext=input.split(/\r?\n/).some(raw=>!metadata(raw)&&/\b(?:delete|remove|drop|retire|replace|deduplicat\w*)\b/i.test(raw));
  const meaningful=value=>typeof value==='string'&&value.trim()===value&&value.length>0
    &&Buffer.byteLength(value,'utf8')<=2048&&!/[\x00-\x1f\x7f]|<[^>]*>|\b(?:TODO|TBD|COMMAND_HERE)\b/i.test(value);
  for(const [index,raw]of input.split(/\r?\n/).entries()) {
    const marker=VALUE_EQ_MARKER.exec(raw);
    if(marker){
      if(++declared>32){issues.push({bodyLine:index+1,reason:'more than32 value-equivalence records; split the task'});break;}
      try{
        if(Buffer.byteLength(marker[1],'utf8')>16384)throw Error('value-equivalence record exceeds16KiB');
        const item=JSON.parse(marker[1]),keys=['claim','left','right','state','probe','evidence','observedAt','reason'];
        if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!keys.includes(k)))throw Error('VALUE-EQUIVALENCE needs only claim, left, right, state, probe, evidence, observedAt and reason');
        if(!meaningful(item.claim)||!meaningful(item.left)||!meaningful(item.right)||item.left===item.right)throw Error('name the concrete claim and two distinct compared value paths without placeholders');
        if(seen.has(item.claim))throw Error('duplicate value-equivalence claim; reconcile its state once');
        if(item.state==='reported_equal'){
          if(!meaningful(item.probe)||!meaningful(item.evidence)||item.reason!==undefined)throw Error('reported equality needs the named proving probe and comparison evidence, not an unresolved reason');
          const at=typeof item.observedAt==='string'?Date.parse(item.observedAt):NaN;
          if(!Number.isFinite(at)||new Date(at).toISOString()!==item.observedAt||at>now+300000||now-at>86400000)throw Error('reported equality needs a current ISO UTC observation within24h, not a stale or future receipt');
        }else if(item.state==='unverified'){
          if(!meaningful(item.reason)||item.evidence!==undefined||item.observedAt!==undefined
            ||(item.probe!==undefined&&!meaningful(item.probe)))throw Error('unverified comparison needs a reason and optional proposed probe, not equality evidence or a verified timestamp');
        }else throw Error('state must be reported_equal or unverified; no semantic certification is inferred');
        seen.add(item.claim);declarations.push({...item,bodyLine:index+1});
        if(item.state==='unverified')unverified.push({...item,bodyLine:index+1});
      }catch(error){issues.push({bodyLine:index+1,reason:error.message});}
      continue;
    }
    // Quoted evidence and other typed records are not live removal instructions.
    // Adding a good record must not clear a separate unsupported prose claim.
    if(metadata(raw))continue;
    const equality=/\b(?:redundant|equivalent|identical|same (?:values?|outputs?|results?|behavior))\b/i.test(raw);
    const assertion=/\b(?:is|are|now|already)\s+(?:\w+\s+){0,3}(?:redundant|equivalent|identical)\b|\bredundant rather than wrong\b/i.test(raw);
    if(equality&&(removalContext||assertion))issues.push({bodyLine:index+1,claim:raw.trim(),reason:'unsupported removal/equality premise: replace it with a VALUE-EQUIVALENCE record naming a proving probe and reported evidence, or an explicitly unverified comparison; preserve superseded prose as SNAPSHOT after author reconciliation'});
  }
  return {declarations,unverified,issues,limits:'Declared evidence only: no automatic probe execution, semantic equality, file ownership or deletion acceptance.'};
}

// WF-G264: read an executed-run receipt, never a command embedded in a brief.
// This checks freshness and exact test identity, not the semantic relevance of
// an assertion or the authenticity of author-supplied evidence. Keep the named
// observation small; broad production claims still need parent review.
const RUNTIME_LIMITATION_MARKER = /^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?RUNTIME-LIMITATION\s*:\s*(.*)$/i;
export function withoutRuntimeLimitationPayload(text) {
  return String(text || '').split(/\r?\n/).filter(line=>!RUNTIME_LIMITATION_MARKER.test(line)).join('\n');
}
export function inspectRuntimeLimitations(task={}, {repoRoot=REPO_ROOT,now=Date.now()}={}) {
  const declarations=[],unverified=[],issues=[],seen=new Set();let count=0;
  const meaningful=value=>typeof value==='string'&&value.trim()===value&&value.length>0
    &&Buffer.byteLength(value,'utf8')<=2048&&!/[\x00-\x1f\x7f]|<[^>]*>|\b(?:TODO|TBD|COMMAND_HERE)\b/i.test(value);
  const relative=value=>meaningful(value)&&/^[A-Za-z0-9_.@-]+(?:\/[A-Za-z0-9_.@-]+)+$/.test(value)
    &&!value.split('/').some(part=>part==='.'||part==='..');
  const prose=withoutSourceRecordPayload(withoutDataValuePayload(withoutSourceCitationPayload([task.title||'',task.body||''].join('\n'))));
  const historical=line=>/^[ \t>*-]*(?:SNAPSHOT|HISTORY|EVIDENCE|REFERENCE-ONLY|KNOWN-INVALID)\s*:/i.test(line);
  const active=prose.split(/\r?\n/).map(line=>historical(line)?'':line).join('\n');
  const verbs='(?:add|implement|create|replace|remove|delete|rewrite|wire|fix)';
  const action=new RegExp('\\b'+verbs+'(?:\\s+(?!(?:acceptance|policy|contract)\\b)|:\\s*)','i');
  const bareAction=new RegExp('^\\s*'+verbs+'\\s*$','i');
  const findRecipe=()=>{
    let prohibited=false;
    for(const clause of active.split(/(\.\s+|[;,]|\r?\n|\b(?:but|then|instead)\b)/i)) {
      if(/^(?:\.\s+|;|\r?\n|but|then|instead)$/i.test(clause)){prohibited=false;continue;}
      if(clause===',')continue;
      const negative=/\b(?:do not|don't|never|must not|cannot|can't)\b/i.test(clause)
        ||(prohibited&&(/^\s*(?:or|and)\b/i.test(clause)||bareAction.test(clause)));
      if(!negative&&action.test(clause))return clause;
      prohibited=negative;
    }
    return null;
  };
  for(const [index,raw]of [task.title||'',task.body||''].join('\n').split(/\r?\n/).entries()) {
    const marker=RUNTIME_LIMITATION_MARKER.exec(raw);if(!marker)continue;
    if(++count>32){issues.push({bodyLine:index+1,reason:'more than32 runtime limitation records; split the task'});break;}
    try {
      if(Buffer.byteLength(marker[1],'utf8')>16384)throw Error('runtime limitation record exceeds16KiB');
      const item=JSON.parse(marker[1]),keys=['claim','file','entry','state','reason','receipt','testFile','testName','sourceSha256','testSha256','observation'];
      if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!keys.includes(k)))throw Error('RUNTIME-LIMITATION has unknown fields or is not an object');
      if(!meaningful(item.claim)||!relative(item.file)||typeof item.entry!=='string'||item.entry.length>128||!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(item.entry))throw Error('name a concrete claim, exact relative entry file and entry identifier of at most128 characters');
      if(seen.has(item.claim))throw Error('duplicate runtime limitation claim; reconcile once');
      if(item.state==='unverified') {
        if(!meaningful(item.reason)||['receipt','testFile','testName','sourceSha256','testSha256','observation'].some(k=>item[k]!==undefined))throw Error('unverified runtime premise needs a reason, not failing-run evidence');
        // An unresolved premise may create investigation work, never a repair
        // recipe under an investigative label. Historical prose stays visible.
        if(!/^(?:[\w.-]+:\s*)?(?:Investigate|Probe|Verify|Audit|Test)\b/i.test(task.title||''))throw Error('unverified runtime premise requires an investigation-only task/packet title');
        const recipe=findRecipe();
        if(recipe)throw Error('unverified runtime premise cannot carry an implementation recipe: '+recipe.trim().slice(0,240)+'; split or reconcile the brief first');
        unverified.push({...item,bodyLine:index+1});
      }else if(item.state==='cited_failure') {
        if(item.reason!==undefined||!relative(item.receipt)||!relative(item.testFile)||!meaningful(item.testName)||!meaningful(item.observation)
          ||![item.sourceSha256,item.testSha256].every(sha=>typeof sha==='string'&&/^[a-f0-9]{64}$/.test(sha)))throw Error('cited failure needs receipt, exact test file/full name, source/test SHA256 and observed failure, not an unresolved reason');
        const source=readCitationSource(repoRoot,item.file),testSource=readCitationSource(repoRoot,item.testFile);
        const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
        if(hash(source)!==item.sourceSha256||hash(testSource)!==item.testSha256)throw Error('entry or test source changed since the cited observation; rerun and reconcile evidence');
        if(!source.includes(item.entry.split('.')[0])||!testSource.includes(item.entry.split('.')[0]))throw Error('named entry identifier is absent from the current entry or probe source; review the actual call');
        const receipt=JSON.parse(readCitationSource(repoRoot,item.receipt));validateTestBaseline(receipt,{repoRoot,now});
        const failure=receipt.summary.failures.find(f=>f.kind==='assertion'&&f.file===item.testFile&&f.name===item.testName);
        if(!failure)throw Error('receipt does not contain the named failed assertion; passed/skipped tests and suite/import failures are not limitation proof');
      }else throw Error('runtime state must be cited_failure or unverified');
      seen.add(item.claim);declarations.push({...item,bodyLine:index+1});
    }catch(error){issues.push({bodyLine:index+1,reason:error.message});}
  }
  // Conservative language detection, not a semantic classifier. Another good
  // receipt never clears an unsupported assertion on a different prose line.
  // Keep adjacent wrapped context within a paragraph/sentence. A preservation
  // rule about permissions is not a runtime rejection, and historical context
  // must not lend authority to a later active boundary claim.
  for(const raw of active.split(/(?:\r?\n\s*\r?\n|\.\s+)/)) {
    const limitation=/\b(?:cannot|can't|does not|doesn't|fails to)\s+(?:\w+\s+){0,2}(?:resolve|support|return|assemble|generate|render|load|handle|accept|produce|run|work|execute)\b|\brejects\s+(?!missing\b|unsupported\b|invalid\b)\S+|\b(?:is|are|remains?)\s+(?:\w+\s+){0,2}(?:unsupported|unreachable)\b/i;
    if(limitation.test(raw)
      &&(/\b(?:production|runtime|generation|generator|entry|function|helper|routine|resolver|API|boundary)\b/i.test(raw)||/\b[A-Za-z_$][\w$]*\s*\(/.test(raw))) {
      issues.push({bodyLine:Math.max(1,prose.slice(0,prose.indexOf(raw)).split('\n').length),reason:'unsupported runtime limitation premise: use RUNTIME-LIMITATION with a current named failing-run receipt, or investigation-only unverified state; preserve superseded prose as SNAPSHOT'});
    }
  }
  return {declarations,unverified,issues,limits:'Cited execution evidence, not authenticated or semantic certification; no automatic commands, ownership or implementation permission.'};
}

function readPlanmapSchema(repoRoot) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'public/planmap/topics.schema.json'), 'utf8'));
}

// Source quotes are metadata, not task instructions. Do not turn quoted paths,
// counts, CREATE examples or identifiers into unrelated lint obligations.
const SOURCE_CITATION_MARKER = /^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?(SOURCE-CITATION(?:-UNVERIFIED)?)\s*:\s*(.*)$/i;
const TITLE_TARGET_MARKER = /^[ \t>*-]*TITLE-TARGET\s*:\s*(.*)$/i;
const SYMBOL_CHECK_MARKER = /^[ \t>*-]*(SYMBOL-CHECK(?:-UNVERIFIED)?)\s*:\s*(.*)$/i;
const SOURCE_REVIEW_MARKER = /^[ \t>*-]*SOURCE-REVIEW\s*:\s*(.*)$/i;
const SOURCE_MEMBERS_MARKER = /^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?(SOURCE-MEMBERS(?:-UNVERIFIED)?)\s*:\s*(.*)$/i;
/** Keep member/comparison records out of titles and permission prose; retain them separately. */
export function sourceMembersProse(text) {
  return withoutRuntimeLimitationPayload(withoutEquivalencePayload(text)).split(/\r?\n/).filter(line => !SOURCE_MEMBERS_MARKER.test(line)).join('\n');
}
// The packet gate audits wiring JSON; quoted source context is not an edit grant.
const ACTION_WIRING_MARKER = /^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?ACTION-WIRING(?:-UNCHANGED)?\s*:/i;
// The union packet gate owns these records; quoting them is not an edit grant.
const UNION_METADATA_MARKER = /^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?UNION-(?:CHANGE|REVIEW)\s*:/i;
function withoutSourceCitationPayload(text) {
  return String(text || '').split(/\r?\n/).filter(line => !RUNTIME_LIMITATION_MARKER.test(line) && !VALUE_EQ_MARKER.test(line) && !SOURCE_CITATION_MARKER.test(line) && !TITLE_TARGET_MARKER.test(line) && !DEDUP_ACCEPTANCE_MARKER.test(line) && !SYMBOL_CHECK_MARKER.test(line) && !SOURCE_REVIEW_MARKER.test(line) && !SOURCE_MEMBERS_MARKER.test(line) && !ACTION_WIRING_MARKER.test(line) && !UNION_METADATA_MARKER.test(line)).join('\n');
}

let memberParser;
// Load the repo's existing parser only for explicit member declarations. Normal
// task lint stays light; no application typecheck, emit or enum evaluation occurs.
function sourceMemberParser() {
  return memberParser ||= createRequire(import.meta.url)('typescript');
}

/** WF-G283: current named declaration equality, not global literal presence. */
export function inspectSourceMembers(task = {}, { repoRoot = REPO_ROOT, readSource = file => readCitationSource(repoRoot, file) } = {}) {
  const declarations = [], resolved = [], issues = [], pairs = new Set(); let checked = 0;
  for (const [index, line] of String(task.body || '').split(/\r?\n/).entries()) {
    const marker = SOURCE_MEMBERS_MARKER.exec(line); if (!marker) continue;
    if (++checked > 32) { issues.push({ bodyLine: index + 1, reason: 'more than 32 member declarations; remaining claims unchecked' }); break; }
    let claim;
    try {
      if (Buffer.byteLength(marker[2], 'utf8') > 32768) throw new Error('member declaration exceeds 32768 bytes');
      claim = JSON.parse(marker[2]); const unverified = marker[1].toUpperCase().endsWith('-UNVERIFIED');
      const fields = unverified ? ['file', 'symbol', 'reason'] : ['file', 'symbol', 'kind', 'quote', 'members'];
      if (!claim || typeof claim !== 'object' || Array.isArray(claim) || Object.keys(claim).some(key => !fields.includes(key))) throw new Error('source members needs only ' + fields.join(', '));
      if (typeof claim.file !== 'string' || !/^[A-Za-z0-9_.@-]+(?:\/[A-Za-z0-9_.@-]+)+$/.test(claim.file)
        || claim.file.split('/').some(segment => segment === '.' || segment === '..') || !/\.[cm]?tsx?$/.test(claim.file)) throw new Error('file must be an exact relative TypeScript repository path');
      if (typeof claim.symbol !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(claim.symbol)) throw new Error('symbol must be one ASCII identifier of at most128 characters');
      const key = claim.file + '\0' + claim.symbol;
      if (pairs.has(key)) throw new Error('duplicate file/symbol member claim; reconcile it once');
      pairs.add(key);
      if (unverified) {
        if (typeof claim.reason !== 'string' || !claim.reason.trim() || Buffer.byteLength(claim.reason, 'utf8') > 2048) throw new Error('unverified members require a concrete reason of at most2048 bytes');
        declarations.push({ ...claim, bodyLine: index + 1 });
        throw new Error('VERIFY: author review required: ' + claim.reason);
      }
      if (!['string-union', 'enum'].includes(claim.kind)) throw new Error('kind must be string-union or enum (enum names, not values)');
      if (typeof claim.quote !== 'string' || claim.quote.trim().length < 4 || Buffer.byteLength(claim.quote, 'utf8') > 8192 || claim.quote.includes('\0')) throw new Error('quote must be the complete declaration of at most8192 bytes');
      if (!Array.isArray(claim.members) || !claim.members.length || claim.members.length > 128
        || claim.members.some(value => typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 1024 || /[\x00-\x1f\x7f]/.test(value))) throw new Error('members must be one to128 literal strings of at most1024 bytes, without controls');
      if (new Set(claim.members).size !== claim.members.length) throw new Error('duplicate quoted members');
      declarations.push({ ...claim, bodyLine: index + 1 });
      const raw = readSource(claim.file);
      if (typeof raw !== 'string' || raw.includes('\0')) throw new Error('source is unavailable or not text');
      if (Buffer.byteLength(raw, 'utf8') > 2 * 1024 * 1024) throw new Error('source exceeds the 2 MiB read limit');
      const source = raw.replace(/\r\n?/g, '\n'), ts = sourceMemberParser();
      const parsed = ts.createSourceFile(claim.file, source, ts.ScriptTarget.Latest, true);
      if (parsed.parseDiagnostics.length) throw new Error('source has syntax errors; declaration membership unresolved');
      const candidates = parsed.statements.filter(node => node.name?.text === claim.symbol);
      if (candidates.length !== 1) throw new Error('expected exactly one top-level named declaration; absent, nested or ambiguous source');
      const node = candidates[0]; let members;
      if (claim.kind === 'string-union') {
        if (!ts.isTypeAliasDeclaration(node) || node.typeParameters?.length) throw new Error('expected a nongeneric string-union type declaration');
        let type = node.type; while (ts.isParenthesizedTypeNode(type)) type = type.type;
        const types = ts.isUnionTypeNode(type) ? type.types : [type];
        if (types.some(item => !ts.isLiteralTypeNode(item) || !ts.isStringLiteral(item.literal))) throw new Error('unsupported union: only direct finite string literal members can be confirmed');
        members = types.map(item => item.literal.text);
      } else {
        if (!ts.isEnumDeclaration(node)) throw new Error('expected an enum declaration, not another declaration kind');
        if (node.members.some(item => !ts.isIdentifier(item.name) && !ts.isStringLiteral(item.name))) throw new Error('unsupported enum member name');
        members = node.members.map(item => item.name.text);
      }
      if (!members.length || members.length > 128 || new Set(members).size !== members.length) throw new Error('source members are empty, duplicate or exceed128; author review required');
      const quote = claim.quote.replace(/\r\n?/g, '\n');
      if (node.getText(parsed) !== quote || source.indexOf(quote) !== node.getStart(parsed) || source.indexOf(quote, node.getStart(parsed) + 1) !== -1) throw new Error('stale or ambiguous quote: use the unique complete current named declaration, not a comment, range or neighboring declaration');
      const missing = members.filter(value => !claim.members.includes(value)), extra = claim.members.filter(value => !members.includes(value));
      if (missing.length || extra.length) throw new Error('member mismatch: missing ' + JSON.stringify(missing) + '; extra ' + JSON.stringify(extra));
      resolved.push({ ...claim, bodyLine: index + 1, currentMembers: members, line: parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1 });
    } catch (error) { issues.push({ file: typeof claim?.file === 'string' ? claim.file : undefined, symbol: typeof claim?.symbol === 'string' ? claim.symbol : undefined, bodyLine: index + 1, reason: error.message }); }
  }
  // A conservative migration warning, not an English parser. Even a correct
  // metadata record cannot validate a separate contradictory hand-written list.
  for (const [index, line] of withoutSourceCitationPayload(task.body).split(/\r?\n/).entries()) {
    if (/^[ \t>*-]*(?:EVIDENCE|SNAPSHOT|KNOWN-INVALID)\s*:/i.test(line)) continue;
    if (/\b(?:union|enum)\b/i.test(line) && /\b(?:members?|names?|lists?)\b/i.test(line)
      && [...line.matchAll(/`[^`\n]+`|"[^"\n]+"|'[^'\n]+'/g)].length >= 2) issues.push({ bodyLine: index + 1, reason: 'unverified prose member list: move current union/enum claims into SOURCE-MEMBERS; label only genuinely historical evidence SNAPSHOT' });
  }
  return { declarations, resolved, issues, checked: Math.min(checked, 32) };
}

// WF-G256: English surface names need an author-supplied mapping, not a guess
// from a basename search. Quotes prove current source identity, not that the
// author found every surface or that the implementation is behaviorally correct.
function parseTaskTitleTargets(task) {
  const declarations = [], issues = [], labels = new Set(); let checked = 0;
  for (const [index, line] of String(task.body || '').split(/\r?\n/).entries()) {
    const marker = TITLE_TARGET_MARKER.exec(line); if (!marker) continue;
    if (++checked > 64) { issues.push({ bodyLine: index + 1, reason: 'more than 64 title targets; remaining mappings unchecked' }); break; }
    try {
      if (Buffer.byteLength(marker[1], 'utf8') > 8192) throw new Error('title target exceeds 8192 bytes');
      const target = JSON.parse(marker[1]);
      if (!target || typeof target !== 'object' || Array.isArray(target)
        || Object.keys(target).some(key => !['label', 'file', 'quote'].includes(key))) throw new Error('title target needs only label, file and quote');
      if (typeof target.label !== 'string' || target.label.trim() !== target.label || !target.label
        || Buffer.byteLength(target.label, 'utf8') > 256 || /[\x00-\x1f\x7f]/.test(target.label)
        || !String(task.title || '').includes(target.label)) throw new Error('label must be an exact nonempty excerpt of the current title, at most256 bytes');
      if (labels.has(target.label)) throw new Error('duplicate title label; clarify each surface once');
      if (typeof target.file !== 'string' || !/^[A-Za-z0-9_.@-]+(?:\/[A-Za-z0-9_.@-]+)+$/.test(target.file)
        || target.file.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('title target file must be an exact relative repository path');
      if (typeof target.quote !== 'string' || target.quote.trim().length < 4 || Buffer.byteLength(target.quote, 'utf8') > 2048) throw new Error('title target quote needs four nonblank characters and at most2048 bytes');
      labels.add(target.label); declarations.push({ ...target, bodyLine: index + 1 });
    } catch (error) { issues.push({ bodyLine: index + 1, reason: error.message }); }
  }
  return { declarations, issues };
}

/** Validate declared surface identity; never infer an unnamed target or grant it. */
export function inspectTaskTitleTargets(task = {}, options = {}) {
  const parsed = parseTaskTitleTargets(task), resolved = [], issues = [...parsed.issues];
  for (const target of parsed.declarations) {
    const citation = inspectSourceCitations({ body: 'SOURCE-CITATION: ' + JSON.stringify({ file: target.file, quote: target.quote }) }, options);
    if (citation.issues.length) issues.push(...citation.issues.map(item => ({ ...item, label: target.label, bodyLine: target.bodyLine })));
    else resolved.push({ ...target, line: citation.resolved[0].line });
  }
  for (const name of extractBareFileNames(task.title)) {
    if (!resolved.some(target => target.label === name && path.posix.basename(target.file) === name)) {
      issues.push({ reason: 'qualify title filename ' + name + ' with an exact repository path or a current matching TITLE-TARGET; do not guess ownership from a basename' });
    }
  }
  return { declarations: parsed.declarations, resolved, issues };
}

// Packet audits reuse the same physical containment and bounded text safeguards.
export function readCitationSource(repoRoot, file, { limitBytes = 2 * 1024 * 1024 } = {}) {
  // Reverse-consumer inventory may explicitly read larger generated sources.
  // Ordinary citations keep their existing 2 MiB cap; no caller can unbound it.
  if (!Number.isSafeInteger(limitBytes) || limitBytes < 1 || limitBytes > 16 * 1024 * 1024) throw new Error('invalid bounded source read limit');
  const root = fs.realpathSync(repoRoot), target = fs.realpathSync(path.resolve(root, file));
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw new Error('source is outside the repository');
  const handle = fs.openSync(target, 'r');
  try {
    const stat = fs.fstatSync(handle), limit = limitBytes;
    if (!stat.isFile()) throw new Error('citation target is not a regular file');
    if (stat.size > limit) throw new Error('source exceeds the ' + (limit / (1024 * 1024)) + ' MiB read limit');
    // A concurrent append must not turn this bounded source read into an
    // unbounded readFileSync. Read one extra byte to expose incomplete coverage.
    const bytes = Buffer.alloc(Math.min(limit + 1, stat.size + 1)); let size = 0, read = 0;
    do { read = fs.readSync(handle, bytes, size, bytes.length - size, null); size += read; } while (read && size < bytes.length);
    if (size > limit) throw new Error('source exceeds the ' + (limit / (1024 * 1024)) + ' MiB read limit');
    if (size !== stat.size) throw new Error('source changed while being read');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size));
    if (text.includes('\0')) throw new Error('citation target is not text');
    return text;
  } finally { fs.closeSync(handle); }
}

/**
 * WF-G272: bind declared presence/absence to the exact current file. A global
 * hit cannot rescue a wrong file. Literal identifiers in comments or strings
 * still match: this is not a call/definition parser, semantic proof or edit grant.
 * Reuse citation containment and bounded reads; unavailable is never absent.
 */
export function inspectSymbolChecks(task = {}, { repoRoot = REPO_ROOT, readSource = file => readCitationSource(repoRoot, file) } = {}) {
  const declarations = [], resolved = [], issues = [], pairs = new Set(); let checked = 0;
  for (const [index, line] of String(task.body || '').split(/\r?\n/).entries()) {
    const marker = SYMBOL_CHECK_MARKER.exec(line); if (!marker) continue;
    if (++checked > 64) { issues.push({ bodyLine: index + 1, reason: 'more than 64 symbol declarations; remaining premises unchecked' }); break; }
    let claim;
    try {
      if (Buffer.byteLength(marker[2], 'utf8') > 8192) throw new Error('symbol declaration exceeds 8192 bytes');
      claim = JSON.parse(marker[2]);
      const unverified = marker[1].toUpperCase().endsWith('-UNVERIFIED');
      const allowed = unverified ? ['file', 'symbol', 'reason'] : ['file', 'symbol', 'expect'];
      if (!claim || typeof claim !== 'object' || Array.isArray(claim) || Object.keys(claim).some(key => !allowed.includes(key))) throw new Error('symbol check needs only file, symbol and ' + (unverified ? 'reason' : 'expect'));
      if (typeof claim.file !== 'string' || !/^[A-Za-z0-9_.@-]+(?:\/[A-Za-z0-9_.@-]+)+$/.test(claim.file)
        || claim.file.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('file must be an exact relative repository path, not a basename');
      if (typeof claim.symbol !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(claim.symbol)) throw new Error('symbol must be one ASCII identifier of at most128 characters');
      const key = claim.file + '\0' + claim.symbol;
      if (pairs.has(key)) throw new Error('duplicate file/symbol pair; reconcile the premise once');
      pairs.add(key);
      if (unverified) {
        if (typeof claim.reason !== 'string' || !claim.reason.trim() || Buffer.byteLength(claim.reason, 'utf8') > 2048) throw new Error('unverified symbol check needs a reason of at most2048 bytes');
        declarations.push({ ...claim, bodyLine: index + 1 });
        issues.push({ ...claim, bodyLine: index + 1, reason: 'VERIFY: author review required: ' + claim.reason }); continue;
      }
      if (!['present', 'absent'].includes(claim.expect)) throw new Error('expect must be present or absent');
      declarations.push({ ...claim, bodyLine: index + 1 });
      const source = readSource(claim.file);
      if (typeof source !== 'string' || source.includes('\0')) throw new Error('source is unavailable or is not text');
      if (Buffer.byteLength(source, 'utf8') > 2 * 1024 * 1024) throw new Error('source exceeds the 2 MiB read limit');
      const escaped = claim.symbol.replace(/\$/g, '\\$');
      // Unicode continuations prevent a match inside a longer JS identifier.
      const pattern = new RegExp('(?<![\\p{ID_Continue}$\\u200c\\u200d])' + escaped + '(?![\\p{ID_Continue}$\\u200c\\u200d])', 'u');
      const lines = []; let found = false;
      for (const [sourceIndex, sourceLine] of source.split(/\r\n?|\n/).entries()) {
        if (pattern.test(sourceLine)) { found = true; if (lines.length < 16) lines.push(sourceIndex + 1); }
      }
      if (found !== (claim.expect === 'present')) throw new Error('expected ' + claim.expect + ' but literal identifier is ' + (found ? 'present' : 'absent') + ' in this file; re-read and reconcile before dispatch');
      resolved.push({ ...claim, bodyLine: index + 1, lines });
    } catch (error) { issues.push({ file: typeof claim?.file === 'string' ? claim.file : undefined, symbol: typeof claim?.symbol === 'string' ? claim.symbol : undefined, bodyLine: index + 1, reason: error.message }); }
  }
  return { declarations, resolved, issues, checked: Math.min(checked, 64) };
}

// WF-G307 reviews one uniquely bounded block, not a moving historical line range.
// The parent supplies the affected symbols and preservation assessment. No
// lexical inventory can certify semantic completeness or authorize replacement.
function normalizeSourceReview(value, recorded = false, now = Date.now()) {
  const fields = ['id', 'file', 'start', 'end', 'symbols', 'reason', 'supersedes', ...(recorded ? ['sha256', 'observedAt'] : [])];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) throw new Error('source review has unsupported fields');
  const key = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id);
  if (!key(value.id) || (value.supersedes !== undefined && (!key(value.supersedes) || value.supersedes === value.id))) throw new Error('review ids must be distinct stable keys of at most64 characters');
  if (typeof value.file !== 'string' || !/^[A-Za-z0-9_.@-]+(?:\/[A-Za-z0-9_.@-]+)+$/.test(value.file)
    || value.file.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('review file must be an exact relative repository path');
  for (const name of ['start', 'end']) if (typeof value[name] !== 'string' || value[name].trim().length < 4 || Buffer.byteLength(value[name], 'utf8') > 512 || value[name].includes('\0')) throw new Error(name + ' boundary needs four nonblank characters and at most512 bytes');
  if (value.start === value.end) throw new Error('start and end boundaries must differ');
  if (!Array.isArray(value.symbols) || !value.symbols.length || value.symbols.length > 64 || new Set(value.symbols).size !== value.symbols.length
    || value.symbols.some(symbol => typeof symbol !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(symbol))) throw new Error('symbols needs one to64 distinct ASCII identifiers of at most128 characters');
  if (typeof value.reason !== 'string' || !value.reason.trim() || Buffer.byteLength(value.reason, 'utf8') > 2048 || /\b(?:TBD|TODO)\b/i.test(value.reason)) throw new Error('reason needs a concrete preservation assessment of at most2048 bytes');
  if (recorded && (!/^[a-f0-9]{64}$/.test(value.sha256) || typeof value.observedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.observedAt) || !Number.isFinite(Date.parse(value.observedAt))
    || new Date(value.observedAt).toISOString() !== value.observedAt || Date.parse(value.observedAt) > now)) throw new Error('review needs a SHA-256 digest and a real nonfuture UTC observedAt');
  return { ...value, symbols: [...value.symbols] };
}

function sourceReviewBlock(review, readSource) {
  const source = readSource(review.file);
  if (typeof source !== 'string' || source.includes('\0')) throw new Error('review source is unavailable or is not text');
  if (Buffer.byteLength(source, 'utf8') > 2 * 1024 * 1024) throw new Error('review source exceeds the 2 MiB read limit');
  const start = source.indexOf(review.start), end = source.indexOf(review.end);
  if (start < 0 || end < 0 || source.indexOf(review.start, start + 1) >= 0 || source.indexOf(review.end, end + 1) >= 0) throw new Error('missing or ambiguous review boundaries; re-anchor the intended block');
  if (end < start + review.start.length) throw new Error('review boundaries overlap or are reversed');
  const block = source.slice(start, end + review.end.length);
  if (Buffer.byteLength(block, 'utf8') > 64 * 1024) throw new Error('review block exceeds the 64 KiB limit');
  const checked = inspectSymbolChecks({ body: review.symbols.map(symbol => 'SYMBOL-CHECK: ' + JSON.stringify({ file: review.file, symbol, expect: 'present' })).join('\n') }, { readSource: () => block });
  if (checked.issues.length) throw new Error('reviewed symbol is not in this block: ' + checked.issues.map(issue => issue.symbol).join(', '));
  return { sha256: createHash('sha256').update(block, 'utf8').digest('hex'), line: source.slice(0, start).split(/\r\n?|\n/).length };
}

/** Capture reviewed current text, never accept a caller-supplied baseline hash. */
export function captureSourceReview(input, { repoRoot = REPO_ROOT, readSource = file => readCitationSource(repoRoot, file), now = Date.now() } = {}) {
  const review = normalizeSourceReview(input);
  const result = { ...review, ...sourceReviewBlock(review, readSource), observedAt: new Date(now).toISOString() };
  delete result.line;
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 8192) throw new Error('source review exceeds 8192 bytes');
  return result;
}

/** Explicit supersession retains every old receipt; it never refreshes silently. */
export function inspectSourceReviews(task = {}, { repoRoot = REPO_ROOT, readSource = file => readCitationSource(repoRoot, file), now = Date.now() } = {}) {
  const declarations = [], issues = [], resolved = [], latest = new Map(), ids = new Set(); let checked = 0;
  for (const [index, line] of String(task.body || '').split(/\r?\n/).entries()) {
    const marker = SOURCE_REVIEW_MARKER.exec(line); if (!marker) continue;
    if (++checked > 32) { issues.push({ bodyLine: index + 1, reason: 'more than 32 source review declarations; remaining reviews unchecked' }); break; }
    try {
      if (Buffer.byteLength(marker[1], 'utf8') > 8192) throw new Error('source review exceeds 8192 bytes');
      const review = normalizeSourceReview(JSON.parse(marker[1]), true, now);
      if (ids.has(review.id)) throw new Error('duplicate source review id');
      ids.add(review.id);
      const key = JSON.stringify([review.file, review.start, review.end]), previous = latest.get(key);
      if (previous ? review.supersedes !== previous.id || Date.parse(review.observedAt) < Date.parse(previous.observedAt) : review.supersedes !== undefined) throw new Error('review must explicitly supersede the latest review of this exact block with a nondecreasing timestamp');
      const declaration = { ...review, bodyLine: index + 1 }; declarations.push(declaration); latest.set(key, declaration);
    } catch (error) { issues.push({ bodyLine: index + 1, reason: error.message }); }
  }
  const active = [...latest.values()], checkedAt = new Date(now).toISOString();
  for (const review of active) {
    try {
      const current = sourceReviewBlock(review, readSource);
      if (current.sha256 !== review.sha256) throw new Error('replacement block changed since ' + review.observedAt + '; reconcile sibling additions and append a new reviewed receipt before dispatch');
      resolved.push({ ...review, line: current.line, checkedAt });
    } catch (error) { issues.push({ file: review.file, id: review.id, bodyLine: review.bodyLine, reason: error.message }); }
  }
  // Conservative legacy intake: exact file:line-range replacement instructions
  // need an anchored review. Other English claims still require author review.
  for (const [index, line] of withoutSourceCitationPayload([task.title || '', task.body || ''].join('\n')).split(/\r?\n/).entries()) {
    if (/^[ \t>*-]*(?:EVIDENCE|HISTORY|SNAPSHOT|KNOWN-INVALID|REFERENCE-ONLY|VERIFIED)\s*:/i.test(line) || !/\b(?:replace|rewrite|remove|delete)\b/i.test(line)) continue;
    for (const match of line.matchAll(/\b((?:src|tools|scripts|docs|public)\/[A-Za-z0-9_./@-]+\.[A-Za-z0-9]{1,8}):\d+-\d+/g)) if (!active.some(review => review.file === match[1])) issues.push({ bodyLine: index, file: match[1], reason: 'line-range replacement needs a uniquely bounded SOURCE-REVIEW; a historical line number is not preservation evidence' });
  }
  return { declarations, active, resolved, issues, checkedAt };
}

/** Resolve literal evidence against current bytes; line hints never select a match. */
export function inspectSourceCitations(task = {}, { repoRoot = REPO_ROOT, readSource = file => readCitationSource(repoRoot, file) } = {}) {
  const resolved = [], issues = [], declarations = [];
  const lines = String(task.body || '').split(/\r?\n/);
  let checked = 0;
  for (const [index, line] of lines.entries()) {
    const marker = SOURCE_CITATION_MARKER.exec(line); if (!marker) continue;
    if (++checked > 64) { issues.push({ bodyLine: index + 1, reason: 'more than 64 citation declarations; remaining evidence unchecked' }); break; }
    let citation;
    try {
      if (Buffer.byteLength(marker[2], 'utf8') > 8192) throw new Error('citation declaration exceeds 8192 bytes');
      citation = JSON.parse(marker[2]);
      if (!citation || typeof citation !== 'object' || Array.isArray(citation)) throw new Error('citation must be a JSON object');
      const allowed = marker[1].toUpperCase().endsWith('-UNVERIFIED') ? ['file', 'findingId', 'reason'] : ['file', 'quote', 'observedLine', 'findingId'];
      if (Object.keys(citation).some(key => !allowed.includes(key))) throw new Error('unsupported citation field');
      if (typeof citation.file !== 'string' || !/^[A-Za-z0-9_.@-]+(?:\/[A-Za-z0-9_.@-]+)+$/.test(citation.file)
        || citation.file.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('file must be an exact relative repository path');
      if (citation.findingId !== undefined && (typeof citation.findingId !== 'string' || !citation.findingId.trim())) throw new Error('findingId must be a nonempty string');
      if (marker[1].toUpperCase().endsWith('-UNVERIFIED')) {
        if (typeof citation.reason !== 'string' || !citation.reason.trim()) throw new Error('unverified citation needs a reason');
        declarations.push(citation); issues.push({ ...citation, bodyLine: index + 1, reason: 'author review required: ' + citation.reason }); continue;
      }
      if (typeof citation.quote !== 'string' || citation.quote.trim().length < 4 || Buffer.byteLength(citation.quote, 'utf8') > 2048)
        throw new Error('quote needs at least four nonblank characters and at most 2048 bytes');
      if (citation.observedLine !== undefined && (!Number.isSafeInteger(citation.observedLine) || citation.observedLine < 1)) throw new Error('observedLine must be a positive integer hint');
      declarations.push(citation);
      const source = String(readSource(citation.file)).replace(/\r\n?/g, '\n'), quote = citation.quote.replace(/\r\n?/g, '\n');
      const first = source.indexOf(quote), second = first < 0 ? -1 : source.indexOf(quote, first + 1);
      if (first < 0) throw new Error('quoted source is missing; re-read the current file');
      if (second >= 0) throw new Error('quoted source is ambiguous; choose a longer unique quote');
      resolved.push({ ...citation, bodyLine: index + 1, line: source.slice(0, first).split('\n').length });
    } catch (error) { issues.push({ file: typeof citation?.file === 'string' ? citation.file : undefined, bodyLine: index + 1, reason: error.message }); }
  }
  return { resolved, issues, declarations, checked: Math.min(checked, 64) };
}

// Old file:line prose stays visible as a review warning. Do not pretend a line
// number proves which code the author meant or rewrite historical evidence.
function unanchoredSourceLines(task, citations) {
  const anchored = new Set(citations.resolved.map(item => item.file)), warnings = [];
  for (const [index, line] of [task.title || '', ...String(task.body || '').split(/\r?\n/)].entries()) {
    if (SOURCE_CITATION_MARKER.test(line) || /^[ \t>*-]*(?:EVIDENCE|SNAPSHOT|KNOWN-INVALID)\s*:/i.test(line)) continue;
    for (const match of line.matchAll(/\b((?:src|tools|scripts|docs|public)\/[A-Za-z0-9_./@-]+\.[A-Za-z0-9]{1,8}):(\d+)(?::\d+)?/g)) {
      if (!anchored.has(match[1])) warnings.push({ file: match[1], observedLine: Number(match[2]), bodyLine: index });
    }
  }
  return warnings;
}

export function lintTask(task = {}, {
  repoRoot = REPO_ROOT,
  boardTasks,
  completeBoard = true,
  fileExists = (rel) => defaultExists(repoRoot, rel),
  ignoredPaths = (paths) => defaultIgnoredPaths(repoRoot, paths),
  grepSrc = (name) => defaultGrepSrc(repoRoot, name),
  basenameExists = (name) => defaultBasenameExists(repoRoot, name),
  findSplitCandidates = (p) => defaultFindSplitCandidates(repoRoot, p),
  grepTypes = (name) => defaultGrepTypes(repoRoot, name),
  checkFileFields = (p, fields) => defaultCheckFileFields(repoRoot, p, fields),
  planmapSchema = () => readPlanmapSchema(repoRoot),
} = {}) {
  const refs = Array.isArray(task.refs) ? task.refs : [];
  const bodyText = withoutSourceRecordPayload(withoutDataValuePayload(withoutSourceCitationPayload(task.body)));
  const text = [task.title || '', bodyText, ...refs].join('\n');
  const sourceCitations = inspectSourceCitations(task, { repoRoot });
  const symbolChecks = inspectSymbolChecks(task, { repoRoot });
  const sourceReviews = inspectSourceReviews(task, { repoRoot });
  const sourceMembers = inspectSourceMembers(task, { repoRoot });
  const dataValues = inspectDataValueClaims(task, { repoRoot });
  const sourceRecords = inspectRecordSourceClaims(task, { repoRoot });
  const valueEquivalence = inspectValueEquivalence(task);
  const runtimeLimitations = inspectRuntimeLimitations(task, {repoRoot});
  const paths = [...new Set([...extractPathTokens(text), ...sourceCitations.declarations.map(item => item.file), ...symbolChecks.declarations.map(item => item.file), ...sourceReviews.declarations.map(item => item.file), ...sourceMembers.declarations.map(item => item.file), ...dataValues.declarations.flatMap(item=>[item.file,...(item.origin.kind==='existing'?[item.origin.file]:[])])])];
  const unanchoredCitations = unanchoredSourceLines(task, sourceCitations);
  const identifiers = extractBacktickedIdentifiers(text);
  const fileNames = extractBareFileNames(text);
  const statusClaims = extractPlanmapStatusClaims({ ...task, body: bodyText });
  const countSourceCheck = inspectCountSources([task.title || '', bodyText].join('\n'));
  // The count-source command is a declaration, not a fresh measurement. A full
  // board context adds independent completion-overlap evidence without running it.
  const referenceFreshness = boardTasks === undefined ? null : taskReferenceFreshness(boardTasks, {repoRoot, complete:completeBoard}).get(task.id)
    || (['open','claimed','in_progress','blocked'].includes(task.state)
      ? {status:'unavailable',reason:'Target absent from complete board snapshot.',completions:[]} : null);
  const dedupAcceptance = inspectDedupAcceptance([task.title || '', task.body || ''].join('\n'));
  const pendingDiscoveries = extractPendingDiscoveries([task.title || '', bodyText].join('\n'));
  const invalidPlanmapStatuses = [];
  // Read the authoritative vocabulary only when an assignment was found. Do
  // not silently fall back to a stale list if the schema is absent or malformed.
  if (statusClaims.length) {
    const schema = planmapSchema();
    const topic = schema.properties?.topics?.items?.properties;
    for (const claim of statusClaims) {
      const allowed = (claim.kind === 'feature' ? topic?.features?.items?.properties : topic)?.status?.enum;
      if (!Array.isArray(allowed) || !allowed.length || allowed.some(value => typeof value !== 'string')) {
        throw new Error('Plan Map ' + claim.kind + ' status enum is missing or invalid');
      }
      if (!allowed.includes(claim.status)) invalidPlanmapStatuses.push({ ...claim, allowed: [...allowed] });
    }
  }

  // WF-G191 / WF-G193: the body may DECLARE what it creates and what it
  // asserts is absent. Those declarations change how a path is judged, so they
  // are read before the existence check, not bolted on after it.
  const declaredCreates = extractDeclaredCreates(text);
  const declaredAbsent = extractDeclaredAbsent(text);
  const declared = new Set([...declaredCreates, ...declaredAbsent]);

  const missingPaths = paths.filter((p) => !declared.has(p) && !fileExists(p));
  const presentPaths = paths.filter((p) => fileExists(p));
  // A declared CREATES path that is MISSING is correct — the task creates it.
  // A declared CREATES path that already EXISTS is a stale claim: acting on it
  // would overwrite a file that has already landed.
  const newPaths = declaredCreates.filter((p) => !fileExists(p));
  const staleCreates = declaredCreates.filter((p) => fileExists(p));
  // An EXPECTED-ABSENT path that EXISTS breaks the assertion the body makes.
  const presentDespiteAbsent = declaredAbsent.filter((p) => fileExists(p));
  // Only paths that EXIST can be gitignored; a missing path is missing whatever
  // the ignore rules say.
  const ignored = [...ignoredPaths(presentPaths)];
  const missingIdentifiers = identifiers.filter((name) => !grepSrc(name));
  // A bare file name that belongs to a declared path is covered by that
  // declaration (WF-G193 reported exactly this double report).
  const declaredBaseNames = new Set([...declared].map((p) => p.split('/').pop()));
  const missingFileNames = fileNames.filter((name) => !declaredBaseNames.has(name) && !basenameExists(name));

  // WF-G167: Missing test paths with split file candidate detection
  const missingTestPaths = missingPaths
    .filter((p) => !declared.has(p))
    .filter(isTestPath)
    .map((p) => ({
      path: p,
      splitCandidates: findSplitCandidates(p),
    }));

  // WF-G165: Claims that a schema is missing when it already exists under src/types/**
  const schemaClaims = extractSchemaClaims(text);
  const suspectSchemaClaims = [];
  for (const c of schemaClaims) {
    const hits = grepTypes(c.typeName);
    if (hits && hits.length > 0) {
      suspectSchemaClaims.push({
        ...c,
        existingLocations: hits,
      });
    }
  }

  // WF-G161: DO step claims fields exist in a type file where they do not
  const typeFieldClaims = extractTypeFieldClaims(text);
  const unresolvedTypeFields = [];
  for (const c of typeFieldClaims) {
    if (fileExists(c.file)) {
      const missing = checkFileFields(c.file, c.fields);
      if (missing && missing.length > 0) {
        unresolvedTypeFields.push({
          file: c.file,
          missingFields: missing,
          claim: c.raw,
        });
      }
    }
  }

  return {
    taskId: task.id || '',
    checkedPaths: paths,
    checkedIdentifiers: identifiers,
    checkedFileNames: fileNames,
    missingPaths,
    ignoredPaths: ignored,
    missingIdentifiers,
    missingFileNames,
    missingTestPaths,
    suspectSchemaClaims,
    unresolvedTypeFields,
    invalidPlanmapStatuses,
    countSourceCheck,
    referenceFreshness,
    dedupAcceptance,
    pendingDiscoveries,
    sourceCitations,
    symbolChecks,
    sourceReviews,
    sourceMembers,
    dataValues,
    sourceRecords,
    valueEquivalence,
    runtimeLimitations,
    unanchoredCitations,
    declaredCreates,
    declaredAbsent,
    newPaths,
    staleCreates,
    presentDespiteAbsent,
    clean: missingPaths.length === 0 &&
      !['unverified','unavailable'].includes(referenceFreshness?.status) &&
      missingIdentifiers.length === 0 &&
      missingFileNames.length === 0 &&
      missingTestPaths.length === 0 &&
      suspectSchemaClaims.length === 0 &&
      unresolvedTypeFields.length === 0 &&
      invalidPlanmapStatuses.length === 0 &&
      sourceCitations.issues.length === 0 &&
      symbolChecks.issues.length === 0 &&
      sourceReviews.issues.length === 0 &&
      sourceMembers.issues.length === 0 &&
      dataValues.issues.length === 0 &&
      sourceRecords.issues.length === 0 &&
      valueEquivalence.issues.length === 0 &&
      runtimeLimitations.issues.length === 0 &&
      dedupAcceptance.issues.length === 0 &&
      !countSourceCheck.missingSources && countSourceCheck.invalidSources.length === 0 &&
      pendingDiscoveries.length === 0 &&
      staleCreates.length === 0 &&
      presentDespiteAbsent.length === 0,
  };
}

/** Human-readable report lines for a lint result. */
export function formatLintReport(result) {
  const lines = [];
  if(result.runtimeLimitations?.declarations.length||result.runtimeLimitations?.issues.length){
    lines.push('RUNTIME LIMITATION (WF-G264): executed-run citations, not source-comment or semantic proof.');
    for(const item of result.runtimeLimitations.declarations)lines.push('  '+item.claim+': '+item.state+'; '+item.file+'#'+item.entry+'; '+(item.state==='unverified'?'INVESTIGATION ONLY: '+item.reason:item.testFile+' / '+item.testName+'; '+item.observation));
    for(const item of result.runtimeLimitations.issues)lines.push('  UNRESOLVED body line '+item.bodyLine+': '+item.reason);
    lines.push('  Review the actual entry call and failing assertion; no declared command runs and no ownership is granted.');
  }
  if(result.valueEquivalence?.declarations.length||result.valueEquivalence?.issues.length){
    lines.push('VALUE COMPARISON (WF-G276): declared receipts are not semantic equality or deletion permission.');
    for(const item of result.valueEquivalence.declarations)lines.push('  '+item.claim+': '+item.state+'; '+item.left+' versus '+item.right+'; '+(item.state==='unverified'?'PROBE BEFORE DELETING: '+item.reason:'reported probe '+item.probe+'; evidence '+item.evidence));
    for(const item of result.valueEquivalence.issues)lines.push('  UNRESOLVED body line '+item.bodyLine+': '+item.reason);
    lines.push('  Re-read both current values under authorized locks; no declared probe is executed automatically.');
  }
  lines.push(`task lint ${result.taskId || '(unsaved)'} — ${result.checkedPaths.length} path(s), ${result.checkedIdentifiers.length} identifier(s) checked`);
  for (const line of formatReferenceFreshness(result.referenceFreshness)) lines.push('  ' + line);
  if(result.sourceRecords?.declarations.length||result.sourceRecords?.issues.length){
    lines.push('  SOURCE RECORD IDENTITY (WF-G294): same-read record/source/address binding; not reachability or edit permission.');
    for(const item of result.sourceRecords.resolved)lines.push('    '+item.recordId+' / '+item.sourceId+' '+item.addressField+' '+item.url+' ('+item.path+')');
    for(const issue of result.sourceRecords.issues)lines.push('    UNRESOLVED body line '+issue.bodyLine+': '+issue.reason);
  }
  if(result.dataValues?.declarations.length||result.dataValues?.issues.length){
    lines.push('  DATA VALUE PROVENANCE (WF-G267): current sibling literal or explicit new value; not semantic canon or edit permission.');
    for(const record of result.dataValues.resolved)lines.push('    '+record.file+' '+JSON.stringify(record.field)+': '+JSON.stringify(record.value)+'; '+record.origin.kind+'; '+record.origin.reason);
    for(const issue of result.dataValues.issues)lines.push('    UNRESOLVED body line '+issue.bodyLine+': '+issue.reason);
  }
  if (result.sourceMembers?.declarations.length || result.sourceMembers?.issues.length) {
    lines.push('  SOURCE MEMBERS (WF-G283): exact current finite string unions or enum member names; not enum values, behavioral proof or edit permission.');
    for (const item of result.sourceMembers.resolved) lines.push('    ' + item.file + ':' + item.line + ' ' + item.symbol + ': ' + JSON.stringify(item.currentMembers));
    for (const item of result.sourceMembers.issues) lines.push('    UNRESOLVED body line ' + item.bodyLine + ' ' + (item.file || '') + ' ' + (item.symbol || '') + ': ' + item.reason);
    if (result.sourceMembers.issues.length) lines.push('    Re-read and reconcile with the author before dispatch; no source or task was rewritten.');
  }
  if (result.sourceReviews?.active.length || result.sourceReviews?.issues.length) {
    lines.push('  SIBLING PRESERVATION (WF-G307): current literal block review, not semantic completeness or edit permission.');
    for (const item of result.sourceReviews.resolved) lines.push('    ' + item.file + ':' + item.line + ' review ' + item.id + '; observed ' + item.observedAt + ', rechecked ' + item.checkedAt + '; parent-reviewed symbols ' + item.symbols.join(', '));
    for (const item of result.sourceReviews.issues) lines.push('    UNRESOLVED ' + (item.file || '') + ': ' + item.reason);
  }
  if (result.symbolChecks?.declarations.length || result.symbolChecks?.issues.length) {
    lines.push('  FILE/SYMBOL PREMISES (WF-G272): exact-file literal identifiers, not semantic call-site proof or edit permission.');
    for (const item of result.symbolChecks.resolved) lines.push('    ' + item.file + ': ' + item.symbol + ' expected ' + item.expect + '; ' + (item.lines.length ? 'matching lines ' + item.lines.join(', ') + ' (at most16 shown)' : 'no literal match'));
    for (const item of result.symbolChecks.issues) lines.push('    UNRESOLVED body line ' + item.bodyLine + ' ' + (item.file || '') + ' ' + (item.symbol || '') + ': ' + item.reason);
    if (result.symbolChecks.issues.length) lines.push('    VERIFY and stale premises require author reconciliation before dispatch; no source or task was rewritten.');
  }
  if (result.dedupAcceptance?.contracts.length || result.dedupAcceptance?.issues.length) {
    lines.push('  DEDUP ACCEPTANCE (WF-G325): require DEDUP-ACCEPTANCE roles, not a surviving duplicate or unlabeled hit count.');
    for (const contract of result.dedupAcceptance.contracts) lines.push('    ' + contract.canonical + ': exactly one; ' + contract.obsolete + ': zero; consumers ' + contract.consumers.join(', ') + '; verification declared, not executed.');
    for (const issue of result.dedupAcceptance.issues) lines.push('    UNRESOLVED ' + (issue.line ? 'line ' + issue.line + ': ' : '') + issue.reason);
  }
  if (result.sourceCitations?.resolved.length || result.sourceCitations?.issues.length) {
    lines.push('  SOURCE CITATIONS (WF-G211): literal evidence re-read now, not semantic proof or edit permission.');
    for (const item of result.sourceCitations.resolved) lines.push(`    ${item.file}:${item.line} current quote match; observed line ${item.observedLine ?? 'not recorded'} is only a snapshot hint.`);
    for (const item of result.sourceCitations.issues) lines.push(`    UNRESOLVED body line ${item.bodyLine} ${item.file || ''}: ${item.reason}`);
    if (result.sourceCitations.issues.length) lines.push('    Re-read and reconcile the task before dispatch; no task or source was rewritten.');
  }
  if (result.unanchoredCitations?.length) {
    lines.push('  LINE-ONLY CITATION REVIEW (WF-G211): legacy line numbers are not stable source identity.');
    for (const item of result.unanchoredCitations) lines.push(`    ${item.file}:${item.observedLine}: author/worker must locate current intended code and record a unique SOURCE-CITATION quote.`);
  }
  if (result.missingPaths.length) {
    lines.push(`  MISSING PATHS (${result.missingPaths.length}) — not in this checkout:`);
    for (const p of result.missingPaths) lines.push(`    ${p}`);
  }
  if (result.pendingDiscoveries?.length) {
    lines.push('  UNRESOLVED DISCOVERY (WF-G333): resolve implementation targets before dispatch.');
    for (const item of result.pendingDiscoveries) lines.push(`    line ${item.line}: ${item.claim}`);
    lines.push('    Author: run the scoped read-only source audit, name existing files or record absence and your explicit new-file placement decision. Worker: ask the orchestrator; do not invent a surface or lock scope. No location was chosen or ownership granted here.');
  }
  if ((result.invalidPlanmapStatuses || []).length) {
    lines.push('  INVALID PLAN MAP STATUS ASSIGNMENTS (WF-G288):');
    for (const item of result.invalidPlanmapStatuses) {
      lines.push(`    line ${item.line}: ${item.kind} status ${JSON.stringify(item.status)}; allowed: ${item.allowed.join(', ')}`);
    }
    lines.push('    Keep the current roadmap status when work is blocked; explain the blocker in status_note and the linked Agora task. No record was rewritten.');
  }
  if (result.countSourceCheck?.missingSources || result.countSourceCheck?.invalidSources.length) {
    lines.push('  COUNT PREMISE NEEDS MEASUREMENT (WF-G343): add a real COUNT-SOURCE: <read-only command>.');
    for (const item of result.countSourceCheck.claims) lines.push(`    line ${item.line}: ${item.claim}`);
    for (const item of result.countSourceCheck.invalidSources) lines.push(`    line ${item.line}: empty, placeholder or literal-output source ${JSON.stringify(item.command)}`);
    lines.push('    Frozen corpus counts are not current authority. Label dated historical evidence SNAPSHOT: instead of prescribing it.');
  }
  if (result.countSourceCheck?.sources.length) {
    lines.push('  COUNT SOURCES declared, not executed: run only authorized read-only measurements; post timestamp, command and current counts in the task result before acting.');
    for (const item of result.countSourceCheck.sources) lines.push(`    ${item.command}`);
  }
  if ((result.missingTestPaths || []).length) {
    lines.push(`  MISSING TEST PATHS (${result.missingTestPaths.length}) (WF-G167) — vitest treats unmatched paths as empty filters and exits 0!:`);
    for (const item of result.missingTestPaths) {
      if (item.splitCandidates && item.splitCandidates.length) {
        lines.push(`    ${item.path} -> split test suites found: ${item.splitCandidates.join(', ')}`);
      } else {
        lines.push(`    ${item.path}`);
      }
    }
  }
  if (result.missingIdentifiers.length) {
    lines.push(`  UNGREPPABLE IDENTIFIERS (${result.missingIdentifiers.length}) — no hit under src/:`);
    for (const n of result.missingIdentifiers) lines.push(`    ${n}`);
  }
  if ((result.missingFileNames || []).length) {
    lines.push(`  MISSING FILE NAMES (${result.missingFileNames.length}) — no file with this name anywhere in the repo (WF-G158):`);
    for (const n of result.missingFileNames) lines.push(`    ${n}`);
  }
  if ((result.suspectSchemaClaims || []).length) {
    lines.push(`  SUSPECT SCHEMA CLAIMS (${result.suspectSchemaClaims.length}) (WF-G165) — task claims schema is missing, but type exists under src/types/:`);
    for (const item of result.suspectSchemaClaims) {
      lines.push(`    "${item.claim}" -> found in: ${item.existingLocations.join(', ')}`);
    }
    lines.push(`    Rule: grep src/types/** before prescribing new schemas to prevent duplicate types.`);
  }
  if ((result.unresolvedTypeFields || []).length) {
    lines.push(`  UNRESOLVED TYPE FIELDS (${result.unresolvedTypeFields.length}) (WF-G161) — named fields not found in target file:`);
    for (const item of result.unresolvedTypeFields) {
      lines.push(`    ${item.file}: missing [${item.missingFields.join(', ')}]`);
    }
    lines.push(`    Rule: grep target file before prescribing field sources; if unresolved, record in EVIDENCE as 'source unresolved'.`);
  }
  // WF-G191: a declared CREATES path that already exists is a STALE claim.
  if ((result.staleCreates || []).length) {
    lines.push(`  STALE CREATES (${result.staleCreates.length}) (WF-G191) — the body says the task creates these, but they already exist:`);
    for (const p of result.staleCreates) lines.push(`    ${p}`);
    lines.push('    Read the file first: this task would overwrite work that has already landed.');
  }
  // WF-G193: an EXPECTED-ABSENT path that exists breaks the body's assertion.
  if ((result.presentDespiteAbsent || []).length) {
    lines.push(`  PRESENT DESPITE EXPECTED-ABSENT (${result.presentDespiteAbsent.length}) (WF-G193) — the body asserts these do not exist, but they do:`);
    for (const p of result.presentDespiteAbsent) lines.push(`    ${p}`);
    lines.push('    The premise of this task has changed. Re-read the paths before you act.');
  }
  if (result.ignoredPaths.length) {
    lines.push(`  note: ${result.ignoredPaths.length} named path(s) exist but are GITIGNORED (a reader grepping the index will not find them):`);
    for (const p of result.ignoredPaths) lines.push(`    ${p}`);
  }
  // A NOTE, never a defect: these are the paths the task exists to create or
  // to prove absent, and the body says so.
  if ((result.newPaths || []).length) {
    lines.push(`  NEW PATHS (${result.newPaths.length}) (WF-G191) — declared with a CREATES: line; this task creates them:`);
    for (const p of result.newPaths) lines.push(`    ${p}`);
  }
  if ((result.declaredAbsent || []).length) {
    const clear = result.declaredAbsent.filter((p) => !(result.presentDespiteAbsent || []).includes(p));
    if (clear.length) {
      lines.push(`  EXPECTED ABSENT (${clear.length}) (WF-G193) — declared with an EXPECTED-ABSENT: line, and confirmed absent:`);
      for (const p of clear) lines.push(`    ${p}`);
    }
  }
  if (result.clean) {
    lines.push('  clean: every named path exists or is declared, and every backticked identifier greps in src/.');
  } else {
    lines.push('  A body may legitimately name a path the task CREATES or asserts is ABSENT.');
    lines.push('  Fix the stale ones, and declare the rest on their own body line:');
    lines.push('    CREATES: <path>            the task creates this file (reported as a NEW PATH, not a defect)');
    lines.push('    EXPECTED-ABSENT: <path>    the task asserts this file is gone (lint FAILS if it comes back)');
  }
  return lines;
}
