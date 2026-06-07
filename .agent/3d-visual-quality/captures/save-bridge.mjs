// One-shot bridge: receives a Playwright storageState JSON via POST and writes it
// to storageState.json, so the preview tab's save can be handed to the headless
// capture browser without routing 128KB through the agent's context.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'storageState.json');
const PORT = 9911;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(200); res.end('bridge up'); return; }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    try {
      JSON.parse(body); // validate
      fs.writeFileSync(OUT, body, 'utf8');
      console.log('wrote', OUT, body.length, 'bytes');
      res.writeHead(200); res.end('ok');
      setTimeout(() => { server.close(); process.exit(0); }, 200);
    } catch (e) {
      console.log('bad body', String(e));
      res.writeHead(400); res.end('bad');
    }
  });
});
server.listen(PORT, () => console.log('save-bridge listening on', PORT));
setTimeout(() => { console.log('timeout, no save received'); process.exit(1); }, 120000);
