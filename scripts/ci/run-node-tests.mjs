/** Run the complete tooling inventory with bounded concurrency and a private report. */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { nodeTestFiles } from './node-test-inventory.mjs';

const files = nodeTestFiles();
if (!files.length) throw new Error('Node test inventory is empty.');
// Local recovery configuration supplies the scanner; GitHub supplies these two
// variables explicitly. Never copy the workstation's backup credentials to CI.
const env = { ...process.env };
if (!env.TEST_GITLEAKS_PATH && process.platform === 'win32') {
  const local = 'G:/Users/Gambit/.codex/tools/nightly-save/config.json';
  if (fs.existsSync(local)) {
    const config = JSON.parse(fs.readFileSync(local, 'utf8').replace(/^\uFEFF/, ''));
    env.TEST_GITLEAKS_PATH = config.gitleaksPath;
    env.TEST_GITLEAKS_CONFIG = config.gitleaksConfig;
  }
}
if (!env.TEST_GITLEAKS_PATH || !env.TEST_GITLEAKS_CONFIG) throw new Error('Recovery tests require TEST_GITLEAKS_PATH and TEST_GITLEAKS_CONFIG.');
console.log(`Node test lane: ${files.length} files, four workers.`);
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=4', '--test-timeout=120000', ...files], { stdio: 'inherit', env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
