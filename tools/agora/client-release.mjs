// WF-G240/WF-G245: publish the client as one immutable, validated file set.
// Readers never import an in-progress worktree implementation. A failed publish
// leaves the previous pointer intact; a runtime command is NEVER rerun here.
// Releases are disposable, ignored copies. The implementation and publisher
// remain tracked so a clean clone can bootstrap from committed HEAD, not dirt.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..', '..');
export const RELEASE_FILES = Object.freeze([
  'client-runtime.mjs', 'client-root.mjs', 'identity-policy.mjs',
  'gapIndex.mjs', 'gapAppend.mjs', 'taskLint.mjs', 'client-usage.txt', 'testBaseline.mjs', 'taskFreshness.mjs', 'dataValueProvenance.mjs', 'recordSourceProvenance.mjs',
  'lockSnapshots.mjs',
]);
export const CLIENT_EXPORTS = Object.freeze([
  'run', 'isMainModule', 'renameTargetOf', 'everTracked', 'fileFacts',
  'dirtyInWorktree', 'agentRegistryKeys', 'gapRegistryVocabulary',
  'gapRegistryProjects', 'classificationForSurface', 'gapTokens',
  'gapOverlap', 'findNearDuplicateGaps',
  'supportsLockRecovery',
]);
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const layout = (root) => ({
  root: path.resolve(root),
  releases: path.join(path.resolve(root), '.agent', 'agora', 'client-releases'),
  pointer: path.join(path.resolve(root), '.agent', 'agora', 'client-current.json'),
});
const manifestId = (manifest) => hash(JSON.stringify(manifest));

function committedSource(root, name, revision) {
  return execFileSync('git', ['-c', 'core.fsmonitor=false', 'show', `${revision}:tools/agora/${name}`], {
    cwd: root, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function revisionOf(root) {
  return execFileSync('git', ['-c', 'core.fsmonitor=false', 'rev-parse', 'HEAD'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function checkRelease(dir, id, root) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('invalid client release id');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'release.json'), 'utf8'));
  const names = [...RELEASE_FILES, 'client-origin.json'];
  // WF-G284/WF-G285: new helpers cannot invalidate selected older complete
  // seven/eight/nine/ten/eleven-source releases. Accept only exact inventories;
  // still hash every declared byte and refuse any other missing/extra file.
  const declared = Object.keys(manifest.files).sort().join('\n');
  const previousNames=names.filter(name=>name!=='lockSnapshots.mjs');
  const knownLegacy = [previousNames,previousNames.filter(name=>name!=='recordSourceProvenance.mjs'),
    previousNames.filter(name=>!['recordSourceProvenance.mjs','dataValueProvenance.mjs'].includes(name)),
    previousNames.filter(name => !['recordSourceProvenance.mjs','dataValueProvenance.mjs','taskFreshness.mjs'].includes(name)),
    previousNames.filter(name => !['recordSourceProvenance.mjs','dataValueProvenance.mjs','taskFreshness.mjs','testBaseline.mjs'].includes(name))]
    .map(inventory => inventory.sort().join('\n'));
  if (manifest.version !== 1 || manifest.repoRoot !== path.resolve(root)
    || manifestId(manifest) !== id
    || (declared !== names.sort().join('\n') && !knownLegacy.includes(declared))) {
    throw new Error('client release manifest does not match this checkout');
  }
  for (const [name, digest] of Object.entries(manifest.files)) {
    if (hash(fs.readFileSync(path.join(dir, name))) !== digest) {
      throw new Error(`published client release is damaged: ${name}`);
    }
  }
  return manifest;
}

// Validate before changing the pointer. Import in a child process so validation
// cannot leave a staging path cached in the caller's ESM module graph.
function validateRelease(dir) {
  for (const name of RELEASE_FILES.filter((file) => file.endsWith('.mjs'))) {
    execFileSync(process.execPath, ['--check', path.join(dir, name)], {
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 4 * 1024 * 1024,
    });
  }
  const probe = `const m = await import(${JSON.stringify(pathToFileURL(path.join(dir, 'client-runtime.mjs')).href)});`
    + `for (const key of ${JSON.stringify(CLIENT_EXPORTS)}) {`
    + `if (typeof m[key] !== 'function') throw new Error('missing client export: ' + key); }`
    + `await import(${JSON.stringify(pathToFileURL(path.join(dir, 'taskLint.mjs')).href)});`;
  execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
    stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 4 * 1024 * 1024,
  });
}

// Windows may briefly hold a pointer open. Retrying this atomic rename is safe:
// it publishes local bytes only, not a task/gap/message operation.
async function replacePointer(from, to) {
  for (let attempt = 1; ; attempt++) {
    try { fs.renameSync(from, to); return; } catch (error) {
      if (attempt >= 10 || !['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

/** Explicit worktree publication is an owner action after locks and focused tests.
 * Bootstrap is different: only committed bytes at one exact revision are eligible.
 * No reader automatically promotes current worktree bytes, even if they parse.
 */
export async function publishClient({ repoRoot = DEFAULT_ROOT, committed = false } = {}) {
  const loc = layout(repoRoot);
  const revision = committed ? revisionOf(loc.root) : null;
  const read = (name) => committed
    ? committedSource(loc.root, name, revision)
    : fs.readFileSync(path.join(loc.root, 'tools', 'agora', name));
  const contents = new Map(RELEASE_FILES.map((name) => [name, read(name)]));
  contents.set('client-origin.json', Buffer.from(JSON.stringify({ repoRoot: loc.root })));
  const manifest = {
    version: 1, repoRoot: loc.root, source: committed ? `git:${revision}` : 'reviewed-worktree',
    files: Object.fromEntries([...contents].map(([name, bytes]) => [name, hash(bytes)])),
  };
  const id = manifestId(manifest);
  fs.mkdirSync(loc.releases, { recursive: true });
  const stage = path.join(loc.releases, `.staging-${crypto.randomUUID()}`);
  const pointerTemp = `${loc.pointer}.${crypto.randomUUID()}.tmp`;
  fs.mkdirSync(stage);
  try {
    for (const [name, bytes] of contents) fs.writeFileSync(path.join(stage, name), bytes);
    fs.writeFileSync(path.join(stage, 'release.json'), JSON.stringify(manifest));
    validateRelease(stage);
    // A source write during validation invalidates the candidate. The owner
    // must finish the edit and publish again; arriving workers keep the old set.
    if (!committed) {
      for (const name of RELEASE_FILES) {
        if (hash(read(name)) !== manifest.files[name]) throw new Error(`source changed during publish: ${name}`);
      }
    }
    const destination = path.join(loc.releases, id);
    if (fs.existsSync(destination)) checkRelease(destination, id, loc.root);
    else {
      try { fs.renameSync(stage, destination); } catch (error) {
        // Two first-use readers may build the same committed release. Accept
        // only the identical complete winner, never an arbitrary existing path.
        if (!fs.existsSync(destination)) throw error;
        checkRelease(destination, id, loc.root);
      }
    }
    fs.writeFileSync(pointerTemp, JSON.stringify({ version: 1, id }));
    if (committed) {
      // First-use bootstrap may create, but must not replace, an owner-published
      // pointer that appeared during validation. A hard link is create-if-absent.
      try { fs.linkSync(pointerTemp, loc.pointer); } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        return clientReleaseStatus(loc.root);
      }
    } else await replacePointer(pointerTemp, loc.pointer);
    return { id, directory: destination, manifest };
  } finally {
    // Both paths are generated directly under this checkout's release cache.
    // Never remove another published release: a detached heartbeat may use it.
    if (path.dirname(stage) !== loc.releases) throw new Error('unsafe staging cleanup');
    fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(pointerTemp, { force: true });
  }
}

export function clientReleaseStatus(repoRoot = DEFAULT_ROOT) {
  const loc = layout(repoRoot);
  const pointer = JSON.parse(fs.readFileSync(loc.pointer, 'utf8'));
  if (pointer.version !== 1 || !/^[a-f0-9]{64}$/.test(pointer.id)) throw new Error('invalid client release pointer');
  const directory = path.join(loc.releases, pointer.id);
  return { id: pointer.id, directory, manifest: checkRelease(directory, pointer.id, loc.root) };
}

export async function loadPublishedClient({ repoRoot = DEFAULT_ROOT } = {}) {
  const loc = layout(repoRoot);
  if (!fs.existsSync(loc.pointer)) {
    try { await publishClient({ repoRoot: loc.root, committed: true }); } catch (error) {
      throw new Error(`No published Agora client. Committed bootstrap failed: ${error.message}. `
        + 'The tooling owner must review/test and run node tools/agora/client-release.mjs publish.');
    }
  }
  const release = clientReleaseStatus(loc.root);
  return import(pathToFileURL(path.join(release.directory, 'client-runtime.mjs')).href);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2];
    if (command === 'publish') {
      const release = await publishClient();
      console.log(`Published Agora client ${release.id}\n  ${release.directory}`);
    } else if (command === 'status') {
      const release = clientReleaseStatus();
      console.log(`Agora client ${release.id}\n  source: ${release.manifest.source}\n  checkout: ${release.manifest.repoRoot}`);
    } else {
      console.log('Usage: node tools/agora/client-release.mjs publish|status\nPublish only after the tooling owner reviews and tests the locked implementation.');
      process.exitCode = command ? 1 : 0;
    }
  } catch (error) {
    console.error(`Agora client publication failed: ${error.message}`);
    if (error.stderr) console.error(String(error.stderr));
    process.exitCode = 1;
  }
}
