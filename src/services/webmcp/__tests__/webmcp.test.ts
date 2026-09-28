/**
 * Tests for the WebMCP tool layer.
 *
 * Half of Remy's answer on proof: automated tests catch a break the day it
 * happens. The other half is the test page, which gives him something to look
 * at. Neither replaces the other.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkSupport, registerTool, WebMcpUnsupportedError } from '../modelContext';
import {
  registerSurface, listTools, findTool, activate, resetRegistry, activeSurfaces,
} from '../registry';
import {
  recordCall, getCounts, getBlockers, getEntries, clearLog, subscribe,
} from '../toolLog';
import type { AraliaTool } from '../types';

/** A stand-in for document.modelContext. The real one exists only in Chrome
 *  149+ with a flag on, which no test runner has. */
function installFakeModelContext() {
  const registered: Array<Record<string, unknown>> = [];
  const mc = {
    registerTool: (tool: Record<string, unknown>) => { registered.push(tool); },
    getTools: () => registered,
  };
  Object.defineProperty(document, 'modelContext', {
    value: mc, configurable: true, writable: true,
  });
  return registered;
}

function removeModelContext() {
  Reflect.deleteProperty(document as unknown as Record<string, unknown>, 'modelContext');
}

const tool = (over: Partial<AraliaTool> = {}): AraliaTool => ({
  name: 'test.doThing',
  description: 'Does the thing.',
  kind: 'read',
  execute: () => ({ text: 'done' }),
  ...over,
});

beforeEach(() => {
  resetRegistry();
  clearLog();
  removeModelContext();
});

describe('checkSupport', () => {
  it('reports the missing entry point in words a person can act on', () => {
    const r = checkSupport();
    expect(r.supported).toBe(false);
    expect(r.problem).toBe('no-model-context');
    // The message must name the flag; that is the whole point of it.
    expect(r.message).toContain('enable-webmcp-testing');
  });

  it('passes once document.modelContext is present', () => {
    installFakeModelContext();
    expect(checkSupport().supported).toBe(true);
  });

  it('catches a browser whose modelContext has no registerTool', () => {
    Object.defineProperty(document, 'modelContext', {
      value: {}, configurable: true, writable: true,
    });
    expect(checkSupport().problem).toBe('no-register');
  });
});

describe('registerTool', () => {
  it('fails loudly rather than pretending to register', () => {
    expect(() => registerTool(tool(), 'design-preview'))
      .toThrow(WebMcpUnsupportedError);
  });

  it('rejects a name the spec would not accept', () => {
    installFakeModelContext();
    expect(() => registerTool(tool({ name: 'bad name!' }), 'design-preview'))
      .toThrow(/breaks the WebMCP rule/);
  });

  it('marks a read tool read-only and leaves an act tool unmarked', () => {
    const got = installFakeModelContext();
    registerTool(tool({ name: 'a.read', kind: 'read' }), 'design-preview');
    registerTool(tool({ name: 'a.act', kind: 'act' }), 'design-preview');
    expect((got[0].annotations as Record<string, boolean>).readOnlyHint).toBe(true);
    expect((got[1].annotations as Record<string, boolean>).readOnlyHint).toBe(false);
  });

  it('sets the untrusted marker only on tools returning text a person typed', () => {
    const got = installFakeModelContext();
    registerTool(tool({ name: 'a.safe' }), 'design-preview');
    registerTool(tool({ name: 'a.risky', returnsPersonText: true }), 'design-preview');
    const ann = (i: number) => got[i].annotations as Record<string, boolean>;
    expect(ann(0).untrustedContentHint).toBe(false);
    expect(ann(1).untrustedContentHint).toBe(true);
  });

  it('logs a successful call and returns the spec content shape', async () => {
    const got = installFakeModelContext();
    registerTool(tool({ execute: () => ({ text: 'the answer' }) }), 'design-preview');
    const exec = got[0].execute as (i: Record<string, unknown>) => Promise<
      { content: Array<{ text: string }>; isError: boolean }>;
    const out = await exec({});
    expect(out.content[0].text).toBe('the answer');
    expect(out.isError).toBe(false);
    expect(getEntries()[0].outcome).toBe('ok');
  });

  it('turns a thrown error into a logged error, not a crash', async () => {
    const got = installFakeModelContext();
    registerTool(tool({ execute: () => { throw new Error('boom'); } }), 'design-preview');
    const exec = got[0].execute as (i: Record<string, unknown>) => Promise<
      { content: Array<{ text: string }>; isError: boolean }>;
    const out = await exec({});
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe('boom');
    expect(getEntries()[0].outcome).toBe('error');
  });
});

describe('registry', () => {
  it('collects features per surface and aggregates them centrally', () => {
    registerSurface({
      surface: 'design-preview', label: 'Design Preview', tools: [tool({ name: 'dp.one' })],
    });
    registerSurface({
      surface: 'planmap', label: 'Plan map', tools: [tool({ name: 'pm.one' })],
    });
    expect(listTools().map((t) => t.name)).toEqual(['dp.one', 'pm.one']);
    expect(findTool('pm.one')?.name).toBe('pm.one');
  });

  it('refuses two tools sharing one name across surfaces', () => {
    registerSurface({
      surface: 'design-preview', label: 'DP', tools: [tool({ name: 'same.name' })],
    });
    expect(() => registerSurface({
      surface: 'planmap', label: 'PM', tools: [tool({ name: 'same.name' })],
    })).toThrow(/already declared by the design-preview surface/);
  });

  it('lets a surface re-declare itself, so a hot reload does not double it', () => {
    const entry = {
      surface: 'design-preview' as const, label: 'DP', tools: [tool({ name: 'dp.one' })],
    };
    registerSurface(entry);
    registerSurface(entry);
    expect(listTools()).toHaveLength(1);
  });

  it('reports missing browser support instead of throwing, so the page renders', () => {
    registerSurface({ surface: 'planmap', label: 'PM', tools: [tool({ name: 'pm.one' })] });
    const res = activate('planmap');
    expect(res.registered).toBe(0);
    expect(res.unsupported).toContain('enable-webmcp-testing');
    expect(activeSurfaces()).toEqual([]);
  });

  it('registers every tool once support exists', () => {
    const got = installFakeModelContext();
    registerSurface({
      surface: 'planmap',
      label: 'PM',
      tools: [tool({ name: 'pm.one' }), tool({ name: 'pm.two' })],
    });
    expect(activate('planmap').registered).toBe(2);
    expect(got).toHaveLength(2);
    // A second activate must not hand the browser the same tools again.
    expect(activate('planmap').registered).toBe(2);
    expect(got).toHaveLength(2);
  });

  it('throws for a surface nobody declared', () => {
    expect(() => activate('game')).toThrow(/No tools declared/);
  });
});

describe('tool log', () => {
  const call = (over: Partial<Parameters<typeof recordCall>[0]> = {}) => recordCall({
    tool: 'x.one',
    surface: 'design-preview',
    kind: 'read',
    input: {},
    ms: 10,
    outcome: 'ok',
    detail: 'fine',
    ...over,
  });

  it('counts calls, errors and refusals per tool', () => {
    call();
    call({ outcome: 'error' });
    call({ outcome: 'refused' });
    const c = getCounts()[0];
    expect(c.calls).toBe(3);
    expect(c.errors).toBe(1);
    expect(c.refusals).toBe(1);
  });

  it('averages only successful calls, so a fast failure cannot flatter a slow tool', () => {
    call({ ms: 100 });
    call({ ms: 0, outcome: 'error' });
    expect(getCounts()[0].avgMs).toBe(100);
  });

  it('names a blocker: a tool that fails at least as often as it works', () => {
    call({ tool: 'good.one' });
    call({ tool: 'good.one' });
    call({ tool: 'bad.one', outcome: 'error' });
    call({ tool: 'bad.one', outcome: 'refused' });
    expect(getBlockers().map((c) => c.tool)).toEqual(['bad.one']);
  });

  it('does not call one failure a blocker', () => {
    call({ tool: 'once.failed', outcome: 'error' });
    expect(getBlockers()).toEqual([]);
  });

  it('orders the counts by how frequented a tool is', () => {
    call({ tool: 'rare.one' });
    call({ tool: 'busy.one' });
    call({ tool: 'busy.one' });
    expect(getCounts()[0].tool).toBe('busy.one');
  });

  it('keeps entries newest first', () => {
    call({ tool: 'first.one' });
    call({ tool: 'second.one' });
    expect(getEntries()[0].tool).toBe('second.one');
    expect(getEntries()[0].seq).toBe(2);
  });

  it('tells the panel when something happened', () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    call();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    call();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
