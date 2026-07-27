# Process hygiene for the local dev dashboard

**Date:** 2026-07-20
**Status:** design approved, spec under review
**Surfaces:** `misc/active-dev-servers.html` (Processes tab), `scripts/vite-plugins/devhub/devServerRoutes.ts`

## Problem

Leaked dev processes pile up on the machine. Dead Chrome DevTools MCP servers still pointing at a `:9222` that is gone, orphaned Playwright daemons, and their `cmd`/`conhost` trees keep running because the launcher (Claude, VS Code, npx) did not reap its children when a session ended or crashed.

The dashboard already **classifies** each process — Keep, Likely leaked, or Auto — but it can only look, not act. This feature adds three things: a one-click bulk kill of the likely-leaked set, an opt-in background reaper so they stop piling up, and an advisory risk-detection layer for anything strange.

## Safety model (the core invariant)

This is the part that must not be got wrong, because the page can now end processes.

- **The server decides what is killable, never the browser.** The kill endpoint re-lists processes and re-runs classification itself, and will only ever kill processes it currently rates **Likely leaked**.
- **Hard never-kill set, enforced server-side.** These can never be killed even by a malformed request: the `:3000` dev server, the Agora daemon (`tools/agora/server.mjs`), the Codex runtime, VS Code (`Code.exe`) and its descendants, `claude.exe` and its ancestor chain (the running assistant), and anything the classifier rates Keep or Auto.
- **The client can only narrow, never widen.** A caller may pass a list of PIDs; the server intersects it with its own likely-leaked set. A PID outside that set is dropped, not killed.
- **Dry run first.** The preview shows exactly what would die. Nothing is killed without an explicit confirm (manual button) or the reaper being switched on (opt-in, off by default).
- **Everything is logged** — what was killed, what was skipped, and why.

## Architecture change: classification moves server-side

Today the classifier (`getNodeProcessTool` + `getProcessDisposition`) runs in the browser. A server-authoritative kill needs the same classification on the server, so we make the server the single source of truth:

- Extract the tool-label, disposition, and risk logic into `devServerRoutes.ts` (or a small sibling module it imports).
- `GET /api/dev/node-processes` returns `disposition` and `risk` per process, already computed.
- The dashboard renders those fields instead of computing them. The kill endpoint and the reaper use the same server-side classifier.

This removes client/server drift and is what makes the kill guard trustworthy. It is the largest single piece of the change.

## Component 1: guarded kill endpoint

- `POST /api/dev/kill-processes`, input `{ pids?: number[], dryRun?: boolean }`.
- Flow: list processes → classify → compute the likely-leaked set → intersect with `pids` when provided → apply the never-kill guard → if `dryRun`, return the target list plus skipped items with reasons; otherwise kill each (`taskkill /PID <id> /T /F` on Windows) and return `{ killed, failed, skipped }`.
- A kill failure (access denied, already exited) is reported per PID and is not fatal.

## Component 2: kill button and confirm (frontend)

- A "Kill likely-leaked (N)" button on the Processes tab, where N is the current likely-leaked count. Disabled when N is 0.
- Click runs a dry run, shows a preview listing the exact rows (PID, tool, reason), and waits for Confirm or Cancel.
- Confirm calls the real kill, then shows a short summary (killed X, skipped Y) and refreshes the table.

## Component 3: opt-in reaper

- A background interval inside the dev-server plugin, controlled by `POST /api/dev/reaper { enabled, intervalMs? }` and read by `GET /api/dev/reaper`.
- State persists to a small file under `.agent/` so it survives dev-server restarts. Off by default.
- When on, it runs the guarded kill (non-dry-run) on the current likely-leaked set every interval and appends to a reaper log. Default interval 10 minutes, configurable.
- Frontend: a toggle, an interval selector, and a "last reaped: <time> (<n> killed)" readout.
- **Deferred alternative:** a Windows Scheduled Task running a standalone reaper script, for cleanup even when no dev server is up. Not in v1; revisit if the in-server interval proves too limited.

## Component 4: risk detection (advisory only)

Separate from disposition, and never fed to the kill or reaper — killing a merely "risky" process would be dangerous. Each process gets `risk: { level: 'none' | 'low' | 'high', flags: string[] }`.

Signals:

1. **Unusual location** — exe or script path under Temp, Downloads, `AppData\Local\Temp`, or scratch dirs rather than a normal install or repo path.
2. **Command red-flags** — encoded/`-enc` PowerShell, `iwr | iex`, `curl … | bash`/`sh`, or a hidden window (`-WindowStyle Hidden`) combined with network activity.
3. **Network listeners** — cross-referenced with netstat; flag binds on non-loopback addresses (`0.0.0.0`, `::`) or public interfaces.
4. **Unsigned binaries** — Authenticode via `Get-AuthenticodeSignature`. This adds latency, so compute it lazily and cache it; it must never block the fast process list.
5. **Judgment additions** — parent/child mismatch (an Office app spawning a shell), an exe on a UNC/network path (`\\…`), and random or high-entropy script/exe names.

Frontend: a "Risk" column with the level and its flag reasons, sortable and filterable. Advisory only.

## Data flow

Scan (PowerShell CIM query) → server computes disposition + risk → `GET /api/dev/node-processes` returns processes with both → dashboard renders the Close? column (disposition) and the Risk column (risk) → the kill button and reaper call `POST /api/dev/kill-processes`, which re-derives the set server-side.

## Error handling

- Kill failures are per-PID and non-fatal.
- Signature and netstat lookups degrade gracefully: on failure the risk flag is omitted, not surfaced as an error, and the process list still returns fast.
- Reaper errors are logged; the reaper keeps running.

## Testing

- **Guard unit tests** — given a mixed process list, the kill set contains only likely-leaked and excludes Keep, Auto, the critical set, and `claude.exe`/its chain; a client PID outside the leaked set is dropped; dry run kills nothing.
- **Risk-signal unit tests** — the location, command-regex, and parent/child-mismatch checks against fixtures.
- **Integration** — the dry-run endpoint returns the expected target set for a synthetic process table.
- **Live** — in-browser: the preview matches, the kill removes only leaked rows, and the reaper toggle persists across a dev-server restart.

## Out of scope for v1

- Killing "risky" processes (advisory only, always).
- The Windows Scheduled Task reaper (noted as a future option).
- Anything cross-machine or remote.

## Decisions already made

- Automation: manual button plus an opt-in, server-side interval reaper.
- Risk signals: all four categories plus the judgment additions.
- Kill target: likely-leaked only; risky is never auto-killed.
