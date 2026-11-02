/**
 * Give native gameplay verification an immutable application copy while peers
 * keep working in the checkout. This reuses Aralia's verification-no-watch Vite
 * mode; it changes no game rule, save, world source or running preview.
 *
 * Captures live src/public bytes, verifies a quiet source fence, then publishes
 * a manifest. Serving verifies the copy and rejects accidental live app imports.
 * A fresh origin must be used: this tool does not establish save compatibility.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT_FILES = ['index.html', 'index.tsx', 'vite.config.ts', 'package.json', 'package-lock.json',
  'tsconfig.json', 'tsconfig.node.json', 'postcss.config.js', 'tailwind.config.js'];
const REQUIRED_FILES = new Set(['index.html', 'index.tsx', 'vite.config.ts', 'package.json',
  'postcss.config.js', 'tailwind.config.js']);
const MANIFEST = 'source-cut.json';
const APPLICATION_EXTRAS = ['vendor/ez-tree', 'docs/rendering-hall-of-shame.md', 'docs/water-hall-of-shame.md',
  'docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md', 'docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md'];
const sha256 = data => createHash('sha256').update(data).digest('hex');
const slash = value => value.replaceAll('\\', '/');
async function eachBounded(items, action) {
  let cursor = 0;
  const results = await Promise.allSettled(Array.from({ length: Math.min(8, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; await action(items[index], index); }
  }));
  const failed = results.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
}
function inside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}
function safeFile(root, relative) {
  const absolute = path.resolve(root, relative);
  if (!relative || path.isAbsolute(relative) || !inside(root, absolute) || absolute === path.resolve(root)) {
    throw new Error(`Source-cut path escapes its root: ${relative}`);
  }
  return absolute;
}

async function inputs(root, extras = [], extrasOnly = false, publicSource) {
  const result = [];
  async function walk(relative, ancestors = new Set()) {
    const absolute = safeFile(root, relative);
    const real = await fs.realpath(absolute);
    const sharedPublic = publicSource && (relative === 'public' || slash(relative).startsWith('public/')) && inside(publicSource, real);
    if (!inside(root, real) && !sharedPublic) throw new Error(`Source link escapes the project: ${relative}`);
    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) {
      if (ancestors.has(real)) throw new Error(`Source link cycle: ${relative}`);
      const next = new Set(ancestors).add(real);
      for (const name of (await fs.readdir(absolute)).sort()) {
        if (slash(relative).startsWith('vendor/') && ['node_modules', '.git'].includes(name)) continue;
        await walk(path.join(relative, name), next);
      }
    } else if (stat.isFile()) result.push(slash(relative));
    else throw new Error(`Unsupported source entry: ${relative}`);
  }
  if (!extrasOnly) {
    await walk('src');
    await walk('public');
    for (const name of ROOT_FILES) {
      try { await walk(name); }
      catch (error) { if (error.code !== 'ENOENT' || REQUIRED_FILES.has(name)) throw error; }
    }
  }
  for (const name of extras) await walk(name);
  return [...new Set(result)].sort();
}

async function verifyFiles(root, manifest, quietFence, extrasOnly = false) {
  const actual = await inputs(root, manifest.extraInputs ?? [], extrasOnly, manifest.publicSource);
  const expected = manifest.files.map(file => file.path).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Source file inventory changed');
  const fence = [];
  await eachBounded(manifest.files, async file => {
    const absolute = safeFile(root, file.path);
    if (sha256(await fs.readFile(absolute)) !== file.sha256) throw new Error(`Source bytes changed: ${file.path}`);
    if (quietFence) {
      const stat = await fs.stat(absolute);
      fence.push({ absolute, size: stat.size, mtimeMs: stat.mtimeMs });
    }
  });
  // Hashing alone could miss a peer edit to an early file during a long public
  // asset scan. A second metadata fence rejects that capture before publication.
  await eachBounded(fence, async item => {
    const stat = await fs.stat(item.absolute);
    if (stat.size !== item.size || stat.mtimeMs !== item.mtimeMs) throw new Error('Source changed during verification');
  });
}

export async function captureSourceCut({ projectRoot = PROJECT_ROOT, output, onProgress, extraInputs = [] }) {
  projectRoot = await fs.realpath(projectRoot);
  output = path.resolve(output);
  const scratch = path.join(projectRoot, '.agent', 'scratch');
  if (!inside(scratch, output) || output === scratch) throw new Error('Source cuts belong in this project\'s ignored scratch directory');
  const files = await inputs(projectRoot, extraInputs);
  await fs.mkdir(path.dirname(output), { recursive: true });
  // Never overwrite a previous cut, even a rejected one. Its bytes may explain
  // a native result or an interrupted capture, so a later attempt gets a new name.
  await fs.mkdir(output);
  const manifest = { version: 3, projectRoot, capturedAt: new Date().toISOString(), extraInputs,
    purpose: 'Isolated verification source; no gameplay or save-compatibility claim', files: [] };
  let copied = 0;
  await eachBounded(files, async (relative, index) => {
    const data = await fs.readFile(safeFile(projectRoot, relative));
    const destination = safeFile(output, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, data, { flag: 'wx' });
    manifest.files[index] = { path: relative, bytes: data.length, sha256: sha256(data) };
    copied++;
    if (copied % 1000 === 0 || copied === files.length) onProgress?.({ copied, total: files.length });
  });
  await verifyFiles(projectRoot, manifest, true);
  await fs.writeFile(path.join(output, MANIFEST), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  return manifest;
}

export async function verifySourceCut(cut) {
  const manifest = JSON.parse(await fs.readFile(path.join(cut, MANIFEST), 'utf8'));
  if (manifest.version !== 3 || !Array.isArray(manifest.files)) throw new Error('Unsupported or incomplete source-cut manifest');
  if ([...REQUIRED_FILES].some(name => !manifest.files.some(file => file.path === name))) throw new Error('Incomplete bootstrap/style capture');
  if (manifest.publicSource) {
    // Only unchanged assets from the recorded immutable base may be shared.
    // Application source remains a distinct copy; arbitrary external links
    // and public-asset revisions cannot use this storage-saving mode.
    const base = await fs.realpath(manifest.sourceBase?.path ?? '');
    const scratch = path.join(manifest.projectRoot, '.agent/scratch');
    if (!inside(scratch, base) || base === await fs.realpath(cut)) throw new Error('Invalid shared public base');
    const text = await fs.readFile(path.join(base, MANIFEST), 'utf8');
    if (sha256(text) !== manifest.sourceBase.manifestSha256) throw new Error('Shared public base manifest changed');
    const publicPath = await fs.realpath(path.join(base, 'public'));
    if (publicPath !== manifest.publicSource || publicPath !== await fs.realpath(path.join(cut, 'public')))
      throw new Error('Shared public link does not match its recorded base');
    const publicFiles = files => files.filter(f => f.path.startsWith('public/'));
    if (JSON.stringify(publicFiles(manifest.files)) !== JSON.stringify(publicFiles(JSON.parse(text).files)))
      throw new Error('Shared public inventory differs from its base');
  }
  await verifyFiles(cut, manifest, false);
  return manifest;
}

/** Complete a captured source boundary by adding missing dependencies only.
 * Existing application bytes come from the verified base, never a newer live
 * checkout. This repairs the verification environment without rerolling a town
 * or changing an already-created character. The base remains byte-for-byte intact.
 */
export async function completeSourceCut({ projectRoot = PROJECT_ROOT, base, output, additions = APPLICATION_EXTRAS, onProgress }) {
  projectRoot = await fs.realpath(projectRoot);
  base = await fs.realpath(base);
  output = path.resolve(output);
  const scratch = path.join(projectRoot, '.agent/scratch');
  if (!inside(scratch, base) || !inside(scratch, output) || output === scratch) throw new Error('Source cuts belong in ignored scratch');
  const baseText = await fs.readFile(path.join(base, MANIFEST), 'utf8');
  const prior = JSON.parse(baseText);
  if (![2, 3].includes(prior.version)) throw new Error('Unsupported source base');
  await verifyFiles(base, prior, false);
  const extraPaths = await inputs(projectRoot, additions, true);
  if (extraPaths.some(relative => prior.files.some(file => file.path === relative))) throw new Error('Completion cannot replace existing source bytes');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output);
  const jobs = [...prior.files.map(file => ({ ...file, from: base })), ...extraPaths.map(relative => ({ path: relative, from: projectRoot }))];
  const manifest = { version: 3, projectRoot, capturedAt: new Date().toISOString(),
    purpose: 'Fixed application source with missing dependency completion; no save compatibility claim',
    sourceBase: { path: base, manifestSha256: sha256(baseText) },
    extraInputs: [...new Set([...(prior.extraInputs ?? []), ...additions])], files: [] };
  let copied = 0;
  await eachBounded(jobs, async (job, index) => {
    const data = await fs.readFile(safeFile(job.from, job.path));
    const hash = sha256(data);
    if (job.sha256 && hash !== job.sha256) throw new Error(`Base source changed: ${job.path}`);
    const destination = safeFile(output, job.path);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, data, { flag: 'wx' });
    manifest.files[index] = { path: job.path, bytes: data.length, sha256: hash };
    copied++;
    if (copied % 1000 === 0 || copied === jobs.length) onProgress?.({ copied, total: jobs.length });
  });
  await verifyFiles(base, prior, true);
  await verifyFiles(projectRoot, { files: manifest.files.filter(file => extraPaths.includes(file.path)), extraInputs: additions }, true, true);
  await fs.writeFile(path.join(output, MANIFEST), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  return manifest;
}

/** Derive a new verification boundary without adopting peers' unfinished work.
 * Every unlisted byte comes from the verified base. Explicit replacements are
 * fenced against concurrent edits; neither an old cut nor a save is modified.
 */
export async function reviseSourceCut({ projectRoot = PROJECT_ROOT, base, output, replacements, onProgress, reusePublic = false, replacementRoot }) {
  // A reviewed delta may be prepared against the frozen base in ignored
  // scratch. Reading that explicit overlay avoids adopting unrelated live
  // world changes. Default revisions still read only the project checkout.
  replacementRoot = await fs.realpath(replacementRoot ?? projectRoot);
  if (replacementRoot !== await fs.realpath(projectRoot)
    && !inside(path.join(projectRoot, '.agent', 'scratch'), replacementRoot)) {
    throw new Error('Replacement overlay must be inside this project ignored scratch');
  }
  projectRoot = await fs.realpath(projectRoot);
  base = await fs.realpath(base);
  output = path.resolve(output);
  const scratch = path.join(projectRoot, '.agent/scratch');
  if (!inside(scratch, base) || !inside(scratch, output) || output === scratch) throw new Error('Source cuts belong in ignored scratch');
  if (!Array.isArray(replacements) || !replacements.length) throw new Error('Explicit replacement files are required');
  const changed = [...new Set(replacements.map(relative => {
    safeFile(projectRoot, relative);
    const normalized = slash(relative);
    // A reviewed toolchain change must be captured explicitly in a new cut.
    // The serving guard still checks these bytes; this never refreshes game
    // source implicitly or claims that an existing save is compatible.
    const environmentFile = ['vite.config.ts', 'package.json', 'package-lock.json'].includes(normalized);
    if (!normalized.startsWith('src/') && !normalized.startsWith('public/') && !environmentFile) throw new Error('Only application source or explicit verification environment files may be revised');
    return normalized;
  }))].sort();
  if (reusePublic && changed.some(file => file.startsWith('public/'))) throw new Error('Shared public assets cannot be revised');
  const baseText = await fs.readFile(path.join(base, MANIFEST), 'utf8');
  const prior = await verifySourceCut(base);
  const revisionFiles = [];
  for (const relative of changed) {
    const absolute = safeFile(replacementRoot, relative);
    if (!inside(replacementRoot, await fs.realpath(absolute))) throw new Error('Replacement link escapes its source root');
    const data = await fs.readFile(absolute);
    const stat = await fs.stat(absolute);
    revisionFiles.push({ path: relative, bytes: data.length, sha256: sha256(data), mtimeMs: stat.mtimeMs, data });
  }
  await fs.mkdir(path.dirname(output), { recursive: true });
  const changedBytes = new Map(revisionFiles.map(file => [file.path, file.bytes]));
  const copyBytes = prior.files.reduce((sum, file) => sum + (reusePublic && file.path.startsWith('public/') ? 0 : changedBytes.get(file.path) ?? file.bytes), 0)
    + revisionFiles.filter(file => !prior.files.some(old => old.path === file.path)).reduce((sum, file) => sum + file.bytes, 0);
  const disk = await fs.statfs(path.dirname(output));
  // Reserve room for Vite's cache and the next real save. Refuse BEFORE making
  // an incomplete copy when the logical-copy upper bound cannot fit.
  if (disk.bavail * disk.bsize < copyBytes + 64 * 1024 * 1024) throw new Error('Insufficient free space for source revision plus64MiB reserve');
  await fs.mkdir(output);
  const manifest = { version: 3, projectRoot, capturedAt: new Date().toISOString(),
    purpose: 'Accepted source plus explicit owned revisions; no save compatibility claim',
    sourceBase: { path: base, manifestSha256: sha256(baseText) }, replacements: changed,
    ...(replacementRoot !== await fs.realpath(projectRoot) ? {replacementSourceRoot: replacementRoot} : {}),
    extraInputs: prior.extraInputs ?? [], files: [] };
  if (reusePublic) {
    manifest.publicSource = await fs.realpath(path.join(base, 'public'));
    await fs.symlink(manifest.publicSource, path.join(output, 'public'), process.platform === 'win32' ? 'junction' : 'dir');
  }
  const paths = [...new Set([...prior.files.map(file => file.path), ...changed])].sort();
  const oldFiles = new Map(prior.files.map(file => [file.path, file]));
  const revised = new Map(revisionFiles.map(file => [file.path, file]));
  let copied = 0;
  await eachBounded(paths, async (relative, index) => {
    const revision = revised.get(relative);
    if (reusePublic && relative.startsWith('public/')) {
      manifest.files[index] = { ...oldFiles.get(relative) };
      copied++;
      return;
    }
    const data = revision?.data ?? await fs.readFile(safeFile(base, relative));
    const hash = sha256(data);
    if (!revision && hash !== oldFiles.get(relative).sha256) throw new Error(`Base source changed: ${relative}`);
    const destination = safeFile(output, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, data, { flag: 'wx' });
    manifest.files[index] = { path: relative, bytes: data.length, sha256: hash };
    copied++;
    if (copied % 1000 === 0 || copied === paths.length) onProgress?.({ copied, total: paths.length });
  });
  await verifyFiles(base, prior, true);
  for (const file of revisionFiles) {
    const absolute = safeFile(replacementRoot, file.path), stat = await fs.stat(absolute);
    if (stat.mtimeMs !== file.mtimeMs || sha256(await fs.readFile(absolute)) !== file.sha256) throw new Error(`Replacement changed during capture: ${file.path}`);
  }
  await verifyFiles(output, manifest, false);
  await fs.writeFile(path.join(output, MANIFEST), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  return manifest;
}

export function isLiveApplicationImport(id, projectRoot) {
  const clean = slash(id.split('?')[0]).toLowerCase();
  const root = slash(path.resolve(projectRoot)).toLowerCase();
  return clean.startsWith(root + '/src/') || clean.startsWith(root + '/public/')
    || clean.startsWith(root + '/vendor/') || clean.startsWith(root + '/docs/') || clean === root + '/index.tsx';
}

export async function serveSourceCut(cut, port) {
  cut = await fs.realpath(cut);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('An explicit local verification port is required');
  const manifest = await verifySourceCut(cut);
  const projectRoot = manifest.projectRoot;
  // Vite's normal configuration/plugins and installed dependencies remain the
  // owners of transforms. Refuse a changed configuration or dependency contract.
  for (const name of ['vite.config.ts', 'package.json', 'package-lock.json']) {
    const recorded = manifest.files.find(file => file.path === name);
    if (recorded && sha256(await fs.readFile(path.join(projectRoot, name))) !== recorded.sha256) {
      throw new Error(`Verification environment changed since capture: ${name}`);
    }
  }
  const { createServer } = await import('vite');
  // Tailwind's content paths and PostCSS configuration must resolve against the
  // same frozen source, rather than quietly scanning peers' current JSX files.
  process.chdir(cut);
  const server = await createServer({
    configFile: path.join(projectRoot, 'vite.config.ts'),
    mode: 'verification-no-watch', root: cut, publicDir: path.join(cut, 'public'),
    cacheDir: path.join(cut, 'vite-cache'),
    resolve: { alias: { '@/data/spells': path.join(cut, 'public/data/spells'), '@': path.join(cut, 'src') } },
    plugins: [{ name: 'reject-live-application-source', enforce: 'pre', load(id) {
      if (isLiveApplicationImport(id, projectRoot)) throw new Error(`Live application import rejected: ${id}`);
    } }],
    server: { host: 'localhost', port, strictPort: true, hmr: false, fs: { allow: [projectRoot, cut] } },
  });
  await server.listen();
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, target, portText, ...additions] = process.argv.slice(2);
  if (command === 'capture' && target) {
    const manifest = await captureSourceCut({ output: target, extraInputs: APPLICATION_EXTRAS,
      onProgress: progress => console.log(JSON.stringify({ copyingSource: progress })) });
    console.log(JSON.stringify({ cut: path.resolve(target), files: manifest.files.length,
      bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0), capturedAt: manifest.capturedAt }));
  } else if (command === 'complete' && target && portText) {
    const manifest = await completeSourceCut({ base: target, output: portText,
      ...(additions.length ? { additions } : {}), onProgress: progress => console.log(JSON.stringify({ completingSource: progress })) });
    console.log(JSON.stringify({ cut: path.resolve(portText), files: manifest.files.length, sourceBase: manifest.sourceBase }));
  } else if (command === 'revise' && target && portText) {
    const manifest = await reviseSourceCut({ base: target, output: portText, replacements: additions.filter(file => file !== '--reuse-public'), reusePublic: additions.includes('--reuse-public'),
      onProgress: progress => console.log(JSON.stringify({ revisingSource: progress })) });
    console.log(JSON.stringify({ cut: path.resolve(portText), files: manifest.files.length, sourceBase: manifest.sourceBase, replacements: manifest.replacements }));
  } else if (command === 'serve' && target) {
    const server = await serveSourceCut(target, Number(portText));
    console.log(`Immutable verification source listening on http://localhost:${Number(portText)}/Aralia/`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
  } else throw new Error('Usage: sourceCut.mjs capture <ignored-cut-directory> | complete <base-cut> <new-cut> [missing-input...] | revise <base-cut> <new-cut> [--reuse-public] <owned-file...> | serve <cut-directory> <port>');
}
