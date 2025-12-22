/**
 * Architecture Coverage Verification Script
 *
 * Validates that code files are accounted for in architecture documentation.
 *
 * Usage:
 *   npx --no-install tsx scripts/verify-architecture-coverage.ts
 *
 * Checks:
 *   1. Orphaned files - In codebase but not claimed by any domain
 *   2. Missing files - Claimed in docs but don't exist in codebase
 *   3. Ambiguous files - Claimed by multiple domains
 *   4. Test coverage - Each domain should have associated test files
 *
 * Outputs:
 *   - Console report with coverage statistics
 *   - docs/architecture/_generated/coverage-report.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const domainsDir = path.join(projectRoot, 'docs', 'architecture', 'domains');
const generatedDir = path.join(projectRoot, 'docs', 'architecture', '_generated');
const inventoryPath = path.join(generatedDir, 'file-inventory.json');

// File extensions to track for coverage (code + data + styles)
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css'];

// Patterns to identify test files (tracked separately for test coverage metric)
const TEST_PATTERNS = [
    /\/__tests__\//,
    /\.test\.(ts|tsx|js|jsx)$/,
    /\.spec\.(ts|tsx|js|jsx)$/,
];

// Files to genuinely exclude from tracking (not code, generated, etc.)
const EXCLUDED_PATTERNS = [
    /\.d\.ts$/,  // Type declaration files (often generated)
];

interface FileInventory {
    meta: {
        generatedAt: string;
        totalFiles: number;
    };
    files: Array<{
        path: string;
        extension: string;
        sizeBytes: number;
    }>;
}

interface DomainClaim {
    domain: string;
    files: string[];
}

interface CoverageReport {
    meta: {
        generatedAt: string;
        totalCodeFiles: number;
        totalTestFiles: number;
        claimedFiles: number;
        orphanedFiles: number;
        missingFiles: number;
        ambiguousFiles: number;
        coveragePercent: number;
    };
    orphaned: string[];
    orphanedTests: string[];
    missing: Array<{ file: string; claimedIn: string }>;
    ambiguous: Array<{ file: string; claimedIn: string[] }>;
    byDomain: Record<string, {
        claimedFiles: number;
        validFiles: number;
        missingFiles: number;
        testFiles: number;
    }>;
    testCoverage: {
        domainsWithTests: number;
        domainsWithoutTests: string[];
    };
}

/**
 * Check if a file is a test file
 */
function isTestFile(filePath: string): boolean {
    return TEST_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Check if a file should be excluded from coverage requirements
 */
function isExcluded(filePath: string): boolean {
    return EXCLUDED_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Parse a domain markdown file to extract claimed files
 * Supports explicit file paths and glob patterns
 */
function parseDomainDoc(filePath: string): DomainClaim {
    const content = fs.readFileSync(filePath, 'utf-8');
    const domainName = path.basename(filePath, '.md');

    const files: string[] = [];

    // Match file paths in markdown - can be explicit paths or glob patterns
    // Patterns we're looking for:
    // | `src/components/*.tsx` | ... |
    // - `src/components/X.tsx`
    // `src/components/X.tsx`

    // Pattern 1: Backtick-wrapped paths (most common)
    const backtickPattern = /`((?:src|scripts|public\/data)\/[^`]+)`/g;
    let match;
    while ((match = backtickPattern.exec(content)) !== null) {
        const pattern = match[1];
        if (/[*{[?]/.test(pattern)) {
            const matches = globSync(pattern, { cwd: projectRoot }).map(f => f.replace(/\\/g, '/'));
            for (const f of matches) {
                if (!files.includes(f)) files.push(f);
            }
        } else {
            if (!files.includes(pattern)) {
                files.push(pattern);
            }
        }
    }

    // Pattern 2: Table cells with paths (no backticks)
    const tablePattern = /\|\s*((?:src|scripts|public\/data)\/[^\s|]+)\s*\|/g;
    while ((match = tablePattern.exec(content)) !== null) {
        const pattern = match[1];
        if (/[*{[?]/.test(pattern)) {
            const matches = globSync(pattern, { cwd: projectRoot }).map(f => f.replace(/\\/g, '/'));
            for (const f of matches) {
                if (!files.includes(f)) files.push(f);
            }
        } else {
            if (!files.includes(pattern)) {
                files.push(pattern);
            }
        }
    }

    return { domain: domainName, files };
}

/**
 * Main verification function
 */
async function verifyArchitectureCoverage(): Promise<void> {
    console.log('Architecture Coverage Verification');
    console.log('==================================\n');

    // Load file inventory
    if (!fs.existsSync(inventoryPath)) {
        console.error('Error: file-inventory.json not found.');
        console.error('Run: npx --no-install tsx scripts/generate-architecture-compendium.ts');
        process.exit(1);
    }

    const inventory: FileInventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8'));

    // Filter to code files only, split into regular and test files
    const allCodeFiles = inventory.files
        .filter(f => CODE_EXTENSIONS.includes(f.extension))
        .filter(f => !isExcluded(f.path))
        .map(f => f.path);

    const testFiles = allCodeFiles.filter(f => isTestFile(f));
    const regularFiles = allCodeFiles.filter(f => !isTestFile(f));

    console.log(`Total code files: ${allCodeFiles.length}`);
    console.log(`  - Regular files: ${regularFiles.length}`);
    console.log(`  - Test files: ${testFiles.length}\n`);

    // Parse all domain documents
    const domainDocFiles = fs.readdirSync(domainsDir).filter(f => f.endsWith('.md'));
    const domainClaims: DomainClaim[] = [];

    console.log('Parsing domain documents...');
    for (const domainFile of domainDocFiles) {
        const claim = parseDomainDoc(path.join(domainsDir, domainFile));
        domainClaims.push(claim);
        const testCount = claim.files.filter(f => isTestFile(f)).length;
        console.log(`  ${claim.domain}: ${claim.files.length} files (${testCount} tests)`);
    }
    console.log('');

    // Build maps for analysis
    const claimedFiles = new Map<string, string[]>(); // file -> domains claiming it

    for (const claim of domainClaims) {
        for (const file of claim.files) {
            if (!claimedFiles.has(file)) {
                claimedFiles.set(file, []);
            }
            claimedFiles.get(file)!.push(claim.domain);
        }
    }

    // Analyze coverage for ALL code files (including tests)
    const orphaned: string[] = [];
    const orphanedTests: string[] = [];
    const ambiguous: Array<{ file: string; claimedIn: string[] }> = [];
    const missing: Array<{ file: string; claimedIn: string }> = [];
    const validClaims = new Set<string>();

    // Check each code file for coverage
    for (const file of allCodeFiles) {
        const domains = claimedFiles.get(file) || [];

        if (domains.length === 0) {
            if (isTestFile(file)) {
                orphanedTests.push(file);
            } else {
                orphaned.push(file);
            }
        } else if (domains.length > 1) {
            ambiguous.push({ file, claimedIn: domains });
            validClaims.add(file);
        } else {
            validClaims.add(file);
        }
    }

    // Check for missing files (claimed but don't exist)
    const allCodeFileSet = new Set(allCodeFiles);
    for (const [file, domains] of claimedFiles) {
        const normalizedFile = file.replace(/\\/g, '/');
        if (!allCodeFileSet.has(normalizedFile)) {
            const fullPath = path.join(projectRoot, normalizedFile);
            if (!fs.existsSync(fullPath)) {
                missing.push({ file: normalizedFile, claimedIn: domains[0] });
            }
        }
    }

    // Calculate per-domain stats including test coverage
    const byDomain: Record<string, { claimedFiles: number; validFiles: number; missingFiles: number; testFiles: number }> = {};
    const domainsWithoutTests: string[] = [];

    for (const claim of domainClaims) {
        const domainMissing = missing.filter(m => m.claimedIn === claim.domain).length;
        const domainTests = claim.files.filter(f => isTestFile(f)).length;

        byDomain[claim.domain] = {
            claimedFiles: claim.files.length,
            validFiles: claim.files.filter(f => allCodeFileSet.has(f)).length,
            missingFiles: domainMissing,
            testFiles: domainTests,
        };

        if (domainTests === 0) {
            domainsWithoutTests.push(claim.domain);
        }
    }

    // Calculate coverage (all code files including tests)
    const coveragePercent = allCodeFiles.length > 0
        ? (validClaims.size / allCodeFiles.length) * 100
        : 0;

    // Generate report
    const report: CoverageReport = {
        meta: {
            generatedAt: new Date().toISOString(),
            totalCodeFiles: allCodeFiles.length,
            totalTestFiles: testFiles.length,
            claimedFiles: validClaims.size,
            orphanedFiles: orphaned.length + orphanedTests.length,
            missingFiles: missing.length,
            ambiguousFiles: ambiguous.length,
            coveragePercent: Math.round(coveragePercent * 10) / 10,
        },
        orphaned: orphaned.sort(),
        orphanedTests: orphanedTests.sort(),
        missing,
        ambiguous,
        byDomain,
        testCoverage: {
            domainsWithTests: domainClaims.length - domainsWithoutTests.length,
            domainsWithoutTests,
        },
    };

    // Write report
    const reportPath = path.join(generatedDir, 'coverage-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('=== Coverage Summary ===\n');
    console.log(`Total code files:   ${allCodeFiles.length}`);
    console.log(`Claimed files:      ${validClaims.size}`);
    console.log(`Coverage:           ${report.meta.coveragePercent}%\n`);

    console.log(`Orphaned (regular): ${orphaned.length} files`);
    console.log(`Orphaned (tests):   ${orphanedTests.length} files`);
    console.log(`Missing:            ${missing.length} files`);
    console.log(`Ambiguous:          ${ambiguous.length} files\n`);

    // Test coverage summary
    console.log('=== Test Coverage ===\n');
    console.log(`Domains with tests:    ${report.testCoverage.domainsWithTests}/${domainClaims.length}`);
    if (domainsWithoutTests.length > 0) {
        console.log(`Domains without tests: ${domainsWithoutTests.join(', ')}`);
    }
    console.log('');

    // Print per-domain stats
    console.log('=== Per-Domain Stats ===\n');
    for (const [domain, stats] of Object.entries(byDomain)) {
        console.log(`  ${domain}: ${stats.validFiles} valid, ${stats.testFiles} tests, ${stats.missingFiles} missing`);
    }
    console.log('');

    // Print sample of orphaned files
    if (orphaned.length > 0) {
        console.log('=== Orphaned Files (first 30) ===\n');
        for (const file of orphaned.slice(0, 30)) {
            console.log(`  ${file}`);
        }
        if (orphaned.length > 30) {
            console.log(`  ... and ${orphaned.length - 30} more`);
        }
        console.log('');
    }

    // Print sample of orphaned test files
    if (orphanedTests.length > 0) {
        console.log('=== Orphaned Test Files (first 20) ===\n');
        for (const file of orphanedTests.slice(0, 20)) {
            console.log(`  ${file}`);
        }
        if (orphanedTests.length > 20) {
            console.log(`  ... and ${orphanedTests.length - 20} more`);
        }
        console.log('');
    }

    // Print missing files
    if (missing.length > 0) {
        console.log('=== Missing Files ===\n');
        for (const { file, claimedIn } of missing) {
            console.log(`  ${file} (claimed in: ${claimedIn})`);
        }
        console.log('');
    }

    // Print ambiguous files
    if (ambiguous.length > 0) {
        console.log('=== Ambiguous Files ===\n');
        for (const { file, claimedIn } of ambiguous) {
            console.log(`  ${file} (claimed in: ${claimedIn.join(', ')})`);
        }
        console.log('');
    }

    console.log(`Report written to: ${path.relative(projectRoot, reportPath)}`);

    // Exit with error if there are missing files
    if (missing.length > 0) {
        process.exit(1);
    }
}

// Run
verifyArchitectureCoverage().catch(console.error);
