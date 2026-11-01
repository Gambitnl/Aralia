// Shared static import graph for the orphan report and its triage ledger.
// Candidate modules live under src/, but their importers can live in scripts/
// or tests/ (including nested __tests__ directories).
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const IMPORTER_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const IMPORT_RE = /(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

function walkImporters(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') walkImporters(path.join(dir, entry.name), out);
    } else if (entry.isFile() && IMPORTER_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function resolveSpecifier(repoRoot, fromFile, spec) {
  const base = spec.startsWith('@/')
    ? path.join(repoRoot, 'src', spec.slice(2))
    : (spec.startsWith('./') || spec.startsWith('../'))
      ? path.resolve(path.dirname(fromFile), spec)
      : null;
  if (!base) return null;

  const ext = path.extname(base);
  const candidates = [];
  if (!ext) {
    candidates.push(base);
    for (const suffix of ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']) {
      candidates.push(base + suffix);
    }
    candidates.push(path.join(base, 'index.ts'), path.join(base, 'index.tsx'));
  } else if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    // TypeScript scripts may use the emitted .js extension in their imports.
    candidates.push(base.slice(0, -ext.length) + '.ts', base.slice(0, -ext.length) + '.tsx', base);
  } else {
    candidates.push(base);
  }
  return candidates.find((candidate) => {
    try { return fs.statSync(candidate).isFile(); } catch { return false; }
  }) || null;
}

function collectImportEdges(repoRoot) {
  const inbound = new Map();
  const edges = [];
  const roots = ['src', 'scripts', 'tests'].map((root) => path.join(repoRoot, root));
  for (const file of roots.flatMap((root) => walkImporters(root))) {
    const text = fs.readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const match of text.matchAll(IMPORT_RE)) {
      const spec = match[1] || match[2] || match[3] || match[4];
      const target = resolveSpecifier(repoRoot, file, spec);
      if (!target || target === file) continue;
      inbound.set(target, (inbound.get(target) || 0) + 1);
      edges.push({
        from: path.relative(repoRoot, file).replace(/\\/g, '/'),
        to: path.relative(repoRoot, target).replace(/\\/g, '/'),
      });
    }
  }
  return { inbound, edges };
}



// Local preview modules are useful evidence, but are not necessarily present in
// a clone. Attach Git provenance before a cycle is routed to another agent.
function collectFileProvenance(repoRoot, files) {
  const inventory = spawnSync('git', ['-C', repoRoot, '-c', 'core.fsmonitor=false', 'ls-files', '-z', '--cached', '--', 'src'], {
    encoding: 'utf8', shell: false, windowsHide: true, maxBuffer: 32 * 1024 * 1024,
  });
  if (inventory.error) throw inventory.error;
  if (inventory.status !== 0) throw new Error('Cannot verify source Git provenance: ' + inventory.stderr);
  const tracked = new Set(inventory.stdout.split('\0').filter(Boolean));
  const local = files.filter(file => !tracked.has(file));
  const ignored = new Set();
  if (local.length) {
    const result = spawnSync('git', ['-C', repoRoot, '-c', 'core.fsmonitor=false', 'check-ignore', '-z', '--stdin'], {
      input: local.join('\0') + '\0', encoding: 'utf8', shell: false, windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (![0, 1].includes(result.status)) throw new Error('Cannot verify ignored source: ' + result.stderr);
    for (const file of result.stdout.split('\0').filter(Boolean)) ignored.add(file);
  }
  return Object.fromEntries(files.map(file => [file, tracked.has(file) ? 'tracked' : ignored.has(file) ? 'ignored' : 'untracked']));
}

// Fresh cycle inventory complements the existing orphan graph without changing
// its historical regex or callers. This pass uses syntax and tsconfig resolution;
// declared type edges and lazy imports remain distinguishable from eager edges.
function collectCycleGraph(repoRoot) {
  const ts = require('typescript');
  const crypto = require('node:crypto');
  const { isProductionSource } = require('./debt-summary.cjs');
  const config = ts.findConfigFile(repoRoot, ts.sys.fileExists);
  const parsed = config ? ts.getParsedCommandLineOfConfigFile(config, {}, {
    ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  }) : null;
  if (parsed?.errors.length) throw new Error(ts.flattenDiagnosticMessageText(parsed.errors[0].messageText, '\n'));
  const options = parsed?.options || { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowJs: true };
  const cache = ts.createModuleResolutionCache(repoRoot, file => ts.sys.useCaseSensitiveFileNames ? file : file.toLowerCase(), options);
  const files = walkImporters(path.join(repoRoot, 'src'))
    .map(file => path.relative(repoRoot, file).replace(/\\/g, '/')).filter(isProductionSource).sort();
  if (!files.length) throw new Error('Production source inventory is empty.');
  const known = new Set(files);
  const fileProvenance = collectFileProvenance(repoRoot, files);
  const edges = [];
  const issues = [];
  const hash = crypto.createHash('sha256');
  const edgeKeys = new Set();
  const contents = new Map();
  for (const file of files) {
    const absolute = path.join(repoRoot, file);
    const content = fs.readFileSync(absolute, 'utf8');
    hash.update(file + '\0' + content + '\0');
    contents.set(file, content);
    const tree = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    for (const diagnostic of tree.parseDiagnostics) issues.push({ file, kind: 'syntax', message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') });
    function add(specifier, kind) {
      if (!specifier || !ts.isStringLiteralLike(specifier)) return;
      const spec = specifier.text;
      if (!spec.startsWith('.') && !spec.startsWith('@/')) return;
      // Resources cannot import code back. A query import returns a URL or raw
      // text, rather than evaluating the referenced module in this graph.
      if (/[?]/.test(spec) || /\.(?:json|css|scss|svg|png|jpe?g|gif|webp|ico|glsl|wgsl|wasm|glb|gltf|mp3|wav|ogg)$/.test(spec)) return;
      const resolved = ts.resolveModuleName(spec, absolute, options, ts.sys, cache).resolvedModule;
      if (!resolved) { issues.push({ file, kind: 'unresolved', specifier: spec }); return; }
      const to = path.relative(repoRoot, resolved.resolvedFileName).replace(/\\/g, '/');
      if (!known.has(to)) return;
      if (/\.d\.[cm]?ts$/.test(file) || /\.d\.[cm]?ts$/.test(to)) kind = 'type';
      const key = file + '\0' + to + '\0' + kind;
      if (!edgeKeys.has(key)) { edgeKeys.add(key); edges.push({ from: file, to, kind }); }
    }
    function visit(node) {
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        const named = clause?.namedBindings;
        const typeOnly = clause?.isTypeOnly || (!options.verbatimModuleSyntax && !clause?.name && named && ts.isNamedImports(named)
          && named.elements.length > 0 && named.elements.every(element => element.isTypeOnly));
        add(node.moduleSpecifier, typeOnly ? 'type' : 'static');
      } else if (ts.isExportDeclaration(node)) {
        const named = node.exportClause;
        const typeOnly = node.isTypeOnly || (!options.verbatimModuleSyntax && named && ts.isNamedExports(named) && named.elements.length > 0
          && named.elements.every(element => element.isTypeOnly));
        add(node.moduleSpecifier, typeOnly ? 'type' : 'static');
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node.argument.literal, 'type');
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression, node.isTypeOnly ? 'type' : 'require');
      else if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0], 'dynamic');
        if (ts.isIdentifier(node.expression) && node.expression.text === 'require') add(node.arguments[0], 'require');
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  edges.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  // Unmarked imports of types can look eager in source but vanish on emission.
  // Check only cycle candidates, using the same captured bytes and tsconfig.
  // This is an isolated TypeScript emit, not a Vite bundle or runtime proof.
  const candidateFiles = new Set(cycleGroups(files, edges.filter(edge => edge.kind === 'static' || edge.kind === 'require'))
    .flatMap(group => group.members));
  const emittedCandidateEdges = [];
  for (const file of [...candidateFiles].sort()) {
    const emitted = ts.transpileModule(contents.get(file), { fileName: file,
      compilerOptions: { ...options, noEmit: false, declaration: false, emitDeclarationOnly: false, sourceMap: false, inlineSourceMap: false },
    }).outputText;
    const tree = ts.createSourceFile(file + '.js', emitted, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function addEmitted(specifier) {
      if (!specifier || !ts.isStringLiteralLike(specifier)) return;
      const spec = specifier.text;
      if (!spec.startsWith('.') && !spec.startsWith('@/')) return;
      const resolved = ts.resolveModuleName(spec, path.join(repoRoot, file), options, ts.sys, cache).resolvedModule;
      if (!resolved) return;
      const to = path.relative(repoRoot, resolved.resolvedFileName).replace(/\\/g, '/');
      if (candidateFiles.has(to) && !emittedCandidateEdges.some(edge => edge.from === file && edge.to === to)) emittedCandidateEdges.push({ from: file, to, kind: 'emitted-static' });
    }
    function visitEmitted(node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) addEmitted(node.moduleSpecifier);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') addEmitted(node.arguments[0]);
      ts.forEachChild(node, visitEmitted);
    }
    visitEmitted(tree);
  }
  const compilerAssumptions = { typescript: ts.version, isolatedModules: Boolean(options.isolatedModules),
    verbatimModuleSyntax: Boolean(options.verbatimModuleSyntax), emitMode: 'isolated transpileModule' };
  return { files, edges, issues, emittedCandidateEdges, fileProvenance, compilerAssumptions, sourceSha256: hash.digest('hex'), scope: 'current filesystem production src, including ignored and untracked local source' };
}

// Report strongly connected groups, not an exponential list of every simple
// cycle. Iterative traversals also handle long dependency chains without relying
// on the JavaScript call-stack limit. An internal edge list is the exact witness.
function cycleGroups(files, edges) {
  const forward = new Map(files.map(file => [file, new Set()]));
  const reverse = new Map(files.map(file => [file, new Set()]));
  for (const { from, to } of edges) if (forward.has(from) && forward.has(to)) {
    forward.get(from).add(to); reverse.get(to).add(from);
  }
  const seen = new Set();
  const order = [];
  for (const file of files) {
    if (seen.has(file)) continue;
    seen.add(file);
    const stack = [{ node: file, iterator: forward.get(file).values() }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const next = frame.iterator.next();
      if (next.done) { order.push(frame.node); stack.pop(); }
      else if (!seen.has(next.value)) {
        seen.add(next.value);
        stack.push({ node: next.value, iterator: forward.get(next.value).values() });
      }
    }
  }
  seen.clear();
  const groups = [];
  for (const file of order.reverse()) {
    if (seen.has(file)) continue;
    const members = [];
    const stack = [file]; seen.add(file);
    while (stack.length) {
      const node = stack.pop(); members.push(node);
      for (const next of reverse.get(node)) if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
    if (members.length > 1 || forward.get(file).has(file)) {
      members.sort(); const set = new Set(members);
      groups.push({ members, edges: edges.filter(edge => set.has(edge.from) && set.has(edge.to)) });
    }
  }
  return groups.sort((a, b) => b.members.length - a.members.length || a.members[0].localeCompare(b.members[0]));
}

function cycleReport(repoRoot) {
  const graph = collectCycleGraph(repoRoot);
  const eager = graph.edges.filter(edge => edge.kind === 'static' || edge.kind === 'require');
  const annotate = groups => groups.map(group => ({ ...group,
    memberProvenance: Object.fromEntries(group.members.map(file => [file, graph.fileProvenance[file]])) }));
  return {
    ...graph, generatedAt: new Date().toISOString(),
    complete: graph.issues.length === 0,
    groups: annotate(cycleGroups(graph.files, graph.edges)),
    eagerCandidateGroups: annotate(cycleGroups(graph.files, eager)),
    emittedCandidateGroups: annotate(cycleGroups(graph.files, graph.emittedCandidateEdges)),
    eagerCoverageComplete: graph.issues.every(issue => /\.d\.[cm]?ts$/.test(issue.file)),
    limit: 'Static source relationships only. Unmarked imports used solely as types may be erased; dynamic edges are deferred. No initialization failure or runtime reachability is established.',
  };
}

module.exports = { collectImportEdges, collectCycleGraph, cycleGroups, cycleReport };

if (require.main === module) {
  if (!process.argv.includes('--cycles')) { console.error('Usage: node scripts/quality/import-graph.cjs --cycles'); process.exitCode = 1; }
  else {
    try { const report = cycleReport(process.cwd()); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.complete ? 0 : 1; }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
