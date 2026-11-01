/** The admitted desk lends regional accounts. Selecting Read records the
 * source's frozen words in the existing journal, without finding its subject
 * physically, moving the party or turning a volume into carried property. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 12:25:08
 * Dependents: components/Town/Broadsheet.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React,{useMemo,useState} from 'react';
import {useGameState} from '@/state/GameContext';
import {currentLibraryCollection,libraryAccountDiscovery} from '@/systems/worldforge/interior/libraryCollection';
import {Button} from '../ui/Button';

export default function LibraryCollectionReader(){
 const {state,dispatch}=useGameState();
 const collection=useMemo(()=>{try{return currentLibraryCollection(state);}catch{return null;}},[state]);
 // A selection belongs to these exact words at this library in this world.
 // Reusing a record key after a context change must not reveal another text.
 const [selected,setSelected]=useState<{source:string;words:string}|null>(null);
 const source=collection?JSON.stringify([collection.worldSeed,collection.burgId,collection.plotId]):null;
 const record=source===selected?.source?collection?.records.find(r=>JSON.stringify(r)===selected?.words):undefined;
 if(!collection)return <p role="status">Return to the staffed reading desk to consult this collection.</p>;
 return <section aria-label="Regional library collection">
  <h3 className="text-2xl font-bold">{collection.regionName} collection</h3>
  <p className="my-3 text-sm">Select an account to read. Its words will be kept in your journal. Historical accounts and registers do not establish present conditions or physical access.</p>
  <div className="grid grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)] gap-6">
   <div className="space-y-3">{collection.records.map(r=><div key={r.key} className="rounded border border-stone-400 p-3">
    <h4 className="font-bold">{r.title}</h4>
    <p className="my-1 text-xs uppercase tracking-wide">{r.kind==='municipal-works'?'Municipal register':'Regional history'}</p>
    <Button variant="secondary" size="sm" onClick={()=>{
     // Resolve the current admitted context again at activation. A stale list
     // cannot teach its old world's account after movement or source change.
     const live=currentLibraryCollection(state),entry=live?.records.find(e=>e.key===r.key);
     if(!live||!entry)return;
     setSelected({source:JSON.stringify([live.worldSeed,live.burgId,live.plotId]),words:JSON.stringify(entry)});
     dispatch({type:'ADD_DISCOVERY_ENTRY',payload:libraryAccountDiscovery(live,entry,state.gameTime)});
    }}>Read {r.title}</Button>
   </div>)}</div>
   <article aria-live="polite" className="rounded border border-stone-400 bg-stone-50 p-5">
    {record?<><h4 className="mb-4 text-xl font-bold">{record.title}</h4><p className="leading-relaxed">{record.text}</p><p className="mt-5 text-sm italic">Account retained from {collection.townName} library.</p></>
     :<p className="italic">Choose a volume from the collection.</p>}
   </article>
  </div>
  {!collection.records.length&&<p>No regional accounts are indexed in this collection.</p>}
 </section>;
}
