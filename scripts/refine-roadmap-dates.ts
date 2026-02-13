import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const DATES_FILE = '.agent/roadmap/file_dates.json';
const OUTPUT_FILE = '.agent/roadmap/file_dates.json'; // Overwrite with refined data

// Repos to completely ignore
const VENDOR_DIRS = [
  'Claudeception/',
  '.tmp/azgaar-src/',
  'node_modules/',
  'dist/',
  '.uplink/',
  '.jules/'
];

function extractDateFromContent(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Patterns: "Created: 2024-05-20", "Date: 2024-05-20", "## 2024-05-20"
    const match = content.match(/(?:Created|Date):\s*(\d{4}-\d{2}-\d{2})|##\s*(\d{4}-\d{2}-\d{2})/i);
    return match ? (match[1] || match[2]) : null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const existingDates = JSON.parse(fs.readFileSync(DATES_FILE, 'utf-8'));
  const refinedDates: Record<string, string> = {};

  const files = globSync('**/*.md', { posix: true });

  for (const file of files) {
    // 1. Filter out vendors
    if (VENDOR_DIRS.some(dir => file.startsWith(dir))) continue;

    // 2. Check internal metadata first
    const internalDate = extractDateFromContent(file);
    if (internalDate) {
      refinedDates[file] = internalDate;
      continue;
    }

    // 3. Fallback to Git date if it exists
    if (existingDates[file]) {
      refinedDates[file] = existingDates[file];
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(refinedDates, null, 2));
  console.log(`Refined dates for ${Object.keys(refinedDates).length} files (filtered vendors and prioritized internal dates).`);
}

main().catch(console.error);
