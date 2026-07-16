/**
 * This file gives the local Dev Hub a read-only view of Aralia's charset scan.
 *
 * The Character Review page calls this route to see the same findings as
 * `npm run validate:charset`, without parsing terminal output or writing fixes.
 * Results are cached briefly because scanning thousands of files is useful but
 * too expensive to repeat for every filter change in the browser.
 *
 * Called by: devHubApiManager.ts for GET /api/charset-review
 * Depends on: check-non-ascii.ts for the canonical scanner and classifications
 */
import {
  checkFile,
  getCharsetTargetFiles,
  summarizeIssuesByCharacter,
  type Issue,
} from '../../check-non-ascii';
import type { DevHubRouteContext } from './routeContext';

// ============================================================================
// Public Review Contract
// ============================================================================
// These shapes keep the browser page focused on review work: what was found,
// how risky it is, and whether a deterministic replacement already exists.
// ============================================================================

export type CharsetReviewAction = 'safe_fix' | 'investigate' | 'review';

export type CharsetReviewIssue = Issue & {
  id: string;
  file: string;
  action: CharsetReviewAction;
};

export type CharsetScanResult = {
  filesScanned: number;
  issues: Issue[];
};

export type CharsetScanner = () => CharsetScanResult;

type CharsetReviewPayload = {
  generatedAt: string;
  durationMs: number;
  filesScanned: number;
  filesWithIssues: number;
  totalIssues: number;
  strictIssues: number;
  softIssues: number;
  safeFixes: number;
  strictSafeFixes: number;
  softSafeFixes: number;
  investigate: number;
  manualReview: number;
  characterSummary: ReturnType<typeof summarizeIssuesByCharacter>;
  issues: CharsetReviewIssue[];
};

// ============================================================================
// Live Scan and Cache
// ============================================================================
// The scanner is replaceable in tests so route verification never walks the
// real repository. Production always uses the same file list and checkFile
// function as the command-line validator.
// ============================================================================

const CACHE_MS = 60_000;
let scannerOverride: CharsetScanner | null = null;
let cachedPayload: CharsetReviewPayload | null = null;
let cachedAt = 0;

export function setCharsetScannerForTests(scanner: CharsetScanner | null): void {
  scannerOverride = scanner;
  cachedPayload = null;
  cachedAt = 0;
}

function defaultScanner(): CharsetScanResult {
  const files = getCharsetTargetFiles();
  const issues = files.flatMap((file) => checkFile(file));
  return { filesScanned: files.length, issues };
}

function actionForIssue(issue: Issue): CharsetReviewAction {
  // A named replacement is previewable and deterministic. Mojibake without a
  // replacement needs investigation; other unknown characters need a normal
  // owner review rather than an automatic guess.
  if (issue.suggested !== undefined) return 'safe_fix';
  if (issue.type.startsWith('Mojibake:')) return 'investigate';
  return 'review';
}

function stableIssueId(issue: Issue, index: number): string {
  // Include the source position and finding details so browser review decisions
  // survive refreshes while still changing when the underlying finding changes.
  return [issue.file ?? 'unknown', issue.line, issue.column, issue.codePoint, issue.type, index]
    .join('|');
}

export function buildCharsetReviewPayload(scan: CharsetScanResult, durationMs = 0): CharsetReviewPayload {
  const issues = scan.issues.map((issue, index): CharsetReviewIssue => ({
    ...issue,
    id: stableIssueId(issue, index),
    file: (issue.file ?? 'unknown').replace(/\\/g, '/'),
    action: actionForIssue(issue),
  }));

  return {
    generatedAt: new Date().toISOString(),
    durationMs,
    filesScanned: scan.filesScanned,
    filesWithIssues: new Set(issues.map((issue) => issue.file)).size,
    totalIssues: issues.length,
    strictIssues: issues.filter((issue) => issue.severity === 'strict').length,
    softIssues: issues.filter((issue) => issue.severity === 'soft').length,
    safeFixes: issues.filter((issue) => issue.action === 'safe_fix').length,
    strictSafeFixes: issues.filter((issue) => issue.action === 'safe_fix' && issue.severity === 'strict').length,
    softSafeFixes: issues.filter((issue) => issue.action === 'safe_fix' && issue.severity === 'soft').length,
    investigate: issues.filter((issue) => issue.action === 'investigate').length,
    manualReview: issues.filter((issue) => issue.action === 'review').length,
    characterSummary: summarizeIssuesByCharacter(scan.issues),
    issues,
  };
}

function getCharsetReviewPayload(forceRefresh: boolean): CharsetReviewPayload {
  const now = Date.now();

  // A normal page reload reuses the recent scan. The explicit Refresh scan
  // button bypasses this cache after files have changed on disk.
  if (!forceRefresh && cachedPayload && now - cachedAt < CACHE_MS) {
    return cachedPayload;
  }

  const startedAt = Date.now();
  const scan = (scannerOverride ?? defaultScanner)();
  cachedPayload = buildCharsetReviewPayload(scan, Date.now() - startedAt);
  cachedAt = now;
  return cachedPayload;
}

// ============================================================================
// Dev Hub Route
// ============================================================================
// This endpoint is deliberately GET-only. Review decisions stay in the local
// browser and no repository file can be changed from this page.
// ============================================================================

export async function handleCharsetRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  const { json, parsedUrl, urlPath } = ctx;

  if (urlPath !== '/api/charset-review' && urlPath !== '/Aralia/api/charset-review') {
    return false;
  }

  try {
    json(getCharsetReviewPayload(parsedUrl.searchParams.get('refresh') === '1'));
  } catch (error) {
    json({ error: `Could not scan charset findings: ${String(error)}` }, 500);
  }
  return true;
}
