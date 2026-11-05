import {describe,it,expect,vi} from 'vitest';
const localSource=vi.hoisted(()=>({resolveNpcLocalDirections:vi.fn(),resolveNpcLocalStockDirections:vi.fn(),
 localFactUncertaintyReply:(query:{itemRequested:boolean;subject:string})=>`I can't point you to a nearby ${query.itemRequested?`source for ${query.subject}`:'shop'} from what I know.`}));
vi.mock('../../systems/travel/npcLocalDirections',()=>localSource);
import {classifyLocalFactQuestion,resolveFreeformLocalFactReply} from '../dialogueService';

describe('explicit local fact question classification',()=>{
 it('recognizes the actual local ration-shopping question without losing its wording',()=>{
  const prompt='I am Bram. Elara and I need food for our return journey. Where can I buy rations nearby?';
  expect(classifyLocalFactQuestion(prompt)).toMatchObject({itemId:'rations',playerPrompt:prompt,itemRequested:true});
 });
 it.each([
  'Where can I find provisions around here?',
  'Can I buy food nearby?',
  'Where are rations in this town?',
 ])('recognizes explicit local supply question: %s',prompt=>expect(classifyLocalFactQuestion(prompt)).toBeDefined());
 it('recognizes a named catalog item and contains an unrecognized local item to uncertainty',()=>{
  expect(classifyLocalFactQuestion('Where can I buy a healing potion nearby?')?.itemId).toBeDefined();
  expect(classifyLocalFactQuestion('Where can I buy an unlisted object nearby?')).toMatchObject({itemRequested:true,subject:'unlisted object'});
 });
 it.each(['food','provisions','supplies'])('does not silently reinterpret %s as rations',subject=>{
  expect(classifyLocalFactQuestion(`Where can I buy ${subject} nearby?`)).toMatchObject({itemRequested:true});
  expect(classifyLocalFactQuestion(`Where can I buy ${subject} nearby?`)?.itemId).toBeUndefined();
 });
 it.each([
  'Why did you want to restore the temple to begin with?',
  'What do you think about the temple?',
  'Where can I buy rations in Waterdeep?',
  'I need food for the road. Tell me about your family.',
 ])('keeps social or nonlocal speech on the model path: %s',prompt=>expect(classifyLocalFactQuestion(prompt)).toBeUndefined());
 it('returns an attributed source receipt only for a source-resolved open seller',()=>{
  const prompt='Where can I buy rations nearby?';
  localSource.resolveNpcLocalStockDirections.mockReturnValue({status:'found',itemId:'rations',businessId:'shop-1',burgId:12,plotId:4,
   snapshot:'The Provisioner is open nearby and has 4 rations listed.'});
  expect(resolveFreeformLocalFactReply({} as never,{id:'npc',name:'Nia'} as never,prompt,'speaker')).toMatchObject({handled:true,
   response:'The Provisioner is open nearby and has 4 rations listed.',publication:{topicId:'global_directions',speakerKey:'speaker',
   source:{kind:'local-directions',snapshot:'The Provisioner is open nearby and has 4 rations listed.',query:{playerPrompt:prompt,itemId:'rations',businessId:'shop-1',burgId:12,plotId:4}}}});
 });
 it('does not publish a fact or permit model completion when local stock is unknown',()=>{
  localSource.resolveNpcLocalStockDirections.mockReturnValue({status:'unknown',itemId:'rations'});
  const result=resolveFreeformLocalFactReply({} as never,{id:'npc',name:'Nia'} as never,'Where can I buy rations nearby?','speaker');
  expect(result).toMatchObject({handled:true,response:expect.stringContaining('source for Rations'),publication:{source:{query:{outcome:'unknown',itemId:'rations'}}}});
 });
});
