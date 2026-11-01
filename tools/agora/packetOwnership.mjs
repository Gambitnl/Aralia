// Compare owned files with task refs, title and body obligations before dispatch.
// No path is silently granted: mismatches need wider ownership or a named handoff.
// Reference-only/absence assertions use the task linter's shared declaration rules.
// Data prescriptions also check existing raw values; semantic necessity stays reviewed.
// Declared leaf/mount links need current import evidence and delivery ownership.
// Imported type contracts expose advisory owners, never implicit edit grants.
// Action delivery audits add reviewed wiring edits to existing ownership gates.
// Production wiring also needs its reviewed state caller or a dependent task.
import { extractTaskOwnershipPaths, extractPendingDiscoveries, inspectTaskTitleTargets, inspectDedupAcceptance, inspectSymbolChecks, inspectSourceReviews, inspectSourceMembers, inspectValueEquivalence, inspectRuntimeLimitations } from './taskLint.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { globIterateSync, hasMagic } from 'glob';
import { lockOverlap } from './store.mjs';
import { createForwarderResolver } from './forwarderOwnership.mjs';
import { inspectPacketMounts } from './mountOwnership.mjs';
import { inspectSharedTypeDependencies } from './sharedTypeOwnership.mjs';
import { inspectPacketActionWiring, assertTaskActionWiring } from './actionWiring.mjs';
import { validatePacketUnions, inspectUnionConsumers, assertTaskUnions } from './unionConsumerOwnership.mjs';
import { inspectProductionCallers, assertTaskProductionCallers } from './productionCallerOwnership.mjs';
import { inspectPacketDataValues, assertTaskDataValues } from './dataValueProvenance.mjs';
import {inspectPacketSourceRecords,assertTaskSourceRecords} from './recordSourceProvenance.mjs';
import {inspectPacketSourceRewrites,assertTaskSourceRewrites} from './sourceRewritePreflight.mjs';
import {validateVisualPacket,inspectVisualHandoff} from './visualAcceptance.mjs';

const TASK_ID = /^agora-[a-z0-9]+(?:\.[0-9]+)*$/i;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ============================================================================
// Cross-File Symbol, Adapter, State-Slice & Inline-Union Resolution
// (WF-G248, WF-G261, WF-G262, WF-G270, WF-G273)
// ============================================================================
// Why this exists:
//   Workers were repeatedly handed packets that owned only half of a task's
//   required edit chain:
//   - WF-G248: an adapter file (`src/data/adapters/5eTools/spellcastingAdapter.ts`)
//     for a runtime slot-tracking task without its `MonsterData` type home
//     (`src/types/ui.ts`) or runtime consumer (`src/utils/combat/createEnemyFromMonster.ts`).
//   - WF-G261: a wave-sequenced packet placed behind earlier packets because of
//     hot files (`combatUtils.ts`, `useActionExecutor.ts`, `physicsUtils.ts`)
//     without putting those hot files in the packet's owned list.
//   - WF-G262: a state-slice / save-state reducer packet (`src/state/**`) that
//     omits `src/types/state.ts` (and `src/state/initialState.ts` when required).
//   - WF-G270: a task body directing "add X in A AND read/persist/merge it in B"
//     where `B` is a symbol (`applySpeechProfile`, `performLevelUp`) whose
//     defining file is omitted from `packet.files`.
//   - WF-G273: a task widening an inline callback/property union (`requestReaction`
//     `triggerType: 'on_hit' | 'on_take_damage'`) whose declaration sites live
//     one import away in unowned files.
//
// How it works:
//   Lazily builds a lightweight export/import index of `src/` once per process
//   when any of those patterns appear in active packet/task prose, and feeds
//   the resolved file paths into `analyzePacketOwnership`'s `addRef` pipeline
//   so the packet must either own the file or declare an explicit `handoff`.
// ============================================================================

let cachedSrcIndex = null;

function getSrcSymbolAndConsumerIndex(repoRoot = REPO_ROOT) {
  if (cachedSrcIndex && cachedSrcIndex.repoRoot === repoRoot) {
    return cachedSrcIndex;
  }
  const symbolToFile = new Map();
  const importersByTarget = new Map();
  const inlineTriggerUnionFiles = [];
  const root = path.join(repoRoot, 'src');

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !/\.[cm]?[jt]sx?$/i.test(entry.name)) continue;
      if (/\.(?:test|spec|d)\.[cm]?[jt]sx?$/i.test(entry.name)) continue;
      const rel = path.relative(repoRoot, fullPath).replace(/\\/g, '/');
      let text;
      try {
        text = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }
      // Index exported symbols (preferring non-barrel modules over index.ts).
      const isBarrel = /^index\.[cm]?[jt]sx?$/i.test(entry.name);
      for (const match of text.matchAll(/\bexport\s+(?:async\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)) {
        const sym = match[1];
        if (!symbolToFile.has(sym) || (!isBarrel && symbolToFile.get(sym).endsWith('/index.ts'))) {
          symbolToFile.set(sym, rel);
        }
      }
      // Index relative imports so adapter -> runtime consumer chains can be traced.
      const fromDir = path.posix.dirname(rel);
      for (const match of text.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g)) {
        const rawSpec = match[1].replace(/\.(?:[cm]?[jt]sx?)$/i, '');
        const resolvedBase = path.posix.normalize(path.posix.join(fromDir, rawSpec));
        for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
          const candidate = resolvedBase + ext;
          if (!importersByTarget.has(candidate)) importersByTarget.set(candidate, new Set());
          importersByTarget.get(candidate).add(rel);
        }
      }
      // Index inline requestReaction / triggerType union declaration sites (WF-G273).
      if (/\btriggerType\s*:\s*['"]on_hit['"]\s*\|\s*(?:['"][A-Za-z0-9_]+['"]\s*\|\s*)*['"]on_take_damage['"]/.test(text)) {
        inlineTriggerUnionFiles.push(rel);
      }
    }
  };
  walk(root);
  cachedSrcIndex = { repoRoot, symbolToFile, importersByTarget, inlineTriggerUnionFiles };
  return cachedSrcIndex;
}

function activeProseLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter((line) => !/^[ \t>*-]*(?:REFERENCE-ONLY|EVIDENCE|HISTORY|SNAPSHOT|KNOWN-INVALID)\s*:/i.test(line))
    .join('\n');
}

function normalizeFile(value) {
  return String(value || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
}

function packetReferences(packet) {
  return [
    ...(Array.isArray(packet.issues) ? packet.issues : []),
    ...(Array.isArray(packet.refs) ? packet.refs : []),
  ];
}

function fileReferences(values) {
  return extractTaskOwnershipPaths({ refs: values }, { repoRoot: REPO_ROOT }).map(({ ref }) => normalizeFile(ref));
}

function tokensOverlap(a, b) {
  return Boolean(lockOverlap([a], { paths: [b], globs: [] }, REPO_ROOT));
}

function packetLockErrors(packet, locks) {
  const errors = [];
  for (const file of packet.files || []) {
    const ref = normalizeFile(file);
    for (const lock of locks) {
      if (!lockOverlap([ref], lock, REPO_ROOT)) continue;
      errors.push('packet ' + packet.id + ' owns ' + ref
        + ' but active Agora lock ' + lock.id + ' is held by ' + lock.agentId
        + (lock.reason ? ' (' + lock.reason + ')' : '')
        + '; wait for release or change the packet before dispatch');
    }
  }
  return errors;
}

function lockSnapshot(locks, { source = 'supplied', observedAt = null } = {}) {
  // Copy only public lock fields. A prompt needs every path and glob, not a
  // handwritten theme or incidental private fields from a response (WF-G330).
  return { source, observedAt, locks: locks.map(lock => ({
    id: lock.id, agentId: lock.agentId, reason: lock.reason || '',
    paths: [...(lock.paths || [])], globs: [...(lock.globs || [])],
    expiresAt: lock.expiresAt ?? null,
  })) };
}

export function formatLockSnapshot(snapshot) {
  if (!snapshot) return 'LOCK OBSERVATION (WF-G330): none supplied; this is NOT evidence that files are free.';
  const iso = value => typeof value === 'number' && Number.isFinite(value)
    && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : 'unknown';
  const lines = ['LOCK OBSERVATION (WF-G330): ' + snapshot.source
    + ', observed ' + iso(snapshot.observedAt)
    + '. Advisory snapshot only; re-read locks and acquire your own lock before editing.'];
  if (!snapshot.locks.length) lines.push('  No locks in this observation; this is not a reservation or grant.');
  for (const lock of snapshot.locks) {
    lines.push('  LOCK DATA ' + JSON.stringify({
      id: lock.id, holder: lock.agentId, paths: lock.paths, globs: lock.globs,
      expires: iso(lock.expiresAt), reason: lock.reason,
    }));
  }
  return lines.join('\n');
}

function ownedSourceFiles(files) {
  const found = new Set();
  for (const file of files) {
    const ref = normalizeFile(file);
    const matches = hasMagic(ref, { magicalBraces: true })
      ? globIterateSync(ref, { cwd: REPO_ROOT, nodir: true })
      : [ref];
    for (const match of matches) {
      const source = path.posix.normalize(normalizeFile(match));
      if (!source.startsWith('src/')) continue;
      const extension = path.posix.extname(source);
      if (!/^\.(?:[cm]?[jt]sx?)$/i.test(extension)) continue;
      const stem = path.posix.basename(source, extension);
      if (stem.endsWith('.d') || /\.(?:test|spec)$/i.test(stem)) continue;
      found.add(source);
    }
  }
  return found;
}

function existingSiblingTests(source) {
  const directory = path.posix.dirname(source);
  const stem = path.posix.basename(source, path.posix.extname(source));
  const tests = [];
  for (const relativeDir of [directory, path.posix.join(directory, '__tests__')]) {
    const absoluteDir = path.join(REPO_ROOT, ...relativeDir.split('/'));
    let entries;
    try {
      entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith(stem)
        || !/\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/i.test(entry.name)) continue;
      const suffix = entry.name.slice(stem.length);
      // Module.test.ts and Module.behavior.test.ts are conventional siblings.
      // Also cover names such as EntityResolverServiceGeneration.test.ts when
      // the test actually imports this source, without confusing FooBar with Foo.
      const conventional = /^\.(?:[^.]+\.)*(?:test|spec)\.(?:[cm]?[jt]sx?)$/i.test(suffix);
      if (!conventional) {
        const relativeSource = path.posix.relative(relativeDir, source).replace(/\.[^.]+$/, '');
        const importPath = relativeSource.startsWith('.') ? relativeSource : './' + relativeSource;
        const contents = fs.readFileSync(path.join(absoluteDir, entry.name), 'utf8');
        const specifiers = [importPath, importPath + '.js', importPath + '.ts', importPath + '.tsx'];
        if (!specifiers.some((specifier) => contents.includes("'" + specifier + "'")
          || contents.includes('"' + specifier + '"'))) continue;
      }
      tests.push(path.posix.join(relativeDir, entry.name));
    }
  }
  return tests;
}

export function packetTaskIds(packet) {
  const explicit = Array.isArray(packet.taskIds) ? packet.taskIds : [];
  const linked = packetReferences(packet).map((ref) => String(ref).trim()).filter((ref) => TASK_ID.test(ref));
  return [...new Set([...explicit, ...linked])];
}

// Batch Git's real ignore rules before dispatch. A failed probe is not proof
// that a test will exist in a clone, so fail closed instead of guessing.
export function ignoredPacketPaths(files) {
  if (!files.length) return new Set();
  try {
    const output = execFileSync('git', ['-c', 'core.fsmonitor=false', 'check-ignore', '-z', '--stdin'], {
      cwd: REPO_ROOT, input: files.join('\0') + '\0', encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return new Set(output.split('\0').filter(Boolean).map(normalizeFile));
  } catch (error) {
    if (error.status === 1) return new Set(); // Git's explicit "none ignored" result.
    throw new Error('partition cannot verify ignored test homes (WF-G258): ' + error.message);
  }
}

export function ignoredTestHomeErrors(packet, sources, ignored) {
  const errors = [];
  const homes = packet.localTestHomes || [];
  const owned = (packet.files || []).map(normalizeFile);
  for (const source of sources) {
    if (!ignored.has(source)) continue;
    const home = homes.find(item => item.source === source);
    if (!home) {
      errors.push('packet ' + packet.id + ' owns gitignored source ' + source
        + '; declare localTestHomes with an ignored test file owned by this packet (WF-G258); tracked CI cannot import this source in a clean clone');
    } else if (!ignored.has(home.test) || !owned.some(file => tokensOverlap(home.test, file))) {
      errors.push('packet ' + packet.id + ' test home ' + home.test + ' for ' + source
        + ' must be gitignored AND owned by this same packet (WF-G258); a tracked test or sibling handoff is not sufficient');
    }
  }
  for (const home of homes) {
    if (!sources.has(home.source) || !ignored.has(home.source)) {
      errors.push('packet ' + packet.id + ' has stale localTestHomes source ' + home.source
        + '; it is not an owned gitignored source (WF-G258)');
    }
  }
  return errors;
}

export function localTestHomePromptBlock(packet) {
  if (!packet.localTestHomes?.length) return '';
  return '\nLOCAL-ONLY TEST HOMES (WF-G258):\n'
    + packet.localTestHomes.map(home => '- ' + home.source + ' -> ' + home.test).join('\n')
    + '\nUse these declared ignored test files, not a new tracked test importing an ignored module. '
    + 'These files still require your own lock. Local-only tests do not prove clean-clone CI; '
    + 'do not edit .gitignore or claim a CI repair from local results. Existing verification-command limits still apply.\n';
}

// An implementation packet cannot own a sentence such as "discover the UI".
// Authors must search first and choose literal existing/new targets themselves;
// this shared preflight never guesses locations or silently expands a packet.
export function assertResolvedPacketDiscovery(packet) {
  const pending = extractPendingDiscoveries([packet.scope || '', packet.guidance || ''].join('\n'));
  for (const file of packet.files || []) {
    if (typeof file === 'string' && (/^\s*(?:(?:discover|find|locate|maybe)\b(?:[ \t:]|$)|(?:TBD|TODO)(?:\s|:|$))/i.test(file)
      || /<[^>]*>/.test(file))) pending.push({ claim: 'owned target ' + JSON.stringify(file) });
  }
  if (pending.length) {
    throw new Error('packet ' + packet.id + ': unresolved implementation discovery (WF-G333): '
      + pending.map(item => item.claim).join('; ')
      + '. Run the scoped read-only source audit before dispatch; name real files or record absence and a parent-chosen exact new location. No file ownership or placement decision was inferred.');
  }
}

/**
 * WF-G327: a prescribed data diff needs a current premise, not just a filename.
 * Read exact existing JSON fields without writing or expanding ownership.
 * Missing from-values remain verification obligations. Literal no-ops fail;
 * semantic equivalence still needs the owning normalizer and reviewed evidence.
 */
export function inspectPacketDataEdits(packet, { repoRoot = REPO_ROOT } = {}) {
  if (packet.dataEdits === undefined) return [];
  const fail = message => { throw new Error('packet ' + packet.id + ': WF-G327 ' + message); };
  if (!Array.isArray(packet.dataEdits)) fail('dataEdits must be an array');
  const seen = new Set();
  const checked = [];
  const jsonValue = (value, label) => {
    let encoded;
    try { encoded = JSON.stringify(value); } catch { fail(label + ' must be a JSON value'); }
    if (encoded === undefined || !isDeepStrictEqual(value, JSON.parse(encoded))) fail(label + ' must be a JSON value');
  };
  for (const edit of packet.dataEdits) {
    if (!edit || typeof edit !== 'object' || Array.isArray(edit)
      || Object.keys(edit).some(key => !['file', 'field', 'from', 'to'].includes(key))) {
      fail('dataEdits records allow only file, field, from and to');
    }
    if (typeof edit.file !== 'string' || !edit.file.trim()) fail('data edit file must name an exact owned JSON path');
    const raw = normalizeFile(edit.file);
    if (path.posix.isAbsolute(raw) || /^[A-Za-z]:/.test(raw) || raw.split('/').includes('..') || hasMagic(raw, { magicalBraces: true })
      || !/\.json$/i.test(raw)) fail('data edit file must be an exact repository-relative JSON path');
    const file = path.posix.normalize(raw);
    if (!lockOverlap([file], { paths: packet.files || [], globs: [] }, repoRoot)) fail('data edit file is not owned: ' + file);
    if (!Array.isArray(edit.field) || !edit.field.length || edit.field.some(key => typeof key !== 'string'
      && !(Number.isSafeInteger(key) && key >= 0))) fail('field must be a nonempty array of exact JSON keys or array indices');
    const key = JSON.stringify([file, edit.field.map(String)]);
    if (seen.has(key)) fail('duplicate data field prescription: ' + key);
    seen.add(key);
    if (!Object.hasOwn(edit, 'to')) fail('data edit needs a JSON to-value');
    jsonValue(edit.to, 'to');
    const hasFrom = Object.hasOwn(edit, 'from');
    if (hasFrom) jsonValue(edit.from, 'from');
    let current;
    try {
      const root = fs.realpathSync(repoRoot);
      const target = fs.realpathSync(path.join(root, ...file.split('/')));
      const relative = path.relative(root, target);
      if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) {
        fail('data path resolves outside the repository: ' + file);
      }
      current = JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch (error) {
      if (error.message.includes('WF-G327')) throw error;
      fail('cannot read existing owned JSON file ' + file + ': ' + error.message);
    }
    // A key array avoids ambiguous dot notation. Own-key checks keep inherited
    // properties and array metadata from masquerading as authored JSON fields.
    for (const segment of edit.field) {
      if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment)
        || (Array.isArray(current) && !/^(?:0|[1-9]\d*)$/.test(String(segment)))) {
        fail('field must name an existing JSON field in ' + file + ': ' + JSON.stringify(edit.field));
      }
      current = current[segment];
    }
    if (hasFrom && !isDeepStrictEqual(edit.from, current)) fail('stale from-value for ' + file + ' ' + JSON.stringify(edit.field) + '; read current data and revise the premise before dispatch');
    if (isDeepStrictEqual(edit.to, current)) fail('literal target is already present in ' + file + ' ' + JSON.stringify(edit.field) + '; remove the unnecessary data diff, do not rewrite the source');
    checked.push({ file, field: [...edit.field], ...(hasFrom ? { from: edit.from } : {}), to: edit.to,
      current, needsVerification: !hasFrom });
  }
  return checked;
}

// Keep ownership in the existing packet model, not the pure provenance reader.
// This wrapper is shared by plan validation, prompts and queued launch checks.
export function inspectPacketDataValueOwnership(packet) {
  const report=inspectPacketDataValues(packet);
  for(const record of report.declarations)if(!lockOverlap([record.file],{paths:packet.files||[],globs:[]},REPO_ROOT))throw new Error('packet '+packet.id+': WF-G267 data target is not owned: '+record.file);
  return report;
}

// A source identity is reference-only. Editing its board still needs explicit
// ownership in the usual packet, not an implied grant from the citation.
export function inspectPacketSourceRecordOwnership(packet){
  const report=inspectPacketSourceRecords(packet);
  for(const item of report.declarations)if(!lockOverlap([item.file],{paths:packet.files||[],globs:[]},REPO_ROOT))throw new Error('packet '+packet.id+': WF-G294 source-record target is not owned: '+item.file);
  return report;
}

// WF-G276: carry the author's comparison state without silently promoting an
// unverified claim. Records are read context, not file or command permission.
export function inspectPacketValueEquivalence(packet){
  if(packet.valueEquivalence!==undefined&&(!Array.isArray(packet.valueEquivalence)||packet.valueEquivalence.length>32))throw Error('packet '+packet.id+': WF-G276 valueEquivalence must be an array of at most32 records');
  const body=[packet.scope||'',packet.guidance||'',...(packet.valueEquivalence||[]).map(item=>'VALUE-EQUIVALENCE: '+JSON.stringify(item))].join('\n');
  const report=inspectValueEquivalence({body});
  if(report.issues.length)throw Error('packet '+packet.id+': WF-G276 '+report.issues.map(i=>i.reason).join('; '));
  return report;
}
export function assertTaskValueEquivalence(packet,task){
  const report=inspectValueEquivalence(task),authored=inspectPacketValueEquivalence(packet);
  if(report.issues.length)throw Error('task '+task.id+': WF-G276 '+report.issues.map(i=>i.reason).join('; '));
  const normalized=items=>items.map(({bodyLine,...item})=>item);
  // Do not drop, replace, or promote a durable premise by changing plan JSON.
  // A task edit needs an author-reconciled matching packet before launch.
  for(const item of normalized(report.declarations))if(!normalized(authored.declarations).some(candidate=>isDeepStrictEqual(candidate,item)))throw Error('task '+task.id+': WF-G276 comparison record missing or changed in packet; retain its exact claim, evidence and unresolved state');
  for(const item of normalized(authored.declarations))if(!normalized(report.declarations).some(candidate=>isDeepStrictEqual(candidate,item)))throw Error('task '+task.id+': WF-G276 packet comparison record missing or changed in durable task; reconcile before launch');
  return report;
}

// WF-G264: keep exact executed evidence or unresolved investigation state in
// both plan and durable task. Refresh it again at the queued launch boundary.
export function inspectPacketRuntimeLimitations(packet){
  if(packet.runtimeLimitations!==undefined&&(!Array.isArray(packet.runtimeLimitations)||packet.runtimeLimitations.length>32))throw Error('packet '+packet.id+': WF-G264 runtimeLimitations must be an array of at most32 records');
  const body=[packet.guidance||'',...(packet.runtimeLimitations||[]).map(item=>'RUNTIME-LIMITATION: '+JSON.stringify(item))].join('\n');
  const report=inspectRuntimeLimitations({title:packet.scope||'',body},{repoRoot:REPO_ROOT});
  if(report.issues.length)throw Error('packet '+packet.id+': WF-G264 '+report.issues.map(i=>i.reason).join('; '));
  return report;
}
export function assertTaskRuntimeLimitations(packet,task){
  const report=inspectRuntimeLimitations(task,{repoRoot:REPO_ROOT}),authored=inspectPacketRuntimeLimitations(packet);
  if(report.issues.length)throw Error('task '+task.id+': WF-G264 '+report.issues.map(i=>i.reason).join('; '));
  const normalize=items=>items.map(({bodyLine,...item})=>item);
  for(const [left,right]of [[report,authored],[authored,report]])for(const item of normalize(left.declarations))
    if(!normalize(right.declarations).some(other=>isDeepStrictEqual(item,other)))throw Error('task '+task.id+': WF-G264 runtime evidence missing or changed between packet and durable task; reconcile before launch');
  return report;
}

export function validateOwnershipDeclarations(plan) {
  const packets = Array.isArray(plan.packets) ? plan.packets : [];
  const packetIds = new Set(packets.map((packet) => packet.id));
  for (const packet of packets) {
    inspectPacketRuntimeLimitations(packet);
    inspectPacketValueEquivalence(packet);
    assertResolvedPacketDiscovery(packet);
    inspectPacketDataEdits(packet);
    inspectPacketDataValueOwnership(packet);
    inspectPacketSourceRecordOwnership(packet);
    inspectPacketSourceRewrites(packet);
    inspectPacketMounts(packet);
    validateVisualPacket(packet);
    inspectProductionCallers(packet);
    inspectPacketActionWiring(packet);
    validatePacketUnions(packet);
    if (packet.forwarderOnly !== undefined) {
      if (!Array.isArray(packet.forwarderOnly)) throw new Error('packet ' + packet.id + ': forwarderOnly must be an array');
      const seen = new Set();
      for (const item of packet.forwarderOnly) {
        if (!item || typeof item.file !== 'string' || fileReferences([item.file]).length !== 1
          || fileReferences([item.file])[0] !== item.file || normalizeFile(item.file) !== item.file
          || item.file.split('/').includes('..') || seen.has(item.file)
          || typeof item.reason !== 'string' || !item.reason.trim()) {
          throw new Error('packet ' + packet.id + ': forwarderOnly needs unique exact repo-relative files and a reason');
        }
        seen.add(item.file);
      }
    }
    if (packet.localTestHomes !== undefined) {
      if (!Array.isArray(packet.localTestHomes)) throw new Error('packet ' + packet.id + ': localTestHomes must be an array');
      const seen = new Set();
      for (const home of packet.localTestHomes) {
        if (!home || typeof home !== 'object' || [home.source, home.test].some(ref =>
          typeof ref !== 'string' || fileReferences([ref]).length !== 1
          || normalizeFile(ref) !== ref || fileReferences([ref])[0] !== ref
          || ref.split('/').includes('..'))
          || !/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(home.test) || seen.has(home.source)) {
          throw new Error('packet ' + packet.id + ': localTestHomes needs unique source and repo-relative test-file paths');
        }
        seen.add(home.source);
      }
    }
    if (packet.taskIds !== undefined && !Array.isArray(packet.taskIds)) {
      throw new Error('packet ' + packet.id + ': taskIds must be an array');
    }
    for (const id of packet.taskIds || []) {
      if (typeof id !== 'string' || !TASK_ID.test(id)) {
        throw new Error('packet ' + packet.id + ': invalid Agora task id in taskIds: ' + JSON.stringify(id));
      }
    }
    if (packet.hotFiles !== undefined) {
      if (!Array.isArray(packet.hotFiles) || packet.hotFiles.some((ref) => typeof ref !== 'string'
        || fileReferences([ref]).length !== 1 || normalizeFile(ref) !== fileReferences([ref])[0])) {
        throw new Error('packet ' + packet.id + ': hotFiles must be an array of exact repo-relative file refs (WF-G261)');
      }
    }
    if (packet.handoffs !== undefined && !Array.isArray(packet.handoffs)) {
      throw new Error('packet ' + packet.id + ': handoffs must be an array');
    }
    for (const handoff of packet.handoffs || []) {
      if (!handoff || typeof handoff !== 'object'
        || typeof handoff.ref !== 'string'
        || fileReferences([handoff.ref]).length !== 1
        || normalizeFile(handoff.ref) !== fileReferences([handoff.ref])[0]
        || typeof handoff.toPacket !== 'string'
        || !packetIds.has(handoff.toPacket)
        || handoff.toPacket === packet.id
        || typeof handoff.expectedBreakage !== 'string'
        || !handoff.expectedBreakage.trim()) {
        throw new Error('packet ' + packet.id + ': each handoff needs one file ref, a different sibling toPacket, and expectedBreakage');
      }
      if (handoff.taskId !== undefined && !packetTaskIds(packet).includes(handoff.taskId)) {
        throw new Error('packet ' + packet.id + ': handoff taskId ' + handoff.taskId + ' is not a claimed task');
      }
    }
  }
}

export function analyzePacketOwnership(plan, boardTasks = [], boardLocks = [], observation = {}) {
  validateOwnershipDeclarations(plan);
  const packets = plan.packets || [];
  const byTaskId = new Map(boardTasks.map((task) => [task.id, task]));
  const fileClaims = [];
  const taskOwner = new Map();
  const findings = [];
  const errors = [];
  const usedHandoffs = new Set();
  const forwarders = [];
  const titleTargets = [];
  const mountPoints = packets.flatMap(packet => inspectPacketMounts(packet, boardTasks));
  const productionCallers = packets.flatMap(packet => inspectProductionCallers(packet, boardTasks));
  let checkedTasks = 0;
  let checkedRefs = 0;
  const sourcesByPacket = new Map(packets.map(packet => [packet.id, ownedSourceFiles(packet.files || [])]));
  const actionWiring = new Map(packets.map(packet => [packet.id, inspectPacketActionWiring(packet, { sourceFiles:[...sourcesByPacket.get(packet.id)] })]));
  // One current reverse observation for the wave, not a graph per source file.
  const unionConsumers = inspectUnionConsumers(plan, { sourceFilesByPacket:sourcesByPacket });
  // Resolve once per plan, not once per file. Source-only inspection does not
  // grant downstream ownership or discover private hook state automatically.
  const traceForwarder = [...sourcesByPacket.values()].some(sources => sources.size)
    ? createForwarderResolver() : null;
  const ignoreTargets = [...new Set(packets.flatMap(packet => [
    ...sourcesByPacket.get(packet.id), ...(packet.localTestHomes || []).map(home => home.test),
  ]))];
  const ignored = ignoredPacketPaths(ignoreTargets);
  const hasDeclarationCandidates = [...sourcesByPacket.values()].some(sources =>
    [...sources].some(source => /\.(?:tsx?|jsx?)$/i.test(source)));
  // Tracked declarations are part of the source contract, not disposable
  // output. Read Git once per analysis; never require ignored/untracked twins
  // or pretend the dependency-header sync regenerates them (WF-G263).
  let trackedDeclarations = new Set();
  if (hasDeclarationCandidates) {
    try {
      trackedDeclarations = new Set(execFileSync('git', [
        '-c', 'core.fsmonitor=false', 'ls-files', '-z', '--', ':(glob)src/**/*.d.ts',
      ], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).split('\0').filter(Boolean));
    } catch (error) {
      throw new Error('partition cannot verify tracked declaration twins (WF-G263): ' + error.message);
    }
  }

  for (const packet of packets) {
    errors.push(...packetLockErrors(packet, boardLocks));
    for (const file of packet.files || []) {
      const ref = normalizeFile(file);
      const previous = fileClaims.find((claim) => claim.packetId !== packet.id && tokensOverlap(ref, claim.ref));
      if (previous) {
        errors.push(ref + ' overlaps ' + previous.ref + ' owned by both ' + previous.packetId + ' and ' + packet.id);
      }
      fileClaims.push({ ref, packetId: packet.id });
    }
  }

  for (const packet of packets) {
    const owned = (packet.files || []).map(normalizeFile);
    errors.push(...ignoredTestHomeErrors(packet, sourcesByPacket.get(packet.id), ignored));
    // WF-G209: a source edit cannot be responsibly closed if its existing
    // regression test belongs to a different packet (or no packet at all).
    // Check both co-located and __tests__ siblings before worker dispatch.
    const checkedTests = new Set();
    for (const source of sourcesByPacket.get(packet.id)) {
      const twin = source.replace(/\.(?:tsx?|jsx?)$/i, '.d.ts');
      if (trackedDeclarations.has(twin) && !owned.some(file => tokensOverlap(twin, file))) {
        errors.push('packet ' + packet.id + ' owns ' + source
          + ' but tracked declaration twin ' + twin + ' is outside its owned files'
          + '; put source and declaration in the same packet (WF-G263); header sync does not regenerate declarations');
      }
      for (const siblingTest of existingSiblingTests(source)) {
        if (checkedTests.has(siblingTest)) continue;
        checkedTests.add(siblingTest);
        if (owned.some((file) => tokensOverlap(siblingTest, file))) continue;
        const otherOwner = fileClaims.find((claim) => claim.packetId !== packet.id
          && tokensOverlap(siblingTest, claim.ref))?.packetId;
        errors.push('packet ' + packet.id + ' owns ' + source
          + ' but existing companion test ' + siblingTest + ' is outside its owned files'
          + (otherOwner ? ' (owned by ' + otherOwner + ')' : '')
          + '; put source and test in the same packet (WF-G209)');
      }
    }
    const references = new Map();
    const addRef = (taskId, ref, sources = ['refs']) => {
      const key = (taskId || 'packet') + '\0' + ref;
      references.set(key, { taskId, ref, sources: [...new Set([...(references.get(key)?.sources || []), ...sources])] });
    };
    for (const ref of fileReferences(packetReferences(packet))) addRef(null, ref);
    for (const hotFile of packet.hotFiles || []) addRef(null, normalizeFile(hotFile), ['hot-file']);
    for (const ref of actionWiring.get(packet.id).references) addRef(null,ref,['action-wiring']);
    for (const ref of unionConsumers.packets.find(item => item.packetId === packet.id).references) addRef(null,ref,['union-consumer']);

    const ownsStateFile = [...sourcesByPacket.get(packet.id)].some((source) => source.startsWith('src/state/'));
    const ownedAdapters = [...sourcesByPacket.get(packet.id)].filter((source) => source.startsWith('src/data/adapters/'));
    const inspectCrossFileObligations = (taskId, text) => {
      const prose = activeProseLines(text);
      if (!prose.trim()) return;
      // WF-G262: state-slice / save-state work in src/state/** requires the
      // canonical GameState type file (src/types/state.ts) and initialState.ts
      // when required initial-state fields are added.
      if (ownsStateFile && /\b(?:state[- ]slice|save[- ]state|new\s+GameState\s+(?:slice|field))\b/i.test(prose)) {
        addRef(taskId, 'src/types/state.ts', ['state-slice']);
        if (/\b(?:required\s+(?:field|slice)|initial[- ]state|initialState)\b/i.test(prose)) {
          addRef(taskId, 'src/state/initialState.ts', ['state-slice']);
        }
      }
      // WF-G270: resolve symbol consumer/persister targets named in wiring
      // directives ("read it in applySpeechProfile", "merge ... in performLevelUp")
      // to their defining src/ file when not already declared in an owned file.
      for (const match of prose.matchAll(/\b(?:read|persist|merge|consume)\s+(?:it|them|[A-Za-z0-9_.'`-]+)\s+(?:in|into|inside|via)\s+`?([A-Za-z_$][A-Za-z0-9_$]{3,})`?/gi)) {
        const sym = match[1];
        const idx = getSrcSymbolAndConsumerIndex(REPO_ROOT);
        const definingFile = idx.symbolToFile.get(sym);
        if (definingFile && !sourcesByPacket.get(packet.id).has(definingFile)) {
          addRef(taskId, definingFile, ['symbol-target:' + sym]);
        }
      }
      // WF-G248: an adapter packet scoped to runtime monster spell-slot /
      // combatant tracking must own or hand off its MonsterData type contract
      // and direct runtime consumer chain.
      if (ownedAdapters.length && /\bruntime\b[^\n]*\b(?:monster\s+spell\s+slots?|spell\s+slots?\s+tracking|slot\s+tracking)\b/i.test(prose)) {
        const idx = getSrcSymbolAndConsumerIndex(REPO_ROOT);
        const monsterDataFile = idx.symbolToFile.get('MonsterData');
        if (monsterDataFile) addRef(taskId, monsterDataFile, ['adapter-chain']);
        const runtimeConsumer = idx.symbolToFile.get('createEnemyFromMonster');
        if (runtimeConsumer) addRef(taskId, runtimeConsumer, ['adapter-chain']);
        for (const adapter of ownedAdapters) {
          for (const importer of idx.importersByTarget.get(adapter) || []) {
            addRef(taskId, importer, ['adapter-chain']);
          }
        }
      }
      // WF-G273: adding a new reaction prompt / trigger case to
      // CommandContext.requestReaction / triggerType ('on_hit' | 'on_take_damage')
      // cascades across every inline triggerType union declaration site.
      if (/\brequestReaction\b|\btriggerType\b/i.test(prose)
        && /\b(?:on_hit|on_take_damage|failed\s+saving\s+throw|on_failed_save)\b/i.test(prose)) {
        const idx = getSrcSymbolAndConsumerIndex(REPO_ROOT);
        for (const declFile of idx.inlineTriggerUnionFiles) {
          addRef(taskId, declFile, ['inline-union']);
        }
      }
    };
    inspectCrossFileObligations(null, [packet.scope || '', packet.guidance || '', packet.partitionNote || ''].join('\n'));

    for (const id of packetTaskIds(packet)) {
      checkedTasks++;
      const previous = taskOwner.get(id);
      if (previous && previous !== packet.id) {
        errors.push('task ' + id + ' is claimed by both ' + previous + ' and ' + packet.id);
      }
      taskOwner.set(id, packet.id);
      const task = byTaskId.get(id);
      if (!task) {
        errors.push('packet ' + packet.id + ' claims task ' + id + ', but it is absent from the live board');
        continue;
      }
      try { assertTaskActionWiring(packet,task); } catch (error) { errors.push('packet '+packet.id+' '+error.message); }
      try { assertTaskUnions(packet,task); } catch (error) { errors.push('packet '+packet.id+' '+error.message); }
      try { assertTaskProductionCallers(packet,task); } catch (error) { errors.push('packet '+packet.id+' '+error.message); }
      try { assertTaskDataValues(packet,task); } catch (error) { errors.push('packet '+packet.id+' '+error.message); }
      try { assertTaskSourceRecords(packet,task); } catch (error) { errors.push('packet '+packet.id+' '+error.message); }
      try { assertTaskSourceRewrites(packet,task); } catch (error) { errors.push('packet '+packet.id+' '+error.message); }
      try { assertTaskValueEquivalence(packet,task); } catch (error) { errors.push('packet '+packet.id+' '+error.message); }
      try { assertTaskRuntimeLimitations(packet,task); } catch (error) { errors.push('packet '+packet.id+' '+error.message); }
      try { inspectVisualHandoff(packet,task,boardTasks); } catch(error) { errors.push('packet '+packet.id+' '+error.message); }
      // WF-G256: title mappings must still match current source bytes. A
      // verified quote is location evidence, never semantic completeness proof.
      const titleCheck = inspectTaskTitleTargets(task, { repoRoot: REPO_ROOT });
      // Re-read anchored replacement blocks; old symbol presence misses growth.
      const reviews = inspectSourceReviews(task, { repoRoot: REPO_ROOT });
      for (const issue of reviews.issues) errors.push('packet ' + packet.id + ' task ' + id
        + ' source preservation review: ' + (issue.file || '') + ': ' + issue.reason + ' (WF-G307)');
      // Exact-file premise failures stop dispatch; read context grants no files.
      const symbols = inspectSymbolChecks(task, { repoRoot: REPO_ROOT });
      const members = inspectSourceMembers(task, { repoRoot: REPO_ROOT });
      for (const issue of members.issues) errors.push('packet ' + packet.id + ' task ' + id
        + ' source members need reconciliation: ' + (issue.file || '') + ' ' + (issue.symbol || '') + ': ' + issue.reason + ' (WF-G283)');
      for (const issue of symbols.issues) errors.push('packet ' + packet.id + ' task ' + id
        + ' symbol premise needs reconciliation: ' + (issue.file || '') + ' ' + (issue.symbol || '') + ': ' + issue.reason + ' (WF-G272)');
      const dedup = inspectDedupAcceptance([task.title || '', task.body || ''].join('\n'));
      for (const issue of dedup.issues) errors.push('packet ' + packet.id + ' task ' + id
        + ' deduplication acceptance needs reconciliation: ' + issue.reason + ' (WF-G325)');
      for (const issue of titleCheck.issues) errors.push('packet ' + packet.id + ' task ' + id
        + ' title target needs clarification: ' + issue.reason + ' (WF-G256)');
      titleTargets.push(...titleCheck.resolved.map(item => ({ packetId: packet.id, taskId: id, ...item })));
      // Refs alone omit title targets, DO steps and cross-packet edits. Keep
      // each origin in the report so the author can repair the packet.
      for (const { ref, sources } of extractTaskOwnershipPaths(task, { repoRoot: REPO_ROOT })) {
        addRef(id, normalizeFile(ref), sources);
      }
      inspectCrossFileObligations(id, [task.title || '', task.body || ''].join('\n'));
    }

    const acceptedForwarderOnly = new Set();
    for (const source of sourcesByPacket.get(packet.id)) {
      try {
        const forwarder = traceForwarder(source);
        if (!forwarder) continue;
        const exception = (packet.forwarderOnly || []).find(item => item.file === source);
        forwarders.push({ packetId: packet.id, ...forwarder, forwarderOnly: Boolean(exception), reason: exception?.reason });
        if (exception) {
          acceptedForwarderOnly.add(source);
        } else {
          for (const target of forwarder.chain.slice(1)) addRef(null, target, ['forwarder']);
        }
      } catch (error) {
        errors.push('packet ' + packet.id + ' ' + source + ': ' + error.message + ' (WF-G247)');
      }
    }
    for (const item of packet.forwarderOnly || []) {
      if (!acceptedForwarderOnly.has(item.file)) errors.push('packet ' + packet.id
        + ' has stale or unowned forwarderOnly file ' + item.file + ' (WF-G247)');
    }

    for (const { taskId, ref, sources } of references.values()) {
      checkedRefs++;
      if (owned.some((file) => tokensOverlap(ref, file))) {
        findings.push({ packetId: packet.id, taskId, ref, sources, status: 'owned' });
        continue;
      }
      const siblingPacketId = fileClaims.find((claim) => claim.packetId !== packet.id && tokensOverlap(ref, claim.ref))?.packetId || null;
      const handoff = (packet.handoffs || []).find((item) =>
        normalizeFile(item.ref) === ref && (item.taskId === undefined || item.taskId === taskId));
      const validHandoff = handoff && siblingPacketId && handoff.toPacket === siblingPacketId;
      if (validHandoff) {
        usedHandoffs.add(handoff);
        findings.push({
          packetId: packet.id, taskId, ref, sources, status: 'delegated',
          siblingPacketId, expectedBreakage: handoff.expectedBreakage,
        });
        continue;
      }
      const source = taskId ? 'task ' + taskId : 'packet refs';
      const detail = !siblingPacketId
        ? 'no sibling packet owns it; widen this packet or add an owning sibling'
        : handoff
          ? 'handoff names ' + handoff.toPacket + ', but ' + siblingPacketId + ' owns it'
          : 'owned by ' + siblingPacketId + '; add an explicit handoff with expected breakage';
      const symbolTargetTag = sources.find((s) => s.startsWith('symbol-target:'));
      const message = packet.id + ' ' + source + ' names ' + ref + ' outside its owned files: ' + detail
        + (sources.includes('forwarder') ? ' (implementation behind owned forwarder, WF-G247)' : '')
        + (sources.includes('body') ? ' (named in task body)' : '')
        + (sources.includes('hot-file') ? ' (sequenced hot-file target, WF-G261)' : '')
        + (sources.includes('state-slice') ? ' (state-slice type contract, WF-G262)' : '')
        + (symbolTargetTag ? ' (symbol target ' + symbolTargetTag.slice('symbol-target:'.length) + ' named in task body, WF-G270)' : '')
        + (sources.includes('adapter-chain') ? ' (cross-file adapter consumer chain, WF-G248)' : '')
        + (sources.includes('inline-union') ? ' (inline discriminated union declaration site, WF-G273)' : '');
      errors.push(message + (sources.includes('title') ? ' (named in task title, WF-G256)' : '')
        + (sources.includes('title-target') ? ' (declared title target, WF-G256)' : ''));
      findings.push({ packetId: packet.id, taskId, ref, sources, status: 'unhandled', siblingPacketId });
    }

    for (const handoff of packet.handoffs || []) {
      if (!usedHandoffs.has(handoff)) {
        errors.push('packet ' + packet.id + ' has an unused or stale handoff for ' + handoff.ref);
      }
    }
  }

  const sharedTypes = inspectSharedTypeDependencies(plan, sourcesByPacket, boardLocks);
  return { ok: errors.length === 0, checkedTasks, checkedRefs, findings, errors, forwarders, titleTargets, mountPoints, productionCallers, sharedTypes, unionConsumers, actionWiring:[...actionWiring.values()],
    lockSnapshot: lockSnapshot(boardLocks, observation) };
}

export function formatPacketOwnershipReport(report) {
  const lines = [
    'Partition ownership: ' + report.checkedTasks + ' claimed task(s), '
      + report.checkedRefs + ' file ref(s), ' + report.errors.length + ' error(s)',
  ];
  lines.push(formatLockSnapshot(report.lockSnapshot));
  if (report.unionConsumers?.packets.some(packet => packet.changes.length || packet.unchanged.length)) {
    lines.push('UNION CONSUMERS (WF-G282): '+report.unionConsumers.inspectedSources+' repository sources; source-symbol observation, not runtime acceptance or edit permission.');
    for (const packet of report.unionConsumers.packets) {
      for (const change of packet.changes) {
        lines.push('  UNION CHANGE '+packet.packetId+' '+change.file+'#'+change.symbol+'; added '+change.added.join(', ')+'; removed '+change.removed.join(', '));
        for (const consumer of change.consumers) lines.push('    '+consumer.kind+' '+consumer.file+':'+consumer.line+' '+consumer.name+'; '+(consumer.required?'REQUIRED ownership/handoff':'parent other-use review, not automatic edit'));
      }
      for (const review of packet.unchanged) lines.push('  UNCHANGED UNION '+packet.packetId+' '+review.file+' '+(review.symbol || review.symbols.join(', '))+'; '+review.reason);
    }
  }
  for (const target of report.titleTargets || []) lines.push('  TITLE TARGET ' + target.packetId + ' ' + target.taskId
    + ' ' + target.label + ' -> ' + target.file + ':' + target.line
    + '; current unique quote verified, not semantic completeness or edit permission');
  if (report.sharedTypes) {
    lines.push('SHARED TYPES (WF-G228): scoped syntax candidates from ' + report.sharedTypes.checkedSources
      + ' source(s), observed ' + new Date(report.sharedTypes.observedAt).toISOString()
      + '; packet owners are plan declarations, not a complete type/member graph and not edit permission.');
    for (const entry of report.sharedTypes.entries) lines.push('  SHARED TYPE ' + entry.packetId + ' ' + entry.source + ' -> ' + entry.file
      + '; symbols ' + entry.symbols.join(', ') + '; owner ' + entry.ownership
      + '; evidence ' + [...new Set(entry.evidence.map(item => 'line ' + item.line + ' ' + item.basis + ' via ' + item.via.join(' -> ')))].join(', ')
      + (entry.owners.length ? ' ' + entry.owners.map(owner => owner.packetId + ' (' + (owner.handle || 'handle unknown') + ')').join(', ') : '')
      + (entry.locks.length ? '; lock holders ' + entry.locks.map(lock => lock.agentId + ' [' + lock.id + ']').join(', ') : '; no holder in supplied lock observation'));
    for (const entry of report.sharedTypes.issues) lines.push('  SHARED TYPE AUDIT ISSUE ' + entry.packetId + ' ' + entry.source + ': ' + entry.message);
    lines.push('  A needed type change requires parent scope/dependency reconciliation and your own lock; never improvise an encoding or silently widen ownership.');
  }
  for (const entry of report.mountPoints || []) {
    lines.push('  MOUNT POINT ' + entry.packetId + ' ' + entry.leaf + '#' + entry.symbol + ' -> ' + entry.parent
      + '; ' + (entry.importVerified ? 'direct runtime import verified, JSX references ' + entry.jsxReferences : 'PLANNED link, not verified')
      + '; ' + (entry.delivery === 'owned' ? 'parent owned by this packet' : 'deferred to ' + entry.followUpTask + ', follow-up verified ' + entry.followUpVerified)
      + '; structural evidence only, not rendered acceptance');
  }
  for (const route of report.productionCallers || []) {
    lines.push('  PRODUCTION CALLER '+route.packetId+' '+route.module.file+'#'+route.module.symbol
      +' -> '+route.callers.map(caller=>caller.file+'#'+caller.symbol+' ('+caller.delivery+(caller.followUpTask?' '+caller.followUpTask:'')+')').join(' -> ')
      +'; GameState.'+route.state.field+'; parent nearest-caller review: '+route.review
      +'; state syntax '+route.stateSyntaxVerified+'; source clues only, not gameplay acceptance');
  }
  for (const audit of report.actionWiring || []) {
    for (const route of audit.entries) lines.push('  ACTION WIRING '+route.packetId+' '+route.action+'; '+route.kind+'; '+(route.syntaxVerified?'declared current syntax verified':'PLANNED, delivery incomplete')+'; observed '+route.observedAt
      +'; '+route.roles.map(role=>role.name+' '+role.file+':'+role.line+(role.change?' EDIT obligation':' reviewed read-only')).join('; '));
    if (audit.review) lines.push('  ACTION WIRING UNCHANGED: current source anchors checked; parent assessment: '+audit.review.reason);
  }
  for (const item of report.forwarders || []) {
    lines.push('  FORWARDER ' + item.packetId + ' ' + item.chain.join(' -> ')
      + (item.forwarderOnly ? '; facade-only edit: ' + item.reason : '; target ownership required (WF-G247)'));
  }
  for (const finding of report.findings.filter((item) => item.status === 'delegated')) {
    lines.push('  HANDOFF ' + finding.packetId + ' '
      + (finding.taskId || 'packet refs') + ' ' + finding.ref + ' -> '
      + finding.siblingPacketId + ': ' + finding.expectedBreakage);
  }
  for (const error of report.errors) lines.push('  BLOCK ' + error);
  if (report.ok) lines.push('  PASS: every file ref is owned or has a declared sibling handoff.');
  return lines.join('\n');
}

export function handoffPromptBlock(packet) {
  if (!Array.isArray(packet.handoffs) || packet.handoffs.length === 0) return '';
  const lines = packet.handoffs.map((handoff) =>
    '- ' + (handoff.taskId ? 'Task ' + handoff.taskId + ', ' : '')
      + handoff.ref + ' belongs to sibling packet ' + handoff.toPacket
      + '. Expected cross-packet effect: ' + handoff.expectedBreakage);
  return '\nExpected cross-packet effects and required handoffs (do not edit sibling files):\n'
    + lines.join('\n') + '\nReport these effects and name the sibling packet in your result.\n';
}

export function forwarderOnlyPromptBlock(packet) {
  if (!packet.forwarderOnly?.length) return '';
  return '\nFACADE-ONLY EDITS (WF-G247):\n'
    + packet.forwarderOnly.map(item => '- ' + item.file + ': ' + item.reason).join('\n')
    + '\nChange only these forwarding exports, not downstream implementation or private hook state. '
    + 'Audit callers/state owners before promising behavior changes; missing ownership requires a revised packet or handoff.\n';
}

export async function checkPlanOwnership(plan, { boardTasks, boardLocks, fetchImpl = fetch } = {}) {
  const claimed = plan.packets.flatMap(packetTaskIds);
  let tasks = boardTasks;
  if (tasks === undefined && claimed.length) {
    const url = String(plan.baseUrl || 'http://localhost:4319').replace(/\/$/, '') + '/tasks';
    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
    } catch (error) {
      throw new Error('partition check could not reach live Agora tasks: ' + error.message);
    }
    if (!response.ok) throw new Error('partition check could not read live Agora tasks (HTTP ' + response.status + ')');
    const body = await response.json();
    if (!Array.isArray(body.tasks)) throw new Error('partition check received no tasks array from Agora');
    tasks = body.tasks;
  }
  let locks = boardLocks;
  let observation;
  // A real partition/seed/dispatch call must read current locks even when no
  // packet claims an existing task. Supplying boardTasks makes an offline unit
  // analysis possible; callers can also supply boardLocks explicitly.
  if (locks === undefined && boardTasks === undefined) {
    observation = await readLiveLockSnapshot(plan, { fetchImpl });
    locks = observation.locks;
  }
  return analyzePacketOwnership(plan, tasks || [], locks || [], observation);
}

export async function readLiveLockSnapshot(plan, { fetchImpl = fetch } = {}) {
  const url = String(plan.baseUrl || 'http://localhost:4319').replace(/\/$/, '') + '/locks';
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
  } catch (error) {
    throw new Error('partition check could not reach live Agora locks: ' + error.message);
  }
  if (!response.ok) throw new Error('partition check could not read live Agora locks (HTTP ' + response.status + ')');
  const body = await response.json();
  if (!Array.isArray(body.locks)) throw new Error('partition check received no locks array from Agora');
  for (const lock of body.locks) {
    if (!lock || typeof lock.id !== 'string' || typeof lock.agentId !== 'string'
      || (!Array.isArray(lock.paths) && !Array.isArray(lock.globs))
      || [lock.paths, lock.globs].some(tokens => tokens !== undefined
        && (!Array.isArray(tokens) || tokens.some(token => typeof token !== 'string')))) {
      throw new Error('partition check received a malformed lock scope from Agora; cannot prove launch ownership');
    }
  }
  return lockSnapshot(body.locks, { source: 'live daemon', observedAt: Date.now() });
}

export async function checkPacketLaunchLocks(plan, packet, options) {
  // Queued workers may start after siblings have locked THEIR disjoint files.
  // Refresh all notes but check conflicts only against this launching packet.
  const snapshot = await readLiveLockSnapshot(plan, options);
  const errors = packetLockErrors(packet, snapshot.locks);
  try { inspectPacketValueEquivalence(packet); } catch(error) { errors.push(error.message); }
  try { inspectPacketRuntimeLimitations(packet); } catch(error) { errors.push(error.message); }
  // A queued launch must re-read the selected durable task, including a seeded
  // id absent from authored taskIds. Later board edits cannot hide behind plan metadata.
  const selected = [...new Set([...packetTaskIds(packet), ...(options?.taskId ? [options.taskId] : [])])];
  if (selected.some(id => typeof id !== 'string' || !TASK_ID.test(id))) throw new Error('invalid launch task identity');
  if (selected.length || packet.productionCallers?.length) {
    const fetchImpl = options?.fetchImpl || fetch;
    const url = String(plan.baseUrl || 'http://localhost:4319').replace(/\/$/, '') + '/tasks';
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('launch member check could not read live tasks (HTTP ' + response.status + ')');
    const body = await response.json();
    if (!Array.isArray(body.tasks)) throw new Error('launch member check received no tasks array');
    // A queued slot is a new observation, not permission inherited from seed.
    // Recheck current source, exact task metadata and deferred dependency edges.
    const currentPacket = { ...packet, taskIds: selected };
    try { inspectProductionCallers(currentPacket, body.tasks); }
    catch (error) { errors.push(error.message); }
    try { inspectPacketDataValueOwnership(currentPacket); }
    catch (error) { errors.push(error.message); }
    try { inspectPacketSourceRecordOwnership(currentPacket); }
    catch (error) { errors.push(error.message); }
    try { inspectPacketSourceRewrites(currentPacket); }
    catch (error) { errors.push(error.message); }
    for (const id of selected) {
      const matches = body.tasks.filter(task => task.id === id);
      if (matches.length !== 1) { errors.push('launch task ' + id + ' is absent or ambiguous (WF-G283)'); continue; }
      try { assertTaskProductionCallers(currentPacket, matches[0]); }
      catch (error) { errors.push('launch task ' + id + ': ' + error.message); }
      try { assertTaskDataValues(currentPacket, matches[0]); }
      catch (error) { errors.push('launch task '+id+': '+error.message); }
      try { assertTaskSourceRecords(currentPacket, matches[0]); }
      catch (error) { errors.push('launch task '+id+': '+error.message); }
      try { assertTaskSourceRewrites(currentPacket, matches[0]); }
      catch (error) { errors.push('launch task '+id+': '+error.message); }
      try { assertTaskValueEquivalence(currentPacket, matches[0]); }
      catch (error) { errors.push('launch task '+id+': '+error.message); }
      try { assertTaskRuntimeLimitations(currentPacket, matches[0]); }
      catch (error) { errors.push('launch task '+id+': '+error.message); }
      try { inspectVisualHandoff(currentPacket,matches[0],body.tasks); }
      catch(error){errors.push('launch task '+id+': '+error.message);}
      const check = inspectSourceMembers(matches[0], { repoRoot: REPO_ROOT });
      for (const issue of check.issues) errors.push('launch task ' + id + ': ' + issue.reason + ' (WF-G283)');
    }
  } else {
    try { inspectProductionCallers(packet, []); }
    catch (error) { errors.push(error.message); }
    try { inspectPacketDataValueOwnership(packet); }
    catch (error) { errors.push(error.message); }
    try { inspectPacketSourceRecordOwnership(packet); }
    catch (error) { errors.push(error.message); }
    try { inspectPacketSourceRewrites(packet); }
    catch (error) { errors.push(error.message); }
  }
  return { ok: !errors.length, errors, checkedTasks: selected.length, checkedRefs: 0, findings: [], lockSnapshot: snapshot };
}
