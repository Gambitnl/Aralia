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
    } else if (arg === '--keyword-hits') {
      args.mode = 'keyword-hits';
    } else if (arg === '--stale-markers') {
      args.mode = 'stale-markers';
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
  return crypto.createHash('sha256').update(stripMarker(content).trimEnd(), 'utf8').digest('hex');
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
  '.agent_tools',
  '.antigravitycli',
  '.claude',
  '.chrome-gemini-profile',
  '.codex',
  '.cursor',
  '.gemini',
  '.jules',
  '.local',
  '.pi',
  '.playwright-cli',
  '.playwright-mcp',
  '.superpowers',
  '.symphony',
  '.tmp',
  '.understand-anything',
  '.uplink',
  '.vscode',
  '.windsurf',
  '.worktrees',
  'artifacts',
  'node_modules',
  'dist',
  'docs-site-dist',
  'build',
  '.vite',
  '.cache',
  'coverage',
  'devtools',
  'output',
  'playwright-report',
  'test-results',
  'tmp',
  'vendor',
  'verification',
]);

const ignoredRepoPrefixes = [
  // These roots contain local agent state, orchestration control-plane records,
  // backups, external workflow experiments, dependency snapshots, or generated
  // proof. They are not Aralia-facing backlog queues for the default retirement
  // scan, so keeping them out makes "what remains?" answerable instead of noisy.
  '.agent/',
  'conductor/',
  'deprecated/uplink/',
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
  /^AGENTS(?:\.bak)?\.md$/i,
  /^CONTRIBUTING\.md$/i,
  /^README\.md$/i,
  /^AntiGravityCeption\//i,
  /^Claudeception\//i,
  /^docs-site\//i,
  /^docs\/spells\/reference\//i,
  /^docs\/status-effects\//i,
  /^docs\/portraits\/race_profiles\//i,
  /^docs\/agent-workflows\/living-project-task-protocol\/templates\//i,
  /^public\/agent-docs\//i,
  /^skills\//i,
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

const auditKeywordPatterns = [
  { label: 'checkbox', pattern: /\[[ xX]\]/ },
  { label: 'status', pattern: /^Status:\s*(active|pending|not_started|in_progress|blocked|stale|proposed)/im },
  { label: 'todo', pattern: /\bTODO\b/i },
  { label: 'backlog', pattern: /\bbacklog\b/i },
  { label: 'gap', pattern: /\bgap\b/i },
  { label: 'pending', pattern: /\bpending\b/i },
  { label: 'blocked', pattern: /\bblocked\b/i },
  { label: 'stale', pattern: /\bstale\b/i },
  { label: 'next action', pattern: /\bnext action\b/i },
  { label: 'acceptance criteria', pattern: /\bacceptance criteria\b/i },
  { label: 'future improvement', pattern: /\bfuture improvements?\b/i },
  { label: 'not implemented', pattern: /\bnot implemented\b/i },
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
      score -= 8;
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

function reportKeywordHits(root, json, limit, options) {
  const files = walkMarkdownFiles(root);

  // This audit is intentionally broader than the candidate queue. It catches
  // unmarked files that contain backlog-shaped words even when their path is a
  // common reference path such as README.md. Future agents can use it as a
  // false-negative review queue without turning every hit into mandatory work.
  const hits = files
    .map((repoPath) => {
      const content = fs.readFileSync(toAbsolutePath(repoPath), 'utf8');
      if (hasMarker(content)) {
        return null;
      }

      if (!options.includeLivingProjects && (livingProjectPathPattern.test(repoPath) || activeControlPathPattern.test(repoPath))) {
        return null;
      }

      const labels = auditKeywordPatterns
        .filter(({ pattern }) => pattern.test(content))
        .map(({ label }) => label);

      if (labels.length === 0) {
        return null;
      }

      const candidate = scoreBacklogCandidate(repoPath, content, options);
      const lowSignal = lowSignalPathPatterns.some((pattern) => pattern.test(repoPath));

      return {
        path: repoPath,
        score: candidate?.score ?? 0,
        lowSignal,
        labels,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.lowSignal) - Number(b.lowSignal) || b.score - a.score || a.path.localeCompare(b.path));

  const limited = Number.isFinite(limit) && limit > 0 ? hits.slice(0, limit) : hits;

  if (json) {
    console.log(JSON.stringify({ root, keywordHitCount: hits.length, limit, includeLivingProjects: options.includeLivingProjects, files: limited }, null, 2));
    return;
  }

  console.log(`Unmarked markdown files with backlog-like keywords: ${hits.length}`);
  for (const hit of limited) {
    const marker = hit.lowSignal ? 'low-signal' : 'review';
    console.log(`${hit.score.toString().padStart(2, ' ')}  ${marker.padEnd(10)}  ${hit.path}  [${hit.labels.join(', ')}]`);
  }
}

function reportStaleMarkers(root, json, limit) {
  const files = walkMarkdownFiles(root);

  // A marker is stale when the file still says it was walked, but the reviewed
  // content hash no longer matches the hash stored in the marker. Those files
  // should be re-walked before we trust their ledger disposition.
  const stale = files
    .map((repoPath) => {
      const content = fs.readFileSync(toAbsolutePath(repoPath), 'utf8');
      const marker = readExistingMarker(content);
      if (!marker) {
        return null;
      }

      const currentHash = hashReviewContent(content);
      if (marker.sha256WithoutMarker === currentHash) {
        return null;
      }

      return {
        path: repoPath,
        markerHash: marker.sha256WithoutMarker ?? null,
        currentHash,
        markedAtUtc: marker.markedAtUtc ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.path.localeCompare(b.path));

  const limited = Number.isFinite(limit) && limit > 0 ? stale.slice(0, limit) : stale;

  if (json) {
    console.log(JSON.stringify({ root, staleMarkerCount: stale.length, limit, files: limited }, null, 2));
    return;
  }

  console.log(`Markdown files with stale backlog walked markers: ${stale.length}`);
  for (const entry of limited) {
    console.log(entry.path);
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

  if (args.mode === 'keyword-hits') {
    reportKeywordHits(args.root, args.json, args.limit, { includeLivingProjects: args.includeLivingProjects });
    return;
  }

  if (args.mode === 'stale-markers') {
    reportStaleMarkers(args.root, args.json, args.limit);
    return;
  }

  reportMissingMarkers(args.root, args.json);
}

main();
