/** Restore a small source file from an encrypted snapshot and prove its exact bytes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { command } from './nightly-snapshot.mjs';

const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
const snapshot = process.argv[3], expectedHash = process.argv[4];
const source = path.join(config.repoPath, 'scripts/git/nightly-snapshot.mjs');
const backupPath = '/' + source.replace(/\\/g, '/').replace(':', '');
try {
  const contents = command(config.resticPath, ['-r', config.resticRepo, 'dump', snapshot, backupPath], { encoding: null });
  const actualHash = crypto.createHash('sha256').update(contents).digest('hex');
  if (actualHash !== expectedHash?.toLowerCase()) throw new Error('Restored source hash did not match the bytes checked before backup.');
  fs.writeFileSync(path.join(config.stateDir, 'restore-proof.json'), JSON.stringify({
    at: new Date().toISOString(), snapshot, source: backupPath, sha256: actualHash, status: 'success'
  }, null, 2));
  console.log('Restored source bytes match the pre-backup hash.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
