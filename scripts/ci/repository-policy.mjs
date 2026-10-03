/**
 * Keep generated compiler state out of commits while allowing dependency locks.
 * npm ci verifies package/lock consistency; a contributor's name or branch is
 * not evidence that a lockfile change is valid or invalid.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function forbiddenFiles(files) {
  return files.filter(file => /\.tsbuildinfo$/.test(file));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const base = event.pull_request?.base.sha || event.before;
  const head = event.pull_request?.head.sha || process.env.GITHUB_SHA;
  const isSha = value => /^[a-f0-9]{40,64}$/.test(value || '') && !/^0+$/.test(value);
  const args = isSha(base) && isSha(head)
    ? ['diff', '--name-only', '--diff-filter=ACMR', '-z', base, head]
    : ['ls-files', '-z'];
  const files = execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean);
  const forbidden = forbiddenFiles(files);
  if (forbidden.length) throw new Error(`Generated compiler state must remain ignored: ${forbidden.join(', ')}`);
  console.log('Repository policy passed; dependency lockfiles are permitted and checked by npm ci.');
}
