/**
 * Reads source syntax for the preservation-first debt scanner.
 *
 * TypeScript's parser separates actual unfinished behavior from example strings,
 * regular expressions, and visible JSX text. The scanner still owns triage and
 * tracking decisions; this module supplies evidence without modifying source.
 */
import ts from 'typescript';

const DEBUG_METHODS = new Set(['trace', 'profile', 'profileEnd', 'time', 'timeEnd']);
const STUB_METHODS = new Set(['warn', 'log', 'error']);
const STUB_MESSAGE = /^(?:not\s+implemented|unimplemented|stub|placeholder|todo)\b/i;

function scriptKind(fileName) {
  if (/\.json$/i.test(fileName)) return ts.ScriptKind.JSON;
  if (/\.tsx$/i.test(fileName)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(fileName)) return ts.ScriptKind.JSX;
  if (/\.(?:js|mjs|cjs)$/i.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function unwrap(node) {
  while (node && ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
}

function literalText(node) {
  node = unwrap(node);
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
}

function memberName(node) {
  node = unwrap(node);
  if (node && ts.isPropertyAccessExpression(node)) return node.name.text;
  if (node && ts.isElementAccessExpression(node)) return literalText(node.argumentExpression);
  return null;
}

function isConsoleCall(node) {
  const target = unwrap(node.expression);
  return target && (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target))
    && ts.isIdentifier(unwrap(target.expression)) && unwrap(target.expression).text === 'console';
}

function enclosingSymbol(node, sourceFile) {
  const names = [];
  for (let current = node; current && current !== sourceFile; current = current.parent) {
    if ((ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current)
      || ts.isClassDeclaration(current) || ts.isClassExpression(current)
      || ts.isMethodDeclaration(current) || ts.isGetAccessorDeclaration(current)
      || ts.isSetAccessorDeclaration(current) || ts.isVariableDeclaration(current)
      || ts.isPropertyDeclaration(current) || ts.isPropertyAssignment(current)
      || ts.isModuleDeclaration(current)) && current.name) {
      names.unshift(current.name.getText(sourceFile));
    }
    if (ts.isConstructorDeclaration(current)) names.unshift('constructor');
  }
  return names.join('.') || '<module>';
}

// ---------------------------------------------------------------------------
// Comment and literal projections
// ---------------------------------------------------------------------------
// Comments occupy the gaps between parsed tokens. Scanning only those gaps lets
// the parser decide whether a slash belongs to a regex, a JSX tag, or a comment.
// Template chunks are masked separately, leaving interpolation expressions live.
function lexicalTokens(sourceFile) {
  const tokens = [];
  const visit = (node) => {
    // Documentation nodes duplicate trivia. Their complete original comment is
    // recovered from the gap instead, including unprefixed block-comment lines.
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const children = node.getChildren(sourceFile);
    if (children.length > 0) {
      for (const child of children) visit(child);
    } else if (node.kind !== ts.SyntaxKind.EndOfFileToken && node.end > node.getStart(sourceFile)) {
      tokens.push({ node, start: node.getStart(sourceFile), end: node.end, kind: node.kind });
    }
  };
  visit(sourceFile);
  return tokens.sort((a, b) => a.start - b.start || a.end - b.end);
}

function commentRanges(source, tokens) {
  const ranges = [];
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, source);
  const scanGap = (start, end) => {
    if (end <= start) return;
    scanner.scanRange(start, end - start, () => {
      for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
        if (kind === ts.SyntaxKind.SingleLineCommentTrivia || kind === ts.SyntaxKind.MultiLineCommentTrivia) {
          ranges.push({ start: scanner.getTokenPos(), end: scanner.getTextPos(), kind });
        }
      }
    });
  };
  let previousEnd = 0;
  for (const token of tokens) {
    scanGap(previousEnd, token.start);
    previousEnd = Math.max(previousEnd, token.end);
  }
  scanGap(previousEnd, source.length);
  return ranges;
}

function literalRange(token) {
  const { start, end, kind } = token;
  if (kind === ts.SyntaxKind.StringLiteral || kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) {
    return { start: start + 1, end: end - 1 };
  }
  if (kind === ts.SyntaxKind.TemplateHead) return { start: start + 1, end: end - 2 };
  if (kind === ts.SyntaxKind.TemplateMiddle) return { start: start + 1, end: end - 2 };
  if (kind === ts.SyntaxKind.TemplateTail) return { start: start + 1, end: end - 1 };
  return null;
}

function maskRanges(source, ranges) {
  if (!ranges.length) return source;
  const chunks = [];
  let end = 0;
  for (const range of ranges) {
    if (range.end <= end) continue;
    const start = Math.max(end, range.start);
    if (start > end) chunks.push(source.slice(end, start));
    chunks.push(source.slice(start, range.end).replace(/[^\r\n]+/g, text => ' '.repeat(text.length)));
    end = range.end;
  }
  if (end < source.length) chunks.push(source.slice(end));
  return chunks.join('');
}

function projectLines(source, sourceFile, tokens, comments, isJson) {
  // Spaces preserve offsets and prevent words on opposite sides of a literal or
  // comment from joining. Mask whole intervals instead of allocating two arrays
  // with one entry per character: generated data files can be many megabytes.
  const executableRanges = [...comments];
  const strings = [];
  for (const token of tokens) {
    const literal = literalRange(token);
    if (literal) strings.push(literal);
    if (literal || token.kind === ts.SyntaxKind.RegularExpressionLiteral || token.kind === ts.SyntaxKind.JsxText) {
      executableRanges.push(token);
    }
  }
  executableRanges.sort((a, b) => a.start - b.start || a.end - b.end);

  const lineStarts = sourceFile.getLineStarts();
  const rawLines = source.split(/\r\n|\n|\r/);
  const codeLines = comments.length ? maskRanges(source, comments).split(/\r\n|\n|\r/) : rawLines;
  const executableLines = isJson ? rawLines.map(raw => ' '.repeat(raw.length))
    : executableRanges.length ? maskRanges(source, executableRanges).split(/\r\n|\n|\r/) : rawLines;
  const lines = rawLines.map((raw, i) => ({
    lineNum: i + 1,
    raw,
    code: codeLines[i],
    codeWithoutStrings: executableLines[i],
    strings: [],
    comments: [],
    isInsideComment: false,
    hasExecutableCode: !isJson && codeLines[i].trim().length > 0,
    symbol: '<module>',
  }));
  // A leading comment belongs to the next syntactic scope; an inline comment
  // keeps its line's existing scope. Names, rather than line numbers, let finding
  // identities survive inserted comments while separating different functions.
  let tokenIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    while (tokenIndex < tokens.length && tokens[tokenIndex].end <= lineStarts[i]) tokenIndex++;
    lines[i].symbol = enclosingSymbol(tokens[tokenIndex]?.node ?? sourceFile, sourceFile);
  }
  const appendChunks = (range, property) => {
    const firstLine = sourceFile.getLineAndCharacterOfPosition(range.start).line;
    const lastLine = sourceFile.getLineAndCharacterOfPosition(Math.max(range.start, range.end - 1)).line;
    for (let i = firstLine; i <= lastLine; i++) {
      const start = Math.max(range.start, lineStarts[i]);
      const end = Math.min(range.end, lineStarts[i] + rawLines[i].length);
      lines[i][property].push(source.slice(start, Math.max(start, end)));
    }
  };
  for (const range of comments) appendChunks(range, 'comments');
  for (const range of strings) appendChunks(range, 'strings');
  for (const line of lines) line.isInsideComment = line.comments.length > 0 && !line.hasExecutableCode;
  return lines;
}

function isEmptyValue(node) {
  node = unwrap(node);
  return node && (node.kind === ts.SyntaxKind.NullKeyword
    || (ts.isObjectLiteralExpression(node) && node.properties.length === 0)
    || (ts.isArrayLiteralExpression(node) && node.elements.length === 0));
}

function isAlwaysTrueArrow(node) {
  node = unwrap(node);
  if (!node || !ts.isArrowFunction(node)) return false;
  const body = unwrap(node.body);
  if (body.kind === ts.SyntaxKind.TrueKeyword) return true;
  return ts.isBlock(body) && body.statements.length === 1
    && ts.isReturnStatement(body.statements[0])
    && unwrap(body.statements[0].expression)?.kind === ts.SyntaxKind.TrueKeyword;
}

/**
 * Returns evidence for the scanner without deciding whether a feature is debt.
 * Lines are one-based; offsets are zero-based. Parse errors remain explicit so a
 * damaged source file cannot quietly be counted as a successful clean scan.
 */
export function analyzeSource(source, fileName = 'source.tsx') {
  const kind = scriptKind(fileName);
  const isJson = kind === ts.ScriptKind.JSON;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const tokens = lexicalTokens(sourceFile);
  const comments = isJson ? [] : commentRanges(source, tokens);
  const lines = projectLines(source, sourceFile, tokens, comments, isJson);
  const findings = [];
  const imports = [];
  const errors = [];

  if (isJson) {
    // JSON is literal data, not a TypeScript block with misleading diagnostics.
    try {
      JSON.parse(source.replace(/^\uFEFF/, ''));
    } catch (error) {
      const position = Number(/position (\d+)/i.exec(error.message)?.[1] ?? 0);
      errors.push({ line: sourceFile.getLineAndCharacterOfPosition(Math.min(position, source.length)).line + 1, message: error.message });
    }
    return { lines, findings, imports, errors };
  }

  for (const error of sourceFile.parseDiagnostics) {
    errors.push({
      line: sourceFile.getLineAndCharacterOfPosition(error.start ?? 0).line + 1,
      message: ts.flattenDiagnosticMessageText(error.messageText, '\n'),
    });
  }
  const addFinding = (node, type) => {
    const offset = node.getStart(sourceFile);
    const endOffset = node.end;
    const context = node.getText(sourceFile);
    findings.push({
      line: sourceFile.getLineAndCharacterOfPosition(offset).line + 1,
      endLine: sourceFile.getLineAndCharacterOfPosition(Math.max(offset, endOffset - 1)).line + 1,
      type,
      text: context.trim(),
      context,
      symbol: enclosingSymbol(node, sourceFile),
      offset,
      endOffset,
    });
  };
  const addImport = (node, specifier, importKind) => {
    const value = literalText(specifier);
    if (value === null) return;
    imports.push({ specifier: value, line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1, kind: importKind });
  };

  // -------------------------------------------------------------------------
  // Executable evidence
  // -------------------------------------------------------------------------
  // These patterns intentionally stay narrow. An arbitrary string saying
  // "unimplemented" is documentation or data until executable syntax proves it
  // is the argument of an actual stub. No inferred deletion advice is produced.
  const visit = (node) => {
    if (ts.isThrowStatement(node)) {
      const expression = unwrap(node.expression);
      if (expression && ts.isNewExpression(expression)
        && ts.isIdentifier(unwrap(expression.expression)) && unwrap(expression.expression).text === 'Error'
        && STUB_MESSAGE.test(literalText(expression.arguments?.[0]) ?? '')) {
        addFinding(node, 'THROW_UNIMPLEMENTED');
      }
    }
    if (ts.isReturnStatement(node)) {
      const expression = unwrap(node.expression);
      if (expression && ts.isAsExpression(expression) && expression.type.kind === ts.SyntaxKind.AnyKeyword
        && isEmptyValue(expression.expression)) addFinding(node, 'DUMMY_RETURN_AS_ANY');
    }
    if (ts.isDebuggerStatement(node)) addFinding(node, 'DEBUG_TRAP');
    if (ts.isAsExpression(node) && node.type.kind === ts.SyntaxKind.AnyKeyword) addFinding(node, 'AS_ANY_CAST');
    if (ts.isCallExpression(node)) {
      const method = memberName(node.expression);
      if (isConsoleCall(node)) {
        if (DEBUG_METHODS.has(method)) addFinding(node, 'DEBUG_TRAP');
        if (STUB_METHODS.has(method) && STUB_MESSAGE.test(literalText(node.arguments[0]) ?? '')) addFinding(node, 'CONSOLE_STUB');
      }
      if (method === 'filter' && isAlwaysTrueArrow(node.arguments[0])) addFinding(node, 'DUMMY_FILTER_STUB');
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) addImport(node, node.arguments[0], 'dynamic-import');
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') addImport(node, node.arguments[0], 'require');
    }
    if (ts.isImportDeclaration(node)) addImport(node, node.moduleSpecifier, 'import');
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) addImport(node, node.moduleSpecifier, 'export');
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) addImport(node, node.argument.literal, 'import-type');
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addImport(node, node.moduleReference.expression, 'require');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  for (const range of comments) {
    const context = source.slice(range.start, range.end);
    const checks = [
      ['TS_IGNORE_SUPPRESSION', /@ts-(?:ignore|expect-error)\b/g],
      ['ESLINT_TYPE_SUPPRESSION', /eslint-disable(?:-next-line|-line)?\b[^\r\n]*@typescript-eslint\/no-explicit-any\b/g],
    ];
    for (const [type, pattern] of checks) {
      for (const match of context.matchAll(pattern)) {
        const offset = range.start + match.index;
        const lineIndex = sourceFile.getLineAndCharacterOfPosition(offset).line;
        findings.push({
          line: lineIndex + 1,
          endLine: sourceFile.getLineAndCharacterOfPosition(Math.max(offset, range.end - 1)).line + 1,
          type,
          text: context.trim(),
          context,
          symbol: lines[lineIndex].symbol,
          offset,
          endOffset: range.end,
        });
      }
    }
  }

  findings.sort((a, b) => a.offset - b.offset || a.type.localeCompare(b.type));
  return { lines, findings, imports, errors };
}
