/**
 * Give Node's built-in tests one runner and keep them out of the browser suite.
 * Both Vitest configuration and the CI Node lane use this inventory, so adding
 * a tooling test cannot silently omit it or run it under two environments.
 */
import fs from 'node:fs';
import path from 'node:path';

export function nodeTestFiles(root = process.cwd()) {
  const found = [];
  function walk(relative) {
    const directory = path.join(root, relative);
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory() && !['node_modules', '.git', '.agent', 'dist'].includes(entry.name)) walk(file);
      else if (entry.isFile() && /\.test\.(?:c|m)?[jt]s$/.test(entry.name)
        && /(?:from\s*|require\s*\()(['"])node:test\1/.test(fs.readFileSync(path.join(root, file), 'utf8'))) found.push(file);
    }
  }
  walk('scripts');
  walk('tools');
  walk('devtools');
  walk('misc');
  walk('src');
  return found.sort();
}
