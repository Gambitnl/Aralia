/**
 * Review unlocked Aralia work without changing staging or publishing automatically.
 * The Windows task calls this file through a small external PowerShell wrapper.
 * Large changes require approval of an exact tree; secrets never get an override.
 * Private recovery runs separately. Only an explicit reviewed-commit command publishes.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { storageStatus } from './backup-policy.mjs';

export function command(exe, args, options = {}) {
  const result = spawnSync(exe, args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
    timeout: 180000, windowsHide: true, ...options });
  if (result.error || result.status !== 0) {
    throw new Error(`${path.basename(exe)} failed (${result.status ?? result.error?.code}): ${(result.stderr || result.stdout || '').slice(-2000)}`);
  }
  return result.stdout || '';
}

export function assessChanges(numstat, sizes, limits = {}) {
  const policy = { deletedFiles: 100, deletedLines: 20000, binaryBytes: 10 * 1024 * 1024,
    totalBinaryBytes: 50 * 1024 * 1024, ...limits };
  let deletedFiles = 0, deletedLines = 0, binaryBytes = 0;
  const largeBinaries = [];
  for (const item of numstat) {
    if (item.deleted) deletedFiles++;
    if (item.removed !== '-') deletedLines += Number(item.removed);
    if (item.added === '-') {
      const size = sizes[item.file] || 0;
      binaryBytes += size;
      if (size >= policy.binaryBytes) largeBinaries.push({ file: item.file, bytes: size });
    }
  }
  const reasons = [];
  if (deletedFiles >= policy.deletedFiles) reasons.push(`${deletedFiles} deleted files`);
  if (deletedLines >= policy.deletedLines) reasons.push(`${deletedLines} deleted lines`);
  if (largeBinaries.length) reasons.push(`${largeBinaries.length} large binary files`);
  if (binaryBytes >= policy.totalBinaryBytes) reasons.push(`${binaryBytes} bytes of binary additions`);
  return { reasons, deletedFiles, deletedLines, binaryBytes, largeBinaries };
}

export function healthReasons({ taskState, lastRunResult, taskLastRun, snapshotTime, ahead = 0, lastReceipt, now = Date.now() }) {
  const reasons = [];
  if (taskState === 'Disabled') reasons.push('Daily snapshot task is disabled.');
  const repairedAfterTask = lastReceipt?.status === 'success' && taskLastRun && Date.parse(lastReceipt.at) > Date.parse(taskLastRun);
  if (!repairedAfterTask && lastRunResult && ![267008, 267009, 267011].includes(Number(lastRunResult))) reasons.push(`Task Scheduler last result: ${lastRunResult}.`);
  const checked = lastReceipt?.status === 'success' && lastReceipt.at ? lastReceipt.at : snapshotTime;
  if (!checked) reasons.push('No successful save or review check could be verified.');
  else if (!Number.isFinite(Date.parse(checked)) || now - Date.parse(checked) > 36 * 3600000) reasons.push('No successful save or review check in the last 36 hours.');
  if (ahead) reasons.push(`${ahead} local commit(s) are waiting to push.`);
  if (lastReceipt?.status === 'failed' || lastReceipt?.status === 'blocked') reasons.push(`Latest save: ${lastReceipt.message}`);
  return reasons;
}

function parseNumstat(text, deleted) {
  // --no-renames makes every entry one NUL-separated record, even for odd filenames.
  return text.split('\0').filter(Boolean).map(line => {
    const first = line.indexOf('\t'), second = line.indexOf('\t', first + 1);
    const file = line.slice(second + 1);
    return { added: line.slice(0, first), removed: line.slice(first + 1, second), file, deleted: deleted.has(file) };
  });
}

export function makeRunner(config) {
  const root = path.resolve(config.repoPath);
  const state = path.resolve(config.stateDir || path.join(root, '.agent/scratch/nightly-save'));
  fs.mkdirSync(state, { recursive: true });
  const git = (args, extra = {}) => command('git', ['-C', root, ...args], extra);
  const receiptPath = path.join(state, 'last-run.json');
  const readJson = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
  const writeJson = (file, data) => { fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2)); fs.renameSync(`${file}.tmp`, file); };
  const guard = (args, env) => command(process.execPath,
    [path.join(root, 'scripts/git/commit-msg-agora-guard.cjs'), ...args], { cwd: root, env: { ...process.env, ...env, ARALIA_SNAPSHOT_REQUIRE_AGORA: '1', ARALIA_SNAPSHOT_FORCE: '' } });
  function scan(range) {
    // Use the reviewed tool's built-in rules, never a working-tree configuration or ignore list.
    // Redaction also applies to failure output and the local report.
    const report = path.join(state, 'secrets-redacted.json');
    command(config.gitleaksPath, ['git', root, '--redact=100', '--no-banner', '--exit-code=23',
      `--config=${config.gitleaksConfig}`, '--ignore-gitleaks-allow', `--gitleaks-ignore-path=${state}`,
      '--report-format=json', `--report-path=${report}`, `--log-opts=${range}`],
    { cwd: state, env: { ...process.env, GITLEAKS_CONFIG: '', GITLEAKS_CONFIG_TOML: '', GITLEAKS_CONFIG_PATH: '' } });
  }
  function validateRoot() {
    if (git(['branch', '--show-current']).trim() !== 'master') throw new Error('Daily save requires master.');
    const actual = git(['remote', 'get-url', '--push', 'origin']).trim().replace(/\.git$/, '').replace(/\/$/, '');
    if (actual !== config.expectedRemote.replace(/\.git$/, '').replace(/\/$/, '')) throw new Error('Origin does not match the configured publication remote.');
    if (git(['ls-files', '-u']).trim()) throw new Error('Unresolved merge conflicts must be resolved before saving.');
  }
  function remoteState(fetch = true) {
    if (fetch) git(['fetch', '--no-tags', 'origin', 'master']);
    const [behind, ahead] = git(['rev-list', '--left-right', '--count', 'origin/master...HEAD']).trim().split(/\s+/).map(Number);
    return { behind, ahead };
  }
  function inspect(indexFile, env, committedTree, enforce = true) {
    const tree = committedTree || git(['write-tree'], { env }).trim();
    const base = git(['rev-parse', 'origin/master']).trim();
    const deleted = new Set(git(['diff', '--no-renames', '--name-only', '-z', '--diff-filter=D', base, tree], { env }).split('\0').filter(Boolean));
    const entries = parseNumstat(git(['diff', '--no-renames', '--numstat', '-z', base, tree], { env }), deleted);
    const sizes = {};
    for (const item of entries.filter(e => e.added === '-' && !e.deleted)) {
      sizes[item.file] = Number(git(['cat-file', '-s', `${tree}:${item.file}`], { env }).trim());
    }
    const assessment = assessChanges(entries, sizes, config.limits);
    const fingerprint = crypto.createHash('sha256').update(`${base}\n${tree}`).digest('hex');
    const report = { checkedAt: new Date().toISOString(), base, tree, fingerprint, ...assessment, entries };
    writeJson(path.join(state, 'change-review.json'), report);
    const grouped = new Map();
    for (const entry of entries) {
      const group = entry.file.split('/').slice(0, 3).join('/');
      const counts = grouped.get(group) || { changed: 0, deleted: 0 };
      counts.changed++; if (entry.deleted) counts.deleted++; grouped.set(group, counts);
    }
    const summary = [...grouped].sort((a, b) => b[1].changed - a[1].changed)
      .map(([folder, counts]) => `| ${folder} | ${counts.changed} | ${counts.deleted} |`).join('\n');
    fs.writeFileSync(path.join(state, 'change-review.md'),
      `# Public snapshot review\n\nChecked: ${report.checkedAt}\n\n` +
      `Publication is ${assessment.reasons.length ? 'waiting for review' : 'within the automatic limits'}.\n\n` +
      `Detected: ${assessment.deletedFiles} deleted files; ${assessment.deletedLines} removed lines; ${assessment.binaryBytes} bytes of binary additions.\n\n` +
      `This preview does not commit or push. Deleted tracked files remain recoverable from GitHub history. The private backup runs separately.\n\n` +
      `| Folder | Changed files | Deleted files |\n| --- | ---: | ---: |\n${summary}\n\n` +
      `The exact paths, tree, and fingerprint are in change-review.json. An approval applies only to this exact tree and never skips the secret scan.\n`);
    const approval = readJson(path.join(state, 'change-approval.json'));
    if (enforce && assessment.reasons.length && approval?.fingerprint !== fingerprint) {
      const error = new Error(`Publication needs change review: ${assessment.reasons.join(', ')}. See ${path.join(state, 'change-review.json')}`);
      error.blocked = true;
      throw error;
    }
    return report;
  }
  async function run({ dryRun = false, publishReviewed, reviewCommitted = false } = {}) {
    const lockPath = path.join(state, 'run.lock');
    // Recover only a lock whose process is demonstrably gone. An active or unknown
    // owner is never displaced, including a process with inaccessible permissions.
    if (fs.existsSync(lockPath)) {
      const pid = Number(fs.readFileSync(lockPath, 'utf8'));
      if (!Number.isInteger(pid) || pid <= 0) throw new Error('Save lock has no valid owner; inspect it before retrying.');
      try { process.kill(pid, 0); throw new Error('Another save is running.'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
      fs.unlinkSync(lockPath);
    }
    const lock = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(lock, String(process.pid));
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aralia-nightly-'));
    try {
      validateRoot();
      const { behind, ahead } = remoteState();
      if (behind) throw new Error('Local master is behind GitHub. Review before saving.');
      const indexPath = git(['rev-parse', '--path-format=absolute', '--git-path', 'index']).trim();
      const candidateIndex = path.join(temp, 'index-candidate');
      const env = { ...process.env, GIT_INDEX_FILE: candidateIndex };
      if (reviewCommitted || publishReviewed) git(['read-tree', 'HEAD'], { env });
      else { fs.copyFileSync(indexPath, candidateIndex); git(['add', '-A'], { env }); }
      const initialTree = git(['write-tree'], { env }).trim();
      const held = path.join(temp, 'held');
      if (reviewCommitted || publishReviewed) env.ARALIA_SNAPSHOT_COMPARE_BASE = 'origin/master';
      console.log(guard(['--hold-back-locked', held], env));
      const tree = git(['write-tree'], { env }).trim();
      if ((publishReviewed || reviewCommitted) && (tree !== initialTree || fs.readFileSync(held, 'utf8').length)) throw new Error('Committed changes overlap active Agora locks. Retry after the owners finish.');
      const report = inspect(candidateIndex, env, tree, false);
      // Scan an unreferenced commit. This never changes master or the user's index.
      if (report.entries.length) {
        const candidate = git(['commit-tree', tree, '-p', 'HEAD', '-m', 'nightly review candidate']).trim();
        scan('origin/master..' + candidate);
      } else if (ahead) scan('origin/master..HEAD');
      let message = report.entries.length ? 'Recovery is separate; public changes await deliberate review and commit.' : 'No public changes; successful check.';
      if (publishReviewed) {
        if (report.fingerprint !== publishReviewed) throw new Error('Publication fingerprint does not match the reviewed committed tree.');
        // Only existing commits can be published. Uncommitted game work stays local.
        scan('origin/master..HEAD');
        guard(['--hold-back-locked', held], env);
        if (git(['write-tree'], { env }).trim() !== tree || fs.readFileSync(held, 'utf8').length) throw new Error('A new Agora lock overlaps outgoing changes.');
        if (ahead) git(['push', 'origin', 'HEAD:refs/heads/master']);
        git(['fetch', '--no-tags', 'origin', 'master']);
        if (git(['rev-parse', 'HEAD']).trim() !== git(['rev-parse', 'origin/master']).trim()) throw new Error('Remote publication verification did not match HEAD.');
        message = 'Reviewed commits pushed and verified.';
        fs.rmSync(path.join(state, 'change-approval.json'), { force: true });
      }
      const result = { status: dryRun ? 'preview' : 'success', mode: publishReviewed ? 'publication' : 'review',
        message, at: new Date().toISOString(), fingerprint: report.fingerprint, tree,
        reviewRequired: !publishReviewed && report.entries.length > 0, anomalyReasons: report.reasons,
        heldPaths: fs.readFileSync(held, 'utf8').split('\0').filter(Boolean).length };
      if (!dryRun) writeJson(receiptPath, result);
      return { ...result, changedFiles: report.entries.length };
    } catch (error) {
      if (!dryRun) writeJson(receiptPath, { status: error.blocked ? 'blocked' : 'failed', message: error.message, at: new Date().toISOString() });
      throw error;
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
      fs.closeSync(lock); fs.rmSync(lockPath, { force: true });
    }
  }
  function health({ taskState, lastRunResult, taskLastRun } = {}) {
    let snapshotTime, ahead, remoteError;
    try {
      ({ ahead } = remoteState());
      snapshotTime = git(['log', '-1', '--format=%cI', '--grep=^auto: daily snapshot', 'origin/master']).trim();
    } catch (error) { remoteError = error.message; }
    const lastReceipt = readJson(receiptPath);
    const reasons = healthReasons({ taskState, lastRunResult, taskLastRun, snapshotTime, ahead: lastReceipt?.mode === 'review' ? 0 : ahead, lastReceipt });
    if (config.backupEnabled) {
      const backup = readJson(path.join(state, 'private-backup.json'));
      if (!backup) reasons.push('Private backup has no completed receipt.');
      else if (backup.status === 'running') {
        if (Date.now() - new Date(backup.at).getTime() > 2 * 3600000) reasons.push('Private backup has been running over two hours; inspect it.');
      }
      else if (backup.status !== 'success') reasons.push(`Private backup needs attention: ${backup.message}`);
      else if (Date.now() - new Date(backup.at).getTime() > 36 * 3600000) reasons.push('Private backup is over 36 hours old.');
      if (config.privateGitEnabled) {
        const cloud = readJson(path.join(state, 'private-cloud.json'));
        if (!cloud || cloud.status !== 'success') reasons.push('Private GitHub recovery copy has no successful push receipt.');
        else if (Date.now() - new Date(cloud.at).getTime() > 36 * 3600000) reasons.push('Private GitHub recovery copy is over 36 hours old.');
        else {
          try {
            const published = command('git', ['-C', config.privateGitDir, 'ls-remote', 'origin', 'refs/heads/master']).trim().split(/\s+/)[0];
            if (published !== cloud.commit) reasons.push('Private GitHub head does not match the successful recovery receipt.');
          } catch (error) { reasons.push(`Cannot verify private GitHub recovery: ${error.message}`); }
        }
      }
      if (config.backupMaxBytes) {
        try { reasons.push(...storageStatus(config).reasons); }
        catch (error) { reasons.push(`Cannot assess recovery storage: ${error.message}`); }
      }
    }
    if (remoteError) reasons.push(`Cannot verify GitHub: ${remoteError}`);
    const result = { checkedAt: new Date().toISOString(), taskState, snapshotTime, ahead, reviewPending: !!lastReceipt?.reviewRequired, reasons, lastReceipt };
    writeJson(path.join(state, 'health.json'), result);
    return result;
  }
  return { run, health };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const configPath = args[args.indexOf('--config') + 1];
    if (!args.includes('--config') || !configPath) throw new Error('--config <local JSON file> is required.');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
    if (args.includes('--publish-reviewed') && !/^[a-f0-9]{64}$/.test(args[args.indexOf('--publish-reviewed') + 1] || '')) throw new Error('--publish-reviewed requires the exact reviewed fingerprint.');
    if (args.includes('--approve-anomalies')) {
      const review = JSON.parse(fs.readFileSync(path.join(config.stateDir, 'change-review.json'), 'utf8'));
      const fingerprint = args[args.indexOf('--approve-anomalies') + 1];
      if (fingerprint !== review.fingerprint) throw new Error('Approval must match the exact reviewed fingerprint.');
      fs.writeFileSync(path.join(config.stateDir, 'change-approval.json'), JSON.stringify({ fingerprint, approvedAt: new Date().toISOString() }));
      console.log('Approved the reviewed tree only; any change invalidates this approval.');
    } else {
      const runner = makeRunner(config);
      const result = args.includes('--health') ? runner.health({ taskState: args[args.indexOf('--task-state') + 1], lastRunResult: Number(args[args.indexOf('--task-result') + 1]), taskLastRun: args.includes('--task-last-run') ? args[args.indexOf('--task-last-run') + 1] : undefined })
        : await runner.run({ dryRun: args.includes('--dry-run'), reviewCommitted: args.includes('--review-committed'), publishReviewed: args.includes('--publish-reviewed') ? args[args.indexOf('--publish-reviewed') + 1] : undefined });
      console.log(JSON.stringify(result, null, 2));
      if (args.includes('--health') && result.reasons.length) process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = error.blocked ? 2 : 1; }
}
