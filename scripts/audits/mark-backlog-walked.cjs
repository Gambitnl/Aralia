#!/usr/bin/env node
/**
 * Marks and audits markdown files that have been walked by the backlog-retirement pass.
 *
 * The human ledger remains the source of truth for classifications and evidence. This
 * utility adds a small HTML comment to each concrete ledger-proven markdown file so
 * future agents can ask a simpler question: "which markdown files still do not carry
 * the walked marker?" It also computes hashes with the marker removed, so adding or
 * refreshing the marker does not make every file look changed again.
 *
 * Called by: npm run backlog:mark-walked and npm run backlog:missing-markers
 * Depends on: docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Paths And Marker Format
// ============================================================================
// The marker is an HTML comment because markdown renderers ignore it while humans
// and scripts can still see it in the source file. The JSON payload keeps the
// marker machine-readable without adding frontmatter to files that do not use it.
// ============================================================================

const repoRoot = process.cwd();
const ledgerPath = path.join(repoRoot, 'docs', 'tasks', 'backlog-retirement', 'RETIREMENT_LEDGER.md');
const markerPrefix = '<!-- aralia-backlog-walked:';
const markerPattern = /(?:\r?\n)?<!-- aralia-backlog-walked: .*? -->(?:\r?\n)?/g;
const markerPayloadPattern = /<!-- aralia-backlog-walked: (.*?) -->/;

// ============================================================================
// Small CLI Parser
// ============================================================================
// This script is intentionally dependency-free because it runs during maintenance
// passes where package install state should not matter.
// ============================================================================

function parseArgs(argv) {
  const args = {
    mode: 'missing',
    root: '.',
    write: false,
    json: false,
    limit: 100,
    includeLivingProjects: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mark-ledger') {
      args.mode = 'mark-ledger';
    } else if (arg === '--missing') {
      args.mode = 'missing';
    } else if (arg === '--candidates') {
      args.mode = 'candidates';
    } else if (arg === '--write') {
      args.write = true;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--root') {
      args.root = argv[index + 1] ?? args.root;
      index += 1;
    } else if (arg === '--limit') {
      args.limit = Number.parseInt(argv[index + 1] ?? `${args.limit}`, 10);
      index += 1;
    } else if (arg === '--include-living-projects') {
      args.includeLivingProjects = true;
    }
  }

  return args;
}

// ============================================================================
// Ledger Parsing
// ============================================================================
// The ledger is a markdown table. We only trust rows whose first cell is an exact
// file path and whose state starts with "walked"; bucket rows and deleted files
// remain ledger-only evidence.
// ============================================================================

function parseLedgerRows() {
  const ledger = fs.readFileSync(ledgerPath, 'utf8');
  return ledger
    .split(/\r?\n/)
    .filter((line) => line.startsWith('| `'))
    .map((line) => {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
      return {
        backlogFile: cells[0]?.match(/`([^`]+)`/)?.[1] ?? '',
        walkState: cells[1] ?? '',
      };
    })
    .filter((row) => row.backlogFile.length > 0 && row.walkState.startsWith('walked'));
}

// ============================================================================
// File Helpers
// ============================================================================
// Hashing ignores any existing walked marker. That gives future agents a stable
// way to compare the reviewed content instead of comparing the bookkeeping line.
// ============================================================================

function toRepoPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
}

function toAbsolutePath(repoPath) {
  return path.join(repoRoot, ...repoPath.split(/[\\/]+/));
}

function stripMarker(content) {
  return content.replace(markerPattern, '\n').replace(/\n{3,}/g, '\n\n');
}

function hashReviewContent(content) {
  return crypto.createHash('sha256').update(stripMarker(content), 'utf8').digest('hex');
}

function hasMarker(content) {
  return content.includes(markerPrefix);
}

function buildMarker(repoPath, content) {
  const payload = {
    source: 'docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md',
    path: repoPath,
    sha256WithoutMarker: hashReviewContent(content),
    markedAtUtc: new Date().toISOString(),
  };
  return `${markerPrefix} ${JSON.stringify(payload)} -->`;
}

function readExistingMarker(content) {
  const payloadText = content.match(markerPayloadPattern)?.[1];

  if (!payloadText) {
    return null;
  }

  try {
    return JSON.parse(payloadText);
  } catch {
    return null;
  }
}

function addOrRefreshMarker(repoPath) {
  const absolutePath = toAbsolutePath(repoPath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const contentWithoutMarker = stripMarker(content).trimEnd();
  const currentHash = hashReviewContent(contentWithoutMarker);
  const existingMarker = readExistingMarker(content);

  if (existingMarker?.sha256WithoutMarker === currentHash) {
    return {
      path: repoPath,
      changed: false,
      sha256WithoutMarker: currentHash,
    };
  }

  const marker = buildMarker(repoPath, contentWithoutMarker);
  const nextContent = `${contentWithoutMarker}\n\n${marker}\n`;
  const changed = nextContent !== content;

  if (changed) {
    fs.writeFileSync(absolutePath, nextContent);
  }

  return {
    path: repoPath,
    changed,
    sha256WithoutMarker: hashReviewContent(nextContent),
  };
}

// ============================================================================
// Markdown Discovery
// ============================================================================
// The default scan covers the repository but skips generated/runtime folders.
// Callers can narrow the scan with --root when they only want docs/tasks.
// ============================================================================

const ignoredDirectoryNames = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.vite',
  '.cache',
  'coverage',
]);

const ignoredRepoPrefixes = [
  '.agent/scratch/',
  '.agent/roadmap-local/tooling_state',
];

function shouldSkipDirectory(absolutePath) {
  const name = path.basename(absolutePath);
  const repoPath = toRepoPath(absolutePath);
  return ignoredDirectoryNames.has(name) || ignoredRepoPrefixes.some((prefix) => repoPath.startsWith(prefix));
}

function walkMarkdownFiles(root) {
  const absoluteRoot = path.resolve(repoRoot, root);
  const files = [];

  function visit(currentPath) {
    if (shouldSkipDirectory(currentPath)) {
      return;
    }

    const stat = fs.statSync(currentPath);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(currentPath)) {
        visit(path.join(currentPath, child));
      }
      return;
    }

    if (stat.isFile() && currentPath.endsWith('.md')) {
      files.push(toRepoPath(currentPath));
    }
  }

  visit(absoluteRoot);
  return files.sort();
}

// ============================================================================
// Commands
// ============================================================================
// mark-ledger stamps every existing concrete markdown file represented by a
// walked ledger row. missing reports the markdown files that do not yet have a
// marker, which is the review queue the user asked for.
// ============================================================================

const candidatePathPatterns = [
  /(^|\/)(backlog|gaps?|tracker|roadmap|plan|plans|todo|task|tasks|handoff|audit|report|workflow|improvements?|archive)(\/|$)/i,
  /(^|\/)[^/]*(backlog|gaps?|tracker|roadmap|plan|todo|handoff|audit|report|workflow|implementation|migration|refactor|review)[^/]*\.md$/i,
];

const lowSignalPathPatterns = [
  /^docs\/spells\/reference\//i,
  /^docs\/status-effects\//i,
  /^docs\/portraits\/race_profiles\//i,
  /^docs\/agent-workflows\/living-project-task-protocol\/templates\//i,
];

const livingProjectPathPattern = /^docs\/projects\/.*\/(?:AUDIT_OR_PROOF|COLD_START_AGENT_PROMPT|DECISIONS|GAPS|NORTH_STAR|RUNBOOK|TRACKER|SUBPROJECTS)\.md$/i;
const activeControlPathPattern = /^(docs\/projects\/(?:GLOBAL_GAPS|GAPS_SCHEMA_FIT_REPORT|PROJECT_CARD_SCHEMA|PROJECT_SCHEMA_MIGRATION_NOTES|PROJECT_TRACKER|PROJECT_WORKFLOW_DOC_MIGRATION_NOTES)\.md|docs\/agent-workflows\/living-project-task-protocol\/(?:README|ITERATION_AGENT_WORKFLOW|PARENT_PROJECT_WITH_SUBPROJECTS|WORKFLOW_GAPS)\.md|docs\/agent-workflows\/living-project-task-protocol\/templates\/(?:AUDIT_OR_PROOF|COLD_START_AGENT_PROMPT|DECISIONS|GAPS|GLOBAL_GAPS|LIVING_TRACKER|NORTH_STAR|RUNBOOK|TASK_SLICE)\.md|docs\/spells\/(?:GAPS|TRACKER|NORTH_STAR)\.md)$/i;

const candidateContentPatterns = [
  { pattern: /^Status:\s*(active|pending|not_started|in_progress|blocked|stale|proposed)/im, weight: 4 },
  { pattern: /Archive status:|Last reviewed:/i, weight: 3 },
  { pattern: /\[[ xX]\]/, weight: 3 },
  { pattern: /\b(TODO|backlog|gap|pending|not_started|stale|blocked|superseded|implementation plan|next action|acceptance criteria)\b/i, weight: 2 },
  { pattern: /\|\s*(Gap ID|Status|Next action|Owner|Evidence|Task)\s*\|/i, weight: 3 },
];

function scoreBacklogCandidate(repoPath, content, options = {}) {
  if (!options.includeLivingProjects && (livingProjectPathPattern.test(repoPath) || activeControlPathPattern.test(repoPath))) {
    return null;
  }

  let score = 0;
  const reasons = [];

  for (const pattern of candidatePathPatterns) {
    if (pattern.test(repoPath)) {
      score += 3;
      reasons.push('path');
      break;
    }
  }

  for (const pattern of lowSignalPathPatterns) {
    if (pattern.test(repoPath)) {
      score -= 4;
      reasons.push('low-signal-path');
      break;
    }
  }

  for (const { pattern, weight } of candidateContentPatterns) {
    if (pattern.test(content)) {
      score += weight;
      reasons.push(pattern.source.replace(/\\b|\\s\*|\\|/g, '').slice(0, 36));
    }
  }

  return { path: repoPath, score, reasons };
}

function markLedgerRows() {
  const rows = parseLedgerRows();
  const concreteFiles = rows
    .map((row) => row.backlogFile.replace(/\\/g, '/'))
    .filter((repoPath) => !repoPath.includes('*'))
    .filter((repoPath) => fs.existsSync(toAbsolutePath(repoPath)))
    .filter((repoPath) => fs.statSync(toAbsolutePath(repoPath)).isFile())
    .filter((repoPath) => repoPath.endsWith('.md'));

  const seen = new Set();
  const uniqueFiles = concreteFiles.filter((repoPath) => {
    if (seen.has(repoPath)) {
      return false;
    }
    seen.add(repoPath);
    return true;
  });

  const results = uniqueFiles.map(addOrRefreshMarker);
  const changed = results.filter((result) => result.changed);
  console.log(`Marked ${changed.length} of ${results.length} ledger-walked markdown files.`);
}

function reportMissingMarkers(root, json) {
  const files = walkMarkdownFiles(root);
  const missing = files.filter((repoPath) => !hasMarker(fs.readFileSync(toAbsolutePath(repoPath), 'utf8')));

  if (json) {
    console.log(JSON.stringify({ root, totalMarkdown: files.length, missing: missing.length, files: missing }, null, 2));
    return;
  }

  console.log(`Markdown files scanned: ${files.length}`);
  console.log(`Missing backlog walked marker: ${missing.length}`);
  for (const repoPath of missing) {
    console.log(repoPath);
  }
}

function reportBacklogCandidates(root, json, limit, options) {
  const files = walkMarkdownFiles(root);
  const candidates = files
    .map((repoPath) => {
      const content = fs.readFileSync(toAbsolutePath(repoPath), 'utf8');
      if (hasMarker(content)) {
        return null;
      }
      return scoreBacklogCandidate(repoPath, content, options);
    })
    .filter(Boolean)
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const limited = Number.isFinite(limit) && limit > 0 ? candidates.slice(0, limit) : candidates;

  if (json) {
    console.log(JSON.stringify({ root, candidateCount: candidates.length, limit, includeLivingProjects: options.includeLivingProjects, files: limited }, null, 2));
    return;
  }

  console.log(`Likely unwalked backlog candidates: ${candidates.length}`);
  for (const candidate of limited) {
    console.log(`${candidate.score.toString().padStart(2, ' ')}  ${candidate.path}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === 'mark-ledger') {
    markLedgerRows();
    return;
  }

  if (args.mode === 'candidates') {
    reportBacklogCandidates(args.root, args.json, args.limit, { includeLivingProjects: args.includeLivingProjects });
    return;
  }

  reportMissingMarkers(args.root, args.json);
}

main();
