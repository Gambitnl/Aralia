// tools/agora/guardGit.mjs
// Claude Code PreToolUse hook: veto destructive git commands in the SHARED
// multi-agent checkout. `git reset --hard` / `git checkout` by one agent
// silently destroys every other agent's uncommitted work — the single biggest
// clobber vector this repo has seen. The daemon-side locks are advisory; this
// is the enforcement layer for Claude Code sessions.
//
// Wired in .claude/settings.json:
//   PreToolUse → matcher "Bash" → { if: "Bash(git *)", command: "node tools/agora/guardGit.mjs" }
// Reads the hook JSON on stdin, prints a permissionDecision JSON on stdout.
//
// Escape hatch (explicit human authorization only): prefix the command with
// GIT_GUARD_ALLOW=1 — e.g. `GIT_GUARD_ALLOW=1 git reset --hard`. The deny
// message teaches this, so a human-instructed recovery is one retry away.
//
// Pure Node.js, zero dependencies, exports decide() for tests.
//
// This file only blocks destructive git operations in this repo. It does not
// try to block non-git shell text that happens to mention `git` in user data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const DEFAULT_BASE_URL = process.env.AGORA_URL || 'http://localhost:4319';
const AGENT_IDENTITY_RE = /^[A-Za-z_][A-Za-z0-9_]*=.+/;
const ROOT_OPTION_WITH_VALUE = new Set([
  '-C',
  '-c',
  '--config-env',
  '--git-dir',
  '--work-tree',
  '--namespace',
]);

// Normalize for lock matching by stripping trailing `./`, Windows separators, and
// leading repo prefixes so `tools/x`, `./tools/x`, and `F:\Repos\Aralia\tools\x`
// all match the same lock entries.
function normalizePathForAgora(file) {
  const asText = String(file || '');
  if (!asText) return '';
  const abs = path.isAbsolute(asText) ? asText : path.resolve(process.cwd(), asText);
  const norm = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').toLowerCase();
  const candidates = new Set();
  candidates.add(norm(asText));
  candidates.add(norm(abs));
  const relativeToRepo = abs.toLowerCase().startsWith(repoRoot.toLowerCase() + path.sep) || abs.toLowerCase() === repoRoot.toLowerCase()
    ? norm(path.relative(repoRoot, abs))
    : '';
  if (relativeToRepo) candidates.add(relativeToRepo);
  return [...candidates].filter(Boolean);
}

// Reads this Codex worker's stored Agora identity, if available.
function readStoredAgentId(env = process.env) {
  const dir = env.AGORA_DIR || path.join(repoRoot, '.agent', 'agora');
  const key = typeof env.AGORA_AGENT_ID === 'string' && env.AGORA_AGENT_ID.trim()
    ? env.AGORA_AGENT_ID.trim().replace(/[^A-Za-z0-9._-]/g, '_')
    : '';
  const file = path.join(dir, key ? `client-identity.${key}.json` : 'client-identity.json');
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return raw?.[env.AGORA_URL || DEFAULT_BASE_URL]?.agentId || null;
  } catch {
    return null;
  }
}

function splitCommandBodies(command) {
  const chunks = [];
  const current = [];
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (escaped) {
      current.push(ch);
      escaped = false;
      continue;
    }
    if (!inSingle && ch === '\\') {
      escaped = true;
      continue;
    }
    if (!inDouble && ch === '\'') {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && (ch === ';' || ch === '\n')) {
      chunks.push(current.join('').trim());
      current.length = 0;
      continue;
    }
    if (!inSingle && !inDouble && ch === '&' && command[i + 1] === '&') {
      chunks.push(current.join('').trim());
      current.length = 0;
      i += 1;
      continue;
    }
    if (!inSingle && !inDouble && ch === '|' && command[i + 1] === '|') {
      chunks.push(current.join('').trim());
      current.length = 0;
      i += 1;
      continue;
    }
    if (!inSingle && !inDouble && ch === '|') {
      chunks.push(current.join('').trim());
      current.length = 0;
      continue;
    }
    if (!inSingle && !inDouble && ch === '&') {
      chunks.push(current.join('').trim());
      current.length = 0;
      continue;
    }
    current.push(ch);
  }
  chunks.push(current.join('').trim());
  return chunks.filter((s) => s.length);
}

function tokenizeSegment(segment) {
  const tokens = [];
  let token = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (escaped) {
      token += ch;
      escaped = false;
      continue;
    }
    if (!inSingle && ch === '\\' && inDouble) {
      escaped = true;
      continue;
    }
    if (!inDouble && ch === '\'') {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && /\s/.test(ch)) {
      if (token.length) {
        tokens.push(token);
        token = '';
      }
      continue;
    }
    token += ch;
  }
  if (token.length) tokens.push(token);
  return tokens;
}

function parseGitInvocation(segment) {
  const tokens = tokenizeSegment(segment);
  if (!tokens.length) return null;

  let commandIndex = 0;
  while (commandIndex < tokens.length && AGENT_IDENTITY_RE.test(tokens[commandIndex])) {
    commandIndex += 1;
  }
  if (tokens[commandIndex] !== 'git') return null;

  let i = commandIndex + 1;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token === '--') break;
    if (!token.startsWith('-')) break;
    if (token === '-C' || token === '-c' || token === '--config-env' || token === '--git-dir' || token === '--work-tree' || token === '--namespace') {
      i += 2;
      continue;
    }
    if (token.startsWith('-C') || token.startsWith('-c') || token.startsWith('--git-dir=') || token.startsWith('--work-tree=') || token.startsWith('--namespace=') || token.startsWith('--config-env=')) {
      i += 1;
      continue;
    }
    if (ROOT_OPTION_WITH_VALUE.has(token)) {
      i += 2;
      continue;
    }
    i += 1;
  }
  const subcommand = tokens[i];
  if (!subcommand) return null;
  return { subcommand, args: tokens.slice(i + 1) };
}

async function canRestoreByOwnLock(targets, { baseUrl = DEFAULT_BASE_URL, env = process.env, fetchImpl = fetch } = {}) {
  const agentId = readStoredAgentId(env);
  if (!agentId) return { ok: false, reason: 'no local Agora identity' };
  const res = await fetchImpl(`${baseUrl}/locks`);
  const body = await res.json().catch(() => ({}));
  const locks = body.locks ?? [];

  for (const target of targets) {
    const normalizedTargets = normalizePathForAgora(target);
    const hit = locks.find((l) => (l.paths ?? []).some((p) => {
      const covered = normalizePathForAgora(p);
      return covered.some((c) => normalizedTargets.includes(c));
    }));
    if (!hit || hit.agentId !== agentId) {
      return {
        ok: false,
        reason: !hit ? `missing lock for ${target}` : `lock held by ${hit.agentId}`,
      };
    }
  }
  return { ok: true };
}

function restoreTargets(args) {
  const targets = [];
  let i = 0;
  let seenDashDash = false;
  const consumeAfterSource = (flag) => {
    if (flag === '--source' || flag === '-s') {
      i += 2;
      return true;
    }
    return false;
  };

  while (i < args.length) {
    const arg = args[i];
    if (arg === '--') {
      seenDashDash = true;
      i += 1;
      continue;
    }
    if (!seenDashDash && arg.startsWith('-')) {
      if (consumeAfterSource(arg)) continue;
      i += 1;
      continue;
    }
    targets.push(arg);
    i += 1;
  }
  return targets;
}

export async function decide(command, {
  baseUrl = DEFAULT_BASE_URL,
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const cmd = String(command || '');
  if (/\bGIT_GUARD_ALLOW=1\b/.test(cmd)) return { deny: false };

  for (const segment of splitCommandBodies(cmd)) {
    const invocation = parseGitInvocation(segment);
    if (!invocation) continue;
    const commandArgs = invocation.args;
    const sub = invocation.subcommand.toLowerCase();

    if (sub === 'reset' && commandArgs.some((arg) => arg === '--hard' || arg === '--merge' || arg === '--keep')) {
      return {
        deny: true,
        reason: `BLOCKED by the shared-checkout git guard: git reset --hard/--merge/--keep discards every agent's uncommitted work in this shared tree. ` +
          `Multiple agents work this tree concurrently (check ${baseUrl} — Agora). ` +
          `Coordinate instead: lock files via Agora, or ask the human. ` +
          `If a human explicitly authorized this exact operation, re-run it prefixed with GIT_GUARD_ALLOW=1.`,
      };
    }

    if (sub === 'checkout') {
      return {
        deny: true,
        reason: `BLOCKED by the shared-checkout git guard: git checkout switches/overwrites the shared working tree under other agents. ` +
          `Multiple agents work this tree concurrently (check ${baseUrl} — Agora). ` +
          `Coordinate instead: lock files via Agora, or ask the human. ` +
          `If a human explicitly authorized this exact operation, re-run it prefixed with GIT_GUARD_ALLOW=1.`,
      };
    }

    if (sub === 'switch') {
      return {
        deny: true,
        reason: `BLOCKED by the shared-checkout git guard: git switch changes the shared working tree under other agents. ` +
          `Multiple agents work this tree concurrently (check ${baseUrl} — Agora). ` +
          `Coordinate instead: lock files via Agora, or ask the human. ` +
          `If a human explicitly authorized this exact operation, re-run it prefixed with GIT_GUARD_ALLOW=1.`,
      };
    }

    if (sub === 'restore') {
      const targets = restoreTargets(commandArgs);
      if (!targets.length) {
        return {
          deny: true,
          reason: 'BLOCKED by the shared-checkout git guard: git restore requires explicit path targets in this shared checkout. ' +
            'Coordinate with Agora locks or ask the human and use GIT_GUARD_ALLOW=1.',
        };
      }
      const lockCheck = await canRestoreByOwnLock(targets, { baseUrl, env, fetchImpl });
      if (!lockCheck.ok) {
        return {
          deny: true,
          reason: `BLOCKED by the shared-checkout git guard: cannot restore ${targets.join(', ')} — ${lockCheck.reason}. ` +
            `Coordinate via Agora and hold your own lock for each exact target before restore.`,
        };
      }
      continue;
    }

    if (sub === 'clean') {
      return {
        deny: true,
        reason: `BLOCKED by the shared-checkout git guard: git clean deletes untracked files — including other agents' new files and coordination state. ` +
          `Multiple agents work this tree concurrently (check ${baseUrl} — Agora). ` +
          `Coordinate instead: lock files via Agora, or ask the human. ` +
          `If a human explicitly authorized this exact operation, re-run it prefixed with GIT_GUARD_ALLOW=1.`,
      };
    }

    if (sub === 'stash') {
      return {
        deny: true,
        reason: `BLOCKED by the shared-checkout git guard: git stash removes in-flight changes from this shared tree. ` +
          `Multiple agents work this tree concurrently (check ${baseUrl} — Agora). ` +
          `Coordinate instead: lock files via Agora, or ask the human. ` +
          `If a human explicitly authorized this exact operation, re-run it prefixed with GIT_GUARD_ALLOW=1.`,
      };
    }
  }
  return { deny: false };
}

function isMainModule() {
  const invoked = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
  return invoked.endsWith('tools/agora/guardGit.mjs');
}

if (isMainModule()) {
  let raw = '';
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    let command = '';
    try {
      const input = JSON.parse(raw || '{}');
      command = (input.tool_input && input.tool_input.command) || '';
    } catch {
      // Unparseable input: fail OPEN for the hook (never brick all Bash), the
      // permission system still applies.
      process.stdout.write(JSON.stringify({}));
      return;
    }
    decide(command).then((d) => {
      if (d.deny) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: d.reason,
          },
        }));
      } else {
        process.stdout.write(JSON.stringify({}));
      }
    }).catch(() => {
      process.stdout.write(JSON.stringify({}));
    });
  });
}
