#!/usr/bin/env node
/**
 * Check the two test-mock contracts implicated in WF-G314/G315 without running
 * tests or importing game code. Saving-throw factories must retain real exports;
 * combat utility factories must not invent the retired dice exports. The audit
 * recognizes static Vitest factories and reports unsupported shapes for review.
 * It cannot prove complete dynamic behavior, grant ownership or repair tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(SELF), '../..');
const ts = createRequire(path.join(REPO, 'package.json'))('typescript');
const retired = new Set(['rollDice', 'rollD20', 'rollDamage']);
const literal = node => node && ts.isStringLiteralLike(node) ? node.text : null;
const unwrap = node => {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))) node = node.expression;
  return node;
};
const kind = specifier => {
  const name = (specifier || '').replace(/\\/g, '/').replace(/\.[cm]?[jt]s$/, '');
  if (/(?:^|\/)utils\/character\/savingThrowUtils$/.test(name)) return 'saving';
  if (/(?:^|\/)utils\/combat(?:\/(?:combatUtils|index))?$/.test(name)) return 'combat';
  return null;
};
const propertyName = node => node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : null;

function returned(factory) {
  factory = unwrap(factory);
  if (!factory || !ts.isArrowFunction(factory) && !ts.isFunctionExpression(factory)) return [];
  if (!ts.isBlock(factory.body)) return [unwrap(factory.body)];
  const found = [];
  function visit(node) {
    if (node !== factory.body && (ts.isFunctionLike(node) || ts.isClassLike(node))) return;
    if (ts.isReturnStatement(node)) { found.push(unwrap(node.expression)); return; }
    ts.forEachChild(node, visit);
  }
  visit(factory.body);
  return found;
}

/** Static syntax evidence only; offsets let a reviewed repair keep unrelated text. */
export function inspectMockContracts(source, { file = 'fixture.test.ts' } = {}) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if (tree.parseDiagnostics.length) throw new Error('invalid test syntax: ' + file);
  const controls = new Set(['vi', 'vitest']);
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || literal(statement.moduleSpecifier) !== 'vitest') continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) {
      if (['vi', 'vitest'].includes(item.propertyName?.text || item.name.text)) controls.add(item.name.text);
    }
  }
  const method = (node, name) => ts.isPropertyAccessExpression(node) && controls.has(node.expression.getText(tree)) && node.name.text === name;
  const spreads = new Map();
  // Hoisted dice controls are literal objects in these suites. Do not guess the
  // shape of imported or computed spreads: those become review findings below.
  for (const statement of tree.statements) if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const value = unwrap(declaration.initializer);
      const objects = value && ts.isObjectLiteralExpression(value) ? [value]
        : value && ts.isCallExpression(value) && method(value.expression, 'hoisted') ? returned(value.arguments[0]) : [];
      if (objects.length === 1 && ts.isObjectLiteralExpression(objects[0]) && objects[0].properties.every(p => !ts.isSpreadAssignment(p))) {
        spreads.set(declaration.name.text, objects[0].properties.map(p => propertyName(p.name)).filter(Boolean));
      }
    }
  }
  const findings = [];
  let factories = 0;
  function visit(node) {
    if (!ts.isCallExpression(node) || !['mock', 'doMock'].some(name => method(node.expression, name))) {
      ts.forEachChild(node, visit); return;
    }
    const moduleArg = node.arguments[0];
    const specifier = literal(moduleArg) || (moduleArg && ts.isCallExpression(moduleArg) && moduleArg.expression.kind === ts.SyntaxKind.ImportKeyword ? literal(moduleArg.arguments[0]) : null);
    const moduleKind = kind(specifier);
    if (!moduleKind) { ts.forEachChild(node, visit); return; }
    factories++;
    const factory = unwrap(node.arguments[1]);
    const objects = returned(factory);
    const actualNames = new Set();
    const original = factory && (ts.isArrowFunction(factory) || ts.isFunctionExpression(factory)) ? factory.parameters[0]?.name.getText(tree) : null;
    if (factory && ts.isBlock(factory.body)) for (const statement of factory.body.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const value = declaration.initializer && ts.isAwaitExpression(declaration.initializer) ? unwrap(declaration.initializer.expression) : null;
        if (!ts.isIdentifier(declaration.name) || !value || !ts.isCallExpression(value)) continue;
        if (original && ts.isIdentifier(value.expression) && value.expression.text === original
          || method(value.expression, 'importActual') && kind(literal(value.arguments[0])) === moduleKind) actualNames.add(declaration.name.text);
      }
    }
    const report = (code, message, property) => findings.push({ file, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
      code, message, specifier, mockStart: node.getStart(tree), mockEnd: node.end,
      ...(property ? { propertyStart: property.getStart(tree), propertyEnd: property.end } : {}) });
    if (!objects.length || objects.some(o => !o || !ts.isObjectLiteralExpression(o))) {
      report('review-factory', 'Unsupported factory shape; inspect its real export contract.');
    } else for (const object of objects) {
      if (moduleKind === 'saving' && !object.properties.some(p => ts.isSpreadAssignment(p) && actualNames.has(p.expression.getText(tree)))) {
        report('saving-throw-full-mock', 'Keep the actual saving-throw exports and override only intentional test controls.');
      }
      if (moduleKind === 'combat') for (const property of object.properties) {
        if (ts.isSpreadAssignment(property)) {
          const name = property.expression.getText(tree);
          if (actualNames.has(name)) continue;
          const names = spreads.get(name);
          if (!names) report('review-spread', 'Computed/imported mock spread needs export review: ' + name, property);
          else if (names.some(n => retired.has(n))) report('retired-dice-export', 'Retired dice exports injected through ' + name, property);
        } else if (retired.has(propertyName(property.name))) report('retired-dice-export', 'Combat utilities no longer export ' + propertyName(property.name), property);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return { file, factories, findings };
}

export function mockContractAudit({ tests, repoRoot = REPO }) {
  if (!Array.isArray(tests) || !tests.length) throw new Error('name explicit test scopes');
  const root = fs.realpathSync(repoRoot), files = new Set();
  const within = file => { const r = path.relative(root, file); return !path.isAbsolute(r) && r !== '..' && !r.startsWith('..' + path.sep); };
  function walk(file) {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) if (!['node_modules', '.git', 'dist', 'build'].includes(name)) walk(path.join(file, name));
    } else if (/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(file)) files.add(file);
  }
  for (const scope of tests) {
    const file = path.resolve(root, scope);
    if (!within(file) || !within(fs.realpathSync(file))) throw new Error('test scope escapes repository: ' + scope);
    if (fs.statSync(file).isFile() && !/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(file)) throw new Error('scope must be a test file or directory');
    walk(file);
  }
  const reports = [...files].sort().map(file => inspectMockContracts(fs.readFileSync(file, 'utf8'), { file: path.relative(root, file).replace(/\\/g, '/') }));
  return { files: reports.length, factories: reports.reduce((n, r) => n + r.factories, 0), findings: reports.flatMap(r => r.findings) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  try {
    const args = process.argv.slice(2), tests = [];
    let json = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--tests' && args[i + 1] && !args[i + 1].startsWith('--')) tests.push(args[++i]);
      else if (args[i] === '--json') json = true;
      else throw new Error('Usage: node tools/agora/mockContractAudit.mjs --tests <subtree-or-test> [--tests ...] [--json]');
    }
    const result = mockContractAudit({ tests });
    console.log(json ? JSON.stringify(result, null, 2) : `${result.files} tests inspected; ${result.factories} matching factories; ${result.findings.length} findings\n`
      + result.findings.map(f => `${f.file}:${f.line} ${f.code}: ${f.message}`).join('\n'));
    if (result.findings.length) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
