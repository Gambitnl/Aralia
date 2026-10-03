/** Run the real Windows launcher against disposable helpers to prove failure isolation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

test('launcher retries a failed review and still completes both recovery steps', { skip: process.platform !== 'win32' }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-launcher-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scripts = path.join(root, 'scripts/git'), state = path.join(root, '.agent/scratch/nightly-save');
  fs.mkdirSync(scripts, { recursive: true }); fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(scripts, 'nightly-snapshot.mjs'), `import fs from 'node:fs'; const c=JSON.parse(fs.readFileSync(process.argv[3])); fs.appendFileSync(c.stateDir+'/attempts.txt','review\\n'); process.exit(1);`);
  fs.writeFileSync(path.join(scripts, 'private-backup.ps1'), `param([string]$ConfigPath,[switch]$LocalOnly)\n$c=Get-Content $ConfigPath -Raw | ConvertFrom-Json\n[IO.File]::AppendAllText((Join-Path $c.stateDir 'attempts.txt'), "encrypted\n")\nexit 0\n`);
  fs.writeFileSync(path.join(scripts, 'private-backup.mjs'), `import fs from 'node:fs'; const c=JSON.parse(fs.readFileSync(process.argv[2])); fs.appendFileSync(c.stateDir+'/attempts.txt','cloud\\n');`);
  const configPath = path.join(root, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ repoPath: root, stateDir: state, nodePath: process.execPath, backupEnabled: true, privateGitEnabled: true }));
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/git/nightly-launcher.ps1'), '-ConfigPath', configPath, '-MutexName', 'Local\\AraliaLauncherTest-' + crypto.randomUUID(), '-RetryDelaySeconds', '0'], { encoding: 'utf8', timeout: 60000, windowsHide: true });
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const receipt = JSON.parse(fs.readFileSync(path.join(state, 'nightly-run.json'), 'utf8').replace(/^\uFEFF/, ''));
  assert.deepEqual(receipt.failedSteps, ['public-review']);
  assert.equal(fs.readFileSync(path.join(state, 'attempts.txt'), 'utf8').replace(/\r/g, ''), 'review\nreview\nreview\nencrypted\ncloud\n');
});
