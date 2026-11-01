// WF-G214: a leaf component's packet needs its real integration owner, not
// a guessed scene name. Inspect declared source links without running code.
// This is not a whole-project call graph, rendered proof or an edit grant.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { hasMagic } from 'glob';
import { lockOverlap, normalizeTaskDeps, isBlockingDepType } from './store.mjs';
import { extractTaskOwnershipPaths } from './taskLint.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(path.join(REPO, 'package.json'))('typescript');
const TASK = /^agora-[a-z0-9]+(?:\.[0-9]+)*$/i;
const within = (root, file) => {
  const relative = path.relative(root, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
};

export function mountFollowUpLine(entry) {
  // Only the parent is this task's edit target; the leaf remains read context.
  return `MOUNT-FOLLOWUP: ${entry.parent} mounts ${entry.symbol}\nREFERENCE-ONLY: MOUNT-LEAF: ${entry.leaf}#${entry.symbol}`;
}

/** Authored declarations stay readable on the durable brief and every prompt. */
export function mountPointPromptBlock(packet) {
  if (!packet.mountPoints?.length) return '';
  return '\nMOUNT POINTS (WF-G214):\n'
    + packet.mountPoints.map(entry => 'REFERENCE-ONLY: MOUNT-POINT: ' + JSON.stringify(entry)).join('\n')
    + '\nRecheck the actual leaf/importer and acquire your own declared locks. '
    + 'Owned delivery needs both files; deferred delivery stays unmounted/incomplete until its named dependent task proves integration. '
    + 'A planned relationship is not an established import. Structural import/JSX evidence is not rendered integration acceptance; '
    + 'preserve the task\'s visual verification and approval boundaries.\n';
}

/**
 * Check the author's exact mount claim and ownership before board writes.
 * Omitted declarations remain a human scope-audit obligation; arbitrary prose
 * cannot be interpreted as a reliable semantic feature/mount declaration.
 */
export function inspectPacketMounts(packet, boardTasks, { repoRoot = REPO } = {}) {
  if (packet.mountPoints === undefined) return [];
  const fail = message => { throw new Error('packet ' + packet.id + ': WF-G214 ' + message); };
  if (!Array.isArray(packet.mountPoints)) fail('mountPoints must be an array');
  const root = fs.realpathSync(repoRoot), seen = new Set(), reports = [];
  const owned = ref => lockOverlap([ref], { paths: packet.files || [], globs: [] }, root);
  const exact = ref => typeof ref === 'string' && ref.startsWith('src/')
    && !ref.includes('\\') && path.posix.normalize(ref) === ref && !ref.split('/').includes('..')
    && !hasMagic(ref, { magicalBraces: true }) && /\.[cm]?[jt]sx?$/i.test(ref) && !/\.d\.[cm]?ts$/i.test(ref);
  const physical = (ref, required) => {
    const file = path.resolve(root, ref);
    let existing = file;
    // A planned new file still cannot hide beneath a junction to another tree.
    while (!fs.existsSync(existing) && existing !== root) existing = path.dirname(existing);
    if (!within(root, fs.realpathSync(existing))) fail('mount path resolves outside the repository: ' + ref);
    if (required && (!fs.existsSync(file) || !fs.statSync(file).isFile())) fail('existing relationship needs readable source: ' + ref);
    return file;
  };
  let options, resolution;
  const compiler = () => {
    if (options) return;
    options = { allowJs: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext };
    const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
    if (configPath) {
      const config = ts.getParsedCommandLineOfConfigFile(configPath, { noEmit: true }, {
        ...ts.sys, readDirectory: () => [], onUnRecoverableConfigFileDiagnostic: error => fail(ts.flattenDiagnosticMessageText(error.messageText, '\n')),
      });
      const error = config.errors.find(item => item.code !== 18003);
      if (error) fail(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
      options = config.options;
    }
    resolution = ts.createModuleResolutionCache(root, name => name, options);
  };
  for (const entry of packet.mountPoints) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || Object.keys(entry).some(key => !['leaf', 'parent', 'symbol', 'relation', 'delivery', 'followUpTask', 'reason'].includes(key))
      || !exact(entry.leaf) || !exact(entry.parent) || entry.leaf === entry.parent
      || typeof entry.symbol !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(entry.symbol)
      || !['existing', 'planned'].includes(entry.relation) || !['owned', 'deferred'].includes(entry.delivery)) {
      fail('mountPoints needs exact leaf/parent source paths, symbol, existing/planned relation and owned/deferred delivery');
    }
    if (entry.reason !== undefined && (typeof entry.reason !== 'string' || !entry.reason.trim())) fail('reason must be nonempty text');
    if (entry.relation === 'planned' && !entry.reason?.trim()) fail('planned link needs a reviewed reason; no current import is inferred');
    const key = JSON.stringify([entry.leaf, entry.parent, entry.symbol]);
    if (seen.has(key)) fail('duplicate mount point: ' + key);
    seen.add(key);
    if (!owned(entry.leaf)) fail('leaf is not owned by this packet: ' + entry.leaf);
    if (entry.delivery === 'owned') {
      if (entry.followUpTask !== undefined) fail('owned delivery must not name a deferred follow-up');
      if (!owned(entry.parent)) fail('mount parent is outside this packet; own it or pre-file a dependent mounting task: ' + entry.parent);
    } else {
      if (owned(entry.parent)) fail('deferred declaration already owns its parent; choose owned delivery or revise the packet');
      if (!TASK.test(entry.followUpTask || '')) fail('deferred delivery needs an exact pre-filed follow-up task id');
    }
    const leaf = physical(entry.leaf, entry.relation === 'existing');
    const parent = physical(entry.parent, entry.relation === 'existing');
    const report = { packetId: packet.id, ...entry, importVerified: false, jsxReferences: 0, followUpVerified: false };
    if (entry.relation === 'existing') {
      compiler();
      const tree = ts.createSourceFile(parent, fs.readFileSync(parent, 'utf8'), ts.ScriptTarget.Latest, true);
      if (tree.parseDiagnostics.length) fail('invalid syntax in declared parent: ' + entry.parent);
      const tags = new Set();
      for (const statement of tree.statements) {
        if (!ts.isImportDeclaration(statement) || !statement.importClause || statement.importClause.isTypeOnly
          || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
        const bindings = statement.importClause.namedBindings;
        const runtimeNamed = bindings && ts.isNamedImports(bindings) ? bindings.elements.filter(item => !item.isTypeOnly) : [];
        if (!statement.importClause.name && !runtimeNamed.length && !(bindings && ts.isNamespaceImport(bindings))) continue;
        const target = ts.resolveModuleName(statement.moduleSpecifier.text, parent, options, ts.sys, resolution).resolvedModule;
        if (!target || target.isExternalLibraryImport || /\.d\.[cm]?ts$/i.test(target.resolvedFileName)) continue;
        if (fs.realpathSync(target.resolvedFileName) !== fs.realpathSync(leaf)) continue;
        report.importVerified = true;
        if (entry.symbol === 'default' && statement.importClause.name) tags.add(statement.importClause.name.text);
        for (const item of runtimeNamed) if ((item.propertyName || item.name).text === entry.symbol) tags.add(item.name.text);
        if (bindings && ts.isNamespaceImport(bindings)) tags.add(bindings.name.text + '.' + entry.symbol);
      }
      if (!report.importVerified) fail('declared parent has no direct runtime import of leaf: ' + entry.parent + ' -> ' + entry.leaf);
      // JSX syntax is a clue, not proof of execution, reachability, visibility
      // or correct props. A module can also import other exports from this leaf.
      const visit = node => {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && tags.has(node.tagName.getText(tree))) report.jsxReferences++;
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
    if (entry.delivery === 'deferred' && boardTasks !== undefined) {
      const follow = boardTasks.find(task => task.id === entry.followUpTask);
      if (!follow || !['open', 'claimed', 'blocked'].includes(follow.state)) fail('mount follow-up must be current and unfinished: ' + entry.followUpTask);
      if (!follow.campaignId) fail('deferred mounting needs build and follow-up in a current campaign');
      if (!(follow.body || '').replace(/\r\n/g, '\n').includes(mountFollowUpLine(entry))) fail('follow-up lacks the exact durable MOUNT-FOLLOWUP obligation');
      if (!extractTaskOwnershipPaths(follow, { repoRoot: root }).some(item => item.ref === entry.parent && item.sources.includes('refs'))) fail('follow-up must name its mount parent as an edit obligation and ref');
      const buildIds = new Set([...(packet.taskIds || []), ...(packet.issues || []), ...(packet.refs || [])].filter(id => TASK.test(id)));
      const deps = normalizeTaskDeps(follow.deps);
      const build = deps.filter(dep => buildIds.has(dep.id) && isBlockingDepType(dep.type))
        .map(dep => boardTasks.find(task => task.id === dep.id && task.campaignId === follow.campaignId)).find(Boolean);
      if (!build || build.id === follow.id) fail('follow-up needs a blocking dependency on an exact current build task in this packet/campaign');
      report.followUpVerified = true;
    }
    reports.push(report);
  }
  return reports;
}
