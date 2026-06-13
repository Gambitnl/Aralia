/**
 * Agent Session Manager — multi-session PTY rig for the agent fleet dashboard.
 *
 * Unlike ptyTerminalManager (one sticky shell shared by all clients), this
 * manages MANY named PTY sessions — one per dispatched agent task — so the
 * dashboard (misc/agent_matrix.html) can render each live agent session in
 * its own xterm tile.
 *
 * REST (vite middleware):
 *   GET    /api/agent-sessions            → { wsPort, sessions: [{id, title, agent, cmd, startedAt, status, exitCode}] }
 *   POST   /api/agent-sessions/spawn      → body {title, agent, cmd, cwd?, cols?, rows?} → {id}
 *   POST   /api/agent-sessions/:id/kill   → SIGKILL the PTY (session kept for review)
 *   DELETE /api/agent-sessions/:id        → kill if alive + remove from the list
 *
 * WS: connect to ws://<host>:<wsPort>/?sid=<id>. Replays the scrollback
 * buffer on connect, then streams live output. Client messages:
 *   {type:'input', data}  — keystrokes into the PTY
 *   {type:'resize', cols, rows}
 *
 * Dispatch integration: orchestrating agents launch fleet work through
 * POST /spawn instead of a raw shell, e.g.
 *   curl -s -X POST localhost:5174/api/agent-sessions/spawn \
 *     -H 'Content-Type: application/json' \
 *     -d '{"title":"worldforge task 4","agent":"codex","cmd":"codex exec - < spec.md"}'
 * which makes every dispatch observable (and interruptible) from the dashboard.
 *
 * Exited sessions are retained (with scrollback) until DELETEd or until
 * MAX_DONE_RETAINED is exceeded (oldest finished sessions are pruned first).
 */
import { WebSocket, WebSocketServer } from 'ws';
import * as pty from 'node-pty';
import * as fs from 'fs';
import * as path from 'path';

const BUFFER_CHARS = 400_000;
const MAX_SESSIONS = 24;
const MAX_DONE_RETAINED = 16;
const ACTIVITY_FILE = path.join(process.cwd(), '.agent', 'orchestration', 'activity.jsonl');
const ACTIVITY_MAX_RETURN = 200;

const logActivity = (event: Record<string, unknown>) => {
  try {
    fs.appendFileSync(ACTIVITY_FILE, JSON.stringify({ at: Date.now(), ...event }) + '\n');
  } catch { /* feed is best-effort — never fail a dispatch over it */ }
};

const readActivity = (n: number) => {
  try {
    const lines = fs.readFileSync(ACTIVITY_FILE, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch {
    return [];
  }
};

interface AgentSession {
  id: string;
  title: string;
  agent: string;
  cmd: string;
  cwd: string;
  startedAt: number;
  status: 'running' | 'exited' | 'killed';
  exitCode: number | null;
  proc: ReturnType<typeof pty.spawn> | null;
  buffer: string;
  clients: Set<WebSocket>;
}

export const agentSessionManager = () => ({
  name: 'agent-session-manager',
  configureServer(server: any) {
    const sessions = new Map<string, AgentSession>();
    let wsPort: number | null = null;

    const wss = new WebSocketServer({ port: 0 });
    wss.on('error', (err: Error) => {
      server.config.logger.error(`[agent-sessions] WS server error: ${err.message}`);
    });
    wss.on('listening', () => {
      wsPort = (wss.address() as { port: number }).port;
      server.config.logger.info(`[agent-sessions] WS server ready on port ${wsPort}`);
    });

    const publicMeta = (s: AgentSession) => ({
      id: s.id,
      title: s.title,
      agent: s.agent,
      cmd: s.cmd,
      cwd: s.cwd,
      startedAt: s.startedAt,
      status: s.status,
      exitCode: s.exitCode,
    });

    const pruneFinished = () => {
      const done = [...sessions.values()]
        .filter(s => s.status !== 'running')
        .sort((a, b) => a.startedAt - b.startedAt);
      while (done.length > MAX_DONE_RETAINED) {
        const victim = done.shift()!;
        for (const c of victim.clients) { try { c.close(); } catch { /* already gone */ } }
        sessions.delete(victim.id);
      }
    };

    const spawnSession = (opts: { title?: string; agent?: string; cmd: string; cwd?: string; cols?: number; rows?: number }) => {
      const id = `as-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
      const cwd = opts.cwd || process.cwd();
      const cols = Math.max(20, Math.min(400, opts.cols || 120));
      const rows = Math.max(5, Math.min(200, opts.rows || 30));
      const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
      const shellArgs = process.platform === 'win32' ? ['/c', opts.cmd] : ['-c', opts.cmd];

      const session: AgentSession = {
        id,
        title: opts.title || opts.cmd.slice(0, 60),
        agent: opts.agent || 'unknown',
        cmd: opts.cmd,
        cwd,
        startedAt: Date.now(),
        status: 'running',
        exitCode: null,
        proc: null,
        buffer: '',
        clients: new Set(),
      };

      session.proc = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: process.env as Record<string, string>,
      });

      session.proc.onData((data: string) => {
        session.buffer += data;
        if (session.buffer.length > BUFFER_CHARS) {
          session.buffer = session.buffer.slice(-BUFFER_CHARS);
        }
        for (const client of session.clients) {
          try {
            if (client.readyState === WebSocket.OPEN) client.send(data);
          } catch { /* client torn down mid-send */ }
        }
      });

      session.proc.onExit(({ exitCode }: { exitCode: number }) => {
        if (session.status === 'running') session.status = 'exited';
        session.exitCode = exitCode;
        session.proc = null;
        const note = `\r\n\x1b[2m[agent-session ${session.status}, exit ${exitCode}]\x1b[0m\r\n`;
        session.buffer += note;
        for (const client of session.clients) {
          try {
            if (client.readyState === WebSocket.OPEN) client.send(note);
          } catch { /* ignore */ }
        }
        logActivity({
          kind: 'exit', id: session.id, agent: session.agent, title: session.title,
          status: session.status, exitCode, runtimeMs: Date.now() - session.startedAt,
        });
        pruneFinished();
      });

      sessions.set(id, session);
      server.config.logger.info(`[agent-sessions] spawned ${id} (${session.agent}): ${session.title}`);
      logActivity({ kind: 'spawn', id, agent: session.agent, title: session.title });
      return session;
    };

    // External registration: sibling plugins that spawn their OWN hidden PTYs
    // (e.g. agentUsageProbe) surface them here so Live Dispatches shows every
    // terminal the dev server runs. globalThis avoids module-identity issues
    // between the statically-imported and lazily-imported plugin graphs.
    (globalThis as { __agentSessionExternal?: unknown }).__agentSessionExternal = {
      register(opts: { id: string; title: string; agent: string; cmd: string }) {
        const session: AgentSession = {
          id: opts.id, title: opts.title, agent: opts.agent, cmd: opts.cmd,
          cwd: process.cwd(), startedAt: Date.now(), status: 'running',
          exitCode: null, proc: null, buffer: '', clients: new Set(),
        };
        sessions.set(opts.id, session);
        logActivity({ kind: 'spawn', id: opts.id, agent: opts.agent, title: opts.title, external: true });
      },
      data(id: string, chunk: string) {
        const s = sessions.get(id);
        if (!s) return;
        s.buffer += chunk;
        if (s.buffer.length > BUFFER_CHARS) s.buffer = s.buffer.slice(-BUFFER_CHARS);
        for (const c of s.clients) { try { if (c.readyState === WebSocket.OPEN) c.send(chunk); } catch { /* gone */ } }
      },
      finish(id: string, ok: boolean, note?: string) {
        const s = sessions.get(id);
        if (!s || s.status !== 'running') return;
        s.status = 'exited';
        s.exitCode = ok ? 0 : 1;
        const msg = `\r\n\x1b[2m[probe ${ok ? 'ok' : 'FAILED'}${note ? ': ' + note.slice(0, 120) : ''}]\x1b[0m\r\n`;
        s.buffer += msg;
        for (const c of s.clients) { try { if (c.readyState === WebSocket.OPEN) c.send(msg); } catch { /* gone */ } }
        logActivity({ kind: 'exit', id, agent: s.agent, title: s.title, status: 'exited', exitCode: s.exitCode, runtimeMs: Date.now() - s.startedAt, external: true });
        pruneFinished();
      },
    };

    wss.on('connection', (ws: WebSocket, req: any) => {
      const sid = new URL(req.url || '/', 'http://x').searchParams.get('sid') || '';
      const session = sessions.get(sid);
      if (!session) {
        try { ws.send('\x1b[31m[agent-sessions] unknown session id\x1b[0m\r\n'); ws.close(); } catch { /* ignore */ }
        return;
      }
      session.clients.add(ws);
      if (session.buffer.length > 0) ws.send(session.buffer);

      ws.on('message', (msg: Buffer) => {
        if (!session.proc) return;
        try {
          const d = JSON.parse(msg.toString());
          if (d.type === 'input') session.proc.write(d.data);
          if (d.type === 'resize') session.proc.resize(Math.max(2, d.cols), Math.max(2, d.rows));
        } catch {
          try { session.proc.write(msg.toString()); } catch { /* pty already dead */ }
        }
      });
      ws.on('error', () => session.clients.delete(ws));
      ws.on('close', () => session.clients.delete(ws));
    });

    const readBody = (req: any): Promise<string> =>
      new Promise((resolve) => {
        let body = '';
        req.on('data', (c: Buffer) => { body += c.toString(); });
        req.on('end', () => resolve(body));
      });

    const json = (res: any, code: number, obj: unknown) => {
      res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(obj));
    };

    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      if (urlPath === '/api/agent-activity' && req.method === 'GET') {
        const n = Math.min(ACTIVITY_MAX_RETURN, Math.max(1,
          parseInt(new URL(req.url, 'http://x').searchParams.get('n') || '60', 10) || 60));
        return json(res, 200, { events: readActivity(n) });
      }
      if (!urlPath.startsWith('/api/agent-sessions')) return next();

      if (req.method === 'GET' && urlPath === '/api/agent-sessions') {
        return json(res, 200, { wsPort, sessions: [...sessions.values()].map(publicMeta) });
      }

      if (req.method === 'POST' && urlPath === '/api/agent-sessions/spawn') {
        let opts: any;
        try { opts = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'invalid JSON body' }); }
        if (!opts || typeof opts.cmd !== 'string' || !opts.cmd.trim()) {
          return json(res, 400, { error: 'cmd (string) is required' });
        }
        const running = [...sessions.values()].filter(s => s.status === 'running').length;
        if (running >= MAX_SESSIONS) return json(res, 429, { error: `session cap reached (${MAX_SESSIONS})` });
        try {
          const s = spawnSession(opts);
          return json(res, 200, { id: s.id, wsPort });
        } catch (err: any) {
          return json(res, 500, { error: `spawn failed: ${err.message}` });
        }
      }

      const killMatch = urlPath.match(/^\/api\/agent-sessions\/([\w-]+)\/kill$/);
      if (req.method === 'POST' && killMatch) {
        const s = sessions.get(killMatch[1]);
        if (!s) return json(res, 404, { error: 'no such session' });
        if (s.proc) { s.status = 'killed'; try { s.proc.kill(); } catch { /* already dead */ } }
        return json(res, 200, { ok: true });
      }

      const delMatch = urlPath.match(/^\/api\/agent-sessions\/([\w-]+)$/);
      if (req.method === 'DELETE' && delMatch) {
        const s = sessions.get(delMatch[1]);
        if (!s) return json(res, 404, { error: 'no such session' });
        if (s.proc) { s.status = 'killed'; try { s.proc.kill(); } catch { /* already dead */ } }
        for (const c of s.clients) { try { c.close(); } catch { /* ignore */ } }
        sessions.delete(s.id);
        return json(res, 200, { ok: true });
      }

      return json(res, 404, { error: 'unknown agent-sessions route' });
    });
  },
});
