/**
 * Keeps existing suite failures visible when a worker is given broad acceptance.
 * Reads Vitest JSON only; it never runs tests, excludes failures, edits source or
 * changes Agora records. Receipt timestamps/commands are evidence, not attestation.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_AGE = 2 * 60 * 60 * 1000;
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rootPath = root => fs.realpathSync(path.resolve(root));
const commandText = command => {
  if (typeof command !== 'string' || !command.trim() || command.length > 4096 || /[\r\n\x00]/.test(command)) throw new Error('Name one exact test command; it is recorded, never executed by this tool.');
  return command.trim();
};
function recent(time, now, label) {
  if (!Number.isFinite(time) || time <= 0 || time > now + 60000 || now - time > MAX_AGE) throw new Error(label + ' is missing, future-dated or older than two hours; collect fresh pre-edit evidence.');
}
export function readTestJson(file) {
  const stat = fs.statSync(file); if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('Test evidence must be a regular JSON file at most2MiB.');
  const bytes = fs.readFileSync(file); if (bytes.length > MAX_BYTES) throw new Error('Test evidence grew beyond2MiB.');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

// Test identity is file + full name, not a file-level failure count. A new
// failure inside an already-red file must never disappear through subtraction.
export function inspectVitestReport(report, { repoRoot, now = Date.now() } = {}) {
  const root = rootPath(repoRoot); recent(report?.startTime, now, 'Vitest run start');
  if (!Array.isArray(report.testResults) || !report.testResults.length || typeof report.success !== 'boolean') throw new Error('Incomplete Vitest JSON report: nonempty testResults and success are required.');
  const tests = [], failures = [], files = [], seen = new Set();
  for (const suite of report.testResults) {
    if (typeof suite.name !== 'string' || !Array.isArray(suite.assertionResults) || !['passed', 'failed'].includes(suite.status)) throw new Error('Malformed Vitest suite record.');
    const absolute = path.resolve(root, suite.name), relative = path.relative(root, absolute);
    if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw new Error('Suite is outside the named checkout: ' + suite.name);
    const file = relative.replace(/\\/g, '/'); if (files.includes(file)) throw new Error('Ambiguous duplicate suite: ' + file); files.push(file);
    if (!Number.isFinite(suite.endTime) || suite.endTime < report.startTime || suite.endTime > now + 60000) throw new Error('Suite completion timestamp is missing or inconsistent.');
    let assertionFailures = 0;
    for (const assertion of suite.assertionResults) {
      if (typeof assertion.fullName !== 'string' || !assertion.fullName || !['passed', 'failed', 'pending', 'skipped', 'todo', 'disabled'].includes(assertion.status)
        || !Array.isArray(assertion.failureMessages) || assertion.failureMessages.some(message => typeof message !== 'string')) throw new Error('Malformed Vitest assertion record.');
      const id = JSON.stringify([file, assertion.fullName]); if (seen.has(id)) throw new Error('Ambiguous duplicate test identity: ' + id); seen.add(id);
      const test = { id, file, name: assertion.fullName, status: assertion.status }; tests.push(test);
      if (assertion.status === 'failed') {
        assertionFailures++; if (!assertion.failureMessages.length) throw new Error('Failed assertion has no diagnostic: ' + id);
        failures.push({ ...test, kind: 'assertion', messages: assertion.failureMessages });
      }
    }
    if (suite.status === 'failed' && !assertionFailures) failures.push({ id: JSON.stringify([file, '<suite/hook>']), file, kind: 'suite', messages: [suite.message || 'Failed suite without an assertion diagnostic; investigate collection/hooks.'] });
    if (suite.status === 'passed' && assertionFailures) throw new Error('Suite status contradicts failed assertions.');
  }
  if (report.numTotalTests !== tests.length || report.numFailedTests !== tests.filter(test => test.status === 'failed').length
    || report.numPassedTests !== tests.filter(test => test.status === 'passed').length) throw new Error('Vitest totals contradict assertion inventory.');
  if (report.success !== (failures.length === 0) || report.numPendingTestSuites !== 0) throw new Error('Report contains incomplete or unrepresented suite failures.');
  const sort = values => values.sort((a, b) => String(a.id || a).localeCompare(String(b.id || b)));
  return { files: sort(files), tests: sort(tests), failures: sort(failures), startedAt: report.startTime, success: report.success };
}

export function captureTestBaseline(report, { repoRoot, command, now = Date.now() } = {}) {
  const root = rootPath(repoRoot), summary = inspectVitestReport(report, { repoRoot: root, now });
  return { schemaVersion: 1, kind: 'vitest-pre-edit-baseline', repoRoot: root, command: commandText(command), capturedAt: now,
    report, reportHash: digest(report), summary };
}
export function validateTestBaseline(receipt, { repoRoot, now = Date.now() } = {}) {
  if (receipt?.schemaVersion !== 1 || receipt.kind !== 'vitest-pre-edit-baseline' || receipt.repoRoot !== rootPath(repoRoot)) throw new Error('Baseline schema or checkout does not match.');
  recent(receipt.capturedAt, now, 'Baseline capture'); commandText(receipt.command);
  const summary = inspectVitestReport(receipt.report, { repoRoot, now });
  if (receipt.capturedAt < summary.startedAt || receipt.reportHash !== digest(receipt.report) || JSON.stringify(summary) !== JSON.stringify(receipt.summary)) throw new Error('Baseline report/summary/hash or timestamp is inconsistent.');
  return receipt;
}
export function baselineTaskText(receipt, options) {
  validateTestBaseline(receipt, options);
  const failedFiles = [...new Set(receipt.summary.failures.map(failure => failure.file))];
  return [
    'TEST BASELINE (WF-G284): pre-edit reporter evidence, not permission to ignore failures.',
    'Acceptance command: ' + receipt.command,
    'Run started: ' + new Date(receipt.summary.startedAt).toISOString() + '; captured: ' + new Date(receipt.capturedAt).toISOString(),
    'Report SHA256: ' + receipt.reportHash,
    'Known failing files: ' + (failedFiles.length ? failedFiles.join(', ') : 'none in this report'),
    'Known failure identities/diagnostics: ' + JSON.stringify(receipt.summary.failures),
    'Inventory: ' + receipt.summary.files.length + ' file(s), ' + receipt.summary.tests.length + ' test(s).',
    'Report the actual full-suite result plus inherited, changed/new and unverified failures separately. Never subtract a whole red file or call a still-red suite green. Recollect evidence if stale or the command/inventory changes. This baseline does not prove failure authorship, ownership or relevance to your change.',
  ].join('\n');
}

export function compareTestBaseline(receipt, report, { repoRoot, command, now = Date.now() } = {}) {
  validateTestBaseline(receipt, { repoRoot, now });
  if (commandText(command) !== receipt.command) throw new Error('Commands differ; do not compare differently scoped runs.');
  const after = inspectVitestReport(report, { repoRoot, now });
  if (after.startedAt < receipt.capturedAt) throw new Error('Post-edit report predates baseline capture.');
  if (JSON.stringify(after.files) !== JSON.stringify(receipt.summary.files)) throw new Error('Suite file inventories differ; no subtraction or acceptance is justified.');
  const oldTests = new Map(receipt.summary.tests.map(test => [test.id, test]));
  const nextTests = new Map(after.tests.map(test => [test.id, test]));
  const missingTests = [...oldTests.keys()].filter(id => !nextTests.has(id));
  const unverifiedTests = after.tests.filter(test => !['passed', 'failed'].includes(test.status));
  const priorFailures = new Map(receipt.summary.failures.map(failure => [failure.id, failure]));
  const inheritedFailures = [], regressions = [];
  for (const failure of after.failures) {
    const previous = priorFailures.get(failure.id);
    if (previous && JSON.stringify(previous.messages) === JSON.stringify(failure.messages)) inheritedFailures.push(failure);
    else regressions.push(failure);
  }
  const resolvedFailures = receipt.summary.failures.filter(failure => failure.kind === 'assertion'
    ? nextTests.get(failure.id)?.status === 'passed'
    : !after.failures.some(current => current.id === failure.id) && !unverifiedTests.some(test => test.file === failure.file));
  return { fullSuiteSuccess: after.success, acceptanceGreen: after.success && after.tests.length > 0 && !missingTests.length && !unverifiedTests.length,
    inheritedFailures, regressions, resolvedFailures, missingTests, unverifiedTests,
    note: 'Inherited failures remain failures. This comparison does not assign authorship or authorize unrelated repairs.' };
}

// File output is explicit, never overwrites an existing receipt. Capture and
// comparison accept supplied reports only; neither launches a test command.
async function main(args) {
  const [mode, ...rest] = args, flags = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]; if (!key?.startsWith('--') || !rest[i + 1] || rest[i + 1].startsWith('--') || Object.hasOwn(flags, key.slice(2))) throw new Error('Use named, unique --flag value arguments.');
    flags[key.slice(2)] = rest[i + 1];
  }
  const repoRoot = flags.root || process.cwd();
  if (mode === 'capture') {
    if (!flags.report || !flags.output) throw new Error('capture requires --report <vitest.json> --command <exact> --output <new receipt.json> [--root <checkout>].');
    const receipt = captureTestBaseline(readTestJson(flags.report), { repoRoot, command: flags.command });
    const encoded = JSON.stringify(receipt, null, 2); if (Buffer.byteLength(encoded, 'utf8') > MAX_BYTES) throw new Error('Receipt exceeds2MiB; choose a smaller focused scope, not truncated evidence.');
    fs.writeFileSync(flags.output, encoded, { flag: 'wx' }); console.log(baselineTaskText(receipt, { repoRoot }));
  } else if (mode === 'compare') {
    if (!flags.baseline || !flags.report) throw new Error('compare requires --baseline <receipt.json> --report <post.json> --command <same> [--root <checkout>].');
    const result = compareTestBaseline(readTestJson(flags.baseline), readTestJson(flags.report), { repoRoot, command: flags.command });
    console.log(JSON.stringify(result, null, 2)); if (!result.acceptanceGreen) process.exitCode = 1;
  } else throw new Error('Use capture or compare. This tool never runs tests.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error('Test baseline refused: ' + error.message); process.exitCode = 2; });
