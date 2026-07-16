/**
 * @file creaturePlanRoutes.ts — text-to-creature devhub routes (dev server only).
 *
 * POST /devhub/api/creature-plan          { text }            → generate (or return the exact-text match)
 * POST /devhub/api/creature-plan          { reviseId, note }  → revised plan linked via revisedFrom
 * POST /devhub/api/creature-plan/approve  { id }              → flip status to approved
 * GET  /devhub/api/creature-plans                             → { entries } newest first
 *
 * The brain is the Claude CLI (`claude -p --model claude-fable-5 --effort
 * medium --output-format json`). An invalid plan gets ONE retry with the named
 * validation errors appended; still invalid → 422 with the list, verbatim, and
 * nothing is stored. The game never calls these routes: approved entries are
 * plain JSON under src/data/creatures3d/plans, importable at build time.
 */
import { spawn } from 'child_process';
import { mkdirSync, promises as fsp } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type { DevHubRouteContext } from './routeContext';
import {
  PLAN_LIMITS,
  validateCreaturePlan,
  type CreaturePlan,
} from '../../../src/systems/entities3d/textPlan/planSchema';

export interface CreatureLibraryEntry {
  id: string;
  name: string;
  slug: string;
  /** The generation prompt text, or the revise note for revised entries. */
  description: string;
  plan: CreaturePlan;
  status: 'generated' | 'approved';
  createdAt: string;
  revisedFrom?: string;
}

/** Injectable for tests; the default shells out to the Claude CLI. */
export type CliRunner = (prompt: string) => Promise<string>;

const DEFAULT_LIBRARY_DIR = path.resolve(process.cwd(), 'src/data/creatures3d/plans');
let libraryDirOverride: string | null = null;

export function setLibraryDirForTests(dir: string | null): void {
  libraryDirOverride = dir;
}

function libraryDir(): string {
  return libraryDirOverride ?? DEFAULT_LIBRARY_DIR;
}

const CLI_TIMEOUT_MS = 120_000;

/** The dev server often runs INSIDE a Claude Code session; a spawned `claude`
 * inheriting that env splices itself into the parent conversation instead of
 * starting fresh. Strip every session/IPC variable. */
function cleanCliEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('CLAUDE') || k.startsWith('MCP_') || k === 'CLAUDECODE') continue;
    env[k] = v;
  }
  return env;
}

const defaultRunner: CliRunner = (prompt) =>
  new Promise((resolve, reject) => {
    // The prompt goes through STDIN: as an argv with shell:true (needed for the
    // Windows .cmd shim), its newlines would mangle the command line. Neutral
    // cwd keeps the CLI from loading this repo's CLAUDE.md and following it.
    const child = spawn(
      'claude',
      ['-p', '--model', 'claude-fable-5', '--effort', 'medium', '--output-format', 'json'],
      { windowsHide: true, shell: process.platform === 'win32', cwd: tmpdir(), env: cleanCliEnv() },
    );
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude CLI timed out after ${CLI_TIMEOUT_MS / 1000}s`));
    }, CLI_TIMEOUT_MS);
    child.stdout.on('data', (d: Buffer) => {
      stdout += d;
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d;
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`claude CLI failed to start: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude CLI exited ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });

/** Pull the plan JSON out of CLI output (result envelope or raw text). */
function extractPlanJson(stdout: string): unknown {
  let text = stdout.trim();
  try {
    const envelope = JSON.parse(text) as { result?: unknown };
    if (envelope && typeof envelope === 'object' && typeof envelope.result === 'string') {
      text = envelope.result.trim();
    }
  } catch {
    // raw text output — fall through to the brace slice
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error(`no JSON object in CLI output: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

async function knownPartIds(): Promise<ReadonlySet<string>> {
  // Lazy import keeps this module light for the dev server's dynamic loader
  // (the part registry pulls in three.js).
  const [{ registerAllParts }, { allParts }] = await Promise.all([
    import('../../../src/systems/entities3d/parts'),
    import('../../../src/systems/entities3d/registry'),
  ]);
  registerAllParts();
  return new Set(allParts().map((p) => p.id));
}

function schemaPrompt(): string {
  return [
    'You design a creature body plan for a stylized 3D game. Output ONLY a JSON object — no prose, no code fences.',
    'The JSON shape (all lengths in feet):',
    '{',
    '  "name": string,                                  // 1–40 chars, display name',
    '  "frame": { "heightFt": number, "lengthFt"?: number, "bulk": number, "stance": "upright"|"horizontal"|"serpentine"|"floating" },',
    '  "spine": { "segments": int, "taper": number, "arch": number },',
    '  "appendages": [ { "kind": "leg"|"arm"|"tail"|"tentacle"|"neck"|"wing", "attach": number, "heightFrac"?: number, "perSide"?: boolean, "count": int, "chain": [ { "lenFt": number, "r": number } ] } ],',
    '  "heads": [ { "neckIndex"?: int, "sizeScale": number, "eyes": { "count": int, "sizeScale": number }, "snout"?: { "lengthScale": number, "droop": number } } ],',
    '  "palette": { "bodyHex": "#rrggbb", "accentHex"?: "#rrggbb", "bellyHex"?: "#rrggbb", "eyeHex": "#rrggbb" },',
    '  "garnish"?: [ { "partId": string, "params"?: { [k]: number } } ]',
    '}',
    `Hard ranges: heightFt ${PLAN_LIMITS.heightFt[0]}–${PLAN_LIMITS.heightFt[1]}; lengthFt ${PLAN_LIMITS.lengthFt[0]}–${PLAN_LIMITS.lengthFt[1]} (REQUIRED for horizontal/serpentine); bulk ${PLAN_LIMITS.bulk[0]}–${PLAN_LIMITS.bulk[1]}; spine.segments ${PLAN_LIMITS.spineSegments[0]}–${PLAN_LIMITS.spineSegments[1]}; spine.taper ${PLAN_LIMITS.spineTaper[0]}–${PLAN_LIMITS.spineTaper[1]}; spine.arch ${PLAN_LIMITS.spineArch[0]}–${PLAN_LIMITS.spineArch[1]}; at most ${PLAN_LIMITS.appendages[1]} appendages; attach ${PLAN_LIMITS.attach[0]}–${PLAN_LIMITS.attach[1]} (0=front, 1=rear); count ${PLAN_LIMITS.count[0]}–${PLAN_LIMITS.count[1]} per entry (per side when perSide); chain ${PLAN_LIMITS.chainLinks[0]}–${PLAN_LIMITS.chainLinks[1]} links; lenFt ${PLAN_LIMITS.linkLenFt[0]}–${PLAN_LIMITS.linkLenFt[1]}; r ${PLAN_LIMITS.linkR[0]}–${PLAN_LIMITS.linkR[1]} (fraction of body radius); heads ${PLAN_LIMITS.heads[0]}–${PLAN_LIMITS.heads[1]}; head sizeScale ${PLAN_LIMITS.headSizeScale[0]}–${PLAN_LIMITS.headSizeScale[1]}; eyes.count ${PLAN_LIMITS.eyeCount[0]}–${PLAN_LIMITS.eyeCount[1]}; eyes.sizeScale ${PLAN_LIMITS.eyeSizeScale[0]}–${PLAN_LIMITS.eyeSizeScale[1]}; snout lengthScale ${PLAN_LIMITS.snoutLengthScale[0]}–${PLAN_LIMITS.snoutLengthScale[1]}, droop ${PLAN_LIMITS.snoutDroop[0]}–${PLAN_LIMITS.snoutDroop[1]}; at most ${PLAN_LIMITS.garnish[1]} garnish entries.`,
    'Rules: heads[].neckIndex must point at an appendage of kind "neck" (omit it to sit the head on the spine front). Legs make it walk; no legs + serpentine = it slithers; floating hovers. Use garnish only for parts you are told exist. Unknown fields are rejected.',
  ].join('\n');
}

function slugify(name: string, id: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'creature';
  return `${base}-${id}`;
}

function newId(): string {
  return Math.random().toString(16).slice(2, 10).padEnd(8, '0');
}

async function readBody(req: DevHubRouteContext['req']): Promise<Record<string, unknown>> {
  let acc = '';
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer | string) => {
      acc += chunk;
    });
    req.on('end', () => resolve());
    req.on('error', (e: Error) => reject(e));
  });
  if (!acc.trim()) return {};
  return JSON.parse(acc) as Record<string, unknown>;
}

async function listEntries(): Promise<CreatureLibraryEntry[]> {
  const dir = libraryDir();
  let files: string[] = [];
  try {
    files = (await fsp.readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return []; // library dir not created yet — an empty library, not an error
  }
  const entries = await Promise.all(
    files.map(async (f) => JSON.parse(await fsp.readFile(path.join(dir, f), 'utf8')) as CreatureLibraryEntry),
  );
  return entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

async function writeEntry(entry: CreatureLibraryEntry): Promise<void> {
  const dir = libraryDir();
  mkdirSync(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, `${entry.slug}.json`), JSON.stringify(entry, null, 2), 'utf8');
}

/** Ask the brain, validate, retry once with the errors. Returns the plan or throws a 422 payload. */
async function generatePlan(
  runner: CliRunner,
  userSection: string,
): Promise<{ plan: CreaturePlan } | { errors: string[] }> {
  const known = await knownPartIds();
  const basePrompt = `${schemaPrompt()}\nKnown garnish partIds: ${[...known].sort().join(', ')}.\n\n${userSection}`;
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\nYour previous attempt failed validation with these errors — fix every one:\n${lastErrors.join('\n')}`;
    const raw = await runner(prompt);
    let candidate: unknown;
    try {
      candidate = extractPlanJson(raw);
    } catch (e) {
      lastErrors = [String(e instanceof Error ? e.message : e)];
      continue;
    }
    const errors = validateCreaturePlan(candidate, known);
    if (errors.length === 0) return { plan: candidate as CreaturePlan };
    lastErrors = errors;
  }
  return { errors: lastErrors };
}

export async function handleCreaturePlanRoutes(
  ctx: DevHubRouteContext,
  runner: CliRunner = defaultRunner,
): Promise<boolean> {
  const { urlPath, json } = ctx;

  if (urlPath === '/devhub/api/creature-plans') {
    json({ entries: await listEntries() });
    return true;
  }

  if (urlPath === '/devhub/api/creature-plan/approve') {
    try {
      const { id } = await readBody(ctx.req);
      const entries = await listEntries();
      const entry = entries.find((e) => e.id === id);
      if (!entry) {
        json({ error: `no library entry with id ${String(id)}` }, 404);
        return true;
      }
      entry.status = 'approved';
      await writeEntry(entry);
      json({ entry });
    } catch (e) {
      json({ error: String(e instanceof Error ? e.message : e) }, 500);
    }
    return true;
  }

  if (urlPath === '/devhub/api/creature-plan') {
    try {
      const body = await readBody(ctx.req);

      if (typeof body.reviseId === 'string') {
        const note = String(body.note ?? '').trim();
        if (!note) {
          json({ error: 'revise needs a note' }, 400);
          return true;
        }
        const entries = await listEntries();
        const parent = entries.find((e) => e.id === body.reviseId);
        if (!parent) {
          json({ error: `no library entry with id ${body.reviseId}` }, 404);
          return true;
        }
        const result = await generatePlan(
          runner,
          `Current plan:\n${JSON.stringify(parent.plan, null, 2)}\n\nRevision request: ${note}\nReturn the FULL revised plan.`,
        );
        if ('errors' in result) {
          json({ errors: result.errors }, 422);
          return true;
        }
        const id = newId();
        const entry: CreatureLibraryEntry = {
          id,
          name: result.plan.name,
          slug: slugify(result.plan.name, id),
          description: note,
          plan: result.plan,
          status: 'generated',
          createdAt: new Date().toISOString(),
          revisedFrom: parent.id,
        };
        await writeEntry(entry);
        json({ entry });
        return true;
      }

      const text = String(body.text ?? '').trim();
      if (!text) {
        json({ error: 'generate needs a text description' }, 400);
        return true;
      }
      const existing = (await listEntries()).find((e) => e.description === text && !e.revisedFrom);
      if (existing) {
        json({ entry: existing });
        return true;
      }
      const result = await generatePlan(runner, `Creature description: ${text}`);
      if ('errors' in result) {
        json({ errors: result.errors }, 422);
        return true;
      }
      const id = newId();
      const entry: CreatureLibraryEntry = {
        id,
        name: result.plan.name,
        slug: slugify(result.plan.name, id),
        description: text,
        plan: result.plan,
        status: 'generated',
        createdAt: new Date().toISOString(),
      };
      await writeEntry(entry);
      json({ entry });
    } catch (e) {
      json({ error: String(e instanceof Error ? e.message : e) }, 500);
    }
    return true;
  }

  return false;
}
