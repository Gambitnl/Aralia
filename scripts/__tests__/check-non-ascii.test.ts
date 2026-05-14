import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { checkFile } from '../check-non-ascii';

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
