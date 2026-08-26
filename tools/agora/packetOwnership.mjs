// WF-G225: compare a packet's owned files with the file refs of every existing
// Agora task it claims. This is a read-only pre-dispatch check.
import { extractPathTokens } from './taskLint.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globIterateSync, hasMagic } from 'glob';
import { lockOverlap } from './store.mjs';

const TASK_ID = /^agora-[a-z0-9]+(?:\.[0-9]+)*$/i;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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
  return [...new Set(values.flatMap((value) =>
    extractPathTokens(String(value).replace(/\\/g, '/')).map(normalizeFile)))];
}

function tokensOverlap(a, b) {
  return Boolean(lockOverlap([a], { paths: [b], globs: [] }, REPO_ROOT));
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

export function validateOwnershipDeclarations(plan) {
  const packets = Array.isArray(plan.packets) ? plan.packets : [];
  const packetIds = new Set(packets.map((packet) => packet.id));
  for (const packet of packets) {
    if (packet.taskIds !== undefined && !Array.isArray(packet.taskIds)) {
      throw new Error('packet ' + packet.id + ': taskIds must be an array');
    }
    for (const id of packet.taskIds || []) {
      if (typeof id !== 'string' || !TASK_ID.test(id)) {
        throw new Error('packet ' + packet.id + ': invalid Agora task id in taskIds: ' + JSON.stringify(id));
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

export function analyzePacketOwnership(plan, boardTasks = [], boardLocks = []) {
  validateOwnershipDeclarations(plan);
  const packets = plan.packets || [];
  const byTaskId = new Map(boardTasks.map((task) => [task.id, task]));
  const fileClaims = [];
  const taskOwner = new Map();
  const findings = [];
  const errors = [];
  const usedHandoffs = new Set();
  let checkedTasks = 0;
  let checkedRefs = 0;

  for (const packet of packets) {
    for (const file of packet.files || []) {
      const ref = normalizeFile(file);
      const previous = fileClaims.find((claim) => claim.packetId !== packet.id && tokensOverlap(ref, claim.ref));
      if (previous) {
        errors.push(ref + ' overlaps ' + previous.ref + ' owned by both ' + previous.packetId + ' and ' + packet.id);
      }
      fileClaims.push({ ref, packetId: packet.id });
      for (const lock of boardLocks) {
        if (!lockOverlap([ref], lock, REPO_ROOT)) continue;
        errors.push('packet ' + packet.id + ' owns ' + ref
          + ' but active Agora lock ' + lock.id + ' is held by ' + lock.agentId
          + (lock.reason ? ' (' + lock.reason + ')' : '')
          + '; wait for release or change the packet before dispatch');
      }
    }
  }

  for (const packet of packets) {
    const owned = (packet.files || []).map(normalizeFile);
    // WF-G209: a source edit cannot be responsibly closed if its existing
    // regression test belongs to a different packet (or no packet at all).
    // Check both co-located and __tests__ siblings before worker dispatch.
    const checkedTests = new Set();
    for (const source of ownedSourceFiles(owned)) {
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
    const addRef = (taskId, ref) => {
      const key = (taskId || 'packet') + '\0' + ref;
      references.set(key, { taskId, ref });
    };
    for (const ref of fileReferences(packetReferences(packet))) addRef(null, ref);

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
      for (const ref of fileReferences(Array.isArray(task.refs) ? task.refs : [])) addRef(id, ref);
    }

    for (const { taskId, ref } of references.values()) {
      checkedRefs++;
      if (owned.some((file) => tokensOverlap(ref, file))) {
        findings.push({ packetId: packet.id, taskId, ref, status: 'owned' });
        continue;
      }
      const siblingPacketId = fileClaims.find((claim) => claim.packetId !== packet.id && tokensOverlap(ref, claim.ref))?.packetId || null;
      const handoff = (packet.handoffs || []).find((item) =>
        normalizeFile(item.ref) === ref && (item.taskId === undefined || item.taskId === taskId));
      const validHandoff = handoff && siblingPacketId && handoff.toPacket === siblingPacketId;
      if (validHandoff) {
        usedHandoffs.add(handoff);
        findings.push({
          packetId: packet.id, taskId, ref, status: 'delegated',
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
      const message = packet.id + ' ' + source + ' names ' + ref + ' outside its owned files: ' + detail;
      errors.push(message);
      findings.push({ packetId: packet.id, taskId, ref, status: 'unhandled', siblingPacketId });
    }

    for (const handoff of packet.handoffs || []) {
      if (!usedHandoffs.has(handoff)) {
        errors.push('packet ' + packet.id + ' has an unused or stale handoff for ' + handoff.ref);
      }
    }
  }

  return { ok: errors.length === 0, checkedTasks, checkedRefs, findings, errors };
}

export function formatPacketOwnershipReport(report) {
  const lines = [
    'Partition ownership: ' + report.checkedTasks + ' claimed task(s), '
      + report.checkedRefs + ' file ref(s), ' + report.errors.length + ' error(s)',
  ];
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
  // A real partition/seed/dispatch call must read current locks even when no
  // packet claims an existing task. Supplying boardTasks makes an offline unit
  // analysis possible; callers can also supply boardLocks explicitly.
  if (locks === undefined && boardTasks === undefined) {
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
    locks = body.locks;
  }
  return analyzePacketOwnership(plan, tasks || [], locks || []);
}
