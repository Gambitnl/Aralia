#!/usr/bin/env node
/**
 * Builds a content snapshot for the backlog-retirement ledger.
 *
 * The backlog retirement pass needs to know whether a markdown file was walked
 * in its current form or whether it changed after the last review. This script
 * reads the human ledger, hashes every referenced backlog file that still
 * exists, and writes a small JSON snapshot beside the ledger for future agents.
 *
 * Called by: npm run backlog:snapshot
 * Depends on: docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Paths
// ============================================================================
// Keep the paths explicit so this utility stays tied to the retirement ledger
// rather than accidentally becoming a broad documentation crawler.
// ============================================================================

const repoRoot = process.cwd();
const ledgerPath = path.join(repoRoot, 'docs', 'tasks', 'backlog-retirement', 'RETIREMENT_LEDGER.md');
const snapshotPath = path.join(repoRoot, 'docs', 'tasks', 'backlog-retirement', 'WALKED_FILE_SNAPSHOT.json');
const walkedMarkerPattern = /(?:\r?\n)?<!-- aralia-backlog-walked: .*? -->(?:\r?\n)?/g;

// ============================================================================
// Ledger Parsing
// ============================================================================
// The ledger is intentionally human-readable markdown. This parser only extracts
// the first backticked path from table rows and the walk-state cell next to it.
// If the row is a bucket glob or a deleted file, the snapshot records that fact
// instead of pretending there is a file hash.
// ============================================================================

function parseLedgerRows(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith('| `'))
    .map((line) => {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
      const backlogFile = cells[0]?.match(/`([^`]+)`/)?.[1] ?? '';
      return {
        backlogFile,
        walkState: cells[1] ?? '',
      };
    })
    .filter((row) => row.backlogFile.length > 0);
}

// ============================================================================
// File Fingerprints
// ============================================================================
// A hash is only meaningful for an existing concrete file. Missing files are
// usually expected retired packets, while glob rows are bucket reminders.
// The walked marker is ignored so refreshing the marker does not make the
// underlying reviewed content appear stale.
// ============================================================================

function stripWalkedMarker(buffer) {
  return buffer.toString('utf8').replace(walkedMarkerPattern, '\n').replace(/\n{3,}/g, '\n\n');
}

function fingerprint(backlogFile) {
  if (backlogFile.includes('*')) {
    return {
      exists: false,
      kind: 'glob',
      sha256: null,
      bytes: null,
      modifiedUtc: null,
    };
  }

  const absolutePath = path.join(repoRoot, ...backlogFile.split(/[\\/]+/));

  if (!fs.existsSync(absolutePath)) {
    return {
      exists: false,
      kind: 'missing',
      sha256: null,
      bytes: null,
      modifiedUtc: null,
    };
  }

  const stat = fs.statSync(absolutePath);

  if (!stat.isFile()) {
    return {
      exists: true,
      kind: 'not_file',
      sha256: null,
      bytes: stat.size,
      modifiedUtc: stat.mtime.toISOString(),
    };
  }

  const buffer = fs.readFileSync(absolutePath);
  const reviewContent = stripWalkedMarker(buffer);
  const sha256 = crypto.createHash('sha256').update(reviewContent, 'utf8').digest('hex');

  return {
    exists: true,
    kind: 'file',
    sha256,
    bytes: buffer.byteLength,
    modifiedUtc: stat.mtime.toISOString(),
  };
}

// ============================================================================
// Snapshot Writer
// ============================================================================
// The snapshot is committed as durable review evidence. Agents can compare it
// against a later run to see exactly which kept backlog files changed.
// ============================================================================

function main() {
  if (!fs.existsSync(ledgerPath)) {
    throw new Error(`Missing backlog retirement ledger: ${ledgerPath}`);
  }

  const ledger = fs.readFileSync(ledgerPath, 'utf8');
  const rows = parseLedgerRows(ledger);
  const entries = rows.map((row) => ({
    ...row,
    ...fingerprint(row.backlogFile),
  }));

  const summary = entries.reduce(
    (acc, entry) => {
      acc.total += 1;
      acc[entry.kind] = (acc[entry.kind] ?? 0) + 1;
      return acc;
    },
    { total: 0 },
  );

  const snapshot = {
    generatedFor: 'backlog-retirement',
    generatedAtUtc: new Date().toISOString(),
    ledgerPath: path.relative(repoRoot, ledgerPath).replace(/\\/g, '/'),
    summary,
    entries,
  };

  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${path.relative(repoRoot, snapshotPath)} with ${entries.length} ledger entries.`);
}

main();
