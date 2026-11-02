// WF-G228: show imported type contracts and their packet/lock owners before
// dispatch. Read scoped syntax and module links, never execute or typecheck it.
// A candidate is read context, not proof an edit is needed or permission to edit.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { lockOverlap } from './store.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(path.join(REPO, 'package.json'))('typescript');
const within = (root, file) => {
  const relative = path.relative(root, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
};
const slash = file => file.replace(/\\/g, '/');
const hasModifier = (node, kind) => node.modifiers?.some(modifier => modifier.kind === kind);
const FALLBACK_BASIS = 'explicit type import; declaration not identified';
const typeDeclaration = node => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
  || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node);

/** Bounded import/export discovery, not a semantic member or whole-project graph. */
export function inspectSharedTypeDependencies(plan, sourcesByPacket, locks = [], { repoRoot = REPO } = {}) {
  const root = fs.realpathSync(repoRoot), packets = plan.packets || [];
  const entries = new Map(), issues = [], issueKeys = new Set(), parsed = new Map();
  let options, resolution, checkedSources = 0, visits = 0;
  const relative = file => slash(path.relative(root, file));
  const issue = (packetId, source, message) => {
    const key = JSON.stringify([packetId, source, message]);
    if (!issueKeys.has(key)) { issueKeys.add(key); issues.push({ packetId, source, message }); }
  };
  const compiler = () => {
    if (options) return;
    options = { allowJs: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext };
    const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
    if (configPath) {
      // Respect aliases/extends without enumerating source or running a compiler.
      const config = ts.getParsedCommandLineOfConfigFile(configPath, { noEmit: true }, {
        ...ts.sys, readDirectory: () => [], onUnRecoverableConfigFileDiagnostic: diagnostic => {
          throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
        },
      });
      const error = config.errors.find(item => item.code !== 18003);
      if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
      options = config.options;
    }
    resolution = ts.createModuleResolutionCache(root, name => name, options);
  };
  const sourceTree = file => {
    if (!within(root, file) || !within(root, fs.realpathSync(file))) throw new Error('source link escapes repository');
    if (!parsed.has(file)) {
      if (parsed.size >= 256) throw new Error('audit limit: 256 parsed files per plan');
      const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      if (tree.parseDiagnostics.length) throw new Error('unverified syntax: ' + relative(file));
      parsed.set(file, tree);
    }
    return parsed.get(file);
  };
  const resolve = (specifier, from) => {
    compiler();
    const found = ts.resolveModuleName(specifier, from, options, ts.sys, resolution).resolvedModule;
    if (!found) throw new Error('unresolved import/export ' + specifier + ' from ' + relative(from));
    if (found.isExternalLibraryImport || /[\\/]node_modules[\\/]/.test(found.resolvedFileName)) return null;
    const file = path.resolve(found.resolvedFileName);
    if (!within(root, file) || !within(root, fs.realpathSync(file))) throw new Error('import/export resolves outside repository: ' + specifier);
    return relative(file).startsWith('src/') ? file : null;
  };
  function trace(file, symbol, explicitType, chain, seen, warn) {
    if (++visits > 4096) throw new Error('audit limit: 4096 symbol visits per plan');
    if (chain.length > 16) throw new Error('audit limit: 16 import/export links');
    const key = file + '\0' + symbol;
    if (seen.has(key)) throw new Error('cyclic type re-export: ' + chain.join(' -> '));
    const nextSeen = new Set([...seen, key]), tree = sourceTree(file), results = [];
    const add = (name, basis) => results.push({ file: relative(file), symbol: name, basis, via: chain });
    const declarations = tree.statements.filter(typeDeclaration);
    const direct = declarations.filter(node => symbol === '*'
      ? hasModifier(node, ts.SyntaxKind.ExportKeyword)
      : symbol === 'default' ? hasModifier(node, ts.SyntaxKind.DefaultKeyword)
        : node.name?.text === symbol && hasModifier(node, ts.SyntaxKind.ExportKeyword));
    for (const node of direct) add(node.name?.text || symbol, 'exported type declaration');
    const follow = (specifier, forwarded, typeOnly) => {
      // One broken barrel branch must be disclosed, not erase a valid sibling.
      try {
        const target = resolve(specifier, file);
        if (target) results.push(...trace(target, forwarded, explicitType || typeOnly, [...chain, relative(target)], nextSeen, warn));
      } catch (error) { warn(error.message); }
    };
    for (const statement of tree.statements) {
      if (!ts.isExportDeclaration(statement)) continue;
      const clause = statement.exportClause, module = statement.moduleSpecifier;
      if (module && ts.isStringLiteralLike(module)) {
        if (!clause) follow(module.text, symbol, statement.isTypeOnly);
        else if (ts.isNamedExports(clause)) {
          for (const item of clause.elements) if (symbol === '*' || item.name.text === symbol) {
            follow(module.text, (item.propertyName || item.name).text, statement.isTypeOnly || item.isTypeOnly);
          }
        } else if (ts.isNamespaceExport(clause) && (symbol === '*' || clause.name.text === symbol)) {
          follow(module.text, '*', statement.isTypeOnly);
        }
      } else if (!module && clause && ts.isNamedExports(clause)) {
        for (const item of clause.elements) if (symbol === '*' || item.name.text === symbol) {
          const local = (item.propertyName || item.name).text;
          const declaration = declarations.find(node => node.name?.text === local);
          if (declaration) add(local, 'locally exported type declaration');
          else for (const imported of imports(tree)) if (imported.local === local) {
            follow(imported.specifier, imported.symbol, imported.explicitType || statement.isTypeOnly || item.isTypeOnly);
          }
        }
      }
    }
    // Explicit type-only imports may describe typeof a value. Retain the known
    // module with a qualified basis instead of inventing a declaration or edit.
    if (!results.length && explicitType) add(symbol, FALLBACK_BASIS);
    // An `export type *` barrel sends the symbol down every branch, and each branch
    // without the declaration adds the fallback above. Keep a fallback only when no
    // branch found the declaration itself; otherwise src/types/combat/index.ts reported
    // all nine of its modules for every imported combat type.
    const declared = new Set(results.filter(found => found.basis !== FALLBACK_BASIS).map(found => found.symbol));
    return results.filter(found => found.basis !== FALLBACK_BASIS || !declared.has(found.symbol));
  }
  function imports(tree) {
    const found = [];
    for (const statement of tree.statements) {
      if (!ts.isImportDeclaration(statement) || !statement.importClause || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
      const clause = statement.importClause, specifier = statement.moduleSpecifier.text;
      const line = tree.getLineAndCharacterOfPosition(statement.getStart(tree)).line + 1;
      if (clause.name) found.push({ specifier, symbol: 'default', local: clause.name.text, explicitType: clause.isTypeOnly, line });
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const item of clause.namedBindings.elements) found.push({ specifier, symbol: (item.propertyName || item.name).text,
          local: item.name.text, explicitType: clause.isTypeOnly || item.isTypeOnly, line });
      } else if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        found.push({ specifier, symbol: '*', local: clause.namedBindings.name.text, explicitType: clause.isTypeOnly, line });
      }
    }
    return found;
  }
  for (const packet of packets) for (const ref of sourcesByPacket.get(packet.id) || []) {
    const file = path.resolve(root, ref);
    if (!within(root, file)) { issue(packet.id, ref, 'owned source escapes repository'); continue; }
    if (!fs.existsSync(file)) { issue(packet.id, ref, 'planned or missing source not inspected'); continue; }
    let tree;
    try { tree = sourceTree(file); checkedSources++; }
    catch (error) { issue(packet.id, ref, error.message); continue; }
    const referenced = imports(tree);
    const visit = node => {
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
        referenced.push({ specifier: node.argument.literal.text, symbol: node.qualifier?.getText(tree).split('.')[0] || '*',
          explicitType: true, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 });
      }
      if (ts.isImportEqualsDeclaration(node)) issue(packet.id, ref, 'import-equals requires manual type ownership review');
      ts.forEachChild(node, visit);
    };
    visit(tree);
    for (const imported of referenced) {
      try {
        const target = resolve(imported.specifier, file);
        if (!target) continue;
        for (const found of trace(target, imported.symbol, imported.explicitType, [relative(target)], new Set(), message => issue(packet.id, ref, message))) {
          const key = JSON.stringify([packet.id, ref, found.file]);
          if (!entries.has(key)) {
            const owners = packets.filter(owner => lockOverlap([found.file], { paths: owner.files || [], globs: [] }, root))
              .map(owner => ({ packetId: owner.id, handle: owner.handle || null }));
            entries.set(key, { packetId: packet.id, source: ref, file: found.file, symbols: [], evidence: [], owners,
              ownership: owners.length > 1 ? 'ambiguous' : !owners.length ? 'unassigned' : owners[0].packetId === packet.id ? 'self' : 'sibling',
              locks: locks.filter(lock => lockOverlap([found.file], lock, root)).map(lock => ({ id: lock.id, agentId: lock.agentId, reason: lock.reason || '' })) });
          }
          const entry = entries.get(key);
          if (!entry.symbols.includes(found.symbol)) entry.symbols.push(found.symbol);
          const evidence = { specifier: imported.specifier, line: imported.line, imported: imported.symbol,
            symbol: found.symbol, basis: found.basis, via: found.via };
          if (!entry.evidence.some(item => JSON.stringify(item) === JSON.stringify(evidence))) entry.evidence.push(evidence);
        }
      } catch (error) { issue(packet.id, ref, error.message); }
    }
  }
  return { entries: [...entries.values()], issues, checkedSources, observedAt: Date.now() };
}

/** Read-only evidence is carried into a brief; it never expands owned files. */
export function sharedTypePromptBlock(packet, audit) {
  const entries = audit?.entries.filter(entry => entry.packetId === packet.id) || [];
  const issues = audit?.issues.filter(entry => entry.packetId === packet.id) || [];
  // Keep a discovered graph from turning one task-new shell argument into an
  // oversized command. The partition report retains all collected evidence;
  // omissions are explicit and require the parent report, not an absence claim.
  const observations = [...entries.map(entry => 'REFERENCE-ONLY: SHARED-TYPE: ' + JSON.stringify(entry)),
    ...issues.map(entry => 'REFERENCE-ONLY: SHARED-TYPE-AUDIT-ISSUE: ' + JSON.stringify(entry))];
  const selected = []; let bytes = 0;
  for (const line of observations) {
    const size = Buffer.byteLength(line, 'utf8') + 1;
    if (bytes + size <= 8192) { selected.push(line); bytes += size; }
  }
  const omitted = observations.length - selected.length;
  return '\nSHARED TYPE DEPENDENCIES (WF-G228):\n'
    + (audit ? 'Source observation: ' + new Date(audit.observedAt).toISOString() + '; packet owners are plan declarations, not active lock grants.\n' : '')
    + (audit ? selected.join('\n') || (observations.length
      ? 'Evidence omitted from this bounded excerpt; request the full current partition report.'
      : 'No candidates in this scoped syntax observation; this is not a complete type/member graph.')
      : 'Audit not supplied; do not assume there are no shared contracts.')
    + (omitted ? '\nREFERENCE-ONLY: SHARED-TYPE-AUDIT-PARTIAL: ' + JSON.stringify({ omitted })
      + '\nObservation excerpt truncated; ask the parent for the full current partition report before depending on omitted type evidence.' : '')
    + '\nAdvisory candidates only, not edit permission or proof a type change is needed. '
    + 'Re-read the type source, current partition and locks before requesting an explicit parent-approved scope or dependent owning task. '
    + 'Package libraries, dynamic/runtime-only imports and semantic member dependencies need manual review; incomplete audits are not proof of absence.\n';
}
