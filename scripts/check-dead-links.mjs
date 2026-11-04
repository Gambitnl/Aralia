/**
 * @file check-dead-links.mjs
 * Validates that all relative markdown links in key documentation files resolve to existing files (GG-126, GG-265).
 */

import fs from 'node:fs';
import path from 'node:path';

const filesToCheck = [
  'public/agent-docs/AGENTS.md',
  'docs/projects/PROJECT_TRACKER.md'
];

let totalDead = 0;
let totalChecked = 0;

for (const filePath of filesToCheck) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);

  // Match markdown links: [text](target)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  const deadLinks = [];
  let fileLinkCount = 0;

  while ((match = linkRegex.exec(content)) !== null) {
    let target = match[2].trim();
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    target = target.split('#')[0].split('?')[0];
    if (!target) continue;

    fileLinkCount++;
    totalChecked++;

    const targetPath = path.isAbsolute(target) ? target : path.resolve(dir, target);
    if (!fs.existsSync(targetPath)) {
      deadLinks.push({ text: match[1], target, resolved: targetPath });
    }
  }

  if (deadLinks.length > 0) {
    console.log(`\n❌ ${filePath} has ${deadLinks.length} dead link(s) (out of ${fileLinkCount} checked):`);
    for (const d of deadLinks) {
      console.log(`  - [${d.text}](${d.target}) -> resolved: ${d.resolved}`);
    }
    totalDead += deadLinks.length;
  } else {
    console.log(`\n✅ ${filePath}: all ${fileLinkCount} relative link(s) resolve to existing files.`);
  }
}

if (totalDead > 0) {
  console.log(`\nFound ${totalDead} total dead link(s).`);
  process.exit(1);
} else {
  console.log(`\nAll ${totalChecked} relative links across checked files are valid!`);
  process.exit(0);
}
