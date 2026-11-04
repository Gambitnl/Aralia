#!/usr/bin/env node
/**
 * @file tools/agora/guardMemory.mjs
 * PreToolUse hook: HARD-BLOCK agent writes to org-tier memory files.
 *
 * What this file does:
 * 1. Reads the hook payload from stdin (`tool_name`, `tool_input.file_path`).
 * 2. Matches the target path against the `orgReadOnly` globs in
 *    `.claude/memory-permissions.json`.
 * 3. On a match it returns a PreToolUse `deny` decision; otherwise it allows.
 *
 * Why it exists:
 * Anthropic's memory talk: org-wide context must be read-only to agents, so one
 * agent cannot corrupt what every other agent reads. Remy's standing directives
 * (`remy-*.md`) and `AGENTS.md` are that tier here. Before this hook the only
 * write guard was the destructive-git guard; nothing stopped an agent from
 * rewriting a directive. Sibling of `guardGit.mjs`.
 *
 * Safety: the guard FAILS OPEN on any internal error (bad JSON, missing
 * manifest) and says so on stderr, so a bug here cannot block every write.
 * Remy edits org-tier files directly, outside an agent, so the block never
 * applies to him.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = resolve(HERE, '..', '..', '.claude', 'memory-permissions.json');
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const isWin = process.platform === 'win32';

const norm = (p) => { let s = String(p).replace(/\\/g, '/'); return isWin ? s.toLowerCase() : s; };

/** Convert a glob (`**`, `*`, `?`) to an anchored RegExp over a forward-slash path. */
function globToRegExp(glob) {
  let re = '';
  const g = norm(glob);
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function allow() { process.exit(0); }
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  try {
    const payload = raw.trim() ? JSON.parse(raw) : {};
    if (!WRITE_TOOLS.has(payload.tool_name)) allow();
    const target = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path;
    if (!target) allow();
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    const path = norm(resolve(String(target)));
    for (const glob of manifest.orgReadOnly ?? []) {
      if (globToRegExp(glob).test(path)) {
        deny(`BLOCKED by memory permission tier: "${target}" is org read-only (matched "${glob}" in .claude/memory-permissions.json). `
          + 'Agents do not edit org-tier memory. Ask Remy to make this change directly, or propose it in a dream report.');
      }
    }
    allow();
  } catch (error) {
    // Fail open: a broken guard must never block all writes. Say so loudly.
    process.stderr.write(`guardMemory: internal error, allowing write (${error?.message ?? error})\n`);
    allow();
  }
});
