/**
 * Codebase Dependency Visualizer
 *
 * This script analyzes all TypeScript/TSX files in the src directory,
 * extracts their import/export relationships, parses code blocks (functions,
 * components, classes), and generates an interactive HTML visualization.
 *
 * The visualization shows:
 * - Files as circles sized by number of connections
 * - Arrows showing dependency direction (imports IN, exports OUT)
 * - Click to highlight connected files
 * - Expand files to see individual code blocks
 * - Toggle between viewing incoming/outgoing dependencies
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents a code block within a file (function, class, component, etc.)
 */
interface CodeBlock {
  name: string;           // Name of the function/class/component
  type: 'function' | 'class' | 'component' | 'hook' | 'constant' | 'type' | 'interface';
  startLine: number;      // Line number where the block starts
  endLine: number;        // Line number where the block ends
  description: string;    // Auto-generated description of what it does
  exports: boolean;       // Whether this block is exported
}

/**
 * Represents a file in the codebase with all its metadata
 */
interface FileNode {
  id: string;                  // Unique identifier (relative file path)
  name: string;                // Just the filename
  fullPath: string;            // Full absolute path
  relativePath: string;        // Path relative to src/
  description: string;         // Auto-generated description of file purpose
  imports: string[];           // Files this file imports FROM (dependencies)
  importedBy: string[];        // Files that import THIS file (dependents)
  codeBlocks: CodeBlock[];     // Individual code segments in the file
  connectionCount: number;     // Total connections (imports + importedBy)
  category: string;            // Category based on folder structure
}

/**
 * Represents a connection/edge between two files
 */
interface FileEdge {
  source: string;    // Source file ID (the file doing the importing)
  target: string;    // Target file ID (the file being imported)
}

/**
 * The complete graph data structure for visualization
 */
interface GraphData {
  nodes: FileNode[];
  edges: FileEdge[];
}

// ============================================================================
// FILE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Extracts all import statements from a file's content
 * Returns an array of file paths that this file imports
 */
function extractImports(content: string, filePath: string): string[] {
  const imports: string[] = [];

  // Split content into lines for line-by-line processing
  // This is more reliable than multiline regex
  const lines = content.split('\n');
  const allPaths = new Set<string>();

  // Track if we're in a multiline import
  let inMultilineImport = false;
  let multilineBuffer = '';

  for (const line of lines) {
    // Skip comment lines
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//')) continue;
    if (trimmedLine.startsWith('/*')) continue;
    if (trimmedLine.startsWith('*')) continue;

    if (inMultilineImport) {
      multilineBuffer += ' ' + line;
      // Check if multiline import ends on this line
      if (line.includes(';') || (line.includes("'") || line.includes('"'))) {
        // Try to extract the path from the complete import
        const pathMatch = multilineBuffer.match(/from\s+['"]([^'"]+)['"]/);
        if (pathMatch) {
          allPaths.add(pathMatch[1]);
        }
        inMultilineImport = false;
        multilineBuffer = '';
      }
      continue;
    }

    // Check for import statement
    if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('export ')) {
      // Single line import: import X from 'path' or import { X } from 'path'
      const singleLineMatch = line.match(/(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/);
      if (singleLineMatch) {
        allPaths.add(singleLineMatch[1]);
        continue;
      }

      // Side-effect import: import 'path'
      const sideEffectMatch = line.match(/import\s+['"]([^'"]+)['"]/);
      if (sideEffectMatch && !line.includes(' from ')) {
        allPaths.add(sideEffectMatch[1]);
        continue;
      }

      // Check for multiline import starting
      if (line.includes('{') && !line.includes('}')) {
        inMultilineImport = true;
        multilineBuffer = line;
        continue;
      }

      // Also check for import with just type/name that continues
      if (trimmedLine.startsWith('import ') && !line.includes("'") && !line.includes('"')) {
        inMultilineImport = true;
        multilineBuffer = line;
        continue;
      }
    }
  }

  // Process each found path
  for (const importPath of allPaths) {
    // Only process relative imports (not node_modules packages)
    if (importPath.startsWith('.') || importPath.startsWith('@/')) {
      // Resolve the import path relative to the current file
      const resolvedPath = resolveImportPath(importPath, filePath);
      if (resolvedPath) {
        imports.push(resolvedPath);
      }
    }
  }

  return imports;
}

/**
 * Resolves an import path to a normalized relative path from src/
 * Handles various import patterns like './file', '../folder/file', '@/alias'
 */
function resolveImportPath(importPath: string, currentFilePath: string): string | null {
  const srcDir = path.join(process.cwd(), 'src');
  const currentDir = path.dirname(currentFilePath);

  let resolvedPath: string;

  // Handle @/ alias (common in many projects to reference src/)
  if (importPath.startsWith('@/')) {
    resolvedPath = path.join(srcDir, importPath.slice(2));
  } else {
    // Handle relative paths
    resolvedPath = path.resolve(currentDir, importPath);
  }

  // Try to find the actual file with various extensions
  // Order matters - try exact match first, then with extensions, then index files
  const extensions = [
    '',           // Exact path (might already have extension)
    '.ts',        // TypeScript file
    '.tsx',       // TypeScript React file
    '.js',        // JavaScript file
    '.jsx',       // JavaScript React file
    '/index.ts',  // Directory with index.ts
    '/index.tsx', // Directory with index.tsx
    '/index.js',  // Directory with index.js
    '/index.jsx', // Directory with index.jsx
  ];

  for (const ext of extensions) {
    const fullPath = resolvedPath + ext;
    try {
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          // Return path relative to src/
          return path.relative(srcDir, fullPath).replace(/\\/g, '/');
        }
      }
    } catch {
      // Ignore errors (e.g., permission issues)
    }
  }

  return null;
}

/**
 * Extracts code blocks (functions, classes, components) from file content
 * This gives us the "inner structure" of each file for the expanded view
 */
function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = content.split('\n');

  // Track export keywords for determining if blocks are exported
  const exportedNames = new Set<string>();

  // First pass: find all export statements to know what's exported
  const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class|type|interface)\s+(\w+)/g;
  let exportMatch;
  while ((exportMatch = exportRegex.exec(content)) !== null) {
    exportedNames.add(exportMatch[1]);
  }

  // Also find named exports at the bottom of files
  const namedExportRegex = /export\s*\{\s*([^}]+)\s*\}/g;
  while ((exportMatch = namedExportRegex.exec(content)) !== null) {
    const names = exportMatch[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
    names.forEach(n => exportedNames.add(n));
  }

  // Pattern for React functional components (arrow function or function declaration)
  const componentRegex = /(?:export\s+)?(?:const|function)\s+([A-Z][a-zA-Z0-9]*)\s*(?::\s*React\.FC[^=]*)?=?\s*(?:\([^)]*\)|[^=]*)(?:=>|\{)/g;

  // Pattern for regular functions
  const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+([a-z][a-zA-Z0-9]*)\s*\(/g;

  // Pattern for arrow function constants (non-component)
  const arrowFnRegex = /(?:export\s+)?const\s+([a-z][a-zA-Z0-9]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/g;

  // Pattern for classes
  const classRegex = /(?:export\s+)?class\s+([A-Z][a-zA-Z0-9]*)/g;

  // Pattern for hooks (functions starting with 'use')
  const hookRegex = /(?:export\s+)?(?:const|function)\s+(use[A-Z][a-zA-Z0-9]*)\s*(?:=|<|\()/g;

  // Pattern for type definitions
  const typeRegex = /(?:export\s+)?type\s+([A-Z][a-zA-Z0-9]*)\s*(?:<[^>]*>)?\s*=/g;

  // Pattern for interface definitions
  const interfaceRegex = /(?:export\s+)?interface\s+([A-Z][a-zA-Z0-9]*)/g;

  /**
   * Helper function to find the line number where a pattern match occurs
   */
  function findLineNumber(matchIndex: number): number {
    const beforeMatch = content.slice(0, matchIndex);
    return beforeMatch.split('\n').length;
  }

  /**
   * Helper function to estimate the end line of a code block
   * Uses brace counting to find matching closing brace
   */
  function findBlockEnd(startLine: number): number {
    let braceCount = 0;
    let started = false;

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (started && braceCount === 0) {
        return i + 1;
      }
    }

    return Math.min(startLine + 20, lines.length);
  }

  /**
   * Helper to generate a description based on the code block name and type
   */
  function generateDescription(name: string, type: CodeBlock['type']): string {
    const readable = name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();

    switch (type) {
      case 'component':
        return 'React component that renders ' + readable.toLowerCase();
      case 'hook':
        return 'Custom hook for ' + readable.replace(/^Use /, '').toLowerCase() + ' logic';
      case 'function':
        return 'Function that handles ' + readable.toLowerCase();
      case 'class':
        return 'Class that manages ' + readable.toLowerCase();
      case 'type':
        return 'Type definition for ' + readable.toLowerCase() + ' data';
      case 'interface':
        return 'Interface defining ' + readable.toLowerCase() + ' structure';
      case 'constant':
        return 'Constant value for ' + readable.toLowerCase();
      default:
        return readable;
    }
  }

  // Extract hooks first
  let match;
  while ((match = hookRegex.exec(content)) !== null) {
    const startLine = findLineNumber(match.index);
    blocks.push({
      name: match[1],
      type: 'hook',
      startLine,
      endLine: findBlockEnd(startLine),
      description: generateDescription(match[1], 'hook'),
      exports: exportedNames.has(match[1]) || match[0].includes('export')
    });
  }

  // Extract components
  while ((match = componentRegex.exec(content)) !== null) {
    const name = match[1];
    if (blocks.some(b => b.name === name)) continue;

    const startLine = findLineNumber(match.index);
    blocks.push({
      name,
      type: 'component',
      startLine,
      endLine: findBlockEnd(startLine),
      description: generateDescription(name, 'component'),
      exports: exportedNames.has(name) || match[0].includes('export')
    });
  }

  // Extract regular functions
  while ((match = functionRegex.exec(content)) !== null) {
    const name = match[1];
    if (blocks.some(b => b.name === name)) continue;

    const startLine = findLineNumber(match.index);
    blocks.push({
      name,
      type: 'function',
      startLine,
      endLine: findBlockEnd(startLine),
      description: generateDescription(name, 'function'),
      exports: exportedNames.has(name) || match[0].includes('export')
    });
  }

  // Extract arrow functions
  while ((match = arrowFnRegex.exec(content)) !== null) {
    const name = match[1];
    if (blocks.some(b => b.name === name)) continue;

    const startLine = findLineNumber(match.index);
    blocks.push({
      name,
      type: 'function',
      startLine,
      endLine: findBlockEnd(startLine),
      description: generateDescription(name, 'function'),
      exports: exportedNames.has(name) || match[0].includes('export')
    });
  }

  // Extract classes
  while ((match = classRegex.exec(content)) !== null) {
    const name = match[1];
    if (blocks.some(b => b.name === name)) continue;

    const startLine = findLineNumber(match.index);
    blocks.push({
      name,
      type: 'class',
      startLine,
      endLine: findBlockEnd(startLine),
      description: generateDescription(name, 'class'),
      exports: exportedNames.has(name) || match[0].includes('export')
    });
  }

  // Extract types
  while ((match = typeRegex.exec(content)) !== null) {
    const name = match[1];
    if (blocks.some(b => b.name === name)) continue;

    const startLine = findLineNumber(match.index);
    blocks.push({
      name,
      type: 'type',
      startLine,
      endLine: startLine + 5,
      description: generateDescription(name, 'type'),
      exports: exportedNames.has(name) || match[0].includes('export')
    });
  }

  // Extract interfaces
  while ((match = interfaceRegex.exec(content)) !== null) {
    const name = match[1];
    if (blocks.some(b => b.name === name)) continue;

    const startLine = findLineNumber(match.index);
    blocks.push({
      name,
      type: 'interface',
      startLine,
      endLine: findBlockEnd(startLine),
      description: generateDescription(name, 'interface'),
      exports: exportedNames.has(name) || match[0].includes('export')
    });
  }

  blocks.sort((a, b) => a.startLine - b.startLine);

  return blocks;
}

/**
 * Generates a description of what a file does based on its path and content
 */
function generateFileDescription(relativePath: string, content: string): string {
  const fileName = path.basename(relativePath, path.extname(relativePath));
  const dirName = path.dirname(relativePath);

  // Extract any JSDoc comments at the top of the file
  const topCommentMatch = content.match(/^\/\*\*[\s\S]*?\*\//);
  if (topCommentMatch) {
    const descMatch = topCommentMatch[0].match(/\*\s+([^@\n*]+)/);
    if (descMatch) {
      return descMatch[1].trim();
    }
  }

  const parts = dirName.split('/').filter(p => p && p !== '.');

  if (fileName.endsWith('.test') || fileName.endsWith('.spec')) {
    return 'Tests for ' + fileName.replace(/\.test$|\.spec$/, '');
  }

  if (parts.includes('hooks')) {
    return 'Custom React hook for ' + fileName.replace(/^use/, '') + ' functionality';
  }

  if (parts.includes('components')) {
    return 'UI component for rendering ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  }

  if (parts.includes('utils') || parts.includes('helpers')) {
    return 'Utility functions for ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  }

  if (parts.includes('services')) {
    return 'Service layer for ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase() + ' operations';
  }

  if (parts.includes('state') || parts.includes('store')) {
    return 'State management for ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  }

  if (parts.includes('types')) {
    return 'Type definitions for ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  }

  if (parts.includes('reducers')) {
    return 'Redux reducer for ' + fileName.replace(/Reducer$/, '') + ' state';
  }

  if (parts.includes('systems')) {
    return 'Game system logic for ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  }

  const readable = fileName.replace(/([A-Z])/g, ' $1').trim();
  return 'Module for ' + readable.toLowerCase();
}

/**
 * Determines the category of a file based on its directory structure
 */
function getFileCategory(relativePath: string): string {
  const parts = relativePath.split('/');

  if (parts.length > 1) {
    return parts[0];
  }

  return 'root';
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyzes the entire codebase and builds the dependency graph
 */
async function analyzeCodebase(): Promise<GraphData> {
  const srcDir = path.join(process.cwd(), 'src');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: srcDir,
    ignore: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/__tests__/**']
  });

  console.log('Found ' + files.length + ' source files to analyze...');

  const nodeMap = new Map<string, FileNode>();
  const allImports: { source: string; targets: string[] }[] = [];

  for (const file of files) {
    // Normalize file path to use forward slashes consistently
    const normalizedFile = file.replace(/\\/g, '/');
    const fullPath = path.join(srcDir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');

    const node: FileNode = {
      id: normalizedFile,
      name: path.basename(file),
      fullPath,
      relativePath: normalizedFile,
      description: generateFileDescription(normalizedFile, content),
      imports: [],
      importedBy: [],
      codeBlocks: extractCodeBlocks(content),
      connectionCount: 0,
      category: getFileCategory(normalizedFile)
    };

    nodeMap.set(normalizedFile, node);

    const imports = extractImports(content, fullPath);
    allImports.push({ source: normalizedFile, targets: imports });
  }

  const edges: FileEdge[] = [];

  for (const { source, targets } of allImports) {
    const sourceNode = nodeMap.get(source);
    if (!sourceNode) continue;

    for (const target of targets) {
      const targetNode = nodeMap.get(target);
      if (!targetNode) continue;

      sourceNode.imports.push(target);
      targetNode.importedBy.push(source);

      edges.push({ source, target });
    }
  }

  for (const node of nodeMap.values()) {
    node.connectionCount = node.imports.length + node.importedBy.length;
  }

  const nodes = Array.from(nodeMap.values())
    .sort((a, b) => b.connectionCount - a.connectionCount);

  console.log('Analysis complete: ' + nodes.length + ' nodes, ' + edges.length + ' edges');

  return { nodes, edges };
}

// ============================================================================
// HTML GENERATION - Using string concatenation to avoid template literal issues
// ============================================================================

/**
 * Generates the complete HTML file with embedded D3.js visualization
 */
function generateVisualizationHTML(data: GraphData): string {
  const jsonData = JSON.stringify(data);

  // Build the HTML as an array of lines to avoid template literal escaping issues
  const htmlParts: string[] = [];

  htmlParts.push('<!DOCTYPE html>');
  htmlParts.push('<html lang="en">');
  htmlParts.push('<head>');
  htmlParts.push('  <meta charset="UTF-8">');
  htmlParts.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  htmlParts.push('  <title>Codebase Dependency Visualizer - Aralia</title>');
  htmlParts.push('  <script src="https://d3js.org/d3.v7.min.js"></script>');
  htmlParts.push('  <style>');
  htmlParts.push(getCSS());
  htmlParts.push('  </style>');
  htmlParts.push('</head>');
  htmlParts.push('<body>');
  htmlParts.push(getHTMLBody());
  htmlParts.push('  <script>');
  htmlParts.push('    const graphData = ' + jsonData + ';');
  htmlParts.push(getJavaScript());
  htmlParts.push('  </script>');
  htmlParts.push('</body>');
  htmlParts.push('</html>');

  return htmlParts.join('\n');
}

function getCSS(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      overflow: hidden;
      height: 100vh;
    }
    .container { display: flex; height: 100vh; }
    .sidebar {
      width: 350px;
      background: rgba(30, 30, 50, 0.95);
      border-right: 1px solid #3a3a5a;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .sidebar-header {
      padding: 20px;
      border-bottom: 1px solid #3a3a5a;
      background: rgba(40, 40, 60, 0.5);
    }
    .sidebar-header h1 { font-size: 1.3em; color: #7dd3fc; margin-bottom: 5px; }
    .sidebar-header p { font-size: 0.85em; color: #888; }
    .controls {
      padding: 15px 20px;
      border-bottom: 1px solid #3a3a5a;
      background: rgba(35, 35, 55, 0.5);
    }
    .control-group { margin-bottom: 12px; }
    .control-group:last-child { margin-bottom: 0; }
    .control-group label {
      display: block;
      font-size: 0.8em;
      color: #aaa;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .toggle-buttons { display: flex; gap: 8px; }
    .toggle-btn {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #4a4a6a;
      background: transparent;
      color: #aaa;
      font-size: 0.85em;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .toggle-btn:hover { background: rgba(125, 211, 252, 0.1); border-color: #7dd3fc; }
    .toggle-btn.active { background: rgba(125, 211, 252, 0.2); border-color: #7dd3fc; color: #7dd3fc; }
    .search-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #4a4a6a;
      background: rgba(20, 20, 35, 0.8);
      color: #e0e0e0;
      font-size: 0.9em;
      border-radius: 4px;
    }
    .search-input:focus { outline: none; border-color: #7dd3fc; }
    .search-input::placeholder { color: #666; }
    .file-list { flex: 1; overflow-y: auto; padding: 10px; }
    .file-item {
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
    }
    .file-item:hover { background: rgba(125, 211, 252, 0.1); border-color: rgba(125, 211, 252, 0.3); }
    .file-item.selected { background: rgba(125, 211, 252, 0.15); border-color: #7dd3fc; }
    .file-name { font-weight: 500; font-size: 0.95em; color: #e0e0e0; margin-bottom: 4px; }
    .file-path { font-size: 0.75em; color: #888; margin-bottom: 6px; }
    .file-stats { display: flex; gap: 12px; font-size: 0.75em; }
    .stat { display: flex; align-items: center; gap: 4px; }
    .stat-in { color: #4ade80; }
    .stat-out { color: #f97316; }
    .stat-blocks { color: #a78bfa; }
    .detail-panel {
      display: none;
      padding: 15px 20px;
      border-top: 1px solid #3a3a5a;
      background: rgba(35, 35, 55, 0.8);
      max-height: 300px;
      overflow-y: auto;
    }
    .detail-panel.visible { display: block; }
    .detail-panel h3 { font-size: 1em; color: #7dd3fc; margin-bottom: 8px; }
    .detail-panel p { font-size: 0.85em; color: #aaa; margin-bottom: 12px; line-height: 1.5; }
    .code-blocks-list { list-style: none; }
    .code-block-item {
      padding: 8px 10px;
      background: rgba(20, 20, 35, 0.5);
      border-radius: 4px;
      margin-bottom: 6px;
      border-left: 3px solid;
    }
    .code-block-item.type-component { border-color: #7dd3fc; }
    .code-block-item.type-hook { border-color: #a78bfa; }
    .code-block-item.type-function { border-color: #4ade80; }
    .code-block-item.type-class { border-color: #f97316; }
    .code-block-item.type-type { border-color: #fbbf24; }
    .code-block-item.type-interface { border-color: #f472b6; }
    .block-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .block-name { font-weight: 500; font-size: 0.9em; }
    .block-type { font-size: 0.7em; padding: 2px 6px; border-radius: 3px; background: rgba(255,255,255,0.1); text-transform: uppercase; }
    .block-desc { font-size: 0.8em; color: #888; }
    .graph-container { flex: 1; position: relative; overflow: hidden; }
    #graph { width: 100%; height: 100%; }
    .node { cursor: pointer; transition: opacity 0.3s; }
    .node circle { stroke: #fff; stroke-width: 1.5px; transition: all 0.3s; }
    .node:hover circle { stroke-width: 3px; }
    .node.selected circle { stroke: #7dd3fc; stroke-width: 4px; }
    .node.highlighted circle { stroke: #fbbf24; stroke-width: 3px; }
    .node.dimmed { opacity: 0.15; }
    .node-label { font-size: 10px; fill: #fff; text-anchor: middle; pointer-events: none; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
    .link { fill: none; stroke-opacity: 0.4; transition: all 0.3s; }
    .link.dimmed { stroke-opacity: 0.05; }
    .link.highlighted-in { stroke: #4ade80 !important; stroke-opacity: 0.8 !important; stroke-width: 2px !important; }
    .link.highlighted-out { stroke: #f97316 !important; stroke-opacity: 0.8 !important; stroke-width: 2px !important; }
    .tooltip {
      position: absolute;
      padding: 12px 16px;
      background: rgba(30, 30, 50, 0.95);
      border: 1px solid #4a4a6a;
      border-radius: 6px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      max-width: 300px;
      z-index: 1000;
    }
    .tooltip.visible { opacity: 1; }
    .tooltip-title { font-weight: 600; color: #7dd3fc; margin-bottom: 6px; }
    .tooltip-desc { font-size: 0.85em; color: #aaa; margin-bottom: 8px; }
    .tooltip-stats { display: flex; gap: 16px; font-size: 0.8em; }
    .legend {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: rgba(30, 30, 50, 0.9);
      border: 1px solid #4a4a6a;
      border-radius: 6px;
      padding: 12px 16px;
    }
    .legend-title { font-size: 0.8em; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 0.85em; }
    .legend-color { width: 12px; height: 12px; border-radius: 50%; }
    .expanded-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(10, 10, 20, 0.95);
      display: none;
      flex-direction: column;
      z-index: 100;
    }
    .expanded-overlay.visible { display: flex; }
    .expanded-header {
      padding: 20px 30px;
      border-bottom: 1px solid #3a3a5a;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .expanded-title h2 { color: #7dd3fc; font-size: 1.3em; margin-bottom: 5px; }
    .expanded-title p { color: #888; font-size: 0.9em; }
    .close-expanded {
      padding: 10px 20px;
      background: transparent;
      border: 1px solid #4a4a6a;
      color: #aaa;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
      transition: all 0.2s;
    }
    .close-expanded:hover { border-color: #7dd3fc; color: #7dd3fc; }
    .expanded-content { flex: 1; overflow: hidden; position: relative; }
    #expanded-graph { width: 100%; height: 100%; }
  `;
}

function getHTMLBody(): string {
  return `
  <div class="container">
    <div class="sidebar">
      <div class="sidebar-header">
        <h1>Codebase Visualizer</h1>
        <p>Click nodes to explore dependencies. Double-click to expand.</p>
      </div>
      <div class="controls">
        <div class="control-group">
          <label>Dependency View</label>
          <div class="toggle-buttons">
            <button class="toggle-btn active" data-mode="all">All</button>
            <button class="toggle-btn" data-mode="in">Imports</button>
            <button class="toggle-btn" data-mode="out">Exports</button>
          </div>
        </div>
        <div class="control-group">
          <label>Search Files</label>
          <input type="text" class="search-input" placeholder="Type to filter files...">
        </div>
      </div>
      <div class="file-list" id="fileList"></div>
      <div class="detail-panel" id="detailPanel">
        <h3 id="detailTitle">File Details</h3>
        <p id="detailDesc">Select a file to see details</p>
        <ul class="code-blocks-list" id="codeBlocksList"></ul>
      </div>
    </div>
    <div class="graph-container">
      <svg id="graph"></svg>
      <div class="tooltip" id="tooltip">
        <div class="tooltip-title" id="tooltipTitle"></div>
        <div class="tooltip-desc" id="tooltipDesc"></div>
        <div class="tooltip-stats">
          <span class="stat stat-in"><span id="tooltipIn">0</span> imports</span>
          <span class="stat stat-out"><span id="tooltipOut">0</span> dependents</span>
        </div>
      </div>
      <div class="legend" id="legend">
        <div class="legend-title">Categories</div>
      </div>
      <div class="expanded-overlay" id="expandedOverlay">
        <div class="expanded-header">
          <div class="expanded-title">
            <h2 id="expandedFileName">File Name</h2>
            <p id="expandedFileDesc">Description</p>
          </div>
          <button class="close-expanded" id="closeExpanded">Close (Esc)</button>
        </div>
        <div class="expanded-content">
          <svg id="expanded-graph"></svg>
        </div>
      </div>
    </div>
  </div>
  `;
}

function getJavaScript(): string {
  return `
    var categoryColors = {
      'components': '#7dd3fc',
      'hooks': '#a78bfa',
      'utils': '#4ade80',
      'services': '#f97316',
      'state': '#fbbf24',
      'types': '#f472b6',
      'systems': '#22d3ee',
      'commands': '#c084fc',
      'assets': '#94a3b8',
      'data': '#fb923c',
      'contexts': '#34d399',
      'root': '#e0e0e0'
    };

    var selectedNode = null;
    var dependencyMode = 'all';
    var searchFilter = '';
    var simulation = null;
    var expandedSimulation = null;
    var graphElements = null;

    function init() {
      buildLegend();
      buildFileList();
      createGraph();
      setupEventListeners();
    }

    function buildLegend() {
      var legend = document.getElementById('legend');
      var categories = [];
      var seen = {};
      graphData.nodes.forEach(function(n) {
        if (!seen[n.category]) {
          seen[n.category] = true;
          categories.push(n.category);
        }
      });

      categories.forEach(function(cat) {
        var color = categoryColors[cat] || '#888';
        var item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = '<div class="legend-color" style="background: ' + color + '"></div><span>' + cat + '</span>';
        legend.appendChild(item);
      });
    }

    function buildFileList() {
      var container = document.getElementById('fileList');
      container.innerHTML = '';

      var filteredNodes = graphData.nodes.filter(function(node) {
        if (!searchFilter) return true;
        var searchLower = searchFilter.toLowerCase();
        return node.name.toLowerCase().indexOf(searchLower) !== -1 ||
               node.relativePath.toLowerCase().indexOf(searchLower) !== -1;
      });

      filteredNodes.forEach(function(node) {
        var item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.id = node.id;

        if (selectedNode && selectedNode.id === node.id) {
          item.classList.add('selected');
        }

        item.innerHTML = '<div class="file-name">' + node.name + '</div>' +
          '<div class="file-path">' + node.relativePath + '</div>' +
          '<div class="file-stats">' +
          '<span class="stat stat-in">&#x2190; ' + node.imports.length + ' imports</span>' +
          '<span class="stat stat-out">' + node.importedBy.length + ' dependents &#x2192;</span>' +
          '<span class="stat stat-blocks">' + node.codeBlocks.length + ' blocks</span>' +
          '</div>';

        item.addEventListener('click', function() { selectNode(node); });
        item.addEventListener('dblclick', function() { expandNode(node); });

        container.appendChild(item);
      });
    }

    function updateDetailPanel(node) {
      var panel = document.getElementById('detailPanel');
      var title = document.getElementById('detailTitle');
      var desc = document.getElementById('detailDesc');
      var blocksList = document.getElementById('codeBlocksList');

      if (!node) {
        panel.classList.remove('visible');
        return;
      }

      panel.classList.add('visible');
      title.textContent = node.name;
      desc.textContent = node.description;

      blocksList.innerHTML = '';
      node.codeBlocks.forEach(function(block) {
        var li = document.createElement('li');
        li.className = 'code-block-item type-' + block.type;
        li.innerHTML = '<div class="block-header">' +
          '<span class="block-name">' + block.name + '</span>' +
          '<span class="block-type">' + block.type + '</span>' +
          '</div>' +
          '<div class="block-desc">' + block.description + '</div>';
        blocksList.appendChild(li);
      });

      if (node.codeBlocks.length === 0) {
        blocksList.innerHTML = '<li style="color: #666; font-size: 0.85em;">No code blocks extracted</li>';
      }
    }

    function createGraph() {
      var svg = d3.select('#graph');
      var container = document.querySelector('.graph-container');
      var width = container.clientWidth;
      var height = container.clientHeight;

      svg.attr('width', width).attr('height', height);
      svg.selectAll('*').remove();

      var zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', function(event) {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);

      var g = svg.append('g');

      var defs = svg.append('defs');

      defs.append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#666');

      defs.append('marker')
        .attr('id', 'arrow-in')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#4ade80');

      defs.append('marker')
        .attr('id', 'arrow-out')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#f97316');

      var maxConnections = 0;
      graphData.nodes.forEach(function(n) {
        if (n.connectionCount > maxConnections) maxConnections = n.connectionCount;
      });

      var sizeScale = d3.scaleSqrt()
        .domain([0, maxConnections])
        .range([6, 40]);

      simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.edges)
          .id(function(d) { return d.id; })
          .distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(function(d) { return sizeScale(d.connectionCount) + 5; }));

      var links = g.append('g')
        .selectAll('line')
        .data(graphData.edges)
        .enter()
        .append('line')
        .attr('class', 'link')
        .attr('stroke', '#666')
        .attr('stroke-width', 1)
        .attr('marker-end', 'url(#arrow)');

      var nodes = g.append('g')
        .selectAll('.node')
        .data(graphData.nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .call(d3.drag()
          .on('start', dragStarted)
          .on('drag', dragged)
          .on('end', dragEnded));

      nodes.append('circle')
        .attr('r', function(d) { return sizeScale(d.connectionCount); })
        .attr('fill', function(d) { return categoryColors[d.category] || '#888'; });

      nodes.append('text')
        .attr('class', 'node-label')
        .attr('dy', function(d) { return sizeScale(d.connectionCount) + 12; })
        .text(function(d) { return d.connectionCount > 3 ? d.name : ''; })
        .style('font-size', function(d) { return Math.max(8, sizeScale(d.connectionCount) / 2) + 'px'; });

      nodes
        .on('click', function(event, d) {
          event.stopPropagation();
          selectNode(d);
        })
        .on('dblclick', function(event, d) {
          event.stopPropagation();
          expandNode(d);
        })
        .on('mouseover', function(event, d) { showTooltip(event, d); })
        .on('mouseout', hideTooltip);

      svg.on('click', function() { selectNode(null); });

      simulation.on('tick', function() {
        links
          .attr('x1', function(d) { return d.source.x; })
          .attr('y1', function(d) { return d.source.y; })
          .attr('x2', function(d) { return d.target.x; })
          .attr('y2', function(d) { return d.target.y; });

        nodes.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
      });

      graphElements = { nodes: nodes, links: links, sizeScale: sizeScale };
    }

    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    function selectNode(node) {
      selectedNode = node;

      document.querySelectorAll('.file-item').forEach(function(item) {
        if (node && item.dataset.id === node.id) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
      });

      updateDetailPanel(node);
      updateGraphHighlighting();
    }

    function updateGraphHighlighting() {
      if (!graphElements) return;

      var nodes = graphElements.nodes;
      var links = graphElements.links;

      if (!selectedNode) {
        nodes.classed('selected', false)
             .classed('highlighted', false)
             .classed('dimmed', false);
        links.classed('highlighted-in', false)
             .classed('highlighted-out', false)
             .classed('dimmed', false)
             .attr('marker-end', 'url(#arrow)');
        return;
      }

      var connectedNodes = {};
      connectedNodes[selectedNode.id] = true;
      var incomingEdges = {};
      var outgoingEdges = {};

      if (dependencyMode === 'all' || dependencyMode === 'in') {
        selectedNode.imports.forEach(function(id) {
          connectedNodes[id] = true;
          incomingEdges[selectedNode.id + '->' + id] = true;
        });
      }

      if (dependencyMode === 'all' || dependencyMode === 'out') {
        selectedNode.importedBy.forEach(function(id) {
          connectedNodes[id] = true;
          outgoingEdges[id + '->' + selectedNode.id] = true;
        });
      }

      nodes.classed('selected', function(d) { return d.id === selectedNode.id; })
           .classed('highlighted', function(d) { return d.id !== selectedNode.id && connectedNodes[d.id]; })
           .classed('dimmed', function(d) { return !connectedNodes[d.id]; });

      links.each(function(d) {
        var link = d3.select(this);
        var edgeKeyForward = d.source.id + '->' + d.target.id;
        var edgeKeyReverse = d.target.id + '->' + d.source.id;

        var isIncoming = incomingEdges[edgeKeyForward] || incomingEdges[edgeKeyReverse];
        var isOutgoing = outgoingEdges[edgeKeyForward] || outgoingEdges[edgeKeyReverse];
        var isConnected = isIncoming || isOutgoing;

        link.classed('highlighted-in', isIncoming)
            .classed('highlighted-out', isOutgoing)
            .classed('dimmed', !isConnected);

        if (isIncoming) {
          link.attr('marker-end', 'url(#arrow-in)');
        } else if (isOutgoing) {
          link.attr('marker-end', 'url(#arrow-out)');
        } else {
          link.attr('marker-end', 'url(#arrow)');
        }
      });
    }

    function showTooltip(event, node) {
      var tooltip = document.getElementById('tooltip');
      document.getElementById('tooltipTitle').textContent = node.name;
      document.getElementById('tooltipDesc').textContent = node.description;
      document.getElementById('tooltipIn').textContent = node.imports.length;
      document.getElementById('tooltipOut').textContent = node.importedBy.length;

      tooltip.style.left = (event.pageX + 15) + 'px';
      tooltip.style.top = (event.pageY + 15) + 'px';
      tooltip.classList.add('visible');
    }

    function hideTooltip() {
      document.getElementById('tooltip').classList.remove('visible');
    }

    function expandNode(node) {
      if (!node || node.codeBlocks.length === 0) return;

      var overlay = document.getElementById('expandedOverlay');
      document.getElementById('expandedFileName').textContent = node.name;
      document.getElementById('expandedFileDesc').textContent = node.description + ' - ' + node.codeBlocks.length + ' code blocks';

      overlay.classList.add('visible');
      createExpandedGraph(node);
    }

    function createExpandedGraph(fileNode) {
      var svg = d3.select('#expanded-graph');
      var container = document.querySelector('.expanded-content');
      var width = container.clientWidth;
      var height = container.clientHeight;

      svg.attr('width', width).attr('height', height);
      svg.selectAll('*').remove();

      var zoom = d3.zoom()
        .scaleExtent([0.5, 3])
        .on('zoom', function(event) { g.attr('transform', event.transform); });

      svg.call(zoom);

      var g = svg.append('g');

      var blockColors = {
        'component': '#7dd3fc',
        'hook': '#a78bfa',
        'function': '#4ade80',
        'class': '#f97316',
        'type': '#fbbf24',
        'interface': '#f472b6',
        'constant': '#94a3b8'
      };

      var centerNode = {
        id: 'center',
        name: fileNode.name,
        type: 'file',
        description: fileNode.description,
        isCenter: true
      };

      var blockNodes = fileNode.codeBlocks.map(function(block, i) {
        return {
          id: 'block-' + i,
          name: block.name,
          type: block.type,
          description: block.description,
          exports: block.exports,
          isCenter: false
        };
      });

      var allNodes = [centerNode].concat(blockNodes);

      var edges = blockNodes.map(function(block) {
        return { source: 'center', target: block.id };
      });

      function sizeScale(d) {
        if (d.isCenter) return 50;
        return d.exports ? 25 : 18;
      }

      expandedSimulation = d3.forceSimulation(allNodes)
        .force('link', d3.forceLink(edges).id(function(d) { return d.id; }).distance(120))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(function(d) { return sizeScale(d) + 10; }));

      var links = g.append('g')
        .selectAll('line')
        .data(edges)
        .enter()
        .append('line')
        .attr('stroke', '#4a4a6a')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5');

      var nodes = g.append('g')
        .selectAll('.expanded-node')
        .data(allNodes)
        .enter()
        .append('g')
        .attr('class', 'expanded-node')
        .style('cursor', 'default');

      nodes.append('circle')
        .attr('r', sizeScale)
        .attr('fill', function(d) { return d.isCenter ? categoryColors[fileNode.category] : blockColors[d.type]; })
        .attr('stroke', function(d) { return d.exports ? '#fff' : 'none'; })
        .attr('stroke-width', 2);

      nodes.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', function(d) { return sizeScale(d) + 15; })
        .attr('fill', '#fff')
        .style('font-size', '11px')
        .text(function(d) { return d.name; });

      nodes.filter(function(d) { return !d.isCenter; })
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', function(d) { return sizeScale(d) + 28; })
        .attr('fill', '#888')
        .style('font-size', '9px')
        .text(function(d) { return d.type; });

      expandedSimulation.on('tick', function() {
        links
          .attr('x1', function(d) { return d.source.x; })
          .attr('y1', function(d) { return d.source.y; })
          .attr('x2', function(d) { return d.target.x; })
          .attr('y2', function(d) { return d.target.y; });

        nodes.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
      });
    }

    function closeExpandedView() {
      document.getElementById('expandedOverlay').classList.remove('visible');
      if (expandedSimulation) {
        expandedSimulation.stop();
      }
    }

    function setupEventListeners() {
      document.querySelectorAll('.toggle-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.toggle-btn').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          dependencyMode = btn.dataset.mode;
          updateGraphHighlighting();
        });
      });

      document.querySelector('.search-input').addEventListener('input', function(e) {
        searchFilter = e.target.value;
        buildFileList();
      });

      document.getElementById('closeExpanded').addEventListener('click', closeExpandedView);

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          closeExpandedView();
        }
      });

      window.addEventListener('resize', function() {
        createGraph();
        if (selectedNode) {
          updateGraphHighlighting();
        }
      });
    }

    init();
  `;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('Starting codebase analysis...');

  const graphData = await analyzeCodebase();

  const html = generateVisualizationHTML(graphData);

  const outputPath = path.join(process.cwd(), 'codebase-visualization.html');
  fs.writeFileSync(outputPath, html, 'utf-8');

  console.log('\nVisualization generated: ' + outputPath);
  console.log('Open this file in a web browser to explore your codebase!');

  console.log('\nSummary:');
  console.log('- Total files: ' + graphData.nodes.length);
  console.log('- Total connections: ' + graphData.edges.length);

  console.log('\nTop 10 most connected files:');
  graphData.nodes.slice(0, 10).forEach(function(node, i) {
    console.log('  ' + (i + 1) + '. ' + node.name + ' (' + node.connectionCount + ' connections)');
  });
}

main().catch(console.error);
