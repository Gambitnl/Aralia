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
