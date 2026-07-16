/**
 * @file creaturePlanRoutes.test.ts — the text-to-creature devhub routes.
 * Every test injects a fake CLI runner; nothing here talks to the real CLI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import {
  handleCreaturePlanRoutes,
  setLibraryDirForTests,
  type CliRunner,
  type CreatureLibraryEntry,
} from '../creaturePlanRoutes';
import { PLAN_FIXTURES } from '../../../../src/systems/entities3d/textPlan/fixtures';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'creature-plans-'));
  setLibraryDirForTests(dir);
});

afterEach(() => {
  setLibraryDirForTests(null);
  rmSync(dir, { recursive: true, force: true });
});

interface Captured {
  data: unknown;
  status: number;
}

function makeCtx(method: string, urlPath: string, body?: unknown): { ctx: Parameters<typeof handleCreaturePlanRoutes>[0]; out: Captured } {
  const out: Captured = { data: undefined, status: 0 };
  const req = body === undefined ? Readable.from([]) : Readable.from([JSON.stringify(body)]);
  (req as unknown as { method: string }).method = method;
  return {
    ctx: {
      req,
      res: {},
      json: (data: unknown, status = 200) => {
        out.data = data;
        out.status = status;
      },
      parsedUrl: new URL(`http://localhost${urlPath}`),
      urlPath,
    },
    out,
  };
}

const dragonJson = JSON.stringify(PLAN_FIXTURES.dragon);

describe('creature plan routes', () => {
  it('ignores unrelated paths', async () => {
    const { ctx } = makeCtx('GET', '/devhub/api/spells');
    expect(await handleCreaturePlanRoutes(ctx, vi.fn())).toBe(false);
  });

  it('generates: runner plan → validated → stored with status generated', async () => {
    const runner: CliRunner = vi.fn(async () => dragonJson);
    const { ctx, out } = makeCtx('POST', '/devhub/api/creature-plan', { text: 'a mighty ember dragon' });
    expect(await handleCreaturePlanRoutes(ctx, runner)).toBe(true);
    expect(out.status).toBe(200);
    const entry = (out.data as { entry: CreatureLibraryEntry }).entry;
    expect(entry.status).toBe('generated');
    expect(entry.name).toBe('Emberwing Dragon');
    expect(entry.description).toBe('a mighty ember dragon');
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    const onDisk = JSON.parse(readFileSync(path.join(dir, files[0]), 'utf8')) as CreatureLibraryEntry;
    expect(onDisk.id).toBe(entry.id);
  });

  it('exact same text returns the stored entry without calling the runner again', async () => {
    const runner = vi.fn(async () => dragonJson);
    const first = makeCtx('POST', '/devhub/api/creature-plan', { text: 'same words' });
    await handleCreaturePlanRoutes(first.ctx, runner);
    const second = makeCtx('POST', '/devhub/api/creature-plan', { text: 'same words' });
    await handleCreaturePlanRoutes(second.ctx, runner);
    expect(runner).toHaveBeenCalledTimes(1);
    const a = (first.out.data as { entry: CreatureLibraryEntry }).entry;
    const b = (second.out.data as { entry: CreatureLibraryEntry }).entry;
    expect(b.id).toBe(a.id);
  });

  it('invalid once → retry prompt carries the validation errors → success', async () => {
    const bad = JSON.stringify({ name: 'Broken', frame: { heightFt: 900 } });
    const prompts: string[] = [];
    const runner: CliRunner = vi.fn(async (prompt: string) => {
      prompts.push(prompt);
      return prompts.length === 1 ? bad : dragonJson;
    });
    const { ctx, out } = makeCtx('POST', '/devhub/api/creature-plan', { text: 'x' });
    await handleCreaturePlanRoutes(ctx, runner);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(prompts[1]).toContain('failed validation');
    expect(prompts[1]).toContain('frame.heightFt');
    expect(out.status).toBe(200);
  });

  it('invalid twice → 422 with the full error list, nothing stored', async () => {
    const runner: CliRunner = vi.fn(async () => '{"name":"nope"}');
    const { ctx, out } = makeCtx('POST', '/devhub/api/creature-plan', { text: 'y' });
    await handleCreaturePlanRoutes(ctx, runner);
    expect(out.status).toBe(422);
    expect((out.data as { errors: string[] }).errors.length).toBeGreaterThan(0);
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it('approve flips status on disk', async () => {
    const runner: CliRunner = vi.fn(async () => dragonJson);
    const gen = makeCtx('POST', '/devhub/api/creature-plan', { text: 'dragon' });
    await handleCreaturePlanRoutes(gen.ctx, runner);
    const { id } = (gen.out.data as { entry: CreatureLibraryEntry }).entry;
    const appr = makeCtx('POST', '/devhub/api/creature-plan/approve', { id });
    expect(await handleCreaturePlanRoutes(appr.ctx, runner)).toBe(true);
    expect((appr.out.data as { entry: CreatureLibraryEntry }).entry.status).toBe('approved');
    const files = readdirSync(dir);
    const onDisk = JSON.parse(readFileSync(path.join(dir, files[0]), 'utf8')) as CreatureLibraryEntry;
    expect(onDisk.status).toBe('approved');
  });

  it('revise: prompt carries the parent plan, entry links via revisedFrom', async () => {
    const prompts: string[] = [];
    const runner: CliRunner = vi.fn(async (prompt: string) => {
      prompts.push(prompt);
      return dragonJson;
    });
    const gen = makeCtx('POST', '/devhub/api/creature-plan', { text: 'dragon' });
    await handleCreaturePlanRoutes(gen.ctx, runner);
    const parent = (gen.out.data as { entry: CreatureLibraryEntry }).entry;
    const rev = makeCtx('POST', '/devhub/api/creature-plan', { reviseId: parent.id, note: 'make the wings bigger' });
    await handleCreaturePlanRoutes(rev.ctx, runner);
    const child = (rev.out.data as { entry: CreatureLibraryEntry }).entry;
    expect(child.revisedFrom).toBe(parent.id);
    expect(child.id).not.toBe(parent.id);
    expect(prompts[1]).toContain('make the wings bigger');
    expect(prompts[1]).toContain('"Emberwing Dragon"');
    expect(readdirSync(dir)).toHaveLength(2);
  });

  it('lists entries newest first', async () => {
    const runner: CliRunner = vi.fn(async () => dragonJson);
    const a = makeCtx('POST', '/devhub/api/creature-plan', { text: 'first' });
    await handleCreaturePlanRoutes(a.ctx, runner);
    await new Promise((r) => setTimeout(r, 15));
    const b = makeCtx('POST', '/devhub/api/creature-plan', { text: 'second' });
    await handleCreaturePlanRoutes(b.ctx, runner);
    const list = makeCtx('GET', '/devhub/api/creature-plans');
    expect(await handleCreaturePlanRoutes(list.ctx, runner)).toBe(true);
    const entries = (list.out.data as { entries: CreatureLibraryEntry[] }).entries;
    expect(entries).toHaveLength(2);
    expect(entries[0].description).toBe('second');
    expect(entries[1].description).toBe('first');
  });

  it('runner failure surfaces verbatim as a 500', async () => {
    const runner: CliRunner = vi.fn(async () => {
      throw new Error('claude CLI exited 1: no credits');
    });
    const { ctx, out } = makeCtx('POST', '/devhub/api/creature-plan', { text: 'z' });
    await handleCreaturePlanRoutes(ctx, runner);
    expect(out.status).toBe(500);
    expect(String((out.data as { error: string }).error)).toContain('no credits');
  });
});
