# Codex Terminal — Dev Hub Integration

**Date:** 2026-02-27
**Status:** Approved

## Summary

Add a "Codex Terminal" card to the 8-card navigation grid in `misc/dev_hub.html`. Clicking it opens a draggable, resizable window (vanilla JS port of `src/components/ui/WindowFrame.tsx`) containing a live SSE terminal connected to a persistent `codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox --search` process. The user types freely; each message is written to the process's stdin.

## Architecture

### Server — new `codexChatManager` Vite plugin (`vite.config.ts`)

New interface alongside the existing `CodexJob`:
```typescript
interface CodexChatSession {
  proc: ReturnType<typeof spawn> | null;
  subscribers: Array<(chunk: string) => void>;
  buffer: string[];
  alive: boolean;
}
const codexChatSessions = new Map<string, CodexChatSession>();
```

Four endpoints:

| Method | Path | Action |
|--------|------|--------|
| POST | `/api/codex-chat/start` | Spawn `codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox --search`, return `{ sessionId }` |
| GET  | `/api/codex-chat/:id/stream` | SSE stream of stdout/stderr with buffer replay + 25s heartbeat |
| POST | `/api/codex-chat/:id/send` | Write `message + "\n"` to proc stdin |
| POST | `/api/codex-chat/:id/kill` | SIGTERM, mark `alive: false` |

- Session auto-cleans after 30 min post-exit
- `proc.on('error', ...)` handler prevents Vite crash on ENOENT
- `shell: process.platform === 'win32'` for `.cmd` resolution (same as codexRunManager)
- SSE stream stays open indefinitely — `__SESSION_END__` sent on process exit, but stream is not ended
- No script-name validation needed — send endpoint accepts free-form text; length capped at 2000 chars

### Client — `misc/dev_hub.html`

#### 1. New card in the existing `.grid`

```
[Agent Tool badge]
◈ CODEX TERMINAL
Live AI session with web search enabled.
Codex sits idle until you send a prompt.
```

#### 2. Vanilla JS window frame (port of `WindowFrame.tsx` + `useResizableWindow.ts`)

CSS classes: `.cterm-overlay`, `.cterm-window`, `.cterm-titlebar`, `.cterm-body`, `.cterm-terminal`, `.cterm-input-row`, `.cterm-resize-*`

Behaviour matching the React component:
- Drag by title bar (left mouse only, not from buttons)
- 8 resize handles (4 corners + 4 edges) with amber-400 hover glow
- Maximize/restore toggle button
- Min 600×400px, max viewport − 40px
- Position + size persisted to `localStorage` key `codex-terminal-window`
- Constrained to viewport with 20px margin during drag

#### 3. Terminal lifecycle

```
Open card click
  → POST /api/codex-chat/start
  → GET  /api/codex-chat/:id/stream  (EventSource)
  → Status dot: ● live (green)
  → Input always visible

User types + sends
  → POST /api/codex-chat/:id/send { message }
  → Send button disabled, re-enabled after 300ms quiet on SSE

__SESSION_END__ received
  → Status dot: ● offline (red)
  → Input disabled (session dead)
  → "Session ended" shown in terminal

Close / Kill
  → POST /api/codex-chat/:id/kill
  → EventSource.close()
  → Window hidden
```

#### 4. Re-open behaviour

If the window is already open (session alive), clicking the card brings it to front rather than spawning a second session.

## Files Changed

- `vite.config.ts` — add `codexChatManager` plugin
- `misc/dev_hub.html` — new card, window frame CSS + HTML + JS (self-contained, no external deps)

## Out of Scope

- PTY / node-pty (not needed for initial implementation)
- Tabs or multiple simultaneous sessions
- Session history persistence beyond the buffer in memory
