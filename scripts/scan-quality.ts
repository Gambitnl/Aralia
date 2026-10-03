import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(import.meta.dirname, '..', 'src');

interface Finding {
  file: string;
  line: number;
  pattern: string;
  text: string;
}

const PATTERNS: { name: string; regex: RegExp; ignore?: (file: string) => boolean }[] = [
  {
    name: 'STUB',
    regex: /throw new Error\(['"`]not implemented['"`]\)|\/\/\s*STUB|PLACEHOLDER|NOT_IMPLEMENTED/i,
  },
  {
    name: 'ANY_TYPE',
    regex: /:\s*any\b|as\s+any\b/,
    ignore: (file) => file.includes('.test.') || file.includes('__tests__'),
  },
  {
    name: 'CONSOLE_LOG',
    regex: /\bconsole\.(log|debug|info)\b/,
    ignore: (file) => file.includes('logger') || file.includes('scripts/'),
  },
  {
    name: 'TS_IGNORE',
    regex: /@ts-ignore|@ts-nocheck/,
  },
  {
    name: 'EMPTY_CATCH',
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
  },
];

function walkDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      files.push(...walkDir(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function scan(): Finding[] {
  const files = walkDir(SRC);
  const findings: Finding[] = [];

  for (const file of files) {
    const relPath = relative(join(SRC, '..'), file);
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of PATTERNS) {
        if (pattern.ignore?.(relPath)) continue;
        if (pattern.regex.test(lines[i])) {
          findings.push({
            file: relPath,
            line: i + 1,
            pattern: pattern.name,
            text: lines[i].trim().slice(0, 100),
          });
        }
      }
    }
  }

  return findings;
}

// --- Run ---
const findings = scan();

// Group by pattern
const grouped = new Map<string, Finding[]>();
for (const f of findings) {
  const list = grouped.get(f.pattern) || [];
  list.push(f);
  grouped.set(f.pattern, list);
}

// JSON output for API consumption (dev hub dashboard)
if (process.argv.includes('--json')) {
  const result: Record<string, { count: number; items: { file: string; line: number; text: string }[] }> = {};
  for (const [pattern, items] of grouped) {
    result[pattern] = { count: items.length, items: items.map(i => ({ file: i.file, line: i.line, text: i.text })) };
  }
  console.log(JSON.stringify({ total: findings.length, groups: result }));
  process.exit(0);
}

// Report
console.log('\n=== Quality Scan ===\n');

let total = 0;
for (const [pattern, items] of grouped) {
  console.log(`${pattern}: ${items.length}`);
  for (const item of items.slice(0, 5)) {
    console.log(`  ${item.file}:${item.line}  ${item.text}`);
  }
  if (items.length > 5) {
    console.log(`  ... and ${items.length - 5} more`);
  }
  total += items.length;
  console.log();
}

console.log(`Total findings: ${total}`);

// Informational only — pre-push hook handles blocking.
// Run with --strict to exit 1 on stubs.
if (process.argv.includes('--strict')) {
  const stubs = grouped.get('STUB') || [];
  if (stubs.length > 0) {
    console.log(`\n!! ${stubs.length} stub(s) found.`);
    process.exit(1);
  }
}
