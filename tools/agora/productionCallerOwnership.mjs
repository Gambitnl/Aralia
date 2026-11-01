// WF-G255: a wiring packet needs the game-state caller, not just a pure module.
// The parent declares the reviewed call chain; partition checks current source
// anchors, direct import/call clues and ownership or exact dependent tasks.
// This does not infer complete data flow, certify the nearest caller, execute
// game code, grant files or turn planned/deferred wiring into finished work.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readCitationSource, inspectSourceCitations, extractTaskOwnershipPaths } from './taskLint.mjs';
import { lockOverlap, normalizeTaskDeps, isBlockingDepType } from './store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(import.meta.url)('typescript');
const TASK = /^agora-[a-z0-9]+(?:\.[0-9]+)*$/i;
const name = node => node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : undefined;
const identifier = value => typeof value === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(value);
const exact = value => typeof value === 'string' && /^src\/[A-Za-z0-9_./@-]+\.[cm]?[jt]sx?$/.test(value)
  && path.posix.normalize(value) === value && !value.split('/').includes('..') && !/\.d\.[cm]?ts$/.test(value)
  && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(value) && !value.includes('/__tests__/');
const text = value => typeof value === 'string' && value.trim() && Buffer.byteLength(value,'utf8') <= 4096 && !/\b(?:TODO|TBD)\b/i.test(value);
const only = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
const MARKER = /^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?PRODUCTION-CALLER\s*:\s*(.*)$/i;

// This detects explicit wiring instructions, not arbitrary English semantics.
// Historical/reference-only lines and existing generic policy paragraphs are
// not new work. Authors must still declare every affected production chain.
export function hasProductionWiringIntent(value) {
  const prose = String(value || '').split(/\r?\n/).filter(line => !/^[ \t>*-]*(?:REFERENCE-ONLY|EVIDENCE|HISTORY|SNAPSHOT|KNOWN-INVALID)\s*:/i.test(line)
    && !MARKER.test(line) && !/^(?:ACTION DELIVERY|UNION DELIVERY|DOCUMENTATION AUDIT|FILE\/SYMBOL PREMISES|SIBLING PRESERVATION|SOURCE MEMBERS) \(WF-G\d+\):/.test(line)).join('\n');
  // Formatting and empty call notation do not change a wiring instruction.
  const plain = prose.replace(/[`*~]/g,'').replace(/[()[\]"']/g,' ');
  return /\b(?:wire|wiring|integrate|integrating)\s+(?:[\w$./:@\\-]+\s+){1,8}(?:to|into|with|through)\b/i.test(plain);
}

export function productionFollowUpLine(entry, caller) {
  // The source module remains read context, not an edit grant for its sibling.
  return `PRODUCTION-FOLLOWUP: ${caller.file}#${caller.symbol} delivers GameState.${entry.state.field}\nREFERENCE-ONLY: PRODUCTION-SOURCE: ${entry.module.file}#${entry.module.symbol}`;
}

export function productionCallerPromptBlock(packet) {
  const entries = packet.productionCallers || [];
  return '\nPRODUCTION DELIVERY (WF-G255): own the reviewed state-holding caller or name its pre-filed dependent follow-up. '
    + 'Recheck the current chain, nearest state owner and required companion tests before editing. '
    + 'Planned/deferred wiring remains incomplete acceptance; current syntax clues are not data-flow or gameplay proof. '
    + 'These records grant no files, locks or commands. Do not omit a required caller or silently widen ownership.\n'
    + entries.map(entry => 'REFERENCE-ONLY: PRODUCTION-CALLER: '+JSON.stringify(entry)).join('\n')+'\n';
}

// Existing task declarations must survive a new partition or seeded dispatch.
// Validate again after merging; a copied marker never becomes trusted evidence.
export function assertTaskProductionCallers(packet, task) {
  const fail = message => { throw new Error('WF-G255 '+message); };
  const entries = packet.productionCallers || [], seen = new Set();
  for (const line of String(task.body || '').split(/\r?\n/)) {
    const match = MARKER.exec(line); if (!match) continue;
    let value; try { if (Buffer.byteLength(match[1],'utf8') > 65536) throw new Error(); value=JSON.parse(match[1]); } catch { fail('invalid task PRODUCTION-CALLER metadata'); }
    if (!value?.id || seen.has(value.id) || !entries.some(entry => isDeepStrictEqual(entry,value))) fail('task productionCallers must be retained exactly in this packet');
    seen.add(value.id);
  }
  if (hasProductionWiringIntent([task.title,task.body].join('\n')) && !entries.length) fail('wiring task requires productionCallers before dispatch');
}

export function inspectProductionCallers(packet, boardTasks, { repoRoot=ROOT }={}) {
  const fail = message => { throw new Error('packet '+packet.id+': WF-G255 '+message); };
  const declarations = packet.productionCallers === undefined ? [] : packet.productionCallers;
  if (!Array.isArray(declarations) || declarations.length>16 || Buffer.byteLength(JSON.stringify(declarations),'utf8')>65536) fail('productionCallers needs at most16 bounded route records');
  if (hasProductionWiringIntent([packet.scope,packet.guidance].join('\n')) && !declarations.length) fail('wiring intent requires productionCallers; review the nearest state-holding caller');
  if (!declarations.length) return [];
  const root=fs.realpathSync(repoRoot), parsed=new Map(), ids=new Set();
  const owned=file=>Boolean(lockOverlap([file],{paths:packet.files||[],globs:[]},root));
  const source=file=>{
    if (!exact(file)) fail('need an exact production source, not a test, declaration, glob or traversal: '+file);
    if (!parsed.has(file)) {
      if (parsed.size>=64) fail('source audit exceeds64 files');
      let raw;try { raw=readCitationSource(root,file); } catch(error) { fail('source unavailable: '+file+'; '+error.message); }
      const tree=ts.createSourceFile(file,raw,ts.ScriptTarget.Latest,true);
      if (tree.parseDiagnostics.length) fail('source syntax unavailable: '+file);
      parsed.set(file,{raw,tree});
    }
    return parsed.get(file);
  };
  const anchor=role=>{
    if (!only(role,['file','symbol','quote','relation','reason','delivery','followUpTask']) || !identifier(role.symbol) || !text(role.quote)) fail('source roles need exact file, symbol and bounded current quote');
    const {raw}=source(role.file);
    const check=inspectSourceCitations({body:'SOURCE-CITATION: '+JSON.stringify({file:role.file,quote:role.quote})},{readSource:()=>raw});
    if (check.issues.length) fail('stale or ambiguous source anchor: '+role.file);
    return check.resolved[0].line;
  };
  const functions=(file,symbol)=>source(file).tree.statements.flatMap(node=>{
    if (!node.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword)) return [];
    if (ts.isFunctionDeclaration(node) && name(node.name)===symbol && node.body) return [node];
    return ts.isVariableStatement(node) ? node.declarationList.declarations.filter(item=>name(item.name)===symbol && item.initializer && (ts.isArrowFunction(item.initializer)||ts.isFunctionExpression(item.initializer))).map(item=>item.initializer) : [];
  });
  const walk=(node,predicate)=>{const found=[];let count=0;const visit=n=>{if(++count>200000)fail('syntax observation exceeds200000 nodes');if(predicate(n))found.push(n);ts.forEachChild(n,visit);};visit(node);return found;};
  // Conservatively reject local bindings, including destructuring and namespace
  // roots. A syntax-only audit must not mistake their calls for imported code.
  const binding=node=>ts.isParameter(node)||ts.isVariableDeclaration(node)||ts.isBindingElement(node)||ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isClassDeclaration(node)||ts.isClassExpression(node)||ts.isEnumDeclaration(node)||ts.isModuleDeclaration(node);
  const importShadows=(owner,aliases)=>{const roots=new Set([...aliases].map(alias=>alias.split('.')[0]));return walk(owner,node=>binding(node)&&roots.has(name(node.name)));};
  let options,resolution;
  const resolve=(specifier,file)=>{
    if (!options) {
      options={allowJs:true,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler};
      const config=ts.findConfigFile(root,ts.sys.fileExists,'tsconfig.json');
      if(config){const parsedConfig=ts.getParsedCommandLineOfConfigFile(config,{noEmit:true},{...ts.sys,readDirectory:()=>[],onUnRecoverableConfigFileDiagnostic:()=>fail('invalid module configuration')});if(parsedConfig.errors.some(error=>error.code!==18003))fail('invalid module configuration');options=parsedConfig.options;}
      resolution=ts.createModuleResolutionCache(root,value=>value,options);
    }
    const target=ts.resolveModuleName(specifier,path.join(root,file),options,ts.sys,resolution).resolvedModule;
    return target&&!target.isExternalLibraryImport ? path.relative(root,fs.realpathSync(target.resolvedFileName)).replaceAll('\\','/') : null;
  };
  const imports=(file,from,symbol,allowType=false)=>{
    const aliases=new Set();
    for(const node of source(file).tree.statements){
      if(!ts.isImportDeclaration(node)||!ts.isStringLiteralLike(node.moduleSpecifier)||!node.importClause||(!allowType&&node.importClause.isTypeOnly)||resolve(node.moduleSpecifier.text,file)!==from)continue;
      const bindings=node.importClause.namedBindings;
      if(bindings&&ts.isNamedImports(bindings))for(const item of bindings.elements)if((allowType||!item.isTypeOnly)&&name(item.propertyName||item.name)===symbol)aliases.add(item.name.text);
      if(!allowType&&bindings&&ts.isNamespaceImport(bindings))aliases.add(bindings.name.text+'.'+symbol);
    }
    return aliases;
  };
  const reports=[];
  for(const entry of declarations){
    if(!only(entry,['id','module','callers','state','review'])||!text(entry.id)||!/^[A-Za-z0-9_-]{1,64}$/.test(entry.id)||ids.has(entry.id)||!text(entry.review)||!Array.isArray(entry.callers)||!entry.callers.length||entry.callers.length>8)fail('route needs unique id, module,1-8 callers, state and parent nearest-caller review');
    ids.add(entry.id);anchor(entry.module);if(!owned(entry.module.file))fail('pure module is outside packet ownership: '+entry.module.file);
    if(!only(entry.module,['file','symbol','quote']))fail('module accepts only file,symbol,quote');
    if(!only(entry.state,['field','quote','relation','reason'])||!identifier(entry.state.field)||!text(entry.state.quote)||!['existing','planned'].includes(entry.state.relation)||!text(entry.state.reason))fail('state needs field,current quote,existing/planned relation and a reviewed reason');
    let previous=entry.module;const links=[],pairs=new Set();
    for(const caller of entry.callers){
      const line=anchor(caller),key=caller.file+'#'+caller.symbol;
      if(pairs.has(key)||key===previous.file+'#'+previous.symbol||!['existing','planned'].includes(caller.relation)||!text(caller.reason)||!['owned','deferred'].includes(caller.delivery))fail('caller needs unique non-cyclic link,existing/planned relation,reason and owned/deferred delivery');
      pairs.add(key);
      if(caller.delivery==='owned'){if(!owned(caller.file)||caller.followUpTask!==undefined)fail('state/caller outside owned files; own it or pre-file an exact dependent task: '+caller.file);}
      else if(owned(caller.file)||!TASK.test(caller.followUpTask||''))fail('deferred caller must be unowned and name an exact pre-filed task');
      let syntaxVerified=false;
      if(caller.relation==='existing'){
        const providers=functions(previous.file,previous.symbol),consumers=functions(caller.file,caller.symbol);
        if(providers.length!==1||consumers.length!==1)fail('existing link needs unique direct exported function definitions; unsupported chain requires review');
        const aliases=previous.file===caller.file ? new Set([previous.symbol]) : imports(caller.file,previous.file,previous.symbol);
        const calls=walk(consumers[0],node=>ts.isCallExpression(node)&&aliases.has(node.expression.getText(source(caller.file).tree)));
        const shadows=importShadows(consumers[0],aliases);
        if(!calls.length||shadows.length)fail('existing caller lacks an unshadowed direct runtime import/call: '+caller.file+'#'+caller.symbol);
        syntaxVerified=true;
      }
      let followUpVerified=false;
      if(caller.delivery==='deferred'&&boardTasks!==undefined){
        const follow=boardTasks.find(task=>task.id===caller.followUpTask);
        const builds=new Set([...(packet.taskIds||[]),...(packet.issues||[]),...(packet.refs||[])].filter(id=>TASK.test(id)));
        if(!follow||!['open','claimed','in_progress','blocked'].includes(follow.state)||!follow.campaignId)fail('caller follow-up must be current,unfinished and in a campaign');
        const lines=(follow.body||'').replace(/\r\n/g,'\n').split('\n');
        if(!lines.some((_,i)=>lines.slice(i,i+2).join('\n')===productionFollowUpLine(entry,caller)))fail('follow-up lacks exact durable PRODUCTION-FOLLOWUP obligation');
        if(!extractTaskOwnershipPaths(follow,{repoRoot:root}).some(item=>item.ref===caller.file&&item.sources.includes('refs')))fail('follow-up must retain its exact caller as edit obligation and ref');
        let deps;try { deps=normalizeTaskDeps(follow.deps); } catch(error) { fail('follow-up dependency metadata is invalid: '+error.message); }
        const build=deps.filter(dep=>builds.has(dep.id)&&isBlockingDepType(dep.type)).map(dep=>boardTasks.find(task=>task.id===dep.id&&task.campaignId===follow.campaignId&&['open','claimed','in_progress','blocked'].includes(task.state))).find(Boolean);
        if(!build||build.id===follow.id)fail('follow-up needs a blocking dependency on a current build task in this packet/campaign');
        followUpVerified=true;
      }
      links.push({...caller,line,syntaxVerified,followUpVerified});previous=caller;
    }
    const {raw,tree}=source(previous.file), stateCheck=inspectSourceCitations({body:'SOURCE-CITATION: '+JSON.stringify({file:previous.file,quote:entry.state.quote})},{readSource:()=>raw});
    if(stateCheck.issues.length)fail('stale or ambiguous state-owner source anchor');
    let stateSyntaxVerified=false;
    if(entry.state.relation==='existing'){
      const owners=functions(previous.file,previous.symbol);if(owners.length!==1)fail('state owner needs one direct exported function');
      const owner=owners[0],roots=new Set(),parameters=[];
      const canonical=source('src/types/state.ts').tree.statements.filter(node=>ts.isInterfaceDeclaration(node)&&name(node.name)==='GameState');
      if(canonical.length!==1||!canonical[0].members.some(member=>name(member.name)===entry.state.field))fail('state field is absent or unsupported in canonical GameState');
      const stateTypes=imports(previous.file,'src/types/state.ts','GameState',true);
      const barrelAliases=imports(previous.file,'src/types/index.ts','GameState',true);
      if(barrelAliases.size){
        const exported=source('src/types/index.ts').tree.statements.some(node=>ts.isExportDeclaration(node)&&node.moduleSpecifier&&ts.isStringLiteralLike(node.moduleSpecifier)&&resolve(node.moduleSpecifier.text,'src/types/index.ts')==='src/types/state.ts'
          &&(!node.exportClause||ts.isNamedExports(node.exportClause)&&node.exportClause.elements.some(item=>name(item.name)==='GameState'&&name(item.propertyName||item.name)==='GameState')));
        if(!exported)fail('GameState barrel does not directly re-export the canonical type');
        for(const alias of barrelAliases)stateTypes.add(alias);
      }
      // An imported spelling is insufficient if a generic or local declaration
      // shadows it. Unsupported identity resolution stays a reviewed blocker.
      const typeBinding=node=>ts.isTypeParameterDeclaration(node)||ts.isTypeAliasDeclaration(node)||ts.isInterfaceDeclaration(node)||ts.isClassDeclaration(node)||ts.isEnumDeclaration(node);
      if(walk(owner,node=>typeBinding(node)&&stateTypes.has(name(node.name))).length
        ||tree.statements.some(node=>typeBinding(node)&&stateTypes.has(name(node.name))))fail('canonical GameState type is shadowed; current state source requires review');
      for(const param of owner.parameters)if(ts.isIdentifier(param.name)&&param.type&&ts.isTypeReferenceNode(param.type)&&stateTypes.has(param.type.typeName.getText(tree))){roots.add(param.name.text);parameters.push(param);}
      for(const accessor of ['useGameState','useOptionalGameState']){
        const aliases=imports(previous.file,'src/state/GameContext.tsx',accessor);
        const shadows=importShadows(owner,aliases);
        if(shadows.length)fail('state context accessor is shadowed; current state source requires review');
        for(const binding of walk(owner,node=>ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&ts.isCallExpression(node.initializer)&&aliases.has(node.initializer.expression.getText(tree))))roots.add(binding.name.text+'.state');
      }
      for(const base of roots){const bindings=walk(owner,node=>(ts.isParameter(node)||ts.isVariableDeclaration(node)||ts.isBindingElement(node))&&name(node.name)===base.split('.')[0]);if(bindings.length!==1)fail('state binding is shadowed or ambiguous');}
      const start=raw.indexOf(entry.state.quote),end=start+entry.state.quote.length;
      const accesses=walk(owner,node=>(ts.isPropertyAccessExpression(node)&&name(node.name)===entry.state.field||ts.isElementAccessExpression(node)&&node.argumentExpression&&ts.isStringLiteralLike(node.argumentExpression)&&node.argumentExpression.text===entry.state.field)
        &&roots.has(node.expression.getText(tree).replaceAll('?.','.'))&&node.getStart(tree)>=start&&node.end<=end);
      // Passing the complete typed state to a pure module is also a real
      // state-holding caller. Its field's eventual data flow remains reviewed.
      const typed=parameters.some(param=>param.getStart(tree)>=start&&param.end<=end);
      if(!accesses.length&&!typed)fail('existing state quote lacks a supported GameState parameter/context field access in the declared caller');
      stateSyntaxVerified=true;
    }
    reports.push({packetId:packet.id,...entry,callers:links,stateSyntaxVerified,observedAt:new Date().toISOString()});
  }
  return reports;
}
