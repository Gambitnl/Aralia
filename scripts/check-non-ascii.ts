import fs from 'fs';
import { globSync } from 'glob';
import { pathToFileURL } from 'url';

/**
 * This script checks Aralia's documentation and public data for text characters
 * that are risky in generated data, copied rules text, or JSON consumed by the game.
 *
 * The validator is used by `npm run validate` before the data validator runs. It
 * scans the configured docs and data folders, normalizes known safe characters
 * with `--write`, prints exact file/line findings for anything left behind, and
 * also prints a compact character-frequency summary so the largest cleanup
 * buckets are easy to see.
 *
 * Called by: package.json scripts `validate:charset`, `validate`, and `fix:charset`
 * Depends on: glob for file discovery and Node's fs module for reading/writing files
 */

// ============================================================================
// Scan Configuration
// ============================================================================
// This section defines the folders and character families the validator knows
// about. Data/reference files are strict because they feed the game; broader docs
// are softer because prose can contain intentional punctuation while still being
// useful to report.
// ============================================================================

const SHOULD_WRITE = process.argv.includes('--write');
export const CHARSET_REVIEW_REPORT_PATH = 'docs/reports/charset-review-report.md';

export const TARGET_DIRECTORIES = [
    'docs/**/*.md',
    'public/data/spells/**/*.json',
    'public/data/glossary/entries/**/*.json',
];

export function getCharsetTargetFiles(): string[] {
    return TARGET_DIRECTORIES.flatMap((pattern) => globSync(pattern)).filter(
        // The generated report intentionally quotes bad characters for human
        // review, so scanning it would recursively inflate the next report.
        (file) => file.replace(/\\/g, '/') !== CHARSET_REVIEW_REPORT_PATH
    );
}

export const MOJIBAKE_MARKERS = [
    { pattern: /\uFFFD/g, name: 'Replacement Character (U+FFFD)' },
    { pattern: /\u00C3[\u0080-\u00BF]/g, name: 'Possible UTF-8/Latin-1 mixup (Ã + suffix)' },
    { pattern: /\u00E2\u20AC\u2122/g, name: 'Decoded Right Quote (â‚¬™)' },
    { pattern: /\u0192/g, name: 'Latin Small Letter F With Hook (ƒ - common mojibake artifact)' },
];

export const FORBIDDEN_CHARS = [
    { pattern: /\uFEFF/g, name: 'Byte Order Mark (BOM)', replacement: '' },
    { pattern: /[\u200B-\u200D]/g, name: 'Zero-Width Character', replacement: '' },
    { pattern: /\u009D/g, name: 'Dangling Mojibake Quote Tail', replacement: '' },
];

export const MOJIBAKE_NORMALIZATIONS: { pattern: RegExp; replacement: string; name: string }[] = [
    { pattern: /\u00E2\u20AC\u2122/g, replacement: "'", name: 'Mojibake Right Single Quote Sequence' },
    { pattern: /\u00E2\u02C6'/g, replacement: '-', name: 'Mojibake Minus Sign Sequence' },
];

export const NORMALIZATIONS: { pattern: RegExp; replacement: string; name: string }[] = [
    { pattern: /[\u2018\u2019]/g, replacement: "'", name: 'Smart Single Quote' },
    { pattern: /[\u201C\u201D]/g, replacement: '"', name: 'Smart Double Quote' },
    { pattern: /\u2192/g, replacement: '->', name: 'Right Arrow' },
    { pattern: /\u2705/g, replacement: 'PASSED', name: 'White Heavy Check Mark' },
    { pattern: /\u274C/g, replacement: 'FAILED', name: 'Cross Mark' },
    { pattern: /\u2013/g, replacement: '-', name: 'En-dash' },
    { pattern: /\u2014/g, replacement: '-', name: 'Em-dash' },
    { pattern: /\u2026/g, replacement: '...', name: 'Ellipsis' },
    { pattern: /\u00A0/g, replacement: ' ', name: 'Non-breaking Space' },
    { pattern: /\u00D7/g, replacement: 'x', name: 'Multiplication Sign' },
    { pattern: /\u00BD/g, replacement: '1/2', name: 'Fraction One Half' },
    { pattern: /\u00BC/g, replacement: '1/4', name: 'Fraction One Quarter' },
    { pattern: /\u00BE/g, replacement: '3/4', name: 'Fraction Three Quarters' },
    { pattern: /\u2212/g, replacement: '-', name: 'Minus Sign' },
    { pattern: /\u00F7/g, replacement: '/', name: 'Division Sign' },
];

export interface Issue {
    file?: string;
    line: number;
    column: number;
    char: string;
    codePoint: string;
    type: string;
    suggested?: string;
    lineText?: string;
    /** 'strict' issues (JSON/data files) fail the build; 'soft' issues (docs) are warnings only */
    severity: 'strict' | 'soft';
}

export interface CharacterSummaryEntry {
    char: string;
    codePoint: string;
    type: string;
    suggested?: string;
    severity: 'strict' | 'soft';
    count: number;
}

export interface CharacterSummaryByAction {
    autoFixable: CharacterSummaryEntry[];
    manualReview: CharacterSummaryEntry[];
    mojibakeSuspicious: CharacterSummaryEntry[];
}

function patternMatches(pattern: RegExp, text: string): boolean {
    // Reset global patterns before every one-character check. Without this,
    // JavaScript remembers the previous match position and repeated characters
    // can alternate between a named normalization and generic non-ASCII.
    pattern.lastIndex = 0;
    return pattern.test(text);
}

function codePointLabel(text: string): string {
    // Multi-character mojibake sequences need to be reported as a single
    // suspicious unit, so this helper supports both one character and a short
    // sequence without losing the individual code points.
    return Array.from(text)
        .map((char) => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`)
        .join(' ');
}

function findEscapedUnicodeIssues(filePath: string, lineText: string, lineIdx: number, isStrict: boolean): Issue[] {
    // JSON can hide risky text behind ASCII-only unicode escapes such as
    // "\u0027" or "\u00E9". The normal character walk below only sees the
    // backslash and letters, so this explicit pass reports those escape
    // sequences before decoded non-ASCII scanning begins.
    const issues: Issue[] = [];
    const escapedLatin1Pattern = /\\u00([0-9a-fA-F]{2})/g;

    for (const match of lineText.matchAll(escapedLatin1Pattern)) {
        const start = match.index;
        if (start === undefined) {
            continue;
        }

        const code = Number.parseInt(match[1], 16);
        const codePoint = `U+00${match[1].toUpperCase()}`;
        const printableAscii = code >= 0x20 && code <= 0x7e;

        issues.push({
            file: filePath,
            line: lineIdx + 1,
            column: start + 1,
            char: match[0],
            codePoint,
            type: printableAscii
                ? 'Escaped U+00xx: Printable ASCII hidden by JSON escape'
                : 'Escaped U+00xx: Latin-1 character escape needs review',
            suggested: printableAscii ? String.fromCharCode(code) : undefined,
            lineText,
            severity: isStrict ? 'strict' : 'soft',
        });
    }

    return issues;
}

// ============================================================================
// Issue Detection
// ============================================================================
// This section inspects one file and returns every character issue with location
// data. The caller decides whether to print, summarize, fix, or fail the build.
// ============================================================================

export function checkFile(filePath: string): Issue[] {
    const isStrict = filePath.endsWith('.json') || filePath.includes('docs/spells/reference');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const issues: Issue[] = [];

    lines.forEach((lineText, lineIdx) => {
        const sequenceIndexes = new Set<number>();

        issues.push(...findEscapedUnicodeIssues(filePath, lineText, lineIdx, isStrict));

        MOJIBAKE_NORMALIZATIONS.forEach((normalization) => {
            normalization.pattern.lastIndex = 0;
            for (const match of lineText.matchAll(normalization.pattern)) {
                const start = match.index;
                if (start === undefined) {
                    continue;
                }

                const matchedText = match[0];
                for (let offset = 0; offset < matchedText.length; offset++) {
                    sequenceIndexes.add(start + offset);
                }

                issues.push({
                    file: filePath,
                    line: lineIdx + 1,
                    column: start + 1,
                    char: matchedText,
                    codePoint: codePointLabel(matchedText),
                    type: `Mojibake: ${normalization.name}`,
                    suggested: normalization.replacement,
                    lineText,
                    severity: isStrict ? 'strict' : 'soft',
                });
            }
        });

        for (let charIdx = 0; charIdx < lineText.length; charIdx++) {
            if (sequenceIndexes.has(charIdx)) {
                continue;
            }

            const char = lineText[charIdx];
            const code = char.charCodeAt(0);

            // 1. Mandatory Mojibake/Forbidden check (Always)
            let type: string | undefined;
            let suggested: string | undefined;

            for (const m of MOJIBAKE_MARKERS) {
                if (patternMatches(m.pattern, char)) {
                    type = `Mojibake: ${m.name}`;
                }
            }
            for (const f of FORBIDDEN_CHARS) {
                if (patternMatches(f.pattern, char)) {
                    type = `Forbidden: ${f.name}`;
                    suggested = f.replacement;
                }
            }

            // 2. Strict ASCII check (Only for data/reference files)
            if (!type && isStrict) {
                // Allow tabs (9), LF (10), CR (13)
                if (code > 127 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
                    type = 'Non-ASCII Character';
                    for (const n of NORMALIZATIONS) {
                        if (patternMatches(n.pattern, char)) {
                            type = `Inconsistent: ${n.name}`;
                            suggested = n.replacement;
                        }
                    }
                }
            }

            // 3. Normalization suggestion (Always if non-ASCII)
            if (!type && code > 127) {
                for (const n of NORMALIZATIONS) {
                    if (patternMatches(n.pattern, char)) {
                        type = `Inconsistent: ${n.name}`;
                        suggested = n.replacement;
                    }
                }
            }

            if (type) {
                issues.push({
                    file: filePath,
                    line: lineIdx + 1,
                    column: charIdx + 1,
                    char,
                    codePoint: codePointLabel(char),
                    type,
                    suggested,
                    lineText,
                    severity: isStrict ? 'strict' : 'soft',
                });
            }
        }
    });

    return issues;
}

// ============================================================================
// Summary Reporting
// ============================================================================
// This section turns thousands of line-level findings into a small triage list.
// The detailed output remains unchanged, while this aggregate view shows which
// character/type combinations are responsible for the largest cleanup buckets.
// ============================================================================

export function summarizeIssuesByCharacter(issues: Issue[]): CharacterSummaryEntry[] {
    const summaries = new Map<string, CharacterSummaryEntry>();

    issues.forEach((issue) => {
        const key = [
            issue.char,
            issue.codePoint,
            issue.type,
            issue.suggested ?? '',
            issue.severity,
        ].join('\u0000');

        const existing = summaries.get(key);
        if (existing) {
            existing.count++;
            return;
        }

        summaries.set(key, {
            char: issue.char,
            codePoint: issue.codePoint,
            type: issue.type,
            suggested: issue.suggested,
            severity: issue.severity,
            count: 1,
        });
    });

    return [...summaries.values()].sort((left, right) => {
        if (right.count !== left.count) {
            return right.count - left.count;
        }
        if (left.severity !== right.severity) {
            return left.severity === 'strict' ? -1 : 1;
        }
        return left.codePoint.localeCompare(right.codePoint) || left.type.localeCompare(right.type);
    });
}

export function groupCharacterSummaryByAction(summary: CharacterSummaryEntry[]): CharacterSummaryByAction {
    const grouped: CharacterSummaryByAction = {
        autoFixable: [],
        manualReview: [],
        mojibakeSuspicious: [],
    };

    summary.forEach((entry) => {
        // A defined suggestion is the script's contract that --write knows how
        // to fix this exact character safely without guessing at prose intent.
        if (entry.suggested !== undefined) {
            grouped.autoFixable.push(entry);
            return;
        }

        // Mojibake without a deterministic replacement stays separated because
        // it usually means text was decoded incorrectly and needs source review.
        if (entry.type.startsWith('Mojibake:')) {
            grouped.mojibakeSuspicious.push(entry);
            return;
        }

        // Anything else is intentionally left for a human because accented names,
        // copied rules text, and unknown control characters can mean different
        // things depending on context.
        grouped.manualReview.push(entry);
    });

    return grouped;
}

function printCharacterSummaryGroup(title: string, entries: CharacterSummaryEntry[]) {
    console.log(`\n${title}`);
    if (entries.length === 0) {
        console.log('  none');
        return;
    }

    entries.forEach((entry) => {
        const severityLabel = entry.severity === 'strict' ? 'strict' : 'soft';
        const suggestion = entry.suggested !== undefined ? ` -> Suggested: ${entry.suggested}` : '';
        console.log(
            `  ${entry.count}x ${entry.type} (${entry.char} / ${entry.codePoint}, ${severityLabel})${suggestion}`
        );
    });
}

function printCharacterSummary(issues: Issue[]) {
    const summary = summarizeIssuesByCharacter(issues);

    console.log('\n--- Character Frequency ---');
    if (summary.length === 0) {
        console.log('No disallowed or normalized characters found.');
        return;
    }

    const grouped = groupCharacterSummaryByAction(summary);
    printCharacterSummaryGroup('Auto-fixable with --write', grouped.autoFixable);
    printCharacterSummaryGroup('Manual review required', grouped.manualReview);
    printCharacterSummaryGroup('Mojibake suspicious', grouped.mojibakeSuspicious);
}

// ============================================================================
// Review Report
// ============================================================================
// This section writes a durable handoff for issues that remain after automatic
// fixes. It gives the next reviewing agent enough line context to decide whether
// a character is a real word accent, a copied-text artifact, or deeper corruption.
// ============================================================================

function escapeReportText(text: string): string {
    return text.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

export function buildCharsetReviewReport(issues: Issue[]): string {
    const manualIssues = issues.filter((issue) => issue.suggested === undefined);
    const strictManualIssues = manualIssues.filter((issue) => issue.severity === 'strict');
    const softManualIssues = manualIssues.filter((issue) => issue.severity === 'soft');

    const lines = [
        '# Charset Review Report',
        '',
        'This report is generated by `scripts/check-non-ascii.ts` after the automatic charset fixer has run.',
        '',
        'Instructions for the reviewing agent:',
        '',
        '- Bring every remaining strict data issue in this report to the project owner for decision making.',
        '- If an `é` issue is clearly a real accented word, you have permission after presenting this report to replace it with regular ASCII `e`.',
        '- If a remaining issue is not clearly a real accented word, flag it for deeper investigation instead of guessing.',
        '- Soft documentation mojibake can be handled separately unless the owner asks for full docs cleanup.',
        '',
        `Total remaining manual/suspicious issues: ${manualIssues.length}`,
        `Strict data issues requiring owner decision: ${strictManualIssues.length}`,
        `Soft documentation issues: ${softManualIssues.length}`,
        '',
    ];

    if (manualIssues.length === 0) {
        lines.push('No manual charset review issues remain.');
        return `${lines.join('\n')}\n`;
    }

    const appendIssue = (issue: Issue) => {
        lines.push(`## ${issue.severity.toUpperCase()} ${issue.file ?? 'unknown file'}:${issue.line}:${issue.column}`);
        lines.push('');
        lines.push(`- Type: ${issue.type}`);
        lines.push(`- Character: ${issue.char}`);
        lines.push(`- Code point: ${issue.codePoint}`);
        if (issue.char === 'é') {
            lines.push('- Review note: Real accented-word candidate. Present to owner; if confirmed as a normal accented word, replace `é` with `e`.');
        } else if (issue.type.startsWith('Mojibake:')) {
            lines.push('- Review note: Mojibake/corruption candidate. Do not auto-fix unless a deterministic replacement is established.');
        } else {
            lines.push('- Review note: Unknown strict character. Flag for deeper investigation unless surrounding text proves a safe replacement.');
        }
        lines.push('- Line text:');
        lines.push('');
        lines.push('```text');
        lines.push(escapeReportText(issue.lineText ?? ''));
        lines.push('```');
        lines.push('');
    };

    lines.push('## Strict Data Issues');
    lines.push('');
    if (strictManualIssues.length === 0) {
        lines.push('No strict data issues remain.');
        lines.push('');
    } else {
        strictManualIssues.forEach(appendIssue);
    }

    lines.push('## Soft Documentation Issues');
    lines.push('');
    if (softManualIssues.length === 0) {
        lines.push('No soft documentation issues remain.');
        lines.push('');
    } else {
        softManualIssues.forEach(appendIssue);
    }

    return `${lines.join('\n')}\n`;
}

function writeCharsetReviewReport(issues: Issue[]) {
    fs.mkdirSync('docs/reports', { recursive: true });
    fs.writeFileSync(CHARSET_REVIEW_REPORT_PATH, buildCharsetReviewReport(issues), 'utf-8');
    console.log(`Charset review report written to ${CHARSET_REVIEW_REPORT_PATH}`);
}

// ============================================================================
// Auto-Fix Support
// ============================================================================
// This section applies the same known replacements used by the report. It only
// touches recognized forbidden or normalization characters; unknown non-ASCII
// findings remain manual so content intent is not accidentally rewritten.
// ============================================================================

export function fixFile(filePath: string): boolean {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // Apply deterministic mojibake repairs before single-character fixes. These
    // patterns are multi-character corruptions of one intended character.
    for (const n of MOJIBAKE_NORMALIZATIONS) {
        if (patternMatches(n.pattern, content)) {
            content = content.replace(n.pattern, n.replacement);
            modified = true;
        }
    }

    // Apply FORBIDDEN_CHARS
    for (const f of FORBIDDEN_CHARS) {
        if (patternMatches(f.pattern, content)) {
            content = content.replace(f.pattern, f.replacement);
            modified = true;
        }
    }

    // Apply NORMALIZATIONS
    for (const n of NORMALIZATIONS) {
        if (patternMatches(n.pattern, content)) {
            content = content.replace(n.pattern, n.replacement);
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    return modified;
}

// ============================================================================
// Command Line Runner
// ============================================================================
// This section optionally applies safe automatic fixes first, then performs the
// full repo scan, prints detailed findings, appends the aggregate
// character-frequency list, and exits nonzero for strict data issues that remain.
// ============================================================================

export function main() {
    const files = getCharsetTargetFiles();
    console.log(`Scanning ${files.length} files...`);
    const allIssues: Issue[] = [];
    let totalIssues = 0;
    let strictIssues = 0;
    let softIssues = 0;
    let filesWithIssues = 0;
    let filesFixed = 0;

    if (SHOULD_WRITE) {
        // The write pass intentionally runs before reporting so obvious
        // replacements such as BOM removal, smart quotes, and dash variants are
        // not shown as failures after the script has already fixed them.
        files.forEach((file) => {
            if (fixFile(file)) {
                filesFixed++;
            }
        });
        console.log(`Applied automatic charset fixes to ${filesFixed} files.`);
    }

    files.forEach((file) => {
        const issues = checkFile(file);
        if (issues.length > 0) {
            filesWithIssues++;
            totalIssues += issues.length;
            allIssues.push(...issues);

            const fileStrictCount = issues.filter(i => i.severity === 'strict').length;
            const fileSoftCount = issues.filter(i => i.severity === 'soft').length;
            strictIssues += fileStrictCount;
            softIssues += fileSoftCount;

            // Use different prefix for strict vs soft issues
            const prefix = fileStrictCount > 0 ? 'ERROR' : 'WARN';
            console.log(`\n[${prefix}] File: ${file}`);
            issues.forEach((issue) => {
                const severityTag = issue.severity === 'strict' ? '❌' : '⚠️';
                console.log(
                    `  ${severityTag} [Line ${issue.line}, Col ${issue.column}] ${issue.type} (${issue.char} / ${issue.codePoint})${issue.suggested !== undefined ? ` -> Suggested: ${issue.suggested}` : ''
                    }`
                );
            });

        }
    });

    console.log('\n--- Summary ---');
    console.log(`Total files scanned: ${files.length}`);
    console.log(`Files with issues: ${filesWithIssues}`);
    console.log(`Total issues: ${totalIssues}`);
    console.log(`Strict issues (errors): ${strictIssues}`);
    console.log(`Soft issues (warnings): ${softIssues}`);
    if (SHOULD_WRITE) {
        console.log(`Files automatically fixed: ${filesFixed}`);
    }
    printCharacterSummary(allIssues);
    writeCharsetReviewReport(allIssues);

    // Only fail the build for strict issues (JSON/data files) that still remain
    // after the optional automatic fix pass. Soft docs findings stay advisory.
    if (strictIssues > 0) {
        console.log('\n❌ Build failed due to strict charset issues in data files.');
        process.exit(1);
    } else if (softIssues > 0) {
        console.log('\n⚠️ Soft warnings found in documentation (build passes).');
    }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main();
}
