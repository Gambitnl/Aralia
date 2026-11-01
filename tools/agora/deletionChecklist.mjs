#!/usr/bin/env node
/**
 * WF-G321: inventory generated dependency headers before/after a file deletion.
 * Missing targets are expected. Evidence never grants ownership or rewrites a
 * sibling's header; the parent assigns follow-ups and runs one scoped sync.
 * This is a text-header audit, not a runtime dependency or deletion safety proof.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(FILE), '../..');
const slash = value => value.replace(/\\/g, '/');
const sourceFile = /\.[cm]?[jt]sx?$/i;

function within(root, file) {
  const relative = path.relative(root, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}

/** Read only requested source subtrees; never follow symlinks into other work. */
export function deletionChecklist({ deleted, scan, repoRoot = REPO }) {
  if (!Array.isArray(deleted) || !deleted.length || deleted.some(item => typeof item !== 'string' || !item.trim())) {
    throw new Error('name at least one --deleted repository-relative file');
  }
  if (!Array.isArray(scan) || !scan.length) throw new Error('name at least one --scan source subtree');
  const root = fs.realpathSync(repoRoot);
  function relativeFile(value) {
    const normalized = slash(value);
    if (normalized.split('/').includes('..') || path.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) {
      throw new Error('path must be repository-relative without parent traversal: ' + value);
    }
    const absolute = path.resolve(root, normalized);
    if (!within(root, absolute) || absolute === root) throw new Error('path escapes repository: ' + value);
    return slash(path.relative(root, absolute));
  }
  const targets = [...new Set(deleted.map(relativeFile))].sort().map(file => ({
    path: file, exists: fs.existsSync(path.join(root, file)),
  }));
  const key = value => process.platform === 'win32' ? value.toLowerCase() : value;
  const wanted = new Map(targets.map(target => [key(target.path), target]));
  const files = new Set();
  function visit(file) {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(file).sort()) {
        if (['node_modules', '.git', '.agent', 'dist', 'build'].includes(entry)) continue;
        visit(path.join(file, entry));
      }
    } else if (stat.isFile() && sourceFile.test(file)) files.add(file);
  }
  for (const scope of scan) {
    const file = path.join(root, relativeFile(scope));
    if (!within(root, fs.realpathSync(file))) throw new Error('scan scope escapes repository: ' + scope);
    visit(file);
  }
  const headerHits = [];
  for (const file of [...files].sort()) {
    const text = fs.readFileSync(file, 'utf8');
    // Headers are generated prose. Match only their Dependents field, not
    // Imports, source strings, unrelated comments or a same-basename path.
    for (const block of text.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
      if (!block[0].includes('ARCHITECTURAL ADVISORY:')) continue;
      let reading = false;
      let offset = block.index;
      for (const line of block[0].split('\n')) {
        const body = line.replace(/^\s*\*\s?/, '').trim();
        if (body.startsWith('Dependents:')) reading = true;
        else if (reading && (!body || /^[A-Za-z][\w -]*:(?:\s|$)/.test(body) || body === '/')) reading = false;
        if (reading) {
          for (const token of body.replace(/^Dependents:\s*/, '').split(',')) {
            const value = slash(token.trim().replace(/^`|`$/g, ''));
            const absolute = path.isAbsolute(value) ? value : path.join(root, value);
            const full = within(root, absolute) ? slash(path.relative(root, absolute)) : '';
            const target = wanted.get(key(full)) ?? wanted.get(key('src/' + value.replace(/^\.\//, '')));
            if (!target) continue;
            headerHits.push({ file: slash(path.relative(root, file)),
              line: text.slice(0, offset).split('\n').length, target: target.path, stale: !target.exists });
          }
        }
        offset += line.length + 1;
      }
    }
  }
  return { targets, scannedFiles: files.size, headerHits,
    limits: 'Generated Dependents headers only; no complete runtime graph, edit permission, automatic sync or deletion acceptance.' };
}

export function formatDeletionChecklist(report) {
  return [
    ...report.targets.map(target => `${target.path}: ${target.exists ? 'present (pre-delete inventory)' : 'absent'}`),
    ...report.headerHits.map(hit => `${hit.file}:${hit.line} -> ${hit.target} [${hit.stale ? 'stale' : 'review before deletion'}]`),
    `${report.scannedFiles} source files; ${report.headerHits.length} header hits. ${report.limits}`,
  ].join('\n');
}

// A bounded audit fails loudly on unknown flags or missing scopes. It never
// imports scanned code, mutates files, contacts Agora, or acquires a lock.
if (process.argv[1] && path.resolve(process.argv[1]) === FILE) {
  try {
    const deleted = [], scan = [];
    let json = false;
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--json') { json = true; continue; }
      if (!['--deleted', '--scan'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
        throw new Error('usage: --deleted <repo-file>... --scan <source-subtree>... [--json]');
      }
      (args[i] === '--deleted' ? deleted : scan).push(args[++i]);
    }
    const report = deletionChecklist({ deleted, scan });
    console.log(json ? JSON.stringify(report, null, 2) : formatDeletionChecklist(report));
  } catch (error) { console.error('deletion-checklist: ' + error.message); process.exitCode = 1; }
}
