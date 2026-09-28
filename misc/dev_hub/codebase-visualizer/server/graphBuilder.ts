/**
 * This file builds the dependency graph for all source files in src/.
 *
 * The API and sync command both call this module to get a consistent snapshot
 * of import relationships, node metadata, and bridge/orphan role classification.
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { extractCodeBlocks, extractImports, generateFileDescription, getFileCategory, isPureReExportBarrel } from './analyzer';
import { FileEdge, FileNode, GraphData } from './types';

// ============================================================================
// Source Graph Generation
// ============================================================================
// This function scans source files, extracts code metadata, builds import edges,
// and tags files as bridge/orphan/normal for richer UI rendering.
// ============================================================================

export async function generateGraphData(): Promise<GraphData> {
  const srcDir = path.join(process.cwd(), 'src');
  const repoRoot = process.cwd();

  // Scan code files first. Non-code imports get pulled in on demand once the AST
  // import pass tells us they are part of the dependency graph.
  const files = await glob('**/*.{ts,tsx}', {
    cwd: srcDir,
    ignore: ['**/*.d.ts', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/__tests__/**'],
  });

  const nodeMap = new Map<string, FileNode>();
  const contentMap = new Map<string, string>();
  const allImports: { source: string; targets: string[] }[] = [];
  const fileExistsCache = new Map<string, boolean>();

  async function isFile(fullPath: string): Promise<boolean> {
    if (fileExistsCache.has(fullPath)) {
      return fileExistsCache.get(fullPath) || false;
    }

    try {
      const stats = await fsp.stat(fullPath);
      const result = stats.isFile();
      fileExistsCache.set(fullPath, result);
      return result;
    } catch {
      fileExistsCache.set(fullPath, false);
      return false;
    }
  }

  async function readFileContentForVisualizer(fullPath: string): Promise<string> {
    const extension = path.extname(fullPath).toLowerCase();
    const textLikeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.svg']);
    if (!textLikeExtensions.has(extension)) {
      return '';
    }
    return fsp.readFile(fullPath, 'utf-8');
  }

  // This helper keeps lazily-created import targets shaped the same way as the
  // pre-scanned source nodes, even when the import resolves to JSON, SVG, or a
  // file outside src/ such as package.json.
  async function ensureNode(relativePath: string): Promise<FileNode | null> {
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const existing = nodeMap.get(normalizedPath);
    if (existing) return existing;

    const srcRelativeFullPath = path.join(srcDir, normalizedPath);
    const fullPath = await isFile(srcRelativeFullPath) ? srcRelativeFullPath : path.resolve(repoRoot, normalizedPath);
    if (!(await isFile(fullPath))) {
      return null;
    }

    const content = await readFileContentForVisualizer(fullPath);
    contentMap.set(normalizedPath, content);

    const baseName = path.basename(normalizedPath);
    let displayName = baseName;
    if (baseName === 'index.ts' || baseName === 'index.tsx') {
      const parts = normalizedPath.split('/');
      if (parts.length >= 2) {
        displayName = parts[parts.length - 2] + '/' + baseName;
      }
    }

    const node: FileNode = {
      id: normalizedPath,
      name: displayName,
      fullPath,
      relativePath: normalizedPath,
      description: generateFileDescription(normalizedPath, content),
      imports: [],
      importedBy: [],
      codeBlocks: extractCodeBlocks(content, fullPath),
      connectionCount: 0,
      category: getFileCategory(normalizedPath),
      role: 'normal',
    };

    nodeMap.set(normalizedPath, node);
    return node;
  }

  // Create nodes first so we can resolve all edges in a second pass.
  const scannedFiles = await Promise.all(files.map(async (file) => {
    const normalizedFile = file.replace(/\\/g, '/');
    const fullPath = path.join(srcDir, file);
    const content = await readFileContentForVisualizer(fullPath);
    contentMap.set(normalizedFile, content);

    await ensureNode(normalizedFile);
    return { source: normalizedFile, targets: extractImports(content, fullPath) };
  }));
  allImports.push(...scannedFiles);

  const edges: FileEdge[] = [];

  // Link nodes once all nodes exist so forward and backward relationships are accurate.
  for (const { source, targets } of allImports) {
    const sourceNode = nodeMap.get(source);
    if (!sourceNode) continue;

    for (const target of targets) {
      const targetNode = await ensureNode(target);
      if (!targetNode) continue;

      sourceNode.imports.push(target);
      targetNode.importedBy.push(source);
      edges.push({ source, target });
    }
  }

  // Compute total degree and assign role tags used by node-shape rendering.
  for (const node of nodeMap.values()) {
    node.connectionCount = node.imports.length + node.importedBy.length;

    // Bridge nodes are pure re-export barrels, not deprecated wrappers.
    const content = contentMap.get(node.relativePath) || '';
    const isBridge = isPureReExportBarrel(content);

    if (isBridge) {
      node.role = 'bridge';
    } else if (node.connectionCount === 0) {
      node.role = 'orphan';
    } else {
      node.role = 'normal';
    }
  }

  const nodes = Array.from(nodeMap.values()).sort((left, right) => right.connectionCount - left.connectionCount);
  return { nodes, edges };
}
