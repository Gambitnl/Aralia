/**
 * @file run-chrome-mcp.js
 * Wrapper to run the Chrome DevTools MCP server.
 * 
 * 🛠️ SETUP INSTRUCTIONS:
 * 1. This server requires a running Chrome instance with remote debugging enabled on port 9222.
 * 2. To start the correct instance, run: `npm run mcp:chrome`
 * 3. The debug instance uses a dedicated profile in `.chrome-gemini-profile/` to avoid 
 *    conflicts with your personal Chrome sessions.
 * 
 * 🔍 TROUBLESHOOTING:
 * - If connection fails, ensure port 9222 is listening: `netstat -ano | findstr 9222`
 * - Use `scripts/launch-debug-chrome.js` for manual robust launching.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is one level up from scripts/
const projectRoot = resolve(__dirname, '..');
const serverPath = join(projectRoot, '.agent_tools', 'chrome-devtools-mcp', 'build', 'src', 'index.js');

// Pass through all args (like --browserUrl)
const args = [serverPath, ...process.argv.slice(2)];

const child = spawn('node', args, {
  stdio: 'inherit',
  cwd: projectRoot 
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
