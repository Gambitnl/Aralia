/**
 * Reproduction: abrupt client disconnect (TCP RST) on the pty terminal
 * WebSocket. If the server's ws connection has no 'error' listener, the
 * resulting ECONNRESET is an unhandled 'error' event -> dev server dies.
 *
 * Usage: node repro-ws-reset.mjs [httpPort]
 */
import { WebSocket } from 'ws';

const httpPort = process.argv[2] || '5199';

async function getPtyPort(route) {
  const r = await fetch(`http://localhost:${httpPort}${route}`);
  const { port } = await r.json();
  return port;
}

const ptyPort = await getPtyPort('/api/pty/port');
console.log(`[repro] pty wss port = ${ptyPort}`);

const ws = new WebSocket(`ws://localhost:${ptyPort}`);
ws.on('open', () => {
  console.log('[repro] connected; sending input then RST-ing the socket');
  ws.send(JSON.stringify({ type: 'input', data: 'echo hello\r' }));
  setTimeout(() => {
    // abrupt reset, not a clean close — like a sleeping laptop / killed tab
    ws._socket.resetAndDestroy();
    console.log('[repro] socket reset sent');
    setTimeout(async () => {
      try {
        const r = await fetch(`http://localhost:${httpPort}/api/pty/port`);
        console.log(`[repro] server still alive after RST (status ${r.status})`);
      } catch (e) {
        console.log(`[repro] SERVER DEAD after RST: ${e.cause?.code || e.message}`);
      }
      process.exit(0);
    }, 3000);
  }, 1500);
});
ws.on('error', (e) => console.log('[repro] client ws error (expected):', e.message));
