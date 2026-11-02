/** Simulate browser transaction settlement without touching real saves. An
 * aborted emergency write must release startup; only a committed write may
 * report success. Native disk-capacity failures still need separate evidence. */
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('../../utils/core',()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
beforeEach(()=>vi.resetModules());
afterEach(()=>vi.unstubAllGlobals());

function storage(){
 const transaction={error:null as DOMException|null,oncomplete:null as null|(()=>void),
  onerror:null as null|(()=>void),onabort:null as null|(()=>void),objectStore:()=>({put:vi.fn()})};
 const db={transaction:()=>transaction};
 vi.stubGlobal('indexedDB',{open:()=>{
  const request={onsuccess:null as null|((e:unknown)=>void)};
  queueMicrotask(()=>request.onsuccess?.({target:{result:db}}));return request;
 }});
 return transaction;
}

it('rejects an aborted save transaction so cold-start recovery cannot wait forever',async()=>{
 const tx=storage(),{putSave}=await import('../indexedDBStorageService');
 const pending=putSave('fixture','unchanged-payload');
 const observed=pending.then(()=> 'committed',error=>error);
 await vi.waitFor(()=>expect(tx.oncomplete).toBeTypeOf('function'));
 tx.error=new DOMException('Storage transaction was aborted','AbortError');tx.onabort?.();
 const outcome=await Promise.race([observed,new Promise(resolve=>setTimeout(()=>resolve('still pending'),30))]);
 expect(outcome).toBe(tx.error);
});

it('reports success only after the entire save transaction commits',async()=>{
 const tx=storage(),{putSave}=await import('../indexedDBStorageService');
 let committed=false;const pending=putSave('fixture','unchanged-payload').then(()=>{committed=true});
 await vi.waitFor(()=>expect(tx.oncomplete).toBeTypeOf('function'));
 expect(committed).toBe(false);tx.oncomplete?.();await pending;expect(committed).toBe(true);
});
