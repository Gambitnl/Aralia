// tools/agora/git-shim/git-shim.mjs
// PATH-shim `git` for EXTERNAL agent launch environments (WF-G1): external
// CLIs (codex/kilo/…) run no Claude hooks, so `orchestrate dispatch` prepends
// this directory to their PATH. Every `git <args>` they run funnels through
// the same destructive-command guard Claude sessions get, then delegates to
// the real git with identical stdio/exit-code semantics.
//
// Override (explicit human authorization only): GIT_GUARD_ALLOW=1 in the env
// or embedded in the command, same contract as the Claude-side hook.
import { spawnSync, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from '../guardGit.mjs';

const SHIM_DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const command = 'git ' + args.join(' ');

if (process.env.GIT_GUARD_ALLOW !== '1') {
  const d = decide(command);
  if (d.deny) {
    process.stderr.write(`git-shim: ${d.reason}\n`);
    process.exit(2);
  }
}

// Find the REAL git: first `where`/`which` hit that is not this shim.
function realGit() {
  const probe = process.platform === 'win32' ? 'where git' : 'which -a git';
  try {
    const hits = execSync(probe, { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((p) => !path.resolve(p).toLowerCase().startsWith(SHIM_DIR.toLowerCase()));
    if (hits.length) return hits[0];
  } catch {
    /* fall through */
  }
  // Honest failure — never silently no-op a git call.
  process.stderr.write('git-shim: could not locate the real git on PATH\n');
  process.exit(127);
}

const r = spawnSync(realGit(), args, { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
