// WF-G282: a changed vocabulary can require edits far beyond its declaration.
// Resolve repository type symbols without emitting or checking application
// diagnostics. Required consumers reuse packet ownership; nothing gains a lock.
// Source syntax and explicit parent review are not complete runtime acceptance.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { readCitationSource,inspectSourceCitations } from './taskLint.mjs';
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const ts=createRequire(path.join(REPO,'package.json'))('typescript');
const slash=value=>value.replaceAll('\\','/');
const identity=(file,symbol)=>file+'#'+symbol;
const exact=file=>typeof file==='string'&&/^src\/[A-Za-z0-9_./@-]+\.[cm]?[jt]sx?$/.test(file)&&path.posix.normalize(file)===file&&!file.split('/').includes('..');
const identifier=value=>typeof value==='string'&&/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(value);
const reason=value=>typeof value==='string'&&value.trim()&&Buffer.byteLength(value)<=2048&&!/\b(?:TODO|TBD)\b/i.test(value);
const only=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
const strings=value=>Array.isArray(value)&&value.length<=128&&new Set(value).size===value.length&&value.every(item=>typeof item==='string'&&item.length>0&&Buffer.byteLength(item)<=128);
const fail=message=>{throw new Error('WF-G282 '+message);};
const finite=node=>ts.isTypeAliasDeclaration(node)&&ts.isUnionTypeNode(node.type)&&node.type.types.every(item=>ts.isLiteralTypeNode(item)&&ts.isStringLiteralLike(item.literal));
const members=node=>node.type.types.map(item=>item.literal.text);
const typeName=node=>ts.isIdentifier(node)?node.text:ts.isQualifiedName(node)?node.right.text:'';
/** Capture bytes for an explicit parent assessment; never record or approve it. */
export function captureUnchangedUnionContext(file,assessment,{repoRoot=REPO}={}){
  if(!exact(file)||!reason(assessment))fail('unchanged context needs exact source and parent assessment');
  const text=readCitationSource(repoRoot,file),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);if(tree.parseDiagnostics.length)fail('unverified unchanged source '+file);
  const symbols=tree.statements.filter(finite).map(node=>node.name.text);if(!symbols.length)return null;
  return {file,quote:text.slice(0,160),symbols,hash:createHash('sha256').update(text,'utf8').digest('hex'),reason:assessment};
}
function anchor(root,file,quote,cache){
  if(!exact(file)||typeof quote!=='string'||quote.trim().length<4||Buffer.byteLength(quote)>4096)fail('current anchor needs exact source path and4-4096 byte quote');
  if(!cache.has(file)){const text=readCitationSource(root,file),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);if(tree.parseDiagnostics.length)fail('unverified source syntax '+file);cache.set(file,{text,tree});}
  const result=inspectSourceCitations({body:'SOURCE-CITATION: '+JSON.stringify({file,quote})},{readSource:ref=>cache.get(ref)?.text});
  if(result.issues.length)fail('stale or ambiguous current anchor '+file);return result.resolved[0].line;
}

/** Validate current declarations cheaply; reverse discovery happens once per plan. */
export function validatePacketUnions(packet,{repoRoot=REPO,sourceFiles=packet.files||[]}={}){
  const root=fs.realpathSync(repoRoot),cache=new Map(),changes=packet.unionChanges===undefined?[]:packet.unionChanges,reviews=packet.unionReviews===undefined?[]:packet.unionReviews;
  if(!Array.isArray(changes)||!Array.isArray(reviews)||changes.length+reviews.length>16||Buffer.byteLength(JSON.stringify([changes,reviews]))>8192)fail('packet '+packet.id+' union declarations exceed16 records or8192 bytes');
  const seen=new Set(),ids=new Set();
  for(const [changed,records]of[[true,changes],[false,reviews]])for(const record of records){
    // A type catalogue can hold dozens of unchanged unions. One exact current
    // source hash covers that inventory without repeating every source block.
    if(!changed&&record?.symbols!==undefined){
      if(!only(record,['file','quote','symbols','hash','reason'])||!Array.isArray(record.symbols)||!record.symbols.length||record.symbols.length>128||new Set(record.symbols).size!==record.symbols.length||record.symbols.some(symbol=>!identifier(symbol))||!reason(record.reason)||typeof record.hash!=='string'||!/^[a-f0-9]{64}$/.test(record.hash))fail('malformed grouped unchanged union review');
      anchor(root,record.file,record.quote,cache);const current=cache.get(record.file);
      if(createHash('sha256').update(current.text,'utf8').digest('hex')!==record.hash)fail('stale unchanged union source hash '+record.file);
      for(const symbol of record.symbols){const key=identity(record.file,symbol);if(seen.has(key)||!current.tree.statements.some(node=>finite(node)&&node.name.text===symbol))fail('duplicate or unsupported unchanged union '+key);seen.add(key);}continue;
    }
    const fields=changed?['id','file','symbol','quote','members','added','removed','reason','otherUsesReview','consumerEdits']:['file','symbol','quote','members','reason'];
    if(!only(record,fields)||!identifier(record.symbol)||!strings(record.members)||!record.members.length||!reason(record.reason))fail('malformed union record or reason');
    const key=identity(record.file,record.symbol);if(seen.has(key))fail('duplicate union declaration '+key);seen.add(key);anchor(root,record.file,record.quote,cache);
    const node=cache.get(record.file).tree.statements.find(item=>ts.isTypeAliasDeclaration(item)&&item.name.text===record.symbol);
    if(!node||!finite(node)||!isDeepStrictEqual(members(node),record.members))fail('stale or unsupported finite string-union member premise '+key);
    if(changed){
      if(typeof record.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(record.id)||ids.has(record.id)||!strings(record.added)||!strings(record.removed)||!record.added.length&&!record.removed.length||record.added.some(item=>record.members.includes(item))||record.removed.some(item=>!record.members.includes(item))||!reason(record.otherUsesReview))fail('changed union needs unique id, real member delta and concrete otherUsesReview');
      ids.add(record.id);
      if(record.consumerEdits!==undefined){
        if(!Array.isArray(record.consumerEdits)||record.consumerEdits.length>32)fail('consumerEdits exceeds32 exact reviewed files');const files=new Set();
        for(const item of record.consumerEdits){if(!only(item,['file','quote','reason'])||files.has(item.file)||!reason(item.reason))fail('malformed additional consumer edit');files.add(item.file);anchor(root,item.file,item.quote,cache);}
      }
    }
  }
  for(const file of sourceFiles){
    if(!exact(file)||/\.d\.[cm]?ts$/.test(file)||!fs.existsSync(path.join(root,file)))continue;
    if(!cache.has(file)){const text=readCitationSource(root,file),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);if(tree.parseDiagnostics.length)fail('unverified owned source '+file);cache.set(file,{text,tree});}
    for(const node of cache.get(file).tree.statements.filter(finite))if(!seen.has(identity(file,node.name.text)))fail('unreviewed owned finite union '+identity(file,node.name.text)+'; declare its change or a current unchanged review');
  }
  return {packetId:packet.id,changes,reviews};
}

/** Inspect every repository source, including ignored preview and test files. */
export function inspectUnionConsumers(plan,{repoRoot=REPO,sourceFilesByPacket,limits={}}={}){
  const root=fs.realpathSync(repoRoot),packets=plan.packets||[],validated=packets.map(packet=>validatePacketUnions(packet,{repoRoot:root,sourceFiles:sourceFilesByPacket?.get(packet.id)||packet.files||[]}));
  for(const item of validated){const owned=new Set(sourceFilesByPacket?.get(item.packetId)||packets.find(packet=>packet.id===item.packetId).files||[]);for(const change of item.changes)if(!owned.has(change.file))fail('union member delta must be declared by its actual source-owning packet '+item.packetId+' '+change.file);}
  const result={packets:validated.map(item=>({packetId:item.packetId,changes:item.changes.map(change=>({...change,consumers:[]})),unchanged:item.reviews,references:[]})),observedAt:Date.now(),inspectedSources:0};
  if(!validated.some(item=>item.changes.length))return result;
  const caps={files:8192,bytes:128*1024*1024,nodes:32000000,...limits};
  if(Object.values(caps).some(value=>!Number.isSafeInteger(value)||value<1))fail('invalid inspection limit');
  const source=new Map(),currentInventory=new Set();let bytes=0;
  const inside=file=>{const ref=path.relative(root,fs.realpathSync(file));return !path.isAbsolute(ref)&&ref!=='..'&&!ref.startsWith('..'+path.sep);};
  const walk=(directory,verifyOnly=false)=>{
    if(!inside(directory))fail('source inventory escapes repository');
    for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      const file=path.join(directory,entry.name);
      if(entry.isSymbolicLink())fail('source inventory has unsupported symlink '+slash(path.relative(root,file)));
      if(entry.isDirectory())walk(file,verifyOnly);
      else if(/\.[cm]?[jt]sx?$/.test(entry.name)){
        if(verifyOnly){if(currentInventory.size>=caps.files)fail('source inventory limit '+caps.files+' files');currentInventory.add(path.resolve(file));continue;}
        if(source.size>=caps.files)fail('source inventory limit '+caps.files+' files');const ref=slash(path.relative(root,file)),text=readCitationSource(root,ref,{limitBytes:16*1024*1024});bytes+=Buffer.byteLength(text);if(bytes>caps.bytes)fail('source inventory byte limit');source.set(path.resolve(file),text);
      }
    }
  };walk(path.join(root,'src'));result.inspectedSources=source.size;
  // Bind declaration premises to the captured inventory, not an earlier read.
  for(const item of validated)for(const record of [...item.changes,...item.reviews])if(source.get(path.resolve(root,record.file))!==readCitationSource(root,record.file))fail('declaration changed before union observation '+record.file);
  // All roots are explicit and contained. Do not pull package libraries, emit,
  // evaluate modules or request application diagnostics from this symbol graph.
  let options={module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,allowJs:true};
  const config=ts.findConfigFile(root,ts.sys.fileExists,'tsconfig.json');
  if(config){const parsed=ts.getParsedCommandLineOfConfigFile(config,{}, {...ts.sys,readDirectory:()=>[],onUnRecoverableConfigFileDiagnostic:()=>fail('unreadable module configuration')});if(parsed.errors.some(item=>item.code!==18003))fail('invalid module configuration');options=parsed.options;}
  options={...options,noResolve:true,noLib:true,types:[],lib:[],noEmit:true};const host=ts.createCompilerHost(options);
  host.getSourceFile=(file,version)=>{const text=source.get(path.resolve(file));return text===undefined?undefined:ts.createSourceFile(file,text,version,true);};host.writeFile=()=>fail('source inspection cannot emit');
  const program=ts.createProgram([...source.keys()],options,host),checker=program.getTypeChecker();
  if(program.getSourceFiles().length!==source.size)fail('incomplete source inventory in symbol graph');
  const targets=new Map();for(const item of result.packets)for(const change of item.changes){const key=identity(change.file,change.symbol);if(!targets.has(key))targets.set(key,[]);const prior=targets.get(key)[0];if(prior&&!isDeepStrictEqual([prior.members,prior.added,prior.removed],[change.members,change.added,change.removed]))fail('conflicting member deltas for '+key);targets.get(key).push(change);}
  for(const item of validated)for(const review of item.reviews)for(const symbol of review.symbols||[review.symbol])if(targets.has(identity(review.file,symbol)))fail('wave contradicts unchanged union review '+identity(review.file,symbol));
  let visits=0,consumerCount=0;
  const resolvedSymbol=node=>{
    let symbol=checker.getSymbolAtLocation(ts.isImportTypeNode(node)?node.qualifier:node.typeName);let depth=0;
    while(symbol&&(symbol.flags&ts.SymbolFlags.Alias)){if(++depth>16)fail('type alias resolution limit');symbol=checker.getAliasedSymbol(symbol);}
    return symbol;
  };
  const declaration=node=>resolvedSymbol(node)?.declarations?.find(item=>ts.isTypeAliasDeclaration(item)||ts.isTypeParameterDeclaration(item));
  const targetFor=(node,seen=new Set())=>{
    if(!node)return null;if(ts.isParenthesizedTypeNode(node))return targetFor(node.type,seen);
    if(!ts.isTypeReferenceNode(node)&&!ts.isImportTypeNode(node))return null;
    const decl=declaration(node);if(!decl||ts.isTypeParameterDeclaration(decl))return null;
    const key=identity(slash(path.relative(root,path.resolve(decl.getSourceFile().fileName))),decl.name.text);
    if(targets.has(key))return key;
    if(seen.has(decl)||seen.size>=16)fail('cyclic or deep local type alias');
    return targetFor(decl.type,new Set([...seen,decl]));
  };
  const localImport=specifier=>specifier.startsWith('.')||Object.keys(options.paths||{}).some(pattern=>specifier.startsWith(pattern.split('*')[0]));
  const unresolvedLocal=(node,seen=new Set())=>{
    if(!node)return false;
    if(ts.isTypeReferenceNode(node)||ts.isImportTypeNode(node)){
      const decl=declaration(node);
      if(decl&&!ts.isTypeParameterDeclaration(decl)&&!seen.has(decl)){if(seen.size>=16)fail('local key dependency depth limit');if(unresolvedLocal(decl.type,new Set([...seen,decl])))return true;}
      if(!decl&&!resolvedSymbol(node)?.declarations?.length){
        if(ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument)&&ts.isStringLiteralLike(node.argument.literal)&&localImport(node.argument.literal.text))return true;
        let name=node.typeName;while(name&&ts.isQualifiedName(name))name=name.left;
        const symbol=name&&checker.getSymbolAtLocation(name);
        for(const item of symbol?.declarations||[]){let ancestor=item;while(ancestor&&!ts.isImportDeclaration(ancestor))ancestor=ancestor.parent;if(ancestor&&ts.isStringLiteralLike(ancestor.moduleSpecifier)&&localImport(ancestor.moduleSpecifier.text))return true;}
      }
    }
    let missing=false;ts.forEachChild(node,child=>{if(unresolvedLocal(child,seen))missing=true;});return missing;
  };
  const dependencies=(node,seen=new Set())=>{
    const found=new Set();const visit=item=>{
      const key=targetFor(item);if(key)found.add(key);
      if(ts.isTypeReferenceNode(item)){const decl=declaration(item);if(decl&&!ts.isTypeParameterDeclaration(decl)&&!seen.has(decl)){if(seen.size>=16)fail('type dependency depth limit');for(const ref of dependencies(decl.type,new Set([...seen,decl])))found.add(ref);}}
      ts.forEachChild(item,visit);
    };visit(node);return [...found];
  };
  const tableShape=(node,seen=new Set())=>{
    if(ts.isMappedTypeNode(node)||ts.isTypeReferenceNode(node)&&typeName(node.typeName)==='Record')return true;
    if(ts.isTypeReferenceNode(node)){const decl=declaration(node);if(decl&&!ts.isTypeParameterDeclaration(decl)&&!seen.has(decl)){if(seen.size>=16)fail('table alias shape depth limit');if(tableShape(decl.type,new Set([...seen,decl])))return true;}}
    let found=false;ts.forEachChild(node,child=>{if(tableShape(child,seen))found=true;});return found;
  };
  const label=node=>{for(let parent=node;parent;parent=parent.parent)if((ts.isVariableDeclaration(parent)||ts.isPropertySignature(parent)||ts.isTypeAliasDeclaration(parent))&&parent.name)return parent.name.getText();return '(type use)';};
  const add=(key,tree,node,kind,required)=>{
    const file=slash(path.relative(root,path.resolve(tree.fileName))),line=tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1;
    for(const change of targets.get(key)||[])if(!change.consumers.some(item=>item.file===file&&item.line===line&&item.kind===kind)){if(++consumerCount>4096)fail('consumer observation limit4096');change.consumers.push({file,line,name:label(node),kind,required,evidence:node.getText(tree).slice(0,512)});}
  };
  for(const tree of program.getSourceFiles()){
    if(tree.parseDiagnostics.length)fail('unverified source syntax '+slash(path.relative(root,tree.fileName)));
    const visit=node=>{
      if(++visits>caps.nodes)fail('source syntax node limit');
      if(ts.isTypeReferenceNode(node)&&typeName(node.typeName)==='Record'&&node.typeArguments?.length===2){
        if(unresolvedLocal(node.typeArguments[0]))fail('unresolved local Record key prevents complete consumer observation '+slash(path.relative(root,tree.fileName))+':'+(tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1)+' '+node.typeArguments[0].getText(tree));
        const key=targetFor(node.typeArguments[0]),value=targetFor(node.typeArguments[1]);
        if(key){
          if(checker.getSymbolAtLocation(node.typeName)?.declarations?.length)fail('shadowed Record utility is unsupported');
          let sparse=false;
          for(let child=node,parent=node.parent;parent;child=parent,parent=parent.parent){
            if(ts.isParenthesizedTypeNode(parent))continue;
            if(!ts.isTypeReferenceNode(parent)||parent.typeArguments?.[0]!==child)break;
            const wrapper=typeName(parent.typeName);if(!['Partial','Readonly','Required'].includes(wrapper))fail('unsupported relevant Record wrapper '+wrapper);
            if(checker.getSymbolAtLocation(parent.typeName)?.declarations?.length)fail('shadowed utility wrapper');
            if(wrapper!=='Readonly')sparse=wrapper==='Partial';
          }
          add(key,tree,node,sparse?'sparse-record':'exhaustive-record',!sparse);
        }else if(dependencies(node.typeArguments[0]).length)fail('unsupported transformed changed-union Record key');
        if(value)add(value,tree,node,'record-value',false);
      }
      const reference=ts.isTypeReferenceNode(node)||ts.isImportTypeNode(node),builtin=ts.isTypeReferenceNode(node)&&['Record','Partial','Readonly','Required','Array','ReadonlyArray'].includes(typeName(node.typeName))&&!checker.getSymbolAtLocation(node.typeName)?.declarations?.length;
      if(reference&&node.typeArguments?.some(argument=>dependencies(argument).length)&&!builtin){
        const decl=declaration(node);if(decl&&tableShape(decl.type))fail('unsupported relevant generic table alias');
      }
      if(reference&&!builtin){const decl=declaration(node);if(decl&&!ts.isTypeParameterDeclaration(decl)&&tableShape(decl.type)&&dependencies(decl.type).length)fail('unsupported relevant indirect table alias');}
      if(ts.isMappedTypeNode(node)&&node.typeParameter.constraint&&dependencies(node.typeParameter.constraint).length)fail('unsupported relevant mapped table');
      if(ts.isArrayTypeNode(node)||ts.isTypeReferenceNode(node)&&['Array','ReadonlyArray'].includes(typeName(node.typeName))){
        const element=ts.isArrayTypeNode(node)?node.elementType:node.typeArguments?.[0],key=targetFor(element);
        if(unresolvedLocal(element))fail('unresolved local vocabulary element prevents complete consumer observation');
        if(key){
          if(ts.isTypeReferenceNode(node)&&!builtin)fail('shadowed array utility is unsupported');
          let parent=node.parent;while(parent&&(ts.isTypeOperatorNode(parent)||ts.isParenthesizedTypeNode(parent)))parent=parent.parent;
          let initializer=ts.isVariableDeclaration(parent)?parent.initializer:ts.isAsExpression(parent)||ts.isSatisfiesExpression(parent)?parent.expression:null;
          while(initializer&&(ts.isAsExpression(initializer)||ts.isSatisfiesExpression(initializer)||ts.isParenthesizedExpression(initializer)))initializer=initializer.expression;
          const values=initializer&&ts.isArrayLiteralExpression(initializer)&&initializer.elements.every(item=>ts.isStringLiteralLike(item))?initializer.elements.map(item=>item.text):null;
          const complete=values&&targets.get(key).every(change=>values.length===change.members.length&&new Set(values).size===values.length&&change.members.every(member=>values.includes(member)));
          add(key,tree,node,complete?'complete-literal-vocabulary':'typed-array',Boolean(complete));
        }
      }
      const key=targetFor(node);if(key)add(key,tree,node,'type-reference',false);
      ts.forEachChild(node,visit);
    };visit(tree);
  }
  // A long inventory read cannot silently become evidence for a changed tree.
  // Refuse concurrent rewrites instead of refreshing the baseline automatically.
  for(const packet of packets)validatePacketUnions(packet,{repoRoot:root,sourceFiles:sourceFilesByPacket?.get(packet.id)||packet.files||[]});
  for(const [file,text]of source)if(readCitationSource(root,slash(path.relative(root,file)),{limitBytes:16*1024*1024})!==text)fail('source changed during union observation '+slash(path.relative(root,file)));
  walk(path.join(root,'src'),true);if(!isDeepStrictEqual([...source.keys()].sort(),[...currentInventory].sort()))fail('source inventory membership changed during union observation');
  for(const item of result.packets){const refs=new Set();for(const change of item.changes){refs.add(change.file);for(const consumer of change.consumers)if(consumer.required)refs.add(consumer.file);for(const edit of change.consumerEdits||[])refs.add(edit.file);}item.references=[...refs];}
  return result;
}

/** A recorded source delta cannot disappear when an old task is redispatched. */
export function assertTaskUnions(packet,task){
  const seen=new Set();let bytes=0,count=0;
  const recordKey=record=>record&&identity(record.file,record.symbols?'['+[...record.symbols].sort().join(',')+']':record.symbol);
  for(const line of String(task.body||'').split(/\r?\n/)){
    const match=/^[ \t>*-]*(?:REFERENCE-ONLY:\s*)?(UNION-CHANGE|UNION-REVIEW)\s*:\s*(.*)$/i.exec(line);if(!match)continue;
    bytes+=Buffer.byteLength(match[2]);if(++count>16||bytes>8192)fail('recorded union data limit');let record;try{record=JSON.parse(match[2]);}catch{fail('invalid recorded union JSON');}
    const key=recordKey(record);if(!key||seen.has(key))fail('duplicate recorded union');seen.add(key);
    const list=match[1].toUpperCase()==='UNION-CHANGE'?packet.unionChanges:packet.unionReviews;if(!isDeepStrictEqual(record,list?.find(item=>recordKey(item)===key)))fail('recorded union missing or different in plan');
  }
}

/** Declarations are durable context, not expanded file or command permission. */
export function unionPromptBlock(packet){
  if(!packet.unionChanges?.length&&!packet.unionReviews?.length)return '';
  return '\nUNION CONSUMERS (WF-G282):\n'+(packet.unionChanges||[]).map(item=>'REFERENCE-ONLY: UNION-CHANGE: '+JSON.stringify(item)).join('\n')+'\n'+(packet.unionReviews||[]).map(item=>'REFERENCE-ONLY: UNION-REVIEW: '+JSON.stringify(item)).join('\n')
    +'\nUse the current full partition report. Exhaustive consumers and complete literal vocabularies need owned files or exact owning sibling handoffs and companion tests. Sparse, value-position, subset and other references still need the recorded parent review; no automatic absence, behavioral acceptance, scope, lock or command grants. Unsupported relevant forms and incomplete source observations cannot clear preflight.\n';
}
