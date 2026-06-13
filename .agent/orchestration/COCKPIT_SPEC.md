# Agent Matrix v2 — "Cockpit" Spec (approved 2026-06-12)

Redesign of `misc/agent_matrix.html` into a single-screen mission-control cockpit.
Brainstormed with Remy via visual companion; layout option A chosen from
`.superpowers/brainstorm/2390-1781270282/content/layout-v2.html`.

## Decisions (interview)
1. **Goals:** mission-control reorg + navigability + visual refresh + live-data-driven (all four).
2. **Layout:** Cockpit (option A) — one dense screen, no long scroll.
3. **Tile fidelity:** REAL embedded terminals (xterm.js over PTY WebSocket), interactive (can type into a tile).
4. **Dispatch flow:** Hybrid — cockpit quick-dispatch form AND external orchestrators share the same spawn API.

## Layout
- **Quota strip (top):** one chip per active agent (claude, codex, agy, qoder, gemini, …) — status dot,
  quota bar(s), key dates ("dry → resets Jun 15"). Data: `/api/agent-usage` cache on load; per-chip and
  fetch-all probe buttons (`?refresh=1`). Clicking a chip opens that agent's **reference drawer**.
- **Reference drawers:** slide-over panel holding the agent's existing hand-maintained reference section
  (commands, flags, limits, deals, learnings). Content migrated 1:1 from current per-agent sections
  (agent_matrix.html lines ~779–1407). Hand-edited in place, same as today.
- **Dispatch grid (center):** xterm.js tile per session from `GET /api/agent-sessions`; attach
  `ws://host:<wsPort>/?sid=<id>`; scrollback replays on connect. Tiles: title, agent pill, elapsed,
  kill button; interactive input; dim on exit w/ exit code; removable (DELETE).
- **Right rail:** activity feed + quick-dispatch form (title, agent select, cwd, command) →
  `POST /api/agent-sessions/spawn`.

## Backend (existing, minor touches only)
- `scripts/vite-plugins/agentSessionManager.ts` — already provides spawn/list/kill/delete + WS attach.
  Touches: append spawn/exit events to `.agent/orchestration/activity.jsonl`; raise MAX_DONE_RETAINED.
- `scripts/vite-plugins/agentUsageProbe.ts` — unchanged; feed quota chips. Probe completions also
  logged to activity feed (optional).
- `GET /api/agent-activity` (new, in agentSessionManager) → last N lines of activity.jsonl.

## Activity feed events
`{at, kind: 'spawn'|'exit'|'probe'|'note', agent?, title?, detail?}` one JSON per line, appended server-side;
client polls every ~5s and renders newest-first.

## Out of scope (this pass)
- Persisting/reattaching PTY sessions across dev-server restarts (feed survives via JSONL; live PTYs don't).
- Auth/multi-user. Dashboard is local-only.

## Verification bar
Per Remy's visual-inspection rule: load the page on the dev server, spawn a real session via the form,
screenshot the cockpit with a live tile + populated quota chips; eyeball pass required, not just API 200s.
