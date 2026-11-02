import {afterEach,describe,expect,it,vi} from 'vitest';
import {installMessageWorkProbe} from '../pageWorkProbe';

let release=()=>{};
afterEach(()=>{release();release=()=>{};vi.restoreAllMocks();});
function setup(enabled=()=>true){
  class FakeWorker extends EventTarget {
    private handler:EventListener|null=null;
    get onmessage(){return this.handler;}
    set onmessage(fn:EventListener|null){if(this.handler)this.removeEventListener('message',this.handler);this.handler=fn;if(fn)this.addEventListener('message',fn);}
  }
  // Use an independent native-style slot: real onmessage registration does not
  // call the JS addEventListener wrapper. Dispatch here calls the native slot.
  let slot:EventListener|null=null;
  Object.defineProperty(FakeWorker.prototype,'onmessage',{configurable:true,get(){return slot;},set(fn){slot=fn;}});
  const report=vi.fn(),clock=vi.spyOn(performance,'now');let now=100;clock.mockImplementation(()=>now);
  release=installMessageWorkProbe(report,enabled,{worker:FakeWorker});
  const worker=new FakeWorker();
  return {worker,report,advance:(ms:number)=>{now+=ms;},deliver:()=>slot?.call(worker,new Event('message'))};
}
describe('main-thread message work',()=>{
  it('preserves property getter identity, this, event and thrown errors',()=>{
    const s=setup();const error=Error('handler failure');const receivers:unknown[]=[];
    const fn=function(this:unknown,event:Event){receivers.push(this);expect(event.type).toBe('message');s.advance(12);throw error;};
    s.worker.onmessage=fn;expect(s.worker.onmessage).toBe(fn);
    expect(s.deliver).toThrow(error);expect(receivers).toHaveLength(1);expect(receivers[0]).toBe(s.worker);
    expect(s.report).toHaveBeenCalledWith(expect.stringContaining('Worker message:'),100,112);
    s.worker.onmessage=null;expect(s.worker.onmessage).toBeNull();
  });
  it('preserves duplicate registration, removal, capture and once semantics',()=>{
    const s=setup();const fn=vi.fn(()=>s.advance(3));
    s.worker.addEventListener('message',fn);s.worker.addEventListener('message',fn);
    s.worker.dispatchEvent(new Event('message'));expect(fn).toHaveBeenCalledTimes(1);
    s.worker.removeEventListener('message',fn);s.worker.dispatchEvent(new Event('message'));expect(fn).toHaveBeenCalledTimes(1);
    s.worker.addEventListener('message',fn,{once:true});s.worker.dispatchEvent(new Event('message'));s.worker.dispatchEvent(new Event('message'));
    expect(fn).toHaveBeenCalledTimes(2);expect(s.report).toHaveBeenCalledTimes(2);
  });
  it('calls object listeners with the object as this and supports bypass',()=>{
    let enabled=false;const s=setup(()=>enabled);
    const listener={handleEvent:vi.fn(function(this:unknown){expect(this).toBe(listener);s.advance(2);})};
    s.worker.addEventListener('message',listener);s.worker.dispatchEvent(new Event('message'));expect(s.report).not.toHaveBeenCalled();
    enabled=true;s.worker.dispatchEvent(new Event('message'));expect(s.report).toHaveBeenCalledTimes(1);
    s.worker.removeEventListener('message',listener);s.worker.dispatchEvent(new Event('message'));expect(listener.handleEvent).toHaveBeenCalledTimes(2);
  });
  it('keeps handler results intact if reporting fails',()=>{
    const s=setup();s.report.mockImplementation(()=>{throw Error('telemetry');});
    const fn=vi.fn(()=>s.advance(1));s.worker.onmessage=fn;expect(s.deliver).not.toThrow();expect(fn).toHaveBeenCalledOnce();
  });
});
