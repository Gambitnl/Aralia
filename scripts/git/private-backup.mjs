/**
 * Prepare a separate private GitHub copy of source and text records.
 * The encrypted G: backup holds the full media collection. This copy excludes
 * credentials, browser profiles, generated caches, and files over 5 MiB.
 * Flagged text lines are redacted in the copy only, then scanned again. The
 * encrypted backup preserves exact originals, including redacted source lines.
 * A secret scan and remote visibility check must pass before every push.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { command } from './nightly-snapshot.mjs';

const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.jsonl', '.md', '.txt', '.toml', '.yaml', '.yml', '.ps1', '.sh', '.py', '.css', '.html', '.csv', '.svg']);
export function eligible(relative, size) {
  const parts = relative.replace(/\\/g, '/').split('/');
  if (parts.some(p => /^(node_modules|\.git|dist|build|\.next|\.cache|cache|cdp-profile|chrome-profile|browser-profile|nightly-save|snapshot-fixes)$/i.test(p))) return false;
  const name = parts.at(-1);
  if (/^client-identity\./i.test(name)) return false;
  if (/^(\.env($|\.)|credentials|secrets|auth\.json|.*\.dpapi$)/i.test(name)) return false;
  return size <= 5 * 1024 * 1024 && textExtensions.has(path.extname(name).toLowerCase());
}

export function prepare(config) {
  const target = path.resolve(config.privateGitDir);
  // Only remove stale copied files inside this exact dedicated backup directory.
  if (!target.toLowerCase().endsWith('aralia-private-source')) throw new Error('Unexpected private copy target.');
  fs.mkdirSync(target, { recursive: true });
  const copied = new Set();
  let bytes = 0;
  function walk(source, prefix) {
    if (!fs.existsSync(source)) return;
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      const relative = `${prefix}/${entry.name}`, absolute = path.join(source, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!/^(node_modules|\.git|dist|build|\.next|\.cache|cache|cdp-profile|chrome-profile|browser-profile|nightly-save|snapshot-fixes)$/i.test(entry.name)) walk(absolute, relative);
      } else if (entry.isFile()) {
        const info = fs.statSync(absolute);
        if (!eligible(relative, info.size)) continue;
        const destination = path.join(target, relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        const contents = fs.readFileSync(absolute);
        if (!fs.existsSync(destination) || !contents.equals(fs.readFileSync(destination))) fs.writeFileSync(destination, contents);
        copied.add(relative.replace(/\\/g, '/')); bytes += info.size;
      }
    }
  }
  for (const source of config.privateSources) walk(source.path, source.name);
  function prune(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) prune(file, relative);
      else if (!copied.has(relative)) fs.unlinkSync(file);
    }
  }
  prune(target);
  return { files: copied.size, bytes, target };
}

export function publishPrivate(config) {
  const visibility = JSON.parse(command('gh', ['api', `repos/${config.privateRepo}`, '--jq', '{private,full_name}']));
  if (!visibility.private || visibility.full_name.toLowerCase() !== config.privateRepo.toLowerCase()) throw new Error('Private backup repository visibility/identity check failed.');
  const target = config.privateGitDir;
  const git = args => command('git', ['-C', target, ...args], { timeout: 600000 });
  if (!fs.existsSync(path.join(target, '.git'))) {
    command('git', ['init', '-b', 'master', target]);
    git(['config', 'user.name', 'Aralia Private Backup']);
    git(['config', 'user.email', 'backup@users.noreply.github.com']);
    git(['remote', 'add', 'origin', `https://github.com/${config.privateRepo}.git`]);
  }
  if (git(['remote', 'get-url', '--push', 'origin']).trim() !== `https://github.com/${config.privateRepo}.git`) throw new Error('Private backup remote changed.');
  git(['config', 'core.longpaths', 'true']);
  git(['config', 'core.autocrlf', 'false']);
  // Initial copies contain many loose objects. Do not let automatic repacking
  // hold an unattended commit open; normal push packing still runs as needed.
  git(['config', 'gc.auto', '0']);
  git(['config', 'maintenance.auto', 'false']);
  // Scan the copied files before making even a private commit. Failures preserve
  // the encrypted full backup and leave the cloud copy unpublished for review.
  const scanArgs = ['dir', target, '--redact=100', '--no-banner', '--ignore-gitleaks-allow',
    `--config=${config.gitleaksConfig}`, `--gitleaks-ignore-path=${config.stateDir}`, '--exit-code=23',
    '--report-format=json', `--report-path=${path.join(config.stateDir, 'private-secrets-redacted.json')}`];
  try {
    command(config.gitleaksPath, scanArgs, { timeout: 600000 });
  } catch (error) {
    if (!error.message.includes('failed (23)')) throw error;
    const findings = JSON.parse(fs.readFileSync(path.join(config.stateDir, 'private-secrets-redacted.json'), 'utf8'));
    const redactions = redactCopy(target, findings);
    fs.writeFileSync(path.join(target, 'REDACTIONS.json'), JSON.stringify({
      note: 'Flagged lines were removed from this cloud copy. Exact originals are in the encrypted Restic backup.', redactions
    }, null, 2));
    // Never upload on the strength of redaction alone: the changed copy must pass a fresh scan.
    command(config.gitleaksPath, scanArgs, { timeout: 600000 });
  }
  git(['add', '-A']);
  if (git(['status', '--porcelain']).trim()) git(['commit', '-m', `private recovery copy ${new Date().toISOString()}`]);
  git(['push', '-u', 'origin', 'master']);
  const head = git(['rev-parse', 'HEAD']).trim();
  if (!git(['ls-remote', 'origin', 'refs/heads/master']).startsWith(head)) throw new Error('Private push did not verify.');
  return { commit: head, repo: config.privateRepo };
}

export function redactCopy(target, findings) {
  const grouped = new Map(), redactions = [];
  for (const finding of findings) {
    const absolute = path.resolve(finding.File);
    const relative = path.relative(target, absolute);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep)[0] === '.git') throw new Error('Scanner reported a path outside the copied text tree.');
    if (!grouped.has(absolute)) grouped.set(absolute, new Set());
    for (let line = finding.StartLine; line <= finding.EndLine; line++) grouped.get(absolute).add(line);
    redactions.push({ file: relative.replace(/\\/g, '/'), startLine: finding.StartLine, endLine: finding.EndLine, rule: finding.RuleID });
  }
  for (const [absolute, flagged] of grouped) {
    const text = fs.readFileSync(absolute, 'utf8'), eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    for (const line of flagged) {
      if (!Number.isInteger(line) || line < 1 || line > lines.length) throw new Error('Scanner line range did not match the copied file.');
      lines[line - 1] = '[PRIVATE BACKUP: FLAGGED LINE REDACTED; ORIGINAL IN ENCRYPTED BACKUP]';
    }
    fs.writeFileSync(absolute, lines.join(eol));
  }
  return redactions;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
    if (!process.argv.includes('--publish-only')) console.log(JSON.stringify(prepare(config)));
    if (config.privateGitEnabled) {
      const published = publishPrivate(config);
      fs.writeFileSync(path.join(config.stateDir, 'private-cloud.json'), JSON.stringify({ status: 'success', at: new Date().toISOString(), ...published }));
      console.log(JSON.stringify(published));
    }
  } catch (error) {
    if (config?.stateDir) fs.writeFileSync(path.join(config.stateDir, 'private-cloud.json'), JSON.stringify({ status: 'failed', at: new Date().toISOString(), message: error.message }));
    console.error(error.message); process.exitCode = 1;
  }
}
