/** An observed local-service refusal must recover after the same service returns.
 * Fixtures emit proxy events only; no real provider, credential or model is used. */
import {EventEmitter} from 'node:events';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {addProxyDiagnostics} from '../localServiceProxy';

function response(){
  const res={headersSent:false,writeHead:vi.fn(),end:vi.fn()};
  res.writeHead.mockImplementation(()=>{res.headersSent=true;});
  return res;
}
function fixture(){
  const rewrite=(path:string)=>path.replace(/^\/api\/ollama/,'');
  const config=addProxyDiagnostics('/api/ollama',{target:'http://localhost:11434/api',changeOrigin:true,rewrite},'Start the existing local service.');
  const proxy=new EventEmitter(),request={url:'/api/ollama/tags',method:'GET'};
  // Only the event-emitter surface is needed from the real HTTP proxy here.
  config.configure?.(proxy as never,{});
  const bypass=()=>{const res=response();return{result:config.bypass?.(request as never,res as never,config),res};};
  const refuse=(nested=false)=>{const res=response();const error=Object.assign(new Error(nested?'':'ECONNREFUSED'),
    nested?{errors:[{code:'ECONNREFUSED'}]}:{code:'ECONNREFUSED'});
    proxy.emit('error',error,request,res);return{error,res};};
  return{config,proxy,request,bypass,refuse,rewrite};
}

describe('local service proxy outage recovery',()=>{
  beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(0);vi.spyOn(console,'error').mockImplementation(()=>{});vi.spyOn(console,'info').mockImplementation(()=>{});});
  afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
  it('allows a later request through after a refusal rather than latching offline forever',()=>{
    const f=fixture();
    expect(f.bypass().result).toBeUndefined();f.refuse();
    const down=f.bypass();expect(down.result).toBe(f.request.url);
    expect(down.res.writeHead).toHaveBeenCalledWith(502,{'Content-Type':'application/json'});
    expect(JSON.parse(down.res.end.mock.calls[0][0])).toMatchObject({error:'LOCAL_SERVICE_UNAVAILABLE'});
    vi.advanceTimersByTime(2000);
    expect(f.bypass().result).toBeUndefined();
    f.proxy.emit('proxyRes');
    expect(f.bypass().result).toBeUndefined();
  });
  it('admits one retry per cooldown and retains quiet failures until a real response re-arms diagnostics',()=>{
    const f=fixture();f.refuse(true);expect(console.error).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(2000);expect(f.bypass().result).toBeUndefined();
    expect(f.bypass().result).toBe(f.request.url);expect(f.bypass().result).toBe(f.request.url);
    f.refuse();expect(console.error).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(2000);expect(f.bypass().result).toBeUndefined();
    f.proxy.emit('proxyRes');expect(console.info).toHaveBeenCalledTimes(1);
    expect(f.bypass().result).toBeUndefined();
    f.refuse();expect(console.error).toHaveBeenCalledTimes(6);
  });
  it('preserves local routing and never reports a refused generation as success',()=>{
    const f=fixture();f.request.url='/api/ollama/generate';f.request.method='POST';
    const failure=f.refuse();
    expect(f.config.target).toBe('http://localhost:11434/api');expect(f.config.changeOrigin).toBe(true);
    expect(f.config.rewrite).toBe(f.rewrite);expect(f.rewrite('/api/ollama/generate')).toBe('/generate');
    expect(failure.error.stack).toBe('');
    expect(failure.res.writeHead).toHaveBeenCalledWith(502,{'Content-Type':'application/json'});
    expect(JSON.parse(failure.res.end.mock.calls[0][0])).toMatchObject({error:'LOCAL_SERVICE_UNAVAILABLE'});
  });
  it('leaves non-refusal errors visible without poisoning future proxy attempts',()=>{
    const f=fixture(),res=response();
    f.proxy.emit('error',new Error('upstream response failed'),f.request,res);
    expect(res.writeHead).toHaveBeenCalledWith(502,{'Content-Type':'application/json'});
    expect(f.bypass().result).toBeUndefined();
    expect(console.error).not.toHaveBeenCalled();
  });
});
