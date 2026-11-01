/** A household biography is not an authored offer to abandon home for adventuring.
 * Existing companion stories and explicit encounter-rescue consent retain their routes. */
import {describe,it,expect} from 'vitest';
import {evaluateRecruitOffer} from '../recruitConsent';
import type {GameState} from '../../../types';
const npc={id:'cob',name:'Cob',role:'civilian',biography:{age:13,classId:'commoner'},worldforgeHousehold:{memberId:'home:child:0',burgId:675,signature:'source'}};
const state=(companions:unknown={})=>({generatedNpcs:{cob:{...npc,worldforgeHousehold:{...npc.worldforgeHousehold}}},npcMemory:{cob:{disposition:100}},companions} as unknown as GameState);
describe('household recruitment needs a companion opportunity',()=>{
 it('does not recruit an ordinary child merely because disposition is high',()=>{expect(evaluateRecruitOffer(npc,state()).willJoin).toBe(false)});
 it('does not turn the same resident into an adventurer through a paid hire',()=>{expect(evaluateRecruitOffer(npc,state(),{hire:true}).willJoin).toBe(false)});
 it('preserves an established companion story with the same source identity',()=>{const companions={cob:{id:'cob',inParty:false,relationships:{player:{approval:200}}}};expect(evaluateRecruitOffer(npc,state(companions)).willJoin).toBe(true)});
 it('preserves the explicit rescue producer rather than treating it as a casual invitation',()=>{expect(evaluateRecruitOffer(npc,state(),{autoAccept:true}).willJoin).toBe(true)});
 it('preserves legacy non-household generated recruit opportunities',()=>{const s=state();delete (s.generatedNpcs.cob as unknown as Record<string,unknown>).worldforgeHousehold;expect(evaluateRecruitOffer({id:'cob',name:'A scout'},s).willJoin).toBe(true)});
});
