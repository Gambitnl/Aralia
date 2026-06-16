> **RESOLVED 2026-06-15 — root cause found, no external analysis needed.**
> The CPU runaway was NOT node-pty or the terminal host. The repo `.mcp.json`
> defines a `github` MCP server (`npx -y @modelcontextprotocol/server-github`)
> with an **empty `GITHUB_PERSONAL_ACCESS_TOKEN`**. The server exits instantly on
> launch; Copilot CLI **respawns it in a tight loop** (a fresh `npx.cmd` every
> few hundred ms — see `~/.copilot/logs/process-*.log`), pegging the CPU. It
> happens to ANY copilot launched in the repo dir, regardless of terminal host —
> which is why a real OS console ALSO spiked and a VS Code terminal wouldn't help.
> Fix A (done): login consoles now launch with cwd=%USERPROFILE% (no .mcp.json →
> no project MCP servers → no retry loop). Fix B (pending user): repair/remove the
> empty-token github server in .mcp.json so it stops affecting every MCP CLI.
> The analysis prompt below is retained for history only.

---

# Problem statement: hosting interactive login CLIs in a browser-embedded terminal without runaway CPU

## What I'm trying to achieve
I have a local dashboard ("Agent Matrix", a static HTML page served by a Vite dev
server) that shows a "Live Dispatches" panel: a grid of xterm.js terminals, each
mirroring a server-side PTY. It already works well for **non-interactive** agent
runs (`codex exec ...`, `gemini -p ...`, `qodercli -p ...`) — those spawn, stream
output into a tile, and exit cleanly.

I want the same panel to host **interactive OAuth login flows** for several coding
CLIs, so I can watch and type into the login right inside the dashboard (e.g. type
`/login`, see a device code, complete it). Specifically: GitHub Copilot CLI
(`copilot`), Kilo (`kilo auth login`), Cursor Agent (`cursor-agent login`).

## The blocking problem
Spawning these interactive login CLIs through the server-side node-pty rig makes
the machine run away:
- **CPU spikes to ~92%** almost immediately on spawning `copilot`.
- The Vite dev server's middleware **stops responding** — every `/api/*` route
  hangs (not just the terminal one), until I restart the server.
- **conhost.exe processes leak** badly — they accumulated from ~tens to ~190 over
  a session of spawn attempts; after the copilot spawn one `conhost` was sitting
  at **211 CPU-seconds** (a clear runaway), most others at 0.
- Earlier in the session the Vite Node process also crashed outright with a
  node-pty stack trace: `AttachConsole failed` thrown from
  `node-pty/lib/conpty_console_list_agent.js:13` (`getConsoleProcessList(shellPid)`).

Non-interactive dispatches that **exit quickly** do NOT trigger this. The runaway
correlates with **long-lived, heavy, redraw-heavy interactive Node CLIs** spawned
without a real TTY.

## Environment / system specs
- OS: Windows 11 Pro, build 26200
- CPU: AMD Ryzen 7 3700X (8 cores / 16 threads)
- RAM: 32 GB
- Node: v22.19.0, npm 11.14.1
- node-pty: **1.1.0** (supports `useConpty?: boolean` and `useConptyDll?: boolean`)
- Terminal frontend: xterm.js + FitAddon, fed over a WebSocket from the dev server
- Not running inside Windows Terminal (`WT_SESSION` absent); the dev server is
  launched as `node node_modules/vite/bin/vite.js --port 5177 --strictPort`.
- The offending CLI `copilot` is `@github/copilot` v1.0.60 (a heavy Node CLI that
  loads MCP servers and does a device-code OAuth flow on `/login`).

## Architecture details that matter
- A Vite plugin (`agentSessionManager`) owns a `Map` of sessions. On spawn it does:
  `pty.spawn('cmd.exe', ['/c', <command>], { name:'xterm-256color', cols, rows,
  cwd, env: process.env })`. Default backend = conpty.
- `proc.onData(chunk => { session.buffer += chunk; trim to 400k; broadcast chunk to
  all WS clients })`.
- `proc.onExit(...)` marks status and prunes.
- REST: POST /spawn, GET /sessions, POST /:id/kill, DELETE /:id. The plugin shares
  the single Vite Node event loop with all other `/api/*` routes.

## Methodology already tried (and results)
1. **Per-chunk buffer+broadcast** (original): hung the server when an interactive
   login was spawned.
2. **Output coalescing** — accumulate `onData` into a pending string, flush to
   buffer + WS broadcast on a 24 ms timer (~40 Hz) instead of per chunk, to bound
   event-loop work from redraw floods. → Did NOT fix it; the spawn POST itself hung
   before meaningful output, suggesting the block is at spawn time, not streaming.
3. **winpty backend** — `pty.spawn(..., { useConpty: false })` to avoid the conpty
   `conhost`/`AttachConsole` console-list agent entirely. → Did NOT fix it; copilot
   still pegged CPU on spawn.
4. **Isolated reproduction** — a standalone `node` script (no Vite) calling
   `pty.spawn('cmd.exe', ['/c','copilot'], {...})` to measure whether `spawn()`
   blocks and how much output arrives in 6 s. (Inconclusive in my run — tooling
   flakiness — but worth a clean redo by whoever solves this.)
5. **Detached OS console (current workaround, WORKS)** — instead of node-pty, the
   "log in" button hits an endpoint that runs
   `spawn('cmd.exe', ['/c','start', '<title>', 'cmd','/k', <loginCmd>],
   { detached:true, stdio:'ignore' }).unref()`. This opens a real console window on
   the desktop; no CPU spike, no conhost leak, dev server stays responsive. The
   downside (why this prompt exists): it's a **separate desktop window**, not
   embedded/visible inside the dashboard's Live Dispatches panel.

## What I want from you (the heavy-thinking agent)
Figure out whether — and exactly how — an interactive login CLI like GitHub
Copilot CLI can be hosted in a server-side PTY and mirrored into a browser xterm on
THIS Windows setup **without** the CPU runaway / conhost leak / event-loop stall.
Concretely:

1. **Root-cause it.** Why does spawning `copilot` (and similar) via node-pty 1.1.0
   on Win11/conpty peg the CPU and leak conhosts, while short-lived non-interactive
   spawns don't? Is it: a busy-redraw loop because the program can't detect a real
   TTY / terminal size; the conpty `conhost` pseudo-console plus the
   `conpty_console_list_agent` polling; copilot spawning its own child processes;
   a known node-pty/conpty interaction with Electron/Node CLIs; missing
   `cols/rows`/resize; an env flag (e.g. `TERM`, `CI`, `NO_COLOR`,
   `FORCE_COLOR`) that would calm its render loop?
2. **Propose concrete fixes to test**, ranked, e.g.: node-pty options
   (`useConptyDll`, explicit initial resize, flow control), spawning copilot
   directly instead of via `cmd.exe /c`, setting env to signal non-interactive/
   dumb-terminal, isolating each PTY in a worker thread or child process so a
   runaway can't stall the Vite event loop, capping/curbing output, or an
   alternative pseudo-terminal approach.
3. **If embedding is genuinely unsafe**, design the best "visible in the dashboard"
   alternative: e.g. run the login in a detached console but tee its output to a
   logfile and have a read-only dashboard tile poll/stream that file (so the device
   code etc. is visible in-dashboard while the user types in the real console).
   Detail the Windows-specific mechanics of teeing an interactive console's output
   to a file without breaking its interactivity.
4. Give me a **decision: embed-safely vs. mirror-only**, with the reasoning.

## Constraints
- Must never peg the user's CPU or leak processes. This is the hard requirement.
- Single-developer local tooling on the Windows machine above; no need for
  cross-platform, but don't regress the working non-interactive dispatch tiles.
- Prefer changes localized to the `agentSessionManager` Vite plugin + the dashboard
  page; avoid swapping the whole terminal stack unless clearly necessary.
- The login is OAuth/device-code: the user authenticates in a browser; the terminal
  mostly needs to display a prompt/code and accept a keystroke or two.
