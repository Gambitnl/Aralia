/** The existing household projector exposes a job without changing the person or earned history. */
import {describe,it,expect} from 'vitest';
import {generateHousehold} from '../../town/household';
import {rootSeedPath} from '../../seedPath';
import {householdNpcFacts,reconcileHouseholdNpc} from '../householdNpc';
import type {RichNPC} from '../../../../types/world';
describe('structured household occupation',()=>{
 it('exposes the exact household occupation without parsing prose',()=>{const home=generateHousehold(rootSeedPath(42),'b7',4,'cottage');home.members[0].occupation='innkeeper';expect(householdNpcFacts(home,0,7,'Town').occupation).toBe('innkeeper');});
 it('preserves capabilities, memory and stable identity when updating the source projection',()=>{const home=generateHousehold(rootSeedPath(42),'b7',4,'cottage');home.members[0].occupation='innkeeper';const npc={id:'earned-id',biography:{age:44,family:[],classId:'fighter',level:3},memory:{interactions:['earned']},stats:{hp:9},equippedItems:{},businessId:'saved-shop'} as unknown as RichNPC;const result=reconcileHouseholdNpc(npc,home,0,7,'Town');expect(result.occupation).toBe('innkeeper');expect(result.id).toBe(npc.id);expect(result.memory).toBe(npc.memory);expect(result.stats).toBe(npc.stats);expect(result.businessId).toBe(npc.businessId);expect(result.biography.classId).toBe('fighter');expect(reconcileHouseholdNpc(result,home,0,7,'Town')).toBe(result);});
});
