/**
 * This file performs raw source-code analysis for the visualizer graph.
 *
 * The graph builder calls these helpers to extract imports, classify files, and
 * identify important code blocks in each file. Keeping parser logic separate from
 * traversal logic makes it easier to test and update extraction rules safely.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { CodeBlock } from './types';

// ============================================================================
// Import Extraction
// ============================================================================
// These helpers parse import/export statements and resolve each import into a
// normalized path relative to src/, so edges are consistent across platforms.
// ============================================================================

export function extractImports(content: string, filePath: string): string[] {
  if (!isCodeLikeFile(filePath)) {
    return [];
  }

  const imports = new Set<string>();
  const sourceFile = createSourceFile(content, filePath);

  // This walks the syntax tree once so static imports, dynamic imports, re-exports,
  // and worker URL patterns all feed the same import edge collector.
  function collectImportPath(rawImportPath: string | undefined): void {
    if (!rawImportPath) return;
    if (!rawImportPath.startsWith('.') && !rawImportPath.startsWith('@/')) return;

    const resolvedPath = resolveImportPath(rawImportPath, filePath);
    if (resolvedPath) {
      imports.add(resolvedPath);
    }
  }

  function getStringLiteralValue(expression: ts.Expression | undefined): string | undefined {
    if (!expression) return undefined;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return expression.text;
    }
    return undefined;
  }

  function getWorkerUrlImportPath(expression: ts.Expression | undefined): string | undefined {
    if (!expression || !ts.isNewExpression(expression)) return undefined;
    if (expression.expression.getText(sourceFile) !== 'URL') return undefined;

    const firstArgument = expression.arguments && expression.arguments[0];
    return getStringLiteralValue(firstArgument);
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      collectImportPath(getStringLiteralValue(node.moduleSpecifier));
    } else if (ts.isExportDeclaration(node)) {
      collectImportPath(getStringLiteralValue(node.moduleSpecifier));
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      collectImportPath(getStringLiteralValue(node.arguments[0]));
    } else if (ts.isNewExpression(node)) {
      const calleeText = node.expression.getText(sourceFile);
      if ((calleeText === 'Worker' || calleeText === 'SharedWorker') && node.arguments && node.arguments.length > 0) {
        collectImportPath(getWorkerUrlImportPath(node.arguments[0]) || getStringLiteralValue(node.arguments[0]));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return Array.from(imports);
}

export function resolveImportPath(importPath: string, currentFilePath: string): string | null {
  const srcDir = path.join(process.cwd(), 'src');
  const repoRoot = process.cwd();
  const currentDir = path.dirname(currentFilePath);

  // Support both "@/..." alias imports and plain relative imports.
  const resolvedPath = importPath.startsWith('@/')
    ? path.join(srcDir, importPath.slice(2))
    : path.resolve(currentDir, importPath);

  const extensions = [
    '',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.json',
    '.svg',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '/index.ts',
    '/index.tsx',
    '/index.js',
    '/index.jsx',
    '/index.json',
  ];

  // Try file candidates in priority order until one exists. The graph now allows
  // files outside src/ when source files explicitly import them, such as package.json.
  for (const ext of extensions) {
    const fullPath = resolvedPath + ext;
    try {
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        if (fullPath.startsWith(srcDir + path.sep) || fullPath === srcDir) {
          return path.relative(srcDir, fullPath).replace(/\\/g, '/');
        }
        return path.relative(repoRoot, fullPath).replace(/\\/g, '/');
      }
    } catch {
      // Ignore filesystem errors so one bad path does not break the full graph.
    }
  }

  return null;
}

// ============================================================================
// Bridge / Barrel Classification
// ============================================================================
// These helpers identify files that are only forwarding exports so graph and
// sync code can label them as bridge files without confusing them with
// deprecation status.
// ============================================================================

export function isPureReExportBarrel(content: string): boolean {
  const sourceFile = createSourceFile(content, 'barrel.ts');
  let sawReExport = false;

  for (const statement of sourceFile.statements) {
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) {
      continue;
    }

    if (!ts.isExportDeclaration(statement)) {
      return false;
    }

    if (!statement.moduleSpecifier) {
      return false;
    }

    sawReExport = true;
  }

  return sawReExport;
}

// ============================================================================
// Code Block Extraction
// ============================================================================
// These helpers identify functions, hooks, classes, and type declarations so the
// UI can show richer metadata than just file-level dependencies.
// ============================================================================

export function extractCodeBlocks(content: string, filePath: string = 'visualizer.tsx'): CodeBlock[] {
  if (!isCodeLikeFile(filePath)) {
    return [];
  }

  const blocks: CodeBlock[] = [];
  const exportedNames = collectExportedNames(content, filePath);
  const sourceFile = createSourceFile(content, filePath);

  // Build a human-friendly description based on naming conventions.
  function generateDescription(name: string, type: CodeBlock['type']): string {
    const readable = name.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()).trim();

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
      case 'enum':
        return 'Enum describing ' + readable.toLowerCase() + ' options';
      case 'constant':
        return 'Constant value for ' + readable.toLowerCase();
      default:
        return readable;
    }
  }

  // This keeps the visualizer on the same public contract while moving the
  // extraction internals to a syntax-driven pass similar to GitNexus.
  function getLineRange(node: ts.Node): { startLine: number; endLine: number } {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const end = sourceFile.getLineAndCharacterOfPosition(Math.max(node.getEnd() - 1, node.getStart(sourceFile))).line + 1;
    return { startLine: start, endLine: end };
  }

  function hasExportModifier(node: ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> }): boolean {
    return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
  }

  function pushBlock(name: string, type: CodeBlock['type'], node: ts.Node, exports: boolean): void {
    if (blocks.some((block) => block.name === name && block.startLine === getLineRange(node).startLine && block.type === type)) {
      return;
    }

    const { startLine, endLine } = getLineRange(node);
    blocks.push({
      name,
      type,
      startLine,
      endLine,
      description: generateDescription(name, type),
      exports,
    });
  }

  function isWrappedComponentFactory(initializer: ts.Expression): boolean {
    if (!ts.isCallExpression(initializer)) return false;
    const callee = initializer.expression;
    const calleeText = ts.isPropertyAccessExpression(callee)
      ? `${callee.expression.getText(sourceFile)}.${callee.name.getText(sourceFile)}`
      : callee.getText(sourceFile);
    return ['memo', 'forwardRef', 'React.memo', 'React.forwardRef'].includes(calleeText);
  }

  function containsJsx(node: ts.Node | undefined): boolean {
    if (!node) return false;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      return node.expression.expression.getText(sourceFile) === 'React' && node.expression.name.text === 'createElement';
    }

    let found = false;
    ts.forEachChild(node, function visit(child) {
      if (found) return;
      found = containsJsx(child);
    });
    return found;
  }

  function getBlockTypeForFunctionLike(name: string, initializerOrBody: ts.FunctionLikeDeclarationBase): CodeBlock['type'] {
    if (/^use[A-Z]/.test(name)) return 'hook';
    if (/^[A-Z]/.test(name) && containsJsx(initializerOrBody.body)) return 'component';
    return 'function';
  }

  sourceFile.statements.forEach(function visitStatement(statement) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      pushBlock(
        statement.name.text,
        getBlockTypeForFunctionLike(statement.name.text, statement),
        statement,
        hasExportModifier(statement) || exportedNames.has(statement.name.text),
      );
      return;
    }

    if (ts.isClassDeclaration(statement) && statement.name) {
      pushBlock(
        statement.name.text,
        'class',
        statement,
        hasExportModifier(statement) || exportedNames.has(statement.name.text),
      );
      return;
    }

    if (ts.isTypeAliasDeclaration(statement)) {
      pushBlock(
        statement.name.text,
        'type',
        statement,
        hasExportModifier(statement) || exportedNames.has(statement.name.text),
      );
      return;
    }

    if (ts.isInterfaceDeclaration(statement)) {
      pushBlock(
        statement.name.text,
        'interface',
        statement,
        hasExportModifier(statement) || exportedNames.has(statement.name.text),
      );
      return;
    }

    if (ts.isEnumDeclaration(statement)) {
      pushBlock(
        statement.name.text,
        'enum',
        statement,
        hasExportModifier(statement) || exportedNames.has(statement.name.text),
      );
      return;
    }

    if (!ts.isVariableStatement(statement)) {
      return;
    }

    statement.declarationList.declarations.forEach(function visitDeclaration(declaration) {
      if (!ts.isIdentifier(declaration.name)) return;

      const exportFlag = hasExportModifier(statement) || exportedNames.has(declaration.name.text);
      const initializer = declaration.initializer;
      if (!initializer) return;

      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
        pushBlock(
          declaration.name.text,
          getBlockTypeForFunctionLike(declaration.name.text, initializer),
          declaration,
          exportFlag,
        );
        return;
      }

      if (isWrappedComponentFactory(initializer)) {
        const firstFunctionArgument = initializer.arguments.find((argument) =>
          ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
        ) as ts.FunctionLikeDeclarationBase | undefined;

        if (firstFunctionArgument) {
          pushBlock(
            declaration.name.text,
            getBlockTypeForFunctionLike(declaration.name.text, firstFunctionArgument),
            declaration,
            exportFlag,
          );
          return;
        }
      }

      if (statement.declarationList.flags & ts.NodeFlags.Const) {
        pushBlock(declaration.name.text, 'constant', declaration, exportFlag);
      }
    });
  });

  blocks.sort((left, right) => left.startLine - right.startLine);
  return blocks;
}

// ============================================================================
// Shared TypeScript Helpers
// ============================================================================
// The visualizer only scans TS and TSX for code structure, so these helpers
// centralize script-kind detection and export-name collection.
// ============================================================================

function isCodeLikeFile(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx)$/i.test(filePath);
}

function createSourceFile(content: string, filePath: string): ts.SourceFile {
  const scriptKind = /\.(tsx|jsx)$/i.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);
}

function collectExportedNames(content: string, filePath: string): Set<string> {
  const exportedNames = new Set<string>();
  const sourceFile = createSourceFile(content, filePath);

  sourceFile.statements.forEach(function visitStatement(statement) {
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      statement.exportClause.elements.forEach((element) => {
        exportedNames.add(element.propertyName ? element.propertyName.text : element.name.text);
      });
      return;
    }

    if (!ts.isExportAssignment(statement) || !ts.isIdentifier(statement.expression)) {
      return;
    }

    exportedNames.add(statement.expression.text);
  });

  return exportedNames;
}

// ============================================================================
// File Metadata Helpers
// ============================================================================
// These helpers derive display metadata so the UI can categorize files quickly
// without requiring hardcoded lists.
// ============================================================================

export function generateFileDescription(relativePath: string, content: string): string {
  const fileName = path.basename(relativePath, path.extname(relativePath));
  const dirName = path.dirname(relativePath);
  const parts = dirName.split('/').filter((part) => part && part !== '.');
  const parentScope = parts.length > 0 ? parts[parts.length - 1] : 'root';

  // Prefer explicit top-of-file documentation when available, but skip legal
  // boilerplate and path markers so humans see the first line that explains
  // what the file is for.
  const topComment = extractLeadingComment(content);
  if (topComment) {
    const documentedSummary = summarizeComment(topComment);
    if (documentedSummary) {
      return documentedSummary;
    }
  }

  if (isPureReExportBarrel(content)) {
    const exportCount = countReExportStatements(content);
    const scopeLabel = humanizeName(parentScope === 'root' ? fileName : parentScope);

    if (parts.includes('types')) {
      return 'Central type barrel for ' + scopeLabel.toLowerCase()
        + '. This file gathers shared type exports so gameplay, UI, and state code can import them from one stable entry point.';
    }

    return 'Re-export barrel for ' + scopeLabel.toLowerCase()
      + '. This file gathers ' + exportCount + ' public export'
      + (exportCount === 1 ? '' : 's')
      + ' so other files can import this area from one stable entry point.';
  }

  // Fall back to path-based heuristics when no descriptive header exists.
  if (fileName.endsWith('.test') || fileName.endsWith('.spec')) return 'Tests for ' + fileName.replace(/\.test$|\.spec$/, '');
  if (parts.includes('hooks')) return 'Custom React hook for ' + humanizeName(fileName.replace(/^use/, '')).toLowerCase() + ' behavior.';
  if (parts.includes('components')) return 'UI component for ' + humanizeName(fileName).toLowerCase() + '.';
  if (parts.includes('utils') || parts.includes('helpers')) return 'Shared utility module for ' + humanizeName(fileName).toLowerCase() + '.';
  if (parts.includes('services')) return 'Service module for ' + humanizeName(fileName).toLowerCase() + ' workflows.';
  if (parts.includes('state') || parts.includes('store')) return 'State-management module for ' + humanizeName(fileName).toLowerCase() + '.';
  if (parts.includes('types')) return 'Type definitions for ' + humanizeName(fileName).toLowerCase() + '.';
  if (parts.includes('reducers')) return 'Reducer module for ' + humanizeName(fileName.replace(/Reducer$/, '')).toLowerCase() + ' state.';
  if (parts.includes('systems')) return 'Game-system logic for ' + humanizeName(fileName).toLowerCase() + '.';
  if (parts.includes('constants') || fileName.toLowerCase() === 'constants') return 'Shared constants and foundational reference data used across the codebase.';

  return 'Module for ' + humanizeName(fileName).toLowerCase() + '.';
}

export function getFileCategory(relativePath: string): string {
  const parts = relativePath.split('/');
  return parts.length > 1 ? parts[0] : 'root';
}

function extractLeadingComment(content: string): string | null {
  const trimmedContent = content
    .replace(/^(\s*\/\/\s*@dependencies-start[\s\S]*?\/\/\s*@dependencies-end\s*)/, '')
    .replace(/^(\s*\/\/[^\n]*\n)*/, '')
    .trimStart();
  const blockCommentMatch = trimmedContent.match(/^\/\*\*?[\s\S]*?\*\//);
  if (blockCommentMatch) {
    return blockCommentMatch[0];
  }

  const lineCommentMatch = trimmedContent.match(/^(?:\/\/[^\n]*\n)+/);
  return lineCommentMatch ? lineCommentMatch[0] : null;
}

function summarizeComment(comment: string): string | null {
  const lines = comment
    .split('\n')
    .map((line) => line.replace(/^\s*\/?\**\s?/, '').replace(/\*\/$/, '').trim())
    .filter(Boolean)
    .filter((line) => !/^@/.test(line))
    .filter((line) => !/^copyright/i.test(line))
    .filter((line) => !/^licensed/i.test(line))
    .filter((line) => !/^change log:/i.test(line))
    .filter((line) => !/^last sync:/i.test(line))
    .filter((line) => !/^dependents:/i.test(line))
    .filter((line) => !/^imports:/i.test(line))
    .filter((line) => !/^multi-agent safety:/i.test(line));

  if (lines.length === 0) {
    return null;
  }

  const summary = lines.slice(0, 2).join(' ');
  return summary.length > 220 ? summary.slice(0, 217).trimEnd() + '...' : summary;
}

function countReExportStatements(content: string): number {
  const sourceFile = createSourceFile(content, 'barrel.ts');
  let count = 0;

  sourceFile.statements.forEach((statement) => {
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      count += 1;
    }
  });

  return count;
}

function humanizeName(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\btsx?\b|\bjsx?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
