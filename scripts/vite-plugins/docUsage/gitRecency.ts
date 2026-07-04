import { execFileSync } from 'child_process';

export function computeAgeDays(commitSec: number | null, nowMs: number): number | null {
  if (commitSec == null) return null;
  return Math.floor((nowMs - commitSec * 1000) / 86_400_000);
}

// One `git log` pass for the WHOLE repo instead of one subprocess per file.
// Spawning `git log -1` per doc did not scale (5k+ files hung the endpoint for
// minutes). We walk history newest-first with `--name-only`; the FIRST time a
// path appears is its last-content-commit. Timestamp lines are pure digits
// (from `--format=%ct`); .md paths never are, so the two never collide.
export function gitAgeDays(
  rootDir: string, relPaths: string[], now: number = Date.now(),
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const want = new Set(relPaths);
  for (const rel of relPaths) out.set(rel, null);
  let remaining = want.size;
  if (remaining === 0) return out;
  try {
    const raw = execFileSync(
      'git', ['log', '--format=%ct', '--name-only', '--no-renames'],
      { cwd: rootDir, encoding: 'utf-8', maxBuffer: 1024 * 1024 * 512, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    let currentSec: number | null = null;
    for (const line of raw.split('\n')) {
      if (/^\d+$/.test(line)) { currentSec = parseInt(line, 10); continue; }
      if (!line) continue;
      const rel = line.replace(/\\/g, '/');
      if (want.has(rel) && out.get(rel) == null) {
        out.set(rel, computeAgeDays(currentSec, now));
        if (--remaining === 0) break;
      }
    }
  } catch { /* no git / no history — leave defaults (null) */ }
  return out;
}
