---
name: codex-wtWaitFor-polling
description: |
  Block on Codex CLI (or any xterm.js PTY terminal in a preview page) completing
  a turn instead of manually polling every N seconds. Use when: (1) you sent a
  message to Codex via wtSend() and need to wait for END_TURN, (2) you keep
  forgetting to poll or polling too frequently/infrequently, (3) you want a
  single preview_eval call that returns only when the terminal outputs a specific
  string. Requires the terminal page to expose window.wtWaitFor(pattern, timeoutMs).
author: Claude Code
version: 1.0.0
date: 2026-02-28
---

# Blocking Wait for Codex END_TURN via wtWaitFor

## Problem
After sending a brief to Codex via `wtSend()`, there's no automatic mechanism to
be notified when it finishes. Manual polling (checking every 30s) is either forgotten
after the response ends, or done too frequently (every 3s) which is token-heavy.

## Context / Trigger Conditions
- You used `wtSend(message)` + `wtSend('\r')` to send a task to Codex
- You need to wait for Codex to output `END_TURN` before proceeding
- You're tempted to set a reminder or rely on the user to ping you
- The terminal page exposes `window.wtWaitFor(pattern, timeoutMs)`

## Solution

**Immediately after submitting** (after `wtSend('\r')`), set a baseline and call
`wtWaitFor` in a single `preview_eval` — it blocks until the pattern appears:

```javascript
// Step 1: Let the message echo settle (1-2s), then capture baseline
(async () => {
  await new Promise(r => setTimeout(r, 1500));
  window._baseline = wtGetText().length;

  // Step 2: Block until END_TURN appears AFTER the baseline
  const start = wtGetText().length;
  const deadline = Date.now() + 300000; // 5 min timeout
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000));
    const newText = wtGetText().slice(start);
    if (newText.includes('END_TURN')) {
      return newText.slice(-2000); // return last 2000 chars of response
    }
  }
  return 'TIMEOUT: ' + wtGetText().slice(-500);
})()
```

**Why not use `wtWaitFor` directly?**
`window.wtWaitFor('END_TURN', 300000)` scans the *entire* terminal buffer — it
resolves immediately if "END_TURN" already exists from a previous turn. The manual
polling loop above scans only *new* text after the baseline.

## Verification
The `preview_eval` call will block (up to the tool timeout) and return the tail of
Codex's response including `END_TURN`. You then verify commits with `git log --oneline`.

## Example
```javascript
// Send the brief
wtSend(briefMessage);
wtSend('\r');

// Immediately set up the blocking wait in the SAME response
(async () => {
  const start = wtGetText().length;
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000));
    if (wtGetText().slice(start).includes('END_TURN')) {
      return wtGetText().slice(start).slice(-2000);
    }
  }
  return 'TIMEOUT';
})()
```

## Notes
- Set `start = wtGetText().length` AFTER `wtSend('\r')` and a short delay so the
  echoed message text doesn't false-positive match END_TURN
- `preview_eval` has a tool-level timeout; for very long Codex runs (>5 min) you
  may need to re-invoke with a fresh baseline
- `wtWaitFor(pattern, ms)` is a convenience for NEW waits where the buffer is clean
  — fine for waiting for the Codex prompt on startup (`wtWaitFor('model:', 30000)`)
- Always use the terminal's `serverId` from `preview_start("dev")`, not the roadmap
  server — keep Codex terminal on the main dev server, roadmap UI on dev:roadmap

## Related Skills
- `preview-multi-server-tabs` — keep Codex terminal on one serverId, UI on another
