#!/usr/bin/env node
// tools/agora/hookOrder.mjs
// WF-G138 (2026-09-09): print the ordered list of React hook calls inside each
// function of a module, so a component or hook split can prove that hook-call
// order did not change.
//
// WHY. `exportSet.mjs` proves a barrel exports what the original did, but for
// a React component the thing that actually breaks on a split is the ORDER of
// hook calls (React's rules of hooks). Every splitter in the agora-907c wave
// argued that order by hand in a paragraph; agora-907c.11 asked for this.
//
// WHAT it prints. For every top-level function, arrow function assigned to a
// const, or exported function, one block:
//   ## <functionName>
//   useRef
//   useEffect
//   useMyCustomHook
// Hook calls are identifiers or property accesses whose final name starts with
// `use` followed by an upper-case letter, counted in source order, INCLUDING
// calls nested in blocks (a conditional hook is a bug the reader should see,
// so it is printed with a `?` prefix when inside an if/loop/ternary/logical).
// Nested function bodies (callbacks, inner arrows) are NOT descended into:
// a hook inside a callback is not part of the component's call sequence.
//
// USAGE
//   node tools/agora/hookOrder.mjs src/components/BattleMap/BattleMap.tsx > before.txt
//   ... cut ...
//   node tools/agora/hookOrder.mjs src/components/BattleMap/BattleMap.tsx > after.txt
//   diff before.txt after.txt      # empty = same hook-call order per function
//
// Called by: split workers, AGENT.md (WF-G138)
// Depends on: the repository's installed TypeScript (parser only, no type check)

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const require = createRequire(path.join(REPO_ROOT, 'package.json'));
const ts = require('typescript');

const HOOK_NAME = /^use[A-Z0-9]/;

function calleeName(node) {
  const e = node.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

/** Ordered hook calls in one function body, without descending into nested functions. */
export function hookCallsIn(fn) {
  const out = [];
  function walk(node, conditional) {
    if (node !== fn && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))) {
      return; // a hook in a callback is not part of this function's sequence
    }
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      if (name && HOOK_NAME.test(name)) out.push((conditional ? '?' : '') + name);
    }
    const branch = ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isForStatement(node)
      || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isWhileStatement(node)
      || ts.isDoStatement(node) || ts.isSwitchStatement(node)
      || (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        || node.operatorToken.kind === ts.SyntaxKind.BarBarToken || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken));
    ts.forEachChild(node, (child) => walk(child, conditional || branch));
  }
  ts.forEachChild(fn, (child) => walk(child, false));
  return out;
}

/** { functionName: [hook, ...] } for every named function in the module, in source order. */
export function hookOrderOf(file, { repoRoot = REPO_ROOT } = {}) {
  const absolute = path.resolve(repoRoot, file);
  if (!fs.existsSync(absolute)) throw new Error(`no such file: ${file}`);
  const text = fs.readFileSync(absolute, 'utf8');
  const kind = /\.tsx$/.test(absolute) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(absolute, text, ts.ScriptTarget.Latest, true, kind);
  const result = {};
  function record(name, fn) {
    if (!fn) return;
    const calls = hookCallsIn(fn);
    if (calls.length) result[name] = calls;
  }
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name) record(node.name.text, node);
    else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        let init = decl.initializer;
        // React.memo(fn) / forwardRef(fn) / observer(fn): unwrap one call.
        if (ts.isCallExpression(init) && init.arguments.length && (ts.isArrowFunction(init.arguments[0]) || ts.isFunctionExpression(init.arguments[0]))) {
          init = init.arguments[0];
        }
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) record(decl.name.text, init);
      }
    } else if (ts.isExportAssignment(node) && (ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression))) {
      record('default', node.expression);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}

function main(argv) {
  const json = argv.includes('--json');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    process.stderr.write('Usage: node tools/agora/hookOrder.mjs [--json] <file.tsx> [<file.ts>...]\n');
    return 2;
  }
  const all = {};
  for (const file of files) {
    try {
      all[file] = hookOrderOf(file);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
  }
  if (json) {
    process.stdout.write(`${JSON.stringify(all, null, 2)}\n`);
    return 0;
  }
  for (const [file, fns] of Object.entries(all)) {
    process.stdout.write(`# ${file}\n`);
    for (const [name, calls] of Object.entries(fns)) {
      process.stdout.write(`## ${name}  (${calls.length} hook calls)\n`);
      for (const c of calls) process.stdout.write(`${c}\n`);
    }
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  process.exit(main(process.argv.slice(2)));
}
