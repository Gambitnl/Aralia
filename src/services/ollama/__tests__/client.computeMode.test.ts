/** Exercise the real local request serialization. A player CPU choice applies
 * only to that job, is read per request, and never changes the cloud route. */
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {OllamaClient} from '../client';
import {setOllamaComputeMode} from '../../ai/aiProviderSettings';
const cloud=vi.hoisted(()=>({active:false,generate:vi.fn(),chat:vi.fn()}));
const log=vi.hoisted(()=>({emit:vi.fn()}));
vi.mock('../router',()=>({resolveModelForTask:vi.fn(async()=> 'test-model'),resetRouterCache:vi.fn()}));
vi.mock('../../ai/textProviderRouter',()=>({isGroqActive:()=>cloud.active,routeGenerateForTask:cloud.generate,routeChatForTask:cloud.chat}));
vi.mock('../ollamaLogSink',()=>({emitOllamaLog:log.emit}));
import {resolveModelForTask} from '../router';
import {emitOllamaLog} from '../ollamaLogSink';
const fetchMock=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({model:'test-model',created_at:'now',response:'Ready.',message:{role:'assistant',content:'Ready.'},done:true}),{status:200}));
const bodyAt=(index=0)=>JSON.parse(String(fetchMock.mock.calls[index][1]?.body));
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
describe('explicit local compute choice',()=>{
 afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
 beforeEach(()=>{
  localStorage.clear();vi.clearAllMocks();cloud.active=false;
  vi.mocked(resolveModelForTask).mockReset().mockResolvedValue('test-model');
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({model:'test-model',created_at:'now',response:'Ready.',message:{role:'assistant',content:'Ready.'},done:true}),{status:200}));
  vi.stubGlobal('fetch',fetchMock);
 });
 it('cancels abandoned generation at the actual fetch without waiting for its provider timeout',async()=>{
  let begin!:()=>void;const started=new Promise<void>(resolve=>{begin=resolve;});
  fetchMock.mockImplementationOnce(async(_url,options)=>new Promise((_resolve,reject)=>{
   options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});begin();
  }));
  const controller=new AbortController();
  const result=new OllamaClient().generateForTask({taskType:'conversation_continuation',prompt:'Hello',signal:controller.signal});
  await started;controller.abort();
  expect(await result).toEqual({ok:false,error:'Request cancelled.',model:'test-model'});
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
 });
 it('does not start generation after its owner cancels during model discovery',async()=>{
  const controller=new AbortController();controller.abort();
  expect(await new OllamaClient().generateForTask({taskType:'conversation_continuation',prompt:'Hello',signal:controller.signal})).toEqual({ok:false,error:'Request cancelled.'});
  expect(fetchMock).not.toHaveBeenCalled();
 });
 it('reports a missing configured model instead of leaving the dialogue log pending',async()=>{
  vi.mocked(resolveModelForTask).mockRejectedValueOnce(new Error('Ollama model "chosen-dialogue" is not installed.'));
  const result=await new OllamaClient().generateForTask({taskType:'conversation_continuation',prompt:'Hello'});
  expect(result).toEqual({ok:false,error:'Ollama model "chosen-dialogue" is not installed.'});
  expect(emitOllamaLog).toHaveBeenLastCalledWith(expect.objectContaining({
   phase:'error',taskType:'conversation_continuation',error:'Ollama model "chosen-dialogue" is not installed.',
  }));
  expect(fetchMock).not.toHaveBeenCalled();
 });
 it('does not add a device override for the default Automatic choice',async()=>{
  await new OllamaClient().generateForTask({taskType:'npc_dialogue',prompt:'Hello'});
  expect(bodyAt().options).not.toHaveProperty('num_gpu');
  expect(bodyAt().options.num_ctx).toBe(4096);
 });
 it('sends zero GPU layers for an explicitly CPU dialogue job',async()=>{
  setOllamaComputeMode('dialogue','cpu');
  await new OllamaClient().generateForTask({taskType:'npc_dialogue',prompt:'Hello'});
  expect(bodyAt().model).toBe('test-model');expect(bodyAt().options.num_gpu).toBe(0);
 });
 it('applies the same explicit choice to local chat requests',async()=>{
  setOllamaComputeMode('dialogue','cpu');
  await new OllamaClient().chatForTask({taskType:'conversation_continuation',messages:[{role:'user',content:'Hello'}]});
  expect(bodyAt().options.num_gpu).toBe(0);
 });
 it('does not move another job onto CPU',async()=>{
  setOllamaComputeMode('dialogue','cpu');
  await new OllamaClient().generateForTask({taskType:'name_generation',prompt:'A name'});
  expect(bodyAt().options).not.toHaveProperty('num_gpu');
 });
 it('observes a changed choice on the next request without changing the model',async()=>{
  const client=new OllamaClient();setOllamaComputeMode('dialogue','cpu');
  await client.generateForTask({taskType:'npc_dialogue',prompt:'First'});
  setOllamaComputeMode('dialogue','auto');await client.generateForTask({taskType:'npc_dialogue',prompt:'Second'});
  expect(bodyAt(0).options.num_gpu).toBe(0);expect(bodyAt(1).options).not.toHaveProperty('num_gpu');
  expect(bodyAt(0).model).toBe(bodyAt(1).model);
 });
 it('leaves chosen cloud generate and chat requests on their existing route',async()=>{
  setOllamaComputeMode('dialogue','cpu');cloud.active=true;
  cloud.generate.mockResolvedValue({ok:true,data:{response:'cloud'},model:'chosen-cloud'});
  cloud.chat.mockResolvedValue({ok:true,data:{message:{content:'cloud'}},model:'chosen-cloud'});
  const client=new OllamaClient();await client.generateForTask({taskType:'npc_dialogue',prompt:'Hello'});
  await client.chatForTask({taskType:'conversation_continuation',messages:[]});
  expect(cloud.generate).toHaveBeenCalledOnce();expect(cloud.chat).toHaveBeenCalledOnce();expect(fetchMock).not.toHaveBeenCalled();
 });
 it('prepares a local dialogue model with an empty prompt and the current runtime options',async()=>{
  setOllamaComputeMode('dialogue','cpu');
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({model:'test-model',response:'',done:true}),{status:200}));
  const result=await new OllamaClient().prepareForTask('conversation_continuation');
  expect(result).toEqual({status:'ready',model:'test-model'});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const request=fetchMock.mock.calls[0];
  expect(String(request[0])).toMatch(/\/api\/ollama\/generate$/);
  const body=JSON.parse(String(request[1]?.body));
  expect(body).toMatchObject({model:'test-model',prompt:'',stream:false});
  expect(body.options).toEqual({num_ctx:4096,num_gpu:0});
  expect(body).not.toHaveProperty('keep_alive');
  expect(emitOllamaLog).toHaveBeenNthCalledWith(1,expect.objectContaining({phase:'start',taskType:'conversation_continuation',prompt:''}));
  expect(emitOllamaLog).toHaveBeenLastCalledWith(expect.objectContaining({phase:'success',response:''}));
 });
 it('uses the intent task profile category and compute choice for intent readiness',async()=>{
  setOllamaComputeMode('judgment','cpu');
  setOllamaComputeMode('dialogue','auto');
  await new OllamaClient().prepareForTask('situation_analysis');
  expect(resolveModelForTask).toHaveBeenCalledWith(expect.any(OllamaClient),'situation_analysis',expect.objectContaining({signal:expect.any(AbortSignal)}));
  expect(bodyAt().options).toEqual({num_ctx:4096,num_gpu:0});
 });
 it('skips local preparation entirely when Groq is the selected provider',async()=>{
  cloud.active=true;
  const result=await new OllamaClient().prepareForTask('conversation_continuation');
  expect(result).toEqual({status:'not-required',provider:'groq'});
  expect(fetchMock).not.toHaveBeenCalled();
  expect(resolveModelForTask).not.toHaveBeenCalled();
 });
 it('deduplicates matching concurrent preparation and only cancels after the last caller leaves',async()=>{
  let begin!:()=>void;let finish!:()=>void;
  const started=new Promise<void>(resolve=>{begin=resolve;});
  fetchMock.mockImplementation(async(url,init)=>{
   if(String(url).endsWith('/ps')) return new Response(JSON.stringify({models:[]}),{status:200});
   if(String(url).endsWith('/generate')) return new Promise<Response>((resolve,reject)=>{
    init?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
    finish=()=>resolve(new Response(JSON.stringify({model:'test-model',response:'',done:true}),{status:200}));begin();
   });
   return new Response('{}',{status:404});
  });
  const firstController=new AbortController();const secondController=new AbortController();const client=new OllamaClient();
  const first=client.prepareForTask('conversation_continuation',{signal:firstController.signal});
  const second=client.prepareForTask('conversation_continuation',{signal:secondController.signal});
  await started;
  expect(fetchMock.mock.calls.filter(([url])=>String(url).endsWith('/generate'))).toHaveLength(1);
  firstController.abort();
  await expect(first).resolves.toMatchObject({status:'cancelled'});
  expect(fetchMock.mock.calls.find(([url])=>String(url).endsWith('/generate'))?.[1]?.signal?.aborted).toBe(false);
  finish();
  await expect(second).resolves.toEqual({status:'ready',model:'test-model'});
 });
 it('aborts the underlying startup request when its only caller cancels',async()=>{
  let begin!:()=>void;const started=new Promise<void>(resolve=>{begin=resolve;});
  fetchMock.mockImplementation(async(url,init)=>{
   if(String(url).endsWith('/ps')) return new Response(JSON.stringify({models:[]}),{status:200});
   return new Promise<Response>((_resolve,reject)=>{
    init?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});begin();
   });
  });
  const controller=new AbortController();
  const result=new OllamaClient().prepareForTask('conversation_continuation',{signal:controller.signal});
  await started;controller.abort();
  await expect(result).resolves.toMatchObject({status:'cancelled'});
  expect(fetchMock.mock.calls.find(([url])=>String(url).endsWith('/generate'))?.[1]?.signal?.aborted).toBe(true);
 });
 it('waits for an aborted startup transport to settle before retrying the same key',async()=>{
  let begin!:()=>void;const started=new Promise<void>(resolve=>{begin=resolve;});
  fetchMock.mockImplementationOnce(async(_url,init)=>new Promise<Response>((_resolve,reject)=>{
   begin();init?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  }));
  fetchMock.mockImplementationOnce(async()=>new Response(JSON.stringify({model:'test-model',response:'',done:true}),{status:200}));
  const client=new OllamaClient();const firstController=new AbortController();
  const first=client.prepareForTask('conversation_continuation',{signal:firstController.signal});
  await started;firstController.abort();
  await expect(first).resolves.toMatchObject({status:'cancelled'});
  const retry=client.prepareForTask('conversation_continuation');
  expect(fetchMock.mock.calls.filter(([url])=>String(url).endsWith('/generate'))).toHaveLength(1);
  await expect(retry).resolves.toEqual({status:'ready',model:'test-model'});
  expect(fetchMock.mock.calls.filter(([url])=>String(url).endsWith('/generate'))).toHaveLength(2);
 });
 it('cancels promptly while the selected task model is still being discovered',async()=>{
  const discovery=deferred<string|null>();
  vi.mocked(resolveModelForTask).mockImplementationOnce(()=>discovery.promise);
  const controller=new AbortController();
  const preparation=new OllamaClient().prepareForTask('situation_analysis',{signal:controller.signal});
  controller.abort();
  const outcome=await Promise.race([preparation,new Promise(resolve=>setTimeout(()=>resolve('still-pending'),40))]);
  expect(outcome).toMatchObject({status:'cancelled'});
  expect(fetchMock).not.toHaveBeenCalled();
  discovery.resolve('test-model');
 });
 it('passes the preparation owner signal through selected-model discovery',async()=>{
  const controller=new AbortController();
  const discovery=deferred<string|null>();
  let discoverySignal:AbortSignal|undefined;
  vi.mocked(resolveModelForTask).mockImplementationOnce((_client,_task,options)=>{discoverySignal=options?.signal;return discovery.promise;});
  const preparation=new OllamaClient().prepareForTask('situation_analysis',{signal:controller.signal});
  await vi.waitFor(()=>expect(resolveModelForTask).toHaveBeenCalledOnce());
  expect(discoverySignal).toBeInstanceOf(AbortSignal);
  controller.abort();
  await expect(preparation).resolves.toMatchObject({status:'cancelled'});
  expect(discoverySignal?.aborted).toBe(true);
  discovery.resolve('test-model');
 });
 it('bounds preparation from its start even if selected-model discovery never settles',async()=>{
  vi.useFakeTimers();
  vi.mocked(resolveModelForTask).mockImplementationOnce(()=>new Promise(()=>{}));
  const preparation=new OllamaClient().prepareForTask('situation_analysis');
  await vi.advanceTimersByTimeAsync(300_000);
  const outcome=await Promise.race([preparation,Promise.resolve('still-pending')]);
  expect(outcome).toMatchObject({status:'error',error:expect.stringContaining('300000')});
  expect(fetchMock).not.toHaveBeenCalled();
  vi.useRealTimers();
 });
 it('keeps the preparation deadline active while reading the response body',async()=>{
  vi.useFakeTimers();
  const body=deferred<{done:boolean}>();
  fetchMock.mockResolvedValueOnce({ok:true,statusText:'OK',json:()=>body.promise} as Response);
  const preparation=new OllamaClient().prepareForTask('conversation_continuation');
  await vi.waitFor(()=>expect(fetchMock).toHaveBeenCalledOnce());
  const loadSignal=fetchMock.mock.calls[0][1]?.signal;
  await vi.advanceTimersByTimeAsync(300_000);
  const outcome=await Promise.race([preparation,Promise.resolve('still-pending')]);
  expect(outcome).toMatchObject({status:'error',error:expect.stringContaining('300000')});
  expect(loadSignal?.aborted).toBe(true);
  body.resolve({done:true});
  vi.useRealTimers();
 });
 it('lets a retry caller cancel while it waits for an aborted load to finish consuming its body',async()=>{
  const body=deferred<{done:boolean}>();
  fetchMock.mockResolvedValueOnce({ok:true,statusText:'OK',json:()=>body.promise} as Response);
  const client=new OllamaClient();const firstController=new AbortController();
  const first=client.prepareForTask('conversation_continuation',{signal:firstController.signal});
  await vi.waitFor(()=>expect(fetchMock).toHaveBeenCalledOnce());
  firstController.abort();
  await expect(first).resolves.toMatchObject({status:'cancelled'});
  const retryController=new AbortController();
  const retry=client.prepareForTask('conversation_continuation',{signal:retryController.signal});
  retryController.abort();
  const outcome=await Promise.race([retry,new Promise(resolve=>setTimeout(()=>resolve('still-pending'),40))]);
  expect(outcome).toMatchObject({status:'cancelled'});
  expect(fetchMock).toHaveBeenCalledOnce();
  body.resolve({done:true});
 });
});
