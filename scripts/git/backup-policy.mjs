/** Keep recovery storage within a declared budget without deleting protected history. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function directoryBytes(directory) {
  if (!fs.existsSync(directory)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) total += directoryBytes(file);
    else if (entry.isFile()) total += fs.statSync(file).size;
  }
  return total;
}
export function storageReasons({ bytes, freeBytes, maxBytes, minFreeBytes }) {
  const reasons = [];
  if (!(maxBytes > 0) || !(minFreeBytes > 0)) reasons.push('Storage limits must be positive.');
  if (bytes >= maxBytes) reasons.push('Recovery storage reached its budget; no further growth is allowed.');
  if (freeBytes < minFreeBytes) reasons.push('The recovery drive is below its free-space reserve.');
  return reasons;
}
export function storageStatus(config) {
  const stats = fs.statfsSync(path.dirname(config.resticRepo));
  const result = { bytes: directoryBytes(config.resticRepo) + directoryBytes(config.privateGitDir),
    freeBytes: stats.bavail * stats.bsize, maxBytes: config.backupMaxBytes,
    minFreeBytes: config.backupMinFreeBytes };
  return { ...result, reasons: storageReasons(result) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
    const status = storageStatus(config);
    console.log(JSON.stringify(status));
    if (status.reasons.length) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
