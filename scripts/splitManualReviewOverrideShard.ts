import fs from 'node:fs';
import path from 'node:path';

/**
 * This script splits a large spell mechanics manual-review override shard into
 * smaller ownership-sized JSON files.
 *
 * Manual review shards are operational project memory: they say which discovered
 * mechanics are open, closed, deferred, or waiting on user judgment. A single
 * large shard becomes hard to review safely during long mechanics-closure work,
 * so this script preserves the exact JSON entries while moving them into
 * smaller files that the existing audit loader already knows how to merge.
 *
 * Called by: agents during between-batch modularization checkpoints.
 * Depends on: Node's filesystem APIs and the audit loader's convention that all
 * `.json` files under `manual-review-overrides/` are merged together.
 */

// ============================================================================
// Input Parsing
// ============================================================================
// The script intentionally accepts only one shard path and one chunk size. This
// keeps the modularization step reviewable and avoids accidental corpus-wide
// rewrites.
// ============================================================================

const [shardPathArg, chunkSizeArg = '60'] = process.argv.slice(2);

if (!shardPathArg) {
  throw new Error('Usage: npx tsx scripts/splitManualReviewOverrideShard.ts <shard.json> [chunk-size]');
}

const shardPath = path.resolve(shardPathArg);
const chunkSize = Number.parseInt(chunkSizeArg, 10);

if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
  throw new Error(`Chunk size must be a positive integer; received ${chunkSizeArg}`);
}

// ============================================================================
// Source Loading
// ============================================================================
// PowerShell-created JSON may contain a UTF-8 BOM. Strip it here for the same
// reason the mechanics audit loader does: encoding markers should not block a
// behavior-preserving split of human review data.
// ============================================================================

const rawJson = fs.readFileSync(shardPath, 'utf8').replace(/^\uFEFF/, '');
const source = JSON.parse(rawJson) as {
  generatedFor?: string;
  notes?: string[];
  findings?: Record<string, unknown>;
  manualFindings?: Record<string, unknown[]>;
};

const findings = source.findings ?? {};
const manualFindings = source.manualFindings ?? {};
const findingEntries = Object.entries(findings);
const manualFindingEntries = Object.entries(manualFindings).flatMap(([spellId, spellFindings]) => {
  if (!Array.isArray(spellFindings)) {
    throw new Error(`manualFindings.${spellId} must be an array in ${shardPath}`);
  }

  // Very large shards are often caused by one spell carrying many discovered
  // mechanics. Flattening those spell arrays lets the output files stay small
  // while the audit loader joins same-spell arrays back together at read time.
  return spellFindings.map((finding) => ({ spellId, finding }));
});

if (findingEntries.length === 0 && manualFindingEntries.length === 0) {
  throw new Error(`Shard has no findings or manualFindings to split: ${shardPath}`);
}

// ============================================================================
// Chunk Writing
// ============================================================================
// Each output file keeps the same top-level shape as the source shard. Ordinary
// finding overrides are chunked by key, while manual spell findings are chunked
// by individual finding so one long spell does not keep a shard oversized.
// ============================================================================

const shardDir = path.dirname(shardPath);
const shardBase = path.basename(shardPath, '.json');
const totalChunks = Math.max(
  Math.ceil(findingEntries.length / chunkSize),
  Math.ceil(manualFindingEntries.length / chunkSize),
);

for (let index = 0; index < totalChunks; index += 1) {
  const start = index * chunkSize;
  const end = start + chunkSize;
  const manualChunkEntries = manualFindingEntries.slice(start, end);
  const chunkManualFindings = manualChunkEntries.reduce<Record<string, unknown[]>>(
    (accumulator, entry) => {
      accumulator[entry.spellId] = [...(accumulator[entry.spellId] ?? []), entry.finding];
      return accumulator;
    },
    {},
  );
  const chunk = {
    generatedFor: source.generatedFor ?? 'spell-mechanics-discovery',
    findings: Object.fromEntries(findingEntries.slice(start, end)),
    manualFindings: chunkManualFindings,
  };
  const outputPath = path.join(shardDir, `${shardBase}-${String(index).padStart(2, '0')}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(chunk, null, 2)}\n`, 'utf8');
}

// ============================================================================
// Source Removal
// ============================================================================
// Removing the original shard is part of the equivalence-preserving split: if it
// stayed in place, the audit loader would merge duplicate keys and future agents
// would have two possible files to edit for the same finding.
// ============================================================================

fs.unlinkSync(shardPath);

console.log(`Split ${shardPath} into ${totalChunks} shard files of up to ${chunkSize} findings each.`);
