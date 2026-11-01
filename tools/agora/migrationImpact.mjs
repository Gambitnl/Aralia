#!/usr/bin/env node
// WF-G312: show which tests may lose their controls when a module is retired.
// Orchestrators run this BEFORE assigning a migration, then give each reported
// test a real owner. It reads syntax and the existing TypeScript path aliases;
// it never imports test code, compiles the game, edits files or grants ownership.
// Matches are evidence for review, not proof of failure or a complete runtime
// call graph. Computed module targets are reported as unresolved candidates.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(FILE), '..', '..');
const ts = createRequire(path.join(REPO, 'package.json'))('typescript');
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const slash = value => value.replace(/\\/g, '/');
const stem = file => slash(file).replace(/(?:\.d)?\.[cm]?[jt]sx?$/i, '');
const literal = node => node && (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;

function within(root, file) {
  const relative = path.relative(root, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}

/** Discover only the explicitly requested test subtree, without following links. */
function testFiles(root, scopes) {
  const found = new Set();
  function visit(file) {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) {
        if (['node_modules', '.git', 'dist', 'build'].includes(name)) continue;
        visit(path.join(file, name));
      }
    } else if (stat.isFile() && TEST_FILE.test(file)) found.add(file);
  }
  for (const scope of scopes) {
    const file = path.resolve(root, scope);
    if (!within(root, file) || !within(root, fs.realpathSync(file))) throw new Error('test scope escapes repository: ' + scope);
    if (fs.statSync(file).isFile() && !TEST_FILE.test(file)) throw new Error('scope is not a test file: ' + scope);
    visit(file);
  }
  return [...found].sort();
}

function memberParts(node) {
  if (ts.isIdentifier(node)) return [node.text];
  if (ts.isPropertyAccessExpression(node)) return [...memberParts(node.expression), node.name.text];
  if (ts.isElementAccessExpression(node) && literal(node.argumentExpression) !== null) {
    return [...memberParts(node.expression), literal(node.argumentExpression)];
  }
  return [];
}

export function migrationImpact({ module, symbols, tests, repoRoot = REPO }) {
  if (!module || !Array.isArray(symbols) || !symbols.length || symbols.some(name => typeof name !== 'string' || !name.trim())) {
    throw new Error('name one source module and at least one moved export with --symbol');
  }
  if (!Array.isArray(tests) || !tests.length) throw new Error('name the affected test subtree with --tests');
  const root = fs.realpathSync(repoRoot);
  const target = path.resolve(root, module);
  if (!within(root, target) || !within(root, fs.realpathSync(target)) || !fs.statSync(target).isFile()) {
    throw new Error('source module must be an existing file inside the repository');
  }
  const moved = new Set(symbols);
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
  let options = { allowJs: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext };
  if (configPath) {
    // Read extends/aliases but do not enumerate or typecheck the whole project.
    const config = ts.getParsedCommandLineOfConfigFile(configPath, { noEmit: true }, {
      ...ts.sys, readDirectory: () => [], onUnRecoverableConfigFileDiagnostic: diagnostic => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    });
    const errors = config.errors.filter(error => error.code !== 18003);
    if (errors.length) throw new Error(ts.flattenDiagnosticMessageText(errors[0].messageText, '\n'));
    options = config.options;
  }
  const parsed = new Map();
  function source(file) {
    if (!within(root, file) || !fs.existsSync(file)) return null;
    if (!within(root, fs.realpathSync(file))) return null;
    if (!parsed.has(file)) {
      const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      if (tree.parseDiagnostics.length) {
        throw new Error('cannot reliably scan invalid syntax in ' + slash(path.relative(root, file)) + ': '
          + ts.flattenDiagnosticMessageText(tree.parseDiagnostics[0].messageText, '\n'));
      }
      parsed.set(file, tree);
    }
    return parsed.get(file);
  }
  const resolutionCache = ts.createModuleResolutionCache(root, name => name, options);
  function resolve(specifier, importer) {
    return ts.resolveModuleName(specifier, importer, options, ts.sys, resolutionCache).resolvedModule?.resolvedFileName;
  }
  // Follow static re-export barrels, including renamed exports. Cycles are
  // bounded per route. We do not guess about require-based or computed barrels.
  function traceRoute(file, exported = '*', seen = new Set()) {
    if (!file) return false;
    if (stem(file) === stem(target)) return exported === '*' || moved.has(exported);
    const key = file + '\0' + exported;
    if (seen.has(key)) return false;
    const nextSeen = new Set(seen).add(key);
    const tree = source(file);
    if (!tree) return false;
    return tree.statements.some(statement => {
      if (!ts.isExportDeclaration(statement) || literal(statement.moduleSpecifier) === null) return false;
      const dependency = resolve(literal(statement.moduleSpecifier), file);
      if (!statement.exportClause) return traceRoute(dependency, exported, nextSeen);
      if (ts.isNamedExports(statement.exportClause)) {
        return statement.exportClause.elements.some(item => (exported === '*' || item.name.text === exported)
          && traceRoute(dependency, (item.propertyName || item.name).text, nextSeen));
      }
      return exported === '*' && traceRoute(dependency, '*', nextSeen);
    });
  }
  // Tests repeatedly import the same large barrels. Cache only complete top
  // level routes; a nested cycle's temporary "seen" result must not poison it.
  const routeCache = new Map();
  function routesToTarget(file, exported = '*') {
    const key = file + '\0' + exported;
    if (!routeCache.has(key)) routeCache.set(key, traceRoute(file, exported));
    return routeCache.get(key);
  }

  const files = testFiles(root, tests);
  const findings = [];
  for (const file of files) {
    const tree = source(file);
    const controls = new Set(['vi', 'jest']);
    const namespaces = new Map();
    const seen = new Set();
    function add(node, kind, detail, certainty = 'reference') {
      const key = node.getStart(tree) + '\0' + kind + '\0' + detail;
      if (seen.has(key)) return;
      seen.add(key);
      const location = tree.getLineAndCharacterOfPosition(node.getStart(tree));
      findings.push({ file: slash(path.relative(root, file)), line: location.line + 1,
        column: location.character + 1, kind, detail, certainty });
    }
    function moduleTarget(node, specifier, kind) {
      // Vitest also accepts mock(import('path')); the nested import is still
      // a static target, unlike mock(variable) or import(computedExpression).
      const name = specifier && ts.isCallExpression(specifier)
        && specifier.expression.kind === ts.SyntaxKind.ImportKeyword
        ? literal(specifier.arguments[0]) : literal(specifier);
      if (name === null) {
        add(node, 'unresolved-module-target', kind + ': computed target; inspect manually', 'candidate');
      } else if (routesToTarget(resolve(name, file))) add(node, kind, name);
    }
    for (const statement of tree.statements) {
      if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
      const specifier = literal(statement.moduleSpecifier);
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const item of bindings.elements) {
          const imported = (item.propertyName || item.name).text;
          if (['vitest', '@jest/globals'].includes(specifier) && ['vi', 'jest'].includes(imported)) controls.add(item.name.text);
          const routed = specifier !== null && routesToTarget(resolve(specifier, file), imported);
          if (routed || moved.has(imported)) add(item, 'moved-symbol-import', imported + ' from ' + specifier,
            routed ? 'reference' : 'candidate');
        }
      } else if (bindings && ts.isNamespaceImport(bindings) && specifier !== null) {
        namespaces.set(bindings.name.text, specifier);
        if (routesToTarget(resolve(specifier, file))) add(bindings, 'module-namespace-import', specifier, 'candidate');
      }
      if (statement.importClause.name && specifier !== null && routesToTarget(resolve(specifier, file), 'default')) {
        add(statement, 'moved-symbol-import', 'default from ' + specifier);
      }
    }
    function visit(node) {
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const parts = memberParts(node);
        if (parts.length === 2 && namespaces.has(parts[0])
          && (moved.has(parts[1]) || routesToTarget(resolve(namespaces.get(parts[0]), file), parts[1]))) {
          const routed = routesToTarget(resolve(namespaces.get(parts[0]), file), parts[1]);
          add(node, 'moved-namespace-access', parts.join('.') + ' from ' + namespaces.get(parts[0]), routed ? 'reference' : 'candidate');
        }
      }
      if (ts.isCallExpression(node)) {
        const parts = memberParts(node.expression);
        if (parts.length === 2 && controls.has(parts[0]) && ['mock', 'doMock', 'unmock', 'doUnmock'].includes(parts[1])) {
          moduleTarget(node, node.arguments[0], 'module-' + parts[1]);
        }
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword || parts.join('.') === 'require') {
          moduleTarget(node, node.arguments[0], 'module-' + (parts.join('.') === 'require' ? 'require' : 'dynamic-import'));
        }
        if (parts.length === 2 && controls.has(parts[0]) && parts[1] === 'spyOn'
          && node.arguments[0] && memberParts(node.arguments[0]).join('.') === 'Math'
          && literal(node.arguments[1]) === 'random') add(node, 'math-random-spy', parts[0] + '.spyOn(Math, random)');
        if (parts.length === 2 && controls.has(parts[0]) && parts[1] === 'spyOn' && node.arguments[0]) {
          const binding = memberParts(node.arguments[0]).join('.');
          const name = literal(node.arguments[1]);
          if (namespaces.has(binding) && name !== null
            && (moved.has(name) || routesToTarget(resolve(namespaces.get(binding), file), name))) {
            const routed = routesToTarget(resolve(namespaces.get(binding), file), name);
            add(node, 'moved-export-spy', binding + '.' + name + ' from ' + namespaces.get(binding), routed ? 'reference' : 'candidate');
          }
        }
        if (parts.length === 2 && controls.has(parts[0]) && parts[1] === 'stubGlobal'
          && literal(node.arguments[0]) === 'Math') add(node, 'math-global-stub', 'inspect the stubbed Math object', 'candidate');
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && memberParts(node.left).join('.') === 'Math.random') add(node, 'math-random-override', 'Math.random assignment');
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column || a.kind.localeCompare(b.kind));
  return { module: slash(path.relative(root, target)), symbols: [...moved].sort(), tests: tests.map(slash),
    scannedTests: files.length, affectedTests: new Set(findings.map(item => item.file)).size, findings,
    limits: 'Static syntax evidence, not runtime failure proof. Computed targets, namespace imports and same-name imports elsewhere need review. Does not follow variable aliases, require-based barrels, globalThis.Math or wrapper helpers. No files or board records changed.' };
}

export function formatMigrationImpact(report) {
  return ['Migration test impact: ' + report.module + ' [' + report.symbols.join(', ') + ']',
    report.scannedTests + ' tests scanned; ' + report.affectedTests + ' tests with references or candidates.',
    ...report.findings.map(item => item.file + ':' + item.line + ':' + item.column + ' [' + item.kind + ', '
      + item.certainty + '] ' + item.detail), report.limits].join('\n');
}

function main(argv) {
  const args = { symbols: [], tests: [] };
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--json') { json = true; continue; }
    if (flag === '--help') {
      console.log('Usage: node tools/agora/migrationImpact.mjs --module <source-file> --symbol <moved-export> [--symbol ...] --tests <subtree-or-test> [--tests ...] [--json]');
      return;
    }
    if (!['--module', '--symbol', '--tests'].includes(flag) || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new Error('unknown or incomplete argument: ' + flag);
    }
    const value = argv[++i];
    if (flag === '--module') args.module = value;
    if (flag === '--symbol') args.symbols.push(value);
    if (flag === '--tests') args.tests.push(value);
  }
  const report = migrationImpact(args);
  console.log(json ? JSON.stringify(report, null, 2) : formatMigrationImpact(report));
}

if (process.argv[1] && path.resolve(process.argv[1]) === FILE) {
  try { main(process.argv.slice(2)); } catch (error) { console.error('migration impact:', error.message); process.exitCode = 1; }
}
