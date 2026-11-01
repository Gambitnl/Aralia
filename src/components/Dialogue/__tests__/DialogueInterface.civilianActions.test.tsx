/** The mounted dialogue must present civilian actions honestly while retaining authored companion offers. */
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {DialogueInterface} from '../DialogueInterface';
import type {GameState,NPC,PlayerCharacter} from '../../../types';
import type {DialogueSession} from '../../../types/dialogue';
const props=(established=false)=>{const npc={id:'cob',name:'Cob Hartdown',role:'civilian',baseDescription:'A household child, age 13.',initialPersonalityPrompt:'Cob lives with his family.',worldforgeHousehold:{memberId:'b1:child:0',burgId:675,signature:'source'}} as unknown as NPC;return{isOpen:true,session:{npcId:npc.id,discussedTopicIds:[]} as DialogueSession,npc,gameState:{gameTime:new Date('0351-01-03T16:00:00Z'),generatedNpcs:{cob:npc},npcMemory:{cob:{disposition:100}},companions:established?{cob:{id:'cob',inParty:false}}:{},activeRumors:[],worldBusinesses:{},inventory:[],gold:20,questLog:[],discoveryLog:[]} as unknown as GameState,playerCharacter:{id:'sana',abilityScores:{Charisma:10}} as PlayerCharacter,onClose:vi.fn(),onUpdateSession:vi.fn(),onGenerateResponse:vi.fn(),onInvite:vi.fn()}};
describe('civilian conversation actions',()=>{
 it('does not advertise invented wares or a casual party invitation',()=>{const p=props();render(<DialogueInterface {...p}/>);expect(screen.queryByRole('button',{name:'Show me your wares.'})).not.toBeInTheDocument();expect(screen.queryByTestId('dialogue-invite-to-party')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Who are you?'})).toBeInTheDocument();fireEvent.click(screen.getByTestId('dialogue-end-conversation'));expect(p.onClose).toHaveBeenCalledOnce();expect(p.onGenerateResponse).not.toHaveBeenCalled()});
 it('retains an invitation when the same person has an established companion record',()=>{const p=props(true);render(<DialogueInterface {...p}/>);fireEvent.click(screen.getByTestId('dialogue-invite-to-party'));expect(p.onInvite).toHaveBeenCalledWith('cob')});
});


it('shows the admitted saved age rather than the old biography without rewriting it',()=>{
 const p=props(),before=p.npc.baseDescription;
 p.gameState.townSim={675:{burgId:675,villagers:{9:{occupantId:9,name:p.npc.name,householdMemberId:'b1:child:0',homePlotId:1,bornDay:-6568,race:'Human',parentIds:[],childIds:[],wealth:50}},chronicle:{burgId:675,events:[],nextEventId:1},lastSimDay:3,nextVillagerId:10}};
 render(<DialogueInterface {...p}/>);
 expect(screen.getByText('Cob Hartdown, age 18.')).toBeInTheDocument();
 expect(screen.queryByText(before!)).not.toBeInTheDocument();
 expect(p.npc.baseDescription).toBe(before);
});
