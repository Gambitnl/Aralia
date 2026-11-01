/**
 * Inventory every tracked test and identify assertions that deserve review.
 * This reads source; it never declares a test pointless or deletes coverage.
 * Runtime inventories and mutation results are separate proof. Helpers, loops,
 * snapshots, and mocks can all be intentional, so heuristic findings stay labeled.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { nodeTestFiles } from '../ci/node-test-inventory.mjs';

const testPath = /(?:\.(?:test|spec)(?:-d)?\.(?:[cm]?[jt]sx?)$|(?:^|\/)test_[^/]+\.(?:[cm]?[jt]sx?|py)$|(?:^|\/)tests?\/.*\.py$)/;
const unwrap = node => {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)
    || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node))) node = node.expression;
  return node;
};
function chain(node) {
  node = unwrap(node);
  if (!node) return [];
  if (ts.isIdentifier(node)) return [node.text];
  if (ts.isPropertyAccessExpression(node)) return [...chain(node.expression), node.name.text];
  if (ts.isCallExpression(node)) return chain(node.expression);
  return [];
}
function literal(node) {
  node = unwrap(node);
  if (!node) return undefined;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  return undefined;
}
function stableReference(node) {
  node = unwrap(node);
  return node && (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) && stableReference(node.expression));
}
function visit(node, callback) { callback(node); ts.forEachChild(node, child => visit(child, callback)); }
function ancestry(node, stop, predicate) {
  for (let p = node.parent; p && p !== stop; p = p.parent) if (predicate(p)) return true;
  return false;
}
function expectCall(node, names) {
  if (ts.isCallExpression(node) && names.has(chain(node.expression)[0])) return node;
  if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node)) return expectCall(node.expression, names);
  return null;
}

export function analyzeTestSource(text, file) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    /x$/.test(file) ? ts.ScriptKind.TSX : /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const testNames = new Set(['test', 'it', 'specify', 'fit', 'xit', 'xtest']);
  const expectNames = new Set(['expect', 'expectTypeOf']);
  const assertNames = new Set(['assert']);
  const imports = [];
  let runner = /\.test-d\./.test(file) ? 'type' : 'unknown';
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    imports.push(specifier);
    if (specifier === 'vitest') runner = 'vitest';
    if (specifier === '@playwright/test') runner = 'playwright';
    if (specifier === 'node:test') runner = 'node';
    if (specifier === 'tsd') runner = 'type';
    if (specifier === 'node:test' && statement.importClause?.name) testNames.add(statement.importClause.name.text);
    if (/^(?:node:)?assert(?:\/strict)?$/.test(specifier) && statement.importClause?.name) assertNames.add(statement.importClause.name.text);
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
      const original = binding.propertyName?.text ?? binding.name.text;
      if (['it', 'test', 'specify'].includes(original)) testNames.add(binding.name.text);
      if (['expect', 'expectTypeOf'].includes(original)) expectNames.add(binding.name.text);
      if (/^(?:node:)?assert/.test(specifier)) assertNames.add(binding.name.text);
      if (specifier === 'tsd') assertNames.add(binding.name.text);
    }
  }
  const tests = [];
  const fileFindings = [];
  // A local assertion helper is real coverage. Follow named helpers so the
  // schema's rejection cases do not look empty merely because they delegate.
  const localFunctions = new Map();
  visit(sf, node => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) localFunctions.set(node.name.text, node.body);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) localFunctions.set(node.name.text, node.initializer.body);
  });
  const assertionHelpers = new Set();
  for (let pass = 0; pass < localFunctions.size + 1; pass++) {
    const before = assertionHelpers.size;
    for (const [name, body] of localFunctions) visit(body, node => {
      if (ts.isCallExpression(node) && (expectCall(node.expression, expectNames)
        || assertNames.has(chain(node.expression)[0]) || assertionHelpers.has(chain(node.expression)[0]))) assertionHelpers.add(name);
    });
    if (assertionHelpers.size === before) break;
  }
  const location = node => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  visit(sf, node => {
    if (!ts.isCallExpression(node)) return;
    const names = chain(node.expression);
    if (!testNames.has(names[0])) return;
    // A variable called `fit` is often a fitted layout, not Jasmine's focused
    // test function. Only actual test-registration modifiers belong to this DSL.
    if (names.slice(1).some(name => !['each', 'for', 'skip', 'todo', 'only', 'concurrent', 'sequential', 'skipIf', 'runIf', 'fails'].includes(name))) return;
    if (names.some(name => ['describe', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll', 'step', 'use', 'setTimeout', 'info', 'extend'].includes(name))) return;
    const cb = [...node.arguments].reverse().find(arg => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg));
    // .each(data) is a registration factory, not a second test case.
    if (!cb && !names.includes('todo') && !names.includes('skip')) return;
    if (!cb && (!node.arguments[0] || !ts.isStringLiteralLike(node.arguments[0]))) return;
    if (names.includes('each') && !cb) return;
    const first = node.arguments[0];
    const title = first && ts.isStringLiteralLike(first) ? first.text : '<dynamic title>';
    const row = { title, line: location(node), parameterized: names.includes('each') || names.includes('for'),
      disabled: names.some(n => ['skip', 'todo', 'xit', 'xtest'].includes(n)),
      focused: names.includes('only') || names[0] === 'fit', assertions: [], findings: [], calls: [], bodyHash: null };
    if (cb) {
      const printed = ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, cb.body, sf);
      row.bodyHash = createHash('sha256').update(printed).digest('hex');
      visit(cb.body, part => {
        if (ts.isThrowStatement(part)) row.assertions.push({ line: location(part), matcher: 'explicit-throw',
          conditional: ancestry(part, cb.body, p => ts.isIfStatement(p)), loop: ancestry(part, cb.body, p => ts.isForOfStatement(p)) });
        if (!ts.isCallExpression(part)) return;
        const parts = chain(part.expression);
        row.calls.push(parts.join('.'));
        const exp = expectCall(part.expression, expectNames);
        const isMatcher = exp && part !== exp && parts.length > 1;
        const isAssert = assertNames.has(parts[0]) || expectNames.has(parts[0]) && parts.at(-1) === 'fail';
        if (isMatcher || isAssert) {
          const matcher = parts.at(-1);
          const conditional = ancestry(part, cb.body, p => ts.isIfStatement(p) || ts.isConditionalExpression(p));
          const loop = ancestry(part, cb.body, p => ts.isForOfStatement(p) || ts.isForStatement(p)
            || ts.isCallExpression(p) && chain(p.expression).at(-1) === 'forEach');
          const assertion = { line: location(part), matcher, conditional, loop };
          row.assertions.push(assertion);
          if (exp) {
            const actual = unwrap(exp.arguments[0]);
            const expected = unwrap(part.arguments[0]);
            const a = literal(actual), b = literal(expected);
            if (a !== undefined && b !== undefined && ['toBe', 'toEqual', 'toStrictEqual'].includes(matcher) && a === b)
              row.findings.push({ kind: 'constant-assertion', confidence: 'high', line: location(part) });
            if (actual && expected && ['toBe', 'toEqual', 'toStrictEqual'].includes(matcher)
              && stableReference(actual)
              && actual.getText(sf) === expected.getText(sf))
              row.findings.push({ kind: 'self-comparison', confidence: 'high', line: location(part) });
            if (actual && ts.isPropertyAccessExpression(actual) && actual.name.text === 'length'
              && matcher === 'toBeGreaterThanOrEqual' && b === 0)
              row.findings.push({ kind: 'nonnegative-length', confidence: 'high', line: location(part) });
          }
        }
        if (parts[0] === 'console') row.findings.push({ kind: 'diagnostic-output', confidence: 'review', line: location(part) });
        if (parts.at(-1) === 'catch') row.findings.push({ kind: 'caught-error', confidence: 'review', line: location(part) });
      });
      if (!row.assertions.length && row.calls.some(call => assertionHelpers.has(call)))
        row.assertions.push({ line: row.line, matcher: 'delegated-local-helper', conditional: false, loop: false });
      if (!row.assertions.length && row.parameterized) {
        const parameters = new Set(cb.parameters.filter(p => ts.isIdentifier(p.name)).map(p => p.name.text));
        let fixtureAsserts = false;
        visit(node.expression, part => { if (ts.isCallExpression(part) && expectCall(part.expression, expectNames)) fixtureAsserts = true; });
        if (fixtureAsserts && row.calls.some(call => parameters.has(call)))
          row.assertions.push({ line: row.line, matcher: 'delegated-fixture-callback', conditional: false, loop: false });
      }
      if (ts.isBlock(cb.body) && cb.body.statements.length === 0 && !row.disabled)
        row.findings.push({ kind: 'empty-test', confidence: 'high', line: row.line });
      if (!row.assertions.length && !row.disabled) row.findings.push({ kind: 'no-local-assertion', confidence: 'review', line: row.line });
      if (row.assertions.length && row.assertions.every(a => a.conditional)) row.findings.push({ kind: 'all-assertions-conditional', confidence: 'review', line: row.line });
      if (row.assertions.length && row.assertions.every(a => a.loop)) row.findings.push({ kind: 'all-assertions-in-loops', confidence: 'review', line: row.line });
      if (row.assertions.length && row.assertions.every(a => ['toBeTruthy', 'toBeDefined', 'toBeInTheDocument'].includes(a.matcher)))
        row.findings.push({ kind: 'presence-only', confidence: 'review', line: row.line });
      if (row.assertions.length && row.assertions.every(a => /Snapshot/.test(a.matcher))) row.findings.push({ kind: 'snapshot-only', confidence: 'informational', line: row.line });
    }
    tests.push(row);
  });
  if (/\.test-d\./.test(file)) runner = 'type';
  if (!tests.length && runner !== 'type') fileFindings.push({ kind: 'no-recognized-registration', confidence: 'review', line: 1 });
  return { file, runner, imports, tests, fileFindings, parseErrors: sf.parseDiagnostics.map(d => ({
    line: sf.getLineAndCharacterOfPosition(d.start ?? 0).line + 1, message: ts.flattenDiagnosticMessageText(d.messageText, ' ') })) };
}

export function auditRepository(root) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
  const inventory = tracked.filter(file => testPath.test(file));
  const nodeInventory = new Set(nodeTestFiles(root));
  const files = inventory.map(file => /\.py$/.test(file)
    ? { file, runner: 'python', imports: [], tests: [], fileFindings: [{ kind: 'python-manual-review', confidence: 'review', line: 1 }], parseErrors: [] }
    : analyzeTestSource(fs.readFileSync(path.join(root, file), 'utf8'), file));
  for (const file of files) {
    if (nodeInventory.has(file.file)) file.runner = 'node';
    if (file.runner === 'unknown' && /\.test-d\./.test(file.file)) file.runner = 'type';
  }
  const groups = new Map();
  const findingCounts = {};
  const runners = {};
  for (const file of files) {
    runners[file.runner] = (runners[file.runner] ?? 0) + 1;
    for (const test of file.tests) {
      if (test.bodyHash) {
        const entries = groups.get(test.bodyHash) ?? [];
        entries.push({ file: file.file, title: test.title, line: test.line }); groups.set(test.bodyHash, entries);
      }
      for (const finding of test.findings) findingCounts[finding.kind] = (findingCounts[finding.kind] ?? 0) + 1;
    }
    for (const finding of file.fileFindings) findingCounts[finding.kind] = (findingCounts[finding.kind] ?? 0) + 1;
  }
  const duplicateBodies = [...groups.values()].filter(group => group.length > 1);
  return { schemaVersion: 1, revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    generatedAt: new Date().toISOString(), scope: 'Every tracked test/spec filename, including excluded runner lanes; lexical review is not execution or proof of uselessness.',
    trackedFiles: tracked.length, testFiles: files.length, registrations: files.reduce((n, f) => n + f.tests.length, 0),
    runners, findingCounts, duplicateBodies, files };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.cwd();
  const output = process.argv[2] ?? '.agent/scratch/test-value-audit/source-audit.json';
  const result = auditRepository(root);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ testFiles: result.testFiles, registrations: result.registrations, runners: result.runners,
    findingCounts: result.findingCounts, duplicateGroups: result.duplicateBodies.length, output }, null, 2));
}
