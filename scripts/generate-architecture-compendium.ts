/**
 * Architecture Compendium Generator
 *
 * Generates dependency graphs and file inventories for architecture documentation.
 *
 * Usage:
 *   npx --no-install tsx scripts/generate-architecture-compendium.ts
 *
 * Outputs:
 *   - docs/architecture/_generated/deps.json - Full import dependency graph
 *   - docs/architecture/_generated/file-inventory.json - All tracked files
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to scan
const SCAN_DIRS = ['src', 'scripts', 'public/data'];

// File extensions to track for imports
const IMPORT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

// All extensions to include in inventory
const INVENTORY_EXTENSIONS = [
    ...IMPORT_EXTENSIONS,
    '.json',
    '.md',
    '.css',
];

// Directories to exclude
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git', '__pycache__', '.next'];

interface FileInfo {
    path: string;
    extension: string;
    sizeBytes: number;
    imports: string[];
    importedBy: string[];
}

interface DepsOutput {
    meta: {
        generatedAt: string;
        totalFiles: number;
        totalImportEdges: number;
        scanDirectories: string[];
    };
    files: Record<string, {
        imports: string[];
        importedBy: string[];
        sizeBytes: number;
        extension: string;
    }>;
}

interface InventoryOutput {
    meta: {
        generatedAt: string;
        totalFiles: number;
        byExtension: Record<string, number>;
    };
    files: Array<{
        path: string;
        extension: string;
        sizeBytes: number;
    }>;
}

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'docs', 'architecture', '_generated');

/**
 * Recursively walk a directory and collect file paths
 */
function walkDirectory(dir: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (!EXCLUDE_DIRS.includes(entry.name)) {
                walkDirectory(fullPath, files);
            }
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (INVENTORY_EXTENSIONS.includes(ext)) {
                files.push(fullPath);
            }
        }
    }

    return files;
}

/**
 * Parse import statements from a file
 */
function parseImports(filePath: string): string[] {
    const ext = path.extname(filePath).toLowerCase();
    if (!IMPORT_EXTENSIONS.includes(ext)) {
        return [];
    }

    let content: string;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (_error) {
        console.warn(`Warning: Could not read file ${filePath}`);
        return [];
    }

    const imports: string[] = [];

    // Match ES6 imports: import ... from '...'
    const es6ImportRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6ImportRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }

    // Match dynamic imports: import('...')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }

    // Match CommonJS requires: require('...')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }

    return imports;
}

/**
 * Resolve an import path to an absolute file path
 */
function resolveImport(importPath: string, fromFile: string): string | null {
    // Skip external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('/') && !importPath.startsWith('@/')) {
        return null;
    }

    const fromDir = path.dirname(fromFile);
    let resolved: string;

    if (importPath.startsWith('@/')) {
        // Handle @/ alias (common in some projects)
        resolved = path.join(projectRoot, 'src', importPath.slice(2));
    } else if (importPath.startsWith('/')) {
        resolved = path.join(projectRoot, importPath);
    } else {
        resolved = path.resolve(fromDir, importPath);
    }

    // Try different extensions if not specified
    const ext = path.extname(resolved);
    if (!ext) {
        for (const tryExt of IMPORT_EXTENSIONS) {
            if (fs.existsSync(resolved + tryExt)) {
                return resolved + tryExt;
            }
            // Try index file
            const indexPath = path.join(resolved, `index${tryExt}`);
            if (fs.existsSync(indexPath)) {
                return indexPath;
            }
        }
    }

    if (fs.existsSync(resolved)) {
        return resolved;
    }

    return null;
}

/**
 * Convert absolute path to repo-relative path
 */
function toRelativePath(absolutePath: string): string {
    return path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
}

/**
 * Main generation function
 */
async function generateCompendium(): Promise<void> {
    console.log('Architecture Compendium Generator');
    console.log('=================================\n');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}\n`);
    }

    // Collect all files
    console.log('Scanning directories...');
    const allFiles: string[] = [];
    for (const scanDir of SCAN_DIRS) {
        const fullDir = path.join(projectRoot, scanDir);
        if (fs.existsSync(fullDir)) {
            console.log(`  - ${scanDir}/`);
            walkDirectory(fullDir, allFiles);
        } else {
            console.log(`  - ${scanDir}/ (not found, skipping)`);
        }
    }
    console.log(`\nFound ${allFiles.length} files\n`);

    // Build file info map
    console.log('Parsing imports...');
    const fileInfoMap = new Map<string, FileInfo>();

    for (const file of allFiles) {
        const relativePath = toRelativePath(file);
        const stats = fs.statSync(file);
        const imports = parseImports(file);

        fileInfoMap.set(relativePath, {
            path: relativePath,
            extension: path.extname(file).toLowerCase(),
            sizeBytes: stats.size,
            imports: [],
            importedBy: [],
        });

        // Resolve imports
        for (const imp of imports) {
            const resolved = resolveImport(imp, file);
            if (resolved) {
                const resolvedRelative = toRelativePath(resolved);
                const info = fileInfoMap.get(relativePath)!;
                if (!info.imports.includes(resolvedRelative)) {
                    info.imports.push(resolvedRelative);
                }
            }
        }
    }

    // Build importedBy relationships
    console.log('Building dependency graph...');
    for (const [filePath, info] of fileInfoMap) {
        for (const importedPath of info.imports) {
            const importedInfo = fileInfoMap.get(importedPath);
            if (importedInfo && !importedInfo.importedBy.includes(filePath)) {
                importedInfo.importedBy.push(filePath);
            }
        }
    }

    // Count total edges
    let totalEdges = 0;
    for (const info of fileInfoMap.values()) {
        totalEdges += info.imports.length;
    }

    // Generate deps.json
    console.log('\nGenerating deps.json...');
    const depsOutput: DepsOutput = {
        meta: {
            generatedAt: new Date().toISOString(),
            totalFiles: fileInfoMap.size,
            totalImportEdges: totalEdges,
            scanDirectories: SCAN_DIRS,
        },
        files: {},
    };

    for (const [filePath, info] of fileInfoMap) {
        if (info.imports.length > 0 || info.importedBy.length > 0) {
            depsOutput.files[filePath] = {
                imports: info.imports.sort(),
                importedBy: info.importedBy.sort(),
                sizeBytes: info.sizeBytes,
                extension: info.extension,
            };
        }
    }

    const depsPath = path.join(outputDir, 'deps.json');
    fs.writeFileSync(depsPath, JSON.stringify(depsOutput, null, 2));
    console.log(`  Written: ${toRelativePath(depsPath)}`);

    // Generate file-inventory.json
    console.log('Generating file-inventory.json...');
    const byExtension: Record<string, number> = {};
    const inventoryFiles: Array<{ path: string; extension: string; sizeBytes: number }> = [];

    for (const info of fileInfoMap.values()) {
        const ext = info.extension || '(none)';
        byExtension[ext] = (byExtension[ext] || 0) + 1;
        inventoryFiles.push({
            path: info.path,
            extension: info.extension,
            sizeBytes: info.sizeBytes,
        });
    }

    // Sort by path
    inventoryFiles.sort((a, b) => a.path.localeCompare(b.path));

    const inventoryOutput: InventoryOutput = {
        meta: {
            generatedAt: new Date().toISOString(),
            totalFiles: fileInfoMap.size,
            byExtension: Object.fromEntries(
                Object.entries(byExtension).sort((a, b) => b[1] - a[1])
            ),
        },
        files: inventoryFiles,
    };

    const inventoryPath = path.join(outputDir, 'file-inventory.json');
    fs.writeFileSync(inventoryPath, JSON.stringify(inventoryOutput, null, 2));
    console.log(`  Written: ${toRelativePath(inventoryPath)}`);

    // Summary
    console.log('\n=================================');
    console.log('Generation complete!\n');
    console.log('Summary:');
    console.log(`  Total files: ${fileInfoMap.size}`);
    console.log(`  Total import edges: ${totalEdges}`);
    console.log(`  Files with imports: ${Object.keys(depsOutput.files).length}`);
    console.log('\nTop 5 extensions:');
    const topExtensions = Object.entries(byExtension)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    for (const [ext, count] of topExtensions) {
        console.log(`  ${ext}: ${count} files`);
    }

    // Find most-imported files
    console.log('\nTop 10 most-imported files:');
    const byImportCount = Array.from(fileInfoMap.values())
        .filter(f => f.importedBy.length > 0)
        .sort((a, b) => b.importedBy.length - a.importedBy.length)
        .slice(0, 10);
    for (const info of byImportCount) {
        console.log(`  ${info.importedBy.length} imports: ${info.path}`);
    }
}

// Run
generateCompendium().catch(console.error);
