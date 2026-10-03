/**
 * Skeleton Lab routes (Part Lab, Remy 2026-08-23): the joints editor saves
 * dragged joint positions as `<id>.landmarks.json` beside the base mesh, and
 * the re-rig endpoint runs the Blender pack-rig job so the weights follow.
 *
 * The landmarks file is data for tools/blender/rig_basemesh.py: joint name →
 * [x, y, z] in glTF space at unit height. The job pins those joints and lets
 * un-pinned descendants inherit their ancestor's delta.
 *
 * Called by: devHubApiManager.ts behind the /devhub/api/partlab/ prefix,
 * through an opaque module URL (this module spawns child processes; keep it
 * off Vite's config dependency graph).
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { DevHubRouteContext } from './routeContext';

const BASE_DIR = path.resolve(process.cwd(), 'public', 'references', 'basemesh');
const RIG_SCRIPT = path.resolve(process.cwd(), 'tools', 'entities3d', 'rigBaseMeshes.mjs');
const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const JOINT_RE = /^[a-z0-9_]{1,40}$/;

function readBody(req: DevHubRouteContext['req']): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function landmarksPath(id: string): string {
  return path.join(BASE_DIR, `${id}.landmarks.json`);
}

/** The id must name a pack-rigged base mesh on disk — no path segments. */
function validId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id) && fs.existsSync(path.join(BASE_DIR, `${id}.packrig.glb`));
}

/** Write with a short retry: the dev server can hold the file open while it
 * serves it, and Windows then EPERMs the write for a moment. */
function writeWithRetry(file: string, content: string): void {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      fs.writeFileSync(file, content, 'utf8');
      return;
    } catch (e) {
      last = e;
      const wait = 120 * (i + 1);
      const until = Date.now() + wait;
      while (Date.now() < until) { /* brief synchronous backoff */ }
    }
  }
  throw last;
}

// one Blender run at a time — a second body queues behind the first click
let rerigBusy: string | null = null;

export async function handlePartLabRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { req, json, urlPath, parsedUrl } = ctx;
  if (!urlPath.startsWith('/devhub/api/partlab/')) return false;

  if (req.method === 'GET' && urlPath === '/devhub/api/partlab/landmarks') {
    const id = parsedUrl.searchParams.get('id');
    if (!validId(id)) {
      json({ error: 'unknown base mesh id' }, 400);
      return true;
    }
    const file = landmarksPath(id);
    if (!fs.existsSync(file)) {
      json({ joints: {} });
      return true;
    }
    json(JSON.parse(fs.readFileSync(file, 'utf8')));
    return true;
  }

  if (req.method === 'POST' && urlPath === '/devhub/api/partlab/landmarks') {
    const body = await readBody(req).catch(() => null);
    if (!body || !validId(body.id)) {
      json({ error: 'body needs a valid id' }, 400);
      return true;
    }
    const joints = body.joints;
    if (!joints || typeof joints !== 'object' || Array.isArray(joints)) {
      json({ error: 'body needs joints: { name: [x, y, z] }' }, 400);
      return true;
    }
    const entries = Object.entries(joints as Record<string, unknown>);
    if (entries.length > 80) {
      json({ error: 'too many joints' }, 400);
      return true;
    }
    for (const [name, v] of entries) {
      if (!JOINT_RE.test(name) || !Array.isArray(v) || v.length !== 3 || v.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
        json({ error: `bad joint entry "${name}"` }, 400);
        return true;
      }
    }
    const file = landmarksPath(body.id);
    if (entries.length === 0) {
      // an empty save clears the overrides — back to the pure heuristic fit
      if (fs.existsSync(file)) fs.rmSync(file);
      json({ ok: true, cleared: true });
      return true;
    }
    writeWithRetry(file, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), joints }, null, 2) + '\n');
    json({ ok: true, file: path.relative(process.cwd(), file), joints: entries.length });
    return true;
  }

  if (req.method === 'POST' && urlPath === '/devhub/api/partlab/rerig') {
    const body = await readBody(req).catch(() => null);
    if (!body || !validId(body.id)) {
      json({ error: 'body needs a valid id' }, 400);
      return true;
    }
    if (rerigBusy) {
      json({ error: `a re-rig is already running (${rerigBusy})` }, 409);
      return true;
    }
    rerigBusy = body.id;
    const lines: string[] = [];
    try {
      const code = await new Promise<number>((resolve, reject) => {
        const child = spawn(process.execPath, [RIG_SCRIPT, '--pack', body.id as string], { cwd: process.cwd() });
        const take = (chunk: Buffer) => {
          for (const l of chunk.toString('utf8').split(/\r?\n/)) if (l.trim()) lines.push(l.trim());
        };
        child.stdout.on('data', take);
        child.stderr.on('data', take);
        child.on('error', reject);
        child.on('close', (c) => resolve(c ?? 1));
      });
      if (code !== 0) {
        json({ error: 'rig job failed', log: lines.slice(-15) }, 500);
        return true;
      }
      json({ ok: true, log: lines.slice(-8) });
      return true;
    } finally {
      rerigBusy = null;
    }
  }

  json({ error: 'unknown partlab route' }, 404);
  return true;
}
