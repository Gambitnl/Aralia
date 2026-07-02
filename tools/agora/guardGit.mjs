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

const RULES = [
  {
    re: /\bgit\b[^&|;]*\breset\b[^&|;]*(--hard|--merge|--keep)\b/i,
    what: 'git reset --hard/--merge/--keep discards every agent\'s uncommitted work in this shared tree',
  },
  {
    re: /\bgit\b[^&|;]*\bcheckout\b/i,
    what: 'git checkout switches/overwrites the shared working tree under other agents (branches are also forbidden in this repo — work in master)',
  },
  {
    re: /\bgit\b[^&|;]*\bswitch\b/i,
    what: 'git switch changes the shared working tree under other agents (branches are forbidden in this repo — work in master)',
  },
  {
    re: /\bgit\b[^&|;]*\brestore\b/i,
    what: 'git restore discards working-tree changes that may belong to another agent',
  },
  {
    re: /\bgit\b[^&|;]*\bclean\b/i,
    what: 'git clean deletes untracked files — including other agents\' new files and gitignored coordination state (.agent/agora)',
  },
  {
    re: /\bgit\b[^&|;]*\bstash\b/i,
    what: 'git stash removes in-flight changes from the shared tree (including other agents\'); the stash-dance has caused near-loss before',
  },
];

export function decide(command) {
  const cmd = String(command || '');
  if (/\bGIT_GUARD_ALLOW=1\b/.test(cmd)) return { deny: false };
  for (const rule of RULES) {
    if (rule.re.test(cmd)) {
      return {
        deny: true,
        reason:
          `BLOCKED by the shared-checkout git guard: ${rule.what}. ` +
          `Multiple agents work this tree concurrently (check http://localhost:4319 — Agora). ` +
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
    const d = decide(command);
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
  });
}
