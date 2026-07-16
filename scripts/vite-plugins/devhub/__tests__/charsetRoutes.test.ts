/**
 * This file proves the Dev Hub charset endpoint reports live scanner findings
 * without touching repository files. A small injected scanner keeps these tests
 * deterministic and verifies both classifications and route behavior.
 *
 * Called by: Vitest during focused Dev Hub route verification
 * Depends on: charsetRoutes.ts for the API contract under test
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildCharsetReviewPayload,
  handleCharsetRoutes,
  setCharsetScannerForTests,
  type CharsetScanResult,
} from '../charsetRoutes';

// ============================================================================
// Fixtures and Request Harness
// ============================================================================
// The fixture represents one deterministic replacement, one mojibake warning,
// and one unknown character so every review bucket is covered.
// ============================================================================

const scan: CharsetScanResult = {
  filesScanned: 12,
  issues: [
    { file: 'docs/a.md', line: 2, column: 4, char: '—', codePoint: 'U+2014', type: 'Em-dash', suggested: '-', lineText: 'A — B', severity: 'soft' },
    { file: 'docs/b.md', line: 7, column: 1, char: 'ƒ', codePoint: 'U+0192', type: 'Mojibake: Latin Small Letter F With Hook', lineText: 'ƒbroken', severity: 'soft' },
    { file: 'public/data/spells/x.json', line: 3, column: 9, char: 'é', codePoint: 'U+00E9', type: 'Non-ASCII Character', lineText: '"café"', severity: 'strict' },
  ],
};

type CapturedResponse = { data: unknown; status: number };

function makeContext(path: string): { ctx: Parameters<typeof handleCharsetRoutes>[0]; response: CapturedResponse } {
  const response: CapturedResponse = { data: undefined, status: 0 };
  return {
    ctx: {
      req: {},
      res: {},
      json: (data: unknown, status = 200) => {
        response.data = data;
        response.status = status;
      },
      parsedUrl: new URL(`http://localhost${path}`),
      urlPath: new URL(`http://localhost${path}`).pathname,
    },
    response,
  };
}

afterEach(() => setCharsetScannerForTests(null));

// ============================================================================
// Review Contract Tests
// ============================================================================
// These checks guard the counts and labels that drive the page's summary cards,
// filters, and G5 policy preview.
// ============================================================================

describe('charset review routes', () => {
  it('classifies safe fixes, suspicious corruption, and owner review separately', () => {
    const payload = buildCharsetReviewPayload(scan, 25);

    expect(payload).toMatchObject({
      filesScanned: 12,
      filesWithIssues: 3,
      totalIssues: 3,
      strictIssues: 1,
      softIssues: 2,
      safeFixes: 1,
      strictSafeFixes: 0,
      softSafeFixes: 1,
      investigate: 1,
      manualReview: 1,
      durationMs: 25,
    });
    expect(payload.issues.map((issue) => issue.action)).toEqual(['safe_fix', 'investigate', 'review']);
  });

  it('serves injected live findings and ignores unrelated routes', async () => {
    setCharsetScannerForTests(() => scan);
    const review = makeContext('/api/charset-review?refresh=1');

    expect(await handleCharsetRoutes(review.ctx)).toBe(true);
    expect(review.response.status).toBe(200);
    expect(review.response.data).toMatchObject({ totalIssues: 3, filesScanned: 12 });

    const unrelated = makeContext('/api/spells');
    expect(await handleCharsetRoutes(unrelated.ctx)).toBe(false);
  });

  it('returns a readable error when the scanner cannot complete', async () => {
    setCharsetScannerForTests(() => {
      throw new Error('fixture scan failed');
    });
    const review = makeContext('/Aralia/api/charset-review?refresh=1');

    expect(await handleCharsetRoutes(review.ctx)).toBe(true);
    expect(review.response.status).toBe(500);
    expect(review.response.data).toEqual({ error: 'Could not scan charset findings: Error: fixture scan failed' });
  });
});
