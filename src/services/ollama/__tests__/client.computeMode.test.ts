/** Exercise the real local request serialization. A player CPU choice applies
 * only to that job, is read per request, and never changes the cloud route. */
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {OllamaClient} from '../client';
import {setOllamaComputeMode} from '../../ai/aiProviderSettings';
const cloud=vi.hoisted(()=>({active:false,generate:vi.fn(),chat:vi.fn()}));
vi.mock('../router',()=>({resolveModelForTask:vi.fn(async()=> 'test-model'),resetRouterCache:vi.fn()}));
vi.mock('../../ai/textProviderRouter',()=>({isGroqActive:()=>cloud.active,routeGenerateForTask:cloud.generate,routeChatForTask:cloud.chat}));
const fetchMock=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({model:'test-model',created_at:'now',response:'Ready.',message:{role:'assistant',content:'Ready.'},done:true}),{status:200}));
const bodyAt=(index=0)=>JSON.parse(String(fetchMock.mock.calls[index][1]?.body));
describe('explicit local compute choice',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 beforeEach(()=>{localStorage.clear();vi.clearAllMocks();cloud.active=false;vi.stubGlobal('fetch',fetchMock);});
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
});
