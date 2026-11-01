// Recovery safety is proved with disposable dirty files and synthetic leases.
// No test restores a real checkout file, Git baseline or other agent's work.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as recovery from './lockSnapshots.mjs';
import {captureLockSnapshot,inspectLockSnapshot,restoreLockSnapshot,SNAPSHOT_MAX_FILE} from './lockSnapshots.mjs';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agora-byte-snapshot-'));
  execFileSync('git',['init','-q',root]);fs.writeFileSync(path.join(root,'.gitignore'),'.agent/\n');
  const initial=Buffer.from([0,255,13,10,42]),file='owned.bin',target=path.join(root,file);
  fs.writeFileSync(target,initial);fs.writeFileSync(path.join(root,'sibling.txt'),'peer work');
  const token='private-fixture-bearer',agentId=crypto.randomUUID(),now=Date.now(),lock={id:crypto.randomUUID(),agentId,createdAt:now,expiresAt:now+60000,paths:[file],globs:[]};
  const opts={repoRoot:root,baseUrl:'http://fixture',lock,token,agentId,file};
  return {root,initial,target,opts,capture:()=>captureLockSnapshot(opts),inspect:extra=>inspectLockSnapshot({...opts,...extra}),
    cleanup:()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.match(path.basename(root),/^agora-byte-snapshot-/);fs.rmSync(root,{recursive:true,force:true});}};
}
test('WF260: byte baseline is immutable and preserves dirty binary/CRLF data plus untouched siblings',()=>{
  const f=fixture();try{
    const snapshot=f.capture();assert.equal(snapshot.files[0].sha256,digest(f.initial));
    fs.writeFileSync(f.target,'corrupt');assert.throws(()=>f.capture(),/first baseline/);
    const report=f.inspect();assert.equal(report.currentSha256,digest('corrupt'));assert.deepEqual(report.baseline,f.initial);
    const result=restoreLockSnapshot(report,{repoRoot:f.root,expectCurrent:report.currentSha256});
    assert.deepEqual(fs.readFileSync(f.target),f.initial);assert.equal(fs.readFileSync(result.backup,'utf8'),'corrupt');
    assert.equal(fs.readFileSync(path.join(f.root,'sibling.txt'),'utf8'),'peer work');
  }finally{f.cleanup();}
});
test('WF260: missing/wrong review digest and changed current bytes never overwrite or create backups',()=>{
  const f=fixture();try{
    const s=f.capture();fs.writeFileSync(f.target,'bad');const r=f.inspect();
    for(const expectCurrent of [undefined,'x','0'.repeat(64)])assert.throws(()=>restoreLockSnapshot(r,{repoRoot:f.root,expectCurrent}),/expect-current/);
    fs.writeFileSync(f.target,'peer changed after review');assert.throws(()=>restoreLockSnapshot(r,{repoRoot:f.root,expectCurrent:r.currentSha256}),/changed after review/);
    assert.equal(fs.readFileSync(f.target,'utf8'),'peer changed after review');assert.equal(fs.readdirSync(s.home).filter(n=>n.startsWith('before-restore-')).length,0);
  }finally{f.cleanup();}
});
test('WF260: foreign/stale/replayed/expired/near-expiry lock observations fail closed',()=>{
  const f=fixture();try{
    f.capture();
    for(const change of [{agentId:crypto.randomUUID()},{baseUrl:'http://another-board'},{token:'wrong-bearer'},
      {lock:{...f.opts.lock,paths:[]}},{lock:{...f.opts.lock,expiresAt:Date.now()-1}},{lock:{...f.opts.lock,expiresAt:Date.now()+1000}},
      {lock:{...f.opts.lock,createdAt:f.opts.lock.createdAt+1}},{lock:{...f.opts.lock,id:crypto.randomUUID()}}])assert.throws(()=>f.inspect(change));
    assert.deepEqual(fs.readFileSync(f.target),f.initial);
  }finally{f.cleanup();}
});
test('WF260: tampered manifest or damaged baseline bytes cannot be used',()=>{
  for(const mode of ['manifest','blob']){
    const f=fixture();try{
      const s=f.capture();const p=path.join(s.home,'snapshot.json');
      if(mode==='manifest'){const signed=JSON.parse(fs.readFileSync(p,'utf8'));signed.payload.files[0].sha256=digest('forged');fs.writeFileSync(p,JSON.stringify(signed));}
      else fs.writeFileSync(path.join(s.home,'file-0.bin'),'forged');
      assert.throws(()=>f.inspect(),/tampered|damaged/);assert.deepEqual(fs.readFileSync(f.target),f.initial);
    }finally{f.cleanup();}
  }
});
test('WF260: unsupported directories, globs, missing/large/protected/outside/hardlinked files remain explicitly unavailable',()=>{
  const f=fixture();try{
    fs.mkdirSync(path.join(f.root,'directory'));fs.linkSync(f.target,path.join(f.root,'alias.bin'));
    fs.writeFileSync(path.join(f.root,'large.bin'),Buffer.alloc(SNAPSHOT_MAX_FILE+1));
    const opts={...f.opts,lock:{...f.opts.lock,paths:['owned.bin','directory','missing.bin','large.bin','.git/config','../outside.bin'],globs:['**/*.bin']}};
    const report=captureLockSnapshot(opts);assert.equal(report.files.length,0);assert.equal(report.unavailable.length,7);
    assert.throws(()=>inspectLockSnapshot({...opts,file:'owned.bin'}),/no unique lock-time baseline/);
    assert.equal(fs.statSync(f.target).nlink,2);
  }finally{f.cleanup();}
});
test('WF260: a supported batch captures each file once while reporting unsupported targets',()=>{
  const f=fixture();try{
    const opts={...f.opts,lock:{...f.opts.lock,paths:['owned.bin','sibling.txt','owned.bin','missing.bin']}};
    const report=captureLockSnapshot(opts);assert.equal(report.files.length,2);assert.equal(report.unavailable.length,1);
    assert.equal(inspectLockSnapshot(opts).unchanged,true);
  }finally{f.cleanup();}
});
test('WF260: file, parent and snapshot-home symlinks/junctions are refused',()=>{
  for(const mode of ['target-parent','snapshot-parent']){
    const f=fixture(),outside=fs.mkdtempSync(path.join(os.tmpdir(),'agora-outside-snapshot-'));try{
      fs.writeFileSync(path.join(outside,'owned.bin'),'outside');
      if(mode==='target-parent'){
        fs.symlinkSync(outside,path.join(f.root,'linked'),'junction');
        const opts={...f.opts,file:'linked/owned.bin',lock:{...f.opts.lock,paths:['linked/owned.bin']}};
        const report=captureLockSnapshot(opts);assert.match(report.unavailable[0].reason,/symlinks|outside/);
      }else{
        fs.mkdirSync(path.join(f.root,'.agent'));fs.symlinkSync(outside,path.join(f.root,'.agent/agora'),'junction');
        assert.throws(()=>f.capture(),/symlinks|outside/);
      }
      assert.equal(fs.readFileSync(path.join(outside,'owned.bin'),'utf8'),'outside');
    }finally{f.cleanup();assert.equal(path.dirname(outside),fs.realpathSync(os.tmpdir()));assert.match(path.basename(outside),/^agora-outside-snapshot-/);fs.rmSync(outside,{recursive:true,force:true});}
  }
});
test('WF260: replacing or hardlinking the reviewed target prevents recovery',()=>{
  for(const mode of ['replace','hardlink']){
    const f=fixture();try{
      f.capture();fs.writeFileSync(f.target,'bad');const report=f.inspect();
      if(mode==='replace'){fs.renameSync(f.target,path.join(f.root,'moved.bin'));fs.writeFileSync(f.target,'bad');}
      else fs.linkSync(f.target,path.join(f.root,'new-hardlink.bin'));
      assert.throws(()=>restoreLockSnapshot(report,{repoRoot:f.root,expectCurrent:report.currentSha256}),/identity changed/);
      assert.equal(fs.readFileSync(f.target,'utf8'),'bad');
    }finally{f.cleanup();}
  }
});
test('WF260: empty baselines truncate corruption correctly; unchanged files need no backup',()=>{
  const f=fixture();try{
    fs.writeFileSync(f.target,Buffer.alloc(0));const s=f.capture(),unchanged=f.inspect();
    assert.equal(restoreLockSnapshot(unchanged,{repoRoot:f.root,expectCurrent:unchanged.currentSha256}).changed,false);
    fs.writeFileSync(f.target,'new unwanted bytes');const changed=f.inspect();restoreLockSnapshot(changed,{repoRoot:f.root,expectCurrent:changed.currentSha256});
    assert.equal(fs.statSync(f.target).size,0);assert.equal(fs.readdirSync(s.home).filter(n=>n.startsWith('before-restore-')).length,1);
  }finally{f.cleanup();}
});
test('WF260: nonignored snapshot homes and deleted targets are not silently repaired',()=>{
  const f=fixture();try{
    fs.writeFileSync(path.join(f.root,'.gitignore'),'');assert.throws(()=>f.capture(),/already be gitignored/);
    fs.writeFileSync(path.join(f.root,'.gitignore'),'.agent/\n');f.capture();fs.unlinkSync(f.target);assert.throws(()=>f.inspect(),/ENOENT/);
    assert.equal(fs.existsSync(f.target),false,'recovery is not creation or deletion authority');
  }finally{f.cleanup();}
});

test('WF260: interrupted writes preserve current bytes and report the backup without an automatic retry',()=>{
  const f=fixture(),write=fs.writeSync;try{
    const snapshot=f.capture();fs.writeFileSync(f.target,'bad bytes before recovery');const report=f.inspect();let calls=0;
    const targetStat=fs.statSync(f.target);
    fs.writeSync=(...args)=>{const stat=fs.fstatSync(args[0]);if(stat.dev!==targetStat.dev||stat.ino!==targetStat.ino)return write(...args);calls++;if(calls===1)return write(args[0],args[1],args[2],1,args[4]);throw new Error('fixture write interruption');};
    assert.throws(()=>restoreLockSnapshot(report,{repoRoot:f.root,expectCurrent:report.currentSha256}),/may be partial.*keep the lock.*backup/);
    assert.equal(calls,2,'no retry after write interruption');const backup=fs.readdirSync(snapshot.home).find(name=>name.startsWith('before-restore-'));
    assert.equal(fs.readFileSync(path.join(snapshot.home,backup),'utf8'),'bad bytes before recovery');
    assert.equal(fs.readFileSync(path.join(f.root,'sibling.txt'),'utf8'),'peer work');
  }finally{fs.writeSync=write;f.cleanup();}
});

test('WF260: recovery overlap gate recognizes absolute/case aliases, directories and supported glob syntax',()=>{
  const f=fixture();try{
    for(const scope of [{paths:[f.target],globs:[]},{paths:[],globs:['**/owned.bin']},{paths:[],globs:['owne?.bin']},{paths:['.'],globs:[]},...(process.platform==='win32'?[{paths:['OWNED.BIN'],globs:[]}]:[])])assert.equal(recovery.recoveryLockOverlaps({repoRoot:f.root,file:'owned.bin',lock:scope}),true);
    assert.equal(recovery.recoveryLockOverlaps({repoRoot:f.root,file:'owned.bin',lock:{paths:['unrelated.bin'],globs:['src/*.ts']}}),false);
    assert.throws(()=>recovery.recoveryLockOverlaps({repoRoot:f.root,file:'owned.bin',lock:{paths:null,globs:[]}}),/scope/);
  }finally{f.cleanup();}
});
