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

// ============================================================================
// Isolated Library Setup
// ============================================================================
// Each route test gets a disposable creature library so it cannot read or change the
// game's checked-in plans. The override is always cleared, even when an assertion fails.
// ============================================================================

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

// Build the small request-and-response surface used by the devhub route. This keeps every
// test focused on route behavior without starting a Vite server or invoking the real CLI.
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

// ============================================================================
// Static Configuration Dependency Guard
// ============================================================================
// Vite loads the route module while it reads vite.config.ts. This guard permits erased
// type imports but rejects emitted static imports into the 3D entity system, which would
// make configuration startup depend on actively edited game modules again.
// ============================================================================

describe('creature plan route configuration boundary', () => {
  it('defers every runtime 3D entity dependency until a generation request', () => {
    // Vitest serves test modules through its own URL scheme, so resolve from the repository
    // root just as the devhub plugin itself resolves its checked-in data directories.
    const routeSource = readFileSync(
      path.resolve(process.cwd(), 'scripts/vite-plugins/devhub/creaturePlanRoutes.ts'),
      'utf8',
    );
    const staticImports = [...routeSource.matchAll(/\bimport\s+(?!type\b)(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]/g)]
      .map((match) => match[1]);

    // The runtime filenames and opaque import marker must remain present so this test proves
    // deferral, not deletion of the shared validation and sizing behavior.
    expect(routeSource).toContain("entityModuleUrl('textPlan/planSchema.ts')");
    expect(routeSource).toContain("entityModuleUrl('textPlan/planSize.ts')");
    expect(routeSource).toContain('import(/* @vite-ignore */ planSchemaModuleUrl)');
    expect(routeSource).toContain('import(/* @vite-ignore */ planSizeModuleUrl)');
    expect(staticImports.filter((specifier) => specifier.includes('/src/systems/entities3d/'))).toEqual([]);
  });
});

// ============================================================================
// Route Behavior
// ============================================================================
// These cases preserve generation, retry, storage, approval, revision, listing, and error
// behavior while the entity-system dependencies move behind the request boundary.
// ============================================================================

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
