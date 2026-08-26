/**
 * Regression evidence for syntax-aware debt discovery. These fixtures protect
 * unfinished work from being hidden and ordinary examples from creating tasks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSource } from './sweep-syntax.mjs';

const types = (result) => result.findings.map((finding) => finding.type);
const allComments = (result) => result.lines.flatMap((line) => line.comments).join('\n');

test('JSX closing tags do not hide subsequent debt, and JSX text is not a comment', () => {
  const source = [
    'const x = <div>hello // TODO: visible copy /* more copy */</div>;',
    '// TODO: implement',
    'const y = <div>{/* TODO: real JSX comment */}<span title="// TODO: title" /></div>;',
  ].join('\n');
  const result = analyzeSource(source, 'fixture.tsx');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.lines[0].comments, []);
  assert.deepEqual(result.lines[1].comments, ['// TODO: implement']);
  assert.deepEqual(result.lines[2].comments, ['/* TODO: real JSX comment */']);
  assert.doesNotMatch(allComments(result), /visible copy|title/);
});

test('regex literals, division, example strings, and URLs never become executable debt', () => {
  const source = [
    'const regex = /["\']debugger; as any \\/\\/ TODO: regex/;',
    'const second = /as any/;',
    'const ratio = total / count / 2;',
    'const example = \'throw new Error("todo")\';',
    'const example2 = "console.trace( as any @ts-ignore";',
    'const url = "https://host/TODO:example";',
    '// TODO: after regex',
  ].join('\n');
  const result = analyzeSource(source, 'fixture.ts');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.findings, []);
  assert.equal(allComments(result), '// TODO: after regex');
  assert.doesNotMatch(result.lines[0].codeWithoutStrings, /debugger|as any|TODO/);
  assert.match(result.lines[2].codeWithoutStrings, /total \/ count \/ 2/);
});

test('nested template expressions retain real executable calls and comments', () => {
  const source = 'const value = `text // TODO: fake ${`nested ${console.trace(/* TODO: real */)}`} ${value as any}`;';
  const result = analyzeSource(source, 'fixture.ts');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(types(result), ['DEBUG_TRAP', 'AS_ANY_CAST']);
  assert.equal(allComments(result), '/* TODO: real */');
  assert.match(result.lines[0].codeWithoutStrings, /console\.trace/);
  assert.match(result.lines[0].codeWithoutStrings, /value as any/);
  assert.doesNotMatch(result.lines[0].codeWithoutStrings, /text|nested|TODO/);
});

test('multiline executable stubs retain full context and named ownership', () => {
  const source = [
    'class World {',
    '  build() {',
    '    throw new Error(',
    '      "not implemented"',
    '    );',
    '  }',
    '  entities = () => {',
    '    return (',
    '      {} as any',
    '    );',
    '  };',
    '}',
    'const values = items.filter(',
    '  (item) => { return true; }',
    ');',
    'console.warn(',
    '  "STUB: keep intent"',
    ');',
  ].join('\n');
  const result = analyzeSource(source, 'fixture.ts');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(types(result), ['THROW_UNIMPLEMENTED', 'DUMMY_RETURN_AS_ANY', 'AS_ANY_CAST', 'DUMMY_FILTER_STUB', 'CONSOLE_STUB']);
  assert.equal(result.findings[0].line, 3);
  assert.equal(result.findings[0].endLine, 5);
  assert.equal(result.findings[0].symbol, 'World.build');
  assert.equal(result.findings[0].context, 'throw new Error(\n      "not implemented"\n    );');
  assert.equal(result.findings[1].symbol, 'World.entities');
  assert.equal(result.findings[3].symbol, 'values');
  assert.equal(result.findings[0].offset, source.indexOf('throw'));
  assert.equal(source.slice(result.findings[0].offset, result.findings[0].endOffset), result.findings[0].context);
});

test('dummy returns and filters require the intended executable shapes', () => {
  const source = [
    'function a() { return null as any; }',
    'function b() { return [] as any; }',
    'function c() { return { real: true } as any; }',
    'function d() { return [real] as any; }',
    'items.filter(() => true);',
    'items.filter(item => item.active);',
    'items.filter(() => { update(); return true; });',
    'throw new Error("unrelated runtime failure");',
    'const stubText = "unimplemented";',
  ].join('\n');
  const result = analyzeSource(source, 'fixture.ts');
  assert.equal(types(result).filter((type) => type === 'DUMMY_RETURN_AS_ANY').length, 2);
  assert.equal(types(result).filter((type) => type === 'DUMMY_FILTER_STUB').length, 1);
  assert.equal(types(result).filter((type) => type === 'AS_ANY_CAST').length, 4);
  assert.equal(types(result).filter((type) => type === 'THROW_UNIMPLEMENTED').length, 0);
});

test('debugger statements and direct console calls are found inside syntax expressions', () => {
  const source = [
    'debugger;',
    'console.trace(); console.profile(); console.profileEnd(); console.time(); console.timeEnd();',
    'console["trace"]();',
    'const x = <p>{console.time("render")}</p>;',
    'const y = { debugger: true, trace: () => 1 };',
  ].join('\n');
  const result = analyzeSource(source, 'fixture.tsx');
  assert.deepEqual(result.errors, []);
  assert.equal(result.findings.length, 8);
  assert.ok(types(result).every((type) => type === 'DEBUG_TRAP'));
});

test('suppression directives must occur in actual comments including unprefixed block lines', () => {
  const source = [
    '/**',
    'Unprefixed explanation.',
    '@ts-expect-error: generated API is incomplete',
    '*/',
    'const data = 1;',
    '// eslint-disable-next-line @typescript-eslint/no-explicit-any -- preserve adapter',
    'const adapter: any = data;',
    'const text = "@ts-ignore eslint-disable @typescript-eslint/no-explicit-any";',
    'const regex = /@ts-ignore/;',
    'const jsx = <p>@ts-ignore</p>;',
  ].join('\n');
  const result = analyzeSource(source, 'fixture.tsx');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(types(result), ['TS_IGNORE_SUPPRESSION', 'ESLINT_TYPE_SUPPRESSION']);
  assert.equal(result.findings[0].line, 3);
  assert.equal(result.findings[1].line, 6);
  assert.equal(result.lines[1].isInsideComment, true);
  assert.deepEqual(result.lines[1].comments, ['Unprefixed explanation.']);
  assert.doesNotMatch(result.lines.slice(7).flatMap((line) => line.comments).join(''), /@ts-ignore/);
});

test('comment projections preserve boundaries and never join code across comments', () => {
  const source = '/* intro\r\nbody\r\n*/ const value = "C:\\\\Users\\\\sample"; // citation\r\n';
  const result = analyzeSource(source, 'fixture.ts');
  assert.equal(result.lines.length, 4);
  assert.equal(result.lines[1].hasExecutableCode, false);
  assert.equal(result.lines[2].hasExecutableCode, true);
  assert.equal(result.lines[2].isInsideComment, false);
  assert.deepEqual(result.lines[2].comments, ['*/', '// citation']);
  assert.deepEqual(result.lines[2].strings, ['C:\\\\Users\\\\sample']);
  assert.doesNotMatch(result.lines[2].codeWithoutStrings, /Users|citation/);
  assert.match(result.lines[2].code, /Users/);
});

test('imports are parsed across lines without matching examples or comments', () => {
  const source = [
    'import "./effects";',
    'import type {',
    '  Value',
    '} from "./types";',
    'export { value } from "./exported";',
    'const module = import(',
    '  "./dynamic"',
    ');',
    'const data = require("./required");',
    'type Model = import("./model").Model;',
    'import legacy = require("./legacy");',
    'const example = \'import fake from "./fake"\';',
    '// require("./comment")',
    'import(computedPath);',
  ].join('\n');
  const result = analyzeSource(source, 'fixture.ts');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.imports, [
    { specifier: './effects', line: 1, kind: 'import' },
    { specifier: './types', line: 2, kind: 'import' },
    { specifier: './exported', line: 5, kind: 'export' },
    { specifier: './dynamic', line: 6, kind: 'dynamic-import' },
    { specifier: './required', line: 9, kind: 'require' },
    { specifier: './model', line: 10, kind: 'import-type' },
    { specifier: './legacy', line: 11, kind: 'require' },
  ]);
});

test('valid JSON is data, while invalid JSON and malformed source report errors', () => {
  const json = analyzeSource('{"message":"debugger; as any // TODO: example","nested":{"a":1}}', 'data.json');
  assert.deepEqual(json.errors, []);
  assert.deepEqual(json.findings, []);
  assert.deepEqual(json.imports, []);
  assert.equal(allComments(json), '');
  assert.equal(json.lines[0].hasExecutableCode, false);
  assert.ok(analyzeSource('{"missing":}', 'data.json').errors.length > 0);
  const broken = analyzeSource('const x = ;\nfunction bad( {', 'fixture.ts');
  assert.ok(broken.errors.length > 0);
  assert.equal(broken.errors[0].line, 1);
});

test('JavaScript, JSX, and TypeScript generic syntax use their own language modes', () => {
  assert.deepEqual(analyzeSource('const id = <T>(value: T) => value;', 'generic.ts').errors, []);
  assert.deepEqual(analyzeSource('const view = <div>hello</div>; // TODO: continue', 'view.jsx').errors, []);
  assert.deepEqual(analyzeSource('export const value = `plain`;', 'module.mjs').errors, []);
});

test('comment ownership separates repeated findings by stable named scope', () => {
  const source = [
    '// TODO: implement',
    'function first() {',
    '  // TODO: implement',
    '  return null;',
    '}',
    'function second() {',
    '  // TODO: implement',
    '  return null;',
    '}',
  ].join('\n');
  const result = analyzeSource(source, 'fixture.ts');
  assert.equal(result.lines[0].symbol, 'first');
  assert.equal(result.lines[2].symbol, 'first');
  assert.equal(result.lines[6].symbol, 'second');
  const shifted = analyzeSource('\n\n' + source, 'fixture.ts');
  assert.equal(shifted.lines[4].symbol, result.lines[2].symbol);
  assert.equal(shifted.lines[8].symbol, result.lines[6].symbol);
});

test('finding spans stop at their statement so trailing multiline citations can be scoped', () => {
  const source = [
    'function build() {',
    '  return (',
    '    {} as any',
    '  ); // task-12',
    '}',
    'function unrelated() { return null; } // task-13',
  ].join('\n');
  const result = analyzeSource(source, 'fixture.ts');
  const stub = result.findings.find((finding) => finding.type === 'DUMMY_RETURN_AS_ANY');
  assert.equal(stub.line, 2);
  assert.equal(stub.endLine, 4);
  assert.equal(source.slice(stub.offset, stub.endOffset), 'return (\n    {} as any\n  );');
  assert.deepEqual(result.lines[stub.endLine - 1].comments, ['// task-12']);
  assert.doesNotMatch(stub.context, /task-13/);
});

test('masked projections preserve UTF-16 offsets through mixed newlines and adjacent ranges', () => {
  const source = 'const x = "😀";/*abc*/const y = /x/;\r\n'
    + 'const t = `hello\r${console.trace()} bye`; // note\n';
  const result = analyzeSource(source, 'fixture.ts');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.lines.map(line => line.code), [
    'const x = "😀";       const y = /x/;',
    'const t = `hello',
    '${console.trace()} bye`;        ',
    '',
  ]);
  assert.deepEqual(result.lines.map(line => line.codeWithoutStrings), [
    'const x =     ;       const y =    ;',
    'const t =       ',
    '  console.trace()      ;        ',
    '',
  ]);
  assert.deepEqual(result.lines.map(line => line.strings), [['😀'], ['hello'], [' bye'], []]);
  assert.equal(result.findings[0].line, 3);
  assert.equal(result.findings[0].offset, source.indexOf('console.trace'));
  for (const line of result.lines) {
    assert.equal(line.code.length, line.raw.length);
    assert.equal(line.codeWithoutStrings.length, line.raw.length);
  }
});
