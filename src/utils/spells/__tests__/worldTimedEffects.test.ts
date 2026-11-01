import {describe, expect, it} from 'vitest';
import type {GameState, PlayerCharacter} from '../../../types';
import type {StatusEffect} from '../../../types/effects';
import {createMockPlayerCharacter, createMockSpellSlots} from '../../core/factories';
import {advanceWorldTimedEffects} from '../worldTimedEffects';
import {getMovementSpeed} from '../../character/partyStatUtils';

const castTime = new Date('0351-01-01T09:04:10Z');
const at = (seconds:number) => new Date(castTime.getTime() + seconds * 1000);
const marker = ():StatusEffect => ({
    id:'ooc-longstrider-eldrin',name:'Longstrider',type:'buff',duration:600,
    effect:{type:'condition'},source:'Longstrider',sourceCasterId:'eldrin',
    description:'Longstrider, cast outside combat.',
});
const actor = (effects:StatusEffect[] = [marker()]):PlayerCharacter => createMockPlayerCharacter({
    id:'eldrin',name:'Eldrin Smith',speed:30,hp:7,maxHp:10,conditions:['exhaustion'],
    spellSlots:createMockSpellSlots({level_1:{current:1,max:2}}),statusEffects:effects,
});
const messages = ():GameState['messages'] => [{
    id:1,text:'Eldrin Smith casts Longstrider.',sender:'system',timestamp:castTime,
}];

describe('world-clock spell continuity', () => {
    it('materializes the paid legacy cast only from its original system event', () => {
        const character=actor(),before=structuredClone(character);
        const result=advanceWorldTimedEffects([character],messages(),at(39))[0];
        expect(result.statusEffects?.[0]).toMatchObject({
            effect:{type:'stat_modifier',stat:'speed',value:10},duration:594,
            worldTime:{appliedAtMs:castTime.getTime(),expiresAtMs:at(3600).getTime()},
        });
        expect(result.spellSlots).toEqual(character.spellSlots);
        expect(result.hp).toBe(7);expect(result.conditions).toEqual(['exhaustion']);
        expect(result.speed).toBe(30);expect(getMovementSpeed(result)).toBe(35);
        expect(character).toEqual(before);
    });

    it('never starts a new hour when the same source is processed again', () => {
        const first=advanceWorldTimedEffects([actor()],messages(),at(39));
        const again=advanceWorldTimedEffects(first,messages(),at(39));
        expect(again).toBe(first);
        expect(advanceWorldTimedEffects(first,messages(),at(3599))[0].statusEffects?.[0].worldTime?.expiresAtMs).toBe(at(3600).getTime());
    });

    it('removes an already expired legacy marker without a fresh benefit or refund', () => {
        const result=advanceWorldTimedEffects([actor()],messages(),at(3600))[0];
        expect(result.statusEffects).toEqual([]);
        expect(result.spellSlots?.level_1.current).toBe(1);
        expect(getMovementSpeed(result)).toBe(25);
    });

    it('preserves unknown legacy casts instead of guessing an expiry', () => {
        const party=[actor()];
        expect(advanceWorldTimedEffects(party,[],at(39))).toBe(party);
    });

    it('does not treat a player-authored line as a system cast', () => {
        const party=[actor()],untrusted=messages();untrusted[0]={...untrusted[0],sender:'player'};
        expect(advanceWorldTimedEffects(party,untrusted,at(39))).toBe(party);
    });

    it('does not infer a cast from a future event', () => {
        const party=[actor()];
        expect(advanceWorldTimedEffects(party,messages(),at(-1))).toBe(party);
    });

    it('leaves custom and already-counted turn records under their existing owner', () => {
        const custom={...marker(),id:'custom-longstrider'},counted={...marker(),duration:599};
        const party=[actor([custom,counted])];
        expect(advanceWorldTimedEffects(party,messages(),at(39))).toBe(party);
    });

    it('keeps permanent conditions and injuries when an hour spell expires', () => {
        const permanent:StatusEffect={id:'scar',name:'Persistent injury',type:'debuff',duration:0,effect:{type:'condition'}};
        const result=advanceWorldTimedEffects([actor([marker(),permanent])],messages(),at(8*3600))[0];
        expect(result.statusEffects).toEqual([permanent]);
        expect(result.statusEffects?.[0]).toBe(permanent);
        expect(result.conditions).toEqual(['exhaustion']);expect(result.hp).toBe(7);
    });

    it('has the same exact expiry after native-shaped JSON and batched or short waits', () => {
        const original=advanceWorldTimedEffects([actor()],messages(),at(39));
        const loaded=JSON.parse(JSON.stringify(original)) as PlayerCharacter[];
        let stepped=loaded;
        for(let second=40;second<=3600;second+=10)stepped=advanceWorldTimedEffects(stepped,[],at(second));
        stepped=advanceWorldTimedEffects(stepped,[],at(3600));
        expect(stepped).toEqual(advanceWorldTimedEffects(loaded,[],at(3600)));
        expect(stepped[0].statusEffects).toEqual([]);
        expect(stepped[0].spellSlots?.level_1.current).toBe(1);
    });

    it('keeps the remaining source active when another overlapping cast expires', () => {
        const first:StatusEffect={...marker(),effect:{type:'stat_modifier',stat:'speed',value:10},worldTime:{appliedAtMs:castTime.getTime(),expiresAtMs:at(3600).getTime()}};
        const later:StatusEffect={...first,id:'ooc-longstrider-other',sourceCasterId:'other',worldTime:{appliedAtMs:at(60).getTime(),expiresAtMs:at(3660).getTime()}};
        const party=[actor([first,later])];
        expect(getMovementSpeed(party[0])).toBe(35);
        const once=advanceWorldTimedEffects(party,[],at(3600));
        expect(once[0].statusEffects?.map(e=>e.id)).toEqual([later.id]);
        expect(getMovementSpeed(once[0])).toBe(35);
        expect(getMovementSpeed(advanceWorldTimedEffects(once,[],at(3660))[0])).toBe(25);
    });
});
