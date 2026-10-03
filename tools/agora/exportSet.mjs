#!/usr/bin/env node
// tools/agora/exportSet.mjs
// WF-G132 (2026-09-09): print the export set of one or more TypeScript modules.
//
// WHY. Every file split in the modularization wave (agora-907c.5..14) must
// prove that the barrel left behind exports EXACTLY what the original did.
// Each splitter wrote its own one-off TypeScript-checker script for that, and
// because the worker scratchpad lives outside the repo, `import 'typescript'`
// failed there and had to be hardcoded to an absolute path. This is the
// shared helper: run it before the cut, run it after, diff the two outputs.
//
// WHAT it prints. One line per exported symbol, `name<TAB>kinds`, sorted by
// name, so two runs diff cleanly. Re-exports (`export * from`) are followed,
// which is the point: a barrel must resolve to the same names as the file it
// replaced. Type-only exports are listed with their kind (interface, type
// alias, enum) so a lost type is as visible as a lost function.
//
// USAGE
//   node tools/agora/exportSet.mjs src/systems/spells/effects/triggerHandler.ts > before.txt
//   ... cut ...
//   node tools/agora/exportSet.mjs src/systems/spells/effects/triggerHandler.ts > after.txt
//   diff before.txt after.txt      # exit 0 = same export set
//
// Several files may be named; each gets a `# <path>` header. `--json` emits
// `{ file: { name: [kinds] } }` instead. Exit 1 when a file is missing.
//
// Called by: split workers, AGENT.md (WF-G132)
// Depends on: the repository's installed TypeScript and tsconfig.json

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
// Resolve TypeScript from the repository, never from the caller's cwd: the
// caller's scratchpad has no node_modules (the failure that motivated this).
const require = createRequire(path.join(REPO_ROOT, 'package.json'));
const ts = require('typescript');

/** Map a symbol's flags to the short kind names a reader recognizes. */
function kindsOf(symbol, checker) {
  const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const f = target.flags;
  const kinds = [];
  if (f & ts.SymbolFlags.Function) kinds.push('function');
  if (f & ts.SymbolFlags.Class) kinds.push('class');
  if (f & ts.SymbolFlags.Interface) kinds.push('interface');
  if (f & ts.SymbolFlags.TypeAlias) kinds.push('type');
  if (f & ts.SymbolFlags.Enum) kinds.push('enum');
  if (f & ts.SymbolFlags.Variable) kinds.push('const');
  if (f & ts.SymbolFlags.Namespace && !(f & ts.SymbolFlags.Enum)) kinds.push('namespace');
  return kinds.length ? kinds : ['value'];
}

/** The export set of one module: { name: [kinds] }. */
export function exportSetOf(file, { repoRoot = REPO_ROOT } = {}) {
  const absolute = path.resolve(repoRoot, file);
  if (!fs.existsSync(absolute)) throw new Error(`no such file: ${file}`);
  const configPath = ts.findConfigFile(repoRoot, ts.sys.fileExists, 'tsconfig.json');
  let options = { allowJs: true, jsx: ts.JsxEmit.ReactJSX, moduleResolution: ts.ModuleResolutionKind.Bundler };
  if (configPath) {
    const raw = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, path.dirname(configPath));
    options = { ...parsed.options, noEmit: true, skipLibCheck: true };
  }
  const program = ts.createProgram([absolute], options);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(absolute);
  if (!source) throw new Error(`TypeScript did not load ${file}`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const out = {};
  if (!moduleSymbol) return out;
  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    out[symbol.getName()] = kindsOf(symbol, checker);
  }
  return out;
}

function main(argv) {
  const json = argv.includes('--json');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    process.stderr.write('Usage: node tools/agora/exportSet.mjs [--json] <file.ts> [<file.tsx>...]\n');
    return 2;
  }
  const result = {};
  for (const file of files) {
    try {
      result[file] = exportSetOf(file);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
  }
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }
  for (const [file, set] of Object.entries(result)) {
    process.stdout.write(`# ${file}  (${Object.keys(set).length} exports)\n`);
    for (const name of Object.keys(set).sort()) {
      process.stdout.write(`${name}\t${set[name].join(',')}\n`);
    }
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.exit(main(process.argv.slice(2)));
}
