import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regression pin for the removed dice-box type suppression (agora-3bc2).
 *
 * WHY THIS EXISTS: `DiceService._doInit` carried a `@ts-ignore` above its dynamic
 * `import('@3d-dice/dice-box')`, annotated "lacks local declaration files". That note
 * was stale: `src/types/dice-box.d.ts` declares the module ambiently, so the import
 * resolves on its own. Compiling the suppression as `@ts-expect-error` reported
 * TS2578 "Unused directive", which is the proof it suppressed nothing. A blanket
 * `@ts-ignore` is worse than nothing here because it would also hide a *real* future
 * error on that line, so this test keeps it from creeping back.
 */

const SERVICE_PATH = resolve(__dirname, '../DiceService.ts');
const DECLARATION_PATH = resolve(__dirname, '../../types/dice-box.d.ts');

describe('DiceService dice-box typing', () => {
    it('relies on the ambient declaration instead of a suppression comment', () => {
        const source = readFileSync(SERVICE_PATH, 'utf8');

        expect(source).toContain("import('@3d-dice/dice-box')");
        expect(source).not.toContain('@ts-ignore');
        expect(source).not.toContain('@ts-expect-error');
    });

    it('keeps the ambient module declaration that makes the import resolve', () => {
        const declaration = readFileSync(DECLARATION_PATH, 'utf8');

        // Deleting this file is what would make the import fail to resolve again.
        expect(declaration).toMatch(/declare\s+module\s+['"]@3d-dice\/dice-box['"]/);
    });
});
