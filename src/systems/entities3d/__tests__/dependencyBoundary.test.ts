/**
 * This test file verifies that the 3D entity engine remains independent and clean.
 *
 * It scans all source files in the entities3d system and ensures that none of them
 * import gameplay adapters, user interface panels, or debugging tools in the reverse
 * direction. This protects the engine so that it can be extracted or run in isolation,
 * while ensuring that gameplay-specific details remain in the adapters.
 *
 * Runs as: part of the Vitest unit testing suite.
 * Depends on: Node fs and path libraries to inspect file contents on disk.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Dependency Configuration
// ============================================================================
// Defines which directories and files are forbidden for the core engine to
// import, as well as the root directories of the project.
// ============================================================================

// The absolute path to the src/ directory, which is the root of the source code.
const SRC_DIR = path.resolve(__dirname, '../../../');

// The directory of the entities3d system we want to protect.
const SYSTEMS_DIR = path.resolve(SRC_DIR, 'systems/entities3d');

// The list of gameplay adapter files that the engine is not allowed to import.
const FORBIDDEN_ADAPTERS = [
  path.resolve(SYSTEMS_DIR, 'recipeFromCharacter.ts'),
  path.resolve(SYSTEMS_DIR, 'recipeFromCombatant.ts'),
  path.resolve(SYSTEMS_DIR, 'recipeFromOccupant.ts'),
];

// The list of directories containing UI or gameplay components that the engine must not import.
const FORBIDDEN_DIRS = [
  path.resolve(SRC_DIR, 'components'),
  path.resolve(SRC_DIR, 'devtools'),
];

// ============================================================================
// File Scanner Helpers
// ============================================================================
// Utility functions to recursively find files on disk and extract their imports.
// ============================================================================

// Recursively walks a directory and collects all TypeScript/React source files.
function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.resolve(dir, entry.name);
    
    // Skip the test folder itself to avoid checking test helper imports.
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') {
        files.push(...collectSourceFiles(fullPath));
      }
    } else if (entry.isFile()) {
      // Only check source files, excluding the gameplay adapters themselves.
      const isTsOrTsx = entry.name.endsWith('.ts') || entry.name.endsWith('.tsx');
      const isAdapter = FORBIDDEN_ADAPTERS.includes(fullPath);
      const isDeclFile = entry.name.endsWith('.d.ts');
      
      if (isTsOrTsx && !isAdapter && !isDeclFile) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

// Parses imports from a file's code text.
// Uses simple regex patterns to extract import and export-from paths.
function parseImportPaths(code: string): string[] {
  const paths: string[] = [];
  
  // Pattern to match standard: import ... from 'path'; or export ... from 'path';
  const fromRegex = /(?:import|export)\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  // Pattern to match side-effect imports: import 'path';
  const sideEffectRegex = /import\s+['"]([^'"]+)['"]/g;
  // Pattern to match dynamic imports: import('path')
  const dynamicRegex = /import\(['"]([^'"]+)['"]\)/g;

  let match;
  while ((match = fromRegex.exec(code)) !== null) {
    paths.push(match[1]);
  }
  while ((match = sideEffectRegex.exec(code)) !== null) {
    paths.push(match[1]);
  }
  while ((match = dynamicRegex.exec(code)) !== null) {
    paths.push(match[1]);
  }
  
  return paths;
}

// ============================================================================
// Boundary Checks Assertion
// ============================================================================
// The test suite that runs assertions on all collected engine files.
// ============================================================================

describe('entities3d dependency boundary', () => {
  it('enforces that no core engine files import adapters, components, or devtools', () => {
    const engineFiles = collectSourceFiles(SYSTEMS_DIR);
    
    // Track any violations we find to report them all at once rather than failing early.
    const violations: string[] = [];

    for (const filePath of engineFiles) {
      const code = fs.readFileSync(filePath, 'utf-8');
      const importPaths = parseImportPaths(code);
      const fileDir = path.dirname(filePath);

      for (const importPath of importPaths) {
        let resolvedPath = '';

        // If the path uses the project's root alias (@/), resolve it from the src/ folder.
        if (importPath.startsWith('@/')) {
          resolvedPath = path.resolve(SRC_DIR, importPath.slice(2));
        } else if (importPath.startsWith('.')) {
          // If it is a relative path, resolve it relative to the containing file's folder.
          resolvedPath = path.resolve(fileDir, importPath);
        } else {
          // Skip external library imports (like react, three).
          continue;
        }

        // Check if the import targets a forbidden adapter file.
        // We check both direct file matches and matches without extensions.
        const isForbiddenAdapter = FORBIDDEN_ADAPTERS.some(adapter => {
          const adapterNoExt = adapter.replace(/\.ts$/, '');
          return resolvedPath === adapter || resolvedPath === adapterNoExt;
        });

        if (isForbiddenAdapter) {
          violations.push(
            `File: ${path.relative(SRC_DIR, filePath)}\n` +
            `  Imports forbidden gameplay adapter: "${importPath}"`
          );
        }

        // Check if the import targets any file inside a forbidden directory.
        for (const forbiddenDir of FORBIDDEN_DIRS) {
          if (resolvedPath.startsWith(forbiddenDir)) {
            violations.push(
              `File: ${path.relative(SRC_DIR, filePath)}\n` +
              `  Imports from forbidden UI/game directory: "${importPath}"`
            );
          }
        }
      }
    }

    // Assert that no boundary violations were found.
    if (violations.length > 0) {
      expect.fail(
        `Boundary violations detected! The 3D entity engine must not depend on UI, devtools, or gameplay adapters:\n\n` +
        violations.join('\n\n')
      );
    }
  });
});
