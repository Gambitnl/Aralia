import fs from 'node:fs';
import path from 'node:path';

/**
 * This script splits one spell-template part into two smaller part files.
 *
 * The mechanics-closure workflow edits template shards, not the large aggregate
 * template files. When one shard becomes too large to review safely, this helper
 * performs a behavior-preserving split: it keeps field order unchanged, writes
 * two replacement shards, and removes the original shard only after both
 * replacements have been written.
 *
 * Called by: agents during between-batch modularization checkpoints.
 * Depends on: a template part JSON file with a top-level `fields` array.
 */

// ============================================================================
// Input Handling
// ============================================================================
// The script is intentionally narrow: callers provide the source file, the
// zero-based split index, and two replacement filenames. This avoids guessing
// domain ownership from field names while keeping the resulting diff explicit.
// ============================================================================

const [sourcePathArg, splitIndexArg, firstOutputArg, secondOutputArg] = process.argv.slice(2);

if (!sourcePathArg || !splitIndexArg || !firstOutputArg || !secondOutputArg) {
  console.error('Usage: npx tsx scripts\\splitSpellTemplatePart.ts <source-part.json> <split-index> <first-output.json> <second-output.json>');
  process.exit(1);
}

const sourcePath = path.resolve(process.cwd(), sourcePathArg);
const sourceDir = path.dirname(sourcePath);
const firstOutputPath = path.resolve(sourceDir, firstOutputArg);
const secondOutputPath = path.resolve(sourceDir, secondOutputArg);
const splitIndex = Number.parseInt(splitIndexArg, 10);

if (!Number.isInteger(splitIndex) || splitIndex <= 0) {
  console.error(`Split index must be a positive integer. Received: ${splitIndexArg}`);
  process.exit(1);
}

// ============================================================================
// JSON Shape
// ============================================================================
// Template parts carry metadata plus a field list. We preserve all metadata from
// the original part except `fieldCount` and `fields`, which must reflect each
// new shard after the split.
// ============================================================================

interface TemplatePart {
  templateKind: string;
  part: string;
  fieldCount?: number;
  fields: unknown[];
  [key: string]: unknown;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

// ============================================================================
// Split Operation
// ============================================================================
// Both output files are written before the old file is removed. The final console
// message includes counts so a caller can compare behavior with the aggregate
// template check immediately afterward.
// ============================================================================

const sourcePart = readJson<TemplatePart>(sourcePath);

if (!Array.isArray(sourcePart.fields)) {
  console.error(`Source part has no fields array: ${sourcePath}`);
  process.exit(1);
}

if (splitIndex >= sourcePart.fields.length) {
  console.error(`Split index ${splitIndex} must be smaller than field count ${sourcePart.fields.length}.`);
  process.exit(1);
}

const firstFields = sourcePart.fields.slice(0, splitIndex);
const secondFields = sourcePart.fields.slice(splitIndex);

writeJson(firstOutputPath, {
  ...sourcePart,
  fieldCount: firstFields.length,
  fields: firstFields,
});

writeJson(secondOutputPath, {
  ...sourcePart,
  fieldCount: secondFields.length,
  fields: secondFields,
});

fs.rmSync(sourcePath);

console.log(`[split] ${path.relative(process.cwd(), sourcePath)} -> ${path.basename(firstOutputPath)} (${firstFields.length} fields), ${path.basename(secondOutputPath)} (${secondFields.length} fields)`);
