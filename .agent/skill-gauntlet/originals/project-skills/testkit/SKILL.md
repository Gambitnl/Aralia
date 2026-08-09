---
name: testkit
description: Use when testing or diagnosing Aralia in a real browser — bug troubleshooting, performance/memory checks, or smoke passes over the key game surfaces. Drives the chrome-devtools MCP live and diffs results against saved baselines. Modes: troubleshoot | perf | smoke.
---

# Testkit

Test Aralia through the chrome-devtools MCP ("DevTools for agents"). Three modes,
each a checklist in `workflows/`:

| Mode | When | File |
|------|------|------|
| `troubleshoot` | Something is broken in the running game | `workflows/troubleshoot.md` |
| `perf` | Measure a surface: trace + heap + (2D only) Lighthouse | `workflows/perf.md` |
| `smoke` | Sweep the key surfaces for errors + proof screenshots | `workflows/smoke.md` |

Invoked without a mode? Ask which one (use AskUserQuestion).

## Ground rules (all modes)

1. **Dev server first.** Target the `dev` launch config. The port is dynamic (autoPort): resolve it from preview_start's output, and use base URL `http://localhost:<port>/Aralia/`.
   If it is not running, start it via the preview tools (`preview_start` with
   name `dev`), never via Bash. If it will not start or the chrome-devtools MCP
   tools are unavailable, STOP and say so — no fallback path.
   Before opening Chrome or writing a screenshot, name one repo-relative source
   file that should be current and run the bounded WF-G30 gate:
   ```powershell
   node scripts/dev-server-watchdog.cjs probe --base http://127.0.0.1:<port>/Aralia/ --module src/path/to/changed-file.tsx --timeout-ms 3000
   ```
   `LIVENESS_FAILURE` means the base page did not answer in time.
   `FRESHNESS_FAILURE` means HTTP answered but the cache-busted Vite `?raw`
   module did not match the checkout's SHA-256. Both are hard stops before any
   screenshot. The canonical `tools/vistest/shoot.ts` command enforces the same
   gate with its required `--fresh-module <path>` flag.
2. **Chrome with the debug port.** The chrome-devtools MCP needs Chrome listening on port 9222. Check with `Invoke-WebRequest http://127.0.0.1:9222/json/version`. If it fails, launch an isolated Chrome instance so the operator's real browser stays untouched:
   ```powershell
   Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList '--remote-debugging-port=9222','--user-data-dir=<session scratchpad>\chrome-testkit','--no-first-run','--no-default-browser-check','--window-size=1936,1156','about:blank'
   ```
   The profile directory must always be a scratch path, never the real profile. On teardown, close the instance or leave it — it holds no user data. A worker must never reuse a supervisor's already-open instance for destructive actions.
3. **Fresh console only.** Chrome buffers console messages; a buffer read after
   the fact can be stale. Navigate (or reload) first, then read
   `list_console_messages`. For World3D issues use the in-page deterministic
   replay recipe instead of trusting old output.
4. **Screenshots are the pass condition for anything visual.** Never report a
   visual surface as working from numbers alone. R3F/WebGL scenes can hang naive
   screenshot paths — if `take_screenshot` stalls, fall back to the repo's
   shoot.mjs rig or a rAF readback, and say which you used.
5. **Baselines.** When a mode produces metrics, write them into the run-JSON
   shape below and run `node tools/testkit/baseline.mjs <run.json>`
   (`--promote` only when the user agrees the run is the new baseline). Runs
   live in `.agent/testkit/` (gitignored).
6. **Recovery needs explicit ownership and consent.** A worker must not restart
   a server merely because its port or PID is known. The read-only watcher:
   ```powershell
   node scripts/dev-server-watchdog.cjs watch --base http://127.0.0.1:<port>/Aralia/ --module src/path/to/changed-file.tsx --failure-threshold 3
   ```
   stops with diagnosis and asks for the owning operator. The opt-in
   `supervise` mode accepts `--consent-restart-owned-child`, but it can restart
   only the Vite child that the same watchdog invocation launched after `--`.
   It never attaches to or kills an existing listener. Probe and restart
   receipts append to `.agent/dev-server-watchdog.log`; Vite preload lifecycle
   receipts append to `.agent/dev-server-owner.log`. Both are Git-ignored logs.

## Run JSON shape

    {
      "surfaces": {
        "<surface-name>": {
          "consoleErrors": 0,
          "heapMB": 312.4,
          "lcpMs": 1800,
          "longTasksMs": 240
        }
      }
    }

`consoleErrors` regresses on any increase; `heapMB` on +15%; every other numeric
metric on +20%.

## Known gotchas (apply in every mode)

- StrictMode double-invokes effects and clobbers one-shot drill signals — a
  "missed" 3D drill is often this, not a bug.
- Combat runs without Ollama via `?dummy=1&dev_combat=1`.
- The player's streamed cell is not the town cell — town identity comes from
  `groundTownBurgs`.
