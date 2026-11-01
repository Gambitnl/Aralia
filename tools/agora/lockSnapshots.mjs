// WF-G260: retain the dirty bytes first observed after a CLI file-lock grant.
// Recovery uses that local baseline, never Git HEAD. The client authenticates
// and rechecks live ownership; a reviewed current digest is required to write.
// Snapshots are ignored, bounded, bearer-sealed records, not a security sandbox
// against another process running as the same OS user. No files are auto-restored.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const SNAPSHOT_MAX_FILE=8*1024*1024;
const MAX_BATCH=32*1024*1024,MAX_PATHS=128;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const seal=(payload,token)=>crypto.createHmac('sha256',token).update(JSON.stringify(payload)).digest('hex');
const key=value=>process.platform==='win32'?value.toLowerCase():value;
const relative=root=>value=>path.relative(root,path.resolve(root,value)).replace(/\\/g,'/');
function inside(root,value){
  if(typeof value!=='string'||!value||value.length>4096||/[\x00-\x1f*?]/.test(value))throw new Error('need one exact contained file, not a glob');
  const rel=relative(root)(value);
  if(!rel||rel==='..'||rel.startsWith('../')||path.isAbsolute(rel)||rel.split('/').some(part=>!part||part==='..')||rel.includes(':'))throw new Error('path is outside the checkout or unsupported');
  if(/^\.git(?:\/|$)/i.test(rel)||/^\.agent\/agora(?:\/|$)/i.test(rel))throw new Error('Git and Agora runtime files cannot be snapshot targets');
  return {file:rel,target:path.join(root,...rel.split('/'))};
}
function components(root,target,{create=false}={}){
  const rel=path.relative(root,target);if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw new Error('unsafe contained path');
  let cursor=root;
  for(const part of rel.split(path.sep)){
    cursor=path.join(cursor,part);
    if(!fs.existsSync(cursor)&&create)fs.mkdirSync(cursor,{mode:0o700});
    const stat=fs.lstatSync(cursor);
    if(stat.isSymbolicLink())throw new Error('symlinks/junctions are unsupported');
    const actual=fs.realpathSync(cursor),r=path.relative(root,actual);
    if(r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r))throw new Error('path resolves outside the checkout');
  }
}
function readRegular(root,target){
  components(root,target);const stat=fs.lstatSync(target);
  if(!stat.isFile()||stat.nlink!==1||stat.size>SNAPSHOT_MAX_FILE)throw new Error('need an existing regular single-link file of at most8MiB');
  const fd=fs.openSync(target,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try{
    const observed=fs.fstatSync(fd);
    if(!observed.isFile()||observed.nlink!==1||observed.dev!==stat.dev||observed.ino!==stat.ino||observed.size>SNAPSHOT_MAX_FILE)throw new Error('file identity changed during read');
    const bytes=fs.readFileSync(fd),after=fs.fstatSync(fd);
    if(bytes.length!==observed.size||after.size!==observed.size||after.mtimeMs!==observed.mtimeMs||after.ctimeMs!==observed.ctimeMs)throw new Error('file changed during read');
    return {bytes,stat:after,digest:hash(bytes)};
  }finally{fs.closeSync(fd);}
}
function snapshotHome(root,id){
  if(!uuid(id))throw new Error('need an exact lock UUID');
  return path.join(root,'.agent','agora','locksnap',id);
}
function ignoredHome(root){
  try{execFileSync('git',['-c','core.fsmonitor=false','check-ignore','--quiet','--no-index','.agent/agora/locksnap/probe'],{cwd:root,stdio:'ignore'});}
  catch{throw new Error('snapshot home must already be gitignored; do not change ignore rules silently');}
}

// Recovery cannot use the CLI's looser advisory ref matcher. Compare contained
// absolute aliases, Windows case and the daemon's *, ** and ? syntax. Treat a
// held directory conservatively as covering descendants; malformed scope fails
// closed. This stays dependency-free inside an immutable client release.
export function recoveryLockOverlaps({repoRoot,file,lock}){
  const root=fs.realpathSync(repoRoot),target=key(inside(root,file).target.replace(/\\/g,'/'));
  if(!Array.isArray(lock?.paths)||!Array.isArray(lock?.globs)||lock.paths.length+lock.globs.length>1024)throw new Error('peer lock scope unavailable or unsupported');
  const canonical=value=>{
    if(typeof value!=='string'||!value||value.length>4096||/[\x00-\x1f]/.test(value))throw new Error('peer lock scope malformed');
    let absolute=path.resolve(root,value.replace(/\\/g,'/'));
    if(!/[*?]/.test(value)&&fs.existsSync(absolute))absolute=fs.realpathSync(absolute);
    return key(absolute.replace(/\\/g,'/').replace(/\/$/,''));
  };
  const matches=pattern=>{
    let expression='';
    for(let i=0;i<pattern.length;i++){
      if(pattern[i]==='*'){
        if(pattern[i+1]==='*'){expression+='.*';i++;if(pattern[i+1]==='/')i++;}
        else expression+='[^/]*';
      }else if(pattern[i]==='?')expression+='[^/]';
      else expression+=pattern[i].replace(/[.+^${}()|[\]\\]/g,'\\$&');
    }
    return new RegExp('^'+expression+'$').test(target);
  };
  for(const value of lock.paths){const scope=canonical(value);if(/[*?]/.test(scope)){if(matches(scope))return true;}else if(target===scope||target.startsWith(scope+'/'))return true;}
  return lock.globs.some(value=>matches(canonical(value)));
}

// Called immediately after each successful grant, including partial batches.
// Unsupported paths remain explicit unavailable entries; they are not permission
// to delete a created file, enumerate an unbounded tree or invent an old baseline.
export function captureLockSnapshot({repoRoot,baseUrl,lock,token}){
  const root=fs.realpathSync(repoRoot);if(!uuid(lock?.id)||!uuid(lock?.agentId)||typeof token!=='string'||!token)throw new Error('snapshot needs authenticated grant identity');
  ignoredHome(root);const home=snapshotHome(root,lock.id);
  components(root,path.dirname(home),{create:true});
  if(fs.existsSync(home))throw new Error('snapshot already exists; the first baseline must never be replaced');
  fs.mkdirSync(home,{mode:0o700});
  const files=[],unavailable=[],seen=new Set();let total=0;
  for(const value of (lock.paths||[]).slice(0,MAX_PATHS)){
    try{
      const {file,target}=inside(root,value);
      if(seen.has(key(file)))continue;seen.add(key(file));
      const current=readRegular(root,target);total+=current.bytes.length;
      if(total>MAX_BATCH)throw new Error('snapshot batch exceeds32MiB');
      const blob='file-'+files.length+'.bin';fs.writeFileSync(path.join(home,blob),current.bytes,{flag:'wx',mode:0o600});
      files.push({file,token:value,blob,sha256:current.digest,size:current.bytes.length});
    }catch(error){unavailable.push({file:String(value),reason:error.message});}
  }
  if((lock.paths||[]).length>MAX_PATHS)unavailable.push({file:'remaining paths',reason:'snapshot limited to128 exact file targets'});
  for(const glob of lock.globs||[])unavailable.push({file:glob,reason:'glob scope has no single file baseline; lock exact files for recovery'});
  const payload={version:1,repoRoot:root,baseUrl,lockId:lock.id,agentId:lock.agentId,grantCreatedAt:lock.createdAt??null,capturedAt:Date.now(),files,unavailable};
  fs.writeFileSync(path.join(home,'snapshot.json'),JSON.stringify({payload,seal:seal(payload,token)}),{flag:'wx',mode:0o600});
  return {home,files:files.map(({file,sha256,size})=>({file,sha256,size})),unavailable,capturedAt:payload.capturedAt};
}

// The fresh board observation must still identify the same live holder and
// exact file token. Directory/glob authority cannot manufacture a byte baseline.
export function inspectLockSnapshot({repoRoot,baseUrl,lock,agentId,token,file,now=Date.now()}){
  const root=fs.realpathSync(repoRoot),target=inside(root,file),home=snapshotHome(root,lock?.id);
  if(lock.agentId!==agentId||!uuid(agentId)||!Number.isFinite(lock.expiresAt)||lock.expiresAt-now<10000)throw new Error('same live owner and at least10s lease headroom required');
  if(!(lock.paths||[]).some(value=>{try{return key(inside(root,value).file)===key(target.file);}catch{return false;}}))throw new Error('current exact file lock no longer covers this target');
  const raw=readRegular(root,path.join(home,'snapshot.json')).bytes;
  if(raw.length>128*1024)throw new Error('snapshot manifest exceeds128KiB');
  const signed=JSON.parse(raw.toString('utf8')),payload=signed.payload;
  if(!payload||typeof token!=='string'||!token||signed.seal!==seal(payload,token))throw new Error('snapshot is tampered or bearer ownership changed');
  if(payload.version!==1||payload.repoRoot!==root||payload.baseUrl!==baseUrl||payload.lockId!==lock.id||payload.agentId!==agentId
    ||payload.grantCreatedAt!==(lock.createdAt??null)||!Number.isFinite(payload.capturedAt)||payload.capturedAt>now||!Array.isArray(payload.files)||payload.files.length>MAX_PATHS)throw new Error('snapshot ownership, origin, clock or schema differs');
  const matches=payload.files.filter(entry=>key(entry.file)===key(target.file));
  if(matches.length!==1)throw new Error('no unique lock-time baseline for this file; old clients and unsupported paths cannot be restored');
  const entry=matches[0];
  if(!/^file-\d+\.bin$/.test(entry.blob)||!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.size)||entry.size<0||entry.size>SNAPSHOT_MAX_FILE)throw new Error('invalid snapshot file record');
  const baseline=readRegular(root,path.join(home,entry.blob));
  if(baseline.digest!==entry.sha256||baseline.bytes.length!==entry.size)throw new Error('snapshot bytes are damaged');
  const current=readRegular(root,target.target);
  return {file:target.file,token:entry.token,lockId:lock.id,home,baselineSha256:entry.sha256,currentSha256:current.digest,
    capturedAt:payload.capturedAt,unchanged:entry.sha256===current.digest,baseline:baseline.bytes,current:current.bytes,target:target.target,stat:current.stat,
    lockPaths:[...(lock.paths||[])],lockGlobs:[...(lock.globs||[])]};
}

// The caller repeats authenticated live ownership after review, then this
// function compares the exact current bytes again through a single file handle.
// Current bytes are retained before a write. Failed/partial writes never trigger
// an automatic retry, an unlock or a Git restore; they leave evidence for review.
export function restoreLockSnapshot(report,{repoRoot,expectCurrent,now=Date.now()}={}){
  if(!/^[a-f0-9]{64}$/.test(expectCurrent||''))throw new Error('review current bytes and supply --expect-current <sha256>; no file was restored');
  if(report.currentSha256!==expectCurrent)throw new Error('current digest differs from the reviewed --expect-current; no file was restored');
  const root=fs.realpathSync(repoRoot),target=inside(root,report.file);
  if(target.target!==report.target||snapshotHome(root,report.lockId)!==report.home||hash(report.baseline)!==report.baselineSha256)throw new Error('recovery report identity or baseline changed');
  components(root,target.target);
  const fd=fs.openSync(target.target,fs.constants.O_RDWR|(fs.constants.O_NOFOLLOW||0));
  try{
    const stat=fs.fstatSync(fd),pathStat=fs.lstatSync(target.target);
    if(!stat.isFile()||stat.nlink!==1||pathStat.isSymbolicLink()||stat.dev!==report.stat.dev||stat.ino!==report.stat.ino||pathStat.ino!==stat.ino||pathStat.dev!==stat.dev||stat.size>SNAPSHOT_MAX_FILE)throw new Error('target identity changed before recovery');
    const current=fs.readFileSync(fd);
    if(hash(current)!==expectCurrent)throw new Error('current bytes changed after review; no file was restored');
    if(report.unchanged)return {changed:false,file:report.file,sha256:report.baselineSha256};
    const backup=path.join(report.home,'before-restore-'+now+'-'+crypto.randomUUID()+'.bin');
    components(root,report.home);fs.writeFileSync(backup,current,{flag:'wx',mode:0o600});
    // Synchronous bounded writes cannot make advisory locks physically exclusive.
    // A writer racing this OS user is outside that contract: inspect peer work
    // before acknowledging a digest, and use a surgical patch for mixed edits.
    try{
      let written=0;while(written<report.baseline.length){const n=fs.writeSync(fd,report.baseline,written,report.baseline.length-written,written);if(!n)throw new Error('zero-byte recovery write');written+=n;}
      fs.ftruncateSync(fd,report.baseline.length);fs.fsyncSync(fd);
      if(hash(fs.readFileSync(target.target))!==report.baselineSha256)throw new Error('recovery verification failed');
    }catch(error){throw new Error(error.message+'; recovery may be partial, keep the lock and inspect retained current backup '+backup);}
    return {changed:true,file:report.file,sha256:report.baselineSha256,backup};
  }finally{fs.closeSync(fd);}
}
