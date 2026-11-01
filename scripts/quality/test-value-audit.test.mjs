/** Protect review accuracy: examples, helpers, aliases and real branches differ. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTestSource } from './test-value-audit.mjs';
const analyze = text => analyzeTestSource(text, 'fixture.test.ts');
const findings = result => result.tests.flatMap(t => t.findings.map(f => f.kind));
test('literal and self comparisons are distinguished from actual behavior', () => {
  const result = analyze('it("x",()=>{expect(true).toBe(true);expect(result).toEqual(result);expect(actual).toBe(3);});');
  assert.deepEqual(findings(result), ['constant-assertion', 'self-comparison']);
  assert.equal(result.tests[0].assertions.length, 3);
});
test('array lengths cannot prove that a producer returned missing entries', () => {
  assert.ok(findings(analyze('it("x",()=>{expect(items.length).toBeGreaterThanOrEqual(0);});')).includes('nonnegative-length'));
  assert.equal(findings(analyze('it("x",()=>{expect(value).toBeGreaterThanOrEqual(0);});')).length, 0);
});
test('aliased imports and Node assertions retain their runner and checks', () => {
  const result = analyze('import {it as check,expect as verify} from "vitest";check("x",()=>verify(value).toBe(2));');
  assert.equal(result.runner, 'vitest'); assert.equal(result.tests[0].assertions.length, 1);
  const node = analyze('import check from "node:test";import proof from "node:assert/strict";check("x",()=>proof.equal(value,2));');
  assert.equal(node.runner, 'node'); assert.equal(node.tests[0].assertions.length, 1);
});
test('disabled registrations and parameterized factories are counted once', () => {
  const result = analyze('it.each([1,2])("x", x=>expect(x).toBeGreaterThan(0));test.todo("y");test.skip("z",()=>{});');
  assert.equal(result.tests.length, 3); assert.equal(result.tests[0].parameterized, true);
  assert.equal(result.tests.filter(t=>t.disabled).length, 2);
});
test('conditional and empty loop risks remain review findings', () => {
  assert.ok(findings(analyze('it("x",()=>{if (found) expect(found).toBe(2);});')).includes('all-assertions-conditional'));
  assert.ok(findings(analyze('it("x",()=>{items.forEach(x=>expect(x).toBe(2));});')).includes('all-assertions-in-loops'));
  assert.ok(findings(analyze('it("x",()=>assertFixtureWorks());')).includes('no-local-assertion'));
});
test('comments and strings do not create assertions or tests', () => {
  assert.equal(analyze('// it("x",()=>expect(true).toBe(true));\nconst text = "it() expect()";').tests.length, 0);
});
test('Playwright hooks and suites are not extra tests', () => {
  const result = analyze('test.describe("suite",()=>{test.beforeEach(()=>{});test("real",()=>expect(value).toBe(2));});');
  assert.equal(result.tests.length, 1); assert.equal(result.tests[0].title, 'real');
});
test('repeated function calls are determinism checks, not self comparisons', () => {
  assert.equal(findings(analyze('it("x",()=>expect(generate().windows).toEqual(generate().windows));')).length, 0);
});
test('local helpers prove rejection, while an empty test proves nothing', () => {
  const result = analyze('const bad=x=>expect(parse(x)).toThrow();it("rejects",()=>bad(null));it("empty",()=>{});');
  assert.equal(result.tests[0].assertions[0].matcher, 'delegated-local-helper');
  assert.ok(result.tests[1].findings.some(f=>f.kind==='empty-test'));
});
test('a fitted layout variable and runtime skip do not register extra tests', () => {
  const result = analyze('it("real",()=>{const fit=[];fit.map(x=>x);test.skip(!ready,"fixture absent");expect(value).toBe(2);});');
  assert.equal(result.tests.length, 1); assert.equal(result.tests[0].focused, false);
});
test('parameterized fixture callbacks carry real assertions', () => {
  const result = analyze('it.each([["x",x=>expect(x).toBe(1)]])("row",(_,assertRow)=>assertRow(1));');
  assert.equal(result.tests[0].assertions[0].matcher, 'delegated-fixture-callback');
});
