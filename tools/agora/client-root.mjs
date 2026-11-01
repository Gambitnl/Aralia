// A published client lives in ignored runtime storage, not beside the source.
// Keep its identity, advisory file checks and registry reads in the real checkout.
// The publisher creates and hashes the origin file; ordinary source imports
// retain the existing module-relative root used by developer tests.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const origin = new URL('./client-origin.json', import.meta.url);
export const CLIENT_REPO_ROOT = fs.existsSync(origin)
  ? path.resolve(JSON.parse(fs.readFileSync(origin, 'utf8')).repoRoot)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
