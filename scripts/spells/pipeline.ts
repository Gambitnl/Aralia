/**
 * One command prepares or checks spell artifacts without changing authored rules.
 * Manifest, full bundle, and preview subset are derived before any of them writes.
 * Class spell lists retain their existing generator. Browser URLs stay unchanged.
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { deriveSpellArtifacts, publishArtifacts } from './artifacts';
import { deriveRacialSpellSubset } from './generate-racial-spell-subset.mjs';

const root = process.cwd(), checkOnly = process.argv.includes('--check');
try {
  const artifacts = deriveSpellArtifacts(root);
  const subset = await deriveRacialSpellSubset(artifacts.bundle);
  await publishArtifacts(new Map([
    [path.join(root, 'public/data/spells_manifest.json'), artifacts.manifest],
    [path.join(root, 'public/data/spells_bundle.json'), artifacts.bundle],
    [path.join(root, 'src/data/racialSpellSubset.generated.json'), subset],
  ]), checkOnly);
  const result = spawnSync(process.execPath,
    [path.join(root, 'scripts/generate-class-spell-lists.mjs'), ...(checkOnly ? ['--check'] : [])],
    { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('Class spell-list generation/check failed.');
  console.log(`Spell ${checkOnly ? 'check' : 'generation'} passed (${Object.keys(artifacts.bundle).length} spells).`);
} catch (error) { console.error((error as Error).message); process.exitCode = 1; }
