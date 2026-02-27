# Codex Terminal Dev Hub — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Codex Terminal card to the dev hub navigation grid that opens a draggable, resizable window with a live SSE terminal connected to a persistent `codex --no-alt-screen --dangerously-bypass-approvals-and-sandbox --search` process.

**Architecture:** New `codexChatManager` Vite plugin handles four endpoints (`/api/codex-chat/start|stream|send|kill`). The client is entirely vanilla JS/CSS in `dev_hub.html` — a port of the React `WindowFrame` component into `.cterm-*` classes with full drag, resize, and localStorage persistence.

**Tech Stack:** Node.js `spawn`, SSE, vanilla JS, CSS custom properties. No new npm dependencies.

---

### Task 1: Add `CodexChatSession` interface and session map to `vite.config.ts`

**Files:**
- Modify: `vite.config.ts` (after line 77, the `isSafeScriptName` function)

**Step 1: Insert after the existing `codexRunManager` declarations block (after line 77)**

```typescript
// ==================== Codex Chat Manager ====================
interface CodexChatSession {
  proc: ReturnType<typeof spawn> | null;
  subscribers: Array<(chunk: string) => void>;
  buffer: string[];
  alive: boolean;
}
const codexChatSessions = new Map<string, CodexChatSession>();
```

**Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors (Vite will also show errors in its console on restart).

---

### Task 2: Add `codexChatManager` plugin body to `vite.config.ts`

**Files:**
- Modify: `vite.config.ts` (insert between `codexRunManager` closing `})` and the next plugin definition — around line 1220)

**Step 1: Find exact insertion point**

```bash
grep -n "^const portraitApiManager\|^});" vite.config.ts | head -10
```
Insert the new plugin BEFORE `portraitApiManager`.

**Step 2: Insert the full plugin**

```typescript
const codexChatManager = () => ({
  name: 'codex-chat-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      const jsonReply = (res: any, data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      // ── POST /api/codex-chat/start  →  spawn codex, return sessionId ──
      if (urlPath === '/api/codex-chat/start' && req.method === 'POST') {
        try {
          const sessionId = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
          const cwd = process.cwd();
          // --no-alt-screen: inline/pipe-friendly mode (no alternate screen buffer)
          // shell: true on Windows resolves codex.cmd wrapper
          const proc = spawn(
            'codex',
            ['--no-alt-screen', '--dangerously-bypass-approvals-and-sandbox', '--search'],
            { cwd, shell: process.platform === 'win32', windowsHide: true }
          );
          const session: CodexChatSession = { proc, subscribers: [], buffer: [], alive: true };
          codexChatSessions.set(sessionId, session);

          const emit = (chunk: string) => {
            session.buffer.push(chunk);
            for (const fn of session.subscribers) fn(chunk);
          };

          proc.stdout?.on('data', (data: Buffer) => emit(Buffer.from(data).toString('base64')));
          proc.stderr?.on('data', (data: Buffer) => emit(Buffer.from(data).toString('base64')));
          proc.on('error', (err: Error) => {
            emit(Buffer.from(`[spawn error: ${err.message}]\n`).toString('base64'));
            session.alive = false;
            for (const fn of session.subscribers) fn('__SESSION_END__:-1');
            setTimeout(() => codexChatSessions.delete(sessionId), 30 * 60 * 1000);
          });
          proc.on('close', (code: number | null) => {
            if (!session.alive) return;
            session.alive = false;
            for (const fn of session.subscribers) fn(`__SESSION_END__:${code ?? -1}`);
            setTimeout(() => codexChatSessions.delete(sessionId), 30 * 60 * 1000);
          });

          jsonReply(res, { sessionId });
        } catch (e) {
          jsonReply(res, { error: String(e) }, 500);
        }
        return;
      }

      // ── GET /api/codex-chat/:id/stream  →  SSE ────────────────────────
      const streamMatch = urlPath.match(/^\/api\/codex-chat\/([0-9a-f]+)\/stream$/);
      if (streamMatch && req.method === 'GET') {
        const sessionId = streamMatch[1];
        const session = codexChatSessions.get(sessionId);
        if (!session) { jsonReply(res, { error: 'Session not found.' }, 404); return; }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        const send = (chunk: string) => { if (!res.writableEnded) res.write(`data: ${chunk}\n\n`); };
        for (const chunk of session.buffer) send(chunk);
        if (!session.alive) send('__SESSION_END__:-1');

        const subscriber = (chunk: string) => send(chunk);
        session.subscribers.push(subscriber);

        const heartbeat = setInterval(() => {
          if (!res.writableEnded) res.write(': keepalive\n\n');
          else clearInterval(heartbeat);
        }, 25_000);

        req.on('close', () => {
          clearInterval(heartbeat);
          session.subscribers = session.subscribers.filter((fn: any) => fn !== subscriber);
        });
        return;
      }

      // ── POST /api/codex-chat/:id/send  →  write to stdin ─────────────
      const sendMatch = urlPath.match(/^\/api\/codex-chat\/([0-9a-f]+)\/send$/);
      if (sendMatch && req.method === 'POST') {
        try {
          const sessionId = sendMatch[1];
          const session = codexChatSessions.get(sessionId);
          if (!session || !session.alive || !session.proc) {
            jsonReply(res, { error: 'Session not found or dead.' }, 404); return;
          }
          const body = JSON.parse(await readBody(req));
          const message = String(body?.message || '').slice(0, 2000);
          if (!message.trim()) { jsonReply(res, { error: 'Empty message.' }, 400); return; }
          session.proc.stdin?.write(message + '\n');
          jsonReply(res, { ok: true });
        } catch (e) {
          jsonReply(res, { error: String(e) }, 500);
        }
        return;
      }

      // ── POST /api/codex-chat/:id/kill  →  SIGTERM ────────────────────
      const killMatch = urlPath.match(/^\/api\/codex-chat\/([0-9a-f]+)\/kill$/);
      if (killMatch && req.method === 'POST') {
        const sessionId = killMatch[1];
        const session = codexChatSessions.get(sessionId);
        if (!session) { jsonReply(res, { error: 'Session not found.' }, 404); return; }
        if (session.proc) try { session.proc.kill('SIGTERM'); } catch { /* already exited */ }
        jsonReply(res, { ok: true });
        return;
      }

      next();
    });
  },
});
```

**Step 3: Verify Vite restarts cleanly**

Watch Vite console — should show `vite.config.ts changed, restarting` with no TypeScript errors.

---

### Task 3: Register `codexChatManager` in the Vite plugins array

**Files:**
- Modify: `vite.config.ts` line 1427 (the `plugins:` array in `defineConfig`)

**Step 1: Add `codexChatManager()` to the end of the plugins array**

Change:
```typescript
plugins: [..., codexRunManager()],
```
To:
```typescript
plugins: [..., codexRunManager(), codexChatManager()],
```

**Step 2: Verify with a quick curl**

```bash
curl -s -X POST http://localhost:5173/api/codex-chat/start -H "Content-Type: application/json" -d "{}"
```
Expected: `{"sessionId":"<hex>"}` (codex spawns; may get spawn error if PATH issue but JSON response confirms endpoint works).

**Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add codexChatManager SSE plugin for persistent codex sessions"
```

---

### Task 4: Add `.cterm-*` CSS to `dev_hub.html`

**Files:**
- Modify: `misc/dev_hub.html` (inside the `<link rel="stylesheet" href="dev_hub.css">` section, or add a `<style>` block before `</head>`)

**Step 1: Insert a `<style>` block before `</head>`**

```html
<style>
/* ── Codex Terminal Window ─────────────────────────────────────── */
.cterm-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 8000;
    pointer-events: none;
}
.cterm-overlay.open { display: block; pointer-events: auto; }

.cterm-window {
    position: fixed;
    display: flex;
    flex-direction: column;
    background: #050a14;
    border: 1px solid #7c3aed;
    border-radius: 6px;
    box-shadow: 0 8px 40px rgba(124,58,237,0.35);
    z-index: 8100;
    min-width: 600px;
    min-height: 400px;
    overflow: hidden;
    user-select: none;
}

/* Title bar */
.cterm-titlebar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.75rem;
    background: #0d0920;
    border-bottom: 1px solid #4c1d95;
    cursor: move;
    flex-shrink: 0;
}
.cterm-title {
    flex: 1;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 0.8rem;
    color: #c4b5fd;
    pointer-events: none;
}
.cterm-status-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
    transition: background 0.3s;
}
.cterm-status-dot.dead { background: #ef4444; }
.cterm-btn {
    background: transparent;
    border: 1px solid #4c1d95;
    color: #94a3b8;
    border-radius: 4px;
    font-size: 0.72rem;
    padding: 0.15rem 0.45rem;
    cursor: pointer;
    line-height: 1.4;
}
.cterm-btn:hover { background: #1e1b4b; color: #e2e8f0; }
.cterm-btn.danger { border-color: #7f1d1d; color: #fca5a5; }
.cterm-btn.danger:hover { background: #450a0a; }

/* Body */
.cterm-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.cterm-terminal {
    flex: 1;
    overflow-y: auto;
    padding: 0.6rem 0.9rem;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 0.8rem;
    color: #c7d2fe;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
    background: #050a14;
    scrollbar-width: thin;
    scrollbar-color: #4c1d95 transparent;
}
.cterm-input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    background: #0d0920;
    border-top: 1px solid #4c1d95;
    flex-shrink: 0;
}
.cterm-input-row input {
    flex: 1;
    background: #050a14;
    border: 1px solid #4c1d95;
    border-radius: 4px;
    color: #c4b5fd;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 0.8rem;
    padding: 0.3rem 0.6rem;
    outline: none;
}
.cterm-input-row input:focus { border-color: #7c3aed; }
.cterm-input-row input::placeholder { color: #4c1d95; }
.cterm-input-row input:disabled { opacity: 0.4; cursor: not-allowed; }
.cterm-send-btn {
    background: #3b0764;
    color: #c4b5fd;
    border: 1px solid #7c3aed;
    border-radius: 4px;
    font-size: 0.72rem;
    padding: 0.3rem 0.7rem;
    cursor: pointer;
    white-space: nowrap;
}
.cterm-send-btn:hover { background: #4c1d95; }
.cterm-send-btn:disabled { opacity: 0.45; cursor: default; }

/* Resize handles — amber-400 theme matching WindowFrame.tsx */
.cterm-rh {
    position: absolute;
    z-index: 8200;
}
/* Corners */
.cterm-rh-nw, .cterm-rh-ne, .cterm-rh-sw, .cterm-rh-se {
    width: 12px; height: 12px;
    background: rgba(251,191,36,0.3);
    border-radius: 2px;
}
.cterm-rh-nw:hover, .cterm-rh-ne:hover, .cterm-rh-sw:hover, .cterm-rh-se:hover {
    background: rgba(251,191,36,0.8);
    box-shadow: 0 0 6px rgba(251,191,36,0.6);
}
.cterm-rh-nw { top: 0; left: 0; cursor: nwse-resize; }
.cterm-rh-ne { top: 0; right: 0; cursor: nesw-resize; }
.cterm-rh-sw { bottom: 0; left: 0; cursor: nesw-resize; }
.cterm-rh-se { bottom: 0; right: 0; cursor: nwse-resize; }
/* Edges */
.cterm-rh-n, .cterm-rh-s {
    height: 6px; left: 12px; right: 12px;
    background: rgba(251,191,36,0.15);
}
.cterm-rh-n { top: 0; cursor: ns-resize; }
.cterm-rh-s { bottom: 0; cursor: ns-resize; }
.cterm-rh-n:hover, .cterm-rh-s:hover { background: rgba(251,191,36,0.35); }
.cterm-rh-w, .cterm-rh-e {
    width: 6px; top: 12px; bottom: 12px;
    background: rgba(251,191,36,0.15);
}
.cterm-rh-w { left: 0; cursor: ew-resize; }
.cterm-rh-e { right: 0; cursor: ew-resize; }
.cterm-rh-w:hover, .cterm-rh-e:hover { background: rgba(251,191,36,0.35); }
</style>
```

---

### Task 5: Add the card + window HTML to `dev_hub.html`

**Files:**
- Modify: `misc/dev_hub.html`

**Step 1: Add Codex Terminal card as the 9th card inside the `.grid` div (after the last `</a>` at line ~186)**

```html
        <div class="card" onclick="ctermOpen()" style="cursor:pointer">
            <span class="badge badge-tool">Agent Tool</span>
            <h2>◈ CODEX TERMINAL</h2>
            <p>Live AI session with web search enabled. Codex sits idle until you send a prompt.</p>
        </div>
```

**Step 2: Add the window + overlay HTML before `</body>`**

```html
<!-- ── Codex Terminal Window ────────────────────────────────────── -->
<div class="cterm-overlay" id="ctermOverlay" onclick="ctermOverlayClick(event)"></div>
<div class="cterm-window" id="ctermWindow" style="display:none">
    <!-- Resize handles -->
    <div class="cterm-rh cterm-rh-nw" onmousedown="ctermStartResize('nw',event)"></div>
    <div class="cterm-rh cterm-rh-n"  onmousedown="ctermStartResize('n',event)"></div>
    <div class="cterm-rh cterm-rh-ne" onmousedown="ctermStartResize('ne',event)"></div>
    <div class="cterm-rh cterm-rh-w"  onmousedown="ctermStartResize('w',event)"></div>
    <div class="cterm-rh cterm-rh-e"  onmousedown="ctermStartResize('e',event)"></div>
    <div class="cterm-rh cterm-rh-sw" onmousedown="ctermStartResize('sw',event)"></div>
    <div class="cterm-rh cterm-rh-s"  onmousedown="ctermStartResize('s',event)"></div>
    <div class="cterm-rh cterm-rh-se" onmousedown="ctermStartResize('se',event)"></div>
    <!-- Title bar -->
    <div class="cterm-titlebar" id="ctermTitlebar" onmousedown="ctermStartDrag(event)">
        <span class="cterm-title">◈ Codex</span>
        <span class="cterm-status-dot" id="ctermStatusDot"></span>
        <button class="cterm-btn" onclick="ctermToggleMaximize()" title="Maximize/Restore">⛶</button>
        <button class="cterm-btn danger" onclick="ctermKillSession()" id="ctermKillBtn">■ Kill</button>
        <button class="cterm-btn" onclick="ctermClose()" title="Close (Esc)">✕</button>
    </div>
    <!-- Body -->
    <div class="cterm-body">
        <pre class="cterm-terminal" id="ctermTerminal"></pre>
        <div class="cterm-input-row">
            <input type="text" id="ctermInput" placeholder="Ask codex anything…" autocomplete="off"
                   onkeydown="if(event.key==='Enter')ctermSend()" />
            <button class="cterm-send-btn" id="ctermSendBtn" onclick="ctermSend()">Send ↵</button>
        </div>
    </div>
</div>
```

---

### Task 6: Add the vanilla JS for drag, resize, localStorage, and terminal lifecycle

**Files:**
- Modify: `misc/dev_hub.html` (add `<script>` block before the closing `</body>` tag, before the existing `<script src="...">` tags)

**Step 1: Insert the complete JS block**

```html
<script>
// ── Codex Terminal ───────────────────────────────────────────────
const CTERM_KEY = 'codex-terminal-window';
const CTERM_MIN_W = 600, CTERM_MIN_H = 400;

let _ctermSessionId = null;
let _ctermEvtSrc = null;
let _ctermDrag = null;   // { startX, startY, winX, winY }
let _ctermResize = null; // { handle, startX, startY, winX, winY, winW, winH }
let _ctermMaximized = false;
let _ctermPreMax = null; // saved { x, y, w, h } before maximize
let _ctermQuietTimer = null;

// ── Layout persistence ──────────────────────────────────────────
function ctermLoadLayout() {
    try { return JSON.parse(localStorage.getItem(CTERM_KEY) || 'null'); } catch { return null; }
}
function ctermSaveLayout(x, y, w, h) {
    localStorage.setItem(CTERM_KEY, JSON.stringify({ x, y, w, h }));
}
function ctermApplyLayout(x, y, w, h) {
    const win = document.getElementById('ctermWindow');
    win.style.left   = x + 'px';
    win.style.top    = y + 'px';
    win.style.width  = w + 'px';
    win.style.height = h + 'px';
}
function ctermDefaultLayout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(760, vw - 80), h = Math.min(540, vh - 80);
    const x = Math.round((vw - w) / 2), y = Math.round((vh - h) / 2);
    return { x, y, w, h };
}

// ── Open / Close ────────────────────────────────────────────────
async function ctermOpen() {
    // If already open with a live session, just bring to front
    if (_ctermSessionId) {
        document.getElementById('ctermOverlay').classList.add('open');
        document.getElementById('ctermWindow').style.display = 'flex';
        return;
    }

    // Apply layout
    const saved = ctermLoadLayout() || ctermDefaultLayout();
    ctermApplyLayout(saved.x, saved.y, saved.w, saved.h);
    document.getElementById('ctermOverlay').classList.add('open');
    document.getElementById('ctermWindow').style.display = 'flex';
    document.getElementById('ctermTerminal').textContent = '';
    document.getElementById('ctermInput').value = '';
    document.getElementById('ctermInput').disabled = true;
    document.getElementById('ctermSendBtn').disabled = true;
    document.getElementById('ctermStatusDot').className = 'cterm-status-dot';

    // Esc key to close
    document.addEventListener('keydown', _ctermEscHandler);

    // Start session
    try {
        const res = await fetch('/api/codex-chat/start', { method: 'POST' });
        const data = await res.json();
        if (data.error) { ctermAppend(`[error: ${data.error}]\n`); return; }
        _ctermSessionId = data.sessionId;
        _ctermEvtSrc = new EventSource(`/api/codex-chat/${_ctermSessionId}/stream`);
        _ctermEvtSrc.onmessage = ctermOnSse;
        _ctermEvtSrc.onerror = () => {
            ctermAppend('\n[SSE connection lost]\n');
            ctermMarkDead();
        };
    } catch (e) {
        ctermAppend(`[network error: ${e.message}]\n`);
        ctermMarkDead();
    }
}

function _ctermEscHandler(e) {
    if (e.key === 'Escape') ctermClose();
}

function ctermClose() {
    document.removeEventListener('keydown', _ctermEscHandler);
    document.getElementById('ctermOverlay').classList.remove('open');
    document.getElementById('ctermWindow').style.display = 'none';
    // Kill session on close
    if (_ctermSessionId) {
        fetch(`/api/codex-chat/${_ctermSessionId}/kill`, { method: 'POST' }).catch(() => {});
        _ctermSessionId = null;
    }
    if (_ctermEvtSrc) { _ctermEvtSrc.close(); _ctermEvtSrc = null; }
}

function ctermOverlayClick(e) {
    // Only close if clicking the backdrop itself, not the window
    if (e.target === document.getElementById('ctermOverlay')) ctermClose();
}

// ── Session events ──────────────────────────────────────────────
function ctermOnSse(e) {
    const raw = e.data;
    if (raw.startsWith('__SESSION_END__:')) {
        ctermMarkDead();
        return;
    }
    try { ctermAppend(atob(raw)); } catch { ctermAppend(raw); }

    // Re-enable input after 300ms of quiet (codex is waiting for next prompt)
    clearTimeout(_ctermQuietTimer);
    _ctermQuietTimer = setTimeout(ctermMarkReady, 300);
}

function ctermAppend(text) {
    const t = document.getElementById('ctermTerminal');
    t.textContent += text;
    t.scrollTop = t.scrollHeight;
}

function ctermMarkReady() {
    document.getElementById('ctermInput').disabled = false;
    document.getElementById('ctermSendBtn').disabled = false;
    setTimeout(() => document.getElementById('ctermInput').focus(), 30);
}

function ctermMarkDead() {
    document.getElementById('ctermStatusDot').className = 'cterm-status-dot dead';
    document.getElementById('ctermInput').disabled = true;
    document.getElementById('ctermSendBtn').disabled = true;
    ctermAppend('\n[session ended]\n');
}

// ── Send message ────────────────────────────────────────────────
async function ctermSend() {
    const input = document.getElementById('ctermInput');
    const msg = input.value.trim();
    if (!msg || !_ctermSessionId) return;
    input.value = '';
    input.disabled = true;
    document.getElementById('ctermSendBtn').disabled = true;
    clearTimeout(_ctermQuietTimer);
    try {
        const res = await fetch(`/api/codex-chat/${_ctermSessionId}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg }),
        });
        const data = await res.json();
        if (data.error) ctermAppend(`[error: ${data.error}]\n`);
        // Response streams via SSE — ctermMarkReady fires after quiet period
    } catch (e) {
        ctermAppend(`[network error: ${e.message}]\n`);
        ctermMarkReady(); // re-enable so user can retry
    }
}

async function ctermKillSession() {
    if (!_ctermSessionId) return;
    await fetch(`/api/codex-chat/${_ctermSessionId}/kill`, { method: 'POST' }).catch(() => {});
}

// ── Maximize / Restore ──────────────────────────────────────────
function ctermToggleMaximize() {
    const win = document.getElementById('ctermWindow');
    if (_ctermMaximized) {
        // Restore
        const { x, y, w, h } = _ctermPreMax;
        ctermApplyLayout(x, y, w, h);
        _ctermMaximized = false;
        _ctermPreMax = null;
    } else {
        // Save current, go fullscreen (minus small margin)
        const r = win.getBoundingClientRect();
        _ctermPreMax = { x: r.left, y: r.top, w: r.width, h: r.height };
        const margin = 20;
        ctermApplyLayout(margin, margin, window.innerWidth - margin*2, window.innerHeight - margin*2);
        _ctermMaximized = true;
    }
}

// ── Drag ────────────────────────────────────────────────────────
function ctermStartDrag(e) {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return; // don't drag from buttons
    e.preventDefault();
    const win = document.getElementById('ctermWindow');
    const r = win.getBoundingClientRect();
    _ctermDrag = { startX: e.clientX, startY: e.clientY, winX: r.left, winY: r.top };
    document.addEventListener('mousemove', ctermDoDrag);
    document.addEventListener('mouseup', ctermStopDrag);
}
function ctermDoDrag(e) {
    if (!_ctermDrag) return;
    const dx = e.clientX - _ctermDrag.startX;
    const dy = e.clientY - _ctermDrag.startY;
    const win = document.getElementById('ctermWindow');
    const margin = 20;
    const maxX = window.innerWidth  - win.offsetWidth  - margin;
    const maxY = window.innerHeight - win.offsetHeight - margin;
    const x = Math.max(margin, Math.min(_ctermDrag.winX + dx, maxX));
    const y = Math.max(margin, Math.min(_ctermDrag.winY + dy, maxY));
    win.style.left = x + 'px';
    win.style.top  = y + 'px';
}
function ctermStopDrag() {
    if (!_ctermDrag) return;
    _ctermDrag = null;
    document.removeEventListener('mousemove', ctermDoDrag);
    document.removeEventListener('mouseup', ctermStopDrag);
    const win = document.getElementById('ctermWindow');
    const r = win.getBoundingClientRect();
    ctermSaveLayout(r.left, r.top, win.offsetWidth, win.offsetHeight);
}

// ── Resize ──────────────────────────────────────────────────────
function ctermStartResize(handle, e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const win = document.getElementById('ctermWindow');
    const r = win.getBoundingClientRect();
    _ctermResize = {
        handle,
        startX: e.clientX, startY: e.clientY,
        winX: r.left, winY: r.top, winW: r.width, winH: r.height,
    };
    document.addEventListener('mousemove', ctermDoResize);
    document.addEventListener('mouseup', ctermStopResize);
}
function ctermDoResize(e) {
    if (!_ctermResize) return;
    const { handle, startX, startY, winX, winY, winW, winH } = _ctermResize;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = winX, y = winY, w = winW, h = winH;
    if (handle.includes('e')) w = Math.max(CTERM_MIN_W, winW + dx);
    if (handle.includes('s')) h = Math.max(CTERM_MIN_H, winH + dy);
    if (handle.includes('w')) { w = Math.max(CTERM_MIN_W, winW - dx); if (w !== winW) x = winX + dx; }
    if (handle.includes('n')) { h = Math.max(CTERM_MIN_H, winH - dy); if (h !== winH) y = winY + dy; }
    // Clamp to viewport
    w = Math.min(w, vw - x - 10);
    h = Math.min(h, vh - y - 10);
    ctermApplyLayout(x, y, w, h);
}
function ctermStopResize() {
    if (!_ctermResize) return;
    _ctermResize = null;
    document.removeEventListener('mousemove', ctermDoResize);
    document.removeEventListener('mouseup', ctermStopResize);
    const win = document.getElementById('ctermWindow');
    const r = win.getBoundingClientRect();
    ctermSaveLayout(r.left, r.top, win.offsetWidth, win.offsetHeight);
}
</script>
```

**Step 2: Verify the page loads without JS errors**

Open `http://localhost:5173/Aralia/misc/dev_hub.html` and check browser console — no errors expected.

**Step 3: Commit**

```bash
git add misc/dev_hub.html
git commit -m "feat: add Codex Terminal card and resizable window to dev hub"
```

---

### Task 7: End-to-end verification

**Step 1: Open the page**

Navigate to `http://localhost:5173/Aralia/misc/dev_hub.html`

**Step 2: Verify card appears**

The 9th card in the grid should read "◈ CODEX TERMINAL" with an "Agent Tool" badge.

**Step 3: Click the card**

Expected:
- Backdrop overlay appears
- Window appears centered (~760×540)
- Status dot is green
- Input field is disabled (codex starting up)
- After a moment, input enables OR codex output appears (if it prints a startup message)

**Step 4: Send a prompt**

Type `What is 2 + 2?` and press Enter.
Expected: input disables, message sent to codex stdin, response streams in via SSE, input re-enables after quiet.

**Step 5: Test drag**

Drag the title bar — window moves, stays in viewport. On release, position is saved to `localStorage['codex-terminal-window']`.

**Step 6: Test resize**

Drag a corner handle — window resizes. Min 600×400 is enforced.

**Step 7: Test maximize**

Click ⛶ — window fills viewport with 20px margin. Click again — restores previous size.

**Step 8: Test close**

Click ✕ or press Esc — window closes, session killed. Click card again — fresh session starts, layout is restored from localStorage.

**Step 9: Verify no Vite server errors**

```bash
# Check Vite logs for any unhandled errors
```

---

### Notes for Implementer

- **`--no-alt-screen` behaviour on Windows:** codex may still emit ANSI escape sequences in some situations. The `<pre>` display will show them as raw characters. This is acceptable for an initial implementation — ANSI stripping can be added later if needed.
- **Input disabled timing:** The 300ms quiet heuristic is a reasonable default. If codex sends output in bursts with gaps, the input may briefly re-enable. Adjust the timer value if needed.
- **Session lifecycle:** Each card click with no active session spawns a new codex process. If codex crashes or exits (e.g. auth expiry), the status dot turns red and input is disabled. User must close and reopen to start a fresh session.
