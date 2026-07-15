/**
 * @file scenarios.test.ts — the visual-test scenario registry is well-formed.
 * A broken scenario should fail here, not silently skip in the runner.
 */
import { describe, it, expect } from 'vitest';
import { SCENARIOS, validateScenarios, type VisScenario } from '../scenarios';

const GROUPS = ['entities', 'combat', 'world', 'interiors', 'crowds'] as const;

describe('vistest scenario registry', () => {
  it('has scenarios and validateScenarios finds no problems', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(8);
    expect(validateScenarios(SCENARIOS)).toEqual([]);
  });

  it('ids are unique and kebab-case', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('urls are relative (no leading slash, no host)', () => {
    for (const s of SCENARIOS) {
      expect(s.url.startsWith('/'), `${s.id} url has leading slash`).toBe(false);
      expect(s.url.includes('://'), `${s.id} url has a host`).toBe(false);
    }
  });

  it('every capture recipe ends with exactly one terminal step', () => {
    for (const s of SCENARIOS) {
      expect(s.capture.length, `${s.id} has an empty recipe`).toBeGreaterThan(0);
      const terminals = s.capture.filter((c) => c.kind === 'readback' || c.kind === 'screenshot');
      expect(terminals.length, `${s.id} must have exactly one terminal step`).toBe(1);
      const last = s.capture[s.capture.length - 1];
      expect(last.kind === 'readback' || last.kind === 'screenshot', `${s.id} terminal step must be last`).toBe(true);
    }
  });

  it('waitHook/eval steps carry non-empty code', () => {
    for (const s of SCENARIOS) {
      for (const step of s.capture) {
        if (step.kind === 'waitHook') expect(step.expr.trim().length, `${s.id} empty waitHook`).toBeGreaterThan(0);
        if (step.kind === 'eval') expect(step.js.trim().length, `${s.id} empty eval`).toBeGreaterThan(0);
      }
    }
  });

  it('groups are from the fixed set and notes are present', () => {
    for (const s of SCENARIOS) {
      expect(GROUPS).toContain(s.group);
      expect(s.notes.trim().length, `${s.id} has no notes`).toBeGreaterThan(10);
    }
  });

  it('validateScenarios reports duplicates and bad recipes', () => {
    const bad: VisScenario[] = [
      { id: 'dup', title: 'A', group: 'world', url: 'x.html', notes: 'long enough note here', capture: [{ kind: 'readback' }] },
      { id: 'dup', title: 'B', group: 'world', url: '/abs.html', notes: 'long enough note here', capture: [] },
    ];
    const problems = validateScenarios(bad);
    expect(problems.some((p) => p.includes('duplicate'))).toBe(true);
    expect(problems.some((p) => p.includes('leading slash'))).toBe(true);
    expect(problems.some((p) => p.includes('terminal'))).toBe(true);
  });
});

// --- runner pure helpers ----------------------------------------------------
import { scenarioUrl, captureCommand, outputPath } from '../runnerCore';

describe('vistest runner helpers', () => {
  const s: VisScenario = {
    id: 'demo-one',
    title: 'Demo',
    group: 'world',
    url: 'misc/design.html?step=vistest',
    notes: 'long enough note here',
    capture: [{ kind: 'screenshot' }],
  };

  it('joins base and relative url without double slashes', () => {
    expect(scenarioUrl('http://localhost:5174/Aralia/', s)).toBe('http://localhost:5174/Aralia/misc/design.html?step=vistest');
    expect(scenarioUrl('http://localhost:5174/Aralia', s)).toBe('http://localhost:5174/Aralia/misc/design.html?step=vistest');
  });

  it('builds the copyable capture command', () => {
    expect(captureCommand(s)).toBe('npx tsx tools/vistest/shoot.ts --only demo-one');
  });

  it('builds the output path from the id', () => {
    expect(outputPath('.agent/vistest/captures', s)).toBe('.agent/vistest/captures/demo-one.png');
  });
});
