import fs from 'fs';
import { globSync } from 'glob';

const SHOULD_WRITE = process.argv.includes('--write');

export const TARGET_DIRECTORIES = [
    'docs/**/*.md',
    'public/data/spells/**/*.json',
    'public/data/glossary/entries/**/*.json',
];

export const MOJIBAKE_MARKERS = [
    { pattern: /\uFFFD/g, name: 'Replacement Character (U+FFFD)' },
    { pattern: /\u00C3[\u0080-\u00BF]/g, name: 'Possible UTF-8/Latin-1 mixup (Ã + suffix)' },
    { pattern: /\u00E2\u20AC\u2122/g, name: 'Decoded Right Quote (â‚¬™)' },
    { pattern: /\u0192/g, name: 'Latin Small Letter F With Hook (ƒ - common mojibake artifact)' },
];

export const FORBIDDEN_CHARS = [
    { pattern: /\uFEFF/g, name: 'Byte Order Mark (BOM)', replacement: '' },
    { pattern: /[\u200B-\u200D]/g, name: 'Zero-Width Character', replacement: '' },
];

export const NORMALIZATIONS: { pattern: RegExp; replacement: string; name: string }[] = [
    { pattern: /[\u2018\u2019]/g, replacement: "'", name: 'Smart Single Quote' },
    { pattern: /[\u201C\u201D]/g, replacement: '"', name: 'Smart Double Quote' },
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
    line: number;
    column: number;
    char: string;
    codePoint: string;
    type: string;
    suggested?: string;
    /** 'strict' issues (JSON/data files) fail the build; 'soft' issues (docs) are warnings only */
    severity: 'strict' | 'soft';
}

export function checkFile(filePath: string): Issue[] {
    const isStrict = filePath.endsWith('.json') || filePath.includes('docs/spells/reference');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const issues: Issue[] = [];

    lines.forEach((lineText, lineIdx) => {
        for (let charIdx = 0; charIdx < lineText.length; charIdx++) {
            const char = lineText[charIdx];
            const code = char.charCodeAt(0);

            // 1. Mandatory Mojibake/Forbidden check (Always)
            let type: string | undefined;
            let suggested: string | undefined;

            for (const m of MOJIBAKE_MARKERS) {
                if (m.pattern.test(char)) {
                    type = `Mojibake: ${m.name}`;
                }
            }
            for (const f of FORBIDDEN_CHARS) {
                if (f.pattern.test(char)) {
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
                        if (n.pattern.test(char)) {
                            type = `Inconsistent: ${n.name}`;
                            suggested = n.replacement;
                        }
                    }
                }
            }

            // 3. Normalization suggestion (Always if non-ASCII)
            if (!type && code > 127) {
                for (const n of NORMALIZATIONS) {
                    if (n.pattern.test(char)) {
                        type = `Inconsistent: ${n.name}`;
                        suggested = n.replacement;
                    }
                }
            }

            if (type) {
                issues.push({
                    line: lineIdx + 1,
                    column: charIdx + 1,
                    char,
                    codePoint: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
                    type,
                    suggested,
                    severity: isStrict ? 'strict' : 'soft',
                });
            }
        }
    });

    return issues;
}

function fixFile(filePath: string): boolean {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // Apply FORBIDDEN_CHARS
    for (const f of FORBIDDEN_CHARS) {
        if (f.pattern.test(content)) {
            content = content.replace(f.pattern, f.replacement);
            modified = true;
        }
    }

    // Apply NORMALIZATIONS
    for (const n of NORMALIZATIONS) {
        if (n.pattern.test(content)) {
            content = content.replace(n.pattern, n.replacement);
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    return modified;
}

function main() {
    const files = TARGET_DIRECTORIES.flatMap((pattern) => globSync(pattern));
    console.log(`Scanning ${files.length} files...`);
    // TODO(lint-intent): 'totalIssues' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    // const _totalIssues = 0;
    let totalIssues = 0;
    let strictIssues = 0;
    let softIssues = 0;
    let filesWithIssues = 0;
    let filesFixed = 0;

    files.forEach((file) => {
        const issues = checkFile(file);
        if (issues.length > 0) {
            filesWithIssues++;
            totalIssues += issues.length;

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

            if (SHOULD_WRITE) {
                if (fixFile(file)) {
                    filesFixed++;
                    console.log(`  [FIXED] Normalized character content.`);
                }
            }
        }
    });

    console.log('\n--- Summary ---');
    console.log(`Total files scanned: ${files.length}`);
    console.log(`Files with issues: ${filesWithIssues}`);
    console.log(`Strict issues (errors): ${strictIssues}`);
    console.log(`Soft issues (warnings): ${softIssues}`);
    if (SHOULD_WRITE) {
        console.log(`Files automatically fixed: ${filesFixed}`);
    }

    // Only fail the build for strict issues (JSON/data files)
    // Soft issues (markdown docs) are warnings only
    if (strictIssues > 0 && !SHOULD_WRITE) {
        console.log('\n❌ Build failed due to strict charset issues in data files.');
        process.exit(1);
    } else if (softIssues > 0 && !SHOULD_WRITE) {
        console.log('\n⚠️ Soft warnings found in documentation (build passes).');
    }
}

main();
