// matrix-server.mjs
// Launch wrapper: `npm run matrix` (from the Aralia repo) boots the Agent
// Matrix cockpit, whose implementation lives in the SEPARATE repo
// F:\Repos\Aralia-operator-dashboard (per AGENTS.md the control plane does not
// belong in Aralia itself — this wrapper only delegates to it).
// It runs that repo's `npm start` (checkOperatorPort + vite on 127.0.0.1:3040)
// with stdio inherited so the operator sees vite output directly.
//
// Usage:  npm run matrix              -> cockpit at http://localhost:3040/agent_matrix.html
//         npm run matrix -- --port N  -> extra args are forwarded to vite

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MATRIX_REPO = path.resolve(__dirname, '..', '..', 'Aralia-operator-dashboard');

if (!fs.existsSync(path.join(MATRIX_REPO, 'package.json'))) {
  console.error('[matrix] operator dashboard not found at ' + MATRIX_REPO);
  console.error('[matrix] the Agent Matrix control plane lives in that separate repo.');
  process.exit(1);
}

// Windows note: npm is npm.cmd here, so shell:true is required to spawn it.
const extraArgs = process.argv.slice(2); // e.g. -- --port 3050
const child = spawn('npm', ['start', ...extraArgs], {
  cwd: MATRIX_REPO,
  shell: true,
  stdio: 'inherit',
  env: { ...process.env },
});

console.log('[matrix] launching Agent Matrix cockpit from ' + MATRIX_REPO);
console.log('[matrix] once vite is up: http://localhost:3040/agent_matrix.html');

child.on('exit', (code) => process.exit(code ?? 0));
