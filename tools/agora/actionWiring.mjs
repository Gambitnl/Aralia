// WF-G237: declared action changes need dispatch and payload delivery owners.
// Inspect anchored syntax without executing game code or expanding edit scope.
// A literal route is not whole-program data flow or runtime acceptance proof.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readCitationSource, inspectSourceCitations } from './taskLint.mjs';
import { isDeepStrictEqual } from 'node:util';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(path.join(REPO, 'package.json'))('typescript');
const identifier = value => typeof value === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(value);
const exact = value => typeof value === 'string' && /^src\/[A-Za-z0-9_./@-]+\.[cm]?[jt]sx?$/.test(value)
  && path.posix.normalize(value) === value && !value.split('/').includes('..') && !/\.d\.[cm]?ts$/.test(value);
const concrete = value => typeof value === 'string' && value.trim() && Buffer.byteLength(value, 'utf8') <= 2048 && !/\b(?:TODO|TBD)\b/i.test(value);
const fieldsOnly = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => fields.includes(key));
const name = node => node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : undefined;
const property = (node, key) => node?.properties?.find(item => name(item.name) === key);
const literal = node => node && (ts.isStringLiteralLike(node) ? node.text : ts.isLiteralTypeNode(node) && ts.isStringLiteralLike(node.literal) ? node.literal.text : undefined);
function nodes(root, predicate) {
  const result = []; let visited = 0;
  const visit = node => { if (++visited > 200000) throw new Error('syntax audit exceeds200000 nodes'); if (predicate(node)) result.push(node); ts.forEachChild(node, visit); };
  visit(root); return result;
}
const actionObject = (node, action) => ts.isObjectLiteralExpression(node) && literal(property(node, 'type')?.initializer) === action;
const actionMember = (node, action) => ts.isTypeLiteralNode(node) && literal(node.members.find(item => name(item.name) === 'type')?.type) === action;
const exported = node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);

/** Qualified current evidence and edit obligations, never implicit authority. */
export function inspectPacketActionWiring(packet, { repoRoot = REPO, sourceFiles = packet.files || [] } = {}) {
  const fail = message => { throw new Error('packet '+packet.id+': WF-G237 '+message); };
  const root = fs.realpathSync(repoRoot), parsed = new Map(), entries = [], references = new Set();
  const critical = sourceFiles.filter(file => file === 'src/state/actionTypes.ts' || /^src\/state\/reducers\/[^/]+\.[jt]s$/.test(file) && !/\.d\.ts$/.test(file));
  const declarations = packet.actionWiring === undefined ? [] : packet.actionWiring;
  if (!Array.isArray(declarations) || declarations.length > 16) fail('actionWiring needs at most16 reviewed routes');
  if (Buffer.byteLength(JSON.stringify([declarations, packet.actionWiringReview || null]), 'utf8') > 8192) fail('action wiring declarations exceed8192 bytes per packet');
  const tree = file => {
    if (!parsed.has(file)) {
      if (parsed.size >= 64) fail('audit exceeds64 files');
      let source; try { source = readCitationSource(root, file); } catch (error) { fail('source unavailable: '+file+'; '+error.message); }
      const value = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      if (value.parseDiagnostics.length) fail('unverified syntax in '+file);
      parsed.set(file, { source, tree: value });
    }
    return parsed.get(file).tree;
  };
  const anchor = (file, quote) => {
    if (!exact(file) || typeof quote !== 'string' || quote.trim().length < 4 || Buffer.byteLength(quote, 'utf8') > 4096) fail('source anchors need exact src paths and4-4096 byte quotes');
    tree(file);
    const result = inspectSourceCitations({ body: 'SOURCE-CITATION: '+JSON.stringify({ file, quote }) }, { readSource: ref => { tree(ref); return parsed.get(ref).source; } });
    if (result.issues.length) fail('stale or ambiguous source anchor: '+file+'; '+result.issues.map(issue => issue.reason).join('; '));
    return result.resolved[0].line;
  };
  let review;
  if (packet.actionWiringReview !== undefined) {
    const value = packet.actionWiringReview;
    if (declarations.length || !fieldsOnly(value, ['reason','sources']) || !concrete(value.reason) || !Array.isArray(value.sources) || !value.sources.length || value.sources.length > 16) fail('unchanged wiring review needs a concrete reason and current sources; do not combine with changed routes');
    const seen = new Set();
    for (const item of value.sources) {
      if (!fieldsOnly(item, ['file','quote']) || seen.has(item.file)) fail('unchanged review needs unique exact source anchors');
      seen.add(item.file); anchor(item.file, item.quote);
    }
    for (const file of critical) if (!seen.has(file)) fail('unreviewed core action source: '+file);
    review = { ...value, current: true };
  }
  if (critical.length && !declarations.length && !review) fail('core reducer/AppAction ownership needs an affected-action audit or justified current unchanged-wiring review');
  const ids = new Set();
  let options, resolution;
  const resolveImport = (specifier, file) => {
    if (!options) {
      options = { allowJs: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext };
      const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
      if (configPath) {
        const config = ts.getParsedCommandLineOfConfigFile(configPath, { noEmit: true }, { ...ts.sys, readDirectory: () => [], onUnRecoverableConfigFileDiagnostic: diagnostic => fail(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')) });
        if (config.errors.some(error => error.code !== 18003)) fail('unresolved module configuration');
        options = config.options;
      }
      resolution = ts.createModuleResolutionCache(root, value => value, options);
    }
    const found = ts.resolveModuleName(specifier, path.join(root,file), options, ts.sys, resolution).resolvedModule;
    if (!found || found.isExternalLibraryImport) return null;
    return path.relative(root, path.resolve(found.resolvedFileName)).replaceAll('\\','/');
  };
  for (const entry of declarations) {
    if (!fieldsOnly(entry, ['id','kind','action','stateAction','relation','reason','payloadFields','metadataExpectation','builderExport','roles']) || typeof entry.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(entry.id) || ids.has(entry.id)
      || !['ui','payload'].includes(entry.kind) || !identifier(entry.action) || (entry.stateAction !== undefined && !identifier(entry.stateAction))
      || !['existing','planned'].includes(entry.relation) || !concrete(entry.reason) || !Array.isArray(entry.payloadFields) || entry.payloadFields.length > 32
      || new Set(entry.payloadFields).size !== entry.payloadFields.length || entry.payloadFields.some(field => !identifier(field))) fail('malformed or duplicate action route');
    ids.add(entry.id);
    const roleNames = entry.kind === 'ui' ? ['stateType','reducer','uiType','metadata','handler','emitter'] : ['stateType','reducer','builder','caller'];
    if (!fieldsOnly(entry.roles, roleNames) || roleNames.some(role => !entry.roles[role])) fail('route omits a required '+entry.kind+' role');
    if (entry.kind === 'payload' && (!entry.payloadFields.length || !identifier(entry.builderExport) || entry.metadataExpectation !== undefined)) fail('payload route needs fields and an exact builder export, not UI metadata');
    if (entry.kind === 'ui' && (entry.builderExport !== undefined || !fieldsOnly(entry.metadataExpectation,['isUiToggle','managesLoading']) || Object.values(entry.metadataExpectation).some(value => typeof value !== 'boolean'))) fail('UI route needs an explicit metadata expectation');
    const roles = [];
    for (const roleName of roleNames) {
      const value = entry.roles[roleName];
      if (!fieldsOnly(value,['file','quote','change','reason','newFile']) || typeof value.change !== 'boolean' || value.reason !== undefined && !concrete(value.reason)) fail('role needs file,quote and explicit change flag: '+roleName);
      if (!value.change && !concrete(value.reason)) fail('read-only role needs a concrete unchanged-contract reason: '+roleName);
      let line;
      if (value.newFile !== undefined) {
        if (value.newFile !== true || entry.relation !== 'planned' || !value.change || !exact(value.file) || value.quote !== undefined || !concrete(value.reason)) fail('newFile needs planned edit intent, exact path and a reason, not a current quote');
        const target = path.join(root,value.file); let parent = path.dirname(target);
        if (fs.existsSync(target)) fail('newFile premise is stale; inspect current source: '+value.file);
        while (!fs.existsSync(parent) && parent !== root) parent = path.dirname(parent);
        const relative = path.relative(root,fs.realpathSync(parent));
        if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..'+path.sep)) fail('newFile parent escapes repository');
      } else line = anchor(value.file, value.quote);
      if (value.change) references.add(value.file);
      roles.push({name:roleName,...value,line});
    }
    if (entry.roles.stateType.file !== 'src/state/actionTypes.ts') fail('stateType must name the canonical AppAction source');
    if (entry.kind === 'ui' && (entry.roles.uiType.file !== 'src/types/actions.ts' || entry.roles.metadata.file !== 'src/types/actions.ts' || entry.roles.handler.file !== 'src/hooks/actions/actionHandlers.ts')) fail('UI contract, metadata and handler must name the canonical wiring pair');
    const result = { ...entry, packetId:packet.id, roles, syntaxVerified:false, observedAt:new Date().toISOString() };
    if (entry.relation === 'existing') {
      const stateAction = entry.stateAction || entry.action;
      const type = tree(entry.roles.stateType.file).statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'AppAction');
      const members = type ? nodes(type.type,node => actionMember(node,stateAction)) : [];
      if (members.length !== 1) fail('AppAction needs one direct discriminated member for '+stateAction);
      const payload = members[0].members.find(item => name(item.name) === 'payload')?.type;
      for (const field of entry.payloadFields) if (!payload || !ts.isTypeLiteralNode(payload) || !payload.members.some(item => name(item.name) === field)) fail('AppAction payload field is missing or unsupported: '+field);
      const cases = nodes(tree(entry.roles.reducer.file), node => ts.isCaseClause(node) && literal(node.expression) === stateAction);
      if (cases.length !== 1) fail('reducer needs one current case for '+stateAction);
      for (const field of entry.payloadFields) if (!nodes(cases[0], node => ts.isPropertyAccessExpression(node) && name(node.name) === field || ts.isBindingElement(node) && name(node.propertyName || node.name) === field).length) fail('reducer payload access is missing or unsupported: '+field);
      if (entry.kind === 'ui') {
        const uiTree = tree(entry.roles.uiType.file);
        const actionType = uiTree.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'ActionType');
        const action = uiTree.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'Action');
        if (!actionType || !nodes(actionType.type,node => ts.isLiteralTypeNode(node) && literal(node) === entry.action).length || !action || nodes(action.type,node => actionMember(node,entry.action)).length !== 1) fail('UI ActionType and discriminated Action do not declare '+entry.action);
        const registry = nodes(tree(entry.roles.metadata.file),node => ts.isVariableDeclaration(node) && name(node.name) === 'ACTION_METADATA');
        const metadata = registry.length === 1 && property(registry[0].initializer,entry.action)?.initializer;
        if (!metadata || !ts.isObjectLiteralExpression(metadata)) fail('UI metadata entry is missing or unsupported');
        for (const [key,value] of Object.entries(entry.metadataExpectation)) if (property(metadata,key)?.initializer?.kind !== (value ? ts.SyntaxKind.TrueKeyword : ts.SyntaxKind.FalseKeyword)) fail('UI metadata contradicts '+key);
        const handlers = nodes(tree(entry.roles.handler.file),node => ts.isPropertyAssignment(node) && name(node.name) === entry.action);
        if (handlers.length !== 1 || !nodes(handlers[0].initializer,node => ts.isCallExpression(node) && name(node.expression) === 'dispatch' && node.arguments.some(argument => actionObject(argument,stateAction))).length) fail('direct handler dispatch is missing, ambiguous or unsupported');
        if (!nodes(tree(entry.roles.emitter.file),node => ts.isCallExpression(node) && node.arguments.some(argument => actionObject(argument,entry.action))).length) fail('UI emission is missing or unsupported');
      } else {
        const builders = tree(entry.roles.builder.file).statements.flatMap(statement => {
          if (!exported(statement)) return [];
          if (ts.isFunctionDeclaration(statement) && name(statement.name) === entry.builderExport) return [statement];
          return ts.isVariableStatement(statement) ? statement.declarationList.declarations.filter(node => name(node.name) === entry.builderExport && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))).map(node=>node.initializer) : [];
        });
        if (builders.length !== 1) fail('builder export is missing, ambiguous or unsupported');
        const constructed = nodes(builders[0],node => actionObject(node,stateAction));
        if (!constructed.some(node => { const value = property(node,'payload')?.initializer; return value && ts.isObjectLiteralExpression(value) && entry.payloadFields.every(field=>property(value,field)); })) fail('builder does not explicitly construct the declared payload fields');
        const caller = tree(entry.roles.caller.file), aliases = new Set();
        for (const statement of caller.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier) && statement.importClause && !statement.importClause.isTypeOnly && statement.importClause.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
          if (resolveImport(statement.moduleSpecifier.text,entry.roles.caller.file) !== entry.roles.builder.file) continue;
          for (const item of statement.importClause.namedBindings.elements) if (!item.isTypeOnly && name(item.propertyName || item.name) === entry.builderExport) aliases.add(item.name.text);
        }
        if (!nodes(caller,node=>ts.isCallExpression(node) && aliases.has(name(node.expression))).length) fail('caller does not directly import and call the declared builder export');
      }
      result.syntaxVerified = true;
    }
    entries.push(result);
  }
  for (const file of critical) if (entries.length && !entries.some(entry=>entry.roles.some(role=>role.file===file))) fail('unreviewed core action source: '+file);
  return { entries, references:[...references], review, checkedFiles:parsed.size };
}

/** Do not let a stale board brief silently disappear from the worker plan. */
export function assertTaskActionWiring(packet, task) {
  const fail = message => { throw new Error('task '+task.id+': WF-G237 '+message); };
  let bytes = 0, reviewSeen = false; const ids = new Set();
  for (const line of String(task.body || '').split(/\r?\n/)) {
    const match = /^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?(ACTION-WIRING(?:-UNCHANGED)?)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    bytes += Buffer.byteLength(match[2], 'utf8'); if (bytes > 8192) fail('recorded wiring exceeds8192 bytes');
    let record; try { record = JSON.parse(match[2]); } catch { fail('invalid recorded wiring JSON'); }
    if (match[1].toUpperCase() === 'ACTION-WIRING-UNCHANGED') {
      if (reviewSeen || !isDeepStrictEqual(record,packet.actionWiringReview)) fail('recorded unchanged review differs from the plan'); reviewSeen = true;
    } else {
      if (!record || ids.has(record.id) || ids.size >= 16 || !isDeepStrictEqual(record,packet.actionWiring?.find(entry=>entry.id===record.id))) fail('recorded action route is duplicate or missing/different in the plan');
      ids.add(record.id);
    }
  }
}

/** Durable declarations remain context; edit ownership comes from preflight. */
export function actionWiringPromptBlock(packet) {
  if (!packet.actionWiring?.length && !packet.actionWiringReview) return '';
  return '\nACTION WIRING (WF-G237):\n'+(packet.actionWiring || []).map(entry=>'REFERENCE-ONLY: ACTION-WIRING: '+JSON.stringify(entry)).join('\n')
    +(packet.actionWiringReview ? '\nREFERENCE-ONLY: ACTION-WIRING-UNCHANGED: '+JSON.stringify(packet.actionWiringReview) : '')
    +'\nRecheck current task, route sources and locks. Planned links are incomplete delivery. Required changes need owned files or explicit owning sibling handoffs; acquire your own locks. Syntax and parent-reviewed read-only roles are not runtime acceptance, complete data flow or file/command grants.\n';
}
