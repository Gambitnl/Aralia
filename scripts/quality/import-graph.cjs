// Shared static import graph for the orphan report and its triage ledger.
// Candidate modules live under src/, but their importers can live in scripts/
// or tests/ (including nested __tests__ directories).
const fs = require('node:fs');
const path = require('node:path');

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

module.exports = { collectImportEdges };
