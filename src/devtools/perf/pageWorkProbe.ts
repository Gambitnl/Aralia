/**
 * Times main-thread message handlers, including short worker replies Chrome's
 * long-frame reports omit. This measures handling/decoding on the page, never
 * execution inside a worker. Native delivery, listener identity and errors stay
 * unchanged; timing and reporting failures must never break the application.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/10/2026, 14:31:23
 * Dependents: devtools/perf/rendererProbe.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

type Listener = EventListenerOrEventListenerObject;
type TargetClass = { prototype: EventTarget & { onmessage?: unknown } };
type Reporter = (name: string, start: number, end: number) => void;

function registration(): string {
  // One stack at registration, not on every message. It supplies a useful file
  // even when the listener is anonymous and the worker URL is not public.
  const line = new Error().stack?.split('\n').find(l => !l.includes('pageWorkProbe') && /https?:\/\//.test(l));
  const url = line?.match(/https?:\/\/[^\s)]+/)?.[0];
  return url?.split('/').pop()?.replace(/\?[^:)]*/, '') ?? 'source unavailable';
}

export function installMessageWorkProbe(report: Reporter, enabled: () => boolean,
  classes: { worker?: TargetClass; port?: TargetClass } = {
    worker: typeof Worker === 'undefined' ? undefined : Worker,
    port: typeof MessagePort === 'undefined' ? undefined : MessagePort,
  }): () => void {
  const releases: (() => void)[] = [];
  for (const [kind,ctor] of [['Worker',classes.worker],['MessagePort',classes.port]] as const) {
    if (!ctor) continue;
    const proto=ctor.prototype;
    const wrap=(listener:Listener,name:string):EventListener => function(this:EventTarget,event:Event) {
      if (!enabled()) {
        if (typeof listener==='function') listener.call(this,event); else listener.handleEvent(event);
        return;
      }
      const start=performance.now();
      try { if (typeof listener==='function') listener.call(this,event); else listener.handleEvent(event); }
      finally { const end=performance.now();try { if(end>start)report(name,start,end); } catch { /* only telemetry failed */ } }
    };
    const descriptor=Object.getOwnPropertyDescriptor(proto,'onmessage');
    if (descriptor?.get && descriptor.set && descriptor.configurable) {
      const assigned=new WeakMap<object,{original:EventListener;wrapped:EventListener}>();
      const getter=descriptor.get,setter=descriptor.set;
      Object.defineProperty(proto,'onmessage',{...descriptor,
        get(){const actual=getter.call(this),saved=assigned.get(this);return saved && saved.wrapped===actual?saved.original:actual;},
        set(value:unknown){
          if(typeof value!=='function'){assigned.delete(this);setter.call(this,value);return;}
          const wrapped=wrap(value as EventListener,kind+' message: '+registration());
          assigned.set(this,{original:value as EventListener,wrapped});setter.call(this,wrapped);
        },
      });
      releases.push(()=>Object.defineProperty(proto,'onmessage',descriptor));
    }
    const add=proto.addEventListener,remove=proto.removeEventListener;
    const ownAdd=Object.getOwnPropertyDescriptor(proto,'addEventListener'),ownRemove=Object.getOwnPropertyDescriptor(proto,'removeEventListener');
    const listeners=new WeakMap<object,Map<string,WeakMap<Listener,EventListener>>>();
    const capture=(options?:boolean|EventListenerOptions)=>typeof options==='boolean'?options:options?.capture ?? false;
    proto.addEventListener=function(type:string,listener:Listener|null,options?:boolean|AddEventListenerOptions){
      if(type!=='message'||!listener){add.call(this,type,listener,options);return;}
      let target=listeners.get(this);if(!target){target=new Map();listeners.set(this,target);}
      const key=type+':'+capture(options);let table=target.get(key);if(!table){table=new WeakMap();target.set(key,table);}
      let wrapped=table.get(listener);if(!wrapped){wrapped=wrap(listener,kind+' message: '+registration());table.set(listener,wrapped);}
      add.call(this,type,wrapped,options);
    };
    proto.removeEventListener=function(type:string,listener:Listener|null,options?:boolean|EventListenerOptions){
      const wrapped=listener&&listeners.get(this)?.get(type+':'+capture(options))?.get(listener);
      remove.call(this,type,wrapped||listener,options);
    };
    releases.push(()=>{
      if(ownAdd)Object.defineProperty(proto,'addEventListener',ownAdd);else delete (proto as Partial<EventTarget>).addEventListener;
      if(ownRemove)Object.defineProperty(proto,'removeEventListener',ownRemove);else delete (proto as Partial<EventTarget>).removeEventListener;
    });
  }
  return ()=>{for(const release of releases.reverse())release();};
}
