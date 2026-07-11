import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { readBody, isSafeScriptName, findFreePort, waitForPort } from './utils';

// We need to export/define isSafeScriptName in utils, let's just implement it here for now or import it if I added it.
// I'll add it to utils in a bit.

interface CodexJob {
  proc: ReturnType<typeof spawn> | null;
  subscribers: Array<(chunk: string) => void>;
  done: boolean;
  exitCode: number | null;
  buffer: string[];
}
const codexJobs = new Map<string, CodexJob>();
const SAFE_SCRIPT_NAME_RE = /^[a-zA-Z0-9:_-]+$/;
function isSafeScriptNameLocal(name: string): boolean {
  return SAFE_SCRIPT_NAME_RE.test(name);
}

export const codexRunManager = () => ({
  name: 'codex-run-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];

      const jsonReply = (res: any, data: any, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      };

      if (urlPath === '/api/npm-run' && req.method === 'POST') {
        try {
          const body = JSON.parse(await readBody(req));
          const script = String(body?.script || '');
          if (!isSafeScriptNameLocal(script)) {
            jsonReply(res, { error: 'Invalid script name.' }, 400);
            return;
          }

          const jobId = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
          const cwd = process.cwd();

          const proc = spawn(
            'codex',
            ['exec', '--dangerously-bypass-approvals-and-sandbox', '--color', 'never', `"npm run ${script}"`],
            { cwd, shell: process.platform === 'win32', windowsHide: true }
          );

          const job: CodexJob = { proc, subscribers: [], done: false, exitCode: null, buffer: [] };
          codexJobs.set(jobId, job);

          const emit = (chunk: string) => {
            job.buffer.push(chunk);
            for (const fn of job.subscribers) fn(chunk);
          };

          proc.stdout?.on('data', (data: Buffer) => emit(Buffer.from(data).toString('base64')));
          proc.stderr?.on('data', (data: Buffer) => emit(Buffer.from(data).toString('base64')));

          proc.on('error', (err: Error) => {
            emit(Buffer.from(`[spawn error: ${err.message}]\n`).toString('base64'));
            job.done = true;
            job.exitCode = -1;
            for (const fn of job.subscribers) fn('__EXIT__:-1');
            setTimeout(() => codexJobs.delete(jobId), 30 * 60 * 1000);
          });

          proc.on('close', (code: number | null) => {
            if (job.done) return;
            job.done = true;
            job.exitCode = code;
            for (const fn of job.subscribers) fn(`__EXIT__:${code ?? -1}`);
            setTimeout(() => codexJobs.delete(jobId), 30 * 60 * 1000);
          });

          jsonReply(res, { jobId });
        } catch (e) {
          jsonReply(res, { error: String(e) }, 500);
        }
        return;
      }

      const streamMatch = urlPath.match(/^\/api\/npm-run\/([0-9a-f]+)\/stream$/);
      if (streamMatch && req.method === 'GET') {
        const jobId = streamMatch[1];
        const job = codexJobs.get(jobId);
        if (!job) { jsonReply(res, { error: 'Job not found.' }, 404); return; }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        const send = (chunk: string) => { if (!res.writableEnded) res.write(`data: ${chunk}\n\n`); };

        for (const chunk of job.buffer) send(chunk);

        if (job.done) send(`__EXIT__:${job.exitCode ?? -1}`);

        const subscriber = (chunk: string) => send(chunk);
        job.subscribers.push(subscriber);

        const heartbeat = setInterval(() => {
          if (!res.writableEnded) res.write(': keepalive\n\n');
          else clearInterval(heartbeat);
        }, 25_000);

        req.on('close', () => {
          clearInterval(heartbeat);
          job.subscribers = job.subscribers.filter((fn: any) => fn !== subscriber);
        });
        return;
      }

      const killMatch = urlPath.match(/^\/api\/npm-run\/([0-9a-f]+)\/kill$/);
      if (killMatch && req.method === 'POST') {
        const jobId = killMatch[1];
        const job = codexJobs.get(jobId);
        if (!job) { jsonReply(res, { error: 'Job not found.' }, 404); return; }
        if (job.proc) try { job.proc.kill('SIGTERM'); } catch { /* already exited */ }
        jsonReply(res, { ok: true });
        return;
      }

      const continueMatch = urlPath.match(/^\/api\/npm-run\/([0-9a-f]+)\/continue$/);
      if (continueMatch && req.method === 'POST') {
        try {
          const jobId = continueMatch[1];
          const job = codexJobs.get(jobId);
          if (!job) { jsonReply(res, { error: 'Job not found.' }, 404); return; }

          const body = JSON.parse(await readBody(req));
          const message = String(body?.message || '').trim();
          if (!message) { jsonReply(res, { error: 'Empty message.' }, 400); return; }

          const emit = (chunk: string) => {
            job.buffer.push(chunk);
            for (const fn of job.subscribers) fn(chunk);
          };

          job.done = false;
          job.exitCode = null;

          const newProc = spawn(
            'codex',
            ['exec', '--dangerously-bypass-approvals-and-sandbox', '--color', 'never', 'resume', '--last', '-'],
            { cwd: process.cwd(), shell: process.platform === 'win32', windowsHide: true }
          );
          job.proc = newProc;

          newProc.stdin?.write(message);
          newProc.stdin?.end();

          newProc.stdout?.on('data', (data: Buffer) => emit(Buffer.from(data).toString('base64')));
          newProc.stderr?.on('data', (data: Buffer) => emit(Buffer.from(data).toString('base64')));
          newProc.on('error', (err: Error) => {
            emit(Buffer.from(`[spawn error: ${err.message}]\n`).toString('base64'));
            job.done = true;
            job.exitCode = -1;
            for (const fn of job.subscribers) fn('__EXIT__:-1');
          });
          newProc.on('close', (code: number | null) => {
            if (job.done) return;
            job.done = true;
            job.exitCode = code;
            for (const fn of job.subscribers) fn(`__EXIT__:${code ?? -1}`);
          });

          jsonReply(res, { ok: true });
        } catch (e) {
          jsonReply(res, { error: String(e) }, 500);
        }
        return;
      }

      next();
    });
  },
});

interface CodexChatSession {
  proc: ReturnType<typeof spawn> | null;
  ws: WebSocket | null;
  threadId: string | null;
  nextId: number;
  subscribers: Array<(event: string) => void>;
  buffer: string[];
  alive: boolean;
}
const codexChatSessions = new Map<string, CodexChatSession>();

export const codexChatManager = () => ({
  name: 'codex-chat-manager',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];
      const jsonReply = (r: any, data: any, status = 200) => {
        r.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        r.end(JSON.stringify(data));
      };

      if (urlPath === '/api/codex-chat/start' && req.method === 'POST') {
        try {
          const sessionId = randomUUID().replace(/-/g, '');
          const cwd = process.cwd();
          const port = await findFreePort();

          const proc = spawn(
            'codex',
            [
              'app-server',
              '--listen', `ws://127.0.0.1:${port}`,
              '-c', 'approval_policy="never"',
              '-c', 'search=true',
            ],
            { cwd, shell: process.platform === 'win32', windowsHide: true }
          );

          const session: CodexChatSession = {
            proc, ws: null, threadId: null, nextId: 1,
            subscribers: [], buffer: [], alive: true,
          };
          codexChatSessions.set(sessionId, session);

          const sid = sessionId.slice(0, 8);
          const emit = (type: string, payload?: Record<string, unknown>) => {
            const event = JSON.stringify({ type, ...payload });
            session.buffer.push(event);
            for (const fn of session.subscribers) fn(event);
          };

          const killSession = (code?: number) => {
            if (!session.alive) return;
            session.alive = false;
            if (session.ws) try { session.ws.close(); } catch { /* ignore */ }
            session.ws = null;
            for (const fn of session.subscribers) fn('__SESSION_END__:' + (code ?? -1));
            setTimeout(() => codexChatSessions.delete(sessionId), 30 * 60 * 1000);
          };

          proc.stdout?.on('data', (d: Buffer) => {
            const msg = d.toString().trimEnd();
            if (msg) server.config.logger.info(`[codex:${sid}] ${msg}`);
          });
          proc.stderr?.on('data', (d: Buffer) => {
            const msg = d.toString().trimEnd();
            if (msg) server.config.logger.warn(`[codex:${sid}] ${msg}`);
          });

          proc.on('error', (err: Error) => {
            server.config.logger.error(`[codex:${sid}] spawn error: ${err.message}`);
            emit('error', { text: 'spawn error: ' + err.message });
            killSession(-1);
          });

          proc.on('close', (code: number | null) => {
            server.config.logger.warn(`[codex:${sid}] process exited with code ${code}`);
            killSession(code ?? -1);
          });

          (async () => {
            try {
              await waitForPort(port);

              const ws = new WebSocket(`ws://127.0.0.1:${port}`);
              session.ws = ws;

              ws.on('error', (err: Error) => {
                emit('error', { text: 'ws error: ' + err.message });
                killSession(-1);
              });
              ws.on('close', () => killSession(-1));

              ws.on('open', () => {
                ws.send(JSON.stringify({
                  method: 'initialize', id: session.nextId++,
                  params: {
                    clientInfo: { name: 'aralia-dev-hub', title: 'Aralia Dev Hub', version: '1.0.0' },
                    capabilities: { experimentalApi: false },
                  },
                }));
              });

              ws.on('message', (raw: Buffer) => {
                let msg: any;
                try { msg = JSON.parse(raw.toString()); } catch { return; }

                const method: string | undefined = msg.method;
                const params: any = msg.params;

                if (!method && msg.result !== undefined && session.threadId === null) {
                  ws.send(JSON.stringify({
                    method: 'thread/start', id: session.nextId++,
                    params: {
                      cwd,
                      approvalPolicy: 'never',
                      experimentalRawEvents: false,
                      persistExtendedHistory: false,
                    },
                  }));
                  return;
                }

                if (method === 'thread/started') {
                  session.threadId = params?.thread?.id ?? null;
                  emit('sessionReady');
                  return;
                }

                if (method === 'item/agentMessage/delta') {
                  emit('text', { text: params?.delta ?? '' });
                  return;
                }

                if (method === 'turn/completed') {
                  emit('turnComplete');
                  return;
                }

                if (method === 'error') {
                  emit('error', { text: params?.message ?? 'Unknown error' });
                }
              });

            } catch (err: any) {
              emit('error', { text: 'startup error: ' + err.message });
              killSession(-1);
            }
          })();

          jsonReply(res, { sessionId });
        } catch (e) {
          jsonReply(res, { error: String(e) }, 500);
        }
        return;
      }

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

        const send = (event: string) => { if (!res.writableEnded) res.write('data: ' + event + '\n\n'); };
        for (const chunk of session.buffer) send(chunk);
        if (!session.alive) send('__SESSION_END__:-1');

        const subscriber = (event: string) => send(event);
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

      const sendMatch = urlPath.match(/^\/api\/codex-chat\/([0-9a-f]+)\/send$/);
      if (sendMatch && req.method === 'POST') {
        try {
          const sessionId = sendMatch[1];
          const session = codexChatSessions.get(sessionId);
          if (!session || !session.alive || !session.ws || !session.threadId) {
            jsonReply(res, { error: 'Session not ready.' }, 404); return;
          }
          const body = JSON.parse(await readBody(req));
          const message = String(body?.message || '').slice(0, 2000);
          if (!message.trim()) { jsonReply(res, { error: 'Empty message.' }, 400); return; }

          session.ws.send(JSON.stringify({
            method: 'turn/start', id: session.nextId++,
            params: {
              threadId: session.threadId,
              input: [{ type: 'text', text: message, text_elements: [] }],
              approvalPolicy: 'never',
            },
          }));
          jsonReply(res, { ok: true });
        } catch (e) {
          jsonReply(res, { error: String(e) }, 500);
        }
        return;
      }

      const killMatch = urlPath.match(/^\/api\/codex-chat\/([0-9a-f]+)\/kill$/);
      if (killMatch && req.method === 'POST') {
        const sessionId = killMatch[1];
        const session = codexChatSessions.get(sessionId);
        if (!session) { jsonReply(res, { error: 'Session not found.' }, 404); return; }
        if (session.ws) try { session.ws.close(); } catch { /* ignore */ }
        if (session.proc) try { session.proc.kill('SIGTERM'); } catch { /* already exited */ }
        jsonReply(res, { ok: true });
        return;
      }

      next();
    });
  },
});
