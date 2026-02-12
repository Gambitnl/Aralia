/**
 * Codebase Visualizer Server
 *
 * A simple HTTP server that serves the visualization and provides
 * an API endpoint to regenerate the graph data on demand.
 *
 * Run with: npx tsx scripts/codebase-visualizer-server.ts
 * Then open: http://localhost:3847
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { exec, execSync } from 'child_process';

// ============================================================================
// TYPE DEFINITIONS (same as main visualizer)
// ============================================================================

interface CodeBlock {
  name: string;
  type: 'function' | 'class' | 'component' | 'hook' | 'constant' | 'type' | 'interface';
  startLine: number;
  endLine: number;
  description: string;
  exports: boolean;
}

interface FileNode {
  id: string;
  name: string;
  fullPath: string;
  relativePath: string;
  description: string;
  imports: string[];
  importedBy: string[];
  codeBlocks: CodeBlock[];
  connectionCount: number;
  category: string;
  role: 'normal' | 'bridge' | 'orphan';
}

interface FileEdge {
  source: string;
  target: string;
}

interface GraphData {
  nodes: FileNode[];
  edges: FileEdge[];
}

// ============================================================================
// ANALYSIS FUNCTIONS (copied from main visualizer for standalone operation)
// ============================================================================

function extractImports(content: string, filePath: string): string[] {
  const imports: string[] = [];
  const lines = content.split('\n');
  const allPaths = new Set<string>();
  let inMultilineImport = false;
  let multilineBuffer = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//')) continue;
    if (trimmedLine.startsWith('/*')) continue;
    if (trimmedLine.startsWith('*')) continue;

    if (inMultilineImport) {
      multilineBuffer += ' ' + line;
      if (line.includes(';') || (line.includes("'") || line.includes('"'))) {
        const pathMatch = multilineBuffer.match(/from\s+['"]([^'"]+)['"]/);
        if (pathMatch) {
          allPaths.add(pathMatch[1]);
        }
        inMultilineImport = false;
        multilineBuffer = '';
      }
      continue;
    }

    if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('export ')) {
      const singleLineMatch = line.match(/(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/);
      if (singleLineMatch) {
        allPaths.add(singleLineMatch[1]);
        continue;
      }

      const sideEffectMatch = line.match(/import\s+['"]([^'"]+)['"]/);
      if (sideEffectMatch && !line.includes(' from ')) {
        allPaths.add(sideEffectMatch[1]);
        continue;
      }

      if (line.includes('{') && !line.includes('}')) {
        inMultilineImport = true;
        multilineBuffer = line;
        continue;
      }

      if (trimmedLine.startsWith('import ') && !line.includes("'") && !line.includes('"')) {
        inMultilineImport = true;
        multilineBuffer = line;
        continue;
      }
    }
  }

  for (const importPath of allPaths) {
    if (importPath.startsWith('.') || importPath.startsWith('@/')) {
      const resolvedPath = resolveImportPath(importPath, filePath);
      if (resolvedPath) {
        imports.push(resolvedPath);
      }
    }
  }

  return imports;
}

function resolveImportPath(importPath: string, currentFilePath: string): string | null {
  const srcDir = path.join(process.cwd(), 'src');
  const currentDir = path.dirname(currentFilePath);

  let resolvedPath: string;

  if (importPath.startsWith('@/')) {
    resolvedPath = path.join(srcDir, importPath.slice(2));
  } else {
    resolvedPath = path.resolve(currentDir, importPath);
  }

  const extensions = [
    '', '.ts', '.tsx', '.js', '.jsx',
    '/index.ts', '/index.tsx', '/index.js', '/index.jsx',
  ];

  for (const ext of extensions) {
    const fullPath = resolvedPath + ext;
    try {
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          return path.relative(srcDir, fullPath).replace(/\\/g, '/');
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return null;
}

function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = content.split('\n');
  const exportedNames = new Set<string>();

  const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class|type|interface)\s+(\w+)/g;
  let exportMatch;
  while ((exportMatch = exportRegex.exec(content)) !== null) {
    exportedNames.add(exportMatch[1]);
  }

  const namedExportRegex = /export\s*\{\s*([^}]+)\s*\}/g;
  while ((exportMatch = namedExportRegex.exec(content)) !== null) {
    const names = exportMatch[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
    names.forEach(n => exportedNames.add(n));
  }

  const componentRegex = /(?:export\s+)?(?:const|function)\s+([A-Z][a-zA-Z0-9]*)\s*(?::\s*React\.FC[^=]*)?=?\s*(?:\([^)]*\)|[^=]*)(?:=>|\{)/g;
  const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+([a-z][a-zA-Z0-9]*)\s*\(/g;
  const arrowFnRegex = /(?:export\s+)?const\s+([a-z][a-zA-Z0-9]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/g;
  const classRegex = /(?:export\s+)?class\s+([A-Z][a-zA-Z0-9]*)/g;
  const hookRegex = /(?:export\s+)?(?:const|function)\s+(use[A-Z][a-zA-Z0-9]*)\s*(?:=|<|\()/g;
  const typeRegex = /(?:export\s+)?type\s+([A-Z][a-zA-Z0-9]*)\s*(?:<[^>]*>)?\s*=/g;
  const interfaceRegex = /(?:export\s+)?interface\s+([A-Z][a-zA-Z0-9]*)/g;

  function findLineNumber(matchIndex: number): number {
    return content.slice(0, matchIndex).split('\n').length;
  }

  function findBlockEnd(startLine: number): number {
    let braceCount = 0;
    let started = false;
    for (let i = startLine - 1; i < lines.length; i++) {
      for (const char of lines[i]) {
        if (char === '{') { braceCount++; started = true; }
        else if (char === '}') { braceCount--; }
      }
      if (started && braceCount === 0) return i + 1;
    }
    return Math.min(startLine + 20, lines.length);
  }

  function generateDescription(name: string, type: CodeBlock['type']): string {
    const readable = name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
    switch (type) {
      case 'component': return 'React component that renders ' + readable.toLowerCase();
      case 'hook': return 'Custom hook for ' + readable.replace(/^Use /, '').toLowerCase() + ' logic';
      case 'function': return 'Function that handles ' + readable.toLowerCase();
      case 'class': return 'Class that manages ' + readable.toLowerCase();
      case 'type': return 'Type definition for ' + readable.toLowerCase() + ' data';
      case 'interface': return 'Interface defining ' + readable.toLowerCase() + ' structure';
      case 'constant': return 'Constant value for ' + readable.toLowerCase();
      default: return readable;
    }
  }

  let match;
  while ((match = hookRegex.exec(content)) !== null) {
    const startLine = findLineNumber(match.index);
    blocks.push({
      name: match[1], type: 'hook', startLine, endLine: findBlockEnd(startLine),
      description: generateDescription(match[1], 'hook'),
      exports: exportedNames.has(match[1]) || match[0].includes('export')
    });
  }

  while ((match = componentRegex.exec(content)) !== null) {
    if (blocks.some(b => b.name === match[1])) continue;
    const startLine = findLineNumber(match.index);
    blocks.push({
      name: match[1], type: 'component', startLine, endLine: findBlockEnd(startLine),
      description: generateDescription(match[1], 'component'),
      exports: exportedNames.has(match[1]) || match[0].includes('export')
    });
  }

  while ((match = functionRegex.exec(content)) !== null) {
    if (blocks.some(b => b.name === match[1])) continue;
    const startLine = findLineNumber(match.index);
    blocks.push({
      name: match[1], type: 'function', startLine, endLine: findBlockEnd(startLine),
      description: generateDescription(match[1], 'function'),
      exports: exportedNames.has(match[1]) || match[0].includes('export')
    });
  }

  while ((match = arrowFnRegex.exec(content)) !== null) {
    if (blocks.some(b => b.name === match[1])) continue;
    const startLine = findLineNumber(match.index);
    blocks.push({
      name: match[1], type: 'function', startLine, endLine: findBlockEnd(startLine),
      description: generateDescription(match[1], 'function'),
      exports: exportedNames.has(match[1]) || match[0].includes('export')
    });
  }

  while ((match = classRegex.exec(content)) !== null) {
    if (blocks.some(b => b.name === match[1])) continue;
    const startLine = findLineNumber(match.index);
    blocks.push({
      name: match[1], type: 'class', startLine, endLine: findBlockEnd(startLine),
      description: generateDescription(match[1], 'class'),
      exports: exportedNames.has(match[1]) || match[0].includes('export')
    });
  }

  while ((match = typeRegex.exec(content)) !== null) {
    if (blocks.some(b => b.name === match[1])) continue;
    const startLine = findLineNumber(match.index);
    blocks.push({
      name: match[1], type: 'type', startLine, endLine: startLine + 5,
      description: generateDescription(match[1], 'type'),
      exports: exportedNames.has(match[1]) || match[0].includes('export')
    });
  }

  while ((match = interfaceRegex.exec(content)) !== null) {
    if (blocks.some(b => b.name === match[1])) continue;
    const startLine = findLineNumber(match.index);
    blocks.push({
      name: match[1], type: 'interface', startLine, endLine: findBlockEnd(startLine),
      description: generateDescription(match[1], 'interface'),
      exports: exportedNames.has(match[1]) || match[0].includes('export')
    });
  }

  blocks.sort((a, b) => a.startLine - b.startLine);
  return blocks;
}

function generateFileDescription(relativePath: string, content: string): string {
  const fileName = path.basename(relativePath, path.extname(relativePath));
  const dirName = path.dirname(relativePath);

  const topCommentMatch = content.match(/^\/\*\*[\s\S]*?\*\//);
  if (topCommentMatch) {
    const descMatch = topCommentMatch[0].match(/\*\s+([^@\n*]+)/);
    if (descMatch) return descMatch[1].trim();
  }

  const parts = dirName.split('/').filter(p => p && p !== '.');

  if (fileName.endsWith('.test') || fileName.endsWith('.spec')) return 'Tests for ' + fileName.replace(/\.test$|\.spec$/, '');
  if (parts.includes('hooks')) return 'Custom React hook for ' + fileName.replace(/^use/, '') + ' functionality';
  if (parts.includes('components')) return 'UI component for rendering ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  if (parts.includes('utils') || parts.includes('helpers')) return 'Utility functions for ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  if (parts.includes('services')) return 'Service layer for ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase() + ' operations';
  if (parts.includes('state') || parts.includes('store')) return 'State management for ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  if (parts.includes('types')) return 'Type definitions for ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  if (parts.includes('reducers')) return 'Redux reducer for ' + fileName.replace(/Reducer$/, '') + ' state';
  if (parts.includes('systems')) return 'Game system logic for ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase();

  return 'Module for ' + fileName.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
}

function getFileCategory(relativePath: string): string {
  const parts = relativePath.split('/');
  return parts.length > 1 ? parts[0] : 'root';
}

// ============================================================================
// GRAPH DATA GENERATION
// ============================================================================

async function generateGraphData(): Promise<GraphData> {
  const srcDir = path.join(process.cwd(), 'src');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: srcDir,
    ignore: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/__tests__/**']
  });

  const nodeMap = new Map<string, FileNode>();
  const allImports: { source: string; targets: string[] }[] = [];

  for (const file of files) {
    const normalizedFile = file.replace(/\\/g, '/');
    const fullPath = path.join(srcDir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Generate a display name for the file
    // For index.ts/index.tsx files, include the parent folder name to distinguish them
    // e.g., "components/Spellbook/index.ts" becomes "Spellbook/index.ts"
    const baseName = path.basename(file);
    let displayName = baseName;
    if (baseName === 'index.ts' || baseName === 'index.tsx') {
      const parts = normalizedFile.split('/');
      if (parts.length >= 2) {
        // Show parent folder + filename (e.g., "Spellbook/index.ts")
        displayName = parts[parts.length - 2] + '/' + baseName;
      }
    }

    const node: FileNode = {
      id: normalizedFile,
      name: displayName,
      fullPath,
      relativePath: normalizedFile,
      description: generateFileDescription(normalizedFile, content),
      imports: [],
      importedBy: [],
      codeBlocks: extractCodeBlocks(content),
      connectionCount: 0,
      category: getFileCategory(normalizedFile),
      role: 'normal'
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

    // Identify Bridge and Orphan roles
    const content = fs.readFileSync(node.fullPath, 'utf8');
    const isBridge = (content.includes('export * from') || content.includes('export {')) &&
      (content.includes('@deprecated') || content.length < 500);

    if (isBridge) {
      node.role = 'bridge';
    } else if (node.connectionCount === 0) {
      node.role = 'orphan';
    } else {
      node.role = 'normal';
    }
  }

  const nodes = Array.from(nodeMap.values()).sort((a, b) => b.connectionCount - a.connectionCount);

  return { nodes, edges };
}

// ============================================================================
// HTTP SERVER
// ============================================================================

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const PORT = 3847;
const BASE_DIR = process.cwd();
const SRC_DIR = path.join(BASE_DIR, 'src');

const SYNC_MARKER_START = '// @dependencies-start';
const SYNC_MARKER_END = '// @dependencies-end';

const INCLUDED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'scripts'];

/**
 * Kills any existing process using the specified port.
 * This prevents EADDRINUSE errors when restarting the server.
 * Works on Windows by using netstat to find the PID and taskkill to terminate it.
 */
function killProcessOnPort(port: number): void {
  const isWindows = process.platform === 'win32';

  try {
    if (isWindows) {
      // Use netstat to find the PID of the process listening on this port
      // netstat output format: "  TCP    0.0.0.0:3847    0.0.0.0:0    LISTENING    12345"
      const netstatOutput = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
      });

      // Parse each line to extract PIDs of listening processes
      const lines = netstatOutput.trim().split('\n');
      const pids = new Set<string>();

      for (const line of lines) {
        // Only target LISTENING connections on our exact port
        if (line.includes('LISTENING')) {
          // Split by whitespace and get the last column (PID)
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) {
            pids.add(pid);
          }
        }
      }

      // Kill each process found
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          console.log(`Killed existing process on port ${port} (PID: ${pid})`);
        } catch {
          // Process may have already exited, ignore
        }
      }
    } else {
      // Unix/Mac: use lsof to find and kill the process
      const lsofOutput = execSync(`lsof -ti:${port}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const pids = lsofOutput.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: ['pipe', 'pipe', 'pipe'] });
          console.log(`Killed existing process on port ${port} (PID: ${pid})`);
        } catch {
          // Process may have already exited, ignore
        }
      }
    }
  } catch {
    // No process found on port - this is fine, nothing to kill
  }
}

// ========================================================================
// HEADLESS SYNC LOGIC
// ========================================================================

/**
 * Synchronizes the dependency header for a specific file.
 * Safely wraps the block in markers to prevent overwriting code.
 */
async function syncFileDependencies(targetPath: string) {
  const fullPath = path.resolve(targetPath);
  const ext = path.extname(fullPath).toLowerCase();

  // 1. Safety Filter
  if (!INCLUDED_EXTENSIONS.includes(ext)) {
    console.warn(`[sync] Skipping ${targetPath}: Only ${INCLUDED_EXTENSIONS.join(', ')} files are supported.`);
    return;
  }

  const isScript = fullPath.includes(path.sep + 'scripts' + path.sep) || fullPath.includes(path.sep + 'scripts/');
  if (isScript) {
    console.warn(`[sync] Skipping ${targetPath}: Scripts are excluded.`);
    return;
  }

  console.info(`[sync] Analyzing dependency web for ${targetPath}...`);

  // 2. Full codebase scan (necessary to get accurate "importedBy" data)
  const data = await generateGraphData();
  const nodes = data.nodes;

  // 3. Find our target node in the graph
  const relativeTarget = path.relative(SRC_DIR, fullPath).replace(/\\/g, '/');
  const targetNode = nodes.find(n => n.id === relativeTarget || n.relativePath === relativeTarget);

  if (!targetNode) {
    console.error(`[sync] Could not find ${targetPath} in the dependency map. (Is it inside src/?)`);
    return;
  }

  // 4. Read content early to check for Bridge status
  const content = fs.readFileSync(fullPath, 'utf8');
  const isBridge = (content.includes('export * from') || content.includes('export {')) &&
    (content.includes('@deprecated') || content.length < 500);

  // 5. Determine "Honest Label"
  const importsCount = targetNode.imports.length;
  const dependentsCount = targetNode.importedBy.length;
  let advisoryLabel = "This file is part of a complex dependency web."; // Default

  if (isBridge) {
    advisoryLabel = "DEPRECATED BRIDGE / MIDDLEMAN: Redirects to a new location. (Clean me up!)";
  } else if (dependentsCount === 0) {
    advisoryLabel = "This file appears to be an ISOLATED UTILITY or ORPHAN.";
  } else if (dependentsCount > 10) {
    advisoryLabel = "CRITICAL CORE SYSTEM: Changes here ripple across the entire city.";
  } else if (dependentsCount > 3) {
    advisoryLabel = "SHARED UTILITY: Multiple systems rely on these exports.";
  } else {
    advisoryLabel = "LOCAL HELPER: This file has a small, manageable dependency footprint.";
  }

  // 5. Format the "Stop Sign" block
  const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam' });

  const dependentsStr = targetNode.importedBy
    .map(id => {
      const parts = id.split('/');
      const fileName = parts[parts.length - 1];
      // Provide folder context for index files
      if ((fileName === 'index.ts' || fileName === 'index.tsx') && parts.length > 1) {
        return `${parts[parts.length - 2]}/${fileName}`;
      }
      return fileName;
    })
    .sort()
    .join(', ');

  const syncBlock = `${SYNC_MARKER_START}
/**
 * ARCHITECTURAL ADVISORY:
 * ${advisoryLabel}
 * 
 * Last Sync: ${timestamp}
 * Dependents: ${dependentsCount > 0 ? dependentsStr : 'None (Orphan)'}
 * Imports: ${importsCount === 0 ? 'None' : importsCount + ' files'}
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
${SYNC_MARKER_END}`;

  // 5. Read and Replace using markers
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    const startIdx = content.indexOf(SYNC_MARKER_START);
    const endIdx = content.indexOf(SYNC_MARKER_END);

    if (startIdx !== -1 && endIdx !== -1) {
      // Overwrite exactly what is between markers
      const before = content.substring(0, startIdx);
      const after = content.substring(endIdx + SYNC_MARKER_END.length).trimStart();
      content = before + syncBlock + (after ? '\n\n' + after : '');
    } else {
      // Prepend to top of file
      content = syncBlock + '\n\n' + content.trimStart();
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    console.info(`[sync] Successfully updated ${targetPath}`);
  } catch (err) {
    console.error(`[sync] Failed to write to ${targetPath}:`, err);
  }
}

// ========================================================================
// CLI ENTRY POINT
// ========================================================================

const args = process.argv.slice(2);
if (args.includes('--sync')) {
  const syncIdx = args.indexOf('--sync');
  const target = args[syncIdx + 1];
  if (target) {
    syncFileDependencies(target).catch(err => {
      console.error('[sync] Fatal Error:', err);
      process.exit(1);
    });
  } else {
    console.error('Error: Please provide a file path. Usage: npx tsx scripts/visualizer-server.ts --sync path/to/file.ts');
    process.exit(1);
  }
} else {
  // Kill any existing process on the port before starting the server
  killProcessOnPort(PORT);

  const server = http.createServer(async (req, res) => {
    // Enable CORS for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = req.url || '/';

    // API endpoint to check if server is running (health check)
    if (url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', port: PORT }));
      return;
    }

    // API endpoint to gracefully shutdown the server
    if (url === '/api/shutdown') {
      console.log('[' + new Date().toLocaleTimeString() + '] Shutdown requested via API');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'shutting_down' }));
      // Give the response time to send before closing
      setTimeout(() => {
        server.close(() => {
          console.log('Server shut down gracefully');
          process.exit(0);
        });
      }, 100);
      return;
    }

    // API endpoint to get code quality scan data
    if (url === '/api/scan') {
      console.log('[' + new Date().toLocaleTimeString() + '] Running code quality scan...');
      exec('npx tsx scripts/scan-quality.ts --json', { cwd: process.cwd(), timeout: 30000 }, (error, stdout, stderr) => {
        res.setHeader('Content-Type', 'application/json');
        if (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Scan failed', message: stderr || error.message }));
        } else {
          res.writeHead(200);
          res.end(stdout.trim());
        }
      });
      return;
    }

    // API endpoint to get fresh graph data
    if (url === '/api/graph') {
      console.log('[' + new Date().toLocaleTimeString() + '] Regenerating graph data...');
      try {
        const data = await generateGraphData();
        console.log('[' + new Date().toLocaleTimeString() + '] Done: ' + data.nodes.length + ' nodes, ' + data.edges.length + ' edges');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        console.error('Error generating graph:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to generate graph data' }));
      }
      return;
    }

    // Serve the main HTML page
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getHTMLPage());
      return;
    }

    // 404 for everything else
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(PORT, () => {
    console.log('');
    console.log('Codebase Visualizer Server running at:');
    console.log('  http://localhost:' + PORT);
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');
  });

  // ============================================================================
  // HTML PAGE WITH REFRESH BUTTON
  // ============================================================================

  function getHTMLPage(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codebase Dependency Visualizer - Aralia</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
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
    .toggle-btn, .refresh-btn {
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
    .toggle-btn:hover, .refresh-btn:hover { background: rgba(125, 211, 252, 0.1); border-color: #7dd3fc; }
    .toggle-btn.active { background: rgba(125, 211, 252, 0.2); border-color: #7dd3fc; color: #7dd3fc; }
    .refresh-btn { background: rgba(74, 222, 128, 0.1); border-color: #4ade80; color: #4ade80; }
    .refresh-btn:hover { background: rgba(74, 222, 128, 0.2); }
    .refresh-btn.loading { opacity: 0.6; cursor: wait; }
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
    .detail-panel h3 { font-size: 1.1em; color: #7dd3fc; margin-bottom: 4px; }
    .detail-path { font-size: 0.75em; color: #666; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .copy-btn { padding: 2px 6px; background: rgba(255,255,255,0.05); border: 1px solid #3a3a5a; border-radius: 3px; color: #888; cursor: pointer; font-size: 0.9em; }
    .copy-btn:hover { background: rgba(125, 211, 252, 0.1); color: #7dd3fc; }
    .detail-panel p { font-size: 0.85em; color: #aaa; margin-bottom: 16px; line-height: 1.5; }
    .section-title { font-size: 0.75em; font-weight: bold; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #2a2a4a; padding-bottom: 4px; }
    .code-blocks-list { list-style: none; margin-bottom: 20px; }
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
    .node > circle, .node > rect, .node > path { stroke: #fff; stroke-width: 1.5px; transition: all 0.3s; }
    .node:hover > circle, .node:hover > rect, .node:hover > path { stroke-width: 3px; }
    .node.selected > circle, .node.selected > rect, .node.selected > path { stroke: #7dd3fc; stroke-width: 4px; }
    .node.highlighted > circle, .node.highlighted > rect, .node.highlighted > path { stroke: #fbbf24; stroke-width: 3px; }
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
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(10, 10, 20, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
    }
    .loading-overlay.hidden { display: none; }
    .loading-text { font-size: 1.2em; color: #7dd3fc; }
    .stats-bar {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(30, 30, 50, 0.9);
      border: 1px solid #4a4a6a;
      border-radius: 6px;
      padding: 10px 16px;
      font-size: 0.85em;
    }
    .stats-bar span { color: #7dd3fc; font-weight: 500; }
    .quality-toggle-btn {
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
    .quality-toggle-btn:hover { background: rgba(125, 211, 252, 0.1); border-color: #7dd3fc; }
    .quality-toggle-btn.active { background: rgba(248, 113, 113, 0.2); border-color: #f87171; color: #f87171; }
    .quality-toggle-btn.loading { opacity: 0.6; cursor: wait; }
    .quality-issue-item {
      padding: 6px 10px;
      background: rgba(20, 20, 35, 0.5);
      border-radius: 4px;
      margin-bottom: 4px;
      border-left: 3px solid #666;
      font-size: 0.8em;
    }
    .quality-issue-item.type-STUB { border-color: #f87171; }
    .quality-issue-item.type-ANY_TYPE { border-color: #fbbf24; }
    .quality-issue-item.type-CONSOLE_LOG { border-color: #38bdf8; }
    .quality-issue-item.type-TS_IGNORE { border-color: #a78bfa; }
    .quality-issue-item.type-EMPTY_CATCH { border-color: #fb923c; }
    .quality-issue-line { font-family: 'Segoe UI', monospace; font-size: 0.75em; color: #7dd3fc; }
    .quality-issue-text { font-size: 0.75em; color: #aaa; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .quality-issue-type { font-size: 0.65em; padding: 1px 5px; border-radius: 3px; background: rgba(255,255,255,0.08); text-transform: uppercase; color: #888; }
    .quality-summary { font-size: 0.8em; color: #aaa; margin-bottom: 12px; padding: 8px 10px; background: rgba(20, 20, 35, 0.5); border-radius: 4px; }
    .quality-summary .q-count { font-weight: 600; font-size: 1.1em; }
    .quality-summary .q-clean { color: #4ade80; }
    .quality-summary .q-warn { color: #fbbf24; }
    .quality-summary .q-bad { color: #f87171; }
  </style>
</head>
<body>
  <div class="container">
    <div class="sidebar">
      <div class="sidebar-header">
        <h1>Codebase Visualizer</h1>
        <p>Click nodes to explore dependencies. Double-click to expand.</p>
      </div>
      <div class="controls">
        <div class="control-group">
          <label>Actions</label>
          <button class="refresh-btn" id="refreshBtn" onclick="refreshData()">Refresh Data</button>
        </div>
        <div class="control-group">
          <label>Color Mode</label>
          <div class="toggle-buttons">
            <button class="quality-toggle-btn active" id="colorModeCategory" onclick="setColorMode('category')">Category</button>
            <button class="quality-toggle-btn" id="colorModeQuality" onclick="setColorMode('quality')">Code Quality</button>
          </div>
        </div>
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
        <div class="control-group">
          <label>Legend</label>
          <div style="font-size: 0.75em; color: #888; display: flex; flex-direction: column; gap: 6px; padding: 5px 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#555" /></svg>
              <span>Normal Node</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" fill="#555" stroke="#4ade80" /></svg>
              <span>Bridge (Re-export)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="12" height="12"><path d="M6,1 L11,10 L1,10 Z" fill="#555" stroke="#f87171" /></svg>
              <span>Orphan (Disconnected)</span>
            </div>
          </div>
        </div>
      </div>
      <div class="file-list" id="fileList"></div>
      <div class="detail-panel" id="detailPanel">
        <h3 id="detailTitle">File Details</h3>
        <div class="detail-path">
          <span id="detailPathText">Select a file</span>
          <button class="copy-btn" onclick="copyPath()" id="copyBtn" style="display:none">Copy</button>
        </div>
        <p id="detailDesc">Select a file to see details</p>
        
        <div class="section-title">Exports & Blocks</div>
        <ul class="code-blocks-list" id="codeBlocksList"></ul>
        
        <div class="section-title">Used By (Dependents)</div>
        <ul class="code-blocks-list" id="dependentsList"></ul>
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
      <div class="stats-bar" id="statsBar">
        <span id="nodeCount">0</span> files, <span id="edgeCount">0</span> connections
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
      <div class="loading-overlay" id="loadingOverlay">
        <div class="loading-text">Loading graph data...</div>
      </div>
    </div>
  </div>

  <script>
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

    var graphData = { nodes: [], edges: [] };
    var selectedNode = null;
    var dependencyMode = 'all';
    var searchFilter = '';
    var simulation = null;
    var expandedSimulation = null;
    var graphElements = null;

    // Code Quality mode state
    var colorMode = 'category'; // 'category' or 'quality'
    var qualityData = null;     // scan result from /api/scan
    var qualityByFile = {};     // { nodeId: { total, issues: [...] } }

    function init() {
      setupEventListeners();
      refreshData();
    }

    function refreshData() {
      var btn = document.getElementById('refreshBtn');
      var overlay = document.getElementById('loadingOverlay');

      btn.classList.add('loading');
      btn.textContent = 'Loading...';
      overlay.classList.remove('hidden');

      fetch('/api/graph')
        .then(function(response) { return response.json(); })
        .then(function(data) {
          graphData = data;
          selectedNode = null;

          document.getElementById('nodeCount').textContent = data.nodes.length;
          document.getElementById('edgeCount').textContent = data.edges.length;

          buildLegend();
          buildFileList();
          createGraph();

          btn.classList.remove('loading');
          btn.textContent = 'Refresh Data';
          overlay.classList.add('hidden');
        })
        .catch(function(err) {
          console.error('Failed to load graph data:', err);
          btn.classList.remove('loading');
          btn.textContent = 'Refresh Data';
          overlay.classList.add('hidden');
          alert('Failed to load graph data. Is the server running?');
        });
    }

    function buildLegend() {
      var legend = document.getElementById('legend');

      if (colorMode === 'quality') {
        legend.innerHTML = '<div class="legend-title">Code Quality</div>';
        var qualityLevels = [
          { color: '#2d6a4f', label: 'Clean (0 issues)' },
          { color: '#fbbf24', label: '1-2 issues' },
          { color: '#f97316', label: '3-5 issues' },
          { color: '#f87171', label: '6+ issues' },
          { color: '#333', label: 'Not scanned' }
        ];
        qualityLevels.forEach(function(q) {
          var item = document.createElement('div');
          item.className = 'legend-item';
          item.innerHTML = '<div class="legend-color" style="background: ' + q.color + '"></div><span>' + q.label + '</span>';
          legend.appendChild(item);
        });
        return;
      }

      legend.innerHTML = '<div class="legend-title">Categories</div>';
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

    function scrollToFileInList(nodeId) {
      var item = document.querySelector('.file-item[data-id="' + nodeId + '"]');
      if (item) {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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
      
      var pathText = document.getElementById('detailPathText');
      var copyBtn = document.getElementById('copyBtn');
      pathText.textContent = node.relativePath;
      copyBtn.style.display = 'inline-block';

      blocksList.innerHTML = '';
      node.codeBlocks.forEach(function(block) {
        var li = document.createElement('li');
        li.className = 'code-block-item type-' + block.type;
        var exportBadge = block.exports ? '<span class="block-type" style="background:#4ade8022; color:#4ade80; border:1px solid #4ade8044; margin-left:5px;">EXPORTED</span>' : '';
        li.innerHTML = '<div class="block-header">' +
          '<span class="block-name">' + block.name + exportBadge + '</span>' +
          '<span class="block-type">' + block.type + '</span>' +
          '</div>' +
          '<div class="block-desc">' + block.description + '</div>';
        blocksList.appendChild(li);
      });

      if (node.codeBlocks.length === 0) {
        blocksList.innerHTML = '<li style="color: #666; font-size: 0.85em;">No code blocks extracted</li>';
      }

      var depList = document.getElementById('dependentsList');
      depList.innerHTML = '';
      node.importedBy.forEach(function(depId) {
        var depNode = graphData.nodes.find(n => n.id === depId);
        var li = document.createElement('li');
        li.className = 'code-block-item';
        li.style.cursor = 'pointer';
        li.innerHTML = '<div class="block-header"><span class="block-name">' + (depNode ? depNode.name : depId) + '</span></div>' +
                       '<div class="block-desc" style="font-size:0.7em">' + depId + '</div>';
        li.onclick = function() { selectNode(depNode); scrollToFileInList(depId); };
        depList.appendChild(li);
      });

      if (node.importedBy.length === 0) {
        depList.innerHTML = '<li style="color: #666; font-size: 0.85em;">No dependents found (Orphan)</li>';
      }
    }

    function copyPath() {
      if (!selectedNode) return;
      navigator.clipboard.writeText(selectedNode.fullPath).then(function() {
        var btn = document.getElementById('copyBtn');
        var originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = originalText; }, 2000);
      });
    }

    function createGraph() {
      // Get the SVG element and container dimensions for the graph
      var svg = d3.select('#graph');
      var container = document.querySelector('.graph-container');
      var width = container.clientWidth;
      var height = container.clientHeight;

      // Set up SVG canvas size and clear any previous content
      svg.attr('width', width).attr('height', height);
      svg.selectAll('*').remove();

      // Exit early if there's no data to display
      if (graphData.nodes.length === 0) return;

      // ========================================================================
      // ORPHAN ZONE CONFIGURATION
      // Define the rectangular area where orphan nodes (0 connections) will be
      // constrained. Positioned in the bottom-right corner of the graph.
      // ========================================================================
      var orphanCount = graphData.nodes.filter(function(n) { return n.connectionCount === 0; }).length;

      // Calculate orphan zone dimensions based on how many orphans we have
      // More orphans = bigger box to fit them all
      var orphanZonePadding = 40;  // Padding inside the box for node spacing
      var orphanZoneWidth = Math.max(250, Math.min(400, orphanCount * 25));  // Width scales with count
      var orphanZoneHeight = Math.max(200, Math.min(350, orphanCount * 20)); // Height scales with count

      // Position the orphan zone in the bottom-right corner with some margin
      var orphanZone = {
        x: width - orphanZoneWidth - 30,   // 30px margin from right edge
        y: height - orphanZoneHeight - 30, // 30px margin from bottom edge
        width: orphanZoneWidth,
        height: orphanZoneHeight,
        padding: orphanZonePadding
      };

      // Set up zoom and pan behavior for the graph
      var zoom = d3.zoom()
        .scaleExtent([0.1, 4])  // Allow 10% to 400% zoom
        .on('zoom', function(event) {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);

      // Create main group element that will be transformed by zoom/pan
      var g = svg.append('g');

      // ========================================================================
      // ARROW MARKERS FOR EDGES
      // Define arrowhead markers for import/export visualization
      // ========================================================================
      var defs = svg.append('defs');

      // Default gray arrow for normal links
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

      // Green arrow for incoming imports
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

      // Orange arrow for outgoing exports/dependents
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

      // ========================================================================
      // NODE SIZING
      // Calculate max connections to scale node sizes appropriately
      // ========================================================================
      var maxConnections = 0;
      graphData.nodes.forEach(function(n) {
        if (n.connectionCount > maxConnections) maxConnections = n.connectionCount;
      });

      // Scale node radius from 6px (no connections) to 40px (most connections)
      var sizeScale = d3.scaleSqrt()
        .domain([0, maxConnections])
        .range([6, 40]);

      // Deep copy nodes and edges for D3 mutation (D3 modifies objects in-place)
      var nodesCopy = graphData.nodes.map(function(n) { return Object.assign({}, n); });
      var edgesCopy = graphData.edges.map(function(e) { return { source: e.source, target: e.target }; });

      // ========================================================================
      // CUSTOM FORCE: ORPHAN ZONE CONSTRAINT
      // This force pushes orphan nodes (connectionCount === 0) to stay within
      // the orphan zone rectangle. Non-orphan nodes are pushed AWAY from it.
      // ========================================================================
      function forceOrphanZone() {
        // Strength of the constraining force (higher = snappier positioning)
        var strength = 0.1;

        // The actual force function called on each simulation tick
        function force(alpha) {
          nodesCopy.forEach(function(d) {
            var isOrphan = d.connectionCount === 0;
            var nodeRadius = sizeScale(d.connectionCount);

            if (isOrphan) {
              // ORPHAN NODES: Constrain to stay INSIDE the orphan zone box
              // Calculate the inner bounds (accounting for node radius and padding)
              var minX = orphanZone.x + orphanZone.padding + nodeRadius;
              var maxX = orphanZone.x + orphanZone.width - orphanZone.padding - nodeRadius;
              var minY = orphanZone.y + orphanZone.padding + nodeRadius;
              var maxY = orphanZone.y + orphanZone.height - orphanZone.padding - nodeRadius;

              // If node is outside bounds, apply force to push it back in
              if (d.x < minX) d.vx += (minX - d.x) * strength * alpha;
              if (d.x > maxX) d.vx += (maxX - d.x) * strength * alpha;
              if (d.y < minY) d.vy += (minY - d.y) * strength * alpha;
              if (d.y > maxY) d.vy += (maxY - d.y) * strength * alpha;

              // Also give orphans an initial position inside the zone if not set
              if (d.x === undefined || d.y === undefined) {
                d.x = orphanZone.x + orphanZone.width / 2 + (Math.random() - 0.5) * 100;
                d.y = orphanZone.y + orphanZone.height / 2 + (Math.random() - 0.5) * 100;
              }
            } else {
              // NON-ORPHAN NODES: Push away from the orphan zone to keep it clear
              var zoneLeft = orphanZone.x - nodeRadius;
              var zoneRight = orphanZone.x + orphanZone.width + nodeRadius;
              var zoneTop = orphanZone.y - nodeRadius;
              var zoneBottom = orphanZone.y + orphanZone.height + nodeRadius;

              // Check if node overlaps with orphan zone
              if (d.x > zoneLeft && d.x < zoneRight && d.y > zoneTop && d.y < zoneBottom) {
                // Push node out of the zone toward the nearest edge
                var distLeft = d.x - zoneLeft;
                var distRight = zoneRight - d.x;
                var distTop = d.y - zoneTop;
                var distBottom = zoneBottom - d.y;
                var minDist = Math.min(distLeft, distRight, distTop, distBottom);

                // Apply velocity in the direction of the nearest edge
                if (minDist === distLeft) d.vx -= strength * alpha * 50;
                else if (minDist === distRight) d.vx += strength * alpha * 50;
                else if (minDist === distTop) d.vy -= strength * alpha * 50;
                else d.vy += strength * alpha * 50;
              }
            }
          });
        }

        return force;
      }

      // ========================================================================
      // FORCE SIMULATION SETUP
      // Configure the D3 force simulation with all our forces
      // ========================================================================
      simulation = d3.forceSimulation(nodesCopy)
        // Link force: connected nodes attract each other
        .force('link', d3.forceLink(edgesCopy)
          .id(function(d) { return d.id; })
          .distance(100))
        // Charge force: all nodes repel each other (prevents overlap)
        .force('charge', d3.forceManyBody().strength(-200))
        // Center force: pulls the main graph toward the center (offset left to make room for orphan zone)
        .force('center', d3.forceCenter(width / 2 - orphanZoneWidth / 4, height / 2))
        // Collision force: prevents nodes from overlapping
        .force('collision', d3.forceCollide().radius(function(d) { return sizeScale(d.connectionCount) + 5; }))
        // Orphan zone force: constrains orphans to the box, pushes others away
        .force('orphanZone', orphanCount > 0 ? forceOrphanZone() : null);

      // ========================================================================
      // RENDER EDGES (LINKS)
      // Draw lines between connected files
      // ========================================================================
      var links = g.append('g')
        .selectAll('line')
        .data(edgesCopy)
        .enter()
        .append('line')
        .attr('class', 'link')
        .attr('stroke', '#666')
        .attr('stroke-width', 1)
        .attr('marker-end', 'url(#arrow)');

      // ========================================================================
      // RENDER NODES (FILES)
      // Draw circles for each file, sized by connection count
      // ========================================================================
      var nodes = g.append('g')
        .selectAll('.node')
        .data(nodesCopy)
        .enter()
        .append('g')
        .attr('class', 'node')
        .call(d3.drag()  // Enable drag behavior
          .on('start', dragStarted)
          .on('drag', dragged)
          .on('end', dragEnded));

      // Add shape for each node based on its role
      nodes.each(function(d) {
        var el = d3.select(this);
        var r = sizeScale(d.connectionCount);
        var color = getNodeColor(d);
        
        if (d.role === 'orphan') {
          // Triangle for Orphans
          var points = [
            [0, -r * 1.2],           // Top
            [-r * 1.1, r * 0.8],     // Bottom Left
            [r * 1.1, r * 0.8]       // Bottom Right
          ];
          el.append('path')
            .attr('d', d3.line()(points) + 'Z')
            .attr('fill', color)
            .attr('stroke', colorMode === 'quality' ? 'none' : '#f87171')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '3,2');
        } else if (d.role === 'bridge') {
          // Square for Bridges
          el.append('rect')
            .attr('x', -r)
            .attr('y', -r)
            .attr('width', r * 2)
            .attr('height', r * 2)
            .attr('fill', color)
            .attr('stroke', colorMode === 'quality' ? 'none' : '#4ade80')
            .attr('stroke-width', 1);
        } else {
          // Circle for Normal nodes
          el.append('circle')
            .attr('r', r)
            .attr('fill', color);
        }
      });

      // Add text labels for nodes with enough connections (to reduce clutter)
      nodes.append('text')
        .attr('class', 'node-label')
        .attr('dy', function(d) { return sizeScale(d.connectionCount) + 12; })
        .text(function(d) { return d.connectionCount > 3 ? d.name : ''; })
        .style('font-size', function(d) { return Math.max(8, sizeScale(d.connectionCount) / 2) + 'px'; });

      // ========================================================================
      // NODE INTERACTION HANDLERS
      // Set up click, double-click, and hover behaviors
      // ========================================================================
      nodes
        .on('click', function(event, d) {
          event.stopPropagation();
          selectNode(d);  // Single click selects and highlights connections
        })
        .on('dblclick', function(event, d) {
          event.stopPropagation();
          expandNode(d);  // Double click opens expanded view showing code blocks
        })
        .on('mouseover', function(event, d) { showTooltip(event, d); })
        .on('mouseout', hideTooltip);

      // Clicking empty space deselects any selected node
      svg.on('click', function() { selectNode(null); });

      // ========================================================================
      // SIMULATION TICK HANDLER
      // Update node and link positions on each simulation frame
      // ========================================================================
      simulation.on('tick', function() {
        // Update link positions to follow their source/target nodes
        links
          .attr('x1', function(d) { return d.source.x; })
          .attr('y1', function(d) { return d.source.y; })
          .attr('x2', function(d) { return d.target.x; })
          .attr('y2', function(d) { return d.target.y; });

        // Update node positions via transform
        nodes.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
      });

      // Store references for later use in highlighting
      graphElements = { nodes: nodes, links: links, sizeScale: sizeScale, nodesCopy: nodesCopy };
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

      if (colorMode === 'quality' && qualityByFile[node.id]) {
        var qInfo = qualityByFile[node.id];
        var breakdown = {};
        qInfo.issues.forEach(function(issue) { breakdown[issue.pattern] = (breakdown[issue.pattern] || 0) + 1; });
        var parts = Object.keys(breakdown).map(function(k) { return breakdown[k] + '× ' + k; });
        document.getElementById('tooltipDesc').textContent = qInfo.total + ' issue(s): ' + parts.join(', ');
      } else if (colorMode === 'quality') {
        document.getElementById('tooltipDesc').textContent = 'No issues found';
      } else {
        document.getElementById('tooltipDesc').textContent = node.description;
      }

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

    // ========================================================================
    // CODE QUALITY MODE
    // ========================================================================

    function getNodeColor(d) {
      if (colorMode !== 'quality') {
        return categoryColors[d.category] || '#888';
      }
      var qInfo = qualityByFile[d.id];
      if (!qInfo) return '#333';
      if (qInfo.total === 0) return '#2d6a4f';
      if (qInfo.total <= 2) return '#fbbf24';
      if (qInfo.total <= 5) return '#f97316';
      return '#f87171';
    }

    function setColorMode(mode) {
      if (mode === 'quality' && !qualityData) {
        loadQualityData();
        return;
      }
      colorMode = mode;
      document.getElementById('colorModeCategory').classList.toggle('active', mode === 'category');
      document.getElementById('colorModeQuality').classList.toggle('active', mode === 'quality');
      buildLegend();
      createGraph();
      if (selectedNode) {
        selectNode(selectedNode);
      }
    }

    function loadQualityData() {
      var btn = document.getElementById('colorModeQuality');
      btn.classList.add('loading');
      btn.textContent = 'Scanning...';

      fetch('/api/scan')
        .then(function(response) { return response.json(); })
        .then(function(data) {
          if (data.error) {
            alert('Scan failed: ' + (data.message || data.error));
            btn.classList.remove('loading');
            btn.textContent = 'Code Quality';
            return;
          }
          qualityData = data;
          buildQualityIndex();
          btn.classList.remove('loading');
          btn.textContent = 'Code Quality';
          setColorMode('quality');
        })
        .catch(function(err) {
          alert('Could not reach scan API: ' + err);
          btn.classList.remove('loading');
          btn.textContent = 'Code Quality';
        });
    }

    function buildQualityIndex() {
      qualityByFile = {};
      if (!qualityData || !qualityData.groups) return;

      // Initialize all graph nodes as clean
      graphData.nodes.forEach(function(node) {
        qualityByFile[node.id] = { total: 0, issues: [] };
      });

      // Map scan findings to node IDs
      // scan-quality outputs file paths like "src/components/Foo.tsx"
      // visualizer node IDs are like "components/Foo.tsx" (relative to src/)
      var groups = qualityData.groups;
      for (var patternKey in groups) {
        var items = groups[patternKey].items || [];
        items.forEach(function(item) {
          // Strip leading "src/" or "src\\" to match node IDs
          var nodeId = item.file.replace(/\\/g, '/').replace(/^src\//, '');
          if (!qualityByFile[nodeId]) {
            qualityByFile[nodeId] = { total: 0, issues: [] };
          }
          qualityByFile[nodeId].total++;
          qualityByFile[nodeId].issues.push({
            pattern: patternKey,
            line: item.line,
            text: item.text
          });
        });
      }
    }

    // Override updateDetailPanel to show quality info when in quality mode
    var _originalUpdateDetailPanel = updateDetailPanel;
    updateDetailPanel = function(node) {
      if (colorMode !== 'quality' || !node) {
        _originalUpdateDetailPanel(node);
        return;
      }

      var panel = document.getElementById('detailPanel');
      var title = document.getElementById('detailTitle');
      var desc = document.getElementById('detailDesc');
      var blocksList = document.getElementById('codeBlocksList');
      var depList = document.getElementById('dependentsList');

      panel.classList.add('visible');
      title.textContent = node.name;

      var pathText = document.getElementById('detailPathText');
      var copyBtn = document.getElementById('copyBtn');
      pathText.textContent = node.relativePath;
      copyBtn.style.display = 'inline-block';

      var qInfo = qualityByFile[node.id];
      if (!qInfo || qInfo.total === 0) {
        desc.textContent = 'No code quality issues found in this file.';
        desc.innerHTML = '<span style="color: #4ade80;">✓ Clean — no issues detected</span>';
        blocksList.innerHTML = '';
        depList.innerHTML = '';
        return;
      }

      var countClass = qInfo.total <= 2 ? 'q-warn' : 'q-bad';
      desc.innerHTML = '<div class="quality-summary"><span class="q-count ' + countClass + '">' + qInfo.total + '</span> issue(s) found</div>';

      // Group issues by pattern for display
      var grouped = {};
      qInfo.issues.forEach(function(issue) {
        if (!grouped[issue.pattern]) grouped[issue.pattern] = [];
        grouped[issue.pattern].push(issue);
      });

      blocksList.innerHTML = '';
      for (var pattern in grouped) {
        var header = document.createElement('div');
        header.className = 'section-title';
        header.style.marginTop = '8px';
        header.textContent = pattern + ' (' + grouped[pattern].length + ')';
        blocksList.appendChild(header);

        grouped[pattern].forEach(function(issue) {
          var li = document.createElement('li');
          li.className = 'quality-issue-item type-' + issue.pattern;
          li.innerHTML =
            '<div style="display:flex; justify-content:space-between; align-items:center;">' +
            '<span class="quality-issue-line">Line ' + issue.line + '</span>' +
            '<span class="quality-issue-type">' + issue.pattern + '</span>' +
            '</div>' +
            '<div class="quality-issue-text" title="' + (issue.text || '').replace(/"/g, '&quot;') + '">' + (issue.text || '') + '</div>';
          blocksList.appendChild(li);
        });
      }

      // Hide dependents section in quality mode
      depList.innerHTML = '';
    };

    init();
  </script>
</body>
</html>`;
  }
}
