/** The source boundary, not a green game test, makes native replay reproducible. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { captureSourceCut, completeSourceCut, reviseSourceCut, verifySourceCut, isLiveApplicationImport, serveSourceCut } from './sourceCut.mjs';

async function fixture() {
  // Disposable fixtures must not compete with earned browser saves on the
  // repository volume. Each still has its own ignored source-cut boundary.
  const parent = path.join(os.tmpdir(), 'aralia-source-cut-tests');
  await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, 'source-cut-test-'));
  await fs.mkdir(path.join(root, 'src'));
  await fs.mkdir(path.join(root, 'public/data'), { recursive: true });
  for (const [file, text] of Object.entries({ 'src/main.ts': 'export const world = 1;',
    'public/data/source.json': '{"creature":"Ghoul","hp":22}', 'index.html': '<script type="module" src="/index.tsx"></script>',
    'index.tsx': 'import "./src/main";', 'postcss.config.js': 'export default {};', 'tailwind.config.js': 'export default {};',
    'package.json': '{"name":"source-cut-fixture"}', 'vite.config.ts': 'export default {};',
    '.env': 'MUST_NOT_BE_COPIED=private' })) await fs.writeFile(path.join(root, file), text);
  return { root, cut: path.join(root, '.agent/scratch/cut') };
}

test('the copy stays fixed when live rules and public source data change', async () => {
  const { root, cut } = await fixture();
  const manifest = await captureSourceCut({ projectRoot: root, output: cut });
  await fs.writeFile(path.join(root, 'src/main.ts'), 'export const world = 2;');
  await fs.writeFile(path.join(root, 'public/data/source.json'), '{"creature":"Bandit","hp":11}');
  await verifySourceCut(cut);
  assert.equal(await fs.readFile(path.join(cut, 'src/main.ts'), 'utf8'), 'export const world = 1;');
  assert.equal(JSON.parse(await fs.readFile(path.join(cut, 'public/data/source.json'), 'utf8')).hp, 22);
  assert.equal(manifest.files.some(file => file.path === '.env'), false);
  await assert.rejects(fs.access(path.join(cut, '.env')));
});

test('a prior cut cannot be overwritten', async () => {
  const { root, cut } = await fixture();
  await captureSourceCut({ projectRoot: root, output: cut });
  await assert.rejects(captureSourceCut({ projectRoot: root, output: cut }), { code: 'EEXIST' });
  await verifySourceCut(cut);
});

test('changed or missing copied mechanics fail verification', async () => {
  const { root, cut } = await fixture();
  await captureSourceCut({ projectRoot: root, output: cut });
  await fs.writeFile(path.join(cut, 'src/main.ts'), 'export const world = 99;');
  await assert.rejects(verifySourceCut(cut), /Source bytes changed/);
});

test('an added module cannot silently join a captured world', async () => {
  const { root, cut } = await fixture();
  await captureSourceCut({ projectRoot: root, output: cut });
  await fs.writeFile(path.join(cut, 'src/extra.ts'), 'export const surprise = true;');
  await assert.rejects(verifySourceCut(cut), /inventory changed/);
});

test('destination must be a new directory below ignored project scratch', async () => {
  const { root } = await fixture();
  await assert.rejects(captureSourceCut({ projectRoot: root, output: path.join(root, 'src/replacement') }), /ignored scratch/);
});

test('missing root bootstrap is rejected before a cut can be published', async () => {
  const { root, cut } = await fixture();
  await fs.unlink(path.join(root, 'index.tsx'));
  await assert.rejects(captureSourceCut({ projectRoot: root, output: cut }), { code: 'ENOENT' });
  await assert.rejects(fs.access(cut));
});

test('the serving guard rejects live application paths but permits the isolated copy and dependencies', () => {
  const root = path.resolve('fixture-repo');
  assert.equal(isLiveApplicationImport(path.join(root, 'src/world.ts') + '?worker_file&type=module', root), true);
  assert.equal(isLiveApplicationImport(path.join(root, 'public/data/ghoul.json'), root), true);
  assert.equal(isLiveApplicationImport(path.join(root, 'index.tsx'), root), true);
  assert.equal(isLiveApplicationImport(path.join(root, 'vendor/ez-tree/index.js'), root), true);
  assert.equal(isLiveApplicationImport(path.join(root, '.agent/scratch/cut/src/world.ts'), root), false);
  assert.equal(isLiveApplicationImport(path.join(root, 'node_modules/vite/index.js'), root), false);
});

test('dependency completion preserves the captured world even after live world source changes', async () => {
  const { root, cut } = await fixture();
  await captureSourceCut({ projectRoot: root, output: cut });
  const originalManifest = await fs.readFile(path.join(cut, 'source-cut.json'), 'utf8');
  await fs.writeFile(path.join(root, 'src/main.ts'), 'export const world = 999;');
  await fs.mkdir(path.join(root, 'vendor/tree'), { recursive: true });
  await fs.writeFile(path.join(root, 'vendor/tree/index.js'), 'export const branches = 4;');
  const completed = path.join(root, '.agent/scratch/complete');
  await completeSourceCut({ projectRoot: root, base: cut, output: completed, additions: ['vendor/tree'] });
  await verifySourceCut(completed);
  assert.equal(await fs.readFile(path.join(completed, 'src/main.ts'), 'utf8'), 'export const world = 1;');
  assert.equal(await fs.readFile(path.join(completed, 'vendor/tree/index.js'), 'utf8'), 'export const branches = 4;');
  assert.equal(await fs.readFile(path.join(cut, 'source-cut.json'), 'utf8'), originalManifest);
});

test('dependency completion cannot overwrite an existing captured application file', async () => {
  const { root, cut } = await fixture();
  await captureSourceCut({ projectRoot: root, output: cut });
  await assert.rejects(completeSourceCut({ projectRoot: root, base: cut,
    output: path.join(root, '.agent/scratch/refused'), additions: ['src'] }), /cannot replace/);
  await verifySourceCut(cut);
});

test('explicit environment revision preserves frozen game bytes despite live world changes', async () => {
  const { root, cut } = await fixture();
  await captureSourceCut({ projectRoot: root, output: cut });
  await fs.writeFile(path.join(root, 'src/main.ts'), 'export const world = 999;');
  await fs.writeFile(path.join(root, 'vite.config.ts'), 'export default { worker: { format: "es" } };');
  const output = path.join(root, '.agent/scratch/revised-environment');
  const manifest = await reviseSourceCut({ projectRoot: root, base: cut, output, replacements: ['vite.config.ts'] });
  assert.deepEqual(manifest.replacements, ['vite.config.ts']);
  assert.equal(await fs.readFile(path.join(output, 'src/main.ts'), 'utf8'), 'export const world = 1;');
  assert.equal(await fs.readFile(path.join(output, 'vite.config.ts'), 'utf8'), 'export default { worker: { format: "es" } };');
  await verifySourceCut(output);
  await verifySourceCut(cut);
});

test('environment revision cannot capture secrets or arbitrary root files', async () => {
  const { root, cut } = await fixture();
  await captureSourceCut({ projectRoot: root, output: cut });
  for (const file of ['.env', 'tsconfig.json']) {
    await assert.rejects(reviseSourceCut({ projectRoot: root, base: cut,
      output: path.join(root, '.agent/scratch/refused-environment'), replacements: [file] }), /Only application source/);
  }
});

// Asset sharing saves disk space without coupling mutable application source.
// A later alteration to the shared immutable asset must invalidate the cut.
test('shared public assets retain independent application bytes and detect corruption', async () => {
  const { root, cut } = await fixture();
  await captureSourceCut({ projectRoot: root, output: cut });
  await fs.writeFile(path.join(root, 'src/main.ts'), 'export const world = 2;');
  const output = path.join(root, '.agent/scratch/shared-public');
  await reviseSourceCut({ projectRoot: root, base: cut, output, replacements: ['src/main.ts'], reusePublic: true });
  assert.equal(await fs.realpath(path.join(output, 'public')), await fs.realpath(path.join(cut, 'public')));
  assert.notEqual((await fs.stat(path.join(output, 'src/main.ts'))).ino, (await fs.stat(path.join(cut, 'src/main.ts'))).ino);
  assert.equal(await fs.readFile(path.join(output, 'src/main.ts'), 'utf8'), 'export const world = 2;');
  assert.equal(await fs.readFile(path.join(cut, 'src/main.ts'), 'utf8'), 'export const world = 1;');
  await verifySourceCut(output);
  await fs.writeFile(path.join(cut, 'public/data/source.json'), 'unexpected asset change');
  await assert.rejects(verifySourceCut(output), /Source bytes changed/);
});

test('shared mode refuses asset revisions and mismatched public targets', async () => {
  const { root, cut } = await fixture();
  await captureSourceCut({ projectRoot: root, output: cut });
  const output = path.join(root, '.agent/scratch/shared-public');
  await assert.rejects(reviseSourceCut({ projectRoot: root, base: cut, output,
    replacements: ['public/data/source.json'], reusePublic: true }), /cannot be revised/);
  const manifest = await reviseSourceCut({ projectRoot: root, base: cut, output,
    replacements: ['src/main.ts'], reusePublic: true });
  manifest.publicSource = path.join(root, 'public');
  await fs.writeFile(path.join(output, 'source-cut.json'), JSON.stringify(manifest));
  await assert.rejects(verifySourceCut(output), /does not match/);
});

test('explicit ignored overlay preserves the frozen world and ignores newer live edits', async () => {
  const {root, cut} = await fixture();
  await captureSourceCut({projectRoot:root, output:cut});
  await fs.writeFile(path.join(root,'src/main.ts'),'export const world = 999;');
  const overlay=path.join(root,'.agent/scratch/reviewed-overlay');
  await fs.mkdir(path.join(overlay,'src'),{recursive:true});
  await fs.writeFile(path.join(overlay,'src/water.ts'),'export const sharedBed = true;');
  const output=path.join(root,'.agent/scratch/revised-overlay');
  const manifest=await reviseSourceCut({projectRoot:root,base:cut,output,replacementRoot:overlay,replacements:['src/water.ts']});
  assert.equal(manifest.replacementSourceRoot,await fs.realpath(overlay));
  assert.equal(await fs.readFile(path.join(output,'src/main.ts'),'utf8'),'export const world = 1;');
  assert.equal(await fs.readFile(path.join(output,'src/water.ts'),'utf8'),'export const sharedBed = true;');
  await verifySourceCut(output);await verifySourceCut(cut);
});

test('overlay cannot escape ignored project scratch or substitute a source link', async () => {
  const {root,cut}=await fixture();await captureSourceCut({projectRoot:root,output:cut});
  await assert.rejects(reviseSourceCut({projectRoot:root,base:cut,output:path.join(root,'.agent/scratch/refused'),
    replacementRoot:path.join(root,'src'),replacements:['src/main.ts']}),/ignored scratch/);
  const overlay=path.join(root,'.agent/scratch/linked-overlay');await fs.mkdir(overlay,{recursive:true});
  await fs.symlink(path.join(root,'src'),path.join(overlay,'src'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(reviseSourceCut({projectRoot:root,base:cut,output:path.join(root,'.agent/scratch/refused-link'),
    replacementRoot:overlay,replacements:['src/main.ts']}),/escapes its source root/);
});

// Moving ignored storage must preserve old recorded identities and all normal
// source-cut operations. The fixture moves outside the checkout and leaves the
// same kind of directory junction used by the workstation offload.
test('relocated scratch preserves legacy shared cuts and admits new owned cuts', async () => {
  const {root,cut}=await fixture();
  await captureSourceCut({projectRoot:root,output:cut});
  const scratch=path.join(root,'.agent/scratch'),shared=path.join(scratch,'shared');
  await reviseSourceCut({projectRoot:root,base:cut,output:shared,replacements:['src/main.ts'],reusePublic:true});
  const oldManifest=await fs.readFile(path.join(shared,'source-cut.json'),'utf8');
  const offload=await fs.mkdtemp(path.join(os.tmpdir(),'aralia-scratch-offload-test-'));
  const physical=path.join(offload,'scratch');
  await fs.rename(scratch,physical);
  await fs.symlink(physical,scratch,process.platform==='win32'?'junction':'dir');
  await verifySourceCut(cut);await verifySourceCut(shared);
  assert.equal(await fs.readFile(path.join(shared,'source-cut.json'),'utf8'),oldManifest);
  const fresh=path.join(scratch,'new-parent/fresh');
  await captureSourceCut({projectRoot:root,output:fresh});await verifySourceCut(fresh);
  await fs.mkdir(path.join(root,'vendor/offload'),{recursive:true});
  await fs.writeFile(path.join(root,'vendor/offload/index.js'),'export const retained = true;');
  const completed=path.join(scratch,'completed');
  await completeSourceCut({projectRoot:root,base:cut,output:completed,additions:['vendor/offload']});
  await verifySourceCut(completed);
  const overlay=path.join(scratch,'reviewed');await fs.mkdir(path.join(overlay,'src'),{recursive:true});
  await fs.writeFile(path.join(overlay,'src/reviewed.ts'),'export const owned = true;');
  const revised=path.join(scratch,'revised');
  await reviseSourceCut({projectRoot:root,base:shared,output:revised,replacementRoot:overlay,replacements:['src/reviewed.ts'],reusePublic:true});
  await verifySourceCut(revised);
  assert.equal(await fs.readFile(path.join(revised,'src/main.ts'),'utf8'),'export const world = 1;');
});

test('an offloaded scratch child cannot redirect new outputs or overlays outside its boundary', async () => {
  const {root,cut}=await fixture();await captureSourceCut({projectRoot:root,output:cut});
  const scratch=path.join(root,'.agent/scratch');
  const offload=await fs.mkdtemp(path.join(os.tmpdir(),'aralia-scratch-offload-test-'));
  const physical=path.join(offload,'scratch');await fs.rename(scratch,physical);
  await fs.symlink(physical,scratch,process.platform==='win32'?'junction':'dir');
  const escaped=path.join(scratch,'escape');
  await fs.symlink(path.join(root,'src'),escaped,process.platform==='win32'?'junction':'dir');
  await assert.rejects(captureSourceCut({projectRoot:root,output:path.join(escaped,'new-cut')}),/ignored scratch/);
  await assert.rejects(completeSourceCut({projectRoot:root,base:cut,output:path.join(escaped,'completed'),additions:[]}),/ignored scratch/);
  await assert.rejects(reviseSourceCut({projectRoot:root,base:cut,output:path.join(scratch,'refused'),replacementRoot:escaped,replacements:['src/main.ts']}),/ignored scratch/);
  await verifySourceCut(cut);
});

test('the server reads relocated shared assets without opening unrelated offload files', async () => {
  const {root,cut}=await fixture();await captureSourceCut({projectRoot:root,output:cut});
  const scratch=path.join(root,'.agent/scratch'),shared=path.join(scratch,'shared');
  await reviseSourceCut({projectRoot:root,base:cut,output:shared,replacements:['src/main.ts'],reusePublic:true});
  const offload=await fs.mkdtemp(path.join(os.tmpdir(),'aralia-scratch-offload-test-'));
  const physical=path.join(offload,'scratch');await fs.rename(scratch,physical);
  await fs.symlink(physical,scratch,process.platform==='win32'?'junction':'dir');
  const secret=path.join(offload,'unrelated.txt');await fs.writeFile(secret,'must stay outside serving boundary');
  const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'localhost',resolve));
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const previous=process.cwd();let server;
  try {
    server=await serveSourceCut(shared,port);
    const publicPath=await fs.realpath(path.join(cut,'public/data/source.json'));
    const asset=await fetch(`http://localhost:${port}/@fs/${publicPath.replaceAll('\\','/')}?import`);
    assert.equal(asset.status,200);assert.match(await asset.text(),/Ghoul/);
    const refused=await fetch(`http://localhost:${port}/@fs/${secret.replaceAll('\\','/')}`);
    assert.equal(refused.status,403);
  } finally {
    if(server)await server.close();process.chdir(previous);
  }
});
