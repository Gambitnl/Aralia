import { WebSocket, WebSocketServer } from 'ws';
import * as pty from 'node-pty';

type ViteLogger = { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };

let _ptyWss: WebSocketServer | null = null;
let _ptyLogger: ViteLogger = console;
let _ptyWssPort: number | null = null;
let _stickyPtyProc: ReturnType<typeof pty.spawn> | null = null;
let _ptyClients: Set<WebSocket> = new Set();
let _ptyOutputBuffer = '';
const PTY_BUFFER_CHARS = 200_000;

export const ptyTerminalManager = () => ({
  name: 'pty-terminal-manager',
  configureServer(server: any) {
    // Refreshed every (re)start so buffered log lines reach the LIVE server's
    // logger even though the WebSocketServer/handlers below are created once.
    _ptyLogger = server.config.logger;

    const spawnStickyPty = () => {
      const cmd = process.platform === 'win32' ? 'cmd.exe' : 'bash';
      const sid = Math.random().toString(16).slice(2, 10);
      try {
        _stickyPtyProc = pty.spawn(cmd, [], {
          name: 'xterm-256color',
          cols: 220,
          rows: 50,
          cwd: process.cwd(),
          env: process.env as Record<string, string>,
        });
        _ptyLogger.info(`[pty:${sid}] spawned sticky "${cmd}"`);
      } catch (err: any) {
        _ptyLogger.error(`[pty:${sid}] spawn failed: ${err.message}`);
        return;
      }

      _stickyPtyProc.onData((data: string) => {
        _ptyOutputBuffer += data;
        if (_ptyOutputBuffer.length > PTY_BUFFER_CHARS) {
          _ptyOutputBuffer = _ptyOutputBuffer.slice(-PTY_BUFFER_CHARS);
        }
        for (const client of _ptyClients) {
          try {
            if (client.readyState === WebSocket.OPEN) client.send(data);
          } catch { /* client torn down mid-send */ }
        }
      });

      _stickyPtyProc.onExit(({ exitCode }: { exitCode: number }) => {
        _ptyLogger.info(`[pty:${sid}] exited with code ${exitCode}`);
        _stickyPtyProc = null;
        _ptyOutputBuffer = '';
        for (const client of _ptyClients) {
          if (client.readyState === WebSocket.OPEN) client.close();
        }
        _ptyClients.clear();
      });
    };

    // Create the WebSocket server ONCE and reuse it across Vite dev-server
    // restarts. Vite re-runs configureServer on every restart; creating a fresh
    // WebSocketServer each time leaked an orphaned WSS (holding an OS handle)
    // per restart. The sticky PTY is already a module-level singleton, so the
    // live terminal survives restarts untouched.
    if (!_ptyWss) {
      const wss = new WebSocketServer({ port: 0 });
      _ptyWss = wss;

      wss.on('error', (err: Error) => {
        _ptyLogger.error(`[pty] WebSocket server error: ${err.message}`);
      });

      wss.on('listening', () => {
        const addr = wss.address() as { port: number };
        _ptyWssPort = addr.port;
        _ptyLogger.info(`[pty] WebSocket server ready on port ${_ptyWssPort}`);
      });

      wss.on('connection', (ws: WebSocket, _req: any) => {
        if (!_stickyPtyProc) spawnStickyPty();

        _ptyClients.add(ws);

        if (_ptyOutputBuffer.length > 0) {
          ws.send(_ptyOutputBuffer);
        }

        ws.on('message', (msg: Buffer) => {
          if (!_stickyPtyProc) return;
          try {
            const d = JSON.parse(msg.toString());
            if (d.type === 'input')  _stickyPtyProc.write(d.data);
            if (d.type === 'resize') _stickyPtyProc.resize(Math.max(2, d.cols), Math.max(2, d.rows));
          } catch {
            try { _stickyPtyProc.write(msg.toString()); } catch { /* pty already dead */ }
          }
        });

        ws.on('error', (err: Error) => {
          _ptyLogger.warn(`[pty] client socket error: ${err.message}`);
          _ptyClients.delete(ws);
        });

        ws.on('close', () => {
          _ptyClients.delete(ws);
        });
      });
    }

    server.middlewares.use((req: any, res: any, next: any) => {
      if ((req.url || '').split('?')[0] === '/api/pty/port') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ port: _ptyWssPort }));
        return;
      }
      next();
    });
  },
});

let _shellPtyWss: WebSocketServer | null = null;
let _shellPtyLogger: ViteLogger = console;
let _shellPtyWssPort: number | null = null;
let _stickyShellPtyProc: ReturnType<typeof pty.spawn> | null = null;
let _shellPtyClients: Set<WebSocket> = new Set();
let _shellPtyOutputBuffer = '';

export const shellTerminalManager = () => ({
  name: 'shell-terminal-manager',
  configureServer(server: any) {
    _shellPtyLogger = server.config.logger;

    const spawnStickyShell = () => {
      const cmd = process.platform === 'win32' ? 'cmd.exe' : 'bash';
      const sid = Math.random().toString(16).slice(2, 10);
      try {
        _stickyShellPtyProc = pty.spawn(cmd, [], {
          name: 'xterm-256color',
          cols: 220,
          rows: 50,
          cwd: process.cwd(),
          env: process.env as Record<string, string>,
        });
        _shellPtyLogger.info(`[shell-pty:${sid}] spawned sticky "${cmd}"`);
      } catch (err: any) {
        _shellPtyLogger.error(`[shell-pty:${sid}] spawn failed: ${err.message}`);
        return;
      }

      _stickyShellPtyProc.onData((data: string) => {
        _shellPtyOutputBuffer += data;
        if (_shellPtyOutputBuffer.length > PTY_BUFFER_CHARS) {
          _shellPtyOutputBuffer = _shellPtyOutputBuffer.slice(-PTY_BUFFER_CHARS);
        }
        for (const client of _shellPtyClients) {
          try {
            if (client.readyState === WebSocket.OPEN) client.send(data);
          } catch { /* client torn down mid-send */ }
        }
      });

      _stickyShellPtyProc.onExit(({ exitCode }: { exitCode: number }) => {
        _shellPtyLogger.info(`[shell-pty:${sid}] exited with code ${exitCode}`);
        _stickyShellPtyProc = null;
        _shellPtyOutputBuffer = '';
        for (const client of _shellPtyClients) {
          if (client.readyState === WebSocket.OPEN) client.close();
        }
        _shellPtyClients.clear();
      });
    };

    if (!_shellPtyWss) {
      const wss = new WebSocketServer({ port: 0 });
      _shellPtyWss = wss;

      wss.on('error', (err: Error) => {
        _shellPtyLogger.error(`[shell-pty] WebSocket server error: ${err.message}`);
      });

      wss.on('listening', () => {
        const addr = wss.address() as { port: number };
        _shellPtyWssPort = addr.port;
        _shellPtyLogger.info(`[shell-pty] WebSocket server ready on port ${_shellPtyWssPort}`);
      });

      wss.on('connection', (ws: WebSocket, _req: any) => {
        if (!_stickyShellPtyProc) spawnStickyShell();

        _shellPtyClients.add(ws);

        if (_shellPtyOutputBuffer.length > 0) {
          ws.send(_shellPtyOutputBuffer);
        }

        ws.on('message', (msg: Buffer) => {
          if (!_stickyShellPtyProc) return;
          try {
            const d = JSON.parse(msg.toString());
            if (d.type === 'input')  _stickyShellPtyProc.write(d.data);
            if (d.type === 'resize') _stickyShellPtyProc.resize(Math.max(2, d.cols), Math.max(2, d.rows));
          } catch {
            try { _stickyShellPtyProc.write(msg.toString()); } catch { /* pty already dead */ }
          }
        });

        ws.on('error', (err: Error) => {
          _shellPtyLogger.warn(`[shell-pty] client socket error: ${err.message}`);
          _shellPtyClients.delete(ws);
        });

        ws.on('close', () => {
          _shellPtyClients.delete(ws);
        });
      });
    }

    server.middlewares.use((req: any, res: any, next: any) => {
      if ((req.url || '').split('?')[0] === '/api/shell-terminal/port') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ port: _shellPtyWssPort }));
        return;
      }
      next();
    });
  },
});
