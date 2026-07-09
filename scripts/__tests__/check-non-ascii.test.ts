import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { afterEach, describe, expect, it } from 'vitest';

import {
    buildCharsetReviewReport,
    checkFile,
    groupCharacterSummaryByAction,
    summarizeIssuesByCharacter,
} from '../check-non-ascii';

/**
 * These tests protect the text-encoding scanner that keeps corrupted spell and
 * glossary data out of the game.
 *
 * The scanner normally walks the full repository from package scripts. Tests use
 * temporary JSON files instead so they can prove specific character cases without
 * rewriting real spell data.
 *
 * Called by: Vitest
 * Depends on: check-non-ascii.ts for the actual scanner behavior
 */

const TEMP_FILES: string[] = [];

// ============================================================================
// Temporary File Helpers
// ============================================================================
// This section creates throwaway JSON files because the scanner reads from disk.
// Each test gets a real file path, but the cleanup below removes it afterward.
// ============================================================================

function writeTempJson(content: string): string {
    const filePath = path.join(os.tmpdir(), `aralia-charset-${randomUUID()}.json`);
    fs.writeFileSync(filePath, content, 'utf-8');
    TEMP_FILES.push(filePath);
    return filePath;
}

// Docs are scanned as "soft": findings are advisory warnings, not build failures.
// A `.md` path (not under a JSON/reference lane) is how the scanner decides that.
function writeTempDoc(content: string): string {
    const filePath = path.join(os.tmpdir(), `aralia-charset-${randomUUID()}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
    TEMP_FILES.push(filePath);
    return filePath;
}

afterEach(() => {
    for (const filePath of TEMP_FILES.splice(0)) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});

// ============================================================================
// Escaped U+00xx Detection
// ============================================================================
// This section covers JSON escapes such as "\u0027". They are made from ASCII
// characters in the source file, so the normal non-ASCII character loop cannot
// see them unless this explicit scan stays in place.
// ============================================================================

describe('checkFile escaped U+00xx scan', () => {
    it('reports printable ASCII hidden behind a JSON unicode escape', () => {
        const filePath = writeTempJson('{"description":"spell\\u0027s casting"}');

        const issues = checkFile(filePath);

        expect(issues).toContainEqual(
            expect.objectContaining({
                char: '\\u0027',
                codePoint: 'U+0027',
                suggested: "'",
                type: 'Escaped U+00xx: Printable ASCII hidden by JSON escape',
            }),
        );
    });

    it('reports Latin-1 escapes for review instead of guessing their meaning', () => {
        const filePath = writeTempJson('{"description":"caf\\u00E9"}');

        const issues = checkFile(filePath);

        expect(issues).toContainEqual(
            expect.objectContaining({
                char: '\\u00E9',
                codePoint: 'U+00E9',
                suggested: undefined,
                type: 'Escaped U+00xx: Latin-1 character escape needs review',
            }),
        );
    });
});

// ============================================================================
// Report + summary rollups after a full scan
// ============================================================================
// This section drives the same report and character-frequency helpers that
// `main()` prints/writes at the end of a scan. It builds a mixed set of findings
// from fixtures (strict JSON data + soft docs) so the strict/soft split, the
// action buckets, and the durable review report all stay locked to their
// contract without needing to run the process-exiting CLI on the whole repo.
// ============================================================================

describe('charset scan report and summary rollups', () => {
    // A strict JSON file with two raw accented chars (no safe auto-fix), a soft
    // docs file with a replacement-character mojibake artifact, and a strict JSON
    // file with an auto-fixable smart quote. Together they exercise every bucket.
    function collectMixedIssues() {
        // The three risky characters, one per bucket: U+00E9 (e-acute, strict manual),
        // U+FFFD (replacement char, soft mojibake), U+2019 (smart quote, auto-fixable).
        const strictAccented = checkFile(writeTempJson('{"first":"é","second":"é"}'));
        const softMojibake = checkFile(writeTempDoc('# Doc\nBroken char � here\n'));
        const strictAutoFix = checkFile(writeTempJson('{"quote":"it’s"}'));
        return [...strictAccented, ...softMojibake, ...strictAutoFix];
    }

    it('aggregates repeated characters and keeps strict findings ahead of soft ones', () => {
        const summary = summarizeIssuesByCharacter(collectMixedIssues());

        const accentEntry = summary.find(
            (entry) => entry.codePoint === 'U+00E9' && entry.type === 'Non-ASCII Character',
        );
        expect(accentEntry).toBeDefined();
        // Both accented occurrences collapse into one strict bucket with count 2.
        expect(accentEntry).toMatchObject({ count: 2, severity: 'strict', suggested: undefined });

        // Highest count sorts first, so the twice-seen accent leads the summary.
        expect(summary[0]).toMatchObject({ codePoint: 'U+00E9', count: 2 });
    });

    it('splits findings into auto-fixable, manual review, and mojibake buckets', () => {
        const summary = summarizeIssuesByCharacter(collectMixedIssues());
        const grouped = groupCharacterSummaryByAction(summary);

        // Smart quote has a deterministic replacement -> auto-fixable.
        expect(grouped.autoFixable.some((entry) => entry.suggested === "'")).toBe(true);
        // Accented data char has no replacement and is not mojibake -> manual review.
        expect(grouped.manualReview.some((entry) => entry.codePoint === 'U+00E9')).toBe(true);
        // Replacement character is mojibake with no safe fix -> its own bucket.
        expect(grouped.mojibakeSuspicious.some((entry) => entry.type.startsWith('Mojibake:'))).toBe(true);
    });

    it('writes a review report with correct strict/soft manual counts and sections', () => {
        const report = buildCharsetReviewReport(collectMixedIssues());

        // Only findings without a safe suggestion are "manual": 2 strict accents + 1 soft mojibake.
        expect(report).toContain('Total remaining manual/suspicious issues: 3');
        expect(report).toContain('Strict data issues requiring owner decision: 2');
        expect(report).toContain('Soft documentation issues: 1');

        expect(report).toContain('## Strict Data Issues');
        expect(report).toContain('## Soft Documentation Issues');
        // Per-issue review notes route accented data and mojibake to the right guidance.
        expect(report).toContain('Real accented-word candidate');
        expect(report).toContain('Mojibake/corruption candidate');
    });

    it('emits an empty-state report when no manual review issues remain', () => {
        const report = buildCharsetReviewReport([]);

        expect(report).toContain('# Charset Review Report');
        expect(report).toContain('Total remaining manual/suspicious issues: 0');
        expect(report).toContain('No manual charset review issues remain.');
    });
});
