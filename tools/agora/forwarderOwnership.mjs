// WF-G247: a thin export facade is not the implementation a packet promises
// to repair. Read syntax and resolve internal targets without executing code.
// This is deliberately not a call graph: state-owning hooks and callers still
// need the author's explicit scope audit. Never add paths to a worker's grant.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(path.join(REPO, 'package.json'))('typescript');
const slash = value => value.replace(/\\/g, '/');
const within = (root, file) => {
  const relative = path.relative(root, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
};

export function createForwarderResolver(repoRoot = REPO) {
  const root = fs.realpathSync(repoRoot);
  let options = { allowJs: true, moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext };
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
  if (configPath) {
    // Retain aliases/extends, but do not enumerate or typecheck the project.
    const config = ts.getParsedCommandLineOfConfigFile(configPath, { noEmit: true }, {
      ...ts.sys, readDirectory: () => [], onUnRecoverableConfigFileDiagnostic: diagnostic => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    });
    const errors = config.errors.filter(error => error.code !== 18003);
    if (errors.length) throw new Error(ts.flattenDiagnosticMessageText(errors[0].messageText, '\n'));
    options = config.options;
  }
  const resolution = ts.createModuleResolutionCache(root, name => name, options);
  const parsed = new Map();
  const relative = file => slash(path.relative(root, file));
  function source(file) {
    if (!within(root, file) || !within(root, fs.realpathSync(file))) {
      throw new Error('forwarder path escapes repository: ' + relative(file));
    }
    if (!parsed.has(file)) {
      const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      if (tree.parseDiagnostics.length) throw new Error('invalid syntax in forwarder audit: ' + relative(file));
      parsed.set(file, tree);
    }
    return parsed.get(file);
  }
  function runtimeTarget(tree) {
    const targets = new Set();
    for (const statement of tree.statements) {
      if (ts.isEmptyStatement(statement) || ts.isInterfaceDeclaration(statement)
        || ts.isTypeAliasDeclaration(statement)) continue;
      if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) continue;
      if (!ts.isExportDeclaration(statement)) return null;
      if (statement.isTypeOnly || (statement.exportClause && ts.isNamedExports(statement.exportClause)
        && statement.exportClause.elements.length > 0
        && statement.exportClause.elements.every(item => item.isTypeOnly))) continue;
      if (!statement.moduleSpecifier || !ts.isStringLiteralLike(statement.moduleSpecifier)) return null;
      targets.add(statement.moduleSpecifier.text);
    }
    return targets.size === 1 ? [...targets][0] : null;
  }
  return function traceForwarder(ref) {
    let file = path.resolve(root, ref);
    if (!within(root, file)) throw new Error('forwarder path escapes repository: ' + ref);
    if (!fs.existsSync(file)) return null; // Planned new files have no source to trace yet.
    const chain = [relative(file)];
    const seen = new Set();
    for (let depth = 0; depth < 32; depth++) {
      if (seen.has(file)) throw new Error('forwarder cycle: ' + chain.join(' -> '));
      seen.add(file);
      const specifier = runtimeTarget(source(file));
      if (specifier === null) return chain.length === 1 ? null : { facade: chain[0], target: chain.at(-1), chain };
      const result = ts.resolveModuleName(specifier, file, options, ts.sys, resolution).resolvedModule;
      // Package facades and declaration-only libraries need manual review, not
      // invented ownership in node_modules. Internal unresolved exports block.
      if (result?.isExternalLibraryImport || result?.resolvedFileName.includes('/node_modules/')) {
        return chain.length === 1 ? null : { facade: chain[0], target: chain.at(-1), chain };
      }
      if (!result || /\.d\.[cm]?ts$/i.test(result.resolvedFileName)) {
        throw new Error('cannot resolve runtime forwarder target ' + specifier + ' from ' + relative(file));
      }
      file = path.resolve(result.resolvedFileName);
      source(file); // Check physical containment before accepting the target.
      chain.push(relative(file));
    }
    throw new Error('forwarder chain exceeds 32 files: ' + chain.join(' -> '));
  };
}
