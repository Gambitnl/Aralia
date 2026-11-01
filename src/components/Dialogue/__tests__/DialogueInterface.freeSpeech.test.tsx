/** Players must be able to ask an unscripted follow-up without paying a topic's
 * costs or inventing its rewards. Pending, failed and abandoned speech keeps
 * the existing reply lifetime and never leaks a draft to another resident. */
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {DialogueInterface} from '../DialogueInterface';
import type {GameState,NPC,PlayerCharacter} from '../../../types';
import type {DialogueSession} from '../../../types/dialogue';

const mechanics=vi.hoisted(()=>({process:vi.fn()}));
vi.mock('../../../services/dialogueService',()=>({getAvailableTopics:()=>[],processTopicSelection:mechanics.process}));
const props=(id='faelan')=>({isOpen:true,session:{npcId:id,discussedTopicIds:[],contactStatus:'returning'} as DialogueSession,
    gameState:{npcMemory:{}} as unknown as GameState,npc:{id,name:id,baseDescription:'A local priest.'} as NPC,
    playerCharacter:{id:'sana',abilityScores:{Charisma:10}} as PlayerCharacter,
    onClose:vi.fn(),onUpdateSession:vi.fn(),onTopicOutcome:vi.fn(),onGenerateResponse:vi.fn()});
const say=(words:string)=>{fireEvent.change(screen.getByRole('textbox',{name:'Say something'}),{target:{value:words}});fireEvent.click(screen.getByRole('button',{name:/^Speak$/}));};

describe('resident follow-up speech',()=>{
    beforeEach(()=>vi.clearAllMocks());
    it('asks in the player’s own words through the existing reply path without executing topic mechanics',async()=>{
        const p=props();p.onGenerateResponse.mockResolvedValue('I have not seen that chamber.');render(<DialogueInterface {...p}/>);
        say('  I returned from the undercity. Have you been there?  ');
        expect(await screen.findByText('I have not seen that chamber.')).toBeInTheDocument();
        expect(p.onGenerateResponse.mock.calls[0][0]).toBe('I returned from the undercity. Have you been there?');
        expect(mechanics.process).not.toHaveBeenCalled();expect(p.onTopicOutcome).not.toHaveBeenCalled();expect(p.onUpdateSession).not.toHaveBeenCalled();
        expect(screen.getByRole('textbox',{name:'Say something'})).toHaveValue('');
    });
    it('does not submit empty words',()=>{const p=props();render(<DialogueInterface {...p}/>);say('   ');expect(p.onGenerateResponse).not.toHaveBeenCalled();});
    it('keeps one pending speech request and allows ending it',async()=>{
        let finish!:(text:string)=>void;const p=props();p.onGenerateResponse.mockReturnValue(new Promise<string>(r=>{finish=r;}));render(<DialogueInterface {...p}/>);
        say('Can you help me understand the temple history?');fireEvent.click(screen.getByRole('button',{name:/^Speak$/}));
        expect(p.onGenerateResponse).toHaveBeenCalledOnce();expect(screen.getByRole('textbox',{name:'Say something'})).toBeDisabled();
        fireEvent.click(screen.getByTestId('dialogue-end-conversation'));
        expect(p.onGenerateResponse.mock.calls[0][1].aborted).toBe(true);
        await act(async()=>finish('A reply after leaving.'));expect(screen.queryByText('A reply after leaving.')).not.toBeInTheDocument();
    });
    it('retains a failed question and retries just that speech without mechanical effects',async()=>{
        const p=props();p.onGenerateResponse.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('Tell me what you saw.');render(<DialogueInterface {...p}/>);
        say('What could grow below the town?');expect(await screen.findByRole('alert')).toHaveTextContent('Your words are kept');
        expect(screen.getByRole('textbox',{name:'Say something'})).toHaveValue('What could grow below the town?');
        fireEvent.click(screen.getByRole('button',{name:'Retry reply'}));expect(await screen.findByText('Tell me what you saw.')).toBeInTheDocument();
        expect(p.onGenerateResponse.mock.calls.map(c=>c[0])).toEqual(['What could grow below the town?','What could grow below the town?']);
        expect(p.onTopicOutcome).not.toHaveBeenCalled();expect(mechanics.process).not.toHaveBeenCalled();
    });
    it('clears another resident’s unsent question on speaker change',()=>{
        const p=props(),view=render(<DialogueInterface {...p}/>);fireEvent.change(screen.getByRole('textbox',{name:'Say something'}),{target:{value:'Do you remember your predecessor?'}});
        view.rerender(<DialogueInterface {...props('sten')}/>);expect(screen.getByRole('textbox',{name:'Say something'})).toHaveValue('');
    });
    it('does not discard a newly drafted question when retrying an earlier failed reply',async()=>{
        const p=props();p.onGenerateResponse.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('I do not know.');render(<DialogueInterface {...p}/>);
        say('Do you know that account?');await screen.findByRole('alert');
        fireEvent.change(screen.getByRole('textbox',{name:'Say something'}),{target:{value:'What about the temple?'}});
        fireEvent.click(screen.getByRole('button',{name:'Retry reply'}));await screen.findByText('I do not know.');
        expect(screen.getByRole('textbox',{name:'Say something'})).toHaveValue('What about the temple?');
    });
    it('keeps authored graph conversations on their existing choices',()=>{
        const p=props();render(<DialogueInterface {...p} dialogueGraph={{id:'g',startNodeId:'start',nodes:{start:{id:'start',type:'end',text:'This authored scene ends here.'}}} as never}/>);
        expect(screen.queryByRole('textbox',{name:'Say something'})).not.toBeInTheDocument();
    });
});
